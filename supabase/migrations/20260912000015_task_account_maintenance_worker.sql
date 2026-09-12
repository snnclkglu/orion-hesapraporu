-- Eski küçük fotoğrafın yeni büyük fotoğrafla tekrar bağlanması da engellenir.
create function account_avatar_pair_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null then
  if (select count(*) from storage.objects where bucket_id='account-avatars'
      and name in(new.avatar_path||'/64.webp',new.avatar_path||'/256.webp')
      and split_part(name,'/',1)=new.id::text and created_at>clock_timestamp()-interval '1 hour')<>2 then
   raise exception 'Fotoğrafın iki boyutu da yeniden yüklenmeli' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create trigger account_avatar_pair_guard before update on profiles for each row execute function account_avatar_pair_guard();
revoke all on function account_avatar_pair_guard() from public,anon,authenticated;

create or replace function account_cleanup_candidates() returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(x),'[]') from (
  select o.bucket_id,o.name from storage.objects o where o.created_at<clock_timestamp()-interval '25 hours' and (
   (o.bucket_id='account-avatars'
    and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(64|256)\.webp$'
    and not exists(select 1 from profiles p where o.name in(p.avatar_path||'/256.webp',p.avatar_path||'/64.webp'))
    -- Aynı fotoğrafın diğer boyutu yeniyse iki dosya da bu çalışmada korunur.
    and not exists(select 1 from storage.objects s where s.bucket_id=o.bucket_id
      and split_part(s.name,'/',1)=split_part(o.name,'/',1) and split_part(s.name,'/',2)=split_part(o.name,'/',2)
      and s.created_at>=clock_timestamp()-interval '25 hours'))
   or (o.bucket_id='feedback-images'
    and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-2]-[0-9a-f-]{36}\.webp$'
    and not exists(select 1 from app_feedback_attachments a join app_feedback f on f.id=a.feedback_id
      where a.object_path=o.name and (f.submitted_at is not null or f.created_at>clock_timestamp()-interval '24 hours')))
  ) order by o.created_at,o.id limit 500
 ) x
$$;

create table account_maintenance_runs (
 id uuid primary key default gen_random_uuid(), started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz, mode text not null check(mode in('dry-run','apply')),
 status text not null default 'running' check(status in('running','completed','failed','expired')),
 candidates integer not null default 0 check(candidates between 0 and 500),
 removed integer not null default 0 check(removed between 0 and candidates),
 failed integer not null default 0 check(failed between 0 and candidates),
 drafts integer not null default 0 check(drafts>=0), error_code text check(length(error_code)<=80)
);
create table account_maintenance_lease (
 singleton boolean primary key default true check(singleton), run_id uuid references account_maintenance_runs(id), expires_at timestamptz
);
insert into account_maintenance_lease(singleton) values(true);
alter table account_maintenance_runs enable row level security;
alter table account_maintenance_lease enable row level security;
revoke all on account_maintenance_runs,account_maintenance_lease from public,anon,authenticated;
create policy maintenance_admin_read on account_maintenance_runs for select to authenticated using(is_admin());
grant select on account_maintenance_runs to authenticated;

create function account_maintenance_begin(p_apply boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare lease account_maintenance_lease; rid uuid; items jsonb;
begin
 select * into lease from account_maintenance_lease where singleton for update;
 if lease.expires_at>clock_timestamp() then return jsonb_build_object('busy',true); end if;
 update account_maintenance_runs set status='expired',finished_at=clock_timestamp(),error_code='lease_expired' where id=lease.run_id and status='running';
 items:=account_cleanup_candidates();
 insert into account_maintenance_runs(mode,candidates) values(case when p_apply then 'apply' else 'dry-run' end,jsonb_array_length(items)) returning id into rid;
 -- Çalışan 80 saniyede durur; bu kira Edge çalışma üst sınırından da uzundur.
 update account_maintenance_lease set run_id=rid,expires_at=clock_timestamp()+interval '15 minutes' where singleton;
 return jsonb_build_object('busy',false,'run_id',rid,'items',items);
end $$;

create function account_maintenance_recheck(p_run uuid,p_items jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare items jsonb;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>50 then raise exception 'Geçersiz bakım grubu' using errcode='23514'; end if;
 if not exists(select 1 from account_maintenance_lease l join account_maintenance_runs r on r.id=l.run_id
   where l.singleton and l.run_id=p_run and l.expires_at>clock_timestamp() and r.status='running' and r.mode='apply') then
   raise exception 'Bakım kiralaması geçersiz' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(c),'[]') into items from jsonb_array_elements(account_cleanup_candidates()) c where p_items @> jsonb_build_array(c);
 return items;
end $$;

create function account_maintenance_finish(p_run uuid,p_removed integer,p_failed integer,p_error text default null) returns void language plpgsql security definer set search_path=public as $$
declare n integer:=0; r account_maintenance_runs;
begin
 perform 1 from account_maintenance_lease where singleton and run_id=p_run and expires_at>clock_timestamp() for update;
 if not found then raise exception 'Bakım kiralaması geçersiz' using errcode='42501'; end if;
 select * into r from account_maintenance_runs where id=p_run and status='running' for update;
 if not found or p_removed<0 or p_failed<0 or p_removed+p_failed>r.candidates or (r.mode='dry-run' and p_removed<>0) then
  raise exception 'Geçersiz bakım sonucu' using errcode='23514';
 end if;
 if r.mode='apply' and p_error is null and p_failed=0 then n:=account_cleanup_drafts(); end if;
 update account_maintenance_runs set finished_at=clock_timestamp(),status=case when p_error is null and p_failed=0 then 'completed' else 'failed' end,
   removed=p_removed,failed=p_failed,drafts=n,error_code=p_error where id=p_run;
 update account_maintenance_lease set run_id=null,expires_at=null where singleton;
end $$;
revoke all on function account_maintenance_begin(boolean),account_maintenance_recheck(uuid,jsonb),account_maintenance_finish(uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function account_maintenance_begin(boolean),account_maintenance_recheck(uuid,jsonb),account_maintenance_finish(uuid,integer,integer,text) to service_role;

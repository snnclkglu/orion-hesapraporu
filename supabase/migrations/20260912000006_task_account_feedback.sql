-- Profil öz-servisi ve yönetime özel geri bildirim; mevcut kimlikler korunur.
alter table public.profiles add column avatar_path text, add column account_version integer not null default 1;
create table public.profile_private_details (
 user_id uuid primary key references profiles(id) on delete cascade,
 phone text not null default '' check(length(phone)<=40),
 note text not null default '' check(length(note)<=500)
);
alter table public.profile_private_details enable row level security;
create policy account_private_read on profile_private_details for select to authenticated using(user_id=auth.uid() or is_admin());
revoke all on profile_private_details from anon,authenticated;
grant select on profile_private_details to authenticated;

create or replace function public.guard_profile_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.id<>old.id or new.created_at<>old.created_at then raise exception 'Kimlik değiştirilemez' using errcode='42501'; end if;
 if not is_admin() and (new.role is distinct from old.role or new.title is distinct from old.title or to_jsonb(new)->'email' is distinct from to_jsonb(old)->'email') then raise exception 'Yönetici yetkisi gerekli' using errcode='42501'; end if;
 if new.full_name is distinct from old.full_name and length(trim(new.full_name)) not between 1 and 120 then raise exception 'Ad soyad gerekli' using errcode='23514'; end if;
 if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null and not exists(select 1 from storage.objects where bucket_id='account-avatars' and name=new.avatar_path||'/256.webp' and split_part(name,'/',1)=new.id::text and created_at>now()-interval '1 hour') then raise exception 'Fotoğraf bulunamadı veya yükleme süresi doldu' using errcode='23514'; end if;
 new.account_version:=old.account_version+1;
 return new;
end $$;
create function public.account_save(p_name text,p_phone text,p_note text,p_version integer) returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if auth.uid() is null or length(trim(p_name)) not between 1 and 120 or length(p_phone)>40 or length(p_note)>500 then raise exception 'Bilgileri kontrol edin' using errcode='23514'; end if;
 update profiles set full_name=p_name where id=auth.uid() and account_version=p_version returning account_version into n;
 if n is null then raise exception 'Profil değişti; yenileyin' using errcode='40001'; end if;
 insert into profile_private_details values(auth.uid(),p_phone,p_note) on conflict(user_id) do update set phone=excluded.phone,note=excluded.note;
 return n;
end $$;
revoke all on function account_save(text,text,text,integer) from public,anon;
grant execute on function account_save(text,text,text,integer) to authenticated;

create table public.app_feedback (
 id uuid primary key,
 user_id uuid not null references profiles(id),
 body text not null check(length(trim(body)) between 1 and 4000),
 category text not null default 'general' check(category in ('general','bug','idea','other')),
 section text not null default '' check(length(section)<=60),
 expected_files integer not null default 0 check(expected_files between 0 and 3),
 created_at timestamptz not null default now(), submitted_at timestamptz,
 read_at timestamptz,read_by uuid references profiles(id),archived_at timestamptz,
 version integer not null default 1
);
create table public.app_feedback_attachments (
 id uuid primary key default gen_random_uuid(),feedback_id uuid not null references app_feedback(id) on delete cascade,
 slot integer not null check(slot between 0 and 2),object_path text not null unique,
 name text not null check(length(name) between 1 and 200),bytes integer not null check(bytes between 1 and 10485760),
 unique(feedback_id,slot)
);
create table public.app_feedback_events (
 id uuid primary key default gen_random_uuid(),feedback_id uuid not null references app_feedback(id) on delete cascade,
 actor_id uuid not null references profiles(id),event text not null,created_at timestamptz not null default now()
);
create index feedback_queue_idx on app_feedback(submitted_at desc,id) where submitted_at is not null;
create index feedback_owner_idx on app_feedback(user_id,created_at desc);
alter table app_feedback enable row level security;
alter table app_feedback_attachments enable row level security;
alter table app_feedback_events enable row level security;
-- Yönetim alanları kullanıcıya kolon yetkisi üzerinden de kapalıdır.
create policy feedback_read on app_feedback for select to authenticated using(user_id=auth.uid() or (is_admin() and submitted_at is not null));
create policy feedback_attachment_read on app_feedback_attachments for select to authenticated using(exists(select 1 from app_feedback f where f.id=feedback_id and (f.user_id=auth.uid() or (is_admin() and f.submitted_at is not null))));
create policy feedback_event_read on app_feedback_events for select to authenticated using(is_admin());
revoke all on app_feedback,app_feedback_attachments,app_feedback_events from public,anon,authenticated;
grant select(id,user_id,body,category,section,expected_files,created_at,submitted_at) on app_feedback to authenticated;
grant select on app_feedback_attachments,app_feedback_events to authenticated;

create function public.feedback_begin(p_id uuid,p_body text,p_category text,p_section text,p_files integer) returns uuid language plpgsql security definer set search_path=public as $$
declare f app_feedback;
begin
 if auth.uid() is null then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('feedback/'||auth.uid()::text,0));
 select * into f from app_feedback where id=p_id for update;
 if found then
  if f.user_id<>auth.uid() then raise exception 'Yetki yok' using errcode='42501'; end if;
  if f.body<>p_body or f.category<>p_category or f.section<>p_section or f.expected_files<>p_files then raise exception 'Gönderi değişti; yeni gönderi başlatın' using errcode='40001'; end if;
  return p_id;
 end if;
 if (select count(*) from app_feedback where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Saatlik gönderim sınırına ulaştınız' using errcode='23514'; end if;
 insert into app_feedback(id,user_id,body,category,section,expected_files) values(p_id,auth.uid(),p_body,p_category,p_section,p_files);
 return p_id;
end $$;
create function public.feedback_attach(p_id uuid,p_slot integer,p_path text,p_name text,p_bytes integer) returns void language plpgsql security definer set search_path=public as $$
declare f app_feedback;
begin
 select * into f from app_feedback where id=p_id for update;
 if f.user_id is distinct from auth.uid() or auth.uid() is null then raise exception 'Yetki yok' using errcode='42501'; end if;
 if exists(select 1 from app_feedback_attachments where feedback_id=p_id and slot=p_slot) then return; end if;
 if f.submitted_at is not null or p_slot>=f.expected_files or f.created_at<now()-interval '24 hours' then raise exception 'Taslak süresi doldu veya gönderi kilitli' using errcode='23514'; end if;
 if p_path not like auth.uid()::text||'/'||p_id::text||'/'||p_slot::text||'-%' or not exists(select 1 from storage.objects where bucket_id='feedback-images' and name=p_path and created_at>now()-interval '1 hour') then raise exception 'Ek bulunamadı' using errcode='23514'; end if;
 insert into app_feedback_attachments(feedback_id,slot,object_path,name,bytes) values(p_id,p_slot,p_path,p_name,p_bytes);
end $$;
create function public.feedback_submit(p_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare f app_feedback;
begin
 select * into f from app_feedback where id=p_id for update;
 if f.user_id is distinct from auth.uid() or auth.uid() is null then raise exception 'Yetki yok' using errcode='42501'; end if;
 if f.submitted_at is not null then return p_id; end if;
 if f.created_at<now()-interval '24 hours' then raise exception 'Taslak süresi doldu; yeni gönderi başlatın' using errcode='23514'; end if;
 if (select count(*) from app_feedback_attachments where feedback_id=p_id)<>f.expected_files then raise exception 'Ekler tamamlanmadı' using errcode='23514'; end if;
 update app_feedback set submitted_at=now() where id=p_id;
 insert into app_feedback_events(feedback_id,actor_id,event) values(p_id,auth.uid(),'submitted');
 insert into notifications(user_id,kind,title,href,actor) select id,'app_feedback','Yeni geri bildirim','/admin/feedback/'||p_id,auth.uid() from profiles where role='admin';
 return p_id;
end $$;
create function public.feedback_manage(p_id uuid,p_action text,p_version integer) returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode='42501'; end if;
 if p_action not in ('read','unread','archive','restore') then raise exception 'Geçersiz işlem' using errcode='23514'; end if;
 update app_feedback set read_at=case p_action when 'read' then now() when 'unread' then null else read_at end,
 read_by=case p_action when 'read' then auth.uid() when 'unread' then null else read_by end,
 archived_at=case p_action when 'archive' then now() when 'restore' then null else archived_at end,version=version+1
 where id=p_id and version=p_version and submitted_at is not null;
 if not found then raise exception 'Kayıt değişti; yenileyin' using errcode='40001'; end if;
 insert into app_feedback_events(feedback_id,actor_id,event) values(p_id,auth.uid(),p_action);
end $$;
create function public.feedback_list(p_filters jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path=public as $$
declare management boolean:=coalesce((p_filters->>'admin')::boolean,false); result jsonb;
begin
 if auth.uid() is null or (management and not is_admin()) then raise exception 'Yetki yok' using errcode='42501'; end if;
 with filtered as (
 select f.*,p.full_name from app_feedback f join profiles p on p.id=f.user_id
 where f.submitted_at is not null and (management or f.user_id=auth.uid())
 and (not management or case when p_filters->>'archived'='true' then f.archived_at is not null else f.archived_at is null end)
 and (not management or p_filters->>'unread' is distinct from 'true' or f.read_at is null)
 and (coalesce(p_filters->>'q','')='' or task_search_fold(f.body||' '||p.full_name) like '%'||task_search_fold(p_filters->>'q')||'%')
 and (coalesce(p_filters->>'category','')='' or f.category=p_filters->>'category')
 and (coalesce(p_filters->>'user','')='' or f.user_id=(p_filters->>'user')::uuid)
 and (coalesce(p_filters->>'from','')='' or f.submitted_at>=(p_filters->>'from')::date)
 and (coalesce(p_filters->>'to','')='' or f.submitted_at<(p_filters->>'to')::date+interval '1 day')
 ), page as (select * from filtered order by submitted_at desc,id desc limit 25 offset least(greatest(coalesce((p_filters->>'page')::int,0),0),10000)*25)
 select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg((case when management then to_jsonb(page) else to_jsonb(page)-array['read_at','read_by','archived_at','version'] end)||jsonb_build_object('attachment_count',(select count(*) from app_feedback_attachments a where a.feedback_id=page.id))) from page),'[]'),
 'unread',case when management then (select count(*) from app_feedback where submitted_at is not null and read_at is null and archived_at is null) else 0 end) into result;
 return result;
end $$;
create function public.feedback_detail(p_id uuid,p_admin boolean default false) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare f app_feedback;
begin
 select * into f from app_feedback where id=p_id and submitted_at is not null;
 if not found or auth.uid() is null or (p_admin and not is_admin()) or (not p_admin and f.user_id<>auth.uid()) then raise exception 'Yetki yok' using errcode='42501'; end if;
 return jsonb_build_object('item',(case when p_admin then to_jsonb(f) else to_jsonb(f)-array['read_at','read_by','archived_at','version'] end)||jsonb_build_object('full_name',(select full_name from profiles where id=f.user_id)),
 'attachments',coalesce((select jsonb_agg(a) from app_feedback_attachments a where feedback_id=p_id),'[]'));
end $$;
revoke all on function feedback_begin(uuid,text,text,text,integer),feedback_attach(uuid,integer,text,text,integer),feedback_submit(uuid),feedback_manage(uuid,text,integer),feedback_list(jsonb),feedback_detail(uuid,boolean) from public,anon;
grant execute on function feedback_begin(uuid,text,text,text,integer),feedback_attach(uuid,integer,text,text,integer),feedback_submit(uuid),feedback_manage(uuid,text,integer),feedback_list(jsonb),feedback_detail(uuid,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('account-avatars','account-avatars',false,10485760,array['image/webp']),('feedback-images','feedback-images',false,10485760,array['image/webp']);
-- Dosyalar yalnız doğrulayıp yeniden kodlayan sunucudan yüklenir. Doğrudan yükleme izni yoktur.
create policy account_avatar_read on storage.objects for select to authenticated using(bucket_id='account-avatars' and exists(select 1 from profiles p where name in (p.avatar_path||'/256.webp',p.avatar_path||'/64.webp')));
create policy feedback_image_read on storage.objects for select to authenticated using(bucket_id='feedback-images' and exists(select 1 from app_feedback_attachments a join app_feedback f on f.id=a.feedback_id where a.object_path=name and (f.user_id=auth.uid() or (is_admin() and f.submitted_at is not null))));

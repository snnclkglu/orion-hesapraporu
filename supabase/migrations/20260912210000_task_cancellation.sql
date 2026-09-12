-- İptal kalıcı veri kaybı değildir; atama tek başına iptal yetkisi vermez.
alter table job_tasks add column cancelled_at timestamptz, add column cancelled_by uuid references profiles(id), add column cancellation_reason text, add column cancelled_previous_archived_at timestamptz;
alter table job_tasks add constraint task_cancellation_consistent check((cancelled_at is null and cancelled_by is null and cancellation_reason is null) or (cancelled_at is not null and cancelled_by is not null and length(trim(cancellation_reason)) between 3 and 500));
create index task_cancelled_lookup on job_tasks(cancelled_at desc) where cancelled_at is not null;
create table task_cancellation_events(
 id uuid primary key default gen_random_uuid(),task_id uuid not null references job_tasks(id),
 actor_id uuid not null references profiles(id),agent_name text,event text not null check(event in ('cancelled','reactivated')),
 reason text not null, snapshot jsonb not null,created_at timestamptz not null default clock_timestamp()
);
create index task_cancellation_history on task_cancellation_events(task_id,created_at desc);
alter table task_cancellation_events enable row level security;
create policy task_cancellation_read on task_cancellation_events for select to authenticated using(task_access(task_id,auth.uid()));
revoke all on task_cancellation_events from public,anon,authenticated;
grant select on task_cancellation_events to authenticated;
create function task_cancellation_immutable() returns trigger language plpgsql set search_path=public as $$
begin raise exception 'İptal geçmişi değiştirilemez' using errcode='42501';end $$;
create trigger task_cancellation_immutable before update or delete on task_cancellation_events for each row execute function task_cancellation_immutable();

create function task_cancellation_permission(p_task uuid,p_actor uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=p_actor) and exists(select 1 from job_tasks t where t.id=p_task and
 ((t.visibility in ('private','direct') and t.created_by=p_actor) or
 (t.visibility='job' and exists(select 1 from profiles where id=p_actor and role='admin')) or
 (t.visibility='team' and exists(select 1 from task_boards b join task_teams team on team.id=b.team_id where b.id=t.board_id and team.archived_at is null and
 (team.owner_id=p_actor or exists(select 1 from profiles where id=p_actor and role='admin') or exists(select 1 from task_team_members m where m.team_id=team.id and m.user_id=p_actor and m.role='manager'))))))
$$;
create function task_cancellation_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid:=coalesce(auth.uid(),nullif(current_setting('orion.task_actor',true),'')::uuid); operation text:=current_setting('orion.task_cancellation',true);
begin
 if tg_op='INSERT' then
  if new.cancelled_at is not null or new.cancelled_by is not null or new.cancellation_reason is not null or new.cancelled_previous_archived_at is not null then raise exception 'İptal alanları yalnız iptal komutuyla değişir' using errcode='42501';end if;
 else
  if (new.cancelled_at is distinct from old.cancelled_at or new.cancelled_by is distinct from old.cancelled_by or new.cancellation_reason is distinct from old.cancellation_reason or new.cancelled_previous_archived_at is distinct from old.cancelled_previous_archived_at) and (coalesce(operation,'') not in ('cancel','reactivate') or not task_cancellation_permission(old.id,actor)) then raise exception 'İptal alanları yalnız yetkili iptal komutuyla değişir' using errcode='42501';end if;
  if old.cancelled_at is not null and operation is distinct from 'reactivate' then raise exception 'Önce görevi İptal edilenler bölümünden geri yükleyin' using errcode='23514';end if;
 end if;
 return new;
end $$;
create trigger task_zzz_cancellation_before before insert or update on job_tasks for each row execute function task_cancellation_guard();

do $$ declare definition text;
begin
 definition:=pg_get_functiondef('task_access(uuid,uuid,boolean)'::regprocedure);
 if strpos(definition,'t.id=p_task and')=0 then raise exception 'Görev erişimi beklenen sürümde değil';end if;
 execute replace(definition,'t.id=p_task and','t.id=p_task and (not p_write or t.cancelled_at is null or (current_setting(''orion.task_cancellation'',true)=''reactivate'' and task_cancellation_permission(t.id,p_actor))) and');
 definition:=pg_get_functiondef('task_snapshot(jsonb,uuid)'::regprocedure);
 if strpos(definition,'and (p_filters?''updatedSince'' or case when')=0 then raise exception 'Görev sorgusu beklenen sürümde değil';end if;
 definition:=replace(definition,'and (p_filters?''updatedSince'' or case when','and (p_filters?''updatedSince'' or case when p_filters->>''period''=''cancelled'' then t.cancelled_at is not null else t.cancelled_at is null end) and (p_filters->>''period''=''cancelled'' or p_filters?''updatedSince'' or case when');
 definition:=replace(definition,'task_access(t.id,p_actor,true) as can_edit,','task_access(t.id,p_actor,true) as can_edit, task_cancellation_permission(t.id,p_actor) as can_cancel,');
 execute definition;
 definition:=pg_get_functiondef('task_detail(uuid,uuid)'::regprocedure);
 definition:=replace(definition,'''can_edit'',task_access(t.id,p_actor,true))','''can_edit'',task_access(t.id,p_actor,true),''can_cancel'',task_cancellation_permission(t.id,p_actor))');
 definition:=replace(definition,'''comments'',coalesce(','''cancellations'',coalesce((select jsonb_agg(e order by e.created_at desc) from (select id,actor_id,agent_name,event,reason,created_at from task_cancellation_events where task_id=p_id order by created_at desc limit 100) e),''[]''), ''comments'',coalesce(');
 execute definition;
end $$;

alter function task_command(text,jsonb,uuid,text,text) rename to task_command_without_cancellation;
revoke all on function task_command_without_cancellation(text,jsonb,uuid,text,text) from public,anon,authenticated,service_role;
create function task_command(p_operation text,p_data jsonb,p_actor uuid default auth.uid(),p_agent text default null,p_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare t job_tasks; before_task jsonb; previous task_commands; result jsonb; principal_id text; reason text; recipient uuid;
begin
 if p_operation not in ('cancel','reactivate') then return task_command_without_cancellation(p_operation,p_data,p_actor,p_agent,p_key);end if;
 if p_actor is null or not exists(select 1 from profiles where id=p_actor) or (auth.role() is distinct from 'service_role' and (p_actor is distinct from auth.uid() or p_agent is not null)) then raise exception 'Oturum gerekli' using errcode='42501';end if;
 if p_agent is not null and (p_key is null or length(p_key) not between 8 and 128) then raise exception 'Tekrar anahtarı gerekli' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('task-dependency-graph',0));
 principal_id:=p_actor::text||'/'||coalesce(p_agent,'human');
 if p_key is not null then
  perform pg_advisory_xact_lock(hashtextextended(principal_id||'/'||p_key,0));
  select * into previous from task_commands where principal=principal_id and key=p_key;
  if found then
   if previous.payload<>jsonb_build_object('op',p_operation,'data',p_data) then raise exception 'Tekrar anahtarı çakıştı' using errcode='40001';end if;
   if not task_cancellation_permission((previous.result->'task'->>'id')::uuid,p_actor) then raise exception 'İptal yetkisi yok' using errcode='42501';end if;
   return previous.result||'{"replayed":true}'::jsonb;
  end if;
 end if;
 select * into t from job_tasks where id=(p_data->>'id')::uuid for update;
 if not found or not task_cancellation_permission(t.id,p_actor) then raise exception 'İptal veya geri yükleme yetkiniz yok' using errcode='42501';end if;
 if t.version is distinct from (p_data->>'version')::int then raise exception 'Görev değişti' using errcode='40001';end if;
 before_task:=to_jsonb(t);
 perform set_config('orion.task_actor',p_actor::text,true);perform set_config('orion.task_agent',coalesce(p_agent,''),true);perform set_config('orion.task_command','yes',true);perform set_config('orion.task_cancellation',p_operation,true);
 if p_operation='cancel' then
  if t.cancelled_at is not null then raise exception 'Görev zaten İptal edilenler bölümünde' using errcode='23514';end if;
  reason:=trim(p_data->>'reason');
  if reason is null or length(reason) not between 3 and 500 then raise exception 'İptal nedeni 3–500 karakter olmalı' using errcode='23514';end if;
  if exists(select 1 from task_dependencies where task_id=t.id or waits_for=t.id) or exists(select 1 from job_tasks where goal_id=t.id and cancelled_at is null) then raise exception 'İptal etmeden önce bağlı görevleri ve bekleme bağlantılarını düzenleyin' using errcode='23514';end if;
  update job_tasks set cancelled_at=clock_timestamp(),cancelled_by=p_actor,cancellation_reason=reason,cancelled_previous_archived_at=archived_at,archived_at=coalesce(archived_at,clock_timestamp()) where id=t.id returning * into t;
 else
  if t.cancelled_at is null then raise exception 'Görev İptal edilenler bölümünde değil' using errcode='23514';end if;
  reason:='Görev geri yüklendi';
  update job_tasks set cancelled_at=null,cancelled_by=null,cancellation_reason=null,archived_at=cancelled_previous_archived_at,cancelled_previous_archived_at=null where id=t.id returning * into t;
 end if;
 insert into task_cancellation_events(task_id,actor_id,agent_name,event,reason,snapshot) values(t.id,p_actor,p_agent,case when p_operation='cancel' then 'cancelled' else 'reactivated' end,reason,before_task);
 insert into task_events(task_id,actor_id,agent_name,event,changes) values(t.id,p_actor,p_agent,case when p_operation='cancel' then 'cancelled' else 'reactivated' end,jsonb_build_object('cancelled_at',jsonb_build_object('before',before_task->'cancelled_at','after',t.cancelled_at),'cancellation_reason',jsonb_build_object('before',null,'after',reason)));
 if t.visibility in ('team','job') then
  for recipient in select id from profiles p where p.id<>p_actor and task_cancellation_permission(t.id,p.id) loop
   insert into task_inbox(user_id,task_id,event) values(recipient,t.id,case when p_operation='cancel' then 'cancelled' else 'reactivated' end);
  end loop;
 end if;
 result:=jsonb_build_object('task',to_jsonb(t)||jsonb_build_object('can_edit',task_access(t.id,p_actor,true),'can_cancel',true));
 if p_key is not null then insert into task_commands(principal,key,payload,result) values(principal_id,p_key,jsonb_build_object('op',p_operation,'data',p_data),result);end if;
 perform set_config('orion.task_cancellation','',true);
 return result;
end $$;
revoke all on function task_command(text,jsonb,uuid,text,text),task_cancellation_permission(uuid,uuid),task_cancellation_guard(),task_cancellation_immutable() from public,anon;
grant execute on function task_command(text,jsonb,uuid,text,text),task_cancellation_permission(uuid,uuid) to authenticated,service_role;
do $$ begin
 if to_regclass('public.agent_clients') is not null then
  alter table agent_clients drop constraint if exists agent_clients_scopes_check;
  alter table agent_clients add constraint agent_clients_scopes_check check(cardinality(scopes) between 1 and 13 and scopes <@ array['offers:read','offers:draft:write','email:read','email:draft:write','email:publish','email:test:send','email:send','tasks:read','tasks:write','tasks:comment','tasks:context:read','tasks:tags:manage','tasks:cancel']::text[]);
 end if;
end $$;

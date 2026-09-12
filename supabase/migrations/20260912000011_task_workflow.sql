-- Günlük çalışma: kişisel görünümler, kontrol listesi, tekrar ve bekleme bağlantısı.
alter table job_tasks add column checklist jsonb not null default '[]';
alter table job_tasks add column recurrence jsonb;
alter table job_tasks add column recurrence_parent uuid unique references job_tasks(id);
create function task_flow_valid(items jsonb, rule jsonb) returns boolean language plpgsql immutable set search_path=public as $$
begin
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)>30 then return false; end if;
 if exists(select 1 from jsonb_array_elements(items) i where jsonb_typeof(i)<>'object' or length(trim(i->>'text')) not between 1 and 180 or i->>'text' is null or jsonb_typeof(i->'done') is distinct from 'boolean' or i->>'id' is null or i->>'id' !~ '^[0-9a-f-]{36}$') then return false; end if;
 if (select count(*)<>count(distinct i->>'id') from jsonb_array_elements(items)i) then return false; end if;
 if rule is not null and (jsonb_typeof(rule)<>'object' or coalesce(rule->>'mode','') not in ('weekly','monthly','after') or coalesce(rule->>'interval','') !~ '^[0-9]{1,2}$' or (rule->>'interval')::int not between 1 and 52 or (rule?'day' and (coalesce(rule->>'day','') !~ '^[0-9]{1,2}$' or (rule->>'day')::int not between 1 and 31))) then return false; end if;
 return true;
exception when others then return false;
end $$;
alter table job_tasks add constraint task_flow_validity check(task_flow_valid(checklist,recurrence));
create table task_dependencies(task_id uuid references job_tasks(id) on delete cascade, waits_for uuid references job_tasks(id) on delete cascade, primary key(task_id,waits_for),check(task_id<>waits_for));
create index task_dependency_target on task_dependencies(waits_for);
alter table task_dependencies enable row level security;
create policy task_dependency_read on task_dependencies for select to authenticated using(task_access(task_id,auth.uid()) and task_access(waits_for,auth.uid()));
revoke all on task_dependencies from public,anon,authenticated;
grant select on task_dependencies to authenticated;
create table task_saved_views(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id),name text not null check(length(trim(name)) between 1 and 60),filters jsonb not null,created_at timestamptz not null default now(),unique(user_id,name));
alter table task_saved_views enable row level security;
create policy task_view_owner on task_saved_views for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on task_saved_views from public,anon,authenticated;
grant select,delete on task_saved_views to authenticated;
create function task_save_view(p_name text,p_filters jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'/saved-views',0));
 if length(p_filters::text)>2000 or jsonb_typeof(p_filters)<>'object' then raise exception 'Geçersiz görünüm' using errcode='23514'; end if;
 if (select count(*) from task_saved_views where user_id=auth.uid())>=20 and not exists(select 1 from task_saved_views where user_id=auth.uid() and name=trim(p_name)) then raise exception 'En fazla 20 görünüm' using errcode='23514'; end if;
 insert into task_saved_views(user_id,name,filters) values(auth.uid(),trim(p_name),p_filters) on conflict(user_id,name) do update set filters=excluded.filters returning id into result;
 return result;
end $$;
revoke all on function task_save_view(text,jsonb) from public,anon;
grant execute on function task_save_view(text,jsonb) to authenticated;

create function task_next_date(d date, finished date, rule jsonb) returns date language plpgsql immutable set search_path=public as $$
declare base date; n int := (rule->>'interval')::int; anchor int;
begin
 if rule->>'mode'='after' then return finished+n; end if;
 if rule->>'mode'='weekly' then return d+7*n; end if;
 base:=(date_trunc('month',d)+make_interval(months=>n))::date;
 anchor:=coalesce((rule->>'day')::int,extract(day from d)::int);
 return base+least(anchor,extract(day from (base+interval '1 month - 1 day'))::int)-1;
end $$;

create function task_flow_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('task-dependency-graph',0));
 if new.recurrence is not null and (new.kind<>'task' or new.due_date is null) then raise exception 'Tekrar için görev türü ve termin gerekli' using errcode='23514'; end if;
 if tg_op='INSERT' and new.recurrence_parent is not null and pg_trigger_depth()<2 then raise exception 'Tekrar bağlantısı sunucuda oluşturulur' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if new.recurrence_parent is distinct from old.recurrence_parent then raise exception 'Tekrar geçmişi değiştirilemez' using errcode='42501'; end if;
  if (new.visibility is distinct from old.visibility or new.board_id is distinct from old.board_id or (new.visibility='job' and new.job_id is distinct from old.job_id) or (new.visibility in ('private','direct') and new.assignee is distinct from old.assignee)) and exists(select 1 from task_dependencies where task_id=new.id or waits_for=new.id) then raise exception 'Önce bekleme bağlantılarını kaldırın' using errcode='23514'; end if;
  if new.status='done' and old.status<>'done' and exists(select 1 from task_dependencies d join job_tasks t on t.id=d.waits_for where d.task_id=new.id and t.status<>'done') then raise exception 'Ön koşul görevleri henüz tamamlanmadı' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger task_z_flow_before before insert or update on job_tasks for each row execute function task_flow_guard();
-- İç tekrar eklemesi eski sahipliği korur; istemci bu yolu tetikleyemez.
do $patch$ declare definition text;
begin
 definition:=pg_get_functiondef('public.task_guard()'::regprocedure);
 if strpos(definition,'if actor is null then')=0 then raise exception 'Görev koruma gövdesi beklenen sürümde değil'; end if;
 definition:=replace(definition,'if actor is null then',E'if tg_op=\'INSERT\' and pg_trigger_depth()>1 and new.recurrence_parent is not null then\n select created_by into actor from job_tasks where id=new.recurrence_parent and status=\'done\' and recurrence is not null;\n end if;\n if actor is null then');
 execute definition;
end $patch$;
do $patch$ declare definition text;
begin
 definition:=pg_get_functiondef('public.task_record_event()'::regprocedure);
 if strpos(definition,'''kind'',''goal_id''')=0 then raise exception 'Geçmiş gövdesi beklenen sürümde değil'; end if;
 execute replace(definition,'''kind'',''goal_id''','''kind'',''goal_id'',''checklist'',''recurrence''');
end $patch$;

create function task_flow_after() returns trigger language plpgsql security definer set search_path=public as $$
declare child uuid; current_command text; candidate job_tasks;
begin
 if old.status<>'done' and new.status='done' then
  if new.recurrence is not null and new.archived_at is null and task_access(new.id,new.created_by,true)
    and (new.board_id is null or exists(select 1 from task_boards where id=new.board_id and archived_at is null))
    and (new.visibility<>'team' or new.assignee is null or exists(select 1 from task_team_members m join task_boards b on b.team_id=m.team_id where b.id=new.board_id and m.user_id=new.assignee)) then
   select id into child from job_tasks where recurrence_parent=new.id;
   if child is null then
    current_command:=current_setting('orion.task_command',true);perform set_config('orion.task_command','yes',true);
    insert into job_tasks(title,note,created_by,assignee,visibility,board_id,job_id,kind,status,priority,due_date,recurrence,recurrence_parent,checklist)
    values(new.title,new.note,new.created_by,new.assignee,new.visibility,new.board_id,new.job_id,'task','todo',new.priority,
      task_next_date(new.due_date,(now() at time zone 'Europe/Istanbul')::date,new.recurrence),new.recurrence,new.id,
      coalesce((select jsonb_agg(i||'{"done":false}'::jsonb) from jsonb_array_elements(new.checklist)i),'[]')) returning id into child;
    perform set_config('orion.task_command',coalesce(current_command,''),true);
    insert into task_events(task_id,actor_id,event,changes) values(new.id,coalesce(auth.uid(),new.created_by),'recurrence_created',jsonb_build_object('next_task',jsonb_build_object('before',null,'after',child)));
   end if;
  end if;
  for candidate in select t.* from task_dependencies d join job_tasks t on t.id=d.task_id where d.waits_for=new.id and t.status<>'done' and t.archived_at is null and t.assignee is not null loop
   if task_access(candidate.id,candidate.assignee) and task_access(new.id,candidate.assignee) and not exists(select 1 from task_dependencies d join job_tasks b on b.id=d.waits_for where d.task_id=candidate.id and b.status<>'done') then
    insert into task_inbox(user_id,task_id,event) values(candidate.assignee,candidate.id,'unblocked') on conflict do nothing;
   end if;
  end loop;
 end if;
 return new;
end $$;
create trigger task_flow_after after update on job_tasks for each row execute function task_flow_after();
create unique index task_unblocked_once on task_inbox(user_id,task_id,event) where event='unblocked';

alter function task_command(text,jsonb,uuid,text,text) rename to task_command_base;
revoke all on function task_command_base(text,jsonb,uuid,text,text) from public,anon,authenticated,service_role;
create function task_command(p_operation text,p_data jsonb,p_actor uuid default auth.uid(),p_agent text default null,p_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare t job_tasks; v_id uuid:=(p_data->>'id')::uuid; previous task_commands; result jsonb; principal_id text; target uuid; rule jsonb; old_waiting int;
begin
 perform pg_advisory_xact_lock(hashtextextended('task-dependency-graph',0));
 if p_operation<>'workflow' then return task_command_base(p_operation,p_data,p_actor,p_agent,p_key); end if;
 if p_actor is null or (auth.role() is distinct from 'service_role' and (p_actor is distinct from auth.uid() or p_agent is not null)) or not task_access(v_id,p_actor,true) then raise exception 'Görev yetkisi yok' using errcode='42501'; end if;
 if p_agent is not null and (p_key is null or length(p_key) not between 8 and 128) then raise exception 'Tekrar anahtarı gerekli' using errcode='23514'; end if;
 principal_id:=p_actor::text||'/'||coalesce(p_agent,'human');
 if p_key is not null then
  perform pg_advisory_xact_lock(hashtextextended(principal_id||'/'||p_key,0));
  select * into previous from task_commands where principal=principal_id and key=p_key;
  if found then
   if previous.payload<>jsonb_build_object('op',p_operation,'data',p_data) then raise exception 'Tekrar anahtarı çakıştı' using errcode='40001'; end if;
   return previous.result||'{"replayed":true}'::jsonb;
  end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('task-dependency-graph',0));
 select * into t from job_tasks where id=v_id for update;
 if t.version is distinct from (p_data->>'version')::int then raise exception 'Görev değişti' using errcode='40001'; end if;
 if p_data?'waiting_for' then
  select count(*) into old_waiting from task_dependencies where task_id=t.id;
  if jsonb_typeof(p_data->'waiting_for')<>'array' or jsonb_array_length(p_data->'waiting_for')>10 then raise exception 'En fazla 10 ön koşul' using errcode='23514'; end if;
  delete from task_dependencies where task_id=t.id;
  for target in select value::uuid from jsonb_array_elements_text(p_data->'waiting_for') loop
   if target=t.id or not task_access(target,p_actor) or not exists(select 1 from job_tasks d where d.id=target and d.visibility=t.visibility and d.board_id is not distinct from t.board_id and (t.visibility<>'job' or d.job_id=t.job_id) and (t.visibility not in ('private','direct') or (d.created_by=t.created_by and d.assignee is not distinct from t.assignee))) then raise exception 'Ön koşul aynı paylaşım kapsamında olmalı' using errcode='23514'; end if;
   if exists(with recursive chain(id) as(select target union select d.waits_for from task_dependencies d join chain c on c.id=d.task_id) select 1 from chain where id=t.id) then raise exception 'Döngü oluşturan bağlantı' using errcode='23514'; end if;
   insert into task_dependencies values(t.id,target) on conflict do nothing;
  end loop;
 end if;
 rule:=case when p_data?'recurrence' then nullif(p_data->'recurrence','null'::jsonb) else t.recurrence end;
 if rule->>'mode'='monthly' and not rule?'day' then rule:=rule||jsonb_build_object('day',extract(day from t.due_date)::int); end if;
 perform set_config('orion.task_actor',p_actor::text,true);perform set_config('orion.task_agent',coalesce(p_agent,''),true);perform set_config('orion.task_command','yes',true);
 update job_tasks set checklist=coalesce(p_data->'checklist',checklist),recurrence=rule where id=t.id returning * into t;
 if p_data?'waiting_for' then insert into task_events(task_id,actor_id,agent_name,event,changes) values(t.id,p_actor,p_agent,'workflow_updated',jsonb_build_object('waiting_count',jsonb_build_object('before',old_waiting,'after',(select count(*) from task_dependencies where task_id=t.id)))); end if;
 result:=jsonb_build_object('task',to_jsonb(t));
 if p_key is not null then insert into task_commands(principal,key,payload,result) values(principal_id,p_key,jsonb_build_object('op',p_operation,'data',p_data),result); end if;
 return result;
end $$;
revoke all on function task_command(text,jsonb,uuid,text,text) from public,anon;
grant execute on function task_command(text,jsonb,uuid,text,text) to authenticated,service_role;

create function task_flow_detail(p_id uuid,p_actor uuid default auth.uid()) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if (auth.role() is distinct from 'service_role' and p_actor is distinct from auth.uid()) or not task_access(p_id,p_actor) then raise exception 'Yetki yok' using errcode='42501'; end if;
 return jsonb_build_object('waiting_for',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'status',t.status)) from task_dependencies d join job_tasks t on t.id=d.waits_for where d.task_id=p_id and task_access(t.id,p_actor)),'[]'),
 'next_task',(select id from job_tasks where recurrence_parent=p_id and task_access(id,p_actor)));
end $$;
revoke all on function task_flow_detail(uuid,uuid) from public,anon;
grant execute on function task_flow_detail(uuid,uuid) to authenticated,service_role;

create table task_reminder_preferences(user_id uuid primary key references profiles(id),enabled boolean not null default true,quiet_start int not null default 19 check(quiet_start between 0 and 23),quiet_end int not null default 8 check(quiet_end between 0 and 23));
alter table task_reminder_preferences enable row level security;
create policy task_reminder_owner on task_reminder_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update on task_reminder_preferences to authenticated;
create table task_reminder_receipts(user_id uuid references profiles(id),task_id uuid references job_tasks(id),due_date date,primary key(user_id,task_id,due_date));
alter table task_reminder_receipts enable row level security;
revoke all on task_reminder_receipts from public,anon,authenticated;
create function task_refresh_reminders() returns integer language plpgsql security definer set search_path=public as $$
declare pref task_reminder_preferences; current_hour int:=extract(hour from now() at time zone 'Europe/Istanbul'); n int;
begin
 if auth.uid() is null then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 select * into pref from task_reminder_preferences where user_id=auth.uid();
 if not found then pref.enabled:=true;pref.quiet_start:=19;pref.quiet_end:=8;end if;
 if not pref.enabled or (pref.quiet_start>pref.quiet_end and (current_hour>=pref.quiet_start or current_hour<pref.quiet_end)) or (pref.quiet_start<pref.quiet_end and current_hour>=pref.quiet_start and current_hour<pref.quiet_end) then return 0; end if;
 with candidates as(select t.id,t.due_date from job_tasks t where assignee=auth.uid() and status<>'done' and archived_at is null and due_date<=(now() at time zone 'Europe/Istanbul')::date+1 and task_access(t.id,auth.uid()) and not exists(select 1 from task_reminder_receipts r where r.user_id=auth.uid() and r.task_id=t.id and r.due_date=t.due_date) order by due_date limit 100), added as(
 insert into task_reminder_receipts(user_id,task_id,due_date) select auth.uid(),id,due_date from candidates on conflict do nothing returning task_id)
 insert into task_inbox(user_id,task_id,event) select auth.uid(),task_id,'due_soon' from added;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function task_refresh_reminders() from public,anon;
grant execute on function task_refresh_reminders() to authenticated;

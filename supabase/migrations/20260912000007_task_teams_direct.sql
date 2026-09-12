-- Ekip yönetimi mevcut uygulama yöneticilerine aittir. Kişiye özel atama ayrı kapsamdır.
alter table task_teams add column description text not null default '' check(length(description)<=500), add column archived_at timestamptz, add column version integer not null default 1;
alter table task_boards add column is_default boolean not null default false;
create unique index task_team_default_board on task_boards(team_id) where is_default;
insert into task_boards(name,owner_id,team_id,is_default) select 'GENEL',owner_id,id,true from task_teams;
alter table job_tasks drop constraint job_tasks_visibility_check;
alter table job_tasks add constraint job_tasks_visibility_check check(visibility in ('private','team','job','direct'));
alter table job_tasks drop constraint task_scope_consistent;
alter table job_tasks add constraint task_scope_consistent check(visibility='private' or (visibility='job' and job_id is not null) or (visibility='team' and board_id is not null) or (visibility='direct' and assignee is not null and board_id is null and goal_id is null and kind<>'goal'));
create table task_team_events(id uuid primary key default gen_random_uuid(),team_id uuid not null references task_teams(id),actor_id uuid not null references profiles(id),event text not null,changes jsonb not null default '{}',created_at timestamptz not null default now());
alter table task_team_events enable row level security;
create policy team_event_read on task_team_events for select to authenticated using(is_admin());
revoke all on task_team_events from public,anon,authenticated;
grant select on task_team_events to authenticated;
create or replace function task_team_access(p_team uuid,p_actor uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=p_actor) and exists(select 1 from task_teams t where t.id=p_team and (not p_write or t.archived_at is null) and (t.owner_id=p_actor or exists(select 1 from profiles where id=p_actor and role='admin') or exists(select 1 from task_team_members m where m.team_id=t.id and m.user_id=p_actor and (not p_write or m.role in ('manager','editor')))))
$$;
create or replace function task_access(p_task uuid,p_actor uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=p_actor) and exists(select 1 from job_tasks t where t.id=p_task and ((t.visibility='private' and t.created_by=p_actor) or (t.visibility='direct' and p_actor in (t.created_by,t.assignee)) or t.visibility='job' or (t.visibility='team' and task_board_access(t.board_id,p_actor,p_write))))
$$;

create or replace function public.task_snapshot(p_filters jsonb default '{}',p_actor uuid default auth.uid()) returns jsonb
 language plpgsql stable security definer set search_path=public as $$
declare result jsonb; today date:=(now() at time zone 'Europe/Istanbul')::date;
begin
 if p_actor is null or not exists(select 1 from profiles where id=p_actor) or (auth.role() is distinct from 'service_role' and p_actor is distinct from auth.uid()) then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 with filtered as (
 select t.id,t.updated_at
 from job_tasks t left join jobs j on j.id=t.job_id
 where ((t.visibility='private' and t.created_by=p_actor) or (t.visibility='direct' and p_actor in (t.created_by,t.assignee)) or t.visibility='job' or (t.visibility='team' and task_board_access(t.board_id,p_actor)))
 and (p_filters?'updatedSince' or case when p_filters->>'period'='archived' then t.archived_at is not null else t.archived_at is null end)
 and (coalesce(p_filters->>'view','mine')<>'mine' or t.assignee=p_actor or (t.visibility='private' and t.created_by=p_actor) or (p_filters->>'sent'='true' and t.visibility='direct' and t.created_by=p_actor))
 and (p_filters->>'view' is distinct from 'team' or t.visibility not in ('private','direct'))
 and (not p_filters?'team' or exists(select 1 from task_boards tb where tb.id=t.board_id and tb.team_id=(p_filters->>'team')::uuid))
and (not p_filters?'board' or t.board_id=(p_filters->>'board')::uuid)
 and (p_filters->>'sent' is distinct from 'true' or (t.visibility='direct' and t.created_by=p_actor))
 and (p_filters->>'unassigned' is distinct from 'true' or t.assignee is null)
 and (not p_filters?'assignee' or t.assignee=(p_filters->>'assignee')::uuid)
 and (not p_filters?'job' or t.job_id=(p_filters->>'job')::uuid)
 and (not p_filters?'status' or t.status=p_filters->>'status')
 and (not p_filters?'priority' or t.priority=p_filters->>'priority')
 and (not p_filters?'sourceRef' or t.source_ref=p_filters->>'sourceRef')
and (not p_filters?'updatedSince' or t.updated_at>=(p_filters->>'updatedSince')::timestamptz)
 and (coalesce(p_filters->>'q','')='' or task_search_fold(t.title) like '%'||task_search_fold(p_filters->>'q')||'%' or j.job_no ilike '%'||(p_filters->>'q')||'%')
 and (case p_filters->>'period' when 'today' then t.due_date<=today and t.status<>'done' when 'upcoming' then t.due_date>today and t.status<>'done' when 'done' then t.status='done' else true end)
 ), page_ids as (select * from filtered where not p_filters?'cursor' or (updated_at,id)<(split_part(p_filters->>'cursor','|',1)::timestamptz,split_part(p_filters->>'cursor','|',2)::uuid) order by updated_at desc,id desc limit 50), page as (
 select t.*,j.job_no,task_access(t.id,p_actor,true) as can_edit,
 (select count(*) from job_tasks g where g.goal_id=t.id and g.archived_at is null and task_access(g.id,p_actor)) as goal_total,
 (select count(*) from job_tasks g where g.goal_id=t.id and g.archived_at is null and g.status='done' and task_access(g.id,p_actor)) as goal_done
 from page_ids p join job_tasks t on t.id=p.id left join jobs j on j.id=t.job_id
)
 select jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(page) order by page.updated_at desc,page.id desc) from page),'[]'), 'total',(select count(*) from filtered)) into result;
 return result||jsonb_build_object(
 'boards',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('can_edit',task_board_access(b.id,p_actor,true)) order by b.name) from task_boards b where task_board_access(b.id,p_actor)),'[]'),
 'goals',coalesce((select jsonb_agg(g) from (select * from job_tasks where kind='goal' and archived_at is null and task_access(id,p_actor) order by updated_at desc limit 100) g),'[]'),
 'teams',coalesce((select jsonb_agg(t order by name) from task_teams t where task_team_access(t.id,p_actor)),'[]'),
 'members',coalesce((select jsonb_agg(m) from task_team_members m where task_team_access(m.team_id,p_actor)),'[]'),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',id,'full_name',full_name,'role',role) order by full_name) from profiles),'[]'),
 'jobs',coalesce((select jsonb_agg(j) from (select id,job_no,title from jobs where coalesce(p_filters->>'q','')='' or job_no ilike '%'||(p_filters->>'q')||'%' order by job_no desc limit 100) j),'[]'),
 'inbox',coalesce((select jsonb_agg(n) from (select i.*,t.title from task_inbox i join job_tasks t on t.id=i.task_id where i.user_id=p_actor and task_access(i.task_id,p_actor) order by i.created_at desc limit 50) n),'[]'));
end $$;



create or replace function public.task_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid := coalesce(auth.uid(),nullif(current_setting('orion.task_actor',true),'')::uuid); b task_boards; a text; team_lock uuid;
begin
 if actor is null then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 for team_lock in select distinct team_id from task_boards where id in (new.board_id,case when tg_op='UPDATE' then old.board_id end) and team_id is not null order by team_id loop
  perform pg_advisory_xact_lock(hashtextextended('team/'||team_lock::text,0));
 end loop;
 if tg_op='UPDATE' then
  if not task_access(old.id,actor,true) then raise exception 'Görev yetkisi yok' using errcode='42501'; end if;
  if new.created_by<>old.created_by or new.id<>old.id then raise exception 'Sahip değiştirilemez' using errcode='42501'; end if;
  if (new.visibility<>old.visibility or new.board_id is distinct from old.board_id) and old.created_by<>actor then raise exception 'Paylaşımı yalnız sahibi değiştirir' using errcode='42501'; end if;
  if old.visibility='team' and new.visibility in ('private','direct') then raise exception 'Ekip görevi özel kapsama taşınamaz' using errcode='23514'; end if;
  if old.visibility='direct' and new.assignee is distinct from old.assignee and old.created_by<>actor then raise exception 'Yeniden atamayı gönderen yapabilir' using errcode='42501'; end if;
  new.version:=old.version+1; new.created_at:=old.created_at; new.done_by:=old.done_by; new.previous_status:=old.previous_status; new.source_ref:=old.source_ref;
  if new.status<>old.status then
   if new.status='done' then new.previous_status:=case when old.status='done' then old.previous_status else old.status end; new.done_at:=now(); new.done_by:=actor;
   else new.done_at:=null; new.done_by:=null; end if;
  elsif new.done_at is distinct from old.done_at then
   new.status:=case when new.done_at is null then old.previous_status else 'done' end;
   new.done_by:=case when new.done_at is not null then actor end; if new.done_at is not null then new.done_at:=now(); end if;
  end if;
 else
  if new.created_by<>actor then raise exception 'Sahip geçersiz' using errcode='42501'; end if;
  -- İş hub'ının eski formları görünürlük göndermez.
  if new.job_id is not null and current_setting('orion.task_command',true) is distinct from 'yes' then new.visibility:='job'; end if;
  if new.status='done' then new.done_at:=now(); new.done_by:=actor; end if;
 end if;
 if new.board_id is not null then
  select * into b from task_boards where id=new.board_id;
  if not task_board_access(b.id,actor,true) or (b.archived_at is not null and (tg_op='INSERT' or new.board_id is distinct from old.board_id)) then raise exception 'Pano yetkisi yok' using errcode='42501'; end if;
  if (b.team_id is null and new.visibility<>'private') or (b.team_id is not null and new.visibility<>'team') then raise exception 'Pano kapsamı uyuşmuyor' using errcode='23514'; end if;
 end if;
 if new.visibility='private' and new.assignee is not null and new.assignee<>new.created_by then raise exception 'Atama için ekip panosu seçin' using errcode='23514'; end if;
 if new.visibility='team' and not task_board_access(new.board_id,actor,true) then raise exception 'Ekip yetkisi yok' using errcode='42501'; end if;
 if new.visibility='team' and new.assignee is not null and not exists(select 1 from task_team_members m join task_boards tb on tb.team_id=m.team_id where tb.id=new.board_id and m.user_id=new.assignee) and (tg_op='INSERT' or new.assignee is distinct from old.assignee or new.board_id is distinct from old.board_id) then raise exception 'Kişi bu panoya erişemiyor' using errcode='23514'; end if;
 if new.goal_id is not null and (new.kind<>'task' or not exists(select 1 from job_tasks g where g.id=new.goal_id and g.kind='goal' and g.id<>new.id and task_access(g.id,actor,true) and g.visibility=new.visibility and g.board_id is not distinct from new.board_id)) then raise exception 'Hedef aynı kapsamda olmalı' using errcode='23514'; end if;
 if length(trim(new.title)) not between 1 and 300 or length(new.note)>20000 then raise exception 'Başlık veya açıklama sınırı aşıldı' using errcode='23514'; end if;
 return new;
end $$;



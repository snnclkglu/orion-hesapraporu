-- PANEL: mevcut görev kimliklerini koruyan ortak görev alanı.
-- Migration tek transaction içinde uygulanır; eski kişisel defter salt okunur kalır.
create table public.task_teams (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 owner_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.task_team_members (
 team_id uuid not null references public.task_teams(id) on delete cascade,
 user_id uuid not null references public.profiles(id), role text not null default 'editor' check(role in ('manager','editor','viewer')),
 primary key(team_id,user_id)
);
create table public.task_boards (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 kind text not null default 'task' check(kind in ('task','note','goal')),
 owner_id uuid not null references public.profiles(id), team_id uuid references public.task_teams(id),
 archived_at timestamptz, created_at timestamptz not null default now()
);
alter table public.job_tasks alter column job_id drop not null;
alter table public.job_tasks add column visibility text not null default 'job' check(visibility in ('private','team','job')),
 add column board_id uuid references public.task_boards(id),
 add column kind text not null default 'task' check(kind in ('task','note','goal')),
 add column status text not null default 'todo' check(status in ('todo','doing','waiting','done')),
 add column previous_status text not null default 'todo' check(previous_status in ('todo','doing','waiting')),
 add column priority text not null default 'none' check(priority in ('none','low','medium','high','urgent')),
 add column version integer not null default 1,
 add column archived_at timestamptz,
 add column goal_id uuid references public.job_tasks(id),
 add column source_ref text;
update public.job_tasks set status='done' where done_at is not null;
alter table public.job_tasks alter column visibility set default 'private';
alter table public.job_tasks add constraint task_done_consistent check((status='done')=(done_at is not null));
alter table public.job_tasks add constraint task_scope_consistent check(
 (visibility='private') or (visibility='job' and job_id is not null) or (visibility='team' and board_id is not null));

-- Eski kişisel satırların kimliği veya içeriği çakışırsa geçiş durur, veri ezilmez.
insert into public.job_tasks(id,title,note,assignee,due_date,sort,done_at,done_by,created_by,created_at,updated_at,visibility,status)
 select id,title,note,user_id,due_date,sort,done_at,case when done_at is not null then user_id end,user_id,created_at,updated_at,'private',case when done_at is null then 'todo' else 'done' end from public.user_todos;
alter table public.user_todos rename to user_todos_legacy;
revoke all on public.user_todos_legacy from authenticated,anon;
create view public.user_todos with (security_invoker=true) as
 select id,created_by as user_id,title,note,due_date,done_at,sort,created_at,updated_at from public.job_tasks
 where visibility='private' and board_id is null and kind='task' and archived_at is null with local check option;
grant select,insert,update on public.user_todos to authenticated;

create table public.task_comments (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.job_tasks(id),
 author_id uuid not null references public.profiles(id), body text not null check(length(trim(body)) between 1 and 4000),
 mentions uuid[] not null default '{}', created_at timestamptz not null default now()
);
create table public.task_events (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.job_tasks(id),
 actor_id uuid not null references public.profiles(id), agent_name text, event text not null,
 changes jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.task_attachments (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.job_tasks(id),
 name text not null, object_path text not null unique, mime_type text not null, bytes integer not null check(bytes between 1 and 20971520),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.task_inbox (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 task_id uuid not null references public.job_tasks(id), event text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.task_commands (
 principal text not null, key text not null, payload jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(principal,key)
);
create table public.task_rate_limits (principal text primary key, window_at timestamptz not null, count integer not null);
create index task_workspace_owner on public.job_tasks(created_by,updated_at desc,id);
create index task_workspace_board on public.job_tasks(board_id,archived_at,sort);
create index task_workspace_due on public.job_tasks(assignee,due_date) where archived_at is null;
create index task_workspace_goal on public.job_tasks(goal_id);
create index task_comment_time on public.task_comments(task_id,created_at);
create index task_event_time on public.task_events(task_id,created_at);
create index task_inbox_user on public.task_inbox(user_id,created_at desc);
create unique index task_source_unique on public.job_tasks(created_by,source_ref) where source_ref is not null;

create function public.task_team_access(p_team uuid,p_actor uuid,p_write boolean default false) returns boolean
 language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=p_actor) and (
 exists(select 1 from task_teams where id=p_team and owner_id=p_actor)
 or exists(select 1 from profiles where id=p_actor and role='admin')
 or exists(select 1 from task_team_members where team_id=p_team and user_id=p_actor and (not p_write or role in ('manager','editor'))));
$$;
create function public.task_board_access(p_board uuid,p_actor uuid,p_write boolean default false) returns boolean
 language sql stable security definer set search_path=public as $$
 select exists(select 1 from task_boards b where b.id=p_board and
 ((b.team_id is null and b.owner_id=p_actor) or (b.team_id is not null and task_team_access(b.team_id,p_actor,p_write))));
$$;
create function public.task_access(p_task uuid,p_actor uuid,p_write boolean default false) returns boolean
 language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=p_actor) and exists(select 1 from job_tasks t where t.id=p_task and (
 (t.visibility='private' and t.created_by=p_actor)
 or (t.visibility='job') or (t.visibility='team' and task_board_access(t.board_id,p_actor,p_write))));
$$;

alter table public.task_teams enable row level security;
alter table public.task_team_members enable row level security;
alter table public.task_boards enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_events enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_inbox enable row level security;
alter table public.task_commands enable row level security;
alter table public.task_rate_limits enable row level security;
create policy team_read on public.task_teams for select to authenticated using(task_team_access(id,auth.uid()));
create policy team_member_read on public.task_team_members for select to authenticated using(task_team_access(team_id,auth.uid()));
create policy board_read on public.task_boards for select to authenticated using(task_board_access(id,auth.uid()));
create policy comment_read on public.task_comments for select to authenticated using(task_access(task_id,auth.uid()));
create policy event_read on public.task_events for select to authenticated using(task_access(task_id,auth.uid()));
create policy attachment_read on public.task_attachments for select to authenticated using(task_access(task_id,auth.uid()));
create policy inbox_read on public.task_inbox for select to authenticated using(user_id=auth.uid() and task_access(task_id,auth.uid()));
create policy inbox_update on public.task_inbox for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy job_tasks_select on public.job_tasks;
drop policy job_tasks_update on public.job_tasks;
drop policy job_tasks_insert on public.job_tasks;
drop policy job_tasks_delete on public.job_tasks;
create policy task_read on public.job_tasks for select to authenticated using(task_access(id,auth.uid()));
create policy task_update on public.job_tasks for update to authenticated using(task_access(id,auth.uid(),true)) with check(task_access(id,auth.uid(),true));
create policy task_insert on public.job_tasks for insert to authenticated with check(created_by=auth.uid());

-- Eski yazma yolları dahil tüm görev değişiklikleri doğrulanır ve geçmişe yazılır.
create function public.task_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid := coalesce(auth.uid(),nullif(current_setting('orion.task_actor',true),'')::uuid); b task_boards; a text;
begin
 if actor is null then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if not task_access(old.id,actor,true) then raise exception 'Görev yetkisi yok' using errcode='42501'; end if;
  if new.created_by<>old.created_by or new.id<>old.id then raise exception 'Sahip değiştirilemez' using errcode='42501'; end if;
  if new.visibility<>old.visibility and old.created_by<>actor then raise exception 'Paylaşımı yalnız sahibi değiştirir' using errcode='42501'; end if;
  new.version:=old.version+1;
  if new.status<>old.status then
   if new.status='done' then new.previous_status:=case when old.status='done' then old.previous_status else old.status end; new.done_at:=now(); new.done_by:=actor;
   else new.done_at:=null; new.done_by:=null; end if;
  elsif new.done_at is distinct from old.done_at then
   new.status:=case when new.done_at is null then old.previous_status else 'done' end;
   new.done_by:=case when new.done_at is not null then actor end;
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
 if new.visibility='team' and new.assignee is not null and not task_board_access(new.board_id,new.assignee) then raise exception 'Kişi bu panoya erişemiyor' using errcode='23514'; end if;
 if new.goal_id is not null and not exists(select 1 from job_tasks g where g.id=new.goal_id and g.kind='goal' and g.id<>new.id and task_access(g.id,actor,true) and g.visibility=new.visibility and g.board_id is not distinct from new.board_id) then raise exception 'Hedef aynı kapsamda olmalı' using errcode='23514'; end if;
 if length(trim(new.title)) not between 1 and 300 or length(new.note)>20000 then raise exception 'Başlık veya açıklama sınırı aşıldı' using errcode='23514'; end if;
 return new;
end $$;
create trigger task_workspace_guard before insert or update on public.job_tasks for each row execute function public.task_guard();
create function public.task_record_event() returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid:=coalesce(auth.uid(),nullif(current_setting('orion.task_actor',true),'')::uuid); changes jsonb; ev text;
begin
 ev:=case when tg_op='INSERT' then 'created' else 'updated' end;
 select coalesce(jsonb_object_agg(n.key,jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old)->n.key end,'after',n.value)),'{}') into changes
 from jsonb_each(to_jsonb(new)) n where n.key in ('title','note','status','priority','assignee','due_date','board_id','visibility','archived_at','kind','goal_id') and (tg_op='INSERT' or n.value is distinct from to_jsonb(old)->n.key);
 insert into task_events(task_id,actor_id,agent_name,event,changes) values(new.id,actor,nullif(current_setting('orion.task_agent',true),''),ev,changes);
 if new.assignee is not null and new.assignee<>actor and (tg_op='INSERT' or new.assignee is distinct from old.assignee) then
  insert into task_inbox(user_id,task_id,event) values(new.assignee,new.id,'assigned');
 end if;
 return new;
end $$;
create trigger task_workspace_event after insert or update on public.job_tasks for each row execute function public.task_record_event();

-- Tek transaction: idempotency, sürüm kilidi, değişiklik ve geçmiş birlikte kesinleşir.
create function public.task_command(p_operation text,p_data jsonb,p_actor uuid default auth.uid(),p_agent text default null,p_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t job_tasks; result jsonb; prior task_commands; v_principal text; b task_boards; team task_teams; target uuid; member uuid;
begin
 if p_actor is null or not exists(select 1 from profiles where id=p_actor) then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 if auth.role() is distinct from 'service_role' and (p_actor is distinct from auth.uid() or p_agent is not null) then raise exception 'Aktör geçersiz' using errcode='42501'; end if;
 if p_agent is not null and (p_key is null or length(p_key) not between 8 and 128) then raise exception 'Tekrar anahtarı gerekli' using errcode='23514'; end if;
 perform set_config('orion.task_actor',p_actor::text,true);
 perform set_config('orion.task_agent',coalesce(p_agent,''),true);
 perform set_config('orion.task_command','yes',true);
 v_principal:=p_actor::text||'/'||coalesce(p_agent,'human');
 if p_key is not null then
  perform pg_advisory_xact_lock(hashtextextended(v_principal||'/'||p_key,0));
  select * into prior from task_commands where task_commands.principal=v_principal and key=p_key;
  if found then
   if prior.payload<>jsonb_build_object('op',p_operation,'data',p_data) then raise exception 'Tekrar anahtarı farklı istekle kullanıldı' using errcode='40001'; end if;
   return prior.result||'{"replayed":true}'::jsonb;
  end if;
 end if;
 if p_operation='create' then
  insert into job_tasks(title,note,created_by,assignee,job_id,board_id,visibility,kind,priority,due_date,source_ref,goal_id)
  values(p_data->>'title',coalesce(p_data->>'note',''),p_actor,nullif(p_data->>'assignee','')::uuid,nullif(p_data->>'job_id','')::uuid,nullif(p_data->>'board_id','')::uuid,coalesce(p_data->>'visibility','private'),coalesce(p_data->>'kind','task'),coalesce(p_data->>'priority','none'),nullif(p_data->>'due_date','')::date,nullif(p_data->>'source_ref',''),nullif(p_data->>'goal_id','')::uuid) returning * into t;
  result:=jsonb_build_object('task',to_jsonb(t));
 elsif p_operation in ('update','comment','attachment') then
  select * into t from job_tasks where id=(p_data->>'id')::uuid for update;
  if not found or not task_access(t.id,p_actor,true) then raise exception 'Görev bulunamadı veya yetki yok' using errcode='42501'; end if;
  if p_operation='update' then
   if (p_data->>'version')::int is distinct from t.version then raise exception 'Görev değişti; yenileyip tekrar deneyin' using errcode='40001'; end if;
   update job_tasks set
    title=case when p_data?'title' then p_data->>'title' else title end,
    note=case when p_data?'note' then p_data->>'note' else note end,
    assignee=case when p_data?'assignee' then (p_data->>'assignee')::uuid else assignee end,
    due_date=case when p_data?'due_date' then (p_data->>'due_date')::date else due_date end,
    priority=coalesce(p_data->>'priority',priority),status=coalesce(p_data->>'status',status),
    visibility=coalesce(p_data->>'visibility',visibility),kind=coalesce(p_data->>'kind',kind),
    job_id=case when p_data?'job_id' then (p_data->>'job_id')::uuid else job_id end,
    board_id=case when p_data?'board_id' then (p_data->>'board_id')::uuid else board_id end,
    goal_id=case when p_data?'goal_id' then (p_data->>'goal_id')::uuid else goal_id end,
    archived_at=case when p_data?'archived' then case when (p_data->>'archived')::boolean then now() end else archived_at end
   where id=t.id returning * into t;
   result:=jsonb_build_object('task',to_jsonb(t));
  elsif p_operation='comment' then
   insert into task_comments(task_id,author_id,body,mentions) values(t.id,p_actor,p_data->>'body',array(select jsonb_array_elements_text(coalesce(p_data->'mentions','[]'))::uuid));
   insert into task_events(task_id,actor_id,agent_name,event) values(t.id,p_actor,p_agent,'commented');
   for member in select distinct u from unnest(array[t.created_by,t.assignee]||array(select jsonb_array_elements_text(coalesce(p_data->'mentions','[]'))::uuid)) u where u is not null and u<>p_actor loop
    if task_access(t.id,member) then insert into task_inbox(user_id,task_id,event) values(member,t.id,'commented'); end if;
   end loop;
   result:='{"ok":true}';
  else
   if not exists(select 1 from storage.objects where bucket_id='task-attachments' and name=p_data->>'object_path' and split_part(name,'/',1)=t.id::text and split_part(name,'/',2)=p_actor::text) then raise exception 'Yüklenen dosya bulunamadı' using errcode='23514'; end if;
   insert into task_attachments(task_id,name,object_path,mime_type,bytes,created_by) values(t.id,p_data->>'name',p_data->>'object_path',p_data->>'mime_type',(p_data->>'bytes')::int,p_actor);
   insert into task_events(task_id,actor_id,agent_name,event) values(t.id,p_actor,p_agent,'attached');
   result:='{"ok":true}';
  end if;
 elsif p_operation='board.create' then
  target:=nullif(p_data->>'team_id','')::uuid;
  if target is not null and not task_team_access(target,p_actor,true) then raise exception 'Ekip yetkisi yok' using errcode='42501'; end if;
  insert into task_boards(name,kind,owner_id,team_id) values(p_data->>'name',coalesce(p_data->>'kind','task'),p_actor,target) returning * into b;
  result:=jsonb_build_object('board',to_jsonb(b));
 elsif p_operation='board.archive' then
  select * into b from task_boards where id=(p_data->>'id')::uuid;
  if b.owner_id is distinct from p_actor and not exists(select 1 from profiles where id=p_actor and role='admin' and b.team_id is not null) then raise exception 'Pano sahibi gerekli' using errcode='42501'; end if;
  update task_boards set archived_at=case when (p_data->>'archived')::boolean then now() end where id=b.id;
  result:='{"ok":true}';
 elsif p_operation='team.create' then
  insert into task_teams(name,owner_id) values(p_data->>'name',p_actor) returning * into team;
  insert into task_team_members(team_id,user_id,role) values(team.id,p_actor,'manager');
  result:=jsonb_build_object('team',to_jsonb(team));
 elsif p_operation='team.member' then
  target:=(p_data->>'team_id')::uuid;
  if not exists(select 1 from task_teams where id=target and owner_id=p_actor) and not exists(select 1 from task_team_members where team_id=target and user_id=p_actor and role='manager') and not exists(select 1 from profiles where id=p_actor and role='admin') then raise exception 'Ekip sahibi gerekli' using errcode='42501'; end if;
  member:=(p_data->>'user_id')::uuid;
  if exists(select 1 from task_teams where id=target and owner_id=member) then raise exception 'Ekip sahibi kaldırılamaz' using errcode='23514'; end if;
  if p_data->>'role'='remove' then delete from task_team_members where team_id=target and user_id=member;
  else insert into task_team_members(team_id,user_id,role) values(target,member,p_data->>'role') on conflict(team_id,user_id) do update set role=excluded.role; end if;
  result:='{"ok":true}';
 else raise exception 'Bilinmeyen işlem' using errcode='23514';
 end if;
 if p_key is not null then insert into task_commands(principal,key,payload,result) values(v_principal,p_key,jsonb_build_object('op',p_operation,'data',p_data),result); end if;
 return result;
end $$;
revoke all on function public.task_command(text,jsonb,uuid,text,text) from public,anon;
grant execute on function public.task_command(text,jsonb,uuid,text,text) to authenticated,service_role;

create function public.task_rate_limit(p_principal text,p_limit integer) returns boolean language plpgsql security definer set search_path=public as $$
declare hits integer;
begin
 insert into task_rate_limits(principal,window_at,count) values(p_principal,date_trunc('minute',now()),1)
 on conflict(principal) do update set count=case when task_rate_limits.window_at=excluded.window_at then task_rate_limits.count+1 else 1 end,window_at=excluded.window_at returning count into hits;
 return hits<=p_limit;
end $$;
revoke all on function public.task_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.task_rate_limit(text,integer) to service_role;
revoke all on public.task_commands,public.task_rate_limits from anon,authenticated;
revoke all on public.task_teams,public.task_team_members,public.task_boards,public.task_comments,public.task_events,public.task_attachments,public.task_inbox from anon,authenticated;
grant select on public.task_teams,public.task_team_members,public.task_boards,public.task_comments,public.task_events,public.task_attachments,public.task_inbox to authenticated;
grant update(read_at) on public.task_inbox to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('task-attachments','task-attachments',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict(id) do nothing;
create policy task_file_insert on storage.objects for insert to authenticated with check(bucket_id='task-attachments' and split_part(name,'/',2)=auth.uid()::text and task_access(split_part(name,'/',1)::uuid,auth.uid(),true));
create policy task_file_read on storage.objects for select to authenticated using(bucket_id='task-attachments' and task_access(split_part(name,'/',1)::uuid,auth.uid()));
-- Yalnız henüz kesinleşmemiş kendi yüklemesini temizleyebilir; kayıtlı ek kalıcı silinmez.
create policy task_file_cleanup on storage.objects for delete to authenticated using(bucket_id='task-attachments' and split_part(name,'/',2)=auth.uid()::text and not exists(select 1 from task_attachments where object_path=name));



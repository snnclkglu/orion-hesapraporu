-- Kapsam değişimi ve tamamlanma kimliği istemci tarafından taklit edilemez.
create or replace function public.task_snapshot(p_filters jsonb default '{}',p_actor uuid default auth.uid()) returns jsonb
 language plpgsql stable security definer set search_path=public as $$
declare result jsonb; today date:=(now() at time zone 'Europe/Istanbul')::date;
begin
 if p_actor is null or not exists(select 1 from profiles where id=p_actor) or (auth.role() is distinct from 'service_role' and p_actor is distinct from auth.uid()) then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 with filtered as (
 select t.id,t.updated_at
 from job_tasks t left join jobs j on j.id=t.job_id
 where ((t.visibility='private' and t.created_by=p_actor) or t.visibility='job' or (t.visibility='team' and task_board_access(t.board_id,p_actor)))
 and (p_filters?'updatedSince' or case when p_filters->>'period'='archived' then t.archived_at is not null else t.archived_at is null end)
 and (coalesce(p_filters->>'view','mine')<>'mine' or t.assignee=p_actor or (t.visibility='private' and t.created_by=p_actor))
 and (p_filters->>'view' is distinct from 'team' or t.visibility<>'private')
 and (not p_filters?'team' or exists(select 1 from task_boards tb where tb.id=t.board_id and tb.team_id=(p_filters->>'team')::uuid))
and (not p_filters?'board' or t.board_id=(p_filters->>'board')::uuid)
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
declare actor uuid := coalesce(auth.uid(),nullif(current_setting('orion.task_actor',true),'')::uuid); b task_boards; a text;
begin
 if actor is null then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if not task_access(old.id,actor,true) then raise exception 'Görev yetkisi yok' using errcode='42501'; end if;
  if new.created_by<>old.created_by or new.id<>old.id then raise exception 'Sahip değiştirilemez' using errcode='42501'; end if;
  if (new.visibility<>old.visibility or new.board_id is distinct from old.board_id) and old.created_by<>actor then raise exception 'Paylaşımı yalnız sahibi değiştirir' using errcode='42501'; end if;
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
 if new.visibility='team' and new.assignee is not null and not task_board_access(new.board_id,new.assignee) then raise exception 'Kişi bu panoya erişemiyor' using errcode='23514'; end if;
 if new.goal_id is not null and (new.kind<>'task' or not exists(select 1 from job_tasks g where g.id=new.goal_id and g.kind='goal' and g.id<>new.id and task_access(g.id,actor,true) and g.visibility=new.visibility and g.board_id is not distinct from new.board_id)) then raise exception 'Hedef aynı kapsamda olmalı' using errcode='23514'; end if;
 if length(trim(new.title)) not between 1 and 300 or length(new.note)>20000 then raise exception 'Başlık veya açıklama sınırı aşıldı' using errcode='23514'; end if;
 return new;
end $$;

create or replace function public.task_record_event() returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid:=coalesce(auth.uid(),nullif(current_setting('orion.task_actor',true),'')::uuid); changes jsonb; ev text;
begin
 ev:=case when tg_op='INSERT' then 'created' else 'updated' end;
 select coalesce(jsonb_object_agg(n.key,jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old)->n.key end,'after',n.value)),'{}') into changes
 from jsonb_each(to_jsonb(new)) n where n.key in ('title','note','job_id','status','priority','assignee','due_date','board_id','visibility','archived_at','kind','goal_id') and (tg_op='INSERT' or n.value is distinct from to_jsonb(old)->n.key);
 insert into task_events(task_id,actor_id,agent_name,event,changes) values(new.id,actor,nullif(current_setting('orion.task_agent',true),''),ev,changes);
 if new.assignee is not null and new.assignee<>actor and (tg_op='INSERT' or new.assignee is distinct from old.assignee) then
  insert into task_inbox(user_id,task_id,event) values(new.assignee,new.id,'assigned');
 end if;
 return new;
end $$;


create or replace function public.task_command(p_operation text,p_data jsonb,p_actor uuid default auth.uid(),p_agent text default null,p_key text default null)
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
   if prior.result?'task' and not task_access((prior.result->'task'->>'id')::uuid,p_actor) then raise exception 'Görev yetkisi kaldırılmış' using errcode='42501'; end if;
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

alter table public.task_comments add constraint task_mention_limit check(cardinality(mentions)<=30);
alter table public.task_attachments add constraint task_attachment_name check(length(name) between 1 and 200);
create function public.task_attachment_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from storage.objects o where o.bucket_id='task-attachments' and o.name=new.object_path and split_part(o.name,'/',1)=new.task_id::text and split_part(o.name,'/',2)=new.created_by::text and (o.metadata->>'size')::bigint=new.bytes and o.metadata->>'mimetype'=new.mime_type) then raise exception 'Dosya bilgileri yüklenen nesneyle uyuşmuyor' using errcode='23514'; end if;
 return new;
end $$;
create trigger task_attachment_guard before insert on public.task_attachments for each row execute function public.task_attachment_guard();
-- Başka bucket yolları UUID'ye çevrilmez; kesinleşmiş ekler RLS altında gizlense de silinemez.
drop policy task_file_insert on storage.objects;
drop policy task_file_read on storage.objects;
drop policy task_file_cleanup on storage.objects;
create policy task_file_insert on storage.objects for insert to authenticated with check(bucket_id='task-attachments' and split_part(name,'/',2)=auth.uid()::text and task_access(case when bucket_id='task-attachments' and split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$' then split_part(name,'/',1)::uuid end,auth.uid(),true));
create policy task_file_read on storage.objects for select to authenticated using(bucket_id='task-attachments' and task_access(case when bucket_id='task-attachments' and split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$' then split_part(name,'/',1)::uuid end,auth.uid()));
create policy task_file_cleanup on storage.objects for delete to authenticated using(bucket_id='task-attachments' and split_part(name,'/',2)=auth.uid()::text and task_access(case when bucket_id='task-attachments' and split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$' then split_part(name,'/',1)::uuid end,auth.uid(),true) and not exists(select 1 from task_attachments where object_path=name));
-- SELECT politikası kendi tablosunu yeniden sorgulamaz: INSERT RETURNING yeni satırı henüz göremeyen eski snapshot'a takılmamalı.
drop policy task_read on public.job_tasks;
create policy task_read on public.job_tasks for select to authenticated using(
 (visibility='private' and created_by=auth.uid()) or visibility='job' or (visibility='team' and task_board_access(board_id,auth.uid()))
);


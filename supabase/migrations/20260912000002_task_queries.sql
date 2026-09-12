-- İnsan ve ajan aynı sorgu ve satır yetkisini kullanır.
create function public.task_snapshot(p_filters jsonb default '{}',p_actor uuid default auth.uid()) returns jsonb
 language plpgsql stable security definer set search_path=public as $$
declare result jsonb; today date:=(now() at time zone 'Europe/Istanbul')::date;
begin
 if p_actor is null or not exists(select 1 from profiles where id=p_actor) or (auth.role() is distinct from 'service_role' and p_actor is distinct from auth.uid()) then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 with filtered as (
 select t.*,j.job_no,task_access(t.id,p_actor,true) as can_edit,
 (select count(*) from job_tasks g where g.goal_id=t.id and g.archived_at is null and task_access(g.id,p_actor)) as goal_total,
 (select count(*) from job_tasks g where g.goal_id=t.id and g.archived_at is null and g.status='done' and task_access(g.id,p_actor)) as goal_done
 from job_tasks t left join jobs j on j.id=t.job_id
 where task_access(t.id,p_actor)
 and (p_filters?'updatedSince' or case when p_filters->>'period'='archived' then t.archived_at is not null else t.archived_at is null end)
 and (coalesce(p_filters->>'view','mine')<>'mine' or t.assignee=p_actor or (t.visibility='private' and t.created_by=p_actor))
 and (p_filters->>'view' is distinct from 'team' or t.visibility<>'private')
 and (not p_filters?'board' or t.board_id=(p_filters->>'board')::uuid)
 and (not p_filters?'assignee' or t.assignee=(p_filters->>'assignee')::uuid)
 and (not p_filters?'job' or t.job_id=(p_filters->>'job')::uuid)
 and (not p_filters?'status' or t.status=p_filters->>'status')
 and (not p_filters?'priority' or t.priority=p_filters->>'priority')
 and (not p_filters?'updatedSince' or t.updated_at>=(p_filters->>'updatedSince')::timestamptz)
 and (coalesce(p_filters->>'q','')='' or t.title ilike '%'||(p_filters->>'q')||'%' or j.job_no ilike '%'||(p_filters->>'q')||'%')
 and (case p_filters->>'period' when 'today' then t.due_date<=today and t.status<>'done' when 'upcoming' then t.due_date>today and t.status<>'done' when 'done' then t.status='done' else true end)
 ), page as (select * from filtered where not p_filters?'cursor' or (updated_at,id)<(split_part(p_filters->>'cursor','|',1)::timestamptz,split_part(p_filters->>'cursor','|',2)::uuid) order by updated_at desc,id desc limit 50)
 select jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'), 'total',(select count(*) from filtered)) into result;
 return result||jsonb_build_object(
 'boards',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('can_edit',task_board_access(b.id,p_actor,true)) order by b.name) from task_boards b where task_board_access(b.id,p_actor)),'[]'),
 'teams',coalesce((select jsonb_agg(t order by name) from task_teams t where task_team_access(t.id,p_actor)),'[]'),
 'members',coalesce((select jsonb_agg(m) from task_team_members m where task_team_access(m.team_id,p_actor)),'[]'),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',id,'full_name',full_name,'role',role) order by full_name) from profiles),'[]'),
 'jobs',coalesce((select jsonb_agg(j) from (select id,job_no,title from jobs where coalesce(p_filters->>'q','')='' or job_no ilike '%'||(p_filters->>'q')||'%' order by job_no desc limit 100) j),'[]'),
 'inbox',coalesce((select jsonb_agg(n) from (select i.*,t.title from task_inbox i join job_tasks t on t.id=i.task_id where i.user_id=p_actor and task_access(i.task_id,p_actor) order by i.created_at desc limit 50) n),'[]'));
end $$;
create function public.task_detail(p_id uuid,p_actor uuid default auth.uid()) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if p_actor is null or (auth.role() is distinct from 'service_role' and p_actor is distinct from auth.uid()) or not task_access(p_id,p_actor) then raise exception 'Görev bulunamadı' using errcode='42501'; end if;
 return jsonb_build_object(
 'task',(select to_jsonb(t)||jsonb_build_object('job_no',j.job_no,'can_edit',task_access(t.id,p_actor,true)) from job_tasks t left join jobs j on j.id=t.job_id where t.id=p_id),
 'comments',coalesce((select jsonb_agg(c order by c.created_at) from task_comments c where task_id=p_id),'[]'),
 'events',coalesce((select jsonb_agg(e order by e.created_at desc) from (select * from task_events where task_id=p_id order by created_at desc limit 100) e),'[]'),
 'attachments',coalesce((select jsonb_agg(a order by a.created_at) from task_attachments a where task_id=p_id),'[]'));
end $$;
revoke all on function public.task_snapshot(jsonb,uuid),public.task_detail(uuid,uuid) from public,anon;
grant execute on function public.task_snapshot(jsonb,uuid),public.task_detail(uuid,uuid) to authenticated,service_role;

-- Eski Panel sürümü geçiş sırasında silme çağırsa da kayıt geri alınabilir kalır.
create function public.task_legacy_todo_archive() returns trigger language plpgsql set search_path=public as $$
begin
 update public.job_tasks set archived_at=now() where id=old.id and created_by=auth.uid();
 return old;
end $$;
create trigger task_legacy_todo_archive instead of delete on public.user_todos for each row execute function public.task_legacy_todo_archive();
grant delete on public.user_todos to authenticated;


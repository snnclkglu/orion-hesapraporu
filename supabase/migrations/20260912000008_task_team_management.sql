drop policy task_read on job_tasks;
create policy task_read on job_tasks for select to authenticated using((visibility='private' and created_by=auth.uid()) or (visibility='direct' and auth.uid() in (created_by,assignee)) or visibility='job' or (visibility='team' and task_board_access(board_id,auth.uid())));

create function team_manage(p_operation text,p_data jsonb,p_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare t task_teams; member uuid; target uuid; replacement uuid; old_data jsonb; result jsonb; prior task_commands; v_principal text:=auth.uid()::text||'/teams';
begin
 if auth.uid() is null or not is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode='42501'; end if;
 if p_key is not null then
  perform pg_advisory_xact_lock(hashtextextended(v_principal||'/'||p_key,0));
  select * into prior from task_commands where task_commands.principal=v_principal and key=p_key;
  if found then
   if prior.payload<>jsonb_build_object('op',p_operation,'data',p_data) then raise exception 'İstek değişti' using errcode='40001'; end if;
   return prior.result;
  end if;
 end if;
 if p_operation='create' then
  insert into task_teams(name,description,owner_id) values(p_data->>'name',coalesce(p_data->>'description',''),auth.uid()) returning * into t;
  insert into task_team_members values(t.id,auth.uid(),'manager');
  insert into task_boards(name,owner_id,team_id,is_default) values('GENEL',auth.uid(),t.id,true);
 else
  target:=(p_data->>'id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('team/'||target::text,0));
  select * into t from task_teams where id=target for update;
  if not found then raise exception 'Ekip bulunamadı' using errcode='42501'; end if;
  if p_data?'version' and (p_data->>'version')::integer<>t.version then raise exception 'Ekip değişti' using errcode='40001'; end if;
  old_data:=to_jsonb(t);
  if t.archived_at is not null and p_operation not in ('restore','transfer') then raise exception 'Önce ekibi arşivden çıkarın' using errcode='23514'; end if;
  if p_operation='update' then
   update task_teams set name=p_data->>'name',description=coalesce(p_data->>'description','') where id=t.id;
  elsif p_operation='members' then
   if jsonb_array_length(p_data->'users')>100 then raise exception 'Bir işlemde en fazla 100 üye' using errcode='23514'; end if;
   for member in select jsonb_array_elements_text(p_data->'users')::uuid loop
    insert into task_team_members(team_id,user_id,role) values(t.id,member,'editor') on conflict do nothing;
   end loop;
  elsif p_operation='member' then
   member:=(p_data->>'user_id')::uuid;
   if t.owner_id=member then raise exception 'Önce ekip sahipliğini devredin' using errcode='23514'; end if;
   if p_data->>'role'='remove' then
    replacement:=nullif(p_data->>'replacement','')::uuid;
    if replacement=member or (replacement is not null and not exists(select 1 from task_team_members where team_id=t.id and user_id=replacement)) then raise exception 'Yeni sorumlu ekip üyesi olmalı' using errcode='23514'; end if;
    update job_tasks set assignee=replacement where board_id in(select id from task_boards where team_id=t.id) and assignee=member and status<>'done';
    delete from task_team_members where team_id=t.id and user_id=member;
   else
    update task_team_members set role=p_data->>'role' where team_id=t.id and user_id=member;
   end if;
  elsif p_operation='transfer' then
   member:=(p_data->>'user_id')::uuid;
   if not exists(select 1 from task_team_members where team_id=t.id and user_id=member) then raise exception 'Yeni sahip ekip üyesi olmalı' using errcode='23514'; end if;
   update task_team_members set role='manager' where team_id=t.id and user_id=member;
   update task_teams set owner_id=member where id=t.id;
  elsif p_operation in ('archive','restore') then
   update task_teams set archived_at=case when p_operation='archive' then now() end where id=t.id;
  else raise exception 'Geçersiz işlem' using errcode='23514'; end if;
  update task_teams set version=version+1 where id=t.id returning * into t;
 end if;
 insert into task_team_events(team_id,actor_id,event,changes) values(t.id,auth.uid(),p_operation,jsonb_build_object('before',old_data,'after',to_jsonb(t),'input',p_data));
 result:=jsonb_build_object('team',to_jsonb(t));
 if p_key is not null then insert into task_commands(principal,key,payload,result) values(v_principal,p_key,jsonb_build_object('op',p_operation,'data',p_data),result); end if;
 return result;
end $$;
revoke all on function team_manage(text,jsonb,text) from public,anon;
grant execute on function team_manage(text,jsonb,text) to authenticated;

-- Eski Panel komut yolu aynı merkezi denetimi kullanır. Eski gövde dışarıya kapatılır.
alter function task_command(text,jsonb,uuid,text,text) rename to task_command_core;
revoke all on function task_command_core(text,jsonb,uuid,text,text) from public,anon,authenticated,service_role;
create function task_command(p_operation text,p_data jsonb,p_actor uuid default auth.uid(),p_agent text default null,p_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if p_actor is null or (auth.role() is distinct from 'service_role' and (p_actor is distinct from auth.uid() or p_agent is not null)) then raise exception 'Aktör geçersiz' using errcode='42501'; end if;
 if p_operation in ('team.create','team.member') then
  if p_agent is not null or p_actor is distinct from auth.uid() then raise exception 'Ekip yönetimi uygulama içinden yapılır' using errcode='42501'; end if;
  if p_operation='team.create' then return team_manage('create',p_data,p_key); end if;
  if p_data->>'role'='remove' then return team_manage('member',p_data||jsonb_build_object('id',p_data->>'team_id'),p_key); end if;
  if not is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode='42501'; end if;
  perform team_manage('members',jsonb_build_object('id',p_data->>'team_id','users',jsonb_build_array(p_data->>'user_id')),null);
  return team_manage('member',p_data||jsonb_build_object('id',p_data->>'team_id'),p_key);
 end if;
 if p_operation in ('update','comment','attachment') and not task_access((p_data->>'id')::uuid,p_actor,true) then raise exception 'Görev yetkisi yok' using errcode='42501'; end if;
 if p_operation='board.archive' and exists(select 1 from task_boards where id=(p_data->>'id')::uuid and is_default) then raise exception 'Genel pano ekip ile arşivlenir' using errcode='23514'; end if;
 return task_command_core(p_operation,p_data,p_actor,p_agent,p_key);
end $$;
revoke all on function task_command(text,jsonb,uuid,text,text) from public,anon;
grant execute on function task_command(text,jsonb,uuid,text,text) to authenticated,service_role;

create function team_directory(p_q text default '',p_role text default '',p_page integer default 0,p_team uuid default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 if p_team is not null and not task_team_access(p_team,auth.uid()) then raise exception 'Ekip yetkisi yok' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(v) from(select p.id,p.full_name,p.role,u.email,p.avatar_path,
  exists(select 1 from task_team_members m where m.team_id=p_team and m.user_id=p.id) as member
  from profiles p join auth.users u on u.id=p.id
  where (p_role='' or p.role::text=p_role) and (p_q='' or task_search_fold(p.full_name||' '||coalesce(u.email,'')) like '%'||task_search_fold(left(p_q,100))||'%')
  order by p.full_name,p.id limit 30 offset least(greatest(p_page,0),10000)*30) v),'[]');
end $$;
create function team_list(p_q text default '',p_archived boolean default false,p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(v) from(select t.*,
 (select count(*) from task_team_members m where m.team_id=t.id) as member_count,
 (select count(*) from job_tasks j join task_boards b on b.id=j.board_id where b.team_id=t.id and j.status<>'done' and j.archived_at is null) as open_count,
 (select count(*) from job_tasks j join task_boards b on b.id=j.board_id where b.team_id=t.id and j.status<>'done' and j.assignee is null and j.archived_at is null) as unassigned_count,
 (select count(*) from job_tasks j join task_boards b on b.id=j.board_id where b.team_id=t.id and j.status<>'done' and j.due_date<(now() at time zone 'Europe/Istanbul')::date and j.archived_at is null) as overdue_count
 from task_teams t where task_team_access(t.id,auth.uid()) and (t.archived_at is not null)=p_archived and task_search_fold(t.name) like '%'||task_search_fold(left(p_q,100))||'%' order by t.name,t.id limit 25 offset least(greatest(p_page,0),10000)*25) v),'[]'),
 'total',(select count(*) from task_teams t where task_team_access(t.id,auth.uid()) and (t.archived_at is not null)=p_archived and task_search_fold(t.name) like '%'||task_search_fold(left(p_q,100))||'%'));
end $$;
create function team_detail(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode='42501'; end if;
 return jsonb_build_object('team',(select to_jsonb(t) from task_teams t where id=p_id),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'role',m.role,'app_role',p.role,'email',u.email,'avatar_path',p.avatar_path,'open_count',(select count(*) from job_tasks j join task_boards b on b.id=j.board_id where b.team_id=p_id and j.assignee=p.id and j.status<>'done'))) from task_team_members m join profiles p on p.id=m.user_id join auth.users u on u.id=p.id where m.team_id=p_id),'[]'),
 'events',coalesce((select jsonb_agg(e) from(select event,created_at,actor_id from task_team_events where team_id=p_id order by created_at desc limit 30)e),'[]'));
end $$;
revoke all on function team_directory(text,text,integer,uuid),team_list(text,boolean,integer),team_detail(uuid) from public,anon;
grant execute on function team_directory(text,text,integer,uuid),team_list(text,boolean,integer),team_detail(uuid) to authenticated;

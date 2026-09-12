-- Etiket ilişkisi görevle aynı komutta yazılır; eski istemciler boş listeyle uyumludur.
create table task_tags (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 40),
 normalized_name text generated always as (task_search_fold(trim(name))) stored,
 color_hue integer not null check(color_hue in (300,250,65,155,200,20)),
 scope text not null check(scope in ('global','team','personal')),
 team_id uuid references task_teams(id), owner_id uuid references profiles(id),
 archived_at timestamptz, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((scope='global' and team_id is null and owner_id is null) or (scope='team' and team_id is not null and owner_id is null) or (scope='personal' and owner_id is not null and team_id is null))
);
create unique index task_tag_name on task_tags(scope,coalesce(team_id,owner_id,'00000000-0000-0000-0000-000000000000'::uuid),normalized_name);
create index task_tag_updated on task_tags(updated_at desc,id desc);
insert into task_tags(name,color_hue,scope) values ('TEKLİF',300,'global'),('PROJE',250,'global'),('SATIN ALMA',65,'global');
alter table job_tasks add column tag_ids uuid[] not null default '{}';
alter table job_tasks add constraint task_tag_limit check(cardinality(tag_ids)<=10);
create index task_tag_ids on job_tasks using gin(tag_ids);
create table task_tag_links(task_id uuid references job_tasks(id) on delete cascade,tag_id uuid references task_tags(id),primary key(task_id,tag_id));
create index task_tag_link_reverse on task_tag_links(tag_id,task_id);

create function task_tag_access(p_tag uuid,p_actor uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=p_actor) and exists(select 1 from task_tags g where g.id=p_tag and
 (case g.scope when 'global' then not p_write or exists(select 1 from profiles where id=p_actor and role='admin')
 when 'personal' then g.owner_id=p_actor
 else task_team_access(g.team_id,p_actor,p_write) and (not p_write or exists(select 1 from profiles where id=p_actor and role='admin') or exists(select 1 from task_teams where id=g.team_id and owner_id=p_actor) or exists(select 1 from task_team_members where team_id=g.team_id and user_id=p_actor and role='manager')) end))
$$;
alter table task_tags enable row level security;
alter table task_tag_links enable row level security;
create policy task_tags_read on task_tags for select to authenticated using(task_tag_access(id,auth.uid()));
create policy task_tag_links_read on task_tag_links for select to authenticated using(task_access(task_id,auth.uid()) and task_tag_access(tag_id,auth.uid()));
revoke all on task_tags,task_tag_links from public,anon,authenticated;
grant select on task_tags,task_tag_links to authenticated;

create function task_tag_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare g task_tags; tag uuid;
begin
 if cardinality(new.tag_ids)>10 or cardinality(new.tag_ids)<>(select count(distinct x) from unnest(new.tag_ids)x) then raise exception 'En fazla 10 benzersiz etiket seçin' using errcode='23514'; end if;
 for tag in select unnest(new.tag_ids) order by 1 loop
  select * into g from task_tags where id=tag for share;
  if not found or not (g.scope='global' or (g.scope='personal' and new.visibility='private' and g.owner_id=new.created_by) or (g.scope='team' and new.visibility='team' and exists(select 1 from task_boards b where b.id=new.board_id and b.team_id=g.team_id))) then raise exception 'Etiket paylaşım kapsamıyla uyuşmuyor' using errcode='23514'; end if;
  if g.archived_at is not null and (tg_op='INSERT' or not tag=any(old.tag_ids)) then raise exception 'Arşiv etiketini yeni göreve ekleyemezsiniz' using errcode='23514'; end if;
 end loop;
 return new;
end $$;
create trigger task_zz_tags_before before insert or update on job_tasks for each row execute function task_tag_guard();
create function task_tag_sync() returns trigger language plpgsql security definer set search_path=public as $$
begin
 delete from task_tag_links where task_id=new.id and not tag_id=any(new.tag_ids);
 insert into task_tag_links(task_id,tag_id) select new.id,unnest(new.tag_ids) on conflict do nothing;
 return new;
end $$;
create trigger task_tags_after after insert or update on job_tasks for each row execute function task_tag_sync();

create function task_merge_tags(current_ids uuid[], payload jsonb) returns uuid[] language plpgsql immutable set search_path=public as $$
declare additions uuid[]; removals uuid[]; result uuid[];
begin
 if payload?'tag_ids' and (payload?'add_tag_ids' or payload?'remove_tag_ids') then raise exception 'Etiket kipleri birlikte kullanılamaz' using errcode='23514'; end if;
 if exists(select 1 from jsonb_each(payload) p where p.key in ('tag_ids','add_tag_ids','remove_tag_ids') and (jsonb_typeof(p.value) is distinct from 'array')) then raise exception 'Etiket listesi gerekli' using errcode='23514'; end if;
 if payload?'tag_ids' then return array(select jsonb_array_elements_text(payload->'tag_ids')::uuid); end if;
 additions:=array(select jsonb_array_elements_text(coalesce(payload->'add_tag_ids','[]'))::uuid);
 removals:=array(select jsonb_array_elements_text(coalesce(payload->'remove_tag_ids','[]'))::uuid);
 if cardinality(additions)<>(select count(distinct x) from unnest(additions)x) or cardinality(removals)<>(select count(distinct x) from unnest(removals)x) then raise exception 'Etiketler benzersiz olmalı' using errcode='23514'; end if;
 if additions && removals or cardinality(additions)>10 or cardinality(removals)>10 then raise exception 'Etiket ekle/çıkar listelerini kontrol edin' using errcode='23514'; end if;
 select coalesce(array_agg(distinct x order by x),'{}') into result from unnest(current_ids||additions)x where not x=any(removals);
 return result;
end $$;

-- Çekirdekteki tek INSERT/UPDATE değiştirilir; tekrar yanıtı tam etiketli kaydı içerir.
do $$ declare definition text;
begin
 definition:=pg_get_functiondef('task_command_core(text,jsonb,uuid,text,text)'::regprocedure);
 if strpos(definition,'source_ref,goal_id)')=0 or strpos(definition,'title=case when')=0 then raise exception 'Görev çekirdeği beklenen sürümde değil'; end if;
 definition:=replace(definition,'source_ref,goal_id)','source_ref,goal_id,tag_ids)');
 definition:=replace(definition,'nullif(p_data->>''goal_id'','''')::uuid) returning','nullif(p_data->>''goal_id'','''')::uuid,task_merge_tags(''{}'',p_data)) returning');
 definition:=replace(definition,'title=case when','tag_ids=task_merge_tags(tag_ids,p_data), title=case when');
 execute definition;
 definition:=pg_get_functiondef('task_record_event()'::regprocedure);
 if strpos(definition,'''kind'',''goal_id''')=0 then raise exception 'Görev geçmişi beklenen sürümde değil'; end if;
 execute replace(definition,'''kind'',''goal_id''','''kind'',''goal_id'',''tag_ids''');
 definition:=pg_get_functiondef('task_snapshot(jsonb,uuid)'::regprocedure);
 if strpos(definition,'and (not p_filters?''priority''')=0 then raise exception 'Görev sorgusu beklenen sürümde değil'; end if;
 definition:=replace(definition,'and (not p_filters?''priority''',E'and (p_filters->>''untagged'' is distinct from ''true'' or cardinality(t.tag_ids)=0)\n and (not p_filters?''tagIds'' or case when p_filters->>''tagMatch''=''all'' then t.tag_ids @> array(select jsonb_array_elements_text(p_filters->''tagIds'')::uuid) else t.tag_ids && array(select jsonb_array_elements_text(p_filters->''tagIds'')::uuid) end)\n and (not p_filters?''priority''');
 definition:=replace(definition,'''boards'',coalesce(','''tags'',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object(''can_edit'',task_tag_access(g.id,p_actor,true)) order by g.name) from task_tags g where task_tag_access(g.id,p_actor)),''[]''), ''boards'',coalesce(');
 execute definition;
 definition:=pg_get_functiondef('task_flow_after()'::regprocedure);
 if strpos(definition,'recurrence_parent,checklist)')=0 then raise exception 'Tekrar gövdesi beklenen sürümde değil'; end if;
 definition:=replace(definition,'recurrence_parent,checklist)','recurrence_parent,tag_ids,checklist)');
 definition:=replace(definition,'new.recurrence,new.id,','new.recurrence,new.id,array(select id from task_tags where id=any(new.tag_ids) and archived_at is null),');
 execute definition;
end $$;

create function task_tag_catalog(p_filters jsonb default '{}',p_actor uuid default auth.uid()) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if p_actor is null or (auth.role() is distinct from 'service_role' and p_actor is distinct from auth.uid()) then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 with matches as (select * from task_tags g where task_tag_access(g.id,p_actor)
 and (coalesce(p_filters->>'q','')='' or g.normalized_name like '%'||task_search_fold(p_filters->>'q')||'%')
 and (not p_filters?'scope' or g.scope=p_filters->>'scope')
 and (not p_filters?'team' or g.team_id=(p_filters->>'team')::uuid)
 and (p_filters?'updatedSince' or p_filters->>'archived'='true' or g.archived_at is null)
 and (not p_filters?'updatedSince' or g.updated_at>=(p_filters->>'updatedSince')::timestamptz)),
 page as (select * from matches where not p_filters?'cursor' or (updated_at,id)<(split_part(p_filters->>'cursor','|',1)::timestamptz,split_part(p_filters->>'cursor','|',2)::uuid) order by updated_at desc,id desc limit 50)
 select jsonb_build_object('tags',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('can_edit',task_tag_access(p.id,p_actor,true)) order by updated_at desc,id desc) from page p),'[]'),'total',(select count(*) from matches),'nextCursor',(select updated_at::text||'|'||id::text from page order by updated_at,id limit 1)) into result;
 if jsonb_array_length(result->'tags')<50 then result:=jsonb_set(result,'{nextCursor}','null'); end if;
 return result;
end $$;

alter function task_command(text,jsonb,uuid,text,text) rename to task_command_without_tags;
revoke all on function task_command_without_tags(text,jsonb,uuid,text,text) from public,anon,authenticated,service_role;
create function task_command(p_operation text,p_data jsonb,p_actor uuid default auth.uid(),p_agent text default null,p_key text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare g task_tags; previous task_commands; result jsonb; principal_id text;
begin
 if p_operation not in ('tag.create','tag.update') then return task_command_without_tags(p_operation,p_data,p_actor,p_agent,p_key); end if;
 if p_actor is null or not exists(select 1 from profiles where id=p_actor) or (auth.role() is distinct from 'service_role' and (p_actor is distinct from auth.uid() or p_agent is not null)) then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 if p_agent is not null and (p_key is null or length(p_key) not between 8 and 128) then raise exception 'Tekrar anahtarı gerekli' using errcode='23514'; end if;
 principal_id:=p_actor::text||'/'||coalesce(p_agent,'human');
 if p_key is not null then
  perform pg_advisory_xact_lock(hashtextextended(principal_id||'/'||p_key,0));
  select * into previous from task_commands where principal=principal_id and key=p_key;
  if found then
   if previous.payload<>jsonb_build_object('op',p_operation,'data',p_data) then raise exception 'Tekrar anahtarı çakıştı' using errcode='40001'; end if;
   if not task_tag_access((previous.result->'tag'->>'id')::uuid,p_actor) then raise exception 'Etiket yetkisi yok' using errcode='42501'; end if;
   return previous.result||'{"replayed":true}'::jsonb;
  end if;
 end if;
 if p_operation='tag.create' then
  if p_data->>'scope'='global' and not exists(select 1 from profiles where id=p_actor and role='admin') then raise exception 'Genel katalog yöneticiye aittir' using errcode='42501'; end if;
  if p_data->>'scope'='team' and not task_team_access((p_data->>'team_id')::uuid,p_actor,true) then raise exception 'Ekip yetkisi yok' using errcode='42501'; end if;
  insert into task_tags(name,color_hue,scope,team_id,owner_id) values(upper(translate(trim(p_data->>'name'),'iı','İI')),(p_data->>'color_hue')::int,p_data->>'scope',(p_data->>'team_id')::uuid,case when p_data->>'scope'='personal' then p_actor end) returning * into g;
 else
  select * into g from task_tags where id=(p_data->>'id')::uuid for update;
  if not found or not task_tag_access(g.id,p_actor,true) then raise exception 'Etiket yönetim yetkisi yok' using errcode='42501'; end if;
  if g.version is distinct from (p_data->>'version')::int then raise exception 'Etiket değişti' using errcode='40001'; end if;
  update task_tags set name=case when p_data?'name' then upper(translate(trim(p_data->>'name'),'iı','İI')) else name end,color_hue=coalesce((p_data->>'color_hue')::int,color_hue),archived_at=case when p_data?'archived' then case when (p_data->>'archived')::boolean then now() end else archived_at end,version=version+1,updated_at=clock_timestamp() where id=g.id returning * into g;
 end if;
 result:=jsonb_build_object('tag',to_jsonb(g)||jsonb_build_object('can_edit',task_tag_access(g.id,p_actor,true)));
 if p_key is not null then insert into task_commands(principal,key,payload,result) values(principal_id,p_key,jsonb_build_object('op',p_operation,'data',p_data),result); end if;
 return result;
end $$;
revoke all on function task_command(text,jsonb,uuid,text,text),task_tag_catalog(jsonb,uuid),task_tag_access(uuid,uuid,boolean),task_tag_guard(),task_tag_sync(),task_merge_tags(uuid[],jsonb) from public,anon;
grant execute on function task_command(text,jsonb,uuid,text,text),task_tag_catalog(jsonb,uuid),task_tag_access(uuid,uuid,boolean) to authenticated,service_role;

-- Entegrasyon yönetimi daha önce yayımlandıysa yeni dar izni sözleşmeye ekle.
do $$ begin
 if to_regclass('public.agent_clients') is not null then
  alter table agent_clients drop constraint if exists agent_clients_scopes_check;
  alter table agent_clients add constraint agent_clients_scopes_check check(cardinality(scopes) between 1 and 12 and scopes <@ array['offers:read','offers:draft:write','email:read','email:draft:write','email:publish','email:test:send','email:send','tasks:read','tasks:write','tasks:comment','tasks:context:read','tasks:tags:manage']::text[]);
 end if;
end $$;

-- Tamamı çağıran betiğin geri alınan transaction'ında çalışır.
do $$
#variable_conflict use_variable
declare actor uuid; other uuid; adm uuid; personal uuid; global_tag uuid; second_tag uuid; task_id uuid; r jsonb; payload jsonb; child uuid; v int; old_time timestamptz;
begin
 select id into actor from profiles where role<>'admin' order by created_at limit 1;
 select id into other from profiles where id<>actor order by created_at limit 1;
 select id into adm from profiles where role='admin' limit 1;
 perform set_config('request.jwt.claim.role','service_role',true);
 perform set_config('request.jwt.claim.sub','',true);
 r:=task_command('tag.create','{"name":"teklif doğrulama","color_hue":300,"scope":"personal"}',actor,'Etiket Test','tag-create-0001');personal:=(r->'tag'->>'id')::uuid;
 if r->'tag'->>'name'<>'TEKLİF DOĞRULAMA' then raise exception 'Türkçe ad dönüşümü ayrıştı';end if;
 if not (task_command('tag.create','{"name":"teklif doğrulama","color_hue":300,"scope":"personal"}',actor,'Etiket Test','tag-create-0001')->>'replayed')::boolean then raise exception 'Katalog tekrarı çoğaldı';end if;
 if task_tag_access(personal,other) then raise exception 'Kişisel etiket sızıyor';end if;
 if exists(select 1 from jsonb_array_elements(task_tag_catalog('{}',other)->'tags')g where g->>'id'=personal::text) then raise exception 'Katalog kişisel etiket sızdırdı';end if;
 begin perform task_command('tag.create','{"name":"TEKLİF DOĞRULAMA","color_hue":250,"scope":"personal"}',actor);raise exception using errcode='Z0001',message='Mükerrer etiket kabul edildi';exception when unique_violation then null;end;
 begin perform task_command('tag.create','{"name":"Yetkisiz ortak","color_hue":300,"scope":"global"}',actor);raise exception using errcode='Z0001',message='Genel katalog yetkisi aşıldı';exception when insufficient_privilege then null;end;
 select id into global_tag from task_tags where scope='global' and name='TEKLİF';
 select id into second_tag from task_tags where scope='global' and name='PROJE';
 payload:=jsonb_build_object('title','Etiketli doğrulama','tag_ids',jsonb_build_array(personal,global_tag),'due_date','2026-09-20');
 r:=task_command('create',payload,actor,'Etiket Test','tag-task-create-1');task_id:=(r->'task'->>'id')::uuid;
 if (select cardinality(t.tag_ids) from job_tasks t where t.id=task_id)<>2 then raise exception 'Görev etiketleri yazılmadı';end if;
 if (select count(*) from task_tag_links l where l.task_id=task_id)<>2 then raise exception 'Etiket ilişkisi yazılmadı';end if;
 if task_command('create',payload,actor,'Etiket Test','tag-task-create-1')->'task' is distinct from r->'task' then raise exception 'Tekrar tam yanıtı korumadı';end if;
 old_time:=(r->'task'->>'updated_at')::timestamptz;
 payload:=jsonb_build_object('id',task_id,'version',1,'add_tag_ids',jsonb_build_array(second_tag),'remove_tag_ids',jsonb_build_array(global_tag));
 r:=task_command('update',payload,actor,'Etiket Test','tag-task-update-1');
 if not (r->'task'->'tag_ids' @> jsonb_build_array(personal,second_tag)) or r->'task'->'tag_ids' @> jsonb_build_array(global_tag) then raise exception 'Kısmi güncelleme etiketleri bozdu';end if;
 if (r->'task'->>'version')::int<>2 then raise exception 'Tek etiket güncellemesi sürümü bir artırmalı';end if;
 if not exists(select 1 from task_events e where e.task_id=task_id and e.changes?'tag_ids' and e.agent_name='Etiket Test') then raise exception 'Ajan etiket geçmişi yok';end if;
 if (task_snapshot(jsonb_build_object('tagIds',jsonb_build_array(personal,second_tag),'tagMatch','all'),actor)->>'total')::int<>1 then raise exception 'Tümü filtresi yanlış';end if;
 if (task_snapshot(jsonb_build_object('tagIds',jsonb_build_array(personal),'updatedSince',old_time),actor)->>'total')::int<>1 then raise exception 'Etiket updatedSince kaydı kayboldu';end if;
 begin perform task_command('update',jsonb_build_object('id',task_id,'version',1,'tag_ids','[]'::jsonb),actor);raise exception using errcode='Z0001',message='Eski sürüm etiketleri ezdi';exception when serialization_failure then null;end;
 begin perform task_command('create',jsonb_build_object('title','Yetkisiz etiket','tag_ids',jsonb_build_array(personal)),other);raise exception using errcode='Z0001',message='Başkasının etiketi atandı';exception when check_violation then null;end;
 if exists(select 1 from job_tasks where title='Yetkisiz etiket') then raise exception 'Hatalı etiket yarım görev bıraktı';end if;
 begin perform task_command('update',jsonb_build_object('id',task_id,'version',2,'visibility','direct','assignee',other),actor);raise exception using errcode='Z0001',message='Paylaşım etiket sızdırdı';exception when check_violation then null;end;
 perform task_command('tag.update',jsonb_build_object('id',personal,'version',1,'archived',true),actor);
 begin perform task_command('create',jsonb_build_object('title','Arşiv etiketi','tag_ids',jsonb_build_array(personal)),actor);raise exception using errcode='Z0001',message='Arşiv etiketi atandı';exception when check_violation then null;end;
 -- Mevcut arşiv etiketi açıklama düzenlemeyi engellemez; sonraki tekrara kopyalanmaz.
 r:=task_command('workflow',jsonb_build_object('id',task_id,'version',2,'recurrence',jsonb_build_object('mode','weekly','interval',1)),actor);
 r:=task_command('update',jsonb_build_object('id',task_id,'version',3,'status','done'),actor);
 select id into child from job_tasks where recurrence_parent=task_id;
 if child is null or (select tag_ids from job_tasks where id=child)<>array[second_tag] then raise exception 'Tekrar etiketleri yanlış';end if;
 r:=task_command('update',jsonb_build_object('id',task_id,'version',4,'archived',true),actor);
 r:=task_command('update',jsonb_build_object('id',task_id,'version',5,'archived',false),actor);
 if (r->'task'->>'archived_at') is not null then raise exception 'Arşiv geri alma başarısız';end if;
 r:=task_command('update',jsonb_build_object('id',task_id,'version',6,'tag_ids','[]'::jsonb),actor);
 if exists(select 1 from task_tag_links l where l.task_id=task_id) then raise exception 'Etiket ilişkisi temizlenmedi';end if;
 -- Başka kullanıcı adına katalog okumak normal oturumda yasaktır.
 perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claim.sub',other::text,true);
 begin perform task_tag_catalog('{}',actor);raise exception using errcode='Z0001',message='Katalog aktörü taklit edildi';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.role','service_role',true);perform set_config('request.jwt.claim.sub','',true);
end $$;

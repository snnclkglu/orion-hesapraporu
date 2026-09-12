do $$ declare actor uuid; other uuid; adm uuid; task uuid; personal uuid; shared uuid; goal uuid; team uuid; board uuid; job uuid; r jsonb; n int;
begin
 select id into actor from profiles where role<>'admin' order by created_at limit 1;
 select id into adm from profiles where role='admin' order by created_at limit 1;
 select id into other from profiles where id<>actor and id<>adm limit 1;
 if actor is null or adm is null or other is null then raise exception 'Üç test kimliği gerekli'; end if;
 -- İlk aktarım sürümünde alan eşitliği; sonraki meşru düzenlemeler eski yedekle karşılaştırılmaz.
 if (select count(*) from user_todos_legacy)<>(select count(*) from job_tasks t join user_todos_legacy l on l.id=t.id where t.created_by=l.user_id and (t.version>1 or (t.visibility='private' and t.title=l.title and t.note=l.note and t.due_date is not distinct from l.due_date and t.done_at is not distinct from l.done_at))) then raise exception 'Geçiş verisi eşleşmedi'; end if;
 perform set_config('request.jwt.claim.role','service_role',true);
 r:=task_command('create',jsonb_build_object('title','Doğrulama görevi','assignee',actor),actor,'Test Agent','create-0001');task:=(r->'task'->>'id')::uuid;
 if not (task_command('create',jsonb_build_object('title','Doğrulama görevi','assignee',actor),actor,'Test Agent','create-0001')->>'replayed')::boolean then raise exception 'Tekrar güvenliği yok'; end if;
 if task_access(task,adm) or task_access(task,other) then raise exception 'Özel görev sızıyor'; end if;
 begin perform task_command('update',jsonb_build_object('id',task,'version',2,'title','Eski sürüm'),actor);raise exception using errcode='Z0001',message='Eski sürüm kabul edildi';exception when serialization_failure then null;end;
 r:=task_command('update',jsonb_build_object('id',task,'version',1,'status','done'),actor);
 if r->'task'->>'done_at' is null then raise exception 'Tamamlanma izi yok'; end if;
 perform task_command('comment',jsonb_build_object('id',task,'body','Deneme'),actor);
 personal:=task;
 if jsonb_array_length(task_detail(task,actor)->'comments')<>1 then raise exception 'Yorum yok'; end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 team:=(task_command('team.create','{"name":"Test ekibi"}',adm)->'team'->>'id')::uuid;
 perform task_command('team.member',jsonb_build_object('team_id',team,'user_id',actor,'role','editor'),adm);
 perform task_command('team.member',jsonb_build_object('team_id',team,'user_id',other,'role','viewer'),adm);
 perform set_config('request.jwt.claim.sub','',true);
 board:=(task_command('board.create',jsonb_build_object('name','Test panosu','kind','task','team_id',team),actor)->'board'->>'id')::uuid;
 shared:=(task_command('create',jsonb_build_object('title','Ekip görevi','visibility','team','board_id',board),actor)->'task'->>'id')::uuid;
 if not task_access(shared,other) or task_access(shared,other,true) then raise exception 'Görüntüleyici yetkisi yanlış';end if;
 if not task_access(shared,adm) then raise exception 'Yönetici ekip görevini göremiyor';end if;
 goal:=(task_command('create',jsonb_build_object('title','Kontrol hedefi','kind','goal','visibility','team','board_id',board),actor)->'task'->>'id')::uuid;
 perform task_command('update',jsonb_build_object('id',shared,'version',1,'goal_id',goal),actor);
 begin perform task_command('update',jsonb_build_object('id',goal,'version',1,'kind','note'),actor);raise exception using errcode='Z0001',message='Bağlı hedefin türü bozuldu';exception when check_violation then null;end;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 perform task_command('team.member',jsonb_build_object('team_id',team,'user_id',other,'role','remove'),adm);
 perform set_config('request.jwt.claim.sub','',true);
 if task_access(shared,other) then raise exception 'Üyelik kaldırıldıktan sonra erişim sürüyor';end if;
 perform task_snapshot('{}',actor);
 if task_search_fold('İSDEMİR')<>task_search_fold('isdemir') then raise exception 'Türkçe arama eşleşmiyor';end if;
 -- Kaynak tekilliği anahtardan bağımsızdır.
 perform task_command('create','{"title":"Kaynak denemesi","source_ref":"mail/test/message/task-1"}',actor,'Test Agent','source-0001');
 begin perform task_command('create','{"title":"Kaynak tekrar","source_ref":"mail/test/message/task-1"}',actor,'Test Agent','source-0002');raise exception using errcode='Z0001',message='Kaynak çoğaltıldı';exception when unique_violation then null;end;
 -- Aynı kişi tamamlanma imzasını doğrudan yazmayla başka birine çeviremez.
 perform set_config('orion.task_actor',actor::text,true);
 update job_tasks set done_by=other where id=task;
 if (select done_by from job_tasks where id=task)<>actor then raise exception 'Tamamlanma aktörü taklit edildi';end if;
 -- Eski istemcinin ekleme/tamamlama/silme yolu da yeni görev kaynağını kullanır.
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 set local role authenticated;
 insert into user_todos(user_id,title) values(actor,'Eski istemci denemesi') returning id into task;
 update user_todos set done_at=now() where id=task;
 delete from user_todos where id=task;
 if not exists(select 1 from job_tasks where id=task and archived_at is not null) then raise exception 'Eski istemci arşivlemesi başarısız';end if;
 -- İş hub'ı ayrı bir istekte görünürlük veya status göndermez.
 perform set_config('orion.task_command','',true);
 select id into job from jobs limit 1;
 if job is not null then
  insert into job_tasks(job_id,title,created_by,assignee) values(job,'Hub uyumluluk denemesi',actor,other) returning id into task;
  if not exists(select 1 from job_tasks where id=task and visibility='job') then raise exception 'Hub görevinin görünürlüğü yanlış';end if;
  update job_tasks set done_at=now() where id=task;
  if not exists(select 1 from job_tasks where id=task and status='done' and done_by=actor) then raise exception 'Hub tamamlanması tutarsız';end if;
  update job_tasks set archived_at=now() where id=task;
 end if;
 reset role;
 -- Doğrudan istemci rolü ile RLS; hizmet rolü sorgusu bu testin yerine geçmez.
 task:=personal;
 perform set_config('request.jwt.claim.sub',other::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 set local role authenticated;
 select count(*) into n from job_tasks where id in(task,shared);
 if n<>0 then raise exception 'RLS görev sızdırıyor';end if;
 select count(*) into n from task_comments where task_id=task;
 if n<>0 then raise exception 'RLS yorum sızdırıyor';end if;
 begin perform task_detail(task,actor);raise exception using errcode='Z0001',message='Aktör taklidi mümkün';exception when insufficient_privilege then null;end;
 reset role;
end $$;

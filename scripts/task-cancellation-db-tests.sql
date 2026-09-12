-- Kalıcı veri bırakmadan yetki, audit ve geri açma doğrulaması.
do $$
#variable_conflict use_variable
declare actor uuid; other_user uuid; adm uuid; t uuid; shared uuid; team uuid; board uuid; r jsonb; payload jsonb;
begin
 select id into actor from profiles where role<>'admin' limit 1;
 select id into adm from profiles where role='admin' limit 1;
 select id into other_user from profiles where id not in (actor,adm) limit 1;
 perform set_config('request.jwt.claim.role','service_role',true);
 perform set_config('request.jwt.claim.sub','',true);
 t:=(task_command('create','{"title":"İptal testi özel"}',actor)->'task'->>'id')::uuid;
 if not task_cancellation_permission(t,actor) or task_cancellation_permission(t,adm) then raise exception 'Özel iptal sınırı bozuk';end if;
 begin perform task_command('cancel',jsonb_build_object('id',t,'version',1,'reason','a'),actor);raise exception using errcode='Z0001',message='Nedensiz iptal kabul';exception when check_violation then null;end;
 begin update job_tasks set cancelled_at=now(),cancelled_by=actor,cancellation_reason='Alan değişimi' where id=t;raise exception using errcode='Z0001',message='Doğrudan alan değiştirme kabul';exception when insufficient_privilege then null;end;
 payload:=jsonb_build_object('id',t,'version',1,'reason','Yanlışlıkla açıldı');
 r:=task_command('cancel',payload,actor,'Grokbot Test','cancel-test-001');
 if r->'task'->>'cancelled_by'<>actor::text or (r->'task'->>'can_edit')::boolean or (r->'task'->>'version')::int<>2 then raise exception 'İptal durumu bozuk';end if;
 if not (task_command('cancel',payload,actor,'Grokbot Test','cancel-test-001')->>'replayed')::boolean then raise exception 'İptal tekrar anahtarı bozuk';end if;
 if (select count(*) from task_cancellation_events where task_id=t)<>1 then raise exception 'İptal audit çoğaldı';end if;
 if not exists(select 1 from task_cancellation_events where task_id=t and actor_id=actor and agent_name='Grokbot Test' and snapshot->>'title'='İptal testi özel') then raise exception 'Kimlik veya önceki kayıt korunmadı';end if;
 if (task_snapshot('{"q":"İptal testi özel"}',actor)->>'total')::int<>0 or (task_snapshot('{"q":"İptal testi özel","period":"archived"}',actor)->>'total')::int<>0 then raise exception 'İptal aktif veya arşiv listesine sızdı';end if;
 r:=task_snapshot('{"q":"İptal testi özel","period":"cancelled"}',actor);
 if (r->>'total')::int<>1 or not (r->'tasks'->0->>'can_cancel')::boolean then raise exception 'İptal görünümü eksik';end if;
 r:=task_detail(t,actor);
 if jsonb_array_length(r->'cancellations')<>1 or not (r->'task'->>'can_cancel')::boolean then raise exception 'İptal detay audit eksik';end if;
 begin perform task_command('update',jsonb_build_object('id',t,'version',2,'title','Gizleme'),actor);raise exception using errcode='Z0001',message='İptal edilmiş kayıt düzenlendi';exception when insufficient_privilege or check_violation then null;end;
 begin update task_cancellation_events set reason='Değiştirildi' where task_id=t;raise exception using errcode='Z0001',message='Audit değiştirildi';exception when insufficient_privilege then null;end;
 begin delete from task_cancellation_events where task_id=t;raise exception using errcode='Z0001',message='Audit silindi';exception when insufficient_privilege then null;end;
 begin perform task_command('reactivate',jsonb_build_object('id',t,'version',1),actor);raise exception using errcode='Z0001',message='Eski sürümle açıldı';exception when serialization_failure then null;end;
 r:=task_command('reactivate',jsonb_build_object('id',t,'version',2),actor);
 if r->'task'->>'cancelled_at' is not null or r->'task'->>'archived_at' is not null or not (r->'task'->>'can_edit')::boolean then raise exception 'Yeniden açma bozuk';end if;
 if (select count(*) from task_cancellation_events where task_id=t)<>2 then raise exception 'Yeniden açma geçmişi eksik';end if;
 perform task_command('update',jsonb_build_object('id',t,'version',3,'archived',true),actor);
 perform task_command('cancel',jsonb_build_object('id',t,'version',4,'reason','Arşiv kaydı iptali'),actor);
 r:=task_command('reactivate',jsonb_build_object('id',t,'version',5),actor);
 if r->'task'->>'archived_at' is null then raise exception 'Önceki arşiv durumu kayboldu';end if;
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 set local role authenticated;
 if exists(select 1 from task_cancellation_events where task_id=t) then raise exception 'Kişisel audit başkasına açıldı';end if;
 reset role;
 perform set_config('request.jwt.claim.role','service_role',true);
 perform set_config('request.jwt.claim.sub','',true);
 -- Kişiye atamak alıcıya iptal yetkisi vermez.
 t:=(task_command('create',jsonb_build_object('title','Kişiye iptal testi','visibility','direct','assignee',other_user),actor)->'task'->>'id')::uuid;
 begin perform task_command('cancel',jsonb_build_object('id',t,'version',1,'reason','Yetki deneme'),other_user);raise exception using errcode='Z0001',message='Alıcı görevi iptal etti';exception when insufficient_privilege then null;end;
 -- Ekipte oluşturan/editör yerine yönetici karar verir.
 perform set_config('request.jwt.claim.sub',adm::text,true);
 team:=(task_command('team.create','{"name":"İptal test ekibi"}',adm)->'team'->>'id')::uuid;
 perform task_command('team.member',jsonb_build_object('team_id',team,'user_id',actor,'role','editor'),adm);
 perform set_config('request.jwt.claim.sub','',true);
 board:=(task_command('board.create',jsonb_build_object('name','İptal panosu','kind','task','team_id',team),actor)->'board'->>'id')::uuid;
 shared:=(task_command('create',jsonb_build_object('title','Paylaşılan iptal testi','visibility','team','board_id',board),actor)->'task'->>'id')::uuid;
 begin perform task_command('cancel',jsonb_build_object('id',shared,'version',1,'reason','Yetki deneme'),actor);raise exception using errcode='Z0001',message='Editör paylaşılan görevi iptal etti';exception when insufficient_privilege then null;end;
 perform task_command('cancel',jsonb_build_object('id',shared,'version',1,'reason','Yönetici iptali'),adm);
 perform task_command('reactivate',jsonb_build_object('id',shared,'version',2),adm);
end $$;

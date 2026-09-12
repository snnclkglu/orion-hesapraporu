-- Bütün senaryolar integrations-db.py test transaction'ında geri alınır.
do $$
declare a uuid; other_actor uuid; v jsonb; result jsonb; k uuid; c integer;
begin
 select id into a from profiles where role='admin' limit 1;
 select id into other_actor from profiles where role <> 'admin' limit 1;
 if a is null or other_actor is null then raise exception 'Rol testi için mevcut profiller gerekli'; end if;
 v:=jsonb_build_object('id','integration-test-only','name','API TEST AJANI','actorId',a,'scopes',array['tasks:read','offers:read'],'rateLimitPerMinute',60,'digest',repeat('a',64),'label','Test');
 begin perform agent_manage(other_actor,'create',v); raise exception 'Yönetici olmayan kişi ajan açtı'; exception when insufficient_privilege then null; end;
 perform agent_manage(a,'import',v);
 result:=agent_resolve(repeat('a',64),'integration-test-only');
 if result->'principal'->>'id' <> 'integration-test-only' then raise exception 'Eski anahtar korunmadı'; end if;
 begin perform agent_manage(a,'import',v); raise exception 'Aktarım tekrarlandı'; exception when serialization_failure then null; end;
 v:=v||jsonb_build_object('version',1,'status','paused','scopes',array['tasks:read']);
 perform agent_manage(a,'update',v);
 result:=agent_resolve(repeat('a',64),'integration-test-only');
 if not (result->>'managed')::boolean or result->'principal' <> 'null'::jsonb then raise exception 'Duraklatma aşıldı'; end if;
 begin perform agent_manage(a,'update',v); raise exception 'Eski sürüm kabul edildi'; exception when serialization_failure then null; end;
 v:=v||jsonb_build_object('version',2,'status','active'); perform agent_manage(a,'update',v);
 result:=agent_resolve(repeat('a',64),'integration-test-only');
 if result->'principal'->'scopes' <> '["tasks:read"]'::jsonb then raise exception 'İzin azaltımı uygulanmadı'; end if;
 perform agent_manage(a,'rotate',jsonb_build_object('id','integration-test-only','version',3,'overlapHours',24,'digest',repeat('b',64),'label','Test yeni'));
 if agent_resolve(repeat('a',64),null)->'principal'='null'::jsonb then raise exception 'Geçiş süresi yok'; end if;
 select id into k from agent_credentials where token_hash=repeat('a',64);
 perform agent_manage(a,'revoke',jsonb_build_object('id','integration-test-only','version',4,'credentialId',k));
 result:=agent_resolve(repeat('a',64),'integration-test-only');
 if result->'principal'<>'null'::jsonb or not (result->>'managed')::boolean then raise exception 'İptal edilen anahtar geri açıldı'; end if;
 result:=agent_resolve(repeat('c',64),'integration-test-only');
 if not (result->>'managed')::boolean then raise exception 'Aktarılan ajan ortam tanımına düştü'; end if;
 result:=agent_resolve(repeat('c',64),'untouched-agent');
 if (result->>'managed')::boolean then raise exception 'Aktarılmayan ajan engellendi'; end if;
 perform agent_manage(a,'rotate',jsonb_build_object('id','integration-test-only','version',5,'overlapHours',0,'digest',repeat('c',64),'label','Test hemen'));
 if agent_resolve(repeat('b',64),null)->'principal'<>'null'::jsonb then raise exception 'Eski anahtar hemen bitmedi'; end if;
 if agent_resolve(repeat('c',64),null)->'principal'='null'::jsonb then raise exception 'Yeni anahtar çalışmadı'; end if;
 if exists(select 1 from agent_config_events where agent_id='integration-test-only' and detail::text like '%'||repeat('a',64)||'%') then raise exception 'Gizli özet geçmişe sızdı'; end if;
 foreach v in array array[
  jsonb_build_object('request_id',gen_random_uuid(),'method','GET','route','/api/agent/tasks/:id','status',401,'duration_ms',1),
  jsonb_build_object('request_id',gen_random_uuid(),'method','GET','route','/api/agent/tasks/:id','status',401,'duration_ms',1)
 ] loop perform agent_record_request(v); end loop;
 select count(*) into c from agent_request_events where agent_id is null and route='/api/agent/tasks/:id' and status=401 and created_at>now()-interval '1 minute';
 if c<>1 then raise exception 'Bilinmeyen istek örneklemesi başarısız'; end if;
 if has_table_privilege('authenticated','public.agent_credentials','select') or has_table_privilege('anon','public.agent_request_events','select') then raise exception 'Tablo sırları dışarı açık'; end if;
 if has_function_privilege('authenticated','public.agent_manage(uuid,text,jsonb)','execute') or has_function_privilege('anon','public.agent_resolve(text,text)','execute') then raise exception 'Sunucu RPC dışarı açık'; end if;
end $$;

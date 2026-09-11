// Şema ve senaryolar alt transaction içinde sınanır; tüm değişiklikler geri alınır.
// Hiçbir gönderim işleyicisi çağrılmaz; canlı verilerde kalıcı test kaydı bırakılmaz.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
process.loadEnvFile('.env.frankfurt');
const schema=['20260911000007_email_center.sql','20260911000008_email_center_defaults.sql'].map(name=>fs.readFileSync(`supabase/migrations/${name}`,'utf8')).join('\n');
const scenarios=String.raw`
  if has_table_privilege('authenticated','public.email_deliveries','INSERT') then raise exception 'İstemci kuyruğa yazabiliyor'; end if;
  if has_function_privilege('authenticated','public.email_manage(text,jsonb,uuid,text)','EXECUTE') then raise exception 'İstemci yönetim geçidine erişiyor'; end if;
  if not has_function_privilege('service_role','public.email_claim_delivery()','EXECUTE') then raise exception 'Sunucu kuyruğa erişemiyor'; end if;
  select id into actor from public.profiles where role='admin' order by created_at limit 1;
  select id into job from public.jobs where not document_editing order by created_at limit 1;
  if actor is null or job is null then raise exception 'Test için yönetici ve mevcut iş kaydı gerekli'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  if not public.job_document_lock(job,actor) then raise exception 'Düzenleme kilidi alınamadı'; end if;
  if public.job_document_lock(job,gen_random_uuid()) then raise exception 'İkinci düzenleme aynı anda başladı'; end if;
  if public.job_document_lock(job,gen_random_uuid(),true) then raise exception 'Başka işlem kilidi kaldırabildi'; end if;
  if not public.job_document_lock(job,actor,true) then raise exception 'Düzenleme kilidi bırakılamadı'; end if;
  first_id:=public.publish_job_order(job);
  second_id:=public.publish_job_order(job);
  if first_id<>second_id then raise exception 'İkinci yayın ikinci kayıt oluşturdu'; end if;
  if (select count(*) from public.email_events where source_key='publication/'||first_id)<>1 then raise exception 'Yayın olayı tekil değil'; end if;
  if (select status from public.email_events where source_key='publication/'||first_id)<>'skipped' then raise exception 'Kapalı yayın kuralı gönderim üretti'; end if;
  update public.jobs set revision=case when revision='ZZ' then 'ZY' else 'ZZ' end where id=job;
  second_id:=public.publish_job_order(job);
  if (select event_type from public.email_events where source_key='publication/'||second_id)<>'job.revised' then raise exception 'Revizyon olayı oluşmadı'; end if;
  update public.jobs set document_editing=true where id=job;
  begin perform public.publish_job_order(job); raise exception using errcode='Z0002',message='Eksik kayıt yayımlandı';
  exception when raise_exception then null; end;
  update public.jobs set document_editing=false where id=job;
  select id into rule_id from public.email_rules where event_type='job.published';
  update public.email_rules set mode='test',include_actor=true,user_ids=array[actor] where id=rule_id;
  first_id:=public.email_capture_event('verification/event','job.published',job,actor,'{"notification.title":"Bağlantı testi","links.job":"https://app.orioncranes.com/jobs"}','{}');
  second_id:=public.email_capture_event('verification/event','job.published',job,actor,'{}','{}');
  if first_id<>second_id then raise exception 'Olay tekrar anahtarı çalışmıyor'; end if;
  select * into captured from public.email_events where id=first_id;
  if jsonb_array_length(captured.plans)<>1 then raise exception 'Kural anlık kaydı eksik'; end if;
  select published_version_id into version_id from public.email_templates limit 1;
  begin update public.email_template_versions set content='{}' where id=version_id; raise exception using errcode='Z0002',message='Sürüm değiştirilebildi';
  exception when raise_exception then null; end;
  select id into claimed from public.email_claim_event();
  if claimed<>first_id then raise exception 'Olay sahiplenilemedi'; end if;
  if exists(select 1 from public.email_claim_event() where id=first_id) then raise exception 'Aynı olay iki kez sahiplenildi'; end if;
  perform public.email_finish_event(first_id,1,jsonb_build_array(jsonb_build_object('ruleId',rule_id,'versionId',version_id,'jobId',job,
    'userId',null,'recipient','scolakoglu@orioncranes.com','name','Deneme','reasons','[]'::jsonb,'mode','test','payload','{}'::jsonb)));
  select id into delivery_id from public.email_claim_delivery();
  if delivery_id is null then raise exception 'Gönderim sahiplenilemedi'; end if;
  if exists(select 1 from public.email_claim_delivery() where id=delivery_id) then raise exception 'Aynı gönderim iki kez sahiplenildi'; end if;
  update public.email_deliveries set provider_id='verification-provider',status='sent' where id=delivery_id;
  insert into public.email_webhook_events(id,provider_id,event_type,occurred_at) values('test-delivered','verification-provider','email.delivered',now()),('test-sent','verification-provider','email.sent',now()-interval '1 minute');
  perform public.email_reconcile_delivery('verification-provider');
  if (select status from public.email_deliveries where id=delivery_id)<>'delivered' then raise exception 'Sırasız teslim sonucu geriledi'; end if;
  insert into public.email_webhook_events(id,provider_id,event_type,occurred_at) values('test-complaint','verification-provider','email.complained',now());
  perform public.email_reconcile_delivery('verification-provider');
  if (select status from public.email_deliveries where id=delivery_id)<>'complained' then raise exception 'Şikayet kaydı korunmadı'; end if;
  perform public.email_manage('settings.save','{"paused":true,"testAddress":"scolakoglu@orioncranes.com"}',actor,'verification');
  if exists(select 1 from public.email_claim_delivery()) then raise exception 'Durdurma çalışmıyor'; end if;
`;
const query=`do $validation$ declare actor uuid; job uuid; first_id uuid; second_id uuid; rule_id uuid; version_id uuid; claimed uuid; delivery_id uuid; captured record; begin
begin
${process.argv.includes('--installed')?'':`execute $schema$${schema}$schema$;`}
${scenarios}
raise exception using errcode='Z0001',message='Kontroller geçti';
exception when sqlstate 'Z0001' then raise notice 'Bütün kontroller geçti ve geri alındı'; end;
end $validation$;`;
fs.mkdirSync('tmp',{recursive:true});fs.writeFileSync('tmp/email-center-db-test.sql',query);
const uri=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());uri.password=process.env.SUPABASE_DB_PASSWORD;
const cli=process.env.ORION_SUPABASE_CLI;
if(!cli)throw new Error('ORION_SUPABASE_CLI gerekli.');
const result=spawnSync(cli,['db','query','--db-url',uri.href,'--file','tmp/email-center-db-test.sql'],{encoding:'utf8'});
if(result.status!==0){console.error(result.stdout,result.stderr);process.exit(1);}
console.log('Yayın, tekillik, sahiplenme, yetki, değişmez sürüm, sırasız teslim ve durdurma kontrolleri geçti. Değişiklikler geri alındı.');

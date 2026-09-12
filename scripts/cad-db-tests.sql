-- Bu betik cad-db-check.py tarafından geri alınan transaction içinde çalıştırılır.
create function pg_temp.cad_assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'CAD TEST: %',label; end if; end $$;
create function pg_temp.cad_expect_error(query text, label text) returns void language plpgsql as $$
declare rejected boolean=false;
begin
 begin execute query; exception when others then rejected=true; end;
 if not rejected then raise exception 'CAD TEST reddetmedi: %',label; end if;
end $$;

select set_config('cad.test_admin',(select id::text from profiles where role='admin' limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('cad.test_admin'),true);
select set_config('request.jwt.claim.role','service_role',true);

insert into auth.users(id,email,raw_user_meta_data)
values ('cadd0000-0000-4000-8000-000000000001','cad-test-one@example.invalid','{}'),
       ('cadd0000-0000-4000-8000-000000000002','cad-test-two@example.invalid','{}');
insert into profiles(id,full_name,role)
values('cadd0000-0000-4000-8000-000000000001','CAD TEST BİR','engineer'),
      ('cadd0000-0000-4000-8000-000000000002','CAD TEST İKİ','draftsman')
on conflict(id) do update set role=excluded.role;
insert into cad_devices(id,owner_id,name,state,last_seen_at)
values('cadd1000-0000-4000-8000-000000000001','cadd0000-0000-4000-8000-000000000001','TEST PC 1','ready',now()),
      ('cadd1000-0000-4000-8000-000000000002','cadd0000-0000-4000-8000-000000000002','TEST PC 2','ready',now());
insert into cad_device_secrets(device_id,pairing_hash,pairing_expires_at)
values('cadd1000-0000-4000-8000-000000000001',repeat('a',64),now()+interval '10 minutes');
select pg_temp.cad_assert(cad_pair(repeat('a',64),repeat('b',64))='cadd1000-0000-4000-8000-000000000001'::uuid,'eşleştirme');
select pg_temp.cad_expect_error($q$select cad_pair(repeat('a',64),repeat('c',64))$q$,'kod ikinci cihaza verilmez');
select pg_temp.cad_assert(cad_pair(repeat('a',64),repeat('b',64))='cadd1000-0000-4000-8000-000000000001'::uuid,'yanıt kaybında aynı anahtar tekrar güvenli');
update cad_devices set state='ready' where id='cadd1000-0000-4000-8000-000000000001';

select cad_mutate('cadd0000-0000-4000-8000-000000000001','create',jsonb_build_object(
 'id','cadd2000-0000-4000-8000-000000000001','deviceId','cadd1000-0000-4000-8000-000000000001',
 'name','TEST.dwg','size',10,'sha256',repeat('a',64),'options','{"paper":"A3","duplicates":"hepsi"}'::jsonb));
select cad_mutate('cadd0000-0000-4000-8000-000000000001','queue','{"jobId":"cadd2000-0000-4000-8000-000000000001"}');
select pg_temp.cad_assert(cad_mutate('cadd0000-0000-4000-8000-000000000002','claim','{}','cadd1000-0000-4000-8000-000000000002')='null'::jsonb,'başka cihaz işi alamaz');
select pg_temp.cad_assert(cad_mutate('cadd0000-0000-4000-8000-000000000001','claim','{}','cadd1000-0000-4000-8000-000000000001')->>'status'='processing','iş kapma');
select pg_temp.cad_assert(cad_mutate('cadd0000-0000-4000-8000-000000000001','claim','{}','cadd1000-0000-4000-8000-000000000001')='null'::jsonb,'tek cihaz tek iş');
select pg_temp.cad_expect_error($q$select cad_mutate('cadd0000-0000-4000-8000-000000000002','cancel','{"jobId":"cadd2000-0000-4000-8000-000000000001"}')$q$,'başka kullanıcı iptal edemez');
select pg_temp.cad_expect_error($q$select cad_mutate('cadd0000-0000-4000-8000-000000000001','complete','{"jobId":"cadd2000-0000-4000-8000-000000000001","attemptId":"cadd3000-0000-4000-8000-000000000099"}','cadd1000-0000-4000-8000-000000000001')$q$,'eski deneme sonuç yazamaz');

select set_config('request.jwt.claim.sub','cadd0000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.cad_assert((select count(*)=0 from cad_jobs where id='cadd2000-0000-4000-8000-000000000001'),'RLS başka kullanıcı işi görünmez');
select pg_temp.cad_assert((select count(*)=1 from cad_devices where id in('cadd1000-0000-4000-8000-000000000001','cadd1000-0000-4000-8000-000000000002')),'RLS yalnız kendi cihazı');
select pg_temp.cad_expect_error('select * from cad_device_secrets','cihaz sırları okunamaz');
select pg_temp.cad_expect_error($q$select cad_mutate('cadd0000-0000-4000-8000-000000000001','claim','{}','cadd1000-0000-4000-8000-000000000001')$q$,'istemci RPC çalıştıramaz');
select pg_temp.cad_expect_error($q$update cad_jobs set status='approved'$q$,'istemci tablo yazamaz');
reset role;
set local role anon;
select pg_temp.cad_expect_error('select * from cad_jobs','anonim iş okuyamaz');
reset role;

select set_config('request.jwt.claim.sub',current_setting('cad.test_admin'),true);
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare r text; should_allow boolean; accepted boolean; begin
 foreach r in array array['admin','manager','engineer','draftsman','purchasing','planning','quality','production'] loop
  update profiles set role=r::user_role where id='cadd0000-0000-4000-8000-000000000001';
  accepted=true;
  begin perform cad_mutate('cadd0000-0000-4000-8000-000000000001','heartbeat','{"state":"ready","protocol":1}','cadd1000-0000-4000-8000-000000000001');
  exception when others then accepted=false; end;
  should_allow=r in ('admin','engineer','draftsman');
  perform pg_temp.cad_assert(accepted=should_allow,'rol kapısı '||r);
 end loop;
 update profiles set role='engineer' where id='cadd0000-0000-4000-8000-000000000001';
end $$;

update cad_jobs set lease_until=now()-interval '1 second' where id='cadd2000-0000-4000-8000-000000000001';
select pg_temp.cad_assert((cad_mutate('cadd0000-0000-4000-8000-000000000001','heartbeat',
 jsonb_build_object('state','busy','protocol',1,'jobId',id,'attemptId',attempt_id),'cadd1000-0000-4000-8000-000000000001')->>'accepted')::boolean=false,'süresi geçmiş lease diriltilmez') from cad_jobs where id='cadd2000-0000-4000-8000-000000000001';
select cad_mutate('cadd0000-0000-4000-8000-000000000001','cancel','{"jobId":"cadd2000-0000-4000-8000-000000000001"}');
select pg_temp.cad_expect_error($q$select cad_mutate('cadd0000-0000-4000-8000-000000000001','complete',jsonb_build_object('jobId',id,'attemptId',attempt_id),'cadd1000-0000-4000-8000-000000000001') from cad_jobs where id='cadd2000-0000-4000-8000-000000000001'$q$,'iptal edilen iş sonuç yazamaz');

update cad_devices set state='ready',last_seen_at=now() where id='cadd1000-0000-4000-8000-000000000001';
select cad_mutate('cadd0000-0000-4000-8000-000000000001','retry','{"jobId":"cadd2000-0000-4000-8000-000000000001"}');
select pg_temp.cad_assert(cad_mutate('cadd0000-0000-4000-8000-000000000001','claim','{}','cadd1000-0000-4000-8000-000000000001')->>'attempts'='2','yeniden deneme yeni sahiplik');
update cad_jobs set status='review',result='{"arac_surum":"test"}' where id='cadd2000-0000-4000-8000-000000000001';
select pg_temp.cad_expect_error($q$select cad_export_start('cadd0000-0000-4000-8000-000000000001','cadd2000-0000-4000-8000-000000000001','TEST')$q$,'onaysız paket oluşmaz');
select cad_mutate('cadd0000-0000-4000-8000-000000000001','approve','{"jobId":"cadd2000-0000-4000-8000-000000000001"}');
select pg_temp.cad_assert(cad_export_start('cadd0000-0000-4000-8000-000000000001','cadd2000-0000-4000-8000-000000000001','TEST')=cad_export_start('cadd0000-0000-4000-8000-000000000001','cadd2000-0000-4000-8000-000000000001','TEST'),'iki aktarım tek paket');
select cad_mutate('cadd0000-0000-4000-8000-000000000001','revoke','{"deviceId":"cadd1000-0000-4000-8000-000000000001"}');
select pg_temp.cad_expect_error($q$select cad_mutate('cadd0000-0000-4000-8000-000000000001','heartbeat','{"state":"ready","protocol":1}','cadd1000-0000-4000-8000-000000000001')$q$,'iptal cihaz nabız yazamaz');

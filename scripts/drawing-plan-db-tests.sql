-- Test kayıtlarının tamamı drawing-plan-db-check.py tarafından geri alınır.
create function pg_temp.dp_assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'RESİM TEST: %',label; end if; end $$;
create function pg_temp.dp_reject(query text, label text) returns void language plpgsql as $$
declare rejected boolean=false;
begin begin execute query; exception when others then rejected=true; end;
if not rejected then raise exception 'RESİM TEST reddetmedi: %',label; end if; end $$;
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin' limit 1),true);
insert into auth.users(id,email,raw_user_meta_data) values
('dade0000-0000-4000-8000-000000000001','drawing-test@example.invalid','{}'),
('dade0000-0000-4000-8000-000000000002','drawing-view-test@example.invalid','{}');
insert into profiles(id,full_name,role) values
('dade0000-0000-4000-8000-000000000001','RESİM TEST','engineer'),
('dade0000-0000-4000-8000-000000000002','RESİM OKUMA TEST','draftsman')
on conflict(id) do update set role=excluded.role;
insert into projects(id,doc_no,name,customer,created_by,report_context) values
('dade1000-0000-4000-8000-000000000001','TEST-DRAWING-TRANSACTION','RESİM TEST','TEST','dade0000-0000-4000-8000-000000000001','engineering'),
('dade1000-0000-4000-8000-000000000002','TEST-DRAWING-OFFER','RESİM TEST','TEST','dade0000-0000-4000-8000-000000000001','offer');
select set_config('request.jwt.claim.sub','dade0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare p uuid='dade1000-0000-4000-8000-000000000001'; v bigint; oldv bigint; body jsonb; settings jsonb='{"numbering":{"main":1500,"auxiliary":2500}}'; begin
 body='[{"id":"dade2000-0000-4000-8000-000000000001","code":"1500","name":"ARABA","status":"bekliyor","sourceKey":"trolley:assembly"},{"id":"dade2000-0000-4000-8000-000000000002","code":"1600","name":"ŞASİ","status":"ciziliyor","parentId":"dade2000-0000-4000-8000-000000000001"}]';
 v=save_drawing_plan_document(p,0,body,settings);
 perform pg_temp.dp_assert((select count(*)=2 from project_drawing_plan where project_id=p),'ilk kayıt');
 oldv=v;
 body=jsonb_set(jsonb_set(body,'{0,code}','"1600"'),'{1,code}','"1500"');
 v=save_drawing_plan_document(p,v,body,settings);
 set constraints all immediate;
 set constraints all deferred;
 perform pg_temp.dp_assert((select code='1600' from project_drawing_plan where id='dade2000-0000-4000-8000-000000000001'),'numara takası');
 perform pg_temp.dp_reject(format('select save_drawing_plan_document(%L,%s,%L,%L)',p,oldv,body,settings),'eski sürüm');
 perform pg_temp.dp_reject(format('select save_drawing_plan_document(%L,%s,%L,%L)',p,v,jsonb_set(body,'{1,code}','"1600"'),settings),'tekrar kod');
 perform pg_temp.dp_reject(format('select save_drawing_plan_document(%L,%s,%L,%L)',p,v,jsonb_set(body,'{0,parentId}','"dade2000-0000-4000-8000-000000000002"'),settings),'montaj döngüsü');
 perform pg_temp.dp_reject(format('select save_drawing_plan_document(%L,%s,%L,%L)',p,v,jsonb_set(body,'{0,suppressed}','true'),settings),'gizli ebeveyn');
 perform pg_temp.dp_reject(format('select save_drawing_plan_document(%L,%s,%L,%L)',p,v,body,'{"numbering":{"main":2500,"auxiliary":1500}}'),'ters başlangıç');
 perform pg_temp.dp_assert((select version=v from project_drawing_plan_state where project_id=p),'hatalı işlem sürümü değiştirmez');
 perform pg_temp.dp_assert((select count(*)=2 from project_drawing_plan where project_id=p),'hatalı işlem satır kaybetmez');
 v=save_drawing_plan_document(p,v,body,settings);
 perform pg_temp.dp_assert((select count(*)=2 from project_drawing_plan where project_id=p),'tekrar kayıt çoğaltmaz');
 perform pg_temp.dp_reject(format('select save_drawing_plan_document(%L,0,%L,%L)','dade1000-0000-4000-8000-000000000002',body,settings),'teklif projesi');
end $$;
reset role;
select set_config('request.jwt.claim.sub','dade0000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.dp_assert((select count(*)=2 from project_drawing_plan where project_id='dade1000-0000-4000-8000-000000000001'),'ressam okuyabilir');
select pg_temp.dp_reject($q$select save_drawing_plan_document('dade1000-0000-4000-8000-000000000001',0,'[]','{"numbering":{"main":1500,"auxiliary":2500}}')$q$,'ressam yazamaz');
reset role;
set local role anon;
select pg_temp.dp_reject($q$select save_drawing_plan_document('dade1000-0000-4000-8000-000000000001',0,'[]','{}')$q$,'anonim yazamaz');
reset role;
-- Kaynak sürümü ve başka projeden satır kaçırma kontrolleri.
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin' limit 1),true);
insert into projects(id,doc_no,name,customer,created_by,report_context) values
('dade1000-0000-4000-8000-000000000003','TEST-DRAWING-OTHER','DİĞER TEST','TEST','dade0000-0000-4000-8000-000000000001','engineering');
insert into revisions(id,project_id,rev_no,label,created_by) values
('dade4000-0000-4000-8000-000000000001','dade1000-0000-4000-8000-000000000001',0,'TEST V0','dade0000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','dade0000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare v bigint; body jsonb; settings jsonb; stamp timestamptz; begin
 select version into v from project_drawing_plan_state where project_id='dade1000-0000-4000-8000-000000000001';
 body='[{"id":"dade2000-0000-4000-8000-000000000001","code":"1600","name":"ARABA","status":"bekliyor"}]';
 settings='{"sourceRevisionId":"dade4000-0000-4000-8000-000000000001","numbering":{"main":1500,"auxiliary":2500}}';
 select updated_at into stamp from revisions where id='dade4000-0000-4000-8000-000000000001';
 perform pg_temp.dp_reject(format('select save_drawing_plan_document(%L,%s,%L,%L,%L)','dade1000-0000-4000-8000-000000000001',v,body,settings,stamp-interval '1 second'),'eski hesap damgası');
 perform pg_temp.dp_reject(format('select save_drawing_plan_document(%L,0,%L,%L,%L)','dade1000-0000-4000-8000-000000000003','[]',settings,stamp),'başka proje kaynağı');
 perform pg_temp.dp_reject(format('select save_drawing_plan_document(%L,0,%L,%L)','dade1000-0000-4000-8000-000000000003',body,'{"numbering":{"main":1500,"auxiliary":2500}}'),'başka proje satırı');
 v=save_drawing_plan_document('dade1000-0000-4000-8000-000000000001',v,body,settings,stamp);
 perform pg_temp.dp_assert((select source_revision_id='dade4000-0000-4000-8000-000000000001'::uuid from project_drawing_plan_state where project_id='dade1000-0000-4000-8000-000000000001'),'geçerli kaynak kaydı');
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from profiles where role='admin' limit 1),true);
select * from approve_deletion_request(request_deletion('revision','dade4000-0000-4000-8000-000000000001','{}','GERİ ALINAN TEST'), 'GERİ ALINAN TEST');
select pg_temp.dp_assert((select count(*)=1 from project_drawing_plan where project_id='dade1000-0000-4000-8000-000000000001'),'kaynak silinmesi planı silmez');
select pg_temp.dp_assert((select source_revision_id is null from project_drawing_plan_state where project_id='dade1000-0000-4000-8000-000000000001'),'kaynak bağlantısı boşalır');

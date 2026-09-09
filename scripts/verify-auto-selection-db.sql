-- Yönetim bağlantısında çalıştırılır. Bütün test yazmaları en sonda geri alınır.
begin;
do $$
declare
  test_admin uuid; test_engineer uuid; test_offer uuid; test_revision uuid;
  first_project uuid; first_revision uuid; second_project uuid; second_revision uuid;
  rejected boolean := false;
  catalog_before bigint; catalog_after bigint;
begin
  select id into test_admin from public.profiles where role='admin' order by id limit 1;
  select id into test_engineer from public.profiles where role='engineer' order by id limit 1;
  if test_admin is null then raise exception 'Test admin rolü yok'; end if;
  insert into public.offers(offer_no,issue_date,seq,created_by,subject)
    values ('AUTO-SELECTION-TEST-'||gen_random_uuid(),current_date,(select coalesce(max(seq),0)+1 from public.offers),test_admin,'GERİ ALINAN ENTEGRASYON TESTİ') returning id into test_offer;
  insert into public.offer_revisions(offer_id,rev_no,created_by,payload)
    values (test_offer,0,test_admin,'{"items":[{"id":"auto-selection-test","title":"GERİ ALINAN ENTEGRASYON TESTİ"}]}') returning id into test_revision;
  perform set_config('request.jwt.claim.sub',test_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',test_admin,'role','authenticated')::text,true);
  set local role authenticated;
  select version into catalog_before from public.auto_selection_catalog_state;
  update public.cat_equipment set attrs=attrs where id=(select id from public.cat_equipment order by id limit 1);
  select version into catalog_after from public.auto_selection_catalog_state;
  if catalog_after<>catalog_before+1 then raise exception 'Katalog sürüm tetikleyicisi çalışmadı'; end if;
  select project_id,revision_id into first_project,first_revision from public.create_offer_item_calculation(test_revision,'auto-selection-test','{}','{}','{}','test');
  select project_id,revision_id into second_project,second_revision from public.create_offer_item_calculation(test_revision,'auto-selection-test','{}','{}','{}','test');
  if first_project is null or first_project<>second_project or first_revision<>second_revision then raise exception 'İdempotans testi başarısız'; end if;
  if (select count(*) from public.offer_item_calculations where offer_revision_id=test_revision)<>1 then raise exception 'Tek bağlantı testi başarısız'; end if;
  if not exists(select 1 from public.projects where id=first_project and report_context='offer') then raise exception 'Hesap bağlamı hatalı'; end if;
  if test_engineer is not null then
    perform set_config('request.jwt.claim.sub',test_engineer::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',test_engineer,'role','authenticated')::text,true);
    begin
      perform public.create_offer_item_calculation(test_revision,'auto-selection-test','{}','{}','{}','test');
    exception when others then rejected:=true;
    end;
    if not rejected then raise exception 'Yetkisiz rol engellenmedi'; end if;
  end if;
end;
$$;
rollback;
select true as transaction_assertions_passed, true as all_fixture_changes_rolled_back;

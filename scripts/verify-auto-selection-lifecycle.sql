-- İçeride COMMIT yoktur; çağıran BEGIN/ROLLBACK ile sarmalar.
do $$
declare
  test_admin uuid; test_engineer uuid; test_offer uuid; test_revision uuid; next_revision uuid;
  first_project uuid; first_revision uuid; repeat_project uuid; repeat_revision uuid;
  copy_project uuid; copy_revision uuid; source_time timestamptz; rejected boolean;
  original_item jsonb := '{"id":"lifecycle-original","title":"GERİ ALINAN YAŞAM DÖNGÜSÜ TESTİ"}';
  copy_item jsonb := '{"id":"lifecycle-copy","title":"GERİ ALINAN KOPYA TESTİ"}';
  test_inputs jsonb := '{"specs":{"mainCapacityT":10},"mainHoist":{"shaftD2Mm":177},"autoSelection":{"review":{"notes":{"test":"eski kontrol"}}}}';
  test_selections jsonb := '{"mainHoist":{"motorBrand":"MANUEL TEST"},"sectionNotes":{"main-2.4":"korunacak not"}}';
begin
  select id into test_admin from public.profiles where role='admin' order by id limit 1;
  select id into test_engineer from public.profiles where role='engineer' order by id limit 1;
  if test_admin is null then raise exception 'Test için yönetici bulunamadı'; end if;
  insert into public.offers(offer_no,issue_date,seq,created_by,subject)
    values('AUTO-LIFECYCLE-TEST-'||gen_random_uuid(),current_date,(select coalesce(max(seq),0)+1 from public.offers),test_admin,'GERİ ALINAN TEST') returning id into test_offer;
  insert into public.offer_revisions(offer_id,rev_no,created_by,payload)
    values(test_offer,0,test_admin,jsonb_build_object('items',jsonb_build_array(original_item,copy_item))) returning id into test_revision;
  perform set_config('request.jwt.claim.sub',test_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',test_admin,'role','authenticated')::text,true);
  set local role authenticated;
  select project_id,revision_id into first_project,first_revision from public.open_offer_item_calculation_v2(
    test_revision,'lifecycle-original',original_item,null,null,test_inputs,test_selections,'{}','test');
  select project_id,revision_id into repeat_project,repeat_revision from public.open_offer_item_calculation_v2(
    test_revision,'lifecycle-original',original_item,null,null,test_inputs,test_selections,'{}','test');
  if first_project<>repeat_project or first_revision<>repeat_revision then raise exception 'Tekrar ikinci hesap oluşturdu'; end if;
  select updated_at into source_time from public.revisions where id=first_revision;
  rejected:=false;
  begin
    perform public.open_offer_item_calculation_v2(test_revision,'lifecycle-original',original_item||'{"title":"eski teklif"}',first_revision,source_time,test_inputs,test_selections,'{}','test');
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Eski teklif snapshot kabul edildi'; end if;
  rejected:=false;
  begin
    perform public.open_offer_item_calculation_v2(test_revision,'lifecycle-original',original_item,first_revision,source_time-interval '1 second',test_inputs,test_selections,'{}','test');
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Eski hesap sürümü kabul edildi'; end if;
  test_inputs := jsonb_set(test_inputs,'{specs,mainCapacityT}','25');
  perform public.open_offer_item_calculation_v2(test_revision,'lifecycle-original',original_item,first_revision,source_time,test_inputs,test_selections,'{}','test');
  if (select inputs#>>'{specs,mainCapacityT}' from public.revisions where id=first_revision)<>'25' then raise exception 'Teknik güncelleme kaydedilmedi'; end if;
  select updated_at into source_time from public.revisions where id=first_revision;
  select project_id,revision_id into copy_project,copy_revision from public.open_offer_item_calculation_v2(
    test_revision,'lifecycle-copy',copy_item,first_revision,source_time,test_inputs #- '{autoSelection,review}',test_selections,'{}','test');
  if copy_project=first_project or copy_revision=first_revision then raise exception 'Kopya bağımsız değil'; end if;
  if (select selections from public.revisions where id=copy_revision)<>test_selections then raise exception 'Manuel seçim/not kayboldu'; end if;
  update public.revisions set status='issued' where id=first_revision;
  select updated_at into source_time from public.revisions where id=first_revision;
  select project_id,revision_id into repeat_project,repeat_revision from public.open_offer_item_calculation_v2(
    test_revision,'lifecycle-original',original_item,first_revision,source_time,test_inputs #- '{autoSelection,review}',test_selections,'{}','test');
  if repeat_project<>first_project or repeat_revision=first_revision then raise exception 'Yayımlanmış rapordan yeni taslak açılmadı'; end if;
  if (select status from public.revisions where id=first_revision)<>'issued' or (select inputs from public.revisions where id=first_revision)<>test_inputs then raise exception 'Yayımlanmış kaynak değişti'; end if;
  if (select revision_id from public.offer_item_calculations where offer_revision_id=test_revision and item_id='lifecycle-original')<>repeat_revision then raise exception 'Teklif bağı yeni taslağa ilerlemedi'; end if;
  insert into public.offer_revisions(offer_id,rev_no,created_by,payload)
    values(test_offer,1,test_admin,jsonb_build_object('items',jsonb_build_array(original_item,copy_item))) returning id into next_revision;
  if (select count(*) from public.offer_item_calculations where offer_revision_id=next_revision)<>2 then raise exception 'Yeni teklif revizyonunun hesap bağları yok'; end if;
  if exists(select 1 from public.offer_item_calculations where offer_revision_id=next_revision and project_id in(first_project,copy_project)) then raise exception 'Yeni revizyon eski projeyi paylaşıyor'; end if;
  if exists(select 1 from public.offer_item_calculations c join public.revisions r on r.id=c.revision_id where c.offer_revision_id=next_revision and
    (r.inputs#>>'{mainHoist,shaftD2Mm}'<>'177' or r.selections<>test_selections or r.inputs#>'{autoSelection,review}' is not null)) then raise exception 'Kopyanın manuel alanları/inceleme onayı hatalı'; end if;
  if has_function_privilege('anon','public.open_offer_item_calculation_v2(uuid,text,jsonb,uuid,timestamptz,jsonb,jsonb,jsonb,text)','execute') then raise exception 'Anonim RPC kapısı açık'; end if;
  if test_engineer is not null then
    perform set_config('request.jwt.claim.sub',test_engineer::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',test_engineer,'role','authenticated')::text,true);
    rejected:=false;
    begin perform public.open_offer_item_calculation_v2(test_revision,'lifecycle-original',original_item,null,null,test_inputs,test_selections,'{}','test');
    exception when others then rejected:=true; end;
    if not rejected then raise exception 'Teklif yetkisi olmayan rol kabul edildi'; end if;
  end if;
end;
$$;

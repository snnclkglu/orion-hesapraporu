begin;
do $$
declare v_id uuid; v_total integer; v_page jsonb;
begin
  if public.orion_brand_upper('Haşçelik') <> 'HAŞÇELİK'
    or public.orion_brand_upper('Yılmaz Redüktör') <> 'YILMAZ REDÜKTÖR'
    or public.orion_brand_upper('Conductix-Wampfler') <> 'CONDUCTIX-WAMPFLER'
    or public.orion_brand_upper('Dereli') <> 'DERELI' then raise exception 'Marka harf dönüşümü hatalı'; end if;
  if exists(select 1 from public.cat_equipment where brand <> public.orion_brand_upper(brand))
    or exists(select 1 from public.cat_couplings where brand <> public.orion_brand_upper(brand))
    or exists(select 1 from public.electrical_catalog_documents where manufacturer <> public.orion_brand_upper(manufacturer))
    or exists(select 1 from public.offer_options where list_key like 'brand.%' and value <> public.orion_brand_upper(value)) then raise exception 'Küçük harfli marka kaldı'; end if;
  insert into public.cat_equipment(kind,brand,model,attrs) values ('motor','Haşçelik','__OTOMATIK_TEST__','{}') returning id into v_id;
  if (select brand from public.cat_equipment where id = v_id) <> 'HAŞÇELİK' then raise exception 'INSERT normalizasyonu yok'; end if;
  update public.cat_equipment set brand='Dereli' where id=v_id;
  if (select brand from public.cat_equipment where id = v_id) <> 'DERELI' then raise exception 'UPDATE normalizasyonu yok'; end if;
  v_page := public.auto_selection_catalog_page('[{"kind":"gearbox","brands":["Yılmaz Redüktör"],"application":"yurutme","series":"DR"}]',0);
  select count(*) into v_total from public.cat_equipment where brand='YILMAZ REDÜKTÖR' and attrs->>'application'='yurutme' and attrs->>'series'='DR' and active;
  if v_total < 1 or (v_page->>'total')::int <> v_total then raise exception 'DR seri/marka filtresi eksik'; end if;
  if exists(select 1 from jsonb_array_elements(v_page->'rows') r where r->'attrs'->>'series' <> 'DR') then raise exception 'Başka seri karıştı'; end if;
  if (public.auto_selection_catalog_page('[{"kind":"gearbox","brands":null,"series":"OLMAYAN"}]',0)->>'total')::int <> 0 then raise exception 'Boş seri kısıtı gevşetildi'; end if;
  if not exists(select 1 from jsonb_array_elements(public.auto_selection_catalog_manifest()) f where f->>'brand'='YILMAZ REDÜKTÖR' and f->'attrs'->>'series'='DR') then raise exception 'Seri manifestte yok'; end if;
  if has_function_privilege('anon','public.auto_selection_catalog_page(jsonb,integer)','execute') then raise exception 'Anonim erişim açılmış'; end if;
end $$;
select true as brand_and_series_checks_passed,
  (select count(*) from public.cat_equipment) as catalog_rows,
  jsonb_array_length(public.auto_selection_catalog_manifest()) as families;
rollback;

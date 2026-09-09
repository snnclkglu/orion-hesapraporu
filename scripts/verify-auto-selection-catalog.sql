-- Çağıran işlem BEGIN/ROLLBACK ile çalıştırır; hiçbir ürün değiştirilmez.
do $$
declare v_data jsonb; v_expected integer; v_page jsonb;
begin
  v_data := public.auto_selection_catalog_manifest();
  if jsonb_typeof(v_data) <> 'array' or jsonb_array_length(v_data) = 0 then raise exception 'Aile özeti boş'; end if;
  select count(*) into v_expected from public.cat_equipment where kind = 'motor' and brand = 'SEW-EURODRIVE' and coalesce(attrs->>'unverified','false') <> 'true';
  if v_expected = 0 then raise exception 'Referans motor markası yok'; end if;
  v_page := public.auto_selection_catalog_page('[{"kind":"motor","brands":["SEW-EURODRIVE"]}]',0);
  if (v_page->>'total')::int <> v_expected then raise exception 'Marka süzgeci farklı toplam döndürdü'; end if;
  if exists(select 1 from jsonb_array_elements(v_page->'rows') e where e->>'kind' <> 'motor' or e->>'brand' <> 'SEW-EURODRIVE') then raise exception 'Filtre dışı ürün'; end if;
  if (public.auto_selection_catalog_page('[]',0)->>'total')::int <> 0 then raise exception 'Boş kapsam bütün kataloğu getirdi'; end if;
  if (public.auto_selection_catalog_page('[{"kind":"motor","brands":["olmayan marka"]}]',0)->>'total')::int <> 0 then raise exception 'Olmayan marka gevşetildi'; end if;
  v_page := public.auto_selection_catalog_page('[{"kind":"gearbox","brands":["FLENDER"],"application":"kaldirma"},{"kind":"gearbox","brands":["Yılmaz Redüktör"],"application":"yurutme"}]',0);
  select count(*) into v_expected from public.cat_equipment where kind='gearbox' and ((brand='FLENDER' and attrs->>'application'='kaldirma') or (brand='Yılmaz Redüktör' and attrs->>'application'='yurutme')) and coalesce(attrs->>'unverified','false') <> 'true';
  if (v_page->>'total')::int<>v_expected then raise exception 'Görev/marka birleşimi yanlış'; end if;
  if has_function_privilege('anon','public.auto_selection_catalog_manifest()','EXECUTE') or has_function_privilege('anon','public.auto_selection_catalog_page(jsonb,integer)','EXECUTE') then raise exception 'Anon erişimi açık'; end if;
  begin
    perform public.auto_selection_catalog_page('[{"kind":"uydurma","brands":null}]',0);
    raise exception 'Geçersiz filtre kabul edildi';
  exception when raise_exception then if sqlerrm = 'Geçersiz filtre kabul edildi' then raise; end if; end;
end;
$$;
select true as catalog_assertions_passed, jsonb_array_length(public.auto_selection_catalog_manifest()) as families,
  octet_length(public.auto_selection_catalog_manifest()::text) as manifest_bytes;

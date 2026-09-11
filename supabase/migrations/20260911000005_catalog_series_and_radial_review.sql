-- FLENDER: sayısal kaynak PDF s.9/8; N→kN dönüşümü tek kez yapılır.
with radial(model,kn) as (values
('H2-04',10),
('H2-05',13),
('H2-06',13),
('H2-07',18),
('H2-08',18),
('H2-09',10),
('H2-10',28),
('H2-11',35),
('H2-12',35),
('H2-13',112),
('H2-14',112),
('H2-15',85),
('H2-16',135),
('H2-17',135),
('H2-18',135),
('B2-04',12),
('B2-05',15),
('B2-06',15),
('B2-07',17),
('B2-08',17),
('B2-09',10),
('B2-10',30),
('B2-11',35),
('B2-12',38),
('B2-13',110),
('B2-14',110),
('B2-15',75),
('B2-16',145),
('B2-17',100),
('B2-18',100),
('H3-05',18),
('H3-06',18),
('H3-07',26),
('H3-08',26),
('H3-09',18),
('H3-10',40),
('H3-11',50),
('H3-12',50),
('H3-13',150),
('H3-14',150),
('H3-15',120),
('H3-16',185),
('H3-17',185),
('H3-18',190),
('H4-07',26),
('H4-08',26),
('H4-09',18),
('H4-10',40),
('H4-11',50),
('H4-12',50),
('H4-13',150),
('H4-14',150),
('H4-15',120),
('H4-16',185),
('H4-17',185),
('H4-18',190),
('B3-04',9),
('B3-05',18),
('B3-06',18),
('B3-07',26),
('B3-08',26),
('B3-09',18),
('B3-10',40),
('B3-11',50),
('B3-12',50),
('B3-13',150),
('B3-14',150),
('B3-15',120),
('B3-16',185),
('B3-17',185),
('B3-18',190),
('B4-05',18),
('B4-06',18),
('B4-07',26),
('B4-08',26),
('B4-09',18),
('B4-10',40),
('B4-11',50),
('B4-12',50),
('B4-13',150),
('B4-14',150),
('B4-15',120),
('B4-16',185),
('B4-17',185),
('B4-18',190)
)
update public.cat_equipment e set attrs = (e.attrs - 'allowed_radial_output_kn') ||
 jsonb_build_object('allowed_radial_output_kn',r.kn)
from radial r where e.kind='gearbox' and e.brand='FLENDER' and e.model=r.model;
update public.cat_equipment set attrs = attrs - 'allowed_radial_output_kn'
where kind='gearbox' and brand='FLENDER' and (model ~ '^H1-' or substring(model from '-([0-9]+)')::int >= 19);
update public.cat_equipment set attrs = attrs || jsonb_build_object(
 'series',case when model ~ '^H[1-4]-' then 'H' else attrs->>'series' end,
 'stage_type',split_part(model,'-',1), 'radial_load_basis',
'MD 20.1 s.9/8: standart masif mil S, mil uzantısı ortasında kuvvet; düşeyden ±35°, f1 ≥ 1,2. Mil versiyonlarının en küçük FR2 değeri. H1 ve 19+ boylar üretici teyidi gerektirir; takviyeli yatak V tablosu kullanılmaz.')
where kind='gearbox' and brand='FLENDER';

-- Küçük katalog özeti artık gerçek seri ve giriş bağlantısını da taşır.
create or replace function public.auto_selection_catalog_manifest()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(f) order by f.kind, f.brand, f.attrs::text), '[]'::jsonb) from (
    select kind, brand, jsonb_strip_nulls(jsonb_build_object(
      'application', attrs->'application', 'brake_type', attrs->'brake_type',
      'coupling_type', attrs->'coupling_type', 'typical_application', attrs->'typical_application',
      'type', attrs->'type', 'series', attrs->'series', 'construction', attrs->'construction', 'input_configuration', attrs->'input_configuration')) as attrs,
      count(*)::int as count
    from public.cat_equipment where active and coalesce(attrs->>'unverified','false') <> 'true'
    group by 1,2,3
  ) f;
$$;

create or replace function public.auto_selection_catalog_page(p_filter jsonb, p_page integer)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if jsonb_typeof(p_filter) is distinct from 'array' or jsonb_array_length(p_filter) > 20
    or p_page is null or p_page < 0 or p_page > 1000 or octet_length(p_filter::text) > 30000 then
    raise exception 'Geçersiz katalog filtresi';
  end if;
  if exists(select 1 from jsonb_array_elements(p_filter) f where
    coalesce(f->>'kind','') not in ('air_conditioner','bearing','bearing_housing','brake','buffer','coupling','festoon','gearbox','hook','motor','rope','sheave','wheel')
    or (f->'brands' <> 'null'::jsonb and jsonb_typeof(f->'brands') is distinct from 'array')
    or (f->>'application' is not null and f->>'application' not in ('kaldirma','yurutme'))
    or (f ? 'series' and (jsonb_typeof(f->'series') is distinct from 'string' or length(f->>'series') not between 1 and 200))) then
    raise exception 'Geçersiz ürün ailesi';
  end if;
  with eligible as materialized (
    select e.id,e.kind,e.brand,e.model,e.attrs,e.datasheet_url from public.cat_equipment e
    where e.active and coalesce(e.attrs->>'unverified','false') <> 'true' and exists (
      select 1 from jsonb_array_elements(p_filter) f where f->>'kind' = e.kind
      and (f->'brands' = 'null'::jsonb or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(f->'brands') = 'array' then f->'brands' else '[]'::jsonb end) b where public.orion_brand_upper(b) = e.brand))
      and (f->>'application' is null or f->>'application' = e.attrs->>'application')
      and (f->>'series' is null or f->>'series' = case when e.kind='rope' then e.attrs->>'construction' else e.attrs->>'series' end)
    )
  ), selected as (select * from eligible order by id offset p_page * 1000 limit 1000)
  select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from selected s), '[]'::jsonb),
    'total', (select count(*) from eligible), 'page', p_page) into v_result;
  return v_result;
end;
$$;
-- CREATE OR REPLACE önceki authenticated yetkilerini ve anon yasağını korur.

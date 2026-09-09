-- Küçük katalog özeti artık gerçek seri ve giriş bağlantısını da taşır.
create or replace function public.auto_selection_catalog_manifest()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(f) order by f.kind, f.brand, f.attrs::text), '[]'::jsonb) from (
    select kind, brand, jsonb_strip_nulls(jsonb_build_object(
      'application', attrs->'application', 'brake_type', attrs->'brake_type',
      'coupling_type', attrs->'coupling_type', 'typical_application', attrs->'typical_application',
      'type', attrs->'type', 'series', attrs->'series', 'input_configuration', attrs->'input_configuration')) as attrs,
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
      and (f->>'series' is null or f->>'series' = e.attrs->>'series')
    )
  ), selected as (select * from eligible order by id offset p_page * 1000 limit 1000)
  select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from selected s), '[]'::jsonb),
    'total', (select count(*) from eligible), 'page', p_page) into v_result;
  return v_result;
end;
$$;
-- CREATE OR REPLACE önceki authenticated yetkilerini ve anon yasağını korur.

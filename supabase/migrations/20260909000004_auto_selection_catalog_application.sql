-- Bir marka kaldırma, diğeri yürütme için istendiğinde iki markanın bütün
-- redüktörlerini indirmek yerine uygulama + marka birlikte süzülür.
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
    or (f->>'application' is not null and f->>'application' not in ('kaldirma','yurutme'))) then
    raise exception 'Geçersiz ürün ailesi';
  end if;
  with eligible as materialized (
    select e.id,e.kind,e.brand,e.model,e.attrs,e.datasheet_url from public.cat_equipment e
    where coalesce(e.attrs->>'unverified','false') <> 'true' and exists (
      select 1 from jsonb_array_elements(p_filter) f where f->>'kind' = e.kind
      and (f->'brands' = 'null'::jsonb or f->'brands' ? e.brand)
      and (f->>'application' is null or f->>'application' = e.attrs->>'application')
    )
  ), selected as (select * from eligible order by id offset p_page * 1000 limit 1000)
  select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from selected s), '[]'::jsonb),
    'total', (select count(*) from eligible), 'page', p_page) into v_result;
  return v_result;
end;
$$;

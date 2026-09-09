-- Marka penceresi ürün satırlarını değil küçük aile özetini indirir.
-- Formüller yoktur; katalog RLS politikaları SECURITY INVOKER ile korunur.
create function public.auto_selection_catalog_manifest()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(f) order by f.kind, f.brand, f.attrs::text), '[]'::jsonb) from (
    select kind, brand, jsonb_strip_nulls(jsonb_build_object(
      'application', attrs->'application', 'brake_type', attrs->'brake_type',
      'coupling_type', attrs->'coupling_type', 'typical_application', attrs->'typical_application', 'type', attrs->'type')) as attrs,
      count(*)::int as count
    from public.cat_equipment where coalesce(attrs->>'unverified','false') <> 'true'
    group by 1,2,3
  ) f;
$$;
create function public.auto_selection_catalog_page(p_filter jsonb, p_page integer)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if jsonb_typeof(p_filter) is distinct from 'array' or jsonb_array_length(p_filter) > 13
    or p_page is null or p_page < 0 or p_page > 1000 or octet_length(p_filter::text) > 30000 then
    raise exception 'Geçersiz katalog filtresi';
  end if;
  if exists(select 1 from jsonb_array_elements(p_filter) f where
    coalesce(f->>'kind','') not in ('air_conditioner','bearing','bearing_housing','brake','buffer','coupling','festoon','gearbox','hook','motor','rope','sheave','wheel')
    or (f->'brands' <> 'null'::jsonb and jsonb_typeof(f->'brands') is distinct from 'array')) then
    raise exception 'Geçersiz ürün ailesi';
  end if;
  with eligible as materialized (
    select e.id,e.kind,e.brand,e.model,e.attrs,e.datasheet_url from public.cat_equipment e
    where coalesce(e.attrs->>'unverified','false') <> 'true' and exists (
      select 1 from jsonb_array_elements(p_filter) f where f->>'kind' = e.kind
      and (f->'brands' = 'null'::jsonb or f->'brands' ? e.brand)
    )
  ), selected as (select * from eligible order by id offset p_page * 1000 limit 1000)
  select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from selected s), '[]'::jsonb),
    'total', (select count(*) from eligible), 'page', p_page) into v_result;
  return v_result;
end;
$$;
revoke all on function public.auto_selection_catalog_manifest() from public,anon;
revoke all on function public.auto_selection_catalog_page(jsonb,integer) from public,anon;
grant execute on function public.auto_selection_catalog_manifest() to authenticated;
grant execute on function public.auto_selection_catalog_page(jsonb,integer) to authenticated;

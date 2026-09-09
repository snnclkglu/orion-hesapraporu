-- Marka kimliği veride büyür; Türkçe harfli adlar kimlikBuyuk ile aynı kuraldadır.
create function public.orion_brand_upper(value text) returns text
language sql immutable strict set search_path = '' as $$
  select case when value ~ '[şŞğĞıİçÇöÖüÜ]'
    then upper(translate(btrim(value), 'iı', 'İI')) else upper(btrim(value)) end;
$$;

-- Kimlikler birleştirilmez veya silinmez; tekillik çakışması tüm işlemi durdurur.
do $$ begin
  if exists(select 1 from public.cat_couplings group by coupling_type, public.orion_brand_upper(brand), series, model having count(distinct brand) > 1) then
    raise exception 'Marka dönüşümünde kaplin kimliği çakışıyor';
  end if;
end $$;

create function public.normalize_catalog_brand() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'electrical_catalog_documents' then
    new.manufacturer := public.orion_brand_upper(new.manufacturer);
  elsif tg_table_name = 'offer_options' then
    if new.list_key like 'brand.%' then new.value := public.orion_brand_upper(new.value); end if;
  else
    new.brand := public.orion_brand_upper(new.brand);
  end if;
  return new;
end;
$$;
revoke all on function public.normalize_catalog_brand() from public, anon, authenticated;
create trigger normalize_brand before insert or update of brand on public.cat_equipment for each row execute function public.normalize_catalog_brand();
create trigger normalize_brand before insert or update of brand on public.cat_couplings for each row execute function public.normalize_catalog_brand();
create trigger normalize_brand before insert or update of manufacturer on public.electrical_catalog_documents for each row execute function public.normalize_catalog_brand();
create trigger normalize_brand before insert or update of list_key,value on public.offer_options for each row execute function public.normalize_catalog_brand();

update public.cat_equipment set brand = public.orion_brand_upper(brand) where brand is distinct from public.orion_brand_upper(brand);
update public.cat_couplings set brand = public.orion_brand_upper(brand) where brand is distinct from public.orion_brand_upper(brand);
update public.electrical_catalog_documents set manufacturer = public.orion_brand_upper(manufacturer) where manufacturer is distinct from public.orion_brand_upper(manufacturer);
update public.offer_options set value = public.orion_brand_upper(value) where list_key like 'brand.%' and value is distinct from public.orion_brand_upper(value);

-- Yayımlanmış hesap/teklif snapshot'ları tarihsel kayıttır; içerikleri değiştirilmez.

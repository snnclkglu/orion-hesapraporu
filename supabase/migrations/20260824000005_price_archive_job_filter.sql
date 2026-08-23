-- FİYAT ARŞİVİ — İŞ NUMARASI ARAMASI VE SÜZGECİ
--
-- Arama metni `item_no`yu zaten taşıyordu; kullanıcı bunu arayüzde açıkça
-- kullanabilmek ve aynı alanı çoklu süzgeç olarak da seçebilmek istedi.
-- Süzgeç sunucuda kalır: sayfa yalnız görünen 100 satırı taşımaya devam eder.
--
-- `item_no` burada BAĞLAMdır, yabancı anahtar değildir. Devralınan fiyatlar
-- kapanmış/eski bir işe ait olabilir; `jobs` tablosuna join etmek o bağlamı
-- arşivden düşürürdü. Bu yüzden olayın üstündeki metin aynen korunur.

create or replace view public.purchase_price_index
with (security_invoker = true) as
with olaylar as (
  select
    q.match_key, q.sample, q.supplier, q.quoted_at as gun,
    q.unit_price_eur as eur, q.unit_price as birim, q.currency,
    'teklif'::text as tur, ''::text as kategori, q.item_no
  from public.purchase_quotes q

  union all

  select
    l.match_key, l.sample, o.supplier, o.ordered_at,
    case when o.fx_rate is not null and o.fx_rate > 0 then l.unit_price / o.fx_rate end,
    l.unit_price, o.currency,
    'siparis', '', l.item_no
  from public.purchase_order_lines l
  join public.purchase_orders o on o.id = l.order_id
  where o.cancelled_at is null and l.unit_price is not null

  union all

  select
    h.match_key, h.sample, h.supplier, h.priced_at,
    h.unit_price_eur, h.unit_price, h.currency,
    'gecmis', h.category, h.item_no
  from public.purchase_price_history h
),
son as (
  select distinct on (match_key) match_key, gun, supplier, eur, birim, currency
  from olaylar where tur <> 'teklif'
  order by match_key, gun desc, supplier
)
select
  o.match_key,
  min(o.sample)                                                as sample,
  max(o.gun)                                                   as son_hareket,
  s.gun                                                        as son_alis_gun,
  s.supplier                                                   as son_alis_firma,
  s.eur                                                        as son_alis_eur,
  s.birim                                                      as son_alis_birim,
  s.currency                                                   as son_alis_para,
  min(o.eur) filter (where o.tur <> 'teklif')                  as en_dusuk,
  max(o.eur) filter (where o.tur <> 'teklif')                  as en_yuksek,
  count(*) filter (where o.tur = 'teklif')::int                as teklif_sayisi,
  count(*) filter (where o.tur = 'siparis')::int               as siparis_sayisi,
  count(*) filter (where o.tur = 'gecmis')::int                as gecmis_sayisi,
  array_agg(distinct o.supplier) filter (where o.supplier <> '')   as firmalar,
  array_agg(distinct o.kategori) filter (where o.kategori <> '')   as kategoriler,
  array_agg(distinct o.tur)                                        as turler,
  -- SERBEST ARAMA: ürün + tedarikçi + iş numarası + kategori.
  translate(
    upper(
      coalesce(min(o.sample), '') || ' ' ||
      coalesce(string_agg(distinct o.supplier, ' '), '') || ' ' ||
      coalesce(string_agg(distinct o.item_no, ' '), '') || ' ' ||
      coalesce(string_agg(distinct o.kategori, ' '), '')
    ),
    'IİIÇĞÖŞÜáâäàéêëèíîïìóôöòúûüù',
    'IIICGOSUAAAAEEEEIIIIOOOOUUUU'
  )                                                            as ara,
  -- CREATE OR REPLACE mevcut görünümün sütunlarını aynı sırada ister; yeni
  -- alan bu yüzden en sonda eklenir. `overlaps` çoklu iş filtresini uygular.
  coalesce(
    array_agg(distinct o.item_no) filter (where btrim(o.item_no) <> ''),
    '{}'::text[]
  )                                                            as isler
from olaylar o
left join son s on s.match_key = o.match_key
group by o.match_key, s.gun, s.supplier, s.eur, s.birim, s.currency;

comment on view public.purchase_price_index is
  'Fiyat arşivinin kalem başına dizini; ürün, tedarikçi ve iş numarasıyla '
  'sunucuda aranır/süzülür ve sayfalanır.';

-- Süzgeç yalnız arşivde gerçekten bulunan iş numaralarını sunar. İptal edilen
-- sipariş dizine girmediği için seçeneklere de girmez; iki yüz aynı kümeyi
-- konuşur.
create or replace view public.purchase_price_job_options
with (security_invoker = true) as
select distinct is_no
from (
  select btrim(q.item_no) as is_no
  from public.purchase_quotes q
  where btrim(q.item_no) <> ''

  union

  select btrim(l.item_no)
  from public.purchase_order_lines l
  join public.purchase_orders o on o.id = l.order_id
  where o.cancelled_at is null
    and l.unit_price is not null
    and btrim(l.item_no) <> ''

  union

  select btrim(h.item_no)
  from public.purchase_price_history h
  where btrim(h.item_no) <> ''
) kaynak;

comment on view public.purchase_price_job_options is
  'Fiyat Arşivi İş Numarası süzgecinin, yalnız arşivde kullanılan seçenekleri.';

-- FİYAT ARŞİVİ DİZİNİ — üç kaynak tek görünümde, süzgeç ve sayfalama SQL'de.
--
-- Kullanıcı bildirimi (13.08.2026, ikinci tur): *"Yine yavaş geldi bana, biraz
-- hızlanmış."* Ölçüldü ve haklı:
--
--   · Görünümün KENDİSİ hızlı — `explain analyze` 54 ms.
--   · Kalan maliyet TAŞIMA ve İSTEMCİDE SÜZME: 1675 satır (360 KB) her
--     ziyarette tarayıcıya gidiyor, orada ayrıştırılıyor ve her tuşa basışta
--     baştan süzülüyor. Ekranda ise 100 satır var.
--
-- ÇÖZÜM SÜZGECİ DE VERİTABANINA ALMAKTIR. Sayfa artık yalnız GÖRÜNEN 100
-- satırı çeker (~25 KB); arama ve süzgeç `where` ile TÜM arşivde çalışır —
-- yani kullanıcının şartı ("arama ve filtreyi tüm sayfalar için yapsın")
-- gevşemez, tersine gerçek anlamını kazanır: artık istemciye hiç gelmemiş
-- satırlarda da arıyor.
--
-- ÜÇ KAYNAK BURADA BİRLEŞİR ve kalem başına TEK satır olur. Birleştirme
-- istemcide yapılıyordu; orada yapılınca üç listenin de tamamı gönderilmek
-- zorundaydı. Kaynak AYRIMI kaybolmuyor — sayaçlar tür tür duruyor.

create or replace view public.purchase_price_index
with (security_invoker = true) as
with olaylar as (
  -- TEKLİF — istenen fiyat, alınmamış olabilir.
  select
    q.match_key, q.sample, q.supplier, q.quoted_at as gun,
    q.unit_price_eur as eur, q.unit_price as birim, q.currency,
    'teklif'::text as tur, ''::text as kategori, q.item_no
  from public.purchase_quotes q

  union all

  -- SİPARİŞ — bu uygulamadan verilmiş. İPTAL EDİLENLER GİRMEZ: arşivin sorusu
  -- "kaça aldık" ve iptal edilmiş bir sipariş bir alım değildir. (Ekranda
  -- ayrıca gösterilmesi ayrı bir karardı; dizin ORTALAMA ve SON ALIŞ üretir
  -- ve oraya iptali karıştırmak referansı bozardı.)
  select
    l.match_key, l.sample, o.supplier, o.ordered_at,
    case when o.fx_rate is not null and o.fx_rate > 0 then l.unit_price / o.fx_rate end,
    l.unit_price, o.currency,
    'siparis', '', l.item_no
  from public.purchase_order_lines l
  join public.purchase_orders o on o.id = l.order_id
  where o.cancelled_at is null and l.unit_price is not null

  union all

  -- DEVRALINAN — Excel'den gelen geçmiş alım.
  select
    h.match_key, h.sample, h.supplier, h.priced_at,
    h.unit_price_eur, h.unit_price, h.currency,
    'gecmis', h.category, h.item_no
  from public.purchase_price_history h
),
son as (
  -- EN SON GERÇEKLEŞMİŞ ALIM (teklif değil): "son alış" sütunu budur.
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
  -- ARAMA SÜTUNU: tanım + firmalar + iş numaraları + kategoriler, TEK metin.
  -- `ilike` bunun üzerinde çalışır; istemcideki `trKatla` karşılığı SQL'de
  -- `unaccent` olurdu ama eklenti şart koşmamak için Türkçe'ye özgü harfler
  -- `translate` ile katlanır — arama kutusunun kuralı ekranla AYNI kalsın.
  translate(
    upper(
      coalesce(min(o.sample), '') || ' ' ||
      coalesce(string_agg(distinct o.supplier, ' '), '') || ' ' ||
      coalesce(string_agg(distinct o.item_no, ' '), '') || ' ' ||
      coalesce(string_agg(distinct o.kategori, ' '), '')
    ),
    'IİIÇĞÖŞÜáâäàéêëèíîïìóôöòúûüù',
    'IIICGOSUAAAAEEEEIIIIOOOOUUUU'
  )                                                            as ara
from olaylar o
left join son s on s.match_key = o.match_key
group by o.match_key, s.gun, s.supplier, s.eur, s.birim, s.currency;

comment on view public.purchase_price_index is
  'Fiyat arşivinin kalem başına dizini (teklif + sipariş + devralınan). '
  'Ekran bunu SÜZER ve SAYFALAR; ayrıntı satırları ayrıca istenir.';

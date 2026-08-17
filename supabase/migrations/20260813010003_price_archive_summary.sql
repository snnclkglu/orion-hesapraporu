-- FİYAT ARŞİVİ ÖZETİ — toplama SQL'DE yapılır, tarayıcıda değil.
--
-- Kullanıcı bildirimi (13.08.2026): *"Fiyat arşivine tıkladığımda biraz kasma
-- yapıyor."* Sayfalama DOM'u çözmüştü ama asıl maliyet ondan önceydi ve
-- ölçüldü:
--
--   · İSTEMCİYE GİDEN YÜK 1.302 KB — 4722 devralınan satırın TAMAMI, her
--     ziyarette, RSC akışında. Ekranın gösterdiği şey ise satır başına yedi
--     sayı: son alış, günü, firması, en düşük/yüksek ve kayıt sayısı.
--   · ALTI ARDIŞIK SORGU — `tumSatirlar` 900'erli sayfalıyor (4722/900 = 6) ve
--     her turu Frankfurt'a gidip geliyor.
--
-- Görünüm ikisini birden kesiyor: TEK sorgu, 1675 satır, 360 KB (%72 daha az).
-- Satırın AYRINTISI (hangi tarihte hangi firmadan kaça) yalnız kullanıcı o
-- satırı AÇTIĞINDA çekilir — 1675 kalemin 1674'ünün ayrıntısı hiç açılmıyor
-- ve onları baştan göndermek, okunmayan bir kitabı her sayfa açılışında
-- basmaktı.
--
-- `security_invoker = true` — EVİN KURALI. Görünüm çağıranın yetkisiyle
-- çalışır, yani `purchase_price_history` üzerindeki RLS aynen geçerlidir ve
-- fiyat `can_see_purchasing()` dışına sızmaz (RESIM-18).

create or replace view public.purchase_price_archive
with (security_invoker = true) as
with son as (
  -- EN SON HAREKET: `distinct on` bir kalemin en yeni satırını tek geçişte
  -- verir. Kimlikle bozulan beraberlik DETERMİNİSTİKtir — aynı gün iki alım
  -- varsa hangisinin "son" sayıldığı her okumada aynı olmalıdır.
  select distinct on (match_key)
    match_key, priced_at, supplier, unit_price_eur, unit_price, currency
  from public.purchase_price_history
  order by match_key, priced_at desc, id
)
select
  h.match_key,
  min(h.sample)                                       as sample,
  count(*)::int                                       as kayit,
  s.priced_at                                         as son_gun,
  s.supplier                                          as son_firma,
  s.unit_price_eur                                    as son_eur,
  s.unit_price                                        as son_birim,
  s.currency                                          as son_para,
  min(h.unit_price_eur)                               as en_dusuk,
  max(h.unit_price_eur)                               as en_yuksek,
  -- SÜZGEÇ İÇİN: kalemin geçtiği farklı firmalar ve kategoriler. Ortalama
  -- 1,25 firma/kalem (ölçüldü) — dizi olmaları yükü büyütmüyor.
  array_agg(distinct h.supplier) filter (where h.supplier <> '')   as firmalar,
  array_agg(distinct h.category) filter (where h.category <> '')   as kategoriler,
  -- ARAMA İÇİN: iş numaraları tek bir dizgide. Ayrı bir dizi olarak
  -- göndermek yalnız aramada kullanılan bir alanı üç kat pahalı yapardı.
  string_agg(distinct h.item_no, ' ') filter (where h.item_no <> '') as isler
from public.purchase_price_history h
join son s on s.match_key = h.match_key
group by h.match_key, s.priced_at, s.supplier, s.unit_price_eur, s.unit_price, s.currency;

comment on view public.purchase_price_archive is
  'Fiyat arşivinin kalem başına özeti. Ayrıntı satırları yalnız istendiğinde '
  'okunur (purchase_price_history); bu görünüm listenin kendisini besler.';

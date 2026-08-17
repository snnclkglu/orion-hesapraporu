-- TEKLİFE VADE VE TESLİM SÜRESİ (kullanıcı kararı, 15.08.2026).
--
-- *"Sac, profil ve ray siparişlerinde teklifleri girdiğimizde en sona bize
-- böyle bir ekran da lazım. Hepsinin vadesi, teslim süresi, fiyatı vs farklı
-- oluyor. Biz bunları sisteme gireriz teklif aç olarak. Teklifleri
-- inceleyeceğimiz sayfada inceleriz. Sonra birine sipariş veririz, ya da
-- bölüp de sipariş verebiliriz."*
--
-- Kullanıcının gösterdiği karşılaştırma tablosunda tedarikçi başlığı
-- `EAG DEMİR (90 Gün)` biçiminde ve her sütunun yanında `Teslim Süresi`
-- (`20 Gün` · `Hazır`) var. İki alan bugüne kadar teklifte YOKTU ve
-- karşılaştırma onlarsız yapılamaz: en ucuz fiyat, üç ay vadeli ve altı hafta
-- sonra teslim edilecekse en ucuz teklif DEĞİLDİR.
--
-- ÖDEME KOŞULU SİPARİŞTEKİYLE AYNI SÖZLEŞMEDİR (`purchase_orders`): biçim
-- (`pesin`/`kredi_karti`/`vadeli`) ile GÜN ayrı sütunlardır — "90 gün" bir
-- vadedir, "peşin" bir biçimdir ve tek alanda tutulsalardı ödeme günü
-- hesaplanamazdı (SATIN-21).

alter table public.purchase_quotes
  add column if not exists payment_method text not null default 'pesin',
  add column if not exists payment_term_days int not null default 0,
  -- TESLİM SÜRESİ GÜNDÜR ve 0 "HAZIR" demektir; `null` "söylenmedi"dir.
  -- Serbest metin olsaydı ("2 hafta", "15-20 gün") teklifler sıralanamazdı ve
  -- karşılaştırmanın yarısı kaybolurdu.
  add column if not exists lead_time_days int;

alter table public.purchase_quotes
  drop constraint if exists purchase_quotes_payment_method_check;
alter table public.purchase_quotes
  add constraint purchase_quotes_payment_method_check
  check (payment_method in ('pesin', 'kredi_karti', 'vadeli'));

alter table public.purchase_quotes
  drop constraint if exists purchase_quotes_term_check;
alter table public.purchase_quotes
  add constraint purchase_quotes_term_check
  check (payment_term_days between 0 and 365);

alter table public.purchase_quotes
  drop constraint if exists purchase_quotes_lead_check;
alter table public.purchase_quotes
  add constraint purchase_quotes_lead_check
  check (lead_time_days is null or lead_time_days between 0 and 365);

comment on column public.purchase_quotes.lead_time_days is
  'Teslim süresi GÜN. 0 = Hazır (stokta), null = tedarikçi söylemedi.';

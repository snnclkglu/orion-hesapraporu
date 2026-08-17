-- SAC · PROFİL · RAY ALIM GEÇMİŞİ (kullanıcı kararı, 15.08.2026).
--
-- Kullanıcı bir çalışma dosyası verdi: *"Sac-Profil-Ray Satınalma Fiyatları ve
-- İstatistik Eski Veri adlı exceli dosyaya koydum. Ben bunları exceldeki gibi
-- takip ediyordum. Yani bir analiz sayfası lazım … ortalama fiyatların
-- gidişatını da kontrol ediyorum."*
--
-- ═══════════════════════════════════ NEDEN `purchase_orders`A YAZILMADI
--
-- Devralınan fiyat arşivinin (SATIN-21) birebir aynı gerekçesi: `purchase_orders`
-- CANLI BİR İŞ AKIŞIDIR (Siparişler ekranı, teslim takvimi, gecikme rozetleri).
-- 447 tarihsel alım oraya konsaydı modül ilk açılışta 447 "bekleyen sipariş"
-- gösterir ve kullanılamaz olurdu. Bu satırlar bir AKIŞ değil bir ÖLÇÜMdür.
--
-- ═══════════════════════════════════ NEDEN `purchase_price_history` DEĞİL
--
-- O tablo GENEL fiyat arşividir ve kalem başına tek bir fiyat taşır; buradaki
-- soru farklıdır ve fazladan üç büyüklük ister: KİLO (miktar), KATEGORİ (sac ·
-- profil · ray) ve PLAKA ÖLÇÜSÜ. "2025'te kaç ton sac aldık ve kilosu ortalama
-- kaç avroya geldi" sorusu ancak bu üçüyle cevaplanır. Anahtar uzayı yine
-- ORTAKTIR (`match_key`), yani aynı kalemin teklifi ve siparişi bulunabilir.
--
-- ═══════════════════════════════════ PARA: ÜÇ BİRİM, TEK GERÇEK
--
-- Kaynak dosya TL fiyatı ve o günün TCMB kurlarını yan yana yazıyor; dolar ve
-- avro karşılıkları ondan TÜRETİLMİŞ. Uygulama da öyle yapar: `unit_price_try`
-- ile kurlar SAKLANIR, döviz karşılıkları GENERATED sütundur. Dosyadaki
-- değerlerle birebir tutması bir tesadüf değil, aynı bölmedir (import betiği
-- toplamları satır satır doğrular).
--
-- KUR SATIRIN KENDİNDEDİR (SATIS-16 / SATIN-21 sözleşmesi): merkezî bir kur tablosundan
-- okunsaydı bugünkü kur değişince 2024'te ödediğimiz fiyatın avro karşılığı da
-- değişir ve "gidişat" grafiği kendi kendine yeniden yazılırdı.

create table if not exists public.purchase_raw_purchases (
  id uuid primary key default gen_random_uuid(),

  purchased_at date not null,

  -- TEDARİKÇİ ADI METİNDE DURUR, bağ AYRICA tutulur (SATIN-21'in fotoğraf
  -- kuralı): defterdeki bir düzeltme geçmişte ödenmiş bir faturayı
  -- değiştirmemeli. `supplier_id` yalnız süzgeç ve gruplama kolaylığıdır.
  supplier text not null,
  supplier_id uuid references public.purchase_suppliers (id) on delete set null,

  -- KAYNAĞIN KENDİ KATEGORİSİ. Uygulamanın altı hammadde sınıfına
  -- ÇEVRİLMEZ ve bu bilinçli: dosyada `BORU Ø34X3` satırının kategorisi
  -- PROFİL yazıyor ve kullanıcı üç kova ile takip ediyor (sac · profil · ray).
  -- Yeniden sınıflandırmak, geçmiş seriyi kullanıcının kendi defterinden
  -- farklı gösterirdi — "uydurma veri girmeyeceğiz" kuralının kardeşi.
  category text not null,

  description text not null,
  -- Teklif · sipariş · fiyat arşiviyle AYNI anahtar uzayı.
  match_key text not null,
  quality text not null default '',

  -- Sac plakasının ölçüsü; profil ve rayda boştur ve UYDURULMAZ.
  thickness_mm numeric(10, 2),
  width_mm numeric(12, 2),
  length_mm numeric(12, 2),

  qty_kg numeric(14, 3) not null,
  unit_price_try numeric(16, 6) not null,
  total_try numeric(18, 4) not null,

  -- O GÜNÜN kurları — dosyadan birebir.
  usd_rate numeric(14, 6),
  eur_rate numeric(14, 6),

  unit_price_usd numeric(20, 8) generated always as (
    case when usd_rate is null or usd_rate = 0 then null else unit_price_try / usd_rate end
  ) stored,
  total_usd numeric(20, 6) generated always as (
    case when usd_rate is null or usd_rate = 0 then null else total_try / usd_rate end
  ) stored,
  unit_price_eur numeric(20, 8) generated always as (
    case when eur_rate is null or eur_rate = 0 then null else unit_price_try / eur_rate end
  ) stored,
  total_eur numeric(20, 6) generated always as (
    case when eur_rate is null or eur_rate = 0 then null else total_try / eur_rate end
  ) stored,

  note text not null default '',

  -- KAYNAK İZİ: her import satırı tektir ve betik ikinci kez koşturulduğunda
  -- satır ÇOĞALMAZ (sarf aktarımının kuralı). Elle girilen satırda boştur.
  source_ref text,
  -- Ham A–R değerleri — bir sayı tartışılırsa dosyaya dönmeden bakılır.
  legacy_payload jsonb,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_raw_purchases_qty_positive check (qty_kg > 0),
  constraint purchase_raw_purchases_price_positive check (unit_price_try >= 0),
  constraint purchase_raw_purchases_desc_check check (btrim(description) <> '')
);

create unique index if not exists purchase_raw_purchases_source_idx
  on public.purchase_raw_purchases (source_ref) where source_ref is not null;
create index if not exists purchase_raw_purchases_date_idx
  on public.purchase_raw_purchases (purchased_at desc);
create index if not exists purchase_raw_purchases_key_idx
  on public.purchase_raw_purchases (match_key);
create index if not exists purchase_raw_purchases_cat_idx
  on public.purchase_raw_purchases (category);
create index if not exists purchase_raw_purchases_supplier_idx
  on public.purchase_raw_purchases (supplier);

comment on table public.purchase_raw_purchases is
  'SAC · PROFİL · RAY alım geçmişi (kilo bazlı). Devralınan çalışma dosyasının '
  'karşılığı; canlı sipariş akışına yazılmaz, analiz onunla BİRLEŞTİRİLİR.';

drop trigger if exists touch_purchase_raw_purchases on public.purchase_raw_purchases;
create trigger touch_purchase_raw_purchases
  before update on public.purchase_raw_purchases
  for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════ RLS
--
-- `purchase_*` kalıbı. SİLME YALNIZ YÖNETİCİDE (devralınan fiyat arşivinin
-- kuralı): bu satırlar bir ölçümdür ve tek bir yanlış tıkla iki buçuk yıllık
-- seri kaybedilmemeli.

alter table public.purchase_raw_purchases enable row level security;

drop policy if exists purchase_raw_purchases_select on public.purchase_raw_purchases;
drop policy if exists purchase_raw_purchases_insert on public.purchase_raw_purchases;
drop policy if exists purchase_raw_purchases_update on public.purchase_raw_purchases;
drop policy if exists purchase_raw_purchases_delete on public.purchase_raw_purchases;

create policy purchase_raw_purchases_select on public.purchase_raw_purchases
  for select to authenticated using (public.can_see_purchasing());
create policy purchase_raw_purchases_insert on public.purchase_raw_purchases
  for insert to authenticated with check (public.can_edit_purchasing());
create policy purchase_raw_purchases_update on public.purchase_raw_purchases
  for update to authenticated
  using (public.can_edit_purchasing()) with check (public.can_edit_purchasing());
create policy purchase_raw_purchases_delete on public.purchase_raw_purchases
  for delete to authenticated using (public.is_admin());

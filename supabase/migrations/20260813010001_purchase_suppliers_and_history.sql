-- SATIN ALMA FİRMALARI ve DEVRALINAN FİYAT ARŞİVİ
--
-- ════════════════════════════════════════════ 1. TEDARİKÇİ DEFTERİ AÇILDI
--
-- `20260812000002_purchasing.sql` bu tabloyu BİLEREK AÇMAMIŞTI ve gerekçesi
-- dosyada yazılı: *"Ayrı bir defter tablosu AÇILMADI: ad `adBuyuk` ile BÜYÜK
-- HARFE çevrilerek saklanır ve arayüz var olan adları öneri olarak sunar …
-- üçüncü bir yönetim ekranı açmak teklif girmeyi yavaşlatırdı."*
--
-- Kullanıcı 13.08.2026'da bunu TERSİNE ÇEVİRDİ ve gerekçesi öncekinden güçlü:
-- *"Firma isimlerini Fiyat Arşivi Eski Veri adlı excelden Cari Adı'ndan çekip
-- sisteme kaydedebilirsin. Satın alma firmaları olarak bir yer yapıp kaydet.
-- Tedarikçi seçiminde kullanalım. Kullanıcı sipariş açarken veya teklif
-- girerken eğer yeni bir firma ise hemen orda yeni firma olarak
-- kaydedebilsin."*
--
-- ESKİ GEREKÇE ÇÜRÜMEDİ, KARŞILANDI: korkulan şey "teklif girmeyi yavaşlatan
-- bir yönetim ekranı"ydı. Defter o ekranı ŞART KOŞMUYOR — yeni firma teklif
-- penceresinin İÇİNDEN açılır (`ensureSupplier`), yani akış hızlanır: bugüne
-- kadar öneri listesi yalnız DAHA ÖNCE TEKLİF GİRİLMİŞ firmaları biliyordu ve
-- ilk kez çalışılan her firma elle, her seferinde yeniden yazılıyordu.
--
-- AD HÂLÂ `supplier` METNİNDE DURUR. `purchase_quotes.supplier` ve
-- `purchase_orders.supplier` yabancı anahtara ÇEVRİLMEZ: iş emrindeki müşteri
-- fotoğrafı kuralının (IS-14) aynısı — defter sonradan düzeltilince
-- yayınlanmış bir siparişin firması değişmemelidir. Defter bir ÖNERİ ve
-- TEKİLLEŞTİRME kaynağıdır, bir bağ değil.
--
-- ════════════════════════════════════════ 2. DEVRALINAN FİYAT ARŞİVİ AYRI
--
-- 5083 satırlık geçmiş alım verisi `purchase_orders`a YAZILMAZ. O tablo canlı
-- bir iş akışıdır: Siparişler ekranı, ödeme takvimi, teslim takvimi ve gecikme
-- rozetleri hep ondan türer. Devralınan faturaları oraya koymak 5083 "teslim
-- bekliyor" satırı üretir, ödeme takvimini geçmişe boğar ve modülü ilk açılışta
-- kullanılamaz yapardı.
--
-- Üçüncü bir kaynak olarak durur ve YALNIZ Fiyat Arşivi onu okur — Teknik
-- Resimler'deki "plan → paket → kapanmış eski Drive defteri" üç katmanının
-- aynı deseni.

-- ————————————————————————————————————————————————— tedarikçi defteri
create table if not exists public.purchase_suppliers (
  id uuid primary key default gen_random_uuid(),

  -- Görünen ad; BÜYÜK HARFLE saklanır (`adBuyuk`, IS-14).
  name text not null check (btrim(name) <> ''),

  -- TEKİLLİK ANAHTARI — katlanmış ad (`trKatla`). Ham adla tekilleştirmek
  -- "ÇELİK RULMAN" ile "CELIK RULMAN"ı iki firma sayardı; Türkçe klavye
  -- kullanmadan yazan biri her seferinde yeni bir kayıt açardı.
  match_key text not null,

  -- PASİF FİRMA SİLİNMEZ, İŞARETLENİR. Devralınan listede tedarikçi olmayan
  -- kayıtlar var (banka, otel, kargo, nakliye); onları silmek geçmiş fiyat
  -- satırlarının kaynağını kopartırdı. Öneri listesinden düşerler, defterde
  -- kalırlar.
  active boolean not null default true,

  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create unique index if not exists purchase_suppliers_key_idx
  on public.purchase_suppliers (match_key);
create index if not exists purchase_suppliers_active_idx
  on public.purchase_suppliers (active, name);

-- ————————————————————————————————————— devralınan fiyat arşivi
create table if not exists public.purchase_price_history (
  id uuid primary key default gen_random_uuid(),

  -- Fiyat arşivinin dilbilgisi: normalleştirilmiş tanımın katlanmış hâli.
  -- Teklif ve sipariş defterleriyle AYNI anahtar (SATIN-21) — ayrı bir şema
  -- kullanılsaydı geçmiş fiyat, bugünkü kalemle hiç buluşamazdı.
  match_key text not null,
  sample text not null default '',

  supplier text not null default '',
  -- Belge numarası ve iş numarası BAĞLAM taşır, BAĞ değildir: kaynak dosyadaki
  -- kayıt bulunabilsin diye durur.
  item_no text not null default '',
  doc_no text not null default '',
  -- Kaynaktaki "Alt Kategori"; uygulamanın kendi sınıf sözlüğüne ZORLANMAZ.
  -- Devralınan veri kendi dilini konuşur ve onu bizim on beş ürün ailemize
  -- eşlemek uydurma olurdu — ekran ikisini de gösterebilir.
  category text not null default '',

  qty numeric(16, 4),
  unit text not null default 'Adet',

  unit_price numeric(16, 4) not null,
  currency text not null default 'TRY',
  fx_rate numeric(14, 6),
  -- Karşılaştırılabilir tek büyüklük — `purchase_quotes` ile aynı bağıntı.
  unit_price_eur numeric(20, 6) generated always as (
    case when fx_rate is not null and fx_rate > 0 then unit_price / fx_rate end
  ) stored,

  priced_at date not null,

  -- Nereden geldiği. Bugün tek değer var ama sütun BAŞTAN durur: ikinci bir
  -- devralma geldiğinde ayırt edilebilmeli.
  source text not null default 'excel-2026-08',

  created_at timestamptz not null default now()
);

create index if not exists purchase_price_history_key_idx
  on public.purchase_price_history (match_key, priced_at desc);
create index if not exists purchase_price_history_supplier_idx
  on public.purchase_price_history (supplier);

-- ————————————————————————————————————————————————————————————— RLS
--
-- OKUMA `can_see_purchasing()`E BAĞLI, yazma da. Fiyat mühendise ve ressama
-- kapalıdır (RESIM-18: "fiyat gizlenmez, HİÇ GETİRİLMEZ") ve bu iki tablo da
-- fiyat taşır; `authenticated` okuması onları paket ekranına sızdırırdı.
alter table public.purchase_suppliers enable row level security;
alter table public.purchase_price_history enable row level security;

drop policy if exists purchase_suppliers_select on public.purchase_suppliers;
create policy purchase_suppliers_select on public.purchase_suppliers
  for select to authenticated using (public.can_see_purchasing());

drop policy if exists purchase_suppliers_write on public.purchase_suppliers;
create policy purchase_suppliers_write on public.purchase_suppliers
  for all to authenticated
  using (public.can_edit_purchasing())
  with check (public.can_edit_purchasing());

drop policy if exists purchase_price_history_select on public.purchase_price_history;
create policy purchase_price_history_select on public.purchase_price_history
  for select to authenticated using (public.can_see_purchasing());

drop policy if exists purchase_price_history_write on public.purchase_price_history;
create policy purchase_price_history_write on public.purchase_price_history
  for all to authenticated
  using (public.can_edit_purchasing())
  with check (public.can_edit_purchasing());

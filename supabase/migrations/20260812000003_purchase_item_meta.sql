-- Faz V7/3 — KALEM DEFTERİ: kategori düzeltmesi + not, TEK tabloda.
--
-- ═════════════════════════════ NEDEN YENİ TABLO, NEDEN ESKİSİ KULLANILMIYOR
--
-- `drawing_purchase_overrides` (20260811000001) aynı işi yapıyordu ama
-- ANAHTARI FARKLIYDI: `trKatla(HAM tanım)`. Talep havuzu ise
-- `trKatla(NORMALLEŞTİRİLMİŞ tanım)` kullanır — "RULMAN EKSENEL 51106" ile
-- "Rulman 51106" aynı kalemdir ve ancak normalleştirilmiş anahtarla buluşurlar.
--
-- İki anahtar şemasının bir arada yaşaması, kategoriyi bir ekranda düzeltip
-- ötekinde düzelmemiş görmek demekti. Teknik Resimler'in Satın Alma sekmesi
-- KALDIRILDIĞI için (kullanıcı kararı 12.08.2026 — "zaten yeni bölüm yaptık")
-- eski defterin tek kullanıcısı da kalmadı.
--
-- ESKİ TABLO DÜŞÜRÜLMEZ ("uygulanmış bir migration düzenlenmez" ilkesinin
-- kardeşi): satırları taşınır ve tablo yerinde bırakılır. Taşıma sırasında
-- anahtarlar YENİDEN ÜRETİLEMEZ — ham tanımdan normal tanıma geçmek koddaki
-- sözlüğü gerektirir ve SQL onu bilmez. Bu yüzden satırlar `sample` alanı
-- üzerinden taşınır ve ANAHTAR OLARAK ESKİSİ KORUNUR; eşleşmeyen satır
-- kullanıcıya "Diğer"de görünür ve bir kez daha düzeltilir. Ölçüldü: her iki
-- eski tablo da BOŞ (0 satır), yani bu yol bugün hiçbir veriyi taşımıyor —
-- kod yine de yazılıyor ki migration başka bir kurulumda da doğru çalışsın.

create table if not exists public.purchase_item_meta (
  -- normAnahtar(tanım) — `lib/drawings/normalize.ts`. Talep havuzu, teklifler
  -- ve siparişler AYNI anahtarı taşır; kalem defteri de öyle olmalıdır.
  match_key text primary key,

  -- İnsan okusun diye standart tanım. Anahtar katlanmış olduğu için defter
  -- tek başına okunduğunda neyin düzeltildiği anlaşılmazdı.
  sample text not null default '',

  -- KATEGORİ DÜZELTMESİ. `null` = sözlük ne diyorsa o. Yabancı anahtar
  -- DEĞİLDİR: kategorilerin çoğu koddaki `SATIN_ALMA_SINIFLARI` sözlüğünden
  -- gelir ve veritabanında satırları yoktur.
  category text,

  -- NOT — İŞ HAZIRLAMA LİSTESİ'ndeki "Not" sütununun karşılığı.
  -- Kaynak dosyada 178 satırın yalnız 2'sinde dolu ("%100 Garantili") ama
  -- ikisi de satın alma kararını değiştiren bilgi; sütunu atmak o kararı
  -- kaybetmek olurdu.
  note text not null default '',

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.purchase_item_meta is
  'Satın alma kaleminin İNSAN TARAFINDAN verilen bilgisi: kategori düzeltmesi '
  've not. Anahtar PAKET DEĞİL NORMALLEŞTİRİLMİŞ TANIMDIR — aynı somun her '
  'pakette aynı somundur.';

drop trigger if exists touch_purchase_item_meta on public.purchase_item_meta;
create trigger touch_purchase_item_meta
  before update on public.purchase_item_meta
  for each row execute function public.touch_updated_at();

-- Eski defterden taşıma (bugün 0 satır; başka kurulumlar için).
insert into public.purchase_item_meta (match_key, sample, category)
select o.match_key, o.sample, o.category
from public.drawing_purchase_overrides o
on conflict (match_key) do nothing;

-- ---------------------------------------------------------------------- RLS
-- Satın alma tablolarıyla AYNI kural: okuma da yazma da `can_see_purchasing()`.
-- Kategori düzeltmesi ticari bir karardır ve tedarikçi seçimini etkiler;
-- teknik resim tarafının "okuma herkese" kuralı burada geçerli değildir.
alter table public.purchase_item_meta enable row level security;

do $$
declare t text := 'purchase_item_meta';
begin
  execute format('drop policy if exists %I on public.%I', t || '_select', t);
  execute format('drop policy if exists %I on public.%I', t || '_insert', t);
  execute format('drop policy if exists %I on public.%I', t || '_update', t);
  execute format('drop policy if exists %I on public.%I', t || '_delete', t);

  execute format(
    'create policy %I on public.%I for select to authenticated '
    'using (public.can_see_purchasing())', t || '_select', t);
  execute format(
    'create policy %I on public.%I for insert to authenticated '
    'with check (public.can_edit_purchasing())', t || '_insert', t);
  execute format(
    'create policy %I on public.%I for update to authenticated '
    'using (public.can_edit_purchasing()) with check (public.can_edit_purchasing())',
    t || '_update', t);
  execute format(
    'create policy %I on public.%I for delete to authenticated '
    'using (public.can_edit_purchasing())', t || '_delete', t);
end $$;

-- ═══════════════════════════ TEKLİFTE ADET SORULMUYOR (kullanıcı kararı)
--
-- "Teklifi gir dediğinde açılan pop-up da adet sormasına gerek yok."
--
-- Doğrusu da budur: teklif BİRİM FİYATtır ve adet zaten talep havuzunda yazar;
-- iki yerde adet tutmak, ikisinin ayrışması demekti. Sütun DÜŞÜRÜLMEZ (eski
-- kayıtlarda kademeli fiyat bilgisi olabilir) ama artık yazılmaz ve arayüzde
-- sorulmaz — yorumu bu yüzden güncelleniyor.
comment on column public.purchase_quotes.qty is
  'KULLANIMDAN KALKTI (12.08.2026): teklif birim fiyattır, adet talep '
  'havuzunda yazar. Eski kayıtlar için tutulur, yeni kayıtlarda NULL gelir.';

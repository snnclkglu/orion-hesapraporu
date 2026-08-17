-- HAMMADDE TALEP HAVUZU — imalat satırlarından çıkarılan malzeme ihtiyacı.
--
-- Kullanıcı kararı (15.08.2026): satın alma talep havuzu İKİYE bölündü.
-- EKİPMAN tarafı bugüne kadarki havuzdur (satın alınan ürün + hizmet);
-- HAMMADDE tarafı İMALAT satırlarının tanımından türetilen SAC · PROFİL ·
-- RAY · DOLU · BORU (+ DİĞER) ihtiyacıdır.
--
-- ══════════════════════════════════════════════ NEDEN AZ TABLO VAR
--
-- Havuzun KENDİSİ bir tablo değildir ve olmayacaktır: `/purchasing` beş
-- ekranını da `drawing_packages` + `drawing_parts` üzerinden TÜRETİR (md. 21)
-- ve hammadde de aynı yolu izler. `drawing_parts` her eşleştirmede silinip
-- yeniden kurulduğu için oraya yazılan bir hammadde kararı da kaybolurdu.
--
-- Buradaki iki tablo yalnız İNSANIN KARARINI saklar:
--   · `purchase_raw_meta`   — türetilmiş bir satırın üstüne yazılan düzeltme
--   · `purchase_raw_manual` — hiçbir resimden gelmeyen, elle açılan talep
--
-- ANAHTAR PAKET DEĞİL TANIMDIR (SATIN-21). Hammaddede tanım STOK KALEMİNİN
-- adıdır ("SAC 15 MM S355JR") ve `purchase_quotes` · `purchase_order_lines` ·
-- `purchase_price_history` ile AYNI `match_key` uzayındadır. Bu sayede teklif,
-- sipariş ve fiyat arşivi hammadde satırlarını EK KOD OLMADAN görür.
--
-- YERLEŞİM PLANI SAKLANMAZ ve bu bilinçlidir: `sacYerlesimi` saf ve
-- DETERMİNİSTİKtir — aynı seçim + aynı plaka + aynı pay her zaman aynı planı
-- verir. Plan bir VERİ değil bir SONUÇtur; tabloya konsaydı parçalar
-- değiştiğinde sessizce eskir ve atölye eski plana bakarak keserdi. Seçim
-- adres parametresinde taşınır, plan her açılışta yeniden hesaplanır.

-- ══════════════════════════════════════════ 1. DÜZELTME DEFTERİ

create table if not exists public.purchase_raw_meta (
  -- ÇÖZÜCÜNÜN ÜRETTİĞİ stok anahtarı — taşındıktan SONRAKİ değil. Taşınmış
  -- anahtarla saklansaydı bir sonraki okumada satır zaten yeni anahtarda
  -- olurdu, düzeltme bulunamaz ve satır eski sınıfına geri düşerdi.
  match_key text primary key,
  sample text not null default '',

  -- "KLASÖRE TAŞI" — kullanıcının sınıf kararı. null = sözlük ne diyorsa o.
  -- Liste `src/lib/purchasing/hammadde/siniflar.ts`teki `HAMMADDE_SINIFLARI`
  -- ile BİREBİR aynıdır; ayrışmayı bir test engeller.
  kind text,

  -- Görünen stok adını ezer; boş/null = ezme YOK (purchase_item_meta deseni).
  label_override text,

  -- Bu sınıfın satın alma boyunu ezer (12000 → 6000 gibi). null = varsayılan.
  stock_length_mm numeric(12, 2),

  -- Havuzdan çıkarılmış mı? Satır SİLİNMEZ — bir sonraki yüklemede yeniden
  -- türetilirdi. İşaret kalıcıdır ve geri alınabilir.
  excluded boolean not null default false,

  note text not null default '',

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_raw_meta_kind_check
    check (kind is null or kind in ('SAC', 'PROFIL', 'RAY', 'DOLU', 'BORU', 'DIGER')),
  constraint purchase_raw_meta_length_positive
    check (stock_length_mm is null or stock_length_mm > 0)
);

create index if not exists purchase_raw_meta_kind_idx
  on public.purchase_raw_meta (kind) where kind is not null;
create index if not exists purchase_raw_meta_excluded_idx
  on public.purchase_raw_meta (excluded) where excluded;

comment on table public.purchase_raw_meta is
  'Hammadde havuzundaki TÜRETİLMİŞ satırın üstüne yazılan insan kararı: '
  'sınıf taşıma, ad düzeltme, stok boyu, hariç tutma, not. '
  'Anahtar ÇÖZÜCÜNÜN ürettiği stok anahtarıdır, taşındıktan sonraki değil.';

-- ══════════════════════════════════════════ 2. ELLE AÇILAN HAMMADDE TALEBİ

create table if not exists public.purchase_raw_manual (
  id uuid primary key default gen_random_uuid(),

  -- Teklif/sipariş/fiyat arşiviyle aynı anahtar uzayı.
  match_key text not null,
  sample text not null,
  kind text not null default 'DIGER',

  -- BAĞLAM, bağ değil: iş kalemi metni (md. 17/18 kuralı).
  item_no text not null default '',

  -- Kesit kimliği ("UPN 100", "A65", "Ø90") ve kalite.
  section_code text not null default '',
  quality text not null default '',

  -- Ölçüler — sınıfa göre bir kısmı dolar; EMİN OLUNMAYAN BOŞ KALIR.
  thickness_mm numeric(10, 2),
  width_mm numeric(12, 2),
  length_mm numeric(12, 2),
  outer_dia_mm numeric(10, 2),
  inner_dia_mm numeric(10, 2),

  qty numeric(14, 3),
  unit text not null default 'Adet',
  weight_kg numeric(14, 3),

  note text not null default '',
  active boolean not null default true,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_raw_manual_sample_check check (btrim(sample) <> ''),
  constraint purchase_raw_manual_kind_check
    check (kind in ('SAC', 'PROFIL', 'RAY', 'DOLU', 'BORU', 'DIGER')),
  constraint purchase_raw_manual_qty_positive check (qty is null or qty > 0)
);

create index if not exists purchase_raw_manual_key_idx
  on public.purchase_raw_manual (match_key);
create index if not exists purchase_raw_manual_kind_idx
  on public.purchase_raw_manual (kind);
create index if not exists purchase_raw_manual_active_idx
  on public.purchase_raw_manual (active) where active;

comment on table public.purchase_raw_manual is
  'Hiçbir teknik resimden gelmeyen, elle açılan hammadde talebi. '
  'Türetilmiş havuza EK SATIR olarak katılır; drawing_parts''a dokunmaz.';

-- ══════════════════════════════════════════ 3. updated_at

do $$
declare t text;
begin
  foreach t in array array['purchase_raw_meta', 'purchase_raw_manual'] loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format(
      'create trigger touch_%I before update on public.%I '
      'for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ══════════════════════════════════════════ 4. RLS
--
-- `purchase_*` KALIBI, "authenticated okuma" DEĞİL: hammadde talebi ticari bir
-- karardır (tedarikçi seçimini ve tonaj pazarlığını etkiler).

alter table public.purchase_raw_meta enable row level security;
alter table public.purchase_raw_manual enable row level security;

do $$
declare t text;
begin
  foreach t in array array['purchase_raw_meta', 'purchase_raw_manual'] loop
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
  end loop;
end $$;

-- HAMMADDE — İKİNCİ TUR DÜZELTMELER (kullanıcı listesi, 15.08.2026).
--
-- Üç yeni alan, üçü de İNSANIN KARARINI saklar:
--
--   1. `to_equipment` — *"Diğer kısmında kaplin rulman gibi ekipmanları benim
--      Ekipman tarafına taşıyabilmem lazım."*
--   2. `quality_override` / `qty_override` — *"Satın almacı satırların adını,
--      kalitesini adedini türünü değiştirebilsin."* (ad ve tür zaten vardı)
--
-- ANAHTAR DEĞİŞMİYOR: hepsi `purchase_raw_meta`ya eklenir ve o tablonun
-- anahtarı ÇÖZÜCÜNÜN ürettiği stok anahtarıdır.

alter table public.purchase_raw_meta
  add column if not exists to_equipment boolean not null default false,
  add column if not exists quality_override text,
  add column if not exists qty_override numeric(14, 3);

alter table public.purchase_raw_meta
  drop constraint if exists purchase_raw_meta_qty_positive;
alter table public.purchase_raw_meta
  add constraint purchase_raw_meta_qty_positive
  check (qty_override is null or qty_override > 0);

create index if not exists purchase_raw_meta_equipment_idx
  on public.purchase_raw_meta (to_equipment) where to_equipment;

comment on column public.purchase_raw_meta.to_equipment is
  'Bu stok kalemi HAMMADDE değil EKİPMANdır: hammadde havuzundan düşer, '
  'ekipman havuzu onun kaynak satırlarını okur. Kaplin, rulman, kanca gibi '
  'imalat satırı görünümündeki satın alma kalemleri için.';

-- ══════════════════════════════════════════ KAYNAK SATIR DEFTERİ
--
-- `to_equipment` bir STOK KALEMİ kararıdır ama ekipman havuzu PARÇA
-- TANIMLARIYLA çalışır (`normAnahtar`). İki uzay arasındaki köprü burada
-- durur: taşınan stok kaleminin hangi ham tanımlardan geldiği yazılır ki
-- ekipman tarafı onları AYNI SORGUDA bulabilsin.
--
-- Defter TÜRETİLMİŞ DEĞİL YAZILMIŞTIR: taşıma anında biliniyor ve paket
-- yeniden yüklendiğinde aynı tanım yine gelir, yani bağ kendiliğinden
-- tazelenir.
create table if not exists public.purchase_raw_equipment_keys (
  /** `hamAnahtar(ham tanım)` — parçanın Excel'de yazdığı hâli. */
  part_key text primary key,
  /** Hangi stok kaleminden taşındı (geri almak için). */
  match_key text not null,
  sample text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists purchase_raw_equipment_keys_match_idx
  on public.purchase_raw_equipment_keys (match_key);

comment on table public.purchase_raw_equipment_keys is
  'Hammaddeden Ekipman havuzuna taşınmış PARÇA TANIMLARI. Ekipman okuması bu '
  'kümeyi görür ve o imalat satırlarını kendi havuzuna alır; küme boşken '
  'hiçbir ek sorgu koşmaz.';

alter table public.purchase_raw_equipment_keys enable row level security;

do $$
declare t text := 'purchase_raw_equipment_keys';
begin
  execute format('drop policy if exists %I on public.%I', t || '_select', t);
  execute format('drop policy if exists %I on public.%I', t || '_write', t);
  execute format(
    'create policy %I on public.%I for select to authenticated '
    'using (public.can_see_purchasing())', t || '_select', t);
  execute format(
    'create policy %I on public.%I for all to authenticated '
    'using (public.can_edit_purchasing()) with check (public.can_edit_purchasing())',
    t || '_write', t);
end $$;

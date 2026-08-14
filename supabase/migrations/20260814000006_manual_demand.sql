-- TALEP HAVUZU DÜZELTME + MANUEL TALEP — kullanıcı kararı (14.08.2026):
--   (1) "Talep havuzunda otomatik gelen ekipman satırlarında düzenleme
--       yapabileyim. Otomatik çekerken hatalı, eksik yazı veya adet olabilir."
--   (21) "Talep havuzuna kullanıcı yeni talep ekleyebilsin. PDF tuşunun yanına
--       buton, pop-up'tan tüm özellikleri girsin."
--
-- (1) OTOMATİK SATIR DÜZELTMESİ SNAPSHOT DEĞİL GÖRÜNÜM KATMANIDIR: `match_key`
--     (normalleştirilmiş tanım) DEĞİŞMEZ — teklif/sipariş/fiyat arşivi ona bağlı.
--     Yalnız EKRANDA görünen tanım ve adet override edilir; anahtar sabit kalır.
alter table public.purchase_item_meta
  add column if not exists label_override text,
  add column if not exists qty_override numeric(14, 3);

comment on column public.purchase_item_meta.label_override is
  'Havuzda GÖRÜNEN tanımı ezer (otomatik çıkarım hatalıysa). match_key ve fiyat '
  'arşivi DEĞİŞMEZ; yalnız ekran/PDF gösterimi.';
comment on column public.purchase_item_meta.qty_override is
  'Havuzda GÖRÜNEN adedi ezer (çarpan/adet yanlış çekildiyse). null = dokunma.';

-- (21) MANUEL TALEP: teknik resimden gelmeyen, satınalmacının elle eklediği
--      kalem. Türetilmiş havuza EK bir satır olarak katılır; `drawing_parts`a
--      dokunmaz. Anahtar yine normalleştirilmiş tanımdır (teklif/sipariş onunla
--      bağlanır), ama kaynağı manuel olduğu için ayrı tabloda durur.
create table if not exists public.purchase_manual_demands (
  id uuid primary key default gen_random_uuid(),
  match_key text not null,
  sample text not null,
  category text not null default 'Diğer',
  item_no text not null default '',
  quantity numeric(14, 3),
  unit text not null default 'Adet',
  weight_kg numeric(14, 3),
  quality text not null default '',
  note text not null default '',
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_manual_demands_sample_check check (btrim(sample) <> '')
);

create index if not exists purchase_manual_demands_active_idx
  on public.purchase_manual_demands (active) where active;

drop trigger if exists touch_purchase_manual_demands on public.purchase_manual_demands;
create trigger touch_purchase_manual_demands before update on public.purchase_manual_demands
  for each row execute function public.touch_updated_at();

comment on table public.purchase_manual_demands is
  'Talep havuzuna elle eklenen kalem (teknik resimden gelmez). Türetilmiş '
  'havuza ek satır olarak katılır.';

-- ------------------------------------------------------------------- RLS
alter table public.purchase_manual_demands enable row level security;

drop policy if exists purchase_manual_demands_select on public.purchase_manual_demands;
create policy purchase_manual_demands_select on public.purchase_manual_demands
  for select to authenticated using (public.can_see_purchasing());

drop policy if exists purchase_manual_demands_write on public.purchase_manual_demands;
create policy purchase_manual_demands_write on public.purchase_manual_demands
  for all to authenticated
  using (public.can_edit_purchasing())
  with check (public.can_edit_purchasing());

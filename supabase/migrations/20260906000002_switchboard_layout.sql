-- PANO YERLEŞİMİ — ürün ölçü defteri ve kullanıcının pano kararları.
--
-- ═══════════════════════════════════════════════════ PLAN SAKLANMAZ
--
-- Bu göç DÖRT tablo açar ama hiçbiri hesaplanmış yerleşimi tutmaz:
--   electrical_device_models  — ürünün fiziksel ölçüsü (projeden bağımsız OLGU)
--   switchboard_panels        — kullanıcının pano gövde seçimleri
--   switchboard_placements    — kullanıcının aygıt düzeltmeleri (yalnız SAPMALAR)
--   switchboard_approvals     — onay ve onaylandığı andaki girdinin parmak izi
--
-- Yerleşimin kendisi `lib/switchboard` içinde SAF ve DETERMİNİSTİK olarak her
-- açılışta yeniden hesaplanır (`purchasing/hammadde/yerlesim` ile aynı
-- doktrin). Bir tabloya konsaydı elektrik projesi yeniden okunduğunda
-- (ELEKTRIK-6: `electrical_parts` SİLİNİP yeniden üretilir) sessizce eskirdi
-- ve pano imalatçısı eski plana bakarak kesim yapardı.
--
-- ═══════════════════════════════════════════════ BELGEYE DEĞİL PROJEYE BAĞLI
--
-- Pano kararları `projects(id)`ye bağlanır, `electrical_projects(id)`ye değil:
-- rev3 → rev4 yeni bir belge satırıdır ve kararlar belgeye bağlansaydı çizim
-- bürosunun her yeni sürümünde kullanıcının bütün pano boyutlandırması
-- kaybolurdu.

-- ═══════════════════════════════════════════════════ 1 · ÜRÜN ÖLÇÜ DEFTERİ

create table if not exists public.electrical_device_models (
  id uuid primary key default gen_random_uuid(),
  -- `electricalCatalogLookupKey(supplier, typeNo)` — `electrical_catalog_products`
  -- ile AYNI normalizasyon. İkinci bir normalleştirici yazmak aynı fiziksel
  -- ürünü iki kayda bölerdi (ELEKTRIK-12).
  lookup_key text not null unique,
  supplier text not null default '',
  type_no text not null default '',
  -- ÖLÇÜ NULL OLABİLİR VE BU SIFIR DEĞİLDİR (değişmez md. 4): bilinmeyen bir en
  -- `0` yazılsaydı cihaz panoya sığar görünür, pano sahada yetmezdi.
  width_mm numeric check (width_mm is null or width_mm > 0),
  height_mm numeric check (height_mm is null or height_mm > 0),
  depth_mm numeric check (depth_mm is null or depth_mm > 0),
  -- 17,5 mm modül sayısı; modüler olmayan üründe null.
  module_units numeric check (module_units is null or module_units > 0),
  mount_type text check (mount_type is null or mount_type in ('din', 'plaka', 'kapak', 'govde', 'saha')),
  zone text check (zone is null or zone in ('giris', 'guc', 'motor', 'kumanda', 'klemens')),
  -- Üreticinin istediği serbest yükseklik; ray satırı yüksekliğine eklenir.
  clearance_top_mm numeric check (clearance_top_mm is null or clearance_top_mm >= 0),
  clearance_bottom_mm numeric check (clearance_bottom_mm is null or clearance_bottom_mm >= 0),
  heat_w numeric check (heat_w is null or heat_w >= 0),
  -- TAHMİN BU TABLOYA YAZILMAZ. Burası olgu tablosudur; tahmin çalışma anında
  -- `footprint.ts` tarafından üretilir ve ekranda taralı görünür (PANO-12).
  -- Kullanıcı bir tahmini onaylarsa `elle` olarak girer — bu AYRI bir iddiadır.
  source text not null default 'katalog' check (source in ('katalog', 'elle')),
  source_document_id uuid references public.electrical_catalog_documents(id) on delete set null,
  source_page integer check (source_page is null or source_page > 0),
  note text not null default '',
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.electrical_device_models is
  'Elektrik cihazının fiziksel ölçüsü. Projeden bağımsız; anahtar electrical_catalog_products ile aynı lookup_key.';
comment on column public.electrical_device_models.width_mm is
  'En [mm]. NULL ise ölçü BİLİNMİYOR demektir, sıfır değil.';
comment on column public.electrical_device_models.source is
  'katalog = üretici belgesinden okundu, elle = mühendis girdi. Tahmin BURAYA yazılmaz.';

create index if not exists electrical_device_models_supplier_idx
  on public.electrical_device_models (supplier);

alter table public.electrical_device_models enable row level security;

drop policy if exists "swb_models_select" on public.electrical_device_models;
create policy "swb_models_select" on public.electrical_device_models
  for select to authenticated using (true);
drop policy if exists "swb_models_write" on public.electrical_device_models;
create policy "swb_models_write" on public.electrical_device_models
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

-- ═══════════════════════════════════════════════════ 2 · PANO KARARLARI

create table if not exists public.switchboard_panels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Aygıt etiketinin konum parçası: `=185T+LVD01-F31` → `LVD01`.
  code text not null,
  name text not null default '',
  -- haric = bu konum bir pano değil (motorun yeri de bir koddur).
  kind text check (kind is null or kind in ('oda', 'saha', 'haric')),
  -- NULL = "sistem karar versin". Bir ölçü yazıldığında ilgili *_locked alanı
  -- da işaretlenir ve yeniden yerleştirme onu EZMEZ.
  width_mm numeric check (width_mm is null or width_mm > 0),
  height_mm numeric check (height_mm is null or height_mm > 0),
  depth_mm numeric check (depth_mm is null or depth_mm > 0),
  base_mm numeric check (base_mm is null or base_mm > 0),
  door_config text check (door_config is null or door_config in ('tek', 'cift')),
  order_index integer,
  width_locked boolean not null default false,
  height_locked boolean not null default false,
  depth_locked boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

comment on table public.switchboard_panels is
  'Kullanıcının pano gövde seçimleri. Hesaplanan yerleşim SAKLANMAZ; bu tablo yalnız kararları taşır.';

create index if not exists switchboard_panels_project_idx
  on public.switchboard_panels (project_id, order_index);

alter table public.switchboard_panels enable row level security;

drop policy if exists "swb_panels_select" on public.switchboard_panels;
create policy "swb_panels_select" on public.switchboard_panels
  for select to authenticated using (true);
drop policy if exists "swb_panels_write" on public.switchboard_panels;
create policy "swb_panels_write" on public.switchboard_panels
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

-- ═══════════════════════════════════════════════ 3 · AYGIT DÜZELTMELERİ

create table if not exists public.switchboard_placements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- `tesis|konum|aygıt` — IEC 81346 kimliği. `electrical_parts.id` KULLANILMAZ:
  -- o satırlar her yeniden okumada yeniden üretilir (ELEKTRIK-6) ve düzeltme
  -- koparadı. Ürün anahtarı da kullanılamaz: aynı tipteki on iki kontaktör
  -- (-K1…-K12) tek ürün anahtarı taşır, ama on iki ayrı kutudur.
  device_key text not null,
  panel_code text,
  mount_type text check (mount_type is null or mount_type in ('din', 'plaka', 'kapak', 'govde', 'saha')),
  zone text check (zone is null or zone in ('giris', 'guc', 'motor', 'kumanda', 'klemens')),
  rail_index integer check (rail_index is null or rail_index >= 0),
  order_in_rail integer check (order_in_rail is null or order_in_rail >= 0),
  width_mm numeric check (width_mm is null or width_mm > 0),
  height_mm numeric check (height_mm is null or height_mm > 0),
  depth_mm numeric check (depth_mm is null or depth_mm > 0),
  -- İşaretliyse "Yeniden Yerleştir" bu satırı KORUR.
  pinned boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, device_key)
);

comment on table public.switchboard_placements is
  'Aygıt başına kullanıcı düzeltmesi — yalnız SAPMALAR. Yerleşimin tamamı hesaplanır, saklanmaz.';
comment on column public.switchboard_placements.device_key is
  'installation|location|device (normalize). Yeniden okumada kararlıdır; electrical_parts.id değildir.';

create index if not exists switchboard_placements_project_idx
  on public.switchboard_placements (project_id);
create index if not exists switchboard_placements_panel_idx
  on public.switchboard_placements (project_id, panel_code)
  where panel_code is not null;

alter table public.switchboard_placements enable row level security;

drop policy if exists "swb_placements_select" on public.switchboard_placements;
create policy "swb_placements_select" on public.switchboard_placements
  for select to authenticated using (true);
drop policy if exists "swb_placements_write" on public.switchboard_placements;
create policy "swb_placements_write" on public.switchboard_placements
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

-- ═══════════════════════════════════════════════════════════ 4 · ONAY

create table if not exists public.switchboard_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  -- Onaylandığı andaki GİRDİNİN parmak izi. Plan saklanmadığı için "neyi
  -- onayladım" sorusunun cevabı budur; bugünkü izle tutmuyorsa ekranda
  -- "onay eskidi" şeridi çıkar ve kimse eski bir plana göre sipariş vermez.
  input_fingerprint text not null,
  -- Ortak yükseklik/derinlik/baza ve pay ayarları (LayoutSettings).
  settings jsonb not null default '{}'::jsonb,
  note text not null default '',
  approved_by uuid references auth.users(id),
  approved_at timestamptz not null default now()
);

comment on table public.switchboard_approvals is
  'Pano yerleşiminin onayı. Donmuş belge indirilen SVG/PDF dosyasıdır; burada yalnız onay ve girdi parmak izi durur.';

alter table public.switchboard_approvals enable row level security;

drop policy if exists "swb_approvals_select" on public.switchboard_approvals;
create policy "swb_approvals_select" on public.switchboard_approvals
  for select to authenticated using (true);
drop policy if exists "swb_approvals_write" on public.switchboard_approvals;
create policy "swb_approvals_write" on public.switchboard_approvals
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

-- Faz 5: panelden düzenlenebilirlik
-- app_settings: rapor/uygulama ayarları (key-value, jsonb)
-- cat_equipment: genel ekipman katalogu (motor/redüktör/halat/fren/rulman/teker/tampon...)
-- revisions.is_template: şablon revizyon işareti (yeni projelerin ilk revizyonu buradan kopyalanır)

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.app_settings enable row level security;
create policy "settings_select" on public.app_settings
  for select to authenticated using (true);
create policy "settings_admin_write" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Genel ekipman katalogu: tablo-üzerinden seçim ve satın alma listeleri için.
-- attrs: tipe göre serbest alanlar (ör. motor: {power_kw, rpm, shaft_mm, frame};
-- redüktör: {ratio, nominal_torque_knm, input_shaft_mm, output_shaft_mm};
-- halat: {dia_mm, construction, core, breaking_load_kn}).
create table public.cat_equipment (
  id uuid primary key default gen_random_uuid(),
  kind text not null,          -- motor | gearbox | rope | brake | bearing | wheel | buffer | hook | other
  brand text not null,
  model text not null,
  attrs jsonb not null default '{}'::jsonb,
  notes text not null default '',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cat_equipment_kind_idx on public.cat_equipment (kind, active, sort);

alter table public.cat_equipment enable row level security;
create policy "equipment_select" on public.cat_equipment
  for select to authenticated using (true);
create policy "equipment_admin_write" on public.cat_equipment
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create trigger touch_cat_equipment before update on public.cat_equipment
  for each row execute function public.touch_updated_at();

-- Şablon revizyonlar: is_template=true olan (yayınlanmış) revizyon, yeni
-- projelerin ilk revizyonu için başlangıç kopyası olur.
alter table public.revisions add column is_template boolean not null default false;
create index revisions_template_idx on public.revisions (is_template) where is_template;

-- Varsayılan rapor ayarları
insert into public.app_settings (key, value) values
  ('report', jsonb_build_object(
    'company', 'ORION CRANES',
    'city', 'ANKARA · TÜRKİYE',
    'title_tr', 'HESAP RAPORU',
    'title_en', 'DESIGN CALCULATION REPORT',
    'default_crane_type', 'Çift Kirişli Gezer Köprülü Vinç'
  ))
on conflict (key) do nothing;

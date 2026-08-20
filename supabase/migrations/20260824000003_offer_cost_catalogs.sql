-- MALİYET DEFTERLERİ — güncel hammadde fiyatları ve kullanıcı kalem kataloğu.
--
-- Hammadde fiyatı GLOBALDİR ama maliyet belgesi global değere CANLI BAĞLI
-- DEĞİLDİR: yeni çalışma açılırken sekiz değer payload'a kopyalanır. Böylece
-- bugün sac fiyatını değiştirmek geçmiş teklifin maliyetini değiştirmez;
-- kullanıcı yeni teklifteki kopyayı ayrıca ezebilir.
--
-- Kullanıcının şablonda açtığı özel kalem ayrı kataloğa da yazılır. Şablondan
-- kaldırılması katalogdan silmez; başka bir vinç tipinde "Kalem Ekle" açılır
-- listesinde yeniden seçilebilir.

create table if not exists public.offer_cost_material_prices (
  key text primary key,
  label text not null check (btrim(label) <> ''),
  unit text not null check (btrim(unit) <> ''),
  unit_price numeric(14,4),
  sort int not null default 0,
  active boolean not null default true,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_offer_cost_material_prices on public.offer_cost_material_prices;
create trigger touch_offer_cost_material_prices
  before update on public.offer_cost_material_prices
  for each row execute function public.touch_updated_at();

alter table public.offer_cost_material_prices enable row level security;

drop policy if exists offer_cost_material_prices_select on public.offer_cost_material_prices;
drop policy if exists offer_cost_material_prices_write on public.offer_cost_material_prices;

create policy offer_cost_material_prices_select on public.offer_cost_material_prices
  for select to authenticated using (public.can_see_offer_costs());
create policy offer_cost_material_prices_write on public.offer_cost_material_prices
  for all to authenticated
  using (public.can_edit_offer_costs()) with check (public.can_edit_offer_costs());

-- Kullanıcının 20.08.2026 ekran görüntüsünde verdiği açılış fiyatları [€/kg].
insert into public.offer_cost_material_prices (key, label, unit, unit_price, sort)
values
  ('sac',            'SAC',                      'kg', 0.70, 10),
  ('profil',         'PROFİL',                   'kg', 0.70, 20),
  ('rayKare',        'KARE RAY',                 'kg', 0.90, 30),
  ('rayA',           'A TİPİ RAY',               'kg', 1.10, 40),
  ('kesim',          'KESİM',                    'kg', 0.10, 50),
  ('celikIsciligi',  'ÇELİK İMALAT İŞÇİLİĞİ',   'kg', 0.74, 60),
  ('boya',           'BOYA',                     'kg', 0.08, 70),
  ('boyaIsciligi',   'BOYA İŞÇİLİĞİ',            'kg', 0.07, 80)
on conflict (key) do nothing;

create table if not exists public.offer_cost_line_catalog (
  id uuid primary key default gen_random_uuid(),
  label text not null check (btrim(label) <> ''),
  -- Türkçe katlanmış karşılaştırma anahtarı uygulamada `trKatla` ile üretilir.
  match_key text not null,
  unit text not null check (unit in ('kg', 'adet', 'takım', 'ton', 'm', 'saat')),
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists offer_cost_line_catalog_key_uidx
  on public.offer_cost_line_catalog (match_key);
create index if not exists offer_cost_line_catalog_active_idx
  on public.offer_cost_line_catalog (label) where active;

drop trigger if exists touch_offer_cost_line_catalog on public.offer_cost_line_catalog;
create trigger touch_offer_cost_line_catalog
  before update on public.offer_cost_line_catalog
  for each row execute function public.touch_updated_at();

alter table public.offer_cost_line_catalog enable row level security;

drop policy if exists offer_cost_line_catalog_select on public.offer_cost_line_catalog;
drop policy if exists offer_cost_line_catalog_write on public.offer_cost_line_catalog;

create policy offer_cost_line_catalog_select on public.offer_cost_line_catalog
  for select to authenticated using (public.can_see_offer_costs());
create policy offer_cost_line_catalog_write on public.offer_cost_line_catalog
  for all to authenticated
  using (public.can_edit_offer_costs()) with check (public.can_edit_offer_costs());

comment on table public.offer_cost_material_prices is
  'Yeni maliyet çalışmasına anlık kopyalanan global hammadde birim fiyatları.';
comment on table public.offer_cost_line_catalog is
  'Maliyet şablonlarında yeniden seçilebilen kullanıcı tanımlı kalemler.';

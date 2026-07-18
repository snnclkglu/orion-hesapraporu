-- ORION Hesap Raporu — katalog/katsayı tabloları (Excel KATSAYILAR sayfasından)
-- Okuma: tüm oturum açmış kullanıcılar. Yazma: sadece admin.

-- FEM / DIN sınıflandırma listeleri (dropdown kaynakları)
create table public.cat_fem_classes (
  id bigint generated always as identity primary key,
  class_type text not null,   -- structure | mechanism | usage | load_b | hoist_h
  code text not null,         -- A1..A8, M1..M8, T0..T9, B1..B6, H1..H4
  sort int not null,
  unique (class_type, code)
);

-- Gerekli halat emniyet katsayıları Zp (KATSAYILAR A19:F30)
create table public.cat_rope_safety (
  mech_class text primary key,      -- M1..M8
  zp_moving numeric not null,       -- hareketli halat
  zp_fixed numeric not null         -- sabit halat
);

-- Tambur / makara / denge makarası H katsayıları (A39:I49)
create table public.cat_drum_sheave_coeff (
  mech_class text primary key,      -- M1..M8
  drum_h numeric not null,
  sheave_h numeric not null,
  equalizer_h numeric not null
);

-- Gerekli mekanizma ömürleri saat bandı (A52:J64)
create table public.cat_mechanism_life (
  usage_class text primary key,     -- T0..T9
  hours_min numeric,                -- T0 için null (alt sınır yok)
  hours_max numeric not null
);

-- Mil malzemeleri izin verilen gerilmeler [kg/cm²] (A32:J36)
create table public.cat_shaft_materials (
  material text primary key,        -- C25, C30, C35, C45, 4140+QT, 4140
  bending numeric not null,         -- s1
  shear numeric not null,           -- t
  combined numeric not null         -- sc
);

-- Raylar (A67:O70)
create table public.cat_rails (
  code text primary key,            -- A150..A45, 30x30..80x80
  radius numeric,                   -- kare raylarda null
  head_width numeric not null,      -- temas genişliği [mm]
  sort int not null
);

-- FEM c1 teker katsayısı 2B tablosu (A72:P87): teker çapı x devir bandı
create table public.cat_wheel_c1 (
  wheel_diameter numeric not null,  -- mm
  speed numeric not null,           -- tablo sütun başlığı (devir/hız bandı)
  c1 numeric not null,              -- '-' hücreleri satır olarak eklenmez
  primary key (wheel_diameter, speed)
);

-- DIN 15018 Tablo 17 yorulma gerilmeleri (A90:Q98)
create table public.cat_din15018_fatigue (
  material text not null,           -- St37 | St52
  notch_class text not null,        -- W0..W2, K0..K4
  load_group text not null,         -- B1..B6
  value numeric not null,           -- izin verilen gerilme
  primary key (material, notch_class, load_group)
);

-- Cıvata çekme alanları (O23:X26)
create table public.cat_bolt_areas (
  size text primary key,            -- M12..M39
  diameter numeric not null,        -- mm
  tensile_area numeric not null     -- mm²
);

-- Kaplin katalogları (tambur / fren-kasnaklı / dişli)
create table public.cat_couplings (
  id bigint generated always as identity primary key,
  coupling_type text not null,      -- drum | brake | gear
  brand text not null,              -- ÖZGÜN, JAURE, MAINA, GOSAN, IŞIK
  series text not null,             -- J, TCBR, GTS, AGBS, B3, MTFS, AGT10, Da...
  model text not null,              -- J7, TCBR 45, B3-3, Da-1 ...
  dmax numeric not null,            -- maks delik çapı [mm]
  t_nominal numeric not null,       -- nominal tork [Nm]
  radial_load numeric,              -- radyal yük [N] (sadece tambur kaplinleri)
  sort int not null,
  unique (coupling_type, brand, series, model)
);

-- ------------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'cat_fem_classes','cat_rope_safety','cat_drum_sheave_coeff',
    'cat_mechanism_life','cat_shaft_materials','cat_rails','cat_wheel_c1',
    'cat_din15018_fatigue','cat_bolt_areas','cat_couplings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%s_select" on public.%I for select to authenticated using (true)', t, t);
    execute format(
      'create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end
$$;

-- MARKA/KALİTE — kullanıcı kararı (14.08.2026):
--   "Sipariş Aç'ta Kalem'in yanına Marka/Kalite sütunu açalım. Fiyat Arşivi
--    Eski Veri excelindeki Kalite sütunundakileri sisteme al, dropdown yap.
--    Kullanıcı yeni kalite/marka girebilsin, girerse sisteme kaydedilsin.
--    Yönetim paneline bunun için bir sayfa/tablo yap."
--   ve (md. 18) aynı sütun Sarf Gideri Gir'de de olsun.
--
-- KATALOG + SNAPSHOT (tedarikçi defterinin kuralının aynısı): `purchase_qualities`
-- ÖNERİ listesidir; sipariş satırı ve sarf gideri seçilen değeri kendi
-- `quality` METNİNDE dondurur. Defter sonradan düzeltilse de yayınlanmış bir
-- sipariş değişmez.

create table if not exists public.purchase_qualities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Katlanmış ad (tr-TR büyük, boşluk sadeleştirilmiş): "MAİER" ile "MAİER "
  -- tek kayıt olur. `ensureQuality` bununla arar, insert bununla tekilleşir.
  match_key text not null,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_qualities_name_check check (btrim(name) <> '')
);

create unique index if not exists purchase_qualities_match_key_uidx
  on public.purchase_qualities (match_key);

drop trigger if exists touch_purchase_qualities on public.purchase_qualities;
create trigger touch_purchase_qualities before update on public.purchase_qualities
  for each row execute function public.touch_updated_at();

comment on table public.purchase_qualities is
  'Marka/Kalite ÖNERİ defteri (Fiyat Arşivi Eski Veri Kalite sütunundan '
  'damıtıldı). Sipariş satırı ve sarf gideri değeri kendi quality metninde '
  'dondurur.';

-- ------------------------------------------------------------------- RLS
-- Marka adları fiyat değildir: okuma `authenticated` (sipariş ve sarf girişini
-- yapan herkes öneriyi görmeli). Yazma satın alma ya da sarf düzenleyene açık.
alter table public.purchase_qualities enable row level security;

drop policy if exists purchase_qualities_select on public.purchase_qualities;
create policy purchase_qualities_select on public.purchase_qualities
  for select to authenticated using (true);

drop policy if exists purchase_qualities_write on public.purchase_qualities;
create policy purchase_qualities_write on public.purchase_qualities
  for all to authenticated
  using (public.can_edit_purchasing() or public.can_edit_consumable_expenses())
  with check (public.can_edit_purchasing() or public.can_edit_consumable_expenses());

-- ------------------------------------------------------- SNAPSHOT SÜTUNLARI
alter table public.purchase_order_lines
  add column if not exists quality text not null default '';
comment on column public.purchase_order_lines.quality is
  'Satırın MARKA/KALİTE snapshotu; purchase_qualities öneri kaynağıdır.';

alter table public.purchase_consumable_expenses
  add column if not exists quality text not null default '';
comment on column public.purchase_consumable_expenses.quality is
  'Sarf giderinin MARKA/KALİTE snapshotu.';

-- ------------------------------------------------------------------ SEED
-- SARF GİDERLER ESKİ VERİ.xlsx "Kalite" sütununun 99 damıtılmış değeri
-- (tr-TR büyük). Çakışma DO NOTHING: yeniden koşmak yinelemez.
insert into public.purchase_qualities (name, match_key)
select v.name, upper(btrim(v.name))
from (values
  ('3KEEGO'),('3M'),('ACCUD'),('AKKO'),('AKKON'),('ANSEL'),('ANSELL'),
  ('AS KAYNAK'),('ASELSAN'),('AVR'),('BAYMAK'),('BAYMAX'),('BAYMAX DYNAMİC'),
  ('BEMİS'),('BERİNG'),('BEST'),('BOSCH'),('CALDİNİ'),('CK 45'),('CTM'),
  ('ÇETSAN'),('DAYSON'),('DEKOR'),('EGE FLEX'),('EGEBANT'),('EGESAN'),('ERA'),
  ('ESSAFE'),('FAG'),('FİSCO'),('FORMAT'),('GEKA'),('GFB'),
  ('GİTTO REBERCOLOR'),('HASKAN'),('HASSASEL'),('HELİOS'),('HİLSAN'),
  ('HYUNDAI'),('INSIZE'),('İZELTAŞ'),('İZMİR FIRÇA'),('JOTUN'),('KARBONSAN'),
  ('KYOCERA'),('LINCOLN'),('LOGITECH'),('LUNA'),('MAGMAWELD'),('MAIER'),
  ('MAİER'),('MASTER'),('MİKSAN'),('MOBİL'),('MSK'),('MTE'),('MUTLUSAN'),
  ('NACHI'),('NTN'),('ORS'),('ORWELD'),('ÖZKAYALI'),('PANASONIC'),
  ('PETROL OFİSİ'),('PFERD'),('PFERDO'),('POLYAMİD'),('PROX'),('QTS'),('RUKO'),
  ('S235JR'),('S275JR'),('S355JR'),('SAİT DEMİRCİ'),('SANDER'),('SEL'),
  ('SHAVIV'),('SHELL'),('SIEMENS'),('SKP'),('SMOOXH'),('SONNEFLEX'),('SOYKAN'),
  ('STARLINE'),('TİMKEN'),('TOMAX'),('TP-LİNK'),('TUNGALOY'),('ÜNTEL'),
  ('VALENTE'),('VEGE'),('VENTO'),('VICTOGRAIN'),('VİKO'),('VZN'),('WEICON'),
  ('WİELTRA'),('XEROX'),('YILDIZ')
) as v(name)
where not exists (
  select 1 from public.purchase_qualities q where q.match_key = upper(btrim(v.name))
);

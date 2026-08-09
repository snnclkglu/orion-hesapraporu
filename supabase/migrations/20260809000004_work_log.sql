-- İş Takibi: günlük çalışma saati kaydı.
--
-- BİR SATIR = BİR GÜN × BİR İŞ KALEMİ × BİR PARÇA × BİR İMALAT TÜRÜ.
-- Ölçülen büyüklük ADAM·SAAT'tir: kaç kişi (`people`) kaç saat (`hours`)
-- çalıştı. Kişiler İSİMLE tutulmaz — atölye kaydı baştan beri kişi SAYISIYLA
-- tutuluyor ve her gün isim yazmak günlük girişi kullanılamaz hâle getirirdi.
--
-- YETKİ: bölümü yalnız Yönetici (admin) ve Müdür (manager) görür. Karşılığı
-- `can_see_work_log()`; Satış Takibi'ndeki `can_see_sales()` ile AYNI rol
-- kümesini sorar ama AYRI bir fonksiyondur — iki bölümün yetkisi ileride
-- ayrışabilir ve o gün tek satır değişmesi yeter.

-- --------------------------------------------------------------- yetki sorusu
create or replace function public.can_see_work_log()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'manager')
  );
$$;

-- ------------------------------------------------------------- imalat türleri
-- KATEGORİ ekseni: "Çelik İmalat", "Talaşlı İmalat", "Montaj"…
--
-- Sabit bir liste yerine TABLO: yeni bir imalat türü (kumlama, kaynak, boya
-- hazırlık…) girmek bir migration bekletmemeli — firma kuralı "rutin veri
-- düzenlemeleri panelden, geliştirmeler kodla".
--
-- RENK BİR AÇIDIR, HEX DEĞİL (bkz. `lib/tags.ts`): yığılmış çubuk grafikte
-- her türün rengi her ekranda aynı olmalı, ama aynı hex açık ve koyu temada
-- birden okunmaz. Veri yalnız OKLCH ton açısını taşır.
create table if not exists public.work_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color_hue int not null default 0 check (color_hue between 0 and 359),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------- parçalar
-- ÜRÜN ekseni: "Ana Kiriş", "Boji", "Kabin"… Kaynak Excel'de bu alan serbest
-- metindi ve aynı parça beş ayrı yazımla girilmişti ("Anakiriş" / "Ana Kiriş",
-- "Kaldrıma Kirşi" / "Kaldrıma Kirişi"). Serbest metin bırakılsaydı parça
-- bazında toplam ALINAMAZDI. Defter tek kayıt tutar; yazım düzeltmesi tek
-- satırı değiştirir ve geçmiş kendiliğinden düzelir.
create table if not exists public.work_parts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- kayıt satırı
create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,

  -- KALEM NUMARASI METNİ ASLIDIR, bağlantı türevdir.
  -- Atölye kaydında geçen numaraların bir kısmının sistemde karşılığı yok
  -- (henüz açılmamış ya da farklı numaralanmış iş). Bağlantıyı zorunlu
  -- kılmak o kayıtları aktarılamaz yapardı; metin her zaman durur, `job_id`
  -- ve `job_item_id` eşleştiği ölçüde dolar. Eşleşmeyenler arayüzde
  -- "eşleşmemiş" olarak sayılır ve tek işlemle düzeltilebilir.
  item_no text not null default '',
  job_id uuid references public.jobs (id) on delete set null,
  job_item_id uuid references public.job_items (id) on delete set null,

  part_id uuid not null references public.work_parts (id) on delete restrict,
  category_id uuid not null references public.work_categories (id) on delete restrict,

  -- Çizim grubu kodu ("0200" = ana kiriş grubu). İŞE GÖREdir, evrensel bir
  -- taksonomi DEĞİLDİR: aynı kod iki işte farklı grubu gösterebilir. Bu yüzden
  -- kendi tablosu yoktur; kalem numarasıyla birlikte okunur (0025-00-0200).
  part_code text not null default '',

  people int not null check (people > 0),
  hours numeric(6, 2) not null check (hours > 0),

  -- Adam·saat TÜRETİLİR — elle girilen bir çarpım ikisiyle çelişebilirdi.
  man_hours numeric(12, 2) generated always as (people * hours) stored,

  note text not null default '',

  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sorguların tamamı ya bir GÜN ya bir ARALIK okur; tarih indeksi zorunludur.
create index if not exists work_logs_date_idx on public.work_logs (work_date desc);
create index if not exists work_logs_item_idx on public.work_logs (item_no);
create index if not exists work_logs_job_idx on public.work_logs (job_id);
create index if not exists work_logs_job_item_idx on public.work_logs (job_item_id);
create index if not exists work_logs_part_idx on public.work_logs (part_id);
create index if not exists work_logs_category_idx on public.work_logs (category_id);

create trigger touch_work_categories before update on public.work_categories
  for each row execute function public.touch_updated_at();
create trigger touch_work_parts before update on public.work_parts
  for each row execute function public.touch_updated_at();
create trigger touch_work_logs before update on public.work_logs
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------- RLS
-- Satış Takibi ile aynı düzen: "authenticated okuma" YOK. Okuma da yazma da
-- `can_see_work_log()` ister. Menüden gizlemek yalnız görgü kuralıdır.
alter table public.work_categories enable row level security;
alter table public.work_parts      enable row level security;
alter table public.work_logs       enable row level security;

create policy "work_categories_select" on public.work_categories
  for select to authenticated using (public.can_see_work_log());
create policy "work_categories_write" on public.work_categories
  for all to authenticated using (public.can_see_work_log())
  with check (public.can_see_work_log());

create policy "work_parts_select" on public.work_parts
  for select to authenticated using (public.can_see_work_log());
create policy "work_parts_write" on public.work_parts
  for all to authenticated using (public.can_see_work_log())
  with check (public.can_see_work_log());

create policy "work_logs_select" on public.work_logs
  for select to authenticated using (public.can_see_work_log());
create policy "work_logs_insert" on public.work_logs
  for insert to authenticated with check (public.can_see_work_log());
create policy "work_logs_update" on public.work_logs
  for update to authenticated using (public.can_see_work_log())
  with check (public.can_see_work_log());
create policy "work_logs_delete" on public.work_logs
  for delete to authenticated using (public.can_see_work_log());

-- ------------------------------------------------------------ imalat türleri
-- Renkler marka dilinden seçildi: ağır çelik işi kırmızıya yakın sıcak tonda,
-- talaşlı imalat çelik mavisinde, montaj yeşilde. Ton açıları birbirinden
-- yeterince uzaktır (yığılmış çubukta komşu dilimler ayırt edilebilmelidir).
insert into public.work_categories (name, color_hue, sort) values
  ('Çelik İmalat',        25,  10),
  ('Talaşlı İmalat',     235,  20),
  ('Montaj',             155,  30),
  ('Saha Montajı',       195,  40),
  ('Yürüme Yolu Montajı', 95,  50),
  ('Boya',               290,  60)
on conflict (name) do nothing;

-- -------------------------------------------------------------------- parçalar
-- Devralınan kayıttaki 45 parça (yazım düzeltilmiş hâlleriyle). `sort` alfabetik
-- değil KULLANIM SIKLIĞINA göredir: günlük girişte en çok yazılan parça listenin
-- başında durmalıdır.
insert into public.work_parts (name, sort) values
  ('Ana Kiriş',              10),
  ('Montaj',                 20),
  ('Saha Montajı',           30),
  ('Kabin',                  40),
  ('Elektrik Odası',         50),
  ('Yardımcı Kiriş',         60),
  ('Boji',                   70),
  ('Araba Şasesi',           80),
  ('Baş Kiriş',              90),
  ('Ana Araba',             100),
  ('Talaşlı',               110),
  ('Panel',                 120),
  ('Ekolayzer',             130),
  ('Yürüme Yolu',           140),
  ('Araba Yürütme',         150),
  ('Merdiven Platform',     160),
  ('Tambur 185T',           170),
  ('Köprü Yürütme',         180),
  ('Kaldırma Kirişi',       190),
  ('Şarj Vinci Akşam Mesai',200),
  ('Yardımcı Araba',        210),
  ('Monoray',               220),
  ('185MT Üst Makara',      230),
  ('Yürüme Yolu Montajı',   240),
  ('Monoray Şasesi',        250),
  ('Tambur',                260),
  ('Konsol',                270),
  ('Kova Şasesi',           280),
  ('Tambur 40T',            290),
  ('Mafsal Kolu',           300),
  ('35T Tambur',            310),
  ('Ray Kesim',             320),
  ('Şase',                  330),
  ('Makara',                340),
  ('Ø450 Makara',           350),
  ('Kanca Mili',            360),
  ('Makara Yatağı',         370),
  ('Mil',                   380),
  ('Tambur Döndürme',       390),
  ('Tambur Sehpası',        400),
  ('Boya',                  410),
  ('Pergel Kolu',           420),
  ('Tahrik Mili',           430),
  ('Kanca Bloğu Kaportası', 440),
  ('Rulman Yatağı',         450)
on conflict (name) do nothing;

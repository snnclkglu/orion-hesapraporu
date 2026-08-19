-- ELEKTRİK PROJESİ — hesap raporu projesine bağlı, OKUNAN bir belge.
--
-- Bugün elektrik projesi kimsenin dosyasında duruyor ve içindeki malzeme
-- listesi ekipman listesine, satın almaya ve İşletme ve Bakım El Kitabı'nın
-- elektrik ekine ÜÇ KEZ elle yazılıyor. Bu tablo onu bir kez alır ve okur.
--
-- İKİ KATMAN, İKİ TABLO:
--   `electrical_projects` — YÜKLEMENİN kendisi (dosya, künye, sayfa dizini).
--   `electrical_parts`    — malzeme listesinin AYIKLANMIŞ satırları.
--
-- Satırlar neden `meta` JSONB'ye değil kendi tablosuna yazılıyor: 726 satırlık
-- bir liste sorgulanabilir olmalı (panoya göre süz, tedarikçiye göre topla,
-- bir malzeme kodunu bütün projelerde ara). JSONB'de bunların hepsi tam tablo
-- taraması olurdu. Künye ve sayfa dizini ise BELGENİN KENDİ ÖZELLİĞİDİR,
-- sorgulanmaz — onlar `meta`da kalır.
--
-- REVİZYON YOK, YÜKLEME VAR. Elektrik projesi BİZİM belgemiz değildir; çizim
-- bürosu onu "rev3" diye verir ve bir sonraki sefer "rev4" gelir. Uygulama
-- kendi revizyon zincirini kurmaz, GELEN SÜRÜMLERİ saklar ve hangisinin
-- geçerli olduğunu `is_current` söyler. Eskisi silinmez: teslim edilmiş bir el
-- kitabı hangi sürüme dayandığını gösterebilmelidir.

-- ------------------------------------------------------- electrical_projects
create table if not exists public.electrical_projects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Kullanıcının dosya adı — sürümü de çoğu zaman o taşır ("…_rev3.pdf").
  file_name text not null default '',
  -- Çizim bürosunun sürüm etiketi. DOSYA ADINDAN ÖNERİLİR ama ELLE
  -- düzenlenebilir: "rev3" bir beyandır, uygulamanın türettiği bir gerçek
  -- değil. Bulunamazsa BOŞ kalır (değişmez md. 4).
  revision text not null default '',
  -- Depodaki tam yol: `<project_id>/<electrical_project_id>.pdf`
  storage_path text not null,
  size_bytes bigint not null default 0,
  -- Sunucunun OKUYARAK saydığı sayfa adedi (beyan değil ÖLÇÜM; ekipman
  -- ekinin `page_count` dersiyle aynı). 0 ise dosya açılamamıştır.
  page_count integer not null default 0,
  -- Okunan künye + sayfa dizini + okuma notu (`ElectricalRead` sözleşmesi,
  -- `parts` alanı HARİÇ — o aşağıdaki tabloda).
  meta jsonb not null default '{}'::jsonb,
  -- Okuma ne zaman koştu; null ise dosya yüklendi ama daha okunmadı.
  parsed_at timestamptz,
  -- EL KİTABINA VE EKİPMAN LİSTESİNE GİREN SÜRÜM. Aynı projede yalnız biri
  -- güncel olabilir (aşağıdaki kısmi tekil indeks).
  is_current boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index if not exists electrical_projects_project_idx
  on public.electrical_projects (project_id, created_at desc);

-- GÜNCEL SÜRÜM TEKTİR. Kural VERİTABANINDA durur, uygulamada değil: iki
-- sekmede aynı anda yapılan iki yükleme aksi hâlde iki "güncel" bırakırdı ve
-- el kitabı hangisini bastığını bilemezdi.
create unique index if not exists electrical_projects_current_uidx
  on public.electrical_projects (project_id) where is_current;

alter table public.electrical_projects enable row level security;

-- OKUMA HERKESE, YAZMA MÜHENDİSLİĞE. Elektrik projesi atölyenin de okuduğu
-- bir belgedir (teknik resimlerle aynı gerekçe); yüklemek ve okutmak ise
-- hesap raporunu yazan rolün işidir.
drop policy if exists "elp_select" on public.electrical_projects;
create policy "elp_select" on public.electrical_projects
  for select to authenticated using (true);

drop policy if exists "elp_write" on public.electrical_projects;
create policy "elp_write" on public.electrical_projects
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

comment on table public.electrical_projects is
  'Projeye yüklenen elektrik projesi PDF''i; baytlar electrical-projects kovasında, ayıklanan malzeme electrical_parts tablosunda.';

-- ---------------------------------------------------------- electrical_parts
create table if not exists public.electrical_parts (
  id uuid primary key default gen_random_uuid(),
  electrical_project_id uuid not null
    references public.electrical_projects (id) on delete cascade,
  -- BELGEDEKİ SIRA. Liste alfabetik değil PROJENİN kendi düzeninde okunur;
  -- yeniden dizmek elektrikçiyi belgeden koparırdı.
  sort integer not null,
  device_tag text not null default '',
  -- Aygıt etiketinin çözülmüş parçaları (IEC 81346: `=` tesis, `+` konum,
  -- `-` aygıt). Ayrı sütunlar çünkü PANEL DÖKÜMÜ bunlardan çıkar ve bir
  -- LIKE taramasıyla üretilemez.
  installation text not null default '',
  location text not null default '',
  device text not null default '',
  -- ADET NULL OLABİLİR ve bu SIFIR DEĞİLDİR: okunamayan bir adet
  -- bilinmiyordur (değişmez md. 4).
  qty numeric,
  designation text not null default '',
  type_no text not null default '',
  supplier text not null default '',
  part_no text not null default '',
  -- Satırın belgede yazdığı 1 tabanlı sayfa — okuyan kaynağa dönebilsin.
  page integer not null default 0
);

create index if not exists electrical_parts_doc_idx
  on public.electrical_parts (electrical_project_id, sort);
create index if not exists electrical_parts_location_idx
  on public.electrical_parts (electrical_project_id, location);
-- Malzeme kodunu BÜTÜN projelerde aramak için: "bu şalteri başka nerede
-- kullanmışız" satın almanın ilk sorusudur.
create index if not exists electrical_parts_part_no_idx
  on public.electrical_parts (part_no) where part_no <> '';

alter table public.electrical_parts enable row level security;

drop policy if exists "elpart_select" on public.electrical_parts;
create policy "elpart_select" on public.electrical_parts
  for select to authenticated using (true);

drop policy if exists "elpart_write" on public.electrical_parts;
create policy "elpart_write" on public.electrical_parts
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

comment on table public.electrical_parts is
  'Elektrik projesinin malzeme listesinden (Parts list) ayıklanan satırlar; adet NULL ise okunamamıştır (sıfır değil).';

-- --------------------------------------------------------------------- bucket
-- 150 MB: gerçek bir elektrik projesi 157 sayfa / 12 MB'tır ama panel yerleşim
-- görselleri taşıyan bir dışa aktarım kolayca 80 MB'ı bulur. Sınır cömerttir
-- ki yükleme reddedilmesin; dosya zaten proje başına birkaç sürümdür.
insert into storage.buckets (id, name, public, file_size_limit)
values ('electrical-projects', 'electrical-projects', false, 157286400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "electrical-projects okuma (authenticated)" on storage.objects;
create policy "electrical-projects okuma (authenticated)" on storage.objects
  for select to authenticated using (bucket_id = 'electrical-projects');

drop policy if exists "electrical-projects yükleme (authenticated)" on storage.objects;
create policy "electrical-projects yükleme (authenticated)" on storage.objects
  for insert to authenticated with check (bucket_id = 'electrical-projects');

drop policy if exists "electrical-projects güncelleme (authenticated)" on storage.objects;
create policy "electrical-projects güncelleme (authenticated)" on storage.objects
  for update to authenticated
  using (bucket_id = 'electrical-projects')
  with check (bucket_id = 'electrical-projects');

-- SİLME DE AUTHENTICATED'TIR: yanlış dosya yükleyen onu kaldırabilmeli.
-- Sıra "önce ucuz olanı kaybet"tir (AGENTS, Teknik Resimler): önce TABLO
-- satırı, sonra depo nesnesi. En kötü ihtimalle yetim bir nesne kalır ve o
-- geri alınabilir bir hatadır.
drop policy if exists "electrical-projects silme (authenticated)" on storage.objects;
create policy "electrical-projects silme (authenticated)" on storage.objects
  for delete to authenticated using (bucket_id = 'electrical-projects');

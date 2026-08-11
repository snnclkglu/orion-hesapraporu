-- EKİPMAN LİSTESİNE ELLE EKLENEN KATALOG SAYFALARI ("Ek Belge" sütunu).
--
-- Detaylı ekipman listesi bugün YALNIZ defterdeki (manifest.json) katalog
-- sayfalarını ekleyebiliyor. Defter kaynak PDF'i workspace'te olan üreticileri
-- kapsar; kanca, makara, teker, ray ve müşteriye özel bir çok ürünün sayfası
-- orada YOKTUR ve hiç olmayacaktır (AGENTS, katalog sayfası kapsamı). Mühendis
-- o sayfayı elinde PDF olarak tutuyor. Bu tablo onu ekipman SATIRINA bağlar.
--
-- ANAHTAR `row_key`tir — `equipment_notes` ile birebir aynı kimlik
-- (`<modulKey>:<slug>`). İki tablo aynı satırı gösterir; ayrı bir kimlik
-- üretmek "not şu satırda, ek şu satırda" gibi sessiz bir ayrışma üretirdi.
--
-- BAYTLAR TABLODA DEĞİL DEPODADIR (`equipment-attachments` bucket'ı). Bir
-- katalog yaprağı megabaytlarcadır; JSONB'ye base64 koymak revizyon
-- snapshot'ını ve her okumayı şişirirdi.
--
-- REVİZYON BAŞINADIR, proje başına değil: teslim edilmiş bir listenin eki
-- sonradan değişmemelidir. Yeni revizyon açılırken ekler `copyEquipmentNotes`
-- ile aynı adımda KOPYALANIR (depo nesnesi de kopyalanır) — mühendis her
-- versiyonda aynı PDF'i yeniden yüklemez.

create table if not exists public.equipment_attachments (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.revisions(id) on delete cascade,
  -- Ekipman satırının kararlı kimliği: `<modulKey>:<slug>`
  row_key text not null,
  -- Kullanıcının dosyasının adı — ek sayfasının başlığında görünür.
  file_name text not null default '',
  -- Depodaki tam yol: `<revision_id>/<attachment_id>.pdf`
  storage_path text not null,
  -- Sunucunun OKUYARAK saydığı sayfa adedi (beyan değil ölçüm). 0 ise dosya
  -- açılamamıştır ve ek basılmaz.
  page_count integer not null default 0,
  -- Aynı satıra birden çok ek: kullanıcının verdiği sıra korunur.
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.equipment_attachments enable row level security;

-- RLS `equipment_notes` ile AYNI: revizyonu gören okur ve yazar. Ek bir
-- açıklama gibidir — teslim katmanındadır, hesap değeri değildir; bu yüzden
-- `guard_issued_revision` buraya da UYGULANMAZ ve yayınlanmış revizyonda da
-- ek yüklenebilir.
create policy "eqa_select" on public.equipment_attachments
  for select to authenticated
  using (exists (select 1 from public.revisions r where r.id = revision_id));

create policy "eqa_write" on public.equipment_attachments
  for all to authenticated
  using (exists (select 1 from public.revisions r where r.id = revision_id))
  with check (exists (select 1 from public.revisions r where r.id = revision_id));

create index if not exists equipment_attachments_revision_idx
  on public.equipment_attachments (revision_id, row_key, sort);

-- --------------------------------------------------------------------- bucket
-- 25 MB: taranmış tek bir katalog yaprağı 200–800 KB, ama mühendis çoğu zaman
-- üreticinin çok sayfalı bölüm PDF'ini olduğu gibi yükler. Sınır cömerttir ki
-- yükleme reddedilmesin; belge sayısı zaten satır başına elle verilir.
insert into storage.buckets (id, name, public, file_size_limit)
values ('equipment-attachments', 'equipment-attachments', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Politikalar `reports` bucket'ıyla aynı düzeydedir (authenticated okur/yazar):
-- ek, yeniden yüklenebilir TEK bir PDF'tir; `drawings` bucket'ındaki gibi
-- 450 dosyalık bir teslim değildir, bu yüzden oradaki sıkı yetki gerekmez.
drop policy if exists "equipment-attachments okuma (authenticated)" on storage.objects;
create policy "equipment-attachments okuma (authenticated)" on storage.objects
  for select to authenticated using (bucket_id = 'equipment-attachments');

drop policy if exists "equipment-attachments yükleme (authenticated)" on storage.objects;
create policy "equipment-attachments yükleme (authenticated)" on storage.objects
  for insert to authenticated with check (bucket_id = 'equipment-attachments');

drop policy if exists "equipment-attachments güncelleme (authenticated)" on storage.objects;
create policy "equipment-attachments güncelleme (authenticated)" on storage.objects
  for update to authenticated
  using (bucket_id = 'equipment-attachments')
  with check (bucket_id = 'equipment-attachments');

-- SİLME DE AUTHENTICATED'TIR: yanlış dosya yükleyen kullanıcı onu kaldırabilmeli.
-- Sıra "önce ucuz olanı kaybet" kuralına uyar (AGENTS, Teknik Resimler): önce
-- TABLO satırı silinir, sonra depo nesnesi. Ters sırada depo temizlenip satır
-- kalsaydı liste var olmayan bir eke bağlanırdı; bu sırada ise en kötü ihtimalle
-- yetim bir nesne kalır ve o geri alınabilir bir hatadır.
drop policy if exists "equipment-attachments silme (authenticated)" on storage.objects;
create policy "equipment-attachments silme (authenticated)" on storage.objects
  for delete to authenticated using (bucket_id = 'equipment-attachments');

comment on table public.equipment_attachments is
  'Ekipman listesi satırına elle eklenen katalog/PDF ekleri. Detaylı ekipman listesi PDF''inin sonuna basılır; baytlar equipment-attachments bucket''ındadır.';

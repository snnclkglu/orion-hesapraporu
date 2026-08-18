-- İş emri: REVİZYON BOŞ BAŞLAR · SÖZLEŞME SATIŞA TAŞINIR · İŞLER YAZMA KAPISI
-- (kullanıcı kararları, 18.08.2026)

-- ─────────────────────────────────────────────── 1. Revizyon boş başlar
--
-- *"İlk açılan iş emri revizyonsuz başlar. Eğer revize edilirse Revizyon A
-- olur."* Boş harf "bilinmiyor" DEĞİL bir olgudur: bu belge hiç revize
-- edilmedi. Devralınan 63 satırın hepsi bir gün önce 'A' ile açılmıştı ve
-- HİÇBİRİ revize edilmemişti (revizyon zinciri ilk düzenlemede B'ye geçiyordu),
-- yani 'A' → '' dönüşümü veri kaybı değil düzeltmedir.
alter table public.jobs drop constraint if exists jobs_revision_harf;
alter table public.jobs alter column revision set default '';
update public.jobs set revision = '' where revision = 'A';
alter table public.jobs
  add constraint jobs_revision_harf check (revision ~ '^([A-Z]{1,3})?$');

-- ────────────────────────────────── 2. Sözleşme İşler'den Satış'a taşınır
--
-- *"işler sayfasını tüm kullanıcılara açacağım … Sözleşmeyi de görmesinler
-- istiyorum."* Dosyayı `jobs` üzerinde bırakıp yalnız arayüzden gizlemek
-- YETMEZ: `jobs` herkese okunur, yani yol da okunur ve imzalı bağlantı
-- oradan üretilebilirdi. Kayıt AYRI bir tabloya taşınır ve o tablo
-- `can_see_sales()` ile kesilir — engel RLS'tedir, görgü kuralı değil.
--
-- TABLO İŞ EMRİ BAŞINADIR, iş kalemi başına değil (kullanıcı kararı):
-- bir sözleşme işin tamamını kapsar; dokuz kalemli bir işte aynı PDF'i dokuz
-- kez yüklemek gerekmez. Yükleme yeri Satış Bilgisi penceresidir, kaydın
-- anahtarı ise `job_id`dir.
create table if not exists public.job_contracts (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  file_path text not null default '',
  file_name text not null default '',
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

alter table public.job_contracts enable row level security;

drop policy if exists "job_contracts_select" on public.job_contracts;
create policy "job_contracts_select" on public.job_contracts
  for select to authenticated using (public.can_see_sales());
drop policy if exists "job_contracts_write" on public.job_contracts;
create policy "job_contracts_write" on public.job_contracts
  for all to authenticated
  using (public.can_see_sales()) with check (public.can_see_sales());

-- Sütunlar DÜŞÜRÜLÜR, yanında bırakılmaz (`profiles.tags` dersinin aynısı):
-- iki yerde yaşayan bir alan, birinde düzeltilen kuralın ötekinde kalması
-- demektir — ve buradaki "kural" bir sızıntı kapısıdır. Veri kaybı YOKTUR:
-- ölçüldü, `contract_file_path` dolu olan İŞ EMRİ YOKTU (0/63).
alter table public.jobs
  drop column if exists contract_file_path,
  drop column if exists contract_file_name;

-- Depo politikası da aynı soruyu sorar. `drawings`/`personnel` kalıbı: imzalı
-- bağlantı uygulama katmanındaki rolü TAŞIMAZ, bu yüzden bucket'ın kendisi
-- kesilmelidir.
drop policy if exists "contracts okuma (authenticated)" on storage.objects;
drop policy if exists "contracts yükleme (authenticated)" on storage.objects;
drop policy if exists "contracts güncelleme (authenticated)" on storage.objects;
drop policy if exists "contracts silme (authenticated)" on storage.objects;

create policy "contracts okuma (satis)" on storage.objects
  for select to authenticated
  using (bucket_id = 'contracts' and public.can_see_sales());
create policy "contracts yükleme (satis)" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contracts' and public.can_see_sales());
create policy "contracts güncelleme (satis)" on storage.objects
  for update to authenticated
  using (bucket_id = 'contracts' and public.can_see_sales())
  with check (bucket_id = 'contracts' and public.can_see_sales());
create policy "contracts silme (satis)" on storage.objects
  for delete to authenticated
  using (bucket_id = 'contracts' and public.can_see_sales());

-- ─────────────────────────────────── 3. İş emri YAZMA kapısı (ROL-15 deseni)
--
-- *"Yönetici ve Müdür harici düzenleme ve yeni iş açamayacak sadece
-- görüntüleme yapacak."* Soru AYRI bir fonksiyondur, rol listesi değil;
-- TypeScript karşılığı `canEditJobs` (lib/roles.ts).
create or replace function public.can_edit_jobs()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager')
  );
$$;

grant execute on function public.can_edit_jobs() to authenticated;

drop policy if exists "jobs_insert" on public.jobs;
create policy "jobs_insert" on public.jobs
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_edit_jobs());

drop policy if exists "jobs_update" on public.jobs;
create policy "jobs_update" on public.jobs
  for update to authenticated using (public.can_edit_jobs());

-- Silme YÖNETİCİDE KALIR (daha dar): `jobs_delete` dokunulmadı.
--
-- `job_items` POLİTİKASI DA DOKUNULMADI ve bu bilinçlidir: İşler bir HUB'dır
-- (IS-25). Mühendis hesap raporunu kaleme bağlar (`job_items.project_id`),
-- ressam resim çarpanını yazar (`qty`, `shares_drawings_with`). İş emrinin
-- KENDİSİNİ değiştiren yol `jobs` satırından geçer ve orada kesilir; kalem
-- satırını kilitlemek, bölümü herkese açma kararını boşa çıkarırdı.

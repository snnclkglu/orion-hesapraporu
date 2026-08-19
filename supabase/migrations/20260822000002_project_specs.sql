-- ŞARTNAME — projenin dayandığı müşteri belgesi.
--
-- Hesap raporu bir ŞARTNAMEYE cevap verir: kapasite, açıklık, sınıflandırma,
-- hız, ortam koşulları hep oradan gelir. Bugün o belge kimsenin e-postasında
-- duruyor ve "müşteri ne istemişti" sorusu her seferinde yeniden aranıyor.
-- İşletme ve Bakım El Kitabı da müşterinin kendi listesine göre Teknik
-- Şartname'yi EK olarak taşımak zorunda (Kardemir talebi, 19.08.2026).
--
-- ÇOK SATIR, TEK GÜNCEL. Şartname revize edilir ("rev B ile açıklık değişti")
-- ve eskisi SİLİNMEZ: yayımlanmış bir hesap raporunun hangi şartnameye
-- dayandığı sonradan sorulur. Ekranda "Şartname" düğmesi GÜNCEL olanı açar.
--
-- NEDEN `job_contracts` DEĞİL: sözleşme İŞ EMRİNE bağlı ticari bir belgedir
-- (bedel, vade, teslim); şartname İŞ KALEMİNE bağlı TEKNİK bir belgedir ve
-- bir işin iki kaleminin iki ayrı şartnamesi olabilir. İkisini tek tabloya
-- toplamak "hangi vincin şartnamesi" sorusunu cevapsız bırakırdı.

create table if not exists public.project_specs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  file_name text not null default '',
  -- Depodaki tam yol: `<project_id>/<spec_id>.<uzantı>`
  storage_path text not null,
  -- MIME beyandır; uzantı da bir şey ispat etmez. PDF ise sunucu onu AÇAR ve
  -- sayfasını sayar (özlük dosyası ile aynı ilke); açılamayan dosya kayda
  -- girmez. PDF olmayan bir belge (docx/xlsx) sayfasız kabul edilir.
  content_type text not null default '',
  size_bytes bigint not null default 0,
  page_count integer not null default 0,
  -- Müşterinin kendi revizyon etiketi ("Rev.B"); BOŞ olabilir.
  revision text not null default '',
  note text not null default '',
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index if not exists project_specs_project_idx
  on public.project_specs (project_id, created_at desc);

-- Güncel şartname TEKTİR — `electrical_projects` ile aynı gerekçe.
create unique index if not exists project_specs_current_uidx
  on public.project_specs (project_id) where is_current;

alter table public.project_specs enable row level security;

-- OKUMA HERKESE: şartname atölyenin de sorduğu belgedir. YAZMA mühendisliğe.
drop policy if exists "project_specs_select" on public.project_specs;
create policy "project_specs_select" on public.project_specs
  for select to authenticated using (true);

drop policy if exists "project_specs_write" on public.project_specs;
create policy "project_specs_write" on public.project_specs
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

comment on table public.project_specs is
  'Projenin teknik şartnamesi (müşteri belgesi); baytlar project-specs kovasında. Güncel olan tektir, eskiler saklanır.';

-- --------------------------------------------------------------------- bucket
-- 50 MB: şartname çoğu zaman 20-80 sayfalık bir PDF'tir ama içine tarama
-- eklenmiş sürümleri onlarca megabaytı bulur.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-specs', 'project-specs', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "project-specs okuma (authenticated)" on storage.objects;
create policy "project-specs okuma (authenticated)" on storage.objects
  for select to authenticated using (bucket_id = 'project-specs');

drop policy if exists "project-specs yükleme (authenticated)" on storage.objects;
create policy "project-specs yükleme (authenticated)" on storage.objects
  for insert to authenticated with check (bucket_id = 'project-specs');

drop policy if exists "project-specs güncelleme (authenticated)" on storage.objects;
create policy "project-specs güncelleme (authenticated)" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-specs')
  with check (bucket_id = 'project-specs');

drop policy if exists "project-specs silme (authenticated)" on storage.objects;
create policy "project-specs silme (authenticated)" on storage.objects
  for delete to authenticated using (bucket_id = 'project-specs');

-- Faz D: iş emri modeli
-- jobs (iş emri: bir iş = birden çok vinç) + projects.job_id bağlantısı
-- drawings (vinç başına teknik çizim takibi) + çizim kategori öntanımları

create type public.drawing_status as enum ('draft', 'checking', 'approved');

-- --------------------------------------------------------------------- jobs
-- İş emri: 0057-00 gibi serbest formatlı iş no + müşteri + başlık.
-- Vinçler (projects) job_id ile bağlanır; bağımsız vinçlerde job_id null kalır.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_no text not null unique,          -- ör. 0057-00 (serbest metin)
  title text not null,                  -- ör. ASTOR — Muhtelif Vinçler
  customer text not null,               -- ör. ASTOR A.Ş.
  status public.project_status not null default 'active',
  notes text not null default '',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects
  add column job_id uuid references public.jobs (id) on delete set null;
create index projects_job_idx on public.projects (job_id);

-- ----------------------------------------------------------------- drawings
-- Teknik çizim kaydı: no / ad / kategori / revizyon / durum / dosya linki.
-- Dosya şimdilik Google Drive URL'i; ileride Storage upload eklenecek.
create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  drawing_no text not null,             -- ör. 0053-01-0100
  title text not null,
  category text not null default 'DİĞER',
  revision text not null default 'A',
  status public.drawing_status not null default 'draft',
  file_url text not null default '',    -- Google Drive linki
  notes text not null default '',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index drawings_project_idx on public.drawings (project_id);

-- ---------------------------------------------------------------------- RLS
-- Mevcut desen: authenticated okuma/yazma, silme sadece admin.
alter table public.jobs     enable row level security;
alter table public.drawings enable row level security;

create policy "jobs_select" on public.jobs
  for select to authenticated using (true);
create policy "jobs_insert" on public.jobs
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "jobs_update" on public.jobs
  for update to authenticated using (true);
create policy "jobs_delete" on public.jobs
  for delete to authenticated using (public.is_admin());

create policy "drawings_select" on public.drawings
  for select to authenticated using (true);
create policy "drawings_insert" on public.drawings
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "drawings_update" on public.drawings
  for update to authenticated using (true);
create policy "drawings_delete" on public.drawings
  for delete to authenticated using (public.is_admin());

-- updated_at bakımı (mevcut touch_updated_at fonksiyonu)
create trigger touch_jobs before update on public.jobs
  for each row execute function public.touch_updated_at();
create trigger touch_drawings before update on public.drawings
  for each row execute function public.touch_updated_at();

-- Çizim kategori öntanımları (Google Drive klasör deseninden:
-- "0053-01-0100 KÖPRÜ YÜRÜTME GRUBU"). Panelden app_settings ile düzenlenebilir.
insert into public.app_settings (key, value) values
  ('drawing_categories', jsonb_build_array(
    'KÖPRÜ YÜRÜTME GRUBU',
    'TAŞIYICI AYAKLAR',
    'MERDİVEN PLATFORM',
    'FESTON HATTI',
    'KST YERLEŞİMİ',
    'PANO-BAZA VE MUHAFAZA',
    'ARABA KOMPLE',
    'ARABA YÜRÜTME',
    'ARABA ŞASE',
    'TAMBUR',
    'TAMBUR TAHRİK GRUBU',
    'ÜST MAKARA',
    'DENGE TRAVERSİ',
    'ARABA PLATFORM',
    'KANCA BLOĞU',
    'ARABA MUHAFAZA',
    'SPREADER BEAM',
    'ANA KİRİŞ',
    'BAŞKİRİŞ',
    'GENEL GÖRÜNÜŞ',
    'DİĞER'
  ))
on conflict (key) do nothing;

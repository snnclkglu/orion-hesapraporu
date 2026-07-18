-- ORION Hesap Raporu — çekirdek şema
-- profiles / projects / revisions / audit_log + RLS + kilit trigger'ları

create type public.user_role as enum ('admin', 'engineer');
create type public.revision_status as enum ('draft', 'issued');
create type public.project_status as enum ('active', 'archived');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  title text not null default '',
  role public.user_role not null default 'engineer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Yeni auth kullanıcısı -> otomatik profil; ilk admin sinan@vigowood.com
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when new.email = 'sinan@vigowood.com' then 'admin'::public.user_role
         else 'engineer'::public.user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,          -- ör. 0055-HR-001
  name text not null,                   -- ör. AMONYUM SÜLFAT VİNCİ
  customer text not null,               -- ör. İSDEMİR
  crane_type text not null default 'Çift Kirişli Gezer Köprülü Vinç',
  status public.project_status not null default 'active',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------- revisions
create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  rev_no int not null,                  -- 0,1,2... proje içinde artan
  label text not null default '',       -- ör. V5, "müşteri yorumları işlendi"
  status public.revision_status not null default 'draft',
  inputs jsonb not null default '{}'::jsonb,
  selections jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  engine_version text not null default '',
  notes text not null default '',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references public.profiles (id),
  unique (project_id, rev_no)
);

-- issued revizyon değiştirilemez / silinemez (status geçişi hariç tek yön)
create or replace function public.guard_issued_revision()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then
      raise exception 'Yayınlanmış revizyon silinemez';
    end if;
    return old;
  end if;

  if old.status = 'issued' then
    raise exception 'Yayınlanmış revizyon değiştirilemez; yeni revizyon oluşturun';
  end if;

  if new.status = 'issued' and old.status = 'draft' then
    new.issued_at := now();
    new.issued_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_issued_revision
  before update or delete on public.revisions
  for each row execute function public.guard_issued_revision();

-- --------------------------------------------------------------- audit_log
create table public.audit_log (
  id bigint generated always as identity primary key,
  project_id uuid references public.projects (id) on delete set null,
  revision_id uuid references public.revisions (id) on delete set null,
  actor uuid references public.profiles (id),
  action text not null,                 -- ör. project.create, revision.issue
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------- RLS
alter table public.profiles  enable row level security;
alter table public.projects  enable row level security;
alter table public.revisions enable row level security;
alter table public.audit_log enable row level security;

-- profiles: herkes okur (ekip küçük), sadece kendi profilini veya admin günceller
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- projects: tüm ekip okur/yazar; silme sadece admin
create policy "projects_select" on public.projects
  for select to authenticated using (true);
create policy "projects_insert" on public.projects
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "projects_update" on public.projects
  for update to authenticated using (true);
create policy "projects_delete" on public.projects
  for delete to authenticated using (public.is_admin());

-- revisions: tüm ekip okur/yazar (issued kilidi trigger'da); silme sadece admin
create policy "revisions_select" on public.revisions
  for select to authenticated using (true);
create policy "revisions_insert" on public.revisions
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "revisions_update" on public.revisions
  for update to authenticated using (true);
create policy "revisions_delete" on public.revisions
  for delete to authenticated using (public.is_admin());

-- audit_log: insert-only (güncelleme/silme politikası yok)
create policy "audit_select" on public.audit_log
  for select to authenticated using (true);
create policy "audit_insert" on public.audit_log
  for insert to authenticated with check (actor = (select auth.uid()));

-- updated_at bakımı
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_projects before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

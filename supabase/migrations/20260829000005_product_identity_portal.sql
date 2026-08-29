-- VİNÇ KİMLİĞİ · İSİM PLAKASI · MÜŞTERİ DOKÜMAN PORTALI
--
-- Bir proje iş kaleminin ORTAK doküman paketidir; fiziksel vinçler ise ayrı
-- ünitelerdir. Aynı vinçten iki adet üretildiğinde A/B üniteleri ayrı seri,
-- kalıcı QR ve parola taşır ama aynı yayımlanmış PDF baytlarını okur.
--
-- Müşteriye CANLI iç kaynak gösterilmez. Taslakta hesap raporu, ekipman
-- listesi, el kitabı, elektrik projesi ve teknik resimler önerilir; "Yayınla"
-- anında seçilen PDF'ler private `customer-portal` kovasına dondurulur. Böylece
-- sonraki iç revizyon eski teslimi sessizce değiştirmez.

-- --------------------------------------------------------------- yetki sorusu
create or replace function public.can_edit_product_portals()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_edit_reports();
$$;

comment on function public.can_edit_product_portals() is
  'Vinç kimliği, isim plakası ve müşteri portalı yazma yetkisi; bugün can_edit_reports ile aynıdır, ayrı sorudur.';

-- ------------------------------------------------------------- portal defteri
create table if not exists public.product_portals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  current_revision_id uuid,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

alter table public.product_portals enable row level security;

create policy "product_portals_select" on public.product_portals
  for select to authenticated using (public.can_edit_product_portals());
create policy "product_portals_insert" on public.product_portals
  for insert to authenticated
  with check (public.can_edit_product_portals() and created_by = (select auth.uid()));
create policy "product_portals_update" on public.product_portals
  for update to authenticated
  using (public.can_edit_product_portals())
  with check (public.can_edit_product_portals());
create policy "product_portals_delete" on public.product_portals
  for delete to authenticated using (public.can_edit_product_portals());

drop trigger if exists touch_product_portals on public.product_portals;
create trigger touch_product_portals before update on public.product_portals
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- paket sürümleri
create table if not exists public.product_portal_revisions (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.product_portals(id) on delete cascade,
  rev_no integer not null check (rev_no > 0),
  status public.revision_status not null default 'draft',
  -- Kimlik otomatik değerleri + alan bazlı override, plaka ölçüsü ve taslak
  -- doküman seçimi tek snapshot'tır. Yayımlanan payload değişmez.
  payload jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references public.profiles(id),
  unique (portal_id, rev_no)
);

create index if not exists product_portal_revisions_portal_idx
  on public.product_portal_revisions(portal_id, rev_no desc);

create or replace function public.guard_issued_product_portal_revision()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then
      raise exception 'Yayımlanmış müşteri portalı sürümü silinemez';
    end if;
    return old;
  end if;

  if old.status = 'issued' then
    raise exception 'Yayımlanmış müşteri portalı sürümü değiştirilemez; yeni sürüm oluşturun';
  end if;

  if new.status = 'issued' and old.status = 'draft' then
    new.issued_at := now();
    new.issued_by := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_issued_product_portal_revision on public.product_portal_revisions;
create trigger guard_issued_product_portal_revision
  before update or delete on public.product_portal_revisions
  for each row execute function public.guard_issued_product_portal_revision();

alter table public.product_portal_revisions enable row level security;

create policy "product_portal_revisions_select" on public.product_portal_revisions
  for select to authenticated using (public.can_edit_product_portals());
create policy "product_portal_revisions_insert" on public.product_portal_revisions
  for insert to authenticated
  with check (public.can_edit_product_portals() and created_by = (select auth.uid()));
create policy "product_portal_revisions_update" on public.product_portal_revisions
  for update to authenticated
  using (public.can_edit_product_portals())
  with check (public.can_edit_product_portals());
create policy "product_portal_revisions_delete" on public.product_portal_revisions
  for delete to authenticated using (public.can_edit_product_portals());

alter table public.product_portals
  add constraint product_portals_current_revision_fk
  foreign key (current_revision_id)
  references public.product_portal_revisions(id)
  on delete set null;

-- ------------------------------------------------------------ fiziksel üniteler
create table if not exists public.crane_units (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.product_portals(id) on delete cascade,
  ordinal smallint not null check (ordinal > 0),
  suffix text not null default '' check (suffix = '' or suffix ~ '^[A-Z]+$'),
  -- Tam seri saklanır. Adet daha sonra değişse bile basılmış plaka sessizce
  -- yeniden adlandırılmaz.
  serial_no text not null check (length(btrim(serial_no)) between 1 and 80),
  -- QR'daki kalıcı, kısa kimlik. Sır değildir; parola ayrı kapıdır.
  public_code text not null unique check (public_code ~ '^[A-Z0-9]{16}$'),
  password_salt text not null default ''
    check (password_salt = '' or password_salt ~ '^[0-9a-f]{32}$'),
  password_hash text not null default ''
    check (password_hash = '' or password_hash ~ '^[0-9a-f]{128}$'),
  has_password boolean generated always as (password_hash <> '') stored,
  password_version integer not null default 0 check (password_version >= 0),
  password_changed_at timestamptz,
  portal_enabled boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portal_id, ordinal),
  unique (serial_no)
);

create index if not exists crane_units_portal_idx on public.crane_units(portal_id, ordinal);

alter table public.crane_units enable row level security;

create policy "crane_units_select" on public.crane_units
  for select to authenticated using (public.can_edit_product_portals());
create policy "crane_units_insert" on public.crane_units
  for insert to authenticated
  with check (public.can_edit_product_portals() and created_by = (select auth.uid()));
create policy "crane_units_update" on public.crane_units
  for update to authenticated
  using (public.can_edit_product_portals())
  with check (public.can_edit_product_portals());
create policy "crane_units_delete" on public.crane_units
  for delete to authenticated using (public.can_edit_product_portals());

-- Parola özeti de bir kimlik bilgisidir; normal authenticated SELECT'e
-- verilmez. Uygulama yalnız `has_password` bayrağını görür, doğrulamayı
-- server-only service role yapar.
revoke select on table public.crane_units from authenticated;
grant select (
  id, portal_id, ordinal, suffix, serial_no, public_code, has_password,
  password_version, password_changed_at, portal_enabled,
  created_by, updated_by, created_at, updated_at
) on table public.crane_units to authenticated;

drop trigger if exists touch_crane_units on public.crane_units;
create trigger touch_crane_units before update on public.crane_units
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------- yayımlanmış PDF snapshotı
create table if not exists public.product_portal_files (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.product_portal_revisions(id) on delete cascade,
  folder_key text not null check (folder_key ~ '^[a-z0-9-]{1,40}$'),
  folder_title text not null check (length(btrim(folder_title)) between 1 and 100),
  folder_sort integer not null default 0,
  file_sort integer not null default 0,
  display_name text not null check (length(btrim(display_name)) between 1 and 180),
  file_name text not null check (length(btrim(file_name)) between 1 and 180),
  source_kind text not null check (
    source_kind in ('report', 'equipment', 'manual', 'electrical', 'specification', 'drawing', 'custom')
  ),
  source_id text not null default '',
  source_revision_label text not null default '',
  access_mode text not null default 'view_watermarked'
    check (access_mode in ('view_watermarked', 'download')),
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check (size_bytes > 0),
  page_count integer not null default 0 check (page_count >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (revision_id, id)
);

create index if not exists product_portal_files_revision_idx
  on public.product_portal_files(revision_id, folder_sort, file_sort);

create or replace function public.guard_issued_product_portal_file()
returns trigger
language plpgsql
as $$
declare
  target_revision uuid;
begin
  target_revision := case when tg_op = 'DELETE' then old.revision_id else new.revision_id end;
  if exists (
    select 1 from public.product_portal_revisions r
    where r.id = target_revision and r.status = 'issued'
  ) then
    raise exception 'Yayımlanmış müşteri portalı dosyası değiştirilemez';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_issued_product_portal_file on public.product_portal_files;
create trigger guard_issued_product_portal_file
  before update or delete on public.product_portal_files
  for each row execute function public.guard_issued_product_portal_file();

alter table public.product_portal_files enable row level security;

create policy "product_portal_files_select" on public.product_portal_files
  for select to authenticated using (public.can_edit_product_portals());
create policy "product_portal_files_insert" on public.product_portal_files
  for insert to authenticated with check (public.can_edit_product_portals());
create policy "product_portal_files_update" on public.product_portal_files
  for update to authenticated
  using (public.can_edit_product_portals())
  with check (public.can_edit_product_portals());
create policy "product_portal_files_delete" on public.product_portal_files
  for delete to authenticated using (public.can_edit_product_portals());

-- -------------------------------------------------------- dış portal oturumları
-- Ham oturum anahtarı yalnız HttpOnly çerezde; tabloda SHA-256 özeti vardır.
-- Bu tablolara authenticated/anon politikası AÇILMAZ. Yalnız server-only
-- service-role DAL'i erişir.
create table if not exists public.product_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.crane_units(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  password_version integer not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now()
);

create index if not exists product_portal_sessions_active_idx
  on public.product_portal_sessions(token_hash, expires_at)
  where revoked_at is null;

alter table public.product_portal_sessions enable row level security;

create table if not exists public.product_portal_access_events (
  id bigint generated always as identity primary key,
  unit_id uuid references public.crane_units(id) on delete set null,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  user_agent_hash text not null check (user_agent_hash ~ '^[0-9a-f]{64}$'),
  result text not null check (
    result in ('success', 'invalid', 'rate_limited', 'logout', 'document_view', 'document_download')
  ),
  document_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists product_portal_access_events_lookup_idx
  on public.product_portal_access_events(code_hash, ip_hash, created_at desc);

alter table public.product_portal_access_events enable row level security;

-- Sunucusuz dağıtımda bellek içi sayaç güvenilir değildir. İki anahtar tutulur:
-- kod+IP için 5/15 dakika, portal geneli için 20/15 dakika. Ham kod/IP yoktur.
create table if not exists public.product_portal_login_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  locked_until timestamptz
);

alter table public.product_portal_login_buckets enable row level security;

create or replace function public.consume_product_portal_login_attempt(
  p_code_hash text,
  p_ip_hash text
)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_at timestamptz := clock_timestamp();
  client_key text := 'client:' || p_code_hash || ':' || p_ip_hash;
  portal_key text := 'portal:' || p_code_hash;
  client_row public.product_portal_login_buckets%rowtype;
  portal_row public.product_portal_login_buckets%rowtype;
  client_allowed boolean;
  portal_allowed boolean;
  retry_seconds integer := 0;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return query select false, 900;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(portal_key, 0));

  insert into public.product_portal_login_buckets(bucket_key)
  values (client_key), (portal_key)
  on conflict (bucket_key) do nothing;

  update public.product_portal_login_buckets
  set window_started_at = now_at,
      attempt_count = 0,
      locked_until = null
  where bucket_key in (client_key, portal_key)
    and window_started_at <= now_at - interval '15 minutes'
    and coalesce(locked_until, '-infinity'::timestamptz) <= now_at;

  select * into client_row from public.product_portal_login_buckets
  where bucket_key = client_key for update;
  select * into portal_row from public.product_portal_login_buckets
  where bucket_key = portal_key for update;

  client_allowed := coalesce(client_row.locked_until, '-infinity'::timestamptz) <= now_at
    and client_row.attempt_count < 5;
  portal_allowed := coalesce(portal_row.locked_until, '-infinity'::timestamptz) <= now_at
    and portal_row.attempt_count < 20;

  update public.product_portal_login_buckets
  set attempt_count = attempt_count + 1,
      locked_until = case
        when bucket_key = client_key and attempt_count + 1 >= 5 then now_at + interval '15 minutes'
        when bucket_key = portal_key and attempt_count + 1 >= 20 then now_at + interval '15 minutes'
        else locked_until
      end
  where bucket_key in (client_key, portal_key);

  if not client_allowed then
    retry_seconds := greatest(retry_seconds,
      extract(epoch from (coalesce(client_row.locked_until, now_at + interval '15 minutes') - now_at))::integer);
  end if;
  if not portal_allowed then
    retry_seconds := greatest(retry_seconds,
      extract(epoch from (coalesce(portal_row.locked_until, now_at + interval '15 minutes') - now_at))::integer);
  end if;

  return query select client_allowed and portal_allowed, greatest(0, retry_seconds);
end;
$$;

create or replace function public.reset_product_portal_login_attempt(
  p_code_hash text,
  p_ip_hash text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.product_portal_login_buckets
  where bucket_key = 'client:' || p_code_hash || ':' || p_ip_hash;
$$;

revoke all on function public.consume_product_portal_login_attempt(text, text) from public, anon, authenticated;
revoke all on function public.reset_product_portal_login_attempt(text, text) from public, anon, authenticated;
grant execute on function public.consume_product_portal_login_attempt(text, text) to service_role;
grant execute on function public.reset_product_portal_login_attempt(text, text) to service_role;

-- Yayımdan sonra pointer tek işlemde çevrilir. Dosyalar eksikse sürüm müşteri
-- yüzüne çıkamaz; storage/DB hazırlığı action tarafından önce tamamlanır.
create or replace function public.issue_product_portal_revision(
  p_revision_id uuid,
  p_expected_file_count integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  portal uuid;
  actual_count integer;
begin
  if not public.can_edit_product_portals() then
    raise exception 'Bu işlem için yetkiniz yok';
  end if;

  select portal_id into portal
  from public.product_portal_revisions
  where id = p_revision_id and status = 'draft'
  for update;
  if portal is null then
    raise exception 'Taslak portal sürümü bulunamadı';
  end if;

  select count(*) into actual_count
  from public.product_portal_files
  where revision_id = p_revision_id;
  if actual_count <> p_expected_file_count or actual_count < 1 then
    raise exception 'Portal dosya paketi eksik';
  end if;

  update public.product_portal_revisions
  set status = 'issued'
  where id = p_revision_id;

  update public.product_portals
  set current_revision_id = p_revision_id,
      updated_by = (select auth.uid())
  where id = portal;
end;
$$;

revoke all on function public.issue_product_portal_revision(uuid, integer) from public, anon;
grant execute on function public.issue_product_portal_revision(uuid, integer) to authenticated;

-- ------------------------------------------------------------ private bucket
insert into storage.buckets(id, name, public, file_size_limit)
values ('customer-portal', 'customer-portal', false, 104857600)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit;

create policy "customer-portal okuma" on storage.objects
  for select to authenticated
  using (bucket_id = 'customer-portal' and public.can_edit_product_portals());
create policy "customer-portal yükleme" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'customer-portal' and public.can_edit_product_portals());
create policy "customer-portal güncelleme" on storage.objects
  for update to authenticated
  using (bucket_id = 'customer-portal' and public.can_edit_product_portals())
  with check (bucket_id = 'customer-portal' and public.can_edit_product_portals());
create policy "customer-portal silme" on storage.objects
  for delete to authenticated
  using (bucket_id = 'customer-portal' and public.can_edit_product_portals());

comment on table public.product_portals is
  'Proje başına tek vinç kimliği ve ortak müşteri doküman paketi defteri.';
comment on table public.crane_units is
  'Fiziksel vinçler: ayrı seri, kalıcı QR kimliği ve parola; ortak portal sürümünü okurlar.';
comment on table public.product_portal_files is
  'Yayımlama anında private customer-portal kovasına dondurulan müşteri PDF snapshotları.';

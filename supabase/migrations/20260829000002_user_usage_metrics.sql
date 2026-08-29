-- Yönetim > Kullanıcılar > Profil için mahremiyet odaklı kullanım ölçümü.
--
-- TAM ADRES VE İÇERİK YOKTUR: kayıt kimliği, müşteri/personel/belge adı, arama
-- metni, form içeriği ve tuş bilgisi tutulmaz. İstemci adresi ana bölüme
-- indirger; veritabanı yalnız izin verilen bölüm anahtarını kabul eder.

create table public.user_usage_metrics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null,
  usage_date date not null,
  section text not null check (section in (
    'panel',
    'jobs',
    'offers',
    'engineering',
    'drawings',
    'purchasing',
    'catalog',
    'worklog',
    'sales',
    'personnel',
    'administration',
    'other'
  )),
  device_class text not null check (device_class in ('desktop', 'tablet', 'mobile')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  page_views integer not null default 0 check (page_views between 0 and 100000),
  primary key (user_id, session_id, usage_date, section)
);

comment on table public.user_usage_metrics is
  'Bölüm bazlı aktif süre ve sayfa geçişi. Tam adres, kayıt kimliği ve içerik tutmaz.';

create index user_usage_metrics_user_date_idx
  on public.user_usage_metrics (user_id, usage_date desc);
create index user_usage_metrics_last_seen_idx
  on public.user_usage_metrics (last_seen_at desc);

alter table public.user_usage_metrics enable row level security;

-- Kişi kendi ham özetini, Yönetici bütün kullanıcıların özetini okuyabilir.
-- Yazma doğrudan tabloya değil aşağıdaki dar RPC üzerinden yapılır.
create policy "usage_select_own_or_admin" on public.user_usage_metrics
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

revoke all on table public.user_usage_metrics from anon;
revoke insert, update, delete on table public.user_usage_metrics from authenticated;
grant select on table public.user_usage_metrics to authenticated;

create or replace function public.record_user_usage(
  p_session_id uuid,
  p_section text,
  p_active_seconds integer default 0,
  p_page_views integer default 0,
  p_device_class text default 'desktop'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
  v_usage_date date := (timezone('Europe/Istanbul', now()))::date;
  v_active_seconds integer := least(greatest(coalesce(p_active_seconds, 0), 0), 60);
  v_page_views integer := least(greatest(coalesce(p_page_views, 0), 0), 1);
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı';
  end if;
  if p_session_id is null then
    raise exception 'Oturum kimliği gerekli';
  end if;
  if p_section is null or p_section not in (
    'panel',
    'jobs',
    'offers',
    'engineering',
    'drawings',
    'purchasing',
    'catalog',
    'worklog',
    'sales',
    'personnel',
    'administration',
    'other'
  ) then
    raise exception 'Geçersiz kullanım bölümü';
  end if;
  if p_device_class is null or p_device_class not in ('desktop', 'tablet', 'mobile') then
    raise exception 'Geçersiz cihaz sınıfı';
  end if;

  insert into public.user_usage_metrics (
    user_id,
    session_id,
    usage_date,
    section,
    device_class,
    started_at,
    last_seen_at,
    active_seconds,
    page_views
  )
  values (
    v_user_id,
    p_session_id,
    v_usage_date,
    p_section,
    p_device_class,
    v_now,
    v_now,
    v_active_seconds,
    v_page_views
  )
  on conflict (user_id, session_id, usage_date, section) do update
  set
    device_class = excluded.device_class,
    last_seen_at = excluded.last_seen_at,
    active_seconds = least(
      public.user_usage_metrics.active_seconds + excluded.active_seconds,
      86400
    ),
    page_views = least(
      public.user_usage_metrics.page_views + excluded.page_views,
      100000
    );
end;
$$;

comment on function public.record_user_usage(uuid, text, integer, integer, text) is
  'Oturumdaki kullanıcı adına bölüm bazlı en çok 60 saniyelik kullanım darbesi yazar.';

revoke all on function public.record_user_usage(uuid, text, integer, integer, text) from public;
grant execute on function public.record_user_usage(uuid, text, integer, integer, text) to authenticated;

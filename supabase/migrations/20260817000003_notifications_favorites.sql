-- BİLDİRİMLER + İŞ FAVORİLERİ — kişiye giden defterler.
--
-- SİNYAL DEĞİL BİLDİRİM: panodaki sinyaller veriden türer ve sebebi kalkınca
-- kendiliğinden gider (lib/panel.ts kuralı); bildirim ise bir KİŞİYE yazılmış,
-- okunup kapanan bir KAYITTIR. Panonun "bildirim kutusu bilerek boştur" notu
-- tam bu defteri bekliyordu.
--
-- FAN-OUT SERVER ACTION'DADIR, TETİKLEYİCİDE DEĞİL: kimin bildirim alacağı
-- (favorileyenler ∪ açık görev sahipleri, anılanlar, atanan) bir ÜRÜN
-- kararıdır ve zamanla değişir; SQL'e gömmek her değişikliği migration yapardı
-- (sevk sonrası tamamlama kuralının gerekçesiyle aynı).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.profiles (id) on delete cascade,

  kind text not null,   -- gorev_atandi | bahsedildi | durum_degisti
  job_id uuid references public.jobs (id) on delete cascade,
  job_no text not null default '',

  -- Basılacak satırın kendisi ("0057 · Görev atandı: …") — okuma anında
  -- başka tablodan ad çözmek gerekmez; iş silinse de satır okunur kalır.
  title text not null,
  href text not null default '',

  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Zil sayacı yalnız OKUNMAMIŞI sorar; kısmi indeks tam onu sayar.
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

comment on table public.notifications is
  'Kişiye giden bildirim defteri. Fan-out server action''lardadır '
  '(lib/jobs/notify.ts kuralları); insert authenticated herkese açıktır — '
  'ekleyen BAŞKASININ satırını yazar (iç ağda kabul edilen güven modeli; '
  'daraltmak gerekirse security definer bir notify() fonksiyonuna taşınır).';

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_insert on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_insert on public.notifications
  for insert to authenticated with check (auth.uid() is not null);
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────── favoriler

create table if not exists public.job_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

comment on table public.job_favorites is
  'Kişinin yıldızladığı işler. Herkesin favorisi kendine özeldir; durum '
  'değişikliği bildirimi favorileyenlere gider.';

alter table public.job_favorites enable row level security;

drop policy if exists job_favorites_all on public.job_favorites;

create policy job_favorites_all on public.job_favorites
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- FAN-OUT GEÇİDİ — `drawing_purchase_summary` kalıbı (migration 20260812140000).
--
-- Favori satırları RLS ile SAHİBİNE kapalıdır; ama "durumu değişen işi kimler
-- favoriledi" sorusunu durumun DEĞİŞTİRENİ sormak zorundadır (bildirim
-- fan-out'u). Politikayı herkese açmak "herkesin favorisi kendine özeldir"
-- sözünü bozar; geçit ise adı tek tek yazılmış DAR bir projeksiyondur:
-- yalnız kimlik listesi döner — kim, ne zaman, başka hangi işleri
-- favoriledi geçmez. Güvenlik sınırı fonksiyonun dönüş listesidir.
create or replace function public.job_favorite_user_ids(p_job_id uuid)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select user_id from public.job_favorites where job_id = p_job_id
$$;

revoke all on function public.job_favorite_user_ids(uuid) from public;
grant execute on function public.job_favorite_user_ids(uuid) to authenticated;

-- KAYITLI GÖRÜNÜMLER — İşler sayfasının adlandırılmış adres fotoğrafları.
--
-- `config` SÜRÜMLÜ bir jsonb'dir ({v:1, view, yil, musteri, durum, q,
-- sirala, grup} — lib/jobs/view-state.ts şeması). Bilinmeyen alan okuma
-- anında sessizce düşer; şemadan geçmeyen kayıt uygulanmaz (configToState
-- null döner) — bozuk bir kayıt sayfayı düşüremez.
--
-- Görünüm KİŞİYE ÖZELDİR (RLS user_id kelepçesi) ve kullanıcı başına EN
-- FAZLA BİR varsayılan olabilir (kısmi tekil indeks): /jobs parametresiz
-- açıldığında o varsayılan uygulanır.

create table if not exists public.user_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_saved_views_user_idx
  on public.user_saved_views (user_id, sort);
create unique index if not exists user_saved_views_default_idx
  on public.user_saved_views (user_id) where is_default;

drop trigger if exists touch_user_saved_views on public.user_saved_views;
create trigger touch_user_saved_views before update on public.user_saved_views
  for each row execute function public.touch_updated_at();

comment on table public.user_saved_views is
  'İşler sayfasının kişiye özel kayıtlı görünümleri. config sürümlü jsonb '
  '(v:1); kullanıcı başına en fazla bir varsayılan (kısmi tekil indeks).';

alter table public.user_saved_views enable row level security;

drop policy if exists user_saved_views_all on public.user_saved_views;

create policy user_saved_views_all on public.user_saved_views
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

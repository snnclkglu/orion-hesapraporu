-- PANEL TERCİHLERİ — bölüm gizle/katla, KİŞİYE ÖZEL ve SUNUCUDA.
--
-- localStorage yeterli olurdu ama tercih CİHAZLAR ARASI olmalı (telefonda
-- gizlenen bölüm masaüstünde de gizli) — `user_saved_views` deseninin
-- (user_id + sürümlü jsonb config + RLS kelepçesi) birebir kopyası.
-- Config sözleşmesi `src/lib/panel-prefs.ts`tedir: {v:1, hidden:[],
-- collapsed:[]}; bilinmeyen alan sessizce düşer, bozuk kayıt varsayılana
-- döner (sayfayı asla düşürmez).

create table if not exists public.user_panel_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_user_panel_prefs on public.user_panel_prefs;
create trigger touch_user_panel_prefs before update on public.user_panel_prefs
  for each row execute function public.touch_updated_at();

comment on table public.user_panel_prefs is
  'Açılış panosu bölüm tercihleri (gizli/katlı). Kişiye özel; şeması '
  'src/lib/panel-prefs.ts''teki sürümlü config sözleşmesidir.';

alter table public.user_panel_prefs enable row level security;

drop policy if exists user_panel_prefs_all on public.user_panel_prefs;

create policy user_panel_prefs_all on public.user_panel_prefs
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

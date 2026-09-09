-- PANO AYARI ONAYDAN AYRILIR (PANO-34).
--
-- Bugüne kadar yükseklik/derinlik/baza seçimi yalnız İKİ yerde yaşıyordu:
-- adres çubuğunda (deneme) ve `switchboard_approvals.settings` içinde. Yani
-- "2000 mm istiyorum ama henüz onaylamıyorum" demek mümkün değildi; kullanıcı
-- bir ölçü seçip sayfayı yeniliyor ve seçimi sessizce kayboluyordu.
--
-- ONAY YİNE PARMAK İZİNE BAĞLIDIR (PANO-14): ayarı kaydetmek onaylamak
-- DEĞİLDİR. Ayar girdinin parçası olduğu için kaydedilen ayar parmak izini
-- değiştirir ve varsa onay kendiliğinden eskir — ekranda "onay eskidi" şeridi
-- çıkar. Bu istenen davranıştır: gövde ölçüsü değişmiş bir planı eski onayla
-- imalata göndermek, bu modülün baştan beri engellediği şeydir.
--
-- PLAN YİNE SAKLANMAZ. Burada duran şey plan değil, kullanıcının SİPARİŞ
-- TERCİHİDİR (`LayoutSettings`) — girdi sınıfındandır, çıktı değil.

create table if not exists public.switchboard_settings (
  id uuid primary key default gen_random_uuid(),
  -- Pano kararları gibi PROJEYE bağlanır, belgeye değil: rev3 → rev4 yeni bir
  -- `electrical_projects` satırıdır ve belgeye bağlansaydı çizim bürosunun her
  -- yeni sürümünde kullanıcının bütün ölçü tercihleri kaybolurdu.
  project_id uuid not null unique references public.projects(id) on delete cascade,
  -- `LayoutSettings` — iki dizinin tercihleri (`room`/`field`) ve paylar.
  -- Şema kısıtı YOKTUR ve olmamalıdır: alan eklendiğinde eski satır okunmaya
  -- devam etmeli, okuma tarafı zaten savunmacıdır (`lib/switchboard/settings.ts`).
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

comment on table public.switchboard_settings is
  'Pano yerleşiminin KAYDEDİLMİŞ sipariş tercihleri (LayoutSettings). Onaydan bağımsızdır; onay ayrı tablodadır ve parmak izine bağlıdır.';

alter table public.switchboard_settings enable row level security;

drop policy if exists "swb_settings_select" on public.switchboard_settings;
create policy "swb_settings_select" on public.switchboard_settings
  for select to authenticated using (true);
drop policy if exists "swb_settings_write" on public.switchboard_settings;
create policy "swb_settings_write" on public.switchboard_settings
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

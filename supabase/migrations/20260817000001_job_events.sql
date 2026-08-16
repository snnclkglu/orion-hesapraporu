-- İŞ OLAY AKIŞI — işin biyografisi: kim, ne zaman, ne yaptı.
--
-- `drawing_package_events` gerekçesinin birebiri (migration 20260810000003):
-- `audit_log` KULLANILMAZ — o tabloda `job_id` sütunu yoktur, iş olayları
-- `detail` jsonb içinde sorgulanamaz duruyordu ve hiçbir ekran onları
-- okuyamıyordu. İş detayının "Akış" sekmesi bu tabloyu zaman çizelgesi olarak
-- okur. `audit_log` yazımları KALDIRILMADI: o defter yöneticinin denetim
-- sorusunu cevaplamaya devam eder; bu tablo işin KENDİ sayfasının sorusudur.
--
-- Geriye doldurma YAPILMADI (bilinçli): eski olaylar audit_log.detail jsonb
-- içinde job_id anahtarıyla gömülü ve güvenilir biçimde ayıklanamaz; akış
-- bu migration'dan sonraki değişikliklerle dolar.

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),

  -- `on delete cascade` DEĞİL `set null`: iş silindiğinde "silindi" olayı
  -- kalmalıdır, yoksa silme kaydı kendi kendini yok eder.
  job_id uuid references public.jobs (id) on delete set null,

  -- Silinmiş bir işin olayı hâlâ okunabilsin diye numara da KOPYALANIR.
  job_no text not null default '',

  event text not null,     -- olusturuldu | guncellendi | durum | durum_oto
                           -- | silindi | gorev_acildi | gorev_kapandi
                           -- | gorev_atandi | yorum | carpan
  detail jsonb not null default '{}'::jsonb,

  actor uuid references public.profiles (id),
  at timestamptz not null default now()
);

create index if not exists job_events_job_idx on public.job_events (job_id, at desc);
create index if not exists job_events_at_idx on public.job_events (at desc);

comment on table public.job_events is
  'İşin biyografisi. audit_log KULLANILMAZ: orada job_id sütunu yok ve iş '
  'olayları detail jsonb içinde sorgulanamıyordu. job_id set null taşır ki '
  '"silindi" olayı silmeden sağ çıksın; job_no o yüzden kopyalanır.';

-- Denetim kaydı EKLENİR, DEĞİŞTİRİLMEZ, SİLİNMEZ (audit_log ile aynı ruh).
-- Okuma ve ekleme oturumlu herkese: /jobs bölümü herkese açıktır
-- (roles.ts, kime: "Herkes") ve durumu değiştirebilen herkes olayını da
-- yazabilmelidir — daha dar bir insert kapısı olay yazımını sessizce düşürür,
-- akış eksik kalırdı.
alter table public.job_events enable row level security;

drop policy if exists job_events_select on public.job_events;
drop policy if exists job_events_insert on public.job_events;

create policy job_events_select on public.job_events
  for select to authenticated using (true);
create policy job_events_insert on public.job_events
  for insert to authenticated with check (auth.uid() is not null);

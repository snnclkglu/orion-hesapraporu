-- BÖLÜMÜN ADI "FİNANS" DEĞİL "PERSONEL" (kullanıcı kararı, 12.08.2026).
--
-- Gerekçe kullanıcının kendi cümlesi: "Finans'ta farklı şeyler yaparız. Bu
-- bölüm tamamen Personel'le ilgili oldu." Yani `/finance` adresi ve `fin_`
-- öneki İLERİDE AÇILACAK gerçek finans bölümü için serbest bırakılır. Ad
-- yalnız ekranda değiştirilseydi, o gün gelen bölüm `fin_payroll` ile
-- `fin_cari` yan yana durur ve hangisinin hangi bölüme ait olduğu okunmazdı.
--
-- DÖVİZ KURU İKİSİNE DE AİT DEĞİLDİR. `fin_fx_*` → `fx_*`: kur ne personel
-- verisidir ne de bir bölümün malı; kamuya açık REFERANS veridir ve bugün
-- Satış Takibi de sözleşme kuruna bakıyor. Bölüm önekiyle işaretlemek onu
-- yanlış eve koyardı.
--
-- `alter table ... rename` veriyi, RLS politikalarını, indeksleri, yabancı
-- anahtarları ve tetikleyicileri OLDUĞU GİBİ taşır — yeniden oluşturma yok,
-- veri kaybı yok.

-- ═══════════════════════════════════════════════════════════════ tablolar

alter table if exists public.fin_employees          rename to hr_employees;
alter table if exists public.fin_employment         rename to hr_employment;
alter table if exists public.fin_employee_documents rename to hr_employee_documents;
alter table if exists public.fin_periods            rename to hr_periods;
alter table if exists public.fin_payroll            rename to hr_payroll;
alter table if exists public.fin_per_diem           rename to hr_per_diem;
alter table if exists public.fin_fx_daily           rename to fx_rate_daily;

drop view if exists public.fin_fx_monthly;

-- ═══════════════════════════════════════════════════════════ yetki soruları

create or replace function public.can_see_personnel()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'manager')
  );
$$;

create or replace function public.can_edit_personnel()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_see_personnel();
$$;

comment on function public.can_see_personnel() is
  'Personel bölümü (künye, özlük dosyası, maaş, bordro, harcirah): Yönetici + Müdür. TS ikizi lib/roles.ts → canSeePersonnel.';
comment on function public.can_edit_personnel() is
  'Personel kaydı yazma. TS ikizi lib/roles.ts → canEditPersonnel.';

-- Politikalar eski fonksiyonu çağırıyor; yeni ada geçirilir.
do $$
declare
  t text;
begin
  foreach t in array array[
    'hr_employees', 'hr_employment', 'hr_employee_documents',
    'hr_periods', 'hr_payroll', 'hr_per_diem'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', replace(t, 'hr_', 'fin_') || '_select', t);
    execute format('drop policy if exists %I on public.%I', replace(t, 'hr_', 'fin_') || '_insert', t);
    execute format('drop policy if exists %I on public.%I', replace(t, 'hr_', 'fin_') || '_update', t);
    execute format('drop policy if exists %I on public.%I', replace(t, 'hr_', 'fin_') || '_delete', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (public.can_see_personnel())', t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check (public.can_edit_personnel())', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (public.can_edit_personnel()) with check (public.can_edit_personnel())',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using (public.can_edit_personnel())', t || '_delete', t);
  end loop;
end $$;

-- Kur: okuma herkese açık (kamuya açık piyasa verisi), yazma personelde.
drop policy if exists fin_fx_daily_select on public.fx_rate_daily;
drop policy if exists fin_fx_daily_write  on public.fx_rate_daily;
drop policy if exists fx_rate_daily_select on public.fx_rate_daily;
drop policy if exists fx_rate_daily_write  on public.fx_rate_daily;

create policy fx_rate_daily_select on public.fx_rate_daily
  for select to authenticated using (true);
create policy fx_rate_daily_write on public.fx_rate_daily
  for all to authenticated
  using (public.can_edit_personnel())
  with check (public.can_edit_personnel());

create or replace view public.fx_rate_monthly
with (security_invoker = true) as
select
  date_trunc('month', rate_date)::date               as period,
  round(avg(eur_try), 4)                             as eur_try,
  round(avg(usd_try), 4)                             as usd_try,
  round(avg(eur_try / usd_try), 6)                   as eur_usd,
  round(avg(usd_try / eur_try), 6)                   as usd_eur,
  count(*)::int                                      as day_count,
  min(rate_date)                                     as first_day,
  max(rate_date)                                     as last_day,
  array_agg(distinct source order by source)         as sources
from public.fx_rate_daily
group by 1;

comment on view public.fx_rate_monthly is
  'Aylık ortalama kurlar. Parite GÜN GÜN hesaplanıp ortalanır — ortalamaların oranı DEĞİLDİR.';

-- Depo: bucket adı `personnel` zaten doğruydu; politikalar yeni fonksiyona geçer.
drop policy if exists "personnel okuma (finans)" on storage.objects;
drop policy if exists "personnel yükleme (finans)" on storage.objects;
drop policy if exists "personnel güncelleme (finans)" on storage.objects;
drop policy if exists "personnel silme (finans)" on storage.objects;

drop policy if exists "personnel okuma" on storage.objects;
create policy "personnel okuma" on storage.objects
  for select to authenticated
  using (bucket_id = 'personnel' and public.can_see_personnel());

drop policy if exists "personnel yükleme" on storage.objects;
create policy "personnel yükleme" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'personnel' and public.can_edit_personnel());

drop policy if exists "personnel güncelleme" on storage.objects;
create policy "personnel güncelleme" on storage.objects
  for update to authenticated
  using (bucket_id = 'personnel' and public.can_edit_personnel())
  with check (bucket_id = 'personnel' and public.can_edit_personnel());

drop policy if exists "personnel silme" on storage.objects;
create policy "personnel silme" on storage.objects
  for delete to authenticated
  using (bucket_id = 'personnel' and public.can_edit_personnel());

-- Dönem tetikleyicisi de yeni tabloyu yazar.
create or replace function public.hr_ensure_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hr_periods (period) values (new.period)
  on conflict (period) do nothing;
  return new;
end;
$$;

drop trigger if exists fin_payroll_period_guard on public.hr_payroll;
drop trigger if exists hr_payroll_period_guard on public.hr_payroll;
create trigger hr_payroll_period_guard before insert on public.hr_payroll
  for each row execute function public.hr_ensure_period();

drop function if exists public.fin_ensure_period();
drop function if exists public.can_see_finance();
drop function if exists public.can_edit_finance();

-- ═══════════════════════════════════════════════ 1. BORDRO PARAMETRELERİ

-- YASAL PARAMETRELER KODA GÖMÜLMEZ, VERİDİR.
--
-- Asgari ücret, SGK tavanı, vergi dilimleri ve istisnalar HER YIL (bazen yılda
-- iki kez) değişir. Koda yazılsaydı her ocak ayında bir dağıtım gerekirdi ve
-- eski bir bordroyu yeniden basmak onu YENİ oranlarla basardı — geçmiş bordro
-- değişmemelidir.
--
-- Satır YIL BAŞINADIR ve `valid_from` ile açılır: temmuz ara zammı gelirse
-- aynı yıla ikinci bir satır eklenir, eskisi silinmez.
create table if not exists public.hr_payroll_params (
  valid_from date primary key,
  label text not null default '',

  -- Asgari ücret (aylık brüt) — istisnaların dayanağı.
  min_wage_gross numeric(14, 2) not null,
  -- SGK primine esas kazanç ÜST sınırı (brüt asgarinin 9 katı).
  sgk_ceiling numeric(14, 2) not null,

  -- İşçi payı oranları.
  sgk_employee_rate numeric(6, 5) not null default 0.14,
  unemployment_employee_rate numeric(6, 5) not null default 0.01,
  -- İşveren payı — bordroda bilgi olarak basılır, netten düşülmez.
  sgk_employer_rate numeric(6, 5) not null default 0.2075,
  unemployment_employer_rate numeric(6, 5) not null default 0.02,

  stamp_tax_rate numeric(8, 7) not null default 0.00759,

  -- Gelir vergisi dilimleri: [{ustSinir, oran}] — son dilimin üst sınırı null.
  income_tax_brackets jsonb not null,

  -- Asgari ücret istisnaları (aylık): gelir vergisi ve damga vergisinin
  -- asgari ücrete isabet eden kısmı çalışandan KESİLMEZ.
  income_tax_exemption numeric(14, 2) not null,
  stamp_tax_exemption numeric(14, 2) not null,

  -- Kaynak ve doğrulama durumu: sayı nereden geldi, teyit edildi mi?
  source text not null default '',
  verified boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hr_payroll_params enable row level security;

drop policy if exists hr_payroll_params_select on public.hr_payroll_params;
create policy hr_payroll_params_select on public.hr_payroll_params
  for select to authenticated using (public.can_see_personnel());
drop policy if exists hr_payroll_params_write on public.hr_payroll_params;
create policy hr_payroll_params_write on public.hr_payroll_params
  for all to authenticated
  using (public.can_edit_personnel()) with check (public.can_edit_personnel());

drop trigger if exists touch_hr_payroll_params on public.hr_payroll_params;
create trigger touch_hr_payroll_params before update on public.hr_payroll_params
  for each row execute function public.touch_updated_at();

-- 2026 parametreleri.
--
-- Brüt asgari 33.030,00 · net 28.075,50 · günlük brüt 1.101,00
-- SGK tavanı 297.270,00 (brüt asgarinin 9 katı)
-- Gelir vergisi istisnası 4.211,33 = (33.030 − %14 − %1) × %15
-- Damga vergisi istisnası    250,70 = 33.030 × 0,00759
--
-- İç tutarlılık sınandı: 33.030 − 4.624,20 − 330,30 − 0 − 0 = 28.075,50 ✓
-- yani yayımlanan net asgari ücretle birebir örtüşüyor. `verified` bu yüzden
-- true; yine de ekranda kaynak ve tarih görünür ve yönetici düzeltebilir.
insert into public.hr_payroll_params (
  valid_from, label, min_wage_gross, sgk_ceiling,
  income_tax_brackets, income_tax_exemption, stamp_tax_exemption, source, verified
) values (
  '2026-01-01', '2026',
  33030.00, 297270.00,
  '[{"ust": 190000, "oran": 0.15},
    {"ust": 400000, "oran": 0.20},
    {"ust": 1500000, "oran": 0.27},
    {"ust": 5300000, "oran": 0.35},
    {"ust": null, "oran": 0.40}]'::jsonb,
  4211.33, 250.70,
  'Asgari Ücret Tespit Komisyonu 2026 kararı + GİB gelir vergisi tarifesi', true
)
on conflict (valid_from) do nothing;

-- ══════════════════════════════════ 2. BORDRO ALANLARI (kümülatif matrah)

-- Kümülatif gelir vergisi matrahı BORDRONUN ZORUNLU ALANIDIR: gelir vergisi
-- dilimi yılbaşından beri biriken matraha göre yükselir. Satırda saklanır
-- çünkü hesaplandığı ANDAKİ değerdir — geçmiş bir bordro yeniden basıldığında
-- aynı sayıyı vermelidir.
alter table public.hr_payroll add column if not exists cumulative_tax_base numeric(14, 2);
alter table public.hr_payroll add column if not exists worked_days int not null default 30;
-- Bordronun dayandığı parametre satırı: hangi yılın oranlarıyla hesaplandı?
alter table public.hr_payroll add column if not exists params_valid_from date;

comment on column public.hr_payroll.cumulative_tax_base is
  'Yılbaşından bu döneme kadar biriken gelir vergisi matrahı (bu dönem DÂHİL). Vergi dilimi buradan okunur.';
comment on column public.hr_payroll.worked_days is
  'SGK gün sayısı. Tam ay 30''dur; giriş/çıkış ayında ve ücretsiz izinde düşer.';

comment on table public.hr_employees is
  'Personel künyesi. Giriş/çıkış tarihleri BURADA DEĞİL hr_employment''dadır — bir kişi birden çok kez çalışabilir.';
comment on table public.hr_payroll is
  'Kişi × ay maaş satırı. overtime_amount TÜRETİLMİŞTİR (4857 md. 41; net/225 × (s50×1,5 + s100×2)).';
comment on table public.fx_rate_daily is
  'Günlük döviz kuru gözlemi (TCMB döviz alış; ulaşılamayan günde ECB). Bölüme ait DEĞİLDİR, referans veridir.';

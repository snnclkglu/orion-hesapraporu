-- FİNANS bölümü: personel künyesi, özlük dosyaları, maaş/fazla mesai, harcirah
-- ve aylık ortalama döviz kurları.
--
-- YETKİ: Yönetici (admin) + Müdür (manager). Karşılığı `can_see_finance()` /
-- `can_edit_finance()`; `can_see_sales()` ve `can_see_work_log()` ile AYNI rol
-- kümesini sorar ama AYRI fonksiyonlardır — üç bölümün yetkisi ileride
-- ayrışabilir ve o gün tek satır değişmesi yeter.
--
-- BU BÖLÜM KİŞİSEL VERİ TAŞIR (TC kimlik no, doğum tarihi, IBAN, sağlık
-- raporu). Bu, yetki TANIMINI değil DEPO POLİTİKASI DÜZEYİNİ belirler:
-- `personnel` bucket'ı `reports`/`contracts` gibi "authenticated okur" DEĞİL,
-- `drawings` gibi FONKSİYONLA KISILMIŞTIR. Gerekçe: imzalı bağlantı
-- (`createSignedUrl`) uygulama katmanındaki rol kontrolünü TAŞIMAZ; gevşek bir
-- politikada oturumu olan her kullanıcı yolu bilirse özlük dosyasını açardı.

-- ═══════════════════════════════════════════════════════════ yetki soruları

create or replace function public.can_see_finance()
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

comment on function public.can_see_finance() is
  'Finans bölümü (personel, maaş, özlük dosyası, harcirah): Yönetici + Müdür. TS ikizi lib/roles.ts → canSeeFinance.';

-- Yazma bugün görmeyle AYNI kümedir ama AYRI bir sorudur (`can_edit_purchasing`
-- ile aynı gerekçe): "müdür görür, yalnız yönetici yazar" ayrımı istenirse tek
-- fonksiyon değişir, politikalar değişmez.
create or replace function public.can_edit_finance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_see_finance();
$$;

comment on function public.can_edit_finance() is
  'Finans kaydı yazma. TS ikizi lib/roles.ts → canEditFinance.';

-- ═════════════════════════════════════════════════════════════════ personel

-- ÇALIŞMA DÖNEMİ AYRI BİR TABLODUR (`fin_employment`), giriş/çıkış tarihi
-- personel satırında DEĞİLDİR. Gerekçe devralınan veriden çıktı: FURKAN
-- AYTEKİN aynı TC ile İKİ KEZ çalışmış (2025-01-03 → 2025-04-16 ve
-- 2026-03-09 → 2026-06-18). Tarihler künyede olsaydı ya kişi iki kez
-- açılacaktı (aynı TC, aynı telefon — liste ikizlenir, kıdem bölünür) ya da
-- ilk dönem kaybolacaktı.
create table if not exists public.fin_employees (
  id uuid primary key default gen_random_uuid(),

  -- AD BÜYÜK HARFLE SAKLANIR (AGENTS IS-14): dönüşüm `adBuyuk` ile hem
  -- kullanıcı yazarken hem Zod şemasında yapılır.
  full_name text not null,
  -- Sicil no — firma içi numara. Serbest metindir ve BOŞ OLABİLİR: devralınan
  -- kayıtta yoktu, sonradan verilecek.
  employee_no text not null default '',
  -- '01 - ÜST YÖNETİM' | '02 - ALT YÖNETİM' | '03 - PERSONEL'.
  -- ENUM DEĞİL METİN: kategori firma iç sınıflandırmasıdır ve dördüncüsü bir
  -- migration beklememelidir (`work_categories` ile aynı gerekçe).
  category text not null default '03 - PERSONEL',
  title text not null default '',
  department text not null default '',

  -- KİMLİK. `national_id` TEKİLDİR ama yalnız DOLU olduğunda: devralınan
  -- kayıtta üç kişinin numarası yok (yabancı uyruklu / eksik giriş) ve
  -- zorunlu kılmak onları aktarılamaz yapardı.
  national_id text,
  birth_date date,
  birth_place text not null default '',
  gender text check (gender is null or gender in ('kadin', 'erkek')),
  marital_status text check (marital_status is null or marital_status in ('bekar', 'evli')),
  child_count int not null default 0 check (child_count >= 0),
  blood_type text not null default '',
  education text,
  military_status text not null default '',
  disability_degree int check (disability_degree is null or disability_degree between 1 and 3),

  -- İLETİŞİM
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  city text not null default '',
  emergency_contact text not null default '',
  emergency_phone text not null default '',

  -- İSTİHDAM
  contract_type text not null default 'belirsiz',
  work_mode text not null default 'tam',
  sgk_no text not null default '',
  annual_leave_days int not null default 14 check (annual_leave_days >= 0),

  -- BANKA. IBAN doğrulanmaz, biçimlenir: yanlış IBAN'ı reddetmek yerine
  -- görünür kılmak yeterli (ödeme zaten bankada takılır).
  bank_name text not null default '',
  iban text not null default '',

  notes text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create unique index if not exists fin_employees_national_id_key
  on public.fin_employees (national_id)
  where national_id is not null and national_id <> '';

create index if not exists fin_employees_name_idx on public.fin_employees (full_name);
create index if not exists fin_employees_category_idx on public.fin_employees (category);

-- ÇALIŞMA DÖNEMLERİ. Bir kişinin birden çok dönemi olabilir; `end_date` boşsa
-- dönem AÇIKTIR (kişi bugün çalışıyor). Aynı anda iki açık dönem olamaz —
-- kısıt aşağıdaki kısmi tekil indekstedir.
create table if not exists public.fin_employment (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.fin_employees (id) on delete cascade,
  start_date date not null,
  end_date date,
  exit_reason text,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fin_employment_order check (end_date is null or end_date >= start_date)
);

create index if not exists fin_employment_employee_idx
  on public.fin_employment (employee_id, start_date desc);

-- Bir kişinin AÇIK dönemi en fazla bir tanedir.
create unique index if not exists fin_employment_open_key
  on public.fin_employment (employee_id)
  where end_date is null;

-- ══════════════════════════════════════════════════════════ özlük dosyaları

-- BAYTLAR TABLODA DEĞİL DEPODADIR (`personnel` bucket'ı). `page_count`
-- BEYAN DEĞİL ÖLÇÜMDÜR: sunucu PDF'i geri indirip pdf-lib ile sayar
-- (`equipment_attachments` ile aynı kural). Açılamayan dosya kayda GİRMEZ.
create table if not exists public.fin_employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.fin_employees (id) on delete cascade,
  kind text not null default 'diger',
  title text not null default '',
  file_name text not null default '',
  -- Depodaki tam yol: `<employee_id>/<document_id>.<uzanti>`
  storage_path text not null,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  page_count int not null default 0,

  issued_on date,
  -- SÜRELİ BELGELER: İSG eğitimi (6331 md. 17), periyodik sağlık muayenesi
  -- (ROL-15), operatör belgesi, kaynakçı sertifikası. Süresi dolan belge
  -- ENGELLEYİCİ DEĞİL bir HATIRLATMAdır.
  expires_on date,

  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index if not exists fin_employee_documents_employee_idx
  on public.fin_employee_documents (employee_id, kind, created_at desc);

-- Süresi yaklaşan/geçmiş belgeleri tek taramada bulmak için.
create index if not exists fin_employee_documents_expiry_idx
  on public.fin_employee_documents (expires_on)
  where expires_on is not null;

-- ═══════════════════════════════════════════════════════════════════ dönem

-- BİR DÖNEM = BİR AY. Ayın ilk günüyle anahtarlanır.
--
-- `eur_try_rate` BU AYIN ÖDEME KURUDUR ve satırın KENDİNDE durur — merkezî kur
-- tablosundan okunsaydı, kur tablosu her tazelendiğinde GEÇMİŞ ayların avro
-- karşılığı da değişirdi (Satış Takibi'ndeki `job_item_sales.fx_rate` ile
-- birebir aynı gerekçe, AGENTS SATIS-16).
--
-- Devralınan 27 ay Excel'deki kurla aktarıldı ve o kurlar AYLIK ORTALAMA
-- DEĞİLDİR (ay sonu/ödeme günü spot kuru; 2025 Mart'ta fark %7,8). Yeni aylar
-- `fin_fx_monthly` ortalamasından ÖNERİLİR ama kullanıcı değiştirebilir ve
-- yazıldıktan sonra donar.
--
-- `leave_hours` / `report_hours` AY DÜZEYİNDEDİR, kişi başına değil: firma
-- bugün de öyle tutuyor (Excel "Aylık Çalışma Saatleri" sayfası). Kişi bazlı
-- izin takibi ayrı bir fazdır; bugün uydurulmuş bir dağıtım yazmak veriyi
-- olduğundan kesin gösterirdi.
create table if not exists public.fin_periods (
  period date primary key,
  eur_try_rate numeric(14, 4) check (eur_try_rate is null or eur_try_rate > 0),
  usd_try_rate numeric(14, 4) check (usd_try_rate is null or usd_try_rate > 0),
  leave_hours numeric(10, 2) not null default 0 check (leave_hours >= 0),
  report_hours numeric(10, 2) not null default 0 check (report_hours >= 0),
  -- Dönem kapandı mı? Kapalı dönemde maaş satırı düzenlenmesi UYARIYLA
  -- yapılır (engellenmez — geçmişe dönük düzeltme meşru bir iştir).
  closed boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fin_periods_month check (extract(day from period) = 1)
);

-- ═══════════════════════════════════════════════════════════════════ maaş

-- BİR SATIR = BİR KİŞİ × BİR AY.
create table if not exists public.fin_payroll (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.fin_employees (id) on delete cascade,
  period date not null,

  -- NET MAAŞ firmanın bugün tuttuğu tek maaş büyüklüğüdür.
  net_salary numeric(14, 2) not null default 0 check (net_salary >= 0),

  overtime_hours_50 numeric(8, 2) not null default 0 check (overtime_hours_50 >= 0),
  overtime_hours_100 numeric(8, 2) not null default 0 check (overtime_hours_100 >= 0),

  -- TUTAR TÜRETİLİR (AGENTS SATIS-16). Bağıntı 4857 md. 41'dir ve devralınan
  -- Excel'in 566 satırının TAMAMINDA sıfır sapmayla doğrulandı:
  --     net / 225 × (saat50 × 1,5 + saat100 × 2)
  -- Elle girilen bir tutar saatlerle çelişebilirdi. TS ikizi
  -- `lib/finance/payroll.ts → fazlaMesaiTutari`; ikisinin ayrışmasını
  -- `__tests__/payroll.test.ts` engeller.
  overtime_amount numeric(14, 2)
    generated always as (
      round(
        (net_salary / 225.0) *
        (overtime_hours_50 * 1.5 + overtime_hours_100 * 2.0),
        2
      )
    ) stored,

  -- BORDRO ALTYAPISI. Bugün hiçbiri zorunlu değil ve hiçbiri HESAPLANMIYOR:
  -- yasal brüt→net dönüşümü (SGK matrahı, kümülatif gelir vergisi dilimi,
  -- asgari ücret istisnası, AGİ) bir sonraki fazdır ve şubat/temmuz
  -- güncellemeleriyle her yıl değişir. Alanlar BUGÜN muhasebeden gelen
  -- rakamın SAKLANMASI ve bordroya BASILMASI için var — uydurulmuş bir
  -- hesap yerine gerçek veri.
  gross_salary numeric(14, 2) check (gross_salary is null or gross_salary >= 0),
  sgk_employee numeric(14, 2),
  sgk_employer numeric(14, 2),
  unemployment_employee numeric(14, 2),
  income_tax numeric(14, 2),
  stamp_tax numeric(14, 2),

  bonus numeric(14, 2) not null default 0,
  per_diem numeric(14, 2) not null default 0,
  advance numeric(14, 2) not null default 0,
  deduction numeric(14, 2) not null default 0,

  paid_on date,
  note text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),

  constraint fin_payroll_month check (extract(day from period) = 1),
  constraint fin_payroll_unique unique (employee_id, period)
);

create index if not exists fin_payroll_period_idx on public.fin_payroll (period desc);
create index if not exists fin_payroll_employee_idx on public.fin_payroll (employee_id, period desc);

-- Maaş satırı yazılınca dönem kaydı KENDİLİĞİNDEN doğar: kur ve izin saatleri
-- sonradan girilebilsin diye. Tetikleyici olmasaydı "dönem yok" hatası
-- kullanıcıya iki adım yaptırırdı.
create or replace function public.fin_ensure_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fin_periods (period) values (new.period)
  on conflict (period) do nothing;
  return new;
end;
$$;

drop trigger if exists fin_payroll_period_guard on public.fin_payroll;
create trigger fin_payroll_period_guard before insert on public.fin_payroll
  for each row execute function public.fin_ensure_period();

-- ═════════════════════════════════════════════════════════════════ harcirah

-- YURTİÇİ HARCİRAH TARİFESİ — dönem × personel sınıfı × günlük ücret.
-- Tarife bir GEÇMİŞTİR: eski dönemin ücreti silinmez, yenisi eklenir
-- (`valid_from`). Böylece geçmiş bir sahaya bakıldığında o günkü tarife
-- görünür.
create table if not exists public.fin_per_diem (
  id uuid primary key default gen_random_uuid(),
  valid_from date not null,
  period_label text not null default '',
  role_label text not null,
  daily_try numeric(12, 2) not null check (daily_try >= 0),
  sort int not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_per_diem_valid_idx on public.fin_per_diem (valid_from desc, sort);

-- ═══════════════════════════════════════════════════════════════ döviz kuru

-- GÜNLÜK GÖZLEM. Aylık ortalama BURADAN TÜRETİLİR (`fin_fx_monthly` view'ı) —
-- ortalamayı ayrıca saklamak iki kaynak üretirdi ve ay içindeki bir düzeltme
-- ikisini ayrıştırırdı.
--
-- ANAHTAR YALNIZ GÜNDÜR, kaynak DEĞİL: bir güne iki kaynaktan iki kur
-- yazılsaydı o gün ortalamaya İKİ KEZ girerdi. `source` o günün NEREDEN
-- geldiğini söyler; TCMB'ye ulaşılamayan gün ECB'den (Frankfurter) tamamlanır
-- ve ay künyesinde iki kaynak birden görünür.
create table if not exists public.fin_fx_daily (
  rate_date date primary key,
  source text not null default 'TCMB' check (source in ('TCMB', 'ECB')),
  -- TCMB'de DÖVİZ ALIŞ; ECB'de tek referans kuru.
  usd_try numeric(14, 6) not null check (usd_try > 0),
  eur_try numeric(14, 6) not null check (eur_try > 0),
  -- TCMB döviz SATIŞ. ECB satırlarında NULL'dur — orada satış diye bir şey
  -- yoktur ve alışı satış diye yazmak uydurmak olurdu.
  usd_try_selling numeric(14, 6) check (usd_try_selling is null or usd_try_selling > 0),
  eur_try_selling numeric(14, 6) check (eur_try_selling is null or eur_try_selling > 0),
  fetched_at timestamptz not null default now()
);

-- AY İNDEKSİ YOKTUR ve bu bilinçlidir. `date_trunc('month', <date>)` üzerinde
-- indeks kurulamaz (Postgres onu IMMUTABLE saymaz — `timestamptz` aşırı
-- yüklemesi saat dilimine bağlıdır) ve gerekli de değildir: tablo yılda ~250
-- satır büyür, birincil anahtar zaten tarih sıralıdır ve aylık gruplama tam
-- taramayla mikrosaniyeler sürer.

-- AYLIK ORTALAMA — bir VIEW, bir tablo değil.
--
-- PARİTE GÜN GÜN HESAPLANIR: avg(EUR/USD) ≠ avg(EUR/TRY) / avg(USD/TRY).
-- İkincisi yanlıştır; parite her gün ölçülen bir büyüklüktür ve ortalaması
-- alınacak olan odur.
--
-- `security_invoker = true`: view'ın kendi RLS'i yoktur, ALTTAKİ tablonun
-- politikası uygulanır. Olmasaydı view sahibinin (postgres) yetkisiyle
-- çalışır ve RLS'i sessizce delerdi.
create or replace view public.fin_fx_monthly
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
from public.fin_fx_daily
group by 1;

comment on view public.fin_fx_monthly is
  'Aylık ortalama kurlar. Parite GÜN GÜN hesaplanıp ortalanır — ortalamaların oranı DEĞİLDİR.';

-- ═══════════════════════════════════════════════════════════════ updated_at

do $$
declare
  t text;
begin
  foreach t in array array[
    'fin_employees', 'fin_employment', 'fin_periods', 'fin_payroll', 'fin_per_diem'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'touch_' || t, t);
    execute format(
      'create trigger %I before update on public.%I '
      'for each row execute function public.touch_updated_at()', 'touch_' || t, t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════ RLS
--
-- Satış Takibi ve İş Takibi ile aynı düzen: "authenticated okuma" YOK. Okuma
-- da yazma da yetki sorusunu geçer.

alter table public.fin_employees          enable row level security;
alter table public.fin_employment         enable row level security;
alter table public.fin_employee_documents enable row level security;
alter table public.fin_periods            enable row level security;
alter table public.fin_payroll            enable row level security;
alter table public.fin_per_diem           enable row level security;
alter table public.fin_fx_daily           enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'fin_employees', 'fin_employment', 'fin_employee_documents',
    'fin_periods', 'fin_payroll', 'fin_per_diem'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (public.can_see_finance())', t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check (public.can_edit_finance())', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (public.can_edit_finance()) with check (public.can_edit_finance())',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using (public.can_edit_finance())', t || '_delete', t);
  end loop;
end $$;

-- KUR TABLOSU AYRIDIR VE OKUMASI HERKESE AÇIKTIR.
--
-- İçerik firma sırrı değil KAMUYA AÇIK PİYASA VERİSİdir (TCMB bülteni). Finans
-- yetkisine kısmak hiçbir şeyi korumaz, buna karşılık bugün Satış Takibi'nde
-- sözleşme kuru ELLE giriliyor (AGENTS SATIS-16: "kur satırın kendindedir") ve o
-- alana "bu ayın ortalaması" önerisi koymak yarın yetki değişikliği
-- gerektirmemelidir. YAZMA finanstadır: rakamı yalnız tazeleme yolu yazar.
drop policy if exists fin_fx_daily_select on public.fin_fx_daily;
create policy fin_fx_daily_select on public.fin_fx_daily
  for select to authenticated using (true);

drop policy if exists fin_fx_daily_write on public.fin_fx_daily;
create policy fin_fx_daily_write on public.fin_fx_daily
  for all to authenticated
  using (public.can_edit_finance())
  with check (public.can_edit_finance());

-- ══════════════════════════════════════════════════════════════════ bucket
--
-- 25 MB — `MAX_DOCUMENT_BYTES` ile AYNI SAYI (lib/finance/personnel.ts).
-- Taranmış bir sözleşme birkaç yüz KB'dır; sınır cömerttir ki yükleme
-- reddedilmesin.
insert into storage.buckets (id, name, public, file_size_limit)
values ('personnel', 'personnel', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- POLİTİKA DÜZEYİ: `drawings` gibi SIKI, `equipment-attachments` gibi gevşek
-- DEĞİL. Okuma dahil dördü de fonksiyondan geçer — çünkü buradaki dosya bir
-- katalog yaprağı değil, bir çalışanın sağlık raporudur. `createSignedUrl` bir
-- kez üretildikten sonra 120 saniye boyunca oturumsuz açılabilir; asıl kapı bu
-- politikadır.
drop policy if exists "personnel okuma (finans)" on storage.objects;
create policy "personnel okuma (finans)" on storage.objects
  for select to authenticated
  using (bucket_id = 'personnel' and public.can_see_finance());

drop policy if exists "personnel yükleme (finans)" on storage.objects;
create policy "personnel yükleme (finans)" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'personnel' and public.can_edit_finance());

drop policy if exists "personnel güncelleme (finans)" on storage.objects;
create policy "personnel güncelleme (finans)" on storage.objects
  for update to authenticated
  using (bucket_id = 'personnel' and public.can_edit_finance())
  with check (bucket_id = 'personnel' and public.can_edit_finance());

-- Silme sırası "önce ucuz olanı kaybet"tir (AGENTS, Teknik Resimler): önce
-- TABLO satırı, sonra depo nesnesi. Ters sırada baytlar gidip kayıt kalırsa
-- liste var olmayan bir belgeye bağlanır; bu sırada en kötü ihtimalle yetim
-- bir nesne kalır ve o geri alınabilir bir hatadır.
drop policy if exists "personnel silme (finans)" on storage.objects;
create policy "personnel silme (finans)" on storage.objects
  for delete to authenticated
  using (bucket_id = 'personnel' and public.can_edit_finance());

comment on table public.fin_employees is
  'Personel künyesi. Giriş/çıkış tarihleri BURADA DEĞİL fin_employment''dadır — bir kişi birden çok kez çalışabilir.';
comment on table public.fin_payroll is
  'Kişi × ay maaş satırı. overtime_amount TÜRETİLMİŞTİR (4857 md. 41; net/225 × (s50×1,5 + s100×2)).';
comment on table public.fin_fx_daily is
  'Günlük döviz kuru gözlemi (TCMB döviz alış; ulaşılamayan günde ECB). Aylık ortalama fin_fx_monthly view''ından okunur.';

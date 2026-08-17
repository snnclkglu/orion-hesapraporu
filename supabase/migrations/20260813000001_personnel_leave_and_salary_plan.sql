-- PERSONEL — iki karar (kullanıcı, 13.08.2026):
--
--   1. İZİN VE RAPOR SAATİ ARTIK KİŞİ BAZINDADIR.
--      "Örneğin personel birkaç gün gelmediyse bunu sisteme girmek isterim.
--       Yani izin saatini ve rapor saatini üstte dönem ayarlarında girmeyeyim,
--       kişi bazında gireyim."
--
--   2. NET MAAŞ YIL BAŞINDA BELİRLENİR (`hr_salary_plan`).
--      "Biz yıl başında zam yapıyoruz; kişinin net maaşının 50 bin TL olduğu
--       belirleniyor, sonra kişi yıl boyunca o maaşı alıyor."
--
-- ═════════════════════════════════ 1. KİŞİ BAZINDA İZİN VE RAPOR SAATİ
--
-- AGENTS PERSONEL-22 bugüne kadar şunu söylüyordu: "İzin ve rapor saati ay
-- düzeyindedir (hr_periods), kişi başına değil: firma bugün de öyle tutuyor.
-- Kişi bazlı izin takibi AYRI BİR FAZDIR." O faz budur.
--
-- DÖNEM SÜTUNLARI DÜŞÜRÜLMEZ ve bu bilinçlidir. `drawn` sütununun düşürülme
-- gerekçesi (RESIM-20 — "iki kaynak bir arada yaşamasın") burada geçerli
-- DEĞİLDİR, çünkü bu sütunlarda GERÇEK VERİ var: devralınan 27 ayın izin ve
-- rapor saatleri Excel'den ay düzeyinde geldi ve kişilere DAĞITILAMAZ —
-- uydurulmuş bir dağıtım, boş bir hücreden çok daha pahalıdır (md. 21'in
-- "uydurma bir veri girmeyeceğiz" kuralı).
--
-- Ayrışma riski TEK BİR KURALLA kapatılır ve kural TS tarafındadır
-- (`lib/personnel/payroll.ts → donemIzinRapor`): bir ayda kişi satırlarında
-- izin/rapor VARSA yalnız onlar sayılır; HİÇ YOKSA devralınan ay değeri
-- kullanılır ve ekran bunu "devralınan" diye künyeler. Yani iki kaynak asla
-- TOPLANMAZ; biri diğerinin yerine geçer ve hangisinin konuştuğu görünür.

alter table public.hr_payroll
  add column if not exists leave_hours numeric(8, 2) not null default 0
    check (leave_hours >= 0),
  add column if not exists report_hours numeric(8, 2) not null default 0
    check (report_hours >= 0);

comment on column public.hr_payroll.leave_hours is
  'Kişinin o aydaki izin saati. Net çalışma saatinden düşülür; bordro matrahına GİRMEZ (ücretli izin zaten net maaşın içindedir).';
comment on column public.hr_payroll.report_hours is
  'Kişinin o aydaki raporlu (istirahat) saati. Net çalışma saatinden düşülür.';

comment on column public.hr_periods.leave_hours is
  'DEVRALINAN ay düzeyi izin saati (Excel, 2024-05…2026-07). Yeni kayıt buraya YAZILMAZ — kişi bazlı hr_payroll.leave_hours kullanılır. Kişi satırlarında hiç izin yoksa bu değer YEDEK olarak okunur.';
comment on column public.hr_periods.report_hours is
  'DEVRALINAN ay düzeyi rapor saati. Bkz. hr_periods.leave_hours.';

-- ═══════════════════════════════════════════════ 2. ÜCRET PLANI (ZAM DEFTERİ)
--
-- BİR SATIR = BİR KİŞİNİN BİR TARİHTEN İTİBAREN GEÇERLİ NET ÜCRETİ.
--
-- NEDEN AYRI BİR TABLO — `hr_payroll` zaten net maaşı taşıyor:
--   • Maaş satırı ÖDENMİŞ OLGUdur (o ay eline ne geçti), ücret planı KARARdır
--     (bu kişinin ücreti ne olacak). İkisi çoğu ay aynıdır ama aynı ŞEY
--     değildir: ay ortasında işe giren kişinin maaş satırı eksik gündür,
--     ücreti tamdır.
--   • Karar İLERİ tarihlidir: aralıkta 2027 zammı girilir, ocak maaşı henüz
--     yoktur. Maaş satırına yazmak, ödenmemiş bir ayı ödenmiş göstermek olurdu.
--   • Zammın TABANI ve ORANI kararın parçasıdır ve saklanmalıdır: "%15 zam
--     yapıldı" bilgisi iki maaş satırının farkından geri hesaplanamaz
--     (araya prim, eksik gün ve düzeltmeler girer).
--
-- ANAHTAR (kişi, geçerlilik başlangıcı)dır ve başlangıç AYIN İLK GÜNÜDÜR:
-- ücret ay ortasında değişmez, bordro dönemi aydır.
create table if not exists public.hr_salary_plan (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees (id) on delete cascade,

  -- Bu ücretin geçerli olmaya BAŞLADIĞI dönem. Bitiş TUTULMAZ: bir sonraki
  -- satır zaten bitirir ve iki uçlu aralık tutmak "boşluk/çakışma" diye ikinci
  -- bir tutarlılık sorusu doğururdu.
  effective_from date not null,

  net_salary numeric(14, 2) not null check (net_salary >= 0),

  -- ZAMMIN KÜNYESİ. İkisi de TÜRETİLEBİLİR görünür ama değildir: taban, kararın
  -- verildiği andaki ücrettir ve sonradan bir düzeltmeyle değişebilir.
  previous_net numeric(14, 2) check (previous_net is null or previous_net >= 0),
  raise_pct numeric(8, 4),

  -- 'ilk'      → kişinin ilk ücreti (zam değil)
  -- 'yillik'   → yıl başı zammı
  -- 'ara'      → yıl içi ayarlama
  -- 'duzeltme' → yanlış girilmiş bir kararın düzeltilmesi
  reason text not null default 'yillik'
    check (reason in ('ilk', 'yillik', 'ara', 'duzeltme')),
  note text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),

  constraint hr_salary_plan_month check (extract(day from effective_from) = 1),
  constraint hr_salary_plan_unique unique (employee_id, effective_from)
);

create index if not exists hr_salary_plan_employee_idx
  on public.hr_salary_plan (employee_id, effective_from desc);
create index if not exists hr_salary_plan_from_idx
  on public.hr_salary_plan (effective_from desc);

comment on table public.hr_salary_plan is
  'Ücret planı: bir kişinin bir tarihten itibaren geçerli NET ücreti. Maaş ekranı yeni satır açarken buradan okur. Ödenen ücret hr_payroll''dadır — burası KARAR, orası OLGU.';

alter table public.hr_salary_plan enable row level security;

drop policy if exists hr_salary_plan_select on public.hr_salary_plan;
create policy hr_salary_plan_select on public.hr_salary_plan
  for select to authenticated using (public.can_see_personnel());

drop policy if exists hr_salary_plan_insert on public.hr_salary_plan;
create policy hr_salary_plan_insert on public.hr_salary_plan
  for insert to authenticated with check (public.can_edit_personnel());

drop policy if exists hr_salary_plan_update on public.hr_salary_plan;
create policy hr_salary_plan_update on public.hr_salary_plan
  for update to authenticated
  using (public.can_edit_personnel()) with check (public.can_edit_personnel());

drop policy if exists hr_salary_plan_delete on public.hr_salary_plan;
create policy hr_salary_plan_delete on public.hr_salary_plan
  for delete to authenticated using (public.can_edit_personnel());

drop trigger if exists touch_hr_salary_plan on public.hr_salary_plan;
create trigger touch_hr_salary_plan before update on public.hr_salary_plan
  for each row execute function public.touch_updated_at();

-- ═════════════════════════════════════════ 3. DEFTERİ GEÇMİŞTEN DOLDUR
--
-- Ekran boş açılmaz — ama tek bir sayı UYDURULMAZ. Defter, ödenmiş maaş
-- satırlarının KENDİSİNDEN türetilir: net maaşın DEĞİŞTİĞİ her ay bir karar
-- satırıdır. Değişmediği aylar satır üretmez; zaten "aynı ücret devam etti"
-- demek, bir sonraki satıra kadar geçerlilik kuralının söylediği şeydir.
--
-- Bu bir tahmin değil bir OKUMAdır: firma zammı gerçekten yaptığında maaş
-- satırındaki sayı değişmiştir. Ocak'ta değişen 'yillik', diğer aylarda
-- değişen 'ara' sayılır — ikisi de gerçekten olmuş bir olayı adlandırır.
--
-- `net_salary > 0` süzgeci zorunludur: sıfır maaşlı bir satır (ücretsiz izin,
-- eksik giriş) ücret KARARI değildir ve tabana yazılsaydı ertesi ay sonsuz
-- oranlı bir "zam" görünürdü.
insert into public.hr_salary_plan (
  employee_id, effective_from, net_salary, previous_net, raise_pct, reason, note
)
select
  t.employee_id,
  t.period,
  t.net_salary,
  t.onceki,
  case
    when t.onceki is not null and t.onceki > 0
      then round((t.net_salary / t.onceki - 1)::numeric, 4)
  end,
  case
    when t.onceki is null then 'ilk'
    when extract(month from t.period) = 1 then 'yillik'
    else 'ara'
  end,
  'Devralınan maaş satırlarından türetildi'
from (
  select
    employee_id,
    period,
    net_salary,
    lag(net_salary) over (partition by employee_id order by period) as onceki
  from public.hr_payroll
  where net_salary > 0
) t
where t.onceki is null or t.onceki <> t.net_salary
on conflict (employee_id, effective_from) do nothing;

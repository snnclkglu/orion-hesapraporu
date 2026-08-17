-- SATIŞ FATURALARI — kullanıcı kararı (14.08.2026): Satış bölümüne yalnız
-- faturanın takibi için ayrı bir sayfa. Manuel giriş + "Satış Faturaları Verisi"
-- excelinden devralınan geçmiş.
--
-- SATIŞ TAKİBİ'NDEN AYRIDIR: o, iş kalemi başına sözleşme fiyatını izler; bu,
-- kesilen FATURAyı. İkisi farklı olgulardır (bir iş birden çok faturaya
-- bölünebilir) ve ayrı tabloda durur.
--
-- PARA SÖZLEŞMESİ SATIS-16 ile aynı: `fx_rate` = 1 EUR kaç birim `currency` eder;
-- EUR satırında 1'dir, EUR karşılığı TÜRETİLİR. Devralınan faturalar TL kesilmiş
-- ve kuruyla EUR'a çevrilmiştir; import bunu currency='TRY' + fx_rate(kur) olarak
-- saklar, EUR ciro generated kolondan çıkar.

create table if not exists public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  item_no text not null default '',
  invoice_year int,
  invoice_date date,
  invoice_no text not null default '',
  -- MÜŞTERİ ADI SNAPSHOTTIR (IS-14): defter düzeltilse de kesilmiş fatura
  -- değişmez. `customer_id` yalnız bağlamdır.
  customer text not null default '',
  customer_id uuid references public.customers (id) on delete set null,
  qty numeric(14, 3),
  unit_price numeric(16, 4),
  currency text not null default 'TRY',
  fx_rate numeric(16, 6),
  amount numeric(18, 4) generated always as (coalesce(qty, 0) * coalesce(unit_price, 0)) stored,
  amount_eur numeric(18, 4) generated always as (
    case
      when currency = 'EUR' then coalesce(qty, 0) * coalesce(unit_price, 0)
      when fx_rate is null or fx_rate = 0 then null
      else coalesce(qty, 0) * coalesce(unit_price, 0) / fx_rate
    end
  ) stored,
  note text not null default '',
  source text not null default 'app',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_invoices_currency_check check (currency in ('TRY', 'EUR', 'USD')),
  constraint sales_invoices_fx_positive check (fx_rate is null or fx_rate > 0)
);

create index if not exists sales_invoices_year_idx on public.sales_invoices (invoice_year);
create index if not exists sales_invoices_customer_idx on public.sales_invoices (customer_id);
create index if not exists sales_invoices_date_idx on public.sales_invoices (invoice_date desc);

drop trigger if exists touch_sales_invoices on public.sales_invoices;
create trigger touch_sales_invoices before update on public.sales_invoices
  for each row execute function public.touch_updated_at();

comment on table public.sales_invoices is
  'Satış faturası takibi (Satış Takibi''nden AYRI). EUR ciro fx_rate ile '
  'türetilir; müşteri adı snapshottır.';

-- ------------------------------------------------------------------- RLS
-- `job_item_sales` KALIBI: okuma da yazma da `can_see_sales()` — Yönetici+Müdür.
alter table public.sales_invoices enable row level security;

drop policy if exists sales_invoices_select on public.sales_invoices;
create policy sales_invoices_select on public.sales_invoices
  for select to authenticated using (public.can_see_sales());

drop policy if exists sales_invoices_write on public.sales_invoices;
create policy sales_invoices_write on public.sales_invoices
  for all to authenticated
  using (public.can_see_sales())
  with check (public.can_see_sales());

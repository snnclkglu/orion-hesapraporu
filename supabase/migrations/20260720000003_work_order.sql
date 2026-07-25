-- İş Emri (Work Order, form FR.11.02) tam modeli.
-- Mevcut jobs tablosu (job_no, title, customer, status, notes) genişletilir;
-- iş kalemleri (ürün adı → iş numarası → adet) ayrı job_items tablosunda.

alter table public.jobs
  add column if not exists work_order_date date,
  add column if not exists form_code text not null default 'FR.11.02',
  add column if not exists customer_address text not null default '',
  add column if not exists customer_tax_office text not null default '',
  add column if not exists customer_tax_no text not null default '',
  add column if not exists customer_phone text not null default '',
  add column if not exists customer_fax text not null default '',
  add column if not exists contract_exists boolean not null default false,
  add column if not exists contract_date date,
  add column if not exists workshop_exit_date date,
  add column if not exists delivery_date date,
  add column if not exists quantity_text text not null default '',
  add column if not exists job_leader text not null default '',
  add column if not exists prepared_by_name text not null default '',
  add column if not exists prepared_by_title text not null default '',
  -- kapsam: {proje, devreyeAlma, malzeme, nakliye, imalat, montaj} bool
  add column if not exists scope jsonb not null default '{}'::jsonb;

-- İş kalemleri: iş emri satırları (ürün + iş no + adet). Bazı kalemler vinç
-- (hesap raporu = projects) olur; project_id ile bağlanabilir (opsiyonel).
create table if not exists public.job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  item_no text not null default '',          -- ör. 0057-01
  product_name text not null,                -- ör. 1 t x 19 m Tek Kirişli Köprülü Vinç
  quantity text not null default '',         -- serbest: "3 Adet" / "1"
  sort int not null default 0,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists job_items_job_idx on public.job_items (job_id, sort);

alter table public.job_items enable row level security;
create policy "job_items_select" on public.job_items
  for select to authenticated using (true);
create policy "job_items_write" on public.job_items
  for all to authenticated using (true) with check (true);

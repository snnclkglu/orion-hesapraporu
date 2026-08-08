-- İş emri geliştirmeleri:
--   1. customers  — müşteri defteri (iş açarken seçilir, yeni müşteri pop-up'ı
--      buraya yazar). Şimdiye kadar müşteri bilgileri her iş emrine ELLE
--      yazılıyordu; aynı müşteri her seferinde yeniden girildiği için yazım
--      farkları oluşuyor ve müşteri filtresi güvenilir çalışmıyordu.
--   2. job_status — iş durumu artık aktif/pasif/tamamlandı/arşiv.
--   3. jobs.contract_file_* — "Sözleşme var" işaretlendiğinde yüklenen PDF.
--   4. contracts bucket — sözleşme dosyalarının özel (private) deposu.

-- ------------------------------------------------------------------ müşteriler
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  tax_office text not null default '',
  tax_no text not null default '',
  phone text not null default '',
  fax text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Aynı müşteri iki kez açılmasın. Ad ÜNİKTİR ama karşılaştırma büyük/küçük harf
-- ve baş/son boşluk duyarsızdır: "ASTOR A.Ş." ile "astor a.ş. " aynı kayıttır.
create unique index if not exists customers_name_key
  on public.customers (lower(btrim(name)));

alter table public.customers enable row level security;

create policy "customers_select" on public.customers
  for select to authenticated using (true);
create policy "customers_insert" on public.customers
  for insert to authenticated with check (true);
create policy "customers_update" on public.customers
  for update to authenticated using (true);
create policy "customers_delete" on public.customers
  for delete to authenticated using (public.is_admin());

create trigger touch_customers before update on public.customers
  for each row execute function public.touch_updated_at();

-- Mevcut iş emirlerindeki müşteriler deftere taşınır: aynı ada sahip birden çok
-- iş varsa EN SON girilen (dolu alanı en çok olan) kayıt esas alınır.
insert into public.customers (name, address, tax_office, tax_no, phone, fax)
select distinct on (lower(btrim(j.customer)))
  btrim(j.customer),
  coalesce(j.customer_address, ''),
  coalesce(j.customer_tax_office, ''),
  coalesce(j.customer_tax_no, ''),
  coalesce(j.customer_phone, ''),
  coalesce(j.customer_fax, '')
from public.jobs j
where btrim(coalesce(j.customer, '')) <> ''
order by
  lower(btrim(j.customer)),
  -- dolu alan sayısı çok olan kayıt önce gelsin
  (case when coalesce(j.customer_address, '') <> '' then 1 else 0 end
   + case when coalesce(j.customer_tax_office, '') <> '' then 1 else 0 end
   + case when coalesce(j.customer_tax_no, '') <> '' then 1 else 0 end
   + case when coalesce(j.customer_phone, '') <> '' then 1 else 0 end) desc,
  j.created_at desc
on conflict do nothing;

-- İş, defterdeki müşteriye bağlanır. Metin alanları (customer, customer_address…)
-- KALIR: iş emri basıldığı andaki müşteri bilgisinin fotoğrafıdır; müşteri
-- defteri sonradan güncellenince eski iş emri değişmemelidir.
alter table public.jobs
  add column if not exists customer_id uuid references public.customers (id) on delete set null;

update public.jobs j
set customer_id = c.id
from public.customers c
where j.customer_id is null
  and lower(btrim(j.customer)) = lower(btrim(c.name));

create index if not exists jobs_customer_idx on public.jobs (customer_id);

-- ------------------------------------------------------------------ iş durumu
-- project_status yalnız active/archived taşıyor. İş emrinin akışı bundan
-- daha zengin: pasife alınan (beklemeye giren) ve tamamlanan işler ayrı
-- durumlardır. Enum'a değer eklemek yerine AYRI bir tip kurulur — projects
-- tablosunun durum kümesi değişmesin.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum ('active', 'passive', 'completed', 'archived');
  end if;
end
$$;

alter table public.jobs alter column status drop default;
alter table public.jobs
  alter column status type public.job_status
  using status::text::public.job_status;
alter table public.jobs alter column status set default 'active'::public.job_status;

-- --------------------------------------------------------------- sözleşme PDF
alter table public.jobs
  add column if not exists contract_file_path text not null default '',
  add column if not exists contract_file_name text not null default '';

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy "contracts okuma (authenticated)"
on storage.objects for select
to authenticated
using (bucket_id = 'contracts');

create policy "contracts yükleme (authenticated)"
on storage.objects for insert
to authenticated
with check (bucket_id = 'contracts');

create policy "contracts güncelleme (authenticated)"
on storage.objects for update
to authenticated
using (bucket_id = 'contracts')
with check (bucket_id = 'contracts');

create policy "contracts silme (authenticated)"
on storage.objects for delete
to authenticated
using (bucket_id = 'contracts');

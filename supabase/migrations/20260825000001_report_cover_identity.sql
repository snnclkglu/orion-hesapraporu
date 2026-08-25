-- Hesap raporu kapak kimliği ve vinç yeri.
--
-- `report_brand_customer_id`: raporu Orion dışında kendi adıyla sunan firma.
-- PDF'de bu alan için "partner" ifadesi kullanılmaz; firma adı ve logosu
-- doğrudan kurumsal kimlik olarak gösterilir.
-- `end_customer_id`: kapakta gösterilecek son kullanıcı logosunun kaynağı.

alter table public.projects
  add column if not exists crane_location text not null default '',
  add column if not exists report_brand_customer_id uuid
    references public.customers(id) on delete set null,
  add column if not exists end_customer_id uuid
    references public.customers(id) on delete set null;

create index if not exists projects_report_brand_customer_id_idx
  on public.projects(report_brand_customer_id);

create index if not exists projects_end_customer_id_idx
  on public.projects(end_customer_id);

-- ELEKTRİK MALZEMESİ KATALOG/FÖY DEFTERİ.
--
-- Kaynak PDF, üründen ve kullanımından ayrıdır:
--   electrical_catalog_documents         — depodaki PDF (tam katalog ya da 1-6 s. föy)
--   electrical_catalog_products          — üretici + tip numarasıyla kararlı ürün kimliği
--   electrical_catalog_product_documents — ürünün föy/katalog bağları
--
-- `electrical_parts` yeniden okumada SİLİNİP üretildiği için katalog bağı o
-- satırın UUID'sine bağlanamaz. Ürün kimliği yeniden okumadan ve başka
-- projelerden bağımsız yaşar; aynı Siemens tip numarası ikinci projede yeniden
-- PDF yükletmez.

create table if not exists public.electrical_catalog_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  manufacturer text not null default '',
  language text not null default '',
  document_kind text not null
    check (document_kind in ('catalog', 'technical_sheet', 'technical_extract', 'manual')),
  file_name text not null,
  storage_path text not null unique,
  -- Büyük kataloglar proje düzeyindeki nesne sınırını aşarsa sayfa
  -- sınırlarında parçalanır; açma ucu kullanıcıya yine tek PDF sunar.
  storage_parts text[] not null default '{}',
  size_bytes bigint not null check (size_bytes >= 0),
  page_count integer not null check (page_count > 0),
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  -- Uzun bir belgeden kesilen föy, kaynağını ve 1 tabanlı gerçek sayfalarını
  -- kaybetmez. Asıl belgede bu iki alan boştur.
  source_document_id uuid references public.electrical_catalog_documents (id),
  source_pages integer[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint electrical_catalog_extract_source_check check (
    (document_kind = 'technical_extract'
      and source_document_id is not null
      and cardinality(source_pages) between 1 and 6)
    or
    (document_kind <> 'technical_extract'
      and source_document_id is null
      and cardinality(source_pages) = 0)
  ),
  constraint electrical_catalog_technical_page_check check (
    document_kind not in ('technical_sheet', 'technical_extract') or page_count between 1 and 6
  )
);

alter table public.electrical_catalog_documents
  add column if not exists storage_parts text[] not null default '{}';
update public.electrical_catalog_documents
set storage_parts = array[storage_path]
where cardinality(storage_parts) = 0;

create index if not exists electrical_catalog_documents_source_idx
  on public.electrical_catalog_documents (source_document_id)
  where source_document_id is not null;

create table if not exists public.electrical_catalog_products (
  id uuid primary key default gen_random_uuid(),
  supplier text not null default '',
  type_no text not null,
  designation text not null default '',
  -- Uygulamanın `electricalCatalogLookupKey` çıktısıdır. SQL'in Türkçe
  -- büyük/küçük harf ve noktalama kuralıyla ikinci bir normalleştirici
  -- yazılmaz; iki kuralın ayrışmasını bu alan engeller.
  lookup_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.electrical_catalog_product_documents (
  product_id uuid not null references public.electrical_catalog_products (id) on delete cascade,
  document_id uuid not null references public.electrical_catalog_documents (id) on delete cascade,
  usage text not null check (usage in ('technical', 'catalog')),
  is_primary boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, document_id, usage)
);

create unique index if not exists electrical_catalog_product_primary_uidx
  on public.electrical_catalog_product_documents (product_id, usage)
  where is_primary;
create index if not exists electrical_catalog_product_documents_doc_idx
  on public.electrical_catalog_product_documents (document_id);

alter table public.electrical_catalog_documents enable row level security;
alter table public.electrical_catalog_products enable row level security;
alter table public.electrical_catalog_product_documents enable row level security;

drop policy if exists "elcat_docs_select" on public.electrical_catalog_documents;
create policy "elcat_docs_select" on public.electrical_catalog_documents
  for select to authenticated using (true);
drop policy if exists "elcat_docs_write" on public.electrical_catalog_documents;
create policy "elcat_docs_write" on public.electrical_catalog_documents
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

drop policy if exists "elcat_products_select" on public.electrical_catalog_products;
create policy "elcat_products_select" on public.electrical_catalog_products
  for select to authenticated using (true);
drop policy if exists "elcat_products_write" on public.electrical_catalog_products;
create policy "elcat_products_write" on public.electrical_catalog_products
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

drop policy if exists "elcat_links_select" on public.electrical_catalog_product_documents;
create policy "elcat_links_select" on public.electrical_catalog_product_documents
  for select to authenticated using (true);
drop policy if exists "elcat_links_write" on public.electrical_catalog_product_documents;
create policy "elcat_links_write" on public.electrical_catalog_product_documents
  for all to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

insert into storage.buckets (id, name, public, file_size_limit)
values ('electrical-catalogs', 'electrical-catalogs', false, 157286400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "electrical-catalogs okuma (authenticated)" on storage.objects;
create policy "electrical-catalogs okuma (authenticated)" on storage.objects
  for select to authenticated using (bucket_id = 'electrical-catalogs');
drop policy if exists "electrical-catalogs yükleme (authenticated)" on storage.objects;
create policy "electrical-catalogs yükleme (authenticated)" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'electrical-catalogs' and public.can_edit_reports()
  );
drop policy if exists "electrical-catalogs güncelleme (authenticated)" on storage.objects;
create policy "electrical-catalogs güncelleme (authenticated)" on storage.objects
  for update to authenticated
  using (bucket_id = 'electrical-catalogs' and public.can_edit_reports())
  with check (bucket_id = 'electrical-catalogs' and public.can_edit_reports());
drop policy if exists "electrical-catalogs silme (authenticated)" on storage.objects;
create policy "electrical-catalogs silme (authenticated)" on storage.objects
  for delete to authenticated using (
    bucket_id = 'electrical-catalogs' and public.can_edit_reports()
  );

comment on table public.electrical_catalog_documents is
  'Elektrik ekipmanı tam katalogları ve en çok 6 sayfalık teknik föyleri; baytlar electrical-catalogs kovasındadır.';
comment on table public.electrical_catalog_products is
  'Elektrik malzemesinin üretici + tip numarasıyla projeden bağımsız katalog kimliği.';

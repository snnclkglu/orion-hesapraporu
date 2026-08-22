-- Ekipman listesinden müşteriye açılacak PROJE ANA PAFTASI.
--
-- Bağlantının kendisi değil yalnız aynı uygulamadaki `/paylas/resim/<token>`
-- yolu saklanır. Bu yol bearer token'ı içerdiği için yalnız revizyonu gören
-- authenticated kullanıcılarca okunur; anon tabloyu doğrudan okuyamaz.
-- PDF/Excel indirme ucu canlı isteğin origin'ini ekler; yerel geliştirme
-- adresi yanlışlıkla müşteri belgesine kalıcı olarak yazılmaz.
create table if not exists public.equipment_customer_drawing_links (
  revision_id uuid primary key references public.revisions(id) on delete cascade,
  share_path text not null check (
    share_path ~ '^/paylas/resim/[A-Za-z0-9_-]{43}$'
  ),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.equipment_customer_drawing_links enable row level security;

create policy "eqcdl_select" on public.equipment_customer_drawing_links
  for select to authenticated
  using (exists (select 1 from public.revisions r where r.id = revision_id));

create policy "eqcdl_write" on public.equipment_customer_drawing_links
  for all to authenticated
  using (exists (select 1 from public.revisions r where r.id = revision_id))
  with check (exists (select 1 from public.revisions r where r.id = revision_id));

comment on table public.equipment_customer_drawing_links is
  'Ekipman PDF/Excel başlığındaki müşteri ana pafta bağlantısı; hedef iptal edilirse eski belge 404 alır.';

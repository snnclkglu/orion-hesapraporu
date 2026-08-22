-- MÜŞTERİ TEKNİK RESİM PAYLAŞIMI.
--
-- Teknik resim bucket'ı private kalır. Müşteriye verilen bağlantı storage
-- adresi değil, 256 bitlik rastgele bir anahtardır; yalnız seçilen PDF'i
-- açar. Ham anahtar veritabanında tutulmaz, SHA-256 özeti tutulur. Böylece
-- tablo okuma yetkisi olan bir kullanıcı bile eski müşteri bağlantısını
-- veritabanından çıkaramaz; yeni bağlantı üretmek eskisini kapatır.
create table if not exists public.drawing_public_shares (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.drawing_files(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Bir dosyanın aynı anda tek geçerli müşteri bağlantısı vardır. "Yeni link"
-- işlemi önce eskisini kapatır; müşteriye hangi iki linkin geçerli olduğu gibi
-- belirsiz bir durum bırakmaz.
create unique index if not exists drawing_public_shares_one_active_file
  on public.drawing_public_shares(file_id)
  where revoked_at is null;

create index if not exists drawing_public_shares_active_hash
  on public.drawing_public_shares(token_hash)
  where revoked_at is null;

alter table public.drawing_public_shares enable row level security;

-- Müşteri (anon) tabloyu doğrudan okuyamaz. Açık route anahtarı özetleyip
-- yalnız sunucudaki service-role istemcisiyle tek satırı çözer; storage bucket
-- da public yapılmaz.
create policy "drawing_public_shares_select" on public.drawing_public_shares
  for select to authenticated using (true);

create policy "drawing_public_shares_insert" on public.drawing_public_shares
  for insert to authenticated
  with check (public.can_edit_drawings() and created_by = (select auth.uid()));

create policy "drawing_public_shares_update" on public.drawing_public_shares
  for update to authenticated
  using (public.can_edit_drawings())
  with check (public.can_edit_drawings());

create policy "drawing_public_shares_delete" on public.drawing_public_shares
  for delete to authenticated using (public.can_edit_drawings());

comment on table public.drawing_public_shares is
  'Üyeliksiz müşteriye açılan tek-PDF teknik resim bağlantıları. Bucket private, ham token yalnız oluşturma yanıtındadır.';

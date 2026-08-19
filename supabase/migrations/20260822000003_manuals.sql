-- İŞLETME VE BAKIM EL KİTABI — müşteriye teslim edilen kullanma kılavuzu.
--
-- BELGENİN ADI KULLANICI KARARIDIR (19.08.2026): müşteri "Kullanma ve Bakım
-- Kılavuzu" değil **İŞLETME VE BAKIM EL KİTABI** istiyor. Ad tek yerdedir
-- (`lib/manual/naming.ts`), tabloya gömülmez.
--
-- MODEL TEKLİFİN İKİZİDİR (TEKLIF-2) ve bu bilinçlidir: ikisi de müşteriye
-- TESLİM EDİLEN, revizyonlanan, bölümleri gizlenebilen belgelerdir.
--   `manuals`          — defter satırı (hangi projenin el kitabı)
--   `manual_revisions` — BELGENİN TAMAMI tek bir `payload` snapshot'ında
--   `manual_images`    — gövdeye eklenen görsellerin baytları depoda
--
-- NEDEN İLİŞKİSEL BÖLÜM/BLOK TABLOLARI DEĞİL: bir el kitabı 14 ana bölüm,
-- 40+ alt bölüm ve yüzlerce blok taşır (kaynak Word belgesinde bakım
-- çizelgesi tek başına 235 satır). Her yeni revizyon bunların hepsini
-- kopyalamak zorunda kalırdı ve yayımlanmış bir belgenin değişmezliği tek
-- tetikleyiciyle korunamazdı.
--
-- GÖRSELLER SNAPSHOT'A GİRMEZ, İŞARET EDİLİR. `payload` içindeki resim bloğu
-- yalnız `imageId` taşır; baytlar `manual-images` kovasındadır (ekipman
-- ekinin dersi: JSONB'ye base64 koymak her okumayı şişirirdi). Yeni revizyon
-- açılırken kayıtlar KOPYALANIR — mühendis her sürümde aynı fotoğrafı
-- yeniden yüklemez.
--
-- EL KİTABI PROJEYE BAĞLIDIR, İŞE DEĞİL. Bir iş emrinde birden çok vinç
-- olabilir (job_items) ve her vincin kendi kılavuzu vardır; proje = iş kalemi
-- = bir vinçtir. Hesap raporu, elektrik projesi, şartname ve teknik resim
-- defteri de aynı çapaya bağlıdır, yani el kitabı beslendiği her kaynağa
-- tek bir kimlikten ulaşır.

-- --------------------------------------------------------------------- yetki
-- El kitabını hesap raporunu yazan rol yazar. AYRI BİR SORU olarak tanımlanır
-- (`roller.md`: yetki bir SORUdur, bir liste değil) ki ileride "teknik yazar"
-- rolü açılırsa `can_edit_reports` kalabalıklaşmadan burası genişlesin.
create or replace function public.can_edit_manuals()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_edit_reports();
$$;

comment on function public.can_edit_manuals() is
  'İşletme ve Bakım El Kitabı yazma yetkisi; bugün can_edit_reports ile aynıdır, ayrı sorudur.';

-- ------------------------------------------------------------------- manuals
create table if not exists public.manuals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Müşterinin kendi doküman numarası ("028.00-KBK01"). BİZİM belge kodumuz
  -- (`ORC-BK-…`) ondan ayrıdır ve `pdf/doc-naming.ts`te üretilir; bu alan
  -- müşteri yazışmasında geçen numaradır ve BOŞ olabilir.
  customer_doc_no text not null default '',
  -- Kapakta basılan başlık. Öntanımı belgenin adı + vincin adıdır ama
  -- ELLE düzenlenebilir (teklifteki `titleManual` ile aynı ruh).
  title text not null default '',
  status public.project_status not null default 'active',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- BİR PROJEDE BİR EL KİTABI. İkinci bir kılavuz "hangisi teslim edildi"
-- sorusunu doğururdu; sürüm ayrımı REVİZYONUN işidir.
create unique index if not exists manuals_project_uidx on public.manuals (project_id);

alter table public.manuals enable row level security;

drop policy if exists "manuals_select" on public.manuals;
create policy "manuals_select" on public.manuals
  for select to authenticated using (true);

drop policy if exists "manuals_write" on public.manuals;
create policy "manuals_write" on public.manuals
  for all to authenticated
  using (public.can_edit_manuals())
  with check (public.can_edit_manuals());

comment on table public.manuals is
  'İşletme ve Bakım El Kitabı defter satırı; belgenin kendisi manual_revisions.payload içindedir.';

-- ---------------------------------------------------------- manual_revisions
create table if not exists public.manual_revisions (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.manuals (id) on delete cascade,
  rev_no int not null,
  label text not null default '',
  -- MEVCUT `revision_status` yeniden kullanılır (TEKLIF-2 gerekçesi):
  -- taslak/yayınlandı ayrımı uygulamada TEK bir kavramdır.
  status public.revision_status not null default 'draft',
  -- BELGENİN TAMAMI: bölüm ağacı, bloklar, standart metnin düzenlenmiş hâli,
  -- gizleme kararları, ek kapsamı ve yayımda DONMUŞ otomatik tablolar.
  payload jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references public.profiles (id),
  unique (manual_id, rev_no)
);

create index if not exists manual_revisions_manual_idx
  on public.manual_revisions (manual_id, rev_no desc);

-- YAYIMLANMIŞ REVİZYON DEĞİŞTİRİLEMEZ VE SİLİNEMEZ — `guard_issued_revision`
-- ve `guard_issued_offer_revision`in üçüncü ikizi. Teslim edilmiş bir kılavuz
-- vincin yanında asılıdır; sonradan düzeltilirse operatör başka bir belgeye
-- bakar. NEYİN korunduğunu bu tetikleyici, KİMİN silebileceğini RLS söyler.
create or replace function public.guard_issued_manual_revision()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then
      raise exception 'Yayınlanmış el kitabı revizyonu silinemez';
    end if;
    return old;
  end if;

  if old.status = 'issued' then
    raise exception 'Yayınlanmış el kitabı revizyonu değiştirilemez; yeni revizyon oluşturun';
  end if;

  if new.status = 'issued' and old.status = 'draft' then
    new.issued_at := now();
    new.issued_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_issued_manual_revision on public.manual_revisions;
create trigger guard_issued_manual_revision
  before update or delete on public.manual_revisions
  for each row execute function public.guard_issued_manual_revision();

drop trigger if exists touch_manuals on public.manuals;
create trigger touch_manuals before update on public.manuals
  for each row execute function public.touch_updated_at();

alter table public.manual_revisions enable row level security;

drop policy if exists "manual_revisions_select" on public.manual_revisions;
create policy "manual_revisions_select" on public.manual_revisions
  for select to authenticated using (true);

drop policy if exists "manual_revisions_write" on public.manual_revisions;
create policy "manual_revisions_write" on public.manual_revisions
  for insert to authenticated with check (public.can_edit_manuals());

drop policy if exists "manual_revisions_update" on public.manual_revisions;
create policy "manual_revisions_update" on public.manual_revisions
  for update to authenticated
  using (public.can_edit_manuals())
  with check (public.can_edit_manuals());

drop policy if exists "manual_revisions_delete" on public.manual_revisions;
create policy "manual_revisions_delete" on public.manual_revisions
  for delete to authenticated using (public.can_edit_manuals());

comment on table public.manual_revisions is
  'El kitabı revizyonu; payload belgenin TAMAMIDIR ve yayımlanan revizyon guard_issued_manual_revision ile dondurulur.';

-- ------------------------------------------------------------- manual_images
create table if not exists public.manual_images (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.manual_revisions (id) on delete cascade,
  file_name text not null default '',
  -- Depodaki tam yol: `<revision_id>/<image_id>.png`
  storage_path text not null,
  -- ÖLÇÜLEN boyut (sharp ile), beyan değil: PDF'te en-boy oranı bundan
  -- kurulur ve yanlış bir oran resmi ezer.
  width integer not null default 0,
  height integer not null default 0,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index if not exists manual_images_revision_idx
  on public.manual_images (revision_id);

alter table public.manual_images enable row level security;

-- GÖRSEL BİR TESLİM KATMANIDIR, hesap değeri değil: `equipment_attachments`
-- ile aynı gerekçeyle yayımlanmış revizyonda da yüklenebilir olsaydı belge
-- değişirdi — burada DEĞİL, çünkü resim belgenin GÖVDESİNDEDİR ve gövde
-- yayımda donar. Yazma yetkisi taslak/yayın ayrımını revizyondan okur.
drop policy if exists "manual_images_select" on public.manual_images;
create policy "manual_images_select" on public.manual_images
  for select to authenticated using (true);

drop policy if exists "manual_images_write" on public.manual_images;
create policy "manual_images_write" on public.manual_images
  for all to authenticated
  using (
    public.can_edit_manuals()
    and exists (
      select 1 from public.manual_revisions r
      where r.id = revision_id and r.status = 'draft'
    )
  )
  with check (
    public.can_edit_manuals()
    and exists (
      select 1 from public.manual_revisions r
      where r.id = revision_id and r.status = 'draft'
    )
  );

comment on table public.manual_images is
  'El kitabı gövdesindeki görseller; baytlar manual-images kovasında. Yalnız TASLAK revizyona yazılabilir.';

-- --------------------------------------------------------------------- bucket
-- 25 MB: kılavuza giren şey bir saha fotoğrafı ya da ekran görüntüsüdür.
-- Kaynak Word belgesinde 27 görsel var ve en büyüğü 326 KB; sınır cömerttir
-- ki telefondan çekilmiş ham bir fotoğraf da reddedilmesin.
insert into storage.buckets (id, name, public, file_size_limit)
values ('manual-images', 'manual-images', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "manual-images okuma (authenticated)" on storage.objects;
create policy "manual-images okuma (authenticated)" on storage.objects
  for select to authenticated using (bucket_id = 'manual-images');

drop policy if exists "manual-images yükleme (authenticated)" on storage.objects;
create policy "manual-images yükleme (authenticated)" on storage.objects
  for insert to authenticated with check (bucket_id = 'manual-images');

drop policy if exists "manual-images güncelleme (authenticated)" on storage.objects;
create policy "manual-images güncelleme (authenticated)" on storage.objects
  for update to authenticated
  using (bucket_id = 'manual-images')
  with check (bucket_id = 'manual-images');

drop policy if exists "manual-images silme (authenticated)" on storage.objects;
create policy "manual-images silme (authenticated)" on storage.objects
  for delete to authenticated using (bucket_id = 'manual-images');

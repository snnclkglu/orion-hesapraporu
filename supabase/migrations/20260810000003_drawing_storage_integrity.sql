-- Faz V6 — DEPO BÜTÜNLÜĞÜ: "yüklendi" diyen ekranın söylediği doğru olsun.
--
-- Kusurun kendisi tek cümleyle: sistem baytların depoya ULAŞIP ULAŞMADIĞINI
-- hiçbir zaman KONTROL ETMİYORDU. `file_count` ve `bytes_total` paket açılırken
-- BİR KEZ yazılıyor ve bir daha güncellenmiyor; yani ekrandaki her sayı
-- İSTEMCİNİN BEYANIDIR, deponun gerçeği değil. Beyan ile gerçek arasında bir
-- alan olmadığı için "107 MB yüklendi" cümlesi doğrulanamıyordu.
--
-- Bu migration o alanı açar ve dört ayrı borcu kapatır:
--   1. depoya NE ULAŞTI (stored_count / stored_bytes / verified_at)
--   2. neden ULAŞMADI (drawing_files.upload_error)
--   3. paket SİLİNEBİLİR ve silme geri dönüşsüz veri kaybettirmez
--   4. REVİZYON: dosyalar yenilenir, atölyenin üretim kaydı devrolur
--
-- 20260810000001 ve …0002 UYGULANMIŞTIR ve DÜZENLENMEZ (AGENTS kuralı).

-- ═══════════════════════════════════════════════ 1. Depoya ne ulaştı
--
-- ÜÇ SAYI ÜÇ AYRI SORUYA CEVAP VERİR ve karıştırılmazlar:
--
--   file_count     kaç dosya SATIRI var                  (beyan, değişmez)
--   skipped_count  kaçı BİLEREK yüklenmedi               (yedek + bayt bayt kopya)
--   stored_count   kaçının depoda KENDİ NESNESİ var      (ölçüm)
--
-- Beklenen = file_count − skipped_count. "169/169 dosya depoda · 5 atlandı"
-- cümlesi buradan çıkar ve üç sayının hiçbiri öbürünün yerine geçemez.
--
-- ATLANAN DOSYA "EKSİK" DEĞİLDİR ve bu ayrım şart: deftere bilerek almadığımız
-- bir `.bak` yedeğini ya da bayt bayt aynı ikinci bir PDF'i depoya yollamak
-- tutarsızlıktı; artık yollamıyoruz. Ayrı bir alan olmasaydı doğrulama onları
-- "ulaşmamış" sanıp kullanıcıyı boş yere korkuturdu — modülün en büyük düşmanı
-- olan YANLIŞ ALARM tam da böyle doğar.
alter table public.drawing_packages
  add column if not exists stored_count int not null default 0,
  add column if not exists stored_bytes bigint not null default 0,
  add column if not exists skipped_count int not null default 0,
  add column if not exists skipped_bytes bigint not null default 0,
  add column if not exists verified_at timestamptz;

comment on column public.drawing_packages.skipped_bytes is
  'Atlanan satırların bayt toplamı. AYRI DURMAK ZORUNDA: bytes_total bütün '
  'satırları sayar, stored_bytes ise bucket''taki nesneleri — atlananların '
  'nesnesi hiç yoktur. İkisini doğrudan karşılaştırmak, hiçbir bayt '
  'kaybetmemiş bir pakette bile kalıcı olarak "15 MB eksik" gösterirdi '
  '(MTC ölçüsü: 26 atlanan dosya, 15,4 MB). Beklenen = bytes_total − bu.';

comment on column public.drawing_packages.stored_count is
  'Depoda KENDİ nesnesi bulunan dosya satırı sayısı. `verifyStorage` bunu '
  'bucket''ı LİSTELEYEREK yazar — istemcinin beyanından değil. file_count ile '
  'arasındaki fark ya atlanmış (skipped_count) ya da ULAŞMAMIŞ dosyadır.';

comment on column public.drawing_packages.stored_bytes is
  'Bucket''ta bu paket klasörünün GERÇEK bayt toplamı (nesne üstverisinden). '
  'bytes_total istemcinin beyanıdır; ikisi ayrı durur ki karşılaştırılabilsin.';

comment on column public.drawing_packages.skipped_count is
  'Bilerek yüklenmemiş satır sayısı: `haric` yaşam döngüsü (yedek/çalışma '
  'dosyası) + bayt bayt kopyalar. Kopyanın storage_path''i ASLININKİNİ '
  'gösterir, yani dosya yine açılır; yalnız ikinci bir nesne yazılmaz.';

-- YÜKLEME HATASININ SEBEBİ SAKLANIR.
--
-- Eski sihirbaz `if (error) hatalar.push(d.relPath)` diyordu: `error.message`
-- ve HTTP durumu ATILIYORDU. Bir dosyanın neden ulaşmadığı sorusu bu yüzden
-- CEVAPSIZDI — ne kullanıcı ne de biz bilebiliyorduk. Metin burada durur ki
-- soru bir daha sorulduğunda cevabı olsun.
alter table public.drawing_files
  add column if not exists upload_error text not null default '',
  add column if not exists upload_skipped boolean not null default false;

comment on column public.drawing_files.upload_skipped is
  'Bu satırın baytları BİLEREK gönderilmedi. İki hâli var: `haric` dosyalar '
  '(deftere girmiyorlar, depoya da girmesinler) ve bayt bayt kopyalar '
  '(storage_path aslınınkini gösterir, dosya yine açılır). `stored = false` '
  'olması bir EKSİK DEĞİLDİR; ekranlar ve doğrulama bu ikisini ayırmak '
  'zorundadır.';

comment on column public.drawing_files.stored is
  'Bu satırın KENDİ nesnesi depoda var mı. `verifyStorage` bucket''ı '
  'listeleyerek yazar. Kopya satırlarda false''tur (kendi nesnesi yoktur) ama '
  'upload_skipped true olduğu için EKSİK sayılmaz.';

-- Yarım kalmış yüklemeyi bulan tarama (`resume-card`, `loadMissingUploads`)
-- artık "eksik" derken atlananları dışarıda bırakıyor; süzgeç indekslenir.
create index if not exists dwg_files_eksik_idx
  on public.drawing_files (package_id)
  where not stored and not upload_skipped;

-- ═══════════════════════════════════════════ 2. Paket olayları (denetim)
--
-- NEDEN `audit_log` DEĞİL: o tablo `project_id` / `revision_id` yabancı
-- anahtarlarıyla HESAP RAPORUNA bağlıdır ve teknik resim paketi bambaşka bir
-- tanedir. Zorlamak iki modülü birbirine düğümler, teknik resim silinince
-- denetim satırı da yetim kalırdı.
--
-- Olay zinciri paketin BİYOGRAFİSİDİR: kim yükledi, kim doğruladı, hangi
-- revizyon neyi süperse etti, kaç üretim kaydı taşındı. Sürümler sekmesi bunu
-- zaman çizelgesi olarak okur.
create table if not exists public.drawing_package_events (
  id uuid primary key default gen_random_uuid(),

  -- `on delete cascade` DEĞİL `set null`: paket silindiğinde "silindi" olayı
  -- kalmalıdır, yoksa silme kaydı kendi kendini yok eder.
  package_id uuid references public.drawing_packages (id) on delete set null,

  -- Silinmiş bir paketin olayı hâlâ okunabilsin diye ad da KOPYALANIR.
  folder_name text not null default '',

  event text not null,     -- olusturuldu | revizyon | superse | silindi
                           -- dogrulandi | icerik_okundu | eslestirildi
                           -- | ilerleme_devri | dosya_eklendi
  detail jsonb not null default '{}'::jsonb,

  actor uuid references public.profiles (id),
  at timestamptz not null default now()
);

create index if not exists dwg_events_pkg_idx on public.drawing_package_events (package_id, at desc);
create index if not exists dwg_events_at_idx on public.drawing_package_events (at desc);

comment on table public.drawing_package_events is
  'Paketin biyografisi. audit_log KULLANILMAZ: o tablo hesap raporuna '
  '(project_id/revision_id) bağlıdır ve teknik resim paketi bambaşka bir '
  'tanedir. package_id `set null` taşır ki "silindi" olayı silmeden sağ çıksın.';

-- ═══════════════════════════════════ 3. Revizyon: üretim kaydının devri
--
-- İYİ HABER TASARIMDA ZATEN VARDI: `drawing_part_progress` (item_no, part_code,
-- stage) ile anahtarlanır — PAKETE DEĞİL PARÇAYA bağlıdır. Yani yeni bir
-- revizyon eski kayıtları zaten silmez. Eksik olan DEVRİN KENDİSİ ve DÜRÜSTLÜĞÜ.
--
-- `review_required` bu maddenin kalbidir: sac büyüdüyse eskiden kesilen parça
-- artık yanlıştır. "Kesildi" demeyi sürdürmek atölyeye yalan söylemektir;
-- silmek de yanlıştır, çünkü belki hâlâ kullanılabilir — kararı insan verir.
alter table public.drawing_part_progress
  add column if not exists review_required boolean not null default false,
  add column if not exists review_reason text not null default '',
  add column if not exists carried_from_package_id uuid
    references public.drawing_packages (id) on delete set null;

create index if not exists dwg_progress_review_idx
  on public.drawing_part_progress (review_required)
  where review_required;

comment on column public.drawing_part_progress.review_required is
  'Parça yeni revizyonda İMALATI ETKİLEYECEK biçimde değişti (ölçü · malzeme · '
  'kalınlık · adet · kategori); kayıt devroldu ama insan bakmalı. Tanım metni '
  'ya da montaj başlığı düzeltmesi bu işareti ÜRETMEZ — yoksa her revizyonda '
  'her kayıt işaretlenir ve işaret anlamını yitirirdi.';

-- ═══════════════════════════════════════ 4. Silme: kim ve NE silebilir
--
-- İKİ SORU AYRI SORULUR (ev emsali: `guard_issued_revision` ile
-- `revisions_delete` politikası):
--   KİM  → RLS politikası
--   NE   → tetikleyici
--
-- KİM: `is_admin()` → `can_edit_drawings()`. Emsal `canEditReports`tir:
-- "raporu açan mühendis kendi taslağını temizlemek için yöneticiyi
-- beklememelidir". Burada gerekçe daha da güçlü — paketi ÜRETEN ressamdır ve
-- yanlış klasörü fark eden İLK KİŞİ odur. Eski düzende ressam silme düğmesini
-- görüyor, depo nesneleri gidiyor (depo RLS'i onu geçiriyordu) ama tablo
-- silmesi reddediliyordu: BAYTLAR YOK, KAYITLAR YERİNDE. Paket ekranda
-- sapasağlam görünüp her dosyası boş kalıyordu. Sessiz, geri dönüşsüz kayıp.
drop policy if exists drawing_packages_delete on public.drawing_packages;
create policy drawing_packages_delete on public.drawing_packages
  for delete to authenticated using (public.can_edit_drawings());

-- NE: üretime girmiş paket silinemez.
--
-- Atölye o resimlere bakarak iş yaptıysa paket bir TASLAK değil ARŞİV
-- BELGESİDİR. Kural ressamı da yöneticiyi de bağlar; yönetici için de doğrudur.
--
-- ANLAMLI ilerleme aranır (`qty_done > 0` ya da tarih girilmiş), satırın var
-- olması yetmez: pano bir aşamayı geri alırken satırı sıfırlayıp bırakabilir ve
-- sıfır kayıt yüzünden silmeyi reddetmek YANLIŞ ALARM olurdu.
--
-- İlerleme parçaya METİNLE bağlıdır (item_no, part_code) — `package_id` yalnız
-- bir kolaylık bağıdır ve `on delete set null` taşır. Bu yüzden iki yoldan da
-- bakılır: doğrudan bağ VE metin eşleşmesi.
create or replace function public.guard_drawing_package_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kayit int;
begin
  select count(*) into kayit
  from public.drawing_part_progress p
  where (p.qty_done > 0 or p.done_at is not null)
    and (
      p.package_id = old.id
      or (
        old.item_no <> ''
        and p.item_no = old.item_no
        and exists (
          select 1 from public.drawing_parts d
          where d.package_id = old.id and d.part_code = p.part_code
        )
      )
    );

  if kayit > 0 then
    raise exception
      'Bu paket üretime girmiş (% üretim kaydı). Silinemez; yerine yeni revizyon yükleyin.',
      kayit;
  end if;

  return old;
end;
$$;

drop trigger if exists guard_drawing_package_delete on public.drawing_packages;
create trigger guard_drawing_package_delete
  before delete on public.drawing_packages
  for each row execute function public.guard_drawing_package_delete();

-- ═══════════════════════════════════════════════════ 5. Olay tablosu RLS
--
-- Denetim kaydı EKLENİR, DEĞİŞTİRİLMEZ, SİLİNMEZ (audit_log ile aynı ruh).
-- Okuma herkese: teknik resim atölyenin ortak gerçeğidir.
alter table public.drawing_package_events enable row level security;

drop policy if exists drawing_package_events_select on public.drawing_package_events;
drop policy if exists drawing_package_events_insert on public.drawing_package_events;
drop policy if exists drawing_package_events_update on public.drawing_package_events;
drop policy if exists drawing_package_events_delete on public.drawing_package_events;

create policy drawing_package_events_select on public.drawing_package_events
  for select to authenticated using (true);
create policy drawing_package_events_insert on public.drawing_package_events
  for insert to authenticated with check (public.can_edit_drawings());

-- ═══════════════════════════════════════════════════════ 6. Bucket sınırı
--
-- 50 MB → 200 MB. Gözlenen en büyük dosya 5,6 MB ama büyük bir genel görünüş
-- montaj DWG'si bunu aşabilir ve YÜKLEMENİN REDDEDİLMESİ bu modülün
-- kabul etmediği tek sonuçtur. Pro planında tavan çok yüksek; dar tutmanın
-- hiçbir kazancı yok.
update storage.buckets set file_size_limit = 209715200 where id = 'drawings';

-- ═══════════════════════════════════ 7. Mevcut paketler için başlangıç
--
-- Bu paketler ESKİ SİHİRBAZLA yüklendi: atlama yoktu, her satırın kendi nesnesi
-- var. `stored` beyandan yazılmış olsa da nesneler gerçekten orada — sayaçları
-- oradan başlatmak, ilk `verifyStorage` çalışana kadar ekranın "0/174 depoda"
-- gibi bir YALAN söylemesini engeller. `verified_at` BİLEREK boş bırakılır:
-- bu bir ölçüm değil devralmadır ve ekran "henüz doğrulanmadı" demelidir.
update public.drawing_packages p
   set stored_count = k.adet,
       stored_bytes = k.bayt
  from (
    select package_id, count(*) as adet, coalesce(sum(size_bytes), 0) as bayt
    from public.drawing_files
    where stored
    group by package_id
  ) k
 where k.package_id = p.id
   and p.stored_count = 0;

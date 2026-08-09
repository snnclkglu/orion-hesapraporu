-- Faz V — Teknik Resimler modülü: paket kaydı, dosya defteri, parça defteri.
--
-- Teknik ressam her iş için bir klasör üretip Google Drive'a koyuyordu;
-- uygulama o klasörü hiç görmüyordu. `public.drawings` tablosu var ama elle
-- yazılmış bir Drive linkinden ibaret: bir NİYET DEFTERİ, içerik değil.
--
-- MEVCUT `public.drawings` TABLOSUNA DOKUNULMAZ. Gerekçe:
--   · TANE FARKLI. `drawings` `project_id`ye (bir vincin HESAP RAPORUNA)
--     bağlıdır; paket iş KALEMİNE bağlanır. Bir kalemin raporu hiç olmayabilir
--     ve `project_id`yi zorunlu kılmak o paketleri kaydedilemez yapardı.
--   · DOĞRULUK DÜZEYİ FARKLI. Orada elle yazılmış bir Drive linki, burada
--     imzası doğrulanmış baytlar var. Aynı tabloda dursalar her okuyucuya
--     "bu satır gerçek mi yoksa niyet mi" sorusunu sordururdu.
--   · CANLI EKRAN KIRILIR: projects/actions.ts (createDrawing/update/delete),
--     drawing-dialog.tsx ve proje detayındaki "Teknik Çizimler" sekmesi hâlâ
--     o tabloyu okuyor.
-- Emekliliği kendi fazıdır; köprü olarak proje detayına salt-okunur bir kart
-- eklenecek.
--
-- AD ÇAKIŞMASI: `public.drawing_status` enum'u 20260719000006'da alındı.
-- Bu fazın bütün enum'ları `dwg_` öneklidir.
--
-- TEMEL İLKE — HOŞGÖRÜLÜ ANLAMA. Şemadaki neredeyse her alan BOŞ OLABİLİR ve
-- hiçbir kısıt bir yüklemeyi düşürmez. Sistem klasöre biçim dayatmaz, klasörü
-- anlamaya çalışır; anlayamadığını da saklar. Bunun sebebi ölçülmüş bir
-- gerçek: incelenen iki teslim klasörü birbirine benzemiyordu (tireli ↔ alt
-- çizgili ad, düz ↔ üç seviye iç içe yapı, 1 ↔ 7 Excel, 7/9/11/13/14 sütun).
-- Üçüncüsü de benzemeyecek. Bir teknik ressamın klasörünü sistemin reddetmesi,
-- o ressamın bir daha sistemi kullanmaması demektir.

-- ------------------------------------------------------------------ yetki
-- Teknik Resimler: paket yükleme ve düzenleme yetkisi.
--
-- OKUMA HERKESE AÇIKTIR ve bu yüzden `can_see_drawings()` YOKTUR: teknik resim
-- atölyenin ortak gerçeğidir — hesabı yapan mühendis de, işi izleyen müdür de
-- aynı resme bakar. Satış rakamından farklı olarak gizlenecek bir yanı yoktur.
--
-- YAZMA üç roldedir ve bu küme uygulamadaki DİĞER ÜÇ KÜMENİN HİÇBİRİNE eşit
-- değildir; sorunun ayrı sorulma sebebi budur:
--   · Teknik Ressam paketi ÜRETEN kişidir.
--   · Mühendis yanlış kaleme düşmüş bir paketi düzeltip yeniden
--     eşleştirebilmelidir; ressamı beklemek imalatı durdurur.
--   · Müdür mühendislik ürünü yazmaz.
-- Arayüz karşılığı `canEditDrawings` (lib/roles.ts); rol kümesi
-- lib/__tests__/roles.test.ts'te dondurulmuştur.
create or replace function public.can_edit_drawings()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'engineer', 'draftsman')
  );
$$;

-- ------------------------------------------------------------------ enum'lar
do $$ begin
  if not exists (select 1 from pg_type where typname = 'dwg_package_status') then
    create type public.dwg_package_status as enum ('yukleniyor','yuklendi','aktif','superse');
  end if;
  if not exists (select 1 from pg_type where typname = 'dwg_file_role') then
    create type public.dwg_file_role as enum ('model','resim','kesim','bukum','bom','model3d','diger');
  end if;
  if not exists (select 1 from pg_type where typname = 'dwg_file_lifecycle') then
    create type public.dwg_file_lifecycle as enum ('canli','superse','iptal','kopya','haric');
  end if;
  if not exists (select 1 from pg_type where typname = 'dwg_part_kind') then
    create type public.dwg_part_kind as enum ('montaj','imalat','satinalma','bilinmiyor');
  end if;
  -- ÜÇ DÜZEY VAR, "ENGELLEYİCİ" YOK. Hesap motorunda `engelleyici` bir
  -- kontrolün sağlanmadan revizyonun yayınlanmaması demektir; burada öyle bir
  -- karşılık OLAMAZ çünkü yükleme her zaman başarılıdır. Düzeyler rapordaki
  -- bölümlerle birebir: Eksikler · Çelişkiler · Bilgi.
  if not exists (select 1 from pg_type where typname = 'dwg_finding_kind') then
    create type public.dwg_finding_kind as enum ('eksik','celiski','bilgi');
  end if;
end $$;

-- --------------------------------------------------------- drawing_packages
create table if not exists public.drawing_packages (
  id uuid primary key default gen_random_uuid(),

  -- KLASÖR ADI ASLIDIR ve HAM SAKLANIR. İki gerçek örnek iki ayrı dilbilgisi
  -- kullanıyor ("… - AD (KAPASİTE)" ve "…_AD"); üçüncüsü de gelecektir.
  -- Ayrıştırma boş dönebilir — paket yine açılır, adı olduğu gibi görünür.
  -- `recognized_by` hangi tanıyıcının tuttuğunu yazar ('' = hiçbiri).
  folder_name text not null,
  recognized_by text not null default '',

  -- KALEM NUMARASI METİN, BAĞLANTI TÜREVDİR (İş Takibi ile aynı kural).
  -- `autoItemNos` ikinci kalem eklendiğinde 0057-00'ı 0057-01'e KAYDIRIR ama
  -- ressamın klasör adı ve içindeki parça kodları o gün değişmez. Metin her
  -- zaman durur, `job_item_id`/`job_id` eşleştiği ölçüde dolar, eşleşmeyen
  -- paket DÜŞÜRÜLMEZ — listede ayrıca sayılır ve toplu yeniden bağlanır.
  item_no text not null default '',
  job_id uuid references public.jobs (id) on delete set null,
  job_item_id uuid references public.job_items (id) on delete set null,

  job_code text not null default '',      -- 0057 / 0043
  item_suffix text not null default '',   -- 00
  group_code text not null default '',    -- 0500 (monoray) / 0000 (işin tamamı)
  description text not null default '',   -- MONORAY / MTC PASLANMAZ
  capacity text not null default '',      -- 1 TON (yoksa boş)

  rev_no int not null default 1,
  supersedes_id uuid references public.drawing_packages (id) on delete set null,
  status public.dwg_package_status not null default 'yukleniyor',

  -- SAYAÇLAR: liste ekranı 454 satır okumadan paketin hâlini gösterebilmeli.
  file_count int not null default 0,
  bytes_total bigint not null default 0,
  part_count int not null default 0,
  unrecognized_count int not null default 0,
  finding_counts jsonb not null default '{}'::jsonb,  -- {"eksik":1,"celiski":9,"bilgi":31}

  -- TANIMA ORANI bir NOT DEĞİLDİR: ressamın performansını değil SİSTEMİN
  -- KAVRAYIŞINI ölçer ve ekranda öyle yazılır ("bu paketin %94'ünü
  -- tanıyabildim"). Kural çiğnemek diye bir şey yoktur.
  recognition_pct int,

  -- 0900 + 0901 gibi yerel istisnalar: kullanıcı birleştirir, kod uydurmaz.
  group_map jsonb not null default '{}'::jsonb,

  -- İçerik okuma ve eşleştirme AYRI aşamalardır, AYRI damgalanır: eşleştirme
  -- kuralları değişince paketi YENİDEN İNDİRMEDEN çalıştırabilmek için.
  -- (Hesap motorundaki ENGINE_VERSION ile aynı ruhta; `RECONCILER_VERSION`.)
  parsed_at timestamptz,
  reconciled_at timestamptz,
  reconciler_version int not null default 0,

  notes text not null default '',
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dwg_packages_item_idx on public.drawing_packages (item_no);
create index if not exists dwg_packages_job_idx on public.drawing_packages (job_id);
create index if not exists dwg_packages_job_item_idx on public.drawing_packages (job_item_id);
create index if not exists dwg_packages_group_idx on public.drawing_packages (item_no, group_code);
create index if not exists dwg_packages_status_idx on public.drawing_packages (status);

comment on table public.drawing_packages is
  'Bir YÜKLEME = bir paket, klasör ne kadar derin olursa olsun. MTC paketinde '
  '0043-00-0050 gibi alt klasörler var; onlar ayrı paket DEĞİL yoldur. Parça '
  'kodları paketin tamamında tutarlı olduğu için ağaç zaten kodlardan ve ürün '
  'ağacından kurulur; iç içe paket modeli her sorguya bir özyineleme borcu '
  'eklerdi. TEKİLLİK KISITI YOKTUR: aynı (kalem, grup) ikinci kez yüklenirse '
  'veritabanı reddetmez, sihirbaz "öncekini süperse edeyim mi?" diye SORAR. '
  'Bir yüklemeyi kısıt hatasıyla düşürmek, ressamın bir daha denememesidir.';

-- ------------------------------------------------------------ drawing_files
create table if not exists public.drawing_files (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.drawing_packages (id) on delete cascade,

  -- Tarayıcının `webkitRelativePath`inden kök atılmış, NFC normalize edilmiş
  -- hâli: "0043-00-0050 - BARA AKIM ALMA KOLU/DXF/S235JR-8MM/….dxf"
  --
  -- YOL SEMANTİKTİR ama BEYANDIR: "İPTAL" bir klasör değil bir DURUM,
  -- "S235JR-8MM" bir malzeme BEYANIDIR — ve iki gerçek pakette de o beyan
  -- yanlış çıktı (klasör S235JR derken dosya adı S355JR diyordu, BOM dosya
  -- adını doğruladı). Bu yüzden hem yol hem addan çıkan değer saklanır.
  rel_path text not null,
  folder text not null default '',
  file_name text not null,
  ext text not null default '',

  role public.dwg_file_role not null default 'diger',
  lifecycle public.dwg_file_lifecycle not null default 'canli',

  -- Tanıma sonucu. HEPSİ BOŞ OLABİLİR — dosya yine saklanır ve listelenir.
  part_code text not null default '',
  material text not null default '',       -- "S355JR" | "BDS" | "Kestamid": desen dayatılmaz
  thickness_mm numeric(8,2),
  qty int,
  label text not null default '',          -- addaki serbest açıklama
  recognized_by text not null default '',  -- '' ise tanınmadı (elle bağlanabilir)
  folder_material text not null default '',
  folder_thickness_mm numeric(8,2),

  size_bytes bigint not null default 0,
  -- SHA-256, tarayıcıda `crypto.subtle` ile hesaplanır. BÜKÜM PDF'lerinin
  -- DWG\ altındaki eşlerinin BAYT BAYT AYNISI olduğunu yalnız bu söyler — ve
  -- MTC'de iki FARKLI parçanın aynı PDF'i taşıdığını da (gerçek bir ressam
  -- hatası) yine bu ortaya çıkardı.
  checksum text not null default '',

  -- Depo anahtarı OPAKTIR: "{package_id}/{id}". Türkçe "İ" (U+0130) taşıyan
  -- gerçek yolu anahtar yapmak imzalı bağlantı ve kodlama tarafında sessiz
  -- hatalar üretir; gerçek ad indirmede Content-Disposition ile verilir.
  storage_path text not null default '',
  stored boolean not null default false,

  meta jsonb not null default '{}'::jsonb, -- Faz 2: DXF başlığı / PDF anteti

  superseded_file_id uuid references public.drawing_files (id) on delete set null,
  duplicate_of_id uuid references public.drawing_files (id) on delete set null,

  created_at timestamptz not null default now()
);

-- Yolun paket içinde TEKİL olması, yarıda kalmış bir yüklemeyi kaldığı yerden
-- sürdürülebilir yapar: 454 dosyada bu vazgeçilmezdir.
create unique index if not exists dwg_files_path_key on public.drawing_files (package_id, rel_path);
create index if not exists dwg_files_code_idx on public.drawing_files (package_id, part_code);
create index if not exists dwg_files_sum_idx on public.drawing_files (package_id, checksum);
create index if not exists dwg_files_role_idx on public.drawing_files (package_id, role);

-- --------------------------------------------------------- drawing_bom_rows
-- BOM'un HAM FOTOĞRAFI. Bilinen alanlar adlandırılmış sütunlarda, GERİ KALAN
-- HER ŞEY `extra`da durur; hiçbiri zorunlu değil ve HEPSİ METİNDİR.
--
-- Neden sabit şema değil: iki pakette dokuz çalışma sayfası ve BEŞ AYRI SÜTUN
-- ŞEKLİ (7 · 9 · 11 · 13 · 14) var, sayfa adları `BOM` · `Sayfa1` · `Sayfa2`.
-- Neden ham metin: `QTY` sütunu çoğu satırda tam sayı ama `Category = Testere`
-- satırlarında bir KESİM BOYUdur ("169,3 mm"). Ham değeri okuma anında sayıya
-- zorlamak o bilgiyi sessizce yok ederdi.
--
-- Bu tablo sayesinde eşleştirme kuralı değiştiğinde 200 MB'lık paket yeniden
-- YÜKLENMEDEN yeniden çalıştırılabilir.
create table if not exists public.drawing_bom_rows (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.drawing_packages (id) on delete cascade,
  file_id uuid references public.drawing_files (id) on delete set null,
  sheet_name text not null default '',
  source_kind text not null default 'bilinmiyor',  -- depo | urun_agaci | bilinmiyor
  row_no int not null,

  item_path text not null default '',      -- "1.2.3" — ÜRÜN AĞACI'nda GERÇEK hiyerarşi
  part_number text not null default '',
  bom_structure text not null default '',
  description text not null default '',
  title text not null default '',
  material_raw text not null default '',
  item_qty_raw text not null default '',
  qty_raw text not null default '',
  category text not null default '',
  mass_raw text not null default '',       -- "1498,457 kg"
  rev_raw text not null default '',
  extra jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create unique index if not exists dwg_bom_row_key
  on public.drawing_bom_rows (package_id, file_id, sheet_name, row_no);
create index if not exists dwg_bom_part_idx on public.drawing_bom_rows (package_id, part_number);

-- ------------------------------------------------------------ drawing_parts
-- EŞLEŞTİRİLMİŞ DEFTER — türetilmiştir, her eşleştirmede yeniden kurulur.
create table if not exists public.drawing_parts (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.drawing_packages (id) on delete cascade,

  part_code text not null default '',
  bom_row_id uuid references public.drawing_bom_rows (id) on delete set null,
  bom_seq int,

  -- DEFTER ANAHTARI. Bir BOM'un satırlarının yarısında parça numarası YOKTUR
  -- (civata, segman, rulman, satın alınan üniteler) ama onlar da deftere
  -- girmelidir: satın alma listesi tam olarak onlardan çıkar. Kodu olmayan
  -- satır kendi sırasıyla anahtarlanır.
  register_key text generated always as (
    case when btrim(part_code) <> '' then btrim(part_code)
         else 'SATIR:' || coalesce(bom_seq, 0)::text end
  ) stored,

  -- İKİ AĞAÇ KAYNAĞI, biri her zaman var:
  --   parent_code — parça kodundan son "-NN" atılarak TÜRETİLİR (her pakette)
  --   item_path   — ÜRÜN AĞACI'nın "1.2.3" sütunu (varsa; Inventor montaj
  --                 yapısının kendisi ve daha doğrudur)
  -- Çeliştiklerinde ağaç `item_path`ten kurulur ve `celiski` bulgusu basılır.
  -- MTC'de bu gerçekten oldu: kod `-00-` diye bir ara düzey taşıyor ama
  -- Inventor'da öyle bir montaj yok.
  parent_code text not null default '',
  item_path text not null default '',
  level int not null default 0,
  kind public.dwg_part_kind not null default 'bilinmiyor',

  name text not null default '',
  description text not null default '',
  assembly_title text not null default '',
  material text not null default '',
  material_raw text not null default '',
  category text not null default '',
  qty int,
  cut_length_mm numeric(10,2),   -- kirli QTY sütunundan (Testere / profil)
  thickness_mm numeric(8,2),
  -- ÜRÜN AĞACI'nın `Mass` sütunundan gelir; MTC'de 246/246 satır doluydu.
  -- Ağırlık için PDF antedi okumaya bu yüzden Faz 1'de GEREK KALMADI.
  weight_kg numeric(12,3),
  extents_x_mm numeric(12,3),    -- Faz 2 (DXF)
  extents_y_mm numeric(12,3),    -- Faz 2 (DXF)

  has_model boolean not null default false,
  has_sheet boolean not null default false,
  has_cut boolean not null default false,
  has_3d boolean not null default false,
  sheet_file_id uuid references public.drawing_files (id) on delete set null,
  cut_file_id uuid references public.drawing_files (id) on delete set null,

  sort int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists dwg_parts_key on public.drawing_parts (package_id, register_key);
create index if not exists dwg_parts_parent_idx on public.drawing_parts (package_id, parent_code);
create index if not exists dwg_parts_cat_idx on public.drawing_parts (package_id, category);
create index if not exists dwg_parts_code_idx on public.drawing_parts (part_code);

-- --------------------------------------------------------- drawing_findings
create table if not exists public.drawing_findings (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.drawing_packages (id) on delete cascade,
  code text not null,                       -- PARCA_RESIMSIZ, AYNI_ICERIK_FARKLI_PARCA…
  kind public.dwg_finding_kind not null default 'bilgi',
  subject text not null default '',         -- parça kodu ya da dosya yolu
  title text not null,                      -- tek Türkçe cümle; SUÇLAMAZ
  detail text not null default '',          -- öneri (emir kipi değil)
  data jsonb not null default '{}'::jsonb,
  hint_id text not null default '',         -- Ö-1…Ö-9, öneri belgesine bağlanır
  created_at timestamptz not null default now()
);

create index if not exists dwg_findings_pkg_idx on public.drawing_findings (package_id, kind);

-- "Bunu gördüm, kabul ediyorum." Bulgular HER eşleştirmede silinip yeniden
-- üretilir; onay onlarla birlikte gitmemelidir, bu yüzden AYRI TABLODA ve
-- METİN ANAHTARLIDIR.
create table if not exists public.drawing_finding_acks (
  package_id uuid not null references public.drawing_packages (id) on delete cascade,
  code text not null,
  subject text not null default '',
  note text not null default '',
  acked_by uuid references public.profiles (id),
  acked_at timestamptz not null default now(),
  primary key (package_id, code, subject)
);

-- ---------------------------------------------------------- drawing_aliases
-- ÖĞRENEN EŞLEŞTİRME. Tanınmayan bir klasör/dosya deseni için kullanıcı bir
-- kez "bu şu koda ait" derse sistem bunu HATIRLAR ve sonraki pakette
-- kendiliğinden çözer. Kuralı sıkılaştırmadan isabeti artırmanın yolu budur:
-- sistem kullanıldıkça hoşgörüsünü kaybetmeden daha çoğunu anlar.
create table if not exists public.drawing_aliases (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'klasor',   -- klasor | dosya | malzeme | kategori
  pattern text not null,                  -- "HALAT KLAVUZU (Ø325)"
  resolves_to text not null,              -- "0043-00-0850"
  note text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create unique index if not exists dwg_alias_key on public.drawing_aliases (scope, pattern);

-- ---------------------------------------------------- üretim durumu (Faz V5)
-- ÜRETİM DURUMU DEFTERİ ŞİMDİDEN AYRI TABLODADIR ve METİN ANAHTARLIDIR.
--
-- `drawing_parts` TÜRETİLMİŞ bir tablodur: eşleştirme her çalıştığında silinip
-- yeniden kurulur ve ressam düzeltilmiş paketi yeniden yükleyebilir. Atölyenin
-- "bu parça kesildi" kaydı o döngüde KAYBOLMAMALIDIR. İş Takibi'nin dersi
-- aynen uygulanır: numara METİN durur, paket/parça bağlantısı TÜREVDİR.
--
-- Anahtar (kalem no, parça kodu, aşama) — yani ilerleme PAKETE DEĞİL PARÇAYA
-- bağlıdır ve parçanın yeni paket sürümünde de aynı ilerlemeyi taşır.
--
-- İhtiyacın kanıtı elimizde: MTC paketinde ressam `DXF/0043-00-0100 - ANA
-- KIRIS - KESİLDİ/` diye bir klasör açmış. Durumu yazacak yeri olmadığı için
-- klasör adına yazmış.
create table if not exists public.drawing_part_progress (
  id uuid primary key default gen_random_uuid(),
  item_no text not null,
  part_code text not null,
  stage text not null,                    -- satinalindi | kesildi | bukuldu | …
  qty_done int not null default 0,
  done_at date,
  note text not null default '',
  package_id uuid references public.drawing_packages (id) on delete set null,
  part_id uuid references public.drawing_parts (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dwg_progress_key
  on public.drawing_part_progress (item_no, part_code, stage);

-- --------------------------------------------------------------- updated_at
drop trigger if exists touch_drawing_packages on public.drawing_packages;
create trigger touch_drawing_packages before update on public.drawing_packages
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_drawing_part_progress on public.drawing_part_progress;
create trigger touch_drawing_part_progress before update on public.drawing_part_progress
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------- RLS
alter table public.drawing_packages enable row level security;
alter table public.drawing_files enable row level security;
alter table public.drawing_bom_rows enable row level security;
alter table public.drawing_parts enable row level security;
alter table public.drawing_findings enable row level security;
alter table public.drawing_finding_acks enable row level security;
alter table public.drawing_aliases enable row level security;
alter table public.drawing_part_progress enable row level security;

-- OKUMA HERKESE (jobs/job_items ile aynı düzen). Fiyat değil, resimdir.
-- YAZMA `can_edit_drawings()`.
-- PAKET SİLME YALNIZ YÖNETİCİDE: bir paketi silmek 450'yi aşkın depo nesnesini
-- ve defteri birlikte götürür (evin kuralı: yıkıcı işlem yöneticidedir).
do $$
declare
  t text;
begin
  foreach t in array array[
    'drawing_packages','drawing_files','drawing_bom_rows','drawing_parts',
    'drawing_findings','drawing_finding_acks','drawing_aliases','drawing_part_progress'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_edit_drawings())',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_edit_drawings()) with check (public.can_edit_drawings())',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      t || '_delete', t,
      case when t = 'drawing_packages' then 'public.is_admin()' else 'public.can_edit_drawings()' end);
  end loop;
end $$;

-- ------------------------------------------------------------------- bucket
-- Dosya sınırı BİLİNÇLİ OLARAK CÖMERT (50 MB): gözlenen en büyük dosya
-- 5,56 MB ama büyük bir genel görünüş resmi yüzünden yükleme reddedilmesin.
insert into storage.buckets (id, name, public, file_size_limit)
values ('drawings', 'drawings', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- `contracts`/`reports`tan DAHA SIKI: oralarda her authenticated kullanıcı
-- yazabiliyor. Buradaki yanlış bir silme, yeniden yüklenebilir tek bir PDF'i
-- değil içe aktarılmış 450 dosyalık bir paketi kaybettirir.
drop policy if exists "drawings okuma (authenticated)" on storage.objects;
create policy "drawings okuma (authenticated)" on storage.objects
  for select to authenticated using (bucket_id = 'drawings');

drop policy if exists "drawings yükleme (teknik resim yetkisi)" on storage.objects;
create policy "drawings yükleme (teknik resim yetkisi)" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'drawings' and public.can_edit_drawings());

drop policy if exists "drawings güncelleme (teknik resim yetkisi)" on storage.objects;
create policy "drawings güncelleme (teknik resim yetkisi)" on storage.objects
  for update to authenticated
  using (bucket_id = 'drawings' and public.can_edit_drawings())
  with check (bucket_id = 'drawings' and public.can_edit_drawings());

drop policy if exists "drawings silme (teknik resim yetkisi)" on storage.objects;
create policy "drawings silme (teknik resim yetkisi)" on storage.objects
  for delete to authenticated
  using (bucket_id = 'drawings' and public.can_edit_drawings());

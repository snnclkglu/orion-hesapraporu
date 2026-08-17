-- Faz V7/1 — GÖREV ETİKETLERİ ve İŞ KALEMİ ADEDİ.
--
-- İki ayrı konu tek migration'da duruyor çünkü ikisi de Satın Alma bölümünün
-- ÖN KOŞULUdur: bölümü kimin göreceğini birincisi, listedeki adetlerin neyle
-- çarpılacağını ikincisi söyler.
--
-- MEVCUT MIGRATION DEĞİŞTİRİLMEZ ("uygulanmış bir migration düzenlenmez").

-- ═══════════════════════════════════════════════ 1. GÖREV ETİKETLERİ
--
-- BEŞİNCİ BİR ROL AÇILMADI ve bu bilinçli bir karardır.
--
-- `user_role` TEK DEĞERLİdir ve kişinin uygulamadaki ana kimliğini taşır
-- (Yönetici · Müdür · Mühendis · Teknik Ressam). Satınalmacıyı "Satın Alma"
-- rolüne almak o kişinin mühendis mi müdür mü olduğunu SİLERDİ: Üretim
-- Planlama Sorumlusu hem Müdür'dür (satış takibini görür) hem Planlama işini
-- yapar (satın almayı görür) ve tek değerli bir alanda bu ifade edilemez.
--
-- Etiket ROLÜN YANINA gelir, yerine geçmez. Kullanıcı bunu açıkça böyle
-- istedi: "yönetici mühendis ressam ve müdürün YANINA … taglar açalım".
--
-- `text[]` seçildi, ayrı bir tablo DEĞİL. Gerekçe ölçüdür: küme kapalı (üç
-- değer), kişi başına en çok üç satır olurdu ve her yetki sorusu bir JOIN
-- daha isterdi. RLS fonksiyonları en sıcak yoldur; orada dizi içi arama
-- (`&&`) tek tablo okumasıdır.
--
-- KISIT LİSTEYİ KAPATIR: serbest metin bir etiket bir sabah yetki sorusunun
-- görmediği bir değere dönüşür ve kimse fark etmez. Enum yerine `check`
-- kullanılır çünkü diziye enum koymak sonradan değer eklemeyi (enum'a değer
-- eklenen işlemde o değer literal olarak kullanılamaz) gereksiz zorlaştırırdı.
alter table public.profiles
  add column if not exists tags text[] not null default '{}'::text[];

alter table public.profiles
  drop constraint if exists profiles_tags_valid;

alter table public.profiles
  add constraint profiles_tags_valid
  check (tags <@ array['satinalma','planlama','uretim']::text[]);

comment on column public.profiles.tags is
  'GÖREV etiketleri (satinalma · planlama · uretim). Rolün YERİNE değil '
  'YANINA gelir: rol tek değerlidir, kişinin firmadaki işi birden çok olabilir. '
  'Etiket yalnız KAPI AÇAR, kapatmaz.';

-- Etiket sorgusu için GIN: bugün profil sayısı iki haneli ve indeks bedava
-- sayılır, ama `can_see_purchasing()` her satın alma satırının RLS'inde
-- çalışır ve tablo taraması oraya girmemelidir.
create index if not exists profiles_tags_idx on public.profiles using gin (tags);

-- ------------------------------------------------------------ yetki soruları
--
-- `lib/roles.ts`teki `hasTag` / `canSeePurchasing`ın veritabanı karşılığı.
-- Arayüzdeki gizleme tek başına yeterli değildir (ROL-15): menüden gizlemek
-- görgü kuralı, RLS asıl engeldir.

create or replace function public.has_tag(t text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and tags @> array[t]
  );
$$;

comment on function public.has_tag(text) is
  'Oturumdaki kullanıcı bu görev etiketini taşıyor mu?';

-- SATIN ALMA: Yönetici + «Satın Alma» + «Planlama» (kullanıcı kararı).
--
-- MÜDÜR BURADA YOKTUR ve bu bir gözden kaçma değildir: müdür satış rakamını
-- görür, satın alma ise tedarikçi fiyatı ve ödeme vadesi taşır — ikisi ayrı
-- bilgidir. Müdürün girmesi gerekiyorsa ona `satinalma` etiketi verilir,
-- kural genişletilmez.
create or replace function public.can_see_purchasing()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and (role::text = 'admin' or tags && array['satinalma','planlama'])
  );
$$;

comment on function public.can_see_purchasing() is
  'Satın Alma bölümü: Yönetici + «Satın Alma»/«Planlama» etiketi. '
  'lib/roles.ts:canSeePurchasing ile AYNI kümedir.';

-- Bugün GÖRME ile aynı kümeyi döndürür ama AYRI bir sorudur (`can_see_sales`
-- ile `can_see_work_log` ayrımının aynısı): ileride "planlama görür, yalnız
-- satınalma yazar" istenirse bütün politikaları gözden geçirme borcu doğmasın.
create or replace function public.can_edit_purchasing()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_see_purchasing();
$$;

-- ═══════════════════════════════════════════ 2. İŞ KALEMİ ADEDİ (SAYISAL)
--
-- SORUN: `job_items.quantity` SERBEST METİNdir ve gerçekten öyle kullanılıyor.
-- Bugünkü defterde ölçüldü (74 kalem):
--
--     "1" (24) · "" (21) · "1 Adet" (5) · "3 Adet" (4) · "1 Takım" (3)
--     "Muhtelif" (2) · "90x2 180 m" · "10+10" · "2’ ŞER" · "500 + 300" · …
--
-- Bu alan bir ÇARPAN OLARAK OKUNAMAZ. "Muhtelif"in sayısal karşılığı yoktur ve
-- "90x2 180 m" bir adet değil bir ölçüdür. Metni ayrıştırıp 90 ya da 180
-- yazmak, teknik resim adetlerini sessizce yüz katına çıkarırdı.
--
-- ÇÖZÜM: AYRI BİR SAYISAL SÜTUN, ve NULL YAPILABİLİR.
--
-- `not null default 1` seçilmedi ÇÜNKÜ SIFIRLA AYNI TUZAĞA DÜŞERDİ (bkz.
-- AGENTS.md SATIS-16, "yer tutucu bir değer değildir"): 1 gerçek bir kabul gibi
-- görünür ve kullanıcı hiç dokunmadan geçer. `null` "bilinmiyor" demektir;
-- ekran bunu AÇIKÇA söyler ("adet belirsiz — 1 kabul edildi") ve kullanıcıdan
-- girmesini ister. Sessiz varsayım ile açık varsayım arasındaki fark budur.
--
-- `quantity` METNİ KALIYOR: iş emri PDF'i onu OLDUĞU GİBİ basar ("1 Takım",
-- "Muhtelif") ve müşteriye giden belge bir sayıya indirgenemez. İki alan iki
-- ayrı soruya cevap verir — biri "belgede ne yazacak", öbürü "kaç takım
-- imal edilecek".
alter table public.job_items
  add column if not exists qty int;

alter table public.job_items
  drop constraint if exists job_items_qty_positive;

alter table public.job_items
  add constraint job_items_qty_positive check (qty is null or qty > 0);

comment on column public.job_items.qty is
  'SAYISAL adet — teknik resim ve satın alma adetlerinin çarpanı. NULL = '
  'bilinmiyor (ekran 1 kabul eder ve bunu açıkça yazar). quantity METNİ '
  'ayrıdır: iş emri PDF''i onu olduğu gibi basar ("1 Takım", "Muhtelif").';

-- ------------------------------------------------------------------ dolgu
--
-- YALNIZ TARTIŞMASIZ OLANLAR DOLDURULUR. "3 Adet" tartışmasızdır; "10+10"
-- muhtemelen 20'dir ama MUHTEMELEN yeterli değildir — o satır `null` kalır ve
-- insan karar verir. Uydurma veri girmemenin migration'daki karşılığı budur.
--
-- Kabul edilen iki kalıp:
--   ^\s*(\d+)\s*$                    → "1", "13"
--   ^\s*(\d+)\s*(adet|takım|takim)\s*$ → "3 Adet", "1 Takım"
--
-- Üst sınır 10.000: dört haneyi aşan bir "adet" neredeyse kesinlikle bir ölçü
-- ya da bir yazım kazasıdır ve çarpan olarak felaket olurdu.
update public.job_items
set qty = (regexp_match(quantity, '^\s*(\d+)\s*(?:adet|takım|takim)?\s*$', 'i'))[1]::int
where qty is null
  and quantity ~* '^\s*\d+\s*(?:adet|takım|takim)?\s*$'
  and (regexp_match(quantity, '^\s*(\d+)', 'i'))[1]::bigint between 1 and 10000;

-- ═══════════════════════════════ 3. KALEM EŞLEŞTİRME (ORTAK TEKNİK RESİM)
--
-- Kullanıcı kararı (11.08.2026): "Bazen iki kalem arasında çok çok az
-- değişiklik oluyor, örneğin montaj konumunun farklı olması gibi, biz yine
-- yeni kalem olarak açıyoruz. Ama üretimde iki için tek resim çiziyor."
--
-- Yani: 0075-01 ve 0075-02 iki AYRI iş kalemidir (sözleşmede, iş emrinde, satış
-- takibinde ayrı satırlardır) ama TEK bir teknik resim takımı ikisini birden
-- karşılar. Ressam bire göre çizer; imalat ve satın alma İKİSİNİN TOPLAMI
-- kadar üretir ve satın alır.
--
-- MODEL: ikinci kalem birincisini İŞARET EDER. Bir "grup" tablosu açmak da
-- mümkündü ama iki satırlık bir ilişki için üçüncü bir tablo, her okumaya bir
-- JOIN daha eklerdi. Yön anlamlıdır: resmi TAŞIYAN kalem hedeftir, resmi
-- ÖDÜNÇ ALAN kalem kaynaktır — teknik resim paketi zaten hedefe bağlıdır.
--
-- `on delete set null`: işaret edilen kalem silinirse ödünç alan kalem
-- silinmez, yalnız kendi başına kalır. Ters davranış (cascade) bir iş
-- kalemini silmenin bambaşka bir kalemi de götürmesi olurdu.
alter table public.job_items
  add column if not exists shares_drawings_with uuid
    references public.job_items (id) on delete set null;

comment on column public.job_items.shares_drawings_with is
  'Bu kalemin teknik resimleri işaret edilen kalemle ORTAKTIR. Ressam bire '
  'göre çizer; imalat ve satın alma adetleri iki kalemin toplamı kadardır.';

create index if not exists job_items_shares_idx
  on public.job_items (shares_drawings_with)
  where shares_drawings_with is not null;

-- ZİNCİR VE DÖNGÜ YASAK.
--
-- A→B→C bir zincirdir ve çarpanı hesaplayan kod özyinelemeye girerdi; A→B→A
-- ise sonsuz döngüdür. İkisini de tetikleyici keser çünkü kural VERİNİN
-- kuralıdır: arayüzde engellemek yeterli değildir, aynı satır import ya da
-- doğrudan SQL ile de yazılabilir.
--
-- Kısıt SADE tutulur ve bilinçli olarak "tek seviye" der: bir kalem ya kendi
-- resmini taşır ya da BAŞKA BİR TAŞIYICIYI işaret eder. Taşıyıcı olan bir
-- kalem kendisi başkasını işaret edemez.
create or replace function public.guard_item_share()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.shares_drawings_with is null then
    return new;
  end if;

  if new.shares_drawings_with = new.id then
    raise exception 'Bir iş kalemi kendi resimlerini kendisiyle paylaşamaz.';
  end if;

  -- Hedef, kendisi de birini işaret ediyorsa zincir olurdu.
  if exists (
    select 1 from public.job_items
    where id = new.shares_drawings_with and shares_drawings_with is not null
  ) then
    raise exception
      'Seçilen kalem zaten başka bir kalemin resimlerini kullanıyor. '
      'Resmi TAŞIYAN kalemi seçin (zincir kurulamaz).';
  end if;

  -- Bu kalemi işaret eden başkaları varsa, bu kalem bir TAŞIYICIdır ve
  -- kendisi ödünç alan olamaz.
  if exists (
    select 1 from public.job_items where shares_drawings_with = new.id
  ) then
    raise exception
      'Bu kalemin resimlerini başka kalemler kullanıyor; taşıyıcı bir kalem '
      'kendisi ödünç alan olamaz.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_job_item_share on public.job_items;
create trigger guard_job_item_share
  before insert or update of shares_drawings_with on public.job_items
  for each row execute function public.guard_item_share();

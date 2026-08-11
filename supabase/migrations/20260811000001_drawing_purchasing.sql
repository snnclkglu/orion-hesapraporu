-- Faz V6 — Satın Alma bölümünün kendi verisi: teslim tarihi, teslim aşaması ve
-- kategori düzeltmesi.
--
-- Bölüm ayrıldığında (20260810 fazı) satınalmacının elinde yalnız iki hâl vardı:
-- "bekliyor" ve "satın alındı". Sahada bu yetmiyor — sipariş verilen bir kalemin
-- NE ZAMAN geleceği, satın alma listesine bakma sebebinin kendisidir. Bu
-- migration üç şey ekler:
--
--   1. `due_at`  — TAHMİNİ teslim tarihi (kesin değil; sipariş anında bilinen)
--   2. `teslim_alindi` aşaması — "sipariş verildi" ile "elimizde" ayrı hâllerdir
--   3. kategori düzeltme defteri — sözlüğün bilemediğini insan söyler ve sistem
--      HATIRLAR (md. 18/1'in `drawing_aliases` ile kurduğu kalıbın aynısı)
--
-- MEVCUT MIGRATION DEĞİŞTİRİLMEZ ("uygulanmış bir migration düzenlenmez").

-- ------------------------------------------------- 1. tahmini teslim tarihi
--
-- `done_at`IN YERİNE GEÇMEZ, YANINA GELİR. İkisi ayrı sorulardır:
--   done_at — bu işaret NE ZAMAN kondu (sipariş günü / teslim günü)
--   due_at  — malzeme NE ZAMAN gelecek (gelecek zaman, tahmin)
-- Tek alanda tutulsalardı "3 hafta sonra gelecek" ile "3 hafta önce sipariş
-- edildi" aynı hücreye yazılırdı ve ekran hangisi olduğunu bilemezdi.
--
-- Tarih TÜRÜ `date`tir, `timestamptz` değil: teslim günü bir gündür, saat
-- dilimiyle kayması gereken bir an değil.
alter table public.drawing_part_progress
  add column if not exists due_at date;

comment on column public.drawing_part_progress.due_at is
  'TAHMİNİ teslim tarihi (satın alma). done_at ile karıştırılmaz: done_at '
  'işaretin konduğu gün, due_at malzemenin beklendiği gündür.';

-- Satın alma ekranı "en yakın teslim" sırasını ister; küçük tabloda bile
-- sıralama indeksi bedava sayılır ve liste büyüdükçe kazanır.
create index if not exists dwg_progress_due_idx
  on public.drawing_part_progress (due_at)
  where due_at is not null;

-- ------------------------------------------------------ 2. teslim aşaması
--
-- SATIN ALINDI ≠ ELİMİZDE. Bir kalemin siparişi verilmiş olabilir ve altı hafta
-- sonra gelecektir; atölye o parçayı bekliyordur. Tek işaretle ikisini birden
-- söylemek, "satın alındı" görüp malzemeyi rafta arayan bir insan üretirdi.
--
-- Sıra 15: `satinalindi` (10) ile `kesildi` (20) arasına girer — satın alma
-- zinciri kendi içinde sıralı kalır ve atölye aşamaları kaymaz.
--
-- Ton 352: `satinalindi`nin 265'inden 87 derece uzak. "En az 40 derece" kuralı
-- SEKİZİNCİ AŞAMAYLA BİRLİKTE GRUBA İNDİ ve gerekçesi kuralın kendi
-- gerekçesidir: çipler bir SATIRDA yan yana durduğu için ayırt edilebilir
-- olmalıdır. Satın alma ve üretim çipleri artık aynı satırda hiç görünmez
-- (ayrı ekranlar, `productionStages` / `purchaseStages`), yedi aşamaya sekizinci
-- bir ton 40 derece aralıkla zaten sığmıyordu (7 × 40 = 280, kalan boşluk 65).
-- Grup içinde kural aynen geçerli; koruma `progress.test.ts`te grup grup ölçer.
--
-- 352 kırmızıya yakındır ama `.oc-tag` doygunluk ve parlaklığı kendi verdiği
-- için pastel bir gül tonu çıkar, uyarı kırmızısı değil. Kullanıcının istediği
-- YEŞİL sinyal çipte değil TESLİM TARİHİ sütunundadır (geçmiş kırmızı, yakın
-- sarı, teslim alınmış yeşil) — renk orada bir durum ölçüsüdür, kimlik değil.
--
-- `on conflict do nothing`: migration yeniden çalışırsa kullanıcının
-- düzelttiği ad/ton/sıra EZİLMEZ.
insert into public.drawing_stages (slug, name, sort, color_hue) values
  ('teslim_alindi', 'Teslim alındı', 15, 352)
on conflict (slug) do nothing;

-- --------------------------------------------- 3. kategori düzeltme defteri
--
-- Satın alma kategorisi tanımdan OKUNUR (`satinAlmaSinifi`, on beş ürün
-- ailesi). Sözlük iyi çalışıyor — iki gerçek pakette 126 kalemin 125'i bir
-- aileye düşüyor — ama bilemediği her satır "Diğer"de kalır ve orası
-- satınalmacının çöp kutusu olamaz.
--
-- ÇÖZÜM SÖZLÜĞÜ ŞİŞİRMEK DEĞİL, İNSANI DİNLEMEK. Kullanıcı bir kalemi doğru
-- kategoriye taşır, sistem bunu HATIRLAR ve bir daha sormaz — `drawing_aliases`
-- ile birebir aynı felsefe (md. 18/1: "sistem kullanıldıkça hoşgörüsünü
-- kaybetmeden daha çoğunu anlar").
--
-- ANAHTAR PAKETE DEĞİL TANIMA BAĞLIDIR. `SOMUN M16 DIN934` her pakette aynı
-- somundur; düzeltmeyi paket başına saklamak, aynı işi her teslimde yeniden
-- yaptırırdı. Anahtar KATLANMIŞ tanımdır (`trKatla`) — "CİVATA" ile "CIVATA"
-- aynı kalemdir ve iki ayrı satır açmamalıdır (progress anahtarının kuralıyla
-- aynı gerekçe).
create table if not exists public.drawing_purchase_overrides (
  id uuid primary key default gen_random_uuid(),

  -- trKatla(tanım) — ASCII'ye katlanmış, büyük harfli tanım.
  match_key text not null,

  -- Hedef kategori ADI. Yabancı anahtar DEĞİLDİR: kategorilerin çoğu koddaki
  -- sözlükten (`SATIN_ALMA_SINIFLARI`) gelir ve veritabanında satırları yoktur.
  -- Metin tutmak iki kaynağı tek alanda birleştirmenin tek yoludur.
  category text not null,

  -- İnsan okusun diye ilk görülen ham tanım. Anahtar katlanmış olduğu için
  -- defter tek başına okunduğunda neyin düzeltildiği anlaşılmazdı.
  sample text not null default '',

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dwg_purchase_override_key
  on public.drawing_purchase_overrides (match_key);

comment on table public.drawing_purchase_overrides is
  'Satın alma kategorisi düzeltmeleri. Anahtar PAKET DEĞİL TANIMDIR: aynı '
  'somun her pakette aynı kategoriye gider. drawing_aliases ile aynı felsefe — '
  'sistem kullanıldıkça daha çoğunu doğru bilir.';

-- ------------------------------------------------ 4. kullanıcı kategorileri
--
-- Sözlükteki on beş aile firmanın bugünkü ürün yelpazesidir; yarın "Hidrolik"
-- ya da "Ambalaj" gerekebilir ve bunun için kod değişmesi gerekmemeli.
--
-- Defter YALNIZ EK kategorileri tutar; koddakiler burada YOKTUR. İkisini de
-- tabloya taşımak, sözlüğün sırasını (Redüktör Motor'dan önce gelir) veriye
-- emanet etmek olurdu ve o sıra bir tercih değil bir KURALDIR.
create table if not exists public.drawing_purchase_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort int not null default 100,
  -- Kullanımdan kalkan kategori SİLİNMEZ, pasife alınır: ona taşınmış
  -- kalemlerin düzeltmesi bir sabah adsız kalmamalı (drawing_stages ile aynı).
  active boolean not null default true,
  note text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dwg_purchase_category_name
  on public.drawing_purchase_categories (name);

comment on table public.drawing_purchase_categories is
  'KULLANICININ EKLEDİĞİ satın alma kategorileri. Koddaki sözlük '
  '(SATIN_ALMA_SINIFLARI) burada DEĞİLDİR — onun sırası bir kuraldır, veriye '
  'emanet edilmez.';

-- --------------------------------------------------------------- updated_at
drop trigger if exists touch_drawing_purchase_overrides on public.drawing_purchase_overrides;
create trigger touch_drawing_purchase_overrides
  before update on public.drawing_purchase_overrides
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_drawing_purchase_categories on public.drawing_purchase_categories;
create trigger touch_drawing_purchase_categories
  before update on public.drawing_purchase_categories
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------- RLS
-- 20260810000001'deki do-loop kalıbının aynısı: OKUMA HERKESE (teknik resim
-- atölyenin ortak gerçeğidir), YAZMA `can_edit_drawings()`.
alter table public.drawing_purchase_overrides enable row level security;
alter table public.drawing_purchase_categories enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'drawing_purchase_overrides','drawing_purchase_categories'
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
      'create policy %I on public.%I for delete to authenticated using (public.can_edit_drawings())',
      t || '_delete', t);
  end loop;
end $$;

-- VİNÇ TİPİNE GÖRE MALİYET ŞABLONU — hangi tipte hangi bölümler ve hangi
-- kalemler açılır.
--
-- Kullanıcı isteği (19.08.2026, md. 10): *"Maliyet bölümüne hangi grup vinçte
-- örneğin Tek Kirişli Vinçte, maliyet bölümlerinin ve o bölümlerin içinde
-- hangi kalemlerin geldiğini gösteren, bunlara ekleme yapabileceğim bir sayfa
-- yapsak. Kontrolü daha kolay olur."*
--
-- BU, 20260820000001'DEKİ "ŞABLON TABLOSU YOKTUR" KARARINI TERSİNE ÇEVİRİR ve
-- gerekçesi değişmiştir, unutulmamıştır. O karar iki şeye dayanıyordu:
--   1. "İskelet teklif kaleminin kendi bölümlerinden türer" — bu HÂLÂ geçerli
--      ve varsayılan olarak KORUNUYOR: şablonu olmayan bir vinç tipinde belge
--      birebir bugünküdür (`costGroupKeysForOfferItem` şablonsuz çağrıldığında
--      eski kümeyi verir; `__tests__/template.test.ts` bunu dondurur).
--   2. "Kullanıcıya hangi vinç tipi sorusu ikinci kez sorulur" — SORULMUYOR:
--      şablon teklif kaleminin `craneType`ine göre KENDİLİĞİNDEN eşleşir,
--      kullanıcı maliyet çalışmasında hiçbir şey seçmez.
-- Eksik olan şey görünürlüktü: eşleme koda gömülüydü ve "Kaldırma Kirişi'nde
-- neden yürütme grubu açılıyor" sorusunun cevabı ekranda hiç yoktu.
--
-- İSKELET ANAHTAR TAŞIR, ETİKET TAŞIMAZ. Satır adı, birimi ve miktar kaynağı
-- defterin (`src/lib/offers/cost/registry.ts`) malıdır; kopyalansaydı defter
-- genişlediğinde şablonlar eskir ve iki yer ayrışırdı (20260819000007'de
-- `offer_templates` için yazılı olan aynı gerekçe).
--
-- SATIR TARAFI KARA LİSTEDİR (`closedLines`), beyaz liste değil. "Hangi
-- satırlar gelsin" diye seçilenleri saklamak, kaydedildiği ANDAKİ defteri
-- dondururdu: koda sonradan eklenen bir kalem (BORVERK İŞLEME gibi) o tiplerde
-- hiç açılmaz ve eksikliği ancak aylar sonra fark edilirdi. Kapatılanı
-- saklamak tersini yapar — defter büyüdükçe yeni satır her tipte kendiliğinden
-- görünür, kullanıcının verdiği KARAR korunur.
--
-- KAPATMA SİLME DEĞİLDİR. Buradaki hiçbir ayar kayıtlı bir maliyet
-- çalışmasına dokunmaz: şablon yalnız YENİ açılan kalemin iskeletini kurar ve
-- "Tekliften Tazele"nin hangi satırları EKLEYECEĞİNİ söyler. Fiyatı girilmiş
-- bir satır belgesinde kalır (MALIYET-9: tazeleme ekleyicidir, silici değil).

-- ------------------------------------------------- offer_cost_templates
-- VİNÇ TİPİ ŞABLONUN KİMLİĞİDİR, ayrı bir "ad" alanı YOKTUR (teklif
-- şablonlarından ayrıldığı yer burasıdır): teklifte bir tipin iki şablonu
-- olabilir ("Çift Kirişli — İki Arabalı"), maliyette eşleşme kalemin
-- `craneType` metniyle KENDİLİĞİNDEN kurulur ve iki aday olsaydı hangisinin
-- uygulandığı ekrandan okunamazdı. `match_key` tekilliği bunu imkânsız kılar.
create table if not exists public.offer_cost_templates (
  id uuid primary key default gen_random_uuid(),
  crane_type text not null check (btrim(crane_type) <> ''),
  -- Katlanmış karşılaştırma anahtarı (`trKatla`): "Portal Vinç" ile
  -- "PORTAL VİNÇ" tek tiptir. SQL'de `upper()` KULLANILMAZ — Postgres
  -- Türkçe farkında değildir ve "İ" ile "I"yı ayıramaz (offer_options kuralı).
  match_key text not null,
  skeleton jsonb not null default '{}'::jsonb,
  sort int not null default 0,
  -- PASİF ŞABLON DEFTERDE KALIR, UYGULANMAZ: bir tipin şablonunu geçici
  -- olarak devre dışı bırakmak, satırı silip kararı kaybetmekten iyidir.
  -- Pasifken o tip varsayılan kümeye düşer.
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists offer_cost_templates_key_uidx
  on public.offer_cost_templates (match_key);
create index if not exists offer_cost_templates_sort_idx
  on public.offer_cost_templates (sort) where active;

drop trigger if exists touch_offer_cost_templates on public.offer_cost_templates;
create trigger touch_offer_cost_templates before update on public.offer_cost_templates
  for each row execute function public.touch_updated_at();

comment on table public.offer_cost_templates is
  'Vinç tipine göre maliyet iskeleti: hangi bölümler açılır, hangi defter satırları kapalıdır. Etiket/birim/miktar kaynağı KODDAKİ defterdedir.';

-- ------------------------------------------------------------------- RLS
-- Maliyeti GÖREN okur, YAZAN düzenler. Teklif defterleriyle aynı desen ama
-- AYRI SORULUR: maliyet kâr marjı taşır ve yetki kümesi ileride ayrılabilir
-- (20260820000001'deki `can_see_offer_costs` gerekçesi).
alter table public.offer_cost_templates enable row level security;

drop policy if exists offer_cost_templates_select on public.offer_cost_templates;
drop policy if exists offer_cost_templates_write on public.offer_cost_templates;

create policy offer_cost_templates_select on public.offer_cost_templates
  for select to authenticated using (public.can_see_offer_costs());
create policy offer_cost_templates_write on public.offer_cost_templates
  for all to authenticated
  using (public.can_edit_offer_costs()) with check (public.can_edit_offer_costs());

-- ------------------------------------------------------------------ seed
-- TOHUM VARSAYILANDAN ÜRETİLİR, ELLE YAZILMAZ. Aşağıdaki iskelet
-- `defaultCostSkeleton()`ün çıktısıdır ve şu komutla yeniden üretilir:
--
--   npx tsx -e "import { defaultCostSkeleton } from './src/lib/offers/cost/registry'; console.log(JSON.stringify(defaultCostSkeleton()));"
--
-- Elle yazılsaydı defterle bu dosya ayrışabilir ve "şablonu varsayılan olan
-- tip" ile "hiç şablonu olmayan tip" farklı maliyet iskeleti üretirdi — fark
-- ancak toplamda, aylar sonra fark edilirdi.
--
-- VİNÇ TİPLERİ DEFTERDEN GELİR (`offer_options`), buraya İKİNCİ BİR LİSTE
-- yazılmaz: teklifin "Vinç Tipi" satırını besleyen liste ile şablon defterinin
-- listesi aynı olmak zorundadır, yoksa teklifte seçilebilen bir tipin maliyet
-- şablonu hiç açılamazdı. `match_key` de oradan kopyalanır — aynı katlama
-- kuralının SQL'de ikinci kez yazılması, iki uygulamanın ayrışması demekti.
--
-- SONRADAN EKLENEN TİP TOHUMLANMAZ ve tohumlanmasına gerek yoktur: şablonu
-- olmayan tip varsayılan kümeye düşer, ekran da onu "VARSAYILAN" diye yazar.
insert into public.offer_cost_templates (crane_type, match_key, skeleton, sort)
select o.value, o.match_key,
       '{"groupKeys":["fabrication","steel","hoist","travel","electrical","assembly"]}'::jsonb,
       o.sort
from public.offer_options o
where o.list_key = 'val.craneType' and o.parent_id is null
on conflict (match_key) do nothing;

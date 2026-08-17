-- TEKLİF — müşteriye giden teknik + ticari teklif belgesi ve revizyon arşivi.
--
-- NEDEN AYRI BİR BÖLÜM: `purchase_quotes` TEDARİKÇİNİN bize verdiği tekliftir
-- (içeri gelen fiyat); bu tablo BİZİM müşteriye verdiğimiz tekliftir (dışarı
-- giden fiyat). İkisi aynı kelimeyi taşır ama aynı gerçeği söylemez: birinde
-- tedarikçi defteri ve KDV'li alım tutarı, ötekinde müşteri defteri, revizyon
-- ve teslim edilmiş bir BELGE vardır. Tek tabloya bindirilseydi her sorgu
-- "hangi yönü konuşuyorum" diye bir süzgeç taşımak zorunda kalırdı.
--
-- MODEL MÜHENDİSLİĞİN AYNISIDIR (HESAP-7): defter satırı + SNAPSHOT revizyon.
-- Teklif çok değişir; her revizyon belgenin o günkü tam hâlidir ve yayımlanınca
-- KİLİTLENİR. İlişkisel alt tablolar (kalem, satır, fiyat) seçilseydi her yeni
-- revizyon yüzlerce satır kopyalamak zorunda kalır ve yayımlanmış bir belgenin
-- değişmezliği tek bir tetikleyiciyle korunamazdı.

create type public.offer_status as enum ('draft', 'sent', 'won', 'lost', 'cancelled');

-- BELGE DİLİ TEKLİF NUMARASININ İÇİNDEDİR: TETR-… / TEEN-… (kullanıcı kuralı).
-- Bugün yalnız 'tr' üretilir; alan bugünden var çünkü numara ondan türer ve
-- sonradan eklemek yayımlanmış numaraları yeniden yorumlamak olurdu.
create type public.offer_lang as enum ('tr', 'en');

-- ---------------------------------------------------------------- yetki
-- Teklif FİYAT taşır: Satış Takibi ile aynı rol kümesi (Yönetici · Müdür).
-- AYRI bir soru olarak sorulur (`can_see_sales` ile aynı gerekçe): iki bölüm
-- ileride ayrışabilir ve o gün tek satır değişmesi yeter.
create or replace function public.can_see_offers()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role::text in ('admin', 'manager')
  );
$$;

-- Bugün GÖRME ile aynı kümedir ama AYRI sorudur (`can_edit_purchasing` deseni):
-- "müdür görür, yalnız yönetici yazar" ayrımı istenirse çağrı yerlerini gözden
-- geçirme borcu doğmasın.
create or replace function public.can_edit_offers()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_see_offers();
$$;

-- ---------------------------------------------------------------- offers
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  -- TETR-20260817-1 — müşteriyle yazışmada geçen REFERANS. `docCode`
  -- (ORC-HR-…) ile karıştırılmaz: o bir iç belge kodudur, bu müşterinin
  -- kendi yazışmasında andığı numaradır.
  offer_no text not null,
  lang public.offer_lang not null default 'tr',
  -- Numaranın günü ve o günün sırası AYRI sütunlardır: numara metinden
  -- ayrıştırılarak sıralanamaz ve "bugünün kaçıncı teklifi" sorusu bir
  -- LIKE taramasına dönüşürdü.
  issue_date date not null,
  seq int not null check (seq > 0),
  customer_id uuid references public.customers (id) on delete set null,
  -- MÜŞTERİ ADI FOTOĞRAFTIR: defter sonradan düzeltilince teslim edilmiş
  -- teklif değişmemelidir (iş emrindeki `customer_*` alanlarıyla aynı kural).
  customer_name text not null default '',
  subject text not null default '',
  status public.offer_status not null default 'draft',
  currency text not null default 'EUR',
  -- Teklif kazanılınca açılan iş emriyle bağ — opsiyoneldir ve teklifin
  -- ŞARTI DEĞİLDİR (teklif çoğu zaman işten önce vardır).
  job_id uuid references public.jobs (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists offers_no_uidx on public.offers (offer_no);
-- Aynı gün aynı sıra iki kez üretilemez — numara önerisi yarışırsa insert
-- düşer ve çağıran bir artırıp yeniden dener.
create unique index if not exists offers_seq_uidx
  on public.offers (lang, issue_date, seq);
create index if not exists offers_customer_idx on public.offers (customer_id);
create index if not exists offers_status_idx on public.offers (status, issue_date desc);
create index if not exists offers_job_idx on public.offers (job_id) where job_id is not null;

comment on table public.offers is
  'Müşteriye verilen teklifin defter satırı; belgenin kendisi offer_revisions.payload içindedir.';

-- ------------------------------------------------------- offer_revisions
create table if not exists public.offer_revisions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  rev_no int not null,
  label text not null default '',
  -- MEVCUT `revision_status` enum'u yeniden kullanılır: taslak/yayınlandı
  -- ayrımı uygulamada tek bir kavramdır ve ikinci bir enum iki ayrı etiket
  -- sözlüğü doğururdu (`lib/revision-status.ts` zaten tek yerdir).
  status public.revision_status not null default 'draft',
  -- BELGENİN TAMAMI: kapak, kalemler, gruplar, satırlar, ticari şartlar,
  -- fiyat satırları, notlar, kapsam dışı maddeler ve gizleme kararları.
  payload jsonb not null default '{}'::jsonb,
  -- TOPLAM TÜRETİLİR, elle yazılmaz (SATIS-16 kuralı): listedeki tutar ile
  -- belgedeki tutar ayrışamaz. jsonb okuması immutable'dır, `stored` üretilmiş
  -- sütun bu yüzden yazılabilir.
  total_amount numeric generated always as
    (nullif(payload #>> '{pricing,total}', '')::numeric) stored,
  notes text not null default '',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references public.profiles (id),
  unique (offer_id, rev_no)
);

create index if not exists offer_revisions_offer_idx
  on public.offer_revisions (offer_id, rev_no desc);

-- YAYIMLANMIŞ REVİZYON DEĞİŞTİRİLEMEZ VE SİLİNEMEZ (`guard_issued_revision`
-- ikizi). Teslim edilmiş bir teklif müşterinin elindedir; sonradan
-- düzeltilirse iki taraf farklı belgeye bakar. NEYİN korunduğunu bu
-- tetikleyici, KİMİN silebileceğini RLS politikası söyler.
create or replace function public.guard_issued_offer_revision()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then
      raise exception 'Yayınlanmış teklif revizyonu silinemez';
    end if;
    return old;
  end if;

  if old.status = 'issued' then
    raise exception 'Yayınlanmış teklif revizyonu değiştirilemez; yeni revizyon oluşturun';
  end if;

  if new.status = 'issued' and old.status = 'draft' then
    new.issued_at := now();
    new.issued_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_issued_offer_revision on public.offer_revisions;
create trigger guard_issued_offer_revision
  before update or delete on public.offer_revisions
  for each row execute function public.guard_issued_offer_revision();

drop trigger if exists touch_offers on public.offers;
create trigger touch_offers before update on public.offers
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------- offer_options
-- TEKLİF SÖZLÜĞÜ — bütün açılır listelerin TEK kaynağı.
--
-- Marka defteri ile ticari şart defteri AYNI tabloda yaşar çünkü ikisi de aynı
-- soruyu sorar: "bu alanda hangi değerler önerilsin". İki tablo yazılsaydı
-- düzenleme ekranı, `ensure*` yolu, katlama kuralı ve RLS iki kez yazılırdı.
-- Ayrımı `list_key` yapar: 'brand.motor' · 'brand.drive' · 'term.delivery' …
--
-- `parent_id` KADEMELİ listeler içindir: marka → tip/seri (YILMAZ → HT Tipi).
-- Kendine referans veren tek tablo budur ve derinlik BİRDİR — daha derini bir
-- ağaç düzenleyicisi gerektirirdi, teklif alanlarında karşılığı yok.
create table if not exists public.offer_options (
  id uuid primary key default gen_random_uuid(),
  list_key text not null check (btrim(list_key) <> ''),
  value text not null check (btrim(value) <> ''),
  -- Katlanmış tekillik anahtarı (`trKatla`): "SİBRE" ile "sibre " tek kayıt
  -- olur (purchase_qualities.match_key ile birebir aynı kural).
  match_key text not null,
  parent_id uuid references public.offer_options (id) on delete cascade,
  sort int not null default 0,
  active boolean not null default true,
  -- Yeni teklifte kendiliğinden seçilen değer (ör. geçerlilik "14 iş günü").
  is_default boolean not null default false,
  note text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- İki KISMİ tekillik: kök maddeler liste içinde, çocuklar ebeveyni içinde
-- tekildir. Tek bir birleşik indeks `parent_id` null'ken çakışmayı kaçırırdı.
create unique index if not exists offer_options_root_uidx
  on public.offer_options (list_key, match_key) where parent_id is null;
create unique index if not exists offer_options_child_uidx
  on public.offer_options (parent_id, match_key) where parent_id is not null;
create index if not exists offer_options_list_idx
  on public.offer_options (list_key, sort) where active;

drop trigger if exists touch_offer_options on public.offer_options;
create trigger touch_offer_options before update on public.offer_options
  for each row execute function public.touch_updated_at();

comment on table public.offer_options is
  'Teklif açılır listelerinin defteri: markalar, tip/seriler, ticari şartlar, notlar, kapsam dışı maddeleri.';

-- ------------------------------------------------------ offer_templates
-- ŞABLON teklifin HIZINI verir: "Çift Kirişli Gezer Köprülü Vinç" seçilince
-- gruplar ve satır etiketleri hazır gelir, kullanıcı yalnız değerleri seçer.
-- İskelet JSONB'dir ve payload'ın `items[0]` biçimindedir — şablon ile belge
-- aynı şekli konuşur, aralarında çevirmen yoktur.
create table if not exists public.offer_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  match_key text not null,
  crane_type text not null default '',
  skeleton jsonb not null default '{}'::jsonb,
  sort int not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists offer_templates_key_uidx
  on public.offer_templates (match_key);
create index if not exists offer_templates_sort_idx
  on public.offer_templates (sort) where active;

drop trigger if exists touch_offer_templates on public.offer_templates;
create trigger touch_offer_templates before update on public.offer_templates
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- RLS
alter table public.offers          enable row level security;
alter table public.offer_revisions enable row level security;
alter table public.offer_options   enable row level security;
alter table public.offer_templates enable row level security;

drop policy if exists offers_select on public.offers;
drop policy if exists offers_insert on public.offers;
drop policy if exists offers_update on public.offers;
drop policy if exists offers_delete on public.offers;

create policy offers_select on public.offers
  for select to authenticated using (public.can_see_offers());
create policy offers_insert on public.offers
  for insert to authenticated
  with check (public.can_edit_offers() and created_by = (select auth.uid()));
create policy offers_update on public.offers
  for update to authenticated
  using (public.can_edit_offers()) with check (public.can_edit_offers());
-- Teklifi SİLMEK yalnız yöneticidedir (projeyi silmekle aynı ağırlık):
-- bütün revizyonlarını ve arşivlenmiş PDF'lerini birlikte götürür.
create policy offers_delete on public.offers
  for delete to authenticated using (public.is_admin());

drop policy if exists offer_revisions_select on public.offer_revisions;
drop policy if exists offer_revisions_insert on public.offer_revisions;
drop policy if exists offer_revisions_update on public.offer_revisions;
drop policy if exists offer_revisions_delete on public.offer_revisions;

create policy offer_revisions_select on public.offer_revisions
  for select to authenticated using (public.can_see_offers());
create policy offer_revisions_insert on public.offer_revisions
  for insert to authenticated
  with check (public.can_edit_offers() and created_by = (select auth.uid()));
create policy offer_revisions_update on public.offer_revisions
  for update to authenticated
  using (public.can_edit_offers()) with check (public.can_edit_offers());
-- TASLAK revizyon silinebilir (yanlış açılmış bir revizyonu temizlemenin yolu
-- olmalıdır); YAYIMLANMIŞI tetikleyici zaten durdurur.
create policy offer_revisions_delete on public.offer_revisions
  for delete to authenticated using (public.can_edit_offers());

-- Defterler: teklifi GÖREN okur, YAZAN düzenler. Katalog tablolarındaki
-- "herkes okur" kuralı burada geçmez — marka defteri teklif bölümünün bir
-- parçasıdır ve ticari şart metinleri firma politikasıdır.
drop policy if exists offer_options_select on public.offer_options;
drop policy if exists offer_options_write on public.offer_options;
create policy offer_options_select on public.offer_options
  for select to authenticated using (public.can_see_offers());
create policy offer_options_write on public.offer_options
  for all to authenticated
  using (public.can_edit_offers()) with check (public.can_edit_offers());

drop policy if exists offer_templates_select on public.offer_templates;
drop policy if exists offer_templates_write on public.offer_templates;
create policy offer_templates_select on public.offer_templates
  for select to authenticated using (public.can_see_offers());
create policy offer_templates_write on public.offer_templates
  for all to authenticated
  using (public.can_edit_offers()) with check (public.can_edit_offers());

-- ------------------------------------------------------------ offer_list
-- LİSTE SÜZGEÇLERİ BELGENİN KENDİSİNDEN OKUNUR (kullanıcı isteği, 17.08.2026:
-- *"filtre vinç türü, tonaj gibi temel vinç özelliklerinin yanında müşteri
-- yıl vb genel özellikler de olsun"*).
--
-- Vinç tipi ve tonaj `offers` tablosuna KOPYALANMADI. Kopyalansaydı iki
-- yazıcısı olurdu (revizyon kaydeden yol ve teklif künyesini güncelleyen yol)
-- ve ikisi er geç ayrışırdı — süzgeç, belgenin gerçekte söylediğinden başka
-- bir şey gösterirdi. Görünüm her okumada GÜNCEL revizyondan türetir, yani
-- ayrışma tanım gereği imkânsızdır.
--
-- `security_invoker` ZORUNLUDUR: onsuz görünüm sahibinin yetkisiyle çalışır ve
-- `offers` üzerindeki `can_see_offers()` politikası devre dışı kalırdı — teklif
-- fiyatları, bölümü göremeyen bir role bu görünüm üzerinden sızardı.
create or replace view public.offer_list
with (security_invoker = true) as
select
  o.id,
  o.offer_no,
  o.lang,
  o.issue_date,
  o.seq,
  o.customer_id,
  o.customer_name,
  o.subject,
  o.status,
  o.currency,
  o.job_id,
  o.created_by,
  o.created_at,
  o.updated_at,
  r.id            as latest_revision_id,
  r.rev_no        as latest_rev_no,
  r.status        as latest_rev_status,
  r.total_amount  as latest_total,
  r.updated_at    as latest_updated_at,
  -- Süzgeç boyutları: BASILAN metin değil kalem KÜNYESİ okunur (payload
  -- `items[*].craneType/capacityT`). Basılan "30.000 kg / 5.000 kg" satırından
  -- tonaj ayrıştırmak bir tahmin olurdu; künyedeki sayı her zaman tondur.
  coalesce(jsonb_path_query_array(r.payload, '$.items[*].craneType'), '[]'::jsonb) as crane_types,
  coalesce(jsonb_path_query_array(r.payload, '$.items[*].capacityT'), '[]'::jsonb) as capacities_t,
  coalesce(jsonb_array_length(r.payload -> 'items'), 0) as item_count
from public.offers o
left join lateral (
  select ov.*
  from public.offer_revisions ov
  where ov.offer_id = o.id
  order by ov.rev_no desc
  limit 1
) r on true;

comment on view public.offer_list is
  'Teklif listesi: defter satırı + GÜNCEL revizyonun özeti (tutar, vinç tipi, tonaj). Süzgeçler buradan okur.';

-- --------------------------------------------------------------- storage
-- Yayımlanan teklifin PDF arşivi. Yol: {offer_id}/{offer_no}-R{rev}.pdf
-- `reports` kovasından FARKLI olarak okuma AUTHENTICATED'a değil TEKLİFİ
-- GÖRENE açıktır: belgede müşteri fiyatı vardır ve imzalı bağlantı uygulama
-- katmanındaki rolü taşımaz (personnel kovasının gerekçesiyle birebir aynı).
insert into storage.buckets (id, name, public)
values ('offers', 'offers', false)
on conflict (id) do nothing;

drop policy if exists "offers okuma (teklif yetkisi)" on storage.objects;
drop policy if exists "offers yükleme (teklif yetkisi)" on storage.objects;
drop policy if exists "offers güncelleme (teklif yetkisi)" on storage.objects;

create policy "offers okuma (teklif yetkisi)"
on storage.objects for select to authenticated
using (bucket_id = 'offers' and public.can_see_offers());

create policy "offers yükleme (teklif yetkisi)"
on storage.objects for insert to authenticated
with check (bucket_id = 'offers' and public.can_edit_offers());

create policy "offers güncelleme (teklif yetkisi)"
on storage.objects for update to authenticated
using (bucket_id = 'offers' and public.can_edit_offers())
with check (bucket_id = 'offers' and public.can_edit_offers());

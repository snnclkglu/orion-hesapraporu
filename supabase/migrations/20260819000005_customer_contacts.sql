-- MÜŞTERİ İLETİŞİM KİŞİLERİ (kullanıcı isteği, 17.08.2026: *"Müşteri
-- bilgilerine ayrıca iletişim kişisi de ekleyebileyim. Çünkü teklifte kişi
-- belirtiliyor. Bir veya birden fazla kişi olabilir bir müşteriye."*)
--
-- NEDEN AYRI TABLO: `customers` satırı FİRMANIN künyesidir — unvan, vergi
-- dairesi, santral telefonu. Teklif kapağındaki "KİME" ise bir İNSANDIR ve bir
-- firmada birden çok muhatap olur. Kişi alanları `customers`a eklenseydi
-- ikinci muhatap yazılacak yer bulamaz, kullanıcı onu `notes` içine düşerdi;
-- orada ne aranabilir ne de teklif kapağına geçirilebilirdi.
--
-- YAYINLANMIŞ TEKLİF BU DEFTERE BAĞLI DEĞİLDİR: `offer_revisions.payload`
-- kapak alanlarını METİN olarak dondurur (IS-14'ün müşteri fotoğrafı kuralı).
-- Bu tablo yalnız ÖNERİ kaynağıdır — kişi işten ayrılıp defterden silinse de
-- teslim edilmiş teklifte adı olduğu gibi kalır. Bu yüzden `on delete cascade`
-- güvenlidir: müşteri defterden silinince kişileri de gider, belgeler durur.

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  -- AD SOYAD BÜYÜK HARF saklanır (`adBuyuk`, değişmez md. 3). Dönüşüm SQL'de
  -- YAPILMAZ: Postgres'in `upper()`'ı Türkçe farkında değildir ("İNCİ" →
  -- "INCI"); uygulama katmanı yazar.
  name text not null check (btrim(name) <> ''),
  -- Katlanmış tekillik anahtarı (`trKatla`): "AYŞE YILMAZ" ile "AYSE YILMAZ"
  -- aynı kişidir ve deftere iki kez yazılamaz (purchase_suppliers.match_key
  -- ile birebir aynı kural).
  match_key text not null,
  -- Unvan ve bölüm birer CÜMLEDİR ("Satın Alma Müdürü") ve büyütülmez; ad
  -- kuralı yalnız ada işler.
  title text not null default '',
  -- Teklif kapağındaki "Bölüm" satırı. Unvandan AYRI tutulur: biri kişinin
  -- görevi, öteki firmadaki birimidir ve kapakta ayrı satırlarda durur.
  department text not null default '',
  phone text not null default '',
  email text not null default '',
  note text not null default '',
  -- Teklifte ÖNCE önerilen kişi. TEKLİĞİ VERİTABANI ZORLAMAZ; gerekçe aşağıda.
  is_primary boolean not null default false,
  -- Pasif kişi geçmişte muhataptı ama artık önerilmez. Silmek yerine pasife
  -- çekmek defterin geçmişle bağını korur (tedarikçi defterinin kuralı).
  active boolean not null default true,
  sort int not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Aynı kişi bir müşterinin defterine iki kez yazılamaz. Anahtar MÜŞTERİYLE
-- BİRLİKTE tekildir: aynı ad iki ayrı firmada pekâlâ çalışabilir.
create unique index if not exists customer_contacts_key_uidx
  on public.customer_contacts (customer_id, match_key);
create index if not exists customer_contacts_customer_idx
  on public.customer_contacts (customer_id, sort) where active;

drop trigger if exists touch_customer_contacts on public.customer_contacts;
create trigger touch_customer_contacts before update on public.customer_contacts
  for each row execute function public.touch_updated_at();

comment on table public.customer_contacts is
  'Müşterinin iletişim kişileri — teklif kapağındaki "KİME" bloğunun öneri kaynağı.';
comment on column public.customer_contacts.is_primary is
  'Teklifte önce önerilen kişi. Teklik YAZMA YOLUNDA korunur (kısmi indeks değil).';

-- BİRİNCİL KİŞİ TEKTİR ama KISMİ TEKİLLİK İNDEKSİYLE ZORLANMAZ.
--
-- `(customer_id) where is_primary` bir indeks yazılabilirdi; o zaman
-- "birincili değiştir" İKİ ADIMLI bir işlem olurdu (öncekini düşür, yenisini
-- kaldır) ve iki adımın ARASINDA müşteri birincilsiz kalırdı — arada düşen bir
-- istek defteri sessizce birincilsiz bırakırdı. Kural bu yüzden uygulamanın
-- yazma yolundadır (`offer_options.is_default` ile birebir aynı karar):
-- yeni birincil işaretlenirken kardeşleri düşürülür.

-- ------------------------------------------------------------------- RLS
alter table public.customer_contacts enable row level security;

drop policy if exists customer_contacts_select on public.customer_contacts;
drop policy if exists customer_contacts_write on public.customer_contacts;

-- OKUMA HERKESE AÇIK: müşteri defterinin kendisi zaten öyledir
-- (`customers_select` … `using (true)`) ve iş emri açan, iş listesi bakan,
-- teklif hazırlayan herkes muhatabın telefonunu görebilmelidir.
create policy customer_contacts_select on public.customer_contacts
  for select to authenticated using (true);

-- YAZMA `is_admin() OR can_edit_offers()`: kişiyi deftere GİREN, teklif
-- kapağını dolduran kişidir. Yalnız yöneticiye açılsaydı satışçı kapakta yeni
-- bir muhatap yazarken deftere ekleyemez, yöneticiyi beklerdi — ve o bekleme,
-- kişinin deftere hiç girmemesinin en kısa yoludur.
create policy customer_contacts_write on public.customer_contacts
  for all to authenticated
  using (public.is_admin() or public.can_edit_offers())
  with check (public.is_admin() or public.can_edit_offers());

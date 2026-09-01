-- MÜŞTERİ DEFTERİ "KENDİ FİRMAMIZ"I DA TANIR.
--
-- Kullanıcı kararı (01.09.2026): *"Müşteriler kısmına ORION Vinç olarak
-- kendimiz varız zaten. Gerekli yerlere bilgileri buradan çeksek daha güzel
-- olur; aynı müşterilerin bilgilerini ve logolarını, adreslerini vs çektiğimiz
-- gibi kendi bilgilerimizi de buradan çeksin."*
--
-- ORION'un kaydı deftere 08.08.2026'daki devir aktarımıyla ZATEN girmişti
-- (`20260808000004_import_legacy_jobs.sql`: unvan, adres, vergi dairesi, vergi
-- no, telefon). Eksik olan tek şey onu "biz" diye işaretleyen bir alandı;
-- bugüne kadar aramak için ada ya da kısaltmaya bakmak gerekiyordu ve bu
-- KIRILGANDIR: unvan bir kez küçük "i" ile yazılıp sonra büyük "İ"ye
-- çevrildi (`20260812120000_is_listesi_duzeltmeleri.sql`), ayrıca tarayıcıda
-- /ORION/i deseni Türkçe ı/I tuzağına düşer.
--
-- BAYRAK TEKTİR: kısmi ünik indeks ikinci bir "kendi firmamız" kaydına izin
-- vermez. İki tane olsaydı hangi unvanın belgeye basılacağı belirsizleşirdi.

alter table public.customers
  add column if not exists is_self boolean not null default false,
  -- E-POSTA VE WEB DEFTERE GİRER. Belge altbilgisindeki iletişim satırı
  -- bugün `app_settings.report`tan geliyor; firma künyesi deftere taşınınca
  -- iki kaynak ayrışırdı. Sütunlar BOŞ BAŞLAR ve boş kalabilir — boş metin
  -- "yok" demektir, `null` "bilinmiyor" olurdu ve burada bilinmeyen bir hâl
  -- yok (logo_path ile aynı gerekçe).
  add column if not exists email text not null default '',
  add column if not exists web text not null default '';

comment on column public.customers.is_self is
  'Bu kayıt BİZİM firmamız mı (ORION). Belge künyelerinde üretici bilgisi buradan okunur; en fazla bir satır işaretlenebilir.';
comment on column public.customers.email is
  'Kurumsal e-posta — belge altbilgisindeki iletişim satırı. Boş = yok.';
comment on column public.customers.web is
  'Kurumsal web adresi — belge altbilgisindeki iletişim satırı. Boş = yok.';

create unique index if not exists customers_is_self_uidx
  on public.customers (is_self)
  where is_self;

-- ORION kaydı işaretlenir. EŞLEŞME KISALTMADAN yapılır: `short_name` bu kayda
-- 09.08.2026'da elle verilmişti ve unvan yazımından bağımsızdır. Kayıt yoksa
-- (temiz kurulum) hiçbir şey işaretlenmez — uydurma satır AÇILMAZ.
update public.customers
set is_self = true
where btrim(short_name) = 'ORION'
  and not exists (select 1 from public.customers where is_self);

-- Web adresi uygulama ayarındaki değerle aynıdır; deftere de yazılır ki
-- belge künyesi tek yerden okunabilsin. Elle doldurulmuş bir değer EZİLMEZ.
update public.customers
set web = 'orioncranes.com'
where is_self and btrim(web) = '';

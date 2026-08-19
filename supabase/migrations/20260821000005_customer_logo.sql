-- MÜŞTERİ LOGOSU — defterde bir alan, depoda bir kova.
--
-- Kullanıcı isteği (19.08.2026, md. 21): teklif kapağındaki künyede KİMDEN
-- bizim firmamız, KİME müşteri firmasıdır ve müşterinin de LOGOSU görünsün;
-- *"ama logo yoksa da pdf te yapı bozulmasın eksik görünmesin"*.
--
-- ALAN BOŞ BAŞLAR VE BOŞ KALABİLİR. `not null default ''` seçildi çünkü
-- defterdeki her müşterinin logosu YOKTUR ve olmaması bir eksiklik değildir:
-- boş metin "logo yok" demektir, `null` ise "bilinmiyor" — burada bilinmeyen
-- bir hâl yok. Okuyan taraf (teklif PDF'i) boş yolu logosuz basar.
--
-- BAYTLAR SÜTUNDA DEĞİL DEPODA durur: bir logo 100–800 KB'tır ve her müşteri
-- listesi sorgusu onu satır satır taşırdı. Sütunda yalnız YOL ve kullanıcıya
-- gösterilecek DOSYA ADI vardır (sözleşme/özlük dosyası kalıbı).

alter table public.customers
  add column if not exists logo_path text not null default '',
  add column if not exists logo_name text not null default '';

comment on column public.customers.logo_path is
  'customer-logos kovasındaki yol (<müşteri id>/<yükleme id>.png). Boş = logo yok.';
comment on column public.customers.logo_name is
  'Kullanıcının yüklediği dosyanın ADI — yalnız ekranda gösterilir, yol değildir.';

-- ---------------------------------------------------------------------- kova
-- 2 MB: logo kurumsal bir PNG'dir, taranmış bir belge değil. `contracts`
-- kovasının 25 MB'ı burada cömertlik değil kusur olurdu — sunucu yüklenen
-- nesneyi GERİ İNDİRİP sharp ile ölçüyor ve 20 MB'lık bir görüntü o ölçümü
-- gereksiz yere pahalı yapar. Sınır ayrıca istemci kontrolünün YEDEĞİdir:
-- tarayıcıdaki boyut kontrolü bir kolaylıktır, kelepçe kovanın kendisindedir.
insert into storage.buckets (id, name, public, file_size_limit)
values ('customer-logos', 'customer-logos', false, 2097152)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- OKUMA AUTHENTICATED'TIR, yazma ADMİN.
--
-- Okumayı `can_see_offers()` ile kesmek daha "sıkı" görünürdü ama koruduğu bir
-- şey yok: logo müşterinin herkese açık MARKASIDIR ve hangi müşterilerin
-- defterde olduğu `customers` tablosundan (select to authenticated using true)
-- zaten okunuyor. Kovayı tablodan daha dar tutmak, yalnız korunuyormuş
-- izlenimi verirdi — ve teklif PDF'ini üreten uç kullanıcının kendi oturumuyla
-- indirdiği için okuma hakkını kaybeden rol belgeyi logosuz basardı.
--
-- YAZMA AYRIDIR: müşteri defterini yönetmek (`/admin/customers`) admin işidir;
-- logo o defterin bir alanıdır, ayrı bir yetki düzeyi icat edilmedi.
drop policy if exists "customer-logos okuma (authenticated)" on storage.objects;
create policy "customer-logos okuma (authenticated)" on storage.objects
  for select to authenticated using (bucket_id = 'customer-logos');

drop policy if exists "customer-logos yükleme (admin)" on storage.objects;
create policy "customer-logos yükleme (admin)" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'customer-logos' and public.is_admin());

-- GÜNCELLEME GEREKLİDİR ve sebebi ölçümdür: sunucu yüklenen PNG'yi geri indirip
-- 8 bit sRGB'ye NORMALLEŞTİRİR ve aynı yola `upsert` ile geri yazar (16 bitlik
-- ya da interlaced bir PNG react-pdf'in çözücüsünü düşürür). Bu adım olmadan
-- tek bozuk logo bütün teklif PDF'ini 500'e çevirirdi.
drop policy if exists "customer-logos güncelleme (admin)" on storage.objects;
create policy "customer-logos güncelleme (admin)" on storage.objects
  for update to authenticated
  using (bucket_id = 'customer-logos' and public.is_admin())
  with check (bucket_id = 'customer-logos' and public.is_admin());

drop policy if exists "customer-logos silme (admin)" on storage.objects;
create policy "customer-logos silme (admin)" on storage.objects
  for delete to authenticated
  using (bucket_id = 'customer-logos' and public.is_admin());

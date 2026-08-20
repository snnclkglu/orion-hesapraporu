-- EL KİTABI GÖRSELLERİ: BİRİNCİL ANAHTAR (revision_id, id) OLUR.
--
-- HATA (ölçüldü, 20.08.2026): yeni revizyon açılırken görseller "kimlikleri
-- korunarak" kopyalanıyor (KITAP-9) — `actions.ts`teki
-- `createManualRevision` depo nesnesini `<yeni rev>/<aynı id>.png` yoluna
-- kopyalıyor ve ardından AYNI `id` ile ikinci bir satır yazmaya çalışıyor.
-- `manual_images.id uuid PRIMARY KEY` olduğu için bu insert 23505 (unique
-- violation) ile DÜŞÜYOR ve dönüş değeri okunmadığı için SESSİZ kalıyordu.
--
-- Sonuç zinciri: depo nesnesi kopyalanır (yetim kalır) · DB satırı yazılmaz ·
-- yeni revizyonun `payload`ındaki her `imageId` karşılıksız kalır ·
-- `pdf/route.ts` kaydı bulamaz · `pdf/manual.tsx` kaydı olmayan görsel
-- bloğunu HİÇ BASMAZ. Yani R01'de resimli olan bir kılavuz R02'de RESİMSİZ
-- teslim edilirdi ve bunu ancak belgeyi açan müşteri görürdü.
--
-- NEDEN KİMLİK DEĞİŞTİRMİYORUZ: `payload` içindeki `imageId` atıfları
-- revizyonla birlikte kopyalanır ve o atıfların AYNI kalması KITAP-9'un
-- kendisidir. Yeni bir kimlik üretmek, gövdedeki bütün resim bloklarını
-- yeniden yazmak (ve yayımlanmış bir gövdeyi de dolaylı olarak değiştirmek)
-- demekti.
--
-- NEDEN (revision_id, id): satırın kimliği zaten bu bileşimdir — depo yolu
-- (`<revision_id>/<id>.png`) tam olarak bunu söylüyor. `manual_images.id`ye
-- işaret eden HİÇBİR yabancı anahtar yok ve uygulamadaki bütün sorgular
-- `revision_id` ile kapsanmış (`data.ts` · `actions.ts` · `pdf/route.ts`),
-- bu yüzden TypeScript tarafında SIFIR değişiklik gerekir.

alter table public.manual_images
  drop constraint if exists manual_images_pkey;

alter table public.manual_images
  add constraint manual_images_pkey primary key (revision_id, id);

comment on constraint manual_images_pkey on public.manual_images is
  'Kimlik REVİZYONLA BİRLİKTE eşsizdir: yeni revizyon açılırken görsel aynı id ile kopyalanır (KITAP-9) ve tek sütunlu bir anahtar bu kopyayı reddederdi.';

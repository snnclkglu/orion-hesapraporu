-- ÜRÜN ÖLÇÜ DEFTERİ — üretici kataloglarından doğrulanmış cihaz ölçüleri.
--
-- Satırlar bir AYIKLAMA TURUNUN çıktısıdır: her ölçü üretici PDF'inin metin
-- katmanından okundu ve ÜÇ BAĞIMSIZ LENSLE çürütülmeye çalışıldı — sahiplik
-- (PANO-17: tip numarasının sayfada geçmesi ölçünün ona ait olduğu anlamına
-- gelmez), birebir alıntı ve fiziksel makullük. En az iki lensi geçemeyen
-- ölçü buraya GİRMEDİ.
--
-- ELLE GİRİLEN ÖLÇÜ EZİLMEZ: çakışmada güncelleme yalnız `source <> 'elle'`
-- satırlarda çalışır. Mühendisin kendi beyanı toplu bir turla değişmez
-- (PANO-12).
--
-- Kaynak izi `note` alanındadır (belge · sayfa · birebir alıntı · sahiplik
-- kanıtı) ve `source_document_id` katalog defterindeki belgeye bağlanır.

with gelen (lookup_key, supplier, type_no, width_mm, height_mm, depth_mm,
            mount_type, source_file, source_page, note) as (
  values
  (
    'ELFATEK|OCSCU01', 'Elfatek', 'OCS-CU01',
    83, 110, 44,
    'plaka',
    'https://web.archive.org/web/20240808021502id_/https://www.elfatek.com.tr/uploads/galleries_v/files/LOADCELL_ve_INDIKATOR.pdf',
    2,
    'Kaynak: https://web.archive.org/web/20240808021502id_/https://www.elfatek.com.tr/uploads/galleries_v/files/LOADCELL_ve_INDIKATOR.pdf s.2 · Alıntı: YUK KONTROL INDIKATORU OZELLIKLERI | Baglanti Voltaji : 85-265 VAC | Sensor Girisi : 1 adet panel giris | Sinyal : 4 adet role,RL1,RL2,RL3,RL4 | Haberlesme : RS232 ve canBUS (opsi… · Sahiplik: Belge Elfatek''in KENDI broşürüdür: elfatek.com.tr/uploads/galleries_v/files/ altinda yayimlanmis, her iki sayfasinda ELFATEK logosu ve www.…'
  ),
  (
    'EAE|EGET01', 'EAE', 'EG-ET-01',
    33, 60, 43,
    'din',
    'https://www.farnell.com/datasheets/1925389.pdf',
    1,
    'Kaynak: https://www.farnell.com/datasheets/1925389.pdf s.1 · Alıntı: SMALL THERMOSTAT KTO 011 / KTS 011 | Dimensions 2.4 x 1.3 x 1.7" (60 x 33 x 43 mm) | Weight approx. 1.4 oz. (40 g) | Housing plastic, UL 94V-0, light grey | Mounting clip for 35 m… · Sahiplik: EAE bu urunu URETMIYOR, ETIKETLIYOR. Zincir: (1) EAE''nin KENDI urun fotografinda (https://www.eaeelektroteknik.com/storage/uploads/2025/01/… · Denetim: 1/1 lens onayladı'
  ),
  (
    'BEMIS|BC114037420', 'BEMIS', 'BC1-1403-7420',
    85, 85, 30,
    'kapak',
    'https://www.bemis.com.tr/img/resimler/bemis/teknikcizim/ceenorm/BC1-1504-7420.jpg',
    null,
    'Kaynak: https://www.bemis.com.tr/img/resimler/bemis/teknikcizim/ceenorm/BC1-1504-7420.jpg · Alıntı: Olculer / Dimensions (mm) | a 86 | b 30 | c(o) 70 | d(kare) 70x70 | e(kare) 85x85 | f - | g - | h - · Sahiplik: Harfli olcu tablosu BC1-1403-7420''nin KENDI cizim gorselinde degil, ayni 16 A ailesinin 4 kutuplu kardesi BC1-1504-7420''nin BEMIS cizim gor… · Denetim: 1/1 lens onayladı'
  )
)
insert into public.electrical_device_models (
  lookup_key, supplier, type_no, width_mm, height_mm, depth_mm,
  mount_type, source, source_document_id, source_page, note, updated_at
)
select
  g.lookup_key, g.supplier, g.type_no, g.width_mm, g.height_mm, g.depth_mm,
  g.mount_type, 'katalog',
  (select d.id from public.electrical_catalog_documents d
    where d.file_name = split_part(g.source_file, '/', -1) limit 1),
  g.source_page, g.note, now()
from gelen g
on conflict (lookup_key) do update set
  supplier = excluded.supplier,
  type_no = excluded.type_no,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  depth_mm = excluded.depth_mm,
  mount_type = coalesce(excluded.mount_type, public.electrical_device_models.mount_type),
  source = 'katalog',
  source_document_id = coalesce(excluded.source_document_id, public.electrical_device_models.source_document_id),
  source_page = excluded.source_page,
  note = excluded.note,
  updated_at = now()
where public.electrical_device_models.source <> 'elle';

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
    'SIEMENS|5SL62047', 'Siemens', '5SL6204-7',
    36, 90, 76,
    'din',
    'https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SL6204-7&language=en&caller=SIOS',
    2,
    'Kaynak: https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SL6204-7&language=en&caller=SIOS s.2 · Alıntı: Mechanical Design height 90 mm width 36 mm depth 76 mm installation depth 70 mm number of modular width units 2 · Sahiplik: Belgenin 1. sayfasi "Data sheet 5SL6204-7 / Miniature circuit breaker 400 V 6kA, 2-pole, C, 4A" ile basliyor; 2. sayfa altbilgisinde "https… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|5SL62067', 'Siemens', '5SL6206-7',
    36, 90, 76,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6206-7 Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6206-7 Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: Mechanical Design height 90 mm width 36 mm depth 76 mm installation depth 70 mm number of modular width units 2 · Sahiplik: 1. sayfa: "Data sheet 5SL6206-7 / Miniature circuit breaker 400 V 6kA, 2-pole, C, 6A". Olcunun okundugu 2. sayfanin altbilgisinde "5SL62067… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|5SL62107', 'Siemens', '5SL6210-7',
    36, 90, 76,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6210-7 Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6210-7 Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: Mechanical Design height 90 mm width 36 mm depth 76 mm installation depth 70 mm number of modular width units 2 · Sahiplik: 1. sayfa: "Data sheet 5SL6210-7 / Miniature circuit breaker 400 V 6kA, 2-pole, C, 10 A"; 2. sayfa altbilgisi mlfb=5SL6210-7. Tek urunluk fo… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|5SL62167', 'Siemens', '5SL6216-7',
    36, 90, 76,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6216-7 Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6216-7 Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: Mechanical Design height 90 mm width 36 mm depth 76 mm installation depth 70 mm number of modular width units 2 · Sahiplik: 1. sayfa: "Data sheet 5SL6216-7 / Miniature circuit breaker 400 V 6kA, 2-pole, C, 16A"; 2. sayfa altbilgisi mlfb=5SL6216-7. Tek urunluk foy. · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|5SL62257', 'Siemens', '5SL6225-7',
    36, 90, 76,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6225-7 Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6225-7 Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: Mechanical Design height 90 mm width 36 mm depth 76 mm installation depth 70 mm number of modular width units 2 · Sahiplik: 1. sayfa: "Data sheet 5SL6225-7 / Miniature circuit breaker 400 V 6kA, 2-pole, C, 25A"; 2. sayfa altbilgisi mlfb=5SL6225-7. Tek urunluk foy. · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|5SL62327', 'Siemens', '5SL6232-7',
    36, 90, 76,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6232-7 Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6232-7 Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: Mechanical Design height 90 mm width 36 mm depth 76 mm installation depth 70 mm number of modular width units 2 · Sahiplik: 1. sayfa: "Data sheet 5SL6232-7 / Miniature circuit breaker 400 V 6kA, 2-pole, C, 32 A"; 2. sayfa altbilgisi mlfb=5SL6232-7. Tek urunluk fo… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|5SL63027', 'Siemens', '5SL6302-7',
    54, 90, 76,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6302-7 Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6302-7 Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: Mechanical Design height 90 mm width 54 mm depth 76 mm installation depth 70 mm number of modular width units 3 · Sahiplik: 1. sayfa: "Data sheet 5SL6302-7 / Miniature circuit breaker 400 V 6kA, 3-pole, C, 2A"; 2. sayfa altbilgisi mlfb=5SL6302-7. Tek urunluk foy. · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|5SL63257', 'Siemens', '5SL6325-7',
    54, 90, 76,
    'din',
    'https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SL6325-7&language=en&caller=SIOS',
    2,
    'Kaynak: https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SL6325-7&language=en&caller=SIOS s.2 · Alıntı: Mechanical Design height 90 mm width 54 mm depth 76 mm installation depth 70 mm number of modular width units 3 · Sahiplik: 1. sayfa: "Data sheet 5SL6325-7 / Miniature circuit breaker 400 V 6kA, 3-pole, C, 25A"; olcunun okundugu 2. sayfanin altbilgisinde "https:/… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|5SL63327', 'Siemens', '5SL6332-7',
    54, 90, 76,
    'din',
    'https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SL6332-7&language=en&caller=SIOS',
    2,
    'Kaynak: https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SL6332-7&language=en&caller=SIOS s.2 · Alıntı: Mechanical Design height 90 mm width 54 mm depth 76 mm installation depth 70 mm number of modular width units 3 · Sahiplik: 1. sayfa: "Data sheet 5SL6332-7 / Miniature circuit breaker 400 V 6kA, 3-pole, C, 32 A"; 2. sayfa altbilgisinde "https://mall.industry.siem… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|5SL63637', 'Siemens', '5SL6363-7',
    54, 90, 76,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6363-7 Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 5SL6363-7 Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: Mechanical Design height 90 mm width 54 mm depth 76 mm installation depth 70 mm number of modular width units 3 · Sahiplik: 1. sayfa: "Data sheet 5SL6363-7 / Miniature circuit breaker 400 V 6kA, 3-pole, C, 63 A"; 2. sayfa altbilgisi mlfb=5SL6363-7. Tek urunluk fo… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|3RV20111AA10', 'Siemens', '3RV2011-1AA10',
    45, 97, 97,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 3RV2011-1AA10 Teknik Veri Sayfası (EN).pdf',
    3,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 3RV2011-1AA10 Teknik Veri Sayfası (EN).pdf s.3 · Alıntı: height 97 mm width 45 mm depth 97 mm · Sahiplik: Ayni PDF s.1 basligi: "Data sheet 3RV2011-1AA10" / "Circuit breaker size S00 for motor protection, CLASS 10 A-release 1.1...1.6 A"; olcunun… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|3RV20111EA10', 'Siemens', '3RV2011-1EA10',
    45, 97, 97,
    'din',
    'https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2011-1EA10&language=en&caller=SIOS',
    3,
    'Kaynak: https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2011-1EA10&language=en&caller=SIOS s.3 · Alıntı: height 97 mm width 45 mm depth 97 mm · Sahiplik: Getirilen PDF s.1: "Data sheet 3RV2011-1EA10" / "Circuit breaker size S00 for motor protection, CLASS 10 A-release 2.8...4 A N release 52 A… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|3RV20111GA10', 'Siemens', '3RV2011-1GA10',
    45, 97, 97,
    'din',
    'https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2011-1GA10&language=en&caller=SIOS',
    3,
    'Kaynak: https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2011-1GA10&language=en&caller=SIOS s.3 · Alıntı: height 97 mm width 45 mm depth 97 mm · Sahiplik: Getirilen PDF s.1: "Data sheet 3RV2011-1GA10" / "Circuit breaker size S00 for motor protection, CLASS 10 A-release 4.5...6.3 A N-release 82… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|3RV20111HA10', 'Siemens', '3RV2011-1HA10',
    45, 97, 97,
    'din',
    'https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2011-1HA10&language=en&caller=SIOS',
    3,
    'Kaynak: https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2011-1HA10&language=en&caller=SIOS s.3 · Alıntı: height 97 mm width 45 mm depth 97 mm · Sahiplik: Getirilen PDF s.1: "Data sheet 3RV2011-1HA10" / "Circuit breaker size S00 for motor protection, CLASS 10 A-release 5.5...8 A N-release 104 … · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|3RV20214BA10', 'Siemens', '3RV2021-4BA10',
    45, 97, 97,
    'din',
    'https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2021-4BA10&language=en&caller=SIOS',
    3,
    'Kaynak: https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2021-4BA10&language=en&caller=SIOS s.3 · Alıntı: height 97 mm width 45 mm depth 97 mm · Sahiplik: Getirilen PDF s.1: "Data sheet 3RV2021-4BA10" / "Circuit breaker size S0 for motor protection, CLASS 10 A-release 13...20 A N-release 260 A… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|3RV20214DA10', 'Siemens', '3RV2021-4DA10',
    45, 97, 97,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 3RV2021-4DA10 Teknik Veri Sayfası (EN).pdf',
    3,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/SIEMENS - 3RV2021-4DA10 Teknik Veri Sayfası (EN).pdf s.3 · Alıntı: height 97 mm width 45 mm depth 97 mm · Sahiplik: Ayni PDF s.1 basligi: "Data sheet 3RV2021-4DA10"; olcunun okundugu s.3''un dip bilgisi: "3RV20214DA10 Page 3/7". Olcu bu siparis numarasinin… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|3RV20214EA10', 'Siemens', '3RV2021-4EA10',
    45, 97, 97,
    'din',
    'https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2021-4EA10&language=en&caller=SIOS',
    3,
    'Kaynak: https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2021-4EA10&language=en&caller=SIOS s.3 · Alıntı: height 97 mm width 45 mm depth 97 mm · Sahiplik: Getirilen PDF s.1: "Data sheet 3RV2021-4EA10" / "Circuit breaker size S0 for motor protection, CLASS 10 A-release 27...32 A N-release 400 A… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|3RV20414JA10', 'Siemens', '3RV2041-4JA10',
    70, 165, 176,
    'din',
    'https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2041-4JA10&language=en&caller=SIOS',
    3,
    'Kaynak: https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=3RV2041-4JA10&language=en&caller=SIOS s.3 · Alıntı: height 165 mm width 70 mm depth 176 mm · Sahiplik: Getirilen PDF s.1: "Data sheet 3RV2041-4JA10" / "Circuit breaker size S3 for motor protection, CLASS 10 A-release 45...63 A N-release 819 A… · Denetim: 3/3 lens onayladı'
  ),
  (
    '|MATIS7500', '', 'MATIS 7500',
    250, 330, 210,
    'plaka',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/ETA - MATIS 7500 Teknik Föy - Katalog Sayfaları (TR-EN).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/HABAŞ 50T/ETA - MATIS 7500 Teknik Föy - Katalog Sayfaları (TR-EN).pdf s.2 · Alıntı: BİR ve İKİ FAZLI İZOLASYON TRANSFORMATÖR SEÇİM TABLOSU / SELECTION TABLE OF ONE AND TWO PHASE ISOLATION TRANSFORMER — A B C D E ... 7500 250 330 210 200 167 68.00 · Sahiplik: Bu PDF, adi geregi MATIS 7500 icin olusturulmus TEK URUNLUK teknik foydur (''ETA - MATIS 7500 Teknik Föy - Katalog Sayfaları (TR-EN).pdf'') v… · Denet…'
  ),
  (
    'SCHNEIDERELECTRIC|G12F3F63', 'Schneider Electric', 'G12F3F63',
    75, 130, 60,
    'plaka',
    'https://www.se.com/id/en/product/download-pdf/G12F3F63?filename=Schneider+Electric_GoPact-MCCB_G12F3F63.pdf',
    2,
    'Kaynak: https://www.se.com/id/en/product/download-pdf/G12F3F63?filename=Schneider+Electric_GoPact-MCCB_G12F3F63.pdf s.2 · Alıntı: Width (W) 75 mm Height (H) 130 mm Depth (D) 60 mm Net weight 0.7 kg · Sahiplik: Belge, ureticinin (Schneider Electric, se.com) G12F3F63 siparis numarasina ait KENDI urun veri sayfasidir; 1. sayfa basliginda "Circuit bre… · Denetim: 3/3 lens onayladı'
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

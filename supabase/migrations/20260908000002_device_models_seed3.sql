-- ÜÇÜNCÜ AYIKLAMA TURU + BİR GERİ ALMA.
--
-- ═══════════════════════════════════════════════ MATIS 7500 DEFTERDEN ÇIKAR
--
-- `20260908000001` bu ürünü deftere yazmıştı; o sırada üç doğrulayıcıdan
-- biri kotaya takılmış ve iddia EKSİK OYLA geçmişti. Tur tamamlanınca ölçü
-- ÇÜRÜTÜLDÜ: sayılar kaynakta birebir var ve ambalaj değil gövde ölçüsü, ama
-- EKSEN ATAMASI kanıtlanamıyor — katalog yalnız "BOYUTLAR A B C" diyor,
-- hangi eksenin pano DERİNLİĞİ olduğunu hiçbir yerde söylemiyor; ölçü
-- çiziminde C ve E gövdenin değil ALT AYAK FLANŞININ üzerinde ölçülüyor.
--
-- Yanlış eksen, yanlış derinlikte pano sipariş ettirir. Doğrulanmamış ölçü
-- defterde OLGU olarak duramaz (PANO-12) — satır silinir, ürün "ölçüsü yok"
-- kuyruğuna geri döner ve mühendis elle girebilir.
--
-- SİLME YALNIZ KATALOG SATIRINI VURUR: mühendis bu ürüne elle bir ölçü
-- yazdıysa (`source = 'elle'`) o beyan korunur.

delete from public.electrical_device_models
 where type_no = 'MATIS 7500' and source = 'katalog';

-- ═══════════════════════════════════════════════ YENİ ONAYLANANLAR
--
-- Kotaya takıldığı için oylanamamış altı ürün, tur tamamlanınca ÜÇ LENSİN
-- ÜÇÜNÜ DE geçti.
--
-- İKİSİNİN MONTAJ TİPİ PANO DIŞIDIR ve bu bir düzeltmedir: `BC1-1403-7510`
-- (duvar prizi) ile `BK1-1402-3614` (dörtlü grup priz) taksonomide
-- "Fiş, Priz, Klemens ve Bağlantı" ailesindedir ve öntanım kural onları raya
-- koyar; kaynak belge ikisinin de DUVARA monte edildiğini gösteriyor.
-- Defterdeki `mount_type` öntanımı ezer ve ikisi panodan çıkar.

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
    'GESSMANN|V62L03ZP03ZP', 'GESSMANN', 'V62L-03ZP+03ZP',
    96, 96, 144,
    'kapak',
    'C:\Users\HP\Desktop\ORION\HESAP RAPORU KOD\Elektrik Katalogları\GESSMANN - V6 VV6 Master Switch Kumanda Kolu Teknik Föyü (EN).pdf',
    5,
    'Kaynak: C:\Users\HP\Desktop\ORION\HESAP RAPORU KOD\Elektrik Katalogları\GESSMANN - V6 VV6 Master Switch Kumanda Kolu Teknik Föyü (EN).pdf s.5 · Alıntı: Cover plate / max. 4 / IP 00 / 96 / B / B / 30 / 80 / 25 / 80 / 5,5 / 72 / 80 / 30 / 30 / 3,5 / Hole pattern ... 180 ... 85 ... 77 ... A ... Type | No. of contacts | Dim. A | Dim.… · Sahiplik: Belge bastan sona V6/VV6 ailesinin kendi bolumu (her sayfa altbilgisi ''V6 / VV6'', katalog s. 74-78). Sayfa 2''de temel unite listesinde…'
  ),
  (
    'OMRON|G2RVST700DC24', 'OMRON', 'G2RV-ST700 DC24',
    6.2, 90, 88,
    'din',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/OMRON - G2RV-ST G3RV-ST Slim IO Röle Veri Sayfası (EN).pdf',
    9,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/OMRON - G2RV-ST G3RV-ST Slim IO Röle Veri Sayfası (EN).pdf s.9 · Alıntı: Screw terminal | Models without latching lever (without test switch) | G2RV-ST700 | G2RV-ST700-AP ... 88 ... 80 ... 74.2 ... 46.1 ... 6.2 ... 3.4 29.6 ... 90 ... 34.8 ... 82.2 ...… · Sahiplik: Olcu cizimi bloğunun kendi basligi ''Screw terminal / Models without latching lever (without test switch) / G2RV-ST700 / G2RV-ST700-AP'' ve b… …'
  ),
  (
    'EATON|170M6464', 'EATON', '170M6464',
    76, 53, 92,
    'plaka',
    'https://www.eaton.com/us/en-us/skuPage.170M6464.html',
    null,
    'Kaynak: https://www.eaton.com/us/en-us/skuPage.170M6464.html · Alıntı: Catalog Number 170M6464 ... Product Length/Depth 53 mm Product Height 92 mm Product Width 76 mm Product Weight 848 g · Sahiplik: Eaton''un kendi SKU sayfasinin kunyesi bu siparis numarasinin kendisi: "Catalog Number 170M6464" ve basligi "Fuse-link, high speed, 1000 A, … · Denetim: 3/3 lens onayladı'
  ),
  (
    'BEMIS|BC114037510', 'BEMIS', 'BC1-1403-7510',
    99, 99, 120,
    'saha',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/BEMIS - BC1-1403-7510 Duvar Prizi 16A 2P+E Teknik Föyü (TR).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/BEMIS - BC1-1403-7510 Duvar Prizi 16A 2P+E Teknik Föyü (TR).pdf s.2 · Alıntı: Ölçü resmi (sayfa 2) etiketleri birebir: ön görünüş düşey "99,00", ön görünüş yatay "99,00"; yan görünüş toplam "120,00"; ikinci yan görünüşte rakor çıkıntısı "28,00"; arka görünü… · Sahiplik: Aynı 2 sayfalık föyün 1. sayfası metin katmanında "Duvar Priz / Ürün Kodu : BC1-1403-7510 / Barkod : 8698523907559 / IP Sınıfı : IP67" y…'
  ),
  (
    'BEMIS|BC135047420', 'BEMIS', 'BC1-3504-7420',
    91, 100, 42,
    'kapak',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/BEMIS - BC1-3504-7420 45 Derece Eğik Makine Prizi 32A 3P+E Teknik Föyü (TR).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/BEMIS - BC1-3504-7420 45 Derece Eğik Makine Prizi 32A 3P+E Teknik Föyü (TR).pdf s.2 · Alıntı: Sayfa 2''deki tablo birebir: "Ölçüler / Dimensions (mm)" — a 107, b 42, c 80, d 77, e 91, f 82, g 100, h (boş). Aynı sayfadaki görünüşlerde harfler: yan görünüşte toplam "a", panel… · Sahiplik: Aynı föyün 1. sayfası: "45° Eğik Makine Priz / Ürün Kodu : BC1-3504-7420 / Barkod : 8698523905555 / IP Sınıfı : IP67 / A…'
  ),
  (
    'BEMIS|BK114023614', 'BEMIS', 'BK1-1402-3614',
    280, 64, 45,
    'saha',
    'C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/BEMIS - BK1-1402-3614 Dörtlü Grup Priz 16A 2P+E Teknik Föyü (TR).pdf',
    2,
    'Kaynak: C:/Users/HP/Desktop/ORION/HESAP RAPORU KOD/Elektrik Katalogları/BEMIS - BK1-1402-3614 Dörtlü Grup Priz 16A 2P+E Teknik Föyü (TR).pdf s.2 · Alıntı: Ölçü resmi (sayfa 2) etiketleri birebir: üst görünüş toplam uzunluk "280,00", delik aralığı "220,00", toplam genişlik "64,00", düşey delik aralığı "54,00", delik çapı "Ø4,50"; yan… · Sahiplik: Aynı föyün 1. sayfası: "Dörtlü Grup Priz / Ürün Kodu : BK1-1402-3614 / IP Sınıfı : IP54 / Gövde Malzemesi : Kauçuk". Ayrıca ölçü re…'
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

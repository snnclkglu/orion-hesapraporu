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
    'SCHNEIDERELECTRIC|ATV930D90N4', 'Schneider Electric', 'ATV930D90N4',
    290, 922, 325.5,
    'plaka',
    '0026-01/SCHNEIDER ELECTRIC - Altivar Process ATV900 Kataloğu 2023 (EN).pdf',
    87,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - Altivar Process ATV900 Kataloğu 2023 (EN).pdf s.87 · Alıntı: ATV930D90N4 290 x 922 x 325.5 11.42 x 36.30 x 12.81 · Sahiplik: PDF s.87 (basılı 2/69) başlığı: ''Dimensions (continued) / Variable speed drives / Altivar Process ATV900 / IP21 drives: 380...480 V''. Tablo… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|ATV930D15N4', 'Schneider Electric', 'ATV930D15N4',
    211, 545.9, 235,
    'plaka',
    '0026-01/SCHNEIDER ELECTRIC - Altivar Process ATV900 Kataloğu 2023 (EN).pdf',
    87,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - Altivar Process ATV900 Kataloğu 2023 (EN).pdf s.87 · Alıntı: ATV930D15N4 211 x 545.9 x 235 8.31 x 21.49 x 9.25 · Sahiplik: Aynı tablo (PDF s.87 / basılı 2/69, ''380...480 V IP21/UL Type 1 and cabinet integration drives'' > ''Overall dimensions'', sütunlar ''Reference… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|A9F74110', 'Schneider Electric', 'A9F74110',
    18, 85, 78.5,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf',
    18,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf s.18 · Alıntı: Dimensões (mm) 4P 72 / 3P 54 / 2P 36 / 1P 18 ; 78.5 ; 69.5 ; 50 ; 5.5 ; 4.4 ; 94 ; 85 ; 45 ; 64 ; 4.6 · Sahiplik: Kutup sayısı: PDF s.11 ''Disjuntor iC60N'' referans tablosunda A9F74110 x=281,2 sütununda; o sütunun başlığı ''Curva C'' (x=281,2) ve blok başl… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|A9F74206', 'Schneider Electric', 'A9F74206',
    36, 85, 78.5,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf',
    18,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf s.18 · Alıntı: Dimensões (mm) 4P 72 / 3P 54 / 2P 36 / 1P 18 ; 78.5 ; 69.5 ; 50 ; 5.5 ; 4.4 ; 94 ; 85 ; 45 ; 64 ; 4.6 · Sahiplik: Kutup sayısı: PDF s.12 (s.11 ile aynı çift sayfa yayılımının sağ yarısı) ''Disjuntor iC60N'' tablosunda A9F74206 x=111,4; o sütunun başlığı ''… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|A9F74210', 'Schneider Electric', 'A9F74210',
    36, 85, 78.5,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf',
    18,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf s.18 · Alıntı: Dimensões (mm) 4P 72 / 3P 54 / 2P 36 / 1P 18 ; 78.5 ; 69.5 ; 50 ; 5.5 ; 4.4 ; 94 ; 85 ; 45 ; 64 ; 4.6 · Sahiplik: PDF s.12 ''Disjuntor iC60N'' tablosunda A9F74210 x=111,4 → sütun başlığı ''C'', blok başlığı ''Tipo 2P'' (x=56,0), 10 A satırı. Aynı bloğun ''Larg… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|A9F74216', 'Schneider Electric', 'A9F74216',
    36, 85, 78.5,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf',
    18,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf s.18 · Alıntı: Dimensões (mm) 4P 72 / 3P 54 / 2P 36 / 1P 18 ; 78.5 ; 69.5 ; 50 ; 5.5 ; 4.4 ; 94 ; 85 ; 45 ; 64 ; 4.6 · Sahiplik: PDF s.12 ''Disjuntor iC60N'' tablosunda A9F74216 x=111,4 → sütun başlığı ''C'', blok başlığı ''Tipo 2P'' (x=56,0), 16 A satırı. ''Largura em passo… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|A9F74332', 'Schneider Electric', 'A9F74332',
    54, 85, 78.5,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf',
    18,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf s.18 · Alıntı: Dimensões (mm) 4P 72 / 3P 54 / 2P 36 / 1P 18 ; 78.5 ; 69.5 ; 50 ; 5.5 ; 4.4 ; 94 ; 85 ; 45 ; 64 ; 4.6 · Sahiplik: PDF s.12 ''Disjuntor iC60N'' tablosunda A9F74332 x=277,5 → sütun başlığı ''C'' (x=277,6), blok başlığı ''Tipo 3P'' (x=222,2), 32 A satırı. 3P blo… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|A9A26904', 'Schneider Electric', 'A9A26904',
    9, 86, 67.5,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf',
    141,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf s.141 · Alıntı: Dimensões (mm) ... 9 ; 67.5 ; 63.5 ; 44 ; 5.5 ; 86 ; 45 [resim altyazısı:] iOF, iSD · Sahiplik: PDF s.140 ''Auxiliares elétricos para dispositivos iC60, iID, iDPN Vigi (1P+N), RCA e ARA'' tablosunda ''Sinalização'' bloğu: sütun başlığı ''iO… · Denetim: 1/1 lens onayladı'
  ),
  (
    'ELFATEK|ESXMID602', 'Elfatek', 'ESX_MID 602',
    170, 320, 120,
    'plaka',
    'https://www.elfatek.com.tr/6-butonlu-vinc-uzaktan-kumanda-seti-en-esx-602',
    null,
    'Kaynak: https://www.elfatek.com.tr/6-butonlu-vinc-uzaktan-kumanda-seti-en-esx-602 · Alıntı: Alıcı Teknik Özellikler Model ESX ... Gövde Yapısı Polyamid ... Ağırlık (Kutu Dahil) 2.2 kg Boyut (Small) 235 × 150 × 120 mm Boyut (Medium) 320 × 170 × 120 mm Boyut (Large) 335 × … · Sahiplik: Ölçüler üreticinin EN ESX 602 ürün sayfasındaki ''Alıcı Teknik Özellikler'' (yani ALICI ünitesi) tablosundandır - verici tablosu ayrıdır ve ö… · Denetim: 0/0 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|LC1G185KUEN', 'Schneider Electric', 'LC1G185KUEN',
    107.7, 193, 192.9,
    'plaka',
    '0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf',
    804,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf s.804 · Alıntı: Standard LC1G115…225 & LC1G250DC TeSys Giga High power contactors / 3-pole / All dimensions are in mm. / a b c G J M H L L1 P Q S Ø / 107.7 193 192.9 35 166 164.1 139.4 66.9 69.9 … · Sahiplik: Uc adimli zincir. (1) s.782 (B9/12) ''Giga High Power Contactors - Standard - 3-pole and 4-pole'' siparis tablosunda ''305 250 LC1G185EHEN LC1… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|LP1K0610BD', 'Schneider Electric', 'LP1K0610BD',
    45, 58, 57,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf',
    714,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf s.714 · Alıntı: Contactors LC1K, LC7K, LP1K, LP4K / On panel On mounting rail NSYSDR200BD or NSYSDR200 (35 mm) / 57 35 / LA1 K / 58 50 / 35 / 45 / 4xØ4 / DF565021.eps / 57 / 58 / 45 / DF565023.eps · Sahiplik: (1) s.698 (B8/68) siparis numarasi dizininde tam kod ''LP1K0610BD'' aynen geciyor. (2) s.635 (B8/5) ''3-pole contactors - Motor control 6 to 1… · Denetim: 1/1 lens onayladı'
  ),
  (
    'ETA|MATIS4000', 'ETA', 'MATIS 4000',
    210, 280, 205,
    'plaka',
    'ETA MATIS - Trafo ve Reaktor Urun Katalogu (TR).pdf',
    5,
    'Kaynak: ETA MATIS - Trafo ve Reaktor Urun Katalogu (TR).pdf s.5 · Alıntı: GÜÇ POWER (VA) | BOYUTLAR / DIMENSIONS (mm): A B C | MONTAJ ÖLÇÜ (mm) INSTALLATION DIMENSIONS: D E | AĞIRLIK WEIGHT (kg) ... 4000 | 210 | 280 | 205 | 168 | 146 | 39.50 · Sahiplik: Sayfa 5 tablosunun başlığı ''BİR ve İKİ FAZLI İZOLASYON TRANSFORMATÖR SEÇİM TABLOSU''. Tablonun ilk sütunu ''GÜÇ / POWER (VA)''dır; yani satır … · Denetim: 1/1 lens onayladı'
  ),
  (
    'QUICK|FULL2500', 'QUICK', 'FULL2500',
    268, 268, 95,
    'govde',
    'QUICK - FULL 2500 Fanli Filtre IP54 Teknik Foyu (TR).pdf',
    1,
    'Kaynak: QUICK - FULL 2500 Fanli Filtre IP54 Teknik Foyu (TR).pdf s.1 · Alıntı: Dimensions | Ölçüler | mm | 268x268x95 · Sahiplik: Föy tek ürünlüktür: sayfa başlığı ''QUICK FULL 2500 IP54 / Filter Fans / Fanlı Filtre'' ve teknik tablonun üç veri sütununun üçünün de başlığ… · Denetim: 0/0 lens onayladı'
  ),
  (
    'MUCCO|SNTSL19022', 'MUCCO', 'SNT-SL190-22',
    75, 83, 82,
    'yan',
    'MUCCO - Sinyal ve İkaz Ürünleri Genel Kataloğu (EN).pdf',
    136,
    'Kaynak: MUCCO - Sinyal ve İkaz Ürünleri Genel Kataloğu (EN).pdf s.136 · Alıntı: SL190 Series Motor Sirens | PART NO SNT-SL190-13 SNT-SL190-22 | Power Output 40W 40W | Volume 108dB 108dB || ölçü çizimi kotları: "82" · "83" · "75" · Sahiplik: Sayfa 136 üç seri (SL190/SL290/SL390) taşıyor; her serinin kendi tablosunun tam sağında, aynı yatay bantta kendi ölçü çizimi duruyor. SL190… · Denetim: 0/0 lens onayladı'
  ),
  (
    'MUCCO|SNTB7101', 'MUCCO', 'SNT-B710-1',
    70, 260.5, 79.5,
    'yan',
    'MUCCO - Sinyal ve İkaz Ürünleri Genel Kataloğu (EN).pdf',
    71,
    'Kaynak: MUCCO - Sinyal ve İkaz Ürünleri Genel Kataloğu (EN).pdf s.71 · Alıntı: SNT-B710/B720 Series Led Horns | Lens Diameter: 70mm | Mounting Types: Wall || ölçü çizimi kotları: "70mm" · "149 mm" · "145 mm" · "260,5 mm" · "Ø5" · "77,7mm" · "79,5mm" | çizim … · Sahiplik: Sayfa 71''in tamamı tek bir seriye ayrılmış: başlık "Led Horns / SNT-B710/B720 Series Led Horns". Sayfanın altındaki gri ölçü şeridi bu sayf… · Denetim: 0/0 lens onayladı'
  ),
  (
    'MUCCO|SNT7024S3', 'MUCCO', 'SNT-7024-S3',
    85, 275.5, 85,
    'yan',
    'MUCCO - Sinyal ve İkaz Ürünleri Genel Kataloğu (EN).pdf',
    14,
    'Kaynak: MUCCO - Sinyal ve İkaz Ürünleri Genel Kataloğu (EN).pdf s.14 · Alıntı: STACK LIGHT | Stack Light with 3 Layer | Voltage Options: 7024: 24V/DC | - Lens Diameter: 70mm || ölçü çizimi kotları: "Ø70" · "60 mm" · "252,500" · "275,500" · "R42,500" · "Ø5" · Sahiplik: Sayfa 14 yalnız 3 KATLI kolona ayrılmıştır ("Stack Light with 3 Layer") ve sayfa üzerindeki gerilim seçenekleri listesi "7024: 24V/DC" satı… · Denetim: 0/0 lens onayladı'
  ),
  (
    'MUCCO|SNTBL1861', 'MUCCO', 'SNT-BL186-1',
    229, 265, 98,
    'yan',
    'MUCCO - Sinyal ve İkaz Ürünleri Genel Kataloğu (EN).pdf',
    127,
    'Kaynak: MUCCO - Sinyal ve İkaz Ürünleri Genel Kataloğu (EN).pdf s.127 · Alıntı: 60W Crane Safety Light | BL186 Series Forklift safety light | Part no. Power Supply Color | SNT-BL186-1 10-30V/DC Red || ölçü çizimi kotları: "229mm" · "265mm" · "98 mm" · Sahiplik: Sayfa 127 üç ürünü üst üste üç ayrı yatay blokta veriyor (BL184 / BL186 / BL188) ve her bloğun SOL sütununda o bloğa ait ölçü çizimi duruyo… · Denetim: 0/0 lens onayladı'
  ),
  (
    'NIKIELECTRONICS|N1000P2160W5000K', 'Niki Electronics', 'N1000-P-2/160W.5000K',
    412, 339, 110,
    'yan',
    'NIKI ELEKTRONIK - AGORA P-2 LED Projektör Teknik Föyü (TR).pdf',
    1,
    'Kaynak: NIKI ELEKTRONIK - AGORA P-2 LED Projektör Teknik Föyü (TR).pdf s.1 · Alıntı: N1000-P-2-85W-XK-N1000-P-2-160W-XK | 85-160 W | 14135-26608 lm | 166,3 | 2 | 2 | 412 x 339 x 110 | 95 | 24 | 12 | 12 | 50 | 6,8 · Sahiplik: Föy tek ürün ailesini (P-2) anlatıyor ama tabloda ON ayrı güç bandı var; 160 W bandını ayırdım. "Product Code / Ürün Kodu" sütununda "N1000… · Denetim: 0/0 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|RXG22BD', 'Schneider Electric', 'RXG22BD',
    15.8, 77.5, 73,
    'din',
    'https://www.se.com/us/en/product/download-pdf/RXG22BD?filename=Schneider+Electric_Harmony-Electromechanical-Relays_RXG22BD.pdf',
    5,
    'Kaynak: https://www.se.com/us/en/product/download-pdf/RXG22BD?filename=Schneider+Electric_Harmony-Electromechanical-Relays_RXG22BD.pdf s.5 · Alıntı: Dimensions Drawings / Dimensions — mm / in. — 36.5(MAX) 1.44(MAX) | 34.5 1.36 | 27.5 1.08 | 29(MAX) 1.14(MAX) | 13(MAX) 0.51(MAX) · Sahiplik: PDF ust bilgisi her sayfada ''Product data sheet RXG22BD''; dosya se.com''un RXG22BD urun sayfasindaki ''Product Datasheet'' baglantisindan uret… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|RGZE1S48M', 'Schneider Electric', 'RGZE1S48M',
    15.8, 77.5, 73,
    'din',
    'https://www.se.com/us/en/product/download-pdf/RGZE1S48M?filename=Schneider+Electric_Harmony-Electromechanical-Relays_RGZE1S48M.pdf',
    4,
    'Kaynak: https://www.se.com/us/en/product/download-pdf/RGZE1S48M?filename=Schneider+Electric_Harmony-Electromechanical-Relays_RGZE1S48M.pdf s.4 · Alıntı: Dimensions Drawings / Dimensions — mm / in. — 15.8(MAX) 0.62(MAX) | 77.5 (MAX) 3.05 (MAX) | 73(MAX) 2.87(MAX) | 62(MAX) 2.44(MAX) | 42.5 1.67 | 36 1.42 | 24 0.94 · Sahiplik: PDF ust bilgisi her sayfada ''Product data sheet RGZE1S48M''; ilk sayfa ''socket, Harmony Electromechanical Relays, for RXG2 relays, 5A, screw… · Denetim: …'
  ),
  (
    'SCHNEIDERELECTRIC|RXM4AB1BD', 'Schneider Electric', 'RXM4AB1BD',
    27, 80, 74,
    'din',
    'https://www.se.com/us/en/product/download-pdf/RXM4AB1BD?filename=Schneider+Electric_Harmony-Electromechanical-Relays_RXM4AB1BD.pdf',
    5,
    'Kaynak: https://www.se.com/us/en/product/download-pdf/RXM4AB1BD?filename=Schneider+Electric_Harmony-Electromechanical-Relays_RXM4AB1BD.pdf s.5 · Alıntı: Dimensions Drawings / Dimensions — mm / in. — 40 1.57 | 7.7 0.30 | 6 0.23 | 21 0.82 | 27 1.06 | Pin Side View: 13,2 0.51 | 4,4 0.17 | 2,5 0.9 · Sahiplik: PDF ust bilgisi her sayfada ''Product data sheet RXM4AB1BD''; ilk sayfa ''miniature plug in relay, Harmony Electromechanical Relays, 6A, 4CO, … · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|RXZE2M114M', 'Schneider Electric', 'RXZE2M114M',
    27, 80, 74,
    'din',
    'https://www.se.com/us/en/product/download-pdf/RXZE2M114M?filename=Schneider+Electric_Harmony-Electromechanical-Relays_RXZE2M114M.pdf',
    4,
    'Kaynak: https://www.se.com/us/en/product/download-pdf/RXZE2M114M?filename=Schneider+Electric_Harmony-Electromechanical-Relays_RXZE2M114M.pdf s.4 · Alıntı: Dimensions Drawings / Dimensions — mm / in. — 80 3.14 | 27 1.06 | 67 2.63 | 50 1.96 | 43 1.69 | 7 0.27 | 40 1.57 | 23,5 0.92 — (1) Relays (2) Protection module (3) Maintaining cla… · Sahiplik: PDF ust bilgisi her sayfada ''Product data sheet RXZE2M114M''; ilk sayfa ''socket, Harmony Electromechanical Relays, for RXM2 RXM4 rel…'
  ),
  (
    'SCHNEIDERELECTRIC|RM22TG20', 'Schneider Electric', 'RM22TG20',
    22.5, 90, 79.5,
    'din',
    'https://www.se.com/us/en/product/download-pdf/RM22TG20?filename=Schneider+Electric_Harmony-Control-Relays_RM22TG20.pdf',
    5,
    'Kaynak: https://www.se.com/us/en/product/download-pdf/RM22TG20?filename=Schneider+Electric_Harmony-Control-Relays_RM22TG20.pdf s.5 · Alıntı: Dimensions Drawings / Dimensions — mm / in. — 79.5 3.13 | 22.5 0.89 | 90 3.54 · Sahiplik: PDF ust bilgisi her sayfada ''Product data sheet RM22TG20''; ilk sayfa ''Harmony, Modular 3-phase supply control relay, 8A, 2 CO, 183...528VAC… · Denetim: 1/1 lens onayladı'
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

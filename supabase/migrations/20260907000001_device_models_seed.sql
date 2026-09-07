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
    'SOCOMEC|26003032', 'SOCOMEC', '26003032',
    230, 235, 110,
    'plaka',
    'SOCOMEC - SIRCO 3P 315A Yuk Ayirici Urun Foyu (TR).pdf',
    1,
    'Kaynak: SOCOMEC - SIRCO 3P 315A Yuk Ayirici Urun Foyu (TR).pdf s.1 · Alıntı: Genişlik[mm] 230 Yükseklik[mm] 235 Derinlik [mm] 110 · Sahiplik: Tek ürünlük ürün föyü. Sayfa 1 başlığı "SIRCO 3X315A F", hemen altında "26003032"; ölçüler bu başlığın ALTINDAKİ "ETIM - Mekanik özellikler… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SOCOMEC|26003041', 'SOCOMEC', '26003041',
    230, 235, 110,
    'plaka',
    'SOCOMEC - SIRCO 3P 400A Yuk Ayirici Urun Foyu (TR).pdf',
    1,
    'Kaynak: SOCOMEC - SIRCO 3P 400A Yuk Ayirici Urun Foyu (TR).pdf s.1 · Alıntı: Genişlik[mm] 230 Yükseklik[mm] 235 Derinlik [mm] 110 · Sahiplik: Tek ürünlük ürün föyü. Sayfa 1 başlığı "SIRCO 3X400A F", hemen altında "26003041"; ölçüler bu başlığın ALTINDAKİ "ETIM - Mekanik özellikler… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SOCOMEC|26003064', 'SOCOMEC', '26003064',
    230, 260, 110,
    'plaka',
    'SOCOMEC - SIRCO 3P 630A Yuk Ayirici Urun Foyu (TR).pdf',
    1,
    'Kaynak: SOCOMEC - SIRCO 3P 630A Yuk Ayirici Urun Foyu (TR).pdf s.1 · Alıntı: Genişlik[mm] 230 Yükseklik[mm] 260 Derinlik [mm] 110 · Sahiplik: Tek ürünlük ürün föyü. Sayfa 1 başlığı "SIRCO 3X630A F", hemen altında "26003064"; ölçüler bu başlığın ALTINDAKİ "ETIM - Mekanik özellikler… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SOCOMEC|26003121', 'SOCOMEC', '26003121',
    372, 288, 140,
    'plaka',
    'SOCOMEC - SIRCO 3P 1250A Yuk Ayirici Urun Foyu (TR).pdf',
    1,
    'Kaynak: SOCOMEC - SIRCO 3P 1250A Yuk Ayirici Urun Foyu (TR).pdf s.1 · Alıntı: Genişlik[mm] 372 Yükseklik[mm] 288 Derinlik [mm] 140 · Sahiplik: Tek ürünlük ürün föyü. Sayfa 1''in ilk iki satırı ürün tanımlayıcıdır: "SIRCO 3X1250A F" ve hemen altında "26003121". Ölçü satırları bu başl… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3RN20101CW30', 'Siemens', '3RN2010-1CW30',
    17.5, 100, 90,
    'din',
    'HABAŞ 50T/SIEMENS - 3RN2010-1CW30 Teknik Veri Sayfası (EN).pdf',
    3,
    'Kaynak: HABAŞ 50T/SIEMENS - 3RN2010-1CW30 Teknik Veri Sayfası (EN).pdf s.3 · Alıntı: Installation/ mounting/ dimensions | mounting position any | fastening method screw and snap-on mounting onto 35 mm DIN rail | height 100 mm | width 17.5 mm | depth 90 mm · Sahiplik: Tek ürünlük teknik föy: 1. sayfa ilk satırı "Data sheet 3RN2010-1CW30" ve altında "product type designation 3RN2"; 3. sayfa alt bilgisi "3R… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3RT20151AP01', 'Siemens', '3RT2015-1AP01',
    45, 58, 73,
    'din',
    'HABAŞ 50T/SIEMENS - 3RT2015-1AP01 Teknik Veri Sayfası (EN).pdf',
    5,
    'Kaynak: HABAŞ 50T/SIEMENS - 3RT2015-1AP01 Teknik Veri Sayfası (EN).pdf s.5 · Alıntı: Installation/ mounting/ dimensions / fastening method screw and snap-on mounting onto 35 mm DIN rail according to DIN EN 60715 / height 58 mm / width 45 mm / depth 73 mm · Sahiplik: Tek urunluk teknik foy: belgedeki her sey bu siparis numarasina ait. s.1 basligi birebir "Data sheet 3RT2015-1AP01" ve devami "power contac… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3RT20231AP00', 'Siemens', '3RT2023-1AP00',
    45, 85, 97,
    'din',
    'HABAŞ 50T/SIEMENS - 3RT2023-1AP00 Teknik Veri Sayfası (EN).pdf',
    5,
    'Kaynak: HABAŞ 50T/SIEMENS - 3RT2023-1AP00 Teknik Veri Sayfası (EN).pdf s.5 · Alıntı: Installation/ mounting/ dimensions / fastening method screw and snap-on mounting onto 35 mm DIN rail according to DIN EN 60715 / height 85 mm / width 45 mm / depth 97 mm · Sahiplik: Tek urunluk teknik foy: belgedeki her sey bu siparis numarasina ait. s.1 basligi birebir "Data sheet 3RT2023-1AP00" ve devami "power contac… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3RT20231BB40', 'Siemens', '3RT2023-1BB40',
    45, 85, 107,
    'din',
    'SIEMENS - SIRIUS IC10 Kontaktorler 3RT 3RH Motor Anahtarlama (EN).pdf',
    31,
    'Kaynak: SIEMENS - SIRIUS IC10 Kontaktorler 3RT 3RH Motor Anahtarlama (EN).pdf s.31 · Alıntı: Type 3RT2023 to 3RT2025 3RT2026 to 3RT2028 / Size S0 / Dimensions (W x H x D) / DC operation / • Basic unit / - Screw terminals mm 45 x 85 x 107 · Sahiplik: Olcu tablosunun USTUNDEKI baslik satiri s.31''de birebir "Type 3RT2023 to 3RT2025 3RT2026 to 3RT2028" + "Size S0"; 3RT2023 birinci sutun gru… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3RT20241AP00', 'Siemens', '3RT2024-1AP00',
    45, 85, 97,
    'din',
    'SIEMENS - SIRIUS IC10 Kontaktorler 3RT 3RH Motor Anahtarlama (EN).pdf',
    31,
    'Kaynak: SIEMENS - SIRIUS IC10 Kontaktorler 3RT 3RH Motor Anahtarlama (EN).pdf s.31 · Alıntı: Type 3RT2023 to 3RT2025 3RT2026 to 3RT2028 / Size S0 / Dimensions (W x H x D) / AC operation / • Basic unit / - Screw terminals mm 45 x 85 x 97 · Sahiplik: Olcu tablosunun USTUNDEKI baslik satiri s.31''de birebir "Type 3RT2023 to 3RT2025 3RT2026 to 3RT2028" + "Size S0"; 3RT2024 birinci sutun gru… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3RT20261AP00', 'Siemens', '3RT2026-1AP00',
    45, 85, 97,
    'din',
    'SIEMENS - SIRIUS IC10 Kontaktorler 3RT 3RH Motor Anahtarlama (EN).pdf',
    31,
    'Kaynak: SIEMENS - SIRIUS IC10 Kontaktorler 3RT 3RH Motor Anahtarlama (EN).pdf s.31 · Alıntı: Type 3RT2023 to 3RT2025 3RT2026 to 3RT2028 / Size S0 / Dimensions (W x H x D) / AC operation / • Basic unit / - Screw terminals mm 45 x 85 x 97 · Sahiplik: Olcu tablosunun USTUNDEKI urun-tanimlayici baslik satiri s.31''de birebir: "Type 3RT2023 to 3RT2025 3RT2026 to 3RT2028" + "Size S0" — 3RT202… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3RU21264BB1', 'Siemens', '3RU2126-4BB1',
    45, 97, 95,
    'din',
    'SIEMENS - SIRIUS IC10 Koruma Cihazlari 3RV 3RU 3RB (EN).pdf',
    87,
    'Kaynak: SIEMENS - SIRIUS IC10 Koruma Cihazlari 3RV 3RU 3RB (EN).pdf s.87 · Alıntı: Type 3RU2116 3RU2126 3RU2136 3RU2146 / Size S00 S0 S2 S3 / Dimensions (W x H x D) (overload relay with stand-alone installation support) • Screw terminals • Spring-type terminals … · Sahiplik: Sayfa 87''de x=352.9 sutununda ust satirlar urun-tanimlayicidir: y=351.5 "3RU2126", y=340.9 "S0". Ayni x=352.9 sutununda y=307.7 ("• Screw t… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3RU21364JB1', 'Siemens', '3RU2136-4JB1',
    55, 105, 117,
    'din',
    'SIEMENS - SIRIUS IC10 Koruma Cihazlari 3RV 3RU 3RB (EN).pdf',
    87,
    'Kaynak: SIEMENS - SIRIUS IC10 Koruma Cihazlari 3RV 3RU 3RB (EN).pdf s.87 · Alıntı: Type 3RU2116 3RU2126 3RU2136 3RU2146 / Size S00 S0 S2 S3 / Dimensions (W x H x D) (overload relay with stand-alone installation support) • Screw terminals • Spring-type terminals … · Sahiplik: Sayfa 87''de olcu tablosunun UST basligi urun-tanimlayici satirdir: y=351.5''te "3RU2136", y=340.9''da "S2"; her ikisi de x=417.8 sutununda. "… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3RU21464MB1', 'Siemens', '3RU2146-4MB1',
    70, 106, 124,
    'din',
    'SIEMENS - SIRIUS IC10 Koruma Cihazlari 3RV 3RU 3RB (EN).pdf',
    87,
    'Kaynak: SIEMENS - SIRIUS IC10 Koruma Cihazlari 3RV 3RU 3RB (EN).pdf s.87 · Alıntı: Type 3RU2116 3RU2126 3RU2136 3RU2146 / Size S00 S0 S2 S3 / Dimensions (W x H x D) (overload relay with stand-alone installation support) • Screw terminals • Spring-type terminals … · Sahiplik: Sayfa 87''de x=482.9 sutununda urun-tanimlayici ust satirlar: y=351.5 "3RU2146", y=340.9 "S3". Ayni sutunda y=307.7 ve y=300.2 satirlarinin … · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3SK11211CB41', 'Siemens', '3SK1121-1CB41',
    22.5, 100, 121.6,
    'din',
    'SIEMENS - SIRIUS IC10 Guvenlik Teknigi 3SK Guvenlik Roleleri (EN).pdf',
    20,
    'Kaynak: SIEMENS - SIRIUS IC10 Guvenlik Teknigi 3SK Guvenlik Roleleri (EN).pdf s.20 · Alıntı: Article number | 3SK1111-.AB30, 3SK1211-.BB00, 3SK1211-.BB40 | 3SK1111-.AW20, 3SK1121, 3SK1211-.BW20 | 3SK1112 | 3SK1120 | 3SK1122 | 3SK1213 | 3SK1220 ... General data ... Width x… · Sahiplik: Sipariş numarası ÖLÇÜ SATIRININ ÜSTÜNDEKİ ''Article number'' başlık satırında geçiyor (ölçü bloğunun altında ''Suitable for'' türü bir satır YO… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3SK11212AB40', 'Siemens', '3SK1121-2AB40',
    22.5, 100, 121.6,
    'din',
    '0026-01/SIEMENS - 3SK1121-2AB40 Teknik Veri Sayfası (EN).pdf',
    4,
    'Kaynak: 0026-01/SIEMENS - 3SK1121-2AB40 Teknik Veri Sayfası (EN).pdf s.4 · Alıntı: Installation/ mounting/ dimensions mounting position any fastening method screw and snap-on mounting height 100 mm width 22.5 mm depth 121.6 mm required spacing ● for grounded par… · Sahiplik: Belge TEK ÜRÜNLÜK teknik veri sayfası: 1. sayfanın ilk satırı ''Data sheet 3SK1121-2AB40'' ve ''SIRIUS safety relay Basic unit Advanced series… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3UG55111AR20', 'Siemens', '3UG5511-1AR20',
    22.5, 100, 90,
    'din',
    'SIEMENS - 3UG5511-1AR20 Sebeke Izleme Rolesi Teknik Veri (TR).pdf',
    3,
    'Kaynak: SIEMENS - 3UG5511-1AR20 Sebeke Izleme Rolesi Teknik Veri (TR).pdf s.3 · Alıntı: Montaj/ Sabitleme/ Ebatlar montaj konumu isteğe göre sabitleme türü 35 mm''lik üstten geçmeli raya vidalı ve tırnaklı sabitleme yükseklik 100 mm genişlik 22,5 mm derinlik 90 mm · Sahiplik: Tek ürünlük teknik föy: 1. sayfa başlığı "Bilgi formu 3UG5511-1AR20", ölçü satırlarının bulunduğu 3. sayfanın alt bilgisi "3UG55111AR20 / S… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3VA11164EE360AA0', 'Siemens', '3VA1116-4EE36-0AA0',
    76.2, 130, 70,
    'plaka',
    'SIEMENS - 3VA1116-4EE36-0AA0 Kompakt Salter 160A Teknik Veri (TR).pdf',
    2,
    'Kaynak: SIEMENS - 3VA1116-4EE36-0AA0 Kompakt Salter 160A Teknik Veri (TR).pdf s.2 · Alıntı: Mekanik Tasarım ... yükseklik [inç] 5,12 in / yükseklik 130 mm / genişlik [inç] 3 in / bağlanabilir iletken kesiti türü / yuvarlak iletken terminali / çok telli 1 x (1,5 - 70 mm²)… · Sahiplik: Belge tek ürünlük teknik föydür: 1. sayfa başlığı "Bilgi formu 3VA1116-4EE36-0AA0" ve hemen altında "devre kesici 3VA1 IEC Frame 160 ... Ic… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|3WL12104CB344AN2ZC22', 'Siemens', '3WL1210-4CB34-4AN2-Z C22',
    460, 507, 369,
    'plaka',
    'SIEMENS - 3WL1210-4CB34-4AN2 Acik Tip Salter 1000A Teknik Veri (TR).pdf',
    2,
    'Kaynak: SIEMENS - 3WL1210-4CB34-4AN2 Acik Tip Salter 1000A Teknik Veri (TR).pdf s.2 · Alıntı: Mekanik Tasarım yükseklik 507 mm genişlik 460 mm derinlik 369 mm sabitleme türü sabit monte MB başına net ağırlık 56 kg · Sahiplik: Belge tek ürünlük Siemens bilgi formudur. Sayfa 1 ilk satırı: "Bilgi formu 3WL1210-4CB34-4AN2". Ölçülerin bulunduğu sayfa 2''nin altbilgisi:… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SOCOMEC|41AC4063', 'SOCOMEC', '41AC4063',
    379, 260, 295,
    'plaka',
    'SOCOMEC - SIRCOVER 4P 630A Transfer Salteri Urun Foyu (TR).pdf',
    1,
    'Kaynak: SOCOMEC - SIRCOVER 4P 630A Transfer Salteri Urun Foyu (TR).pdf s.1 · Alıntı: Genişlik[mm] 379 Yükseklik[mm] 260 Derinlik [mm] 295 · Sahiplik: Tek ürünlük ürün föyü. Sayfa 1 başlığı "SIRCOVER 4X630A F", hemen altında "41AC4063"; ölçü satırları bu başlığın ALTINDAKİ "ETIM - Mekanik … · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|5TT41010', 'Siemens', '5TT4101-0',
    18, 90, 76,
    'din',
    'HABAŞ 50T/SIEMENS - 5TT4101-0 Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: HABAŞ 50T/SIEMENS - 5TT4101-0 Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: Mechanical Design height 90 mm width 18 mm width of opening of the contacts 1.2 mm depth 76 mm mounting height 90 mm installation depth 70 mm number of modular width units 1 faste… · Sahiplik: Tek ürünlük teknik föy: 1. sayfa başlığı "Data sheet 5TT4101-0", ölçünün okunduğu 2. sayfanın alt bilgisi "5TT41010 / Page 2/5". Belgede ba… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6AV21232MB030AX0', 'Siemens', '6AV2123-2MB03-0AX0',
    330, 245, 54.9,
    'kapak',
    'SIEMENS - SIMATIC HMI KTP1200 Basic 6AV2123-2MB03-0AX0 Teknik Föy (EN).pdf',
    6,
    'Kaynak: SIEMENS - SIMATIC HMI KTP1200 Basic 6AV2123-2MB03-0AX0 Teknik Föy (EN).pdf s.6 · Alıntı: Dimensions Width of the housing front 330 mm Height of housing front 245 mm Mounting cutout, width 310 mm Mounting cutout, height 221 mm mounting depth 54.9 mm Weights Weight (wit… · Sahiplik: Tek urunluk teknik foy: 1. sayfanin en ustundeki urun-tanimlayici satir birebir "Data sheet 6AV2123-2MB03-0AX0" ve hemen altinda "SIMATIC H… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6ES71555AA010AB0', 'Siemens', '6ES7155-5AA01-0AB0',
    35, 147, 129,
    'plaka',
    'SIEMENS - SIMATIC ET 200MP IM 155-5 PN ST Arayüz Modülü (EN).pdf',
    42,
    'Kaynak: SIEMENS - SIMATIC ET 200MP IM 155-5 PN ST Arayüz Modülü (EN).pdf s.42 · Alıntı: Dimensions Width 35 mm Height 147 mm Depth 129 mm · Sahiplik: Sayfa 42''de olcu blogunun USTUNDE, ayni tablonun sutun basligi olarak "Article number 6ES7155-5AA01-0AB0" satiri yer aliyor; sayfa ustbilgi… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6ES75111AL030AB0', 'Siemens', '6ES7511-1AL03-0AB0',
    35, 147, 129,
    'din',
    'SIEMENS - SIMATIC S7-1500 CPU 1511-1 PN Cihaz Kılavuzu (EN).pdf',
    55,
    'Kaynak: SIEMENS - SIMATIC S7-1500 CPU 1511-1 PN Cihaz Kılavuzu (EN).pdf s.55 · Alıntı: Article number 6ES7511-1AL03-0AB0 / Dimensions / Width 35 mm / Height 147 mm / Depth 129 mm / Weights / Weight, approx. 336 g · Sahiplik: Olcu blogunun HEMEN USTUNDEKI urun-tanimlayici satir birebir soyle: "Article number 6ES7511-1AL03-0AB0" ve bunu takiben "Dimensions / Width… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6ES75211BH000AB0', 'Siemens', '6ES7521-1BH00-0AB0',
    35, 147, 129,
    'din',
    'SIEMENS - SIMATIC S7-1500 DI 16x24VDC HF Dijital Giriş Modülü (EN).pdf',
    47,
    'Kaynak: SIEMENS - SIMATIC S7-1500 DI 16x24VDC HF Dijital Giriş Modülü (EN).pdf s.47 · Alıntı: Article number 6ES7521-1BH00-0AB0 Dimensions Width 35 mm Height 147 mm Depth 129 mm · Sahiplik: Siparis numarasi olcu blogunun HEMEN USTUNDEKI urun-tanimlayici satirda geciyor: "Article number 6ES7521-1BH00-0AB0", hemen altinda "Dimens… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6ES75211BL000AB0', 'Siemens', '6ES7521-1BL00-0AB0',
    35, 147, 129,
    'din',
    'SIEMENS - SIMATIC S7-1500 DI 32x24VDC HF Dijital Giriş Modülü (EN).pdf',
    48,
    'Kaynak: SIEMENS - SIMATIC S7-1500 DI 32x24VDC HF Dijital Giriş Modülü (EN).pdf s.48 · Alıntı: Article number 6ES7521-1BL00-0AB0 Dimensions Width 35 mm Height 147 mm Depth 129 mm · Sahiplik: Siparis numarasi olcu blogunun HEMEN USTUNDEKI urun-tanimlayici satirda geciyor: "Article number 6ES7521-1BL00-0AB0" ve onun altinda "Dimen… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6ES75221BH010AB0', 'Siemens', '6ES7522-1BH01-0AB0',
    35, 147, 129,
    'din',
    'SIEMENS - SIMATIC S7-1500 DQ 16x24VDC 0,5A HF Dijital Çıkış Modülü (EN).pdf',
    33,
    'Kaynak: SIEMENS - SIMATIC S7-1500 DQ 16x24VDC 0,5A HF Dijital Çıkış Modülü (EN).pdf s.33 · Alıntı: Dimensions Width 35 mm Height 147 mm Depth 129 mm · Sahiplik: Sayfa 33 tek ürünlük kılavuzun "Technical specifications" sayfası. Sayfa başlığı: "Digital output module DQ 16x24VDC/0.5A HF (6ES7522-1BH01… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6ES75317QF000AB0', 'Siemens', '6ES7531-7QF00-0AB0',
    35, 147, 129,
    'din',
    'SIEMENS - SIMATIC S7-1500 AI 8xU-I-R-RTD BA Analog Giriş Modülü (EN).pdf',
    43,
    'Kaynak: SIEMENS - SIMATIC S7-1500 AI 8xU-I-R-RTD BA Analog Giriş Modülü (EN).pdf s.43 · Alıntı: Dimensions Width 35 mm Height 147 mm Depth 129 mm · Sahiplik: Sayfa 43 tek ürünlük teknik föyün "Technical specifications" bölümüdür. Sayfa başlığı: "Analog Input Module AI 8xU/I/R/RTD BA (6ES7531-7QF0… · Denetim: 1/1 lens onayladı'
  ),
  (
    '|6GK51160BA002AB2', '', '6GK5116-0BA00-2AB2',
    80, 117, 109,
    'din',
    'HABAŞ 50T/SIEMENS - 6GK5116-0BA00-2AB2 Teknik Veri Sayfası (EN).pdf',
    1,
    'Kaynak: HABAŞ 50T/SIEMENS - 6GK5116-0BA00-2AB2 Teknik Veri Sayfası (EN).pdf s.1 · Alıntı: design, dimensions and weights design compact width 80 mm height 117 mm depth 109 mm net weight 0.375 kg · Sahiplik: Tek ürünlük teknik föy: sayfa 1''in ilk satırı "Data sheet 6GK5116-0BA00-2AB2", hemen altında "SCALANCE XB116 unmanaged IE switch, 16x 10/10… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6GK57381GY000AA0', 'Siemens', '6GK5738-1GY00-0AA0',
    140, 160, 45,
    'din',
    'SIEMENS - SCALANCE W738-1 M12 Client Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: SIEMENS - SCALANCE W738-1 M12 Client Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: design, dimensions and weights width 140 mm height 160 mm depth 45 mm width / of the enclosure / without antenna 140 mm height / of the enclosure / without antenna 149 mm depth / … · Sahiplik: Sayfa 1''in ILK satiri: "Data sheet 6GK5738-1GY00-0AA0", hemen altinda "product type designation W738-1 M12" ve "Technical Product Detail Pa… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6GK57781GY000AA0', 'Siemens', '6GK5778-1GY00-0AA0',
    140, 160, 45,
    'din',
    'SIEMENS - SCALANCE W778-1 M12 Access Point Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: SIEMENS - SCALANCE W778-1 M12 Access Point Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: design, dimensions and weights width 140 mm height 160 mm depth 45 mm width / of the enclosure / without antenna 140 mm height / of the enclosure / without antenna 149 mm depth / … · Sahiplik: Sayfa 1''in ILK satiri: "Data sheet 6GK5778-1GY00-0AA0", hemen altinda "product type designation W778-1 M12" ve "Technical Product Detail Pa… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6GK57938DJ000AA0', 'Siemens', '6GK5793-8DJ00-0AA0',
    190, 190, 30.5,
    'saha',
    'SIEMENS - ANT793-8DJ 5 GHz 18 dBi IWLAN Anten Teknik Veri Sayfası (EN).pdf',
    1,
    'Kaynak: SIEMENS - ANT793-8DJ 5 GHz 18 dBi IWLAN Anten Teknik Veri Sayfası (EN).pdf s.1 · Alıntı: design, dimensions and weights width 190 mm height 190 mm depth 30.5 mm net weight 700 g · Sahiplik: Sayfa 1''in ILK satiri: "Data sheet 6GK5793-8DJ00-0AA0", hemen altinda "product type designation Antenna ANT793-8DJ". Olcu blogu AYNI sayfad… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6SL30000EE388AA0', 'Siemens', '6SL3000-0EE38-8AA0',
    442, 376, 263,
    'plaka',
    'SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf',
    194,
    'Kaynak: SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf s.194 · Alıntı: Line voltage 380 ... 480 V 3 AC Line reactor / 6SL3000-0EE36-2AA0 6SL3000-0EE38-8AA0 6SL3000-0EE41-4AA0 / Rated current A 615 885 1430 / Dimensions / • Width mm (in) 300 (11.8) 44… · Sahiplik: Siparis numarasi olcu blogunun USTUNDEKI urun-tanimlayici baslik satirinda geciyor: "Line voltage 380 ... 480 V 3 AC Line reactor" basligin… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6SL30401MA010AA0', 'Siemens', '6SL3040-1MA01-0AA0',
    50, 300, 226,
    'plaka',
    'SIEMENS - SINAMICS S120 Booksize ve SIMOTICS Katalog D 21.4 (EN).pdf',
    78,
    'Kaynak: SIEMENS - SINAMICS S120 Booksize ve SIMOTICS Katalog D 21.4 (EN).pdf s.78 · Alıntı: Dimensions • Width 50 mm (1.97 in) • Height 300 mm (11.81 in) • Depth 226 mm (8.90 in) Weight, approx. 2.3 kg (5.07 lb) · Sahiplik: Sayfa 78 ''■ Technical specifications'' tablosunun ürün-tanımlayıcı başlık satırı ölçülerin ÜSTÜNDE: ''CU320-2 Control Unit / PROFINET / PROFI… · Denetim: 1/1 lens onayladı'
  ),
  (
    '|6SL30550AA004CA5', '', '6SL3055-0AA00-4CA5',
    212, 156, 31,
    'kapak',
    'SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf',
    248,
    'Kaynak: SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf s.248 · Alıntı: ■ Technical specifications AOP30 Advanced Operator Panel 6SL3055-0AA00-4CA5 ... Degree of protection IP20 for the inside of the cabinet IP55 for the outside of the cabinet Dimensi… · Sahiplik: Sayfa 248 (basili sayfa 5/64) bastan sona yalnizca AOP30''a ayrilmis. ''■ Technical specifications'' basliginin HEMEN ALTINDAKI urun-tanimlayi… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6SL30550AA006AA1', 'Siemens', '6SL3055-0AA00-6AA1',
    30, 151, 110,
    'din',
    'SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf',
    250,
    'Kaynak: SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf s.250 · Alıntı: DMC20 DRIVE-CLiQ Hub Module | 6SL3055-0AA00-6AA1 | ... | Degree of protection IP20 | Dimensions | • Width 30 mm (1.18 in) | • Height 151 mm (5.94 in) | • Depth 110 mm (4.33 in) | … · Sahiplik: Teknik ozellik ("Technical specifications") tablosunun urun-tanimlayici BASLIK satiri birebir "DMC20 DRIVE-CLiQ Hub Module" + "6SL3055-0AA0… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6SL31201TE230AC0', 'Siemens', '6SL3120-1TE23-0AC0',
    100, 380, 270,
    'plaka',
    'SIEMENS - SINAMICS S120 Booksize ve SIMOTICS Katalog D 21.4 (EN).pdf',
    133,
    'Kaynak: SIEMENS - SINAMICS S120 Booksize ve SIMOTICS Katalog D 21.4 (EN).pdf s.133 · Alıntı: Internal air cooling C type 6SL3120-... – – – 1TE21-8AC0 1TE23-0AC0 | Internal air cooling D type 6SL3120-... 1TE13-0AD0 1TE15-0AD0 1TE21-0AD0 1TE21-8AD0 1TE23-0AD0 | • Rated curr… · Sahiplik: Sayfa basligi "Single Motor Modules in booksize format · Technical specifications (continued)". Siparis numarasi, olcu satirlarinin USTUNDE… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6SL31201TE313AA3', 'Siemens', '6SL3120-1TE31-3AA3',
    300, 380, 270,
    'plaka',
    'SIEMENS - SINAMICS S120 Booksize ve SIMOTICS Katalog D 21.4 (EN).pdf',
    134,
    'Kaynak: SIEMENS - SINAMICS S120 Booksize ve SIMOTICS Katalog D 21.4 (EN).pdf s.134 · Alıntı: Internal air cooling 6SL3120-... 1TE24-5AA3 1TE26-0AA3 1TE28-5AA3 1TE31-3AA3 1TE32-0AA4 | • Rated current Irated A 45 60 85 132 200 | Dimensions | • Width mm (in) 150 (5.91) 150 (… · Sahiplik: Sayfa basligi "Single Motor Modules in booksize format · Technical specifications (continued)". Siparis numarasi, olcu satirlarinin USTUNDE… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|6SL33201TE321AA3', 'Siemens', '6SL3320-1TE32-1AA3',
    326, 1400, 356,
    'plaka',
    'SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf',
    97,
    'Kaynak: SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf s.97 · Alıntı: Dimensions • Width mm (in) 326 (12.8) 326 (12.8) 326 (12.8) 326 (12.8) 326 (12.8) • Height mm (in) 1400 (55.1) 1400 (55.1) 1533 (60.4) 1533 (60.4) 1533 (60.4) • Depth mm (in) 356 … · Sahiplik: Sayfa 97 tek tablodur; basligi "SINAMICS S120 Chassis Format Units / Air-cooled units / Motor Modules". Urun-tanimlayici baslik blogu: "Mot… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|6SL33201TE326AA3', 'Siemens', '6SL3320-1TE32-6AA3',
    326, 1400, 356,
    'plaka',
    'SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf',
    97,
    'Kaynak: SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf s.97 · Alıntı: Dimensions • Width mm (in) 326 (12.8) 326 (12.8) 326 (12.8) 326 (12.8) 326 (12.8) • Height mm (in) 1400 (55.1) 1400 (55.1) 1533 (60.4) 1533 (60.4) 1533 (60.4) • Depth mm (in) 356 … · Sahiplik: Sayfa 97 tek tablodur; basligi "SINAMICS S120 Chassis Format Units / Air-cooled units / Motor Modules". Urun-tanimlayici baslik blogu: "Mot… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|6SL33201TE375AA3', 'Siemens', '6SL3320-1TE37-5AA3',
    503, 1475, 547,
    'plaka',
    'SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf',
    99,
    'Kaynak: SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf s.99 · Alıntı: Dimensions • Width mm (in) 503 (19.8) 503 (19.8) 503 (19.8) • Height mm (in) 1475 (58.1) 1475 (58.1) 1475 (58.1) • Depth mm (in) 547 (21.5) 547 (21.5) 547 (21.5) Weight, approx. k… · Sahiplik: Sayfa 99 tek tablodur; sayfa basligi "SINAMICS S120 Chassis Format Units / Air-cooled units / Motor Modules". Tablonun urun-tanimlayici bas… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SIEMENS|6SL33306TE411AA3', 'Siemens', '6SL3330-6TE41-1AA3',
    503, 1475, 548,
    'govde',
    'SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf',
    79,
    'Kaynak: SIEMENS - SINAMICS S120 Chassis ve Cabinet Modules Katalog D 21.3 (EN).pdf s.79 · Alıntı: Line voltage 380 ... 480 V 3 AC Smart Line Modules / 6SL3330- 6TE35-5AA3 | 6SL3330- 6TE37-3AA3 | 6SL3330- 6TE41-1AA3 | 6SL3330- 6TE41-3AA3 | 6SL3330- 6TE41-7AA3 ... Dimensions | •… · Sahiplik: Siparis numarasi olcu bloklarinin USTUNDEKI urun-tanimlayici baslik satirinda geciyor: sayfa 79''daki ''Technical specifications / Smart Line… · Denetim: 3/3 lens onayladı'
  ),
  (
    'ELIMKO|E6901111110', 'Elimko', 'E690-1-1-1-1-1-1-0',
    160, 87, 107,
    'din',
    'ELIMKO - E-690 Serisi Tarayıcı Kullanım Kılavuzu (TR).pdf',
    4,
    'Kaynak: ELIMKO - E-690 Serisi Tarayıcı Kullanım Kılavuzu (TR).pdf s.4 · Alıntı: 1.3. Boyutlar / GÖSTERGE / 96 mm / 192 mm / 55 mm / 11 mm / 11 mm / GİRİŞ-ÇIKIŞ BİRİMİ / 107 mm / 87 mm / 160 mm / GÜÇ KARTI SLOTU / SLOT 1 ... SLOT 6 / M4 Topraklama / Not: Çizim… · Sahiplik: Belge tek ürünlük E-690 kılavuzudur; sayfadaki her şey E-690''a aittir. Tip kodu ÖLÇÜ BÖLÜMÜNÜN HEMEN ÜSTÜNDEKİ ''1.2. Tipe Göre Kodlama'' baş… · Denetim: 3/3 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|G25F3A250', 'Schneider Electric', 'G25F3A250',
    105, 165, 90,
    'plaka',
    '0026-01/SCHNEIDER ELECTRIC - GoPact MCCB 16-800A Kataloğu 2024 (EN).pdf',
    20,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - GoPact MCCB 16-800A Kataloğu 2024 (EN).pdf s.20 · Alıntı: GoPact MCCB 250 160 - 250 A / Breaking capacity levels B F / ... / Dimensions (H*W*D) (mm) / 3 Pole 165*105*90 165*105*90 / 4 Pole 165*140*90 165*140*90 / Pole to pole distance mm… · Sahiplik: Sahiplik iki adimda kanitlandi. (1) Sayfa 81 ''Commercial References'' tablosu: ''GoPact Molded Case Circuit Breaker 250'' basligi altinda, ''36… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|GV2ME07', 'Schneider Electric', 'GV2ME07',
    45, 89, 78.5,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf',
    531,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf s.531 · Alıntı: s.531 (B6/93), "Dimensions and mounting / TeSys Power / Deca - Frame 2 Motor circuit breakers - Thermal-magnetic": "Dimensions | GV2ME GVAX GVAD, AM, AN, AU, AS, AX GVAE | b | 67,… · Sahiplik: Zincir: (1) s.452 (B6/14) baslik BIREBIR "Deca - Frame 2 (ref. GV2ME): control by push button, connection by screw clamp terminals"; "Produ… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|GV2ME20', 'Schneider Electric', 'GV2ME20',
    45, 89, 78.5,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf',
    531,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf s.531 · Alıntı: s.531 (B6/93), "Dimensions and mounting / TeSys Power / Deca - Frame 2 Motor circuit breakers - Thermal-magnetic": "Dimensions | GV2ME GVAX GVAD, AM, AN, AU, AS, AX GVAE | b | 67,… · Sahiplik: Zincir: (1) s.452 (B6/14) baslik BIREBIR "Deca - Frame 2 (ref. GV2ME): control by push button, connection by screw clamp terminals" + "Prod… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|LC1D09M7', 'Schneider Electric', 'LC1D09M7',
    45, 77, 86,
    'din',
    '0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf',
    737,
    'Kaynak: 0026-01/SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf s.737 · Alıntı: Sayfa 737 (katalog no B8/107), baslik "TeSys Control / Deca Contactors - AC Coil / Dimensions". Cizim: "45 12,512,5" (govde eni 45, iki yanda 12,5 min. elektriksel mesafe). Tablo:… · Sahiplik: Zincir olcu blogunun USTUNDEKI urun-tanimlayici satirlardan kuruldu; hicbir "Suitable for" satirina dayanilmadi. (1) Sayfa 658 (B8/28) "Pro… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|LZSPT5A5T30', 'Siemens', 'LZS:PT5A5T30',
    28, 74, 72,
    'din',
    'SIEMENS - SIRIUS IC10 Yardimci Kontaktorler ve Roleler LZS (EN).pdf',
    46,
    'Kaynak: SIEMENS - SIRIUS IC10 Yardimci Kontaktorler ve Roleler LZS (EN).pdf s.46 · Alıntı: Relay type LZX:RT print relay, 8-pole, (12.7 mm) 1 CO / 2 CO LZX:PT industrial relay, 8-, 11- and 14-pole, (22.5 mm) 2 CO / 3 CO / 4 CO General data Dimensions (W x H x D) • LZS:R… · Sahiplik: İki sütunlu tablo; sütun başlıkları ölçü satırının ÜSTÜNDE: 1. sütun "LZX:RT print relay", 2. sütun "LZX:PT industrial relay". Ölçü satırın… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SIEMENS|LZSRT4A4L24', 'Siemens', 'LZS:RT4A4L24',
    15.5, 78, 71,
    'din',
    'HABAŞ 50T/SIEMENS - LZS_RT4A4L24 Teknik Veri Sayfası (EN).pdf',
    2,
    'Kaynak: HABAŞ 50T/SIEMENS - LZS_RT4A4L24 Teknik Veri Sayfası (EN).pdf s.2 · Alıntı: Installation/ mounting/ dimensions mounting position any fastening method snap-on mounting height 78 mm width 15.5 mm depth 71 mm · Sahiplik: Tek ürünlük teknik föy: 1. sayfa başlığı "Data sheet LZS:RT4A4L24", ölçünün okunduğu 2. sayfanın alt bilgisi "LZS:RT4A4L24 / Page 2/4". Bel… · Denetim: 1/1 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|PSEE2G1AC24DC120WSC', 'Phoenix Contact', 'PS-EE-2G/1AC/24DC/120W/SC',
    40, 124, 125,
    'din',
    'PHOENIX CONTACT - PS-EE-2G 24DC 120W Guc Kaynagi 1234302 (TR).pdf',
    5,
    'Kaynak: PHOENIX CONTACT - PS-EE-2G 24DC 120W Guc Kaynagi 1234302 (TR).pdf s.5 · Alıntı: Ölçüler Ürün boyutları Genişlik 40 mm Yükseklik 124 mm Derinlik 125 mm · Sahiplik: Tek ürünlük teknik föy (17 sayfa). Ölçü blogunun bulundugu 5. sayfanin alt bilgisi birebir: "PS-EE-2G/1AC/24DC/120W/SC - Güç kaynağı" / "12… · Denetim: 1/1 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|PSEE2G1AC24DC240WSC', 'Phoenix Contact', 'PS-EE-2G/1AC/24DC/240W/SC',
    60, 124, 125,
    'din',
    'PHOENIX CONTACT - PS-EE-2G 24DC 240W Guc Kaynagi 1234304 (TR).pdf',
    5,
    'Kaynak: PHOENIX CONTACT - PS-EE-2G 24DC 240W Guc Kaynagi 1234304 (TR).pdf s.5 · Alıntı: Ölçüler Ürün boyutları Genişlik 60 mm Yükseklik 124 mm Derinlik 125 mm · Sahiplik: Tek ürünlük teknik föy (17 sayfa). Ölçü blogunun bulundugu 5. sayfanin alt bilgisi birebir: "PS-EE-2G/1AC/24DC/240W/SC - Güç kaynağı" / "12… · Denetim: 1/1 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|PSEE2G1AC24DC480WSC', 'Phoenix Contact', 'PS-EE-2G/1AC/24DC/480W/SC',
    86, 124, 125,
    'din',
    'PHOENIX CONTACT - PS-EE-2G 24DC 480W Guc Kaynagi 1234308 (TR).pdf',
    5,
    'Kaynak: PHOENIX CONTACT - PS-EE-2G 24DC 480W Guc Kaynagi 1234308 (TR).pdf s.5 · Alıntı: Ölçüler Ürün boyutları Genişlik 86 mm Yükseklik 124 mm Derinlik 125 mm · Sahiplik: Tek ürünlük teknik föy (17 sayfa). Ölçü blogunun bulundugu 5. sayfanin alt bilgisi birebir: "PS-EE-2G/1AC/24DC/480W/SC - Güç kaynağı" / "12… · Denetim: 1/1 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|PSEE2G1AC24DC60WSC', 'Phoenix Contact', 'PS-EE-2G/1AC/24DC/60W/SC',
    33, 90, 100,
    'din',
    'PHOENIX CONTACT - PS-EE-2G 24DC 60W Guc Kaynagi 1394764 (TR).pdf',
    5,
    'Kaynak: PHOENIX CONTACT - PS-EE-2G 24DC 60W Guc Kaynagi 1394764 (TR).pdf s.5 · Alıntı: Ölçüler Ürün boyutları Genişlik 33 mm Yükseklik 90 mm Derinlik 100 mm · Sahiplik: Tek ürünlük teknik föy (17 sayfa). Ölçü blogunun bulundugu 5. sayfanin alt bilgisi birebir: "PS-EE-2G/1AC/24DC/60W/SC - Güç kaynağı" / "139… · Denetim: 1/1 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|PT16N', 'Phoenix Contact', 'PT 16 N',
    12.2, 75.4, 52.6,
    'din',
    'PHOENIX CONTACT - PT 16 N Gecis Klemensi 3212138 (TR).pdf',
    3,
    'Kaynak: PHOENIX CONTACT - PT 16 N Gecis Klemensi 3212138 (TR).pdf s.3 · Alıntı: Ölçüler / Genişlik 12,2 mm / Kapak genişliği 2,2 mm / Yükseklik 75,4 mm / NS 35/7,5''te derinlik 52,6 mm / NS 35/15''te derinlik 60,1 mm · Sahiplik: Tek ürünlük teknik föy; ölçü blogunun bulundugu 3. sayfanin dip bilgisi ürünü birebir tanimliyor: "PT 16 N - Geçiş klemensi" / "3212138" / … · Denetim: 1/1 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|PT25', 'Phoenix Contact', 'PT 2,5',
    5.2, 48.6, 35.3,
    'din',
    'PHOENIX CONTACT - PT 2,5 Gecis Klemensi 3209510 (TR).pdf',
    4,
    'Kaynak: PHOENIX CONTACT - PT 2,5 Gecis Klemensi 3209510 (TR).pdf s.4 · Alıntı: Ölçüler / Genişlik 5,2 mm / Kapak genişliği 2,2 mm / Yükseklik 48,6 mm / Derinlik 35,3 mm / NS 35/7,5''te derinlik 36,8 mm / NS 35/15''te derinlik 44,3 mm · Sahiplik: Tek ürünlük teknik föy: sayfa 4''ün alt bilgisi ölçü blogunun sahibini birebir yazıyor — "PT 2,5 - Geçiş klemensi / 3209510 / https://www.ph… · Denetim: 1/1 lens onayladı'
  ),
  (
    '|PT25', '', 'PT 2,5',
    5.2, 48.6, 35.3,
    'din',
    'PHOENIX CONTACT - PT 2,5 Gecis Klemensi 3209510 (TR).pdf',
    4,
    'Kaynak: PHOENIX CONTACT - PT 2,5 Gecis Klemensi 3209510 (TR).pdf s.4 · Alıntı: Ölçüler / Genişlik 5,2 mm / Kapak genişliği 2,2 mm / Yükseklik 48,6 mm / Derinlik 35,3 mm / NS 35/7,5''te derinlik 36,8 mm / NS 35/15''te derinlik 44,3 mm · Sahiplik: Tek ürünlük teknik föy: sayfa 4''ün alt bilgisi ölçü blogunun sahibini birebir yazıyor — "PT 2,5 - Geçiş klemensi / 3209510 / https://www.ph… · Denetim: 1/1 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|PT4', 'Phoenix Contact', 'PT 4',
    6.2, 56, 35.3,
    'din',
    'PHOENIX CONTACT - PT 4 Gecis Klemensi 3211757 (TR).pdf',
    4,
    'Kaynak: PHOENIX CONTACT - PT 4 Gecis Klemensi 3211757 (TR).pdf s.4 · Alıntı: Ölçüler / Genişlik 6,2 mm / Yükseklik 56 mm / Derinlik 35,3 mm / NS 35/7,5''te derinlik 36,5 mm / NS 35/15''te derinlik 44 mm · Sahiplik: Tek ürünlük teknik föy: sayfa 4''ün alt bilgisi ölçü blogunun ait olduğu ürünü birebir adlandırıyor — "PT 4 - Geçiş klemensi / 3211757 / htt… · Denetim: 1/1 lens onayladı'
  ),
  (
    '|PT4', '', 'PT 4',
    6.2, 56, 35.3,
    'din',
    'PHOENIX CONTACT - PT 4 Gecis Klemensi 3211757 (TR).pdf',
    4,
    'Kaynak: PHOENIX CONTACT - PT 4 Gecis Klemensi 3211757 (TR).pdf s.4 · Alıntı: Ölçüler / Genişlik 6,2 mm / Yükseklik 56 mm / Derinlik 35,3 mm / NS 35/7,5''te derinlik 36,5 mm / NS 35/15''te derinlik 44 mm · Sahiplik: Tek ürünlük teknik föy: sayfa 4''ün alt bilgisi ölçü blogunun ait olduğu ürünü birebir adlandırıyor — "PT 4 - Geçiş klemensi / 3211757 / htt… · Denetim: 1/1 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|PT4HESILED245X20', 'Phoenix Contact', 'PT 4-HESILED 24 (5X20)',
    6.2, 56, 57.3,
    'din',
    'PHOENIX CONTACT - PT 4-HESILED 24 Sigortali Klemens 3211903 (TR).pdf',
    3,
    'Kaynak: PHOENIX CONTACT - PT 4-HESILED 24 Sigortali Klemens 3211903 (TR).pdf s.3 · Alıntı: Ölçüler / Genişlik 6,2 mm / Kapak genişliği 2,2 mm / Yükseklik 56 mm / Derinlik 57,3 mm / NS 35/7,5''te derinlik 64,8 mm / NS 35/15''te derinlik 72,3 mm · Sahiplik: Tek ürünlük teknik föy: sayfa 3''ün alt bilgisi ölçü blogunun sahibini plandaki tip numarasının aynısıyla yazıyor — "PT 4-HESILED 24 (5X20) … · Denetim: 1/1 lens onayladı'
  ),
  (
    '|PT4HESILED245X20', '', 'PT 4-HESILED 24 (5X20)',
    6.2, 56, 57.3,
    'din',
    'PHOENIX CONTACT - PT 4-HESILED 24 Sigortali Klemens 3211903 (TR).pdf',
    3,
    'Kaynak: PHOENIX CONTACT - PT 4-HESILED 24 Sigortali Klemens 3211903 (TR).pdf s.3 · Alıntı: Ölçüler / Genişlik 6,2 mm / Kapak genişliği 2,2 mm / Yükseklik 56 mm / Derinlik 57,3 mm / NS 35/7,5''te derinlik 64,8 mm / NS 35/15''te derinlik 72,3 mm · Sahiplik: Tek ürünlük teknik föy: sayfa 3''ün alt bilgisi ölçü blogunun sahibini plandaki tip numarasının aynısıyla yazıyor — "PT 4-HESILED 24 (5X20) … · Denetim: 1/1 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|RBO10', 'Phoenix Contact', 'RBO 10',
    41, 144, 77,
    'din',
    'PHOENIX CONTACT - RBO 10 Civata Baglantili Klemens 3244614 (TR).pdf',
    4,
    'Kaynak: PHOENIX CONTACT - RBO 10 Civata Baglantili Klemens 3244614 (TR).pdf s.4 · Alıntı: Ölçüler Boyutlu çizim Genişlik 41 mm Yükseklik 144 mm NS 35/7,5''te derinlik 77 mm NS 35/15''te derinlik 84,5 mm Cıvata boyu 31 mm Delik çapı 6,4 mm Pin aralığı 41 mm · Sahiplik: Tek ürünlük teknik föy (12 sayfa). Ölçü blogunun bulundugu 4. sayfanin alt bilgisi birebir: "RBO 10 - Cıvata bağlantılı klemens" / "3244614… · Denetim: 3/3 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|RBO16', 'Phoenix Contact', 'RBO 16',
    54.8, 164, 91.8,
    'din',
    'PHOENIX CONTACT - RBO 16 Civata Baglantili Klemens 3244630 (TR).pdf',
    4,
    'Kaynak: PHOENIX CONTACT - RBO 16 Civata Baglantili Klemens 3244630 (TR).pdf s.4 · Alıntı: Ölçüler Boyutlu çizim Genişlik 54,8 mm Yükseklik 164 mm NS 35/7,5''te derinlik 91,8 mm NS 35/15''te derinlik 99,3 mm Cıvata boyu 45 mm Delik çapı 6,4 mm Pin aralığı 54,8 mm · Sahiplik: Tek ürünlük teknik föy (12 sayfa). Ölçü blogunun bulundugu 4. sayfanin alt bilgisi birebir: "RBO 16 - Cıvata bağlantılı klemens" / "3244630… · Denetim: 3/3 lens onayladı'
  ),
  (
    'OMRON|S8VKC24024', 'Omron', 'S8VKC24024',
    60, 125, 150,
    'din',
    '0026-01/OMRON - S8VK-C Anahtarlamalı Güç Kaynağı Teknik Föyü (EN).pdf',
    7,
    'Kaynak: 0026-01/OMRON - S8VK-C Anahtarlamalı Güç Kaynağı Teknik Föyü (EN).pdf s.7 · Alıntı: Dimensions (Unit: mm) ... 6.35 | 125 | 4.7 | (Sliding: 7.5 max.)60 | 104.6 | Rail Stopper | 5.0 dia. (Bit #2) | 140 | 145.6 | (10) | (4)(1) | 150 | 34.7 | 5.0 dia. (Bit #2) | 6.35… · Sahiplik: Sayfa 7''nin basligi "Dimensions (Unit: mm)" ve sayfada dort cizim ALT ALTA (tek sutun) diziliyor; her cizimin ALTINDA kendi model basligi v… · Denetim: 3/3 lens onayladı'
  ),
  (
    'PHOENIXCONTACT|UNOPS1AC12DC30W', 'Phoenix Contact', 'UNO-PS/1AC/12DC/ 30W',
    22.5, 90, 84,
    'din',
    'PHOENIX CONTACT - UNO-PS 12DC 30W Guc Kaynagi 2902998 (TR).pdf',
    4,
    'Kaynak: PHOENIX CONTACT - UNO-PS 12DC 30W Guc Kaynagi 2902998 (TR).pdf s.4 · Alıntı: Ölçüler Genişlik 22,5 mm Yükseklik 90 mm Derinlik 84 mm · Sahiplik: Tek ürünlük teknik föy (11 sayfa). Ölçü blogunun bulundugu 4. sayfanin alt bilgisi birebir: "UNO-PS/1AC/12DC/ 30W - Güç kaynağı" / "2902998… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|XB4BS8442', 'Schneider Electric', 'XB4BS8442',
    40, 47, 82,
    'kapak',
    'HABAŞ 50T/SCHNEIDER ELECTRIC - SCHNEIDER ELECTRIC - XB4BS8442 Ürün Teknik Föyü (EN).pdf',
    1,
    'Kaynak: HABAŞ 50T/SCHNEIDER ELECTRIC - SCHNEIDER ELECTRIC - XB4BS8442 Ürün Teknik Föyü (EN).pdf s.1 · Alıntı: Complementary / Height 47 mm / Width 40 mm / Depth 82 mm · Sahiplik: Tek ürünlük teknik föy. Sayfa 1 başlığı: ''Product data sheet'' / ''Characteristics'' / ''XB4BS8442'' / ''Red Ø40 Emergency stop, switching off Ø2… · Denetim: 1/1 lens onayladı'
  ),
  (
    'SCHNEIDERELECTRIC|XB5AD21', 'Schneider Electric', 'XB5AD21',
    30, 42, 70,
    'kapak',
    'HABAŞ 50T/SCHNEIDER ELECTRIC - XB5AD21 Ürün Teknik Föyü (EN).pdf',
    1,
    'Kaynak: HABAŞ 50T/SCHNEIDER ELECTRIC - XB5AD21 Ürün Teknik Föyü (EN).pdf s.1 · Alıntı: Height 42 mm Width 30 mm Depth 70 mm · Sahiplik: Tek ürünlük teknik föy (2 sayfa) ve dosya adı tip numarasının kendisi. Sayfa 1''in başlığı ölçü blogunun ÜSTÜNDE: "Product data sheet / Char… · Denetim: 1/1 lens onayladı'
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

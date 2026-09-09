-- ÖLÇÜ DEFTERİNDEKİ MONTAJ TİPİ DÜZELTMELERİ (PANO-37).
--
-- ═══════════════════════════════════════════ NEDEN BİR MIGRATION GEREKİYOR
--
-- Montaj tipi İKİ kaynaktan gelebilir ve defter kuralı EZER:
--   `override?.mountType ?? model?.mountType ?? kural.mountType`  (panels.ts)
--
-- Bu bilinçli bir sıradır — defter, o ürün için ÖLÇÜLMÜŞ bir beyandır ve genel
-- bir kategori kuralından güçlüdür. Ama sonucu şudur: sınıflandırma kuralı
-- değiştiğinde defterdeki eski satır SESSİZCE kazanır. 09.09.2026'da tam bu
-- oldu — kural değişti, ekranda hiçbir şey değişmedi.
--
-- ═══════════════════════════════════════════ İKİ DÜZELTME
--
-- 1. AYDINLATMA VE İKAZ ARTIK `saha`. Kullanıcı kararı: "pano yanı
--    ekipmanlarından sadece direnç gösterilsin; aydınlatma ve diğer saha
--    ekipmanlara gerek yok." Beş ürün 08.09.2026'da `yan` olarak tohumlanmıştı:
--    MUCCO sinyal/ikaz ailesi (siren, boru korna, ikaz kolonu, hat lambası) ve
--    NIKI AGORA P-2 LED projektör. Hepsi vincin üstünde ya da sahada durur.
--    KAYBOLMAZLAR: `saha` kuyruğunda sebebiyle görünürler (PANO-10).
--
-- 2. KONTROL TRAFOSU ARTIK `zemin`. `ETA MATIS 4000` (400-230 V, 4 kVA)
--    `plaka` olarak tohumlanmıştı; kullanıcı kararı: "trafo pano içerisinde
--    yere konuyor, bundan dolayı pano yerleşiminde gösterilmesin." Panonun
--    İÇİNDEDİR ve sipariş listesindedir, montaj plakasında yer kaplamaz.
--
-- ═══════════════════════════════════════════ ÖLÇÜLER DEĞİŞMİYOR
--
-- Yalnız `mount_type` yazılır. En/boy/derinlik olduğu gibi kalır — o sayılar
-- üretici föyünden okundu ve montaj kararıyla ilgisi yok.
--
-- ELLE GİRİLMİŞ SATIR DA GÜNCELLENİR ve bu istisnadır: `seed-device-models.ts`
-- elle girilen ÖLÇÜYÜ korur çünkü o mühendisin kendi ölçümüdür; buradaki ise
-- bir ölçüm değil, kullanıcının bugün verdiği MONTAJ KARARIDIR.

update public.electrical_device_models
set mount_type = 'saha'
where lookup_key in (
  'MUCCO|SNTSL19022',
  'MUCCO|SNTB7101',
  'MUCCO|SNT7024S3',
  'MUCCO|SNTBL1861',
  'NIKIELECTRONICS|N1000P2160W5000K'
);

update public.electrical_device_models
set mount_type = 'zemin'
where lookup_key = 'ETA|MATIS4000';

-- 3. TELSİZ KUMANDA ARTIK `saha`. Kullanıcı kararı: "Radio Control
--    Receiver-Transmitter pano dışında olur, içerisine yerleştirme."
--    `ELFATEK ESX_MID 602` (170 x 320 x 120 mm) `plaka` olarak tohumlanmıştı ve
--    0026'nın `LVD0` panosunda montaj plakasında yer kaplıyordu. Alıcı direğe
--    ya da kabine, verici operatörün eline gider.
update public.electrical_device_models
set mount_type = 'saha'
where lookup_key = 'ELFATEK|ESXMID602';

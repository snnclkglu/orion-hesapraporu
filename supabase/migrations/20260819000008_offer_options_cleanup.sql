-- DEFTER TEMİZLİĞİ — yerine yenisi gelen maddeleri PASİFE ALIR.
--
-- 17.08.2026 turunda üç liste yapı değiştirdi:
--   · `val.craneClass`      — yedi karışık yazım, beş tek biçimli sınıfa indi
--   · `val.temperatureRange`— tek "aralık" listesi, min/maks olarak İKİYE ayrıldı
--   · `term.deliveryTime`   — hazır cümle listesi, parçalı seçime dönüştü
--
-- MADDELER SİLİNMEZ, PASİFE ALINIR (tedarikçi defterinin kuralı). Silmek iki
-- şeyi birden bozardı: kullanıcının elle eklemiş olabileceği maddeler de
-- giderdi, ve defterin geçmişi — hangi yazımın ne zaman kullanıldığı — yok
-- olurdu. Pasif madde açılır listede ÇIKMAZ; teslim edilmiş tekliflerdeki
-- değerler zaten METİN olarak payload'da donmuştur ve bundan etkilenmez.
--
-- Yeni maddeleri `20260819000007_offer_options_seed_v2.sql` yazar; bu dosya
-- YALNIZCA eskisini kapatır ve o migration'dan SONRA koşmalıdır.

-- Eski vinç sınıfı yazımları: yenileri "FEM 1Am / ISO M4" gibi kuyruksuzdur,
-- eskiler " - ISO/FEM …" kuyruğu taşır.
update public.offer_options
   set active = false
 where list_key = 'val.craneClass'
   and value like '%ISO/FEM%';

-- Eşleştirilmiş sıcaklık aralıkları — yerlerini `val.tempMin` / `val.tempMax` aldı.
update public.offer_options
   set active = false
 where list_key = 'val.temperatureRange';

-- Hazır teslim süresi cümleleri — yerini `term.deliveryTrigger` +
-- `val.deliveryWeeks` + `val.deliveryUnit` üçlüsü aldı.
update public.offer_options
   set active = false
 where list_key = 'term.deliveryTime';

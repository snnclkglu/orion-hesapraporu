-- KOMŞUYA BAĞLI SABİTLEME (PANO-38, Plan F2 — 13.09.2026).
--
-- `order_in_rail` bir MUTLAK İNDEKSTİ ve iki listenin birbirini saymasını
-- gerektiriyordu: ekran indeksi çizim sırasından, çözücü kendi sırasından
-- türetiyordu. First-fit (PANO-37 md. 5) iki listeyi ayırdı; ölçüldü (0026-01,
-- 12.09.2026): kullanıcı sürücüyü bir şalterin yanına bıraktı, çözücü onu
-- 15. indekse — giriş şalterlerinin ortasına — koydu, orada yeni bir plaka
-- rayı açıldı ve pano 2313 mm ile taştı.
--
-- Yeni sabitleme bir KOMŞU + YÖN'dür: "bu aygıt, şu aygıtın önüne/sonrasına".
-- Komşu anahtarı iki tarafta da aynı anlama gelir. Eski sütun SİLİNMEZ:
-- 12.09.2026 öncesi satırlar okunmaya devam eder (kendi türünün listesinde
-- sayılır), yenisi yazılmaz; ekran onları "eski biçim" rozetiyle gösterir.

alter table public.switchboard_placements
  add column if not exists anchor_device_key text,
  add column if not exists anchor_side text
    check (anchor_side is null or anchor_side in ('once', 'sonra'));

comment on column public.switchboard_placements.anchor_device_key is
  'Komşuya bağlı sabitleme (PANO-38): bu aygıt, verilen aygıtın yanına sıralanır. installation|location|device biçiminde.';
comment on column public.switchboard_placements.anchor_side is
  'once = komşunun önüne, sonra = komşunun arkasına.';
comment on column public.switchboard_placements.order_in_rail is
  'ESKİ BİÇİM (12.09.2026 öncesi): mutlak sıra indeksi. Okunur, yazılmaz; yeni sabitleme anchor_device_key/anchor_side.';

-- PANO YANI MONTAJ TİPİ (`yan`) — PANO-27.
--
-- Ölçüldü (0026-01, 08.09.2026): 108 dB'lik bir siren, bir boru korna ve üç
-- katlı bir ikaz kolonu pano KAPAĞINA 30 x 30 mm delik olarak çiziliyordu; dört
-- adet 160 W LED projektör ise "gövde gereci" sayıldığı için ne çizimde ne
-- listede ne kuyrukta GÖRÜNÜYORDU. Hiçbiri panonun içinde değil: bunlar vincin
-- üstüne ya da panonun yanına asılır.
--
-- `saha`dan (motor, enkoder, limit şalteri) farkı ÇİZİLMESİDİR: saha ekipmanı
-- makinenin üstündedir ve pano çiziminde işi yoktur; `yan` ekipman panonun
-- görünür komşusudur ve dizilim şemasında kendi şeridinde durur.
--
-- Kısıt TS tarafındaki `MountType` birliğiyle eşit tutulur; ayrışmayı bir guard
-- testi migration dosyasını OKUYARAK engeller (değişmez md. 8).

alter table public.electrical_device_models
  drop constraint if exists electrical_device_models_mount_type_check;

alter table public.electrical_device_models
  add constraint electrical_device_models_mount_type_check
  check (mount_type is null or mount_type in ('din', 'plaka', 'kapak', 'govde', 'yan', 'saha'));

alter table public.switchboard_placements
  drop constraint if exists switchboard_placements_mount_type_check;

alter table public.switchboard_placements
  add constraint switchboard_placements_mount_type_check
  check (mount_type is null or mount_type in ('din', 'plaka', 'kapak', 'govde', 'yan', 'saha'));

comment on column public.electrical_device_models.mount_type is
  'Cihaz panoda nereye takilir: din (TS35 rayi) | plaka (montaj plakasina vidali) | kapak (kapak kesiti) | govde (fan, termostat, pano lambasi) | yan (pano yanina asilan siren, korna, ikaz kolonu, projektor) | saha (pano disi: motor, enkoder, limit salteri).';

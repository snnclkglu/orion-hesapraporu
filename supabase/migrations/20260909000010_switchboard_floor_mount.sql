-- ZEMİN MONTAJI — trafo panonun tabanına oturur (PANO-37).
--
-- Kullanıcı kararı (09.09.2026): *"trafo pano içerisinde yere konuyor, bundan
-- dolayı pano yerleşiminde gösterilmesin."* Trafo panonun İÇİNDEDİR ve sipariş
-- listesindedir; montaj plakasında yer kaplamaz.
--
-- `govde` KOVASINA ATILMADI çünkü o kova "gövde gereci"dir (pano lambası, fan,
-- etiket). 4 kVA'lık bir kontrol trafosunu bir aksesuar gibi listelemek,
-- panoyu kuran kişiye yanlış bir şey söylerdi. Reaktör, şok bobini ve şebeke
-- filtresi `plaka` olarak KALIR — zemine konan yalnız trafodur.
--
-- Kısıt İKİ TABLODA birden genişler ve bir test bunu TypeScript birliğiyle
-- karşılaştırır (`mount.sql.guard.test.ts`, değişmez md. 8).

alter table public.electrical_device_models
  drop constraint if exists electrical_device_models_mount_type_check;

alter table public.electrical_device_models
  add constraint electrical_device_models_mount_type_check
  check (mount_type is null or mount_type in ('din', 'plaka', 'zemin', 'kapak', 'govde', 'yan', 'saha'));

alter table public.switchboard_placements
  drop constraint if exists switchboard_placements_mount_type_check;

alter table public.switchboard_placements
  add constraint switchboard_placements_mount_type_check
  check (mount_type is null or mount_type in ('din', 'plaka', 'zemin', 'kapak', 'govde', 'yan', 'saha'));

comment on column public.electrical_device_models.mount_type is
  'Aygıt panoda nereye takılır: din | plaka | zemin (pano tabanı, trafo) | kapak (sınıflandırma; yerleşimi çizilmez) | govde | yan (pano yanı) | saha (pano dışı).';

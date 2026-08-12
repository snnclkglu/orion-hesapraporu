-- INNOMATICS → INNOMOTICS — 12.08.2026 (kullanıcı bildirimi).
--
-- Marka adı baştan beri YANLIŞ YAZILMIŞTI. Siemens'in motor işinin ayrıldığı
-- şirketin adı **INNOMOTICS**tir; katalog çıkarımında "INNOMATICS" yazılmış ve
-- oradan seed'e, oradan da mühendisin seçimlerine ve teslim edilen ekipman
-- listelerine geçmiştir. Bir üreticinin adını yanlış basmak, müşteriye giden
-- belgede sipariş edilemeyecek bir ürün göstermek demektir.
--
-- Düzeltme ÜÇ YERİ birden kapsar; biri eksik kalırsa katalogdaki ürün ile
-- revizyondaki seçim `dsKey(kind, brand, model)` üzerinden birbirini bulamaz
-- ve katalog sayfası düğmesi sessizce ölür (AGENTS md. 20'nin uyardığı bağ):
--   1. `cat_equipment` — katalogdaki 100 motor satırı
--   2. `catalog_version` künyesi — kaynak listesindeki marka adı
--   3. `revisions.inputs` / `selections` — mühendisin YAPMIŞ olduğu seçimler
--
-- YAYINLANMIŞ REVİZYONLARA DA DOKUNULUR ve bu bilinçlidir. `guard_issued_revision`
-- teslim edilmiş hesabın SAYILARINI korumak için vardır; burada değişen tek şey
-- bir üreticinin adının doğru yazılmasıdır ve düzeltilmeyen bir revizyon her
-- yeniden basımda yanlış markayı basmaya devam ederdi. Emsal: 20260812120000'in
-- devralınan satırlara büyük harf kuralını uygulaması. Tetikleyici yalnız bu
-- işlem boyunca durdurulur.
--
-- Metin değişimi `replace` iledir: "INNOMATICS" dizgisi bu veride markadan
-- başka bir şeye karşılık gelmez ve varsayılan yürütme markası
-- ("INNOMATICS/SEW/ABB") gibi birleşik yazımları da doğru çevirir.
--
-- Migration TEKRAR ÇALIŞTIRILABİLİR.

-- --------------------------------------------------------------- 1. katalog
update public.cat_equipment
set brand = 'INNOMOTICS'
where brand = 'INNOMATICS';

-- ------------------------------------------------------- 2. katalog künyesi
update public.app_settings
set value = replace(value::text, 'INNOMATICS', 'INNOMOTICS')::jsonb
where key = 'catalog_version'
  and value::text like '%INNOMATICS%';

-- --------------------------------------------------------- 3. revizyonlar
alter table public.revisions disable trigger guard_issued_revision;

update public.revisions
set
  inputs = replace(inputs::text, 'INNOMATICS', 'INNOMOTICS')::jsonb,
  selections = replace(selections::text, 'INNOMATICS', 'INNOMOTICS')::jsonb
where inputs::text like '%INNOMATICS%'
   or selections::text like '%INNOMATICS%';

alter table public.revisions enable trigger guard_issued_revision;

-- Panelden elle eklenen ek ekipman satırları da markayı METİN olarak taşır.
update public.equipment_extras
set rows = replace(rows::text, 'INNOMATICS', 'INNOMOTICS')::jsonb
where rows::text like '%INNOMATICS%';

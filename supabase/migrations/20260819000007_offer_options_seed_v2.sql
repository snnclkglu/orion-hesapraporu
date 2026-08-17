-- TEKLİF DEFTERİ — SEED (ÜRETİLMİŞ DOSYA, ELLE DÜZENLENMEZ)
--
--     npx tsx scripts/gen-offer-seed.ts
--
-- Kaynak: firmanın 2026'da verdiği on dört teklifin METNİ ve uygulamanın kendi
-- katalog/sabit defterleri. UYDURULMUŞ DEĞER YOKTUR (değişmez md. 4): bir
-- seçenek burada varsa gerçek bir belgede geçmiştir. Bu yüzden bazı listeler
-- tek maddelik, "Garanti" listesi ise BOŞTUR — devralınan tekliflerin hiçbirinde
-- garanti maddesi yok ve bir garanti süresi uydurmak, teklifte yapılabilecek en
-- pahalı hatadır.
--
-- LİSTELER KAPALI DEĞİLDİR: kullanıcı yazdığı değeri tek tıkla deftere ekler
-- (`ensureOfferOption`), tıpkı tedarikçi defterindeki gibi.
--
-- `on conflict do nothing`: seed iki kez uygulanırsa kullanıcının eklediği ya
-- da düzenlediği maddeler EZİLMEZ.


-- ——————————————————————————————————————————————— MARKALAR

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.motor', 'GAMAK', 'GAMAK', 10, false),
  ('brand.motor', 'ELK', 'ELK', 20, false),
  ('brand.motor', 'ABB', 'ABB', 30, false),
  ('brand.motor', 'SIEMENS', 'SIEMENS', 40, false),
  ('brand.motor', 'SEW-EURODRIVE', 'SEW-EURODRIVE', 50, false),
  ('brand.motor', 'INNOMOTICS', 'INNOMOTICS', 60, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.gearbox', 'YILMAZ R.', 'YILMAZ R.', 10, false),
  ('brand.gearbox', 'FLENDER', 'FLENDER', 20, false),
  ('brand.gearbox', 'SEW-EURODRIVE', 'SEW-EURODRIVE', 30, false),
  ('brand.gearbox', 'SIEMENS', 'SIEMENS', 40, false),
  ('brand.gearbox', 'POLAT (PGR)', 'POLAT (PGR)', 50, false),
  ('brand.gearbox', 'ROSSI', 'ROSSI', 60, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.brake', 'SIBRE', 'SIBRE', 10, false),
  ('brand.brake', 'DERELİ', 'DERELI', 20, false),
  ('brand.brake', 'GALVI NEWCOMEN', 'GALVI NEWCOMEN', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.drive', 'SCHNEIDER', 'SCHNEIDER', 10, false),
  ('brand.drive', 'VEIOKONG', 'VEIOKONG', 20, false),
  ('brand.drive', 'SIEMENS', 'SIEMENS', 30, false),
  ('brand.drive', 'ABB', 'ABB', 40, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.bearing', 'SKF', 'SKF', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.pendant', 'Elfatek', 'ELFATEK', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.limit', 'Stromag', 'STROMAG', 10, false),
  ('brand.limit', 'Crosslimit', 'CROSSLIMIT', 20, false),
  ('brand.limit', 'Terr', 'TERR', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.trafo', 'Eka', 'EKA', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.powerSupply', 'Omron', 'OMRON', 10, false),
  ('brand.powerSupply', 'Phoenix', 'PHOENIX', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.terminal', 'Phoenix', 'PHOENIX', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.loadcell', 'Esit', 'ESIT', 10, false),
  ('brand.loadcell', 'Kobastar', 'KOBASTAR', 20, false),
  ('brand.loadcell', 'Elfatek', 'ELFATEK', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.signalization', 'Mucco', 'MUCCO', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.cable', 'Üntel', 'UNTEL', 10, false),
  ('brand.cable', 'Helukabel', 'HELUKABEL', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.resistor', 'Ressa', 'RESSA', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.switchgear', 'Schneider', 'SCHNEIDER', 10, false),
  ('brand.switchgear', 'Siemens', 'SIEMENS', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.panel', 'EAE', 'EAE', 10, false),
  ('brand.panel', 'TEMPA', 'TEMPA', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('brand.busbar', 'Vasel', 'VASEL', 10, false),
  ('brand.busbar', 'Conductix-Wampfler', 'CONDUCTIX-WAMPFLER', 20, false)
on conflict do nothing;


-- ————————————————————————————— KADEMELİ LİSTELER (marka → tip/seri)

insert into public.offer_options (list_key, value, match_key, sort, parent_id)
select v.list_key, v.value, v.match_key, v.sort, p.id
from (values
  ('series.gearbox', 'VR Tipi', 'VR TIPI', 10),
  ('series.gearbox', 'HT Tipi', 'HT TIPI', 20),
  ('series.gearbox', 'HT Sandık Tipi', 'HT SANDIK TIPI', 30),
  ('series.gearbox', 'DR Tipi', 'DR TIPI', 40),
  ('series.gearbox', 'KR Tipi', 'KR TIPI', 50),
  ('series.gearbox', 'M Tipi', 'M TIPI', 60),
  ('series.gearbox', 'Planet R.', 'PLANET R.', 70)
) as v(list_key, value, match_key, sort)
cross join lateral (
  select id from public.offer_options
  where list_key = 'brand.gearbox' and match_key = 'YILMAZ R.'
) p
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, parent_id)
select v.list_key, v.value, v.match_key, v.sort, p.id
from (values
  ('series.gearbox', 'B2', 'B2', 10),
  ('series.gearbox', 'B3', 'B3', 20),
  ('series.gearbox', 'B4', 'B4', 30),
  ('series.gearbox', 'H1', 'H1', 40),
  ('series.gearbox', 'H2', 'H2', 50),
  ('series.gearbox', 'H3', 'H3', 60),
  ('series.gearbox', 'H4', 'H4', 70)
) as v(list_key, value, match_key, sort)
cross join lateral (
  select id from public.offer_options
  where list_key = 'brand.gearbox' and match_key = 'FLENDER'
) p
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, parent_id)
select v.list_key, v.value, v.match_key, v.sort, p.id
from (values
  ('series.gearbox', 'R', 'R', 10),
  ('series.gearbox', 'F', 'F', 20),
  ('series.gearbox', 'K', 'K', 30),
  ('series.gearbox', 'S', 'S', 40),
  ('series.gearbox', 'W', 'W', 50),
  ('series.gearbox', 'X', 'X', 60)
) as v(list_key, value, match_key, sort)
cross join lateral (
  select id from public.offer_options
  where list_key = 'brand.gearbox' and match_key = 'SEW-EURODRIVE'
) p
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, parent_id)
select v.list_key, v.value, v.match_key, v.sort, p.id
from (values
  ('series.gearbox', 'SIMOGEAR', 'SIMOGEAR', 10)
) as v(list_key, value, match_key, sort)
cross join lateral (
  select id from public.offer_options
  where list_key = 'brand.gearbox' and match_key = 'SIEMENS'
) p
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, parent_id)
select v.list_key, v.value, v.match_key, v.sort, p.id
from (values
  ('series.gearbox', 'PCS', 'PCS', 10)
) as v(list_key, value, match_key, sort)
cross join lateral (
  select id from public.offer_options
  where list_key = 'brand.gearbox' and match_key = 'POLAT (PGR)'
) p
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, parent_id)
select v.list_key, v.value, v.match_key, v.sort, p.id
from (values
  ('series.drive', 'ATV-320', 'ATV-320', 10),
  ('series.drive', 'ATV-340', 'ATV-340', 20)
) as v(list_key, value, match_key, sort)
cross join lateral (
  select id from public.offer_options
  where list_key = 'brand.drive' and match_key = 'SCHNEIDER'
) p
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, parent_id)
select v.list_key, v.value, v.match_key, v.sort, p.id
from (values
  ('series.drive', 'ACS880', 'ACS880', 10)
) as v(list_key, value, match_key, sort)
cross join lateral (
  select id from public.offer_options
  where list_key = 'brand.drive' and match_key = 'ABB'
) p
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, parent_id)
select v.list_key, v.value, v.match_key, v.sort, p.id
from (values
  ('series.pendant', 'EN-MİD Serisi', 'EN-MID SERISI', 10)
) as v(list_key, value, match_key, sort)
cross join lateral (
  select id from public.offer_options
  where list_key = 'brand.pendant' and match_key = 'ELFATEK'
) p
on conflict do nothing;


-- ——————————————————————————————————————— TEKNİK DEĞER LİSTELERİ

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.reeving', '2/1', '2/1', 10, false),
  ('val.reeving', '4/1', '4/1', 20, false),
  ('val.reeving', '4/2', '4/2', 30, false),
  ('val.reeving', '8/2', '8/2', 40, false),
  ('val.reeving', '12/2', '12/2', 50, false),
  ('val.reeving', '16/2', '16/2', 60, false),
  ('val.reeving', '16/4', '16/4', 70, false),
  ('val.reeving', '20/2', '20/2', 80, false),
  ('val.reeving', '20/4', '20/4', 90, false),
  ('val.reeving', '24/4', '24/4', 100, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.speedControl', 'Çift Hız Kontrolü (Frekans İnvertörlü)', 'CIFT HIZ KONTROLU (FREKANS INVERTORLU)', 10, false),
  ('val.speedControl', 'Frekans İnvertörlü', 'FREKANS INVERTORLU', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.controlType', 'İnvertör Kontrollü', 'INVERTOR KONTROLLU', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.hook', 'DIN 15401/P Tek Ağızlı Kanca', 'DIN 15401/P TEK AGIZLI KANCA', 10, false),
  ('val.hook', 'DIN 15402 Çift Ağızlı Kanca', 'DIN 15402 CIFT AGIZLI KANCA', 20, false),
  ('val.hook', 'Kaldırma Kirişi (Spreader)', 'KALDIRMA KIRISI (SPREADER)', 30, false),
  ('val.hook', 'Polip', 'POLIP', 40, false),
  ('val.hook', 'Mekanik Kepçe', 'MEKANIK KEPCE', 50, false),
  ('val.hook', 'Motorlu Kepçe', 'MOTORLU KEPCE', 60, false),
  ('val.hook', 'C Kancası', 'C KANCASI', 70, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.ropeConstruction', '6x36', '6X36', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.ropeGrade', '1770 N/mm2', '1770 N/MM2', 10, false),
  ('val.ropeGrade', '1960 N/mm2', '1960 N/MM2', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.ropeCore', 'Kendir Özlü', 'KENDIR OZLU', 10, false),
  ('val.ropeCore', 'Çelik Özlü', 'CELIK OZLU', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.brakeType', 'Kasnak Fren', 'KASNAK FREN', 10, false),
  ('val.brakeType', 'Elektrohidrolik Kasnak Fren', 'ELEKTROHIDROLIK KASNAK FREN', 20, false),
  ('val.brakeType', 'Elektromanyetik Motor Freni', 'ELEKTROMANYETIK MOTOR FRENI', 30, false),
  ('val.brakeType', 'Elektromanyetik Fren Soğutmalı', 'ELEKTROMANYETIK FREN SOGUTMALI', 40, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.safetyBrake', 'Emniyet Freni', 'EMNIYET FRENI', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.gearboxMounting', 'Paralel Şaft', 'PARALEL SAFT', 10, false),
  ('val.gearboxMounting', 'Delik Milli', 'DELIK MILLI', 20, false),
  ('val.gearboxMounting', 'Helisel Dişli', 'HELISEL DISLI', 30, false),
  ('val.gearboxMounting', 'Sandık Tipi', 'SANDIK TIPI', 40, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.wheelStandard', 'DIN15090', 'DIN15090', 10, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.wheelMaterial', 'C4140 35-42 HRC', 'C4140 35-42 HRC', 10, false),
  ('val.wheelMaterial', 'CK45', 'CK45', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.driveSystem', '2 Tekerden Tahrik', '2 TEKERDEN TAHRIK', 10, false),
  ('val.driveSystem', '4 Tekerden Tahrik', '4 TEKERDEN TAHRIK', 20, false),
  ('val.driveSystem', '8 Tekerden Tahrik', '8 TEKERDEN TAHRIK', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.travelSystem', '4 Teker', '4 TEKER', 10, false),
  ('val.travelSystem', '8 Teker', '8 TEKER', 20, false),
  ('val.travelSystem', '8 Teker, 4 Boji', '8 TEKER, 4 BOJI', 30, false),
  ('val.travelSystem', '16 Teker, 8 Boji, 4 Ekolayzır', '16 TEKER, 8 BOJI, 4 EKOLAYZIR', 40, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.rail', '40x30 Ray', '40X30 RAY', 10, false),
  ('val.rail', '60x40 Dikdörtgen Ray', '60X40 DIKDORTGEN RAY', 20, false),
  ('val.rail', 'A45', 'A45', 30, false),
  ('val.rail', 'A55', 'A55', 40, false),
  ('val.rail', 'A65', 'A65', 50, false),
  ('val.rail', 'A75', 'A75', 60, false),
  ('val.rail', 'A100', 'A100', 70, false),
  ('val.rail', 'A120', 'A120', 80, false),
  ('val.rail', 'A150', 'A150', 90, false),
  ('val.rail', 'S46', 'S46', 100, false),
  ('val.rail', 'Mevcut Ray', 'MEVCUT RAY', 110, false),
  ('val.rail', 'Müşteri Kapsamında', 'MUSTERI KAPSAMINDA', 120, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.craneClass', 'FEM 1Am / ISO M4', 'FEM 1AM / ISO M4', 10, false),
  ('val.craneClass', 'FEM 2m / ISO M5', 'FEM 2M / ISO M5', 20, false),
  ('val.craneClass', 'FEM 3m / ISO M6', 'FEM 3M / ISO M6', 30, false),
  ('val.craneClass', 'FEM 4m / ISO M7', 'FEM 4M / ISO M7', 40, false),
  ('val.craneClass', 'FEM 5m / ISO M8', 'FEM 5M / ISO M8', 50, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.craneType', 'Çift Kirişli Gezer Köprülü Vinç', 'CIFT KIRISLI GEZER KOPRULU VINC', 10, false),
  ('val.craneType', 'Tek Kirişli Gezer Köprülü Vinç', 'TEK KIRISLI GEZER KOPRULU VINC', 20, false),
  ('val.craneType', 'Monoray Vinç', 'MONORAY VINC', 30, false),
  ('val.craneType', 'Şarj / Döküm Vinci', 'SARJ / DOKUM VINCI', 40, false),
  ('val.craneType', 'Portal Vinç', 'PORTAL VINC', 50, false),
  ('val.craneType', 'Çift Kirişli Gezer Köprülü Portal Vinç', 'CIFT KIRISLI GEZER KOPRULU PORTAL VINC', 60, false),
  ('val.craneType', 'Yarı Portal Vinç', 'YARI PORTAL VINC', 70, false),
  ('val.craneType', 'Pergel Vinç', 'PERGEL VINC', 80, false),
  ('val.craneType', 'Alttan Askılı Vinç', 'ALTTAN ASKILI VINC', 90, false),
  ('val.craneType', 'Konsol Vinç', 'KONSOL VINC', 100, false),
  ('val.craneType', 'Rıhtım / Liman Vinci', 'RIHTIM / LIMAN VINCI', 110, false),
  ('val.craneType', 'Kaldırma Kirişi', 'KALDIRMA KIRISI', 120, false),
  ('val.craneType', 'Vinç Arabası', 'VINC ARABASI', 130, false),
  ('val.craneType', 'Operatör Kabini', 'OPERATOR KABINI', 140, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.environmentPlace', 'Kapalı Alan', 'KAPALI ALAN', 10, false),
  ('val.environmentPlace', 'Açık Alan', 'ACIK ALAN', 20, false),
  ('val.environmentPlace', 'Kapalı / Açık Alan', 'KAPALI / ACIK ALAN', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.tempMin', '0', '0', 10, false),
  ('val.tempMin', '-5', '-5', 20, false),
  ('val.tempMin', '-10', '-10', 30, false),
  ('val.tempMin', '-15', '-15', 40, false),
  ('val.tempMin', '-20', '-20', 50, false),
  ('val.tempMin', '-25', '-25', 60, false),
  ('val.tempMin', '-30', '-30', 70, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.tempMax', '+40', '+40', 10, false),
  ('val.tempMax', '+45', '+45', 20, false),
  ('val.tempMax', '+50', '+50', 30, false),
  ('val.tempMax', '+55', '+55', 40, false),
  ('val.tempMax', '+60', '+60', 50, false),
  ('val.tempMax', '+65', '+65', 60, false),
  ('val.tempMax', '+70', '+70', 70, false),
  ('val.tempMax', '+75', '+75', 80, false),
  ('val.tempMax', '+80', '+80', 90, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.motorPower', '0,25', '0,25', 10, false),
  ('val.motorPower', '0,37', '0,37', 20, false),
  ('val.motorPower', '0,55', '0,55', 30, false),
  ('val.motorPower', '0,75', '0,75', 40, false),
  ('val.motorPower', '1,1', '1,1', 50, false),
  ('val.motorPower', '1,5', '1,5', 60, false),
  ('val.motorPower', '2,2', '2,2', 70, false),
  ('val.motorPower', '3', '3', 80, false),
  ('val.motorPower', '4', '4', 90, false),
  ('val.motorPower', '5,5', '5,5', 100, false),
  ('val.motorPower', '7,5', '7,5', 110, false),
  ('val.motorPower', '11', '11', 120, false),
  ('val.motorPower', '15', '15', 130, false),
  ('val.motorPower', '18,5', '18,5', 140, false),
  ('val.motorPower', '22', '22', 150, false),
  ('val.motorPower', '30', '30', 160, false),
  ('val.motorPower', '37', '37', 170, false),
  ('val.motorPower', '45', '45', 180, false),
  ('val.motorPower', '55', '55', 190, false),
  ('val.motorPower', '75', '75', 200, false),
  ('val.motorPower', '90', '90', 210, false),
  ('val.motorPower', '110', '110', 220, false),
  ('val.motorPower', '132', '132', 230, false),
  ('val.motorPower', '160', '160', 240, false),
  ('val.motorPower', '200', '200', 250, false),
  ('val.motorPower', '250', '250', 260, false),
  ('val.motorPower', '315', '315', 270, false),
  ('val.motorPower', '355', '355', 280, false),
  ('val.motorPower', '400', '400', 290, false),
  ('val.motorPower', '450', '450', 300, false),
  ('val.motorPower', '500', '500', 310, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.motorRpm', '750', '750', 10, false),
  ('val.motorRpm', '1000', '1000', 20, false),
  ('val.motorRpm', '1500', '1500', 30, false),
  ('val.motorRpm', '3000', '3000', 40, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.drivePower', '0,37', '0,37', 10, false),
  ('val.drivePower', '0,55', '0,55', 20, false),
  ('val.drivePower', '0,75', '0,75', 30, false),
  ('val.drivePower', '1,1', '1,1', 40, false),
  ('val.drivePower', '1,5', '1,5', 50, false),
  ('val.drivePower', '2,2', '2,2', 60, false),
  ('val.drivePower', '3', '3', 70, false),
  ('val.drivePower', '4', '4', 80, false),
  ('val.drivePower', '5,5', '5,5', 90, false),
  ('val.drivePower', '7,5', '7,5', 100, false),
  ('val.drivePower', '11', '11', 110, false),
  ('val.drivePower', '15', '15', 120, false),
  ('val.drivePower', '18,5', '18,5', 130, false),
  ('val.drivePower', '22', '22', 140, false),
  ('val.drivePower', '30', '30', 150, false),
  ('val.drivePower', '37', '37', 160, false),
  ('val.drivePower', '45', '45', 170, false),
  ('val.drivePower', '55', '55', 180, false),
  ('val.drivePower', '75', '75', 190, false),
  ('val.drivePower', '90', '90', 200, false),
  ('val.drivePower', '110', '110', 210, false),
  ('val.drivePower', '132', '132', 220, false),
  ('val.drivePower', '160', '160', 230, false),
  ('val.drivePower', '200', '200', 240, false),
  ('val.drivePower', '250', '250', 250, false),
  ('val.drivePower', '315', '315', 260, false),
  ('val.drivePower', '355', '355', 270, false),
  ('val.drivePower', '400', '400', 280, false),
  ('val.drivePower', '500', '500', 290, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.wheelDia', '80', '80', 10, false),
  ('val.wheelDia', '100', '100', 20, false),
  ('val.wheelDia', '120', '120', 30, false),
  ('val.wheelDia', '150', '150', 40, false),
  ('val.wheelDia', '200', '200', 50, false),
  ('val.wheelDia', '250', '250', 60, false),
  ('val.wheelDia', '315', '315', 70, false),
  ('val.wheelDia', '400', '400', 80, false),
  ('val.wheelDia', '500', '500', 90, false),
  ('val.wheelDia', '630', '630', 100, false),
  ('val.wheelDia', '710', '710', 110, false),
  ('val.wheelDia', '800', '800', 120, false),
  ('val.wheelDia', '900', '900', 130, false),
  ('val.wheelDia', '1000', '1000', 140, false),
  ('val.wheelDia', '1120', '1120', 150, false),
  ('val.wheelDia', '1250', '1250', 160, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.ropeDia', '8', '8', 10, false),
  ('val.ropeDia', '10', '10', 20, false),
  ('val.ropeDia', '12', '12', 30, false),
  ('val.ropeDia', '14', '14', 40, false),
  ('val.ropeDia', '16', '16', 50, false),
  ('val.ropeDia', '18', '18', 60, false),
  ('val.ropeDia', '20', '20', 70, false),
  ('val.ropeDia', '22', '22', 80, false),
  ('val.ropeDia', '24', '24', 90, false),
  ('val.ropeDia', '26', '26', 100, false),
  ('val.ropeDia', '28', '28', 110, false),
  ('val.ropeDia', '30', '30', 120, false),
  ('val.ropeDia', '32', '32', 130, false),
  ('val.ropeDia', '36', '36', 140, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.girder', 'Kutu Çelik Konstrüksiyon', 'KUTU CELIK KONSTRUKSIYON', 10, false),
  ('val.girder', 'Kutu Çelik Konstrüksiyon, St52', 'KUTU CELIK KONSTRUKSIYON, ST52', 20, false),
  ('val.girder', 'Kutu Çelik Konstrüksiyon, St52/St44', 'KUTU CELIK KONSTRUKSIYON, ST52/ST44', 30, false),
  ('val.girder', 'Çelik Konstrüksiyon', 'CELIK KONSTRUKSIYON', 40, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.girderCalc', 'FEM / DIN15018 - 1/1000 Maksimum Sehim', 'FEM / DIN15018 - 1/1000 MAKSIMUM SEHIM', 10, false),
  ('val.girderCalc', 'FEM / DIN15018 - 1/1000 (M6) Maksimum Sehim', 'FEM / DIN15018 - 1/1000 (M6) MAKSIMUM SEHIM', 20, false),
  ('val.girderCalc', '1/250 Maksimum Sehim', '1/250 MAKSIMUM SEHIM', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.steelGrade', 'S355JR', 'S355JR', 10, false),
  ('val.steelGrade', 'St52', 'ST52', 20, false),
  ('val.steelGrade', 'St44/St52', 'ST44/ST52', 30, false),
  ('val.steelGrade', 'St52 / St44', 'ST52 / ST44', 40, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.platform', 'Tek Taraflı Yürüme Platformu', 'TEK TARAFLI YURUME PLATFORMU', 10, false),
  ('val.platform', 'Çift Taraflı Yürüme Platformu', 'CIFT TARAFLI YURUME PLATFORMU', 20, false),
  ('val.platform', 'Yok', 'YOK', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.paint', 'Kumlama + Astar + Son Kat, Renk : RAL1007 Sarı', 'KUMLAMA + ASTAR + SON KAT, RENK : RAL1007 SARI', 10, false),
  ('val.paint', 'RAL 1007', 'RAL 1007', 20, false),
  ('val.paint', 'RAL 1007 Turuncu', 'RAL 1007 TURUNCU', 30, false),
  ('val.paint', 'Isıya Dayanıklı Boya, RAL : 1018', 'ISIYA DAYANIKLI BOYA, RAL : 1018', 40, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.supplyVoltage', '400 VAC 50 Hz', '400 VAC 50 HZ', 10, false),
  ('val.supplyVoltage', '380 VAC', '380 VAC', 20, false),
  ('val.supplyVoltage', '220 VAC', '220 VAC', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.controlVoltage', '220 – 24 VDC', '220 – 24 VDC', 10, false),
  ('val.controlVoltage', '220 VAC', '220 VAC', 20, false),
  ('val.controlVoltage', '24 VDC', '24 VDC', 30, false),
  ('val.controlVoltage', '48 VDC', '48 VDC', 40, false),
  ('val.controlVoltage', '110 VAC', '110 VAC', 50, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.runwayPower', 'Müşteri Kapsamında', 'MUSTERI KAPSAMINDA', 10, false),
  ('val.runwayPower', 'Kapalı Bara', 'KAPALI BARA', 20, false),
  ('val.runwayPower', 'Kapalı Kutu Bara (Opsiyonel)', 'KAPALI KUTU BARA (OPSIYONEL)', 30, false),
  ('val.runwayPower', 'Hariç', 'HARIC', 40, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.scope', 'Orion Kapsamında', 'ORION KAPSAMINDA', 10, false),
  ('val.scope', 'Müşteri Kapsamında', 'MUSTERI KAPSAMINDA', 20, false),
  ('val.scope', 'Dahil', 'DAHIL', 30, false),
  ('val.scope', 'Hariç', 'HARIC', 40, false),
  ('val.scope', 'Opsiyonel', 'OPSIYONEL', 50, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.testDynamic', 'Q x 1,1', 'Q X 1,1', 10, true)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.testStatic', 'Q x 1,25', 'Q X 1,25', 10, true)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.priceUnit', 'Takım', 'TAKIM', 10, false),
  ('val.priceUnit', 'Adet', 'ADET', 20, false),
  ('val.priceUnit', 'Kişi', 'KISI', 30, false),
  ('val.priceUnit', 'Metre', 'METRE', 40, false),
  ('val.priceUnit', 'Gün', 'GUN', 50, false)
on conflict do nothing;


-- ————————————————————————————————————————————— TİCARİ ŞARTLAR

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.validity', '14 iş günü', '14 IS GUNU', 10, true)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.deliveryTrigger', 'Avans Ödemesi Sonrası', 'AVANS ODEMESI SONRASI', 10, true),
  ('term.deliveryTrigger', 'Sipariş Onayı Sonrası', 'SIPARIS ONAYI SONRASI', 20, false),
  ('term.deliveryTrigger', 'Sözleşme İmzalanması Sonrası', 'SOZLESME IMZALANMASI SONRASI', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.deliveryWeeks', '4', '4', 10, false),
  ('val.deliveryWeeks', '5', '5', 20, false),
  ('val.deliveryWeeks', '6', '6', 30, false),
  ('val.deliveryWeeks', '7', '7', 40, false),
  ('val.deliveryWeeks', '8', '8', 50, false),
  ('val.deliveryWeeks', '9', '9', 60, false),
  ('val.deliveryWeeks', '10', '10', 70, false),
  ('val.deliveryWeeks', '11', '11', 80, false),
  ('val.deliveryWeeks', '12', '12', 90, false),
  ('val.deliveryWeeks', '13', '13', 100, false),
  ('val.deliveryWeeks', '14', '14', 110, false),
  ('val.deliveryWeeks', '15', '15', 120, false),
  ('val.deliveryWeeks', '16', '16', 130, false),
  ('val.deliveryWeeks', '17', '17', 140, false),
  ('val.deliveryWeeks', '18', '18', 150, false),
  ('val.deliveryWeeks', '19', '19', 160, false),
  ('val.deliveryWeeks', '20', '20', 170, false),
  ('val.deliveryWeeks', '21', '21', 180, false),
  ('val.deliveryWeeks', '22', '22', 190, false),
  ('val.deliveryWeeks', '23', '23', 200, false),
  ('val.deliveryWeeks', '24', '24', 210, false),
  ('val.deliveryWeeks', '25', '25', 220, false),
  ('val.deliveryWeeks', '26', '26', 230, false),
  ('val.deliveryWeeks', '27', '27', 240, false),
  ('val.deliveryWeeks', '28', '28', 250, false),
  ('val.deliveryWeeks', '29', '29', 260, false),
  ('val.deliveryWeeks', '30', '30', 270, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.deliveryUnit', 'Hafta', 'HAFTA', 10, true),
  ('val.deliveryUnit', 'Ay', 'AY', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.freight', 'Dahil', 'DAHIL', 10, false),
  ('term.freight', 'Hariç', 'HARIC', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.erection', 'Vinçlerin yerine montajı ve devreye alınması dahildir.', 'VINCLERIN YERINE MONTAJI VE DEVREYE ALINMASI DAHILDIR.', 10, false),
  ('term.erection', 'Hariç', 'HARIC', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.deliveryPlace', 'Yerinde çalışır halde teslim', 'YERINDE CALISIR HALDE TESLIM', 10, false),
  ('term.deliveryPlace', 'Ankara, Başkent OSB.', 'ANKARA, BASKENT OSB.', 20, false),
  ('term.deliveryPlace', 'Ankara Başkent OSB., Orion Vinç Fabrika', 'ANKARA BASKENT OSB., ORION VINC FABRIKA', 30, false),
  ('term.deliveryPlace', 'Ankara Fabrika', 'ANKARA FABRIKA', 40, false),
  ('term.deliveryPlace', 'Proje gönderimi', 'PROJE GONDERIMI', 50, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.warranty', '2 Yıl', '2 YIL', 10, true),
  ('term.warranty', '1 Yıl', '1 YIL', 20, false),
  ('term.warranty', '3 Yıl', '3 YIL', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.paymentHeader', 'KDV Dahil ödeme şekli aşağıda belirtilen şekildedir.', 'KDV DAHIL ODEME SEKLI ASAGIDA BELIRTILEN SEKILDEDIR.', 10, false),
  ('term.paymentHeader', 'Ödeme şekli aşağıda belirtilen şekildedir.', 'ODEME SEKLI ASAGIDA BELIRTILEN SEKILDEDIR.', 20, false),
  ('term.paymentHeader', 'Teslimde Nakit', 'TESLIMDE NAKIT', 30, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.paymentLine', '%40 Avans Sipariş ile Nakit', '%40 AVANS SIPARIS ILE NAKIT', 10, false),
  ('term.paymentLine', '%50 Avans Sipariş ile Nakit', '%50 AVANS SIPARIS ILE NAKIT', 20, false),
  ('term.paymentLine', '%30 Avans Sipariş ile Nakit', '%30 AVANS SIPARIS ILE NAKIT', 30, false),
  ('term.paymentLine', '%60 Teslimat Sonrası Nakit', '%60 TESLIMAT SONRASI NAKIT', 40, false),
  ('term.paymentLine', '%60 Teslimat Sonrası Nakit (Fatura + 30 Gün)', '%60 TESLIMAT SONRASI NAKIT (FATURA + 30 GUN)', 50, false),
  ('term.paymentLine', '%60 Sevk ile Nakit', '%60 SEVK ILE NAKIT', 60, false),
  ('term.paymentLine', '%50 Nakit Sevk Öncesi', '%50 NAKIT SEVK ONCESI', 70, false),
  ('term.paymentLine', 'Sevk Öncesi %30 Nakit', 'SEVK ONCESI %30 NAKIT', 80, false),
  ('term.paymentLine', 'Devreye Alma Sonrası %30 Nakit', 'DEVREYE ALMA SONRASI %30 NAKIT', 90, false),
  ('term.paymentLine', 'Her vinç teslimatı sonrası %60 Nakit', 'HER VINC TESLIMATI SONRASI %60 NAKIT', 100, false),
  ('term.paymentLine', 'Montaj Sonrası Kalan Nakit', 'MONTAJ SONRASI KALAN NAKIT', 110, false),
  ('term.paymentLine', '%50 Detay Projeler Tamamlandığında Nakit', '%50 DETAY PROJELER TAMAMLANDIGINDA NAKIT', 120, false),
  ('term.paymentLine', 'Teslim + 30 Gün Nakit', 'TESLIM + 30 GUN NAKIT', 130, false),
  ('term.paymentLine', 'Teslimde Nakit', 'TESLIMDE NAKIT', 140, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.note', 'Belirtilen fiyatlara KDV dahil değildir.', 'BELIRTILEN FIYATLARA KDV DAHIL DEGILDIR.', 10, false),
  ('term.note', 'Teklif fiyatına hiçbir yurtiçi vergi, harç, pul avans damga vergisi, banka komisyonu ve masrafları v.b. dahil değildir.', 'TEKLIF FIYATINA HICBIR YURTICI VERGI, HARC, PUL AVANS DAMGA VERGISI, BANKA KOMISYONU VE MASRAFLARI V.B. DAHIL DEGILDIR.', 20, false),
  ('term.note', 'Malzemenin kısmen veya tamamen alınması firmamız dışındaki nedenlerden ötürü (inşaat işlerinin tamamlanmaması, nakliye alıcıya ait ise araç bulunamaması v.b.) gecikmesi halinde malzemenin sevkiyata hazır olduğunun müşteriye bildirilmesini takiben 5 gün içerisinde ödeme koşulları aynen devam edecektir.', 'MALZEMENIN KISMEN VEYA TAMAMEN ALINMASI FIRMAMIZ DISINDAKI NEDENLERDEN OTURU (INSAAT ISLERININ TAMAMLANMAMASI, NAKLIYE ALICIYA AIT ISE ARAC BULUNAMAMASI V.B.) GECIKMESI HALINDE MALZEMENIN SEVKIYATA HAZIR OLDUGUNUN MUSTERIYE BILDIRILMESINI TAKIBEN 5 GUN ICERISINDE ODEME KOSULLARI AYNEN DEVAM EDECEKTIR.', 30, false),
  ('term.note', 'Teslim sonrası vincin tüm imalat projeleri dwg. formatında paylaşılacaktır.', 'TESLIM SONRASI VINCIN TUM IMALAT PROJELERI DWG. FORMATINDA PAYLASILACAKTIR.', 40, false),
  ('term.note', 'Elektrik projelendirme ve tasarım dahil değildir.', 'ELEKTRIK PROJELENDIRME VE TASARIM DAHIL DEGILDIR.', 50, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.exclusion', 'Vincin montaj sahasında gerekli olan tüm inşaat işleri', 'VINCIN MONTAJ SAHASINDA GEREKLI OLAN TUM INSAAT ISLERI', 10, false),
  ('term.exclusion', 'Köprü rayı ve hol bara montajı', 'KOPRU RAYI VE HOL BARA MONTAJI', 20, false),
  ('term.exclusion', 'Hol boyu bara tesisatı ve besleme', 'HOL BOYU BARA TESISATI VE BESLEME', 30, false),
  ('term.exclusion', 'Nakliye', 'NAKLIYE', 40, false),
  ('term.exclusion', 'Nakliye ve Montaj', 'NAKLIYE VE MONTAJ', 50, false),
  ('term.exclusion', 'Montajda kullanılacak mobil ve sepetli vinçler', 'MONTAJDA KULLANILACAK MOBIL VE SEPETLI VINCLER', 60, false),
  ('term.exclusion', 'Montaj için yatay ve düşey hareketleri sağlayacak gerekli sayı ve kapasitedeki montaj vinci sağlanması', 'MONTAJ ICIN YATAY VE DUSEY HAREKETLERI SAGLAYACAK GEREKLI SAYI VE KAPASITEDEKI MONTAJ VINCI SAGLANMASI', 70, false),
  ('term.exclusion', 'Sahaya gelen malzemelerin boşaltılması ve depolanması', 'SAHAYA GELEN MALZEMELERIN BOSALTILMASI VE DEPOLANMASI', 80, false),
  ('term.exclusion', 'Test için gerekli uygun yük temini ve bu yükün bağlanması için gereken ekipmanlar', 'TEST ICIN GEREKLI UYGUN YUK TEMINI VE BU YUKUN BAGLANMASI ICIN GEREKEN EKIPMANLAR', 90, false),
  ('term.exclusion', 'Sahada ihtiyaç duyulacak her türlü enerji temini', 'SAHADA IHTIYAC DUYULACAK HER TURLU ENERJI TEMINI', 100, false),
  ('term.exclusion', 'Vinç barası', 'VINC BARASI', 110, false),
  ('term.exclusion', 'Vinç üzeri enerji besleme noktasına kadar gerekli kesit ve miktarda kablo bağlantısı sağlanması', 'VINC UZERI ENERJI BESLEME NOKTASINA KADAR GEREKLI KESIT VE MIKTARDA KABLO BAGLANTISI SAGLANMASI', 120, false),
  ('term.exclusion', 'Kabin montaj sahasında gerekli olan tüm inşaat işleri', 'KABIN MONTAJ SAHASINDA GEREKLI OLAN TUM INSAAT ISLERI', 130, false),
  ('term.exclusion', 'Kabin montajı', 'KABIN MONTAJI', 140, false)
on conflict do nothing;


-- ————————————————————————————————————————————— KAPAK METİNLERİ

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('cover.honorific', 'Bey,', 'BEY,', 10, false),
  ('cover.honorific', 'Hanım,', 'HANIM,', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('cover.intro', 'Tarafımızdan talep etmiş olduğunuz konu iş için teknik ve ticari teklifimizi aşağıda dikkatinize sunar, kıymetli siparişleriniz bekleriz.', 'TARAFIMIZDAN TALEP ETMIS OLDUGUNUZ KONU IS ICIN TEKNIK VE TICARI TEKLIFIMIZI ASAGIDA DIKKATINIZE SUNAR, KIYMETLI SIPARISLERINIZ BEKLERIZ.', 10, true)
on conflict do nothing;


-- ——————————————————————————————————————————————————— ŞABLONLAR
-- İskelet yalnız GRUP ANAHTARLARINI taşır; satırlar defterden (`registry.ts`)
-- kurulur. Satırların kopyası buraya yazılsaydı defter her genişlediğinde
-- şablonlar eskir ve yeni alan hiçbir teklifte görünmezdi.

insert into public.offer_templates (name, match_key, crane_type, skeleton, sort) values
  ('Çift Kirişli Gezer Köprülü Vinç', 'CIFT KIRISLI GEZER KOPRULU VINC', 'Çift Kirişli Gezer Köprülü Vinç', '{"groupKeys":["general","mainHoist","trolley","bridge","steel","electrical"]}'::jsonb, 10),
  ('Çift Kirişli Vinç — Yardımcı Kaldırmalı', 'CIFT KIRISLI VINC — YARDIMCI KALDIRMALI', 'Çift Kirişli Gezer Köprülü Vinç', '{"groupKeys":["general","mainHoist","auxHoist","trolley","bridge","steel","electrical"]}'::jsonb, 20),
  ('Tek Kirişli / Monoray Vinç', 'TEK KIRISLI / MONORAY VINC', 'Monoray Vinç', '{"groupKeys":["general","mainHoist","trolley","steel","electrical"]}'::jsonb, 30),
  ('Portal Vinç', 'PORTAL VINC', 'Portal Vinç', '{"groupKeys":["general","mainHoist","trolley","gantry","steel","electrical"]}'::jsonb, 40),
  ('Pergel Vinç', 'PERGEL VINC', 'Pergel Vinç', '{"groupKeys":["general","mainHoist","trolley","boom","steel","electrical"]}'::jsonb, 50),
  ('Vinç Arabası', 'VINC ARABASI', 'Vinç Arabası', '{"groupKeys":["general","mainHoist","auxHoist","trolley","steel","electrical"]}'::jsonb, 60),
  ('Kaldırma Kirişi', 'KALDIRMA KIRISI', 'Kaldırma Kirişi', '{"groupKeys":["general","steel"]}'::jsonb, 70),
  ('Operatör Kabini', 'OPERATOR KABINI', 'Operatör Kabini', '{"groupKeys":["general","steel"]}'::jsonb, 80)
on conflict do nothing;

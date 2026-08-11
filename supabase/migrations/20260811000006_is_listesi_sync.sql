-- İŞ LİSTESİNİN EŞİTLENMESİ — "ORİON-İş Listesi (2).xlsx", 11.08.2026.
--
-- Firmanın güncel iş listesi (87 satır, 0001-00 … 0062-00) ile sistemdeki
-- kalemler karşılaştırıldı. Devralınan aktarım (20260808000004 +
-- 20260808000008) 55 basılı İŞ EMRİNDEN çıkmıştı; o tarihten sonra açılan
-- işler ve iş emri formuna hiç girmemiş kalemler sistemde eksikti:
--
--   yeni iş emri   0020 · 0056 · 0058 · 0059 · 0060 · 0061 · 0062
--   yeni kalem     0034-01…07 (tek "PANEL İMALATI" kalemi yedi proje
--                  numarasına ayrıldı) · 0057-09
--   yeni müşteri   TOSÇELİK PROFİL · SMT GRUP
--
-- BU SEFER EXCEL EZER. Önceki aktarım var olan ticari kaydı korumuştu
-- (`do nothing`) çünkü sisteme elle girilmiş fiyatlar vardı; bugünkü istek
-- "sayfayı listeye göre güncelle"dir ve liste artık asıldır. Kullanıcının
-- kendi yazdığı NOT alanı (`notes`) yine de korunur — listede karşılığı yok.
--
-- ÜRÜN ADLARI DA LİSTEDEN GELİR. İş emri formundaki adlar büyük harf ve
-- kısaltmalıydı ("PANEL İMALATI"); listedeki adlar müşteriye gösterilen
-- adlardır ("Çelik Panel İmalatı (06-3618)") ve İş Listesi PDF'i ile Satış
-- Takibi ekranı aynı metni göstermek zorundadır. İş emrinin KENDİ başlığı
-- (`jobs.title`) DEĞİŞMEZ: o, basılmış formun fotoğrafıdır.
--
-- 0045 BÖLÜNMÜŞ KALIR. Excel iki vinci tek satırda 2 adet olarak yazar, iş
-- emri iki ayrı kalem açmıştır (0045-01, 0045-02). Kalemler bozulmaz; miktar
-- kalem başına 1'e iner, birim ağırlık ve birim fiyat aynen taşınır — toplam
-- ağırlık ve toplam bedel Excel'inkiyle birebir aynı çıkar.
--
-- 0028-00 BU AKTARIMIN DIŞINDADIR — çelişki çözülmeden veri yazılmaz.
-- Listede satır "ORION CRANES · 10 t x 20,05 m Çift Kirişli Köprülü Tavan
-- Vinci"dir (0006-00 satırının bire bir aynısı, yalnız sözleşme tarihi
-- farklı); iş emrinde ise 0028 "ASTOR A.Ş. · 30 t x 21,7 m"dir. İkisi aynı
-- iş olamaz ve hangisinin doğru olduğu belgelerden çıkmıyor. Yazılsaydı
-- ASTOR'un iş emrinin altında ORION'un vinci görünürdü — sessiz ve fark
-- edilmesi güç bir hata. Aynı satır 20260808000008'de de bu sebeple
-- atlanmıştı; karar kullanıcınındır.
--
-- Migration TEKRAR ÇALIŞTIRILABİLİR.

-- ------------------------------------------------------------ yeni müşteriler
-- Listede geçip defterde olmayan iki firma. Kısaltma ve renk
-- `assign_customer_color` tetikleyicisinden gelir.
with actor as (
  select coalesce(
    (select p.id from public.profiles p join auth.users u on u.id = p.id
      where u.email = 'scolakoglu@orioncranes.com'),
    (select p.id from public.profiles p where p.role = 'admin' order by p.created_at limit 1)
  ) as id
)
insert into public.customers (name, created_by)
select v.name, a.id
from (values ('TOSÇELİK PROFİL'), ('SMT GRUP')) as v(name)
cross join actor a
where not exists (
  select 1 from public.customers c where lower(btrim(c.name)) = lower(btrim(v.name))
);

-- --------------------------------------------------------------- eksik işler
-- Listedeki ad Excel'in kısa müşteri adıdır; iş emrine defterdeki RESMÎ unvan
-- yazılır (iş emri o unvanı basar). Eşleme aşağıdaki `musteri` CTE'sindedir.
with actor as (
  select coalesce(
    (select p.id from public.profiles p join auth.users u on u.id = p.id
      where u.email = 'scolakoglu@orioncranes.com'),
    (select p.id from public.profiles p where p.role = 'admin' order by p.created_at limit 1)
  ) as id
),
musteri (kisa, resmi) as (values
  ('ASTOR A.Ş.', 'ASTOR A.Ş.'),
  ('EREĞLİ DEMİR ÇELİK FABRİKALARI', 'EREĞLİ DEMİR ÇELİK FABRİKALARI T.A.Ş.'),
  ('GALVASUN GALVANİZ SANAYİ', 'GALVASUN GALVANİZ SAN.TİC.İTH.İHR.LTD.ŞTİ.'),
  ('HABAŞ', 'HABAŞ'),
  ('KARDEMİR A.Ş.', 'KARDEMİR A.Ş.'),
  ('KARDEMİR ÇELİK SANAYİ A.Ş.', 'KARDEMİR ÇELİK SANAYİ A.Ş. (ÇELİKHANE)'),
  ('KARÇEL A.Ş.', 'KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.'),
  ('LİTEC MAKİNA', 'LITEC MAKİNA SAN. VE TİC. A.Ş.'),
  ('MAKİNE VE KİMYA ENDÜSTRİSİ A.Ş.', 'MAKİNE VE KİMYA ENDÜSTRİSİ ANONİM ŞİRKETİ'),
  ('MTC PASLANMAZ', 'MTC PASLANMAZ'),
  ('ORHUN MAKİNA', 'ORHUN MAKİNA'),
  ('ORION CRANES', 'ORiON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.'),
  ('PLASTIC MASTER', 'PLASTIC MASTER PLASTİK SANAYİ VE TİC.LTD.ŞTİ.'),
  ('PİMSUN', 'PİMSUN'),
  ('SAKA DEMİR ÇELİK SAN.TİC.A.Ş.', 'SAKA DEMİR ÇELİK SANAYİ VE TİCARET A.Ş.'),
  ('SMT GRUP', 'SMT GRUP'),
  ('Sİ-MA MAKİNA', 'Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.TİC.LTD.ŞTİ'),
  ('TOSÇELİK PROFİL', 'TOSÇELİK PROFİL'),
  ('YALCO DIŞ TİCARET', 'YALCO DIŞ TİCARET VE MÜMESSİLLİK LTD. ŞTİ.'),
  ('YILMAZLAR TEMELLİ VİNÇ HİZM. TİC. LTD. ŞTİ.', 'YILMAZLAR TEMELLİ VİNÇ HİZM. TİC. LTD. ŞTİ.'),
  ('İNFEED OTOMASYON', 'İNFEED OTOMASYON ELEKTRİK ELEKTRONİK SAN.VE TİC.LTD.ŞTİ.'),
  ('İSKENDERUN DEMİR VE ÇELİK A.Ş.', 'İSKENDERUN DEMİR VE ÇELİK A.Ş.'),
  ('İZMİR DEMİR ÇELİK SANAYİ A.Ş.', 'İZMİR DEMİR ÇELİK SANAYİ A.Ş.')
),
src (job_no, title, customer_short, contract_date, due_date, ship_date,
     quantity_text, status) as (values
  ('0020', '185/40 t x 18,28 m Kapasiteli Dört Kirişli Köprülü Tavan Vinci (Çelikhane Şarj Holü Tesisi)', 'KARÇEL A.Ş.', '2025-04-17', '2026-02-20', '2026-01-12', '1 Adet', 'completed'),
  ('0056', '32 t Kapasiteli Döner Arabalı Portal Vinç Mühendislik ve Tasarım Hizmeti', 'KARÇEL A.Ş.', '2026-05-15', '2026-05-20', '2026-05-22', '1 Adet', 'completed'),
  ('0058', '1 t Kapasiteli C Kanca İmalatı CE Belgeli', 'TOSÇELİK PROFİL', '2026-07-06', '2026-07-29', '2026-07-23', '1 Adet', 'completed'),
  ('0059', 'Tampon Karşılığı ve Rüzgar Emniyet Kilidi (0053-01 Portal Vinç)', 'LİTEC MAKİNA', '2026-07-02', '2026-07-10', '2026-07-08', '4 Takım', 'completed'),
  ('0060', '10, 12, 15, 20, 30mm S235JR Kalite Saclar', 'SMT GRUP', '2026-07-09', '2026-07-20', '2026-07-17', '1 Set', 'completed'),
  ('0061', 'Duvar Tipi Manuel Pergel Vinç Kolu 250 Kg Kapasiteli, 180° Dönebilir, 4,5m', 'ASTOR A.Ş.', '2026-07-13', '2026-08-17', null, '12 Adet', 'active'),
  ('0062', '170 Ton Lamelli Kanca İmalatı (Şarj Vinci)', 'İZMİR DEMİR ÇELİK SANAYİ A.Ş.', '2026-07-31', '2026-10-15', null, '2 Adet', 'active')
)
insert into public.jobs (
  job_no, title, customer, customer_id, customer_address, customer_tax_office,
  customer_tax_no, customer_phone, customer_fax, work_order_date, contract_date,
  workshop_exit_date, delivery_date, quantity_text, form_code, scope,
  status, created_by
)
select
  s.job_no,
  s.title,
  coalesce(c.name, s.customer_short),
  c.id,
  coalesce(c.address, ''), coalesce(c.tax_office, ''), coalesce(c.tax_no, ''),
  coalesce(c.phone, ''), coalesce(c.fax, ''),
  s.contract_date::date,
  s.contract_date::date,
  s.due_date::date,
  s.ship_date::date,
  s.quantity_text,
  'FR.81',
  '{}'::jsonb,
  s.status::public.job_status,
  a.id
from src s
cross join actor a
left join musteri m on m.kisa = s.customer_short
left join public.customers c on lower(btrim(c.name)) = lower(btrim(m.resmi))
where not exists (select 1 from public.jobs j where j.job_no = s.job_no);

-- ------------------------------------------------- 0034: tek kalem yedi oldu
-- YALCO panel işi iş emrinde tek satırdı ("PANEL İMALATI", 500+300 adet);
-- listede yedi ayrı proje numarasına ayrılmış. Var olan kalem SİLİNMEZ,
-- 0034-01'e DÖNÜŞTÜRÜLÜR: hesap raporu bağı (`project_id`) ve atölye
-- kayıtlarının `job_item_id` bağı o satırda durur, silinip yeniden açılsaydı
-- ikisi de kopardı. Kural `autoItemNos` ile aynı: çok kalemli işte numaralar
-- -01'den başlar.
update public.job_items i
set item_no = '0034-01'
from public.jobs j
where j.id = i.job_id and j.job_no = '0034' and i.item_no = '0034-00'
  and not exists (
    select 1 from public.job_items x where x.job_id = j.id and x.item_no = '0034-01'
  );

-- Atölye çizelgesindeki METİN de düzeltilir (`work_logs.item_no` asıldır,
-- bağlantı türevdir — İş Takibi md. 17).
update public.work_logs set item_no = '0034-01' where item_no = '0034-00';

-- ------------------------------------------------------------ iş kalemleri
-- İKİ AYRI CÜMLE: aynı cümlede hem INSERT hem UPDATE yapan bir CTE, iki alt
-- cümlenin AYNI anlık görüntüyü görmesi yüzünden okunması zor bir yapı olurdu.
-- `on commit drop` KULLANILMAZ: migration'ın açık bir işlem bloğunda koşup
-- koşmadığı çalıştırıcıya bağlıdır ve işlem bloğu YOKSA tablo daha ikinci
-- cümleye gelmeden düşerdi. Açık `drop` her iki durumda da doğrudur.
drop table if exists tmp_is_listesi_kalem;
create temporary table tmp_is_listesi_kalem (
  job_no text, item_no text, product_name text, quantity text, sort int
);
insert into tmp_is_listesi_kalem (job_no, item_no, product_name, quantity, sort) values
  ('0001', '0001-00', 'Emniyet Freni Konsol İmalatı (SHI 105FC)', '1 Adet', 0),
  ('0002', '0002-00', '100/50 t x 21,00 m Kapasiteli Dört Kirişli Köprülü Tavan Vinci (Cüruf Pota Tumba Tesisi)', '2 Adet', 0),
  ('0003', '0003-00', '1,5 t Kapasiteli Köprülü Tavan Vinci', '1 Adet', 0),
  ('0004', '0004-00', '30 t Kapasiteli Tekabül Arabası Mühendislik ve Tasarım Hizmeti', '1 Adet', 0),
  ('0005', '0005-01', '10 t x 21,70 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '1 Adet', 0),
  ('0005', '0005-02', '20 t x 21,70 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '1 Adet', 1),
  ('0005', '0005-03', 'Yürüme Yolu Montajı 140 m', '2 Adet', 2),
  ('0006', '0006-00', '10 t x 20,05 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '1 Adet', 0),
  ('0007', '0007-00', 'Emniyet Freni Konsol İmalatı (5732.00)', '1 Adet', 0),
  ('0008', '0008-00', '15 t x 8,51 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci Mühendislik ve Tasarım Hizmeti (SDM Vakum Tesisi)', '1 Adet', 0),
  ('0009', '0009-00', '10 t x 14,11 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '1 Adet', 0),
  ('0010', '0010-00', 'Lamel Kanca ve Semer İmalatı (100/35/10 t x 30,00 m Şarj Vinci)', '2 Adet', 0),
  ('0011', '0011-00', '185 t Kapasiteli Kaldırma Kirişi Analiz ve Detay Proje Hizmeti', '1 Adet', 0),
  ('0012', '0012-00', 'SDM-2 Tandiş Vinci-1 Revizyon Elektrik Odası İmalatı (Kardemir)', '1 Adet', 0),
  ('0013', '0013-00', 'Sıcak Haddehane A3 50/10 t Atölye Vinci Elektrik Odası İmalatı (Habaş)', '1 Adet', 0),
  ('0014', '0014-00', 'Tekerlek Ø500mm', '6 Adet', 0),
  ('0015', '0015-00', 'Pinyon Mil ve Fren Kasnağı', '2 Takım', 0),
  ('0016', '0016-00', 'Burç (0383.01.2800/7)', '4 Adet', 0),
  ('0017', '0017-00', '120 t Kapasiteli Kaldırma Kirişi', '1 Adet', 0),
  ('0018', '0018-00', '3 t Kapasiteli Monoray Vinç', '1 Adet', 0),
  ('0019', '0019-00', '185/40 t x 18,28 m Kapasiteli Dört Kirişli Köprülü Tavan Vinci Mühendislik ve Tasarım Hizmeti (Çelikhane Şarj Holü Tesisi)', '1 Adet', 0),
  ('0020', '0020-00', '185/40 t x 18,28 m Kapasiteli Dört Kirişli Köprülü Tavan Vinci (Çelikhane Şarj Holü Tesisi)', '1 Adet', 0),
  ('0021', '0021-01', '0,5 t Kapasiteli Pergel Vinç', '1 Adet', 0),
  ('0021', '0021-02', '1,0 t Kapasiteli Pergel Vinç', '1 Adet', 1),
  ('0021', '0021-03', '1,5 t Kapasiteli Pergel Vinç', '1 Adet', 2),
  ('0022', '0022-00', 'Sac Ø890x90mm S355J2+N', '3 Adet', 0),
  ('0023', '0023-01', '10 t Kapasiteli Kanca Bloğu', '1 Adet', 0),
  ('0023', '0023-02', '10 t Kapasiteli Üst Makara Bloğu', '1 Adet', 1),
  ('0024', '0024-00', 'RPH_Motor Koruma Kapakları', '13 Adet', 0),
  ('0025', '0025-00', '20 t x 30,00 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci (Kütük Holü-2)', '1 Adet', 0),
  ('0026', '0026-01', '100 t x 14,85 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '1 Adet', 0),
  ('0026', '0026-02', 'Yürüme Yolu 30 m', '1 Adet', 1),
  ('0027', '0027-00', '2 x 15 t x 23,50 m Kapasiteli Portal Vinç Mühendislik ve Tasarım Hizmeti', '1 Adet', 0),
  ('0029', '0029-00', 'Pergel Vinç Demontaj', '1 Adet', 0),
  ('0030', '0030-00', '0,5 t Kapasiteli Pergel Vinç Kumandası ve Servis Hizmeti (0021-01)', '1 Adet', 0),
  ('0031', '0031-00', 'Bakım ve Onarım Hizmeti', '', 0),
  ('0032', '0032-00', 'Boru Döndürme Aparatı', '1 Adet', 0),
  ('0033', '0033-00', '6 Butonlu Kablosuz Vinç Kumandası', '2 Adet', 0),
  ('0034', '0034-01', 'Çelik Panel İmalatı (06-3618)', '775 Takım', 0),
  ('0034', '0034-02', 'Çelik Panel İmalatı (06-4406)', '40 Takım', 1),
  ('0034', '0034-03', 'Çelik Panel İmalatı (06-4405)', '22 Takım', 2),
  ('0034', '0034-04', 'Çelik Panel İmalatı (5995-1710)', '4 Takım', 3),
  ('0034', '0034-05', 'Çelik Panel İmalatı (5995-1720)', '4 Takım', 4),
  ('0034', '0034-06', 'Çelik Panel İmalatı (5995-1730)', '4 Takım', 5),
  ('0034', '0034-07', 'Çelik Panel İmalatı (5995-1740)', '4 Takım', 6),
  ('0035', '0035-00', 'SDM-3 Kütük Vinçleri Elektrik ve Otomasyon Sistem Revizyonu', '2 Adet', 0),
  ('0036', '0036-00', 'Bakım ve Onarım Hizmeti', '1 Adet', 0),
  ('0037', '0037-00', '10 t Kapasiteli Monoray Vinç', '1 Adet', 0),
  ('0038', '0038-00', 'Kanca Bloğu Kaportası Ø240mm', '10 Adet', 0),
  ('0039', '0039-01', '35 t Kapasiteli Tambur', '1 Adet', 0),
  ('0039', '0039-02', '35 t Kapasiteli Kanca Bloğu', '1 Adet', 1),
  ('0040', '0040-00', 'Çelik Panel İmalatı (06-3618)', '13 Takım', 0),
  ('0041', '0041-00', '170/40/12,5 t Kapasiteli Pota Vinci Baş Kiriş İmalatı', '1 Adet', 0),
  ('0042', '0042-01', 'Emniyet Freni Konsol İmalatı (SHI 107)', '3 Adet', 0),
  ('0042', '0042-02', 'Emniyet Freni Diski BHV02-004-001', '1 Adet', 1),
  ('0042', '0042-03', 'Emniyet Freni Diski HV4-004-009', '2 Adet', 2),
  ('0043', '0043-00', '15 t x 24 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '1 Adet', 0),
  ('0044', '0044-00', 'Bilezik İmalatı', '60 Adet', 0),
  ('0045', '0045-01', '2x30 t x 29,5 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '1 Adet', 0),
  ('0045', '0045-02', '2x30 t x 29,5 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '1 Adet', 1),
  ('0046', '0046-01', 'Elektrik Odası İmalatı', '1 Adet', 0),
  ('0046', '0046-02', 'Araba Komple İmalatı', '1 Adet', 1),
  ('0047', '0047-00', 'Hurda Kovası İmalatı', '4 Adet', 0),
  ('0048', '0048-00', 'Yürüme Yolu Montajı 260 m', '260 Metre', 0),
  ('0049', '0049-00', 'Muhtelif Yedek Parça İmalatı (185/40 t Şarj Vinci)', '1 Takım', 0),
  ('0050', '0050-00', 'Muhtelif Yedek Parça İmalatı', '1 Takım', 0),
  ('0051', '0051-00', 'Operatör Kabini Yedek Parça Temini', '20 Adet', 0),
  ('0052', '0052-00', 'SD10 Vinci Operatör Kabini Yenilenmesi', '1 Adet', 0),
  ('0053', '0053-01', '40 t x 16,7 m Kapasiteli Portal Vinci', '1 Adet', 0),
  ('0053', '0053-02', 'Mekanik Spreader Beam', '1 Adet', 1),
  ('0054', '0054-00', '75 t Kapasiteli Kaldırma Kirişi', '1 Adet', 0),
  ('0055', '0055-00', 'İsdemir Amonyum Sülfat Tesisi 2M³ Kapasiteli Kepçeli Çift Kirişli Tavan Vinci', '1 Adet', 0),
  ('0056', '0056-00', '32 t Kapasiteli Döner Arabalı Portal Vinç Mühendislik ve Tasarım Hizmeti', '1 Adet', 0),
  ('0057', '0057-01', '1 t x 19,00 m Kapasiteli Tek Kirişli Köprülü Tavan Vinci', '3 Adet', 0),
  ('0057', '0057-02', 'Yürüme Yolu ve Bara Montajı 1 t x 19 m (Dikme Ayaklar Dahil)', '3 Adet', 1),
  ('0057', '0057-03', '1 t x 4,00 m Kapasiteli Tek Kirişli Köprülü Tavan Vinci', '3 Adet', 2),
  ('0057', '0057-04', 'Yürüme Yolu ve Bara Montajı 1 t x 18 m (Dikme Ayaklar Dahil)', '1 Adet', 3),
  ('0057', '0057-05', 'Yürüme Yolu ve Bara Montajı 1 t x 9 m (Dikme Ayaklar Dahil)', '1 Adet', 4),
  ('0057', '0057-06', '1,0 t Kapasiteli Pergel Vinç', '1 Adet', 5),
  ('0057', '0057-07', '5 t x 21,30 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '3 Adet', 6),
  ('0057', '0057-08', 'Yürüme Yolu ve Bara Montajı Hol Boyu 290 m (A55 Ray+Krapo+Sac Giydirme+Grout Beton+Conductix Bara)', '1 Adet', 7),
  ('0057', '0057-09', 'Yürüme Yolu ve Bara Montajı Hol Boyu 37,5 m (A55 Ray+Krapo+Sac Giydirme+Grout Beton+Conductix Bara)', '2 Adet', 8),
  ('0058', '0058-00', '1 t Kapasiteli C Kanca İmalatı CE Belgeli', '1 Adet', 0),
  ('0059', '0059-00', 'Tampon Karşılığı ve Rüzgar Emniyet Kilidi (0053-01 Portal Vinç)', '4 Takım', 0),
  ('0060', '0060-00', '10, 12, 15, 20, 30mm S235JR Kalite Saclar', '1 Set', 0),
  ('0061', '0061-00', 'Duvar Tipi Manuel Pergel Vinç Kolu 250 Kg Kapasiteli, 180° Dönebilir, 4,5m', '12 Adet', 0),
  ('0062', '0062-00', '170 Ton Lamelli Kanca İmalatı (Şarj Vinci)', '2 Adet', 0);

-- Eksik kalemler açılır…
insert into public.job_items (job_id, item_no, product_name, quantity, sort)
select j.id, s.item_no, s.product_name, s.quantity, s.sort
from tmp_is_listesi_kalem s
join public.jobs j on j.job_no = s.job_no
where not exists (
  select 1 from public.job_items i where i.job_id = j.id and i.item_no = s.item_no
);

-- …var olanların ADI ve SIRASI listedekiyle eşitlenir.
--
-- MİKTAR METNİ (`quantity`) EŞİTLENMEZ ve bu bilinçlidir: o alanı yalnız iş
-- emri formu basar ("2 Takım", "1+1", "90x2 180 m") ve basılmış bir formun
-- ifadesini listeye uydurmak için değiştirmek kazanç getirmez — Satış Takibi
-- de İş Listesi de miktarı ticari kayıttan okur. Yeni açılan kalemlerde alan
-- yukarıdaki INSERT ile listeden dolar, çünkü orada yazılı bir form yoktur.
update public.job_items i
set product_name = s.product_name,
    sort = s.sort
from tmp_is_listesi_kalem s
join public.jobs j on j.job_no = s.job_no
where i.job_id = j.id and i.item_no = s.item_no
  and (i.product_name is distinct from s.product_name or i.sort is distinct from s.sort);

drop table if exists tmp_is_listesi_kalem;

-- ------------------------------------------------------ sözleşme tarihleri
-- Satış Takibi satırın YILINI sözleşme tarihinden okur (`saleYear`) ve İş
-- Listesi PDF'i yıllara göre gruplar; tarih listedekiyle aynı olmalıdır.
with src (job_no, contract_date) as (values
  ('0001', '2024-02-14'),
  ('0002', '2024-03-11'),
  ('0003', '2024-03-20'),
  ('0004', '2024-03-25'),
  ('0005', '2024-04-29'),
  ('0006', '2024-04-29'),
  ('0007', '2024-05-13'),
  ('0008', '2024-07-26'),
  ('0009', '2024-07-31'),
  ('0010', '2024-08-23'),
  ('0011', '2024-10-18'),
  ('0012', '2024-10-14'),
  ('0013', '2024-10-24'),
  ('0014', '2024-12-05'),
  ('0015', '2024-12-05'),
  ('0016', '2024-12-05'),
  ('0017', '2024-12-17'),
  ('0018', '2025-01-09'),
  ('0019', '2025-01-22'),
  ('0020', '2025-04-17'),
  ('0021', '2025-01-30'),
  ('0022', '2025-02-13'),
  ('0023', '2025-03-17'),
  ('0024', '2025-03-18'),
  ('0025', '2025-04-02'),
  ('0026', '2025-04-17'),
  ('0027', '2025-04-17'),
  ('0029', '2025-06-23'),
  ('0030', '2025-07-05'),
  ('0031', '2025-07-05'),
  ('0032', '2025-08-06'),
  ('0033', '2025-08-15'),
  ('0034', '2025-08-25'),
  ('0035', '2025-09-03'),
  ('0036', '2025-09-15'),
  ('0037', '2025-09-19'),
  ('0038', '2025-09-30'),
  ('0039', '2025-10-22'),
  ('0040', '2025-11-13'),
  ('0041', '2025-11-28'),
  ('0042', '2025-12-08'),
  ('0043', '2025-12-11'),
  ('0044', '2025-12-16'),
  ('0045', '2025-12-23'),
  ('0046', '2025-12-30'),
  ('0047', '2026-01-02'),
  ('0048', '2026-01-27'),
  ('0049', '2026-01-30'),
  ('0050', '2026-02-10'),
  ('0051', '2026-02-13'),
  ('0052', '2026-02-19'),
  ('0053', '2026-03-06'),
  ('0054', '2026-03-16'),
  ('0055', '2026-05-11'),
  ('0056', '2026-05-15'),
  ('0057', '2026-06-17'),
  ('0058', '2026-07-06'),
  ('0059', '2026-07-02'),
  ('0060', '2026-07-09'),
  ('0061', '2026-07-13'),
  ('0062', '2026-07-31')
)
update public.jobs j
set contract_date = s.contract_date::date
from src s
where j.job_no = s.job_no
  and s.contract_date is not null
  and j.contract_date is distinct from s.contract_date::date;

-- ------------------------------------ 0020'nin atölye kayıtlarının bağlanması
-- 0020-00 numarası atölye çizelgesinde 792 satırla geçiyordu ama sistemde
-- karşılığı olan iş emri yoktu (devralınan aktarımın "eşleşmemiş" kaydı).
-- İş artık açıldığına göre bağ kurulur.
update public.work_logs w
set job_item_id = i.id, job_id = i.job_id
from public.job_items i
join public.jobs j on j.id = i.job_id
where i.item_no = w.item_no
  and w.job_item_id is null
  and j.job_no = left(w.item_no, 4);

-- --------------------------------------------------------- ticari kayıtlar
-- Kur alanı: 1 avro kaç birim para eder (TL ~33-53, dolar ~1,15, avro 1).
-- Toplamlar YAZILMAZ, tablo onları birim değerlerden türetir.
with actor as (
  select coalesce(
    (select p.id from public.profiles p join auth.users u on u.id = p.id
      where u.email = 'scolakoglu@orioncranes.com'),
    (select p.id from public.profiles p where p.role = 'admin' order by p.created_at limit 1)
  ) as id
),
src (item_no, scope, due_date, shipment_date, quantity, unit,
     unit_weight_kg, unit_price, currency, fx_rate, shipment_place) as (values
  ('0001-00', 'Komple İmalat', '2024-03-30', '2024-04-01', 1.0, 'Adet', 45.0, 1072.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0002-00', 'Hazır Ekipmanlar ve Elektrik Hariç.
Mühendislik, Tasarım, İmalat, Nakliye, Devreye Alma', '2025-02-04', '2025-01-06', 2.0, 'Adet', 184000.0, 787500.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0003-00', 'Köprü İmalatı.
Elektrik, Devreye Alma ve Araba Hariç', '2024-04-15', '2024-04-16', 1.0, 'Adet', 2010.0, 225000.0, 'TRY', 34.5096, 'TÜRKİYE'),
  ('0004-00', 'Mühendislik ve Tasarım Hizmeti', '2024-04-25', '2024-04-25', 1.0, 'Adet', null, null, 'EUR', 1.0, 'TÜRKİYE'),
  ('0005-01', 'Komple İmalat', '2024-06-28', '2024-07-14', 1.0, 'Adet', 15000.0, 38000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0005-02', 'Komple İmalat', '2024-06-28', '2024-07-13', 1.0, 'Adet', 18000.0, 62600.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0005-03', 'İşçilik', '2024-06-28', '2024-06-22', 2.0, 'Adet', null, 9700.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0006-00', 'Komple İmalat', null, null, 1.0, 'Adet', 11000.0, null, 'EUR', 1.0, 'TÜRKİYE'),
  ('0007-00', 'Komple İmalat', '2024-06-03', '2024-06-29', 1.0, 'Adet', 165.0, 1300.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0008-00', 'Mühendislik ve Tasarım Hizmeti', '2024-09-26', '2024-09-09', 1.0, 'Adet', null, 2750.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0009-00', 'Komple İmalat', '2024-09-25', '2024-09-28', 1.0, 'Adet', 9000.0, 53000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0010-00', 'Komple İmalat', '2024-10-18', '2024-10-30', 2.0, 'Adet', 1480.0, 4480.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0011-00', 'Hesap Raporu Analizi Hazırlanması', '2024-11-01', '2024-10-30', 1.0, 'Adet', null, 2000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0012-00', 'Komple İmalat', '2025-06-11', '2025-06-23', 1.0, 'Adet', 3646.0, 52000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0013-00', 'Komple İmalat', '2025-04-24', '2025-06-11', 1.0, 'Adet', 7744.0, 98750.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0014-00', 'Komple İmalat', '2025-01-19', '2025-01-20', 6.0, 'Adet', 186.0, 21000.0, 'TRY', 32.9403, 'TÜRKİYE'),
  ('0015-00', 'Komple İmalat', '2025-01-19', '2025-01-20', 2.0, 'Takım', 86.0, 360.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0016-00', 'Komple İmalat', '2025-01-05', '2025-01-05', 4.0, 'Adet', 20.0, 1500.0, 'TRY', 32.9403, 'TÜRKİYE'),
  ('0017-00', 'Komple İmalat', '2024-12-27', '2024-12-26', 1.0, 'Adet', 1735.0, 7000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0018-00', 'Komple İmalat', '2025-03-09', '2025-03-10', 1.0, 'Adet', 573.0, 5000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0019-00', 'Mühendislik ve Tasarım Hizmeti', '2025-03-22', '2025-07-22', 1.0, 'Adet', null, 39000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0020-00', 'Hazır Ekipmanlar ve Elektrik Hariç', '2026-02-20', '2026-01-12', 1.0, 'Adet', 250000.0, 1200000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0021-01', 'Komple İmalat', '2025-05-11', '2025-06-17', 1.0, 'Adet', 1860.0, 650000.0, 'TRY', 46.5778, 'TÜRKİYE'),
  ('0021-02', 'Komple İmalat', '2025-05-11', '2025-06-17', 1.0, 'Adet', 2010.0, 725000.0, 'TRY', 46.5778, 'TÜRKİYE'),
  ('0021-03', 'Komple İmalat', '2025-05-11', '2025-06-17', 1.0, 'Adet', 2378.0, 800000.0, 'TRY', 46.5778, 'TÜRKİYE'),
  ('0022-00', 'Malzeme Satışı', '2025-02-14', '2025-02-14', 3.0, 'Adet', 440.0, null, 'EUR', 1.0, ''),
  ('0023-01', 'Komple İmalat', '2025-05-17', '2025-05-26', 1.0, 'Adet', 435.0, 4500.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0023-02', 'Komple İmalat', '2025-05-17', '2025-05-26', 1.0, 'Adet', 20.0, 1100.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0024-00', 'Komple İmalat', '2025-04-18', '2025-04-08', 13.0, 'Adet', 27.0, 34.615385, 'EUR', 1.0, 'TÜRKİYE'),
  ('0025-00', 'Araba ve Elektrik Hariç', '2025-06-25', '2025-10-22', 1.0, 'Adet', 54650.0, 170000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0026-01', 'Komple İmalat', '2025-06-30', '2025-07-24', 1.0, 'Adet', 33000.0, 208000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0026-02', 'İşçilik', '2025-06-30', '2025-07-24', 1.0, 'Adet', 7000.0, 17000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0027-00', 'Mühendislik ve Tasarım Hizmeti', '2025-06-17', null, 1.0, 'Adet', null, null, 'EUR', 1.0, 'TÜRKİYE'),
  ('0029-00', 'İşçilik', '2025-06-25', '2025-06-24', 1.0, 'Adet', null, 12500.0, 'TRY', 45.608, 'TÜRKİYE'),
  ('0030-00', 'Malzeme Satışı', '2025-07-05', '2025-07-05', 1.0, 'Adet', null, null, 'EUR', 1.0, 'TÜRKİYE'),
  ('0031-00', 'İşçilik', null, null, null, 'Adet', null, null, 'EUR', 1.0, 'TÜRKİYE'),
  ('0032-00', 'Komple İmalat', null, null, 1.0, 'Adet', 935.0, null, 'EUR', 1.0, 'TÜRKİYE'),
  ('0033-00', 'Malzeme Satışı', '2025-08-22', '2025-08-22', 2.0, 'Adet', null, 345.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0034-01', 'Komple İmalat', '2025-10-10', '2025-11-06', 775.0, 'Takım', 28.9, 83.86, 'USD', 1.1514, 'TÜRKİYE'),
  ('0034-02', 'Komple İmalat', '2025-10-10', '2025-11-06', 40.0, 'Takım', 2.3, 7.0, 'USD', 1.1514, 'TÜRKİYE'),
  ('0034-03', 'Komple İmalat', '2025-10-10', '2025-11-06', 22.0, 'Takım', 28.9, 82.0, 'USD', 1.1514, 'TÜRKİYE'),
  ('0034-04', 'Komple İmalat', '2025-10-10', '2025-11-06', 4.0, 'Takım', 26.7, 78.0, 'USD', 1.1514, 'TÜRKİYE'),
  ('0034-05', 'Komple İmalat', '2025-10-10', '2025-11-06', 4.0, 'Takım', 26.7, 78.0, 'USD', 1.1514, 'TÜRKİYE'),
  ('0034-06', 'Komple İmalat', '2025-10-10', '2025-11-06', 4.0, 'Takım', 26.9, 78.0, 'USD', 1.1514, 'TÜRKİYE'),
  ('0034-07', 'Komple İmalat', '2025-10-10', '2025-11-06', 4.0, 'Takım', 26.9, 78.0, 'USD', 1.1514, 'TÜRKİYE'),
  ('0035-00', 'Komple İmalat', '2026-02-03', '2026-05-22', 2.0, 'Adet', 7000.0, 237500.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0036-00', 'İşçilik', '2025-09-17', '2025-09-16', 1.0, 'Adet', null, 10000.0, 'TRY', 48.5313, 'TÜRKİYE'),
  ('0037-00', 'Komple İmalat', '2025-12-19', '2026-04-24', 1.0, 'Adet', 2516.0, 30000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0038-00', 'Komple İmalat', '2025-10-30', '2025-11-04', 10.0, 'Adet', 0.8, 6800.0, 'TRY', 48.4335, 'TÜRKİYE'),
  ('0039-01', 'Komple İmalat', '2025-12-10', '2026-01-02', 1.0, 'Adet', 751.0, 5000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0039-02', 'Komple İmalat', '2025-12-10', '2026-01-02', 1.0, 'Adet', 441.0, 6000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0040-00', 'Komple İmalat', '2025-12-13', '2025-11-20', 13.0, 'Takım', 28.92, 83.86, 'USD', 1.1579, 'TÜRKİYE'),
  ('0041-00', 'Komple İmalat', '2026-02-11', '2026-02-02', 1.0, 'Adet', 2901.0, 5900.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0042-01', 'Komple İmalat', '2025-12-31', '2026-01-13', 3.0, 'Adet', 74.33, 910.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0042-02', 'Komple İmalat', '2025-12-31', '2026-01-13', 1.0, 'Adet', 131.0, 1010.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0042-03', 'Komple İmalat', '2025-12-31', '2026-01-13', 2.0, 'Adet', 248.0, 1010.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0043-00', 'Komple İmalat', '2026-03-30', '2026-06-19', 1.0, 'Adet', 10100.0, 2000000.0, 'TRY', 53.1051, 'TÜRKİYE'),
  ('0044-00', 'Komple İmalat', '2026-02-16', '2026-02-02', 60.0, 'Adet', 0.1, 1.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0045-01', 'Ana Kiriş, Platform Hariç', '2026-04-23', '2026-07-07', 1.0, 'Adet', 13075.0, 148000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0045-02', 'Ana Kiriş, Platform Hariç', '2026-04-23', '2026-07-07', 1.0, 'Adet', 13075.0, 148000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0046-01', 'Komple İmalat', '2026-02-07', '2026-02-16', 1.0, 'Adet', 1410.0, 6000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0046-02', 'Teknolojik Ekipmanlar Hariç', '2026-02-07', '2026-02-16', 1.0, 'Adet', 2480.0, 15250.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0047-00', 'Komple İmalat', '2026-03-02', '2026-02-17', 4.0, 'Adet', 1026.25, 945.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0048-00', 'Komple İmalat', '2026-03-15', '2026-04-08', 260.0, 'Metre', 64.27, 150.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0049-00', 'Komple İmalat', '2026-03-30', '2026-04-13', 1.0, 'Takım', 335.0, 62999.0, 'TRY', 52.0744, 'TÜRKİYE'),
  ('0050-00', 'Komple İmalat', '2026-04-10', '2026-04-13', 1.0, 'Takım', 46.0, 242.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0051-00', '', '2026-03-13', '2026-02-23', 20.0, 'Adet', 0.15, 20.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0052-00', 'Komple İmalat', '2026-07-19', null, 1.0, 'Adet', 4000.0, 97500.0, 'USD', 1.1836, 'TÜRKİYE'),
  ('0053-01', 'Komple İmalat', '2026-05-30', '2026-06-22', 1.0, 'Adet', 37000.0, 115000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0053-02', 'Komple İmalat', '2026-05-30', '2026-06-22', 1.0, 'Adet', 1968.0, 10000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0054-00', 'Komple İmalat', '2026-04-16', '2026-04-16', 1.0, 'Adet', 3845.0, 9000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0055-00', 'Komple İmalat', '2027-03-01', null, 1.0, 'Adet', 20000.0, 547500.0, 'USD', 1.17, 'TÜRKİYE'),
  ('0056-00', 'Mühendislik ve Tasarım Hizmeti', '2026-05-20', '2026-05-22', 1.0, 'Adet', null, 1100.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0057-01', 'Komple İmalat', '2026-08-17', null, 3.0, 'Adet', 3333.333333, 24000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0057-02', 'Komple İmalat', '2026-08-17', null, 3.0, 'Adet', null, 6500.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0057-03', 'Komple İmalat', '2026-08-17', null, 3.0, 'Adet', null, 14000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0057-04', 'Komple İmalat', '2026-08-17', null, 1.0, 'Adet', null, 4500.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0057-05', 'Komple İmalat', '2026-08-17', null, 1.0, 'Adet', null, 3000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0057-06', 'Komple İmalat', '2026-08-17', null, 1.0, 'Adet', 2180.0, 17000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0057-07', 'Komple İmalat', '2026-08-17', null, 3.0, 'Adet', null, 36000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0057-08', 'Komple İmalat', '2026-08-17', null, 1.0, 'Adet', 53000.0, 94000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0057-09', 'Komple İmalat', '2026-08-17', null, 2.0, 'Adet', 6850.0, 10000.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0058-00', 'Komple İmalat', '2026-07-29', '2026-07-23', 1.0, 'Adet', 60.0, 350.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0059-00', 'Komple İmalat', '2026-07-10', '2026-07-08', 4.0, 'Takım', 115.0, 625.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0060-00', '', '2026-07-20', '2026-07-17', 1.0, 'Set', 69395.0, 51814.25, 'USD', 1.15, 'TÜRKİYE'),
  ('0061-00', 'Komple İmalat', '2026-08-17', null, 12.0, 'Adet', 115.0, 1200.0, 'EUR', 1.0, 'TÜRKİYE'),
  ('0062-00', 'Komple İmalat', '2026-10-15', null, 2.0, 'Adet', 1970.0, 6300.0, 'EUR', 1.0, 'TÜRKİYE')
),
-- Kaynak AYRI BİR CTE'dedir: `cross join … on conflict` dizilimi ayrıştırıcı
-- için ikircikli okunur (`ON` bir birleştirme koşulu sanılabilir). Birleşim
-- CTE'ye alınınca `on conflict` düz bir `from` sonrasına düşer.
kaynak as (
  select
    i.id as job_item_id, s.scope, s.due_date::date as due_date,
    s.shipment_date::date as shipment_date, s.quantity, s.unit,
    s.unit_weight_kg, s.unit_price, s.currency, s.fx_rate, s.shipment_place,
    a.id as updated_by
  from src s
  join public.job_items i on i.item_no = s.item_no
  cross join actor a
)
insert into public.job_item_sales (
  job_item_id, scope, due_date, shipment_date, quantity, unit,
  unit_weight_kg, unit_price, currency, fx_rate, shipment_place, updated_by
)
select
  job_item_id, scope, due_date, shipment_date, quantity, unit,
  unit_weight_kg, unit_price, currency, fx_rate, shipment_place, updated_by
from kaynak
on conflict (job_item_id) do update set
  scope = excluded.scope,
  due_date = excluded.due_date,
  shipment_date = excluded.shipment_date,
  quantity = excluded.quantity,
  unit = excluded.unit,
  unit_weight_kg = excluded.unit_weight_kg,
  unit_price = excluded.unit_price,
  currency = excluded.currency,
  fx_rate = excluded.fx_rate,
  shipment_place = excluded.shipment_place,
  updated_by = excluded.updated_by;

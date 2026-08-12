-- İŞ LİSTESİ DÜZELTMELERİ — 12.08.2026 (kullanıcı kararları).
--
-- 1. **0028 iş listesine uyar.** Kalem numarası iki belgede farklı işi
--    gösteriyordu: iş emri "ASTOR A.Ş. · 30 t x 21,7 m", güncel iş listesi
--    "ORION CRANES · 10 t x 20,05 m". İki aktarımda da bilerek atlanmıştı.
--    Karar (12.08.2026): **liste asıldır** — iş emri büyük olasılıkla iptal
--    edilmiş. Kayıt listedeki işe çevrilir; iş emrinin müşteri künyesi de
--    ORION'a taşınır, yoksa satır ASTOR'un unvanıyla ORION'un vincini
--    gösterirdi.
--
-- 2. **Ad alanları BÜYÜK HARF.** Firma kuralı (`adBuyuk`, lib/tr-text.ts) iş
--    adı, ürün adı ve müşteri adını büyük harfle saklar; kural form üzerinden
--    yazmada zaten işliyordu ama DEVRALINAN ve İÇE AKTARILAN satırlara hiç
--    uygulanmamıştı. Aynı ad iki yazımla durduğu sürece listeler yanlış
--    sıralanır ve dosya adı (zaten BÜYÜK basar) ekranla ayrışır.
--
--    Dönüşüm SQL'de YAPILMAZ: Postgres'in `upper()`'ı Türkçe farkında
--    değildir ("İSDEMİR" → "ISDEMIR"). Değerler `adBuyuk` ile hesaplanıp tek
--    tek yazılmıştır — ne yazıldığı migration okununca görünür.
--
-- Migration TEKRAR ÇALIŞTIRILABİLİR.

-- ------------------------------------------------------------------- 1. 0028
update public.jobs j set
  title = '10 T X 20,05 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ',
  customer = c.name,
  customer_id = c.id,
  customer_address = c.address,
  customer_tax_office = c.tax_office,
  customer_tax_no = c.tax_no,
  customer_phone = c.phone,
  customer_fax = c.fax,
  contract_date = '2025-05-09'::date,
  work_order_date = '2025-05-09'::date,
  workshop_exit_date = null::date,
  delivery_date = null::date
from public.customers c
where j.job_no = '0028'
  and lower(btrim(c.name)) = lower(btrim('ORiON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.'));

update public.job_items set product_name = '10 T X 20,05 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ' where item_no = '0028-00';

-- Ticari kayıt: listede fiyat yok, ağırlık var.
insert into public.job_item_sales (
  job_item_id, scope, due_date, shipment_date, quantity, unit,
  unit_weight_kg, unit_price, currency, fx_rate, shipment_place
)
select i.id, 'Komple İmalat', null::date, null::date,
       1.0, 'Adet', 11000.0, null, 'EUR', 1, 'TÜRKİYE'
from public.job_items i
where i.item_no = '0028-00'
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
  shipment_place = excluded.shipment_place;

-- ----------------------------------------------------- 2. büyük harf geçişi
-- Müşteri defteri. Ad ÜNİK'tir (lower(btrim(name))) ve yalnız harf kipi
-- değiştiği için çakışma doğmaz.
update public.customers c set name = v.yeni, short_name = v.kisa
from (values
  ('ORiON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.', 'ORİON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.', 'ORION')
) as v(eski, yeni, kisa)
where c.name = v.eski;

-- İş emrindeki müşteri METNİ defterin FOTOĞRAFIDIR; defter büyütülünce o da
-- büyütülür, yoksa iki alan ayrışırdı.
update public.jobs j set customer = v.yeni
from (values
  ('ORiON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.', 'ORİON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.')
) as v(eski, yeni)
where j.customer = v.eski;

update public.jobs j set title = v.title, customer = v.musteri
from (values
  ('0005', '10 T X 21 M KAPASİTELİ +  20 T X 22 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ + VİNÇ YÜRÜME YOLU MONTAJI', 'ASTOR A.Ş.'),
  ('0006', '10 T X 20,5 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', 'ORİON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.'),
  ('0009', '10 T X 14 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', 'ASTOR A.Ş.'),
  ('0020', '185/40 T X 18,28 M KAPASİTELİ DÖRT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ (ÇELİKHANE ŞARJ HOLÜ TESİSİ)', 'KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.'),
  ('0026', '100 T X 15,50 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ + YÜRÜME YOLU HOL BOYU 30 M', 'ASTOR A.Ş.'),
  ('0032', 'BORU DÖNDÜRME APARATI', 'ORİON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.'),
  ('0042', 'EMNİYET FRENİ KONSOL VE FREN DİSKLERİ İMALATI', 'Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.TİC.LTD.ŞTİ'),
  ('0043', '15 T X 24 M KÖPRÜLÜ TAVAN VİNCİ', 'MTC PASLANMAZ'),
  ('0044', 'BİLEZİK İMALATI', 'KARDEMİR A.Ş.'),
  ('0045', '2X30 T X 29,5 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', 'HABAŞ'),
  ('0046', 'ELEKTRİK ODASI İMALATI VE ARABA KOMPLE İMALATI', 'ORHUN MAKİNA'),
  ('0047', 'HURDA KOVASI İMALATI', 'KARDEMİR A.Ş.'),
  ('0048', 'YÜRÜME YOLU MONTAJI', 'LITEC MAKİNA SAN. VE TİC. A.Ş.'),
  ('0049', 'MUHTELİF YEDEK PARÇA İMALATI (185/40 T ŞARJ VİNCİ)', 'KARDEMİR A.Ş.'),
  ('0050', 'MUHTELİF YEDEK PARÇA İMALATI', 'KARDEMİR A.Ş.'),
  ('0051', 'OPERATÖR KABİNİ YEDEK PARÇA İMALATI', 'EREĞLİ DEMİR ÇELİK FABRİKALARI T.A.Ş.'),
  ('0052', 'SD10 VİNCİ OPERATÖR KABİNİ YENİLENMESİ', 'İSKENDERUN DEMİR VE ÇELİK A.Ş.'),
  ('0054', '75 T KAPASİTELİ KALDIRMA KİRİŞİ', 'LITEC MAKİNA SAN. VE TİC. A.Ş.'),
  ('0055', 'İSDEMİR AMONYUM SÜLFAT TESİSİ 2M³ KAPASİTELİ KEPÇELİ ÇİFT KİRİŞLİ TAVAN VİNCİ', 'İSKENDERUN DEMİR VE ÇELİK A.Ş.'),
  ('0056', '32 T KAPASİTELİ DÖNER ARABALI PORTAL VİNÇ MÜHENDİSLİK VE TASARIM HİZMETİ', 'KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.'),
  ('0057', 'MUHTELİF VİNÇLER', 'ASTOR A.Ş.'),
  ('0058', '1 T KAPASİTELİ C KANCA İMALATI CE BELGELİ', 'TOSÇELİK PROFİL'),
  ('0059', 'TAMPON KARŞILIĞI VE RÜZGAR EMNİYET KİLİDİ (0053-01 PORTAL VİNÇ)', 'LITEC MAKİNA SAN. VE TİC. A.Ş.'),
  ('0060', '10, 12, 15, 20, 30MM S235JR KALİTE SACLAR', 'SMT GRUP'),
  ('0061', 'DUVAR TİPİ MANUEL PERGEL VİNÇ KOLU 250 KG KAPASİTELİ, 180° DÖNEBİLİR, 4,5M', 'ASTOR A.Ş.'),
  ('0062', '170 TON LAMELLİ KANCA İMALATI (ŞARJ VİNCİ)', 'İZMİR DEMİR ÇELİK SANAYİ A.Ş.')
) as v(job_no, title, musteri)
where j.job_no = v.job_no;

update public.job_items i set product_name = v.ad
from (values
  ('0001-00', 'EMNİYET FRENİ KONSOL İMALATI (SHI 105FC)'),
  ('0002-00', '100/50 T X 21,00 M KAPASİTELİ DÖRT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ (CÜRUF POTA TUMBA TESİSİ)'),
  ('0003-00', '1,5 T KAPASİTELİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0004-00', '30 T KAPASİTELİ TEKABÜL ARABASI MÜHENDİSLİK VE TASARIM HİZMETİ'),
  ('0005-01', '10 T X 21,70 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0005-02', '20 T X 21,70 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0005-03', 'YÜRÜME YOLU MONTAJI 140 M'),
  ('0006-00', '10 T X 20,05 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0007-00', 'EMNİYET FRENİ KONSOL İMALATI (5732.00)'),
  ('0008-00', '15 T X 8,51 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ MÜHENDİSLİK VE TASARIM HİZMETİ (SDM VAKUM TESİSİ)'),
  ('0009-00', '10 T X 14,11 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0010-00', 'LAMEL KANCA VE SEMER İMALATI (100/35/10 T X 30,00 M ŞARJ VİNCİ)'),
  ('0011-00', '185 T KAPASİTELİ KALDIRMA KİRİŞİ ANALİZ VE DETAY PROJE HİZMETİ'),
  ('0012-00', 'SDM-2 TANDİŞ VİNCİ-1 REVİZYON ELEKTRİK ODASI İMALATI (KARDEMİR)'),
  ('0013-00', 'SICAK HADDEHANE A3 50/10 T ATÖLYE VİNCİ ELEKTRİK ODASI İMALATI (HABAŞ)'),
  ('0014-00', 'TEKERLEK Ø500MM'),
  ('0015-00', 'PİNYON MİL VE FREN KASNAĞI'),
  ('0016-00', 'BURÇ (0383.01.2800/7)'),
  ('0017-00', '120 T KAPASİTELİ KALDIRMA KİRİŞİ'),
  ('0018-00', '3 T KAPASİTELİ MONORAY VİNÇ'),
  ('0019-00', '185/40 T X 18,28 M KAPASİTELİ DÖRT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ MÜHENDİSLİK VE TASARIM HİZMETİ (ÇELİKHANE ŞARJ HOLÜ TESİSİ)'),
  ('0020-00', '185/40 T X 18,28 M KAPASİTELİ DÖRT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ (ÇELİKHANE ŞARJ HOLÜ TESİSİ)'),
  ('0021-01', '0,5 T KAPASİTELİ PERGEL VİNÇ'),
  ('0021-02', '1,0 T KAPASİTELİ PERGEL VİNÇ'),
  ('0021-03', '1,5 T KAPASİTELİ PERGEL VİNÇ'),
  ('0022-00', 'SAC Ø890X90MM S355J2+N'),
  ('0023-01', '10 T KAPASİTELİ KANCA BLOĞU'),
  ('0023-02', '10 T KAPASİTELİ ÜST MAKARA BLOĞU'),
  ('0024-00', 'RPH_MOTOR KORUMA KAPAKLARI'),
  ('0025-00', '20 T X 30,00 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ (KÜTÜK HOLÜ-2)'),
  ('0026-01', '100 T X 14,85 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0026-02', 'YÜRÜME YOLU 30 M'),
  ('0027-00', '2 X 15 T X 23,50 M KAPASİTELİ PORTAL VİNÇ MÜHENDİSLİK VE TASARIM HİZMETİ'),
  ('0029-00', 'PERGEL VİNÇ DEMONTAJ'),
  ('0030-00', '0,5 T KAPASİTELİ PERGEL VİNÇ KUMANDASI VE SERVİS HİZMETİ (0021-01)'),
  ('0031-00', 'BAKIM VE ONARIM HİZMETİ'),
  ('0032-00', 'BORU DÖNDÜRME APARATI'),
  ('0033-00', '6 BUTONLU KABLOSUZ VİNÇ KUMANDASI'),
  ('0034-01', 'ÇELİK PANEL İMALATI (06-3618)'),
  ('0034-02', 'ÇELİK PANEL İMALATI (06-4406)'),
  ('0034-03', 'ÇELİK PANEL İMALATI (06-4405)'),
  ('0034-04', 'ÇELİK PANEL İMALATI (5995-1710)'),
  ('0034-05', 'ÇELİK PANEL İMALATI (5995-1720)'),
  ('0034-06', 'ÇELİK PANEL İMALATI (5995-1730)'),
  ('0034-07', 'ÇELİK PANEL İMALATI (5995-1740)'),
  ('0035-00', 'SDM-3 KÜTÜK VİNÇLERİ ELEKTRİK VE OTOMASYON SİSTEM REVİZYONU'),
  ('0036-00', 'BAKIM VE ONARIM HİZMETİ'),
  ('0037-00', '10 T KAPASİTELİ MONORAY VİNÇ'),
  ('0038-00', 'KANCA BLOĞU KAPORTASI Ø240MM'),
  ('0039-01', '35 T KAPASİTELİ TAMBUR'),
  ('0039-02', '35 T KAPASİTELİ KANCA BLOĞU'),
  ('0040-00', 'ÇELİK PANEL İMALATI (06-3618)'),
  ('0041-00', '170/40/12,5 T KAPASİTELİ POTA VİNCİ BAŞ KİRİŞ İMALATI'),
  ('0042-01', 'EMNİYET FRENİ KONSOL İMALATI (SHI 107)'),
  ('0042-02', 'EMNİYET FRENİ DİSKİ BHV02-004-001'),
  ('0042-03', 'EMNİYET FRENİ DİSKİ HV4-004-009'),
  ('0043-00', '15 T X 24 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0044-00', 'BİLEZİK İMALATI'),
  ('0045-01', '2X30 T X 29,5 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0045-02', '2X30 T X 29,5 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0046-01', 'ELEKTRİK ODASI İMALATI'),
  ('0046-02', 'ARABA KOMPLE İMALATI'),
  ('0047-00', 'HURDA KOVASI İMALATI'),
  ('0048-00', 'YÜRÜME YOLU MONTAJI 260 M'),
  ('0049-00', 'MUHTELİF YEDEK PARÇA İMALATI (185/40 T ŞARJ VİNCİ)'),
  ('0050-00', 'MUHTELİF YEDEK PARÇA İMALATI'),
  ('0051-00', 'OPERATÖR KABİNİ YEDEK PARÇA TEMİNİ'),
  ('0052-00', 'SD10 VİNCİ OPERATÖR KABİNİ YENİLENMESİ'),
  ('0053-01', '40 T X 16,7 M KAPASİTELİ PORTAL VİNCİ'),
  ('0053-02', 'MEKANİK SPREADER BEAM'),
  ('0054-00', '75 T KAPASİTELİ KALDIRMA KİRİŞİ'),
  ('0055-00', 'İSDEMİR AMONYUM SÜLFAT TESİSİ 2M³ KAPASİTELİ KEPÇELİ ÇİFT KİRİŞLİ TAVAN VİNCİ'),
  ('0056-00', '32 T KAPASİTELİ DÖNER ARABALI PORTAL VİNÇ MÜHENDİSLİK VE TASARIM HİZMETİ'),
  ('0057-01', '1 T X 19,00 M KAPASİTELİ TEK KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0057-02', 'YÜRÜME YOLU VE BARA MONTAJI 1 T X 19 M (DİKME AYAKLAR DAHİL)'),
  ('0057-03', '1 T X 4,00 M KAPASİTELİ TEK KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0057-04', 'YÜRÜME YOLU VE BARA MONTAJI 1 T X 18 M (DİKME AYAKLAR DAHİL)'),
  ('0057-05', 'YÜRÜME YOLU VE BARA MONTAJI 1 T X 9 M (DİKME AYAKLAR DAHİL)'),
  ('0057-06', '1,0 T KAPASİTELİ PERGEL VİNÇ'),
  ('0057-07', '5 T X 21,30 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ'),
  ('0057-08', 'YÜRÜME YOLU VE BARA MONTAJI HOL BOYU 290 M (A55 RAY+KRAPO+SAC GİYDİRME+GROUT BETON+CONDUCTİX BARA)'),
  ('0057-09', 'YÜRÜME YOLU VE BARA MONTAJI HOL BOYU 37,5 M (A55 RAY+KRAPO+SAC GİYDİRME+GROUT BETON+CONDUCTİX BARA)'),
  ('0058-00', '1 T KAPASİTELİ C KANCA İMALATI CE BELGELİ'),
  ('0059-00', 'TAMPON KARŞILIĞI VE RÜZGAR EMNİYET KİLİDİ (0053-01 PORTAL VİNÇ)'),
  ('0060-00', '10, 12, 15, 20, 30MM S235JR KALİTE SACLAR'),
  ('0061-00', 'DUVAR TİPİ MANUEL PERGEL VİNÇ KOLU 250 KG KAPASİTELİ, 180° DÖNEBİLİR, 4,5M'),
  ('0062-00', '170 TON LAMELLİ KANCA İMALATI (ŞARJ VİNCİ)')
) as v(item_no, ad)
where i.item_no = v.item_no;

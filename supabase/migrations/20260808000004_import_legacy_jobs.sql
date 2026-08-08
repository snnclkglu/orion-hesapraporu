-- Eski iş emirlerinin (İŞ EMİRLERİ/*.pdf, 2024-02 … 2026-06) sisteme
-- aktarımı: müşteri defteri + iş emirleri + iş kalemleri.
--
-- Kaynak 55 basılı iş emri PDF'idir; alanlar formun kendi tablolarından
-- (İŞİN ADI · MÜŞTERİ BİLGİLERİ · İŞ BİLGİLERİ · KAPSAM) okunmuştur.
-- Kapsam onay kutuları basılı formdaki dolgu rengiyle çözülmüştür.
--
-- İŞ NO / KALEM NO: formun "İŞ NUMARASI" sütunu KALEM numarasıdır
-- (0057-01…0057-08). İş no bunun KÖKÜdür (0057) — `autoItemNos` kuralı.
--
-- İş durumu teslim (yoksa atölye çıkış) tarihine göre verilir: geçmişte
-- kalan iş `completed`, ileri tarihli iş `active`.
--
-- Migration TEKRAR ÇALIŞTIRILABİLİR: var olan iş no, müşteri adı ve kalem
-- numarası atlanır — elle girilmiş 0055 no'lu iş (hesap raporuna bağlı)
-- ve 0065 no'lu iş bu sayede korunur.

-- ---------------------------------------------------------------- müşteriler
-- Defterdeki kısa "ASTOR" kaydı iş emirlerindeki tam unvana taşınır; yeni
-- kayıt açılsaydı müşteri filtresi ikiye bölünür ve mevcut 0065 no'lu iş
-- eski kayda asılı kalırdı.
update public.customers set
  name = 'ASTOR A.Ş.',
  address = case when address = '' then 'ASO 2. Ve 3. OSB Alcı Mahallesi 2001 Cadde No:3 Sincan/ANKARA' else address end,
  tax_office = case when tax_office = '' then '' else tax_office end,
  tax_no = case when tax_no = '' then '' else tax_no end,
  phone = case when phone = '' then '+90 312 267 01 56' else phone end,
  fax = case when fax = '' then '+90 312 267 00 34' else fax end
where lower(btrim(name)) = lower(btrim('ASTOR'))
  and not exists (
    select 1 from public.customers x where lower(btrim(x.name)) = lower(btrim('ASTOR A.Ş.'))
  );

with actor as (
  select coalesce(
    (select p.id from public.profiles p join auth.users u on u.id = p.id
      where u.email = 'scolakoglu@orioncranes.com'),
    (select p.id from public.profiles p where p.role = 'admin' order by p.created_at limit 1)
  ) as id
),
src (name, address, tax_office, tax_no, phone, fax) as (values
  ('ASTOR A.Ş.', 'ASO 2. Ve 3. OSB Alcı Mahallesi 2001 Cadde No:3 Sincan/ANKARA', '', '', '+90 312 267 01 56', '+90 312 267 00 34'),
  ('EREĞLİ DEMİR ÇELİK FABRİKALARI T.A.Ş.', 'Uzunkum Cad. No : 7 67330 Kdz. Ereğli/Zonguldak', 'Kdz.Ereğli VD.', '3520006426', '', ''),
  ('GALVASUN GALVANİZ SAN.TİC.İTH.İHR.LTD.ŞTİ.', 'Başkent OSB. 19.Cadde No:29 06909 Malıköy- Temelli-Sincan/ANKARA', 'SİNCAN', '3880740323', '+90 312 277 33 48', '+90 312 277 33 68'),
  ('HABAŞ', 'Soğanlık Yeni Fuat Paşa Sokak No:1 34880 Kartal/İstanbul', '', '', '', ''),
  ('İNFEED OTOMASYON ELEKTRİK ELEKTRONİK SAN.VE TİC.LTD.ŞTİ.', 'İvedikköy Mah. Anadolu Bulvarı Corner-1 145J 06378', 'İVEDİK', '4781 1689 72', '0 (546) 474 69 45', '+90'),
  ('İSKENDERUN DEMİR VE ÇELİK A.Ş.', 'Karşı Mahalle Şehit Yüzbaşı Ali Oğuz Bulvarı No:1 PK 31900 Payas/Hatay', 'HATAY - Akdeniz Vergi Dairesi Müdürlüğü', '8790009670', '', ''),
  ('İZMİR DEMİR ÇELİK SANAYİ A.Ş.', 'Foça Çelik Fabrikası: Nemrut Cad. No:2 Horozgediği Mah. Aliağa/İzmir', 'KONAK VD.', '4840008672', '0 232 441 50 50', '0 232 441 56 66'),
  ('KARDEMİR A.Ş.', 'Fabrika Sahası, 78170 Merkez/Karabük', 'Karabük VD.', '5050055358', '', ''),
  ('KARDEMİR ÇELİK SANAYİ A.Ş. (ÇELİKHANE)', 'Bozköy Mah. 2.Cd. No: 24 35800 ALİAĞA /İZMİR (ÇELİKHANE)', 'PAMUKKALE', '523 094 9312', '+90 232 625 22 22', '+90'),
  ('KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.', 'Kardemir Sahası içi Karçel Binası 78170 Karabük / Türkiye', 'KARABÜK', '5230126315', '+90 370 418 22 38', '+90 370 412 04 99'),
  ('LITEC MAKİNA SAN. VE TİC. A.Ş.', 'The Paragon, B Blok, Kat 23 No.113, Kızılırmak Mh. 1445 Sk. No:2/1 Çukurambar, Çankaya/Ankara', '', '', '', ''),
  ('MAKİNE VE KİMYA ENDÜSTRİSİ ANONİM ŞİRKETİ', 'A.O.Ç. Bahçekapı Mah. Güvercinlik Cad.No:2 06797 No:2 Etimesgut Türkiye', 'ANKARA KURUMLAR', '6111520767', '+90 312 211 01 62', '+90 312 211 00 42'),
  ('MTC PASLANMAZ', '', '', '', '', ''),
  ('ORHUN MAKİNA', 'Deri OSB 6.Yol 1-6 Parsel Tuzla/İstanbul', '', '', '', ''),
  ('ORiON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.', 'Başkent OSB. 1.Cadde No:20 06909 Malıköy- Temelli-Sincan/ANKARA', 'SİNCAN', '6470773204', '+90 312 511 48 06', ''),
  ('PİMSUN', 'Başkent OSB 26. Cadde No:11 06909 Malıköy- Temelli-Sincan/ANKARA', '', '', '+90 0312 397 70 72', '+90 0312 397 26 94'),
  ('PLASTIC MASTER PLASTİK SANAYİ VE TİC.LTD.ŞTİ.', 'Ramazanoğlu Mahallesi Karşıgeçit Sokak No:5 İç Kapı:3 Pendik/İSTANBUL', 'PENDİK', '7300853737', '', ''),
  ('SAKA DEMİR ÇELİK SANAYİ VE TİCARET A.Ş.', 'Kurtuluş Mahallesi, Sanati Bölgesi No: 9 KARABÜK/MERKEZ', '', '', '+90 370 413 02 33', '+90'),
  ('Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.TİC.LTD.ŞTİ', 'Kartaltepe Mahallesi Ahu Sokak Çınar Apt. B Blok No: 1/6 34145 Bakırköy/İSTANBUL', 'GÜNEŞLİ', '7700068218', '+90 212 213 92 92', ''),
  ('YALCO DIŞ TİCARET VE MÜMESSİLLİK LTD. ŞTİ.', 'Başkent O.S.B R.T.E. Bulvarı No: 20 06909 Malıköy/Sincan-ANKARA', 'SİNCAN', '9290037628', '+90 312 447 32 96', '+90 312 447 32 99'),
  ('YILMAZLAR TEMELLİ VİNÇ HİZM. TİC. LTD. ŞTİ.', '', '', '', '', '')
)
insert into public.customers (name, address, tax_office, tax_no, phone, fax, created_by)
select s.name, s.address, s.tax_office, s.tax_no, s.phone, s.fax, a.id
from src s cross join actor a
where not exists (
  select 1 from public.customers c where lower(btrim(c.name)) = lower(btrim(s.name))
);

-- -------------------------------------------------------------- iş emirleri
with actor as (
  select coalesce(
    (select p.id from public.profiles p join auth.users u on u.id = p.id
      where u.email = 'scolakoglu@orioncranes.com'),
    (select p.id from public.profiles p where p.role = 'admin' order by p.created_at limit 1)
  ) as id
),
src (job_no, title, customer, work_order_date, form_code, address, tax_office,
     tax_no, phone, fax, contract_date, workshop_exit_date, delivery_date,
     quantity_text, job_leader, prepared_by_name, prepared_by_title, scope,
     notes, status) as (values
  ('0001', 'SHI 105FC KONSOL İMALATI', 'Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.TİC.LTD.ŞTİ', '2024-02-14', 'FR.11.02', 'Kartaltepe Mahallesi Ahu Sokak Çınar Apt. B Blok No: 1/6 34145 Bakırköy/İSTANBUL', 'GÜNEŞLİ', '7700068218', '+90 212 213 92 92', '', '2024-02-14', '2024-03-30', '2024-04-01', '1 Takım', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş No :', 'completed'),
  ('0002', 'CÜRUF POTA TUMBA TESİSİ 100/50 TON KÖPRÜLÜ VİNÇ', 'KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.', '2024-03-11', 'FR.11.02', 'Kardemir Sahası içi Karçel Binası 78170 Karabük / Türkiye', 'KARABÜK', '5230126315', '+90 370 418 22 38', '+90 370 412 04 99', '2024-03-11', '2024-11-20', null, '2 Takım', 'Sinan ÇOLAKOĞLU & Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Hazır Komponentler Hariç
(Motor, Redüktör, Klima, Kablo, Fren, Kaplin vs)
Sözleşme No : KÇ.SZL.227', 'completed'),
  ('0003', '1,5 TON KAPASİTELİ KÖPRÜLÜ TAVAN VİNCİ', 'PLASTIC MASTER PLASTİK SANAYİ VE TİC.LTD.ŞTİ.', '2024-03-20', 'FR.11.02', 'Ramazanoğlu Mahallesi Karşıgeçit Sokak No:5 İç Kapı:3 Pendik/İSTANBUL', 'PENDİK', '7300853737', '', '', '2024-03-20', '2024-04-16', null, '1 Takım', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Araba Hariç Komple İmalat. Yürüme Yolları Dahil', 'completed'),
  ('0004', '30 TON KAPASİTELİ TEKABÜL ARABASI', 'KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.', '2024-03-25', 'FR.11.02', 'Kardemir Sahası içi Karçel Binası 78170 Karabük / Türkiye', 'KARABÜK', '5230126315', '+90 370 418 22 38', '+90 370 412 04 99', '2024-03-25', '2024-04-25', null, '1', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": false, "nakliye": false, "imalat": false, "montaj": false}', '', 'completed'),
  ('0005', '10 t x 21 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ + 20 t x 22 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ + VİNÇ YÜRÜME YOLU MONTAJI', 'ASTOR A.Ş.', '2024-04-26', 'FR.11.02', 'ASO 2. Ve 3. OSB Alcı Mahallesi 2001 Cadde No:3 Sincan/ANKARA', '', '', '+90 312 267 01 56', '+90 312 267 00 34', '2024-04-26', '2024-06-13', null, '1+1', 'Sinan ÇOLAKOĞLU & Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Vinç Yürüme Yolları
10 t için Hol uzunluğu 140m (Bara Montajı da dahil)
20 t için Hol uzunluğu 140m
Vinç yürüme yolları sadece işçiliktir.', 'completed'),
  ('0006', '10 t x 20,5 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', 'ORiON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.', '2024-04-26', 'FR.11.02', 'Başkent OSB. 1.Cadde No:20 06909 Malıköy- Temelli-Sincan/ANKARA', 'SİNCAN', '6470773204', '+90 312 511 48 06', '', '2024-04-26', '2024-06-13', null, '1', 'Sinan ÇOLAKOĞLU & Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', '', 'completed'),
  ('0007', '5732.00 KONSOL İMALATI', 'Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.TİC.LTD.ŞTİ', '2024-02-14', 'FR.11.02', 'Kartaltepe Mahallesi Ahu Sokak Çınar Apt. B Blok No: 1/6 34145 Bakırköy/İSTANBUL', 'GÜNEŞLİ', '7700068218', '+90 212 213 92 92', '', '2024-05-13', '2024-05-30', '2024-06-03', '1 Takım', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş No :', 'completed'),
  ('0008', 'SDM VAKUM TESİSİ 15 TON X 8,510 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', 'KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.', '2024-07-26', 'FR.11.02', 'Kardemir Sahası içi Karçel Binası 78170 Karabük / Türkiye', 'KARABÜK', '5230126315', '+90 370 418 22 38', '+90 370 412 04 99', '2024-07-26', '2024-09-26', null, '1', 'Sinan ÇOLAKOĞLU & Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Sipariş Numarası :', 'completed'),
  ('0009', '10 t x 14 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', 'ASTOR A.Ş.', '2024-07-26', 'FR.11.02', 'ASO 2. Ve 3. OSB Alcı Mahallesi 2001 Cadde No:3 Sincan/ANKARA', '', '', '+90 312 267 01 56', '+90 312 267 00 34', '2024-07-26', '2024-09-26', null, '1', 'Sinan ÇOLAKOĞLU & Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Sipariş Numarası :', 'completed'),
  ('0010', 'LAMEL KANCA VE SEMER İMALATI', 'KARDEMİR ÇELİK SANAYİ A.Ş. (ÇELİKHANE)', '2024-08-23', 'FR-81', 'Bozköy Mah. 2.Cd. No: 24 35800 ALİAĞA /İZMİR (ÇELİKHANE)', 'PAMUKKALE', '523 094 9312', '+90 232 625 22 22', '+90', '2024-08-23', '2024-10-17', '2024-10-18', '2', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş Numarası : 757098 / 0
Talep No : 241605 - 1
Referans Proje Numarası : 0853.02.2600 REV B
100/35/10 TON X 30 M ŞARJ VİNCİ
Sevk Adresi : Bozköy Mah. 2.Cd. No: 24 35800
ALİAĞA /İZMİR (ÇELİKHANE)', 'completed'),
  ('0011', '185 TON KALDIRMA KİRİŞİ ANALİZ VE DETAY PROJE HİZMETİ', 'KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.', '2024-10-18', 'FR.81', 'Kardemir Sahası içi Karçel Binası 78170 Karabük / Türkiye', 'KARABÜK', '5230126315', '+90 370 418 22 38', '+90 370 412 04 99', '2024-10-18', '2024-11-01', null, '1', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": false, "nakliye": false, "imalat": false, "montaj": false}', 'Sipariş Numarası :', 'completed'),
  ('0012', 'ELEKTRİK ODASI, SDM-2 TANDİŞ VİNÇİ-1 REVİZYON (KARDEMİR)', 'İNFEED OTOMASYON ELEKTRİK ELEKTRONİK SAN.VE TİC.LTD.ŞTİ.', '2024-10-14', 'FR-81', 'İvedikköy Mah. Anadolu Bulvarı Corner-1 145J 06378', 'İVEDİK', '4781 1689 72', '0 (546) 474 69 45', '+90', '2024-10-14', '2025-03-14', '2025-03-14', '1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', '', 'completed'),
  ('0013', 'SICAK HADDEHANE A3 50/10 T ATÖLYE VİNCİ ELEKTRİK ODASI İMALATI (HABAŞ)', 'İNFEED OTOMASYON ELEKTRİK ELEKTRONİK SAN.VE TİC.LTD.ŞTİ.', '2024-10-25', 'FR-81', 'İvedikköy Mah. Anadolu Bulvarı Corner-1 145J 06378', 'İVEDİK', '4781 1689 72', '0 (546) 474 69 45', '+90', '2024-10-24', '2025-04-24', '2025-04-25', '1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'SAS NO : 6200392293', 'completed'),
  ('0014', 'TEKERLEK Ø500MM', 'KARDEMİR A.Ş.', '2024-12-05', 'FR-81', '78170 KARABÜK', '', '', '', '', '2024-12-05', '2025-01-18', '2025-01-19', '6', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş No : 780374/0
“İrsaliyenin ve faturanın üzerine "SAT No ve SAS No"
yazılarak teslim edilmesini, faturanın mutlaka malzeme ile
beraber gönderilmesini, faturaya sipariş ekran
görüntüsünün eklenmesini ve malzemeler herhangi bir
termine bağlanmamışsa tek seferde teslim edilmesini rica
ederiz.”', 'completed'),
  ('0015', 'PİNYON MİL VE FREN KASNAĞI', 'KARDEMİR A.Ş.', '2024-12-05', 'FR-81', '78170 KARABÜK', '', '', '', '', '2024-12-05', '2025-01-18', '2025-01-19', '2’ ŞER', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş No : 780448/0
“İrsaliyenin ve faturanın üzerine "SAT No ve SAS No"
yazılarak teslim edilmesini, faturanın mutlaka malzeme ile
beraber gönderilmesini, faturaya sipariş ekran
görüntüsünün eklenmesini ve malzemeler herhangi bir
termine bağlanmamışsa tek seferde teslim edilmesini rica
ederiz.”
Poz 1 Pinyon Mil, 2 adet
Poz 17 Fren Kasnağı 2 adet', 'completed'),
  ('0016', 'BURÇ 0383.01.2800/7', 'KARDEMİR A.Ş.', '2024-12-05', 'FR-81', '78170 KARABÜK', '', '', '', '', '2024-12-05', '2025-01-05', '2025-01-05', '4', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş No : 780561
“İrsaliyenin ve faturanın üzerine "SAT No ve SAS No"
yazılarak teslim edilmesini, faturanın mutlaka malzeme ile
beraber gönderilmesini, faturaya sipariş ekran
görüntüsünün eklenmesini ve malzemeler herhangi bir
termine bağlanmamışsa tek seferde teslim edilmesini rica
ederiz.”
0383.01.2800 Poz 7', 'completed'),
  ('0017', '120 TON KALDIRMA KAPASİTELİ KALDIRMA APARATI', 'ASTOR A.Ş.', '2024-07-26', 'FR.11.02', 'ASO 2. Ve 3. OSB Alcı Mahallesi 2001 Cadde No:3 Sincan/ANKARA', '', '', '+90 312 267 01 56', '+90 312 267 00 34', '2024-12-17', '2024-12-27', null, '1', 'Sinan ÇOLAKOĞLU & Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş Numarası : 20241202048', 'completed'),
  ('0018', '3 TON KAPASİTELİ MONORAY', 'KARDEMİR A.Ş.', '2025-01-09', 'FR-81', '78170 KARABÜK', '', '', '', '', '2025-01-09', '2025-03-08', null, '1', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş No : 788077/0
“İrsaliyenin ve faturanın üzerine "SAT No ve SAS No"
yazılarak teslim edilmesini, faturanın mutlaka malzeme ile
beraber gönderilmesini, faturaya sipariş ekran
görüntüsünün eklenmesini ve malzemeler herhangi bir
termine bağlanmamışsa tek seferde teslim edilmesini rica
ederiz.”', 'completed'),
  ('0019', 'ÇELİKHANE ŞARJ HOLÜ TESİSİ 185/40 TON KÖPRÜLÜ VİNÇ PROJE VE MÜHENDİSLİK HİZMETİ', 'KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.', '2025-01-22', 'FR.81', 'Kardemir Sahası içi Karçel Binası 78170 Karabük / Türkiye', 'KARABÜK', '5230126315', '+90 370 418 22 38', '+90 370 412 04 99', '2025-01-22', null, '2025-03-22', '1', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": false, "nakliye": false, "imalat": false, "montaj": false}', 'Sipariş Numarası :', 'completed'),
  ('0021', 'PERGEL VİNÇ 0,5 TON KAPASİTELİ + PERGEL VİNÇ 1,0 TON KAPASİTELİ + PERGEL VİNÇ 1,5 TON KAPASİTELİ', 'MAKİNE VE KİMYA ENDÜSTRİSİ ANONİM ŞİRKETİ', '2025-01-23', 'FR.81', 'A.O.Ç. Bahçekapı Mah. Güvercinlik Cad.No:2 06797 No:2 Etimesgut Türkiye', '', '5230', '+90 312 211 01 62', '+90 312 211 00 42', '2025-01-23', '2025-05-10', '2025-05-11', '3', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Talep Numarası : 24029549
Sevk Adresi : MKE GAZİ FİŞEK FAB.MD.
A.O.Ç. Bahçekapı Mah. Güvercinlik Cd.No:2 06797
Gazi-Etimesgut/ANKARA', 'completed'),
  ('0022', 'Ø890X90MM S355J2+N SAC', 'YILMAZLAR TEMELLİ VİNÇ HİZM. TİC. LTD. ŞTİ.', '2025-02-13', 'FR.81', '', '', '', '', '', '2025-02-13', '2025-02-14', '2025-02-14', '3', '', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": false, "imalat": false, "montaj": false}', '1.320 Kg', 'completed'),
  ('0023', '10 TON KANCA BLOĞU + 10 TON ÜST MAKARA BLOĞU', 'KARDEMİR ÇELİK SANAYİ A.Ş. (ÇELİKHANE)', '2024-03-17', 'FR-81', 'Bozköy Mah. 2.Cd. No: 24 35800 ALİAĞA /İZMİR (ÇELİKHANE)', 'PAMUKKALE', '523 094 9312', '+90 232 625 22 22', '+90', '2025-03-17', '2025-05-16', '2025-05-17', '1+1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sevk Adresi : Bozköy Mah. 2.Cd. No: 24 35800
ALİAĞA /İZMİR (ÇELİKHANE)', 'completed'),
  ('0024', 'RPH_MOTOR KORUMA KAPAKLARI İMALATI', 'KARDEMİR A.Ş.', '2025-03-18', 'FR-81', '78170 KARABÜK', '', '', '', '', '2025-03-18', '2025-03-17', '2025-03-18', '13', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş No :
3100004176 - ÇELİK KONSTRÜKSİYON İMALAT
Sac Kalınlığı : 2mm
Kalite : S235JR
Adet : 13
Koyu mavi renk ile boyanacaktır.', 'completed'),
  ('0025', 'KÜTÜK HOLÜ-2 20 TON X 30 M KAPASİTELİ KÖPRÜLÜ TAVAN VİNCİ', 'İZMİR DEMİR ÇELİK SANAYİ A.Ş.', '2025-03-24', 'FR-81', 'Foça Çelik Fabrikası: Nemrut Cad. No:2 Horozgediği Mah. Aliağa/İzmir', 'KONAK VD.', '4840008672', '0 232 441 50 50', '0 232 441 56 66', '2025-03-28', '2025-06-25', '2025-06-28', '1', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Araba komple ve elektrik kapsam dışıdır.
Ana Kiriş, Baş Kiriş, Boji, Platform, Feston ve Kabin
dahildir.', 'completed'),
  ('0026', '100 t x 15,50 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ + YÜRÜME YOLU HOL BOYU 30 m', 'ASTOR A.Ş.', '2025-04-17', 'FR.11.02', 'ASO 2. Ve 3. OSB Alcı Mahallesi 2001 Cadde No:3 Sincan/ANKARA', '', '', '+90 312 267 01 56', '+90 312 267 00 34', '2025-04-17', '2025-06-30', null, '1', 'Sinan ÇOLAKOĞLU & Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Yürüme Yolu Kurban Bayramında tamamlanacak.', 'completed'),
  ('0027', '2X 15 T X 23,5 M KAPASİTELİ PORTAL VİNÇ', 'KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.', '2025-04-17', 'FR.11.02', 'Kardemir Sahası içi Karçel Binası 78170 Karabük / Türkiye', 'KARABÜK', '5230126315', '+90 370 418 22 38', '+90 370 412 04 99', '2025-04-17', '2025-06-17', null, '1', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": false, "nakliye": false, "imalat": false, "montaj": false}', 'Bedelsiz', 'completed'),
  ('0028', '30 t x 21,7 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', 'ASTOR A.Ş.', '2025-04-22', 'FR.11.02', 'ASO 2. Ve 3. OSB Alcı Mahallesi 2001 Cadde No:3 Sincan/ANKARA', '', '', '+90 312 267 01 56', '+90 312 267 00 34', '2025-04-22', '2025-06-30', null, '1', 'Sinan ÇOLAKOĞLU & Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', '', 'completed'),
  ('0029', 'PERGEL VİNÇ DEMONTAJ VE MONTAJ İŞÇİLİĞİ', 'GALVASUN GALVANİZ SAN.TİC.İTH.İHR.LTD.ŞTİ.', '2025-05-09', 'FR.11.02', 'Başkent OSB. 19.Cadde No:29 06909 Malıköy- Temelli-Sincan/ANKARA', 'SİNCAN', '3880740323', '+90 312 277 33 48', '+90 312 277 33 68', '2025-06-23', '2025-06-25', '2025-06-25', '1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": false, "nakliye": false, "imalat": false, "montaj": true}', '500 Kg Pergel vincin sökümü ve montajı', 'completed'),
  ('0030', '(0021-01) 0,5 TON KAPASİTELİ PERGEL VİNÇ KUMANDASI VE SERVİS HİZMETİ', 'MAKİNE VE KİMYA ENDÜSTRİSİ ANONİM ŞİRKETİ', '2025-07-05', 'FR.81', 'A.O.Ç. Bahçekapı Mah. Güvercinlik Cad.No:2 06797 No:2 Etimesgut Türkiye', 'ANKARA KURUMLAR', '6111520767', '+90 312 211 01 62', '+90 312 211 00 42', '2025-07-05', '2025-07-05', '2025-07-05', '1', '', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": false, "montaj": true}', '', 'completed'),
  ('0031', 'BAKIM VE ONARIM', 'PİMSUN', '2025-07-05', 'FR.81', 'Başkent OSB 26. Cadde No:11 06909 Malıköy- Temelli-Sincan/ANKARA', '', '', '+90 0312 397 70 72', '+90 0312 397 26 94', '2025-07-05', '2025-07-30', '2025-07-30', '1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Özfatihler Marka, 2,5 Ton Kapasiteli Monoray Bakım
ve Onarımı', 'completed'),
  ('0032', 'BORU DÖNDÜRME APARATI', 'ORiON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.', '2025-08-06', 'FR.11.02', 'Başkent OSB. 1.Cadde No:20 06909 Malıköy- Temelli-Sincan/ANKARA', 'SİNCAN', '6470773204', '+90 312 511 48 06', '', '2025-08-06', '2025-09-06', null, '1', 'Sinan ÇOLAKOĞLU & Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', '', 'completed'),
  ('0033', '6 BUTONLU KABLOSUZ VİNÇ KUMANDASI', 'MAKİNE VE KİMYA ENDÜSTRİSİ ANONİM ŞİRKETİ', '2025-08-15', 'FR.81', 'A.O.Ç. Bahçekapı Mah. Güvercinlik Cad.No:2 06797 No:2 Etimesgut Türkiye', 'ANKARA KURUMLAR', '6111520767', '+90 312 211 01 62', '+90 312 211 00 42', '2025-08-15', null, '2025-08-22', '2', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": false, "montaj": false}', '', 'completed'),
  ('0034', 'PANEL İMALATI', 'YALCO DIŞ TİCARET VE MÜMESSİLLİK LTD. ŞTİ.', '2025-08-25', 'FR.81', 'Başkent O.S.B R.T.E. Bulvarı No: 20 06909 Malıköy/Sincan-ANKARA', 'SİNCAN', '9290037628', '+90 312 447 32 96', '+90 312 447 32 99', '2025-08-25', '2025-10-08', '2025-10-08', '500 + 300', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', '98-3619 Numaralı Projeden 500 Adet
300 Adet için müşteriden yeni proje gelecek
Kumlama ve boya (RAL kodu sonra bildirilecektir)
uygulanmış, kalıp yağı sürülmüş, korozyona karşı
koruma paketlemesi yapılmış, ürünler nakliye ve
stoklamada zarar görmeyecek şekilde tahta paletler
üzerinde istiflenmiş olarak sevk edilecektir.
Boya : Tek yüzeye uygulanacak.', 'completed'),
  ('0035', 'SDM-3 KÜTÜK VİNÇLERİ ELEKTRİK VE OTOMASYON SİSTEM REVİZYONU', 'KARDEMİR A.Ş.', '2025-09-03', 'FR-81', '78170 KARABÜK', 'KARABÜK VD.', '5050055358', '', '', '2025-09-03', '2026-02-02', '2026-02-03', '1 + 1', 'Akif ERGÜVEN & Harun ORAN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', '2 Adet elektrik odası ve teknolojik ekipmanları', 'completed'),
  ('0036', 'BAKIM ONARIM (1 TON PERGEL VİNÇ)', 'MAKİNE VE KİMYA ENDÜSTRİSİ ANONİM ŞİRKETİ', '2025-09-15', 'FR.81', 'A.O.Ç. Bahçekapı Mah. Güvercinlik Cad.No:2 06797 No:2 Etimesgut Türkiye', 'ANKARA KURUMLAR', '6111520767', '+90 312 211 01 62', '+90 312 211 00 42', '2025-09-15', null, '2025-09-17', '1', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": false, "montaj": false}', '1 Ton Kapasiteli Pergel Vinç Halat Değişimi', 'completed'),
  ('0037', '10 TON KAPASİTELİ MONORAY VİNÇ (ŞARJ&DÖKÜM VİNCİ)', 'KARDEMİR ÇELİK SANAYİ A.Ş. (ÇELİKHANE)', '2025-09-19', 'FR-81', 'Bozköy Mah. 2.Cd. No: 24 35800 ALİAĞA /İZMİR (ÇELİKHANE)', 'PAMUKKALE', '523 094 9312', '+90 232 625 22 22', '+90', '2025-09-19', '2025-12-19', '2025-12-19', '1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş Numarası : 904035 / 0
Talep No : 1235570-4
Sevk Adresi : Bozköy Mah. 2.Cd. No: 24 35800
ALİAĞA /İZMİR (ÇELİKHANE)', 'completed'),
  ('0038', 'KANCA BLOĞU KAPORTASI Ø240MM', 'SAKA DEMİR ÇELİK SANAYİ VE TİCARET A.Ş.', '2025-09-30', 'FR-81', 'Kurtuluş Mahallesi, Sanati Bölgesi No: 9 KARABÜK/MERKEZ', '', '', '+90 370 413 02 33', '+90', '2025-09-30', '2025-10-30', '2025-11-01', '10', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş Numarası : 25/507-63178
Talep No : 568', 'completed'),
  ('0039', 'TAMBUR İMALATI 35 TON KAPASİTELİ + KANCA BLOĞU İMALATI 35 TON KAPASİTELİ', 'ASTOR A.Ş.', '2025-10-22', 'FR.11.02', 'ASO 2. Ve 3. OSB Alcı Mahallesi 2001 Cadde No:3 Sincan/ANKARA', '', '', '+90 312 267 01 56', '+90 312 267 00 34', '2025-10-22', '2025-12-10', null, '1+1', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'Sipariş Numarası : 20251002769', 'completed'),
  ('0040', 'PANEL İMALATI', 'YALCO DIŞ TİCARET VE MÜMESSİLLİK LTD. ŞTİ.', '2025-11-13', 'FR.81', 'Başkent O.S.B R.T.E. Bulvarı No: 20 06909 Malıköy/Sincan-ANKARA', 'SİNCAN', '9290037628', '+90 312 447 32 96', '+90 312 447 32 99', '2025-11-13', '2025-12-13', '2025-12-13', '13', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', '06-3618 Numaralı Projeden 13 Adet
Kumlama ve boya (RAL kodu sonra bildirilecektir)
uygulanmış, kalıp yağı sürülmüş, korozyona karşı
koruma paketlemesi yapılmış, ürünler nakliye ve
stoklamada zarar görmeyecek şekilde tahta paletler
üzerinde istiflenmiş olarak sevk edilecektir.
Boya : Tek yüzeye uygulanacak.', 'completed'),
  ('0041', '170/40/12,5 T KAPASİTELİ POTA VİNCİ BAŞ KİRİŞİ', 'KARDEMİR A.Ş.', '2025-11-28', 'FR-81', '78170 KARABÜK', 'KARABÜK VD.', '5050055358', '', '', '2025-11-28', '2026-02-09', '2026-02-10', '1', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'ERP Sipariş Numarası: 1371271
Sipariş Adı: 1000033418 - 1 KMP
KİRİŞ,BAŞ,0383.02.03.0400/1-10:12:14-18›
Sipariş Tarihi: 28-11-2025 14:44', 'completed'),
  ('0042', 'Emniyet Freni Konsol ve Fren Diskleri İmalatı', 'Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.TİC.LTD.ŞTİ', '2025-12-08', 'FR-81', 'Kartaltepe Mahallesi Ahu Sokak Çınar Apt. B Blok No: 1/6 34145 Bakırköy/İSTANBUL', 'GÜNEŞLİ VD.', '7700068218', '', '', '2025-12-08', '2025-12-30', '2025-12-31', '', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": false, "imalat": true, "montaj": false}', 'Konsol SHI 107: 3 Adet
Disk BHV02: 1 Adet
Disk HV4: 2 Adet', 'completed'),
  ('0043', '15 t x 24 m Köprülü Tavan Vinci', 'MTC PASLANMAZ', '2025-12-11', 'FR-81', '', '', '', '', '', '2025-12-11', '2026-03-30', '2026-03-30', '1 Adet', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": false, "imalat": true, "montaj": true}', '', 'completed'),
  ('0044', 'Bilezik İmalatı', 'KARDEMİR A.Ş.', '2025-12-16', 'FR-81', 'Fabrika Sahası, 78170 Merkez/Karabük', 'Karabük VD.', '5050055358', '', '', '2025-12-16', '2026-02-16', '2026-02-16', '60 Adet', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'ERP Sipariş Numarası: 923402/0
Pazarlık Numarası: 1377068
SAT/SAS Numarası: 1000030588
(İrsaliye ve Fatura üzerine mutlaka yazılacak)', 'completed'),
  ('0045', '2x30 t x 29,5 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', 'HABAŞ', '2025-12-23', 'FR-81', 'Soğanlık Yeni Fuat Paşa Sokak No:1 34880 Kartal/İstanbul', '', '', '', '', '2025-12-23', '2026-04-23', '2026-04-24', '1 + 1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Ana Kiriş ve Platform Hariç,
Haricinde ki tüm ekipmanlar komple imal edilecek.
Montaj Yeri : YILDIZ GEMİ Tersanesi
Evliya Çelebi Mahallesi Tersaneler Caddesi No:16
Tuzla/İstanbul', 'completed'),
  ('0046', 'Elektrik Odası İmalatı ve Araba Komple İmalatı', 'ORHUN MAKİNA', '2025-12-30', 'FR-81', 'Deri OSB 6.Yol 1-6 Parsel Tuzla/İstanbul', '', '', '', '', '2025-12-30', '2026-02-03', '2026-02-04', '1 + 1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": false, "imalat": true, "montaj": true}', 'Araba Komple’ de teknolojik ekipmanlar müşteri
tarafından gönderilecek. Montaj ORİON tarafından
yapılacak.
Elektrik Odası ve Araba C5 Boya', 'completed'),
  ('0047', 'Hurda Kovası İmalatı', 'KARDEMİR A.Ş.', '2026-01-02', 'FR-81', 'Fabrika Sahası, 78170 Merkez/Karabük', 'Karabük VD.', '5050055358', '', '', '2026-01-02', '2026-03-02', '2026-03-02', '4 Adet', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'ERP Sipariş Numarası: 926882 / 0
Pazarlık Numarası: 1383676-1
SAT/SAS Numarası: 1000033477
(İrsaliye ve Fatura üzerine mutlaka yazılacak)', 'completed'),
  ('0048', 'Yürüme Yolu Montajı', 'LITEC MAKİNA SAN. VE TİC. A.Ş.', '2026-01-27', 'FR-81', 'The Paragon, B Blok, Kat 23 No.113, Kızılırmak Mh. 1445 Sk. No:2/1 Çukurambar, Çankaya/Ankara', '', '', '', '', '2026-01-27', '2026-02-28', '2026-02-28', '90x2 180 m', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": false, "nakliye": false, "imalat": false, "montaj": false}', 'A75 Ray, Rayaltı Lastiği, Galvanizli Krapo
90 metre x 2 = 180 metre ray montajı yapılacak.
Montaj Yeri : Artvin/Hopa', 'completed'),
  ('0049', 'Muhtelif Yedek Parça İmalatı (185/40 t Şarj Vinci)', 'KARDEMİR A.Ş.', '2026-01-30', 'FR-81', 'Fabrika Sahası, 78170 Merkez/Karabük', 'Karabük VD.', '5050055358', '', '', '2026-01-30', '2026-03-30', '2026-03-30', 'Muhtelif', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'ERP Sipariş Numarası: 932791/0
Pazarlık Numarası: 1408763-2
(İrsaliye ve Fatura üzerine mutlaka yazılacak)
0019-00-0107 = 8 Adet, 0019-00-0108 = 6 Adet,
0019-00-0109 = 6 Adet, 0019-00-0110 = 6 Adet,
0019-00-0111 = 6 Adet, 0019-00-0112 = 6 Adet,
0019-00-0113 = 6 Adet, 0019-00-0114 = 3 Adet,
0019-00-0123 = 3 Adet,', 'completed'),
  ('0050', 'Muhtelif Yedek Parça İmalatı', 'KARDEMİR A.Ş.', '2026-02-10', 'FR-81', 'Fabrika Sahası, 78170 Merkez/Karabük', 'Karabük VD.', '5050055358', '', '', '2026-02-10', '2026-04-10', '2026-04-10', 'Muhtelif', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', 'ERP Sipariş Numarası: 934692/0
Pazarlık Numarası: 1408920
Sipariş Adı:
1000033914 - 7 KALEM İMALAT MALZEMESİ
(İrsaliye ve Fatura üzerine mutlaka yazılacak)
14-5335-07060102 = 2 Adet
14-5335-07060104 = 2 Adet
14-5335-07060105 = 2 Adet
14-5335-07060106 = 2 Adet', 'completed'),
  ('0051', 'Operatör Kabini Yedek Parça İmalatı', 'EREĞLİ DEMİR ÇELİK FABRİKALARI T.A.Ş.', '2026-02-13', 'FR-81', 'Uzunkum Cad. No : 7 67330 Kdz. Ereğli/Zonguldak', 'Kdz.Ereğli VD.', '3520006426', '', '', '2026-02-13', '2026-03-13', '2026-03-13', '10+10', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": false}', '“Teklifimiz kapı kolu ve kilit seti içermektedir. Set
halinde sevk edilecektir.”
Sipariş Kodu/SAS No: 440902 / 1100430960
Pazarlık No: 684774-3
Mehmet Karaduman
0372 329 47 42
mkaraduman@erdemir.com.tr', 'completed'),
  ('0052', 'SD10 Vinci Operatör Kabini Yenilenmesi', 'İSKENDERUN DEMİR VE ÇELİK A.Ş.', '2026-02-19', 'FR-81', 'Karşı Mahalle Şehit Yüzbaşı Ali Oğuz Bulvarı No:1 PK 31900 Payas/Hatay', 'HATAY - Akdeniz Vergi Dairesi Müdürlüğü', '8790009670', '', '', '2026-02-19', '2026-07-19', '2026-07-19', '1', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'Satınalma Sipariş No : SA.1.48.4100036565
Satınalma Talep No : 4100034700', 'completed'),
  ('0053', '40 t x 16,7 m Kapasiteli Portal Vinç ve Mekanik Spreader Beam', 'LITEC MAKİNA SAN. VE TİC. A.Ş.', '2026-03-06', 'FR-81', 'The Paragon, B Blok, Kat 23 No.113, Kızılırmak Mh. 1445 Sk. No:2/1 Çukurambar, Çankaya/Ankara', '', '', '', '', '2026-03-06', '2026-05-30', '2026-05-30', '1 + 1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": false, "nakliye": false, "imalat": false, "montaj": false}', 'Kablo Sarma Tamburu Dahil
Montaj Yeri : Elazığ', 'completed'),
  ('0054', '75 t Kapasiteli Kaldırma Kirişi', 'LITEC MAKİNA SAN. VE TİC. A.Ş.', '2026-03-16', 'FR-81', 'The Paragon, B Blok, Kat 23 No.113, Kızılırmak Mh. 1445 Sk. No:2/1 Çukurambar, Çankaya/Ankara', '', '', '', '', '2026-03-16', '2026-04-16', '2026-04-16', '1', 'Salih ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": false, "devreyeAlma": false, "malzeme": false, "nakliye": false, "imalat": false, "montaj": false}', '', 'completed'),
  ('0055', 'İsdemir Amonyum Sülfat Tesisi 2m³ Kapasiteli Kepçeli Çift Kirişli Tavan Vinci', 'İSKENDERUN DEMİR VE ÇELİK A.Ş.', '2026-05-11', 'FR-81', 'Karşı Mahalle Şehit Yüzbaşı Ali Oğuz Bulvarı No:1 PK 31900 Payas/Hatay', 'HATAY - Akdeniz Vergi Dairesi Müdürlüğü', '8790009670', '', '', '2026-05-11', '2027-02-01', '2027-03-01', '1', 'Sinan ÇOLAKOĞLU', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', 'SAT-SAS No: 410034613
Sözleşme No: 2026-30', 'active'),
  ('0057', 'Muhtelif Vinçler', 'ASTOR A.Ş.', '2026-06-17', 'FR.11.02', 'ASO 2. Ve 3. OSB Alcı Mahallesi 2001 Cadde No:3 Sincan/ANKARA', '', '', '+90 312 267 01 56', '+90 312 267 00 34', '2026-06-17', '2026-08-17', null, 'Muhtelif', 'Akif ERGÜVEN', 'Salih ERGÜVEN', 'Genel Müdür', '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}', '0057-01: 3 Adet
0057-02: 3 Adet
0057-03: 3 Adet
0057-04: 1 Adet
0057-05: 1 Adet
0057-06: 1 Adet
0057-07: 3 Adet
0057-08: 1 Adet', 'active')
)
insert into public.jobs (
  job_no, title, customer, customer_id, status, work_order_date, form_code,
  customer_address, customer_tax_office, customer_tax_no, customer_phone,
  customer_fax, contract_exists, contract_date, workshop_exit_date,
  delivery_date, quantity_text, job_leader, prepared_by_name,
  prepared_by_title, scope, notes, created_by
)
select
  s.job_no, s.title, s.customer, c.id, s.status::public.job_status,
  s.work_order_date::date, s.form_code, s.address, s.tax_office, s.tax_no,
  s.phone, s.fax,
  -- "Sözleşme var" kutusu: basılı formda ayrı bir kutu yok; sözleşme
  -- TARİHİ dolu olan emir sözleşmelidir (elle girilen 0055 kaydı da böyle).
  (s.contract_date is not null),
  s.contract_date::date, s.workshop_exit_date::date, s.delivery_date::date,
  s.quantity_text, s.job_leader, s.prepared_by_name, s.prepared_by_title,
  s.scope::jsonb, s.notes, a.id
from src s
cross join actor a
left join public.customers c on lower(btrim(c.name)) = lower(btrim(s.customer))
where not exists (select 1 from public.jobs j where j.job_no = s.job_no);

-- ------------------------------------------------------------- iş kalemleri
with src (job_no, item_no, product_name, quantity, sort) as (values
  ('0001', '0001-00', 'SHI 105FC KONSOL İMALATI', '1 Takım', 0),
  ('0002', '0002-00', 'CÜRUF POTA TUMBA TESİSİ 100/50 TON KÖPRÜLÜ VİNÇ', '2 Takım', 0),
  ('0003', '0003-00', '1,5 TON KAPASİTELİ KÖPRÜLÜ TAVAN VİNCİ', '1 Takım', 0),
  ('0004', '0004-00', '30 TON KAPASİTELİ TEKABÜL ARABASI', '1', 0),
  ('0005', '0005-01', '10 t x 21 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', '', 0),
  ('0005', '0005-02', '20 t x 22 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', '', 1),
  ('0005', '0005-03', 'VİNÇ YÜRÜME YOLU MONTAJI', '', 2),
  ('0006', '0006-00', '10 t x 20,5 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', '1', 0),
  ('0007', '0007-00', '5732.00 KONSOL İMALATI', '1 Takım', 0),
  ('0008', '0008-00', 'SDM VAKUM TESİSİ 15 TON X 8,510 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', '1', 0),
  ('0009', '0009-00', '10 t x 14 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', '1', 0),
  ('0010', '0010-00', 'LAMEL KANCA VE SEMER İMALATI', '2', 0),
  ('0011', '0011-00', '185 TON KALDIRMA KİRİŞİ ANALİZ VE DETAY PROJE HİZMETİ', '1', 0),
  ('0012', '0012-00', 'ELEKTRİK ODASI, SDM-2 TANDİŞ VİNÇİ-1 REVİZYON (KARDEMİR)', '1', 0),
  ('0013', '0013-00', 'SICAK HADDEHANE A3 50/10 T ATÖLYE VİNCİ ELEKTRİK ODASI İMALATI (HABAŞ)', '1', 0),
  ('0014', '0014-00', 'TEKERLEK Ø500MM', '6', 0),
  ('0015', '0015-00', 'PİNYON MİL VE FREN KASNAĞI', '2’ ŞER', 0),
  ('0016', '0016-00', 'BURÇ 0383.01.2800/7', '4', 0),
  ('0017', '0017-00', '120 TON KALDIRMA KAPASİTELİ KALDIRMA APARATI', '1', 0),
  ('0018', '0018-00', '3 TON KAPASİTELİ MONORAY', '1', 0),
  ('0019', '0019-00', 'ÇELİKHANE ŞARJ HOLÜ TESİSİ 185/40 TON KÖPRÜLÜ VİNÇ PROJE VE MÜHENDİSLİK HİZMETİ', '1', 0),
  ('0021', '0021-01', 'PERGEL VİNÇ 0,5 TON KAPASİTELİ', '', 0),
  ('0021', '0021-02', 'PERGEL VİNÇ 1,0 TON KAPASİTELİ', '', 1),
  ('0021', '0021-03', 'PERGEL VİNÇ 1,5 TON KAPASİTELİ', '', 2),
  ('0022', '0022-00', 'Ø890X90MM S355J2+N SAC', '3', 0),
  ('0023', '0023-01', '10 TON KANCA BLOĞU', '', 0),
  ('0023', '0023-02', '10 TON ÜST MAKARA BLOĞU', '', 1),
  ('0024', '0024-00', 'RPH_MOTOR KORUMA KAPAKLARI İMALATI', '13', 0),
  ('0025', '0025-00', 'KÜTÜK HOLÜ-2 20 TON X 30 M KAPASİTELİ KÖPRÜLÜ TAVAN VİNCİ', '1', 0),
  ('0026', '0026-01', '100 t x 15,50 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', '', 0),
  ('0026', '0026-02', 'YÜRÜME YOLU HOL BOYU 30 m', '', 1),
  ('0027', '0027-00', '2X 15 T X 23,5 M KAPASİTELİ PORTAL VİNÇ', '1', 0),
  ('0028', '0028-00', '30 t x 21,7 m KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ', '1', 0),
  ('0029', '0029-00', 'PERGEL VİNÇ DEMONTAJ VE MONTAJ İŞÇİLİĞİ', '1', 0),
  ('0030', '0030-00', '(0021-01) 0,5 TON KAPASİTELİ PERGEL VİNÇ KUMANDASI VE SERVİS HİZMETİ', '1', 0),
  ('0031', '0031-00', 'BAKIM VE ONARIM', '1', 0),
  ('0032', '0032-00', 'BORU DÖNDÜRME APARATI', '1', 0),
  ('0033', '0033-00', '6 BUTONLU KABLOSUZ VİNÇ KUMANDASI', '2', 0),
  ('0034', '0034-00', 'PANEL İMALATI', '500 + 300', 0),
  ('0035', '0035-00', 'SDM-3 KÜTÜK VİNÇLERİ ELEKTRİK VE OTOMASYON SİSTEM REVİZYONU', '1 + 1', 0),
  ('0036', '0036-00', 'BAKIM ONARIM (1 TON PERGEL VİNÇ)', '1', 0),
  ('0037', '0037-00', '10 TON KAPASİTELİ MONORAY VİNÇ (ŞARJ&DÖKÜM VİNCİ)', '1', 0),
  ('0038', '0038-00', 'KANCA BLOĞU KAPORTASI Ø240MM', '10', 0),
  ('0039', '0039-01', 'TAMBUR İMALATI 35 TON KAPASİTELİ', '', 0),
  ('0039', '0039-02', 'KANCA BLOĞU İMALATI 35 TON KAPASİTELİ', '', 1),
  ('0040', '0040-00', 'PANEL İMALATI', '13', 0),
  ('0041', '0041-00', '170/40/12,5 T KAPASİTELİ POTA VİNCİ BAŞ KİRİŞİ', '1', 0),
  ('0042', '0042-01', 'Emniyet Freni Konsol İmalatı (SHI 107)', '', 0),
  ('0042', '0042-02', 'Emniyet Freni Diski BHV02-004-001', '', 1),
  ('0042', '0042-03', 'Emniyet Freni Diski HV4-004-009', '', 2),
  ('0043', '0043-00', '15 t x 24 m Köprülü Tavan Vinci', '1 Adet', 0),
  ('0044', '0044-00', 'Bilezik İmalatı', '60 Adet', 0),
  ('0045', '0045-01', '2x30 t x 29,5 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '', 0),
  ('0045', '0045-02', '2x30 t x 29,5 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci', '', 1),
  ('0046', '0046-01', 'Elektrik Odası İmalatı', '', 0),
  ('0046', '0046-02', 'Araba Komple İmalatı', '', 1),
  ('0047', '0047-00', 'Hurda Kovası İmalatı', '4 Adet', 0),
  ('0048', '0048-00', 'Yürüme Yolu Montajı', '90x2 180 m', 0),
  ('0049', '0049-00', 'Muhtelif Yedek Parça İmalatı (185/40 t Şarj Vinci)', 'Muhtelif', 0),
  ('0050', '0050-00', 'Muhtelif Yedek Parça İmalatı', 'Muhtelif', 0),
  ('0051', '0051-00', 'Operatör Kabini Yedek Parça İmalatı', '10+10', 0),
  ('0052', '0052-00', 'SD10 Vinci Operatör Kabini Yenilenmesi', '1', 0),
  ('0053', '0053-01', '40 t x 16,7 m Kapasiteli Portal Vinci', '', 0),
  ('0053', '0053-02', 'Mekanik Spreader Beam', '', 1),
  ('0054', '0054-00', '75 t Kapasiteli Kaldırma Kirişi', '1', 0),
  ('0055', '0055-00', 'İsdemir Amonyum Sülfat Tesisi 2m³ Kapasiteli Kepçeli Çift Kirişli Tavan Vinci', '1', 0),
  ('0057', '0057-01', '1 t x 19,00 m Kapasiteli Tek Kirişli Köprülü Tavan Vinci', '3 Adet', 0),
  ('0057', '0057-02', 'Yürüme Yolu ve Bara Montajı 1 t x 19 m (Dikme Ayaklar Dahil)', '3 Adet', 1),
  ('0057', '0057-03', '1 t x 3,00 m Kapasiteli Tek Kirişli Köprülü Tavan Vinci', '3 Adet', 2),
  ('0057', '0057-04', 'Yürüme Yolu ve Bara Montajı 1 t x 18 m (Dikme Ayaklar Dahil)', '1 Adet', 3),
  ('0057', '0057-05', 'Yürüme Yolu ve Bara Montajı 1 t x 9 m (Dikme Ayaklar Dahil)', '1 Adet', 4),
  ('0057', '0057-06', '1,0 t Kapasiteli Pergel Vinç', '1 Adet', 5),
  ('0057', '0057-07', '5 t x 22,00 m Kapasiteli Tek Kirişli Köprülü Tavan Vinci', '3 Adet', 6),
  ('0057', '0057-08', 'Yürüme Yolu ve Bara Montajı 290 m (50x30 Kare Ray)', '1 Adet', 7)
)
insert into public.job_items (job_id, item_no, product_name, quantity, sort)
select j.id, s.item_no, s.product_name, s.quantity, s.sort
from src s
join public.jobs j on j.job_no = s.job_no
where not exists (
  select 1 from public.job_items i where i.job_id = j.id and i.item_no = s.item_no
);

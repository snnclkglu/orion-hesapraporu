-- ORİON-İş Fiyatları.xlsx "İş Listesi" sayfasındaki ticari veriler.
--
-- Eşleşme KALEM NUMARASI (job_items.item_no) üzerindendir. Excel'de olup
-- sistemde karşılığı OLMAYAN satırlar aktarılmaz — iş emri PDF'lerinden
-- gelen kalem listesi değiştirilmez (bkz. aktarım raporu).
--
-- Kur alanı: 1 avro kaç birim para eder. Excel'in "Kur" sütunu da böyle
-- tutulmuş (TL satırında ~34-48, dolar satırında ~1,15, avroda 1).
--
-- Toplamlar YAZILMAZ: tablo onları birim değerlerden türetir.
-- Var olan kayıt EZİLMEZ (`do nothing`) — elle girilmiş fiyat korunur.

with src (item_no, scope, due_date, shipment_date, quantity, unit,
          unit_weight_kg, unit_price, currency, fx_rate, shipment_place) as (values
  ('0001-00', 'Komple İmalat', '2024-03-30', '2024-04-01', 1.0, 'Adet', 45.0, 1072.0, 'EUR', 1, 'TÜRKİYE'),
  ('0002-00', 'Hazır Ekipmanlar ve Elektrik Hariç. 
Mühendislik, Tarsarım, İmalat, Nakliye, Devreye Alma', '2025-02-04', '2025-01-06', 2.0, 'Adet', 184000.0, 787500.0, 'EUR', 1, 'TÜRKİYE'),
  ('0003-00', 'Köprü İmalatı.
Elektrik, Devreye Alma ve Araba Hariç', '2024-04-15', '2024-04-16', 1.0, 'Adet', 2010.0, 225000.0, 'TRY', 34.5096, 'TÜRKİYE'),
  ('0004-00', 'Mühendislik ve Tasarım Hizmeti', '2024-04-25', '2024-04-25', 1.0, 'Adet', null, null, 'EUR', 1, 'TÜRKİYE'),
  ('0005-01', 'Komple İmalat', '2024-06-28', '2024-07-14', 1.0, 'Adet', 15000.0, 38000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0005-02', 'Komple İmalat', '2024-06-28', '2024-07-13', 1.0, 'Adet', 18000.0, 62600.0, 'EUR', 1, 'TÜRKİYE'),
  ('0005-03', 'İşçilik', '2024-06-28', '2024-06-22', 2.0, 'Adet', null, 9700.0, 'EUR', 1, 'TÜRKİYE'),
  ('0006-00', 'Komple İmalat', null, null, 1.0, 'Adet', 11000.0, null, 'EUR', 1, 'TÜRKİYE'),
  ('0007-00', 'Komple İmalat', '2024-06-03', '2024-06-29', 1.0, 'Adet', 165.0, 1300.0, 'EUR', 1, 'TÜRKİYE'),
  ('0008-00', 'Mühendislik ve Tasarım Hizmeti', '2024-09-26', '2024-09-09', 1.0, 'Adet', null, 2750.0, 'EUR', 1, 'TÜRKİYE'),
  ('0009-00', 'Komple İmalat', '2024-09-25', '2024-09-28', 1.0, 'Adet', 9000.0, 53000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0010-00', 'Komple İmalat', '2024-10-18', '2024-10-30', 2.0, 'Adet', 1480.0, 4480.0, 'EUR', 1, 'TÜRKİYE'),
  ('0011-00', 'Hesap Raporu Analizi Hazırlanması', '2024-11-01', '2024-10-30', 1.0, 'Adet', null, 2000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0012-00', 'Komple İmalat', '2025-06-11', '2025-06-23', 1.0, 'Adet', 3646.0, 52000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0013-00', 'Komple İmalat', '2025-04-24', '2025-06-11', 1.0, 'Adet', 7744.0, 98750.0, 'EUR', 1, 'TÜRKİYE'),
  ('0014-00', 'Komple İmalat', '2025-01-19', '2025-01-20', 6.0, 'Adet', 186.0, 21000.0, 'TRY', 32.9403, 'TÜRKİYE'),
  ('0015-00', 'Komple İmalat', '2025-01-19', '2025-01-20', 2.0, 'Takım', 86.0, 360.0, 'EUR', 1, 'TÜRKİYE'),
  ('0016-00', 'Komple İmalat', '2025-01-05', '2025-01-05', 4.0, 'Adet', 20.0, 1500.0, 'TRY', 32.9403, 'TÜRKİYE'),
  ('0017-00', 'Komple İmalat', '2024-12-27', '2024-12-26', 1.0, 'Adet', 1735.0, 7000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0018-00', 'Komple İmalat', '2025-03-09', '2025-03-10', 1.0, 'Adet', 573.0, 5000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0019-00', 'Mühendislik ve Tasarım Hizmeti', '2025-03-22', '2025-07-22', 1.0, 'Adet', null, 39000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0021-01', 'Komple İmalat', '2025-05-11', '2025-06-17', 1.0, 'Adet', 1860.0, 650000.0, 'TRY', 46.5778, 'TÜRKİYE'),
  ('0021-02', 'Komple İmalat', '2025-05-11', '2025-06-17', 1.0, 'Adet', 2010.0, 725000.0, 'TRY', 46.5778, 'TÜRKİYE'),
  ('0021-03', 'Komple İmalat', '2025-05-11', '2025-06-17', 1.0, 'Adet', 2378.0, 800000.0, 'TRY', 46.5778, 'TÜRKİYE'),
  ('0022-00', 'Malzeme Satışı', '2025-02-14', '2025-02-14', 3.0, 'Adet', 440.0, null, 'EUR', 1, ''),
  ('0023-01', 'Komple İmalat', '2025-05-17', '2025-05-26', 1.0, 'Adet', 435.0, 4500.0, 'EUR', 1, 'TÜRKİYE'),
  ('0023-02', 'Komple İmalat', '2025-05-17', '2025-05-26', 1.0, 'Adet', 20.0, 1100.0, 'EUR', 1, 'TÜRKİYE'),
  ('0024-00', 'Komple İmalat', '2025-04-18', '2025-04-08', 13.0, 'Adet', 27.0, 34.615385, 'EUR', 1, 'TÜRKİYE'),
  ('0025-00', 'Araba ve Elektrik Hariç', '2025-06-25', '2025-10-22', 1.0, 'Adet', 54650.0, 170000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0026-01', 'Komple İmalat', '2025-06-30', '2025-07-24', 1.0, 'Adet', 33000.0, 208000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0026-02', 'İşçilik', '2025-06-30', '2025-07-24', 1.0, 'Adet', 7000.0, 17000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0027-00', 'Mühendislik ve Tasarım Hizmeti', '2025-06-17', null, 1.0, 'Adet', null, null, 'EUR', 1, 'TÜRKİYE'),
  ('0029-00', 'İşçilik', '2025-06-25', '2025-06-24', 1.0, 'Adet', null, 12500.0, 'TRY', 45.608, 'TÜRKİYE'),
  ('0030-00', 'Malzeme Satışı', '2025-07-05', '2025-07-05', 1.0, 'Adet', null, null, 'EUR', 1, 'TÜRKİYE'),
  ('0031-00', 'İşçilik', null, null, null, 'Adet', null, null, 'EUR', 1, 'TÜRKİYE'),
  ('0032-00', 'Komple İmalat', null, null, 1.0, 'Adet', 935.0, null, 'EUR', 1, 'TÜRKİYE'),
  ('0033-00', 'Malzeme Satışı', '2025-08-22', '2025-08-22', 2.0, 'Adet', null, 345.0, 'EUR', 1, 'TÜRKİYE'),
  ('0035-00', 'Komple İmalat', '2026-02-03', '2026-05-22', 2.0, 'Adet', 7000.0, 237500.0, 'EUR', 1, 'TÜRKİYE'),
  ('0036-00', 'İşçilik', '2025-09-17', '2025-09-16', 1.0, 'Adet', null, 10000.0, 'TRY', 48.5313, 'TÜRKİYE'),
  ('0037-00', 'Komple İmalat', '2025-12-19', '2026-04-24', 1.0, 'Adet', 2516.0, 30000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0038-00', 'Komple İmalat', '2025-10-30', '2025-11-04', 10.0, 'Adet', 0.8, 6800.0, 'TRY', 48.4335, 'TÜRKİYE'),
  ('0039-01', 'Komple İmalat', '2025-12-10', '2026-01-02', 1.0, 'Adet', 751.0, 5000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0039-02', 'Komple İmalat', '2025-12-10', '2026-01-02', 1.0, 'Adet', 441.0, 6000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0040-00', 'Komple İmalat', '2025-12-13', '2025-11-20', 13.0, 'Takım', 28.92, 83.86, 'USD', 1.1579, 'TÜRKİYE'),
  ('0041-00', 'Komple İmalat', '2026-02-11', '2026-02-02', 1.0, 'Adet', 2901.0, 5900.0, 'EUR', 1, 'TÜRKİYE'),
  ('0042-01', 'Komple İmalat', '2025-12-31', '2026-01-13', 3.0, 'Adet', 74.33, 910.0, 'EUR', 1, 'TÜRKİYE'),
  ('0042-02', 'Komple İmalat', '2025-12-31', '2026-01-13', 1.0, 'Adet', 131.0, 1010.0, 'EUR', 1, 'TÜRKİYE'),
  ('0042-03', 'Komple İmalat', '2025-12-31', '2026-01-13', 2.0, 'Adet', 248.0, 1010.0, 'EUR', 1, 'TÜRKİYE'),
  ('0043-00', 'Komple İmalat', '2026-03-30', '2026-06-19', 1.0, 'Adet', 10100.0, 2000000.0, 'TRY', 53.1051, 'TÜRKİYE'),
  ('0044-00', 'Komple İmalat', '2026-02-16', '2026-02-02', 60.0, 'Adet', 0.1, 1.0, 'EUR', 1, 'TÜRKİYE'),
  ('0046-01', 'Komple İmalat', '2026-02-07', '2026-02-16', 1.0, 'Adet', 1410.0, 6000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0046-02', 'Teknolojik Ekipmanlar Hariç', '2026-02-07', '2026-02-16', 1.0, 'Adet', 2480.0, 15250.0, 'EUR', 1, 'TÜRKİYE'),
  ('0047-00', 'Komple İmalat', '2026-03-02', '2026-02-17', 4.0, 'Adet', 1026.25, 945.0, 'EUR', 1, 'TÜRKİYE'),
  ('0048-00', 'Komple İmalat', '2026-03-15', '2026-04-08', 260.0, 'Metre', 64.27, 150.0, 'EUR', 1, 'TÜRKİYE'),
  ('0049-00', 'Komple İmalat', '2026-03-30', '2026-04-13', 1.0, 'Takım', 335.0, 62999.0, 'TRY', 52.0744, 'TÜRKİYE'),
  ('0050-00', 'Komple İmalat', '2026-04-10', '2026-04-13', 1.0, 'Takım', 46.0, 242.0, 'EUR', 1, 'TÜRKİYE'),
  ('0051-00', '', '2026-03-13', '2026-02-23', 20.0, 'Adet', 0.15, 20.0, 'EUR', 1, 'TÜRKİYE'),
  ('0052-00', 'Komple İmalat', '2026-07-19', null, 1.0, 'Adet', 4000.0, 97500.0, 'USD', 1.1836, 'TÜRKİYE'),
  ('0053-01', 'Komple İmalat', '2026-05-30', '2026-06-22', 1.0, 'Adet', 37000.0, 115000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0053-02', 'Komple İmalat', '2026-05-30', '2026-06-22', 1.0, 'Adet', 1968.0, 10000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0054-00', 'Komple İmalat', '2026-04-16', '2026-04-16', 1.0, 'Adet', 3845.0, 9000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0055-00', 'Komple İmalat', '2027-03-01', null, 1.0, 'Adet', 20000.0, 547500.0, 'USD', 1.17, 'TÜRKİYE'),
  ('0057-01', 'Komple İmalat', '2026-08-17', null, 3.0, 'Adet', 3333.333333, 24000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0057-02', 'Komple İmalat', '2026-08-17', null, 3.0, 'Adet', null, 6500.0, 'EUR', 1, 'TÜRKİYE'),
  ('0057-03', 'Komple İmalat', '2026-08-17', null, 3.0, 'Adet', null, 14000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0057-04', 'Komple İmalat', '2026-08-17', null, 1.0, 'Adet', null, 4500.0, 'EUR', 1, 'TÜRKİYE'),
  ('0057-05', 'Komple İmalat', '2026-08-17', null, 1.0, 'Adet', null, 3000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0057-06', 'Komple İmalat', '2026-08-17', null, 1.0, 'Adet', 2180.0, 17000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0057-07', 'Komple İmalat', '2026-08-17', null, 3.0, 'Adet', null, 36000.0, 'EUR', 1, 'TÜRKİYE'),
  ('0057-08', 'Komple İmalat', '2026-08-17', null, 1.0, 'Adet', 53000.0, 94000.0, 'EUR', 1, 'TÜRKİYE')
)
insert into public.job_item_sales (
  job_item_id, scope, due_date, shipment_date, quantity, unit,
  unit_weight_kg, unit_price, currency, fx_rate, shipment_place
)
select
  i.id, s.scope, s.due_date::date, s.shipment_date::date, s.quantity::numeric,
  s.unit, s.unit_weight_kg::numeric, s.unit_price::numeric, s.currency,
  s.fx_rate::numeric, s.shipment_place
from src s
join public.job_items i on i.item_no = s.item_no
on conflict (job_item_id) do nothing;

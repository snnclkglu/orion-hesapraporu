-- TEKLİF ELEKTRİK SİSTEMİ — PLC ve HMI PANEL seçenekleri.
--
-- Kullanıcı kararı (26.08.2026): "Kiriş Boyu Elektrik" satırı kaldırılıp
-- yerine PLC; altına HMI PANEL gelir. Hiçbiri varsayılan değildir: seçilmemiş
-- bir otomasyon modeli müşteriye vaat edilemez.

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.plc', 'SIEMENS S7-1200', 'SIEMENS S7-1200', 10, false),
  ('val.plc', 'SIEMENS S7-1500', 'SIEMENS S7-1500', 20, false)
on conflict do nothing;

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('val.hmiPanel', 'SIEMENS MTP SERİSİ', 'SIEMENS MTP SERISI', 10, false),
  ('val.hmiPanel', 'SIEMENS MTP 7"', 'SIEMENS MTP 7"', 20, false),
  ('val.hmiPanel', 'SIEMENS MTP 9"', 'SIEMENS MTP 9"', 30, false),
  ('val.hmiPanel', 'SIEMENS MTP 11"', 'SIEMENS MTP 11"', 40, false)
on conflict do nothing;

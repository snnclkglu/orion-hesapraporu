-- Müşteri defterine KISALTMA ve RENK.
--
-- Neden: iş emri ve satış listelerinde müşteri sütunu resmî unvanın tamamını
-- taşıyordu ("Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.
-- TİC.LTD.ŞTİ") ve satırın yarısını yiyordu. Listeler artık KISALTMAYI gösterir;
-- resmî unvan iş emrinin kendisinde ve PDF'te olduğu gibi kalır — iş emri
-- basıldığı andaki bilginin fotoğrafıdır, kısaltma yalnız EKRAN kolaylığıdır.
--
-- RENK bir HEX değil AÇI (0–359) olarak saklanır. Gerekçe: renk hem açık hem
-- koyu temada okunmak zorunda; tek bir hex ikisinde birden çalışmaz. Açı
-- saklandığında sunum katmanı aynı tondan açık tema için soluk pastel, koyu
-- tema için koyu pastel üretir (globals.css `.oc-tag`). Böylece "soft pastel"
-- kuralı veriyle değil TANIMLA garanti edilir; kullanıcı tonu değiştirir,
-- pastelliği bozamaz.

alter table public.customers
  add column if not exists short_name text not null default '',
  -- NOT NULL ama VARSAYILANSIZ: değer verilmezse aşağıdaki tetikleyici
  -- (before insert) doldurur, kısıt tetikleyiciden SONRA denetlenir.
  add column if not exists color_hue smallint;

comment on column public.customers.short_name is
  'Liste ekranlarında görünen kısaltma. Boşsa uygulama adın ilk kelimesinden türetir.';
comment on column public.customers.color_hue is
  'Müşteri rengi — OKLCH ton açısı (0–359). Pastel doygunluk/parlaklık sunum katmanındadır.';

-- ---------------------------------------------------------- mevcut kayıtlar
-- Kısaltmalar: kural "adın ilk kelimesi"dir; yalnız ilk kelime tek başına
-- ANLAMSIZ ya da AYIRT EDİCİ olmadığında firmanın bilinen ticari kısaltması
-- yazılır (MAKİNE… → MKE, İSKENDERUN DEMİR VE ÇELİK → İSDEMİR gibi).
update public.customers c set short_name = v.short_name
from (values
  ('ASTOR A.Ş.', 'ASTOR'),
  ('EREĞLİ DEMİR ÇELİK FABRİKALARI T.A.Ş.', 'ERDEMİR'),
  ('GALVASUN GALVANİZ SAN.TİC.İTH.İHR.LTD.ŞTİ.', 'GALVASUN'),
  ('HABAŞ', 'HABAŞ'),
  ('İNFEED OTOMASYON ELEKTRİK ELEKTRONİK SAN.VE TİC.LTD.ŞTİ.', 'İNFEED'),
  ('İSKENDERUN DEMİR VE ÇELİK A.Ş.', 'İSDEMİR'),
  ('İZMİR DEMİR ÇELİK SANAYİ A.Ş.', 'İDÇ'),
  ('KARDEMİR A.Ş.', 'KARDEMİR'),
  ('KARDEMİR ÇELİK SANAYİ A.Ş. (ÇELİKHANE)', 'KARDEMİR ÇH'),
  ('KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.', 'KARÇEL'),
  ('LITEC MAKİNA SAN. VE TİC. A.Ş.', 'LITEC'),
  ('MAKİNE VE KİMYA ENDÜSTRİSİ ANONİM ŞİRKETİ', 'MKE'),
  ('MTC PASLANMAZ', 'MTC'),
  ('ORHUN MAKİNA', 'ORHUN'),
  ('ORiON VİNÇ MÜHENDİSLİK MAKİNA SAN.TİC.LTD.ŞTİ.', 'ORION'),
  ('PİMSUN', 'PİMSUN'),
  ('PLASTIC MASTER PLASTİK SANAYİ VE TİC.LTD.ŞTİ.', 'PLASTIC MASTER'),
  ('SAKA DEMİR ÇELİK SANAYİ VE TİCARET A.Ş.', 'SAKA'),
  ('Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.TİC.LTD.ŞTİ', 'Sİ-MA'),
  ('YALCO DIŞ TİCARET VE MÜMESSİLLİK LTD. ŞTİ.', 'YALCO'),
  ('YILMAZLAR TEMELLİ VİNÇ HİZM. TİC. LTD. ŞTİ.', 'YILMAZLAR')
) as v(name, short_name)
where lower(btrim(c.name)) = lower(btrim(v.name))
  and c.short_name = '';

-- Listede olmayan (sonradan açılmış) kayıtlar: adın ilk kelimesi.
update public.customers
set short_name = split_part(btrim(name), ' ', 1)
where short_name = '' and btrim(name) <> '';

-- Renkler ALTIN AÇIYLA dağıtılır: ardışık iki müşteri renk çemberinde
-- birbirinden en uzak noktalara düşer, komşu satırlar birbirine benzemez.
with sirali as (
  select id, (row_number() over (order by lower(btrim(name))) - 1) as sira
  from public.customers
)
update public.customers c
set color_hue = ((s.sira * 137) % 360)::smallint
from sirali s
where s.id = c.id and c.color_hue is null;

-- ------------------------------------------------------- yeni kayıt varsayılanı
-- Uygulama rengi kendisi seçer (var olanlardan en uzak tonu); bu tetikleyici
-- yalnız uygulama dışından (SQL, içe aktarım) açılan kayıtlar için güvencedir.
create or replace function public.assign_customer_color()
returns trigger
language plpgsql
as $$
declare
  adet integer;
begin
  if new.color_hue is null then
    select count(*) into adet from public.customers;
    new.color_hue := ((adet * 137) % 360)::smallint;
  end if;
  if btrim(coalesce(new.short_name, '')) = '' then
    new.short_name := split_part(btrim(new.name), ' ', 1);
  end if;
  return new;
end;
$$;

drop trigger if exists customers_assign_color on public.customers;
create trigger customers_assign_color
  before insert on public.customers
  for each row execute function public.assign_customer_color();

alter table public.customers alter column color_hue set not null;

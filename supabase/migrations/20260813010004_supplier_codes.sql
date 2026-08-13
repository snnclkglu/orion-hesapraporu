-- TEDARİKÇİ KODU — defter Yönetim'e taşındı ve her firma bir kimlik aldı
--
-- Kullanıcı kararı (13.08.2026): *"Satın Alma bölümündeki tedarikçileri Yönetim
-- bölümüne Tedarikçiler adında bir sayfa ekleyerek oraya taşıyalım. Her
-- tedarikçiye benzersiz bir kod verelim. TD ile başlayabilir."*
--
-- KOD BİR ETİKET DEĞİL, SİPARİŞ NUMARASININ KÖKÜDÜR. `purchase_orders.order_no`
-- bugüne kadar boş bırakılabilen serbest bir metindi ve canlı veride çoğu
-- boştu; sipariş numarası olmayan bir kayıt telefonla teyit edilemez ("hangi
-- siparişi soruyorsunuz?"). Kod firmaya bir kez verilir, sipariş numarası da
-- ondan türer: `TD0007-01`, `TD0007-02`. Öneriyi ekran üretir ve kullanıcı
-- ELLE DEĞİŞTİREBİLİR (`lib/purchasing/order-no.ts`) — devralınan bir numara
-- düzenine geçmek gerektiğinde uygulamanın kuralı yolu kapatmamalıdır.
--
-- NUMARA SIRA SAYACINDAN GELİR, `max()+1`DEN DEĞİL. İki kullanıcı aynı anda
-- firma açtığında `max()+1` ikisine de aynı sayıyı verir ve tekillik indeksi
-- birini düşürürdü; `sequence` bunu veritabanı düzeyinde çözer. Sayaç bir
-- BOŞLUK bırakabilir (silinen firma) ve bu kabul edilmiştir: kod bir sıra
-- numarası değil bir KİMLİKtir, ardışıklığı bir şey ifade etmez.
--
-- AD HÂLÂ `supplier` METNİNDE DURUR (20260813010001'in kuralı): sipariş satırı
-- koda BAĞLANMAZ. Defterdeki bir düzeltme yayınlanmış siparişi değiştirmemeli.

-- ————————————————————————————————————————————————————————— kod sütunu
alter table public.purchase_suppliers
  add column if not exists code text;

-- ————————————————————————————————————————————————————————— sayaç
create sequence if not exists public.purchase_supplier_code_seq;

-- ————————————————————————————————— devralınan 285 firmaya kod ver
--
-- SIRA ADA GÖREdir: kod bir kez verilir ve bir daha değişmez, o yüzden ilk
-- dağıtımın anlaşılır bir düzeni olmalı — alfabetik liste, defteri elinde
-- basılı tutan biri için de okunur.
with sirali as (
  select id, row_number() over (order by name, id) as sira
  from public.purchase_suppliers
  where code is null or btrim(code) = ''
)
update public.purchase_suppliers s
set code = 'TD' || lpad(sirali.sira::text, 4, '0')
from sirali
where s.id = sirali.id;

-- Sayacı en büyük mevcut koddan sonraya al: kalıba UYMAYAN kodlar (elle
-- yazılmış olabilir) sayaca girmez ama tekillik indeksi onları da korur.
select setval(
  'public.purchase_supplier_code_seq',
  greatest(
    1,
    coalesce(
      (select max(substring(code from 3)::bigint)
         from public.purchase_suppliers
        where code ~ '^TD[0-9]+$'),
      0
    )
  ),
  true
);

-- ————————————————————————————————————————————— yeni kayıtta otomatik kod
--
-- VARSAYILAN, TETİKLEYİCİ DEĞİL: `ensureSupplier` sipariş penceresinden yeni
-- firma açarken `code` alanını hiç göndermez ve varsayılan devreye girer.
-- Elle kod veren yönetim ekranı ise değerini gönderir ve varsayılan çalışmaz.
alter table public.purchase_suppliers
  alter column code set default ('TD' || lpad(nextval('public.purchase_supplier_code_seq')::text, 4, '0'));

-- Boş kalan varsa (eski satır) doldur, sonra zorunlu kıl.
update public.purchase_suppliers
set code = 'TD' || lpad(nextval('public.purchase_supplier_code_seq')::text, 4, '0')
where code is null or btrim(code) = '';

alter table public.purchase_suppliers
  alter column code set not null;

create unique index if not exists purchase_suppliers_code_idx
  on public.purchase_suppliers (code);

-- ————————————————————————————————————————— sipariş numarası aranabilir
--
-- TEKİLLİK KISITI KONMADI ve bu bilinçlidir. Numara VARSA benzersiz olmalıdır
-- ama kural UYGULAMADA yaşar (`createOrder` / `editOrder` çakışmayı reddeder):
-- devralınan kayıtlarda numarasız ve elle yazılmış siparişler var, bir `unique`
-- indeks migration'ın KENDİSİNİ düşürebilir ve o an kaybedilen şey bir kayıt
-- değil bütün dağıtımdır. İndeks yalnız aramayı hızlandırır.
create index if not exists purchase_orders_no_idx
  on public.purchase_orders (order_no)
  where btrim(order_no) <> '';

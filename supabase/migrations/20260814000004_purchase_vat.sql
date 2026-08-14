-- SİPARİŞ SATIRINDA KDV — kullanıcı kararı (14.08.2026):
--
--   "Satın alma talep havuzunda sipariş açma bölümüne de Sarf Gideri Gir
--    bölümüyle aynı mantıkla kdv ekleyelim. 20 10 1 ve 0 % kdv olsun. Kullanıcı
--    hep kdv hariç fiyat girer, kdv otomatik gelir. Fiyat arşivi vb diğer
--    grafiklerde her zaman kdv hariç fiyat üzerinden gösterim yapılır."
--
-- ORAN SATIRDADIR, BAŞLIKTA DEĞİL: tek bir siparişte %20'lik bir rulman ile
-- %1'lik bir kalem yan yana durabilir ve başlıkta tutulan tek bir oran onları
-- aynı sayamazdı (sarf fişinde verilen kararın aynısı).
--
-- `unit_price` KDV HARİÇ KALIR ve bu bir sözleşmedir: fiyat arşivi, tedarikçi
-- karşılaştırması ve bütün panolar o sütundan okuyor. KDV yalnız ÖDENECEK
-- tutarı büyütür.
alter table public.purchase_order_lines
  add column if not exists vat_rate numeric(5, 2) not null default 20;

alter table public.purchase_order_lines
  drop constraint if exists purchase_order_lines_vat_rate_check,
  add constraint purchase_order_lines_vat_rate_check
    check (vat_rate in (20, 10, 1, 0));

comment on column public.purchase_order_lines.vat_rate is
  'Satır KDV oranı (%). `unit_price` KDV HARİÇTİR; bu oran yalnız ödenecek '
  'tutarı üretir. Analiz ve fiyat arşivi daima net üzerinden çalışır.';

-- VARSAYILAN GERİYE DE İŞLER ve bu bilinçlidir: KDV kavramı yokken girilmiş
-- bütün fiyatlar zaten KDV HARİÇ yazılmıştı (satınalmacının alışkanlığı) ve
-- firmanın alımlarının olağan oranı %20'dir. Eski satırları oransız bırakmak,
-- ödeme takvimini olduğundan düşük gösterirdi.

-- ————————————————————————————————————————————————— SARF: %0 ORANI EKLENDİ
--
-- İKİ AYRI ORAN LİSTESİ TUTULMAZ (`lib/purchasing/vat.ts`). Sarf %0'ı tanımayıp
-- sipariş tanısaydı aynı modülde aynı soruya iki cevap olurdu. Genişletmedir,
-- daraltma değil: var olan hiçbir satır bu kısıtla geçersizleşmez.
alter table public.purchase_consumable_expenses
  drop constraint if exists purchase_consumable_expenses_vat_rate_check,
  add constraint purchase_consumable_expenses_vat_rate_check
    check (vat_rate is null or vat_rate in (20, 10, 1, 0));

-- ══════════════════════════════════════════════ SİPARİŞ TOPLAMLARI (yeniden)
--
-- Görünüm üç sütun KAZANIR: `total_vat`, `total_gross`, `total_gross_eur`.
-- Var olan sütunlar aynı sırada ve aynı bağıntıyla kalır — `create or replace`
-- yalnız sona sütun eklemeye izin verir ve ödeme günü kuralı (md. 21) hiç
-- değişmedi: ödeme TESLİMDEN sayılır, sipariş tarihinden değil.
create or replace view public.purchase_order_totals
with (security_invoker = true) as
select
  o.id                                            as order_id,
  count(l.id)                                     as line_count,
  coalesce(sum(l.qty), 0)                         as total_qty,
  coalesce(sum(l.received_qty), 0)                as received_qty,
  coalesce(sum(l.qty * coalesce(l.unit_price, 0)), 0) as total_amount,
  case
    when o.fx_rate is null or o.fx_rate = 0 then null
    else coalesce(sum(l.qty * coalesce(l.unit_price, 0)), 0) / o.fx_rate
  end                                             as total_eur,
  case
    when o.payment_term_days = 0 then coalesce(o.received_at, o.due_at)
    else coalesce(o.received_at, o.due_at) + o.payment_term_days
  end                                             as payment_due_at,
  -- KDV satır oranından hesaplanır; başlıkta tek bir oran tutulsaydı karışık
  -- oranlı bir sipariş yanlış toplanırdı.
  coalesce(sum(l.qty * coalesce(l.unit_price, 0) * l.vat_rate / 100), 0)
                                                  as total_vat,
  coalesce(sum(l.qty * coalesce(l.unit_price, 0) * (1 + l.vat_rate / 100)), 0)
                                                  as total_gross,
  case
    when o.fx_rate is null or o.fx_rate = 0 then null
    else coalesce(sum(l.qty * coalesce(l.unit_price, 0) * (1 + l.vat_rate / 100)), 0) / o.fx_rate
  end                                             as total_gross_eur
from public.purchase_orders o
left join public.purchase_order_lines l on l.order_id = o.id
group by o.id, o.fx_rate, o.payment_term_days, o.received_at, o.due_at;

comment on view public.purchase_order_totals is
  'Sipariş toplamları (net · KDV · KDV dahil) ve ödeme günü. Ödeme günü '
  'TESLİMDEN sayılır, sipariş tarihinden değil (kullanıcı kararı).';

-- ═══════════════════════════════════════════ SARF ÖDEME TAKVİMİ (yeniden)
--
-- Ödeme Takvimi artık KDV'yi de GÖSTERİYOR (kullanıcı kararı, 14.08.2026):
-- ödenecek tutarın yanında KDV hariç tutar ve KDV ayrı okunur. Sarf görünümü o
-- iki sayıyı zaten toplayabiliyordu ama dışarı vermiyordu.
create or replace view public.purchase_consumable_payment_schedule
with (security_invoker = true) as
select
  e.payment_group_id,
  min(e.expense_date)                                         as expense_date,
  min(e.due_at)                                              as due_at,
  min(e.payment_due_at)                                      as payment_due_at,
  min(e.payment_method)                                      as payment_method,
  min(e.payment_term_days)                                   as payment_term_days,
  min(e.payment_paid_at)                                     as payment_paid_at,
  min(e.supplier_name)                                       as supplier_name,
  min(e.document_no)                                         as document_no,
  min(e.currency)                                            as currency,
  count(*)::int                                              as line_count,
  sum(e.amount * (1 + e.vat_rate / 100.0))                  as gross_amount,
  sum(e.amount_eur * (1 + e.vat_rate / 100.0))              as gross_amount_eur,
  array_agg(distinct e.item_name order by e.item_name)
    filter (where coalesce(btrim(e.item_name), '') <> '')     as item_names,
  sum(e.amount)                                              as net_amount,
  sum(e.amount_eur)                                          as net_amount_eur,
  sum(e.amount * e.vat_rate / 100.0)                         as vat_amount
from public.purchase_consumable_expenses e
where e.payment_group_id is not null
group by e.payment_group_id;

comment on view public.purchase_consumable_payment_schedule is
  'Ödeme Takvimi için sarf fişi başına tek, KDV dahil ödeme satırı. Alt '
  'giderler ve bütün analizler net kalır.';

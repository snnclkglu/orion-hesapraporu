-- Sarf fişleri net gider olarak analiz edilir; finans takviminde ise KDV dahil
-- ödenecek tutar görünür. Aynı formda girilen çok sayıdaki malzeme tek ödeme
-- fişidir ve `payment_group_id` bunu kararlı biçimde temsil eder.
alter table public.purchase_consumable_expenses
  add column if not exists payment_group_id uuid,
  add column if not exists vat_rate numeric(5, 2),
  add column if not exists due_at date,
  add column if not exists payment_method text,
  add column if not exists payment_term_days int,
  add column if not exists payment_due_at date,
  add column if not exists payment_paid_at date;

alter table public.purchase_consumable_expenses
  drop constraint if exists purchase_consumable_expenses_vat_rate_check,
  add constraint purchase_consumable_expenses_vat_rate_check
    check (vat_rate is null or vat_rate in (1, 10, 20)),
  drop constraint if exists purchase_consumable_expenses_payment_method_check,
  add constraint purchase_consumable_expenses_payment_method_check
    check (payment_method is null or payment_method in ('pesin', 'kredi_karti', 'vadeli')),
  drop constraint if exists purchase_consumable_expenses_payment_term_check,
  add constraint purchase_consumable_expenses_payment_term_check
    check (payment_term_days is null or payment_term_days between 0 and 365),
  drop constraint if exists purchase_consumable_expenses_payment_bundle_check,
  add constraint purchase_consumable_expenses_payment_bundle_check check (
    (payment_group_id is null and vat_rate is null and due_at is null
      and payment_method is null and payment_term_days is null and payment_due_at is null
      and payment_paid_at is null)
    or
    (payment_group_id is not null and vat_rate is not null and due_at is not null
      and payment_method is not null and payment_term_days is not null
      and payment_due_at = due_at + payment_term_days
      and (payment_method = 'vadeli' or payment_term_days = 0)
      and (payment_method <> 'vadeli' or payment_term_days > 0))
  );

create index if not exists purchase_consumable_expenses_payment_group_idx
  on public.purchase_consumable_expenses (payment_group_id)
  where payment_group_id is not null;
create index if not exists purchase_consumable_expenses_payment_due_idx
  on public.purchase_consumable_expenses (payment_due_at, payment_group_id)
  where payment_group_id is not null;

comment on column public.purchase_consumable_expenses.due_at is
  'Beklenen teslim/termin. Sarf ödeme vadesinin başladığı gündür.';
comment on column public.purchase_consumable_expenses.payment_due_at is
  'Termin + ödeme vadesi. Sipariş/alım tarihinden vade hesaplanmaz.';
comment on column public.purchase_consumable_expenses.vat_rate is
  'Yalnız ödeme toplamı için dondurulan satır KDV oranı; gider ve analiz amount/amount_eur üzerinden nettir.';

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
    filter (where coalesce(btrim(e.item_name), '') <> '')     as item_names
from public.purchase_consumable_expenses e
where e.payment_group_id is not null
group by e.payment_group_id;

comment on view public.purchase_consumable_payment_schedule is
  'Ödeme Takvimi için sarf fişi başına tek, KDV dahil ödeme satırı. Alt giderler net kalır.';

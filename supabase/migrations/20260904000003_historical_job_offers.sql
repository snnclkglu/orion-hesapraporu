-- GEÇMİŞ İŞ EMİRLERİ → KAZANILMIŞ TEKLİF ARŞİVİ.
--
-- Teklif bölümü 0064 numaralı iş ile kullanılmaya başlandı. 0001–0063 işleri
-- gerçekte kazanılmış olmasına rağmen teklif kaydı olmadığı için Satış Analizi
-- geçmişi eksik görünüyordu. Bu veri göçü her eski iş için, iş emrinin açılış
-- gününde verilmiş ve aynı gün kazanılmış bir R0 teklif üretir.
--
-- TUTARIN TEK KAYNAĞI Satış Takibi'dir (`job_item_sales`). Fiyatı bulunmayan
-- sekiz eski kalem sıfır sayılmaz: satır ve miktar korunur, birim fiyat ile
-- teklif toplamı NULL kalır. Para birimi dönüştürülmez. Teklifte tek para
-- birimi gerektiği için karışık para birimli bir iş varsa göç açıkça durur.
--
-- GÖÇ TEKRARLANABİLİRDİR: yalnız `offers.job_id` bağı bulunmayan eski işleri
-- alır. Aynı güne ait mevcut tekliflerin `seq` değeri devam ettirilir; örneğin
-- 18.08.2026 tarihindeki mevcut -1 kaydından sonra 0063 işi -2 olur.

do $$
begin
  if exists (
    select 1
    from public.jobs j
    where nullif(substring(j.job_no from '^\s*([0-9]+)'), '')::int < 64
      and j.work_order_date is null
  ) then
    raise exception 'Geçmiş teklif göçü durdu: iş emri tarihi eksik iş var.';
  end if;

  if exists (
    select 1
    from public.jobs j
    where nullif(substring(j.job_no from '^\s*([0-9]+)'), '')::int < 64
      and (j.customer_id is null or j.created_by is null)
  ) then
    raise exception 'Geçmiş teklif göçü durdu: müşteri veya oluşturan bağı eksik iş var.';
  end if;

  if exists (
    select 1
    from public.jobs j
    where nullif(substring(j.job_no from '^\s*([0-9]+)'), '')::int < 64
      and not exists (select 1 from public.job_items i where i.job_id = j.id)
  ) then
    raise exception 'Geçmiş teklif göçü durdu: kalemi olmayan iş var.';
  end if;

  if exists (
    select 1
    from public.jobs j
    join public.job_items i on i.job_id = j.id
    left join public.job_item_sales s on s.job_item_id = i.id
    where nullif(substring(j.job_no from '^\s*([0-9]+)'), '')::int < 64
      and s.job_item_id is null
  ) then
    raise exception 'Geçmiş teklif göçü durdu: Satış Takibi satırı olmayan iş kalemi var.';
  end if;

  if exists (
    select 1
    from public.jobs j
    join public.job_items i on i.job_id = j.id
    join public.job_item_sales s on s.job_item_id = i.id
    where nullif(substring(j.job_no from '^\s*([0-9]+)'), '')::int < 64
    group by j.id
    having count(distinct s.currency) > 1
  ) then
    raise exception 'Geçmiş teklif göçü durdu: tek işte birden çok para birimi var.';
  end if;

  if exists (
    select 1
    from public.jobs j
    join public.job_items i on i.job_id = j.id
    join public.job_item_sales s on s.job_item_id = i.id
    where nullif(substring(j.job_no from '^\s*([0-9]+)'), '')::int < 64
      and s.unit_price is not null
      and s.quantity is null
  ) then
    raise exception 'Geçmiş teklif göçü durdu: fiyatı olup miktarı olmayan iş kalemi var.';
  end if;

  if exists (
    select 1
    from public.offers o
    join public.jobs j on j.id = o.job_id
    where nullif(substring(j.job_no from '^\s*([0-9]+)'), '')::int < 64
    group by j.id
    having count(*) > 1
  ) then
    raise exception 'Geçmiş teklif göçü durdu: aynı eski işe bağlı birden çok teklif var.';
  end if;

  if not exists (
    select 1 from public.jobs
    where id = '69dac3a5-45c7-4f94-ae52-2850b9542014'::uuid and job_no = '0064'
  ) or not exists (
    select 1 from public.offers
    where id = '8926d3aa-659e-4618-825e-f774c1efacc0'::uuid
      and offer_no = 'TETR-20260822-1'
      and (job_id is null or job_id = '69dac3a5-45c7-4f94-ae52-2850b9542014'::uuid)
  ) then
    raise exception '0064 işi ile TETR-20260822-1 sınır kaydı beklenen kimlikte değil.';
  end if;
end
$$;

create temporary table _historical_offer_backfill on commit drop as
with aday as (
  select
    j.*,
    nullif(substring(j.job_no from '^\s*([0-9]+)'), '')::int as root_no
  from public.jobs j
  where nullif(substring(j.job_no from '^\s*([0-9]+)'), '')::int < 64
    and not exists (select 1 from public.offers o where o.job_id = j.id)
),
gunluk_sira as (
  select
    a.*,
    (
      coalesce((
        select max(o.seq)
        from public.offers o
        where o.lang = 'tr' and o.issue_date = a.work_order_date
      ), 0)
      + row_number() over (
          partition by a.work_order_date
          order by a.root_no, a.job_no, a.id
        )
    )::int as offer_seq
  from aday a
),
kalemler as (
  select
    g.id as job_id,
    g.job_no,
    g.title,
    g.customer,
    g.customer_id,
    g.work_order_date,
    g.prepared_by_name,
    g.prepared_by_title,
    g.created_by,
    g.offer_seq,
    coalesce(min(s.currency), 'EUR') as currency,
    case
      when count(*) filter (where s.unit_price is not null) = 0 then null
      else sum(s.quantity * s.unit_price) filter (where s.unit_price is not null)
    end as offer_total,
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', i.id::text,
        'title', i.product_name,
        'titleManual', true,
        'craneType', nullif(btrim(p.crane_type), ''),
        'groups', jsonb_build_array()
      ))
      order by i.sort, i.item_no, i.id
    ) as items,
    jsonb_agg(
      jsonb_build_object(
        'id', 'historical-price-' || i.id::text,
        'itemId', i.id::text,
        'parentLineId', null,
        'description', i.product_name,
        'qty', s.quantity,
        'unit', coalesce(nullif(btrim(s.unit), ''), 'Adet'),
        'unitPrice', s.unit_price,
        'discountPercent', null,
        'inTotal', true,
        'optional', false,
        'hidden', false,
        'manualCost', null,
        'leadTime', ''
      )
      order by i.sort, i.item_no, i.id
    ) as price_lines
  from gunluk_sira g
  join public.job_items i on i.job_id = g.id
  join public.job_item_sales s on s.job_item_id = i.id
  left join public.projects p on p.id = i.project_id
  group by
    g.id, g.job_no, g.title, g.customer, g.customer_id,
    g.work_order_date, g.prepared_by_name, g.prepared_by_title,
    g.created_by, g.offer_seq
)
select
  gen_random_uuid() as offer_id,
  k.job_id,
  k.job_no,
  'TETR-' || to_char(k.work_order_date, 'YYYYMMDD') || '-' || k.offer_seq::text as offer_no,
  k.offer_seq,
  k.work_order_date,
  k.customer_id,
  k.customer,
  k.title,
  k.currency,
  k.offer_total,
  k.created_by,
  (k.work_order_date::timestamp at time zone 'Europe/Istanbul') + interval '12 hours' as historical_at,
  jsonb_build_object(
    'version', 2,
    'issuer', jsonb_build_object(
      'customerId', null,
      'company', '',
      'address', '',
      'taxOffice', '',
      'taxNo', '',
      'phone', '',
      'fax', '',
      'email', '',
      'web', ''
    ),
    'cover', jsonb_build_object(
      'fromName', coalesce(k.prepared_by_name, ''),
      'fromTitle', coalesce(k.prepared_by_title, ''),
      'fromEmail', '',
      'toName', '',
      'toDept', '',
      'toPhone', '',
      'toEmail', '',
      'customerRef', '',
      'greeting', '',
      'intro', '',
      'signatories', jsonb_build_array()
    ),
    'items', k.items,
    'testLoad', jsonb_build_object(
      'enabled', false,
      'title', 'TEST YÜKÜ',
      'position', 'ticari',
      'rows', jsonb_build_array()
    ),
    'terms', jsonb_build_object(
      'title', 'TESLİM VE ÖDEME ŞEKLİ',
      'rows', jsonb_build_array(),
      'paymentLines', jsonb_build_array()
    ),
    'pricing', jsonb_build_object(
      'currency', k.currency,
      'vatIncluded', false,
      'leadTimeUnit', null,
      'lines', k.price_lines,
      'discountTotal', null,
      'total', k.offer_total
    ),
    'notes', jsonb_build_array(),
    'exclusions', jsonb_build_array(),
    'generalTerms', jsonb_build_array(),
    'hiddenSections', jsonb_build_array('terms', 'notes', 'exclusions', 'generalTerms')
  ) as payload
from kalemler k;

insert into public.offers (
  id, offer_no, lang, issue_date, issued_on, expected_on, win_score, won_on,
  seq, customer_id, customer_name, subject, status, currency, job_id,
  created_by, created_at, updated_at
)
select
  offer_id, offer_no, 'tr', work_order_date, work_order_date, work_order_date,
  10, work_order_date, offer_seq, customer_id, customer, title, 'won', currency,
  job_id, created_by, historical_at, historical_at
from _historical_offer_backfill;

insert into public.offer_revisions (
  offer_id, rev_no, label, status, payload, notes,
  created_by, created_at, updated_at, issued_at, issued_by
)
select
  offer_id, 0, 'R0', 'issued', payload,
  'Geçmiş iş emri ve Satış Takibi kayıtlarından oluşturuldu.',
  created_by, historical_at, historical_at, historical_at, created_by
from _historical_offer_backfill;

insert into public.audit_log (actor, action, detail, created_at)
select
  created_by,
  'offer.history.backfill',
  jsonb_build_object(
    'offer_id', offer_id,
    'offer_no', offer_no,
    'job_id', job_id,
    'job_no', job_no,
    'source', 'jobs+job_item_sales'
  ),
  historical_at
from _historical_offer_backfill;

-- 0064 zaten gerçek bir teklife sahipti; yalnız eksik iş emri bağı kurulur.
-- 0065 ve sonrası ile, özellikle henüz iş emri açılmamış TETR-20260902-1 ile
-- ilgili hiçbir kayıt bu göçün kapsamına girmez.
with baglanan as (
  update public.offers
  set job_id = '69dac3a5-45c7-4f94-ae52-2850b9542014'::uuid
  where id = '8926d3aa-659e-4618-825e-f774c1efacc0'::uuid
    and job_id is null
  returning id, offer_no, created_by, issue_date
)
insert into public.audit_log (actor, action, detail, created_at)
select
  created_by,
  'offer.job.link.backfill',
  jsonb_build_object(
    'offer_id', id,
    'offer_no', offer_no,
    'job_id', '69dac3a5-45c7-4f94-ae52-2850b9542014',
    'job_no', '0064'
  ),
  (issue_date::timestamp at time zone 'Europe/Istanbul') + interval '12 hours'
from baglanan;

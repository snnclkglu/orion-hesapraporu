-- TEKLİF ANALİZİ — KAZANILAN İŞLERİN GERÇEKLEŞME TARİHİ.
--
-- `updated_at` kazanılma tarihi değildir: teklif kazanıldıktan sonra konu ya
-- da müşteri künyesi düzeltilirse değişir. Aylık gerçekleşme grafiğinin
-- oynak bir bakım tarihine dayanmasını önlemek için karar günü ayrı tutulur.

alter table public.offers
  add column if not exists won_on date;

-- Geçmiş kayıt yalnız denetim defterinde açık bir "won" geçişi varsa
-- doldurulur. İz yoksa teklif tarihi/son güncelleme gibi bir değer tahmin
-- edilmez; ekran onu "tarihi eksik" olarak gösterir.
--
-- `touch_offers` bu tarihsel tamamlama sırasında updated_at'i bugüne çekmesin.
alter table public.offers disable trigger touch_offers;

with won_events as (
  select
    (detail ->> 'offer_id')::uuid as offer_id,
    max(created_at::date) as won_on
  from public.audit_log
  where (detail ->> 'offer_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      detail ->> 'yeni' = 'won'
      or detail #>> '{yeni,status}' = 'won'
    )
  group by (detail ->> 'offer_id')::uuid
)
update public.offers o
set won_on = e.won_on
from won_events e
where o.id = e.offer_id
  and o.status = 'won'
  and o.won_on is null;

alter table public.offers enable trigger touch_offers;

alter table public.offers
  drop constraint if exists offers_won_on_status_check,
  add constraint offers_won_on_status_check
    check (status = 'won' or won_on is null);

comment on column public.offers.won_on is
  'Teklifin Kazanıldı durumuna geçtiği gün. Aylık kazanılan işler analizi bundan okunur; bilinmiyorsa boştur.';

create index if not exists offers_won_on_idx
  on public.offers (won_on desc)
  where status = 'won';

-- Uygulama dışındaki güvenilir yazma yolları da karar gününü korur. Yalnız
-- gerçek bir durum geçişinde bugün önerilir; tarihi bilinmeyen eski bir
-- kazanılmış teklif sıradan bir künye güncellemesiyle bugüne taşınmaz.
create or replace function public.sync_offer_won_on()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'won' then
    new.won_on := null;
  elsif tg_op = 'INSERT' or old.status is distinct from 'won' then
    new.won_on := coalesce(new.won_on, current_date);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_offer_won_on on public.offers;
create trigger sync_offer_won_on
  before insert or update on public.offers
  for each row execute function public.sync_offer_won_on();

-- Ortak liste yeni alanı da taşır; teklif listesi, detay ve analiz aynı
-- defter satırını okumaya devam eder.
drop view if exists public.offer_list;

create view public.offer_list
with (security_invoker = true) as
select
  o.id,
  o.offer_no,
  o.lang,
  o.issue_date,
  o.issued_on,
  o.expected_on,
  o.win_score,
  o.won_on,
  o.seq,
  o.customer_id,
  o.customer_name,
  o.subject,
  o.status,
  o.currency,
  o.job_id,
  o.created_by,
  o.created_at,
  o.updated_at,
  r.id            as latest_revision_id,
  r.rev_no        as latest_rev_no,
  r.status        as latest_rev_status,
  r.total_amount  as latest_total,
  r.updated_at    as latest_updated_at,
  coalesce(jsonb_path_query_array(r.payload, '$.items[*].craneType'), '[]'::jsonb) as crane_types,
  coalesce(jsonb_path_query_array(r.payload, '$.items[*].capacityT'), '[]'::jsonb) as capacities_t,
  coalesce(jsonb_array_length(r.payload -> 'items'), 0) as item_count
from public.offers o
left join lateral (
  select ov.*
  from public.offer_revisions ov
  where ov.offer_id = o.id
  order by ov.rev_no desc
  limit 1
) r on true;

comment on view public.offer_list is
  'Teklif listesi: defter satırı + güncel revizyon özeti; takip, projeksiyon ve kazanılan işler analizi aynı kaynaktan okur.';

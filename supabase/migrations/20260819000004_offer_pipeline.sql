-- TEKLİF ANALİZİ — kazanma puanı ve BEKLENEN İŞLER defteri.
--
-- Kullanıcı isteği (17.08.2026): *"açık teklifler ve bu tekliflerin sıcaklık
-- soğukluk oranına göre projeksiyon yapacağım. Tekliflere 1-10 arası puan verip
-- yakınlığını belirleyeyim … ben yakında hızlıca verebileceğim teklifi kısa bir
-- satır olarak buraya ekleyebileyim. Henüz o teklifi vermemiş olabilirim ama
-- vereceğimi biliyor oluyor bazı durumlarda."*
--
-- İKİ AYRI OLGU, İKİ AYRI YER:
--
--   `offers.win_score`  — VERİLMİŞ bir teklifin kazanılma yakınlığı. Teklifin
--                         kendi alanıdır çünkü teklif zaten vardır; ayrı bir
--                         tabloya konsaydı her teklif için boş bir satır
--                         doğar ya da satırsız teklifler oluşurdu.
--
--   `offer_leads`       — HENÜZ VERİLMEMİŞ, verileceği bilinen iş. Teklif
--                         DEĞİLDİR: numarası, belgesi, revizyonu yoktur.
--                         `offers`a boş bir kayıt açmak, teklif numarası
--                         zincirini gerçekte var olmayan belgelerle
--                         doldururdu — numara müşteriyle yazışmada geçen bir
--                         referanstır, bir niyet kaydı değil.
--
-- Beklenen iş teklife dönüştüğünde satır SİLİNMEZ, `offer_id` ile bağlanır ve
-- pasife alınır: projeksiyonun geçmişi, tahminin ne kadar tuttuğunu gösteren
-- tek kayıttır.

alter table public.offers
  add column if not exists win_score smallint
    check (win_score is null or (win_score between 1 and 10)),
  -- Kararın BEKLENDİĞİ tarih — projeksiyon dönemi bundan okunur. Teslim ya da
  -- geçerlilik süresiyle karıştırılmaz: o ikisi belgenin maddesidir, bu
  -- kullanıcının beklentisidir ve boş kalabilir.
  add column if not exists expected_on date;

comment on column public.offers.win_score is
  'Kazanma yakınlığı 1–10 (kullanıcı takdiri). Boş = puanlanmamış; projeksiyona GİRMEZ.';
comment on column public.offers.expected_on is
  'Kararın beklendiği tarih — projeksiyon dönemi bundan okunur.';

create index if not exists offers_expected_on_idx
  on public.offers (expected_on) where expected_on is not null;

-- ————————————————————————————————————————————————————— offer_leads
create table if not exists public.offer_leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  -- Defterde olmayan bir firma için de satır açılabilmelidir: beklenen iş
  -- çoğu zaman bir telefon görüşmesidir ve müşteriyi deftere yazmak için
  -- yeterli bilgi henüz yoktur. Ad SERBEST METİNDİR ve bu bilinçli bir
  -- gevşemedir (teklifin kendisinde defter ZORUNLUdur).
  customer_name text not null default '',
  subject text not null default '',
  expected_on date,
  amount numeric,
  currency text not null default 'EUR',
  win_score smallint check (win_score is null or (win_score between 1 and 10)),
  notes text not null default '',
  active boolean not null default true,
  -- Teklife dönüştüyse bağ; satır silinmez, pasife alınır.
  offer_id uuid references public.offers (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offer_leads_expected_idx
  on public.offer_leads (expected_on) where active;
create index if not exists offer_leads_customer_idx
  on public.offer_leads (customer_id);

drop trigger if exists touch_offer_leads on public.offer_leads;
create trigger touch_offer_leads before update on public.offer_leads
  for each row execute function public.touch_updated_at();

comment on table public.offer_leads is
  'Henüz verilmemiş ama verileceği bilinen işler — teklif analizi projeksiyonunun ikinci kaynağı.';

alter table public.offer_leads enable row level security;

drop policy if exists offer_leads_select on public.offer_leads;
drop policy if exists offer_leads_write on public.offer_leads;

create policy offer_leads_select on public.offer_leads
  for select to authenticated using (public.can_see_offers());
create policy offer_leads_write on public.offer_leads
  for all to authenticated
  using (public.can_edit_offers()) with check (public.can_edit_offers());

-- Görünüm puanı ve beklenen tarihi de taşımalı.
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
  'Teklif listesi: defter satırı + GÜNCEL revizyonun özeti. Liste, takip sayacı ve analiz sayfası buradan okur.';

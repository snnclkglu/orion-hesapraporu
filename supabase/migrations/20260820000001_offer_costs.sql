-- MALİYET ÇALIŞMASI — teklifin İÇ yüzü: ağırlık, boyutlandırma ve maliyet.
--
-- NEDEN AYRI TABLO. `offer_revisions.payload` içine bir `cost` bloğu eklemek
-- daha az iş olurdu ve iki şeyi birden bozardı:
--
--   1. MÜŞTERİYE GİDEN BELGE ile maliyet aynı nesnede dururdu. Teklif PDF'ini
--      basan yolda tek bir gözden kaçma marjımızı müşteriye yazdırırdı;
--      koruma tek bir süzgeç fonksiyonunun doğruluğuna kalırdı. Ayrı tablo
--      bunu YAPISAL olarak imkânsız kılar — teklif payload'ında maliyet diye
--      bir alan yoktur.
--   2. YAYIMLANMIŞ TEKLİF REVİZYONU KİLİTLİDİR (`guard_issued_offer_revision`).
--      Maliyet ise teklif gönderildikten SONRA da güncellenir: tedarikçi
--      fiyatı değişir, montaj keşfi netleşir. Aynı nesnede olsalardı maliyeti
--      düzeltmek için müşteriye hiç gitmemiş bir R1 açmak gerekirdi.
--
-- REVİZYON ZİNCİRİ AYRIDIR ama BAĞI KAYITLIDIR (kullanıcı kararı, 17.08.2026).
-- Maliyetin kendi M0/M1/M2 zinciri, kendi yayımı ve kendi kilidi vardır;
-- `payload.sourceRevNo` hangi teklif revizyonundan kurulduğunu söyler. Teklif
-- R1'e geçip maliyet M0'da kalırsa ekran bunu yazar — sessiz bir ayrışma kâr
-- marjını yanlış gösterirdi.
--
-- ŞABLON TABLOSU YOKTUR ve bu bilinçlidir. Maliyet iskeleti teklif kaleminin
-- KENDİ bölümlerinden türer (`costGroupKeysForOfferItem`): yardımcı kaldırması
-- olan bir vinçte maliyette de o grup açılır. Ayrı bir şablon defteri
-- `offer_templates` ile er geç ayrışır ve kullanıcıya aynı soruyu (hangi vinç
-- tipi) ikinci kez sordururdu — TEKLIF-32'nin tam tersi.

-- ---------------------------------------------------------------- yetki
-- Maliyet KÂR MARJI taşır: teklif fiyatından bir adım daha içeridedir.
-- Bugün teklifle aynı kümedir (Yönetici · Müdür) ama AYRI SORULUR
-- (`can_edit_purchasing` deseni): "müdür teklifi görür, maliyeti görmez"
-- ayrımı istenirse tek satır değişmesi yeter ve çağrı yerleri gözden
-- geçirilmek zorunda kalmaz.
create or replace function public.can_see_offer_costs()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_see_offers();
$$;

create or replace function public.can_edit_offer_costs()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_edit_offers();
$$;

-- -------------------------------------------------- offer_cost_revisions
create table if not exists public.offer_cost_revisions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  rev_no int not null,
  -- M0 · M1 — teklifin R0/R1'inden AYRI harflenir ki iki zincir ekranda
  -- birbirine karışmasın ("R1'in maliyeti M1'dir" gibi bir eşleşme YOKTUR).
  label text not null default '',
  status public.revision_status not null default 'draft',
  -- BELGENİN TAMAMI: model katsayıları, kalemler, girdiler, elle ezilen
  -- değerler, maliyet satırları, proje geneli ve oranlı gruplar.
  payload jsonb not null default '{}'::jsonb,
  -- TOPLAM TÜRETİLİR, elle yazılmaz. İki sütun çünkü iki ayrı soru var:
  -- `direct_amount` oranların TABANIDIR (proje maliyeti), `total_amount`
  -- müşteriye verilen fiyatla karşılaştırılan sayıdır.
  direct_amount numeric generated always as
    (nullif(payload #>> '{direct}', '')::numeric) stored,
  total_amount numeric generated always as
    (nullif(payload #>> '{total}', '')::numeric) stored,
  notes text not null default '',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references public.profiles (id),
  unique (offer_id, rev_no)
);

create index if not exists offer_cost_revisions_offer_idx
  on public.offer_cost_revisions (offer_id, rev_no desc);

comment on table public.offer_cost_revisions is
  'Teklifin İÇ maliyet çalışması: ağırlık modeli, boyutlandırma ve maliyet kalemleri. Müşteriye giden belgeden AYRIDIR.';

-- YAYIMLANMIŞ MALİYET DEĞİŞTİRİLEMEZ VE SİLİNEMEZ.
--
-- "Yayım" burada müşteriye göndermek değil, KARARI DONDURMAK demektir: bu
-- fiyatı bu maliyetle verdik. Sonradan düzeltilirse geçmişe dönük olarak
-- "aslında kârlıydı" denebilir ve teklif kararlarının denetimi imkânsızlaşır.
-- Geri çekme kapısı teklifteki ikizinin aynısıdır (`guard_issued_offer_revision`,
-- migration 20260819000009): yalnız durum ve yayım damgaları değişebilir,
-- payload AYNI KALMAK ZORUNDADIR — SQL bir niyet okuyamaz, alanların
-- aynılığına bakar.
create or replace function public.guard_issued_offer_cost()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then
      raise exception 'Yayınlanmış maliyet revizyonu silinemez';
    end if;
    return old;
  end if;

  if old.status = 'issued' then
    if new.status = 'draft'
       and new.issued_at is null
       and new.issued_by is null
       and new.offer_id   = old.offer_id
       and new.rev_no     = old.rev_no
       and new.label      = old.label
       and new.notes      is not distinct from old.notes
       and new.payload    = old.payload
       and new.created_by = old.created_by then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'Yayınlanmış maliyet revizyonu değiştirilemez; yeni revizyon oluşturun';
  end if;

  if new.status = 'issued' and old.status = 'draft' then
    new.issued_at := now();
    new.issued_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_issued_offer_cost on public.offer_cost_revisions;
create trigger guard_issued_offer_cost
  before update or delete on public.offer_cost_revisions
  for each row execute function public.guard_issued_offer_cost();

-- ------------------------------------------------------------------- RLS
alter table public.offer_cost_revisions enable row level security;

drop policy if exists offer_costs_select on public.offer_cost_revisions;
drop policy if exists offer_costs_insert on public.offer_cost_revisions;
drop policy if exists offer_costs_update on public.offer_cost_revisions;
drop policy if exists offer_costs_delete on public.offer_cost_revisions;

create policy offer_costs_select on public.offer_cost_revisions
  for select to authenticated using (public.can_see_offer_costs());
create policy offer_costs_insert on public.offer_cost_revisions
  for insert to authenticated
  with check (public.can_edit_offer_costs() and created_by = (select auth.uid()));
create policy offer_costs_update on public.offer_cost_revisions
  for update to authenticated
  using (public.can_edit_offer_costs()) with check (public.can_edit_offer_costs());
create policy offer_costs_delete on public.offer_cost_revisions
  for delete to authenticated using (public.can_edit_offer_costs());

-- ------------------------------------------------------- offer_cost_list
-- TEKLİF LİSTESİNİN VE PANELİN MALİYET ÖZETİ.
--
-- `offer_list` görünümüne sütun EKLENMEDİ ve bu bilinçlidir: o görünüm teklif
-- bölümünün her yerinde okunuyor ve maliyeti oraya koymak, kâr marjını
-- ileride teklifi görebilen ama maliyeti göremeyen bir role de taşırdı.
-- Ayrı görünüm, ayrı yetki sorusu.
--
-- `security_invoker` ZORUNLUDUR: onsuz görünüm sahibinin yetkisiyle çalışır ve
-- `can_see_offer_costs()` politikası devre dışı kalırdı.
create or replace view public.offer_cost_list
with (security_invoker = true) as
select
  o.id as offer_id,
  c.id            as latest_cost_id,
  c.rev_no        as latest_cost_rev_no,
  c.status        as latest_cost_status,
  c.direct_amount as latest_direct,
  c.total_amount  as latest_total,
  c.updated_at    as latest_updated_at,
  -- Maliyet HANGİ teklif revizyonuna göre kuruldu — panel bunu teklifin
  -- güncel revizyonuyla karşılaştırıp "maliyet geride kaldı" diyebilsin.
  nullif(c.payload #>> '{sourceRevNo}', '')::int as source_rev_no
from public.offers o
left join lateral (
  select cv.*
  from public.offer_cost_revisions cv
  where cv.offer_id = o.id
  order by cv.rev_no desc
  limit 1
) c on true;

comment on view public.offer_cost_list is
  'Teklif başına GÜNCEL maliyet revizyonunun özeti. offer_list''ten AYRIDIR: maliyet ayrı bir yetki sorusudur.';

-- --------------------------------------------------------------- storage
-- Yayımlanan maliyet çalışmasının İÇ BELGE arşivi. Yol:
--   {offer_id}/{offer_no}-M{rev}.pdf
-- Okuma `offers` kovasından DAHA DAR: teklif PDF'ini görebilen herkes değil,
-- yalnız maliyeti görebilen okur.
insert into storage.buckets (id, name, public)
values ('offer-costs', 'offer-costs', false)
on conflict (id) do nothing;

drop policy if exists "offer-costs okuma (maliyet yetkisi)" on storage.objects;
drop policy if exists "offer-costs yükleme (maliyet yetkisi)" on storage.objects;
drop policy if exists "offer-costs güncelleme (maliyet yetkisi)" on storage.objects;

create policy "offer-costs okuma (maliyet yetkisi)"
on storage.objects for select to authenticated
using (bucket_id = 'offer-costs' and public.can_see_offer_costs());

create policy "offer-costs yükleme (maliyet yetkisi)"
on storage.objects for insert to authenticated
with check (bucket_id = 'offer-costs' and public.can_edit_offer_costs());

create policy "offer-costs güncelleme (maliyet yetkisi)"
on storage.objects for update to authenticated
using (bucket_id = 'offer-costs' and public.can_edit_offer_costs())
with check (bucket_id = 'offer-costs' and public.can_edit_offer_costs());

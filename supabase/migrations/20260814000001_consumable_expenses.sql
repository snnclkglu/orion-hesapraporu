-- SARF GİDERLERİ — fabrika geneli, herhangi bir projeye bağlı olmayan alımlar.
--
-- Bu kayıtlar `purchase_orders`a yazılmaz. Sipariş tablosu canlı teslim/ödeme
-- akışıdır; eski faturaları oraya taşımak geçmişte binlerce "bekleyen sipariş"
-- üretirdi. Sarf gideri kendi defterinde yaşar, satın alma tedarikçi defterini
-- ortak kullanır ve bütün karşılaştırmalar satırda DONDURULAN avro karşılığıyla
-- yapılır.
--
-- PARA SÖZLEŞMESİ mevcut satın alma modülüyle aynıdır:
--   fx_rate = 1 EUR kaç `currency`; amount_eur = amount / fx_rate.
-- `amount` yerel para birimindeki YETKİLİ toplamdır. Miktar × birim fiyat tekrar
-- hesaplanıp bu toplamın üstüne yazılmaz; devralınan belgede iskonto/yuvarlama
-- bulunabilir. Negatif tutar da bilinçli olarak yasaklanmaz: iade/mahsup satırı
-- tarihsel veride gerçek bir mali olay olabilir.

-- ═════════════════════════════════════════════ 1. AYRI YETKİ SORULARI
--
-- Satın Alma'nın genel kapısı Yönetici + Satın Alma + Planlama'dır. Kullanıcı
-- sarf giderini yalnız Yönetici ve Satın Alma'nın değiştirmesini istediği için
-- bu alt alanın YAZMA sorusu daha dardır. Planlama kayıt ve analizleri görür,
-- ekleyemez/düzenleyemez/silemez.
create or replace function public.can_see_consumable_expenses()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'purchasing', 'planning')
  );
$$;

create or replace function public.can_edit_consumable_expenses()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'purchasing')
  );
$$;

comment on function public.can_see_consumable_expenses() is
  'Sarf gideri okuma: Yönetici · Satın Alma · Planlama.';
comment on function public.can_edit_consumable_expenses() is
  'Sarf gideri yazma/silme: yalnız Yönetici · Satın Alma.';

-- ════════════════════════════════════════════════ 2. SARF MALZEME DEFTERİ
--
-- Kod sequence'ten gelir; `max()+1` eşzamanlı iki kayıtta çakışırdı. Sequence
-- boşluk bırakabilir ve bu kabul edilir: SM kodu sıra değil değişmez kimliktir.
create sequence if not exists public.purchase_consumable_item_code_seq;

create table if not exists public.purchase_consumable_items (
  id uuid primary key default gen_random_uuid(),
  code text not null default (
    'SM' || lpad(nextval('public.purchase_consumable_item_code_seq')::text, 4, '0')
  ),

  -- Görünen ad büyük harfli tutulur; `match_key` Türkçe katlanmış tekillik
  -- anahtarıdır. Normalleştirme uygulamada `consumableMatchKey` sözleşmesiyle
  -- yapılır (NFKC, tr-TR büyük, noktalama/boşluk ve çap işareti katlama).
  name text not null,
  match_key text not null,
  group_name text not null default '',
  default_unit text not null default 'Adet',
  active boolean not null default true,
  note text not null default '',

  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_consumable_items_code_format
    check (code ~ '^SM[0-9]+$'),
  constraint purchase_consumable_items_name_nonempty
    check (btrim(name) <> ''),
  constraint purchase_consumable_items_key_nonempty
    check (btrim(match_key) <> ''),
  constraint purchase_consumable_items_unit_nonempty
    check (btrim(default_unit) <> '')
);

alter sequence public.purchase_consumable_item_code_seq
  owned by public.purchase_consumable_items.code;

create unique index if not exists purchase_consumable_items_code_idx
  on public.purchase_consumable_items (code);
create unique index if not exists purchase_consumable_items_key_idx
  on public.purchase_consumable_items (match_key);
create index if not exists purchase_consumable_items_active_name_idx
  on public.purchase_consumable_items (active, name);
create index if not exists purchase_consumable_items_group_idx
  on public.purchase_consumable_items (group_name, name)
  where btrim(group_name) <> '';

comment on table public.purchase_consumable_items is
  'Yönetim > Sarf Malzemeler ana defteri. SM kodu değişmez; kullanılan kayıt '
  'silinmek yerine pasife alınır.';
comment on column public.purchase_consumable_items.match_key is
  'Malzeme adının consumableMatchKey ile üretilen teknik tekillik anahtarı.';

-- ═══════════════════════════════════════════════════ 3. SARF GİDER DEFTERİ
create table if not exists public.purchase_consumable_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,

  -- Master bağları seçimi hızlandırır; snapshot alanları tarihsel belgeyi
  -- korur. Malzeme silinemez (RESTRICT), tedarikçi silinse bile adı snapshotta
  -- kalır (SET NULL). Eski Excel'de Tanım'ı boş 101 satır bulunduğu için
  -- `item_id` ve iki malzeme snapshotı NULL/boş kalabilir. Canlı form bunları
  -- uygulama şemasında zorunlu tutar; import hiçbir satırı sessizce düşürmez.
  item_id uuid references public.purchase_consumable_items (id) on delete restrict,
  item_code text,
  item_name text,
  group_name text not null default '',

  supplier_id uuid references public.purchase_suppliers (id) on delete set null,
  supplier_name text not null default '',

  document_no text not null default '',
  department text not null default '',
  quantity numeric(18, 4),
  unit text not null default '',
  unit_price numeric(20, 6),
  note text not null default '',

  -- Yerel para birimindeki yetkili toplam; işaretli olması serbesttir.
  amount numeric(20, 4) not null,
  currency text not null default 'TRY',
  fx_rate numeric(18, 8) not null,
  fx_rate_date date,
  fx_source text not null default 'manual',
  amount_eur numeric(24, 6) generated always as (amount / fx_rate) stored,

  -- Import kalite işaretleri kapanıp kaybolmaz; ekran bunları süzebilir ve
  -- kullanıcıya açıklayabilir. Liste genişletilebilir, DB enumuna kapatılmaz.
  -- Bilinen ilk değerler: blank_supplier, blank_item, duplicate_candidate,
  -- period_mismatch, fx_outlier.
  quality_flags text[] not null default '{}'::text[],

  -- Excel'in yorumlanmayan bütün hücrelerinin ham, denetlenebilir fotoğrafı.
  -- Canonical alanlar sonradan düzeltilebilir; ham kaynak değiştirilemez.
  legacy_payload jsonb not null default '{}'::jsonb,
  source text not null default 'app',
  source_ref text,

  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_consumable_expenses_currency_check
    check (currency in ('TRY', 'EUR', 'USD')),
  constraint purchase_consumable_expenses_fx_positive
    check (fx_rate > 0),
  constraint purchase_consumable_expenses_eur_rate
    check (currency <> 'EUR' or fx_rate = 1),
  constraint purchase_consumable_expenses_item_snapshot
    check (
      item_id is null
      or (
        coalesce(btrim(item_code), '') <> ''
        and coalesce(btrim(item_name), '') <> ''
      )
    ),
  constraint purchase_consumable_expenses_fx_source_nonempty
    check (btrim(fx_source) <> ''),
  constraint purchase_consumable_expenses_source_nonempty
    check (btrim(source) <> '' and source = btrim(source)),
  constraint purchase_consumable_expenses_source_ref_valid
    check (source_ref is null or (btrim(source_ref) <> '' and source_ref = btrim(source_ref))),
  constraint purchase_consumable_expenses_import_has_ref
    check (source = 'app' or source_ref is not null),
  constraint purchase_consumable_expenses_payload_object
    check (jsonb_typeof(legacy_payload) = 'object')
);

-- En yeni gider önce; aynı tarihli kayıtların sırası da her okumada aynıdır.
create index if not exists purchase_consumable_expenses_date_idx
  on public.purchase_consumable_expenses (expense_date desc, created_at desc, id);
create index if not exists purchase_consumable_expenses_item_date_idx
  on public.purchase_consumable_expenses (item_id, expense_date desc)
  where item_id is not null;
create index if not exists purchase_consumable_expenses_supplier_date_idx
  on public.purchase_consumable_expenses (supplier_id, expense_date desc)
  where supplier_id is not null;
create index if not exists purchase_consumable_expenses_group_date_idx
  on public.purchase_consumable_expenses (group_name, expense_date desc)
  where btrim(group_name) <> '';
create index if not exists purchase_consumable_expenses_source_date_idx
  on public.purchase_consumable_expenses (source, expense_date desc);
create index if not exists purchase_consumable_expenses_quality_flags_idx
  on public.purchase_consumable_expenses using gin (quality_flags);

-- `app` satırında source_ref NULL olabilir. Import satırının kaynak içindeki
-- kimliği zorunlu ve tekildir; migration yeniden çalışırsa aynı olay ikinci
-- kez yazılamaz.
create unique index if not exists purchase_consumable_expense_source_ref
  on public.purchase_consumable_expenses (source, source_ref)
  where source_ref is not null;

comment on table public.purchase_consumable_expenses is
  'Projeye bağlı olmayan fabrika sarf alımları. Yerel toplam yetkilidir; '
  'amount_eur kayıt anındaki satır kurundan türetilip saklanır.';
comment on column public.purchase_consumable_expenses.amount is
  'Belgenin kendi para birimindeki yetkili satır toplamı; iade/mahsup için negatif olabilir.';
comment on column public.purchase_consumable_expenses.fx_rate is
  '1 EUR kaç currency. EUR kaydında 1; geçmiş kayıtta sonradan değiştirilmeden saklanır.';
comment on column public.purchase_consumable_expenses.legacy_payload is
  'Devralınan satırın yorumlanmayan ham alanları; insert sonrasında değiştirilemez.';
comment on column public.purchase_consumable_expenses.quality_flags is
  'Import kalite işaretleri; ör. blank_item, duplicate_candidate, period_mismatch.';

-- ════════════════════════════════════════════ 4. AKTÖR / ZAMAN / KİMLİK KORUMASI
--
-- Authenticated istekte aktörü istemcinin gönderdiği UUID değil JWT belirler.
-- Migration/service-role bağlamında auth.uid() NULL'dır; import bu yüzden NULL
-- aktörle güvenle çalışabilir. `updated_at` evin ortak trigger'ıyla tutulur.
create or replace function public.stamp_purchase_consumable_actor()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is not null then
    if tg_op = 'INSERT' then
      new.created_by := actor_id;
    end if;
    new.updated_by := actor_id;
  end if;
  return new;
end;
$$;

create or replace function public.guard_purchase_consumable_item_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.code is distinct from old.code
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Sarf malzemenin kimlik/kod/oluşturma alanları değiştirilemez.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_purchase_consumable_expense_provenance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.source is distinct from old.source
     or new.source_ref is distinct from old.source_ref
     or new.legacy_payload is distinct from old.legacy_payload
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Sarf giderinin kaynak ve oluşturma alanları değiştirilemez.';
  end if;
  return new;
end;
$$;

-- Canlı action boş belge/bölüm/notu NULL gönderse de tabloda iki ayrı "boş"
-- temsili yaşatmayız. Trigger constraintlerden önce çalışır; import ve uygulama
-- aynı canonical sözleşmeye düşer.
create or replace function public.normalize_purchase_consumable_expense_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.document_no := coalesce(new.document_no, '');
  new.department := coalesce(new.department, '');
  new.note := coalesce(new.note, '');
  return new;
end;
$$;

drop trigger if exists guard_purchase_consumable_item_identity
  on public.purchase_consumable_items;
create trigger guard_purchase_consumable_item_identity
  before update on public.purchase_consumable_items
  for each row execute function public.guard_purchase_consumable_item_identity();

drop trigger if exists guard_purchase_consumable_expense_provenance
  on public.purchase_consumable_expenses;
create trigger guard_purchase_consumable_expense_provenance
  before update on public.purchase_consumable_expenses
  for each row execute function public.guard_purchase_consumable_expense_provenance();

drop trigger if exists normalize_purchase_consumable_expense_text
  on public.purchase_consumable_expenses;
create trigger normalize_purchase_consumable_expense_text
  before insert or update on public.purchase_consumable_expenses
  for each row execute function public.normalize_purchase_consumable_expense_text();

drop trigger if exists stamp_purchase_consumable_items_actor
  on public.purchase_consumable_items;
create trigger stamp_purchase_consumable_items_actor
  before insert or update on public.purchase_consumable_items
  for each row execute function public.stamp_purchase_consumable_actor();

drop trigger if exists stamp_purchase_consumable_expenses_actor
  on public.purchase_consumable_expenses;
create trigger stamp_purchase_consumable_expenses_actor
  before insert or update on public.purchase_consumable_expenses
  for each row execute function public.stamp_purchase_consumable_actor();

drop trigger if exists touch_purchase_consumable_items
  on public.purchase_consumable_items;
create trigger touch_purchase_consumable_items
  before update on public.purchase_consumable_items
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_purchase_consumable_expenses
  on public.purchase_consumable_expenses;
create trigger touch_purchase_consumable_expenses
  before update on public.purchase_consumable_expenses
  for each row execute function public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════ 5. RLS
alter table public.purchase_consumable_items enable row level security;
alter table public.purchase_consumable_expenses enable row level security;

drop policy if exists purchase_consumable_items_select
  on public.purchase_consumable_items;
create policy purchase_consumable_items_select
  on public.purchase_consumable_items
  for select to authenticated
  using (public.can_see_consumable_expenses());

-- Satın Alma hızlı giriş ekranından yeni malzeme AÇABİLİR. Ana defterde ad,
-- grup ve aktiflik değiştirmek veya silmek Yönetim işidir.
drop policy if exists purchase_consumable_items_insert
  on public.purchase_consumable_items;
create policy purchase_consumable_items_insert
  on public.purchase_consumable_items
  for insert to authenticated
  with check (public.can_edit_consumable_expenses());

drop policy if exists purchase_consumable_items_update
  on public.purchase_consumable_items;
create policy purchase_consumable_items_update
  on public.purchase_consumable_items
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists purchase_consumable_items_delete
  on public.purchase_consumable_items;
create policy purchase_consumable_items_delete
  on public.purchase_consumable_items
  for delete to authenticated
  using (public.is_admin());

drop policy if exists purchase_consumable_expenses_select
  on public.purchase_consumable_expenses;
create policy purchase_consumable_expenses_select
  on public.purchase_consumable_expenses
  for select to authenticated
  using (public.can_see_consumable_expenses());

drop policy if exists purchase_consumable_expenses_insert
  on public.purchase_consumable_expenses;
create policy purchase_consumable_expenses_insert
  on public.purchase_consumable_expenses
  for insert to authenticated
  with check (public.can_edit_consumable_expenses());

drop policy if exists purchase_consumable_expenses_update
  on public.purchase_consumable_expenses;
create policy purchase_consumable_expenses_update
  on public.purchase_consumable_expenses
  for update to authenticated
  using (public.can_edit_consumable_expenses())
  with check (public.can_edit_consumable_expenses());

drop policy if exists purchase_consumable_expenses_delete
  on public.purchase_consumable_expenses;
create policy purchase_consumable_expenses_delete
  on public.purchase_consumable_expenses
  for delete to authenticated
  using (public.can_edit_consumable_expenses());

-- Tedarikçi defterinin eski FOR ALL politikası Planlama/Satın Alma'ya UPDATE
-- ve DELETE de veriyordu. Inline yeni firma açma değişmez; düzenleme/silme
-- Yönetim'e daralır. SELECT politikası olduğu gibi can_see_purchasing()dir.
drop policy if exists purchase_suppliers_write on public.purchase_suppliers;
drop policy if exists purchase_suppliers_insert on public.purchase_suppliers;
drop policy if exists purchase_suppliers_update on public.purchase_suppliers;
drop policy if exists purchase_suppliers_delete on public.purchase_suppliers;

create policy purchase_suppliers_insert
  on public.purchase_suppliers
  for insert to authenticated
  with check (public.can_edit_purchasing());

create policy purchase_suppliers_update
  on public.purchase_suppliers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy purchase_suppliers_delete
  on public.purchase_suppliers
  for delete to authenticated
  using (public.is_admin());

-- ═══════════════════════════════════════════════ 6. KAYIT DİZİNİ GÖRÜNÜMÜ
--
-- Liste tüm legacy_payload JSON'unu taşımaz. Ayrıntı gerektiğinde ana tablodan
-- yalnız o satır okunur. `security_invoker` alt tablolardaki RLS'i korur.
create or replace view public.purchase_consumable_expense_records
with (security_invoker = true) as
select
  e.id,
  e.expense_date,
  e.document_no,
  e.item_id,
  e.item_code,
  e.item_name,
  e.group_name,
  i.active                                                   as item_active,
  e.supplier_id,
  e.supplier_name,
  s.code                                                     as supplier_code,
  s.active                                                   as supplier_active,
  e.department,
  e.quantity,
  e.unit,
  e.unit_price,
  e.note,
  e.amount,
  e.currency,
  e.fx_rate,
  e.fx_rate_date,
  e.fx_source,
  e.amount_eur,
  e.quality_flags,
  cardinality(e.quality_flags) > 0                           as has_quality_flags,
  e.legacy_payload <> '{}'::jsonb                            as has_legacy_payload,
  e.source,
  e.source_ref,
  e.created_by,
  e.updated_by,
  e.created_at,
  e.updated_at,
  -- Arama ekranla aynı Türkçe katlama dilini kullanır. JSON payload bilerek
  -- aramaya girmez; liste sorgusunu pahalılaştırmadan canonical alanlar aranır.
  translate(
    upper(concat_ws(' ',
      coalesce(e.document_no, ''),
      coalesce(e.item_code, ''),
      coalesce(e.item_name, ''),
      e.group_name,
      e.supplier_name,
      coalesce(s.code, ''),
      coalesce(e.department, ''),
      coalesce(e.note, ''),
      e.unit,
      e.currency,
      e.source,
      array_to_string(e.quality_flags, ' ')
    )),
    'IİIÇĞÖŞÜáâäàéêëèíîïìóôöòúûüù',
    'IIICGOSUAAAAEEEEIIIIOOOOUUUU'
  )                                                          as ara
from public.purchase_consumable_expenses e
left join public.purchase_consumable_items i on i.id = e.item_id
left join public.purchase_suppliers s on s.id = e.supplier_id;

comment on view public.purchase_consumable_expense_records is
  'Sarf kayıt ekranının RLS korumalı, aranabilir ve sayfalanabilir dizini. '
  'Ham legacy_payload yalnız ana tablodan satır ayrıntısında okunur.';

-- ════════════════════════════════════════════════ 7. AYLIK ANALİZ GÖRÜNÜMÜ
--
-- En küçük faydalı analiz tanesi ay × grup × malzeme × tedarikçidir. Üst
-- toplamlar bu satırlardan yeniden toplanabilir; fiziksel miktar farklı
-- birimler arasında toplanmaz, bütün karşılaştırmalar amount_eur üzerindedir.
create or replace view public.purchase_consumable_monthly
with (security_invoker = true) as
select
  date_trunc('month', e.expense_date::timestamp)::date        as month_start,
  extract(year from e.expense_date)::int                      as expense_year,
  extract(month from e.expense_date)::int                     as expense_month,
  e.group_name,
  e.item_id,
  e.item_code,
  e.item_name,
  e.supplier_id,
  e.supplier_name,
  count(*)::int                                               as expense_count,
  count(*) filter (where cardinality(e.quality_flags) > 0)::int
                                                               as quality_flagged_count,
  sum(e.amount_eur)                                           as total_eur,
  avg(e.amount_eur)                                           as average_eur,
  min(e.amount_eur)                                           as min_eur,
  max(e.amount_eur)                                           as max_eur
from public.purchase_consumable_expenses e
group by
  date_trunc('month', e.expense_date::timestamp)::date,
  extract(year from e.expense_date)::int,
  extract(month from e.expense_date)::int,
  e.group_name,
  e.item_id,
  e.item_code,
  e.item_name,
  e.supplier_id,
  e.supplier_name;

comment on view public.purchase_consumable_monthly is
  'Ay × grup × malzeme × tedarikçi düzeyinde EUR sarf özeti. Fiziksel miktar '
  'farklı birimler arasında bilinçli olarak toplanmaz.';

-- NOT: Bu migration audit_log yazmaz. Audit, INSERT/UPDATE/DELETE action'ının
-- kullanıcı niyetini ve silmeden önceki satır fotoğrafını bildiği katmanda
-- yazılacaktır.

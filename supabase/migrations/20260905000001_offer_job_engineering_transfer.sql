-- Kazanılan teklif -> iş emri -> fiyatsız mühendislik aktarımı -> V0 rapor.
--
-- Üç sınır bilinçlidir:
--   1. Ticari teklif tablolarını yalnız can_see_offers() okur.
--   2. Mühendis bütün teklifi değil, fiyat alanı bulunmayan handoff satırını okur.
--   3. İş emri ve hesap raporu çekirdekleri transaction içinde kurulur; kısmi
--      job/project satırı bırakılamaz.

-- ------------------------------------------------------------------ kaynak izi

create table if not exists public.offer_job_conversions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete restrict,
  offer_revision_id uuid not null references public.offer_revisions(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete cascade,
  mapping_version integer not null check (mapping_version > 0),
  mapping_snapshot jsonb not null default '[]'::jsonb
    check (jsonb_typeof(mapping_snapshot) = 'array'),
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (offer_id),
  unique (job_id)
);

comment on table public.offer_job_conversions is
  'Kazanılan teklifin hangi yayımlanmış revizyondan hangi iş emrine dönüştüğünün ticari erişimli izi; fiyat snapshotı taşımaz.';

alter table public.offer_job_conversions enable row level security;

create policy "offer_job_conversions_select" on public.offer_job_conversions
  for select to authenticated using (public.can_see_offers());
create policy "offer_job_conversions_insert" on public.offer_job_conversions
  for insert to authenticated with check (public.can_edit_jobs());

-- ---------------------------------------------------------- teknik handoff defteri

create table if not exists public.offer_engineering_handoffs (
  id uuid primary key default gen_random_uuid(),
  conversion_id uuid not null references public.offer_job_conversions(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete restrict,
  offer_revision_id uuid not null references public.offer_revisions(id) on delete restrict,
  source_offer_no text not null,
  source_revision_no integer not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_item_no text not null,
  source_type text not null
    check (source_type in ('technicalItem', 'standalonePriceLine')),
  source_item_id text not null,
  product_name text not null,
  eligibility text not null
    check (eligibility in ('eligible', 'review', 'not_applicable')),
  crane_type text not null default '',
  technical_facts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(technical_facts) = 'object'),
  technical_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(technical_snapshot) = 'object'),
  mapped_fields jsonb not null default '[]'::jsonb
    check (jsonb_typeof(mapped_fields) = 'array'),
  unmapped_fields jsonb not null default '[]'::jsonb
    check (jsonb_typeof(unmapped_fields) = 'array'),
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  mapping_version integer not null check (mapping_version > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, job_item_no, source_type, source_item_id)
);

create index if not exists offer_engineering_handoffs_job_idx
  on public.offer_engineering_handoffs(job_id, job_item_no);

comment on table public.offer_engineering_handoffs is
  'Mühendisin fiyat görmeden okuyabildiği teklif teknik aktarımı. Fiyat, iskonto, ödeme ve hukuk metni içermez.';

alter table public.offer_engineering_handoffs enable row level security;

-- Bu tablo teklif tablosu değildir: yalnız önceden beyaz listeyle üretilmiş
-- fiyatsız teknik fotoğrafı taşır ve iş emri gibi bütün ekibe okunur.
create policy "offer_engineering_handoffs_select" on public.offer_engineering_handoffs
  for select to authenticated using (true);
create policy "offer_engineering_handoffs_insert" on public.offer_engineering_handoffs
  for insert to authenticated with check (public.can_edit_jobs());

create trigger touch_offer_engineering_handoffs
  before update on public.offer_engineering_handoffs
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------- rapor kaynağı

create table if not exists public.engineering_report_sources (
  project_id uuid primary key references public.projects(id) on delete cascade,
  revision_id uuid not null unique references public.revisions(id) on delete cascade,
  mode text not null check (mode in ('manual', 'from_offer')),
  handoff_id uuid references public.offer_engineering_handoffs(id) on delete restrict,
  mapped_fields jsonb not null default '[]'::jsonb
    check (jsonb_typeof(mapped_fields) = 'array'),
  review_warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(review_warnings) = 'array'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (
    (mode = 'manual' and handoff_id is null)
    or (mode = 'from_offer' and handoff_id is not null)
  )
);

comment on table public.engineering_report_sources is
  'Yeni mühendislik raporunun manuel mi teklif aktarımıyla mı doğduğunu ve V0 kaynak inceleme izini taşır.';

alter table public.engineering_report_sources enable row level security;

create policy "engineering_report_sources_select" on public.engineering_report_sources
  for select to authenticated using (true);
create policy "engineering_report_sources_insert" on public.engineering_report_sources
  for insert to authenticated with check (public.can_edit_reports());

-- --------------------------------------------- tekliften atomik iş emri açma

create or replace function public.create_job_from_offer(
  p_offer_id uuid,
  p_offer_revision_id uuid,
  p_job jsonb,
  p_items jsonb,
  p_mapping_version integer,
  p_warnings jsonb default '[]'::jsonb
)
returns table (job_id uuid)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_offer public.offers%rowtype;
  v_revision public.offer_revisions%rowtype;
  v_job_id uuid;
  v_conversion_id uuid;
  v_item jsonb;
  v_facts jsonb;
begin
  if v_user_id is null then raise exception 'Oturum bulunamadı'; end if;
  if not public.can_edit_jobs() then
    raise exception 'İş emri yazma yetkisi yalnız Yönetici ve Müdürdedir';
  end if;
  if p_job is null or p_items is null
     or jsonb_typeof(p_job) <> 'object' or jsonb_typeof(p_items) <> 'array' then
    raise exception 'İş emri aktarım yapısı geçersiz';
  end if;
  if p_warnings is null or p_mapping_version is null
     or jsonb_typeof(p_warnings) <> 'array' or p_mapping_version < 1 then
    raise exception 'Teklif eşleştirme bilgisi geçersiz';
  end if;
  -- Doğrudan RPC çağrısında dahi ticari alan teknik deftere sokulamaz.
  if p_items::text ~* '"(unitPrice|unit_price|manualCost|manual_cost|cost|price|amount|total|currency|vat|kdv|discountPercent|discountTotal|paymentLines|payment)"[[:space:]]*:' then
    raise exception 'Teknik aktarım ticari fiyat alanı içeremez';
  end if;

  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;
  if not found then raise exception 'Teklif bulunamadı'; end if;
  if v_offer.status::text <> 'won' then
    raise exception 'İş emri yalnız Kazanıldı durumundaki tekliften oluşturulabilir';
  end if;
  if v_offer.job_id is not null then
    raise exception 'Bu teklif için iş emri zaten oluşturulmuş';
  end if;

  select * into v_revision
  from public.offer_revisions
  where id = p_offer_revision_id and offer_id = p_offer_id;
  if not found or v_revision.status::text <> 'issued' then
    raise exception 'İş emri için bu teklife ait yayımlanmış revizyon seçilmeli';
  end if;

  if nullif(btrim(p_job->>'job_no'), '') is null then raise exception 'İş no gerekli'; end if;
  if nullif(btrim(p_job->>'title'), '') is null then raise exception 'İş adı gerekli'; end if;
  if nullif(btrim(p_job->>'customer'), '') is null then raise exception 'Müşteri gerekli'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'En az bir iş kalemi gerekli'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) entry
    where nullif(btrim(entry->>'item_no'), '') is null
       or nullif(btrim(entry->>'product_name'), '') is null
  ) then
    raise exception 'Her iş kaleminde numara ve ürün adı gerekli';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) entry
    group by btrim(entry->>'item_no')
    having count(*) > 1
  ) then
    raise exception 'İş kalemi numaraları aynı iş içinde benzersiz olmalı';
  end if;

  insert into public.jobs (
    job_no, revision, title, customer, customer_id, work_order_date,
    customer_address, customer_tax_office, customer_tax_no, customer_phone,
    customer_fax, contract_exists, contract_date, workshop_exit_date,
    delivery_date, shipping_address, shipping_country, assembly_address,
    quantity_text, job_leader, project_manager, prepared_by_name,
    prepared_by_title, scope, notes, created_by
  ) values (
    btrim(p_job->>'job_no'), btrim(coalesce(p_job->>'revision', '')),
    btrim(p_job->>'title'), btrim(p_job->>'customer'),
    nullif(p_job->>'customer_id', '')::uuid,
    nullif(p_job->>'work_order_date', '')::date,
    btrim(coalesce(p_job->>'customer_address', '')),
    btrim(coalesce(p_job->>'customer_tax_office', '')),
    btrim(coalesce(p_job->>'customer_tax_no', '')),
    btrim(coalesce(p_job->>'customer_phone', '')),
    btrim(coalesce(p_job->>'customer_fax', '')),
    coalesce((p_job->>'contract_exists')::boolean, false),
    nullif(p_job->>'contract_date', '')::date,
    nullif(p_job->>'workshop_exit_date', '')::date,
    nullif(p_job->>'delivery_date', '')::date,
    btrim(coalesce(p_job->>'shipping_address', '')),
    coalesce(nullif(btrim(p_job->>'shipping_country'), ''), 'Türkiye'),
    btrim(coalesce(p_job->>'assembly_address', '')),
    btrim(coalesce(p_job->>'quantity_text', '')),
    btrim(coalesce(p_job->>'job_leader', '')),
    btrim(coalesce(p_job->>'project_manager', '')),
    btrim(coalesce(p_job->>'prepared_by_name', '')),
    btrim(coalesce(p_job->>'prepared_by_title', '')),
    coalesce(p_job->'scope', '{}'::jsonb),
    btrim(coalesce(p_job->>'notes', '')),
    v_user_id
  ) returning id into v_job_id;

  insert into public.job_items (job_id, item_no, product_name, quantity, sort)
  select
    v_job_id,
    btrim(entry.value->>'item_no'),
    btrim(entry.value->>'product_name'),
    btrim(coalesce(entry.value->>'quantity', '')),
    entry.ordinality::integer - 1
  from jsonb_array_elements(p_items) with ordinality as entry(value, ordinality);

  update public.offers set job_id = v_job_id where id = p_offer_id;

  insert into public.offer_job_conversions (
    offer_id, offer_revision_id, job_id, mapping_version,
    mapping_snapshot, warnings, created_by
  ) values (
    p_offer_id, p_offer_revision_id, v_job_id, p_mapping_version,
    p_items, p_warnings, v_user_id
  ) returning id into v_conversion_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'source_type', '') in ('technicalItem', 'standalonePriceLine')
       and nullif(btrim(v_item->>'source_id'), '') is not null then
      -- RPC doğrudan çağrılsa bile mühendislik defterine yalnız bilinen teknik
      -- anahtarlar girer. Değişken teklifin geri kalan snapshot'ı ticari
      -- erişimli conversion kaydında kalır.
      select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
      into v_facts
      from jsonb_each(
        case
          when jsonb_typeof(v_item->'technical_facts') = 'object'
            then v_item->'technical_facts'
          else '{}'::jsonb
        end
      ) as entry
      where entry.key = any (array[
        'mainCapacityT', 'auxCapacityT', 'spanM', 'mainLiftHeightM',
        'mainLiftSpeedMpm', 'auxLiftSpeedMpm', 'structureClass',
        'bridgeSpeedMpm', 'trolleySpeedMpm', 'ambientTempMinC',
        'ambientTempMaxC', 'installationEnvironment', 'supplyVoltage',
        'controlVoltage', 'runwayLengthM'
      ]);

      insert into public.offer_engineering_handoffs (
        conversion_id, offer_id, offer_revision_id, source_offer_no,
        source_revision_no, job_id, job_item_no, source_type, source_item_id,
        product_name, eligibility, crane_type, technical_facts,
        technical_snapshot, mapped_fields, unmapped_fields, warnings,
        mapping_version, created_by
      ) values (
        v_conversion_id, p_offer_id, p_offer_revision_id, v_offer.offer_no,
        v_revision.rev_no, v_job_id, btrim(v_item->>'item_no'),
        v_item->>'source_type', v_item->>'source_id',
        btrim(v_item->>'product_name'),
        case when v_item->>'eligibility' in ('eligible', 'review', 'not_applicable')
          then v_item->>'eligibility' else 'review' end,
        btrim(coalesce(v_item->>'crane_type', '')),
        v_facts,
        jsonb_build_object(
          'sourceType', v_item->>'source_type',
          'sourceId', v_item->>'source_id',
          'productName', btrim(v_item->>'product_name'),
          'craneType', btrim(coalesce(v_item->>'crane_type', ''))
        ),
        coalesce(v_item->'mapped_fields', '[]'::jsonb),
        '[]'::jsonb,
        coalesce(v_item->'warnings', '[]'::jsonb),
        p_mapping_version, v_user_id
      );
    end if;
  end loop;

  insert into public.audit_log (actor, action, detail)
  values (
    v_user_id,
    'job.createFromOffer',
    jsonb_build_object(
      'job_id', v_job_id,
      'job_no', p_job->>'job_no',
      'offer_id', p_offer_id,
      'offer_revision_id', p_offer_revision_id,
      'mapping_version', p_mapping_version,
      'item_count', jsonb_array_length(p_items)
    )
  );

  return query select v_job_id;
end;
$function$;

revoke all on function public.create_job_from_offer(uuid, uuid, jsonb, jsonb, integer, jsonb) from public;
grant execute on function public.create_job_from_offer(uuid, uuid, jsonb, jsonb, integer, jsonb) to authenticated;

-- ---------------------------------------------- atomik mühendislik raporu V0

create or replace function public.create_engineering_report_v0(
  p_job_id uuid,
  p_job_item_no text,
  p_source_mode text,
  p_handoff_id uuid,
  p_project jsonb,
  p_revision jsonb
)
returns table (project_id uuid, revision_id uuid)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_job public.jobs%rowtype;
  v_item_id uuid;
  v_item_project_id uuid;
  v_item_count integer;
  v_handoff public.offer_engineering_handoffs%rowtype;
  v_project_id uuid;
  v_revision_id uuid;
  v_mapped jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'Oturum bulunamadı'; end if;
  if not public.can_edit_reports() then
    raise exception 'Hesap raporu oluşturma yetkisi gerekli';
  end if;
  if p_source_mode not in ('manual', 'from_offer') then
    raise exception 'Hesap raporu oluşturma biçimi geçersiz';
  end if;
  if p_project is null or p_revision is null
     or jsonb_typeof(p_project) <> 'object' or jsonb_typeof(p_revision) <> 'object' then
    raise exception 'Hesap raporu snapshot yapısı geçersiz';
  end if;
  if jsonb_typeof(p_revision->'inputs') <> 'object'
     or jsonb_typeof(p_revision->'selections') <> 'object'
     or jsonb_typeof(p_revision->'results') <> 'object' then
    raise exception 'V0 hesap snapshot yapısı geçersiz';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if not found then raise exception 'İş emri bulunamadı'; end if;
  if v_job.status::text <> 'active' then
    raise exception 'Yeni hesap raporu yalnız aktif iş emrinde oluşturulabilir';
  end if;
  if nullif(btrim(p_job_item_no), '') is null then raise exception 'İş kalemi gerekli'; end if;

  -- Aynı kalem için iki eşzamanlı V0 açma isteğini sıraya al. İlk işlem bağı
  -- yazdıktan sonra bekleyen işlem yeni project_id değerini görüp durur.
  perform 1
  from public.job_items
  where job_id = p_job_id and item_no = btrim(p_job_item_no)
  for update;

  select count(*)
  into v_item_count
  from public.job_items
  where job_id = p_job_id and item_no = btrim(p_job_item_no);
  if v_item_count <> 1 then
    raise exception 'İş kalemi bulunamadı veya numarası benzersiz değil';
  end if;
  select id, project_id
  into v_item_id, v_item_project_id
  from public.job_items
  where job_id = p_job_id and item_no = btrim(p_job_item_no);
  if v_item_project_id is not null then
    raise exception 'Bu iş kaleminin hesap raporu zaten var; yeni proje yerine revizyon açın';
  end if;

  if p_source_mode = 'from_offer' then
    if p_handoff_id is null then raise exception 'Teklif teknik aktarımı seçilmeli'; end if;
    select * into v_handoff
    from public.offer_engineering_handoffs
    where id = p_handoff_id
      and job_id = p_job_id
      and job_item_no = btrim(p_job_item_no);
    if not found then raise exception 'Teklif teknik aktarımı bu iş kalemine ait değil'; end if;
    if v_handoff.eligibility = 'not_applicable' then
      raise exception 'Bu teklif kalemi mühendislik hesap raporuna uygun değil';
    end if;
    v_mapped := v_handoff.mapped_fields;
    v_warnings := v_handoff.warnings;
  elsif p_handoff_id is not null then
    raise exception 'Manuel rapor teklif aktarımı taşıyamaz';
  end if;

  if nullif(btrim(p_project->>'name'), '') is null then raise exception 'Rapor / vinç adı gerekli'; end if;
  if nullif(btrim(p_project->>'customer'), '') is null then raise exception 'Müşteri gerekli'; end if;
  if nullif(btrim(p_project->>'crane_type'), '') is null then raise exception 'Vinç tipi gerekli'; end if;

  insert into public.projects (
    doc_no, name, customer, crane_type, crane_location,
    report_brand_customer_id, end_customer_id, report_context, job_id, created_by
  ) values (
    btrim(p_job_item_no),
    btrim(p_project->>'name'),
    btrim(p_project->>'customer'),
    btrim(p_project->>'crane_type'),
    btrim(coalesce(p_project->>'crane_location', '')),
    nullif(p_project->>'report_brand_customer_id', '')::uuid,
    nullif(p_project->>'end_customer_id', '')::uuid,
    'engineering', p_job_id, v_user_id
  ) returning id into v_project_id;

  insert into public.revisions (
    project_id, rev_no, label, status, inputs, selections, results,
    engine_version, created_by
  ) values (
    v_project_id, 0, 'V0', 'draft',
    p_revision->'inputs', p_revision->'selections', p_revision->'results',
    btrim(coalesce(p_revision->>'engine_version', '')), v_user_id
  ) returning id into v_revision_id;

  update public.job_items set project_id = v_project_id where id = v_item_id;

  insert into public.engineering_report_sources (
    project_id, revision_id, mode, handoff_id, mapped_fields,
    review_warnings, created_by
  ) values (
    v_project_id, v_revision_id, p_source_mode, p_handoff_id,
    v_mapped, v_warnings, v_user_id
  );

  insert into public.audit_log (project_id, revision_id, actor, action, detail)
  values (
    v_project_id, v_revision_id, v_user_id,
    case when p_source_mode = 'from_offer'
      then 'project.createFromOfferJob'
      else 'project.createManualV0' end,
    jsonb_build_object(
      'job_id', p_job_id,
      'job_item_no', btrim(p_job_item_no),
      'handoff_id', p_handoff_id,
      'mapped_fields', v_mapped
    )
  );

  return query select v_project_id, v_revision_id;
end;
$function$;

revoke all on function public.create_engineering_report_v0(uuid, text, text, uuid, jsonb, jsonb) from public;
grant execute on function public.create_engineering_report_v0(uuid, text, text, uuid, jsonb, jsonb) to authenticated;

-- TEKLİF KAZANILMA YAYIMI + MÜHENDİSLİK V0 BELİRSİZ SÜTUN DÜZELTMESİ.
--
-- `create_engineering_report_v0` bir TABLE sonucu döndürdüğü için PL/pgSQL
-- içinde `project_id` aynı zamanda çıktı değişkenidir. İş kalemindeki
-- `select id, project_id` niteliksiz yazılınca Postgres sütun ile çıktı
-- değişkenini ayıramıyordu. Uygulanmış migration değiştirilmez; işlev burada
-- ileri migration ile ve bütün tablo sütunları takma adla nitelenerek yenilenir.

create or replace function public.mark_offer_won(
  p_offer_id uuid,
  p_won_on date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_offer public.offers%rowtype;
  v_revision public.offer_revisions%rowtype;
  v_newly_issued boolean := false;
  v_won_on date;
begin
  if v_user_id is null then raise exception 'Oturum bulunamadı'; end if;
  if not public.can_edit_offers() then
    raise exception 'Teklifi düzenleme yetkisi gerekli';
  end if;

  select o.* into v_offer
  from public.offers as o
  where o.id = p_offer_id
  for update;
  if not found then raise exception 'Teklif bulunamadı'; end if;

  select r.* into v_revision
  from public.offer_revisions as r
  where r.offer_id = p_offer_id
  order by r.rev_no desc
  limit 1
  for update;
  if not found then raise exception 'Kazanıldı yapmak için teklif revizyonu gerekli'; end if;
  if v_revision.status::text not in ('draft', 'issued') then
    raise exception 'Son teklif revizyonunun durumu yayıma uygun değil';
  end if;

  if v_revision.status::text = 'draft' then
    update public.offer_revisions as r
    set status = 'issued'
    where r.id = v_revision.id;
    v_newly_issued := true;
  end if;

  v_won_on := coalesce(p_won_on, v_offer.won_on, current_date);
  update public.offers as o
  set status = 'won',
      won_on = v_won_on,
      issued_on = case
        when v_newly_issued then current_date
        else coalesce(o.issued_on, current_date)
      end
  where o.id = p_offer_id;

  insert into public.audit_log (actor, action, detail)
  values (
    v_user_id,
    'offer.status',
    jsonb_build_object(
      'offer_id', p_offer_id,
      'onceki', v_offer.status,
      'yeni', 'won',
      'won_on', v_won_on,
      'latest_revision_id', v_revision.id,
      'latest_rev_no', v_revision.rev_no,
      'latest_revision_issued', v_newly_issued
    )
  );

  return jsonb_build_object(
    'revision_id', v_revision.id,
    'rev_no', v_revision.rev_no,
    'newly_issued', v_newly_issued
  );
end;
$function$;

revoke all on function public.mark_offer_won(uuid, date) from public;
grant execute on function public.mark_offer_won(uuid, date) to authenticated;

-- ------------------------------------------------ Mühendislik okuma sınırı

-- İşler bütün personele açıktır; hesap raporunun kendisi değildir. Müdür
-- raporu okuyabilir ama yazamaz, Mühendis yazabilir. Teklif hesapları kendi
-- can_see_offers kapısında kalır.
create or replace function public.can_see_engineering()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.role::text in ('admin', 'manager', 'engineer')
  );
$function$;

comment on function public.can_see_engineering() is
  'Mühendislik hesap raporlarını okuyabilen roller: Yönetici, Müdür ve Mühendis.';

revoke all on function public.can_see_engineering() from public;
grant execute on function public.can_see_engineering() to authenticated;

drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select to authenticated using (
    (coalesce(report_context::text, 'engineering') = 'engineering' and public.can_see_engineering())
    or (report_context::text = 'offer' and public.can_see_offers())
  );

drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and (
      (coalesce(report_context::text, 'engineering') = 'engineering' and public.can_edit_reports())
      or (report_context::text = 'offer' and public.can_edit_offers())
    )
  );

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects
  for update to authenticated
  using (
    (coalesce(report_context::text, 'engineering') = 'engineering' and public.can_edit_reports())
    or (report_context::text = 'offer' and public.can_edit_offers())
  )
  with check (
    (coalesce(report_context::text, 'engineering') = 'engineering' and public.can_edit_reports())
    or (report_context::text = 'offer' and public.can_edit_offers())
  );

drop policy if exists "revisions_select" on public.revisions;
create policy "revisions_select" on public.revisions
  for select to authenticated using (
    exists (
      select 1
      from public.projects as p
      where p.id = revisions.project_id
        and (
          (coalesce(p.report_context::text, 'engineering') = 'engineering' and public.can_see_engineering())
          or (p.report_context::text = 'offer' and public.can_see_offers())
        )
    )
  );

drop policy if exists "revisions_insert" on public.revisions;
create policy "revisions_insert" on public.revisions
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.projects as p
      where p.id = revisions.project_id
        and (
          (coalesce(p.report_context::text, 'engineering') = 'engineering' and public.can_edit_reports())
          or (p.report_context::text = 'offer' and public.can_edit_offers())
        )
    )
  );

drop policy if exists "revisions_update" on public.revisions;
create policy "revisions_update" on public.revisions
  for update to authenticated
  using (
    exists (
      select 1
      from public.projects as p
      where p.id = revisions.project_id
        and (
          (coalesce(p.report_context::text, 'engineering') = 'engineering' and public.can_edit_reports())
          or (p.report_context::text = 'offer' and public.can_edit_offers())
        )
    )
  )
  with check (
    exists (
      select 1
      from public.projects as p
      where p.id = revisions.project_id
        and (
          (coalesce(p.report_context::text, 'engineering') = 'engineering' and public.can_edit_reports())
          or (p.report_context::text = 'offer' and public.can_edit_offers())
        )
    )
  );

drop policy if exists "offer_engineering_handoffs_select" on public.offer_engineering_handoffs;
create policy "offer_engineering_handoffs_select" on public.offer_engineering_handoffs
  for select to authenticated using (public.can_see_engineering());

drop policy if exists "engineering_report_sources_select" on public.engineering_report_sources;
create policy "engineering_report_sources_select" on public.engineering_report_sources
  for select to authenticated using (public.can_see_engineering());

-- ------------------------------------------ İşler için sade teklif belgesi

-- Bu süzgeç VERİTABANINDA çalışır. RPC'yi tarayıcıdan doğrudan çağıran bir
-- kullanıcı dahi tam teklif payload'ını alamaz: fiyat tablosu, iskonto/toplam,
-- ödeme planı ve özel imza depolama yolları cevap oluşmadan önce düşer.
create or replace function public.job_offer_document_payload(p_payload jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  with source as (
    select coalesce(p_payload, '{}'::jsonb) as payload
  ), normalized as (
    select
      s.payload,
      case when jsonb_typeof(s.payload->'terms') = 'object'
        then s.payload->'terms' else '{}'::jsonb end as terms,
      case when jsonb_typeof(s.payload->'cover') = 'object'
        then s.payload->'cover' else '{}'::jsonb end as cover
    from source as s
  ), safe_parts as (
    select
      n.payload,
      n.terms,
      n.cover,
      coalesce((
        select jsonb_agg(term.value order by term.ordinality)
        from jsonb_array_elements(
          case when jsonb_typeof(n.terms->'rows') = 'array'
            then n.terms->'rows' else '[]'::jsonb end
        ) with ordinality as term(value, ordinality)
        where lower(coalesce(term.value->>'key', '')) not in ('payment', 'price', 'tax')
          and coalesce(term.value->>'label', '') !~* '(fiyat|bedel|ödeme|odeme|avans|iskonto|kdv|para[[:space:]]+birimi|vergi)'
      ), '[]'::jsonb) as term_rows,
      coalesce((
        select jsonb_agg(
          signature.value - 'userId' - 'signaturePath' - 'signatureName'
          order by signature.ordinality
        )
        from jsonb_array_elements(
          case when jsonb_typeof(n.cover->'signatories') = 'array'
            then n.cover->'signatories' else '[]'::jsonb end
        ) with ordinality as signature(value, ordinality)
      ), '[]'::jsonb) as signatories,
      coalesce((
        select jsonb_agg(note.value order by note.ordinality)
        from jsonb_array_elements(
          case when jsonb_typeof(n.payload->'notes') = 'array'
            then n.payload->'notes' else '[]'::jsonb end
        ) with ordinality as note(value, ordinality)
        where coalesce(note.value->>'text', '') !~*
          '(fiyat|bedel|ödeme|odeme|avans|iskonto|kdv|para[[:space:]]+birimi|vergi|banka|teminat|vade|€|[$]|₺|(^|[^[:alnum:]_])(eur|usd|try|tl)([^[:alnum:]_]|$))'
      ), '[]'::jsonb) as notes,
      coalesce((
        select jsonb_agg(general_term.value order by general_term.ordinality)
        from jsonb_array_elements(
          case when jsonb_typeof(n.payload->'generalTerms') = 'array'
            then n.payload->'generalTerms' else '[]'::jsonb end
        ) with ordinality as general_term(value, ordinality)
        where lower(coalesce(general_term.value->>'key', '')) not in ('payment', 'price', 'tax')
          and coalesce(general_term.value->>'title', '') !~*
            '(fiyat|bedel|ödeme|odeme|avans|iskonto|kdv|para[[:space:]]+birimi|vergi)'
      ), '[]'::jsonb) as general_terms
    from normalized as n
  )
  select
    p.payload
    || jsonb_build_object('pricing', '{}'::jsonb)
    || jsonb_build_object(
      'terms', p.terms || jsonb_build_object(
        'title', 'TESLİM VE DİĞER ŞARTLAR',
        'rows', p.term_rows,
        'paymentLines', '[]'::jsonb
      )
    )
    || jsonb_build_object(
      'cover', p.cover || jsonb_build_object('signatories', p.signatories)
    )
    || jsonb_build_object('notes', p.notes)
    || jsonb_build_object('generalTerms', p.general_terms)
  from safe_parts as p;
$function$;

revoke all on function public.job_offer_document_payload(jsonb) from public;
grant execute on function public.job_offer_document_payload(jsonb) to authenticated;

create or replace function public.has_job_offer_document(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.offer_job_conversions as c
    join public.offers as o on o.id = c.offer_id and o.job_id = c.job_id
    where c.job_id = p_job_id
  );
$function$;

revoke all on function public.has_job_offer_document(uuid) from public;
grant execute on function public.has_job_offer_document(uuid) to authenticated;

create or replace function public.list_job_offer_document_jobs()
returns table (job_id uuid)
language sql
stable
security definer
set search_path = ''
as $function$
  select c.job_id
  from public.offer_job_conversions as c
  join public.offers as o on o.id = c.offer_id and o.job_id = c.job_id
  where (select auth.uid()) is not null;
$function$;

revoke all on function public.list_job_offer_document_jobs() from public;
grant execute on function public.list_job_offer_document_jobs() to authenticated;

create or replace function public.get_job_offer_document(p_job_id uuid)
returns table (
  job_no text,
  offer_no text,
  revision_no integer,
  issue_date date,
  subject text,
  customer_id uuid,
  customer_name text,
  currency text,
  payload jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    j.job_no,
    o.offer_no,
    r.rev_no,
    o.issue_date,
    o.subject,
    o.customer_id,
    o.customer_name,
    o.currency,
    public.job_offer_document_payload(r.payload)
  from public.offer_job_conversions as c
  join public.jobs as j on j.id = c.job_id
  join public.offers as o on o.id = c.offer_id and o.job_id = c.job_id
  join public.offer_revisions as r
    on r.id = c.offer_revision_id and r.offer_id = c.offer_id
  where c.job_id = p_job_id
    and (select auth.uid()) is not null
  limit 1;
$function$;

revoke all on function public.get_job_offer_document(uuid) from public;
grant execute on function public.get_job_offer_document(uuid) to authenticated;

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

  select j.* into v_job
  from public.jobs as j
  where j.id = p_job_id;
  if not found then raise exception 'İş emri bulunamadı'; end if;
  if v_job.status::text <> 'active' then
    raise exception 'Yeni hesap raporu yalnız aktif iş emrinde oluşturulabilir';
  end if;
  if nullif(btrim(p_job_item_no), '') is null then raise exception 'İş kalemi gerekli'; end if;

  perform 1
  from public.job_items as ji
  where ji.job_id = p_job_id and ji.item_no = btrim(p_job_item_no)
  for update;

  select count(*)
  into v_item_count
  from public.job_items as ji
  where ji.job_id = p_job_id and ji.item_no = btrim(p_job_item_no);
  if v_item_count <> 1 then
    raise exception 'İş kalemi bulunamadı veya numarası benzersiz değil';
  end if;

  select ji.id, ji.project_id
  into v_item_id, v_item_project_id
  from public.job_items as ji
  where ji.job_id = p_job_id and ji.item_no = btrim(p_job_item_no);
  if v_item_project_id is not null then
    raise exception 'Bu iş kaleminin hesap raporu zaten var; yeni proje yerine revizyon açın';
  end if;

  if p_source_mode = 'from_offer' then
    if p_handoff_id is null then raise exception 'Teklif teknik aktarımı seçilmeli'; end if;
    select h.* into v_handoff
    from public.offer_engineering_handoffs as h
    where h.id = p_handoff_id
      and h.job_id = p_job_id
      and h.job_item_no = btrim(p_job_item_no);
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

  update public.job_items as ji
  set project_id = v_project_id
  where ji.id = v_item_id;

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

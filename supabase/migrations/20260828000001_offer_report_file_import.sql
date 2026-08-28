-- TEKLİF HESAP RAPORU · DOSYADAN ATOMİK OLUŞTURMA
--
-- Normal akışta proje künyesi ile ilk revizyon iki ayrı kullanıcı adımıdır.
-- AI aktarım dosyası ise ikisini birlikte getirir. Bunlar uygulama tarafında
-- iki ayrı INSERT olsaydı ikinci INSERT'in ağ/RLS hatasında listede revizyonsuz,
-- kullanılamayan bir proje kalırdı. Fonksiyon proje + V0 + audit kaydını tek
-- Postgres işleminde kurar; herhangi biri düşerse tamamı geri alınır.

create or replace function public.create_offer_report_from_file(
  p_doc_no text,
  p_name text,
  p_customer text,
  p_crane_type text,
  p_crane_location text,
  p_inputs jsonb,
  p_selections jsonb,
  p_results jsonb,
  p_engine_version text,
  p_source jsonb default '{}'::jsonb,
  p_review_notes jsonb default '[]'::jsonb
)
returns table (project_id uuid, revision_id uuid)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_project_id uuid;
  v_revision_id uuid;
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı';
  end if;
  if not public.can_edit_offers() then
    raise exception 'Teklif hesap raporu oluşturma yetkisi gerekli';
  end if;
  if nullif(btrim(p_doc_no), '') is null then
    raise exception 'Doküman no gerekli';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'Rapor / vinç adı gerekli';
  end if;
  if nullif(btrim(p_customer), '') is null then
    raise exception 'Müşteri gerekli';
  end if;
  if nullif(btrim(p_crane_type), '') is null then
    raise exception 'Vinç tipi gerekli';
  end if;
  if jsonb_typeof(p_inputs) <> 'object'
     or jsonb_typeof(p_selections) <> 'object'
     or jsonb_typeof(p_results) <> 'object' then
    raise exception 'Hesap raporu snapshot yapısı geçersiz';
  end if;
  if jsonb_typeof(p_source) <> 'object' or jsonb_typeof(p_review_notes) <> 'array' then
    raise exception 'Dosya kaynak bilgisi geçersiz';
  end if;

  insert into public.projects (
    doc_no,
    name,
    customer,
    crane_type,
    crane_location,
    report_context,
    job_id,
    created_by
  ) values (
    btrim(p_doc_no),
    btrim(p_name),
    btrim(p_customer),
    btrim(p_crane_type),
    btrim(coalesce(p_crane_location, '')),
    'offer',
    null,
    v_user_id
  )
  returning id into v_project_id;

  insert into public.revisions (
    project_id,
    rev_no,
    label,
    status,
    inputs,
    selections,
    results,
    engine_version,
    created_by
  ) values (
    v_project_id,
    0,
    'V0',
    'draft',
    p_inputs,
    p_selections,
    p_results,
    coalesce(nullif(btrim(p_engine_version), ''), ''),
    v_user_id
  )
  returning id into v_revision_id;

  insert into public.audit_log (
    project_id,
    revision_id,
    actor,
    action,
    detail
  ) values (
    v_project_id,
    v_revision_id,
    v_user_id,
    'project.createFromFile',
    jsonb_build_object(
      'doc_no', btrim(p_doc_no),
      'report_context', 'offer',
      'source', p_source,
      'review_notes', p_review_notes,
      'engine_version', p_engine_version
    )
  );

  return query select v_project_id, v_revision_id;
end;
$function$;

comment on function public.create_offer_report_from_file(
  text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb
) is
  'AI aktarım JSONundan teklif hesap raporu projesi + V0 taslak + audit kaydını atomik oluşturur.';

revoke all on function public.create_offer_report_from_file(
  text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb
) from public;
grant execute on function public.create_offer_report_from_file(
  text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb
) to authenticated;

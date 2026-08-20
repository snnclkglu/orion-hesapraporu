-- Kalıcı silme talepleri: ana kayıtlar ve belgeler önce Yönetici onayına gider.
--
-- Güvenlik yalnız arayüze bırakılmaz. Korunan tablolardaki BEFORE DELETE
-- tetikleyicisi, silmeyi ancak `approve_deletion_request()` aynı transaction
-- içinde talebi kilitleyip işaretlediyse geçirir. Böylece doğrudan REST/RLS
-- çağrısı veya eski bir istemci onay kuyruğunu atlayamaz.

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'job',
    'project',
    'revision',
    'drawing_package',
    'offer',
    'offer_revision',
    'offer_cost_revision',
    'employee',
    'employee_document',
    'project_spec',
    'electrical_project',
    'manual_revision',
    'equipment_attachment'
  )),
  target_id text not null,
  target_label text not null,
  target_path text not null default '',
  target_snapshot jsonb not null default '{}'::jsonb,
  request_note text not null default '',
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text not null default '',
  cleanup_items jsonb not null default '[]'::jsonb,
  cleanup_status text not null default 'not_required'
    check (cleanup_status in ('not_required', 'pending', 'completed', 'failed')),
  cleanup_error text not null default '',
  constraint deletion_requests_review_shape check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status = 'processing' and reviewed_by is not null)
    or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index if not exists deletion_requests_open_target_uidx
  on public.deletion_requests (entity_type, target_id)
  where status in ('pending', 'processing');
create index if not exists deletion_requests_queue_idx
  on public.deletion_requests (status, requested_at desc);
create index if not exists deletion_requests_requester_idx
  on public.deletion_requests (requested_by, requested_at desc);

comment on table public.deletion_requests is
  'Kalıcı silme için Yönetici onay kuyruğu ve değiştirilemez karar izi. Hedefin silme öncesi künyesi target_snapshot içinde yaşar.';

alter table public.deletion_requests enable row level security;
revoke all on table public.deletion_requests from anon;
revoke insert, update, delete on table public.deletion_requests from authenticated;
grant select on table public.deletion_requests to authenticated;

drop policy if exists deletion_requests_select on public.deletion_requests;
create policy deletion_requests_select on public.deletion_requests
  for select to authenticated
  using (requested_by = (select auth.uid()) or public.is_admin());

-- INSERT/UPDATE/DELETE politikası bilinçli olarak YOKTUR. Yazma yalnız aşağıdaki
-- dar SECURITY DEFINER fonksiyonlarından geçer; isteyen kişi hedef künyesini,
-- karar veren kişi de talebin kapsamını sonradan değiştiremez.

create or replace function public.request_deletion(
  p_entity_type text,
  p_target_id text,
  p_context jsonb default '{}'::jsonb,
  p_request_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
  v_label text;
  v_path text := '';
  v_snapshot jsonb := '{}'::jsonb;
  v_status text;
  v_project_id uuid;
  v_manual_id uuid;
  v_offer_id uuid;
begin
  if v_user is null then
    raise exception 'Oturum bulunamadı';
  end if;
  if p_target_id is null or btrim(p_target_id) = '' then
    raise exception 'Silinecek kayıt kimliği gerekli';
  end if;

  -- İstemci yalnız hedef KİMLİĞİNİ söyler. Ad, adres, durum ve bütün denetim
  -- fotoğrafı güvenilen tablolardan burada yeniden okunur.
  case p_entity_type
    when 'job' then
      if not public.can_edit_jobs() then raise exception 'İş silme talebi için iş düzenleme yetkisi gerekir'; end if;
      select
        format('İş %s · %s', j.job_no, j.title),
        format('/jobs/%s', j.id),
        jsonb_build_object(
          'job_id', j.id, 'job_no', j.job_no, 'title', j.title,
          'customer', j.customer, 'status', j.status,
          'item_count', (select count(*) from public.job_items i where i.job_id = j.id)
        )
      into v_label, v_path, v_snapshot
      from public.jobs j where j.id = p_target_id::uuid;

    when 'project' then
      if not public.can_edit_reports() then raise exception 'Hesap raporu silme talebi için mühendislik yazma yetkisi gerekir'; end if;
      select
        format('Hesap raporu %s · %s', coalesce(nullif(p.doc_no, ''), '—'), p.name),
        format('/projects/%s', p.id),
        jsonb_build_object(
          'project_id', p.id, 'doc_no', p.doc_no, 'name', p.name,
          'job_id', p.job_id, 'status', p.status,
          'revision_count', (select count(*) from public.revisions r where r.project_id = p.id)
        )
      into v_label, v_path, v_snapshot
      from public.projects p where p.id = p_target_id::uuid;
      if exists (
        select 1 from public.revisions r
        where r.project_id = p_target_id::uuid and r.status = 'issued'
      ) then
        raise exception 'Yayınlanmış revizyonu olan hesap raporu silinemez; arşivleyin';
      end if;

    when 'revision' then
      if not public.can_edit_reports() then raise exception 'Revizyon silme talebi için mühendislik yazma yetkisi gerekir'; end if;
      select
        format('%s · V%s taslak hesap revizyonu', coalesce(nullif(p.doc_no, ''), p.name), r.rev_no),
        format('/projects/%s/revisions/%s', p.id, r.id),
        jsonb_build_object(
          'revision_id', r.id, 'project_id', p.id, 'rev_no', r.rev_no,
          'status', r.status, 'doc_no', p.doc_no, 'project_name', p.name
        ),
        r.status::text,
        p.id
      into v_label, v_path, v_snapshot, v_status, v_project_id
      from public.revisions r
      join public.projects p on p.id = r.project_id
      where r.id = p_target_id::uuid
        and (p_context->>'project_id' is null or p.id = (p_context->>'project_id')::uuid);
      if v_status = 'issued' then raise exception 'Yayınlanmış revizyon silinemez'; end if;

    when 'drawing_package' then
      if not public.can_edit_drawings() then raise exception 'Paket silme talebi için teknik resim yazma yetkisi gerekir'; end if;
      select
        format('Teknik resim paketi · %s', d.folder_name),
        format('/drawings/%s', d.id),
        jsonb_build_object(
          'package_id', d.id, 'folder_name', d.folder_name, 'item_no', d.item_no,
          'rev_no', d.rev_no, 'status', d.status, 'file_count', d.file_count,
          'part_count', d.part_count, 'bytes_total', d.bytes_total
        )
      into v_label, v_path, v_snapshot
      from public.drawing_packages d where d.id = p_target_id::uuid;

    when 'offer' then
      if not public.can_edit_offers() then raise exception 'Teklif silme talebi için teklif yazma yetkisi gerekir'; end if;
      select
        format('Teklif %s · %s', o.offer_no, coalesce(nullif(o.subject, ''), o.customer_name)),
        format('/offers/%s', o.id),
        jsonb_build_object(
          'offer_id', o.id, 'offer_no', o.offer_no, 'subject', o.subject,
          'customer_name', o.customer_name, 'status', o.status,
          'revision_count', (select count(*) from public.offer_revisions r where r.offer_id = o.id)
        )
      into v_label, v_path, v_snapshot
      from public.offers o where o.id = p_target_id::uuid;
      if exists (
        select 1 from public.offer_revisions r
        where r.offer_id = p_target_id::uuid and r.status = 'issued'
      ) then
        raise exception 'Yayımlanmış revizyonu olan teklif silinemez; İptal durumuna alın';
      end if;

    when 'offer_revision' then
      if not public.can_edit_offers() then raise exception 'Teklif revizyonu silme talebi için teklif yazma yetkisi gerekir'; end if;
      select
        format('Teklif %s · R%s taslak revizyonu', o.offer_no, r.rev_no),
        format('/offers/%s/revisions/%s', o.id, r.id),
        jsonb_build_object(
          'revision_id', r.id, 'offer_id', o.id, 'offer_no', o.offer_no,
          'rev_no', r.rev_no, 'status', r.status
        ),
        r.status::text,
        o.id
      into v_label, v_path, v_snapshot, v_status, v_offer_id
      from public.offer_revisions r
      join public.offers o on o.id = r.offer_id
      where r.id = p_target_id::uuid
        and (p_context->>'offer_id' is null or o.id = (p_context->>'offer_id')::uuid);
      if v_status = 'issued' then raise exception 'Yayımlanmış teklif revizyonu silinemez'; end if;

    when 'offer_cost_revision' then
      if not public.can_edit_offer_costs() then raise exception 'Maliyet revizyonu silme talebi için maliyet yazma yetkisi gerekir'; end if;
      select
        format('Teklif %s · M%s taslak maliyet revizyonu', o.offer_no, r.rev_no),
        format('/offers/%s/costs/%s', o.id, r.id),
        jsonb_build_object(
          'cost_revision_id', r.id, 'offer_id', o.id, 'offer_no', o.offer_no,
          'rev_no', r.rev_no, 'status', r.status
        ),
        r.status::text,
        o.id
      into v_label, v_path, v_snapshot, v_status, v_offer_id
      from public.offer_cost_revisions r
      join public.offers o on o.id = r.offer_id
      where r.id = p_target_id::uuid
        and (p_context->>'offer_id' is null or o.id = (p_context->>'offer_id')::uuid);
      if v_status = 'issued' then raise exception 'Yayımlanmış maliyet revizyonu silinemez'; end if;

    when 'employee' then
      if not public.can_edit_personnel() then raise exception 'Personel silme talebi için personel yazma yetkisi gerekir'; end if;
      select
        format('Personel · %s', e.full_name),
        format('/personnel/%s', e.id),
        jsonb_build_object(
          'employee_id', e.id, 'full_name', e.full_name,
          'employee_no', e.employee_no, 'department', e.department,
          'document_count', (select count(*) from public.hr_employee_documents d where d.employee_id = e.id),
          'payroll_count', (select count(*) from public.hr_payroll p where p.employee_id = e.id)
        )
      into v_label, v_path, v_snapshot
      from public.hr_employees e where e.id = p_target_id::uuid;
      if exists (
        select 1 from public.hr_payroll p where p.employee_id = p_target_id::uuid
      ) then
        raise exception 'Maaş geçmişi olan personel silinemez; çalışma dönemini kapatın';
      end if;

    when 'employee_document' then
      if not public.can_edit_personnel() then raise exception 'Özlük belgesi silme talebi için personel yazma yetkisi gerekir'; end if;
      select
        format('%s · %s', e.full_name, coalesce(nullif(d.title, ''), d.file_name)),
        format('/personnel/%s', e.id),
        jsonb_build_object(
          'document_id', d.id, 'employee_id', e.id, 'employee_name', e.full_name,
          'kind', d.kind, 'title', d.title, 'file_name', d.file_name,
          'storage_path', d.storage_path, 'size_bytes', d.size_bytes
        )
      into v_label, v_path, v_snapshot
      from public.hr_employee_documents d
      join public.hr_employees e on e.id = d.employee_id
      where d.id = p_target_id::uuid
        and (p_context->>'employee_id' is null or e.id = (p_context->>'employee_id')::uuid);

    when 'project_spec' then
      if not public.can_edit_reports() then raise exception 'Şartname silme talebi için mühendislik yazma yetkisi gerekir'; end if;
      select
        format('%s · Teknik şartname · %s', coalesce(nullif(p.doc_no, ''), p.name), s.file_name),
        format('/projects/%s', p.id),
        jsonb_build_object(
          'spec_id', s.id, 'project_id', p.id, 'file_name', s.file_name,
          'revision', s.revision, 'storage_path', s.storage_path,
          'size_bytes', s.size_bytes, 'is_current', s.is_current
        )
      into v_label, v_path, v_snapshot
      from public.project_specs s
      join public.projects p on p.id = s.project_id
      where s.id = p_target_id::uuid
        and (p_context->>'project_id' is null or p.id = (p_context->>'project_id')::uuid);

    when 'electrical_project' then
      if not public.can_edit_reports() then raise exception 'Elektrik projesi silme talebi için mühendislik yazma yetkisi gerekir'; end if;
      select
        format('%s · Elektrik projesi · %s', coalesce(nullif(p.doc_no, ''), p.name), e.file_name),
        format('/projects/%s', p.id),
        jsonb_build_object(
          'electrical_project_id', e.id, 'project_id', p.id, 'file_name', e.file_name,
          'revision', e.revision, 'storage_path', e.storage_path,
          'size_bytes', e.size_bytes, 'is_current', e.is_current
        )
      into v_label, v_path, v_snapshot
      from public.electrical_projects e
      join public.projects p on p.id = e.project_id
      where e.id = p_target_id::uuid
        and (p_context->>'project_id' is null or p.id = (p_context->>'project_id')::uuid);

    when 'manual_revision' then
      if not public.can_edit_manuals() then raise exception 'El kitabı revizyonu silme talebi için el kitabı yazma yetkisi gerekir'; end if;
      select
        format('%s · El kitabı R%s taslak revizyonu', coalesce(nullif(p.doc_no, ''), p.name), r.rev_no),
        format('/projects/%s/manual/%s', p.id, r.id),
        jsonb_build_object(
          'manual_revision_id', r.id, 'manual_id', m.id, 'project_id', p.id,
          'rev_no', r.rev_no, 'status', r.status, 'project_name', p.name
        ),
        r.status::text,
        p.id,
        m.id
      into v_label, v_path, v_snapshot, v_status, v_project_id, v_manual_id
      from public.manual_revisions r
      join public.manuals m on m.id = r.manual_id
      join public.projects p on p.id = m.project_id
      where r.id = p_target_id::uuid
        and (p_context->>'project_id' is null or p.id = (p_context->>'project_id')::uuid);
      if v_status = 'issued' then raise exception 'Yayımlanmış el kitabı revizyonu silinemez'; end if;

    when 'equipment_attachment' then
      if not public.can_edit_reports() then raise exception 'Ekipman eki silme talebi için mühendislik yazma yetkisi gerekir'; end if;
      select
        format('%s · V%s ekipman eki · %s', coalesce(nullif(p.doc_no, ''), p.name), r.rev_no, a.file_name),
        format('/projects/%s/revisions/%s/equipment', p.id, r.id),
        jsonb_build_object(
          'attachment_id', a.id, 'revision_id', r.id, 'project_id', p.id,
          'row_key', a.row_key, 'file_name', a.file_name,
          'storage_path', a.storage_path, 'page_count', a.page_count
        )
      into v_label, v_path, v_snapshot
      from public.equipment_attachments a
      join public.revisions r on r.id = a.revision_id
      join public.projects p on p.id = r.project_id
      where a.id = p_target_id::uuid
        and (p_context->>'revision_id' is null or r.id = (p_context->>'revision_id')::uuid);

    else
      raise exception 'Desteklenmeyen silme talebi türü';
  end case;

  if v_label is null then raise exception 'Silinecek kayıt bulunamadı veya kapsamla eşleşmiyor'; end if;

  select id into v_id
  from public.deletion_requests
  where entity_type = p_entity_type and target_id = p_target_id
    and status in ('pending', 'processing')
  order by requested_at desc
  limit 1;
  if v_id is not null then return v_id; end if;

  begin
    insert into public.deletion_requests (
      entity_type, target_id, target_label, target_path, target_snapshot,
      request_note, requested_by
    ) values (
      p_entity_type, p_target_id, v_label, v_path, v_snapshot,
      left(btrim(coalesce(p_request_note, '')), 500), v_user
    ) returning id into v_id;
  exception when unique_violation then
    -- İki kullanıcı aynı hedefi aynı anda gönderirse ikinci çağrı hata vermez;
    -- kısmi tekil indeksin kazanan açık talebine bağlanır.
    select id into v_id
    from public.deletion_requests
    where entity_type = p_entity_type and target_id = p_target_id
      and status in ('pending', 'processing')
    order by requested_at desc
    limit 1;
    if v_id is null then raise; end if;
    return v_id;
  end;

  insert into public.audit_log (actor, action, detail)
  values (v_user, 'deletion.request', jsonb_build_object(
    'request_id', v_id, 'entity_type', p_entity_type,
    'target_id', p_target_id, 'target_label', v_label
  ));

  return v_id;
end;
$$;

-- Korunan tablodaki silmeyi yalnız onay fonksiyonunun açtığı transaction geçirir.
create or replace function public.guard_approved_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_target_id text;
begin
  -- Onaylı bir üst kaydın CASCADE'i alt kaydı da götürebilir. O silme, ayrı bir
  -- kullanıcı niyeti değil aynı onayın kapsamıdır ve FK trigger'ı içinden gelir.
  if pg_trigger_depth() > 1 then return old; end if;

  v_target_id := to_jsonb(old)->>tg_argv[1];
  -- Yeni el kitabı revizyonu hazırlanırken görsel kopyası yarıda kalırsa, aynı
  -- çağrıda açılmış birkaç dakikalık taslak atomik geri alınır. Bu dar kapı
  -- kullanıcıya açık bir silme yolu değildir: yalnız `created_by` sahibi ve
  -- aşağıdaki rollback RPC'sinin transaction işaretiyle geçer.
  if tg_argv[0] = 'manual_revision'
     and nullif(current_setting('app.manual_copy_rollback_id', true), '') = v_target_id
     and to_jsonb(old)->>'status' = 'draft'
     and (to_jsonb(old)->>'created_by')::uuid = (select auth.uid())
     and (to_jsonb(old)->>'created_at')::timestamptz >= now() - interval '15 minutes'
  then
    return old;
  end if;

  v_request_id := nullif(current_setting('app.deletion_request_id', true), '')::uuid;
  if v_request_id is null or not exists (
    select 1 from public.deletion_requests r
    where r.id = v_request_id
      and r.entity_type = tg_argv[0]
      and r.target_id = v_target_id
      and r.status = 'processing'
      and r.reviewed_by = (select auth.uid())
  ) then
    raise exception 'Kalıcı silme önce Yönetici onayına sunulmalıdır';
  end if;
  return old;
end;
$$;

-- Adlar tabloya göre açık yazılır: migration tekrar koştuğunda güvenle yenilenir.
drop trigger if exists approval_guard_jobs on public.jobs;
create trigger approval_guard_jobs before delete on public.jobs
  for each row execute function public.guard_approved_deletion('job', 'id');
drop trigger if exists approval_guard_projects on public.projects;
create trigger approval_guard_projects before delete on public.projects
  for each row execute function public.guard_approved_deletion('project', 'id');
drop trigger if exists approval_guard_revisions on public.revisions;
create trigger approval_guard_revisions before delete on public.revisions
  for each row execute function public.guard_approved_deletion('revision', 'id');
drop trigger if exists approval_guard_drawing_packages on public.drawing_packages;
create trigger approval_guard_drawing_packages before delete on public.drawing_packages
  for each row execute function public.guard_approved_deletion('drawing_package', 'id');
drop trigger if exists approval_guard_offers on public.offers;
create trigger approval_guard_offers before delete on public.offers
  for each row execute function public.guard_approved_deletion('offer', 'id');
drop trigger if exists approval_guard_offer_revisions on public.offer_revisions;
create trigger approval_guard_offer_revisions before delete on public.offer_revisions
  for each row execute function public.guard_approved_deletion('offer_revision', 'id');
drop trigger if exists approval_guard_offer_cost_revisions on public.offer_cost_revisions;
create trigger approval_guard_offer_cost_revisions before delete on public.offer_cost_revisions
  for each row execute function public.guard_approved_deletion('offer_cost_revision', 'id');
drop trigger if exists approval_guard_employee_documents on public.hr_employee_documents;
create trigger approval_guard_employee_documents before delete on public.hr_employee_documents
  for each row execute function public.guard_approved_deletion('employee_document', 'id');
drop trigger if exists approval_guard_employees on public.hr_employees;
create trigger approval_guard_employees before delete on public.hr_employees
  for each row execute function public.guard_approved_deletion('employee', 'id');
drop trigger if exists approval_guard_project_specs on public.project_specs;
create trigger approval_guard_project_specs before delete on public.project_specs
  for each row execute function public.guard_approved_deletion('project_spec', 'id');
drop trigger if exists approval_guard_electrical_projects on public.electrical_projects;
create trigger approval_guard_electrical_projects before delete on public.electrical_projects
  for each row execute function public.guard_approved_deletion('electrical_project', 'id');
drop trigger if exists approval_guard_manual_revisions on public.manual_revisions;
create trigger approval_guard_manual_revisions before delete on public.manual_revisions
  for each row execute function public.guard_approved_deletion('manual_revision', 'id');
drop trigger if exists approval_guard_equipment_attachments on public.equipment_attachments;
create trigger approval_guard_equipment_attachments before delete on public.equipment_attachments
  for each row execute function public.guard_approved_deletion('equipment_attachment', 'id');

-- Revizyon açma sırasında yarım kalan görsel kopyasının telafisi. Normal
-- kullanıcı silmesi bu fonksiyondan geçemez: yalnız çağıranın az önce açtığı,
-- hâlâ taslak olan revizyon kabul edilir.
create or replace function public.rollback_manual_revision_copy(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not public.can_edit_manuals() then
    raise exception 'El kitabı geri alma yetkisi yok';
  end if;
  if not exists (
    select 1 from public.manual_revisions r
    where r.id = p_revision_id
      and r.status = 'draft'
      and r.created_by = v_user
      and r.created_at >= now() - interval '15 minutes'
  ) then
    raise exception 'Geri alınabilecek yeni taslak bulunamadı';
  end if;

  perform set_config('app.manual_copy_rollback_id', p_revision_id::text, true);
  delete from public.manual_revisions where id = p_revision_id;
  if not found then raise exception 'Yeni taslak geri alınamadı'; end if;
end;
$$;

create or replace function public.approve_deletion_request(
  p_request_id uuid,
  p_review_note text default ''
)
returns table (request_id uuid, target_path text, cleanup_items jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.deletion_requests%rowtype;
  v_reviewer uuid := (select auth.uid());
  v_deleted int := 0;
  v_cleanup jsonb := '[]'::jsonb;
begin
  if v_reviewer is null or not public.is_admin() then
    raise exception 'Silme talebini yalnız Yönetici onaylayabilir';
  end if;

  select * into v_request
  from public.deletion_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Silme talebi bulunamadı'; end if;
  if v_request.status <> 'pending' then raise exception 'Bu silme talebi daha önce sonuçlandırılmış'; end if;

  update public.deletion_requests
  set status = 'processing', reviewed_by = v_reviewer,
      review_note = left(btrim(coalesce(p_review_note, '')), 500)
  where id = p_request_id;
  perform set_config('app.deletion_request_id', p_request_id::text, true);

  -- Satırlar gitmeden önce depo yolları güvenilen tablolardan toplanır.
  if v_request.entity_type = 'drawing_package' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'drawings', 'path', f.storage_path)), '[]'::jsonb)
    into v_cleanup from public.drawing_files f
    where f.package_id = v_request.target_id::uuid and f.stored and f.storage_path <> '';
  elsif v_request.entity_type = 'project' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', x.bucket, 'path', x.path)), '[]'::jsonb)
    into v_cleanup
    from (
      select 'reports'::text bucket, o.name::text path
      from storage.objects o
      where o.bucket_id = 'reports' and o.name like v_request.target_id || '/%'
      union all
      select 'project-specs', s.storage_path from public.project_specs s
      where s.project_id = v_request.target_id::uuid
      union all
      select 'electrical-projects', e.storage_path from public.electrical_projects e
      where e.project_id = v_request.target_id::uuid
      union all
      select 'equipment-attachments', a.storage_path
      from public.equipment_attachments a
      join public.revisions r on r.id = a.revision_id
      where r.project_id = v_request.target_id::uuid
      union all
      select 'manual-images', i.storage_path
      from public.manual_images i
      join public.manual_revisions mr on mr.id = i.revision_id
      join public.manuals m on m.id = mr.manual_id
      where m.project_id = v_request.target_id::uuid
    ) x where x.path is not null and x.path <> '';
  elsif v_request.entity_type = 'revision' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'equipment-attachments', 'path', a.storage_path)), '[]'::jsonb)
    into v_cleanup from public.equipment_attachments a
    where a.revision_id = v_request.target_id::uuid and a.storage_path <> '';
  elsif v_request.entity_type = 'employee_document' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'personnel', 'path', d.storage_path)), '[]'::jsonb)
    into v_cleanup from public.hr_employee_documents d
    where d.id = v_request.target_id::uuid and d.storage_path <> '';
  elsif v_request.entity_type = 'employee' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'personnel', 'path', d.storage_path)), '[]'::jsonb)
    into v_cleanup from public.hr_employee_documents d
    where d.employee_id = v_request.target_id::uuid and d.storage_path <> '';
  elsif v_request.entity_type = 'project_spec' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'project-specs', 'path', s.storage_path)), '[]'::jsonb)
    into v_cleanup from public.project_specs s
    where s.id = v_request.target_id::uuid and s.storage_path <> '';
  elsif v_request.entity_type = 'electrical_project' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'electrical-projects', 'path', e.storage_path)), '[]'::jsonb)
    into v_cleanup from public.electrical_projects e
    where e.id = v_request.target_id::uuid and e.storage_path <> '';
  elsif v_request.entity_type = 'manual_revision' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'manual-images', 'path', i.storage_path)), '[]'::jsonb)
    into v_cleanup from public.manual_images i
    where i.revision_id = v_request.target_id::uuid and i.storage_path <> '';
  elsif v_request.entity_type = 'equipment_attachment' then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', 'equipment-attachments', 'path', a.storage_path)), '[]'::jsonb)
    into v_cleanup from public.equipment_attachments a
    where a.id = v_request.target_id::uuid and a.storage_path <> '';
  end if;

  case v_request.entity_type
    when 'job' then delete from public.jobs where id = v_request.target_id::uuid;
    when 'project' then delete from public.projects where id = v_request.target_id::uuid;
    when 'revision' then delete from public.revisions where id = v_request.target_id::uuid;
    when 'drawing_package' then delete from public.drawing_packages where id = v_request.target_id::uuid;
    when 'offer' then delete from public.offers where id = v_request.target_id::uuid;
    when 'offer_revision' then delete from public.offer_revisions where id = v_request.target_id::uuid;
    when 'offer_cost_revision' then delete from public.offer_cost_revisions where id = v_request.target_id::uuid;
    when 'employee' then delete from public.hr_employees where id = v_request.target_id::uuid;
    when 'employee_document' then delete from public.hr_employee_documents where id = v_request.target_id::uuid;
    when 'project_spec' then delete from public.project_specs where id = v_request.target_id::uuid;
    when 'electrical_project' then delete from public.electrical_projects where id = v_request.target_id::uuid;
    when 'manual_revision' then delete from public.manual_revisions where id = v_request.target_id::uuid;
    when 'equipment_attachment' then delete from public.equipment_attachments where id = v_request.target_id::uuid;
    else raise exception 'Desteklenmeyen silme talebi türü';
  end case;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception 'Silinecek kayıt artık bulunamıyor'; end if;

  update public.deletion_requests
  set status = 'approved', reviewed_at = now(),
      cleanup_items = v_cleanup,
      cleanup_status = case when jsonb_array_length(v_cleanup) = 0 then 'not_required' else 'pending' end,
      cleanup_error = ''
  where id = p_request_id;

  insert into public.audit_log (actor, action, detail)
  values (v_reviewer, 'deletion.approve', jsonb_build_object(
    'request_id', p_request_id, 'entity_type', v_request.entity_type,
    'target_id', v_request.target_id, 'target_label', v_request.target_label,
    'requested_by', v_request.requested_by
  ));

  return query select p_request_id, v_request.target_path, v_cleanup;
end;
$$;

create or replace function public.reject_deletion_request(
  p_request_id uuid,
  p_review_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid := (select auth.uid());
  v_request public.deletion_requests%rowtype;
begin
  if v_reviewer is null or not public.is_admin() then
    raise exception 'Silme talebini yalnız Yönetici reddedebilir';
  end if;
  if btrim(coalesce(p_review_note, '')) = '' then
    raise exception 'Ret gerekçesi gerekli';
  end if;

  select * into v_request from public.deletion_requests
  where id = p_request_id for update;
  if not found then raise exception 'Silme talebi bulunamadı'; end if;
  if v_request.status <> 'pending' then raise exception 'Bu silme talebi daha önce sonuçlandırılmış'; end if;

  update public.deletion_requests
  set status = 'rejected', reviewed_by = v_reviewer, reviewed_at = now(),
      review_note = left(btrim(p_review_note), 500)
  where id = p_request_id;

  insert into public.audit_log (actor, action, detail)
  values (v_reviewer, 'deletion.reject', jsonb_build_object(
    'request_id', p_request_id, 'entity_type', v_request.entity_type,
    'target_id', v_request.target_id, 'target_label', v_request.target_label,
    'requested_by', v_request.requested_by,
    'reason', left(btrim(p_review_note), 500)
  ));
end;
$$;

create or replace function public.mark_deletion_cleanup(
  p_request_id uuid,
  p_status text,
  p_error text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Dosya temizleme sonucunu yalnız Yönetici yazabilir';
  end if;
  if p_status not in ('completed', 'failed') then raise exception 'Geçersiz temizleme durumu'; end if;

  update public.deletion_requests
  set cleanup_status = p_status,
      cleanup_error = case when p_status = 'failed' then left(coalesce(p_error, ''), 1000) else '' end
  where id = p_request_id and status = 'approved' and cleanup_status <> 'not_required';
  if not found then raise exception 'Temizlenecek onaylı talep bulunamadı'; end if;
end;
$$;

revoke all on function public.request_deletion(text, text, jsonb, text) from public;
revoke all on function public.approve_deletion_request(uuid, text) from public;
revoke all on function public.reject_deletion_request(uuid, text) from public;
revoke all on function public.mark_deletion_cleanup(uuid, text, text) from public;
revoke all on function public.rollback_manual_revision_copy(uuid) from public;
grant execute on function public.request_deletion(text, text, jsonb, text) to authenticated;
grant execute on function public.approve_deletion_request(uuid, text) to authenticated;
grant execute on function public.reject_deletion_request(uuid, text) to authenticated;
grant execute on function public.mark_deletion_cleanup(uuid, text, text) to authenticated;
grant execute on function public.rollback_manual_revision_copy(uuid) to authenticated;

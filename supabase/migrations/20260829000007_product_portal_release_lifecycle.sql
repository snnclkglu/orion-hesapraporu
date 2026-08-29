-- MÜŞTERİ PORTALI YAYIN YAŞAM DÖNGÜSÜ
--
-- Yayımlanmış paket snapshot'ı silinmez veya taslağa çevrilmez. Yanlış yayım,
-- aktif sürüm işaretçisi geri çekilerek müşteriden kaldırılır; önceki değişmez
-- bir sürüm aynı işaretçiyle yeniden yayına alınabilir.

create or replace function public.withdraw_product_portal(p_portal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := (select auth.uid());
  project_id_value uuid;
  previous_revision_id uuid;
begin
  if actor_id is null or not public.can_edit_product_portals() then
    raise exception 'Bu işlem için yetkiniz yok';
  end if;

  select project_id, current_revision_id
    into project_id_value, previous_revision_id
  from public.product_portals
  where id = p_portal_id
  for update;

  if project_id_value is null then
    raise exception 'Vinç kimliği bulunamadı';
  end if;

  update public.product_portals
  set current_revision_id = null,
      updated_by = actor_id
  where id = p_portal_id;

  delete from public.product_portal_sessions s
  using public.crane_units u
  where s.unit_id = u.id
    and u.portal_id = p_portal_id;

  update public.crane_units
  set portal_enabled = false,
      updated_by = actor_id
  where portal_id = p_portal_id;

  insert into public.audit_log(project_id, actor, action, detail)
  values (
    project_id_value,
    actor_id,
    'product_portal.withdraw',
    jsonb_build_object(
      'portal_id', p_portal_id,
      'previous_revision_id', previous_revision_id
    )
  );

  return previous_revision_id;
end;
$$;

create or replace function public.activate_product_portal_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := (select auth.uid());
  portal_id_value uuid;
  project_id_value uuid;
  previous_revision_id uuid;
begin
  if actor_id is null or not public.can_edit_product_portals() then
    raise exception 'Bu işlem için yetkiniz yok';
  end if;

  select r.portal_id, p.project_id
    into portal_id_value, project_id_value
  from public.product_portal_revisions r
  join public.product_portals p on p.id = r.portal_id
  where r.id = p_revision_id
    and r.status = 'issued'
    and exists (
      select 1 from public.product_portal_files f where f.revision_id = r.id
    );

  if portal_id_value is null then
    raise exception 'Yayımlanmış ve dosyaları hazır sürüm bulunamadı';
  end if;

  select current_revision_id into previous_revision_id
  from public.product_portals
  where id = portal_id_value
  for update;

  update public.product_portals
  set current_revision_id = p_revision_id,
      updated_by = actor_id
  where id = portal_id_value;

  insert into public.audit_log(project_id, actor, action, detail)
  values (
    project_id_value,
    actor_id,
    'product_portal.activate_revision',
    jsonb_build_object(
      'portal_id', portal_id_value,
      'previous_revision_id', previous_revision_id,
      'revision_id', p_revision_id
    )
  );

  return portal_id_value;
end;
$$;

revoke all on function public.withdraw_product_portal(uuid) from public, anon;
revoke all on function public.activate_product_portal_revision(uuid) from public, anon;
grant execute on function public.withdraw_product_portal(uuid) to authenticated;
grant execute on function public.activate_product_portal_revision(uuid) to authenticated;

comment on function public.withdraw_product_portal(uuid) is
  'Aktif müşteri paketini yayından kaldırır; üniteleri kapatır ve oturumları iptal eder.';
comment on function public.activate_product_portal_revision(uuid) is
  'Aynı portalın değişmez yayımlanmış bir paketini yeniden aktif eder.';

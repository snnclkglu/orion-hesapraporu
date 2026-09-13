-- Hesaptan resim planı: mevcut numaralar korunur, montaj ilişkisi ayrı saklanır.
alter table public.project_drawing_plan
  add column parent_id uuid,
  add column sort_order integer,
  add column source_key text,
  add column origin text not null default 'legacy' check (origin in ('auto','manual','legacy')),
  add column generated_values jsonb,
  add column overrides jsonb not null default '[]',
  add column suppressed boolean not null default false,
  add column reason text not null default '';
alter table public.project_drawing_plan add constraint pdp_project_row_unique unique(project_id,id);
alter table public.project_drawing_plan add constraint pdp_parent_fk
  foreign key(project_id,parent_id) references public.project_drawing_plan(project_id,id) deferrable initially deferred;
alter table public.project_drawing_plan drop constraint project_drawing_plan_project_id_code_key;
alter table public.project_drawing_plan add constraint project_drawing_plan_project_id_code_key
  unique(project_id,code) deferrable initially deferred;
create unique index pdp_source_unique on public.project_drawing_plan(project_id,source_key) where source_key is not null;

create table public.project_drawing_plan_state (
  project_id uuid primary key references public.projects(id) on delete cascade,
  version bigint not null default 0,
  source_revision_id uuid references public.revisions(id) on delete set null,
  source_revision_label text not null default '',
  source_updated_at timestamptz,
  fingerprint text not null default '',
  numbering jsonb not null default '{"main":1500,"auxiliary":2500}',
  generator_version text not null default '1.0.0',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.project_drawing_plan_state enable row level security;
create policy pdps_select on public.project_drawing_plan_state for select to authenticated using(true);
create policy pdps_insert on public.project_drawing_plan_state for insert to authenticated with check(public.can_edit_reports());
create policy pdps_update on public.project_drawing_plan_state for update to authenticated using(public.can_edit_reports()) with check(public.can_edit_reports());

-- Eski istemcinin doğrudan satır yazması da yeni editörün sürümünü geçersiz kılar.
create function public.bump_drawing_plan_version() returns trigger
language plpgsql security invoker set search_path=public as $$
declare target uuid;
begin
  target := case when tg_op='DELETE' then old.project_id else new.project_id end;
  if exists(select 1 from projects where id=target) then
    insert into project_drawing_plan_state(project_id,version,updated_by) values(target,1,auth.uid())
    on conflict(project_id) do update set version=project_drawing_plan_state.version+1,updated_at=now(),updated_by=auth.uid();
  end if;
  return null;
end $$;
create trigger pdp_bump_version after insert or update or delete on public.project_drawing_plan
for each row execute function public.bump_drawing_plan_version();

create function public.save_drawing_plan_document(
  p_project_id uuid, p_expected_version bigint, p_rows jsonb, p_state jsonb,
  p_source_updated_at timestamptz default null
) returns bigint language plpgsql security invoker set search_path=public as $$
declare current_version bigint; item jsonb; source_id uuid; source_stamp timestamptz;
begin
  if auth.uid() is null or not public.can_edit_reports() then raise exception 'Bu resim planını düzenleme yetkiniz yok.' using errcode='42501'; end if;
  if not exists(select 1 from projects where id=p_project_id and coalesce(report_context,'engineering')='engineering') then
    raise exception 'Mühendislik projesi bulunamadı.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)>120 then raise exception 'Geçersiz resim planı; en fazla 120 satır.'; end if;
  if p_rows is null or p_state is null or p_expected_version is null then raise exception 'Eksik plan verisi.'; end if;
  insert into project_drawing_plan_state(project_id) values(p_project_id) on conflict do nothing;
  select version into current_version from project_drawing_plan_state where project_id=p_project_id for update;
  if current_version<>p_expected_version then raise exception 'Resim planı başka bir kullanıcı tarafından değiştirildi. Taslağınız korundu; güncel planı yeniden açın.' using errcode='40001'; end if;
  source_id := nullif(p_state->>'sourceRevisionId','')::uuid;
  if source_id is not null then
    select updated_at into source_stamp from revisions where id=source_id and project_id=p_project_id for share;
    if not found then raise exception 'Kaynak revizyon bu projeye ait değil.'; end if;
    if p_source_updated_at is null or source_stamp<>p_source_updated_at then raise exception 'Kaynak hesap değişti; güncel hesapla tekrar deneyin.' using errcode='40001'; end if;
  end if;
  if (p_state->'numbering'->>'main')::integer not between 200 and 9000
    or (p_state->'numbering'->>'auxiliary')::integer not between 200 and 9000
    or (p_state->'numbering'->>'main')::integer % 100 <> 0
    or (p_state->'numbering'->>'auxiliary')::integer % 100 <> 0
    or (p_state->'numbering'->>'main')::integer >= (p_state->'numbering'->>'auxiliary')::integer
    or p_state->'numbering'->>'main' is null or p_state->'numbering'->>'auxiliary' is null then raise exception 'Geçersiz numara başlangıçları.'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r group by r->>'id' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(p_rows) r group by r->>'code' having count(*)>1) then raise exception 'Satır kimliği veya resim numarası tekrarlanıyor.'; end if;
  for item in select * from jsonb_array_elements(p_rows) loop
    if item->>'id' is null or item->>'code' is null or item->>'code' !~ '^[0-9]{4}$'
      or length(trim(coalesce(item->>'name','')))=0 or length(item->>'name')>120 or length(coalesce(item->>'note',''))>300
      or coalesce(item->>'status','') not in ('bekliyor','ciziliyor','revize','kontrol','cizildi') then raise exception 'Geçersiz resim satırı.'; end if;
    if exists(select 1 from project_drawing_plan where id=(item->>'id')::uuid and project_id<>p_project_id) then raise exception 'Satır başka projeye ait.'; end if;
    if nullif(item->>'parentId','') is not null and not exists(
      select 1 from jsonb_array_elements(p_rows) r where r->>'id'=item->>'parentId'
      and (coalesce((item->>'suppressed')::boolean,false) or not coalesce((r->>'suppressed')::boolean,false))
    ) then raise exception 'Üst montaj bulunamadı veya kaldırılmış.'; end if;
  end loop;
  if exists(
    with recursive links as (
      select r->>'id' id, nullif(r->>'parentId','') parent from jsonb_array_elements(p_rows) r
    ), chain as (
      select id, parent, array[id] path, false cycle from links
      union all
      select c.id,l.parent,c.path||l.id,l.id=any(c.path) from chain c join links l on l.id=c.parent where not c.cycle
    ) select 1 from chain where cycle
  ) then raise exception 'Montaj ilişkisi döngü içeriyor.'; end if;
  -- Silme, numara değişimi, ekleme ve audit aynı transaction içindedir.
  delete from project_drawing_plan where project_id=p_project_id
    and id not in(select (r->>'id')::uuid from jsonb_array_elements(p_rows) r);
  for item in select * from jsonb_array_elements(p_rows) loop
    insert into project_drawing_plan(id,project_id,code,name,status,drawn_by,note,parent_id,sort_order,source_key,origin,generated_values,overrides,suppressed,reason,created_by,updated_by)
    values((item->>'id')::uuid,p_project_id,item->>'code',item->>'name',item->>'status',nullif(item->>'drawnBy','')::uuid,coalesce(item->>'note',''),
      nullif(item->>'parentId','')::uuid,(item->>'sortOrder')::integer,nullif(item->>'sourceKey',''),coalesce(item->>'origin','manual'),nullif(item->'generated','null'::jsonb),coalesce(item->'overrides','[]'),coalesce((item->>'suppressed')::boolean,false),coalesce(item->>'reason',''),auth.uid(),auth.uid())
    on conflict(id) do update set code=excluded.code,name=excluded.name,status=excluded.status,drawn_by=excluded.drawn_by,note=excluded.note,
      parent_id=excluded.parent_id,sort_order=excluded.sort_order,source_key=excluded.source_key,origin=excluded.origin,generated_values=excluded.generated_values,
      overrides=excluded.overrides,suppressed=excluded.suppressed,reason=excluded.reason,updated_at=now(),updated_by=auth.uid();
  end loop;
  update project_drawing_plan_state set version=version+1,source_revision_id=source_id,source_revision_label=coalesce(p_state->>'sourceRevisionLabel',''),
    source_updated_at=p_source_updated_at,fingerprint=coalesce(p_state->>'fingerprint',''),numbering=p_state->'numbering',updated_at=now(),updated_by=auth.uid()
    where project_id=p_project_id returning version into current_version;
  insert into audit_log(project_id,actor,action,detail) values(p_project_id,auth.uid(),'drawingPlan.save',jsonb_build_object('version',current_version,'rows',jsonb_array_length(p_rows),'sourceRevisionId',source_id));
  return current_version;
end $$;
revoke all on function public.save_drawing_plan_document(uuid,bigint,jsonb,jsonb,timestamptz) from public,anon;
grant execute on function public.save_drawing_plan_document(uuid,bigint,jsonb,jsonb,timestamptz) to authenticated;

notify pgrst, 'reload schema';

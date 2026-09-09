-- Hızlı seçim: tutarlı katalog aktarımı ve teklif kalemi / hesap raporu bağı.
-- Yayınlanmış rapor koruması değiştirilmez; kayıt çakışması mevcut updated_at ile çözülür.
create table public.auto_selection_catalog_state (
  id boolean primary key default true check (id),
  version bigint not null default 1
);
insert into public.auto_selection_catalog_state(id) values (true);
alter table public.auto_selection_catalog_state enable row level security;
create policy auto_selection_catalog_read on public.auto_selection_catalog_state
  for select to authenticated using (true);
grant select on public.auto_selection_catalog_state to authenticated;

create function public.bump_auto_selection_catalog_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.auto_selection_catalog_state set version = version + 1 where id;
  return null;
end;
$$;
revoke all on function public.bump_auto_selection_catalog_version() from public;
create trigger auto_selection_catalog_version after insert or update or delete or truncate
  on public.cat_equipment for each statement execute function public.bump_auto_selection_catalog_version();

create table public.offer_item_calculations (
  offer_revision_id uuid not null references public.offer_revisions(id) on delete cascade,
  item_id text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_id uuid not null references public.revisions(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(offer_revision_id, item_id)
);
alter table public.offer_item_calculations enable row level security;
create policy offer_item_calculations_read on public.offer_item_calculations
  for select to authenticated using (public.can_see_offers() and exists (
    select 1 from public.offer_revisions r where r.id = offer_revision_id
  ));
create policy offer_item_calculations_insert on public.offer_item_calculations
  for insert to authenticated with check (
    public.can_edit_offers() and created_by = (select auth.uid())
    and exists (select 1 from public.offer_revisions r
      where r.id = offer_revision_id and r.status = 'draft'
        and exists (select 1 from jsonb_array_elements(r.payload->'items') i where i->>'id' = item_id))
    and exists (select 1 from public.revisions r join public.projects p on p.id = r.project_id
      where r.id = revision_id and p.id = offer_item_calculations.project_id
        and p.report_context = 'offer' and r.status = 'draft' and p.created_by = (select auth.uid()))
  );
grant select, insert on public.offer_item_calculations to authenticated;

create function public.create_offer_item_calculation(
  p_offer_revision_id uuid, p_item_id text, p_inputs jsonb, p_selections jsonb,
  p_results jsonb, p_engine_version text
) returns table(project_id uuid, revision_id uuid)
language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.offer_revisions%rowtype;
  v_item jsonb;
  v_project uuid;
  v_report uuid;
  v_customer text;
begin
  if auth.uid() is null or not public.can_edit_offers() then raise exception 'Teklif düzenleme yetkisi gerekli'; end if;
  select * into v_revision from public.offer_revisions where id = p_offer_revision_id for update;
  if not found or v_revision.status <> 'draft' then raise exception 'Teklif revizyonu düzenlenebilir değil'; end if;
  select value into v_item from jsonb_array_elements(v_revision.payload->'items') where value->>'id' = p_item_id;
  if v_item is null then raise exception 'Önce teklif kalemini kaydedin'; end if;
  select c.project_id, c.revision_id into v_project, v_report from public.offer_item_calculations c
    where c.offer_revision_id = p_offer_revision_id and c.item_id = p_item_id;
  if found then return query select v_project, v_report; return; end if;
  if jsonb_typeof(p_inputs) <> 'object' or jsonb_typeof(p_selections) <> 'object' or jsonb_typeof(p_results) <> 'object'
    or octet_length(p_inputs::text) + octet_length(p_selections::text) + octet_length(p_results::text) > 4000000
    then raise exception 'Hesap verisi geçersiz'; end if;
  select coalesce(c.name, 'TEKLİF MÜŞTERİSİ') into v_customer
    from public.offers o left join public.customers c on c.id = o.customer_id where o.id = v_revision.offer_id;
  insert into public.projects(doc_no,name,customer,crane_type,report_context,created_by)
    values ('THR-' || upper(substr(gen_random_uuid()::text,1,8)), coalesce(nullif(v_item->>'title',''), 'TEKLİF ÖN HESABI'),
      coalesce(v_customer,'TEKLİF MÜŞTERİSİ'), coalesce(nullif(v_item->>'craneType',''),'Çift Kirişli Gezer Köprülü Vinç'), 'offer', auth.uid())
    returning id into v_project;
  insert into public.revisions(project_id,rev_no,label,status,inputs,selections,results,engine_version,created_by)
    values (v_project,0,'TEKLİF ÖN HESABI','draft',p_inputs,p_selections,p_results,p_engine_version,auth.uid()) returning id into v_report;
  insert into public.offer_item_calculations values(p_offer_revision_id,p_item_id,v_project,v_report,auth.uid(),now());
  insert into public.audit_log(project_id,revision_id,actor,action,detail)
    values(v_project,v_report,auth.uid(),'auto_selection.offer_report.create',jsonb_build_object('offer_revision_id',p_offer_revision_id,'item_id',p_item_id));
  return query select v_project,v_report;
end;
$$;
revoke all on function public.create_offer_item_calculation(uuid,text,jsonb,jsonb,jsonb,text) from public;
grant execute on function public.create_offer_item_calculation(uuid,text,jsonb,jsonb,jsonb,text) to authenticated;

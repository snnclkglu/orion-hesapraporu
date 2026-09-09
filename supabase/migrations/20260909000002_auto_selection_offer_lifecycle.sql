-- Teklif talebini ve kaynak hesap sürümünü aynı işlemde doğrular.
-- Kopya ilk açılışta ayrı projeye dönüşür; mevcut raporun manuel alanları korunur.
create policy offer_item_calculations_update on public.offer_item_calculations
  for update to authenticated using (public.can_edit_offers() and exists (
    select 1 from public.offer_revisions o where o.id = offer_revision_id and o.status = 'draft'
  )) with check (public.can_edit_offers() and exists (
    select 1 from public.revisions r join public.projects p on p.id = r.project_id
    where r.id = revision_id and p.id = offer_item_calculations.project_id and p.report_context = 'offer'
  ));
grant update(revision_id) on public.offer_item_calculations to authenticated;

create function public.open_offer_item_calculation_v2(
  p_offer_revision_id uuid, p_item_id text, p_expected_item jsonb,
  p_source_revision_id uuid, p_source_updated_at timestamptz,
  p_inputs jsonb, p_selections jsonb, p_results jsonb, p_engine_version text
) returns table(project_id uuid, revision_id uuid)
language plpgsql security invoker set search_path = '' as $$
declare
  v_offer public.offer_revisions%rowtype;
  v_link public.offer_item_calculations%rowtype;
  v_source public.revisions%rowtype;
  v_item jsonb;
  v_project uuid;
  v_report uuid;
  v_customer text;
begin
  if auth.uid() is null or not public.can_edit_offers() then raise exception 'Teklif düzenleme yetkisi gerekli'; end if;
  select * into v_offer from public.offer_revisions where id = p_offer_revision_id for update;
  if not found or v_offer.status <> 'draft' then raise exception 'Teklif taslağı bulunamadı'; end if;
  select value into v_item from jsonb_array_elements(v_offer.payload->'items') where value->>'id' = p_item_id;
  if v_item is null or v_item is distinct from p_expected_item then raise exception 'Teklif kalemi değişti; yeniden açın'; end if;
  if jsonb_typeof(p_inputs) is distinct from 'object' or jsonb_typeof(p_selections) is distinct from 'object'
    or jsonb_typeof(p_results) is distinct from 'object'
    or octet_length(p_inputs::text) + octet_length(p_selections::text) + octet_length(p_results::text) > 4000000
    then raise exception 'Hesap verisi geçersiz'; end if;
  select * into v_link from public.offer_item_calculations c
    where c.offer_revision_id = p_offer_revision_id and c.item_id = p_item_id for update;
  if v_link.revision_id is not null and p_source_revision_id is null then
    return query select v_link.project_id, v_link.revision_id; return;
  end if;
  if p_source_revision_id is not null then
    select r.* into v_source from public.revisions r join public.projects p on p.id = r.project_id
      where r.id = p_source_revision_id and p.report_context = 'offer' for update of r;
    if not found or v_source.updated_at is distinct from p_source_updated_at then raise exception 'Kaynak hesap değişti; yeniden açın'; end if;
    if v_link.revision_id is not null and v_link.revision_id <> v_source.id then raise exception 'Bağlı hesap sürümü değişti'; end if;
  end if;
  if v_link.revision_id is not null then
    v_project := v_link.project_id;
    if v_source.status = 'draft' then
      update public.revisions set inputs=p_inputs, selections=p_selections, results=p_results, engine_version=p_engine_version
        where id=v_source.id and status='draft' and updated_at=p_source_updated_at returning id into v_report;
      if v_report is null then raise exception 'Hesap kayıt çakışması'; end if;
    else
      perform 1 from public.projects where id=v_project for update;
      insert into public.revisions(project_id,rev_no,label,status,inputs,selections,results,engine_version,created_by)
        select v_project,coalesce(max(r.rev_no),-1)+1,'TEKLİF ÖN HESABI','draft',p_inputs,p_selections,p_results,p_engine_version,auth.uid()
        from public.revisions r where r.project_id=v_project returning id into v_report;
      update public.offer_item_calculations set revision_id=v_report where offer_revision_id=p_offer_revision_id and item_id=p_item_id;
    end if;
  else
    select o.customer_name into v_customer from public.offers o where o.id=v_offer.offer_id;
    insert into public.projects(doc_no,name,customer,crane_type,report_context,created_by)
      values ('THR-' || upper(substr(gen_random_uuid()::text,1,8)),coalesce(nullif(v_item->>'title',''),'TEKLİF ÖN HESABI'),
        coalesce(nullif(v_customer,''),'TEKLİF MÜŞTERİSİ'),coalesce(nullif(v_item->>'craneType',''),'Çift Kirişli Gezer Köprülü Vinç'),'offer',auth.uid())
      returning id into v_project;
    insert into public.revisions(project_id,rev_no,label,status,inputs,selections,results,engine_version,created_by)
      values(v_project,0,'TEKLİF ÖN HESABI','draft',p_inputs,p_selections,p_results,p_engine_version,auth.uid()) returning id into v_report;
    insert into public.offer_item_calculations values(p_offer_revision_id,p_item_id,v_project,v_report,auth.uid(),now());
  end if;
  insert into public.audit_log(project_id,revision_id,actor,action,detail)
    values(v_project,v_report,auth.uid(),'auto_selection.offer_report.sync',jsonb_build_object('offer_revision_id',p_offer_revision_id,'item_id',p_item_id,'source_revision_id',p_source_revision_id));
  return query select v_project,v_report;
end;
$$;
revoke all on function public.open_offer_item_calculation_v2(uuid,text,jsonb,uuid,timestamptz,jsonb,jsonb,jsonb,text) from public,anon;
grant execute on function public.open_offer_item_calculation_v2(uuid,text,jsonb,uuid,timestamptz,jsonb,jsonb,jsonb,text) to authenticated;

-- Aynı teklifin yeni revizyonu hesaplarını da atomik kopyalar. Agent API'sinin
-- ortak insert yolu da bu tetikleyiciden geçer. Yeni hesaba eski inceleme onayı taşınmaz.
create function public.copy_offer_revision_calculations()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_previous uuid;
  v_item jsonb;
  v_row record;
  v_project uuid;
  v_revision uuid;
  v_inputs jsonb;
begin
  select id into v_previous from public.offer_revisions where offer_id=new.offer_id and rev_no<new.rev_no order by rev_no desc limit 1;
  if v_previous is null then return new; end if;
  for v_row in select c.item_id,r.*,p.crane_type from public.offer_item_calculations c
    join public.revisions r on r.id=c.revision_id join public.projects p on p.id=r.project_id
    where c.offer_revision_id=v_previous and p.report_context='offer'
  loop
    select value into v_item from jsonb_array_elements(new.payload->'items') where value->>'id'=v_row.item_id;
    if v_item is null then continue; end if;
    insert into public.projects(doc_no,name,customer,crane_type,report_context,created_by)
      select 'THR-' || upper(substr(gen_random_uuid()::text,1,8)),coalesce(nullif(v_item->>'title',''),'TEKLİF ÖN HESABI'),o.customer_name,
        coalesce(nullif(v_item->>'craneType',''),v_row.crane_type),'offer',new.created_by from public.offers o where o.id=new.offer_id returning id into v_project;
    v_inputs := v_row.inputs #- '{autoSelection,review}';
    v_inputs := jsonb_set(v_inputs,'{offerTechnicalSource}',coalesce(v_inputs->'offerTechnicalSource','{}'::jsonb)
      || jsonb_build_object('offerRevisionId',new.id,'itemId',v_row.item_id),true);
    insert into public.revisions(project_id,rev_no,label,status,inputs,selections,results,engine_version,created_by)
      values(v_project,0,'TEKLİF ÖN HESABI','draft',v_inputs,v_row.selections,v_row.results,v_row.engine_version,new.created_by) returning id into v_revision;
    insert into public.offer_item_calculations values(new.id,v_row.item_id,v_project,v_revision,new.created_by,now());
    insert into public.audit_log(project_id,revision_id,actor,action,detail)
      values(v_project,v_revision,new.created_by,'auto_selection.offer_report.copy',jsonb_build_object('source_revision_id',v_row.id,'offer_revision_id',new.id));
  end loop;
  return new;
end;
$$;
revoke all on function public.copy_offer_revision_calculations() from public,anon,authenticated;
create trigger offer_revision_calculations_copy after insert on public.offer_revisions
  for each row execute function public.copy_offer_revision_calculations();

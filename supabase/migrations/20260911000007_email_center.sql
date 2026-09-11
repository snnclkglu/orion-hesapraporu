-- E-posta Merkezi: yayın, şablon, olay ve teslim kayıtları.
alter table public.jobs add column document_editing boolean not null default false;
alter table public.jobs add column document_edit_token uuid, add column document_edit_until timestamptz;
-- Ayrı HTTP adımlarındaki kalem yenilemeleri aynı işte üst üste binmez.
create function public.job_document_lock(p_job uuid,p_token uuid,p_release boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.can_edit_jobs() then raise exception 'İş emri düzenleme yetkisi yok.'; end if;
  if p_release then
    update public.jobs set document_edit_token=null,document_edit_until=null where id=p_job and document_edit_token=p_token;
  else
    update public.jobs set document_edit_token=p_token,document_edit_until=now()+interval '15 minutes'
      where id=p_job and (document_edit_token is null or document_edit_until<now());
  end if;
  return found;
end $$;
revoke all on function public.job_document_lock(uuid,uuid,boolean) from public,anon;
grant execute on function public.job_document_lock(uuid,uuid,boolean) to authenticated;
create table public.email_settings (
  id boolean primary key default true check(id),
  paused boolean not null default false,
  test_address text not null default 'scolakoglu@orioncranes.com',
  updated_at timestamptz not null default now()
);
insert into public.email_settings(id) values(true);
create table public.email_templates (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, published_version_id uuid,
  created_at timestamptz not null default now()
);
create table public.email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.email_templates(id),
  version integer not null, content jsonb not null,
  created_by uuid references public.profiles(id), source text not null,
  created_at timestamptz not null default now(),
  unique(template_id,version), unique(template_id,id)
);
alter table public.email_templates add constraint email_published_version_fk
  foreign key(id,published_version_id) references public.email_template_versions(template_id,id);
create table public.email_rules (
  id uuid primary key default gen_random_uuid(), name text not null,
  event_type text not null check(event_type in ('job.published','job.revised','gorev_atandi','bahsedildi','durum_degisti')),
  template_id uuid not null references public.email_templates(id),
  mode text not null default 'off' check(mode in ('off','test','live')),
  user_ids uuid[] not null default '{}', roles public.user_role[] not null default '{}',
  related_recipients boolean not null default false,
  include_actor boolean not null default false,
  priority integer not null default 100,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.email_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id), source text not null,
  action text not null, entity_id text not null,
  before_value jsonb, after_value jsonb,
  created_at timestamptz not null default now()
);
create table public.job_publications (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs(id),
  revision text not null, snapshot jsonb not null, fingerprint text not null,
  published_by uuid not null references public.profiles(id), published_at timestamptz not null default now(),
  unique(job_id,revision)
);
create table public.email_events (
  id uuid primary key default gen_random_uuid(), source_key text not null unique,
  event_type text not null, job_id uuid references public.jobs(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  context jsonb not null, plans jsonb not null default '[]',
  status text not null default 'pending' check(status in ('pending','processing','done','failed','skipped')),
  attempts integer not null default 0, lease_until timestamptz, last_error text,
  created_at timestamptz not null default now()
);
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.email_events(id), rule_id uuid references public.email_rules(id),
  template_version_id uuid not null references public.email_template_versions(id),
  job_id uuid references public.jobs(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  recipient text not null, recipient_name text not null default '', reasons jsonb not null default '[]',
  mode text not null check(mode in ('test','live')), payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','sent','delivered','delayed','failed','bounced','complained','skipped','cancelled')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  lease_until timestamptz, first_attempt_at timestamptz, sent_at timestamptz,
  provider_id text unique, last_error text, provider_events jsonb not null default '{}',
  resend_of uuid references public.email_deliveries(id),
  created_at timestamptz not null default now(),
  unique(event_id,recipient)
);
create table public.email_webhook_events (
  id text primary key, provider_id text not null, event_type text not null,
  occurred_at timestamptz not null, received_at timestamptz not null default now()
);
create index email_event_queue on public.email_events(created_at) where status in ('pending','processing');
create index email_delivery_queue on public.email_deliveries(next_attempt_at) where status in ('pending','processing');
create index email_delivery_job on public.email_deliveries(job_id,created_at desc);

-- İnsan ve ajan yazımları aynı servis geçidinden yapılır. İstemci yalnız yöneticiyse okur.
do $$ declare t text; begin
  foreach t in array array['email_settings','email_templates','email_template_versions','email_rules','email_audit','email_events','email_deliveries','email_webhook_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy admin_read on public.%I for select to authenticated using(public.is_admin())',t);
  end loop;
end $$;
alter table public.job_publications enable row level security;
revoke all on public.job_publications from anon, authenticated;
grant select on public.job_publications to authenticated;
grant all on public.job_publications to service_role;
create policy publication_read on public.job_publications for select to authenticated using(true);

create function public.email_immutable() returns trigger language plpgsql as $$
begin raise exception 'Bu kayıt değiştirilemez.'; end $$;
create trigger immutable_email_versions before update or delete on public.email_template_versions for each row execute function public.email_immutable();
create trigger immutable_email_audit before update or delete on public.email_audit for each row execute function public.email_immutable();
create trigger immutable_job_publications before update or delete on public.job_publications for each row execute function public.email_immutable();

-- Alıcı önizlemesi ve gerçek olay kaydı aynı sorguyu kullanır.
create function public.email_resolve_recipients(p_rule jsonb,p_actor uuid,p_targets uuid[])
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId',p.id,'name',p.full_name,'email',u.email,
    'reasons',to_jsonb(array_remove(array[
      case when p.id::text in (select jsonb_array_elements_text(p_rule->'user_ids')) then 'Doğrudan seçildi' end,
      case when p.role::text in (select jsonb_array_elements_text(p_rule->'roles')) then 'Rol: '||p.role::text end,
      case when coalesce((p_rule->>'related_recipients')::boolean,false) and p.id=any(p_targets) then 'Olayın ilgili kişisi' end
    ],null))
  ) order by p.full_name,p.id),'[]')
  from public.profiles p join auth.users u on u.id=p.id
  where u.email is not null and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until<now())
    and (coalesce((p_rule->>'include_actor')::boolean,false) or p.id is distinct from p_actor)
    and (p.id::text in (select jsonb_array_elements_text(p_rule->'user_ids'))
      or p.role::text in (select jsonb_array_elements_text(p_rule->'roles'))
      or (coalesce((p_rule->>'related_recipients')::boolean,false) and p.id=any(p_targets)));
$$;
create function public.email_capture_event(p_source text,p_type text,p_job uuid,p_actor uuid,p_context jsonb,p_targets uuid[] default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid; plan jsonb; cfg public.email_settings; begin
  select * into cfg from public.email_settings where id;
  if p_job is not null then
    select jsonb_build_object('job.number',j.job_no,'job.title',j.title,'job.customerName',j.customer,
      'job.deliveryDate',coalesce(to_char(j.delivery_date,'DD.MM.YYYY'),''),
      'publication.revisionLabel',case when j.revision='' then 'Revizyonsuz' else 'Revizyon '||j.revision end,
      'links.job','https://app.orioncranes.com/jobs/'||j.id)||p_context into p_context
      from public.jobs j where j.id=p_job;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('rule',to_jsonb(r),'versionId',v.id,
    'content',v.content,'recipients',public.email_resolve_recipients(to_jsonb(r),p_actor,p_targets),
    'testAddress',cfg.test_address) order by r.priority,r.id),'[]') into plan
  from public.email_rules r join public.email_template_versions v on v.id=(select published_version_id from public.email_templates where id=r.template_id)
  where r.event_type=p_type and r.mode<>'off';
  insert into public.email_events(source_key,event_type,job_id,actor_id,context,plans,status,last_error)
    values(p_source,p_type,p_job,p_actor,p_context,plan,
      case when cfg.paused or plan='[]'::jsonb then 'skipped' else 'pending' end,
      case when cfg.paused then 'Gönderimler durdurulmuş' when plan='[]'::jsonb then 'Etkin kural yok' end)
    on conflict(source_key) do nothing returning id into eid;
  if eid is null then select id into eid from public.email_events where source_key=p_source; end if;
  return eid;
end $$;

-- İş/kalem fotoğrafı yalnız sunucudaki satırlardan oluşur; sıra ve teknik çarpanlardan bağımsızdır.
create function public.job_publication_snapshot(p_job uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('job',to_jsonb(j)-array['updated_at','status','document_editing','document_edit_token','document_edit_until'], 'items',
    coalesce((select jsonb_agg(jsonb_build_object('item_no',i.item_no,'product_name',i.product_name,'quantity',i.quantity) order by i.sort,i.item_no)
      from public.job_items i where i.job_id=j.id),'[]')) from public.jobs j where j.id=p_job;
$$;
create function public.publish_job_order(p_job uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare j public.jobs; snap jsonb; pid uuid; prev public.job_publications; et text; begin
  if auth.uid() is null or not public.can_edit_jobs() then raise exception 'İş emri yayınlama yetkisi yok.'; end if;
  select * into j from public.jobs where id=p_job for update;
  if not found then raise exception 'İş bulunamadı.'; end if;
  if j.document_editing then raise exception 'İş emri kaydı tamamlanmamış. Düzenleme ekranında tekrar kaydedin.'; end if;
  snap:=public.job_publication_snapshot(p_job);
  select * into prev from public.job_publications where job_id=p_job and revision=j.revision;
  if found then
    if prev.fingerprint=md5(snap::text) then return prev.id; end if;
    raise exception 'Bu revizyon zaten yayımlandı. Değişiklikleri yeni revizyonla yayımlayın.';
  end if;
  if exists(select 1 from public.job_publications where job_id=p_job) then et:='job.revised'; else et:='job.published'; end if;
  insert into public.job_publications(job_id,revision,snapshot,fingerprint,published_by)
    values(p_job,j.revision,snap,md5(snap::text),auth.uid()) returning id into pid;
  perform public.email_capture_event('publication/'||pid,et,p_job,auth.uid(),jsonb_build_object(
    'job.number',j.job_no,'job.title',j.title,'job.customerName',j.customer,
    'job.deliveryDate',coalesce(to_char(j.delivery_date,'DD.MM.YYYY'),''),
    'publication.revisionLabel',case when j.revision='' then 'Revizyonsuz' else 'Revizyon '||j.revision end,
    'links.job','https://app.orioncranes.com/jobs/'||p_job,
    'notification.title',case when et='job.published' then 'İş emri yayımlandı' else 'İş emri revizyonu yayımlandı' end
  ));
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'job.publish',jsonb_build_object('job_id',p_job,'publication_id',pid,'revision',j.revision));
  return pid;
end $$;

-- Yönetim yazımı + önce/sonra denetimi tek transaction içindedir.
create function public.email_manage(p_action text,p_data jsonb,p_actor uuid,p_source text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; old jsonb; eid uuid; tid uuid; ver integer; begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Yönetici yetkisi gerekli.'; end if;
  if p_action='template.save' then
    insert into public.email_templates(slug,name) values(p_data->>'slug',p_data->>'name')
      on conflict(slug) do nothing;
    select id into tid from public.email_templates where slug=p_data->>'slug' for update;
    select to_jsonb(t) into old from public.email_templates t where id=tid;
    update public.email_templates set name=p_data->>'name' where id=tid;
    select coalesce(max(version),0)+1 into ver from public.email_template_versions where template_id=tid;
    insert into public.email_template_versions(template_id,version,content,created_by,source)
      values(tid,ver,p_data->'content',p_actor,p_source) returning to_jsonb(email_template_versions.*) into result;
    eid:=tid;
  elsif p_action='template.publish' then
    eid:=(p_data->>'templateId')::uuid;
    select to_jsonb(t) into old from public.email_templates t where id=eid for update;
    if old is null then raise exception 'Şablon bulunamadı.'; end if;
    update public.email_templates set published_version_id=(p_data->>'versionId')::uuid where id=eid returning to_jsonb(email_templates.*) into result;
  elsif p_action='rule.save' then
    eid:=coalesce((p_data->>'id')::uuid,gen_random_uuid());
    select to_jsonb(r) into old from public.email_rules r where id=eid for update;
    if old is not null and (p_data->>'revision')::integer is distinct from (old->>'revision')::integer then raise exception 'Kural değişmiş. Yenileyip tekrar deneyin.'; end if;
    insert into public.email_rules(id,name,event_type,template_id,mode,user_ids,roles,related_recipients,include_actor,priority)
      values(eid,p_data->>'name',p_data->>'eventType',(p_data->>'templateId')::uuid,p_data->>'mode',
      array(select jsonb_array_elements_text(p_data->'userIds')::uuid),array(select jsonb_array_elements_text(p_data->'roles')::public.user_role),
      (p_data->>'relatedRecipients')::boolean,(p_data->>'includeActor')::boolean,(p_data->>'priority')::integer)
    on conflict(id) do update set name=excluded.name,event_type=excluded.event_type,template_id=excluded.template_id,
      mode=excluded.mode,user_ids=excluded.user_ids,roles=excluded.roles,related_recipients=excluded.related_recipients,
      include_actor=excluded.include_actor,priority=excluded.priority,revision=email_rules.revision+1,updated_at=now()
    returning to_jsonb(email_rules.*) into result;
    if p_data->>'mode'='off' then
      update public.email_deliveries set status='cancelled',last_error='Kural kapatıldı' where rule_id=eid and status='pending';
    end if;
  elsif p_action='settings.save' then
    select to_jsonb(s) into old from public.email_settings s where id for update;
    update public.email_settings set paused=(p_data->>'paused')::boolean,test_address=p_data->>'testAddress',updated_at=now() where id returning to_jsonb(email_settings.*) into result;
    if (p_data->>'paused')::boolean then
      update public.email_deliveries set status='cancelled',last_error='Gönderimler durduruldu' where status='pending';
      update public.email_events set status='skipped',last_error='Gönderimler durduruldu' where status='pending';
    end if;
  else raise exception 'Bilinmeyen işlem.'; end if;
  insert into public.email_audit(actor_id,source,action,entity_id,before_value,after_value)
    values(p_actor,p_source,p_action,coalesce(eid::text,'settings'),old,result);
  return result;
end $$;

create function public.email_claim_event() returns setof public.email_events language plpgsql security definer set search_path=public as $$
begin
  if (select paused from public.email_settings where id) then return; end if;
  update public.email_events set status='failed',last_error='Olay hazırlama deneme sınırı' where status in ('pending','processing') and attempts>=8 and (lease_until is null or lease_until<now());
  return query update public.email_events e set status='processing',attempts=e.attempts+1,lease_until=now()+interval '2 minutes'
  where e.id=(select id from public.email_events where attempts<8 and (status='pending' or(status='processing' and lease_until<now())) order by created_at for update skip locked limit 1) returning e.*;
end $$;
create function public.email_finish_event(p_id uuid,p_attempt integer,p_deliveries jsonb) returns void language plpgsql security definer set search_path=public as $$
declare d jsonb; begin
  perform 1 from public.email_events where id=p_id and status='processing' and attempts=p_attempt for update;
  if not found then raise exception 'Olay sahipliği değişti.'; end if;
  for d in select * from jsonb_array_elements(p_deliveries) loop
    insert into public.email_deliveries(event_id,rule_id,template_version_id,job_id,user_id,recipient,recipient_name,reasons,mode,payload,status,last_error)
      values(p_id,(d->>'ruleId')::uuid,(d->>'versionId')::uuid,(d->>'jobId')::uuid,(d->>'userId')::uuid,
      d->>'recipient',d->>'name',d->'reasons',d->>'mode',d->'payload',
      case when (select paused from public.email_settings where id) or not exists(select 1 from public.email_rules where id=(d->>'ruleId')::uuid and mode=d->>'mode') then 'cancelled' else coalesce(d->>'status','pending') end,d->>'error')
      on conflict(event_id,recipient) do nothing;
  end loop;
  update public.email_events set status=case when jsonb_array_length(p_deliveries)=0 then 'skipped' else 'done' end,
    last_error=case when jsonb_array_length(p_deliveries)=0 then 'Uygun alıcı yok' else null end,lease_until=null where id=p_id;
end $$;
create function public.email_claim_delivery() returns setof public.email_deliveries language plpgsql security definer set search_path=public as $$
begin
  if (select paused from public.email_settings where id) then return; end if;
  update public.email_deliveries set status='failed',last_error='Yeniden deneme süresi doldu'
    where status in ('pending','processing') and ((first_attempt_at is not null and first_attempt_at<now()-interval '23 hours') or(attempts>=8 and lease_until<now()));
  return query update public.email_deliveries d set status='processing',attempts=d.attempts+1,
    first_attempt_at=coalesce(d.first_attempt_at,now()),lease_until=now()+interval '2 minutes'
    where d.id=(select id from public.email_deliveries where attempts<8 and next_attempt_at<=now() and
      (status='pending' or(status='processing' and lease_until<now())) order by created_at for update skip locked limit 1) returning d.*;
end $$;
create function public.email_reconcile_delivery(p_provider text) returns void language sql security definer set search_path=public as $$
  update public.email_deliveries d set provider_events=(select coalesce(jsonb_object_agg(event_type,occurred_at),'{}') from public.email_webhook_events where provider_id=p_provider),
  status=case
    when exists(select 1 from public.email_webhook_events where provider_id=p_provider and event_type='email.complained') then 'complained'
    when exists(select 1 from public.email_webhook_events where provider_id=p_provider and event_type='email.bounced') then 'bounced'
    when exists(select 1 from public.email_webhook_events where provider_id=p_provider and event_type='email.delivered') then 'delivered'
    when exists(select 1 from public.email_webhook_events where provider_id=p_provider and event_type in ('email.failed','email.suppressed')) then 'failed'
    when exists(select 1 from public.email_webhook_events where provider_id=p_provider and event_type='email.delivery_delayed') then 'delayed'
    else d.status end where d.provider_id=p_provider;
$$;

-- Bütün yardımcılar yalnız service_role; yayın kapısı kendi rol kontrolünü yapar.
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in
    ('email_resolve_recipients','email_capture_event','job_publication_snapshot','email_manage','email_claim_event','email_finish_event','email_claim_delivery','email_reconcile_delivery') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
revoke all on function public.publish_job_order(uuid) from public,anon;
grant execute on function public.publish_job_order(uuid) to authenticated;

create function public.email_manual_delivery(p_delivery jsonb,p_actor uuid,p_source text)
returns uuid language plpgsql security definer set search_path=public as $$
declare did uuid; begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Yönetici yetkisi gerekli.'; end if;
  if (select paused from public.email_settings where id) then raise exception 'Gönderimler durdurulmuş.'; end if;
  did:=(p_delivery->>'id')::uuid;
  if exists(select 1 from public.email_deliveries where id=did) then
    if exists(select 1 from public.email_deliveries where id=did and (payload is distinct from p_delivery->'payload' or mode<>'test')) then raise exception 'İstek kimliği başka mesaj için kullanılmış.'; end if;
    return did;
  end if;
  if lower(p_delivery->>'recipient') is distinct from (select lower(test_address) from public.email_settings where id) then raise exception 'Deneme adresi değişmiş.'; end if;
  insert into public.email_deliveries(id,template_version_id,job_id,recipient,recipient_name,mode,reasons,payload)
    values(did,(p_delivery->>'template_version_id')::uuid,(p_delivery->>'job_id')::uuid,p_delivery->>'recipient',p_delivery->>'recipient_name','test',p_delivery->'reasons',p_delivery->'payload');
  insert into public.email_audit(actor_id,source,action,entity_id,after_value) values(p_actor,p_source,'test.send',did::text,jsonb_build_object('recipient',p_delivery->>'recipient'));
  return did;
end $$;
create function public.email_delivery_action(p_action text,p_id uuid,p_new_id uuid,p_actor uuid,p_source text)
returns uuid language plpgsql security definer set search_path=public as $$
declare d public.email_deliveries; begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Yönetici yetkisi gerekli.'; end if;
  if (select paused from public.email_settings where id) then raise exception 'Gönderimler durdurulmuş.'; end if;
  select * into d from public.email_deliveries where id=p_id for update;
  if not found then raise exception 'Gönderim bulunamadı.'; end if;
  if p_action='delivery.retry' then
    if d.status<>'failed' or d.provider_id is not null or d.attempts>=8 or d.payload='{}'::jsonb or d.first_attempt_at<now()-interval '23 hours' then raise exception 'Bu kayıt güvenli yeniden denemeye uygun değil.'; end if;
    update public.email_deliveries set status='pending',next_attempt_at=now(),lease_until=null where id=p_id;
  elsif p_action='delivery.resend' then
    if d.status not in ('sent','delivered') or p_new_id is null then raise exception 'Yalnız gönderilmiş mesaj yeni kayıt olarak tekrar gönderilebilir.'; end if;
    if exists(select 1 from public.email_deliveries where id=p_new_id and resend_of is distinct from p_id) then raise exception 'İstek kimliği başka gönderime ait.'; end if;
    insert into public.email_deliveries(id,rule_id,template_version_id,job_id,user_id,recipient,recipient_name,reasons,mode,payload,resend_of)
      values(p_new_id,d.rule_id,d.template_version_id,d.job_id,d.user_id,d.recipient,d.recipient_name,d.reasons,d.mode,d.payload,p_id) on conflict(id) do nothing;
  else raise exception 'Geçersiz gönderim işlemi.'; end if;
  insert into public.email_audit(actor_id,source,action,entity_id,after_value) values(p_actor,p_source,p_action,p_id::text,jsonb_build_object('newId',p_new_id));
  return coalesce(p_new_id,p_id);
end $$;
revoke all on function public.email_manual_delivery(jsonb,uuid,text) from public,anon,authenticated;
revoke all on function public.email_delivery_action(text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.email_manual_delivery(jsonb,uuid,text) to service_role;
grant execute on function public.email_delivery_action(text,uuid,uuid,uuid,text) to service_role;

create function public.job_publication_state(p_job uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare p public.job_publications; begin
  if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
  select * into p from public.job_publications where job_id=p_job order by published_at desc limit 1;
  return jsonb_build_object('published',p.id is not null,'dirty',p.id is not null and p.fingerprint<>md5(public.job_publication_snapshot(p_job)::text));
end $$;
revoke all on function public.job_publication_state(uuid) from public,anon;
grant execute on function public.job_publication_state(uuid) to authenticated;

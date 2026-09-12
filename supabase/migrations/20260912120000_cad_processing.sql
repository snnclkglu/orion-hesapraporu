-- CAD-1: ayrı yerel AutoCAD modülü; mevcut paket/veri kuralları değiştirilmez.
create table public.cad_devices (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(name) between 1 and 80),
 state text not null default 'unpaired' check(state in ('unpaired','ready','busy','autocad_missing','attention')),
 autocad_version text not null default '', helper_version text not null default '', protocol integer not null default 1,
 message text not null default '', last_seen_at timestamptz, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index cad_devices_owner on public.cad_devices(owner_id);
create table public.cad_device_secrets (
 device_id uuid primary key references public.cad_devices(id), token_hash text unique,
 pairing_hash text unique not null, pairing_expires_at timestamptz not null,
 paired_at timestamptz
);
create table public.cad_jobs (
 id uuid primary key, owner_id uuid not null references auth.users(id),
 device_id uuid not null references public.cad_devices(id),
 source_name text not null, source_size bigint not null check(source_size between 1 and 104857600),
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'), source_path text not null unique,
 options jsonb not null default '{"paper":"A3","duplicates":"hepsi"}',
 status text not null default 'uploading' check(status in ('uploading','queued','processing','review','approved','failed','cancelled')),
 attempt_id uuid, attempts integer not null default 0, lease_until timestamptz,
 progress text not null default '', error text not null default '', result jsonb,
 package_id uuid references public.drawing_packages(id),
 approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index cad_jobs_owner on public.cad_jobs(owner_id, created_at desc);
create index cad_jobs_queue on public.cad_jobs(device_id,created_at) where status='queued';
create unique index cad_jobs_one_running on public.cad_jobs(device_id) where status='processing';
create table public.cad_artifacts (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.cad_jobs(id),
 attempt_id uuid not null, name text not null, size bigint not null check(size between 1 and 104857600),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), storage_path text not null unique,
 kind text not null check(kind in ('pdf','report','diagnostic','result')),
 created_at timestamptz not null default now(), unique(job_id,attempt_id,name)
);
alter table public.cad_devices enable row level security;
alter table public.cad_device_secrets enable row level security;
alter table public.cad_jobs enable row level security;
alter table public.cad_artifacts enable row level security;
revoke all on public.cad_devices,public.cad_device_secrets,public.cad_jobs,public.cad_artifacts from anon, authenticated;
grant select on public.cad_devices,public.cad_jobs,public.cad_artifacts to authenticated;
grant all on public.cad_devices,public.cad_device_secrets,public.cad_jobs,public.cad_artifacts to service_role;
create policy cad_device_read on public.cad_devices for select to authenticated using(owner_id=(select auth.uid()));
create policy cad_job_read on public.cad_jobs for select to authenticated using(owner_id=(select auth.uid()));
create policy cad_artifact_read on public.cad_artifacts for select to authenticated using(exists(select 1 from public.cad_jobs j where j.id=job_id and j.owner_id=(select auth.uid())));
insert into storage.buckets(id,name,public,file_size_limit) values('cad-private','cad-private',false,104857600);
-- Storage'a kullanıcı yazma politikası açılmaz; izinler tek nesnelik imzalı URL'dir.

create function public.cad_pair(p_hash text,p_token_hash text) returns uuid
language plpgsql security definer set search_path=public as $$
declare s cad_device_secrets; d cad_devices;
begin
 select * into s from cad_device_secrets where pairing_hash=p_hash for update;
 if not found or s.pairing_expires_at<now() then raise exception 'Bağlantı kodu geçersiz veya süresi dolmuş.'; end if;
 select * into d from cad_devices where id=s.device_id for update;
 if d.revoked_at is not null or not exists(select 1 from profiles where id=d.owner_id and role::text in ('admin','engineer','draftsman')) then raise exception 'Bağlantı yetkisi yok.'; end if;
 if s.paired_at is not null and s.token_hash is distinct from p_token_hash then raise exception 'Kod daha önce kullanıldı.'; end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Anahtar biçimi geçersiz.'; end if;
 update cad_device_secrets set token_hash=p_token_hash,paired_at=coalesce(paired_at,now()) where device_id=d.id;
 update cad_devices set state='attention',message='Yardımcı kontrolü bekleniyor.' where id=d.id;
 return d.id;
end $$;

-- Yalnız sunucu çağırır. p_actor oturumdan / doğrulanmış cihazdan gelir; istek gövdesinden alınmaz.
create function public.cad_mutate(p_actor uuid,p_action text,p_data jsonb,p_device uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d cad_devices; j cad_jobs; a cad_artifacts; v_id uuid; v_attempt uuid; v_path text;
begin
 if not exists(select 1 from profiles where id=p_actor and role::text in ('admin','engineer','draftsman')) then raise exception 'Çizim işleme yetkisi yok.'; end if;
 if p_device is not null then
  select * into d from cad_devices where id=p_device and owner_id=p_actor and revoked_at is null for update;
  if not found then raise exception 'Cihaz bağlantısı geçersiz.'; end if;
 end if;
 if p_action='heartbeat' then
  if p_device is null then raise exception 'Cihaz gerekli.'; end if;
  update cad_devices set state=p_data->>'state',autocad_version=left(coalesce(p_data->>'autocadVersion',''),80),
   helper_version=left(coalesce(p_data->>'helperVersion',''),40),protocol=(p_data->>'protocol')::int,
   message=left(coalesce(p_data->>'message',''),500),last_seen_at=now() where id=p_device;
  if p_data->>'jobId' is not null then
   update cad_jobs set lease_until=now()+interval '3 minutes',updated_at=now(),progress=left(coalesce(p_data->>'progress','İşleniyor'),300)
    where id=(p_data->>'jobId')::uuid and device_id=p_device and owner_id=p_actor and status='processing'
    and attempt_id=(p_data->>'attemptId')::uuid and lease_until>now();
   if not found then return jsonb_build_object('accepted',false); end if;
  end if;
  return jsonb_build_object('accepted',true);
 elsif p_action='claim' then
  if p_device is null or d.state<>'ready' or d.last_seen_at<now()-interval '90 seconds' or d.protocol<>1 then return 'null'::jsonb; end if;
  update cad_jobs set status='failed',error='Bilgisayar bağlantısı kesildi. Yerel yardımcıyı kontrol edip yeniden deneyin.',lease_until=null,updated_at=now()
   where device_id=p_device and status='processing' and lease_until<now();
  if exists(select 1 from cad_jobs where device_id=p_device and status='processing') then return 'null'::jsonb; end if;
  select * into j from cad_jobs where device_id=p_device and owner_id=p_actor and status='queued' order by created_at for update skip locked limit 1;
  if not found then return 'null'::jsonb; end if;
  update cad_jobs set status='processing',attempt_id=gen_random_uuid(),attempts=attempts+1,lease_until=now()+interval '3 minutes',
   progress='Çizim indiriliyor',error='',updated_at=now() where id=j.id returning * into j;
  return to_jsonb(j);
 elsif p_action='create' then
  v_id=(p_data->>'id')::uuid;
  select * into d from cad_devices where id=(p_data->>'deviceId')::uuid and owner_id=p_actor and revoked_at is null for update;
  if not found or d.state not in ('ready','busy') or d.last_seen_at is null or d.last_seen_at<now()-interval '90 seconds' or d.protocol<>1 then raise exception 'Seçilen bilgisayar işleme hazır değil.'; end if;
  if (select count(*) from cad_jobs where owner_id=p_actor and status in ('uploading','queued','processing'))>=30 then raise exception 'Önce bekleyen işlemleri tamamlayın.'; end if;
  insert into cad_jobs(id,owner_id,device_id,source_name,source_size,source_sha256,source_path,options)
   values(v_id,p_actor,d.id,p_data->>'name',(p_data->>'size')::bigint,p_data->>'sha256',p_actor::text||'/'||v_id::text||'/source/source.dwg',p_data->'options')
   on conflict(id) do nothing;
  select * into j from cad_jobs where id=v_id and owner_id=p_actor;
  if not found or j.source_sha256<>p_data->>'sha256' or j.device_id<>d.id then raise exception 'İş kimliği başka bir kayda ait.'; end if;
  return to_jsonb(j);
 elsif p_action='revoke' then
  update cad_devices set revoked_at=now(),message='Bağlantı kaldırıldı.' where id=(p_data->>'deviceId')::uuid and owner_id=p_actor;
  update cad_jobs set status='cancelled',lease_until=null,updated_at=now(),error='Bilgisayar bağlantısı kaldırıldı.'
   where device_id=(p_data->>'deviceId')::uuid and owner_id=p_actor and status in ('uploading','queued','processing');
  return '{}'::jsonb;
 end if;
 select * into j from cad_jobs where id=(p_data->>'jobId')::uuid and owner_id=p_actor for update;
 if not found then raise exception 'İş bulunamadı.'; end if;
 if p_device is not null then
  if j.device_id<>p_device or j.attempt_id is distinct from (p_data->>'attemptId')::uuid then raise exception 'Eski veya başka cihaza ait deneme.'; end if;
  if p_action='complete' and j.status in ('review','approved') then return to_jsonb(j); end if;
  if j.status<>'processing' or j.lease_until<now() then raise exception 'İş sahipliğinin süresi doldu veya iş iptal edildi.'; end if;
 end if;
 if p_action='queue' then
  if j.status='uploading' then update cad_jobs set status='queued',progress='Bilgisayar bekleniyor',updated_at=now() where id=j.id; end if;
 elsif p_action='cancel' then
  if j.status not in ('uploading','queued','processing','failed') then raise exception 'Bu işlem iptal edilemez.'; end if;
  update cad_jobs set status='cancelled',lease_until=null,updated_at=now() where id=j.id;
 elsif p_action='retry' then
  if j.status not in ('failed','cancelled') then raise exception 'Yalnız durmuş işlemler yeniden denenebilir.'; end if;
  select * into d from cad_devices where id=j.device_id and owner_id=p_actor and revoked_at is null;
  if not found or d.state<>'ready' or d.last_seen_at<now()-interval '90 seconds' then raise exception 'Önce bilgisayardaki yardımcıyı hazır duruma getirin.'; end if;
  update cad_jobs set status='queued',attempt_id=null,lease_until=null,result=null,error='',progress='Yeniden sıraya alındı',updated_at=now() where id=j.id;
 elsif p_action='artifact' then
  if p_device is null then raise exception 'Cihaz gerekli.'; end if;
  if (select count(*) from cad_artifacts where job_id=j.id and attempt_id=j.attempt_id)>1200 then raise exception 'Çıktı sınırı aşıldı.'; end if;
  v_path=p_actor::text||'/'||j.id::text||'/'||j.attempt_id::text||'/'||(p_data->>'sha256')||'/'||(p_data->>'name');
  insert into cad_artifacts(job_id,attempt_id,name,size,sha256,storage_path,kind)
   values(j.id,j.attempt_id,p_data->>'name',(p_data->>'size')::bigint,p_data->>'sha256',v_path,p_data->>'kind')
   on conflict(job_id,attempt_id,name) do nothing;
  select * into a from cad_artifacts where job_id=j.id and attempt_id=j.attempt_id and name=p_data->>'name';
  if a.sha256<>p_data->>'sha256' or a.size<>(p_data->>'size')::bigint then raise exception 'Aynı denemedeki çıktı değiştirilemez.'; end if;
  return to_jsonb(a);
 elsif p_action='fail' then
  if p_device is null then raise exception 'Cihaz gerekli.'; end if;
  update cad_jobs set status='failed',error=left(coalesce(p_data->>'message','İşlem tamamlanamadı.'),1500),lease_until=null,updated_at=now() where id=j.id;
 elsif p_action='complete' then
  if p_device is null then raise exception 'Cihaz gerekli.'; end if;
  update cad_jobs set status='review',result=p_data->'result',lease_until=null,progress='Sonuçlar incelemeye hazır',updated_at=now() where id=j.id;
 elsif p_action='approve' then
  if j.status not in ('review','approved') then raise exception 'İncelenecek sonuç yok.'; end if;
  update cad_jobs set status='approved',approved_at=coalesce(approved_at,now()),updated_at=now() where id=j.id;
 else raise exception 'Bilinmeyen işlem.';
 end if;
 select * into j from cad_jobs where id=j.id;
 return to_jsonb(j);
end $$;
revoke all on function public.cad_pair(text,text),public.cad_mutate(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.cad_pair(text,text),public.cad_mutate(uuid,text,jsonb,uuid) to service_role;

create function public.cad_export_start(p_actor uuid,p_job uuid,p_folder text,p_item uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare j cad_jobs; v_package uuid; v_item job_items;
begin
 if not exists(select 1 from profiles where id=p_actor and role::text in ('admin','engineer','draftsman')) then raise exception 'Aktarım yetkisi yok.'; end if;
 select * into j from cad_jobs where id=p_job and owner_id=p_actor for update;
 if not found or j.status<>'approved' then raise exception 'Önce sonuçları inceleyip onaylayın.'; end if;
 if j.package_id is not null then return j.package_id; end if;
 if length(trim(p_folder)) not between 1 and 180 then raise exception 'Paket adı gerekli.'; end if;
 if p_item is not null then
  select * into v_item from job_items where id=p_item;
  if not found then raise exception 'İş kalemi bulunamadı.'; end if;
 end if;
 insert into drawing_packages(folder_name,item_no,job_id,job_item_id,status,created_by,updated_by,notes)
  values(trim(p_folder),coalesce(v_item.item_no,''),v_item.job_id,p_item,'yukleniyor',p_actor,p_actor,
   'Çizim İşleme kaynağı: '||j.id::text||'; deneme: '||j.attempt_id::text||'; araç: '||coalesce(j.result->>'arac_surum',''))
  returning id into v_package;
 update cad_jobs set package_id=v_package,updated_at=now() where id=j.id;
 return v_package;
end $$;
revoke all on function public.cad_export_start(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.cad_export_start(uuid,uuid,text,uuid) to service_role;

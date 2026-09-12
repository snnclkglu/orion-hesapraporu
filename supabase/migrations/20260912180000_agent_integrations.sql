-- API yönetimi: tüm sırlar yalnız service_role; yönetim oturumu RPC içinde doğrulanır.
create table public.agent_clients (
 id text primary key check (id ~ '^[a-z0-9][a-z0-9._-]{1,63}$'),
 name text not null check (length(name) between 2 and 120),
 actor_id uuid not null references public.profiles(id),
 scopes text[] not null check (cardinality(scopes) between 1 and 12 and scopes <@ array['offers:read','offers:draft:write','email:read','email:draft:write','email:publish','email:test:send','email:send','tasks:read','tasks:write','tasks:comment','tasks:context:read','tasks:tags:manage']::text[]),
 rate_limit integer not null default 60 check (rate_limit between 1 and 600),
 status text not null default 'active' check (status in ('active','paused')),
 version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.agent_credentials (
 id uuid primary key default gen_random_uuid(), agent_id text not null references public.agent_clients(id),
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 label text not null check (length(label) between 1 and 40),
 created_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz
);
create index agent_credentials_agent on public.agent_credentials(agent_id);
create table public.agent_config_events (
 id bigint generated always as identity primary key, agent_id text not null, actor uuid not null references public.profiles(id),
 action text not null, detail jsonb not null, created_at timestamptz not null default now()
);
create table public.agent_request_events (
 id bigint generated always as identity primary key, request_id uuid not null,
 agent_id text, method text not null check (method in ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
 route text not null check (length(route) <= 180), scope text,
 status integer not null check(status between 100 and 599), duration_ms integer not null check(duration_ms between 0 and 3600000),
 reason_code text, replayed boolean not null default false, created_at timestamptz not null default now()
);
create table public.agent_request_daily (
 day date not null, agent_id text not null, requests bigint not null default 0, errors bigint not null default 0,
 duration_ms bigint not null default 0, primary key(day,agent_id)
);
alter table public.agent_request_daily enable row level security;
revoke all on public.agent_request_daily from anon,authenticated;
grant all on public.agent_request_daily to service_role;
create index agent_requests_recent on public.agent_request_events(id desc);
create index agent_requests_agent_recent on public.agent_request_events(agent_id,id desc);
create index agent_requests_date on public.agent_request_events(created_at);
create index agent_changes_recent on public.agent_config_events(id desc);
alter table public.agent_clients enable row level security;
alter table public.agent_credentials enable row level security;
alter table public.agent_config_events enable row level security;
alter table public.agent_request_events enable row level security;
revoke all on public.agent_clients, public.agent_credentials, public.agent_config_events, public.agent_request_events from anon, authenticated;
grant all on public.agent_clients, public.agent_credentials, public.agent_config_events, public.agent_request_events to service_role;
grant usage, select on sequence public.agent_config_events_id_seq, public.agent_request_events_id_seq to service_role;

-- Aktarılmış kimlik veya iptal edilmiş anahtar, eski env tanımına geri düşemez.
create function public.agent_resolve(p_digest text, p_env_id text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.agent_clients; k public.agent_credentials;
begin
 select * into k from agent_credentials where token_hash=p_digest;
 if found then
  select * into c from agent_clients where id=k.agent_id;
  if c.status <> 'active' or k.revoked_at is not null or k.expires_at <= now() then
   return jsonb_build_object('managed',true,'principal',null);
  end if;
  return jsonb_build_object('managed',true,'principal',jsonb_build_object('id',c.id,'name',c.name,'actorId',c.actor_id,'scopes',c.scopes,'rateLimitPerMinute',c.rate_limit));
 end if;
 return jsonb_build_object('managed',exists(select 1 from agent_clients where id=p_env_id),'principal',null);
end $$;

-- Yönetim değişikliği ve karar izi aynı transaction'dır. İstemci digest gönderemez:
-- bu RPC yalnız sunucuya açık, girdileri Yönetici oturumundan yeniden kurulur.
create function public.agent_manage(p_actor uuid,p_action text,p_value jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.agent_clients; v_id text := p_value->>'id'; v_scopes text[]; v_detail jsonb; v_key uuid; v_hours integer;
begin
 if not exists(select 1 from profiles where id=p_actor and role='admin') then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('agent:'||coalesce(v_id,''),0));
 select * into c from agent_clients where id=v_id for update;
 if p_action in ('create','import') then
  if c.id is not null then raise exception 'Kayıt zaten var. Yenileyin.' using errcode='40001'; end if;
 elsif c.id is null then raise exception 'Ajan bulunamadı.' using errcode='23514';
 elsif c.version <> (p_value->>'version')::integer or p_value->>'version' is null then
  raise exception 'Kayıt değişti. Yenileyin.' using errcode='40001';
 end if;
 if p_action in ('create','import','update') then
  select array_agg(distinct x) into v_scopes from jsonb_array_elements_text(p_value->'scopes') x;
  if p_action='update' and c.actor_id <> (p_value->>'actorId')::uuid then raise exception 'Ajan profili değiştirilemez.' using errcode='23514'; end if;
  if p_action in ('create','import') then
   insert into agent_clients(id,name,actor_id,scopes,rate_limit,status) values(v_id,p_value->>'name',(p_value->>'actorId')::uuid,v_scopes,(p_value->>'rateLimitPerMinute')::integer,'active');
  else
   update agent_clients set name=p_value->>'name',scopes=v_scopes,rate_limit=(p_value->>'rateLimitPerMinute')::integer,status=p_value->>'status',version=version+1,updated_at=now() where id=v_id;
  end if;
  v_detail := jsonb_build_object('önce',case when c.id is not null then jsonb_build_object('izinler',c.scopes,'durum',c.status,'sınır',c.rate_limit) else null end,
    'sonra',jsonb_build_object('izinler',v_scopes,'durum',coalesce(p_value->>'status','active'),'sınır',(p_value->>'rateLimitPerMinute')::integer));
 elsif p_action='rotate' then
  v_hours := (p_value->>'overlapHours')::integer;
  if v_hours is null or v_hours not in (0,24) then raise exception 'Geçiş süresi geçersiz.' using errcode='23514'; end if;
  update agent_credentials set expires_at=least(coalesce(expires_at,'infinity'::timestamptz),now()+make_interval(hours=>v_hours)) where agent_id=v_id and revoked_at is null;
  update agent_clients set version=version+1,updated_at=now() where id=v_id;
  v_detail := jsonb_build_object('geçiş_saat',v_hours);
 elsif p_action='revoke' then
  update agent_credentials set revoked_at=now() where id=(p_value->>'credentialId')::uuid and agent_id=v_id and revoked_at is null returning id into v_key;
  if v_key is null then raise exception 'Anahtar bulunamadı veya zaten iptal edildi.' using errcode='23514'; end if;
  update agent_clients set version=version+1,updated_at=now() where id=v_id;
  v_detail := jsonb_build_object('anahtar_id',v_key);
 else raise exception 'İşlem geçersiz.' using errcode='23514';
 end if;
 if p_action in ('create','import','rotate') then
  insert into agent_credentials(agent_id,token_hash,label) values(v_id,p_value->>'digest',p_value->>'label') returning id into v_key;
  v_detail := v_detail || jsonb_build_object('anahtar_id',v_key);
 end if;
 insert into agent_config_events(agent_id,actor,action,detail) values(v_id,p_actor,p_action,v_detail);
 return jsonb_build_object('id',v_id,'credentialId',v_key);
end $$;

-- İşlem gövdeleri ve sırlar için kolon yoktur. Bilinmeyen kimlikler dakikada
-- durum/yol başına tek örnekle sınırlıdır; bunlardan kesin trafik sayısı türetilmez.
create function public.agent_record_request(p_event jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if p_event->>'agent_id' is null then
  perform pg_advisory_xact_lock(18120926);
  if exists(select 1 from agent_request_events where agent_id is null and created_at>now()-interval '1 minute' and status=(p_event->>'status')::integer and route=p_event->>'route') then return; end if;
 end if;
 insert into agent_request_events(request_id,agent_id,method,route,scope,status,duration_ms,replayed,reason_code)
 values((p_event->>'request_id')::uuid,p_event->>'agent_id',p_event->>'method',p_event->>'route',p_event->>'scope',(p_event->>'status')::integer,(p_event->>'duration_ms')::integer,coalesce((p_event->>'replayed')::boolean,false),
 case when p_event->>'reason_code' in ('scope_denied','profile_denied','auth_failed','access_denied','validation','unavailable','conflict','limited','not_found','internal') then p_event->>'reason_code' else null end);
 insert into agent_request_daily(day,agent_id,requests,errors,duration_ms)
 values((now() at time zone 'Europe/Istanbul')::date,coalesce(p_event->>'agent_id',''),1,case when (p_event->>'status')::integer>=400 then 1 else 0 end,(p_event->>'duration_ms')::integer)
 on conflict(day,agent_id) do update set requests=agent_request_daily.requests+1,errors=agent_request_daily.errors+excluded.errors,duration_ms=agent_request_daily.duration_ms+excluded.duration_ms;
end $$;

create function public.agent_prune_requests() returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare n bigint;
begin
 delete from agent_request_events where id in(select id from agent_request_events where created_at < now()-interval '7 days' limit 10000);
 get diagnostics n = row_count;
 delete from agent_request_daily where day < ((now() at time zone 'Europe/Istanbul')::date-30);
 return n;
end $$;
revoke all on function public.agent_resolve(text,text), public.agent_manage(uuid,text,jsonb), public.agent_record_request(jsonb), public.agent_prune_requests() from public, anon, authenticated;
grant execute on function public.agent_resolve(text,text), public.agent_manage(uuid,text,jsonb), public.agent_record_request(jsonb), public.agent_prune_requests() to service_role;

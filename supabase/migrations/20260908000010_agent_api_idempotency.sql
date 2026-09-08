-- Agent API POST tekrar güvenliği.
--
-- Agent ağ zaman aşımında aynı komutu yeniden gönderebilir. Teklif ya da
-- revizyon tablosuna agent'a özgü alan eklemek yerine HTTP kapısının kendi
-- küçük defteri tutulur. Ham bearer token hiçbir zaman yazılmaz; anahtar agent
-- kimliğiyle birlikte tekildir. Tablo yalnız service-role kullanan sunucu
-- route'larına aittir ve son kullanıcı oturumlarına kapalıdır.

create table public.agent_api_idempotency (
  agent_id text not null,
  idempotency_key text not null,
  method text not null,
  path text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (agent_id, idempotency_key),
  constraint agent_api_idempotency_agent_id_check
    check (agent_id ~ '^[a-z0-9][a-z0-9._-]{1,63}$'),
  constraint agent_api_idempotency_key_check
    check (length(idempotency_key) between 8 and 128),
  constraint agent_api_idempotency_method_check
    check (method = 'POST'),
  constraint agent_api_idempotency_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint agent_api_idempotency_response_check
    check (
      (completed_at is null and response_status is null and response_body is null)
      or
      (completed_at is not null and response_status between 100 and 599 and response_body is not null)
    )
);

create index agent_api_idempotency_created_at_idx
  on public.agent_api_idempotency (created_at);

alter table public.agent_api_idempotency enable row level security;
revoke all on table public.agent_api_idempotency from anon, authenticated;

comment on table public.agent_api_idempotency is
  'Agent API POST tekrar güvenliği; yalnız service-role erişir, bearer token saklanmaz.';

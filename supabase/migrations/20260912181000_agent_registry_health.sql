-- Yalnız veritabanı kaydı kullanan kurulumda yanlış anahtar 401 üretir;
-- yapılandırma yokluğu ile anahtar reddi ayrılır. Bilgi yalnız sunucu RPC'sidir.
create or replace function public.agent_resolve(p_digest text,p_env_id text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.agent_clients; k public.agent_credentials;
begin
 select * into k from agent_credentials where token_hash=p_digest;
 if found then
  select * into c from agent_clients where id=k.agent_id;
  if c.status<>'active' or k.revoked_at is not null or k.expires_at<=now() then
   return jsonb_build_object('managed',true,'configured',true,'principal',null);
  end if;
  return jsonb_build_object('managed',true,'configured',true,'principal',jsonb_build_object('id',c.id,'name',c.name,'actorId',c.actor_id,'scopes',c.scopes,'rateLimitPerMinute',c.rate_limit));
 end if;
 return jsonb_build_object('managed',exists(select 1 from agent_clients where id=p_env_id),'configured',exists(select 1 from agent_clients),'principal',null);
end $$;
revoke all on function public.agent_resolve(text,text) from public,anon,authenticated;
grant execute on function public.agent_resolve(text,text) to service_role;

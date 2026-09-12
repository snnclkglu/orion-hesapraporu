-- Aktörü istemciden kabul etmeyen dar kullanıcı oran sınırı.
create function public.account_media_rate_limit() returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Oturum gerekli' using errcode='42501'; end if;
 return task_rate_limit(auth.uid()::text||'/account-media',30);
end $$;
revoke all on function account_media_rate_limit() from public,anon;
grant execute on function account_media_rate_limit() to authenticated;

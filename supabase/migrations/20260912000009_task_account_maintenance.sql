-- Yalnız referans dışı veya süresi dolmuş taslak dosyaları. Kesinleşmiş gönderi silinmez.
create function account_cleanup_candidates() returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(x),'[]') from (
  select o.bucket_id,o.name from storage.objects o where o.created_at<now()-interval '25 hours' and (
   (o.bucket_id='account-avatars' and not exists(select 1 from profiles p where o.name in(p.avatar_path||'/256.webp',p.avatar_path||'/64.webp')))
   or (o.bucket_id='feedback-images' and not exists(select 1 from app_feedback_attachments a join app_feedback f on f.id=a.feedback_id where a.object_path=o.name and (f.submitted_at is not null or f.created_at>now()-interval '24 hours')))
  ) order by o.created_at limit 500
 ) x
$$;
create function account_cleanup_drafts() returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 delete from app_feedback f where f.submitted_at is null and f.created_at<now()-interval '25 hours'
 and not exists(select 1 from storage.objects o where o.bucket_id='feedback-images' and split_part(o.name,'/',2)=f.id::text);
 get diagnostics n=row_count; return n;
end $$;
revoke all on function account_cleanup_candidates(),account_cleanup_drafts() from public,anon,authenticated;
grant execute on function account_cleanup_candidates(),account_cleanup_drafts() to service_role;
create function feedback_unread_count() returns bigint language plpgsql stable security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'Yönetici yetkisi gerekli' using errcode='42501'; end if;
 return (select count(*) from app_feedback where submitted_at is not null and read_at is null and archived_at is null);
end $$;
revoke all on function feedback_unread_count() from public,anon;
grant execute on function feedback_unread_count() to authenticated;

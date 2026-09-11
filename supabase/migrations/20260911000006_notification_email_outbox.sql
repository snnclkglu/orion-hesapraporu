-- Yalnız sunucu yazıcısının oluşturduğu YENİ bildirimler e-posta kuyruğuna girer.
-- Eski notifications satırları ve doğrudan istemci INSERT'leri gönderim üretmez.
create table public.notification_email_outbox (
  id uuid primary key references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  href text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  sent_at timestamptz,
  provider_id text,
  last_error text
);
alter table public.notification_email_outbox enable row level security;
revoke all on public.notification_email_outbox from anon, authenticated;
grant all on public.notification_email_outbox to service_role;
create index notification_email_pending on public.notification_email_outbox(next_attempt_at)
  where status in ('pending','processing');

-- Tek satır atomik sahiplenilir; eşzamanlı cron/after aynı e-postayı alamaz.
create function public.claim_notification_email()
returns setof public.notification_email_outbox
language plpgsql security definer set search_path = public
as $$
begin
  -- Resend anahtarı 24 saat tutulur. Bu pencerenin dışında otomatik yeniden gönderilmez.
  update public.notification_email_outbox set status='failed', last_error='retry_window_expired'
    where status in ('pending','processing') and created_at < now() - interval '23 hours';
  return query
    update public.notification_email_outbox q
    set status='processing', attempts=q.attempts+1, lease_until=now()+interval '2 minutes'
    where q.id = (
      select e.id from public.notification_email_outbox e
      where e.attempts < 8 and e.next_attempt_at <= now()
        and (e.status='pending' or (e.status='processing' and e.lease_until < now()))
      order by e.created_at for update skip locked limit 1
    ) returning q.*;
end;
$$;
revoke all on function public.claim_notification_email() from public, anon, authenticated;
grant execute on function public.claim_notification_email() to service_role;

-- MÜŞTERİ PORTALI ERİŞİM SERTLEŞTİRMESİ
--
-- Üç kusur düzeltilir; üçü de sessizdi ve üçü de müşteriyi kapıda bırakıyordu.

-- ------------------------------------------------------------------ 1. olay türü
-- `content/route.ts` yayımlanmamış paket denemesini `inactive_release` olarak
-- yazıyor ama CHECK listesinde o değer YOKTU: satır her seferinde kısıt ihlaliyle
-- düşüyor, `insert` hatası da okunmadığı için denetim defterinde HİÇ İZ kalmıyordu.
-- "Müşteri giriş yapamıyor" şikâyetinin en sık sebebini gösteren kayıt buydu.
alter table public.product_portal_access_events
  drop constraint if exists product_portal_access_events_result_check;

alter table public.product_portal_access_events
  add constraint product_portal_access_events_result_check
  check (
    result in (
      'success', 'invalid', 'rate_limited', 'logout',
      'document_view', 'document_download',
      -- Paket yayında değil ya da dosyası yok: parola doğru olsa bile oturum açılmaz.
      'inactive_release',
      -- Oturumu olmayan / süresi dolmuş bir istek belgeye ulaşmaya çalıştı.
      'document_denied'
    )
  );

-- --------------------------------------------------------------- 2. hız sınırı
-- ESKİ DAVRANIŞ: sayaç KİLİTLİYKEN DE artıyordu ve `locked_until` her denemede
-- 15 dakika ileri atılıyordu. Parolasını yanlış hatırlayan müşteri denemeye devam
-- ettikçe kilidi KENDİ ELİYLE sonsuza uzatıyor, üstelik kilitli olduğunu hiç
-- öğrenmiyordu (yanlış parola ile kilit müşteriye aynı ekranı gösteriyor).
--
-- YENİ DAVRANIŞ: kilitliyse sayaç ARTMAZ, `locked_until` DOKUNULMAZ; pencere
-- kendiliğinden dolar. Ayrıca çağıran taraf "kilitli mi" bilgisini ayrı alır ki
-- müşteriye "yanlış parola" yerine "çok fazla deneme" diyebilsin.
-- ÖNCE DÜŞÜR: `create or replace` bir fonksiyonun OUT parametrelerini
-- DEĞİŞTİREMEZ (SQLSTATE 42P13, "cannot change return type of existing
-- function"). Dönüş satırına `locked` eklendiği için düşürmek zorunludur;
-- yetkiler aşağıda yeniden verilir.
drop function if exists public.consume_product_portal_login_attempt(text, text);

create function public.consume_product_portal_login_attempt(
  p_code_hash text,
  p_ip_hash text
)
returns table(allowed boolean, retry_after integer, locked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_at timestamptz := clock_timestamp();
  client_key text := 'client:' || p_code_hash || ':' || p_ip_hash;
  portal_key text := 'portal:' || p_code_hash;
  client_row public.product_portal_login_buckets%rowtype;
  portal_row public.product_portal_login_buckets%rowtype;
  client_locked boolean;
  portal_locked boolean;
  retry_seconds integer := 0;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return query select false, 900, true;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(portal_key, 0));

  insert into public.product_portal_login_buckets(bucket_key)
  values (client_key), (portal_key)
  on conflict (bucket_key) do nothing;

  -- Süresi dolmuş pencereyi sıfırla: kilit bittiğinde sayaç da biter.
  update public.product_portal_login_buckets
  set window_started_at = now_at,
      attempt_count = 0,
      locked_until = null
  where bucket_key in (client_key, portal_key)
    and window_started_at <= now_at - interval '15 minutes'
    and coalesce(locked_until, '-infinity'::timestamptz) <= now_at;

  select * into client_row from public.product_portal_login_buckets
  where bucket_key = client_key for update;
  select * into portal_row from public.product_portal_login_buckets
  where bucket_key = portal_key for update;

  client_locked := coalesce(client_row.locked_until, '-infinity'::timestamptz) > now_at;
  portal_locked := coalesce(portal_row.locked_until, '-infinity'::timestamptz) > now_at;

  if client_locked or portal_locked then
    -- KİLİTLİYKEN SAYAÇ ARTMAZ. Bu satırın yokluğu kilidi kalıcı yapıyordu.
    retry_seconds := greatest(
      case when client_locked then extract(epoch from (client_row.locked_until - now_at))::integer else 0 end,
      case when portal_locked then extract(epoch from (portal_row.locked_until - now_at))::integer else 0 end
    );
    return query select false, greatest(1, retry_seconds), true;
    return;
  end if;

  update public.product_portal_login_buckets
  set attempt_count = attempt_count + 1,
      locked_until = case
        when bucket_key = client_key and attempt_count + 1 >= 5 then now_at + interval '15 minutes'
        when bucket_key = portal_key and attempt_count + 1 >= 20 then now_at + interval '15 minutes'
        else locked_until
      end
  where bucket_key in (client_key, portal_key);

  -- Bu denemeyle kilitlenmiş olabilir; kilit BU denemeden SONRA geçerlidir,
  -- yani mevcut deneme değerlendirilir ve müşteri son bir yanıt alır.
  return query select true, 0, false;
end;
$$;

-- Başarılı girişte YALNIZ istemci kovası sıfırlanıyordu; portal kovası dolu
-- kalıyor ve tek bir yabancının denemeleri gerçek müşteriyi de kilitliyordu.
-- Doğru parolayı bilen biri, o portalın kovasını temizlemeye yetkilidir.
create or replace function public.reset_product_portal_login_attempt(
  p_code_hash text,
  p_ip_hash text
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.product_portal_login_buckets
  where bucket_key in (
    'client:' || p_code_hash || ':' || p_ip_hash,
    'portal:' || p_code_hash
  );
$$;

revoke all on function public.consume_product_portal_login_attempt(text, text) from public, anon, authenticated;
revoke all on function public.reset_product_portal_login_attempt(text, text) from public, anon, authenticated;
grant execute on function public.consume_product_portal_login_attempt(text, text) to service_role;
grant execute on function public.reset_product_portal_login_attempt(text, text) to service_role;

-- ------------------------------------------------------- 3. defterleri buda
-- Oturum, olay ve kilit tabloları hiç budanmıyordu; müşteri portalı yıllarca
-- açık kalacak bir yüzdür ve bu üç tablo yalnız büyür. Süresi dolmuş oturum bir
-- kayıt değil, çöptür; olay defteri ise denetim için bir yıl yeter.
create or replace function public.prune_product_portal_access(p_keep_days integer default 365)
returns table(sessions_removed bigint, events_removed bigint, buckets_removed bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  s bigint;
  e bigint;
  b bigint;
begin
  delete from public.product_portal_sessions
  where expires_at < now() - interval '7 days';
  get diagnostics s = row_count;

  delete from public.product_portal_access_events
  where created_at < now() - make_interval(days => greatest(30, p_keep_days));
  get diagnostics e = row_count;

  delete from public.product_portal_login_buckets
  where window_started_at < now() - interval '1 day'
    and coalesce(locked_until, '-infinity'::timestamptz) < now();
  get diagnostics b = row_count;

  return query select s, e, b;
end;
$$;

revoke all on function public.prune_product_portal_access(integer) from public, anon, authenticated;
grant execute on function public.prune_product_portal_access(integer) to service_role;

comment on function public.consume_product_portal_login_attempt(text, text) is
  'Portal giriş denemesi sayacı; KİLİTLİYKEN sayaç artmaz, kilit kendini uzatmaz.';
comment on function public.prune_product_portal_access(integer) is
  'Süresi dolmuş portal oturumlarını, eski erişim olaylarını ve ölü kilit kovalarını siler.';

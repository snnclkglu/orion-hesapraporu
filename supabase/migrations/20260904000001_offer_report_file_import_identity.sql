-- TEKLİF HESAP RAPORU · DOSYADAN OLUŞTURMA — MÜŞTERİ VE RAPOR FİRMASI KÜNYESİ
--
-- Kullanıcı kararı (04.09.2026, TEKLIF-79): AI girdi dosyası yalnız hesap
-- bilgisi değil proje künyesini de taşır — son kullanıcı (müşteri) firması,
-- raporu kendi adıyla sunan firma ve kontrol eden. 28.08.2026'daki "müşteri
-- UUID'leri taşınmaz" kararı böylece değişti; taşınabilirlik eşleşme
-- kuralıyla korunur:
--
--   • Son kullanıcı: önce kimlik, sonra unvan (lower(btrim(name)) — defterin
--     ünik indeksiyle AYNI ifade, Türkçe İ/ı tuzağına düşmez) eşlenir. Eşleşen
--     kayıt BAĞLANIR, dosyadaki bilgiyle GÜNCELLENMEZ (defter dosyadan gelen
--     bir metinle ezilmez). Eşleşme yoksa unvan ve künyeyle YENİ müşteri
--     açılır — yeni şartname çoğu zaman yeni müşteridir ve kaydı elle bir daha
--     yazdırmak dosyanın amacını boşa çıkarırdı.
--   • Rapor firması: yalnız MEVCUT kayıtla eşleşir (kimlik, unvan ya da kısa
--     ad). Raporu kendi adıyla sunan birkaç firma vardır; dosyadan yenisi
--     açılmaz, bulunamazsa alan boş kalır ve proje sayfasından seçilir.
--   • Kontrol eden serbest metindir (`checked_by_name`). Hazırlayan dosyadan
--     alınmaz; kapak, oluşturan kullanıcıya düşer (raporun mevcut yedek kuralı).
--
-- Eski imza (11 parametre) KALDIRILIR: aynı adla iki aşırı yükleme kalsaydı
-- PostgREST adlandırılmış argümanlarla en iyi adayı seçemez ("Could not choose
-- the best candidate function") ve dosyayla oluşturma tümden düşerdi. Yeni
-- parametrelerin hepsi varsayılanlıdır; eski istemci çağrısı da çalışmaya
-- devam eder. Eşleştirme fonksiyonun İÇİNDEDİR: müşteri, proje ve V0 tek
-- Postgres işleminde doğar, biri düşerse yetim müşteri de kalmaz.

drop function if exists public.create_offer_report_from_file(
  text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb
);

create or replace function public.create_offer_report_from_file(
  p_doc_no text,
  p_name text,
  p_customer text,
  p_crane_type text,
  p_crane_location text,
  p_inputs jsonb,
  p_selections jsonb,
  p_results jsonb,
  p_engine_version text,
  p_source jsonb default '{}'::jsonb,
  p_review_notes jsonb default '[]'::jsonb,
  p_end_customer jsonb default null,
  p_report_brand jsonb default null,
  p_checked_by_name text default ''
)
returns table (
  project_id uuid,
  revision_id uuid,
  linked_end_customer_id uuid,
  end_customer_created boolean,
  linked_report_brand_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_project_id uuid;
  v_revision_id uuid;
  v_end_customer_id uuid;
  v_end_customer_created boolean := false;
  v_report_brand_id uuid;
  v_name text;
  v_short_name text;
  v_id_text text;
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_user_id is null then
    raise exception 'Oturum bulunamadı';
  end if;
  if not public.can_edit_offers() then
    raise exception 'Teklif hesap raporu oluşturma yetkisi gerekli';
  end if;
  if nullif(btrim(p_doc_no), '') is null then
    raise exception 'Doküman no gerekli';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'Rapor / vinç adı gerekli';
  end if;
  if nullif(btrim(p_customer), '') is null then
    raise exception 'Müşteri gerekli';
  end if;
  if nullif(btrim(p_crane_type), '') is null then
    raise exception 'Vinç tipi gerekli';
  end if;
  if jsonb_typeof(p_inputs) <> 'object'
     or jsonb_typeof(p_selections) <> 'object'
     or jsonb_typeof(p_results) <> 'object' then
    raise exception 'Hesap raporu snapshot yapısı geçersiz';
  end if;
  if jsonb_typeof(p_source) <> 'object' or jsonb_typeof(p_review_notes) <> 'array' then
    raise exception 'Dosya kaynak bilgisi geçersiz';
  end if;
  if p_end_customer is not null and jsonb_typeof(p_end_customer) <> 'object' then
    raise exception 'Son kullanıcı künyesi geçersiz';
  end if;
  if p_report_brand is not null and jsonb_typeof(p_report_brand) <> 'object' then
    raise exception 'Rapor firması künyesi geçersiz';
  end if;

  -- ------------------------------------------------------- son kullanıcı
  if jsonb_typeof(p_end_customer) = 'object' then
    v_name := nullif(btrim(coalesce(p_end_customer->>'name', '')), '');
    v_id_text := btrim(coalesce(p_end_customer->>'id', ''));
    if v_id_text ~* c_uuid then
      select c.id into v_end_customer_id
        from public.customers c
       where c.id = v_id_text::uuid;
    end if;
    if v_end_customer_id is null and v_name is not null then
      select c.id into v_end_customer_id
        from public.customers c
       where lower(btrim(c.name)) = lower(v_name)
       limit 1;
    end if;
    if v_end_customer_id is null and v_name is not null then
      insert into public.customers (
        name, short_name, address, tax_office, tax_no, phone, fax, email, web, created_by
      ) values (
        v_name,
        left(btrim(coalesce(p_end_customer->>'shortName', '')), 120),
        left(btrim(coalesce(p_end_customer->>'address', '')), 1000),
        left(btrim(coalesce(p_end_customer->>'taxOffice', '')), 240),
        left(btrim(coalesce(p_end_customer->>'taxNo', '')), 60),
        left(btrim(coalesce(p_end_customer->>'phone', '')), 120),
        left(btrim(coalesce(p_end_customer->>'fax', '')), 120),
        left(btrim(coalesce(p_end_customer->>'email', '')), 240),
        left(btrim(coalesce(p_end_customer->>'web', '')), 240),
        v_user_id
      )
      returning id into v_end_customer_id;
      v_end_customer_created := true;
    end if;
  end if;

  -- ------------------------------------------------------- rapor firması
  v_name := null;
  v_id_text := null;
  if jsonb_typeof(p_report_brand) = 'object' then
    v_name := nullif(btrim(coalesce(p_report_brand->>'name', '')), '');
    v_short_name := nullif(btrim(coalesce(p_report_brand->>'shortName', '')), '');
    v_id_text := btrim(coalesce(p_report_brand->>'id', ''));
    if v_id_text ~* c_uuid then
      select c.id into v_report_brand_id
        from public.customers c
       where c.id = v_id_text::uuid;
    end if;
    if v_report_brand_id is null and v_name is not null then
      select c.id into v_report_brand_id
        from public.customers c
       where lower(btrim(c.name)) = lower(v_name)
          or lower(btrim(c.short_name)) = lower(v_name)
       order by (lower(btrim(c.name)) = lower(v_name)) desc
       limit 1;
    end if;
    if v_report_brand_id is null and v_short_name is not null then
      select c.id into v_report_brand_id
        from public.customers c
       where lower(btrim(c.short_name)) = lower(v_short_name)
       limit 1;
    end if;
  end if;

  insert into public.projects (
    doc_no,
    name,
    customer,
    crane_type,
    crane_location,
    report_context,
    job_id,
    created_by,
    end_customer_id,
    report_brand_customer_id,
    checked_by_name
  ) values (
    btrim(p_doc_no),
    btrim(p_name),
    btrim(p_customer),
    btrim(p_crane_type),
    btrim(coalesce(p_crane_location, '')),
    'offer',
    null,
    v_user_id,
    v_end_customer_id,
    v_report_brand_id,
    left(btrim(coalesce(p_checked_by_name, '')), 120)
  )
  returning id into v_project_id;

  insert into public.revisions (
    project_id,
    rev_no,
    label,
    status,
    inputs,
    selections,
    results,
    engine_version,
    created_by
  ) values (
    v_project_id,
    0,
    'V0',
    'draft',
    p_inputs,
    p_selections,
    p_results,
    coalesce(nullif(btrim(p_engine_version), ''), ''),
    v_user_id
  )
  returning id into v_revision_id;

  insert into public.audit_log (
    project_id,
    revision_id,
    actor,
    action,
    detail
  ) values (
    v_project_id,
    v_revision_id,
    v_user_id,
    'project.createFromFile',
    jsonb_build_object(
      'doc_no', btrim(p_doc_no),
      'report_context', 'offer',
      'source', p_source,
      'review_notes', p_review_notes,
      'engine_version', p_engine_version,
      'identity', jsonb_build_object(
        'end_customer_id', v_end_customer_id,
        'end_customer_created', v_end_customer_created,
        'report_brand_customer_id', v_report_brand_id,
        'report_brand_requested', jsonb_typeof(p_report_brand) = 'object',
        'checked_by_name', left(btrim(coalesce(p_checked_by_name, '')), 120)
      )
    )
  );

  return query
    select v_project_id, v_revision_id, v_end_customer_id, v_end_customer_created, v_report_brand_id;
end;
$function$;

comment on function public.create_offer_report_from_file(
  text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb, jsonb, jsonb, text
) is
  'AI aktarım JSONundan teklif hesap raporu projesi + V0 taslak + audit kaydını atomik oluşturur; son kullanıcı ve rapor firmasını defterle eşler (TEKLIF-79).';

revoke all on function public.create_offer_report_from_file(
  text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb, jsonb, jsonb, text
) from public;
grant execute on function public.create_offer_report_from_file(
  text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb, jsonb, jsonb, text
) to authenticated;

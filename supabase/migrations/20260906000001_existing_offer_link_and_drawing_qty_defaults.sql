-- Mevcut iş emrine kazanılmış teklif bağlama + resim çarpanı varsayılanı.
--
-- Bu iki akışın ortak ilkesi: kullanıcıya yararlı bir başlangıç üretirken
-- mevcut iş emrinin ticari/operasyonel fotoğrafını sessizce değiştirmemek.

-- ═══════════════════════════════ 1. MEVCUT İŞE YALNIZ TEKLİF BELGESİ BAĞLA

create or replace function public.link_offer_to_existing_job(
  p_job_id uuid,
  p_offer_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_job public.jobs%rowtype;
  v_offer public.offers%rowtype;
  v_revision public.offer_revisions%rowtype;
  v_job_conversion public.offer_job_conversions%rowtype;
  v_offer_conversion public.offer_job_conversions%rowtype;
begin
  if v_user_id is null then raise exception 'Oturum bulunamadı'; end if;
  if not public.can_edit_jobs() then
    raise exception 'İş emri yazma yetkisi yalnız Yönetici ve Müdürdedir';
  end if;

  select j.* into v_job
  from public.jobs as j
  where j.id = p_job_id
  for update;
  if not found then raise exception 'İş emri bulunamadı'; end if;

  select o.* into v_offer
  from public.offers as o
  where o.id = p_offer_id
  for update;
  if not found then raise exception 'Teklif bulunamadı'; end if;
  if v_offer.status::text <> 'won' then
    raise exception 'Yalnız Kazanıldı durumundaki teklif bağlanabilir';
  end if;
  if v_offer.job_id is not null and v_offer.job_id <> p_job_id then
    raise exception 'Bu teklif başka bir iş emrine bağlı';
  end if;

  select c.* into v_job_conversion
  from public.offer_job_conversions as c
  where c.job_id = p_job_id;
  if v_job_conversion.id is not null and v_job_conversion.offer_id <> p_offer_id then
    raise exception 'Bu iş emrine başka bir teklif dokümanı bağlı';
  end if;

  select c.* into v_offer_conversion
  from public.offer_job_conversions as c
  where c.offer_id = p_offer_id;
  if v_offer_conversion.id is not null and v_offer_conversion.job_id <> p_job_id then
    raise exception 'Bu teklif başka bir iş emrinde doküman kaynağı olarak kullanılıyor';
  end if;

  -- Aynı bağ daha önce kurulmuşsa revizyonu kendiliğinden değiştirmeyiz:
  -- yayımlanmış belge kaynağı bağlandığı andaki sabit fotoğraf olarak kalır.
  if v_job_conversion.id is not null then
    update public.offers set job_id = p_job_id where id = p_offer_id and job_id is null;
    return jsonb_build_object(
      'job_id', p_job_id,
      'offer_id', p_offer_id,
      'offer_revision_id', v_job_conversion.offer_revision_id,
      'already_linked', true
    );
  end if;

  select r.* into v_revision
  from public.offer_revisions as r
  where r.offer_id = p_offer_id and r.status::text = 'issued'
  order by r.rev_no desc
  limit 1;
  if not found then
    raise exception 'Teklifin yayımlanmış revizyonu bulunamadı';
  end if;

  -- YALNIZ kaynak bağı yazılır. jobs ve job_items tablolarına UPDATE yoktur;
  -- müşteri, tarih, kapsam, kalem ve resim eşleşmeleri olduğu gibi kalır.
  update public.offers
  set job_id = p_job_id
  where id = p_offer_id;

  insert into public.offer_job_conversions (
    offer_id,
    offer_revision_id,
    job_id,
    mapping_version,
    mapping_snapshot,
    warnings,
    created_by
  ) values (
    p_offer_id,
    v_revision.id,
    p_job_id,
    1,
    '[]'::jsonb,
    jsonb_build_array(
      'Mevcut iş emrine yalnız sade teklif dokümanı kaynağı olarak bağlandı; iş emri bilgileri değiştirilmedi.'
    ),
    v_user_id
  );

  insert into public.audit_log (actor, action, detail)
  values (
    v_user_id,
    'job.link_offer_document',
    jsonb_build_object(
      'job_id', p_job_id,
      'job_no', v_job.job_no,
      'offer_id', p_offer_id,
      'offer_no', v_offer.offer_no,
      'offer_revision_id', v_revision.id,
      'offer_revision_no', v_revision.rev_no,
      'job_fields_changed', false
    )
  );

  return jsonb_build_object(
    'job_id', p_job_id,
    'offer_id', p_offer_id,
    'offer_revision_id', v_revision.id,
    'already_linked', false
  );
end;
$function$;

revoke all on function public.link_offer_to_existing_job(uuid, uuid) from public;
grant execute on function public.link_offer_to_existing_job(uuid, uuid) to authenticated;

-- ═══════════════════════════════ 2. RESİM ÇARPANI OTOMATİK BAŞLANGICI

create or replace function public.job_item_default_drawing_qty(p_quantity text)
returns integer
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_match text[];
  v_qty bigint;
begin
  -- İlk sayıyı körlemesine almayız: "90x2 180 m" ve "10+10" adet değildir.
  v_match := regexp_match(
    coalesce(p_quantity, ''),
    '^\s*(\d+)\s*(?:adet|takım|takim)?\s*$',
    'i'
  );
  if v_match is null then return 1; end if;
  v_qty := v_match[1]::bigint;
  return case when v_qty between 1 and 10000 then v_qty::integer else 1 end;
end;
$function$;

comment on function public.job_item_default_drawing_qty(text) is
  'İş emrindeki tek anlamlı adedi resim/satın alma çarpanına çevirir; belirsiz özel ifadeler düzenlenebilir güvenli başlangıç olarak 1 döner.';

create or replace function public.default_job_item_drawing_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.qty is null then
    new.qty := public.job_item_default_drawing_qty(new.quantity);
  end if;
  -- shares_drawings_with NULL, kanonik "Kendi resimleri" değeridir.
  return new;
end;
$function$;

drop trigger if exists default_job_item_drawing_fields on public.job_items;
create trigger default_job_item_drawing_fields
  before insert on public.job_items
  for each row execute function public.default_job_item_drawing_fields();

-- Eski satırlar da ilk açılışta boş görünmesin; özel/karmaşık adetler 1 ile
-- başlar ve kullanıcı karttan değiştirebilir.
update public.job_items
set qty = public.job_item_default_drawing_qty(quantity)
where qty is null;

alter table public.job_items
  alter column shares_drawings_with set default null;

comment on column public.job_items.qty is
  'Teknik resim ve satın alma adedi çarpanı. Yeni satırda iş emrindeki tek anlamlı adetten otomatik gelir; özel durumda kullanıcı değiştirir.';

comment on column public.job_items.shares_drawings_with is
  'NULL = Kendi resimleri (yeni kalemin varsayılanı). Doluysa bu kalemin teknik resimleri işaret edilen kalemle ortaktır.';

-- MÜŞTERİ PORTALI SNAPSHOT SERTLEŞTİRMESİ
--
-- İlk portal migrasyonu yayımlanmış dosya satırlarının UPDATE/DELETE işlemini
-- kapattı. INSERT de aynı değişmezliğin parçasıdır: bir R01 paketine yayım
-- sonrasında sessizce yeni bir PDF eklenemez. Storage nesnesi de satır kadar
-- değişmezdir; yayımlanmış bir dosyanın yolu doğrudan Storage API ile
-- güncellenemez veya silinemez.

create or replace function public.guard_issued_product_portal_file()
returns trigger
language plpgsql
as $$
declare
  target_revision uuid;
begin
  target_revision := case when tg_op = 'DELETE' then old.revision_id else new.revision_id end;
  if exists (
    select 1 from public.product_portal_revisions r
    where r.id = target_revision and r.status = 'issued'
  ) then
    raise exception 'Yayımlanmış müşteri portalı dosyası değiştirilemez';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_issued_product_portal_file on public.product_portal_files;
create trigger guard_issued_product_portal_file
  before insert or update or delete on public.product_portal_files
  for each row execute function public.guard_issued_product_portal_file();

-- Uygulama nesne güncellemesi yapmaz: yeni bir benzersiz yola yükler. UPDATE
-- yetkisini tümden kaldırmak, upsert ile yayımlanmış baytların ezilmesini
-- engeller.
drop policy if exists "customer-portal güncelleme" on storage.objects;

drop policy if exists "customer-portal silme" on storage.objects;
create policy "customer-portal silme" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'customer-portal'
    and public.can_edit_product_portals()
    and not exists (
      select 1
      from public.product_portal_files f
      join public.product_portal_revisions r on r.id = f.revision_id
      where f.storage_path = storage.objects.name
        and r.status = 'issued'
    )
  );

-- current_revision_id yalnız bu portalın gerçekten yayımlanmış bir sürümünü
-- gösterebilir. RPC zaten bunu doğru yapar; tetikleyici doğrudan SQL/API
-- yazımlarının aynı değişmezi aşmasını önler.
create or replace function public.validate_product_portal_current_revision()
returns trigger
language plpgsql
as $$
begin
  if new.current_revision_id is not null and not exists (
    select 1
    from public.product_portal_revisions r
    where r.id = new.current_revision_id
      and r.portal_id = new.id
      and r.status = 'issued'
  ) then
    raise exception 'Güncel portal sürümü aynı portalın yayımlanmış bir sürümü olmalıdır';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_product_portal_current_revision on public.product_portals;
create trigger validate_product_portal_current_revision
  before insert or update of current_revision_id on public.product_portals
  for each row execute function public.validate_product_portal_current_revision();

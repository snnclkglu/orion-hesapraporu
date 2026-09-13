-- Yeni belge sözleşmesi ve değişmez teslim çıktısı. Eski yayınlara dokunmaz.
alter table public.manual_revisions add column if not exists delivery_archive jsonb;

create or replace function public.guard_manual_design_contract() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.payload->>'v' not in ('1','2') or coalesce(new.payload->>'designVersion','1') not in ('1','2') then
    raise exception 'Desteklenmeyen el kitabı sürümü';
  end if;
  if tg_op = 'UPDATE' and old.payload->>'designVersion' = '2' and coalesce(new.payload->>'designVersion','1') <> '2' then
    raise exception 'Şematik el kitabı eski istemciyle değiştirilemez. Sayfayı yenileyin.';
  end if;
  if new.status = 'issued' and new.payload->>'designVersion' = '2' and
     (new.delivery_archive->'body'->>'sha256' is null or new.delivery_archive->'full'->>'sha256' is null) then
    raise exception 'Şematik el kitabı teslim dosyaları arşivlenmeden yayımlanamaz';
  end if;
  return new;
end $$;
create trigger guard_manual_design_contract before insert or update on public.manual_revisions
for each row execute function public.guard_manual_design_contract();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('manual-deliveries','manual-deliveries',false,104857600,array['application/pdf']) on conflict(id) do nothing;
create policy manual_delivery_read on storage.objects for select to authenticated using (bucket_id='manual-deliveries');
create policy manual_delivery_insert on storage.objects for insert to authenticated with check (
  bucket_id='manual-deliveries' and public.can_edit_reports() and exists (
    select 1 from public.manual_revisions r join public.manuals m on m.id=r.manual_id
    where r.id::text=(storage.foldername(name))[2] and m.project_id::text=(storage.foldername(name))[1] and r.status='draft'));
create policy manual_delivery_cleanup on storage.objects for delete to authenticated using (
  bucket_id='manual-deliveries' and public.can_edit_reports() and exists (
    select 1 from public.manual_revisions r where r.id::text=(storage.foldername(name))[2] and r.status='draft'));

create or replace function public.complete_manual_delivery(p_project_id uuid,p_revision_id uuid,p_expected jsonb,p_frozen jsonb,p_archive jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare current_revision public.manual_revisions;
begin
  if not public.can_edit_reports() then raise exception 'Yayım yetkisi yok'; end if;
  select r.* into current_revision from public.manual_revisions r join public.manuals m on m.id=r.manual_id
    where r.id=p_revision_id and m.project_id=p_project_id for update of r;
  if not found or current_revision.status <> 'draft' then raise exception 'Yayımlanabilir taslak bulunamadı'; end if;
  if current_revision.payload <> p_expected then raise exception 'Taslak başka bir oturumda değişti. Yenileyin.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='manual-deliveries' and name=p_archive->'body'->>'path') or
     not exists(select 1 from storage.objects where bucket_id='manual-deliveries' and name=p_archive->'full'->>'path') then
    raise exception 'Teslim dosyaları eksik';
  end if;
  if split_part(p_archive->'body'->>'path','/',2) <> p_revision_id::text or
     split_part(p_archive->'full'->>'path','/',2) <> p_revision_id::text then raise exception 'Teslim yolu revizyonla uyuşmuyor'; end if;
  update public.manual_revisions set payload=p_frozen,delivery_archive=p_archive,status='issued' where id=p_revision_id;
end $$;
revoke all on function public.complete_manual_delivery(uuid,uuid,jsonb,jsonb,jsonb) from public;
grant execute on function public.complete_manual_delivery(uuid,uuid,jsonb,jsonb,jsonb) to authenticated;

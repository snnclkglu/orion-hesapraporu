-- Teklif kapağındaki kullanıcı imzaları özel PNG deposunda tutulur.
insert into storage.buckets (id, name, public, file_size_limit)
values ('offer-signatures', 'offer-signatures', false, 1048576)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "offer-signatures okuma" on storage.objects;
create policy "offer-signatures okuma" on storage.objects
  for select to authenticated
  using (bucket_id = 'offer-signatures' and public.can_see_offers());

drop policy if exists "offer-signatures yükleme" on storage.objects;
create policy "offer-signatures yükleme" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'offer-signatures' and public.can_see_offers());

drop policy if exists "offer-signatures güncelleme" on storage.objects;
create policy "offer-signatures güncelleme" on storage.objects
  for update to authenticated
  using (bucket_id = 'offer-signatures' and public.can_see_offers())
  with check (bucket_id = 'offer-signatures' and public.can_see_offers());

drop policy if exists "offer-signatures silme" on storage.objects;
create policy "offer-signatures silme" on storage.objects
  for delete to authenticated
  using (bucket_id = 'offer-signatures' and public.can_see_offers());

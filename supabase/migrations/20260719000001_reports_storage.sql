-- Rapor arşivi: yayınlanan revizyonların PDF çıktıları.
-- Private 'reports' bucket'ı; yol düzeni: {project_id}/{doc_no}-V{rev_no}.pdf
-- Okuma/yazma yalnızca oturum açmış (authenticated) kullanıcılara açıktır.

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- storage.objects üzerinde RLS Supabase tarafından zaten etkindir;
-- 'reports' bucket'ı için authenticated politikaları:

create policy "reports okuma (authenticated)"
on storage.objects for select
to authenticated
using (bucket_id = 'reports');

create policy "reports yükleme (authenticated)"
on storage.objects for insert
to authenticated
with check (bucket_id = 'reports');

-- upsert: mevcut nesnenin üzerine yazma (aynı revizyon yeniden yayınlanırsa)
create policy "reports güncelleme (authenticated)"
on storage.objects for update
to authenticated
using (bucket_id = 'reports')
with check (bucket_id = 'reports');

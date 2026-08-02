-- Hesap raporu silme (projects DELETE, yalnız admin) sırasında rapor arşivinin
-- yetim kalmaması için 'reports' bucket'ına DELETE politikası eklenir.
-- Yol düzeni {project_id}/{doc_no}-V{rev_no}.pdf olduğundan proje silinince
-- ilgili klasördeki nesneler de temizlenebilir. Silme yetkisi projects tablosu
-- ile aynı kuralda tutulur: yalnızca yönetici.

create policy "reports silme (admin)"
on storage.objects for delete
to authenticated
using (bucket_id = 'reports' and public.is_admin());

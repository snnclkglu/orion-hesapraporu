-- Taslak revizyonu MÜHENDİS de silebilir.
--
-- `revisions_delete` politikası yalnız yöneticiye açıktı; oysa revizyonu AÇAN
-- ve düzenleyen mühendistir (`revisions_insert`/`revisions_update` tüm ekibe
-- açık). Yanlış açılmış bir taslağı temizlemek için yöneticiyi beklemek zorunda
-- kalıyordu — kendi açtığı ve kimseye teslim edilmemiş bir kaydı silmek
-- yönetici işi değildir.
--
-- YAYINLANMIŞ REVİZYON HÂLÂ SİLİNEMEZ ve bu kural burada DEĞİL,
-- `guard_issued_revision` tetikleyicisindedir: politika kimin silebileceğini,
-- tetikleyici neyin silinebileceğini söyler. İkisi ayrı kaldığı için rol
-- kümesi genişlediğinde teslim edilmiş hesabın dokunulmazlığı gevşemez.
--
-- Müdür ve teknik ressam kapsam dışıdır: ikisi de hesap raporu yazmaz.

create or replace function public.can_edit_reports()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'engineer')
  );
$$;

comment on function public.can_edit_reports() is
  'Hesap raporu yazan roller (yönetici + mühendis). Taslak revizyon silme yetkisi buna bağlıdır; yayınlanmışı guard_issued_revision engeller.';

drop policy if exists "revisions_delete" on public.revisions;
create policy "revisions_delete" on public.revisions
  for delete to authenticated using (public.can_edit_reports());

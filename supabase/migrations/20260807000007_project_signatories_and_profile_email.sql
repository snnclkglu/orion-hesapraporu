-- Rapor sorumluları ve yönetim ekranında gösterilecek profil e-postası.

alter table public.projects
  add column if not exists prepared_by uuid references public.profiles (id) on delete set null,
  add column if not exists checked_by uuid references public.profiles (id) on delete set null;

alter table public.profiles
  add column if not exists email text not null default '';

update public.profiles p
set email = coalesce(u.email, '')
from auth.users u
where u.id = p.id
  and p.email is distinct from coalesce(u.email, '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    case when new.email in ('scolakoglu@orioncranes.com', 'sinan@vigowood.com')
         then 'admin'::public.user_role
         else 'engineer'::public.user_role end
  );
  return new;
end;
$$;

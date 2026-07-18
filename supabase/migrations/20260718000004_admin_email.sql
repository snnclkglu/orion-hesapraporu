-- Admin bootstrap e-postası güncellemesi: scolakoglu@orioncranes.com
-- (sinan@vigowood.com da admin olarak korunur)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when new.email in ('scolakoglu@orioncranes.com', 'sinan@vigowood.com')
         then 'admin'::public.user_role
         else 'engineer'::public.user_role end
  );
  return new;
end;
$$;

-- Bu e-postalarla zaten açılmış hesap varsa admin'e yükselt
update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and u.email in ('scolakoglu@orioncranes.com', 'sinan@vigowood.com')
  and p.role <> 'admin';

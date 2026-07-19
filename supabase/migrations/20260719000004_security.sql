-- Güvenlik sertleştirme
-- 1) Rol yükseltme açığı: profiles_update_own politikası kullanıcının kendi
--    satırında role sütununu da değiştirmesine izin veriyordu (engineer -> admin).
--    Trigger ile rol değişikliği yalnızca admin'e tanınır.

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Rol değişikliği için admin yetkisi gerekir';
  end if;
  return new;
end;
$$;

create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- 2) Başkasının profilini güncelleme: mevcut politika admin'e tam, kullanıcıya
--    kendi satırını veriyordu — doğru; ama with check eksikti (satırı başka
--    kullanıcıya "taşıma" denemelerine karşı) — netleştir.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- 3) audit_log: revizyon/proje kimliği sahteciliğine karşı not — insert
--    politikası actor = auth.uid() zorunluluğunu zaten taşıyor (değişiklik yok).

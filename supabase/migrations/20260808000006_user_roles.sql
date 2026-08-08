-- Rol kümesi genişletilir: Yönetici · Müdür · Mühendis · Teknik Ressam.
--
-- Mevcut `user_role` yalnız admin/engineer taşıyordu. Firma düzeni bundan
-- zengin: müdür fiyat/ciro görür ama sistem ayarlarına karışmaz, teknik ressam
-- yalnız çizim tarafındadır. Etiketler `src/lib/roles.ts`tedir:
--   admin → Yönetici · manager → Müdür · engineer → Mühendis
--   draftsman → Teknik Ressam
--
-- Enum'a değer EKLENİR, mevcut değerler değişmez: eski kayıtlar (admin/engineer)
-- olduğu gibi kalır ve `is_admin()` aynı anlamı taşımaya devam eder.

alter type public.user_role add value if not exists 'manager';
alter type public.user_role add value if not exists 'draftsman';

-- Satış/fiyat verisini görebilenler. `is_admin()` yerine AYRI bir yardımcı:
-- yönetim paneli (ayarlar, kullanıcılar, katalog yazma) yalnız yöneticide
-- kalmalı; satış rakamları ise müdüre de açıktır.
--
-- Karşılaştırma metin üzerinden yapılır — enum'a AZ ÖNCE eklenen değer aynı
-- işlem içinde literal olarak kullanılamaz.
create or replace function public.can_see_sales()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'manager')
  );
$$;

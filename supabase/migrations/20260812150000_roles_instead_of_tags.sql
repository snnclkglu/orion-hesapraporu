-- GÖREV ETİKETİ → ROL (kullanıcı kararı, 12.08.2026).
--
-- Satın Alma · Planlama · Üretim bir gün önce `profiles.tags` altında ÇOK
-- DEĞERLİ görev etiketleri olarak açılmıştı (20260812000001). Gerekçe şuydu:
-- rol tek değerlidir ve "hem Müdür hem Planlama" olan bir kişiyi ifade edemez.
--
-- KULLANICI KARARI BUNU TERSİNE ÇEVİRDİ: *"Satın Alma, Planlama ve Üretim'i
-- görev etiketi olarak değil direkt Rol olarak eklemek istiyorum. Görev
-- etiketine gerek yok."* — ve aynı turda dördüncüsü eklendi: *"Hatta Kalite de
-- olsun toplam 4 olsun."* KALİTE'nin veritabanı tarafında bugün bir karşılığı
-- YOKTUR ve olmaması bilinçlidir: rol bir kimliktir, kapı açmak ayrı bir
-- karardır (aynısı ÜRETİM için de geçerli).
--
-- Bedeli açıkça yazılıdır: Planlama rolündeki bir kişi aynı anda Müdür OLAMAZ
-- (satış takibi, iş takibi ve personel bölümlerini göremez). Hangi kimliğin
-- taşınacağı kullanıcının kararıdır ve Kullanıcılar sayfasından verilir.
--
-- ETİKET MEKANİZMASI TAMAMEN KALDIRILIR, yanında bırakılmaz: iki mekanizma bir
-- arada yaşasaydı aynı yetki iki ayrı yerden sorulabilir hâle gelir ve bir gün
-- biri güncellenip öteki unutulurdu (`drawn` sütununun düşürülme gerekçesiyle
-- birebir aynı). VERİ KAYBI YOKTUR: sütun bugün beş profilin beşinde de boştur
-- — hiçbir kullanıcıya etiket verilmemişti, ölçüldü.

-- ═══════════════════════════════════════════════════ 1. YENİ ROL DEĞERLERİ
--
-- Enum'a değer EKLENİR, mevcut değerler değişmez (20260808000006 ile aynı
-- kalıp): eski kayıtlar olduğu gibi kalır.
alter type public.user_role add value if not exists 'purchasing';
alter type public.user_role add value if not exists 'planning';
alter type public.user_role add value if not exists 'quality';
alter type public.user_role add value if not exists 'production';

-- ═══════════════════════════════════════════════════ 2. YETKİ SORUSU
--
-- KÜME DEĞİŞMEDİ, yalnız kaynağı değişti: Yönetici + Satın Alma + Planlama.
-- Müdür burada hâlâ yoktur ve bu bir gözden kaçma değildir — müdür satış
-- rakamını görür, satın alma ise tedarikçi fiyatı ve ödeme vadesi taşır.
--
-- Karşılaştırma METİN üzerindendir: enum'a AZ ÖNCE eklenen bir değer aynı
-- işlem içinde literal olarak kullanılamaz.
--
-- Fonksiyon `tags` sütununa BAKMAYI BIRAKIR ve bu, sütunu düşürmeden ÖNCE
-- yapılmalıdır: gövde bir metin olduğu için Postgres bağımlılığı izlemez,
-- yani ters sırada sütun sessizce gider ve fonksiyon ilk çağrıldığında
-- patlar — satın alma bölümü herkese kapanırdı.
create or replace function public.can_see_purchasing()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'purchasing', 'planning')
  );
$$;

comment on function public.can_see_purchasing() is
  'Satın Alma bölümü: Yönetici · Satın Alma · Planlama ROLLERİ. '
  'lib/roles.ts:canSeePurchasing ile AYNI kümedir.';

-- Bugün GÖRME ile aynı kümeyi döndürür ama AYRI bir sorudur; gövdesi
-- değişmedi, yalnız tazelenir ki iki fonksiyon aynı migration'da okunsun.
create or replace function public.can_edit_purchasing()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_see_purchasing();
$$;

-- ═══════════════════════════════════════════════════ 3. ETİKET DEFTERİ GİDER
--
-- `has_tag()` ÖNCE düşer: tek kullanıcısı `can_see_purchasing()`ti ve o artık
-- rolü soruyor. Kalsaydı hiçbir şey sormayan ama çağrılabilir duran bir yetki
-- fonksiyonu olurdu.
drop function if exists public.has_tag(text);

drop index if exists public.profiles_tags_idx;

alter table public.profiles
  drop constraint if exists profiles_tags_valid;

alter table public.profiles
  drop column if exists tags;

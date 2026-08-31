-- EL KİTABI DEFTERLERİ — bakım kuralları, yağlama noktaları, metin parçaları.
--
-- KULLANICI KARARI (30.08.2026): bakım ve yağlama kuralları "kod öntanım +
-- panelden düzenleme" olsun. Bu tablolar o kararın PANEL katmanıdır.
--
-- NEDEN İKİ KATMAN: bir bakım aralığı bir MÜHENDİSLİK kararıdır ve dayanağı
-- bir standarttır (ISO 9927-1, ISO 4309, DIN 15020). O satırlar kodda yaşar
-- (`src/lib/manual/maintenance-rules.ts`), testle kilitlidir ve sürümlenir.
-- Ama firmanın kendi görevleri de vardır ("kabin klimasının filtresini
-- değiştir") ve onlar için kod değişikliği beklemek, defteri hiç kullanmamak
-- demekti. Panel katmanı kod kuralının ÜZERİNE BİNER, kapatır ya da yenisini
-- ekler; birleştirme TEK yerdedir (`mergeMaintenanceRules`).
--
-- NEDEN `rule_id` TEXT VE UNIQUE: panel satırı kod kuralına bu anahtarla
-- bağlanır. Kod tarafında kimlikler sabittir ve testle eşsizliği korunur;
-- burada da eşsiz olmalı ki bir kurala iki farklı üzerine-binme yazılamasın.
--
-- NEDEN DESEN METİN OLARAK SAKLANIR: kural ekipman ADINA uyar ve desen bir
-- RegExp kaynağıdır. Çekirdek onu `try/catch` ile derler; BOZUK DESEN düz
-- metin araması olur ve bütün çizelgeyi düşürmez (KITAP-2'nin "belge düşmez"
-- ilkesi).
--
-- METİN PARÇALARI (`manual_snippets`): kullanıcı kararı (30.08.2026) — ana
-- şablon KODDA kalır (her kılavuzda aynı, testli), yanına panelden yönetilen
-- bir parça defteri gelir. Sık kullanılan paragraf/uyarı/liste bir kez
-- kaydedilir ve herhangi bir bölüme tek tıkla eklenir. Eklenen blok belgeye
-- KOPYALANIR: defter sonradan değişse teslim edilmiş kılavuz değişmez.

-- ------------------------------------------------------- bakım kuralları
create table if not exists public.manual_maintenance_rules (
  id uuid primary key default gen_random_uuid(),
  -- Kod kuralının kimliği (üzerine binme) ya da firmaya özel yeni bir kimlik.
  rule_id text not null,
  -- Ekipman adına uyan RegExp kaynağı; BOŞ ise kural vincin kendisine aittir
  -- (çelik yapı, ray, etiket) ve ekipman listesinden bağımsız basılır.
  match_pattern text not null default '',
  part text not null default '',
  task text not null default '',
  -- F = Montajcı · E = Elektrikçi · MA = Bakım Teknisyeni · I = Denetmen
  person text not null default '',
  -- d · w · 2w · m · 2m · y · 2y
  freq text not null default '',
  -- R · AR · LR (anlamları belgenin kendi açıklama çizelgesindedir)
  state text not null default '',
  -- DAYANAK: kod kuralında zorunlu, firmaya özel satırda serbest.
  basis text not null default '',
  -- "M7" gibi; bu kaldırma grubundan İTİBAREN geçerli.
  min_group text not null default '',
  -- Kod kuralını KAPATIR. Silmek yerine kapatmak, kararın izini bırakır.
  disabled boolean not null default false,
  sort int not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manual_maintenance_rules_rule_uidx
  on public.manual_maintenance_rules (rule_id);

alter table public.manual_maintenance_rules enable row level security;

drop policy if exists "manual_maintenance_rules_select" on public.manual_maintenance_rules;
create policy "manual_maintenance_rules_select" on public.manual_maintenance_rules
  for select to authenticated using (true);

drop policy if exists "manual_maintenance_rules_write" on public.manual_maintenance_rules;
create policy "manual_maintenance_rules_write" on public.manual_maintenance_rules
  for all to authenticated
  using (public.can_edit_manuals())
  with check (public.can_edit_manuals());

drop trigger if exists manual_maintenance_rules_touch on public.manual_maintenance_rules;
create trigger manual_maintenance_rules_touch
  before update on public.manual_maintenance_rules
  for each row execute function public.touch_updated_at();

comment on table public.manual_maintenance_rules is
  'Bakım takvimi kural defterinin PANEL katmanı; kod defterinin üzerine biner (rule_id ile).';
comment on column public.manual_maintenance_rules.rule_id is
  'Kod kuralının kimliği (üzerine binme) ya da firmaya özel yeni kimlik; eşsizdir.';
comment on column public.manual_maintenance_rules.match_pattern is
  'Ekipman adına uyan RegExp kaynağı; boşsa kural ekipmandan bağımsızdır. Bozuk desen düz metin araması olur.';
comment on column public.manual_maintenance_rules.disabled is
  'Kod kuralını kapatır — silmek yerine kapatmak kararın izini bırakır.';

-- ---------------------------------------------------- yağlama noktaları
create table if not exists public.manual_lubrication_points (
  id uuid primary key default gen_random_uuid(),
  point_id text not null,
  match_pattern text not null default '',
  place text not null default '',
  -- YAĞ SINIFI, ürün adı DEĞİL ("Dişli yağı ISO VG 220", "Gres NLGI 2").
  -- Tabloya BASILMAZ; tablonun üstündeki köprü notunu kurar. Ürün adı
  -- uygulamada yoktur ve uydurulmaz (değişmez md. 4).
  klass text not null default '',
  basis text not null default '',
  disabled boolean not null default false,
  sort int not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manual_lubrication_points_point_uidx
  on public.manual_lubrication_points (point_id);

alter table public.manual_lubrication_points enable row level security;

drop policy if exists "manual_lubrication_points_select" on public.manual_lubrication_points;
create policy "manual_lubrication_points_select" on public.manual_lubrication_points
  for select to authenticated using (true);

drop policy if exists "manual_lubrication_points_write" on public.manual_lubrication_points;
create policy "manual_lubrication_points_write" on public.manual_lubrication_points
  for all to authenticated
  using (public.can_edit_manuals())
  with check (public.can_edit_manuals());

drop trigger if exists manual_lubrication_points_touch on public.manual_lubrication_points;
create trigger manual_lubrication_points_touch
  before update on public.manual_lubrication_points
  for each row execute function public.touch_updated_at();

comment on table public.manual_lubrication_points is
  'Yağlama nokta defterinin PANEL katmanı; kod defterinin üzerine biner (point_id ile).';
comment on column public.manual_lubrication_points.klass is
  'Yağ SINIFI (ISO VG / NLGI); ürün adı değildir ve tabloya basılmaz, köprü notunu kurar.';

-- ------------------------------------------------------- metin parçaları
create table if not exists public.manual_snippets (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  category text not null default '',
  -- Hangi bölümde önerilsin (şablon `key`i); boşsa her bölümde görünür.
  section_hint text not null default '',
  -- TEK bir ManualBlock. Serbest JSON DOĞRUDAN YAZILMAZ: sunucu eylemi onu
  -- önce çekirdeğin blok okuyucusundan geçirir (KITAP-10 ilkesi), yoksa bir
  -- hata veritabanına okunamayan bir blok yazar ve o parça bir daha açılmaz.
  block jsonb not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_snippets_section_idx
  on public.manual_snippets (section_hint);

alter table public.manual_snippets enable row level security;

drop policy if exists "manual_snippets_select" on public.manual_snippets;
create policy "manual_snippets_select" on public.manual_snippets
  for select to authenticated using (true);

drop policy if exists "manual_snippets_write" on public.manual_snippets;
create policy "manual_snippets_write" on public.manual_snippets
  for all to authenticated
  using (public.can_edit_manuals())
  with check (public.can_edit_manuals());

drop trigger if exists manual_snippets_touch on public.manual_snippets;
create trigger manual_snippets_touch
  before update on public.manual_snippets
  for each row execute function public.touch_updated_at();

comment on table public.manual_snippets is
  'El kitabı metin parçaları defteri; belgeye KOPYALANIR, sonradan defter değişse teslim edilmiş kılavuz değişmez.';
comment on column public.manual_snippets.block is
  'Tek bir ManualBlock; yazılmadan önce withManualDefaults blok okuyucusundan geçirilir.';

-- Faz V5 — Parça üretim durumu (atölye): aşama defteri + ilerleme bağlantısı.
--
-- 20260810000001 `drawing_part_progress` tablosunu zaten kurdu ve aşamayı METİN
-- olarak sakladı (`stage text not null`). Bu migration o metnin arkasına BİR
-- DEFTER koyar. Gerekçe İş Takibi'nden birebir devralınmıştır:
--
--   `work_categories` serbest metin olsaydı aynı imalat türü beş yazımla
--   girilir ve parça bazında toplam ALINAMAZDI. Kaynak çizelgede tam olarak bu
--   oldu ("Anakiriş" / "Ana Kiriş" / "ANA KİRİŞ") ve defter o yüzden var.
--
-- Atölyede aynı risk daha büyüktür: "kesildi" · "Kesildi" · "KESİLDİ" ·
-- "kesim yapıldı" · "kesim" beş ayrı aşama olurdu ve "kaç parça kesildi"
-- sorusunun cevabı hiçbir zaman doğru çıkmazdı.
--
-- METİN SÜTUNU KALIR VE ASIL ANAHTAR ODUR. `stage_id` yalnız bir bağdır:
-- defter satırı silinse bile (`on delete set null`) atölyenin kaydı yaşamaya
-- devam eder. Bu, tablonun kuruluş gerekçesiyle aynı ilkedir — `drawing_parts`
-- her eşleştirmede silinip yeniden kurulduğu için ilerleme PAKETE DEĞİL
-- PARÇAYA, kimliğe değil METNE bağlanır.
--
-- MEVCUT MIGRATION DEĞİŞTİRİLMEZ ("uygulanmış bir migration düzenlenmez").

-- ------------------------------------------------------- drawing_stages
-- RENK OKLCH TON AÇISIDIR (0-359), HEX DEĞİL.
--
-- `customers.color_hue` ve `work_categories` ile aynı kural: aynı hex açık ve
-- koyu temada birden okunmaz. Veri yalnız açıyı taşır; doygunluk ve parlaklık
-- `globals.css`teki `.oc-tag` kuralındadır ve tema başına ayrı verilir.
-- Kullanıcı tonu seçer, okunurluğu bozamaz (bkz. src/lib/tags.ts
-- `nextDistinctHue` — yeni aşama var olanlardan EN UZAK tonu alır).
create table if not exists public.drawing_stages (
  id uuid primary key default gen_random_uuid(),

  -- KARARLI ANAHTAR. `drawing_part_progress.stage` metni buna eşittir ve
  -- ASCII'dir: Türkçe karakterli bir anahtar küçültme/büyütme uçlarında
  -- sessizce ikiye bölünürdü ("KESİLDİ".toLowerCase() İngilizce yerelde
  -- "kesi̇ldi̇" verir ve "kesildi" ile EŞİT DEĞİLDİR — bkz. lib/drawings/tr-text.ts).
  slug text not null,

  -- GÖRÜNEN AD. Türkçedir ve düzeltilebilir; anahtar onunla birlikte kaymaz.
  name text not null,

  sort int not null default 0,
  color_hue smallint not null default 0,

  -- Kullanımdan kalkan aşama SİLİNMEZ, pasife alınır: geçmiş kayıtların
  -- aşaması bir gün adsız kalmamalı.
  active boolean not null default true,

  note text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dwg_stage_slug_ascii check (slug ~ '^[a-z0-9_]+$'),
  constraint dwg_stage_hue_range check (color_hue >= 0 and color_hue <= 359)
);

create unique index if not exists dwg_stage_slug_key on public.drawing_stages (slug);
-- Ad da TEKİLDİR: aynı aşamanın iki adla girilmesi tam olarak kaçınılan şeydir.
create unique index if not exists dwg_stage_name_key on public.drawing_stages (name);
create index if not exists dwg_stage_sort_idx on public.drawing_stages (sort);

comment on table public.drawing_stages is
  'Üretim aşaması DEFTERİ — serbest metin değil. İş Takibi''nin work_categories '
  'dersi: aynı aşama beş yazımla girilirse parça bazında toplam ALINAMAZ. '
  'Renk OKLCH TON AÇISIDIR (hex değil): aynı hex açık ve koyu temada birden '
  'okunmaz. Aşama SİLİNMEZ, active=false ile pasife alınır.';

-- Tohum aşamalar. Kullanıcının baştan saydıkları ("parça satın alındı,
-- kesildi, talaşlı imalata girdi vs") artı atölyenin geri kalan doğal adımları.
--
-- TONLAR EN AZ 40 DERECE ARALIKLIDIR: bu çipler bir parça satırında YAN YANA
-- durur; komşu iki aşamanın ayırt edilebilirliği veriyle değil KURALLA
-- garanti edilir (aynı gerekçe `nextDistinctHue`in var olma sebebidir).
--
--   satinalindi  265  menekşe      kesildi        25  mercan
--   bukuldu       65  amber        talasli       200  camgöbeği
--   kaynak       320  eflatun      boya          150  yeşil
--   montaja_hazir 105 fıstık
--
-- `on conflict do nothing`: migration yeniden çalışırsa kullanıcının
-- düzelttiği ad/ton/sıra EZİLMEZ.
insert into public.drawing_stages (slug, name, sort, color_hue) values
  ('satinalindi',   'Satın alındı',   10, 265),
  ('kesildi',       'Kesildi',        20,  25),
  ('bukuldu',       'Büküldü',        30,  65),
  ('talasli',       'Talaşlı imalat', 40, 200),
  ('kaynak',        'Kaynak',         50, 320),
  ('boya',          'Boya',           60, 150),
  ('montaja_hazir', 'Montaja hazır',  70, 105)
on conflict (slug) do nothing;

-- --------------------------------------------- drawing_part_progress bağı
-- `on delete set null`: defter satırı silinirse atölye kaydı METİNLE yaşar.
-- Bu sütun bir KİMLİK DEĞİL bir KOLAYLIKTIR (ad ve renk için birleştirme);
-- ilerlemenin anahtarı hâlâ (item_no, part_code, stage) üçlüsüdür.
alter table public.drawing_part_progress
  add column if not exists stage_id uuid references public.drawing_stages (id) on delete set null;

create index if not exists dwg_progress_stage_idx on public.drawing_part_progress (stage_id);

-- Liste ekranı "kaç parça montaja hazır" sorusunu bütün paketler için tek
-- sorguda sorar; (item_no, part_code, stage) benzersiz indeksi soldan önekli
-- olduğu için `where stage = …` süzgecini KARŞILAMAZ.
create index if not exists dwg_progress_stage_slug_idx on public.drawing_part_progress (stage);

-- Var olan kayıtları deftere bağla (metin zaten slug ile aynı yazılıyordu).
update public.drawing_part_progress p
   set stage_id = s.id
  from public.drawing_stages s
 where p.stage_id is null
   and p.stage = s.slug;

-- --------------------------------------------------------------- updated_at
drop trigger if exists touch_drawing_stages on public.drawing_stages;
create trigger touch_drawing_stages before update on public.drawing_stages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------- RLS
-- 20260810000001'deki do-loop kalıbının aynısı: OKUMA HERKESE (teknik resim
-- atölyenin ortak gerçeğidir), YAZMA `can_edit_drawings()`.
--
-- Aşama defterini SİLME de `can_edit_drawings()`tedir, `is_admin()` değil:
-- yıkıcılığı bir paketi silmekle kıyaslanamaz (yedi satırlık bir sözlük) ve
-- `on delete set null` sayesinde hiçbir atölye kaydı düşmez.
alter table public.drawing_stages enable row level security;

do $$
declare
  t text := 'drawing_stages';
begin
  execute format('drop policy if exists %I on public.%I', t || '_select', t);
  execute format('drop policy if exists %I on public.%I', t || '_insert', t);
  execute format('drop policy if exists %I on public.%I', t || '_update', t);
  execute format('drop policy if exists %I on public.%I', t || '_delete', t);

  execute format(
    'create policy %I on public.%I for select to authenticated using (true)',
    t || '_select', t);
  execute format(
    'create policy %I on public.%I for insert to authenticated with check (public.can_edit_drawings())',
    t || '_insert', t);
  execute format(
    'create policy %I on public.%I for update to authenticated using (public.can_edit_drawings()) with check (public.can_edit_drawings())',
    t || '_update', t);
  execute format(
    'create policy %I on public.%I for delete to authenticated using (public.can_edit_drawings())',
    t || '_delete', t);
end $$;

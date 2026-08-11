-- Faz V7/2 — SATIN ALMA MODÜLÜ: teklifler, siparişler, sipariş satırları.
--
-- ═════════════════════════════════════════════════ TEMEL KARAR: ANAHTAR
--
-- Satın alma paket başına DÜŞÜNMEZ. Satınalmacı "0057-00-0500'ün cıvataları"
-- diye sipariş vermez; elindeki bütün projelerin cıvatalarını biriktirir ve
-- tedarikçiye tek sipariş açar (kullanıcı kararı, md. 7). Aynı sebeple bir
-- fiyat da pakete ait değildir: "RULMAN 6205-Z'yi geçen sene kaça almışız"
-- sorusunun cevabı bütün projelerin ortak hafızasıdır (md. 13).
--
-- Bu yüzden ANAHTAR PAKET DEĞİL TANIMDIR:
--
--     match_key = trKatla(normalizeTanim(ham tanım))
--
-- `drawing_purchase_overrides.match_key` ile BİREBİR AYNI dilbilgisi — o
-- defter de "aynı somun her pakette aynı somundur" diyerek kurulmuştu. İki
-- ayrı anahtar şeması, kategori düzeltmesi ile fiyat geçmişini birbirinden
-- habersiz bırakırdı.
--
-- `package_id` ve `item_no` SATIRDA DURUR ama BAĞ DEĞİL BAĞLAMdır: hangi iş
-- için alındığını söyler, kimliği taşımaz (`on delete set null`). Paket
-- silinse bile "bu rulman şu tarihte şu fiyata alındı" bilgisi yaşamalıdır —
-- `drawing_part_progress`in dersinin (md. 18) birebir aynısı.
--
-- ══════════════════════════════════════════ PARA: HER ŞEY AVRODA GÖRÜNÜR
--
-- Kullanıcı kararı: "Fiyatlar Euro olacak. TL fiyat girilirse kur bilgisi
-- istenecek ve sistemimizde hep euro görünecek."
--
-- `job_item_sales` ile AYNI sözleşme (md. 16): `fx_rate` = 1 avro kaç birim
-- `currency` eder, avro satırında 1'dir, avro karşılığı TÜRETİLİR. Kur
-- SATIRIN KENDİNDEDİR: merkezî bir kur tablosundan okunsaydı bugünkü kur
-- değişince geçmişte ödediğimiz fiyatın avro karşılığı da değişir ve fiyat
-- arşivi bir referans olmaktan çıkardı.

-- ═══════════════════════════════════════════════════════ 1. TEKLİFLER
--
-- "Teklif Alındı" AYRI BİR İŞARET DEĞİLDİR, bir SONUÇTUR: kalemin en az bir
-- teklifi varsa teklif alınmıştır. Ayrı bir boolean tutulsaydı iki gerçek
-- (işaret ve teklif satırları) ayrışabilir ve ekran "teklif alındı" derken
-- listede tek fiyat görünmeyebilirdi.
create table if not exists public.purchase_quotes (
  id uuid primary key default gen_random_uuid(),

  -- KİMLİK — katlanmış standart tanım. Fiyat arşivi bunun üzerinden çalışır.
  match_key text not null,
  -- İnsan okusun diye ilk görülen standart tanım ("CIVATA M16X120 DIN 931
  -- GALVANİZLİ"). Anahtar katlanmış olduğu için defter tek başına okunduğunda
  -- neyin fiyatı olduğu anlaşılmazdı (`drawing_purchase_overrides.sample`).
  sample text not null default '',

  -- Tedarikçi. Ayrı bir defter tablosu AÇILMADI: ad `adBuyuk` ile BÜYÜK HARFE
  -- çevrilerek saklanır ve arayüz var olan adları öneri olarak sunar. İş
  -- Takibi'nin parça defteri dersi (aynı parça beş yazımla girilmişti) burada
  -- normalleştirme + öneri ile karşılanır; üçüncü bir yönetim ekranı açmak
  -- teklif girmeyi yavaşlatırdı ve o zaman hiç girilmezdi.
  supplier text not null,

  unit_price numeric(16, 4) not null,
  currency text not null default 'EUR',
  fx_rate numeric(14, 6),
  -- Karşılaştırılabilir tek büyüklük. Kur yoksa NULL — sıfır yazmak "bedava"
  -- derdi ve en ucuz teklif olarak sıralanırdı.
  unit_price_eur numeric(20, 6) generated always as (
    case when fx_rate is null or fx_rate = 0 then null else unit_price / fx_rate end
  ) stored,

  -- Teklifin geçerli olduğu adet; tedarikçi çoğu zaman kademeli fiyat verir.
  qty numeric(14, 3),
  unit text not null default 'Adet',

  quoted_at date not null default current_date,
  valid_until date,
  -- Kazanan teklif. Sipariş bundan TÜREMEZ (sipariş kendi satırını yazar) ama
  -- "hangisini seçtik" sorusu teklif tablosunun kendi sorusudur.
  chosen boolean not null default false,
  note text not null default '',

  -- BAĞLAM (kimlik değil): teklif hangi iş için istendi?
  item_no text not null default '',
  package_id uuid references public.drawing_packages (id) on delete set null,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_quotes_currency_check check (currency in ('TRY', 'EUR', 'USD')),
  constraint purchase_quotes_fx_positive check (fx_rate is null or fx_rate > 0),
  constraint purchase_quotes_price_positive check (unit_price >= 0),
  constraint purchase_quotes_qty_positive check (qty is null or qty > 0)
);

create index if not exists purchase_quotes_key_idx on public.purchase_quotes (match_key);
create index if not exists purchase_quotes_supplier_idx on public.purchase_quotes (supplier);
create index if not exists purchase_quotes_date_idx on public.purchase_quotes (quoted_at desc);

comment on table public.purchase_quotes is
  'Alınan teklifler. Anahtar PAKET DEĞİL TANIMDIR (match_key): aynı rulmanın '
  'fiyatı bütün projelerin ortak hafızasıdır.';

-- ══════════════════════════════════════════════════════ 2. SİPARİŞLER
--
-- BİR SİPARİŞ BİRDEN ÇOK PROJEYE HİZMET EDER (md. 7). Başlık tedarikçiyi,
-- tarihleri ve ödeme koşulunu taşır; hangi kalemin hangi işe gittiği
-- SATIRDADIR. Sipariş `item_no` taşısaydı çok projeli sipariş modellenemez,
-- satınalmacı gerçekte yaptığı işi sisteme giremezdi.
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),

  -- Bizim ya da tedarikçinin sipariş numarası; serbest, tekillik dayatılmaz
  -- (aynı numara iki tedarikçide olabilir).
  order_no text not null default '',
  supplier text not null,

  ordered_at date not null default current_date,
  -- TERMİN: malzemenin BEKLENDİĞİ gün (gelecek zaman, tahmin).
  due_at date,
  -- Gerçekten geldiği gün. `due_at` ile karıştırılmaz — biri tahmin, biri
  -- olgu (`drawing_part_progress`teki done_at/due_at ayrımının aynısı).
  received_at date,

  -- ÖDEME KOŞULU.
  --
  -- Kullanıcının açılır listesi karışık iki şey içeriyor: "Peşin" ve "Kredi
  -- Kartı" bir ÖDEME BİÇİMİdir, "30 gün" bir VADEdir. İkisi tek metin alanına
  -- konsaydı ödeme günü hesaplanamazdı ("kredi kartı" kaç gün eder?). Bu
  -- yüzden biçim ve gün AYRI durur; arayüz ikisini tek açılır listede birleştirir.
  --
  -- Gün SERBESTTİR (0–365), sabit bir listeye kapatılmadı: bugün 15/30/45/60/90
  -- isteniyor ama "120 gün" bir sabah gerekirse bunun için migration yazmak
  -- gerekmemeli.
  payment_method text not null default 'pesin',
  payment_term_days int not null default 0,

  -- AVANS — iki yol, ikisi de isteğe bağlı.
  -- Yüzde açılır listeden (%5…%30), tutar elle. İkisi de doluysa TUTAR kazanır
  -- (elle yazılan bir sayı, bir orandan türetilenden daha kesindir).
  advance_pct numeric(5, 2),
  advance_amount numeric(16, 4),
  advance_paid_at date,
  balance_paid_at date,

  currency text not null default 'EUR',
  fx_rate numeric(14, 6),

  note text not null default '',
  -- İptal edilen sipariş SİLİNMEZ: teslim ve ödeme takvimlerinden düşer ama
  -- fiyat arşivinde "şu tarihte şu fiyata anlaşılmıştı" bilgisi kalır.
  cancelled_at date,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_orders_currency_check check (currency in ('TRY', 'EUR', 'USD')),
  constraint purchase_orders_fx_positive check (fx_rate is null or fx_rate > 0),
  constraint purchase_orders_method_check
    check (payment_method in ('pesin', 'kredi_karti', 'vadeli')),
  constraint purchase_orders_term_range
    check (payment_term_days between 0 and 365),
  -- Vadeli bir siparişin vadesi olmalıdır; yoksa "vadeli" demek boş bir
  -- etikettir ve ödeme günü teslim günüyle çakışırdı.
  constraint purchase_orders_vadeli_days
    check (payment_method <> 'vadeli' or payment_term_days > 0),
  constraint purchase_orders_advance_pct_range
    check (advance_pct is null or (advance_pct > 0 and advance_pct <= 100)),
  constraint purchase_orders_advance_amount_positive
    check (advance_amount is null or advance_amount > 0)
);

create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier);
create index if not exists purchase_orders_due_idx on public.purchase_orders (due_at)
  where due_at is not null and cancelled_at is null;
create index if not exists purchase_orders_ordered_idx on public.purchase_orders (ordered_at desc);

comment on column public.purchase_orders.payment_term_days is
  'Vade GÜNÜ. Ödeme günü SİPARİŞ TARİHİNDEN DEĞİL TESLİMDEN sayılır '
  '(kullanıcı kararı): coalesce(received_at, due_at) + payment_term_days.';

-- ═══════════════════════════════════════════════ 3. SİPARİŞ SATIRLARI
create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders (id) on delete cascade,

  -- Teklifle AYNI kimlik: fiyat arşivi ikisini tek listede birleştirir.
  match_key text not null,
  sample text not null default '',

  -- BAĞLAM: bu satır hangi iş kalemi için. Çok projeli siparişte satır satır
  -- değişir — başlıkta duramamasının sebebi budur.
  item_no text not null default '',
  package_id uuid references public.drawing_packages (id) on delete set null,
  -- Talep havuzundaki satırla bağ (`progressKeyOf`). Kimlik DEĞİLDİR; paket
  -- yeniden eşleştirilince anahtar değişebilir ve satır yine de yaşamalıdır.
  part_key text not null default '',

  qty numeric(14, 3) not null,
  unit text not null default 'Adet',
  unit_price numeric(16, 4),

  -- KISMİ TESLİM GERÇEKTİR: 100 cıvatanın 60'ı gelir. Sıfırdan başlar ve
  -- `qty`ye ulaşınca satır tamamlanmış sayılır.
  received_qty numeric(14, 3) not null default 0,

  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_order_lines_qty_positive check (qty > 0),
  constraint purchase_order_lines_received_range
    check (received_qty >= 0),
  constraint purchase_order_lines_price_positive
    check (unit_price is null or unit_price >= 0)
);

create index if not exists purchase_order_lines_order_idx
  on public.purchase_order_lines (order_id);
create index if not exists purchase_order_lines_key_idx
  on public.purchase_order_lines (match_key);
create index if not exists purchase_order_lines_item_idx
  on public.purchase_order_lines (item_no) where item_no <> '';

-- ------------------------------------------------------------- updated_at
do $$
declare t text;
begin
  foreach t in array array['purchase_quotes','purchase_orders','purchase_order_lines'] loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format(
      'create trigger touch_%I before update on public.%I '
      'for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ════════════════════════════════════════════ 4. TÜRETİLMİŞ GÖRÜNÜMLER
--
-- Sipariş TOPLAMI satırlardan gelir ve türetilmiş bir sütun olamaz (üretilmiş
-- sütun toplulaştıramaz). İki sayfa (teslim takvimi, ödeme takvimi) ve fiyat
-- arşivi aynı toplamı ister; üç yerde ayrı yazılsaydı biri er geç KDV'yi ya da
-- iptal edilmiş satırı farklı sayardı.
--
-- `security_invoker = true`: görünüm çağıranın haklarıyla çalışır, yani alt
-- tabloların RLS'i geçerli kalır. Varsayılan (definer) olsaydı görünüm bir
-- yetki deliği olurdu.
create or replace view public.purchase_order_totals
with (security_invoker = true) as
select
  o.id                                            as order_id,
  count(l.id)                                     as line_count,
  coalesce(sum(l.qty), 0)                         as total_qty,
  coalesce(sum(l.received_qty), 0)                as received_qty,
  coalesce(sum(l.qty * coalesce(l.unit_price, 0)), 0) as total_amount,
  case
    when o.fx_rate is null or o.fx_rate = 0 then null
    else coalesce(sum(l.qty * coalesce(l.unit_price, 0)), 0) / o.fx_rate
  end                                             as total_eur,
  -- ÖDEME GÜNÜ TESLİMDEN SAYILIR (kullanıcı kararı, md. 11): "ürün teslimi +
  -- vade süresi şeklinde öderiz, sipariş tarihi + vade değil". Mal henüz
  -- gelmediyse beklenen teslim (termin) esas alınır — takvim bir tahmindir ve
  -- tahminin dayanağı da tahmin olabilir.
  case
    when o.payment_term_days = 0 then coalesce(o.received_at, o.due_at)
    else coalesce(o.received_at, o.due_at) + o.payment_term_days
  end                                             as payment_due_at
from public.purchase_orders o
left join public.purchase_order_lines l on l.order_id = o.id
group by o.id, o.fx_rate, o.payment_term_days, o.received_at, o.due_at;

comment on view public.purchase_order_totals is
  'Sipariş toplamları ve ödeme günü. Ödeme günü TESLİMDEN sayılır, sipariş '
  'tarihinden değil (kullanıcı kararı).';

-- ---------------------------------------------------------------------- RLS
--
-- `job_item_sales` KALIBI, "authenticated okuma" DEĞİL: satın alma tedarikçi
-- fiyatı ve ödeme vadesi taşır. Okuma da yazma da `can_see_purchasing()`
-- ister — Yönetici + «Satın Alma»/«Planlama» etiketi.
alter table public.purchase_quotes enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'purchase_quotes','purchase_orders','purchase_order_lines'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (public.can_see_purchasing())', t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check (public.can_edit_purchasing())', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (public.can_edit_purchasing()) with check (public.can_edit_purchasing())',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using (public.can_edit_purchasing())', t || '_delete', t);
  end loop;
end $$;

-- ══════════════════════ 4b. SATIN ALMA AŞAMALARINI SATINALMACI DA YAZAR
--
-- `drawing_part_progress` yazma politikası `can_edit_drawings()` istiyordu:
-- Yönetici · Mühendis · Teknik Ressam. Satınalmacı bu kümede DEĞİLDİR ve
-- olmamalıdır — paketi yeniden eşleştirmek onun işi değil.
--
-- Ama "satın alındı" ve "teslim alındı" TAM OLARAK onun işidir; kodun kendisi
-- bunu zaten söylüyor (`PURCHASE_STAGE_SLUGS`, md. 18: "sipariş kararı tezgâhın
-- değil satınalmanın kaydıdır"). Politika o güne kadar bu ayrımı tanımıyordu
-- çünkü satınalmacı diye ayrı bir yetki yoktu.
--
-- AYRIM AŞAMA DÜZEYİNDEDİR, tablo düzeyinde değil: satınalmacı "kesildi"
-- yazamaz, atölye "satın alındı" işaretleyemez (ikincisi zaten ekranda yok).
-- İki kural aynı listeyi okur; ayrışmalarını `progress.test.ts` migration
-- dosyasını okuyarak engeller.
do $$
declare
  t text := 'drawing_part_progress';
  satinalma text := $q$stage in ('satinalindi','teslim_alindi') and public.can_edit_purchasing()$q$;
begin
  execute format('drop policy if exists %I on public.%I', t || '_insert', t);
  execute format('drop policy if exists %I on public.%I', t || '_update', t);
  execute format('drop policy if exists %I on public.%I', t || '_delete', t);

  execute format(
    'create policy %I on public.%I for insert to authenticated '
    'with check (public.can_edit_drawings() or (%s))', t || '_insert', t, satinalma);
  execute format(
    'create policy %I on public.%I for update to authenticated '
    'using (public.can_edit_drawings() or (%s)) '
    'with check (public.can_edit_drawings() or (%s))', t || '_update', t, satinalma, satinalma);
  execute format(
    'create policy %I on public.%I for delete to authenticated '
    'using (public.can_edit_drawings() or (%s))', t || '_delete', t, satinalma);
end $$;

-- ═════════════════════════════════ 5. ANA GRUP DEFTERİ (kod → grup adı)
--
-- Kullanıcı kararı (md. 9): "0057-00-0700'ün 1 TON KANCA BLOĞU olduğunu
-- anlamalıyız ve bunu parçalara ve sistemde ihtiyaç olan yerlerde
-- anlaşılabilirliği artırmak için kullanmalıyız."
--
-- Ad UYDURULMAZ, kaynaktan ÇIKARILIR: depo/ürün ağacı Excel'inde o kodun
-- KENDİ SATIRI vardır ve tanımı oradadır. İçe aktarım bu deftere yazar;
-- kullanıcı düzeltebilir ve düzeltme tahmini YENER (satın alma kategorisi
-- düzeltme defteriyle aynı felsefe).
--
-- Anahtar KODUN KENDİSİDİR, pakete bağlı değil: aynı grup kodu bir sonraki
-- revizyonda da aynı grubu anlatır.
create table if not exists public.drawing_group_names (
  id uuid primary key default gen_random_uuid(),
  -- "0057-00-0700" — normalleştirilmiş grup kodu.
  group_code text not null,
  name text not null,
  -- Adı insan mı düzeltti yoksa içe aktarım mı buldu? Düzeltilmiş ad, yeniden
  -- eşleştirmede EZİLMEZ.
  manual boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists drawing_group_names_code
  on public.drawing_group_names (group_code);

comment on table public.drawing_group_names is
  'Ana grup kodu → grup adı (0057-00-0700 → 1 TON KANCA BLOĞU). Ad kaynak '
  'Excel''deki kendi satırından ÇIKARILIR, uydurulmaz.';

drop trigger if exists touch_drawing_group_names on public.drawing_group_names;
create trigger touch_drawing_group_names
  before update on public.drawing_group_names
  for each row execute function public.touch_updated_at();

-- Grup adı teknik resim tarafının ortak gerçeğidir (satın alma da okur):
-- okuma HERKESE, yazma `can_edit_drawings()` — `drawing_purchase_overrides`
-- ile aynı kural.
alter table public.drawing_group_names enable row level security;

do $$
declare t text := 'drawing_group_names';
begin
  execute format('drop policy if exists %I on public.%I', t || '_select', t);
  execute format('drop policy if exists %I on public.%I', t || '_insert', t);
  execute format('drop policy if exists %I on public.%I', t || '_update', t);
  execute format('drop policy if exists %I on public.%I', t || '_delete', t);

  execute format(
    'create policy %I on public.%I for select to authenticated using (true)',
    t || '_select', t);
  execute format(
    'create policy %I on public.%I for insert to authenticated '
    'with check (public.can_edit_drawings() or public.can_edit_purchasing())',
    t || '_insert', t);
  execute format(
    'create policy %I on public.%I for update to authenticated '
    'using (public.can_edit_drawings() or public.can_edit_purchasing()) '
    'with check (public.can_edit_drawings() or public.can_edit_purchasing())',
    t || '_update', t);
  execute format(
    'create policy %I on public.%I for delete to authenticated '
    'using (public.can_edit_drawings())', t || '_delete', t);
end $$;

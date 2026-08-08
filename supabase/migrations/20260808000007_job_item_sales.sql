-- Satış Takibi: iş kalemi başına ticari bilgi (kapsam, termin/sevk, miktar,
-- ağırlık, fiyat, para birimi, kur).
--
-- NEDEN AYRI TABLO: fiyat yalnız Yönetici ve Müdür'e açıktır. Alanlar
-- `job_items` üzerine konsaydı satır bir bütün olarak okunduğu için mühendisin
-- gördüğü sorgudan fiyatı ayıklamak sunum katmanına kalırdı; ayrı tabloda
-- yetkiyi RLS'in kendisi keser (`can_see_sales()`), sızdıracak sorgu yazılamaz.
--
-- SATIRLAR ÖNCEDEN ÜRETİLMEZ. Sayfa `job_items` ile SOL BİRLEŞTİRME yapar;
-- her iş kalemi listede zaten görünür, kayıt ilk fiyat girildiğinde oluşur.
-- Tetikleyiciyle satır çoğaltmak, iş kalemi silinip yeniden yazıldığında
-- (iş emri güncellemesi `job_items`i tamamen yeniler) boş kayıt bırakırdı.

create table if not exists public.job_item_sales (
  id uuid primary key default gen_random_uuid(),
  -- Tek kalem = tek satır. Kalem silinirse ticari kaydı da gider.
  job_item_id uuid not null unique references public.job_items (id) on delete cascade,

  scope text not null default '',              -- Kapsam (ör. "Komple İmalat")
  due_date date,                               -- Termin tarihi
  shipment_date date,                          -- Sevk tarihi
  quantity numeric(14, 3),                     -- Miktar
  unit text not null default 'Adet',           -- Birim (Adet / Takım / m …)
  unit_weight_kg numeric(14, 3),               -- Birim ağırlık (kg)
  unit_price numeric(16, 4),                   -- Birim fiyat (KDV hariç)

  -- Para birimi ISO koduyla tutulur (TRY/EUR/USD); Türkçe etiket sunumdadır.
  currency text not null default 'EUR',
  -- 1 avro kaç `currency` eder. TRY için ~35, USD için ~1,15, EUR için 1.
  -- Kur SATIRA yazılır, merkezî bir kur tablosundan okunmaz: sözleşme anındaki
  -- kur sonradan değişse bile o işin avro karşılığı değişmemelidir.
  fx_rate numeric(14, 6),

  shipment_place text not null default '',     -- Sevk yeri
  notes text not null default '',

  -- Toplamlar TÜRETİLİR: elle girilen bir toplam, birim değerlerle çelişebilir.
  total_weight_kg numeric(18, 3) generated always as (
    coalesce(quantity, 0) * coalesce(unit_weight_kg, 0)
  ) stored,
  total_price numeric(20, 4) generated always as (
    coalesce(quantity, 0) * coalesce(unit_price, 0)
  ) stored,
  eur_amount numeric(20, 4) generated always as (
    case
      when fx_rate is null or fx_rate = 0 then null
      else (coalesce(quantity, 0) * coalesce(unit_price, 0)) / fx_rate
    end
  ) stored,

  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint job_item_sales_currency_check
    check (currency in ('TRY', 'EUR', 'USD')),
  constraint job_item_sales_fx_positive
    check (fx_rate is null or fx_rate > 0)
);

create index if not exists job_item_sales_item_idx
  on public.job_item_sales (job_item_id);

create trigger touch_job_item_sales before update on public.job_item_sales
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------- RLS
-- Diğer tablolardan FARKLI: "authenticated okuma" YOK. Okuma da yazma da
-- `can_see_sales()` ister (Yönetici + Müdür).
alter table public.job_item_sales enable row level security;

create policy "job_item_sales_select" on public.job_item_sales
  for select to authenticated using (public.can_see_sales());
create policy "job_item_sales_insert" on public.job_item_sales
  for insert to authenticated with check (public.can_see_sales());
create policy "job_item_sales_update" on public.job_item_sales
  for update to authenticated using (public.can_see_sales())
  with check (public.can_see_sales());
create policy "job_item_sales_delete" on public.job_item_sales
  for delete to authenticated using (public.can_see_sales());

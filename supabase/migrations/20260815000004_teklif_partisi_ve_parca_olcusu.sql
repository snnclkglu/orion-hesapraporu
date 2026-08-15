-- TEKLİF PARTİSİ + PARÇA ÖLÇÜSÜ DÜZELTMESİ (kullanıcı listesi, 15.08.2026).
--
-- İki ayrı karar, tek migration: ikisi de aynı turda istendi ve ikisi de
-- İNSANIN KARARINI saklar.
--
-- ═══════════════════════════════════════════ 1. TEKLİF BİR PARTİ HÂLİNDE GELİR
--
-- Kullanıcı kararı: *"Her teklif aç dediğimde bu benzersiz bir kodla takip
-- edilebilsin. Teklif karşılaştırma sayfası şu anda karmaşık geliyor. Teklif
-- Aç Koduna göre satır satır gelsin. Her açtığım teklifi ayrı ayrı
-- değerlendirebileyim."*
--
-- Bugüne kadar teklif SATIR SATIR yaşıyordu: bir firmadan on beş kaleme fiyat
-- alındığında defterde on beş bağımsız satır oluyor ve "bu teklifi kim, ne
-- zaman, hangi kapsamda verdi" sorusunun cevabı hiçbir yerde durmuyordu.
-- Aynı firmadan iki hafta arayla alınmış iki teklif de tek bir sütuna
-- karışıyordu — oysa onlar iki AYRI tekliftir ve ayrı değerlendirilmelidir.
--
-- PARTİ BİR FİRMANIN BİR TEKLİFİDİR: tedarikçi + tarih + kod, altında kalem
-- kalem birim fiyatlar. `TK0001` firmaya değil TEKLİFE verilir ve bir daha
-- değişmez; sipariş numarasının tedarikçi kodundan türemesiyle (md. 21) aynı
-- ruhta, ama bu kod bir SAYAÇTAN gelir çünkü tekliflerin sırası firmadan
-- bağımsızdır.
--
-- SATIR HÂLÂ KENDİ BAŞINA AYAKTADIR: `purchase_quotes.batch_id` NULL
-- OLABİLİR ve `on delete set null` taşır. Parti bir KAPSAM künyesidir, bir
-- kimlik değil — fiyat arşivi partiyi hiç bilmeden çalışmaya devam eder.
--
-- ═══════════════════════════════════════════ 2. PARÇANIN ÖLÇÜSÜ DÜZELTİLEBİLİR
--
-- Kullanıcı kararı: *"Hammadde havuzuna düşen kalemlerin en boy uzunluk
-- ölçülerini düzenleyebilmek istiyorum. Bazen yanlışlık yapılmış olabilir
-- projede veya son anda değişiklik istenebilir."*
--
-- SAKLANAN ŞEY SAYI DEĞİL TANIMDIR (`lib/purchasing/hammadde/olcu-duzelt.ts`):
-- bu modülde ölçünün tek kaynağı tanım metnidir ve sayıyı ayrıca saklamak
-- ikinci bir gerçek üretirdi. Ayrıca kullanıcı açıkça *"hem parça ismi
-- değişsin"* dedi — düzeltme zaten adın kendisidir.

-- ═══════════════════════════════════════════════ TEKLİF PARTİSİ

create sequence if not exists public.purchase_quote_code_seq;

create table if not exists public.purchase_quote_batches (
  id uuid primary key default gen_random_uuid(),

  -- KOD SIRA SAYACINDAN GELİR, `max()+1`DEN DEĞİL (md. 21'in tedarikçi kodu
  -- dersi): iki satınalmacı aynı dakikada teklif açarsa `max()+1` ikisine de
  -- aynı numarayı verirdi. Sayaç bir BOŞLUK bırakabilir ve bu kabul edilmiştir
  -- — kod bir sıra numarası değil bir KİMLİKtir.
  code text not null default ('TK' || lpad(nextval('public.purchase_quote_code_seq')::text, 4, '0')),

  -- Teklifi VEREN firma. Ad metindir (md. 21): defter düzeltilince alınmış
  -- teklif değişmemeli.
  supplier text not null,
  quoted_at date not null default current_date,

  -- HANGİ EKRANDAN AÇILDI. Hammadde ve ekipman havuzları aynı `match_key`
  -- uzayını paylaşır ama teklif listeleri ayrı okunur; kapsam olmadan her iki
  -- ekran ötekinin partilerini de sayardı.
  scope text not null default 'hammadde',

  title text not null default '',
  note text not null default '',

  -- İPTAL SİLME DEĞİLDİR (siparişteki kuralın aynısı): iptal edilmiş teklif
  -- karşılaştırmaya girmez ama defterde durur ve geri alınabilir.
  status text not null default 'acik',
  cancelled_at timestamptz,
  cancel_reason text not null default '',

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_quote_batches_status_check check (status in ('acik', 'iptal')),
  constraint purchase_quote_batches_supplier_check check (btrim(supplier) <> '')
);

create unique index if not exists purchase_quote_batches_code_idx
  on public.purchase_quote_batches (code);
create index if not exists purchase_quote_batches_supplier_idx
  on public.purchase_quote_batches (supplier);
create index if not exists purchase_quote_batches_date_idx
  on public.purchase_quote_batches (quoted_at desc);

comment on table public.purchase_quote_batches is
  'BİR FİRMANIN BİR TEKLİFİ. Kod (TK0001) teklife verilir; karşılaştırma '
  'sayfası satırları bu koda göre ayırır. İptal silme değildir.';

alter table public.purchase_quotes
  add column if not exists batch_id uuid
    references public.purchase_quote_batches (id) on delete set null;

create index if not exists purchase_quotes_batch_idx
  on public.purchase_quotes (batch_id);

-- ————————————————————————————— DEVRALINAN TEKLİFLERE PARTİ
--
-- Var olan satırlar kodsuz kalsaydı karşılaştırma sayfası onları hiç
-- gösteremezdi. Gruplama (TEDARİKÇİ, TEKLİF TARİHİ) ikilisidir: aynı gün aynı
-- firmadan girilen fiyatlar gerçekten TEK bir teklifti.
with gruplar as (
  select supplier, quoted_at
  from public.purchase_quotes
  where batch_id is null
  group by supplier, quoted_at
  order by quoted_at, supplier
), yeni as (
  insert into public.purchase_quote_batches (supplier, quoted_at, note)
  select supplier, quoted_at, 'Parti kodu sonradan verildi (devralınan teklif).'
  from gruplar
  returning id, supplier, quoted_at
)
update public.purchase_quotes q
set batch_id = y.id
from yeni y
where q.batch_id is null and q.supplier = y.supplier and q.quoted_at = y.quoted_at;

-- ═══════════════════════════════════════════════ PARÇA ÖLÇÜSÜ DÜZELTMESİ

create table if not exists public.purchase_raw_part_dims (
  -- `parcaOlcuAnahtari(itemNo, partCode)` — METİNDİR ve bu bilinçli:
  -- `drawing_parts` her eşleştirmede silinip yeniden kurulur, satır kimliğine
  -- bağlanan bir düzeltme ilk yeni yüklemede yetim kalırdı
  -- (`drawing_part_progress` ile aynı ders).
  part_key text primary key,

  /* Ressamın yazdığı HAM tanım — kanıt olarak durur, ekran ikisini yan yana
     gösterir ("değiştirildi" rozetinin altındaki eski ad). */
  sample text not null default '',

  /* Ölçüsü düzeltilmiş YENİ tanım. Çözücü bunu okur; ad, stok kalemi, ağırlık
     ve plaka yerleşimi kendiliğinden uyar. */
  label_override text not null,

  note text not null default '',

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_raw_part_dims_label_check check (btrim(label_override) <> '')
);

comment on table public.purchase_raw_part_dims is
  'Hammadde havuzundaki KESİM PARÇASININ ölçü düzeltmesi. Sayı değil TANIM '
  'saklanır: ölçünün tek kaynağı tanım metnidir ve kullanıcı "parça ismi de '
  'değişsin" dedi.';

-- ═══════════════════════════════════════════════ updated_at

do $$
declare t text;
begin
  foreach t in array array['purchase_quote_batches', 'purchase_raw_part_dims'] loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format(
      'create trigger touch_%I before update on public.%I '
      'for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════ RLS
--
-- `purchase_*` KALIBI: teklif ticari bir veridir, "authenticated okur" DEĞİL.

alter table public.purchase_quote_batches enable row level security;
alter table public.purchase_raw_part_dims enable row level security;

do $$
declare t text;
begin
  foreach t in array array['purchase_quote_batches', 'purchase_raw_part_dims'] loop
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

-- Faz V7/3 — TEKNİK RESİMLER İÇİN SATIN ALMA ÖZETİ (salt okunur pencere).
--
-- ═══════════════════════════════════════════ NEDEN AYRI BİR PENCERE GEREKTİ
--
-- Kullanıcı kararı (12.08.2026): *"Mühendis ya da ressam bu ekipman satın
-- alınmış mı diye bakabilsin ve teslim süresini görebilsin. Fiyat ve kimden
-- alındığı gibi bilgilere gerek yok. Satın Alma modülünü mühendis ve ressama
-- açmayacağım."*
--
-- İhtiyaç gerçek ve dar: **"geldi mi, ne zaman gelir"**. Bu soruyu bugün
-- yalnız `purchase_orders` cevaplayabiliyor ve o tablonun okuması
-- `can_see_purchasing()`e kapalı — haklı olarak: tedarikçi adı, birim fiyat,
-- kur ve ödeme vadesi taşıyor.
--
-- ÜÇ YOL VARDI, İKİSİ YANLIŞTI:
--   (a) RLS'i gevşetmek — fiyatı ve tedarikçiyi herkese açardı. Modülün var
--       oluş sebebine aykırı.
--   (b) `security_invoker = true` bir görünüm — alt tablonun RLS'i geçerli
--       kalır, yani mühendis yine hiçbir şey göremezdi. (Evin kuralı da
--       budur: `purchase_order_totals` bilinçle invoker'dır ve definer olsaydı
--       "bir yetki deliği" olurdu.)
--   (c) SEÇİLMİŞ SÜTUNLARI DÖNEN, `security definer` BİR FONKSİYON — burada
--       yapılan. Fark şudur: geçirilen şey TABLO DEĞİL, adı tek tek yazılmış
--       BİR PROJEKSİYONDUR. Güvenlik sınırı aşağıdaki `returns table`
--       listesinin KENDİSİDİR ve o listede para ya da tedarikçi geçmez.
--
-- **LİSTEYE TİCARİ SÜTUN EKLENMEZ.** `unit_price`, `supplier`, `currency`,
-- `fx_rate`, `payment_*`, `advance_*` ve toplam tutar bu fonksiyondan ASLA
-- dönmez; eklendiği gün mühendis ekranı bir fiyat listesine dönüşür. Kural
-- bir yorum değil, migration dosyasını OKUYAN bir koruma testine bağlıdır
-- (`lib/drawings/__tests__/purchase-summary.test.ts` — `terms.test.ts`
-- deseninin aynısı).
--
-- ══════════════════════════════════════════════════════════ KİM ÇAĞIRABİLİR
--
-- Teknik resim okuması RLS'te bütün oturumlara açıktır ("Fiyat değil,
-- resimdir" — 20260810000001). Bu fonksiyon o kapının aynısını kullanır:
-- `authenticated` çağırır, `anon` ÇAĞIRAMAZ. `security definer` fonksiyonlarda
-- EXECUTE varsayılan olarak PUBLIC'tedir; o yüzden ÖNCE geri alınır.

create or replace function public.drawing_purchase_summary(p_package_id uuid)
returns table (
  -- Talep havuzundaki satırla bağ (`progressKeyOf`); ekran satırı bununla bulur.
  part_key text,
  -- Katlanmış standart tanım — `part_key` boş kalmış eski satırların yedeği.
  match_key text,
  -- Sipariş edilen ve teslim alınan ADET. Adet ticari bir bilgi değildir:
  -- atölyenin "60'ı geldi, 40'ı yolda" sorusunun cevabı budur.
  ordered_qty numeric,
  received_qty numeric,
  -- İlk sipariş günü; "ne zaman ısmarlandı" sorusu.
  first_ordered_at date,
  -- EN YAKIN AÇIK TERMİN. Teslim alınmış siparişler dışarıda: kapanmış bir
  -- siparişin termini bir bekleyiş değil bir geçmiştir.
  next_due_at date,
  -- Son teslim günü (olgu). `next_due_at` tahmindir, bu ölçümdür.
  last_received_at date,
  -- Kaç sipariş ve kaçı hâlâ açık. "2 siparişten 1'i geldi" ancak böyle yazılır.
  order_count integer,
  open_order_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.part_key,
    l.match_key,
    coalesce(sum(l.qty), 0)                                   as ordered_qty,
    coalesce(sum(l.received_qty), 0)                          as received_qty,
    min(o.ordered_at)                                         as first_ordered_at,
    min(o.due_at) filter (where o.received_at is null)         as next_due_at,
    max(o.received_at)                                        as last_received_at,
    count(distinct o.id)::int                                 as order_count,
    count(distinct o.id) filter (where o.received_at is null)::int as open_order_count
  from public.purchase_order_lines l
  join public.purchase_orders o on o.id = l.order_id
  where l.package_id = p_package_id
    -- İPTAL EDİLEN SİPARİŞ BİR TAAHHÜT DEĞİLDİR. Teslim ve ödeme
    -- takvimlerinden düştüğü gibi bu özetten de düşer; aksi hâlde ressam
    -- iptal edilmiş bir siparişe bakıp malzemeyi bekler.
    and o.cancelled_at is null
  group by l.part_key, l.match_key
$$;

comment on function public.drawing_purchase_summary(uuid) is
  'Teknik Resimler ekranının SALT OKUNUR satın alma özeti: adet, sipariş günü, '
  'termin ve teslim. Fiyat, tedarikçi, kur ve ödeme koşulu DÖNMEZ — güvenlik '
  'sınırı bu fonksiyonun sütun listesidir.';

revoke execute on function public.drawing_purchase_summary(uuid) from public;
revoke execute on function public.drawing_purchase_summary(uuid) from anon;
grant execute on function public.drawing_purchase_summary(uuid) to authenticated;

-- Paket başına sorgu bu indeksi ister; `package_id` bugüne kadar yalnız
-- `on delete set null` için vardı ve indekssizdi.
create index if not exists purchase_order_lines_package_idx
  on public.purchase_order_lines (package_id) where package_id is not null;

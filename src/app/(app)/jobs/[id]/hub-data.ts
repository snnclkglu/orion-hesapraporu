// BAĞLANTILAR sekmesinin okuma katmanı — işin öteki modüllerdeki izleri.
//
// YETKİ İKİ KEZ SORULUR (panel kuralı): RLS zaten keser ama kesilmiş sorgu
// BOŞ döner ve ekranda "0 kayıt" gibi görünürdü — yokluk iyi haber sanılır.
// Rolün görmediği bölümün değeri `null`dur ve sayfa onu HİÇ ÇİZMEZ.
//
// Sayımlar `head: true` COUNT ile alınır (panel `say` kalıbı) ve okunamayan
// tablo 0 döner, sayfayı düşürmez.

import type { SupabaseClient } from "@supabase/supabase-js";
import { canSeePurchasing, canSeeSales, canSeeWorkLog } from "@/lib/roles";

export interface JobItemRef {
  id: string;
  item_no: string;
  product_name: string;
}

export interface JobSaleDates {
  itemNo: string;
  productName: string;
  dueDate: string | null;
  shipmentDate: string | null;
}

export interface JobBaglari {
  /** Bu işe bağlanmış teknik resim paketi sayısı. */
  drawings: number;
  /** null = rol İş Takibi'ni görmüyor — 0 olarak çizilmez. */
  worklog: number | null;
  /** null = rol Satın Alma'yı görmüyor. */
  purchasing: number | null;
  /** null = rol Satış'ı görmüyor; dizi = kalem başına termin/sevk. */
  sales: JobSaleDates[] | null;
}

async function guvenliSay(
  q: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  const { count, error } = await q;
  return error ? 0 : (count ?? 0);
}

export async function loadJobBaglari(
  supabase: SupabaseClient,
  opts: { jobId: string; role: string | null | undefined; items: JobItemRef[] }
): Promise<JobBaglari> {
  const itemNos = opts.items.map((i) => i.item_no).filter(Boolean);
  const itemIds = opts.items.map((i) => i.id);

  const drawingsP = guvenliSay(
    supabase
      .from("drawing_packages")
      .select("*", { count: "exact", head: true })
      .eq("job_id", opts.jobId)
  );

  const worklogP: Promise<number | null> = canSeeWorkLog(opts.role)
    ? guvenliSay(
        supabase
          .from("work_logs")
          .select("*", { count: "exact", head: true })
          .eq("job_id", opts.jobId)
      )
    : Promise.resolve(null);

  // Sipariş satırı kalem NUMARASIYLA eşleşir (WORKLOG-17 / SATIN-21: numara METİN,
  // bağlantı TÜREV). Kalem numarası taşımayan satırlar (ör. plaka siparişi)
  // bu sayıya girmez — sayfa bunu dipnotla SÖYLER, sessiz bırakmaz.
  const purchasingP: Promise<number | null> = canSeePurchasing(opts.role)
    ? itemNos.length > 0
      ? guvenliSay(
          supabase
            .from("purchase_order_lines")
            .select("*", { count: "exact", head: true })
            .in("item_no", itemNos)
        )
      : Promise.resolve(0)
    : Promise.resolve(null);

  // supabase-js `.then` zinciri Promise değil PromiseLike döner; `await` için
  // fark etmez, tip bunu söylemek zorunda.
  const salesP: PromiseLike<JobSaleDates[] | null> = canSeeSales(opts.role)
    ? itemIds.length > 0
      ? supabase
          .from("job_item_sales")
          .select("job_item_id, due_date, shipment_date")
          .in("job_item_id", itemIds)
          .then((r) => {
            const rows = r.error ? [] : (r.data ?? []);
            const byId = new Map(
              rows.map((s) => [
                String((s as { job_item_id: string }).job_item_id),
                s as { due_date: string | null; shipment_date: string | null },
              ])
            );
            // Kaydı HİÇ OLMAYAN kalem de bir cevaptır (satırlar önceden
            // üretilmez, SATIS-16): listede boş tarihlerle görünür.
            return opts.items.map((it) => {
              const s = byId.get(it.id);
              return {
                itemNo: it.item_no,
                productName: it.product_name,
                dueDate: s?.due_date ?? null,
                shipmentDate: s?.shipment_date ?? null,
              };
            });
          })
      : Promise.resolve([])
    : Promise.resolve(null);

  const [drawings, worklog, purchasing, sales] = await Promise.all([
    drawingsP,
    worklogP,
    purchasingP,
    salesP,
  ]);

  return { drawings, worklog, purchasing, sales };
}

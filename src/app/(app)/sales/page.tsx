// Satış Takibi — iş kalemi başına fiyat, termin/sevk ve ciro.
//
// Liste İŞ KALEMİNDEN çıkar, ticari kayıttan değil: iş emrinde açılan her kalem
// burada kendiliğinden görünür (fiyatı boş). Böylece "fiyatı girilmemiş iş"
// listeden düşmez, aksine göze batar.
//
// Sorgu ve eşleme `data.ts`tedir: aynı satırları müşteriye giden İş Listesi
// PDF'i de okur ve iki liste ayrışamaz.

import { createClient } from "@/lib/supabase/server";
import { SalesTable } from "./sales-table";
import { saleYear } from "./schema";
import { JobListButton } from "./job-list-button";
import { loadSaleRows } from "./data";
import { PageHeader } from "@/components/page-header";

// Yetki + bölüm rayı `sales/layout.tsx`tedir; bu sayfa yalnız Satış Takibi
// tablosunu basar.
export default async function SalesPage() {
  const supabase = await createClient();

  const rows = await loadSaleRows(supabase);
  // Yıl listesi TABLONUN süzgeciyle aynı kaynaktan çıkar (`saleYear`), yeniden
  // en yeniye sıralanır — açılır listede önce bu yıl görünür.
  const years = [...new Set(rows.map(saleYear).filter(Boolean))].sort((a, b) =>
    b.localeCompare(a)
  );

  return (
    <div className="grid gap-4">
      {/* Yetki rozeti şeridin EYLEM yuvasında DEĞİL sayfanın içindedir.
          Rozet bir eylem değil bir künyedir, yeri de içeriktir. Eylem
          yuvasında yalnız gerçek eylem durur — burada İş Listesi indirmesi. */}
      <PageHeader
        title="Satış Takibi"
        hint="İş kalemi başına fiyat, termin ve sevk takibi — ciro avro karşılığıyla toplanır"
      >
        <JobListButton years={years} />
      </PageHeader>
      <span className="w-fit border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
        Yönetici · Müdür
      </span>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
          <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
            [ HENÜZ İŞ KALEMİ YOK ]
          </h2>
          <p className="max-w-sm text-sm text-foreground/70">
            Satış satırları iş emirlerinden gelir. İşler bölümünde bir iş emri
            açtığınızda kalemleri burada kendiliğinden listelenir.
          </p>
        </div>
      ) : (
        <SalesTable rows={rows} />
      )}
    </div>
  );
}

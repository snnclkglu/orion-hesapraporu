// Kayıtlar — tek tek satırların listesi, düzenlemesi ve dışa aktarımı.
//
// Analiz "ne oldu"yu, bu ekran "hangi satır"ı gösterir. Bir sayı yanlış
// göründüğünde gidilecek yer burasıdır: satır bulunur, açılır, düzeltilir.

import { createClient } from "@/lib/supabase/server";
import { loadCategories, loadJobOptions, loadParts, loadWorkLogs } from "../data";
import { RecordsTable } from "./records-table";

export default async function WorkLogRecordsPage() {
  const supabase = await createClient();
  const [rows, parts, categories, jobs] = await Promise.all([
    loadWorkLogs(supabase),
    loadParts(supabase),
    loadCategories(supabase),
    loadJobOptions(supabase),
  ]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ HENÜZ KAYIT YOK ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Günlük Giriş ekranından ilk çizelgeyi yazdığınızda satırlar burada listelenir.
        </p>
      </div>
    );
  }

  return <RecordsTable rows={rows} parts={parts} categories={categories} jobs={jobs} />;
}

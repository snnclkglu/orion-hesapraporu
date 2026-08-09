// Analiz — grafikler, kırılımlar, çapraz tablolar ve dönem karşılaştırması.
//
// Veri SUNUCUDA tek istekte (sayfalanarak) çekilir, süzme ve toplama
// İSTEMCİDE yapılır — liste ekranlarının deseni. Gerekçe burada daha da
// güçlüdür: kullanıcı bir panoda süzgeci saniyede bir değiştirir ve her
// değişimde sunucuya gitmek paneli kullanılamaz yapardı. Kayıt sayısı binlerle
// ölçülür; tarayıcı bu boyutta bir toplamı bir karede yapar.

import { createClient } from "@/lib/supabase/server";
import { loadDateBounds, loadWorkLogs } from "../data";
import { AnalysisView } from "./analysis-view";

export default async function WorkLogAnalysisPage() {
  const supabase = await createClient();
  const [rows, bounds] = await Promise.all([loadWorkLogs(supabase), loadDateBounds(supabase)]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ HENÜZ KAYIT YOK ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Günlük Giriş ekranından ilk çizelgeyi yazdığınızda analiz burada
          kendiliğinden oluşur.
        </p>
      </div>
    );
  }

  return <AnalysisView rows={rows} bounds={bounds} />;
}

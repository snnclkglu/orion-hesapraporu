// Yalnız development: Teknik Araçlar çalışma yüzlerini auth olmadan görsel
// doğrulamak için. Üretimde 404 döner.

import { notFound } from "next/navigation";
import { WeightCalculator } from "@/app/(app)/tools/agirlik/weight-calculator";
import { KeywayTool } from "@/app/(app)/tools/kama/keyway-tool";
import { ToleranceTool } from "@/app/(app)/tools/tolerans/tolerance-tool";

export default function ToolsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid min-h-dvh max-w-[96rem] gap-12 overflow-x-clip bg-background p-3 text-foreground sm:p-6">
      <header className="border-b pb-4"><p className="oc-kicker text-muted-foreground">Görsel önizleme</p><h1 className="text-2xl font-semibold">Teknik Araçlar</h1></header>
      <WeightCalculator />
      <KeywayTool />
      <ToleranceTool />
    </main>
  );
}

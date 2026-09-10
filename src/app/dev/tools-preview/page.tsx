// Yalnız development: Teknik Araçlar çalışma yüzlerini auth olmadan görsel
// doğrulamak için. Üretimde 404 döner.

import { notFound } from "next/navigation";
import Link from "next/link";
import { WeightCalculator } from "@/app/(app)/tools/agirlik/weight-calculator";
import { KeywayTool } from "@/app/(app)/tools/kama/keyway-tool";
import { ToleranceTool } from "@/app/(app)/tools/tolerans/tolerance-tool";
import { RailsTool } from "@/app/(app)/tools/raylar/rails-tool";
import { BoltTool } from "@/app/(app)/tools/civata/bolt-tool";
import { CirclipTool } from "@/app/(app)/tools/segman/circlip-tool";
import { AxleHolderTool } from "@/app/(app)/tools/aks-tutucu/axle-holder-tool";

export default function ToolsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid min-h-dvh max-w-[96rem] gap-12 overflow-x-clip bg-background p-3 text-foreground sm:p-6">
      <header className="border-b pb-4"><p className="oc-kicker text-muted-foreground">Görsel önizleme</p><h1 className="text-2xl font-semibold">Teknik Araçlar</h1><Link href="/dev/tools-preview/catalogs" className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline">Katalog ve emniyet sayfalarını aç</Link></header>
      <WeightCalculator />
      <KeywayTool />
      <ToleranceTool />
      <RailsTool />
      <BoltTool />
      <CirclipTool />
      <AxleHolderTool />
    </main>
  );
}

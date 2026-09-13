import Link from "next/link";
import { notFound } from "next/navigation";
import { DrawingPlanCard } from "@/app/(app)/projects/[id]/drawing-plan-card";
import {
  NEW_WORK_TEMPLATE,
  NEW_WORK_DISABLED_MODULES,
} from "@/lib/calc/defaults";
import {
  calcInputFromRevision,
  type RevisionInputsJson,
} from "@/lib/revision-load";
import { deriveDrawingPlan } from "@/lib/drawing-plan/derive";
import { reconcileDrawingPlan } from "@/lib/drawing-plan/reconcile";
import { emptyDrawingPlanState } from "@/lib/drawing-plan/types";

export default async function DrawingPlanPreview({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const scenario = (await searchParams).scenario ?? "separate";
  const raw = {
    specs: {
      ...NEW_WORK_TEMPLATE.specs,
      auxTrolleyMode: scenario === "shared" ? "shared" : "separate",
      travelArrangement: scenario === "fixed" ? "fixed" : "traveling",
      hasOperatorCabin: "yes",
      electricalAccommodationType: "room",
      electricalRoomHasAirConditioner: "yes",
      trolleyPowerSupply: "festoon",
    },
    disabledModules: NEW_WORK_DISABLED_MODULES.filter(
      (k) => k !== "aux" && k !== "auxTrolley" && k !== "auxHook",
    ),
  } as RevisionInputsJson;
  const derivation = deriveDrawingPlan(calcInputFromRevision(raw, null), raw);
  let serial = 0;
  const rows =
    scenario === "empty"
      ? []
      : reconcileDrawingPlan([], derivation.candidates, undefined, {
          id: () =>
            `dade3000-0000-4000-8000-${String(++serial).padStart(12, "0")}`,
        }).rows;
  if (scenario === "legacy")
    rows.forEach((r) => {
      r.sourceKey = null;
      r.origin = "legacy";
    });
  if (scenario === "one") rows.splice(1);
  const target = scenario === "large" ? 120 : scenario === "medium" ? 25 : 0;
  while (rows.length < target) {
    const index = rows.length;
    rows.push({ id: `dade3000-0000-4000-8000-${String(++serial).padStart(12, "0")}`, code: String(5000 + index * 10), name: `TEST GRUBU ${index} · KALDIRMA MEKANİZMASI BAKIM PLATFORMU VE KORKULUK BAĞLANTI DETAYLARI`, status: "bekliyor", drawnBy: null, drawnByName: "", note: "", parentId: rows.find(r => r.sourceKey === "trolley:assembly")?.id, sortOrder: index + 100, origin: "manual", overrides: ["code"] });
  }
  const state = emptyDrawingPlanState();
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-2 sm:p-6">
      <h1 className="text-xl font-semibold">
        Hesaptan teknik resim · geliştirme önizlemesi
      </h1>
      <p className="text-sm text-muted-foreground">
        Örnek hesap verileri. Buradaki kayıt düğmesi yalnız yerel taslağı
        değiştirir.
      </p>
      <nav className="flex flex-wrap gap-3">
        {[
          ["separate", "İki ayrı araba"],
          ["shared", "Ortak araba"],
          ["fixed", "Sabit kaldırma"],
          ["legacy", "Mevcut manuel plan"],
          ["empty", "Boş plan"],
          ["one", "1 grup"],
          ["medium", "25 grup"],
          ["large", "120 grup"],
        ].map(([key, name]) => (
          <Link
            className="min-h-11 rounded border px-3 py-2 text-sm"
            key={key}
            href={`?scenario=${key}`}
          >
            {name}
          </Link>
        ))}
      </nav>
      <DrawingPlanCard
        key={scenario}
        projectId="dev"
        itemNo="0045-00"
        initialRows={rows}
        authors={[]}
        canEdit
        previewDerivation={derivation}
        previewDocument={{ rows, state }}
      />
    </main>
  );
}

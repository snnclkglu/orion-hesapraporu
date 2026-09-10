import { notFound } from "next/navigation";
import { RevisionEditor } from "@/app/(app)/projects/[id]/revisions/[revId]/revision-editor";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import pilotCatalog from "@/lib/auto-selection/fixtures/catalog-design-pilot.json";
import type { EquipmentRow } from "@/lib/auto-selection/types";
import largeFixture from "@/lib/auto-selection/fixtures/crane-100t-50m.json";
import largeCatalog from "@/lib/auto-selection/fixtures/catalog-100t-50m.json";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { moduleState } from "@/lib/calc/presentation/module-access";
import type { ModulesState } from "@/lib/calc/state";
import type { TechnicalSpecs } from "@/lib/calc/types";
import { selectionCalcInput } from "@/lib/auto-selection/solver";

export default async function AutoSelectionPreview({ searchParams }: { searchParams: Promise<{ readonly?: string; context?: string; case?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const large = params.case === "100t";
  const modules = { ...Object.fromEntries(MODULE_ORDER.map(key => [key, moduleState(NEW_WORK_TEMPLATE, key) ?? { inputs: {}, selections: {} }])), ...largeFixture.modules } as ModulesState;
  const initial = large ? selectionCalcInput({ specs: largeFixture.specs as TechnicalSpecs, active: [...MODULE_ORDER] }, modules) : { ...NEW_WORK_TEMPLATE, specs: { ...NEW_WORK_TEMPLATE.specs, hoistBrakeType: "Eldro Fren" } };
  return <main className="flex h-dvh min-h-0 flex-col gap-3 p-3">
    <p className="shrink-0 text-sm text-muted-foreground">Hızlı seçim önizleme · {params.context === "offer" ? "Teklif" : "Mühendislik"} · kayıt yapılmaz</p>
    <div className="min-h-0 flex-1"><RevisionEditor projectId="dev" revisionId="dev" readOnly={params.readonly === "1"} initial={initial}
      initialDisabled={large ? MODULE_ORDER.filter(key => !largeFixture.active.includes(key)) : [...NEW_WORK_DISABLED_MODULES]} previewCatalog={(large ? largeCatalog : pilotCatalog) as EquipmentRow[]} /></div>
  </main>;
}

import { notFound } from "next/navigation";
import { RevisionEditor } from "@/app/(app)/projects/[id]/revisions/[revId]/revision-editor";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import pilotCatalog from "@/lib/auto-selection/fixtures/catalog-pilot.json";
import type { EquipmentRow } from "@/lib/auto-selection/types";

export default async function AutoSelectionPreview({ searchParams }: { searchParams: Promise<{ readonly?: string; context?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  return <main className="flex h-dvh min-h-0 flex-col gap-3 p-3">
    <p className="shrink-0 text-sm text-muted-foreground">Hızlı seçim önizleme · {params.context === "offer" ? "Teklif" : "Mühendislik"} · kayıt yapılmaz</p>
    <div className="min-h-0 flex-1"><RevisionEditor projectId="dev" revisionId="dev" readOnly={params.readonly === "1"} initial={NEW_WORK_TEMPLATE}
      initialDisabled={[...NEW_WORK_DISABLED_MODULES]} previewCatalog={pilotCatalog as EquipmentRow[]} /></div>
  </main>;
}

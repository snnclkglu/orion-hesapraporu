// Ekipman listesi paneli — doğrudan indirme yerine tablo görünümü. Otomatik
// (hesap snapshot'ından) satırlar + panelden eklenen ek satırlar birlikte
// görüntülenir/düzenlenir; buradan Excel veya PDF indirilir.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  calcInputFromRevision, type RevisionInputsJson, type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { runCalc } from "@/lib/calc/engine";
import {
  buildEquipmentGroups, buildSummarySections, dsKey,
  type EquipmentExtraRow,
} from "@/lib/excel/equipment";
import { EquipmentPanel } from "./equipment-panel";

export default async function EquipmentPage({
  params,
}: {
  params: Promise<{ id: string; revId: string }>;
}) {
  const { id, revId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, rev_no, label, status, inputs, selections")
    .eq("id", revId)
    .eq("project_id", id)
    .single();
  if (!revision) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("doc_no, name, customer")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const calcInput = calcInputFromRevision(
    revision.inputs as RevisionInputsJson | null,
    revision.selections as RevisionSelectionsJson | null
  );
  const calcResult = runCalc(calcInput);

  const autoGroups = buildEquipmentGroups(calcInput);
  const summary = buildSummarySections(calcInput, calcResult);

  let extras: EquipmentExtraRow[] = [];
  const { data: extrasRow } = await supabase
    .from("equipment_extras")
    .select("rows")
    .eq("revision_id", revId)
    .maybeSingle();
  if (extrasRow?.rows && Array.isArray(extrasRow.rows)) {
    extras = extrasRow.rows as EquipmentExtraRow[];
  }

  const datasheetUrls: Record<string, string> = {};
  const { data: catRows } = await supabase
    .from("cat_equipment")
    .select("kind, brand, model, datasheet_url")
    .eq("active", true)
    .neq("datasheet_url", "");
  for (const r of (catRows ?? []) as {
    kind: string; brand: string; model: string; datasheet_url: string;
  }[]) {
    if (r.datasheet_url) datasheetUrls[dsKey(r.kind, r.brand, r.model)] = r.datasheet_url;
  }

  return (
    <div className="mx-auto w-full px-4 py-6 lg:px-8">
      <div className="mb-4">
        <Link
          href={`/projects/${id}/revisions/${revId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Revizyona dön
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          Ekipman Listesi{" "}
          <span className="font-mono text-base text-muted-foreground">
            {project.doc_no} · V{revision.rev_no}
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {project.name} — {project.customer}
        </p>
      </div>

      <EquipmentPanel
        projectId={id}
        revisionId={revId}
        autoGroups={autoGroups}
        summary={summary}
        initialExtras={extras}
        datasheetUrls={datasheetUrls}
        locked={revision.status === "issued"}
      />
    </div>
  );
}

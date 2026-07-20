// Ekipman listesi indirme ucu — panelden çağrılır.
//   format=xlsx (varsayılan) → exceljs workbook (Node Buffer → nodejs runtime)
//   format=pdf               → react-pdf ekipman listesi
//   scope=customer           → yalnız ekipman listesi (müşteri); aksi hâlde + teknik özet
// Panelden eklenen ek satırlar (equipment_extras) çıktıya katılır.

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcInputFromRevision, type RevisionInputsJson, type RevisionSelectionsJson } from "@/lib/revision-load";
import { runCalc } from "@/lib/calc/engine";
import {
  buildEquipmentWorkbook, buildEquipmentGroups, buildSummarySections, mergeExtras, dsKey,
  type EquipmentExtraRow,
} from "@/lib/excel/equipment";
import { renderEquipmentPdf } from "@/lib/pdf/equipment-report";
import { getReportSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await params;
  const sp = request.nextUrl.searchParams;
  const format = sp.get("format") === "pdf" ? "pdf" : "xlsx";
  const scope = sp.get("scope") === "customer" ? "customer" : "full";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, rev_no, label, status, inputs, selections")
    .eq("id", revId)
    .eq("project_id", id)
    .single();
  if (!revision) return new Response("Revizyon bulunamadı", { status: 404 });

  const { data: project } = await supabase
    .from("projects")
    .select("doc_no, name, customer")
    .eq("id", id)
    .single();
  if (!project) return new Response("Proje bulunamadı", { status: 404 });

  const calcInput = calcInputFromRevision(
    revision.inputs as RevisionInputsJson | null,
    revision.selections as RevisionSelectionsJson | null
  );
  const calcResult = runCalc(calcInput);
  const settings = await getReportSettings(supabase);

  // Ek satırlar (equipment_extras) — tablo yoksa/boşsa sessizce atlanır
  let extras: EquipmentExtraRow[] = [];
  const { data: extrasRow } = await supabase
    .from("equipment_extras")
    .select("rows")
    .eq("revision_id", revId)
    .maybeSingle();
  if (extrasRow?.rows && Array.isArray(extrasRow.rows)) {
    extras = extrasRow.rows as EquipmentExtraRow[];
  }

  // Katalog datasheet linkleri
  const datasheetUrls = new Map<string, string>();
  const { data: catRows } = await supabase
    .from("cat_equipment")
    .select("kind, brand, model, datasheet_url")
    .eq("active", true)
    .neq("datasheet_url", "");
  for (const r of (catRows ?? []) as {
    kind: string; brand: string; model: string; datasheet_url: string;
  }[]) {
    if (r.datasheet_url) datasheetUrls.set(dsKey(r.kind, r.brand, r.model), r.datasheet_url);
  }

  const meta = {
    docNo: project.doc_no ?? "",
    projectName: project.name ?? "",
    customer: project.customer ?? "",
    revLabel: revision.label ?? "",
    revNo: revision.rev_no,
    date: new Date().toLocaleDateString("tr-TR"),
  };

  const baseName = `${project.doc_no || "rapor"}-V${revision.rev_no}-${
    scope === "customer" ? "ekipman-listesi" : "ekipman"
  }`;

  let raw: Buffer | ArrayBuffer;
  let contentType: string;
  let ext: string;

  if (format === "pdf") {
    const groups = mergeExtras(buildEquipmentGroups(calcInput), extras);
    const summary = scope === "customer" ? undefined : buildSummarySections(calcInput, calcResult);
    raw = await renderEquipmentPdf({ meta, groups, summary, settings, datasheetUrls });
    contentType = "application/pdf";
    ext = "pdf";
  } else {
    const workbook = buildEquipmentWorkbook(calcInput, calcResult, meta, { datasheetUrls, scope, extras });
    raw = await workbook.xlsx.writeBuffer();
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  }

  const body = new Uint8Array(raw as ArrayBuffer);
  const filename = `${baseName}.${ext}`;
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encodedFilename = encodeURIComponent(filename);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
}

// Ekipman listesi Excel indirme ucu — revizyon snapshot'ından iki sayfalık
// .xlsx üretir (bkz. src/lib/excel/equipment.ts). exceljs Node Buffer ürettiği
// için nodejs runtime zorunludur.

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcInputFromRevision, type RevisionInputsJson, type RevisionSelectionsJson } from "@/lib/revision-load";
import { runCalc } from "@/lib/calc/engine";
import { buildEquipmentWorkbook } from "@/lib/excel/equipment";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Oturum gerekli", { status: 401 });
  }

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, rev_no, label, status, inputs, selections")
    .eq("id", revId)
    .eq("project_id", id)
    .single();
  if (!revision) {
    return new Response("Revizyon bulunamadı", { status: 404 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("doc_no, name, customer")
    .eq("id", id)
    .single();
  if (!project) {
    return new Response("Proje bulunamadı", { status: 404 });
  }

  const calcInput = calcInputFromRevision(
    revision.inputs as RevisionInputsJson | null,
    revision.selections as RevisionSelectionsJson | null
  );
  const calcResult = runCalc(calcInput);

  const workbook = buildEquipmentWorkbook(calcInput, calcResult, {
    docNo: project.doc_no ?? "",
    projectName: project.name ?? "",
    customer: project.customer ?? "",
    revLabel: revision.label ?? "",
    revNo: revision.rev_no,
    date: new Date().toLocaleDateString("tr-TR"),
  });

  const buffer = await workbook.xlsx.writeBuffer();

  // Türkçe karakterli dosya adı: ASCII fallback + RFC 5987 filename* kodlaması
  const filename = `${project.doc_no || "rapor"}-V${revision.rev_no}-ekipman.xlsx`;
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encodedFilename = encodeURIComponent(filename);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
}

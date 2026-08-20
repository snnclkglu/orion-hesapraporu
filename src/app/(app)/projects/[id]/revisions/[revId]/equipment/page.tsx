// Ekipman listesi paneli — doğrudan indirme yerine tablo görünümü. Otomatik
// (hesap snapshot'ından) satırlar + panelden eklenen ek satırlar birlikte
// görüntülenir/düzenlenir; buradan Excel veya PDF indirilir.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  altsFromRevision,
  calcInputFromRevision, hiddenSectionsFromRevision,
  type RevisionInputsJson, type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { runCalc } from "@/lib/calc/engine";
import { loadDrawingNote } from "@/lib/equipment-drawing-note";
import {
  buildCatalogSheetUrls, buildEquipmentGroups, buildSummarySections, dsKey,
  type EquipmentExtraRow, type EquipmentNotes,
} from "@/lib/excel/equipment";
import { loadDrawingPlan, resolveProjectItemNo } from "@/lib/drawing-plan-data";
import {
  attachmentsByRowKey,
  loadEquipmentAttachments,
} from "@/lib/equipment-attachments";
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

  // "Ek Özellikler" notları — satırın kararlı row_key'i ile eşlenir (madde 34)
  const notes: EquipmentNotes = {};
  const { data: noteRows } = await supabase
    .from("equipment_notes")
    .select("row_key, note")
    .eq("revision_id", revId);
  for (const n of (noteRows ?? []) as { row_key: string; note: string }[]) {
    notes[n.row_key] = n.note;
  }

  // "Ek Belge" yüklemeleri — satırlara row_key ile bağlanır (notlarla aynı kimlik)
  const attachmentRows = await loadEquipmentAttachments(supabase, revId);

  const autoGroups = buildEquipmentGroups(
    calcInput,
    notes,
    // Seçenekli (alternatif) seçimler panelde de ana satırın altında görünür.
    altsFromRevision(revision.selections as RevisionSelectionsJson | null),
    attachmentsByRowKey(attachmentRows),
    // Gizlenen alt bölümün satırları panelde de görünmez (Excel/PDF ile aynı).
    hiddenSectionsFromRevision(revision.inputs as RevisionInputsJson | null)
  );
  // Teknik Resim Takibi defteri özetin SONUNA basılır. Ressamın mühendise
  // sorduğu son soru numaralandırmadır; cevabı çizim için hazırlanan bu
  // özetin dışında bırakmak, soruyu telefona geri taşırdı.
  const [drawingPlan, itemNo] = await Promise.all([
    loadDrawingPlan(supabase, id),
    resolveProjectItemNo(supabase, id, project.doc_no),
  ]);
  // Ressam notu ekranda da özetin altındadır ve İNDİRİLEN belgeyle AYNI
  // okuma katmanından gelir (`loadDrawingNote`).
  const drawingNote = await loadDrawingNote(supabase, revId);
  const summary = buildSummarySections(
    calcInput,
    calcResult,
    { itemNo, rows: drawingPlan },
    drawingNote
  );

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

  // Katalog sayfası bağlantıları — ekipman ADINA bağlanır. Uygulama içinde
  // göreli adres yeter; Excel/PDF çıktısı mutlak adresi indirme ucunda üretir.
  const sheetUrls = Object.fromEntries(buildCatalogSheetUrls(autoGroups));

  // Sayfa kendi iç boşluğunu VERMEZ: app-shell normal (çerçeve olmayan) kipte
  // `main`e zaten px/py uyguluyor. Sayfa ayrıca padding verirse boşluk ikiye
  // katlanır (madde 35 düzeltmesiyle bu sayfa normal kipe geçti).
  return (
    <div className="w-full">
      {/* Kimlik ve dönüş kabuğun yapışkan üst şeridine çıkar: ekipman tablosu
          uzundur ve aşağı kayan kullanıcı "Revizyona dön" bağlantısını
          kaybediyordu. */}
      <PageHeader
        backHref={`/projects/${id}/revisions/${revId}`}
        backLabel={`V${revision.rev_no}`}
        title="Ekipman Listesi"
        hint={`${project.doc_no} · V${revision.rev_no} · ${project.name}`}
      />
      <div className="mb-4">
        {/* `h2`: sayfanın `h1`i kabuğun üst şeridindedir (PageHeader). */}
        <h2 className="text-xl font-semibold tracking-tight">
          Ekipman Listesi{" "}
          <span className="font-mono text-base text-muted-foreground">
            {project.doc_no} · V{revision.rev_no}
          </span>
        </h2>
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
        initialAttachments={attachmentRows.map((a) => ({
          id: a.id,
          rowKey: a.rowKey,
          fileName: a.fileName,
          pageCount: a.pageCount,
        }))}
        initialDrawingNote={drawingNote}
        datasheetUrls={datasheetUrls}
        sheetUrls={sheetUrls}
        locked={revision.status === "issued"}
      />
    </div>
  );
}

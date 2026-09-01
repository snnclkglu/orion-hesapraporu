// Ekipman listesi indirme ucu — panelden çağrılır.
//   format=xlsx (varsayılan) → exceljs workbook (Node Buffer → nodejs runtime)
//   format=pdf               → react-pdf ekipman listesi
//   scope=customer           → yalnız ekipman listesi (müşteri); aksi hâlde + teknik özet
//   detay=1  (yalnız pdf)    → DETAYLI liste: aynı liste + arkasına ürünlerin
//                              katalog sayfaları; ekipman adı belge içinde o
//                              sayfaya bağlanır
// Panelden eklenen ek satırlar (equipment_extras) çıktıya katılır.
//
// Ekipman adına konan katalog bağlantısı MUTLAK adres ister (Excel ve PDF
// uygulamanın dışında açılır). Kök adres isteğin kendisinden okunur; böylece
// yerelde localhost, canlıda alan adı yazılır ve ayrıca ayar tutmak gerekmez.

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  altsFromRevision, calcInputFromRevision, hiddenSectionsFromRevision,
  type RevisionInputsJson, type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { runCalc } from "@/lib/calc/engine";
import {
  buildCatalogSheetUrls, buildEquipmentWorkbook, buildEquipmentGroups, buildSummarySections,
  mergeExtras, absentModuleGroupNames, dsKey,
  type EquipmentExtraRow, type EquipmentNotes,
} from "@/lib/excel/equipment";
import { loadDrawingPlan, resolveProjectItemNo } from "@/lib/drawing-plan-data";
import {
  EQUIPMENT_ATTACHMENT_BUCKET,
  attachmentsByRowKey,
  loadEquipmentAttachments,
  orderAttachmentsForAppendix,
} from "@/lib/equipment-attachments";
import { collectCatalogSheetPages } from "@/lib/pdf/catalog-sheet-images";
import { docCode, downloadFileName } from "@/lib/pdf/doc-naming";
import { renderEquipmentPdf } from "@/lib/pdf/equipment-report";
import {
  documentMonthLabel,
  reportCoverSpecs,
  summarySpecsForReport,
} from "@/lib/pdf/report";
import { pdfEkleriniSonaEkle, pdfEkleriYerlestir } from "@/lib/pdf/merge";
import { getReportSettings } from "@/lib/settings";
import { loadDrawingNote } from "@/lib/equipment-drawing-note";
import { loadCustomerDrawingPath } from "@/lib/equipment-customer-link";
import { loadReportCoverIdentity } from "@/lib/report-cover-identity-server";
import { loadElectricalEquipment } from "@/lib/equipment-electrical";
import { buildElectricalCatalogAppendix } from "@/lib/electrical/catalog-appendix";
import {
  equipmentListTitle,
  equipmentPartFromParam,
  equipmentSections,
  sectionGroups,
  sectionsForPart,
} from "@/lib/equipment-sections";
import { ENGINEERING_REPORT_CONTEXT, reportContextOf } from "@/lib/report-context";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await params;
  const sp = request.nextUrl.searchParams;
  /*
   * TANINMAYAN BİÇİM SESSİZCE XLSX'E DÜŞMEZ.
   *
   * Eski hâl `sp.get("format") === "pdf" ? "pdf" : "xlsx"` idi; sorgu dizesi
   * herhangi bir sebeple kaybolduğunda (yönlendirme, yanlış kurulmuş URL) uç
   * 200 + xlsx içerik türüyle dönüyor, çağıran da "PDF biçiminde üretilemedi"
   * diyordu ve GERÇEK sebep tamamen görünmez kalıyordu — vinç kimliği yayımını
   * düşüren ikinci kapı buydu (01.09.2026). Beklenmeyen değer artık 400'dür.
   */
  const rawFormat = sp.get("format") ?? "xlsx";
  if (rawFormat !== "pdf" && rawFormat !== "xlsx") {
    return new Response(`Geçersiz format: ${rawFormat}`, { status: 400 });
  }
  const format = rawFormat;
  const scope = sp.get("scope") === "customer" ? "customer" : "full";
  const part = equipmentPartFromParam(sp.get("part"));
  const detailed = format === "pdf" && sp.get("detay") === "1";
  const appOrigin = request.nextUrl.origin;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, rev_no, label, status, inputs, selections, created_by, issued_by, issued_at, updated_at")
    .eq("id", revId)
    .eq("project_id", id)
    .single();
  if (!revision) return new Response("Revizyon bulunamadı", { status: 404 });

  const { data: project } = await supabase
    .from("projects")
    .select("doc_no, name, customer, crane_type, crane_location, report_context, report_brand_customer_id, end_customer_id, prepared_by, checked_by, checked_by_name")
    .eq("id", id)
    .single();
  if (!project) return new Response("Proje bulunamadı", { status: 404 });

  const preparedById = project.prepared_by ?? revision.issued_by ?? revision.created_by;
  const signatoryIds = [preparedById, project.checked_by].filter(
    (value): value is string => Boolean(value)
  );
  const { data: signatoryProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", signatoryIds);
  const nameOf = (id: string | null | undefined) =>
    (signatoryProfiles ?? []).find((profile) => profile.id === id)?.full_name || "—";

  const calcInput = calcInputFromRevision(
    revision.inputs as RevisionInputsJson | null,
    revision.selections as RevisionSelectionsJson | null
  );
  const calcResult = runCalc(calcInput);
  const [settings, coverIdentity] = await Promise.all([
    getReportSettings(supabase),
    format === "pdf"
      ? loadReportCoverIdentity(
          supabase,
          project.report_brand_customer_id,
          project.end_customer_id
        )
      : Promise.resolve(null),
  ]);

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

  // "Ek Özellikler" notları (equipment_notes) — row_key ile satırlara bağlanır
  const notes: EquipmentNotes = {};
  const { data: noteRows } = await supabase
    .from("equipment_notes")
    .select("row_key, note")
    .eq("revision_id", revId);
  for (const n of (noteRows ?? []) as { row_key: string; note: string }[]) {
    notes[n.row_key] = n.note;
  }

  // "Ek Belge" yüklemeleri — sütun HER İKİ kapsamda da yazılır (müşteri
  // listesinde de ekipmanın ekinin kaç sayfa olduğu bilgisi anlamlıdır);
  // ekin SAYFALARI ise yalnız detaylı PDF'e girer.
  const attachmentRows = await loadEquipmentAttachments(supabase, revId);
  const attachments = attachmentsByRowKey(attachmentRows);

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
    coverDate: documentMonthLabel(revision.issued_at ?? revision.updated_at),
    preparedBy: nameOf(preparedById),
    checkedBy: project.checked_by_name?.trim() || nameOf(project.checked_by),
  };

  // `Uint8Array<ArrayBuffer>` — çıplak `Uint8Array` DEĞİL: TS 5.7'den beri
  // `BodyInit` yalnız `ArrayBuffer` tabanlı görünümleri kabul ediyor
  // (`pdf/merge.ts` aynı daraltmayı belgeliyor).
  let body: Uint8Array<ArrayBuffer>;
  let contentType: string;
  let ext: string;
  /** Deste eksik basıldıysa kaç ek atlandı — yanıt başlığına yazılır. */
  let atlananEk = 0;

  // Seçenekli (alternatif) seçimler ekipman listesinde ana satırın altına iner.
  const alts = altsFromRevision(revision.selections as RevisionSelectionsJson | null);
  // Gizlenen alt bölümlerin satırları hiçbir çıktıya girmez (panelle aynı küme).
  const hiddenSections = hiddenSectionsFromRevision(revision.inputs as RevisionInputsJson | null);

  const mechanicalGroups = mergeExtras(
    buildEquipmentGroups(calcInput, notes, alts, attachments, hiddenSections),
    extras,
    // Kapalı bölümün adını taşıyan elle eklenmiş satır o bölümün başlığını
    // diriltmesin — satır "Ek Ekipman" altında durur.
    absentModuleGroupNames(calcInput)
  );
  // Teklif ön hesabında elektrik teslim katmanı yoktur (HESAP-31). Alınmış iş
  // bağlamında ise yalnız GÜNCEL elektrik projesi okunur; eski yüklemeler
  // arşivde kalır ama birleşik ekipman listesine girmez.
  const electrical = reportContextOf(project.report_context) === ENGINEERING_REPORT_CONTEXT
    ? await loadElectricalEquipment(supabase, id, { notes, attachments, origin: appOrigin })
    : null;
  for (const [key, url] of electrical?.datasheetUrls ?? []) datasheetUrls.set(key, url);

  const allSections = equipmentSections({
    mechanical: mechanicalGroups,
    electrical: electrical?.groups,
  });
  const sections = sectionsForPart(allSections, part);
  if (sections.length === 0) {
    return new Response(
      part === "elektrik" ? "Elektrik ekipman listesi bulunamadı" : "Ekipman listesi bulunamadı",
      { status: 404 }
    );
  }
  const groups = sectionGroups(sections);
  const listTitle = equipmentListTitle(sections);
  const includeTechnicalSummary =
    scope !== "customer" && sections.some((section) => section.key === "mechanical");

  // Teknik Resim Takibi defteri YALNIZ teknik özet istendiğinde okunur: müşteri
  // kapsamında özet sayfası hiç basılmaz, sorguyu boşuna atmanın anlamı yok.
  const [drawingPlan, drawingNote, customerDrawingPath] = await Promise.all([
    includeTechnicalSummary
      ? Promise.all([
          resolveProjectItemNo(supabase, id, project.doc_no),
          loadDrawingPlan(supabase, id),
        ]).then(([itemNo, rows]) => ({ itemNo, rows }))
      : Promise.resolve(undefined),
    // Ressam notu da yalnız teknik özet istendiğinde okunur (özet basılmıyorsa
    // notun gideceği bir yer yok).
    includeTechnicalSummary
      ? loadDrawingNote(supabase, revId)
      : Promise.resolve(undefined),
    loadCustomerDrawingPath(supabase, revId),
  ]);
  const mainDrawingUrl = customerDrawingPath
    ? `${appOrigin}${customerDrawingPath}`
    : undefined;

  if (format === "pdf") {
    const summary =
      !includeTechnicalSummary
        ? undefined
        : buildSummarySections(calcInput, calcResult, drawingPlan, drawingNote);
    // Detaylı listede mekanik katalog görüntüleri react-pdf'e doğrudan girer.
    // Elektrik teknik föyleri ise gerçek PDF sayfalarıdır; EK-F üreticisiyle
    // sıkıştırılmış, kaynak sayfadan türetilen tek bir ek hazırlanır ve biraz
    // aşağıda temel belgenin katalog bloğuna yerleştirilir.
    const sheetPages = detailed ? await collectCatalogSheetPages(groups) : undefined;
    const sheetUrls = buildCatalogSheetUrls(groups, appOrigin);
    for (const [key, url] of electrical?.sheetUrls ?? []) sheetUrls.set(key, url);
    const electricalAppendix =
      detailed && sections.some((section) => section.key === "electrical")
        ? await buildElectricalCatalogAppendix(supabase, id, { maxPagesPerDocument: 6 })
        : null;
    const internalSheetAnchors = new Map(
      Object.entries(electricalAppendix?.destinationByCatalogKey ?? {})
    );

    // Ek belgeler: kapaklar react-pdf ile basılır, GERÇEK SAYFALAR sonradan
    // pdf-lib ile kapağın ardına konur. Sıra listeyi izler
    // (`orderAttachmentsForAppendix`) ve `pdfEkleriYerlestir` tam bu sırayı
    // bekler — ikisi arasındaki sözleşme budur.
    const orderedAttachments = detailed
      ? orderAttachmentsForAppendix(groups, attachmentRows)
      : [];
    // TEKNİK ÖZELLİKLER YAPRAĞI teknik özetle BİRLİKTE gelir: ikisi de
    // ressamın/mühendisin belgesine aittir, müşteri listesinde ikisi de yoktur.
    // `detay` bayrağı bunu ETKİLEMEZ — standart ve detaylı listenin farkı
    // yalnız katalog sayfası ekleridir (kullanıcı isteği, 19.08.2026).
    const specTable =
      !includeTechnicalSummary
        ? undefined
        : { ...summarySpecsForReport(calcInput), specs: calcInput.specs };
    const basePdf = await renderEquipmentPdf({
      meta,
      groups,
      sections,
      listTitle,
      partner: coverIdentity?.reportBrand ?? null,
      endCustomerLogo: coverIdentity?.endCustomerLogo ?? null,
      coverSpecs: reportCoverSpecs(calcInput, project.crane_type ?? ""),
      craneLocation: project.crane_location,
      summary,
      specTable,
      settings,
      datasheetUrls,
      sheetUrls,
      mainDrawingUrl,
      sheetPages,
      internalSheetAnchors,
      attachmentCovers: orderedAttachments.map((a) => ({
        rowKey: a.rowKey,
        component: a.component,
        fileName: a.fileName,
        pageCount: a.pageCount,
      })),
    });

    // Elektrik kataloğu kullanıcı eklerinin KAPAKLARINDAN ÖNCE eklenir;
    // mekanik ve elektrik katalog yaprakları böylece kesintisiz tek bloktur.
    // `destinations` hem EK-F dizinindeki hem ekipman tablosundaki `#ekf-*`
    // bağlantılarını doğrudan nihai sayfa nesnesine çevirir.
    let mergedPdf = new Uint8Array(basePdf);
    if (electricalAppendix?.bytes.byteLength) {
      const appendixResult = await pdfEkleriniSonaEkle(
        mergedPdf,
        [{
          ad: "Elektrik Ekipman Katalog Sayfaları",
          bytes: electricalAppendix.bytes,
          destinations: electricalAppendix.destinations,
        }],
        { sondakiSayfalardanOnce: orderedAttachments.length }
      );
      mergedPdf = appendixResult.bytes;
      atlananEk += electricalAppendix.skipped.length + appendixResult.atlananlar.length;
      for (const atlanan of [...electricalAppendix.skipped, ...appendixResult.atlananlar]) {
        console.warn(
          `[ekipman-listesi] elektrik katalog eki eklenemedi: ${atlanan.ad} — ${atlanan.sebep}`
        );
      }
    }

    if (orderedAttachments.length === 0) {
      body = mergedPdf;
    } else {
      const ekler = await Promise.all(
        orderedAttachments.map(async (a) => {
          const { data } = await supabase.storage
            .from(EQUIPMENT_ATTACHMENT_BUCKET)
            .download(a.storagePath);
          return {
            ad: a.fileName,
            bytes: data ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(0),
          };
        })
      );
      const sonuc = await pdfEkleriYerlestir(mergedPdf, ekler);
      body = sonuc.bytes;
      atlananEk += sonuc.atlananlar.length;
      // SESSİZ ATLAMA YOKTUR (merge.ts sözleşmesi). Yükleme anında dosya zaten
      // okunup sayfası sayıldığı için buraya düşmek depo anomalisidir; belge
      // yine de tutarlı basılır (atlanan ekin KAPAĞI da silinir) ve durum hem
      // sunucu günlüğüne hem yanıt başlığına yazılır.
      for (const atlanan of sonuc.atlananlar) {
        console.warn(
          `[ekipman-listesi] ek eklenemedi: ${atlanan.ad} — ${atlanan.sebep}`
        );
      }
    }
    contentType = "application/pdf";
    ext = "pdf";
  } else {
    const sheetUrls = buildCatalogSheetUrls(groups, appOrigin);
    for (const [key, url] of electrical?.sheetUrls ?? []) sheetUrls.set(key, url);
    const workbook = buildEquipmentWorkbook(calcInput, calcResult, meta, {
      datasheetUrls,
      scope: includeTechnicalSummary ? "full" : "customer",
      sections,
      sheetTitle: listTitle,
      sheetUrls,
      mainDrawingUrl,
      drawingPlan,
      drawingNote,
    });
    body = new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  }

  // Dosya adı: İŞ ADI - DOKÜMAN KODU - VERSİYON - TÜR (bkz. pdf/doc-naming).
  // Teknik özet DAHİLİ bir çıktıdır; adında görünmesi, müşteriye yanlış dosyayı
  // göndermeyi zorlaştırır.
  const filename = downloadFileName(
    [
      project.name,
      docCode("EQ", project.doc_no ?? "", revision.rev_no),
      `V${revision.rev_no}`,
      listTitle,
      includeTechnicalSummary ? "Teknik Özet" : null,
      detailed ? "Detaylı" : null,
    ],
    ext as "pdf" | "xlsx"
  );
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encodedFilename = encodeURIComponent(filename);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
      // Deste eksik basıldıysa bu bir SESSİZLİK olmasın: dosya indirilir ama
      // durum başlıkta durur ve sunucu günlüğünde sebebiyle yazar.
      ...(atlananEk > 0 ? { "X-Orion-Atlanan-Ek": String(atlananEk) } : {}),
    },
  });
}

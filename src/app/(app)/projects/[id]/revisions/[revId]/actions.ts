"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runCalc, type CalcInput } from "@/lib/calc/engine";
import {
  CALC_FIELD,
  altsFromRevision,
  calcInputFromRevision,
  hiddenDiagramsFromRevision,
  hiddenSectionsFromRevision,
  sectionNotesFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
  type RevisionSectionNotes,
} from "@/lib/revision-load";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { renderReportPdf } from "@/lib/pdf/report";
import { getReportSettings } from "@/lib/settings";
import { loadReportCoverIdentity } from "@/lib/report-cover-identity-server";

export type SaveResult = { error?: string; ok?: boolean };

/**
 * Taslak revizyonu yayınlar (issue): durum 'issued' olur, DB trigger'ı
 * issued_at/issued_by damgalar ve kaydı kilitler. Sonraki değişiklikler
 * yeni revizyon gerektirir. Yayın sonrası PDF rapor 'reports' bucket'ına
 * arşivlenir; arşivleme hatası yayını GERİ ALMAZ, sadece uyarı döner.
 */
export async function issueRevision(
  projectId: string,
  revisionId: string,
  label: string
): Promise<SaveResult & { warning?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: revision, error } = await supabase
    .from("revisions")
    .update({ status: "issued", label: label.trim() || undefined })
    .eq("id", revisionId)
    .eq("status", "draft")
    .select("rev_no, label, inputs, selections, issued_at, updated_at")
    .single();

  if (error || !revision) {
    return { error: error?.message ?? "Revizyon bulunamadı veya zaten yayınlanmış" };
  }

  // ---- PDF arşivi: reports/{projectId}/{doc_no}-V{rev_no}.pdf (upsert)
  let pdfArchived = false;
  try {
    const [{ data: project }, { data: profile }] = await Promise.all([
      supabase
        .from("projects")
        .select("doc_no, name, customer, crane_type, crane_location, report_brand_customer_id, end_customer_id, prepared_by, checked_by, checked_by_name")
        .eq("id", projectId)
        .single(),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    ]);
    if (project) {
      const preparedById = project.prepared_by ?? user.id;
      const { data: signatoryProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", [preparedById, project.checked_by].filter((id): id is string => Boolean(id)));
      const nameOf = (id: string | null | undefined) =>
        (signatoryProfiles ?? []).find((person) => person.id === id)?.full_name;
      const input = calcInputFromRevision(
        revision.inputs as RevisionInputsJson,
        revision.selections as RevisionSelectionsJson
      );
      const result = runCalc(input);
      const [reportSettings, coverIdentity] = await Promise.all([
        getReportSettings(supabase),
        loadReportCoverIdentity(
          supabase,
          project.report_brand_customer_id,
          project.end_customer_id
        ),
      ]);
      const buffer = await renderReportPdf({
        settings: reportSettings,
        project,
        revision: {
          rev_no: revision.rev_no,
          label: revision.label,
          issued_at: revision.issued_at,
          updated_at: revision.updated_at,
        },
        preparedBy: nameOf(preparedById) || profile?.full_name || "—",
        checkedBy: project.checked_by_name?.trim() || nameOf(project.checked_by) || "—",
        reportBrand: coverIdentity.reportBrand,
        endCustomerLogo: coverIdentity.endCustomerLogo,
        input,
        result,
        level: "detayli", // yayın arşivi her zaman tam (detaylı) rapor saklar
        // Arşivlenen resmî rapor da seçenekli ekipmanları içermelidir.
        alts: altsFromRevision(revision.selections as RevisionSelectionsJson),
        sectionNotes: sectionNotesFromRevision(revision.selections as RevisionSelectionsJson),
        // Gizlenen alt bölümler arşiv raporunda da basılmaz (indirme ucuyla aynı).
        hiddenSections: hiddenSectionsFromRevision(revision.inputs as RevisionInputsJson),
        // Şeması gizlenen bölümler arşiv raporunda da çizilmez.
        hiddenDiagrams: hiddenDiagramsFromRevision(revision.inputs as RevisionInputsJson),
      });
      const { error: uploadError } = await supabase.storage
        .from("reports")
        .upload(`${projectId}/${project.doc_no}-V${revision.rev_no}.pdf`, buffer, {
          contentType: "application/pdf",
          upsert: true,
        });
      pdfArchived = !uploadError;
    }
  } catch {
    pdfArchived = false;
  }

  await supabase.from("audit_log").insert({
    project_id: projectId,
    revision_id: revisionId,
    actor: user.id,
    action: "revision.issue",
    detail: { rev_no: revision.rev_no, label: label.trim(), pdf_archived: pdfArchived },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/revisions/${revisionId}`);
  revalidatePath(`/offers/hesap-raporlari/${projectId}`);
  revalidatePath(`/offers/hesap-raporlari/${projectId}/revisions/${revisionId}`);
  return pdfArchived
    ? { ok: true }
    : {
        ok: true,
        warning:
          "Revizyon yayınlandı ancak PDF arşive yüklenemedi; raporu 'PDF Rapor' bağlantısından indirebilirsiniz.",
      };
}

/**
 * Şablon işaretini değiştirir (sadece admin, RLS + is_admin kontrolü).
 * Şablon revizyon: yeni projelerin ilk revizyonu bu snapshot'tan kopyalanır.
 */
export async function setRevisionTemplate(
  projectId: string,
  revisionId: string,
  isTemplate: boolean
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Bu işlem için admin yetkisi gerekir" };

  const { error } = await supabase
    .from("revisions")
    .update({ is_template: isTemplate })
    .eq("id", revisionId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    project_id: projectId,
    revision_id: revisionId,
    actor: user.id,
    action: isTemplate ? "revision.template_set" : "revision.template_unset",
    detail: {},
  });

  revalidatePath(`/projects/${projectId}/revisions/${revisionId}`);
  revalidatePath(`/offers/hesap-raporlari/${projectId}/revisions/${revisionId}`);
  return { ok: true };
}

/**
 * Taslak revizyonu kaydeder: girdiler + seçimler + sunucuda yeniden hesaplanan
 * sonuç snapshot'ı. Hesap her zaman sunucuda da koşturulur (istemciye güven yok).
 *
 * `calcInput` hesaba GİREN settir (kapatılmış bölümler yoktur). `fullInput`
 * ise kapalı bölümlerin girdilerini de taşır: kayıtta hepsi saklanır, hangi
 * bölümün kapalı olduğu `disabledModules` listesiyle belirtilir. Böylece bir
 * bölüm kapatılıp yeniden açıldığında elle ayarlanmış değerler kaybolmaz.
 */
/**
 * Bölüm girdilerini/seçimlerini JSONB'ye çevirir. Bölüm listesi tek yerden
 * (`CALC_FIELD`) geldiği için yeni bir hesap bölümü eklendiğinde burada
 * unutulacak bir alan kalmaz.
 */
function moduleJson(store: CalcInput, part: "inputs" | "selections") {
  const src = store as unknown as Record<string, { inputs?: object; selections?: object }>;
  const out: Record<string, object | null> = {};
  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    out[field] = src[field]?.[part] ?? null;
  }
  return out;
}

export async function saveRevision(
  projectId: string,
  revisionId: string,
  calcInput: CalcInput,
  alts?: Record<string, { active: number; options: Record<string, unknown>[] }>,
  fullInput?: CalcInput,
  disabledModules?: string[],
  sectionNotes?: RevisionSectionNotes,
  /** Gizlenen alt bölümler (`sectionHideKeyFor` anahtarları, ör. "trolley-5.7") */
  hiddenSections?: string[],
  /**
   * ŞEMASI gizlenen alt bölümler (`sectionDiagramHideKeyFor` anahtarları).
   * Bölüm rapora girmeye devam eder; yalnız parametrik çizimi basılmaz.
   */
  hiddenDiagrams?: string[]
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const result = runCalc(calcInput);
  const store = fullInput ?? calcInput;

  // Dosyadan oluşturma KÜNYESİ hesap girdisi değildir ama revizyonun
  // kaynağıdır. Editörün olağan kaydı inputs nesnesini baştan kurduğu için
  // bu bloğu açıkça devralmazsak ilk Kaydet'te kaynak revizyon ve AI teyit
  // notları sessizce kaybolur. Değer istemciden alınmaz; DB'deki mevcut
  // snapshot'tan okunur.
  const { data: currentRevision } = await supabase
    .from("revisions")
    .select("inputs")
    .eq("id", revisionId)
    .eq("project_id", projectId)
    .maybeSingle();
  const currentInputs = currentRevision?.inputs;
  const fileImport =
    currentInputs &&
    typeof currentInputs === "object" &&
    !Array.isArray(currentInputs) &&
    (currentInputs as Record<string, unknown>).fileImport &&
    typeof (currentInputs as Record<string, unknown>).fileImport === "object" &&
    !Array.isArray((currentInputs as Record<string, unknown>).fileImport)
      ? (currentInputs as Record<string, unknown>).fileImport
      : undefined;

  const { data: updated, error } = await supabase
    .from("revisions")
    .update({
      inputs: {
        ...moduleJson(store, "inputs"),
        specs: calcInput.specs,
        disabledModules: disabledModules ?? [],
        hiddenSections: hiddenSections ?? [],
        hiddenDiagrams: hiddenDiagrams ?? [],
        ...(fileImport ? { fileImport } : {}),
      },
      selections: {
        ...moduleJson(store, "selections"),
        alts: alts ?? {},
        sectionNotes: sectionNotes ?? {},
      },
      results: JSON.parse(JSON.stringify(result)),
      engine_version: result.engineVersion,
    })
    .eq("id", revisionId)
    .eq("status", "draft")
    .select("id");

  if (error) {
    return {
      error: error.message.includes("Yayınlanmış")
        ? "Bu revizyon yayınlanmış; düzenlenemez."
        : error.message,
    };
  }
  if (!updated || updated.length === 0) {
    return { error: "Bu revizyon yayınlanmış; düzenlenemez. Yeni revizyon oluşturun." };
  }

  await supabase.from("audit_log").insert({
    project_id: projectId,
    revision_id: revisionId,
    actor: user.id,
    action: "revision.save",
    detail: { engine_version: result.engineVersion, all_pass: result.allPass },
  });

  revalidatePath(`/projects/${projectId}/revisions/${revisionId}`);
  revalidatePath(`/offers/hesap-raporlari/${projectId}/revisions/${revisionId}`);
  return { ok: true };
}

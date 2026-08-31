import "server-only";

import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ELECTRICAL_BUCKET } from "@/lib/electrical/data";
import { SPEC_BUCKET } from "@/lib/project-specs";
import { sha256 } from "./secrets";
import { CUSTOMER_PORTAL_BUCKET } from "./data-server";
import { PORTAL_REPORT_LEVELS } from "./types";
import type { PortalDocumentSelection } from "./types";

// Equipment/manual route modüllerini buraya doğrudan import ETME. Bu modül
// proje sayfasındaki Server Action zincirindedir; route importu canvas,
// katalog ve react-pdf izini de sayfa lambdasına taşıyıp Vercel'in 225 MiB
// gruplama eşiğini aşar. Aynı-origin fetch mevcut auth'lu PDF uçlarını tek
// kaynak olarak kullanır ve ağır üreticileri kendi fonksiyonlarında bırakır.

export interface MaterializedPortalFile {
  id: string;
  folder_key: string;
  folder_title: string;
  folder_sort: number;
  file_sort: number;
  display_name: string;
  file_name: string;
  source_kind: PortalDocumentSelection["sourceKind"];
  source_id: string;
  source_revision_label: string;
  access_mode: PortalDocumentSelection["accessMode"];
  storage_path: string;
  mime_type: string;
  sha256: string;
  size_bytes: number;
  page_count: number;
}

function safeFileName(value: string): string {
  const clean = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  return `${clean || "dokuman"}.pdf`;
}

async function responsePdf(response: Response, label: string): Promise<Uint8Array> {
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 220);
    throw new Error(`${label} üretilemedi${detail ? `: ${detail}` : ""}`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/pdf")) {
    throw new Error(`${label} PDF biçiminde üretilemedi.`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function download(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  label: string
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`${label} depodan okunamadı.`);
  return new Uint8Array(await data.arrayBuffer());
}

async function sourceBytes(
  supabase: SupabaseClient,
  projectId: string,
  selection: PortalDocumentSelection,
  requestOrigin: string,
  requestCookie: string
): Promise<Uint8Array> {
  switch (selection.sourceKind) {
    case "report": {
      const [{ data: project }, { data: revision }] = await Promise.all([
        supabase.from("projects").select("doc_no").eq("id", projectId).maybeSingle(),
        supabase
          .from("revisions")
          .select("id, rev_no, status")
          .eq("id", selection.sourceId)
          .eq("project_id", projectId)
          .eq("status", "issued")
          .maybeSingle(),
      ]);
      if (!project?.doc_no || !revision) throw new Error("Yayımlanmış hesap raporu bulunamadı.");
      const level = PORTAL_REPORT_LEVELS.find((entry) => entry === selection.reportLevel)
        ?? "detayli";
      if (level !== "detayli") {
        const url = new URL(
          `/projects/${projectId}/revisions/${selection.sourceId}/report`,
          requestOrigin
        );
        url.searchParams.set("level", level);
        const response = await fetch(url, {
          cache: "no-store",
          headers: { Accept: "application/pdf", Cookie: requestCookie },
        });
        return responsePdf(response, "Hesap raporu");
      }
      return download(
        supabase,
        "reports",
        `${projectId}/${project.doc_no}-V${revision.rev_no}.pdf`,
        "Hesap raporu"
      );
    }

    case "equipment": {
      const url = new URL(
        `/projects/${projectId}/revisions/${selection.sourceId}/equipment/download`,
        requestOrigin
      );
      url.searchParams.set("format", "pdf");
      url.searchParams.set("scope", "customer");
      if (selection.equipmentDetail === "detayli") url.searchParams.set("detay", "1");
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/pdf", Cookie: requestCookie },
      });
      return responsePdf(response, "Ekipman listesi");
    }

    case "manual": {
      const url = new URL(
        `/projects/${projectId}/manual/${selection.sourceId}/pdf`,
        requestOrigin
      );
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/pdf", Cookie: requestCookie },
      });
      return responsePdf(response, "İşletme ve Bakım El Kitabı");
    }

    case "electrical": {
      const { data } = await supabase
        .from("electrical_projects")
        .select("storage_path, is_current")
        .eq("id", selection.sourceId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (!data?.storage_path || !data.is_current) throw new Error("Güncel elektrik projesi bulunamadı.");
      return download(supabase, ELECTRICAL_BUCKET, String(data.storage_path), "Elektrik projesi");
    }

    case "specification": {
      const { data } = await supabase
        .from("project_specs")
        .select("storage_path, content_type, is_current")
        .eq("id", selection.sourceId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (!data?.storage_path || !data.is_current || data.content_type !== "application/pdf") {
        throw new Error("Güncel PDF şartname bulunamadı.");
      }
      return download(supabase, SPEC_BUCKET, String(data.storage_path), "Teknik şartname");
    }

    case "drawing": {
      const { data } = await supabase
        .from("drawing_files")
        .select("storage_path, stored, file_name, drawing_packages!inner(job_item_id, item_no)")
        .eq("id", selection.sourceId)
        .maybeSingle();
      if (!data?.stored || !data.storage_path || !/\.pdf$/i.test(String(data.file_name))) {
        throw new Error("Teknik resim PDF'i bulunamadı.");
      }
      // Dosyanın bu projeye ait iş kalemlerinden birine bağlı olduğu tekrar
      // doğrulanır; istemciden gelen sourceId tek başına yetki değildir.
      const pkg = data.drawing_packages as unknown as { job_item_id?: string; item_no?: string } | null;
      const { data: projectItems } = await supabase
        .from("job_items")
        .select("id, item_no")
        .eq("project_id", projectId);
      const belongs = (projectItems ?? []).some(
        (item) => item.id === pkg?.job_item_id || (item.item_no && item.item_no === pkg?.item_no)
      );
      if (!belongs) throw new Error("Teknik resim bu projeye ait değil.");
      return download(supabase, "drawings", String(data.storage_path), "Teknik resim");
    }

    case "custom":
      if (!selection.sourceId.startsWith(`draft/`)) throw new Error("Özel belge yolu geçersiz.");
      return download(supabase, CUSTOMER_PORTAL_BUCKET, selection.sourceId, "Özel belge");
  }
}

export async function materializePortalSelection({
  supabase,
  projectId,
  portalId,
  revisionNo,
  selection,
  requestOrigin,
  requestCookie,
}: {
  supabase: SupabaseClient;
  projectId: string;
  portalId: string;
  revisionNo: number;
  selection: PortalDocumentSelection;
  requestOrigin: string;
  requestCookie: string;
}): Promise<MaterializedPortalFile> {
  const bytes = await sourceBytes(supabase, projectId, selection, requestOrigin, requestCookie);
  if (bytes.byteLength === 0) throw new Error(`${selection.title} boş bir dosya üretti.`);
  let pageCount = 0;
  try {
    /*
     * ŞİFRELİ PDF YAYIMI KOMPLE DÜŞÜRÜYORDU.
     *
     * Müşteriden ya da taşeronndan gelen bir şartname/elektrik projesi çoğu
     * zaman "izin korumalı"dır (yazdırma/kopyalama kısıtı; parola YOK). pdf-lib
     * varsayılan olarak böyle bir belgeyi açmayı reddeder ve `catch` bloğu
     * "geçerli bir PDF değil" diyerek BÜTÜN yayımı iptal ediyordu — tek bir
     * belge yüzünden paket hiç çıkmıyordu ve gerekçe de yanlıştı.
     *
     * `ignoreEncryption` yalnız SAYFA SAYMAK içindir; baytlar olduğu gibi
     * depolanır, biz belgeyi yeniden yazmayız ve korumayı kaldırmayız.
     */
    pageCount = (await PDFDocument.load(bytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    })).getPageCount();
  } catch {
    throw new Error(`${selection.title} geçerli bir PDF değil.`);
  }
  if (pageCount < 1) throw new Error(`${selection.title} sayfa içermiyor.`);

  const id = randomUUID();
  const fileName = safeFileName(selection.title);
  const storagePath = `${portalId}/R${String(revisionNo).padStart(2, "0")}/${id}.pdf`;
  const { error } = await supabase.storage
    .from(CUSTOMER_PORTAL_BUCKET)
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`${selection.title} müşteri paketine yüklenemedi.`);

  return {
    id,
    folder_key: selection.folderKey,
    folder_title: selection.folderTitle,
    folder_sort: selection.folderSort,
    file_sort: selection.fileSort,
    display_name: selection.title,
    file_name: fileName,
    source_kind: selection.sourceKind,
    source_id: selection.sourceId,
    source_revision_label: selection.sourceRevisionLabel,
    access_mode: selection.accessMode,
    storage_path: storagePath,
    mime_type: "application/pdf",
    sha256: sha256(bytes),
    size_bytes: bytes.byteLength,
    page_count: pageCount,
  };
}

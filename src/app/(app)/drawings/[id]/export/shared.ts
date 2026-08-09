// Türev çıktı uçlarının ortak yükü: yetki, veri, eşleme, dosya adı, yanıt.
//
// Üç uç (satın alma · kesim · imalat) aynı beş adımı yapar; üç kez yazmak
// zamanla üç ayrı dosya adı kuralı ve üç ayrı yetki kararı üretirdi.
//
// YETKİ YALNIZ OTURUMDUR. `canEditDrawings` İSTENMEZ: teknik resim okuması
// RLS'te herkese açıktır ve müdür de paketin listesini indirebilmelidir.
// `roles.ts` yeni bir soru eklenmemesini açıkça söylüyor; buradaki tek engel
// oturumsuz erişimdir.

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { docCode, downloadFileName } from "@/lib/pdf/doc-naming";
import { trSayi } from "@/lib/drawings/tr-text";
import type { KesimDosyasi, TurevParca } from "@/lib/drawings/derive";
import type { DrawingExportMeta } from "@/lib/excel/drawing-outputs";
import { loadFiles, loadPackage, loadParts, type FileRow, type PartRow } from "../../data";

/** Yerleşim payının makul aralığı — adres çubuğundan gelen değer sınırlanır. */
const PAY_ALT = 1;
const PAY_UST = 2;

export interface ExportBaglami {
  parts: TurevParca[];
  files: KesimDosyasi[];
  meta: DrawingExportMeta;
  /** Dosya adının ilk parçası: "0057-00 MONORAY (1 TON)" */
  isAdi: string;
  belgeKodu: string;
  kalemNo: string;
}

/**
 * DXF extents sütunlarını SAVUNMACI okur.
 *
 * `extents_x_mm` / `extents_y_mm` şemada Faz 2 için zaten var ama `data.ts`in
 * `select`i onları bugün okumuyor ve o dosya bu fazın sahipliğinde değil.
 * Alan gelirse kullanılır, gelmezse ölçü tanımdan çıkmaya devam eder — iki
 * ajan birbirini beklemez.
 */
function extents(r: PartRow): { x: number | null; y: number | null } {
  const ham = r as PartRow & { extents_x_mm?: number | string | null; extents_y_mm?: number | string | null };
  const say = (v: number | string | null | undefined) =>
    v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
  return { x: say(ham.extents_x_mm), y: say(ham.extents_y_mm) };
}

function partToTurev(r: PartRow): TurevParca {
  const e = extents(r);
  return {
    registerKey: r.register_key,
    partCode: r.part_code,
    parentCode: r.parent_code,
    itemPath: r.item_path,
    level: r.level,
    kind: r.kind,
    name: r.name,
    description: r.description,
    assemblyTitle: r.assembly_title,
    material: r.material,
    category: r.category,
    qty: r.qty,
    cutLengthMm: r.cut_length_mm == null ? null : Number(r.cut_length_mm),
    thicknessMm: r.thickness_mm == null ? null : Number(r.thickness_mm),
    weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
    hasModel: r.has_model,
    hasSheet: r.has_sheet,
    hasCut: r.has_cut,
    has3d: r.has_3d,
    sort: r.sort,
    extentsXMm: e.x,
    extentsYMm: e.y,
    bomRef: null,
  };
}

function fileToKesim(r: FileRow): KesimDosyasi {
  return {
    relPath: r.rel_path,
    fileName: r.file_name,
    role: r.role,
    lifecycle: r.lifecycle,
    partCode: r.part_code,
    material: r.material,
    thicknessMm: r.thickness_mm == null ? null : Number(r.thickness_mm),
    qty: r.qty,
    size: Number(r.size_bytes ?? 0),
  };
}

/** Adres çubuğundaki `?pay=1,25` — tr-TR virgüllü yazım da okunur. */
export function yerlesimPayiOku(request: NextRequest): number | undefined {
  const ham = request.nextUrl.searchParams.get("pay");
  if (!ham) return undefined;
  const n = trSayi(ham);
  if (n == null || !Number.isFinite(n)) return undefined;
  return Math.min(PAY_UST, Math.max(PAY_ALT, n));
}

/**
 * Paketi okur ve türev katmanın beklediği biçime çevirir.
 *
 * Hata durumunda `Response` döner — çağıran uç onu doğrudan geri verir.
 */
export async function exportBaglami(
  packageId: string
): Promise<{ ctx: ExportBaglami } | { hata: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: new Response("Oturum gerekli", { status: 401 }) };

  const paket = await loadPackage(supabase, packageId);
  if (!paket) return { hata: new Response("Paket bulunamadı", { status: 404 }) };

  const [partRows, fileRows, profile] = await Promise.all([
    loadParts(supabase, packageId),
    loadFiles(supabase, packageId),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  // Doküman no KLASÖR KODUDUR (kalem + grup). Kural `parts/download/route.ts`
  // ile BİREBİR AYNIDIR: parça defteri ile türev listeler aynı belge ailesidir
  // ve aynı paketten aynı kodu taşımaları gerekir.
  const kodTabani = [paket.item_no, paket.group_code].filter(Boolean).join("-") || "PAKET";
  const belgeKodu = docCode("TR", kodTabani, paket.rev_no);

  const isAdi =
    [paket.item_no, paket.description || paket.folder_name].filter(Boolean).join(" ") +
    (paket.capacity ? ` (${paket.capacity})` : "");

  const meta: DrawingExportMeta = {
    paketAdi: isAdi,
    belgeKodu,
    klasorAdi: paket.folder_name,
    kalemNo: paket.item_no,
    generatedAt: new Date().toLocaleString("tr-TR"),
    preparedBy: (profile.data as { full_name?: string } | null)?.full_name || user.email || "",
  };

  return {
    ctx: {
      parts: partRows.map(partToTurev),
      files: fileRows.map(fileToKesim),
      meta,
      isAdi,
      belgeKodu,
      kalemNo: paket.item_no,
    },
  };
}

/**
 * xlsx yanıtı — Content-Disposition ÇİFT yazılır.
 *
 * Türkçe karakterli ad eski istemcilerde bozulur; ASCII'ye indirgenmiş yedek
 * ile UTF-8 kodlanmış asıl ad yan yana verilir (worklog/export ile aynı kalıp).
 */
export async function xlsxYaniti(
  workbook: { xlsx: { writeBuffer: () => Promise<ArrayBuffer | Buffer> } },
  parcalar: readonly (string | null | undefined)[]
): Promise<Response> {
  const raw = await workbook.xlsx.writeBuffer();
  const body = new Uint8Array(raw as ArrayBuffer);
  const filename = downloadFileName(parcalar, "xlsx");
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encodedFilename = encodeURIComponent(filename);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
}

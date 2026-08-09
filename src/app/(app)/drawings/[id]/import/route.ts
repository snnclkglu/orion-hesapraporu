// Paketin Excel'lerini okuyup ham BOM satırlarını yazar.
//
// NEDEN ROUTE HANDLER, SERVER ACTION DEĞİL: `exceljs` Node çalışma zamanı ister
// ve iş uzundur (yedi Excel, 627 satır, her biri depodan indirilir). Route
// handler evin ağır Node işleri için zaten kullandığı yol
// (`worklog/export/route.ts`, `revisions/[revId]/report/route.ts`).
//
// PARÇALI ÇALIŞIR (`?ofset=&adet=`): dağıtımın süre tavanı ne olursa olsun bir
// istek onu aşmasın ve yarıda kalan bir okuma AYNI OFSETTEN sürdürülebilsin.
// Bugün yedi Excel bir çağrıda biter; kural yarın ürün ağacı ikiye katlandığında
// da çalışsın diye baştan böyle kuruldu.

import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { parseBomFileName } from "@/lib/drawings/file-name";
import { readSheet } from "@/lib/drawings/excel";

export const runtime = "nodejs";

const BUCKET = "drawings";
/** Bir çağrıda okunacak Excel sayısı. */
const VARSAYILAN_ADET = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditDrawings(profile?.role)) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const url = new URL(request.url);
  const ofset = Math.max(0, Number(url.searchParams.get("ofset") ?? 0) || 0);
  const adet = Math.min(50, Math.max(1, Number(url.searchParams.get("adet") ?? VARSAYILAN_ADET)));

  // Yalnız BOM rolündeki dosyalar; sıra kararlı olsun diye yola göre.
  const { data: hepsi, error: listeHatasi } = await supabase
    .from("drawing_files")
    .select("id, rel_path, file_name, storage_path")
    .eq("package_id", packageId)
    .eq("role", "bom")
    .order("rel_path");
  if (listeHatasi) {
    return NextResponse.json({ error: listeHatasi.message }, { status: 500 });
  }

  const toplam = hepsi?.length ?? 0;
  const dilim = (hepsi ?? []).slice(ofset, ofset + adet);

  let yazilanSatir = 0;
  const okunamayan: { file: string; reason: string }[] = [];

  for (const dosya of dilim) {
    const yol = (dosya.storage_path as string) || "";
    if (!yol) {
      okunamayan.push({ file: dosya.rel_path as string, reason: "depo yolu yok" });
      continue;
    }

    const { data: blob, error: indirmeHatasi } = await supabase.storage.from(BUCKET).download(yol);
    if (indirmeHatasi || !blob) {
      okunamayan.push({
        file: dosya.rel_path as string,
        reason: indirmeHatasi?.message ?? "indirilemedi",
      });
      continue;
    }

    let workbook: ExcelJS.Workbook;
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      workbook = new ExcelJS.Workbook();
      // exceljs kendi `Buffer` bildirimini taşıyor ve @types/node'un jenerik
      // `Buffer<ArrayBuffer>`ıyla yapısal olarak uyuşmuyor. Çalışma zamanında
      // ikisi aynı nesne; dönüştürme yalnız tip katmanındadır.
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch (e) {
      // Bozuk bir Excel BÜTÜN içe aktarmayı düşürmez: o dosya atlanır, sebebi
      // yazılır, kalanlar okunur.
      okunamayan.push({
        file: dosya.rel_path as string,
        reason: e instanceof Error ? e.message : "okunamadı",
      });
      continue;
    }

    const tur = parseBomFileName(dosya.file_name as string).kind;

    // Aynı dosya ikinci kez okunursa satırlar çiftlenmesin.
    await supabase.from("drawing_bom_rows").delete().eq("file_id", dosya.id);

    for (const ws of workbook.worksheets) {
      // exceljs 1 tabanlı ve seyrek; sütunlar `values[1..n]` içinde durur.
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: true }, (row) => {
        const degerler = row.values as unknown[];
        const satir: string[] = [];
        for (let c = 1; c <= ws.columnCount; c++) {
          const v = degerler?.[c];
          satir.push(hucreMetni(v));
        }
        rows.push(satir);
      });

      const okuma = readSheet(
        { fileRelPath: dosya.rel_path as string, sheetName: ws.name, rows },
        tur
      );
      if (okuma.rows.length === 0) continue;

      const kayitlar = okuma.rows.map((r) => ({
        package_id: packageId,
        file_id: dosya.id,
        sheet_name: r.sheetName,
        source_kind: r.sourceKind,
        row_no: r.rowNo,
        item_path: r.itemPath,
        part_number: r.partNumber,
        bom_structure: r.bomStructure,
        description: r.description,
        title: r.title,
        material_raw: r.materialRaw,
        item_qty_raw: r.itemQtyRaw,
        qty_raw: r.qtyRaw,
        category: r.category,
        mass_raw: r.massRaw,
        rev_raw: r.revRaw,
        extra: r.extra,
      }));

      for (let i = 0; i < kayitlar.length; i += 300) {
        const { error } = await supabase
          .from("drawing_bom_rows")
          .insert(kayitlar.slice(i, i + 300));
        if (error) {
          okunamayan.push({ file: `${dosya.rel_path}#${ws.name}`, reason: error.message });
          break;
        }
        yazilanSatir += kayitlar.slice(i, i + 300).length;
      }
    }
  }

  const sonrakiOfset = ofset + dilim.length;
  const kalan = Math.max(0, toplam - sonrakiOfset);

  if (kalan === 0) {
    await supabase
      .from("drawing_packages")
      .update({ parsed_at: new Date().toISOString() })
      .eq("id", packageId);
  }

  return NextResponse.json({
    toplam,
    islenen: dilim.length,
    yazilanSatir,
    kalan,
    sonraki: kalan > 0 ? sonrakiOfset : null,
    okunamayan,
  });
}

/**
 * Hücreyi metne çevirir.
 *
 * Hiçbir şey sayıya ZORLANMAZ: `QTY` sütunu çoğu satırda tam sayı ama
 * `Category = Testere` satırlarında bir kesim boyudur ("169,3 mm"). Ham metni
 * saklamak, o bilgiyi kaybetmemenin tek yolu.
 */
function hucreMetni(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Formül hücresi: sonucu; zengin metin: parçaların birleşimi; köprü: metni.
    if ("result" in o) return hucreMetni(o.result);
    if ("text" in o) return hucreMetni(o.text);
    if ("richText" in o && Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((p) => p.text ?? "").join("").trim();
    }
    if ("hyperlink" in o) return hucreMetni(o.hyperlink);
  }
  return String(v).trim();
}

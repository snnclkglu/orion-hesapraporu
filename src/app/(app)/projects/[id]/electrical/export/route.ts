// Elektrik malzeme listesi Excel çıktısı.
//
// İKİ SAYFA, İKİ SORU (ekrandaki iki görünümün aynısı):
//   "Malzeme Listesi" — sipariş edilebilir liste (aynı ürün tek satır)
//   "Aygıt Listesi"   — belgedeki ham satırlar (elektrikçinin okuduğu)
//
// `nodejs` çalışma zamanı: `exceljs` Node Buffer üretir.

import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import {
  loadCurrentElectricalDoc,
  loadElectricalParts,
} from "@/lib/electrical/data";
import { materialRows } from "@/lib/electrical/rollup";
import { HEADER_FILL, MONO_FONT, autoWidth } from "@/lib/excel/brand";
import { downloadFileName } from "@/lib/pdf/doc-naming";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  const { data: proje } = await supabase
    .from("projects")
    .select("name, doc_no, customer")
    .eq("id", id)
    .maybeSingle();
  const belge = await loadCurrentElectricalDoc(supabase, id);
  if (!belge) return new Response("Elektrik projesi bulunamadı", { status: 404 });

  const parts = await loadElectricalParts(supabase, belge.id);

  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION Cranes";

  const baslikYaz = (ws: ExcelJS.Worksheet, basliklar: string[]) => {
    const satir = ws.addRow(basliklar);
    satir.font = { bold: true };
    satir.eachCell((c) => {
      c.fill = HEADER_FILL;
    });
    ws.views = [{ state: "frozen", ySplit: satir.number }];
  };

  // ————————————————————————————————————————————— sayfa 1: malzeme
  const ws1 = wb.addWorksheet("Malzeme Listesi");
  baslikYaz(ws1, ["Adet", "Tanım", "Tip No", "Tedarikçi", "Malzeme Kodu", "Panolar"]);
  for (const m of materialRows(parts)) {
    // ADET NULL İSE HÜCRE BOŞ KALIR, `0` yazılmaz: sıfır bir ölçüm gibi
    // okunur ve yanlış sipariş ettirir (değişmez md. 4).
    ws1.addRow([
      m.qty ?? null,
      m.designation,
      m.typeNo,
      m.supplier,
      m.partNo,
      m.locations.map((l) => `+${l}`).join(" "),
    ]);
  }
  autoWidth(ws1);
  ws1.getColumn(5).font = { name: MONO_FONT };

  // ————————————————————————————————————————————— sayfa 2: aygıtlar
  const ws2 = wb.addWorksheet("Aygıt Listesi");
  baslikYaz(ws2, [
    "Aygıt Etiketi",
    "Tesis",
    "Pano",
    "Aygıt",
    "Adet",
    "Tanım",
    "Tip No",
    "Tedarikçi",
    "Malzeme Kodu",
    "Sayfa",
  ]);
  for (const p of parts) {
    ws2.addRow([
      p.deviceTag,
      p.installation,
      p.location ? `+${p.location}` : "",
      p.device,
      p.qty ?? null,
      p.designation,
      p.typeNo,
      p.supplier,
      p.partNo,
      p.page || null,
    ]);
  }
  autoWidth(ws2);
  ws2.getColumn(1).font = { name: MONO_FONT };

  const buf = await wb.xlsx.writeBuffer();
  // Dosya adı firma kuralındadır: İŞ ADI - DOKÜMAN KODU - TÜR (`doc-naming.ts`).
  const ad = downloadFileName(
    [proje?.name, proje?.doc_no, "ELEKTRİK MALZEME LİSTESİ", belge.revision],
    "xlsx"
  );
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
    },
  });
}

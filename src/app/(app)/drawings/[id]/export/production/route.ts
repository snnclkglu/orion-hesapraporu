// İmalat Listesi indirme ucu.
//
//     /drawings/<id>/export/production            → bütün orman
//     /drawings/<id>/export/production?kok=0043-00-0100  → yalnız o alt ağaç
//
// AĞAÇ TEK KÖKLÜ DEĞİLDİR: MONORAY'da 9, MTC'de 13 kök var ve `0043-00-0000`
// bir genel görünüş resmidir, "paketin tamamı" değil. Kök parametresi bu
// yüzden zorunlu değil, SEÇENEKtir.
//
// Birleşik PDF (bütün ölçülü resimlerin tek dosyada birleştirilmesi) pdf-lib
// gerektirir ve ERTELENDİ; künyeye bu not düşer.

import type { NextRequest } from "next/server";
import { imalatKokleri, imalatListesi } from "@/lib/drawings/derive";
import { buildImalatWorkbook } from "@/lib/excel/drawing-outputs";
import { exportBaglami, xlsxYaniti } from "../shared";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sonuc = await exportBaglami(id);
  if ("hata" in sonuc) return sonuc.hata;
  const { ctx } = sonuc;

  const kokKod = (request.nextUrl.searchParams.get("kok") ?? "").trim();
  const kokler = imalatKokleri(ctx.parts, ctx.kalemNo);
  const imalat = imalatListesi(ctx.parts, kokKod);

  const wb = buildImalatWorkbook({ imalat, kokler }, ctx.meta);

  return xlsxYaniti(wb, [
    ctx.isAdi,
    ctx.belgeKodu,
    "İmalat Listesi",
    imalat.kokKod ? imalat.kokKod : null,
  ]);
}

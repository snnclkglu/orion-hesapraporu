// Kesim Listesi indirme ucu — kesimciye giden DXF dökümü.
//
// Malzeme × kalınlık başına BİR SAYFA açılır (MTC'de 23 sayfa + özet + künye).
// Tek sayfada gruplamak tezgâh başındaki adamı süzgeç kurmaya zorlardı; sayfa
// sekmesi onun için doğal ayraçtır.
//
//     /drawings/<id>/export/cutting

import type { NextRequest } from "next/server";
import { kesimListesi } from "@/lib/drawings/derive";
import { buildKesimWorkbook } from "@/lib/excel/drawing-outputs";
import { exportBaglami, xlsxYaniti } from "../shared";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sonuc = await exportBaglami(id);
  if ("hata" in sonuc) return sonuc.hata;
  const { ctx } = sonuc;

  const wb = buildKesimWorkbook({ kesim: kesimListesi(ctx.parts, ctx.files) }, ctx.meta);

  return xlsxYaniti(wb, [ctx.isAdi, ctx.belgeKodu, "Kesim Listesi"]);
}

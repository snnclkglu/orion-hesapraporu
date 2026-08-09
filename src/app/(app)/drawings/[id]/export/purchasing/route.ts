// Satın Alma Listesi indirme ucu.
//
// Dört sayfalık tek dosya: satın alınacaklar · sac ihtiyacı · profil-testere
// kesim · künye. Üçü de satınalmanın aynı gün sorduğu sorulardır ve tek
// dosyada gitmeleri, üç ayrı ekten daha az kaybolur.
//
//     /drawings/<id>/export/purchasing?pay=1,25

import type { NextRequest } from "next/server";
import { sacIhtiyaci, satinAlmaListesi, testereKesim } from "@/lib/drawings/derive";
import { buildSatinAlmaWorkbook } from "@/lib/excel/drawing-outputs";
import { exportBaglami, xlsxYaniti, yerlesimPayiOku } from "../shared";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sonuc = await exportBaglami(id);
  if ("hata" in sonuc) return sonuc.hata;
  const { ctx } = sonuc;

  const wb = buildSatinAlmaWorkbook(
    {
      satinAlma: satinAlmaListesi(ctx.parts),
      sac: sacIhtiyaci(ctx.parts, { yerlesimPayi: yerlesimPayiOku(request) }),
      testere: testereKesim(ctx.parts),
    },
    ctx.meta
  );

  return xlsxYaniti(wb, [ctx.isAdi, ctx.belgeKodu, "Satın Alma Listesi"]);
}

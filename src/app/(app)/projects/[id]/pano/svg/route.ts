// PANO ŞEMASININ SVG İNDİRMESİ.
//
// İNDİRİLEN DOSYA KENDİ BAŞINA YETER (`product-portal/nameplate.ts` ile aynı
// kural): tema değişkeni değil BASKI hex'i yazılır ve dış font referansı
// bırakılmaz. Dosya pano imalatçısına gider; orada `var(--oc-diagram-ink)`
// diye bir şey yoktur.
//
// Şema burada YENİDEN HESAPLANIR — plan saklanmıyor ve ekranın gördüğü ile
// dosyanın taşıdığı aynı saf fonksiyondan çıkar.

import { NextResponse } from "next/server";
import { diagramsToSvg } from "@/lib/diagrams/svg";
import {
  panoDizilimDiagram,
  panoIcYerlesimDiagram,
  panoKapakDiagram,
} from "@/lib/diagrams/panoLayout";
import { downloadFileName } from "@/lib/pdf/doc-naming";
import { loadPanoVerisi } from "../pano-data";
import type { Diagram } from "@/lib/diagrams/model";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const sorgu = Object.fromEntries(url.searchParams.entries());

  const veri = await loadPanoVerisi(id, sorgu);
  if (!veri) return new NextResponse("Proje bulunamadı.", { status: 404 });
  if (!veri.belgeVar || veri.parcaSayisi === 0) {
    return new NextResponse("Bu projede okunmuş bir elektrik projesi yok.", { status: 409 });
  }

  const { sonuc } = veri;
  // Tek bir pano istendiyse yalnız o basılır; yoksa bütün belge.
  const tekPano = url.searchParams.get("pano");
  const panolar = [...sonuc.room, ...sonuc.field];

  const cizimler: Diagram[] = [];
  if (tekPano) {
    const p = panolar.find((x) => x.code === tekPano);
    if (!p) return new NextResponse("Pano bulunamadı.", { status: 404 });
    cizimler.push(panoIcYerlesimDiagram({ panel: p, settings: sonuc.settings }));
    const kapak = panoKapakDiagram({ panel: p, settings: sonuc.settings });
    if (kapak) cizimler.push(kapak);
  } else {
    if (sonuc.room.length > 0) {
      cizimler.push(
        panoDizilimDiagram({
          panels: sonuc.room,
          baslik: "Elektrik odası pano dizilimi",
          not: `${sonuc.room.length} göz · ön görünüş`,
        })
      );
    }
    if (sonuc.field.length > 0) {
      cizimler.push(
        panoDizilimDiagram({
          panels: sonuc.field,
          baslik: "Saha panoları",
          not: `${sonuc.field.length} göz · ön görünüş`,
        })
      );
    }
    for (const p of panolar) {
      cizimler.push(panoIcYerlesimDiagram({ panel: p, settings: sonuc.settings }));
      const kapak = panoKapakDiagram({ panel: p, settings: sonuc.settings });
      if (kapak) cizimler.push(kapak);
    }
  }

  const svg = diagramsToSvg(cizimler, {
    baslik: `${veri.project.docNo} pano yerleşimi`,
    // PARMAK İZİ BELGEYE YAZILIR: indirilen dosya donmuş bir belgedir ve hangi
    // girdiye dayandığı ancak burada saklanabilir.
    aciklama: `ORION · ${veri.project.docNo} ${veri.project.name} · elektrik projesi ${
      veri.belgeRevizyon || veri.belgeAdi
    } · parmak izi ${sonuc.fingerprint} · ${new Date().toISOString().slice(0, 10)}`,
    // GÖRÜNÜR MÜREKKEP: imalatçı dosyayı bir görüntüleyicide açtığında ya da
    // BASTIĞINDA hangi girdiye dayandığını görebilmeli. Üstveride kalan bir
    // parmak izi kâğıtta yoktur; PDF altbilgisinde görünüyor, SVG'de
    // görünmüyordu (PANO-15).
    altbilgi: `ORION · ${veri.project.docNo} ${veri.project.name} · ${
      veri.belgeRevizyon || veri.belgeAdi
    } · parmak izi ${sonuc.fingerprint} · ${new Date().toISOString().slice(0, 10)}`,
  });

  const ad = downloadFileName(
    ["ORION", veri.project.docNo, veri.project.name, "PANO YERLEŞİMİ", tekPano],
    "svg"
  );

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ad}"`,
      "Cache-Control": "no-store",
    },
  });
}

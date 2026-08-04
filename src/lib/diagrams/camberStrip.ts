// Ana kiriş KAMBER ŞERİDİ (7.6) — atölye imalat çizimi.
//
// Kirişin yandan görünüşü boyunca perde (diyafram) noktaları işaretlenir; her
// noktanın ÜSTÜNDE kesimde verilecek ters sehim, ALTINDA kiriş sehpaya
// alındığında ölçülmesi beklenen değer yazar. Atölyede kullanılan kamber
// şeridinin birebir karşılığıdır: sacı bu kotlara göre keser, kirişi ürettikten
// sonra mesnette bu kotları ölçerek doğrular.
//
// Ölçüler mm; kotlar CMAA 70 md. 3.5.5.2 (bkz. lib/calc/camber.ts).

import type { CamberStation } from "@/lib/calc/camber";
import {
  DCOL, type Diagram, type DiagramEl,
  fitDiagram, fmtN, ln, txt,
} from "./model";

export interface CamberStripParams {
  spanMm: number;
  stations: CamberStation[];
  /** Kullanılan istasyon adımı [mm] — başlık notunda gösterilir */
  spacingMm: number;
  /** Perde aralığı seyreltildiyse not düşülür */
  thinned?: boolean;
}

const W = 900;
const H = 286;

/** Kirişin yandan görünüşü: uçlarda pahlı (şematik kutu kiriş silueti) */
function pushGirderOutline(els: DiagramEl[], xL: number, xR: number, yTop: number, yBot: number) {
  const chamfer = Math.min(46, (xR - xL) * 0.06);
  const inset = 16;
  els.push({
    kind: "path",
    d:
      `M ${xL} ${yTop} L ${xR} ${yTop} L ${xR} ${yBot - inset} ` +
      `L ${xR - chamfer} ${yBot} L ${xL + chamfer} ${yBot} L ${xL} ${yBot - inset} Z`,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
}

export function camberStripDiagram(p: CamberStripParams): Diagram {
  const els: DiagramEl[] = [];
  const stations = p.stations ?? [];

  els.push(txt(16, 22, "ANA KİRİŞ — KAMBER ŞERİDİ", 11, { bold: true }));
  els.push(
    txt(
      16, 34,
      `ters sehim kotları [mm] · perde aralığı ${fmtN(p.spacingMm)} mm` +
        (p.thinned ? " (şeride sığması için seyreltildi)" : ""),
      8, { fill: DCOL.muted }
    )
  );
  els.push(ln(16, 40, W - 16, 40, DCOL.line, 0.8));

  if (stations.length < 3 || !(p.spanMm > 0)) {
    els.push(txt(W / 2, 120, "Kamber kotları hesaplanamadı", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }

  // Satır adları ("Kesimde" / "Mesnette") kot şeridinin SOLUNDA ayrı bir
  // sütunda durur; şerit bu sütundan sonra başlar. Aksi hâlde en soldaki
  // istasyonun kotu ("0") etiketin üzerine biniyordu.
  const labelCol = 74;
  const xL = labelCol + 34;
  const xR = W - 34;
  const yTop = 118;
  const yBot = 186;
  const yCut = 76;   // kesimde kot satırı
  const ySup = 228;  // mesnette kot satırı
  const xAt = (xMm: number) => xL + (xMm / p.spanMm) * (xR - xL);

  pushGirderOutline(els, xL, xR, yTop, yBot);

  els.push(txt(16, yCut, "KESİMDE", 8.5, { fill: DCOL.accent, bold: true }));
  els.push(txt(16, yCut + 11, "kesim kotu", 6.5, { fill: DCOL.muted }));
  els.push(txt(16, ySup, "MESNETTE", 8.5, { fill: DCOL.accent, bold: true }));
  els.push(txt(16, ySup + 11, "ölçüm kotu", 6.5, { fill: DCOL.muted }));

  // Kot yazıları birbirine girmesin: yazı boyu istasyon sayısına göre küçülür.
  const size = stations.length <= 15 ? 8.5 : stations.length <= 25 ? 7 : 5.8;

  stations.forEach((st, i) => {
    const x = xAt(st.xMm);
    const isEnd = i === 0 || i === stations.length - 1;
    const isMid = st.fromCenterMm === 0;
    // Perde çizgisi — uçlar kesikli (teker ekseni), orta eksen vurgulu
    els.push(
      ln(
        x, yTop + 1, x, yBot - 1,
        isMid ? DCOL.accent : isEnd ? DCOL.faint : DCOL.muted,
        isMid ? 1.1 : 0.7,
        isEnd ? "3,3" : undefined
      )
    );
    els.push(txt(x, yCut, fmtN(st.cuttingMm, 1), size, { anchor: "middle", fill: DCOL.accent, bold: isMid }));
    els.push(txt(x, ySup, fmtN(st.supportedMm, 1), size, { anchor: "middle", fill: DCOL.accent, bold: isMid }));
    // Kotu şeride bağlayan ince uzantılar
    els.push(ln(x, yCut + 4, x, yTop - 4, DCOL.faint, 0.5));
    els.push(ln(x, yBot + 4, x, ySup - 8, DCOL.faint, 0.5));
  });

  // Eksen adları — şeridin İÇİNE değil, dışına yazılır (silueti kirletmesin)
  const xMid = xAt(p.spanMm / 2);
  els.push(txt(xMid, yTop - 9, "ORTA EKSEN", 6.5, { anchor: "middle", fill: DCOL.accent }));
  els.push(txt(xL, yBot + 22, "TEKER EKSENİ", 6.5, { anchor: "middle", fill: DCOL.muted }));
  els.push(txt(xR, yBot + 22, "TEKER EKSENİ", 6.5, { anchor: "middle", fill: DCOL.muted }));

  // Açıklık bilgisi
  els.push(
    txt(W / 2, 258, `L = ${fmtN(p.spanMm / 1000, 2)} m · ${stations.length} istasyon · kotlar mm`, 8, {
      anchor: "middle", fill: DCOL.muted,
    })
  );

  return fitDiagram(els, W, H);
}

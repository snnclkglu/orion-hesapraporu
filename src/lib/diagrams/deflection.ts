// Ana kiriş sehim diyagramı (7.6) — araba ortadayken basit kirişin sehim
// eğrisi. Şematik: iki mesnet, ortada araba/yük oku, abartılı sehim eğrisi,
// orta noktada δ ölçüsü, açıklık L ve L/δ oranı (limit ile karşılaştırmalı).

import {
  DCOL, type Diagram, type DiagramEl,
  arrowHead, dimH, fitDiagram, fmtN, ln, txt,
} from "./model";

export interface DeflectionParams {
  spanM: number;               // açıklık L [m]
  deflectionMm: number;        // δ [mm] (hesaplanan) — vinç pratiğinde sehim mm ile konuşulur
  deflectionRatio?: number;    // L/δ
  limitRatio?: number;         // izin verilen L/δ (ör. 750)
}

const W = 560;
const H = 250;

export function deflectionDiagram(p: DeflectionParams): Diagram {
  const els: DiagramEl[] = [];
  const δ = Math.abs(p.deflectionMm ?? 0);
  const okColor = "#1F8A5B";
  const badColor = "#B4322F";
  const pass =
    p.deflectionRatio !== undefined && p.limitRatio !== undefined
      ? p.deflectionRatio >= p.limitRatio
      : undefined;

  // caption benzeri başlık
  els.push(txt(16, 22, "ANA KİRİŞ — SEHİM", 11, { bold: true }));
  els.push(txt(16, 34, "Araba Ortada · Basit Kiriş · Şematik", 8, { fill: DCOL.muted }));
  els.push(ln(16, 40, W - 16, 40, DCOL.line, 0.8));

  const xL = 70;
  const xR = W - 70;
  const xC = (xL + xR) / 2;
  const yBeam = 96;           // deforme olmamış kiriş ekseni
  const dip = 46;             // abartılı sehim (piksel) — okunurluk için sabit

  // Deforme olmamış eksen (kesikli referans)
  els.push(ln(xL, yBeam, xR, yBeam, DCOL.faint, 0.8, "5,3"));

  // Mesnetler (üçgen) — uçlarda
  const support = (x: number) => {
    els.push({ kind: "polygon", points: [[x, yBeam], [x - 11, yBeam + 20], [x + 11, yBeam + 20]], fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2 });
    els.push(ln(x - 16, yBeam + 20, x + 16, yBeam + 20, DCOL.ink, 1.2));
    // tarama
    for (let i = -14; i <= 12; i += 6) els.push(ln(x + i, yBeam + 26, x + i + 5, yBeam + 20, DCOL.muted, 0.6));
  };
  support(xL);
  support(xR);

  // Sehim eğrisi (kırmızı, kalın) — ortada dip kadar aşağı, kuadratik Bézier
  els.push({
    kind: "path",
    d: `M ${xL} ${yBeam} Q ${xC} ${yBeam + 2 * dip} ${xR} ${yBeam}`,
    fill: "none", stroke: DCOL.accent, strokeWidth: 2,
  });

  // Araba/yük oku (ortada, aşağı) — kiriş üstünden eksene
  els.push({ kind: "rect", x: xC - 26, y: yBeam - 34, w: 52, h: 16, rx: 2, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1 });
  els.push(txt(xC, yBeam - 22, "ARABA", 7.5, { anchor: "middle", fill: DCOL.ink }));
  els.push(ln(xC, yBeam - 18, xC, yBeam - 3, DCOL.accent, 1.8));
  els.push(arrowHead(xC, yBeam, "down", DCOL.accent, 8, 3.2));
  els.push(txt(xC + 8, yBeam - 8, "W", 9, { fill: DCOL.accent, bold: true }));

  // δ ölçüsü — orta noktada eksenden eğri dibine
  const yDip = yBeam + dip;
  els.push(ln(xC + 60, yBeam, xC + 60, yDip, DCOL.muted, 0.8));
  els.push(arrowHead(xC + 60, yBeam, "up", DCOL.muted));
  els.push(arrowHead(xC + 60, yDip, "down", DCOL.muted));
  els.push(ln(xC, yBeam, xC + 64, yBeam, DCOL.faint, 0.6));
  els.push(ln(xC, yDip, xC + 64, yDip, DCOL.faint, 0.6));
  els.push(txt(xC + 66, (yBeam + yDip) / 2 + 3, `δ = ${fmtN(δ, 2)} mm`, 9.5, { fill: DCOL.accent, bold: true }));

  // Açıklık L ölçüsü (altta)
  dimH(els, xL, xR, yBeam + 44, `L = ${fmtN(p.spanM, 2)} m`, { labelDy: 13 });

  // Oran kutusu
  if (p.deflectionRatio !== undefined) {
    const col = pass === undefined ? DCOL.ink : pass ? okColor : badColor;
    const lim = p.limitRatio !== undefined ? `  (izin: L/${fmtN(p.limitRatio)})` : "";
    els.push(txt(W / 2, H - 12, `L/δ = ${fmtN(p.deflectionRatio)}${lim}  ${pass === undefined ? "" : pass ? "✓" : "✗"}`, 9.5, {
      anchor: "middle", fill: col, bold: true,
    }));
  }

  return fitDiagram(els, W, H);
}

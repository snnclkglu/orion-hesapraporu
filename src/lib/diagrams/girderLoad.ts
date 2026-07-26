// Ana kiriş yükleme ve eğilme momenti diyagramı (7.2 Yükler). Köprü kirişi
// açıklık boyunca: dağılı öz ağırlık + ortadaki araba tekerlek yükleri + kanca
// yükü; mesnet reaksiyonları ve altta eğilme momenti (My) diyagramı. FEM 1.001
// §2.2 yük modeli; şematik (ölçekli değil), değerler etiketlenir.

import {
  DCOL, type Diagram, type DiagramEl,
  arrowHead, dimH, fmtN, ln, txt,
} from "./model";
import { KGF_TO_MPA } from "@/lib/units";

export interface GirderLoadParams {
  spanM: number;             // açıklık L
  wheelSpacingMm: number;    // araba tekerlek açıklığı a
  wheelLoadKg?: number;      // teker başına düşey yük P (araba + yük payı)
  selfWeightKg?: number;     // kiriş+başkiriş öz ağırlık payı (dağılı)
  liveLoadKg?: number;       // kaldırma yükü W1
  momentKgCm?: number;       // toplam eğilme momenti My (kg·cm)
}

const W = 620;
const H = 300;

export function girderLoadDiagram(p: GirderLoadParams): Diagram {
  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "ANA KİRİŞ — YÜKLER ve EĞİLME MOMENTİ", 11, { bold: true }));
  els.push(txt(16, 34, "araba ortada · FEM 1.001 §2.2 · şematik", 8, { fill: DCOL.muted }));
  els.push(ln(16, 40, W - 16, 40, DCOL.line, 0.8));

  const xL = 78;
  const xR = W - 78;
  const xC = (xL + xR) / 2;
  const yBeam = 118;

  // Kiriş gövdesi (kutu profil şematik)
  els.push({ kind: "rect", x: xL, y: yBeam - 7, w: xR - xL, h: 14, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3 });

  // Mesnetler (başkirişler) — uçlarda üçgen + reaksiyon oku
  const support = (x: number, label: string) => {
    els.push({ kind: "polygon", points: [[x, yBeam + 7], [x - 12, yBeam + 28], [x + 12, yBeam + 28]], fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2 });
    els.push(ln(x - 17, yBeam + 28, x + 17, yBeam + 28, DCOL.ink, 1.2));
    for (let i = -15; i <= 13; i += 6) els.push(ln(x + i, yBeam + 34, x + i + 5, yBeam + 28, DCOL.muted, 0.6));
    // reaksiyon oku (yukarı)
    els.push(ln(x, yBeam + 44, x, yBeam + 30, DCOL.accent, 1.6));
    els.push(arrowHead(x, yBeam + 29, "up", DCOL.accent, 7, 3));
    els.push(txt(x, yBeam + 56, label, 8.5, { anchor: "middle", fill: DCOL.accent, bold: true }));
  };
  support(xL, "R_A");
  support(xR, "R_B");

  // Dağılı öz ağırlık — küçük aşağı oklar
  for (let x = xL + 14; x <= xR - 14; x += 26) {
    els.push(ln(x, yBeam - 26, x, yBeam - 9, DCOL.muted, 0.8));
    els.push(arrowHead(x, yBeam - 8, "down", DCOL.muted, 5, 2));
  }
  els.push(ln(xL + 8, yBeam - 26, xR - 8, yBeam - 26, DCOL.muted, 0.8));
  els.push(txt(xL + 20, yBeam - 30, `öz ağırlık w${p.selfWeightKg ? `  (≈${fmtN(p.selfWeightKg)} kg)` : ""}`, 8, { fill: DCOL.muted }));

  // Araba — ortada, iki tekerlek yükü (açıklık a)
  const halfA = 30; // piksel yarı-açıklık (şematik)
  const w1 = xC - halfA, w2 = xC + halfA;
  els.push({ kind: "rect", x: xC - 42, y: yBeam - 66, w: 84, h: 20, rx: 2, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1 });
  els.push(txt(xC, yBeam - 52, "ARABA", 8, { anchor: "middle", fill: DCOL.ink }));
  // asılı yük W1
  els.push(ln(xC, yBeam - 46, xC, yBeam - 34, DCOL.faint, 0.8, "2,2"));
  els.push({ kind: "circle", cx: xC, cy: yBeam - 30, r: 4, fill: "#FBEDEC", stroke: DCOL.accent, strokeWidth: 1 });
  if (p.liveLoadKg) els.push(txt(xC + 8, yBeam - 28, `W1 = ${fmtN(p.liveLoadKg)} kg`, 7.5, { fill: DCOL.accent }));
  // tekerlek yükleri (2 aşağı ok)
  for (const wx of [w1, w2]) {
    els.push(ln(wx, yBeam - 44, wx, yBeam - 9, DCOL.accent, 1.8));
    els.push(arrowHead(wx, yBeam - 8, "down", DCOL.accent, 8, 3.2));
  }
  els.push(txt(w1 - 4, yBeam - 30, "P", 9, { anchor: "end", fill: DCOL.accent, bold: true }));
  els.push(txt(w2 + 4, yBeam - 30, "P", 9, { fill: DCOL.accent, bold: true }));
  if (p.wheelLoadKg) els.push(txt(xC, yBeam - 74, `P ≈ ${fmtN(p.wheelLoadKg)} kg / teker`, 8, { anchor: "middle", fill: DCOL.accent }));
  // araba tekerlek açıklığı a
  dimH(els, w1, w2, yBeam - 2, `a = ${fmtN(p.wheelSpacingMm / 1000, 2)} m`, { size: 7.5, labelDy: 9, color: DCOL.muted });

  // Açıklık L
  dimH(els, xL, xR, yBeam + 70, `L = ${fmtN(p.spanM, 2)} m`, { labelDy: 13 });

  // --- Eğilme momenti diyagramı (My) — ortada tepe
  const yM0 = 250;
  const hM = 34;
  els.push(txt(16, yM0 - 6, "Eğilme momenti My", 8.5, { fill: DCOL.muted }));
  els.push(ln(xL, yM0, xR, yM0, DCOL.muted, 0.9));
  // dağılı (parabol) + tekil (üçgen) birleşimi → yumuşak tepe: kuadratik + orta pik
  els.push({
    kind: "path",
    d: `M ${xL} ${yM0} Q ${xC} ${yM0 + hM * 1.5} ${xR} ${yM0} L ${w2} ${yM0 + hM} L ${xC} ${yM0 + hM + 8} L ${w1} ${yM0 + hM} Z`,
    fill: DCOL.accentSoft, stroke: DCOL.accent, strokeWidth: 1.2,
  });
  els.push(ln(xC, yM0, xC, yM0 + hM + 8, DCOL.accent, 0.7, "3,2"));
  if (p.momentKgCm) {
    const nm = p.momentKgCm * KGF_TO_MPA; // kg·cm → N·m
    const label = nm >= 1000 ? `${fmtN(nm / 1000, 1)} kNm` : `${fmtN(nm)} Nm`;
    els.push(txt(xC, yM0 + hM + 22, `Mmaks = ${label}`, 9.5, { anchor: "middle", fill: DCOL.accent, bold: true }));
  }

  return { width: W, height: H, els };
}

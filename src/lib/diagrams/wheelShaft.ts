// Teker mili diyagramı — parametrik SVG üretici (5.2 / 6.2 bölümleri).
// Mesnetler (rulmanlar), teker ve yük gösterimi, a/b mesnet ölçüleri ve
// moment diyagramı (Mmaks etiketli). Model: iki mesnetli kiriş, tekerlek
// yükü a-b kesişiminde; RA = Pmaks/2.
//
// Teker genişliği verilmişse yük TEKİL değil bandaj genişliği boyunca YAYILI
// çizilir (bant boyunca ok dizisi + q şiddeti + b_teker ölçüsü) ve moment
// diyagramının tepesi sivri üçgen yerine PARABOLİK olarak düzleşir —
// M_kenar = Mmaks − q·b_t²/8. Genişlik yoksa eski tekil yük gösterimi kalır.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimH, fitDiagram, fmtN, ln, loadArrow, txt,
} from "./model";
import { KGF_TO_MPA } from "@/lib/units";

export interface WheelShaftParams {
  spanAMm: number;          // mesnet A → teker
  spanBMm: number;          // teker → mesnet B
  shaftDiaMm: number;       // mil çapı
  wheelLoadKg?: number;     // Pmaks (hesaplanan maksimum teker yükü)
  reactionAKg?: number;     // RA
  reactionBKg?: number;     // RB
  maxMomentKgCm?: number;   // Mmaks
  /** Teker genişliği = yükün yayıldığı bant boyu [mm]; 0 → tekil yük */
  loadBandCm?: number;
  /** Yayılı yük şiddeti q = Pmaks / b_t [kg/cm] */
  loadIntensityKgPerCm?: number;
}

const W = 660;
const H = 356;

export function wheelShaftDiagram(p: WheelShaftParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "TEKER MİLİ", "Mesnetler · Yük · Moment Diyagramı");

  const a = p.spanAMm / 10;
  const b = p.spanBMm / 10;
  if (!(a > 0) || !(b > 0)) {
    els.push(txt(W / 2, H / 2, "Mil Mesnet Ölçüleri (a, b) Eksik", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }

  const xA = 140;
  const xB = 540;
  const yAxis = 122;
  const xW = xA + (a / (a + b)) * (xB - xA);
  const hs = Math.min(30, Math.max(12, (p.shaftDiaMm / 10) * 2.2)); // mil kalınlığı [px]

  // --- Mil gövdesi + eksen çizgisi
  els.push({
    kind: "rect", x: xA - 34, y: yAxis - hs / 2, w: xB - xA + 68, h: hs,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  els.push(ln(xA - 46, yAxis, xB + 46, yAxis, DCOL.faint, 0.7, "12,3,2,3"));
  els.push(txt(xB + 52, yAxis + 3, `Ød = ${fmtN(p.shaftDiaMm)} mm`, 9.5));

  // --- Teker (mil üzerinde, yük noktasında)
  const rWheel = 40;
  els.push({
    kind: "circle", cx: xW, cy: yAxis, r: rWheel,
    fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.4,
  });
  els.push({
    kind: "circle", cx: xW, cy: yAxis, r: hs / 2 + 3,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1,
  });

  // --- Rulmanlar (yastık blokları) + mesnet üçgenleri
  for (const [x, label] of [[xA, "A"], [xB, "B"]] as const) {
    els.push({
      kind: "rect", x: x - 15, y: yAxis - hs / 2 - 6, w: 30, h: hs + 12,
      fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2, rx: 2,
    });
    // rulman: daire + çapraz
    els.push({ kind: "circle", cx: x, cy: yAxis, r: 8, stroke: DCOL.ink, strokeWidth: 1, fill: DCOL.paper });
    els.push(ln(x - 5, yAxis - 5, x + 5, yAxis + 5, DCOL.ink, 0.8));
    els.push(ln(x - 5, yAxis + 5, x + 5, yAxis - 5, DCOL.ink, 0.8));
    // mesnet üçgeni + zemin taraması
    const yBk = yAxis + hs / 2 + 6;
    els.push({
      kind: "polygon",
      points: [[x, yBk], [x - 16, yBk + 22], [x + 16, yBk + 22]],
      fill: "none", stroke: DCOL.ink, strokeWidth: 1.1,
    });
    els.push(ln(x - 24, yBk + 22, x + 24, yBk + 22, DCOL.ink, 1.1));
    for (let i = 0; i < 5; i++) {
      const hx = x - 20 + i * 10;
      els.push(ln(hx, yBk + 22, hx - 5, yBk + 28, DCOL.muted, 0.8));
    }
    els.push(txt(x, yBk + 40, `Rulman ${label}`, 8.5, { anchor: "middle", fill: DCOL.muted }));
  }

  // --- Teker yükü (kırmızı, alttan — ray teması)
  // Teker genişliği verilmişse yük TEKİL değil, bandaj genişliği boyunca
  // YAYILI gösterilir: bant boyunca dizilmiş kısa oklar + üstlerinde q şiddeti.
  const pxPerCm = (xB - xA) / (a + b);
  const bandCm = p.loadBandCm ?? 0;
  const bandPx = bandCm > 0 ? Math.max(14, bandCm * pxPerCm) : 0;
  const yTip = yAxis + rWheel + 4;
  // Yayılı gösterimde oklar kısaltılır: altına teker genişliği ölçüsü ve
  // Pmaks etiketi girecek, moment diyagramına da yer kalmalıdır.
  const yTail = yAxis + rWheel + (bandCm > 0 ? 40 : 52);
  if (bandPx > 0) {
    const x0 = xW - bandPx / 2;
    const x1 = xW + bandPx / 2;
    // Yayılı yükün taban çizgisi ve ok dizisi
    els.push(ln(x0, yTail, x1, yTail, DCOL.accent, 1.6));
    const steps = Math.max(3, Math.min(9, Math.round(bandPx / 14)));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (i * (x1 - x0)) / steps;
      loadArrow(els, x, yTail, yTip, { width: 1.1 });
    }
    dimH(els, x0, x1, yTail + 16, `b_teker = ${fmtN(bandCm * 10)} mm`, { size: 9 });
    els.push(txt(x1 + 12, yTail - 4,
      `q = ${fmtN((p.loadIntensityKgPerCm ?? 0) / 10)} kg/mm`, 9.5, { fill: DCOL.accent }));
    els.push(txt(xW, yTail + 34, `Pmaks = ${fmtN(p.wheelLoadKg)} kg  (Yayılı)`, 10, {
      anchor: "middle", fill: DCOL.accent, bold: true,
    }));
  } else {
    loadArrow(els, xW, yTail, yTip);
    els.push(txt(xW + 9, yAxis + rWheel + 40, `Pmaks = ${fmtN(p.wheelLoadKg)} kg`, 10, {
      fill: DCOL.accent, bold: true,
    }));
  }

  // --- Mesnet reaksiyonları RA / RB
  // Etiketler mesnetlerin DIŞINA yazılır: mesnet ekseninde ortalanınca
  // a/b ölçülerine giden kılavuz çizgileri yazının içinden geçiyordu.
  els.push(txt(xA - 22, yAxis - hs / 2 - 22, `RA = ${fmtN(p.reactionAKg)} kg`, 9, {
    anchor: "end", fill: DCOL.muted,
  }));
  els.push(txt(xB + 22, yAxis - hs / 2 - 22, `RB = ${fmtN(p.reactionBKg)} kg`, 9, {
    fill: DCOL.muted,
  }));

  // --- a / b ölçüleri (üstte)
  const yDim = 66;
  els.push(ln(xA, yAxis - hs / 2 - 10, xA, yDim - 4, DCOL.faint, 0.6));
  els.push(ln(xW, yAxis - rWheel - 4, xW, yDim - 4, DCOL.faint, 0.6));
  els.push(ln(xB, yAxis - hs / 2 - 10, xB, yDim - 4, DCOL.faint, 0.6));
  dimH(els, xA, xW, yDim, `a = ${fmtN(p.spanAMm)} mm`);
  dimH(els, xW, xB, yDim, `b = ${fmtN(p.spanBMm)} mm`);

  // --- Moment diyagramı (üçgen, tepe teker altında)
  const yM0 = 252;
  const hM = 56;
  els.push(txt(xA - 34, yM0 - 8, "Moment Diyagramı", 8.5, { fill: DCOL.muted }));
  els.push(ln(xA - 10, yM0, xB + 10, yM0, DCOL.muted, 0.9));
  // Tekil yükte diyagram ÜÇGENDİR; yayılı yükte bant boyunca PARABOLİKTİR ve
  // tepesi düzleşir — bandın uçlarında moment M_kenar = Mmaks − q·b_t²/8'dir.
  const mMax = Math.abs(p.maxMomentKgCm ?? 0);
  const q = p.loadIntensityKgPerCm ?? 0;
  const momentPoints: [number, number][] = [[xA, yM0]];
  if (bandPx > 0 && mMax > 0 && q > 0) {
    const halfCm = bandCm / 2;
    const samples = 8;
    for (let i = 0; i <= samples; i++) {
      const xCm = -halfCm + (i * bandCm) / samples;
      const m = mMax - (q * xCm * xCm) / 2;
      momentPoints.push([
        xW + (xCm / bandCm) * bandPx,
        yM0 + Math.max(0, m / mMax) * hM,
      ]);
    }
  } else {
    momentPoints.push([xW, yM0 + hM]);
  }
  momentPoints.push([xB, yM0]);
  els.push({
    kind: "polygon",
    points: momentPoints,
    fill: DCOL.accentSoft, stroke: DCOL.accent, strokeWidth: 1.2,
  });
  els.push(ln(xW, yM0, xW, yM0 + hM, DCOL.accent, 0.8, "4,3"));
  els.push(txt(xW, yM0 + hM + 16, `Mmaks = ${fmtN((p.maxMomentKgCm ?? 0) * KGF_TO_MPA)} Nm`, 10, {
    anchor: "middle", fill: DCOL.accent, bold: true,
  }));

  return fitDiagram(els, W, H);
}

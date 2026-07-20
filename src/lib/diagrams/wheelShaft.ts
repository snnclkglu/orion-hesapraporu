// Teker mili diyagramı — parametrik SVG üretici (5.2 / 6.2 bölümleri).
// Mesnetler (rulmanlar), teker ve yük oku, a/b mesnet ölçüleri ve basit
// üçgen moment diyagramı (Mmaks etiketli). Model: iki mesnetli kiriş,
// tekerlek yükü a-b kesişiminde (Excel: RA = Pmaks/2, Mmaks = RA·a).

import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimH, fmtN, ln, loadArrow, txt,
} from "./model";
import { KGF_TO_MPA } from "@/lib/units";

export interface WheelShaftParams {
  spanACm: number;          // mesnet A → teker
  spanBCm: number;          // teker → mesnet B
  shaftDiaCm: number;       // mil çapı
  wheelLoadKg?: number;     // Pmaks (hesaplanan maksimum teker yükü)
  reactionAKg?: number;     // RA
  reactionBKg?: number;     // RB
  maxMomentKgCm?: number;   // Mmaks
}

const W = 660;
const H = 356;

export function wheelShaftDiagram(p: WheelShaftParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "TEKER MİLİ", "mesnetler · yük · moment diyagramı");

  const a = p.spanACm;
  const b = p.spanBCm;
  if (!(a > 0) || !(b > 0)) {
    els.push(txt(W / 2, H / 2, "Mil mesnet ölçüleri (a, b) eksik", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return { width: W, height: H, els };
  }

  const xA = 140;
  const xB = 540;
  const yAxis = 122;
  const xW = xA + (a / (a + b)) * (xB - xA);
  const hs = Math.min(30, Math.max(12, p.shaftDiaCm * 2.2)); // mil kalınlığı [px]

  // --- Mil gövdesi + eksen çizgisi
  els.push({
    kind: "rect", x: xA - 34, y: yAxis - hs / 2, w: xB - xA + 68, h: hs,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  els.push(ln(xA - 46, yAxis, xB + 46, yAxis, DCOL.faint, 0.7, "12,3,2,3"));
  els.push(txt(xB + 52, yAxis + 3, `Ød = ${fmtN(p.shaftDiaCm)} cm`, 9.5));

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

  // --- Teker yükü oku (kırmızı, alttan — ray teması)
  loadArrow(els, xW, yAxis + rWheel + 52, yAxis + rWheel + 4);
  els.push(txt(xW + 9, yAxis + rWheel + 40, `Pmaks = ${fmtN(p.wheelLoadKg)} kg`, 10, {
    fill: DCOL.accent, bold: true,
  }));

  // --- Mesnet reaksiyonları RA / RB
  els.push(txt(xA, yAxis - hs / 2 - 26, `RA = ${fmtN(p.reactionAKg)} kg`, 9, {
    anchor: "middle", fill: DCOL.muted,
  }));
  els.push(txt(xB, yAxis - hs / 2 - 26, `RB = ${fmtN(p.reactionBKg)} kg`, 9, {
    anchor: "middle", fill: DCOL.muted,
  }));

  // --- a / b ölçüleri (üstte)
  const yDim = 66;
  els.push(ln(xA, yAxis - hs / 2 - 10, xA, yDim - 4, DCOL.faint, 0.6));
  els.push(ln(xW, yAxis - rWheel - 4, xW, yDim - 4, DCOL.faint, 0.6));
  els.push(ln(xB, yAxis - hs / 2 - 10, xB, yDim - 4, DCOL.faint, 0.6));
  dimH(els, xA, xW, yDim, `a = ${fmtN(a)} cm`);
  dimH(els, xW, xB, yDim, `b = ${fmtN(b)} cm`);

  // --- Moment diyagramı (üçgen, tepe teker altında)
  const yM0 = 252;
  const hM = 56;
  els.push(txt(xA - 34, yM0 - 8, "Moment diyagramı", 8.5, { fill: DCOL.muted }));
  els.push(ln(xA - 10, yM0, xB + 10, yM0, DCOL.muted, 0.9));
  els.push({
    kind: "polygon",
    points: [[xA, yM0], [xW, yM0 + hM], [xB, yM0]],
    fill: DCOL.accentSoft, stroke: DCOL.accent, strokeWidth: 1.2,
  });
  els.push(ln(xW, yM0, xW, yM0 + hM, DCOL.accent, 0.8, "4,3"));
  els.push(txt(xW, yM0 + hM + 16, `Mmaks = ${fmtN((p.maxMomentKgCm ?? 0) * KGF_TO_MPA)} Nm`, 10, {
    anchor: "middle", fill: DCOL.accent, bold: true,
  }));

  return { width: W, height: H, els };
}

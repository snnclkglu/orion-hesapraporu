// Tambur mili yükleme şeması — parametrik SVG üretici (2.2.3 / 3.2.3).
//
// Teknik resimdeki A…G ölçü zincirini birebir yansıtır: solda redüktör tarafı
// mesnet (Ra), sağda tambur yatağı (Rg); aradaki namlu üzerinde yiv bölgeleri.
// Yükler: her yiv bölgesindeki halat yükü T (aşağı kırmızı ok) ve namlu
// ortasındaki tambur ağırlığı W. Mil uçlarında D1 (gerilme kesiti) ve D2
// (yatak oturma) çapları etiketlenir.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimH, fmtN, ln, loadArrow, txt,
} from "./model";
import { KGF_TO_MPA } from "@/lib/units";

export interface DrumShaftParams {
  /** Ölçü zinciri [cm] */
  aCm: number; bCm: number; cCm: number; dCm: number;
  eCm: number; fCm: number; gCm: number;
  /** Mil çapları [cm] */
  d1Cm: number;
  d2Cm: number;
  /** Tambur dış çapı [mm] — namlu yüksekliğinin ölçeklenmesi için */
  drumDiaMm?: number;
  /** Yükler ve sonuçlar */
  ropeLoadKg?: number;
  drumWeightKg?: number;
  ropePositionsCm?: number[];
  weightArmCm?: number;
  reactionGearboxKg?: number;
  reactionBearingKg?: number;
  momentGearboxKgCm?: number;
  momentBearingKgCm?: number;
  positionLabel?: string;
}

const W = 700;
const H = 432;

export function drumShaftDiagram(p: DrumShaftParams): Diagram {
  const els: DiagramEl[] = [];
  caption(
    els,
    "TAMBUR MİLİ — YÜKLEME ŞEMASI",
    p.positionLabel
      ? `iki mesnetli kiriş · halat konumu: ${p.positionLabel.toLocaleLowerCase("tr-TR")}`
      : "iki mesnetli kiriş · halat yükleri ve tambur ağırlığı"
  );

  const seg = {
    A: Math.max(0, p.aCm), B: Math.max(0, p.bCm), C: Math.max(0, p.cCm),
    D: Math.max(0, p.dCm), E: Math.max(0, p.eCm), F: Math.max(0, p.fCm),
    G: Math.max(0, p.gCm),
  };
  const span = seg.A + seg.B + seg.C + seg.D + seg.E + seg.F + seg.G;
  if (!(span > 0)) {
    els.push(txt(W / 2, H / 2, "Tambur mili ölçü zinciri (A…G) eksik", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return { width: W, height: H, els };
  }

  // --- ölçek: cm → px
  const xLeft = 92;
  const xRight = 612;
  const sx = (cm: number) => xLeft + (cm / span) * (xRight - xLeft);

  const yAxis = 158;                                  // mil ekseni
  const drumR = Math.min(56, Math.max(30, (p.drumDiaMm ?? 400) / 9)); // namlu yarı yüksekliği
  const shaftH1 = Math.min(22, Math.max(9, p.d1Cm * 1.9));
  const shaftH2 = Math.min(18, Math.max(7, p.d2Cm * 1.9));

  // ölçü zinciri sınır noktaları
  const xA = sx(0);                                    // Ra mesnedi
  const xPlateL = sx(seg.A);                           // sol yanak
  const xGrooveL0 = sx(seg.A + seg.B);
  const xGrooveL1 = sx(seg.A + seg.B + seg.C);
  const xGrooveR0 = sx(seg.A + seg.B + seg.C + seg.D);
  const xGrooveR1 = sx(seg.A + seg.B + seg.C + seg.D + seg.E);
  const xPlateR = sx(seg.A + seg.B + seg.C + seg.D + seg.E + seg.F);
  const xG = sx(span);                                 // Rg mesnedi

  // --- mil (uçlarda D2, yanak dibinde D1)
  els.push({
    kind: "rect", x: xA - 26, y: yAxis - shaftH2 / 2, w: xPlateL - xA + 26, h: shaftH2,
    fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.1,
  });
  els.push({
    kind: "rect", x: xPlateR, y: yAxis - shaftH2 / 2, w: xG - xPlateR + 26, h: shaftH2,
    fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.1,
  });
  // yanak dibindeki kalın kesit (D1)
  for (const [x0, w0] of [
    [xPlateL - 14, 14],
    [xPlateR, 14],
  ] as const) {
    els.push({
      kind: "rect", x: x0, y: yAxis - shaftH1 / 2, w: w0, h: shaftH1,
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1,
    });
  }

  // --- namlu gövdesi (yanaklar arası)
  els.push({
    kind: "rect", x: xPlateL, y: yAxis - drumR, w: xPlateR - xPlateL, h: drumR * 2,
    fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.3,
  });
  // yanaklar
  for (const x of [xPlateL, xPlateR]) {
    els.push({
      kind: "rect", x: x - 4, y: yAxis - drumR - 7, w: 8, h: (drumR + 7) * 2,
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3,
    });
  }
  // eksen çizgisi
  els.push(ln(xA - 34, yAxis, xG + 34, yAxis, DCOL.faint, 0.7, "12,3,2,3"));

  // --- yiv bölgeleri (küçük tırnaklar)
  for (const [g0, g1] of [
    [xGrooveL0, xGrooveL1],
    [xGrooveR0, xGrooveR1],
  ] as const) {
    if (g1 - g0 < 3) continue;
    const step = Math.max(5, (g1 - g0) / Math.max(4, Math.floor((g1 - g0) / 7)));
    for (let x = g0 + step / 2; x < g1; x += step) {
      els.push(ln(x, yAxis - drumR, x, yAxis - drumR + 8, DCOL.muted, 0.7));
      els.push(ln(x, yAxis + drumR, x, yAxis + drumR - 8, DCOL.muted, 0.7));
    }
  }

  // --- redüktör bloğu (sol) ve tambur yatağı (sağ)
  els.push({
    kind: "rect", x: xA - 74, y: yAxis - 32, w: 48, h: 64,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2, rx: 2,
  });
  els.push(txt(xA - 50, yAxis + 3, "REDÜKTÖR", 7.5, { anchor: "middle", fill: DCOL.muted }));
  els.push({
    kind: "rect", x: xG + 26, y: yAxis - 30, w: 44, h: 60,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2, rx: 2,
  });
  els.push(txt(xG + 48, yAxis + 3, "TAMBUR", 7.5, { anchor: "middle", fill: DCOL.muted }));
  els.push(txt(xG + 48, yAxis + 13, "YATAĞI", 7.5, { anchor: "middle", fill: DCOL.muted }));

  // --- mesnet sembolleri + reaksiyon okları (aşağıdan yukarı)
  const yBase = yAxis + drumR + 62;
  for (const [x, label, value] of [
    [xA, "Ra", p.reactionGearboxKg],
    [xG, "Rg", p.reactionBearingKg],
  ] as const) {
    els.push({
      kind: "circle", cx: x, cy: yAxis, r: shaftH2 / 2 + 4,
      fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.1,
    });
    els.push(ln(x - 4, yAxis - 4, x + 4, yAxis + 4, DCOL.ink, 0.8));
    els.push(ln(x - 4, yAxis + 4, x + 4, yAxis - 4, DCOL.ink, 0.8));
    loadArrow(els, x, yBase, yAxis + drumR + 12);
    els.push(txt(x, yBase + 15, `${label} = ${fmtN(value)} kg`, 10, {
      anchor: "middle", fill: DCOL.accent, bold: true,
    }));
  }

  // --- halatın yiv boyunca gezinme aralığı (ince gri bant)
  const yRange = yAxis - drumR - 16;
  for (const [g0, g1] of [
    [xGrooveL0, xGrooveL1],
    [xGrooveR0, xGrooveR1],
  ] as const) {
    if (g1 - g0 < 6) continue;
    els.push(ln(g0, yRange, g1, yRange, DCOL.faint, 1));
    els.push(ln(g0, yRange - 3, g0, yRange + 3, DCOL.faint, 1));
    els.push(ln(g1, yRange - 3, g1, yRange + 3, DCOL.faint, 1));
  }

  // --- halat yükleri T (yukarıdan aşağı)
  const yTop = yAxis - drumR - 58;
  const positions = p.ropePositionsCm ?? [];
  positions.forEach((cm, i) => {
    const x = sx(cm);
    loadArrow(els, x, yTop, yAxis - drumR - 10);
    els.push(txt(x, yTop - 6, `T${positions.length > 1 ? (i === 0 ? "₁" : "₂") : ""}`, 10, {
      anchor: "middle", fill: DCOL.accent, bold: true,
    }));
  });
  if (positions.length > 0) {
    els.push(txt(xLeft, 62, `T = ${fmtN(p.ropeLoadKg)} kg (her yiv bölgesinde)`, 9, {
      fill: DCOL.accent,
    }));
    els.push(
      txt(xRight, 62, "gri bant: halatın yiv boyunca gezinme aralığı", 8, {
        anchor: "end", fill: DCOL.muted,
      })
    );
  }

  // --- tambur ağırlığı W (namlu ortası)
  if (p.weightArmCm !== undefined) {
    const xW = sx(p.weightArmCm);
    loadArrow(els, xW, yTop - 22, yAxis - drumR - 10, { width: 2.4 });
    els.push(txt(xW + 8, yTop - 16, `W = ${fmtN(p.drumWeightKg)} kg`, 9.5, {
      fill: DCOL.accent, bold: true,
    }));
  }

  // --- D1 / D2 etiketleri (sağ uç)
  els.push(ln(xPlateR + 7, yAxis - shaftH1 / 2 - 3, xPlateR + 7, yAxis - drumR - 22, DCOL.faint, 0.6));
  els.push(txt(xPlateR + 10, yAxis - drumR - 24, `D1 = ${fmtN(p.d1Cm)} cm`, 8.5, { fill: DCOL.ink }));
  els.push(ln(xG, yAxis + shaftH2 / 2 + 3, xG, yAxis + drumR + 34, DCOL.faint, 0.6));
  els.push(txt(xG + 6, yAxis + drumR + 34, `D2 = ${fmtN(p.d2Cm)} cm`, 8.5, { fill: DCOL.ink }));

  // --- ölçü zinciri (altta)
  const yDim = yBase + 46;
  const marks: [number, number, string][] = [
    [0, seg.A, "A"],
    [seg.A, seg.B, "B"],
    [seg.A + seg.B, seg.C, "C"],
    [seg.A + seg.B + seg.C, seg.D, "D"],
    [seg.A + seg.B + seg.C + seg.D, seg.E, "E"],
    [seg.A + seg.B + seg.C + seg.D + seg.E, seg.F, "F"],
    [seg.A + seg.B + seg.C + seg.D + seg.E + seg.F, seg.G, "G"],
  ];
  for (const [from, len, label] of marks) {
    if (len <= 0) continue;
    const x1 = sx(from);
    const x2 = sx(from + len);
    els.push(ln(x1, yAxis + drumR + 8, x1, yDim - 5, DCOL.faint, 0.5));
    // Dar bölümlerde ölçü sığmaz → yalnız harf; değerler alttaki listede
    dimH(els, x1, x2, yDim, x2 - x1 > 40 ? `${label} = ${fmtN(len)}` : label, { size: 8.5 });
  }
  els.push(ln(sx(span), yAxis + drumR + 8, sx(span), yDim - 5, DCOL.faint, 0.5));
  dimH(els, xA, xG, yDim + 26, `L = ${fmtN(span)} cm`, { size: 9.5 });
  // Ölçü listesi — dar bölümlerin değerleri de okunabilsin
  els.push(
    txt(
      W / 2,
      yDim + 44,
      marks
        .filter(([, len]) => len > 0)
        .map(([, len, label]) => `${label}=${fmtN(len)}`)
        .join("  ·  ") + "  cm",
      8.5,
      { anchor: "middle", fill: DCOL.muted }
    )
  );

  // --- moment özeti
  const mA = (p.momentGearboxKgCm ?? 0) * KGF_TO_MPA;
  const mG = (p.momentBearingKgCm ?? 0) * KGF_TO_MPA;
  els.push(txt(xLeft, H - 8, `Ma = Ra · A = ${fmtN(mA)} Nm`, 9, { fill: DCOL.muted }));
  els.push(txt(xRight, H - 8, `Mg = Rg · G = ${fmtN(mG)} Nm`, 9, {
    anchor: "end", fill: DCOL.muted,
  }));

  return { width: W, height: H, els };
}

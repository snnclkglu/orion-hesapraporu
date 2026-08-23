// Ana kiriş 7.8 — kutu kiriş oranları ve basit dinamik ön tarama şeması.
// CMAA oranlarının geometrik tanımlarını ve FEM A-2.2.3'e dayalı SDOF ön
// modelini aynı resimde gösterir. ±20 frekans ayrımı ORION tarama kabulüdür;
// normatif FEM sınırı ya da modal analiz sonucu gibi sunulmaz.

import {
  DCOL,
  type Diagram,
  type DiagramEl,
  arrowHead,
  caption,
  dimH,
  dimV,
  fitDiagram,
  fmtN,
  ln,
  txt,
} from "./model";

export interface GirderDynamicsParams {
  spanM: number;
  heightMm: number;
  webGapMm: number;
  spanToDepthRatio?: number;
  spanToWidthRatio?: number;
  naturalFrequencyHz?: number;
  excitationFrequencyHz?: number;
  separationPct?: number;
}

export function girderDynamicsDiagram(p: GirderDynamicsParams): Diagram {
  // Masaüstü hesap kartının iç genişliği: 824 px diyagram + 16 px kapsayıcı
  // dolgusu. Böylece şema okunabilir boyutta kalırken yatay kaydırma açılmaz.
  const W = 824;
  const H = 330;
  const els: DiagramEl[] = [];
  caption(
    els,
    "ANA KİRİŞ — ORANLAR VE DİNAMİK ÖN TARAMA",
    "CMAA 70 §3.5.1 · FEM 1.001 A-2.2.3 model yaklaşımı"
  );

  // Kiriş görünüşü — yalnız oranların tanımını anlatan ölçek dışı şema.
  const x1 = 55, x2 = 500, beamY = 150, beamH = 46;
  els.push({
    kind: "rect", x: x1, y: beamY, w: x2 - x1, h: beamH,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  // Basit mesnetler.
  els.push({
    kind: "polygon",
    points: [[x1 + 14, beamY + beamH], [x1 + 2, beamY + beamH + 20], [x1 + 26, beamY + beamH + 20]],
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1,
  });
  els.push({
    kind: "polygon",
    points: [[x2 - 14, beamY + beamH], [x2 - 26, beamY + beamH + 20], [x2 - 2, beamY + beamH + 20]],
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1,
  });
  dimH(els, x1, x2, 234, `L = ${fmtN(p.spanM, 2)} m`, { labelDy: 15 });
  dimV(els, x2 + 22, beamY, beamY + beamH, `h = ${fmtN(p.heightMm, 0)} mm`);

  // Trolley/hoist possible excitation and first vertical mode shape.
  els.push(ln(x1, beamY - 8, (x1 + x2) / 2, beamY - 30, DCOL.accent, 1.2));
  els.push(ln((x1 + x2) / 2, beamY - 30, x2, beamY - 8, DCOL.accent, 1.2));
  els.push(txt((x1 + x2) / 2, beamY - 38, "1. düşey mod — şematik", 8.5, {
    anchor: "middle", fill: DCOL.accent,
  }));
  const beamCx = (x1 + x2) / 2;
  els.push(ln(beamCx, 68, beamCx, 112, DCOL.accent, 1.6));
  els.push(arrowHead(beamCx, 120, "down", DCOL.accent, 8, 3.2));
  els.push(txt(beamCx + 10, 86, `fd = ${fmtN(p.excitationFrequencyHz, 3)} Hz`, 9, {
    fill: DCOL.accent,
  }));

  // Kesit tanım kartı: b'nin flanş genişliği değil gövdeler arası açıklık
  // olduğunu resim üzerinde tartışmasız gösterir.
  const sx = 85, sy = 265, sw = 108, sh = 48;
  els.push({ kind: "rect", x: sx, y: sy, w: sw, h: sh, fill: "none", stroke: DCOL.ink, strokeWidth: 1 });
  els.push(ln(sx + 24, sy, sx + 24, sy + sh, DCOL.ink, 2.4));
  els.push(ln(sx + sw - 24, sy, sx + sw - 24, sy + sh, DCOL.ink, 2.4));
  dimH(els, sx + 26, sx + sw - 26, sy + 23, `b = ${fmtN(p.webGapMm, 0)} mm`, {
    size: 8, labelDy: -5,
  });
  els.push(txt(sx + sw + 12, sy + 16, "b = gövde sacları arası net mesafe", 8.5, { fill: DCOL.muted }));

  // Sağ özet paneli.
  const px = 560;
  els.push(ln(540, 58, 540, 306, DCOL.line, 1));
  els.push(txt(px, 78, "ÖN DEĞERLENDİRME", 10, { bold: true, fill: DCOL.accent }));
  const rows: [string, string, string?][] = [
    ["L / h", `${fmtN(p.spanToDepthRatio, 1)}  ≤ 25`, "CMAA"],
    ["L / b", `${fmtN(p.spanToWidthRatio, 1)}  ≤ 65`, "CMAA"],
    ["f1", `${fmtN(p.naturalFrequencyHz, 3)} Hz`, "SDOF"],
    ["fd", `${fmtN(p.excitationFrequencyHz, 3)} Hz`, "tambur"],
    ["frekans ayrımı", `%${fmtN(p.separationPct, 1)}  ≥ %20`, "ORION"],
  ];
  rows.forEach(([label, value, source], index) => {
    const y = 112 + index * 37;
    els.push(txt(px, y, label, 8.5, { fill: DCOL.muted }));
    // Uzun "frekans ayrımı" etiketi ile "%… ≥ %20" değeri birbirine
    // değmesin; kaynak sütunu da panelin sağ kenarında ayrı kalsın.
    els.push(txt(px + 160, y, value, 10, { anchor: "end", bold: true }));
    if (source) els.push(txt(px + 178, y, source, 7.5, { fill: DCOL.muted }));
    els.push(ln(px, y + 10, 804, y + 10, DCOL.line, 0.7));
  });
  els.push(txt(px, 304, "±20 bandı normatif FEM sınırı değildir.", 8, { fill: DCOL.accent }));

  return fitDiagram(els, W, H);
}

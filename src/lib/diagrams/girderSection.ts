// Ana kiriş kutu kesiti — parametrik SVG üretici (7.1 bölümü).
// GirderInputs plaka girdilerinden ölçekli kesit çizer: üst/alt başlık
// plakaları, çift gövde sacı, ek flanş, ray; t1..t6 etiketleri, b/h ölçü
// okları, hesaplanan tarafsız eksen (Cz yatay, Cy düşey — kırmızı kesikli).
//
// Kesit yerleşimi (`layoutBoxSection`) ve plaka/ray çizimi (`pushBoxPlates`,
// `pushRail`) dışa aktarılır: gerilme diyagramı (girderStress.ts) AYNI
// parametrik kesiti kullanır, ikinci bir şematik kutu çizilmez.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimH, dimV, fitDiagram, fmtN, ln, txt,
} from "./model";

/** Kutu kesitin plaka ölçüleri [mm] — kesit ve gerilme diyagramlarının ortak girdisi. */
export interface BoxPlateDims {
  railHeightMm: number;
  t1Mm: number; b1Mm: number;   // üst flanş (ray altı sacı)
  t2Mm: number; b2Mm: number;   // üst iç flanş
  t3Mm: number; h3Mm: number;   // ana gövde sacı
  t4Mm: number;                 // yardımcı gövde sacı
  t5Mm: number; b5Mm: number;   // alt flanş
  t6Mm: number; b6Mm: number;   // ek flanş
  aMm: number;                  // gövde sacları arası mesafe
  xMm: number;                  // kenar mesafesi (b2 sol kenarından)
}

export interface GirderSectionParams extends BoxPlateDims {
  /** Tarafsız eksen — alttan Cz [mm] (hesaplanmışsa) */
  czMm?: number;
  /** Tarafsız eksen — b2 sol kenarından Cy [mm] (hesaplanmışsa) */
  cyMm?: number;
}

/** Piksel cinsinden çözülmüş kesit yerleşimi. */
export interface BoxLayout {
  s: number;             // ölçek [px/mm]
  cx: number;            // b2 merkezinin x'i
  b2Left: number;
  web1X: number;         // ana gövde sacı sol yüzü
  web2X: number;         // yardımcı gövde sacı sol yüzü
  railCx: number;        // ray ekseni [px]
  railCenterYMm: number; // ray ekseni = b2 sol kenarından (x + t3/2) [mm]
  yB: number;            // kesit alt kenarı
  y6: number; y5: number; yWebTop: number; yWebBottom: number; y2: number; y1: number;
  railTop: number;       // ray mantarı üstü
  totalHMm: number;
  maxBMm: number;
  railHMm: number;
}

/** Çizim alanı tanımı (piksel). */
export interface BoxLayoutArea {
  cx: number;       // kesit merkezinin x'i
  drawW: number;    // ölçek için kullanılabilir genişlik
  drawH: number;    // ölçek için kullanılabilir yükseklik (ray dahil)
  areaTop: number;  // alanın üst y'si (dikey ortalama için)
  areaH: number;    // alanın yüksekliği
}

/**
 * Plaka ölçülerinden piksel yerleşimini çözer. Kesit geçersizse (yükseklik ya
 * da genişlik sıfır) `null` döner — çağıran uyarı metnini kendisi basar.
 */
export function layoutBoxSection(p: BoxPlateDims, a: BoxLayoutArea): BoxLayout | null {
  const totalHMm = p.t1Mm + p.t2Mm + p.h3Mm + p.t5Mm + p.t6Mm;
  const maxBMm = Math.max(p.b1Mm, p.b2Mm, p.b5Mm, p.b6Mm);
  if (!(totalHMm > 0) || !(maxBMm > 0)) return null;

  const railHMm = Math.max(0, p.railHeightMm);
  const s = Math.min(a.drawW / maxBMm, a.drawH / (totalHMm + railHMm));
  const contentH = (totalHMm + railHMm) * s;
  const yB = a.areaTop + (a.areaH - contentH) / 2 + contentH;

  const y6 = yB - p.t6Mm * s;
  const y5 = y6 - p.t5Mm * s;
  const yWebBottom = y5;
  const yWebTop = y5 - p.h3Mm * s;
  const y2 = yWebTop - p.t2Mm * s;
  const y1 = y2 - p.t1Mm * s;

  const b2Left = a.cx - (p.b2Mm * s) / 2;
  const web1X = b2Left + p.xMm * s;
  const web2X = b2Left + (p.xMm + p.t3Mm + p.aMm) * s;
  // Ray ana gövde sacı (web1) ekseninde durur; b1 "ray altı sacı" da bu eksende
  const railCenterYMm = p.xMm + p.t3Mm / 2;
  const railCx = b2Left + railCenterYMm * s;

  return {
    s, cx: a.cx, b2Left, web1X, web2X, railCx, railCenterYMm,
    yB, y6, y5, yWebTop, yWebBottom, y2, y1,
    railTop: y1 - railHMm * s,
    totalHMm, maxBMm, railHMm,
  };
}

/** Kesit plakalarını çizer (alttan üste). b1, RAY EKSENİNDE ortalanır. */
export function pushBoxPlates(els: DiagramEl[], p: BoxPlateDims, g: BoxLayout) {
  const plate = (x: number, y: number, w: number, h: number): DiagramEl => ({
    kind: "rect", x, y, w, h,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  const s = g.s;
  if (p.t6Mm > 0 && p.b6Mm > 0) els.push(plate(g.cx - (p.b6Mm * s) / 2, g.y6, p.b6Mm * s, p.t6Mm * s));
  if (p.t5Mm > 0 && p.b5Mm > 0) els.push(plate(g.cx - (p.b5Mm * s) / 2, g.y5, p.b5Mm * s, p.t5Mm * s));
  if (p.t3Mm > 0 && p.h3Mm > 0) els.push(plate(g.web1X, g.yWebTop, p.t3Mm * s, p.h3Mm * s));
  if (p.t4Mm > 0 && p.h3Mm > 0) els.push(plate(g.web2X, g.yWebTop, p.t4Mm * s, p.h3Mm * s));
  if (p.t2Mm > 0 && p.b2Mm > 0) els.push(plate(g.cx - (p.b2Mm * s) / 2, g.y2, p.b2Mm * s, p.t2Mm * s));
  // b1 (ray altı sacı) kirişin ortasında değil, RAYIN ortasında durur
  if (p.t1Mm > 0 && p.b1Mm > 0) els.push(plate(g.railCx - (p.b1Mm * s) / 2, g.y1, p.b1Mm * s, p.t1Mm * s));
}

/** Rayı çizer — ana gövde sacı (web1) ekseninde oturur. */
export function pushRail(els: DiagramEl[], g: BoxLayout, opts?: { label?: boolean }) {
  if (!(g.railHMm > 0)) return;
  const hr = g.railHMm * g.s;
  const fw = hr * 0.8;   // taban genişliği
  const hw = hr * 0.5;   // mantar
  const ww = hr * 0.22;  // gövde
  const footH = hr * 0.28;
  const headH = hr * 0.34;
  const yRB = g.y1;              // ray tabanı = kesit üstü
  const yR2 = yRB - footH;
  const yR3 = yRB - (hr - headH);
  const yR4 = yRB - hr;
  const railCx = g.railCx;
  els.push({
    kind: "polygon",
    points: [
      [railCx - fw / 2, yRB], [railCx + fw / 2, yRB], [railCx + fw / 2, yR2],
      [railCx + ww / 2, yR2], [railCx + ww / 2, yR3], [railCx + hw / 2, yR3],
      [railCx + hw / 2, yR4], [railCx - hw / 2, yR4], [railCx - hw / 2, yR3],
      [railCx - ww / 2, yR3], [railCx - ww / 2, yR2], [railCx - fw / 2, yR2],
    ],
    fill: "#EDE6E6", stroke: DCOL.accent, strokeWidth: 1.1,
  });
  // Ray merkez ekseni (kesikli) — b1 ve gövde sacıyla hizası görünsün
  els.push(ln(railCx, yR4 - 4, railCx, g.yWebBottom, DCOL.accent, 0.6, "3,3"));
  if (opts?.label !== false) {
    els.push(txt(railCx, yR4 - 7, "ray", 8, { anchor: "middle", fill: DCOL.accent }));
  }
}

const W = 660;
const H = 470;

export function girderSectionDiagram(p: GirderSectionParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "ANA KİRİŞ — KUTU KESİT", "parametrik çizim · ölçüler mm");

  const g = layoutBoxSection(p, { cx: 330, drawW: 280, drawH: 340, areaTop: 72, areaH: 356 });
  if (!g) {
    els.push(txt(W / 2, H / 2, "Kesit girdileri eksik veya geçersiz", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }
  const { s, cx, b2Left, web1X, web2X, yB, yWebTop, yWebBottom, y1, y2, y5, y6 } = g;
  const totalH = g.totalHMm;
  const maxB = g.maxBMm;

  pushBoxPlates(els, p, g);
  pushRail(els, g);

  // --- Plaka etiketleri (sol: t1/t3/t5, sağ: t2/t4/t6 — çakışma önleme aralıklı)
  const leftX = 148;
  const rightX = 512;
  const leader = (fromX: number, fromY: number, toX: number, toY: number) =>
    els.push(ln(fromX, fromY, toX, toY, DCOL.faint, 0.8));

  const spread = (ys: number[], minGap = 15): number[] => {
    const out = [...ys];
    for (let i = 1; i < out.length; i++) {
      if (out[i] - out[i - 1] < minGap) out[i] = out[i - 1] + minGap;
    }
    return out;
  };

  // Sol etiketler (açıklayıcı ad + sembol)
  const leftItems = [
    { y: y1 + (p.t1Mm * s) / 2, edgeX: g.railCx - (p.b1Mm * s) / 2, text: `ray altı sacı  t1 = ${fmtN(p.t1Mm)}` },
    { y: yWebTop + (p.h3Mm * s) * 0.32, edgeX: web1X, text: `gövde sacı  t3 = ${fmtN(p.t3Mm)}` },
    { y: y5 + (p.t5Mm * s) / 2, edgeX: cx - (p.b5Mm * s) / 2, text: `alt başlık  t5 = ${fmtN(p.t5Mm)}` },
  ];
  const leftYs = spread(leftItems.map((i) => i.y));
  leftItems.forEach((it, i) => {
    leader(it.edgeX - 2, it.y, leftX + 6, leftYs[i]);
    els.push(txt(leftX, leftYs[i] + 3, it.text, 9.5, { anchor: "end" }));
  });

  // Sağ etiketler (açıklayıcı ad + sembol)
  const rightItems = [
    { y: y2 + (p.t2Mm * s) / 2, edgeX: cx + (p.b2Mm * s) / 2, text: `t2 = ${fmtN(p.t2Mm)}  iç başlık` },
    { y: yWebTop + (p.h3Mm * s) * 0.32, edgeX: web2X + p.t4Mm * s, text: `t4 = ${fmtN(p.t4Mm)}  gövde sacı` },
    { y: y6 + (p.t6Mm * s) / 2, edgeX: cx + (p.b6Mm * s) / 2, text: `t6 = ${fmtN(p.t6Mm)}  ek flanş` },
  ];
  const rightYs = spread(rightItems.map((i) => i.y));
  rightItems.forEach((it, i) => {
    leader(it.edgeX + 2, it.y, rightX - 6, rightYs[i]);
    els.push(txt(rightX, rightYs[i] + 3, it.text, 9.5, { anchor: "start" }));
  });

  // --- Ölçü okları: b1 (üstte, ray ekseninde), b5 (altta), h (sağda), a (gövdeler arası)
  if (p.b1Mm > 0) {
    dimH(els, g.railCx - (p.b1Mm * s) / 2, g.railCx + (p.b1Mm * s) / 2, g.railTop - 16, `b1 = ${fmtN(p.b1Mm)}`);
  }
  if (p.b5Mm > 0) {
    dimH(els, cx - (p.b5Mm * s) / 2, cx + (p.b5Mm * s) / 2, yB + 20, `b5 = ${fmtN(p.b5Mm)}`, { labelDy: 13 });
  }
  // h — toplam kesit yüksekliği (sağ dış)
  const hX = Math.max(cx + (maxB * s) / 2, rightX + 62) + 26;
  els.push(ln(cx + (maxB * s) / 2 + 4, y1, hX + 4, y1, DCOL.faint, 0.6));
  els.push(ln(cx + (maxB * s) / 2 + 4, yB, hX + 4, yB, DCOL.faint, 0.6));
  dimV(els, hX, y1, yB, `h = ${fmtN(totalH)}`);
  // a — gövde sacları arası (net açıklık, geometriden)
  if (p.aMm > 0 && p.h3Mm > 0) {
    dimH(els, web1X + p.t3Mm * s, web2X, yWebTop + (p.h3Mm * s) * 0.62, `gövde arası a = ${fmtN(p.aMm)}`, { size: 8.5 });
  }
  // h3 — gövde (web) yüksekliği — sol iç
  if (p.h3Mm > 0) {
    const h3X = web1X - 12;
    dimV(els, h3X, yWebTop, yWebBottom, `h3 = ${fmtN(p.h3Mm)}`, { labelSide: "left", size: 8.5 });
  }
  // b2 — üst iç başlık genişliği (üstte, b1'in altında)
  if (p.b2Mm > 0) {
    dimH(els, cx - (p.b2Mm * s) / 2, cx + (p.b2Mm * s) / 2, y2 - 8, `b2 = ${fmtN(p.b2Mm)}`, { size: 8.5, labelDy: -3 });
  }

  // --- Tarafsız eksen (kırmızı kesikli)
  if (p.czMm !== undefined && Number.isFinite(p.czMm) && p.czMm > 0 && p.czMm < totalH) {
    const yNA = yB - p.czMm * s;
    els.push(ln(cx - (maxB * s) / 2 - 22, yNA, cx + (maxB * s) / 2 + 22, yNA, DCOL.accent, 1, "6,3"));
    els.push(txt(cx - (maxB * s) / 2 - 26, yNA + 3, `T.E. — Cz = ${fmtN(p.czMm)} mm`, 9, {
      anchor: "end", fill: DCOL.accent,
    }));
  }
  if (p.cyMm !== undefined && Number.isFinite(p.cyMm) && p.cyMm > 0 && p.cyMm < p.b2Mm) {
    const xNA = b2Left + p.cyMm * s;
    els.push(ln(xNA, y1 - 12, xNA, yB + 12, DCOL.accent, 1, "6,3"));
    els.push(txt(xNA + 4, yB + 10, `Cy = ${fmtN(p.cyMm)} mm`, 9, { fill: DCOL.accent }));
  }

  return fitDiagram(els, W, H);
}

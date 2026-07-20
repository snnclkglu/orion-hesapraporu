// Ana kiriş kutu kesiti — parametrik SVG üretici (7.1 bölümü).
// GirderInputs plaka girdilerinden ölçekli kesit çizer: üst/alt başlık
// plakaları, çift gövde sacı, ek flanş, ray; t1..t6 etiketleri, b/h ölçü
// okları, hesaplanan tarafsız eksen (Cz yatay, Cy düşey — kırmızı kesikli).

import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimH, dimV, fmtN, ln, txt,
} from "./model";

export interface GirderSectionParams {
  railHeightMm: number;
  t1Mm: number; b1Mm: number;   // üst flanş
  t2Mm: number; b2Mm: number;   // üst iç flanş
  t3Mm: number; h3Mm: number;   // ana gövde sacı
  t4Mm: number;                 // yardımcı gövde sacı
  t5Mm: number; b5Mm: number;   // alt flanş
  t6Mm: number; b6Mm: number;   // ek flanş
  aMm: number;                  // gövde sacları arası mesafe
  xMm: number;                  // kenar mesafesi (b2 sol kenarından)
  /** Tarafsız eksen — alttan Cz [mm] (hesaplanmışsa) */
  czMm?: number;
  /** Tarafsız eksen — b2 sol kenarından Cy [mm] (hesaplanmışsa) */
  cyMm?: number;
}

const W = 660;
const H = 470;

export function girderSectionDiagram(p: GirderSectionParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "ANA KİRİŞ — KUTU KESİT", "parametrik çizim · ölçüler mm");

  const totalH = p.t1Mm + p.t2Mm + p.h3Mm + p.t5Mm + p.t6Mm;
  const maxB = Math.max(p.b1Mm, p.b2Mm, p.b5Mm, p.b6Mm);
  if (!(totalH > 0) || !(maxB > 0)) {
    els.push(txt(W / 2, H / 2, "Kesit girdileri eksik veya geçersiz", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return { width: W, height: H, els };
  }

  const railH = Math.max(0, p.railHeightMm);
  // Çizim alanı: yükseklik 340px, genişlik 280px; ray dahil ölçek
  const s = Math.min(280 / maxB, 340 / (totalH + railH));
  const cx = 330;
  const contentH = (totalH + railH) * s;
  const yB = 72 + (356 - contentH) / 2 + contentH; // kesit alt kenarı
  const yTop = yB - totalH * s;                    // kesit üst kenarı (t1 üstü)

  const plate = (x: number, y: number, w: number, h: number): DiagramEl => ({
    kind: "rect", x, y, w, h,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });

  // --- Plakalar (alttan üste: t6/b6 → t5/b5 → gövdeler h3 → t2/b2 → t1/b1)
  const y6 = yB - p.t6Mm * s;
  const y5 = y6 - p.t5Mm * s;
  const yWebBottom = y5;
  const yWebTop = y5 - p.h3Mm * s;
  const y2 = yWebTop - p.t2Mm * s;
  const y1 = y2 - p.t1Mm * s;

  if (p.t6Mm > 0 && p.b6Mm > 0) els.push(plate(cx - (p.b6Mm * s) / 2, y6, p.b6Mm * s, p.t6Mm * s));
  if (p.t5Mm > 0 && p.b5Mm > 0) els.push(plate(cx - (p.b5Mm * s) / 2, y5, p.b5Mm * s, p.t5Mm * s));
  // Gövde sacları — konumlar b2 sol kenarına göre (x, t3, a, t4)
  const b2Left = cx - (p.b2Mm * s) / 2;
  const web1X = b2Left + p.xMm * s;
  const web2X = b2Left + (p.xMm + p.t3Mm + p.aMm) * s;
  if (p.t3Mm > 0 && p.h3Mm > 0) els.push(plate(web1X, yWebTop, p.t3Mm * s, p.h3Mm * s));
  if (p.t4Mm > 0 && p.h3Mm > 0) els.push(plate(web2X, yWebTop, p.t4Mm * s, p.h3Mm * s));
  if (p.t2Mm > 0 && p.b2Mm > 0) els.push(plate(cx - (p.b2Mm * s) / 2, y2, p.b2Mm * s, p.t2Mm * s));
  if (p.t1Mm > 0 && p.b1Mm > 0) els.push(plate(cx - (p.b1Mm * s) / 2, y1, p.b1Mm * s, p.t1Mm * s));

  // --- Ray (basitleştirilmiş profil, üst flanşın üzerinde ortalanır)
  if (railH > 0) {
    const hr = railH * s;
    const fw = hr * 0.8;   // taban yarı-genişlik ×2
    const hw = hr * 0.5;   // mantar
    const ww = hr * 0.22;  // gövde
    const footH = hr * 0.28;
    const headH = hr * 0.34;
    const yRB = y1;               // ray tabanı = kesit üstü
    const yR2 = yRB - footH;
    const yR3 = yRB - (hr - headH);
    const yR4 = yRB - hr;
    els.push({
      kind: "polygon",
      points: [
        [cx - fw / 2, yRB], [cx + fw / 2, yRB], [cx + fw / 2, yR2],
        [cx + ww / 2, yR2], [cx + ww / 2, yR3], [cx + hw / 2, yR3],
        [cx + hw / 2, yR4], [cx - hw / 2, yR4], [cx - hw / 2, yR3],
        [cx - ww / 2, yR3], [cx - ww / 2, yR2], [cx - fw / 2, yR2],
      ],
      fill: "#FFFFFF", stroke: DCOL.muted, strokeWidth: 1,
    });
  }

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

  // Sol etiketler
  const leftItems = [
    { y: y1 + (p.t1Mm * s) / 2, edgeX: cx - (p.b1Mm * s) / 2, text: `t1 = ${fmtN(p.t1Mm)}` },
    { y: yWebTop + (p.h3Mm * s) * 0.32, edgeX: web1X, text: `t3 = ${fmtN(p.t3Mm)}` },
    { y: y5 + (p.t5Mm * s) / 2, edgeX: cx - (p.b5Mm * s) / 2, text: `t5 = ${fmtN(p.t5Mm)}` },
  ];
  const leftYs = spread(leftItems.map((i) => i.y));
  leftItems.forEach((it, i) => {
    leader(it.edgeX - 2, it.y, leftX + 6, leftYs[i]);
    els.push(txt(leftX, leftYs[i] + 3, it.text, 9.5, { anchor: "end" }));
  });

  // Sağ etiketler
  const rightItems = [
    { y: y2 + (p.t2Mm * s) / 2, edgeX: cx + (p.b2Mm * s) / 2, text: `t2 = ${fmtN(p.t2Mm)}` },
    { y: yWebTop + (p.h3Mm * s) * 0.32, edgeX: web2X + p.t4Mm * s, text: `t4 = ${fmtN(p.t4Mm)}` },
    { y: y6 + (p.t6Mm * s) / 2, edgeX: cx + (p.b6Mm * s) / 2, text: `t6 = ${fmtN(p.t6Mm)}` },
  ];
  const rightYs = spread(rightItems.map((i) => i.y));
  rightItems.forEach((it, i) => {
    leader(it.edgeX + 2, it.y, rightX - 6, rightYs[i]);
    els.push(txt(rightX, rightYs[i] + 3, it.text, 9.5, { anchor: "start" }));
  });

  // --- Ölçü okları: b1 (üstte), b5 (altta), h (sağda), a (gövdeler arası)
  const railTop = y1 - railH * s;
  if (p.b1Mm > 0) {
    dimH(els, cx - (p.b1Mm * s) / 2, cx + (p.b1Mm * s) / 2, railTop - 16, `b1 = ${fmtN(p.b1Mm)}`);
  }
  if (p.b5Mm > 0) {
    dimH(els, cx - (p.b5Mm * s) / 2, cx + (p.b5Mm * s) / 2, yB + 20, `b5 = ${fmtN(p.b5Mm)}`, { labelDy: 13 });
  }
  // h — toplam kesit yüksekliği (sağ dış)
  const hX = Math.max(cx + (maxB * s) / 2, rightX + 62) + 26;
  els.push(ln(cx + (maxB * s) / 2 + 4, y1, hX + 4, y1, DCOL.faint, 0.6));
  els.push(ln(cx + (maxB * s) / 2 + 4, yB, hX + 4, yB, DCOL.faint, 0.6));
  dimV(els, hX, y1, yB, `h = ${fmtN(totalH)}`);
  // a — gövde sacları arası
  if (p.aMm > 0 && p.h3Mm > 0) {
    dimH(els, web1X + p.t3Mm * s, web2X, yWebTop + (p.h3Mm * s) * 0.62, `a = ${fmtN(p.aMm)}`, { size: 9 });
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

  return { width: W, height: H, els };
}

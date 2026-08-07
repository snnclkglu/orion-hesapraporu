// Kanca bloğu mili yükleme şeması — parametrik SVG üretici (4.4 bölümü).
//
// Makara sayısı donanıma bağlıdır (n = toplam halat / 2) ve diyagram buna göre
// KENDİNİ YENİDEN ÇİZER: 2 makaralı, 4 makaralı, 6 makaralı bloklarda makara
// adedi, konumları ve ölçü zinciri (A · B … D … B · A) otomatik değişir.
//
// Model: mil iki yan sac (mesnet) arasında basit kiriş; her makara 2T yükü
// taşır ve her makara altında bir çift rulman bulunur. Altta moment diyagramı
// çizilir.

import {
  DCOL, type Diagram, type DiagramEl,
  arrowHead, caption, dimH, fitDiagram, fmtN, ln, loadArrow, txt,
} from "./model";
import { KGF_TO_MPA } from "@/lib/units";

export interface HookBlockShaftParams {
  /** Makara eksenlerinin sol mesnete uzaklıkları [mm] */
  positionsMm: number[];
  /** Yan saclar arası açıklık [mm] */
  spanMm: number;
  /** Ölçü zinciri */
  edgeGapMm: number;
  pitchMm: number;
  centerGapMm: number;
  /** Mil çapı D1 [mm] */
  d1Mm: number;
  /** Makara çapı [mm] — makara dairelerinin ölçeği */
  sheaveDiaMm?: number;
  /** Yükler ve sonuçlar */
  ropeLoadKg?: number;
  reactionAKg?: number;
  reactionBKg?: number;
  maxMomentKgCm?: number;
  /** Makara rulmanı kodu (etiket) */
  bearingCode?: string;
}

const W = 700;
const H = 452;

export function hookBlockShaftDiagram(p: HookBlockShaftParams): Diagram {
  const els: DiagramEl[] = [];
  const n = p.positionsMm.length;
  caption(
    els,
    "KANCA BLOĞU MİLİ — YÜKLEME ŞEMASI",
    `${n} makara · her makarada 2T · mil Ø${fmtN(p.d1Mm)} mm`
  );

  if (!(p.spanMm > 0) || n === 0) {
    els.push(txt(W / 2, H / 2, "Mil ölçü zinciri (A, B, D) eksik", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }

  // --- ölçek
  const xLeft = 96;
  const xRight = 604;
  const sx = (mm: number) => xLeft + (mm / p.spanMm) * (xRight - xLeft);
  const yAxis = 196;                      // mil ekseni

  // makara yarıçapı: hem çapa hem komşu makara aralığına göre sınırlanır
  const pitchPx =
    n > 1
      ? Math.min(
          ...p.positionsMm.slice(1).map((x, i) => sx(x) - sx(p.positionsMm[i]))
        )
      : xRight - xLeft;
  const rSheave = Math.max(16, Math.min(52, pitchPx / 2 - 3, (p.sheaveDiaMm ?? 450) / 11));
  const shaftH = Math.max(8, Math.min(20, (p.d1Mm / 10) * 2.2));

  // --- mil gövdesi
  els.push({
    kind: "rect", x: sx(0) - 18, y: yAxis - shaftH / 2,
    w: sx(p.spanMm) - sx(0) + 36, h: shaftH,
    fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.3,
  });
  els.push(ln(sx(0) - 30, yAxis, sx(p.spanMm) + 30, yAxis, DCOL.faint, 0.7, "12,3,2,3"));

  // --- yan saclar (mesnetler)
  for (const [x, label, value] of [
    [sx(0), "Ra", p.reactionAKg],
    [sx(p.spanMm), "Rb", p.reactionBKg],
  ] as const) {
    els.push({
      kind: "rect", x: x - 7, y: yAxis - rSheave - 26, w: 14, h: (rSheave + 26) * 2,
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3,
    });
    // reaksiyon oku (yukarı)
    const yBase = yAxis + rSheave + 62;
    loadArrow(els, x, yBase, yAxis + rSheave + 30);
    els.push(txt(x, yBase + 15, `${label} = ${fmtN(value)} kg`, 10, {
      anchor: "middle", fill: DCOL.accent, bold: true,
    }));
  }
  els.push(txt(sx(0), yAxis - rSheave - 34, "yan sac", 8, {
    anchor: "middle", fill: DCOL.muted,
  }));
  els.push(txt(sx(p.spanMm), yAxis - rSheave - 34, "yan sac", 8, {
    anchor: "middle", fill: DCOL.muted,
  }));

  // --- makaralar + rulman çiftleri + 2T yük okları
  const yTop = yAxis - rSheave - 52;
  p.positionsMm.forEach((mm, i) => {
    const x = sx(mm);
    // makara gövdesi ve yiv
    els.push({
      kind: "circle", cx: x, cy: yAxis, r: rSheave,
      fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.4,
    });
    els.push({
      kind: "circle", cx: x, cy: yAxis, r: rSheave - 4,
      fill: "none", stroke: DCOL.faint, strokeWidth: 0.8,
    });
    // rulman çifti (milin üzerinde, makara göbeğinde)
    for (const dx of [-5, 5]) {
      els.push({
        kind: "rect", x: x + dx - 4, y: yAxis - shaftH / 2 - 5, w: 8, h: shaftH + 10,
        fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 0.9,
      });
    }
    // 2T yük oku (yukarıdan)
    loadArrow(els, x, yTop, yAxis - rSheave - 6);
    els.push(txt(x, yTop - 6, "2T", 10, {
      anchor: "middle", fill: DCOL.accent, bold: true,
    }));
    // makara numarası
    els.push(txt(x, yAxis + 4, String(i + 1), 9, {
      anchor: "middle", fill: DCOL.muted,
    }));
  });

  els.push(txt(xLeft, 62, `T = ${fmtN(p.ropeLoadKg)} kg · makara başına 2T`, 9, {
    fill: DCOL.accent,
  }));
  if (p.bearingCode) {
    els.push(
      txt(xRight, 62, `makara başına 2 adet ${p.bearingCode} rulman`, 8, {
        anchor: "end", fill: DCOL.muted,
      })
    );
  }

  // --- D1 etiketi
  const xMid = n > 1 ? (sx(p.positionsMm[0]) + sx(p.positionsMm[n - 1])) / 2 : sx(p.spanMm / 2);
  els.push(ln(xMid, yAxis + shaftH / 2, xMid, yAxis + rSheave + 14, DCOL.faint, 0.6));
  els.push(txt(xMid + 5, yAxis + rSheave + 16, `D1 = ${fmtN(p.d1Mm)} mm`, 8.5, {
    fill: DCOL.ink,
  }));

  // --- ölçü zinciri (altta): A · B … D … B · A
  const yDim = yAxis + rSheave + 108;
  const bounds = [0, ...p.positionsMm, p.spanMm];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    const len = to - from;
    if (len <= 0) continue;
    // etiket: uçlarda A, kümeler arası D, diğerleri B
    const isEdge = i === 0 || i === bounds.length - 2;
    const label = isEdge
      ? "A"
      : Math.abs(len - p.centerGapMm) < 1e-6 && n > 1
        ? "D"
        : "B";
    const x1 = sx(from);
    const x2 = sx(to);
    els.push(ln(x1, yAxis + rSheave + 30, x1, yDim - 5, DCOL.faint, 0.5));
    dimH(els, x1, x2, yDim, x2 - x1 > 40 ? `${label} = ${fmtN(len)}` : label, { size: 8.5 });
  }
  els.push(ln(sx(p.spanMm), yAxis + rSheave + 30, sx(p.spanMm), yDim - 5, DCOL.faint, 0.5));
  dimH(els, sx(0), sx(p.spanMm), yDim + 26, `L = ${fmtN(p.spanMm)} mm`, { size: 9.5 });

  // --- moment diyagramı (yük noktalarında kırılan çokgen)
  const yM0 = yDim + 54;
  const hM = 40;
  const P = 2 * (p.ropeLoadKg ?? 0);
  const Ra = p.reactionAKg ?? 0;
  const momentAt = (x: number) =>
    Ra * (x / 10) - p.positionsMm.reduce((s, xi) => s + (xi <= x ? P * ((x - xi) / 10) : 0), 0);
  const mMax = Math.max(1e-9, ...p.positionsMm.map(momentAt));
  const pts: [number, number][] = [
    [sx(0), yM0],
    ...p.positionsMm.map(
      (x) => [sx(x), yM0 + (momentAt(x) / mMax) * hM] as [number, number]
    ),
    [sx(p.spanMm), yM0],
  ];
  els.push(ln(sx(0) - 10, yM0, sx(p.spanMm) + 10, yM0, DCOL.muted, 0.9));
  els.push({
    kind: "polygon", points: pts,
    fill: DCOL.accentSoft, stroke: DCOL.accent, strokeWidth: 1.2,
  });
  els.push(txt(sx(0) - 12, yM0 - 6, "Moment diyagramı", 8, { fill: DCOL.muted }));
  els.push(
    txt(
      W / 2,
      yM0 + hM + 18,
      `Mmaks = ${fmtN((p.maxMomentKgCm ?? 0) * KGF_TO_MPA)} Nm`,
      10,
      { anchor: "middle", fill: DCOL.accent, bold: true }
    )
  );
  // moment tepesine ince gösterge
  const peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
  els.push(ln(peak[0], yM0, peak[0], peak[1], DCOL.accent, 0.7, "4,3"));
  els.push(arrowHead(peak[0], peak[1], "down", DCOL.accent, 6, 2.4));

  return fitDiagram(els, W, H);
}

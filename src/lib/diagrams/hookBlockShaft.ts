// Kanca bloğu mili yükleme şeması — parametrik SVG üretici (4.4 bölümü).
//
// Makara sayısı donanıma bağlıdır (n = toplam halat / 2) ve diyagram buna göre
// KENDİNİ YENİDEN ÇİZER: 2 makaralı, 4 makaralı, 6 makaralı bloklarda makara
// adedi, konumları ve merkezden verilen tek taraf ölçüleri otomatik değişir.
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
  /** Makara eksenlerinin mil modelinin sol ucuna uzaklıkları [mm] */
  positionsMm: number[];
  /** Mil modelinin toplam yükleme boyu [mm] */
  shaftLengthMm: number;
  /** Askı sacı mesnetlerinin sol uçtan konumları [mm] */
  supportPositionsMm: [number, number];
  /** Merkezden askı sacına ve tek taraftaki makaralara uzaklıklar [mm]. */
  supportOffsetMm: number;
  sheaveOffsetsMm: number[];
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

  if (!(p.shaftLengthMm > 0) || n === 0) {
    els.push(txt(W / 2, H / 2, "Merkezden askı sacı / makara ölçüleri eksik", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }

  // --- ölçek
  const xLeft = 96;
  const xRight = 604;
  const sx = (mm: number) => xLeft + (mm / p.shaftLengthMm) * (xRight - xLeft);
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
    w: sx(p.shaftLengthMm) - sx(0) + 36, h: shaftH,
    fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.3,
  });
  els.push(ln(sx(0) - 30, yAxis, sx(p.shaftLengthMm) + 30, yAxis, DCOL.faint, 0.7, "12,3,2,3"));

  // --- askı sacları (mesnetler)
  for (const [x, label, value] of [
    [sx(p.supportPositionsMm[0]), "Ra", p.reactionAKg],
    [sx(p.supportPositionsMm[1]), "Rb", p.reactionBKg],
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
  els.push(txt(sx(p.supportPositionsMm[0]), yAxis - rSheave - 34, "askı sacı", 8, {
    anchor: "middle", fill: DCOL.muted,
  }));
  els.push(txt(sx(p.supportPositionsMm[1]), yAxis - rSheave - 34, "askı sacı", 8, {
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
  const xMid = n > 1 ? (sx(p.positionsMm[0]) + sx(p.positionsMm[n - 1])) / 2 : sx(p.shaftLengthMm / 2);
  els.push(ln(xMid, yAxis + shaftH / 2, xMid, yAxis + rSheave + 14, DCOL.faint, 0.6));
  els.push(txt(xMid + 5, yAxis + rSheave + 16, `D1 = ${fmtN(p.d1Mm)} mm`, 8.5, {
    fill: DCOL.ink,
  }));

  // --- merkezden TEK TARAF ölçüleri (karşı taraf simetrik)
  const yDim = yAxis + rSheave + 108;
  const centerX = sx(p.shaftLengthMm / 2);
  const rightSupportX = sx(p.supportPositionsMm[1]);
  els.push(ln(centerX, yAxis + rSheave + 28, centerX, yDim + 22, DCOL.faint, 0.5));
  p.sheaveOffsetsMm.forEach((offset, i) => {
    const yy = yDim + i * 18;
    const toX = sx(p.shaftLengthMm / 2 + offset);
    els.push(ln(toX, yAxis + rSheave + 28, toX, yy - 4, DCOL.faint, 0.5));
    dimH(els, centerX, toX, yy, `m${i + 1} = ${fmtN(offset)} mm`, { size: 8.2 });
  });
  const supportY = yDim + p.sheaveOffsetsMm.length * 18;
  els.push(ln(rightSupportX, yAxis + rSheave + 28, rightSupportX, supportY - 4, DCOL.faint, 0.5));
  dimH(els, centerX, rightSupportX, supportY, `askı = ${fmtN(p.supportOffsetMm)} mm`, { size: 8.5 });
  dimH(
    els,
    sx(p.supportPositionsMm[0]),
    sx(p.supportPositionsMm[1]),
    supportY + 24,
    `L askı = ${fmtN(2 * p.supportOffsetMm)} mm`,
    { size: 9.2 }
  );

  // --- moment diyagramı (yük noktalarında kırılan çokgen)
  const yM0 = supportY + 50;
  const hM = 40;
  const P = 2 * (p.ropeLoadKg ?? 0);
  const Ra = p.reactionAKg ?? 0;
  const Rb = p.reactionBKg ?? 0;
  const supportA = p.supportPositionsMm[0];
  const supportB = p.supportPositionsMm[1];
  const momentAt = (x: number) =>
    Ra * (Math.max(0, x - supportA) / 10) +
    Rb * (Math.max(0, x - supportB) / 10) -
    p.positionsMm.reduce((s, xi) => s + (xi <= x ? P * ((x - xi) / 10) : 0), 0);
  const stations = [...new Set([0, p.shaftLengthMm, ...p.supportPositionsMm, ...p.positionsMm])]
    .sort((a, b) => a - b);
  const moments = stations.map(momentAt);
  const mMax = Math.max(1e-9, ...moments.map(Math.abs));
  const pts: [number, number][] = stations.map(
    (x) => [sx(x), yM0 + (momentAt(x) / mMax) * hM] as [number, number]
  );
  els.push(ln(sx(0) - 10, yM0, sx(p.shaftLengthMm) + 10, yM0, DCOL.muted, 0.9));
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
  const peak = pts.reduce((a, b) => (Math.abs(b[1] - yM0) > Math.abs(a[1] - yM0) ? b : a));
  els.push(ln(peak[0], yM0, peak[0], peak[1], DCOL.accent, 0.7, "4,3"));
  els.push(arrowHead(peak[0], peak[1], "down", DCOL.accent, 6, 2.4));

  return fitDiagram(els, W, H);
}

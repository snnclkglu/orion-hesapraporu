// Buruşma (plaka burkulması) bölümünün parametrik görselleri — FEM 1.001 A-3.4.
//
// Beş görsel:
//   1. bucklingPanelLayoutDiagram — kutu kesit üzerinde KONTROL EDİLEN paneller
//      (yan sac / üst sac) taranmış, b ölçüleri; yandan görünüşte perde aralığı a.
//   2. panelStressDiagram        — panelin kenar gerilme dağılımı σ1/σ2 + kayma
//      okları, ψ ve T.A.3.4.1'e göre hangi durum olduğu.
//   3. bucklingFactorChart       — Kσ ve Kτ'nun kenar oranı α ile değişimi,
//      çalışma noktası ve dal sınırları işaretli (gerçek grafik).
//   4. bucklingInteractionChart  — σ/σvcr – τ/τvcr etkileşim diyagramı; kritik
//      sınır, izin verilen sınır ve çalışma noktası.
//   5. rhoReductionChart         — T.A.3.4.2 orantı sınırı indirgemesi.
//
// Kesit çizimi ana kirişin kendi üreticisinden (girderSection.ts) gelir; ikinci
// bir şematik kutu çizilmez.

import {
  DCOL, type Diagram, type DiagramEl, diagramTitleCase,
  arrowHead, caption, dimH, dimV, fitDiagram, fmtN, ln, txt,
} from "./model";
import {
  CHART_COLORS,
  pushChartFrame, pushCurve, pushFunction, pushHGuide, pushLegend,
  pushPoint, pushUtilizationBar, pushVGuide,
} from "./chart";
import { layoutBoxSection, pushBoxPlates, pushRail, type BoxPlateDims } from "./girderSection";
import {
  BUCKLING_CASE_LABEL, RHO_TABLE, RHO_TABLE_STEEL, SQRT3,
  bucklingFactorSigma, bucklingFactorTau,
  reduceCriticalShear, reduceCriticalStress,
  type BucklingCaseNo, type BucklingSteel,
} from "@/lib/calc/plate-buckling";

const OK = CHART_COLORS.ok;
const BAD = CHART_COLORS.bad;
/** Taranan panel dolgusu — kesit dolgusundan ayırt edilir. */
const PANEL_FILL = "#F7E9E9";

/** Verilen dikdörtgeni 45° eğik çizgilerle tarar (panel vurgusu). */
function hatch(
  els: DiagramEl[], x: number, y: number, w: number, h: number,
  opts?: { step?: number; color?: string; width?: number }
) {
  const step = opts?.step ?? 7;
  const c = opts?.color ?? DCOL.accent;
  const lw = opts?.width ?? 0.55;
  if (!(w > 0) || !(h > 0)) return;
  for (let d = -h; d < w; d += step) {
    const x1 = Math.max(x, x + d);
    const y1 = y + Math.max(0, -d);
    const x2 = Math.min(x + w, x + d + h);
    const y2 = y1 + (x2 - x1);
    if (x2 > x1) els.push(ln(x1, y1, x2, y2, c, lw));
  }
}

// ----------------------------------------------------------- 1. Panel yerleşimi

export interface BucklingPanelLayoutParams extends BoxPlateDims {
  /** Yan sac (gövde) paneli: basınca dik genişlik b [mm] */
  sideWidthMm: number;
  /** Yan sac panelinin uzunluğu a — perde aralığı [mm] */
  sideLengthMm: number;
  /** Üst sac paneli genişliği b [mm] */
  topWidthMm: number;
  /** Üst sac paneli uzunluğu a [mm] */
  topLengthMm: number;
}

const LAY_W = 700;
const LAY_H = 430;

/**
 * Kutu kesit + kontrol edilen panellerin konumu. Sağda kirişin YANDAN görünüşü
 * vardır: perdeler ve iki perde arasındaki panel uzunluğu a burada okunur —
 * mühendisin "b nereden, a nereden" sorusu tek bakışta yanıtlanır.
 */
export function bucklingPanelLayoutDiagram(p: BucklingPanelLayoutParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "BURUŞMA — KONTROL EDİLEN PANELLER", "FEM 1.001 A-3.4 · Ölçüler mm");

  const g = layoutBoxSection(p, { cx: 205, drawW: 210, drawH: 250, areaTop: 78, areaH: 262 });
  if (!g) {
    els.push(txt(LAY_W / 2, LAY_H / 2, "Kesit Girdileri Eksik Veya Geçersiz", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, LAY_W, LAY_H);
  }
  pushBoxPlates(els, p, g);
  pushRail(els, g);

  const s = g.s;

  // --- Yan sac paneli: gövde sacının ÜST (basınç) bölgesinde, b yüksekliğinde
  const sideH = Math.min(p.h3Mm, Math.max(0, p.sideWidthMm)) * s;
  if (sideH > 0 && p.t3Mm > 0) {
    const px = g.web1X, py = g.yWebTop;
    // Panel kalınlığı çizimde ince kalır; okunur bir şerit genişliği kullanılır
    const pw = Math.max(p.t3Mm * s, 5);
    els.push({ kind: "rect", x: px, y: py, w: pw, h: sideH, fill: PANEL_FILL, stroke: DCOL.accent, strokeWidth: 1.3 });
    hatch(els, px, py, pw, sideH, { step: 5 });
    dimV(els, px - 14, py, py + sideH, `b = ${fmtN(p.sideWidthMm)}`, { labelSide: "left", size: 8.5 });
    els.push(ln(px - 16, py, px, py, DCOL.faint, 0.6));
    els.push(ln(px - 16, py + sideH, px, py + sideH, DCOL.faint, 0.6));
  }

  // --- Üst sac paneli: gövde sacları ARASINDAKİ üst başlık şeridi
  const topW = Math.min(p.aMm > 0 ? p.aMm : p.b2Mm, Math.max(0, p.topWidthMm)) * s;
  if (topW > 0 && p.t2Mm > 0) {
    const px = g.web1X + p.t3Mm * s;
    const py = g.y2;
    const ph = Math.max(p.t2Mm * s, 5);
    els.push({ kind: "rect", x: px, y: py, w: topW, h: ph, fill: PANEL_FILL, stroke: DCOL.accent, strokeWidth: 1.3 });
    hatch(els, px, py, topW, ph, { step: 5 });
    dimH(els, px, px + topW, py - 12, `b = ${fmtN(p.topWidthMm)}`, { size: 8.5, labelDy: -5 });
  }

  // --- Panel etiketleri (kesitin solunda / üstünde)
  els.push(txt(g.web1X + 14, g.yWebTop + Math.max(18, sideH / 2), "YAN SAC", 9, {
    fill: DCOL.accent, bold: true,
  }));
  els.push(txt(g.web1X + p.t3Mm * s + topW / 2, g.y2 - 24, "ÜST SAC", 9, {
    anchor: "middle", fill: DCOL.accent, bold: true,
  }));

  // --- Yandan görünüş: perdeler ve panel uzunluğu a
  const evX = 430;
  const evW = 236;
  const evTop = 130;
  const evH = Math.min(150, Math.max(60, p.h3Mm * s));
  els.push(txt(evX, evTop - 26, "YANDAN GÖRÜNÜŞ", 9, { fill: DCOL.ink, bold: true }));
  els.push(txt(evX, evTop - 14, "Panel Uzunluğu = İki Perde Arası", 8, { fill: DCOL.muted }));
  // Üst ve alt başlık çizgileri
  els.push({ kind: "rect", x: evX, y: evTop, w: evW, h: evH, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2 });
  // Perdeler — üç adet, ortadaki iki panel görünür
  const bays = 2;
  for (let i = 0; i <= bays; i++) {
    const x = evX + (evW * i) / bays;
    els.push(ln(x, evTop, x, evTop + evH, DCOL.ink, 1.6));
    els.push(txt(x, evTop + evH + 26, "Perde", 7.5, { anchor: "middle", fill: DCOL.muted }));
  }
  // Panel taraması (ilk göz)
  hatch(els, evX + 1.5, evTop + 1.5, evW / bays - 3, evH - 3, { step: 8, color: DCOL.accent, width: 0.5 });
  dimH(els, evX, evX + evW / bays, evTop + evH + 14, `a = ${fmtN(p.sideLengthMm)}`, { size: 8.5, labelDy: 12 });
  dimV(els, evX + evW + 16, evTop, evTop + evH, "b", { size: 8.5 });
  // Basınç okları (üst kenar) — panelin hangi yönde sıkıştığını gösterir
  for (let i = 0; i <= 4; i++) {
    const x = evX + 12 + (i * (evW / bays - 24)) / 4;
    els.push(ln(x, evTop - 16, x, evTop - 5, DCOL.accent, 1.1));
    els.push(arrowHead(x, evTop - 3, "down", DCOL.accent, 6, 2.4));
  }
  els.push(txt(evX + evW / bays / 2, evTop - 20, "Basınç", 8, { anchor: "middle", fill: DCOL.accent }));

  els.push(
    txt(14, LAY_H - 10,
      "b = Basınç Kuvvetlerine DİK Ölçü · a = Basınç Yönündeki Ölçü (Perde Aralığı) · α = a / b",
      8.5, { fill: DCOL.muted })
  );

  return fitDiagram(els, LAY_W, LAY_H);
}

// ------------------------------------------------------- 2. Kenar gerilmeleri

export interface PanelStressParams {
  title: string;
  /** Belirleyici basınç kenarı gerilmesi (POZİTİF) [N/mm²] */
  sigma1: number;
  /** Diğer kenar; çekme ise negatif [N/mm²] */
  sigma2: number;
  tau: number;
  psi: number;
  widthMm: number;
  lengthMm: number;
  alpha: number;
  /** T.A.3.4.1'de hangi durum — MOTORDAN gelir, burada yeniden türetilmez */
  caseNo: BucklingCaseNo;
}

const PS_W = 560;
const PS_H = 300;

/**
 * Panelin kenar gerilme dağılımı. Sol tarafta panel dikdörtgeni, sağında σ
 * dağılımının doğrusal diyagramı (basınç kırmızı dolgu, çekme gri), panelin
 * kenarlarında kayma okları. Alt satırda ψ ve T.A.3.4.1 durumu yazılıdır.
 */
export function panelStressDiagram(p: PanelStressParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, p.title, "Kenar Gerilmeleri · Basınç POZİTİF · FEM 1.001 T.A.3.4.1");

  const x0 = 70, y0 = 70, w = 150, h = 160;
  // Panel gövdesi
  els.push({ kind: "rect", x: x0, y: y0, w, h, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3 });
  hatch(els, x0, y0, w, h, { step: 12, color: DCOL.faint, width: 0.5 });
  dimV(els, x0 - 16, y0, y0 + h, `b = ${fmtN(p.widthMm)}`, { labelSide: "left", size: 8.5 });
  dimH(els, x0, x0 + w, y0 + h + 16, `a = ${fmtN(p.lengthMm)}`, { size: 8.5, labelDy: 12 });
  els.push(txt(x0 + w / 2, y0 + h / 2 + 3, `α = ${fmtN(p.alpha, 3)}`, 9.5, {
    anchor: "middle", fill: DCOL.ink, bold: true,
  }));

  // Kayma okları — dört kenarda dönel yön
  const shearCol = Math.abs(p.tau) > 0 ? "#3A6EA5" : DCOL.faint;
  const sh = 13;
  els.push(ln(x0 + 18, y0 - 8, x0 + w - 18, y0 - 8, shearCol, 1.3));
  els.push(arrowHead(x0 + w - 16, y0 - 8, "right", shearCol, 7, 2.8));
  els.push(ln(x0 + w - 18, y0 + h + 8, x0 + 18, y0 + h + 8, shearCol, 1.3));
  els.push(arrowHead(x0 + 16, y0 + h + 8, "left", shearCol, 7, 2.8));
  els.push(ln(x0 - 8, y0 + h - 18, x0 - 8, y0 + 18, shearCol, 1.3));
  els.push(arrowHead(x0 - 8, y0 + 16, "up", shearCol, 7, 2.8));
  els.push(ln(x0 + w + 8, y0 + 18, x0 + w + 8, y0 + h - 18, shearCol, 1.3));
  els.push(arrowHead(x0 + w + 8, y0 + h - 16, "down", shearCol, 7, 2.8));
  els.push(txt(x0 + w / 2, y0 - 13, `τ = ${fmtN(Math.abs(p.tau), 1)} N/mm²`, 8.5, {
    anchor: "middle", fill: shearCol,
  }));
  void sh;

  // --- σ dağılımı (sağda). Ölçek: en büyük mutlak gerilme = 88 px
  const dx = x0 + w + 78;          // sıfır ekseni
  const maxAbs = Math.max(Math.abs(p.sigma1), Math.abs(p.sigma2), 1e-9);
  const scale = 88 / maxAbs;
  const s1x = dx + p.sigma1 * scale;   // basınç POZİTİF → sağa
  const s2x = dx + p.sigma2 * scale;

  els.push(ln(dx, y0 - 12, dx, y0 + h + 12, DCOL.faint, 0.8, "4,3"));
  els.push(txt(dx, y0 - 16, "0", 8, { anchor: "middle", fill: DCOL.muted }));
  // Yamuk dolgu (üst kenar σ1, alt kenar σ2)
  els.push({
    kind: "polygon",
    points: [[dx, y0], [s1x, y0], [s2x, y0 + h], [dx, y0 + h]],
    fill: DCOL.accentSoft, stroke: DCOL.accent, strokeWidth: 1.3,
  });
  // Çekme bölgesi ayrı renkte gölgelenir (işaret değişimi görünsün)
  if (p.sigma2 < 0) {
    els.push(ln(dx, y0 + h, s2x, y0 + h, "#7A7470", 1.3));
  }
  els.push(ln(dx, y0, s1x, y0, DCOL.accent, 1.6));
  els.push(ln(dx, y0 + h, s2x, y0 + h, DCOL.accent, 1.6));
  els.push(txt(s1x + (p.sigma1 >= 0 ? 6 : -6), y0 + 4, `σ1 = ${fmtN(p.sigma1, 1)}`, 9, {
    anchor: p.sigma1 >= 0 ? "start" : "end", fill: DCOL.accent, bold: true,
  }));
  els.push(txt(s2x + (p.sigma2 >= 0 ? 6 : -6), y0 + h + 4, `σ2 = ${fmtN(p.sigma2, 1)}`, 9, {
    anchor: p.sigma2 >= 0 ? "start" : "end",
    fill: p.sigma2 >= 0 ? DCOL.accent : "#7A7470", bold: true,
  }));
  els.push(txt(dx + 96, y0 + h / 2, "Basınç →", 8, { fill: DCOL.muted }));
  if (p.sigma2 < 0) els.push(txt(dx - 96, y0 + h / 2, "← Çekme", 8, { fill: DCOL.muted }));

  // --- Alt satır: ψ ve durum
  const caseNo = p.caseNo;
  els.push(ln(14, PS_H - 44, PS_W - 14, PS_H - 44, DCOL.line, 0.8));
  els.push(txt(16, PS_H - 28, `ψ = σ2 / σ1 = ${fmtN(p.psi, 3)}`, 10, { fill: DCOL.ink, bold: true }));
  els.push(txt(16, PS_H - 13, diagramTitleCase(BUCKLING_CASE_LABEL[caseNo]), 8.5, { fill: DCOL.muted }));

  return fitDiagram(els, PS_W, PS_H);
}

// -------------------------------------------------- 3. Kσ / Kτ — α eğrileri

export interface BucklingFactorChartParams {
  alpha: number;
  psi: number;
  kSigma: number;
  kTau: number;
}

const FC_W = 600;
const FC_H = 330;

/**
 * Burkulma katsayılarının kenar oranıyla değişimi. Kσ eğrisi PANELİN KENDİ
 * ψ'siyle çizilir; böylece mühendis "α biraz değişse katsayı ne olurdu"
 * sorusunun yanıtını görür. Dal sınırları α = 2/3 ve α = 1'de kılavuz çizgidir.
 */
export function bucklingFactorChart(p: BucklingFactorChartParams): Diagram {
  const els: DiagramEl[] = [];
  const alphaMax = Math.max(3, Math.min(8, p.alpha * 1.4));
  const kMax = Math.max(
    12,
    Math.ceil(Math.max(p.kSigma, p.kTau, bucklingFactorSigma(0.5, p.psi), bucklingFactorTau(0.5)) / 5) * 5
  );

  const f = pushChartFrame(
    els,
    { x: 68, y: 62, w: 470, h: 200 },
    { min: 0, max: alphaMax, label: "α = a / b", format: (v) => fmtN(v, 1) },
    { min: 0, max: Math.min(kMax, 40), label: "Kσ , Kτ", format: (v) => fmtN(v, 0) },
    { title: "BURKULMA KATSAYILARI", note: `FEM 1.001 T.A.3.4.1 · ψ = ${fmtN(p.psi, 3)} İçin` }
  );

  // Dal sınırları
  pushVGuide(els, f, 2 / 3, "α = 2/3");
  pushVGuide(els, f, 1, "α = 1");

  // Eğriler (α → 0'da katsayılar patladığı için 0,25'ten başlanır)
  pushFunction(els, f, (a) => bucklingFactorSigma(a, p.psi), {
    from: 0.25, to: alphaMax, samples: 240, color: DCOL.accent, width: 1.8,
  });
  pushFunction(els, f, (a) => bucklingFactorTau(a), {
    from: 0.25, to: alphaMax, samples: 240, color: "#3A6EA5", width: 1.6, dash: "6,3",
  });

  pushPoint(els, f, p.alpha, p.kSigma, `Kσ = ${fmtN(p.kSigma, 2)}`, { color: DCOL.accent });
  pushPoint(els, f, p.alpha, p.kTau, `Kτ = ${fmtN(p.kTau, 2)}`, {
    color: "#3A6EA5", guides: false, dy: 12,
  });

  pushLegend(els, 68, 296, [
    { color: DCOL.accent, label: `Kσ (ψ = ${fmtN(p.psi, 2)}) — Basınç` },
    { color: "#3A6EA5", label: "Kτ — Saf Kayma", dash: "6,3" },
  ]);
  els.push(txt(300, 296, `Çalışma Noktası: α = ${fmtN(p.alpha, 3)}`, 8.5, { fill: DCOL.muted }));

  return fitDiagram(els, FC_W, FC_H);
}

// ------------------------------------------------- 4. Etkileşim diyagramı

export interface BucklingInteractionParams {
  /** σ / σvcr */
  sigmaRatio: number;
  /** τ / τvcr */
  tauRatio: number;
  psi: number;
  /** Emniyet katsayısı νv */
  safety: number;
  /** Orantı sınırı indirgemesi ρ (yoksa 1) */
  rho: number;
  /** Kullanım oranı σbil / (σvcr.c/νv) */
  utilization: number;
  caseLabel: string;
}

const IA_W = 600;
const IA_H = 380;

/**
 * σ/σvcr – τ/τvcr etkileşim diyagramı.
 *
 * FEM'in σvcr.c bağıntısı x = σ/σvcr ve y = τ/τvcr cinsinden yazıldığında
 * kontrol tam olarak şu koşula indirgenir:
 *
 *   D(x,y) = (1+ψ)/4 · x + √( [0,25·(3−ψ)·x]² + y² )  ≤  ρ / νv
 *
 * Sabit D eğrisi (c) her zaman (c, 0) ve (0, c) noktalarından geçer; kapalı
 * biçimi A + B = 1 özdeşliğinden çıkar:
 *
 *   y² = c² − 2·A·c·x + (A − B)·x² ,  A = (1+ψ)/4 , B = (3−ψ)/4
 *
 * ψ = −1'de çember, ψ = +1'de parabol olur. Dış eğri kritik sınırı (c = 1),
 * iç eğri izin verilen sınırı (c = ρ/νv) gösterir; çalışma noktası iç eğrinin
 * içindeyse kontrol sağlanır.
 */
export function bucklingInteractionChart(p: BucklingInteractionParams): Diagram {
  const els: DiagramEl[] = [];
  const A = (1 + p.psi) / 4;
  const B = (3 - p.psi) / 4;

  /** Sabit D = c eğrisinin y(x) değeri (tanımsızsa NaN). */
  const curveY = (x: number, c: number): number => {
    const v = c * c - 2 * A * c * x + (A - B) * x * x;
    return v > 0 ? Math.sqrt(v) : v > -1e-12 ? 0 : NaN;
  };
  const sample = (c: number): [number, number][] => {
    const pts: [number, number][] = [];
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const x = (c * i) / n;
      const y = curveY(x, c);
      if (Number.isFinite(y)) pts.push([x, y]);
    }
    return pts;
  };

  const cAllow = p.rho / p.safety;
  const axMax = Math.max(1.15, Math.min(2, p.sigmaRatio * 1.25));
  const ayMax = Math.max(1.15, Math.min(2, p.tauRatio * 1.25));
  const pass = p.utilization <= 1;

  const f = pushChartFrame(
    els,
    { x: 74, y: 70, w: 400, h: 210 },
    { min: 0, max: axMax, label: "σ / σvcr", format: (v) => fmtN(v, 2) },
    { min: 0, max: ayMax, label: "τ / τvcr", format: (v) => fmtN(v, 2) },
    {
      title: "ETKİLEŞİM DİYAGRAMI — BASINÇ + KAYMA",
      note: `FEM 1.001 A-3.4 · ${diagramTitleCase(p.caseLabel)} · ψ = ${fmtN(p.psi, 3)}`,
    }
  );

  // İzin verilen bölge dolgusu + eğriler
  pushCurve(els, f, sample(cAllow), { color: OK, width: 1.8, fillTo: 0, fill: "#E7F3EC" });
  pushCurve(els, f, sample(1), { color: DCOL.accent, width: 1.6, dash: "6,3" });

  pushPoint(els, f, p.sigmaRatio, p.tauRatio,
    `Çalışma Noktası (${fmtN(p.sigmaRatio, 3)} ; ${fmtN(p.tauRatio, 3)})`,
    { color: pass ? OK : BAD, anchor: p.sigmaRatio > axMax * 0.6 ? "end" : "start" }
  );

  pushLegend(els, 74, 310, [
    { color: DCOL.accent, label: "Kritik Sınır  D = 1  (σvcr.c = σbil)", dash: "6,3" },
    {
      color: OK,
      label:
        `İzin Verilen Sınır  D = ρ/νv = ${fmtN(cAllow, 3)}` +
        (p.rho < 1 ? `   (ρ = ${fmtN(p.rho, 3)} · νv = ${fmtN(p.safety, 3)})` : `   (νv = ${fmtN(p.safety, 3)})`),
    },
  ]);

  pushUtilizationBar(els, 330, 300, 140, 12, p.utilization, {
    label: "Kullanım Oranı",
    valueText: `%${fmtN(p.utilization * 100, 1)}  ${pass ? "UYGUN" : "UYGUN DEĞİL"}`,
  });

  return fitDiagram(els, IA_W, IA_H);
}

// ------------------------------------------------ 5. ρ indirgeme grafiği

export interface RhoChartParams {
  steel: BucklingSteel;
  /** İşaretlenecek noktalar: elastik hesaplanan kritik gerilmeler */
  points: { label: string; calculated: number; reduced: number }[];
}

const RC_W = 600;
const RC_H = 330;

/**
 * Orantı sınırı indirgemesi (T.A.3.4.2): elastik formülden çıkan kritik gerilme
 * yatay eksende, kullanılacak (indirgenmiş) değer düşey eksende. 45° kesikli
 * çizgi indirgemenin olmadığı bölgeyi, yatay plato ise tablonun bittiği yerde
 * uygulanan sabitlemeyi gösterir.
 */
export function rhoReductionChart(p: RhoChartParams): Diagram {
  const els: DiagramEl[] = [];
  const rows = RHO_TABLE[RHO_TABLE_STEEL[p.steel]];
  const limit = rows[0].calculated;
  const maxPoint = Math.max(...p.points.map((q) => q.calculated), rows[rows.length - 1].calculated);
  const axMax = Math.min(Math.max(rows[rows.length - 1].calculated * 1.3, maxPoint * 1.1), 1500);
  const ayMax = Math.ceil((rows[rows.length - 1].reduced * 1.15) / 50) * 50;

  const f = pushChartFrame(
    els,
    { x: 74, y: 66, w: 440, h: 190 },
    { min: 0, max: axMax, label: "Hesaplanan σvcr [N/mm²]", format: (v) => fmtN(v, 0) },
    { min: 0, max: ayMax, label: "Kullanılan σvcr [N/mm²]", format: (v) => fmtN(v, 0) },
    {
      title: "ORANTI SINIRI İNDİRGEMESİ",
      note: `FEM 1.001 T.A.3.4.2 · ${p.steel === "St52" ? "St 52 (Fe 510)" : "St 37 (Fe 360)"}`,
    }
  );

  // İndirgeme olmasaydı: 45° çizgi
  pushCurve(els, f, [[0, 0], [Math.min(axMax, ayMax), Math.min(axMax, ayMax)]], {
    color: DCOL.faint, width: 1, dash: "5,4",
  });
  // Gerçek eğri: sınıra kadar 45°, sonra tablo, sonra sabit
  const curve: [number, number][] = [[0, 0], [limit, limit]];
  for (const r of rows.slice(1)) curve.push([r.calculated, r.reduced]);
  curve.push([axMax, rows[rows.length - 1].reduced]);
  pushCurve(els, f, curve, { color: DCOL.accent, width: 1.9 });
  // Tablo satırları küçük daire olarak
  for (const r of rows) {
    els.push({ kind: "circle", cx: f.px(r.calculated), cy: f.py(r.reduced), r: 2, fill: DCOL.accent });
  }

  pushVGuide(els, f, limit, `Orantı Sınırı ${fmtN(limit, 0)}`);
  pushHGuide(els, f, rows[rows.length - 1].reduced, `Tablo Sonu ${fmtN(rows[rows.length - 1].reduced, 0)}`, {
    anchor: "end",
  });

  for (const q of p.points) {
    pushPoint(els, f, q.calculated, q.reduced, `${q.label}: ${fmtN(q.reduced, 0)}`, {
      color: DCOL.ink, guides: true,
    });
  }

  els.push(
    txt(74, 300,
      "Elastik Formüller Yalnız Orantı Sınırının Altında Geçerlidir; Üzerinde Kritik Gerilme ρ İle İndirgenir.",
      8.5, { fill: DCOL.muted })
  );
  els.push(
    txt(74, 313,
      "Tablonun Son Satırından Sonra İndirgenmiş Değer Sabit Tutulur (Emniyetli Kabul).",
      8.5, { fill: DCOL.muted })
  );

  return fitDiagram(els, RC_W, RC_H);
}

/** Bir kritik NORMAL gerilmenin indirgenmiş karşılığı — grafik noktası. */
export function rhoPoint(label: string, calculated: number, steel: BucklingSteel) {
  return { label, calculated, reduced: reduceCriticalStress(calculated, steel).reduced };
}

/**
 * Kritik KAYMA gerilmesinin grafikteki noktası.
 *
 * FEM'in τ koşulu √3·τvcr ≤ orantı sınırı olduğundan τ indirgemesi AYNI σ
 * eğrisi üzerinde okunur: nokta (√3·τvcr, √3·τvcr,ind) koordinatına düşer.
 * Böylece tek grafikte hem normal hem kayma indirgemesi görünür.
 */
export function rhoShearPoint(label: string, tauCalculated: number, steel: BucklingSteel) {
  const r = reduceCriticalShear(tauCalculated, steel);
  return {
    label: `${label} (√3·τ)`,
    calculated: tauCalculated * SQRT3,
    reduced: r.reduced * SQRT3,
  };
}

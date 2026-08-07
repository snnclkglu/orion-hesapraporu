// Tambur mili kaynağı diyagramı — parametrik SVG üretici (2.2.5 bölümü).
//
// Kesit görünüşü (mühendisin AutoCAD kesitiyle aynı okuma sırası):
//   solda  → tambur namlusu (üst ve alt sac, taralı)
//   ortada → düşey tambur yanak/flanş sacı
//   sağda  → yatay mil ve göbek; göbek ile flanş arasında köşe kaynak
//            dikişleri ve konik destek gussetleri
//   en sağda → mesnet reaksiyonunun ("YÜK") etkidiği nokta ve bu yükün
//            flanşa uzaklığını gösteren G ölçü zinciri
//
// Diyagram HİÇBİR fizik hesaplamaz: bütün sayılar kaldırma modülünün kendi
// hücrelerinden gelir. Ölçekleme şematiktir (ölçüler etiketle verilir);
// yalnız G kolu ile göbek/mil çapları görsel olarak orantılanır.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimH, fitDiagram, fmtN, ln, txt, arrowHead,
} from "./model";
import { KGF_TO_MPA } from "@/lib/units";

export interface ShaftWeldParams {
  /** Tambur namlu çapı [mm] — namlu sacının görünüşü için */
  drumDiaMm?: number;
  /** D1: kaynak dikişinin oturduğu göbek çapı [mm] */
  hubDiaMm: number;
  /** D2: mil yatak çapı [mm] */
  shaftDiaMm?: number;
  /** a: kaynak dikişi boğaz kalınlığı [mm] */
  weldThroatMm?: number;
  /** Yükün flanşa uzaklığı — tambur mili bölümündeki G ölçüsü [mm] */
  armMm?: number;
  /** Kolun hangi mesnetten geldiği (G = tambur yatağı, A = redüktör) */
  armLabel?: string;
  /** Kaynak düzlemine etkiyen mesnet reaksiyonu R [kg] */
  reactionKg?: number;
  /** Dikişteki eğilme momenti M = R · G [kg·cm] */
  momentKgCm?: number;
  /** Eğilme gerilmesi [kg/cm²] */
  bendingStress?: number;
  /** Kesme gerilmesi [kg/cm²] */
  shearStress?: number;
  /** Bileşik gerilme [kg/cm²] */
  combinedStress?: number;
  /** Kullanılan izin verilen gerilme [MPa] */
  allowableMPa?: number;
}

const W = 660;
const H = 396;

/** Sac kesitini gösteren 45° tarama çizgileri (dikdörtgenin içine kırpılmış) */
function hatch(
  els: DiagramEl[], x: number, y: number, w: number, h: number, step = 7
) {
  if (!(w > 0) || !(h > 0)) return;
  // Sol üstten sağ alta doğru 45° taramalar; her çizgi dikdörtgenin
  // kenarlarında kırpılır (basit doğrusal kırpma yeterlidir).
  for (let s = -h; s < w; s += step) {
    const x1 = Math.max(x, x + s);
    const y1 = y + Math.max(0, -s);
    const x2 = Math.min(x + w, x + s + h);
    const y2 = y + Math.min(h, w - s);
    if (x2 > x1 && y2 > y1) els.push(ln(x1, y1, x2, y2, DCOL.faint, 0.55));
  }
}

export function shaftWeldDiagram(p: ShaftWeldParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "TAMBUR MİLİ KAYNAĞI", "namlu · yanak sacı · göbek · köşe dikiş · G kolu");

  const yAxis = 186;

  // --- Görsel ölçüler (şematik; gerçek oranlar etiketlerde verilir)
  const xBarrel0 = 44;          // namlu sol ucu
  const xFlange = 286;          // yanak sacının sol yüzü
  const tFlange = 16;           // yanak sacı kalınlığı [px]
  const xFlangeR = xFlange + tFlange;
  const rBarrel = 116;          // namlu yarıçapı [px]
  const tBarrel = 13;           // namlu sacı kalınlığı [px]

  // Göbek ve mil yarı yükseklikleri, gerçek çap oranını korur.
  const hubHalf = 36;
  const shaftHalf =
    p.shaftDiaMm && p.hubDiaMm > 0
      ? Math.min(hubHalf - 6, Math.max(10, (p.shaftDiaMm / p.hubDiaMm) * hubHalf))
      : 18;
  const xHubR = xFlangeR + 74;  // göbeğin sağ ucu
  const xLoad = 574;            // yükün etkidiği nokta

  // --- Tambur namlusu: üst ve alt sac (taralı)
  for (const sign of [-1, 1] as const) {
    const yTop = sign < 0 ? yAxis - rBarrel : yAxis + rBarrel - tBarrel;
    els.push({
      kind: "rect", x: xBarrel0, y: yTop, w: xFlange - xBarrel0, h: tBarrel,
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1,
    });
    hatch(els, xBarrel0 + 1, yTop + 1, xFlange - xBarrel0 - 2, tBarrel - 2, 8);
  }
  els.push(txt(xBarrel0 + 6, yAxis - rBarrel - 10, "TAMBUR NAMLUSU", 8.5, {
    fill: DCOL.muted,
  }));
  if (p.drumDiaMm) {
    els.push(txt(xBarrel0 + 6, yAxis - 6, `Ø tambur = ${fmtN(p.drumDiaMm, 0)} mm`, 9));
  }
  // Namlu eksen çizgisi
  els.push(ln(xBarrel0 - 8, yAxis, xLoad + 40, yAxis, DCOL.faint, 0.7, "14,3,2,3"));

  // --- Yanak / flanş sacı (düşey, taralı)
  els.push({
    kind: "rect", x: xFlange, y: yAxis - rBarrel, w: tFlange, h: 2 * rBarrel,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  hatch(els, xFlange + 1, yAxis - rBarrel + 1, tFlange - 2, 2 * rBarrel - 2, 8);
  els.push(txt(xFlange + tFlange + 6, yAxis - rBarrel - 10, "YANAK / FLANŞ SACI", 8.5, {
    fill: DCOL.muted,
  }));

  // --- Göbek (mil ile flanş arasındaki kısa kovan) ve mil
  els.push({
    kind: "rect", x: xFlangeR, y: yAxis - hubHalf, w: xHubR - xFlangeR, h: 2 * hubHalf,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
  });
  hatch(els, xFlangeR + 1, yAxis - hubHalf + 1, xHubR - xFlangeR - 2, 2 * hubHalf - 2, 9);
  els.push(txt((xFlangeR + xHubR) / 2, yAxis - hubHalf - 8, "GÖBEK", 8.5, {
    anchor: "middle", fill: DCOL.muted,
  }));
  els.push({
    kind: "rect", x: xHubR, y: yAxis - shaftHalf, w: xLoad + 34 - xHubR, h: 2 * shaftHalf,
    fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2,
  });
  els.push(txt(xLoad + 40, yAxis + 3, "MİL", 9, { fill: DCOL.muted }));
  els.push(
    txt(xHubR + 8, yAxis - shaftHalf - 7, `ØD1 = ${fmtN(p.hubDiaMm)} mm`, 9)
  );

  // --- Köşe kaynak dikişleri (göbek ↔ flanş, üstte ve altta)
  const wLeg = 15;
  for (const sign of [-1, 1] as const) {
    const yHub = yAxis + sign * hubHalf;
    els.push({
      kind: "polygon",
      points: [
        [xFlangeR, yHub],
        [xFlangeR, yHub + sign * wLeg],
        [xFlangeR + wLeg, yHub],
      ],
      fill: DCOL.accentSoft, stroke: DCOL.accent, strokeWidth: 1.2,
    });
  }
  const weldNote = p.weldThroatMm
    ? `KÖŞE KAYNAK  a = ${fmtN(p.weldThroatMm, 1)} mm`
    : "KÖŞE KAYNAK";
  els.push(ln(xFlangeR + 8, yAxis + hubHalf + 12, xFlangeR + 26, yAxis + hubHalf + 34,
    DCOL.accent, 0.8));
  els.push(txt(xFlangeR + 30, yAxis + hubHalf + 38, weldNote, 9, {
    fill: DCOL.accent, bold: true,
  }));

  // --- Konik destek gussetleri (flanşa dik, göbeğe oturan üçgen sacalar)
  const gussetH = 62;
  const gussetL = 66;
  for (const sign of [-1, 1] as const) {
    const yHub = yAxis + sign * hubHalf;
    els.push({
      kind: "polygon",
      points: [
        [xFlangeR, yHub],
        [xFlangeR, yHub + sign * gussetH],
        [xFlangeR + gussetL, yHub],
      ],
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1,
    });
  }
  els.push(txt(xFlangeR + 6, yAxis - hubHalf - gussetH - 8, "DESTEK GUSSETİ", 8.5, {
    fill: DCOL.muted,
  }));

  // --- YÜK oku (sağdan, milin üzerine) + G ölçü zinciri
  // Yük mile DÜŞEY etkir; kaynak düzlemine olan uzaklığı G kadardır ve dikişte
  // M = R · G eğilme momentini doğurur.
  const yArrow0 = yAxis - 118;
  els.push(ln(xLoad, yArrow0, xLoad, yAxis - shaftHalf - 9, DCOL.accent, 2));
  els.push(arrowHead(xLoad, yAxis - shaftHalf - 2, "down", DCOL.accent, 9, 3.6));
  els.push(txt(xLoad + 8, yArrow0 + 12, "YÜK", 10.5, { fill: DCOL.accent, bold: true }));
  if (p.reactionKg !== undefined) {
    els.push(txt(xLoad + 8, yArrow0 + 26, `R = ${fmtN(p.reactionKg)} kg`, 9.5, {
      fill: DCOL.accent,
    }));
  }

  // G ölçüsü: kaynak düzleminden (flanşın sağ yüzü) yük eksenine
  const yDim = yAxis + rBarrel + 34;
  els.push(ln(xFlangeR, yAxis + hubHalf + 6, xFlangeR, yDim - 5, DCOL.faint, 0.6));
  els.push(ln(xLoad, yAxis + shaftHalf + 6, xLoad, yDim - 5, DCOL.faint, 0.6));
  dimH(els, xFlangeR, xLoad, yDim,
    `${p.armLabel ?? "G"} = ${fmtN(p.armMm)} mm  (yükün flanşa uzaklığı)`);

  // --- Sonuç kutusu: momentten bileşik gerilmeye
  const bx = 26;
  const by = yDim + 22;
  const lines: string[] = [
    `M = R · ${p.armLabel ?? "G"} = ${fmtN((p.momentKgCm ?? 0) * KGF_TO_MPA)} Nm`,
    `σ_eğ = ${fmtN((p.bendingStress ?? 0) * KGF_TO_MPA)} MPa   ·   τ = ${fmtN((p.shearStress ?? 0) * KGF_TO_MPA)} MPa`,
    // FEM 1.001 Ek A-3.2.2.3 md.3: eşdeğer gerilmede τ² katsayısı 2'dir.
    `σ_cp = √(σ_eğ² + 2·τ²) = ${fmtN((p.combinedStress ?? 0) * KGF_TO_MPA)} MPa`,
  ];
  // Sınır, kontrolü YÖNETEN kuralın (FEM eşdeğer / CMAA asal / CMAA kayma)
  // sınırıdır; hangi gerilmenin hangi sınırla karşılaştırıldığı 2.2.5
  // satırlarında açıkça yazılıdır. Diyagram bu yüzden "σ_cp ≤ σ_em" gibi
  // doğrudan bir karşılaştırma İDDİA ETMEZ.
  if (p.allowableMPa !== undefined) {
    lines.push(`Yöneten kuralın sınırı  σ_em = ${fmtN(p.allowableMPa)} MPa`);
  }
  els.push({
    kind: "rect", x: bx, y: by, w: W - 2 * bx, h: 16 * lines.length + 12,
    fill: DCOL.paper, stroke: DCOL.line, strokeWidth: 1, rx: 3,
  });
  lines.forEach((line, i) => {
    els.push(txt(bx + 12, by + 20 + i * 16, line, 9.5, {
      fill: i === lines.length - 1 ? DCOL.accent : DCOL.ink,
      bold: i === lines.length - 1,
    }));
  });

  return fitDiagram(els, W, H);
}

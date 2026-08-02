// Ana kiriş gerilme şeması (7.4) — GERÇEK kutu kesit üzerine numaralı gerilmeler.
//
// Şematik bir kutu değil, 7.1'deki PARAMETRİK kesit çizimi kullanılır
// (girderSection.ts'teki `layoutBoxSection` / `pushBoxPlates` / `pushRail`):
// plaka kalınlıkları, gövde konumları, ray ekseni ve tarafsız eksen gerçek
// geometriden gelir. Üzerine bileşen gerilmeler kalıcı numaralarıyla
// (σ1…σ10, τ1…τ5) doğru konumlarında işaretlenir; sağda hangi numaranın hangi
// toplama girdiğini gösteren lejant vardır. Değerler MPa cinsindendir.

import {
  DCOL, type Diagram, type DiagramEl,
  arrowHead, fitDiagram, fmtN, ln, txt,
} from "./model";
import {
  type BoxPlateDims,
  layoutBoxSection, pushBoxPlates, pushRail,
} from "./girderSection";
import { KGF_TO_MPA } from "@/lib/units";

export interface GirderStressParams extends BoxPlateDims {
  /** Tarafsız eksen — alttan Cz [mm] */
  czMm?: number;
  /** Ağırlık merkezi — b2 sol kenarından Cy [mm] */
  cyMm?: number;

  // --- Bileşen gerilmeler [kg/cm²] ---
  sigma1SelfWeight?: number;        // σ1  düşey eğilme — kiriş öz ağırlığı (alt lif)
  sigma2Trolley?: number;           // σ2  düşey eğilme — araba ağırlığı (alt lif)
  sigma3Hoist?: number;             // σ3  düşey eğilme — kaldırma yükü (alt lif, ×ψ)
  sigma4BridgeLateral?: number;     // σ4  yatay eğilme — köprü yatay yükü
  sigma5TrolleyLateral?: number;    // σ5  yatay eğilme — araba yanal yükü
  sigma6RailLever?: number;         // σ6  ray kolu / kaçıklık
  sigma7SecondaryTrolley?: number;  // σ7  ikincil moment — araba
  sigma8SecondaryHoist?: number;    // σ8  ikincil moment — kaldırma yükü (×ψ)
  sigma9WheelTrolley?: number;      // σ9  teker basıncı — araba
  sigma10WheelHoist?: number;       // σ10 teker basıncı — kaldırma yükü (×ψ)
  tau1TorsionTrolley?: number;      // τ1  burulma — araba
  tau2TorsionHoist?: number;        // τ2  burulma — kaldırma yükü (×ψ)
  tau3ShearSelfWeight?: number;     // τ3  kesme — öz ağırlık (ana gövde)
  tau4ShearTrolley?: number;        // τ4  kesme — araba (ana gövde)
  tau5ShearHoist?: number;          // τ5  kesme — kaldırma yükü (ana gövde, ×ψ)

  // --- Toplamlar (Yükleme Durumu I) [kg/cm²] ---
  sigmaXBottom?: number;
  sigmaXTop?: number;
  sigmaZ?: number;
  tauMain?: number;
  tauSecondary?: number;
  sigmaComb?: number;
  allowable?: number;
}

const W = 740;
const H = 400;
const RED = DCOL.accent;
const BLUE = "#1D63B8";
const PURPLE = "#7A4FB5";
const ORANGE = "#B4322F";

/** kg/cm² → MPa (mutlak değer), tr biçim */
function mpa(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return "—";
  return `${fmtN(Math.abs(v) * KGF_TO_MPA, 1)} MPa`;
}

export function girderStressDiagram(p: GirderStressParams): Diagram {
  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "ANA KİRİŞ — GERİLME ŞEMASI", 11, { fill: RED, bold: true }));
  els.push(txt(16, 34, "parametrik kutu kesit · numaralı bileşen gerilmeler · Yükleme Durumu I", 8, { fill: DCOL.muted }));
  els.push(ln(16, 40, W - 16, 40, DCOL.line, 0.8));

  const g = layoutBoxSection(p, { cx: 232, drawW: 176, drawH: 244, areaTop: 58, areaH: 268 });
  if (!g) {
    els.push(txt(W / 2, 180, "Kesit girdileri eksik veya geçersiz", 11, {
      anchor: "middle", fill: DCOL.muted,
    }));
    return fitDiagram(els, W, H);
  }

  pushBoxPlates(els, p, g);
  pushRail(els, g, { label: false });

  const { s, cx, web1X, web2X, yB, y1, y2, y5, yWebTop } = g;
  const halfB2 = (p.b2Mm * s) / 2;
  const boxLeft = cx - halfB2;
  const boxRight = cx + halfB2;

  // --- Tarafsız eksen (Cz) ---
  const naY =
    p.czMm !== undefined && Number.isFinite(p.czMm) && p.czMm > 0 && p.czMm < g.totalHMm
      ? yB - p.czMm * s
      : (y1 + yB) / 2;
  els.push(ln(boxLeft - 26, naY, boxRight + 26, naY, RED, 0.9, "6,3"));
  els.push(txt(boxLeft - 30, naY + 3, `T.E.  Cz = ${fmtN(p.czMm, 0)} mm`, 8, {
    anchor: "end", fill: RED,
  }));
  // Ray ekseni etiketi (b1 merkezi de bu eksende)
  els.push(txt(g.railCx, g.railTop - 6, `ray ekseni · b1 merkezi (${fmtN(g.railCenterYMm, 0)} mm)`, 7.5, {
    anchor: "middle", fill: RED,
  }));

  // --- σx üst lif (basınç) — üst iç başlıkta içe bakan mavi oklar ---
  const yTopFib = (y1 + y2) / 2;
  els.push(ln(boxLeft + 16, yTopFib, cx - 8, yTopFib, BLUE, 1.4));
  els.push(arrowHead(boxLeft + 16, yTopFib, "left", BLUE, 6, 2.6));
  els.push(ln(boxRight - 16, yTopFib, cx + 8, yTopFib, BLUE, 1.4));
  els.push(arrowHead(boxRight - 16, yTopFib, "right", BLUE, 6, 2.6));
  els.push(ln(cx, yTopFib, 128, 78, BLUE, 0.7));
  els.push(txt(126, 74, "σ1 σ2 σ3 σ7 σ8 · ÜST LİF (basınç)", 8, { anchor: "end", fill: BLUE, bold: true }));
  els.push(txt(126, 85, `σx,üst = ${mpa(p.sigmaXTop)}`, 8.5, { anchor: "end", fill: BLUE }));

  // --- σx alt lif (çekme) — alt başlıkta dışa bakan kırmızı oklar ---
  const yBotFib = (y5 + yB) / 2;
  els.push(ln(cx - 8, yBotFib, boxLeft + 16, yBotFib, RED, 1.6));
  els.push(arrowHead(boxLeft + 16, yBotFib, "left", RED, 6, 2.6));
  els.push(ln(cx + 8, yBotFib, boxRight - 16, yBotFib, RED, 1.6));
  els.push(arrowHead(boxRight - 16, yBotFib, "right", RED, 6, 2.6));
  els.push(ln(cx, yBotFib, 128, yB + 24, RED, 0.7));
  els.push(txt(126, yB + 20, "σ1 σ2 σ3 σ7 σ8 · ALT LİF (çekme)", 8, { anchor: "end", fill: RED, bold: true }));
  els.push(txt(126, yB + 31, `σx,alt = ${mpa(p.sigmaXBottom)}`, 8.5, { anchor: "end", fill: RED }));

  // --- σ4 σ5 σ6 — yatay eğilme (düşey eksen etrafında): kesit üstünde yatay ok ---
  const yLat = g.railTop - 26;
  els.push(ln(boxLeft, yLat, boxRight, yLat, DCOL.muted, 1.2));
  els.push(arrowHead(boxLeft, yLat, "left", DCOL.muted, 7, 3));
  els.push(arrowHead(boxRight, yLat, "right", DCOL.muted, 7, 3));
  els.push(ln(boxRight, yLat, 344, yLat - 6, DCOL.muted, 0.7));
  els.push(txt(348, yLat - 8, "σ4 σ5 σ6 · yatay eğilme (Mz, ray kolu)", 8, { fill: DCOL.ink, bold: true }));
  els.push(txt(348, yLat + 3, `σ4 = ${mpa(p.sigma4BridgeLateral)}  ·  σ5 = ${mpa(p.sigma5TrolleyLateral)}  ·  σ6 = ${mpa(p.sigma6RailLever)}`, 7.5, { fill: DCOL.muted }));

  // --- σ9 σ10 — teker basıncı: ray ekseninden ana gövde sacına inen ok ---
  const zx = web1X + (p.t3Mm * s) / 2;
  els.push(ln(zx, yWebTop + 4, zx, yWebTop + 34, ORANGE, 1.6));
  els.push(arrowHead(zx, yWebTop + 36, "down", ORANGE, 7, 3));
  els.push(ln(zx, yWebTop + 20, 344, yWebTop + 6, ORANGE, 0.7));
  els.push(txt(348, yWebTop + 4, "σ9 σ10 · teker basıncı (σz, gövde üstü)", 8, { fill: ORANGE, bold: true }));
  els.push(txt(348, yWebTop + 15, `σz = ${mpa(p.sigmaZ)}`, 8.5, { fill: ORANGE }));

  // --- τ — her iki gövde sacında kayma (burulma + kesme) ---
  const tauMark = (x: number, y: number, label: string) => {
    els.push({ kind: "circle", cx: x, cy: y, r: 5.5, fill: "none", stroke: PURPLE, strokeWidth: 1.3 });
    els.push(arrowHead(x + 5.5, y - 3, "up", PURPLE, 5, 2));
    els.push(txt(x, y + 16, label, 7, { anchor: "middle", fill: PURPLE }));
  };
  const tau1X = web1X + (p.t3Mm * s) / 2;
  const tau2X = web2X + (p.t4Mm * s) / 2;
  tauMark(tau1X, naY + 34, "ana");
  tauMark(tau2X, naY + 34, "ikincil");
  els.push(ln(tau2X, naY + 34, 344, naY + 26, PURPLE, 0.7));
  els.push(txt(348, naY + 24, "τ1 τ2 τ3 τ4 τ5 · burulma + kesme", 8, { fill: PURPLE, bold: true }));
  els.push(txt(348, naY + 35, `τ,ana = ${mpa(p.tauMain)}   ·   τ,ikincil = ${mpa(p.tauSecondary)}`, 8, { fill: PURPLE }));

  // --- Lejant: hangi numara hangi toplama giriyor ---
  const lx = 470;
  const lvx = W - 18;
  let ly = 64;
  const row = (no: string, name: string, value: number | undefined, color: string) => {
    els.push(txt(lx, ly, no, 8, { fill: color, bold: true }));
    els.push(txt(lx + 30, ly, name, 8, { fill: DCOL.ink }));
    els.push(txt(lvx, ly, mpa(value), 8, { anchor: "end", fill: DCOL.muted }));
    ly += 12.5;
  };
  const head = (t: string) => {
    ly += 4;
    els.push(txt(lx, ly, t, 8, { fill: DCOL.muted, bold: true }));
    ly += 12.5;
  };

  els.push(ln(lx - 14, 50, lx - 14, 336, DCOL.line, 0.8));
  els.push(txt(lx, 50, "BİLEŞEN GERİLMELER", 9, { fill: RED, bold: true }));
  head("σx — eksenel/eğilme (alt lif değerleri)");
  row("σ1", "Düşey eğilme — kiriş öz ağırlığı", p.sigma1SelfWeight, BLUE);
  row("σ2", "Düşey eğilme — araba ağırlığı", p.sigma2Trolley, BLUE);
  row("σ3", "Düşey eğilme — kaldırma yükü (×ψ)", p.sigma3Hoist, BLUE);
  row("σ4", "Yatay eğilme — köprü yatay yükü", p.sigma4BridgeLateral, BLUE);
  row("σ5", "Yatay eğilme — araba yanal yükü", p.sigma5TrolleyLateral, BLUE);
  row("σ6", "Ray kolu / kaçıklık", p.sigma6RailLever, BLUE);
  row("σ7", "İkincil moment — araba", p.sigma7SecondaryTrolley, BLUE);
  row("σ8", "İkincil moment — yük (×ψ)", p.sigma8SecondaryHoist, BLUE);
  head("σz — teker basıncı (gövde üstü)");
  row("σ9", "Teker basıncı — araba", p.sigma9WheelTrolley, ORANGE);
  row("σ10", "Teker basıncı — yük (×ψ)", p.sigma10WheelHoist, ORANGE);
  head("τ — kayma (ana gövde değerleri)");
  row("τ1", "Burulma — araba", p.tau1TorsionTrolley, PURPLE);
  row("τ2", "Burulma — yük (×ψ)", p.tau2TorsionHoist, PURPLE);
  row("τ3", "Kesme — öz ağırlık", p.tau3ShearSelfWeight, PURPLE);
  row("τ4", "Kesme — araba", p.tau4ShearTrolley, PURPLE);
  row("τ5", "Kesme — yük (×ψ)", p.tau5ShearHoist, PURPLE);

  ly += 6;
  els.push(ln(lx, ly, lvx, ly, DCOL.line, 0.8));
  ly += 13;
  els.push(txt(lx, ly, "σx,alt = σ1+σ2+ψσ3+σ4+σ5+σ6+σ7+ψσ8", 7.5, { fill: DCOL.ink }));
  ly += 11;
  els.push(txt(lx, ly, "σx,üst = σ1+σ2+ψσ3−σ4−σ5−σ6+σ7+ψσ8", 7.5, { fill: DCOL.ink }));
  ly += 11;
  els.push(txt(lx, ly, "σz = σ9 + ψσ10        τ = τ1+ψτ2+τ3+τ4+ψτ5", 7.5, { fill: DCOL.ink }));
  ly += 11;
  els.push(txt(lx, ly, "σcomb = √(σx² + σz² − |σx·σz| + 3τ²)", 7.5, { fill: DCOL.ink, bold: true }));
  ly += 13;
  const okColor = "#1F8A5B";
  const pass =
    p.sigmaComb !== undefined && p.allowable !== undefined ? p.sigmaComb <= p.allowable : undefined;
  els.push(
    txt(
      lx, ly,
      `σcomb = ${mpa(p.sigmaComb)}   ·   izin: ${mpa(p.allowable)}${pass === undefined ? "" : pass ? "  ✓" : "  ✗"}`,
      8.5,
      { fill: pass === undefined ? DCOL.ink : pass ? okColor : ORANGE, bold: true }
    )
  );

  return fitDiagram(els, W, H);
}

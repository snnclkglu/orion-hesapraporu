// Redüktör mil yönleri şeması — ÜST GÖRÜNÜŞ. Seçilen çıkış özelliği ve yön
// koduna (R/L/U/V + 1/2) göre çizilir: gövde, çıkış mili (yönünde), giriş
// mili (tek/çift), flanş/delik göstergesi ve çap etiketleri. Sipariş içindir;
// ölçekli değildir.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, fitDiagram, fmtN, ln, txt,
} from "./model";
import {
  gearboxOutputShape, gearboxShaftDir, type GearboxShaftShape,
} from "@/lib/calc/gearbox-shaft";

export interface GearboxShaftParams {
  /** Çıkış özelliği kodu (00…08, 0S) */
  feature?: string;
  /** Yön kodu (R1/L1/…/V2) */
  direction?: string;
  /** Çıkış mili çapı [mm] */
  outputShaftMm?: number;
  /** Giriş mili çapı [mm] */
  inputShaftMm?: number;
  /** Redüktör modeli (başlık notu) */
  model?: string;
  featureLabel?: string;
}

const W = 520;
const H = 360;

/** Gövdeden bir yönde çıkan mil (dolu ya da delik). */
function shaft(
  els: DiagramEl[], x: number, y: number, dir: "R" | "L" | "U" | "V",
  len: number, halfW: number, shape: GearboxShaftShape
) {
  const horiz = dir === "R" || dir === "L";
  const sgn = dir === "R" || dir === "V" ? 1 : -1;
  const x2 = horiz ? x + sgn * len : x;
  const y2 = horiz ? y : y + sgn * len;
  // mil gövdesi
  if (horiz) {
    els.push({ kind: "rect", x: Math.min(x, x2), y: y - halfW, w: len, h: 2 * halfW, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2 });
  } else {
    els.push({ kind: "rect", x: x - halfW, y: Math.min(y, y2), w: 2 * halfW, h: len, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2 });
  }
  // delik mil: iç çizgi
  if (shape.hollow) {
    const inner = halfW * 0.45;
    if (horiz) els.push(ln(Math.min(x, x2), y, Math.max(x, x2), y, DCOL.faint, inner));
    else els.push(ln(x, Math.min(y, y2), x, Math.max(y, y2), DCOL.faint, inner));
    // uçta delik dairesi
    els.push({ kind: "circle", cx: x2, cy: y2, r: halfW * 0.5, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1 });
  }
  // flanş: mil kökünde halka
  if (shape.flanged) {
    els.push({ kind: "circle", cx: horiz ? x + sgn * 8 : x, cy: horiz ? y : y + sgn * 8, r: halfW + 8, fill: "none", stroke: DCOL.accent, strokeWidth: 1.4 });
  }
  // sıkma bilezik: uçta çift halka
  if (shape.shrinkDisk) {
    for (const o of [0.6, 0.85]) {
      const px = horiz ? x + sgn * len * o : x;
      const py = horiz ? y : y + sgn * len * o;
      els.push({ kind: "circle", cx: px, cy: py, r: halfW + 4, fill: "none", stroke: DCOL.ink, strokeWidth: 1 });
    }
  }
  return { x2, y2, horiz, sgn };
}

export function gearboxShaftDiagram(p: GearboxShaftParams): Diagram {
  const els: DiagramEl[] = [];
  const shape = gearboxOutputShape(p.feature);
  const { dir, inputCount } = gearboxShaftDir(p.direction);
  caption(els, "REDÜKTÖR MİL YÖNLERİ (ÜST GÖRÜNÜŞ)", p.model ? `${p.model}${p.featureLabel ? " · " + p.featureLabel : ""}` : p.featureLabel);

  const cx = 230;
  const cy = 190;
  const bw = 130;
  const bh = 92;
  // Gövde
  els.push({ kind: "rect", x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.6, rx: 6 });
  // Kapak cıvataları (köşe daireleri)
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    els.push({ kind: "circle", cx: cx + dx * (bw / 2 - 10), cy: cy + dy * (bh / 2 - 10), r: 3, fill: "none", stroke: DCOL.muted, strokeWidth: 0.8 });
  }

  const outHalf = 12;
  const inHalf = 6;
  const outLen = 60;
  const inLen = 42;

  // Çıkış mili (yönünde). Çift çıkış milli → iki uçta.
  const start = (d: "R" | "L" | "U" | "V") => {
    if (d === "R") return { x: cx + bw / 2, y: cy };
    if (d === "L") return { x: cx - bw / 2, y: cy };
    if (d === "U") return { x: cx, y: cy - bh / 2 };
    return { x: cx, y: cy + bh / 2 };
  };
  const s = start(dir);
  shaft(els, s.x, s.y, dir, outLen, outHalf, shape);
  if (shape.doubleOutput) {
    const opp = dir === "R" ? "L" : dir === "L" ? "R" : dir === "U" ? "V" : "U";
    const s2 = start(opp);
    shaft(els, s2.x, s2.y, opp, outLen, outHalf, shape);
  }
  // Çıkış çap etiketi
  const oe = start(dir);
  els.push(txt(
    dir === "R" ? oe.x + outLen + 6 : dir === "L" ? oe.x - outLen - 6 : oe.x + outHalf + 10,
    dir === "U" ? oe.y - outLen - 4 : dir === "V" ? oe.y + outLen + 12 : oe.y + 3,
    `ÇIKIŞ Ø${fmtN(p.outputShaftMm ?? 0, 0)}`, 9,
    { anchor: dir === "L" ? "end" : "start", fill: DCOL.accent, bold: true }
  ));

  // Giriş mili — çıkışa DİK kenardan (küçük mil). Tek/çift.
  const inDir: "R" | "L" | "U" | "V" = dir === "R" || dir === "L" ? "U" : "R";
  const is1 = start(inDir);
  shaft(els, is1.x, is1.y, inDir, inLen, inHalf, { hollow: false, flanged: false, doubleFlange: false, doubleOutput: false, shrinkDisk: false });
  if (inputCount === 2) {
    const inOpp = inDir === "U" ? "V" : "L";
    const is2 = start(inOpp);
    shaft(els, is2.x, is2.y, inOpp, inLen, inHalf, { hollow: false, flanged: false, doubleFlange: false, doubleOutput: false, shrinkDisk: false });
  }
  const ie = start(inDir);
  els.push(txt(
    inDir === "U" ? ie.x + 10 : ie.x + inLen + 6,
    inDir === "U" ? ie.y - inLen - 4 : ie.y + 3,
    `GİRİŞ Ø${fmtN(p.inputShaftMm ?? 0, 0)}${inputCount === 2 ? " · Çift" : ""}`, 8.5,
    { fill: DCOL.ink }
  ));

  // Yön künyesi (sağ blok)
  const bx = 400;
  let by = 96;
  const line = (t: string, accent = false) => { els.push(txt(bx, by, t, 8.5, { fill: accent ? DCOL.accent : DCOL.ink, bold: accent })); by += 15; };
  els.push(txt(bx, by - 16, "YÖN", 9, { fill: DCOL.accent, bold: true }));
  line(`Kod: ${(p.direction ?? "—")}`, true);
  line(`Çıkış Yönü: ${({ R: "Sağ", L: "Sol", U: "Üst", V: "Alt" } as const)[dir]}`);
  line(`Giriş Mili: ${inputCount === 2 ? "Çift" : "Tek"}`);
  if (shape.hollow) line("Delik Milli");
  if (shape.flanged) line(shape.doubleFlange ? "Çift Flanşlı" : "Flanşlı");
  if (shape.doubleOutput) line("Çift Çıkış Milli");
  if (shape.shrinkDisk) line("Sıkma bilezik");

  return fitDiagram(els, W, H);
}

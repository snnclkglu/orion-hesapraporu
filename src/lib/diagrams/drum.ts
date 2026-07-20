// Tambur (halat tamburu) şematik diyagramı — yandan görünüş: namlu, yanak
// flanşları, ortadan geçen mil ve mesnetler, üstte oluk hatları. Etiketler:
// tambur çapı D_d, sac kalınlığı s, halat çapı d, oluk adımı t, minimum çap
// D_min = H·d. Ölçekli değil; oranlar okunur tutulur, değerler etiketlenir.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimV, fmtN, ln, txt,
} from "./model";

export interface DrumParams {
  drumDiaMm: number;        // seçilen tambur çapı
  ropeDiaMm: number;        // halat çapı
  wallThicknessMm?: number; // tambur sacı kalınlığı
  groovePitchMm?: number;   // oluk adımı t
  minDiaMm?: number;        // minimum çap D_min = H·d
  grooveLengthMm?: number;  // oluk boyu (varsa)
  material?: string;        // tambur malzemesi
}

const W = 520;
const H = 260;

export function drumDiagram(p: DrumParams): Diagram {
  const els: DiagramEl[] = [];
  caption(els, "TAMBUR", "çap · sac · oluk · mil");

  if (!(p.drumDiaMm > 0)) {
    els.push(txt(W / 2, H / 2, "Tambur çapı seçilmedi", 11, { anchor: "middle", fill: DCOL.muted }));
    return { width: W, height: H, els };
  }

  // Namlu geometrisi (şematik oranlar)
  const cy = 140;
  const barrelH = 96;
  const top = cy - barrelH / 2;
  const bot = cy + barrelH / 2;
  const bx1 = 150;
  const bx2 = 400;
  const flangeW = 12;
  const flangeExtra = 16; // yanak namludan taşar

  // Mil (ortadan geçer) + mesnetler
  els.push(ln(70, cy, 450, cy, DCOL.ink, 1.4));
  [110, 440].forEach((mx) => {
    // basit mesnet üçgeni
    els.push({ kind: "polygon", points: [[mx, cy + 8], [mx - 9, cy + 22], [mx + 9, cy + 22]], fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1 });
    els.push(ln(mx - 13, cy + 22, mx + 13, cy + 22, DCOL.ink, 1));
  });

  // Namlu gövdesi
  els.push({ kind: "rect", x: bx1, y: top, w: bx2 - bx1, h: barrelH, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.4 });
  // Yanak flanşları
  els.push({ kind: "rect", x: bx1 - flangeW, y: top - flangeExtra, w: flangeW, h: barrelH + 2 * flangeExtra, fill: "#E7E4E2", stroke: DCOL.ink, strokeWidth: 1.2 });
  els.push({ kind: "rect", x: bx2, y: top - flangeExtra, w: flangeW, h: barrelH + 2 * flangeExtra, fill: "#E7E4E2", stroke: DCOL.ink, strokeWidth: 1.2 });

  // Sac kalınlığı (üstte ikinci çizgi)
  const wall = 7;
  els.push(ln(bx1, top + wall, bx2, top + wall, DCOL.faint, 0.8, "3,2"));
  els.push(ln(bx1, bot - wall, bx2, bot - wall, DCOL.faint, 0.8, "3,2"));

  // Oluk hatları (üst yüzeyde helis izlenimi)
  const gx0 = bx1 + 10;
  const gx1 = bx2 - 10;
  const pitch = 14;
  for (let x = gx0; x <= gx1; x += pitch) {
    els.push(ln(x, top, x + 6, top + wall, DCOL.muted, 0.7));
  }
  // Oluk adımı ölçüsü
  els.push(ln(gx0, top - 8, gx0 + pitch, top - 8, DCOL.muted, 0.8));
  els.push(ln(gx0, top - 11, gx0, top - 5, DCOL.muted, 0.8));
  els.push(ln(gx0 + pitch, top - 11, gx0 + pitch, top - 5, DCOL.muted, 0.8));
  if (p.groovePitchMm) {
    els.push(txt(gx0 + pitch / 2, top - 12, `t = ${fmtN(p.groovePitchMm, 1)} mm`, 8, { anchor: "middle", fill: DCOL.ink }));
  }

  // Halat (kırmızı) tamburun üstünde bir oluğa oturur
  const rx = (gx0 + gx1) / 2;
  els.push({ kind: "circle", cx: rx, cy: top - 4, r: 4, fill: "#FBEDEC", stroke: DCOL.accent, strokeWidth: 1.2 });
  els.push(txt(rx + 8, top - 4, `halat Ø${fmtN(p.ropeDiaMm, 1)} mm`, 8, { fill: DCOL.accent }));

  // Çap ölçüsü (dikey, sağ yanak dışında)
  dimV(els, bx2 + flangeW + 34, top, bot, `D_d = ${fmtN(p.drumDiaMm)} mm`, { labelSide: "right" });

  // Bilgi kutusu
  const infoY = 224;
  const parts: string[] = [];
  if (p.minDiaMm) parts.push(`Min. çap  D_min = H·d = ${fmtN(p.minDiaMm)} mm`);
  if (p.wallThicknessMm) parts.push(`Sac  s = ${fmtN(p.wallThicknessMm, 1)} mm`);
  if (p.material) parts.push(`Malzeme  ${p.material}`);
  els.push(txt(bx1 - flangeW, infoY, parts.join("      "), 8.5, { fill: DCOL.ink }));
  if (p.minDiaMm && p.drumDiaMm >= p.minDiaMm) {
    els.push(txt(bx1 - flangeW, infoY + 14, `D_d ≥ D_min ✓`, 8.5, { fill: "#1F8A5B", bold: true }));
  } else if (p.minDiaMm) {
    els.push(txt(bx1 - flangeW, infoY + 14, `D_d < D_min ✗`, 8.5, { fill: "#B4322F", bold: true }));
  }

  return { width: W, height: H, els };
}

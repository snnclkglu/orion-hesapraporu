// Ana kiriş gerilme konumları diyagramı (7.4). Şematik kutu kesitte gerilmelerin
// NEREDE etkidiğini gösterir: σx üst (basınç), σx alt (çekme), σz (teker basıncı,
// gövde üstü), σs (kesme/burulma, gövde). Değerler MPa cinsinden etiketlenir.

import {
  DCOL, type Diagram, type DiagramEl,
  arrowHead, fmtN, ln, txt,
} from "./model";
import { KGF_TO_MPA } from "@/lib/units";

export interface GirderStressParams {
  sigmaXTopKgCm2?: number;    // E363 (basınç, işaret negatif olabilir)
  sigmaXBottomKgCm2?: number; // E362 (çekme)
  sigmaZKgCm2?: number;       // E364 (teker basıncı)
  sigmaSKgCm2?: number;       // E365 (kesme/burulma)
}

const W = 560;
const H = 300;
const RED = DCOL.accent;
const BLUE = "#1D63B8";

/** kg/cm² → MPa mutlak değer, tr biçim */
function mpa(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return "—";
  return `${fmtN(Math.abs(v) * KGF_TO_MPA, 1)} MPa`;
}

export function girderStressDiagram(p: GirderStressParams): Diagram {
  const els: DiagramEl[] = [];
  els.push(txt(16, 22, "ANA KİRİŞ — GERİLME KONUMLARI", 11, { bold: true }));
  els.push(txt(16, 34, "kutu kesitte gerilmelerin etkidiği yerler · von Mises bileşeni", 8, { fill: DCOL.muted }));
  els.push(ln(16, 40, W - 16, 40, DCOL.line, 0.8));

  // Kutu kesit (şematik): üst/alt başlık + iki gövde
  const bx = 210, bw = 140;           // kutu sol-x, genişlik
  const tY = 74, bY = 236;            // üst/alt dış y
  const flangeH = 16, webW = 12;
  // üst başlık
  els.push({ kind: "rect", x: bx, y: tY, w: bw, h: flangeH, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3 });
  // alt başlık
  els.push({ kind: "rect", x: bx, y: bY - flangeH, w: bw, h: flangeH, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3 });
  // gövdeler
  els.push({ kind: "rect", x: bx, y: tY + flangeH, w: webW, h: bY - flangeH - (tY + flangeH), fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1 });
  els.push({ kind: "rect", x: bx + bw - webW, y: tY + flangeH, w: webW, h: bY - flangeH - (tY + flangeH), fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.1 });
  // ray (üst başlık üzerinde, sol gövde hizası)
  const railX = bx + webW / 2 + 6;
  els.push({ kind: "rect", x: railX - 7, y: tY - 12, w: 14, h: 12, fill: "#EDE6E6", stroke: RED, strokeWidth: 1 });
  els.push(txt(railX, tY - 15, "ray", 7, { anchor: "middle", fill: RED }));

  // tarafsız eksen
  const naY = (tY + bY) / 2;
  els.push(ln(bx - 30, naY, bx + bw + 30, naY, RED, 0.9, "6,3"));
  els.push(txt(bx + bw + 34, naY + 3, "T.E.", 8, { fill: RED }));

  const cx = bx + bw / 2;

  // σx üst (basınç) — üst başlıkta, içe bakan oklar (mavi)
  els.push(ln(bx + 24, tY + flangeH / 2, cx - 10, tY + flangeH / 2, BLUE, 1.4));
  els.push(arrowHead(bx + 24, tY + flangeH / 2, "left", BLUE, 6, 2.6));
  els.push(ln(bx + bw - 24, tY + flangeH / 2, cx + 10, tY + flangeH / 2, BLUE, 1.4));
  els.push(arrowHead(bx + bw - 24, tY + flangeH / 2, "right", BLUE, 6, 2.6));
  els.push(ln(cx, tY + flangeH / 2, 150, 66, BLUE, 0.7));
  els.push(txt(148, 60, "σx üst · BASINÇ", 8.5, { anchor: "end", fill: BLUE, bold: true }));
  els.push(txt(148, 71, mpa(p.sigmaXTopKgCm2), 8.5, { anchor: "end", fill: BLUE }));

  // σx alt (çekme) — alt başlıkta, dışa bakan oklar (kırmızı)
  els.push(ln(cx - 10, bY - flangeH / 2, bx + 20, bY - flangeH / 2, RED, 1.6));
  els.push(arrowHead(bx + 20, bY - flangeH / 2, "left", RED, 6, 2.6));
  els.push(ln(cx + 10, bY - flangeH / 2, bx + bw - 20, bY - flangeH / 2, RED, 1.6));
  els.push(arrowHead(bx + bw - 20, bY - flangeH / 2, "right", RED, 6, 2.6));
  els.push(ln(cx, bY - flangeH / 2, 150, 250, RED, 0.7));
  els.push(txt(148, 246, "σx alt · ÇEKME", 8.5, { anchor: "end", fill: RED, bold: true }));
  els.push(txt(148, 257, mpa(p.sigmaXBottomKgCm2), 8.5, { anchor: "end", fill: RED }));

  // σz (teker basıncı) — sol gövde üstü, aşağı ok
  const zx = bx + webW / 2;
  els.push(ln(zx, tY + flangeH + 4, zx, tY + flangeH + 34, "#B4322F", 1.6));
  els.push(arrowHead(zx, tY + flangeH + 35, "down", "#B4322F", 7, 3));
  els.push(ln(zx, tY + flangeH + 18, W - 150, 96, "#B4322F", 0.7));
  els.push(txt(W - 148, 90, "σz · teker basıncı", 8.5, { fill: "#B4322F", bold: true }));
  els.push(txt(W - 148, 101, mpa(p.sigmaZKgCm2), 8.5, { fill: "#B4322F" }));

  // σs (kesme/burulma) — sağ gövde, T.E. civarı
  const sx = bx + bw - webW / 2;
  els.push({ kind: "circle", cx: sx, cy: naY, r: 5, fill: "none", stroke: "#7A4FB5", strokeWidth: 1.3 });
  els.push(arrowHead(sx + 5, naY - 3, "up", "#7A4FB5", 5, 2));
  els.push(ln(sx, naY, W - 150, 170, "#7A4FB5", 0.7));
  els.push(txt(W - 148, 166, "σs · kesme/burulma", 8.5, { fill: "#7A4FB5", bold: true }));
  els.push(txt(W - 148, 177, mpa(p.sigmaSKgCm2), 8.5, { fill: "#7A4FB5" }));

  return { width: W, height: H, els };
}

// Halat dengeleme düzeni şeması — denge traversi VEYA denge makarası.
//
// Denge traversi: iki halat ucu, traversin iki ucundaki kama soketlerine bağlı;
// travers ortadaki pimden (pim tipi loadcell) yapıya asılır ve iki halatın
// yükünü eşitler. Denge makarası: iki yiv tek halattan; halat üstteki
// makaradan geçer, makara mili loadcell + rulman üstünde oturur.
//
// Şema ÖLÇEKLİ DEĞİLDİR; seçilen soket/loadcell modeli, kapasite ve yük
// etiketlerini gösterir. Değerler saf hesaptan (cells) gelir.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, dimV, fitDiagram, fmtN, ln, txt, arrowHead,
} from "./model";

export interface BalanceParams {
  variant: "beam" | "sheave";
  /** Denge yükü [kg] (halat yükü × adet) */
  loadKg?: number;
  /** Taşınan halat kolu adedi */
  ropeCount?: number;
  /** Halat çapı [mm] */
  ropeDiaMm?: number;
  /** Seçilen soket (traversi) */
  socketModel?: string;
  socketType?: string;
  socketMblTon?: number;
  /** Seçilen loadcell */
  loadcellModel?: string;
  loadcellCapacityKg?: number;
  /** Denge rulmanı (elle) */
  bearingText?: string;
  /** Denge makarası çapı ve minimumu [mm] */
  sheaveDiaMm?: number;
  sheaveMinDiaMm?: number;
}

const W = 560;
const H = 360;

/** Yapı tavanı — taralı sabit destek. */
function ceiling(els: DiagramEl[], cx: number, y: number, halfW: number) {
  els.push(ln(cx - halfW, y, cx + halfW, y, DCOL.ink, 1.4));
  for (let x = cx - halfW; x < cx + halfW; x += 9) {
    els.push(ln(x, y, x - 6, y - 6, DCOL.faint, 0.7));
  }
}

function loadcellCartridge(els: DiagramEl[], cx: number, y1: number, y2: number, label: string) {
  const w = 26;
  els.push({ kind: "rect", x: cx - w / 2, y: y1, w, h: y2 - y1, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3, rx: 4 });
  // Pim uçları
  els.push({ kind: "circle", cx, cy: y1 + 7, r: 3, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1 });
  els.push({ kind: "circle", cx, cy: y2 - 7, r: 3, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1 });
  els.push(txt(cx + w / 2 + 8, (y1 + y2) / 2 + 3, label, 9, { fill: DCOL.accent, bold: true }));
}

export function balanceDiagram(p: BalanceParams): Diagram {
  const els: DiagramEl[] = [];
  const cx = 210;

  const loadTxt = p.loadKg ? `${fmtN(p.loadKg, 0)} kg` : "?";
  const nTxt = p.ropeCount ? `${fmtN(p.ropeCount, 0)}` : "2";

  if (p.variant === "beam") {
    caption(els, "DENGE TRAVERSİ", `Loadcell Yükü = Halat Yükü × ${nTxt}`);
    const yCeil = 66;
    ceiling(els, cx, yCeil, 70);
    // Loadcell (merkezde, tavandan traverse)
    const yLcTop = yCeil;
    const yLcBot = yCeil + 58;
    loadcellCartridge(els, cx, yLcTop, yLcBot, p.loadcellModel ?? "Loadcell");
    if (p.loadcellCapacityKg) {
      els.push(txt(cx + 22, yLcBot + 2, `Kap. ${fmtN(p.loadcellCapacityKg, 0)} kg`, 8, { fill: DCOL.muted }));
    }
    // Travers kirişi (yatay)
    const yBeam = yLcBot + 16;
    const halfBeam = 120;
    els.push({ kind: "rect", x: cx - halfBeam, y: yBeam, w: 2 * halfBeam, h: 14, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3 });
    els.push(txt(cx, yBeam - 4, "DENGE TRAVERSİ", 8, { anchor: "middle", fill: DCOL.muted }));
    els.push({ kind: "circle", cx, cy: yBeam + 7, r: 3.5, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1 });
    // İki uçta soket + halat
    for (const sgn of [-1, 1] as const) {
      const ex = cx + sgn * (halfBeam - 14);
      const ySkTop = yBeam + 14;
      // soket gövdesi (trapez)
      els.push({
        kind: "polygon",
        points: [[ex - 9, ySkTop], [ex + 9, ySkTop], [ex + 6, ySkTop + 26], [ex - 6, ySkTop + 26]],
        fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2,
      });
      // halat
      els.push(ln(ex, ySkTop + 26, ex, ySkTop + 72, DCOL.ink, 2.2));
      els.push(arrowHead(ex, ySkTop + 72, "down", DCOL.ink, 7, 3));
    }
    // Soket etiketi
    const skLabel = p.socketModel
      ? `SOKET ${p.socketModel}${p.socketType ? ` (${p.socketType})` : ""}${p.socketMblTon ? ` · MBL ${fmtN(p.socketMblTon, 0)} t` : ""}`
      : "HALAT SOKETİ";
    els.push(txt(cx, yBeam + 120, skLabel, 9, { anchor: "middle", fill: DCOL.accent, bold: true }));
    if (p.ropeDiaMm) {
      els.push(txt(cx, yBeam + 134, `Ø${fmtN(p.ropeDiaMm, 0)} mm Halat · ${nTxt} Kol`, 8.5, { anchor: "middle", fill: DCOL.muted }));
    }
    // Yük etiketi
    els.push(txt(cx + halfBeam + 20, yBeam + 8, "YÜK", 10, { fill: DCOL.accent, bold: true }));
    els.push(txt(cx + halfBeam + 20, yBeam + 22, loadTxt, 9.5, { fill: DCOL.accent }));
  } else {
    caption(els, "DENGE MAKARASI", `Loadcell Yükü = Halat Yükü × ${nTxt}`);
    const yCeil = 60;
    ceiling(els, cx, yCeil, 60);
    // Loadcell (mil ekseninde)
    const yAxle = 200;
    loadcellCartridge(els, cx, yCeil, yCeil + 50, p.loadcellModel ?? "Loadcell");
    els.push(ln(cx, yCeil + 50, cx, yAxle - 46, DCOL.faint, 0.8, "8,3"));
    // Makara (daire)
    const r = 46;
    els.push({ kind: "circle", cx, cy: yAxle, r, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.6 });
    els.push({ kind: "circle", cx, cy: yAxle, r: r - 10, fill: "none", stroke: DCOL.faint, strokeWidth: 1 });
    els.push({ kind: "circle", cx, cy: yAxle, r: 5, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.2 });
    els.push(txt(cx, yAxle - r - 8, "DENGE MAKARASI", 8, { anchor: "middle", fill: DCOL.muted }));
    // Halat (iki yiv, makaradan geçer)
    for (const sgn of [-1, 1] as const) {
      els.push(ln(cx + sgn * r, yAxle, cx + sgn * r, yAxle + 96, DCOL.ink, 2.2));
      els.push(arrowHead(cx + sgn * r, yAxle + 96, "down", DCOL.ink, 7, 3));
    }
    els.push({ kind: "path", d: `M ${cx - r} ${yAxle} A ${r} ${r} 0 0 1 ${cx + r} ${yAxle}`, stroke: DCOL.ink, strokeWidth: 2.2, fill: "none" });
    // Çap etiketleri
    if (p.sheaveDiaMm) {
      dimV(els, cx + r + 26, yAxle - r, yAxle + r, `Ø${fmtN(p.sheaveDiaMm, 0)}`, { labelSide: "right", size: 9 });
    }
    if (p.sheaveMinDiaMm) {
      els.push(txt(cx, yAxle + r + 116, `Min. Çap D ≥ ${fmtN(p.sheaveMinDiaMm, 0)} mm (FEM T.4.2.3.1.1)`, 8.5, { anchor: "middle", fill: DCOL.muted }));
    }
    els.push(txt(cx + r + 20, yAxle + 40, "YÜK", 10, { fill: DCOL.accent, bold: true }));
    els.push(txt(cx + r + 20, yAxle + 54, loadTxt, 9.5, { fill: DCOL.accent }));
  }

  // Ortak: rulman + loadcell künyesi (sağ blok)
  const bx = 400;
  let by = 80;
  const line = (t: string, accent = false) => {
    els.push(txt(bx, by, t, 8.5, { fill: accent ? DCOL.accent : DCOL.ink, bold: accent }));
    by += 15;
  };
  els.push(txt(bx, by - 16, "SEÇİM", 9, { fill: DCOL.accent, bold: true }));
  if (p.loadcellModel) line(`Loadcell: ${p.loadcellModel}`);
  if (p.loadcellCapacityKg) line(`Kapasite: ${fmtN(p.loadcellCapacityKg, 0)} kg`);
  if (p.variant === "beam" && p.socketModel) line(`Soket: ${p.socketModel}`);
  if (p.variant === "sheave" && p.sheaveDiaMm) line(`Makara: Ø${fmtN(p.sheaveDiaMm, 0)} mm`);
  if (p.bearingText) line(`Rulman: ${p.bearingText}`);
  if (p.loadKg) line(`Denge Yükü: ${fmtN(p.loadKg, 0)} kg`, true);

  return fitDiagram(els, W, H);
}

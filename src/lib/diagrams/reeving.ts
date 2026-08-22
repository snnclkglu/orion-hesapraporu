// Halat donanımı (reeving) şeması — parametrik SVG üretici (2.1 / 3.1).
// Tambur + üst makaralar + kanca bloğu; n/n donanım (tahrikli/toplam halat)
// ve halat çizgileri. 2/2, 2/4, 4/4, 4/8 gibi donanımlar: tahrikli halat
// çifti başına bir halat sistemi, halat uçları tamburda; tek tahrikli
// halatta ikinci uç sabit bağlantıya gider.

import {
  DCOL, type Diagram, type DiagramEl,
  caption, fitDiagram, fmtN, ln, loadArrow, txt,
} from "./model";
import type { RopeBalancingType } from "@/lib/calc/modules/hoistGroup";

export interface ReevingParams {
  drivenFalls: number;    // tahrikli halat sayısı (tambura sarılan uçlar)
  totalFalls: number;     // toplam halat sayısı
  drumDiaMm?: number;     // tambur çapı (etiket)
  loadKg?: number;        // toplam yük Gt (kanca yükü oku etiketi)
  capacityT?: number;     // kaldırılan yükün tonajı Q [t]
  ropeBalancingType?: RopeBalancingType;
}

const W = 660;
const H = 372;

export function reevingDiagram(p: ReevingParams): Diagram {
  const els: DiagramEl[] = [];
  const nf = Math.min(12, Math.max(1, Math.round(p.totalFalls || 0)));
  const nd = Math.min(nf, Math.max(1, Math.round(p.drivenFalls || 0)));
  const balancingType = p.ropeBalancingType ?? "equalizerSheave";
  caption(
    els,
    `HALAT DONANIMI · ${fmtN(nd, 0)}/${fmtN(nf, 0)}`,
    balancingType === "equalizerBeam"
      ? "Tambur · Denge Traversi · Kanca Bloğu"
      : "Tambur · Denge Makarası · Kanca Bloğu"
  );

  if (!(p.totalFalls > 0)) {
    els.push(txt(W / 2, H / 2, "Donanım girdileri eksik", 11, { anchor: "middle", fill: DCOL.muted }));
    return fitDiagram(els, W, H);
  }

  const cx = 330;
  const dx = nf <= 6 ? 44 : 32;          // halat aralığı
  const xs = Array.from({ length: nf }, (_, i) => cx + (i - (nf - 1) / 2) * dx);
  const yDrumTop = 52;
  const yDrumBottom = yDrumTop + 34;     // tambur alt kenarı (halat başlangıcı)
  const ySheave = 106;                   // üst makara merkezi
  const yBlock = 224;                    // blok makara merkezi

  // --- Halat sistemleri: nd/2 sistem (tek sayıda tahrikli uç → 1 sistem, uç ankrajlı)
  const systems = Math.max(1, Math.floor(nd / 2));
  const fps = Math.ceil(nf / systems);   // sistem başına halat sayısı
  type FallTop = {
    x: number;
    kind: "drum" | "sheave" | "anchor" | "beamAnchor";
    y: number;
  };
  const tops: FallTop[] = [];
  const topSheaves: { cx: number; leftX: number; rightX: number }[] = [];
  const beamAnchors: [number, number][] = [];
  const blockArcs: [number, number][] = []; // blok makarası yay çiftleri

  for (let g = 0; g < systems; g++) {
    const i0 = g * fps;
    const i1 = Math.min(nf, (g + 1) * fps) - 1;
    // son uç: çift tahrikli uçlu sistemde tambura, tek tahrikliyse ankraja
    const lastKind: FallTop["kind"] =
      nd % 2 === 0 || g < systems - 1 ? "drum" : "anchor";
    for (let i = i0; i <= i1; i++) {
      if (i === i0) tops.push({ x: xs[i], kind: "drum", y: yDrumBottom });
      else if (i === i1) tops.push({ x: xs[i], kind: lastKind, y: yDrumBottom });
      else tops.push({ x: xs[i], kind: "sheave", y: ySheave });
      // blok yayları: sistem içinde (i0,i0+1), (i0+2,i0+3), ...
      if (i < i1 && (i - i0) % 2 === 0) blockArcs.push([xs[i], xs[i + 1]]);
    }
    // Üst makaralar: sistem içinde (i0+1,i0+2), (i0+3,i0+4), ...
    const groupTopPairs: [number, number][] = [];
    for (let i = i0 + 1; i < i1; i += 2) groupTopPairs.push([i, i + 1]);
    // Denge traversinde her halatın üst ucu sabittir. Mevcut denge makaralı
    // şemanın sistem ortasındaki denge makarası bu nedenle iki sabit uçla
    // değiştirilir; diğer yönlendirme makaraları yerinde kalır.
    const equalizerPair = balancingType === "equalizerBeam" && groupTopPairs.length > 0
      ? groupTopPairs.reduce((best, pair) => {
          const mid = (xs[pair[0]] + xs[pair[1]]) / 2;
          const bestMid = (xs[best[0]] + xs[best[1]]) / 2;
          const groupMid = (xs[i0] + xs[i1]) / 2;
          return Math.abs(mid - groupMid) < Math.abs(bestMid - groupMid) ? pair : best;
        })
      : undefined;
    for (const pair of groupTopPairs) {
      if (equalizerPair && pair[0] === equalizerPair[0]) {
        tops[pair[0]].kind = "beamAnchor";
        tops[pair[1]].kind = "beamAnchor";
        tops[pair[0]].y = ySheave;
        tops[pair[1]].y = ySheave;
        beamAnchors.push([xs[pair[0]], xs[pair[1]]]);
      } else {
        topSheaves.push({
          cx: (xs[pair[0]] + xs[pair[1]]) / 2,
          leftX: xs[pair[0]],
          rightX: xs[pair[1]],
        });
      }
    }
  }

  // --- Tambur: tambura giden halatların üzerini kapsayan silindir
  const drumXs = tops.filter((t) => t.kind === "drum").map((t) => t.x);
  const dL = Math.min(...drumXs) - 30;
  const dR = Math.max(...drumXs) + 30;
  els.push({
    kind: "rect", x: dL, y: yDrumTop, w: dR - dL, h: yDrumBottom - yDrumTop,
    fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3, rx: 6,
  });
  // helis kanal taraması
  for (let hx = dL + 8; hx < dR - 4; hx += 9) {
    els.push(ln(hx, yDrumTop + 3, hx + 4, yDrumBottom - 3, DCOL.muted, 0.6));
  }
  // tambur ekseni
  els.push(ln(dL - 14, (yDrumTop + yDrumBottom) / 2, dR + 14, (yDrumTop + yDrumBottom) / 2, DCOL.faint, 0.7, "12,3,2,3"));
  els.push(txt(dR + 20, (yDrumTop + yDrumBottom) / 2 + 3,
    p.drumDiaMm ? `Tambur ØD = ${fmtN(p.drumDiaMm)} mm` : "Tambur", 9.5));

  // --- Üst makaralar (halatlar teğet — yarıçap dx/2)
  const rS = dx / 2;
  for (const sheave of topSheaves) {
    const sx = sheave.cx;
    els.push({ kind: "circle", cx: sx, cy: ySheave, r: rS, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2 });
    els.push({ kind: "circle", cx: sx, cy: ySheave, r: 2.2, fill: DCOL.ink });
    // halat üst yarım yayı
    els.push({
      kind: "path",
      d: `M ${sx - rS} ${ySheave} A ${rS} ${rS} 0 0 1 ${sx + rS} ${ySheave}`,
      fill: "none", stroke: DCOL.ink, strokeWidth: 1.4,
    });
  }
  if (topSheaves.length > 0) {
    const sx = topSheaves[topSheaves.length - 1].cx;
    els.push(txt(sx + rS + 8, ySheave + 3, "Makara", 8.5, { fill: DCOL.muted }));
  }

  // --- Denge traversi: iki halat ucu üst taşıyıcıya ayrı ayrı sabitlenir.
  for (const [leftX, rightX] of beamAnchors) {
    els.push(ln(leftX - 11, ySheave - 11, rightX + 11, ySheave - 11, DCOL.ink, 1.4));
    for (const x of [leftX, rightX]) {
      els.push({
        kind: "polygon",
        points: [[x, ySheave], [x - 7, ySheave - 10], [x + 7, ySheave - 10]],
        fill: DCOL.paper,
        stroke: DCOL.ink,
        strokeWidth: 1,
      });
    }
  }
  if (beamAnchors.length > 0) {
    const right = beamAnchors[beamAnchors.length - 1][1];
    els.push(txt(right + 15, ySheave - 8, "Denge traversi · sabit uçlar", 8.5, {
      fill: DCOL.muted,
    }));
  }

  // --- Ankraj (tek tahrikli uç)
  for (const t of tops) {
    if (t.kind !== "anchor") continue;
    els.push({
      kind: "polygon",
      points: [[t.x, yDrumBottom + 10], [t.x - 8, yDrumBottom - 2], [t.x + 8, yDrumBottom - 2]],
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1,
    });
    els.push(ln(t.x - 12, yDrumBottom - 2, t.x + 12, yDrumBottom - 2, DCOL.ink, 1.1));
  }

  // --- Halat düşey çizgileri
  for (const t of tops) {
    const yTop = t.kind === "sheave" || t.kind === "beamAnchor"
      ? t.y
      : t.kind === "anchor"
        ? yDrumBottom + 10
        : t.y;
    els.push(ln(t.x, yTop, t.x, yBlock, DCOL.ink, 1.4));
  }

  // --- Kanca bloğu: gövde + blok makaraları (alt yarım yaylar)
  const bL = xs[0] - rS - 14;
  const bR = xs[nf - 1] + rS + 14;
  const blockTop = yBlock - rS - 8;
  const blockBottom = yBlock + rS + 8;
  els.push({
    kind: "rect", x: bL, y: blockTop, w: bR - bL, h: blockBottom - blockTop,
    fill: "none", stroke: DCOL.ink, strokeWidth: 1.3, rx: 4,
  });
  for (const [xa, xb] of blockArcs) {
    const mx = (xa + xb) / 2;
    els.push({ kind: "circle", cx: mx, cy: yBlock, r: rS, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2 });
    els.push({ kind: "circle", cx: mx, cy: yBlock, r: 2.2, fill: DCOL.ink });
    els.push({
      kind: "path",
      d: `M ${xa} ${yBlock} A ${rS} ${rS} 0 0 0 ${xb} ${yBlock}`,
      fill: "none", stroke: DCOL.ink, strokeWidth: 1.4,
    });
  }
  if (nf === 1) {
    // tek halat: blok içinde bağlantı noktası
    els.push({ kind: "circle", cx: xs[0], cy: yBlock, r: 3, fill: DCOL.ink });
  }
  els.push(txt(bR + 10, yBlock + 3, "Kanca bloğu", 8.5, { fill: DCOL.muted }));

  // --- Kanca + yük oku
  const yHook = blockBottom + 10;
  els.push(ln(cx, blockBottom, cx, yHook, DCOL.ink, 2.4, undefined));
  els.push({
    kind: "path",
    d: `M ${cx} ${yHook} v 12 a 15 15 0 1 1 -24 -10`,
    fill: "none", stroke: DCOL.ink, strokeWidth: 2.6, cap: "round",
  });
  const yArrow0 = yHook + 34;
  loadArrow(els, cx, yArrow0, yArrow0 + 40);
  // Kaldırılan yükün TONAJI önce yazılır: şemaya bakan mühendis hangi yükün
  // kaldırıldığını görmeden halat kuvvetini okumamalıdır. Gt bunun altında
  // kanca bloğu ve halat ağırlığını da içeren toplam yüktür.
  if (p.capacityT !== undefined && Number.isFinite(p.capacityT)) {
    els.push(txt(cx + 10, yArrow0 + 16, `YÜK  Q = ${fmtN(p.capacityT, 2)} t`, 10.5, {
      fill: DCOL.accent, bold: true,
    }));
  }
  els.push(txt(cx + 10, yArrow0 + 31, `Gt = ${fmtN(p.loadKg)} kg`, 9.5, {
    fill: DCOL.accent,
  }));

  return fitDiagram(els, W, H);
}

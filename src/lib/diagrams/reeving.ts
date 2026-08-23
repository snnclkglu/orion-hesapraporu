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
import type {
  DoubleDrumHookSystem,
  HoistEquipmentArrangement,
} from "@/lib/calc/types";

export interface ReevingParams {
  drivenFalls: number;    // tahrikli halat sayısı (tambura sarılan uçlar)
  totalFalls: number;     // toplam halat sayısı
  drumDiaMm?: number;     // tambur çapı (etiket)
  loadKg?: number;        // toplam yük Gt (kanca yükü oku etiketi)
  capacityT?: number;     // kaldırılan yükün tonajı Q [t]
  ropeBalancingType?: RopeBalancingType;
  equipmentArrangement?: HoistEquipmentArrangement;
  doubleDrumHookSystem?: DoubleDrumHookSystem;
}

const W = 660;
const H = 372;

/**
 * Çift tamburun mekanik yerleşimi: ortada tek redüktör, iki yanda simetrik
 * tamburlar ve her yanda seçilen donanımın yarısı. Bu şema fizik hesabı yapmaz;
 * çağıranın verdiği tam donanımı 4/8 → 2/4 + 2/4 biçiminde görünür kılar.
 */
function doubleDrumReevingDiagram(p: ReevingParams, nd: number, nf: number): Diagram {
  const els: DiagramEl[] = [];
  const sideDriven = Math.max(1, Math.round(nd / 2));
  const sideFalls = Math.max(1, Math.round(nf / 2));
  const sideLabel = `${fmtN(sideDriven, 0)}/${fmtN(sideFalls, 0)}`;
  const hookSystem = p.doubleDrumHookSystem ?? "doubleHookBlock";
  caption(
    els,
    `HALAT DONANIMI · ${fmtN(nd, 0)}/${fmtN(nf, 0)} → SOL ${sideLabel} + SAĞ ${sideLabel}`,
    `Ortak Redüktör · İki Simetrik Tambur · ${
      hookSystem === "liftingBeam" ? "Tek Kaldırma Kirişi" : "İki Eşit Kanca Bloğu"
    }`
  );

  const yDrum = 57;
  const drumH = 34;
  const drumRanges: [number, number][] = [[45, 275], [385, 615]];
  const gearbox = { x: 292, y: 49, w: 76, h: 51 };

  for (const [index, [left, right]] of drumRanges.entries()) {
    els.push({
      kind: "rect", x: left, y: yDrum, w: right - left, h: drumH,
      fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1.3, rx: 6,
    });
    for (let x = left + 8; x < right - 5; x += 10) {
      els.push(ln(x, yDrum + 3, x + 4, yDrum + drumH - 3, DCOL.muted, 0.6));
    }
    els.push(txt((left + right) / 2, yDrum - 7,
      `${index === 0 ? "SOL" : "SAĞ"} TAMBUR · ${sideLabel}`, 8.5,
      { anchor: "middle", fill: DCOL.muted, bold: true }));
  }

  // Ortak redüktör ve iki tambur kaplini.
  els.push({
    kind: "rect", ...gearbox, fill: "#FFFFFF", stroke: DCOL.accent,
    strokeWidth: 1.5, rx: 3,
  });
  els.push(txt(gearbox.x + gearbox.w / 2, gearbox.y + 20, "ORTAK", 8.5, {
    anchor: "middle", fill: DCOL.accent, bold: true,
  }));
  els.push(txt(gearbox.x + gearbox.w / 2, gearbox.y + 34, "REDÜKTÖR", 8.5, {
    anchor: "middle", fill: DCOL.accent, bold: true,
  }));
  els.push(ln(275, yDrum + drumH / 2, gearbox.x, yDrum + drumH / 2, DCOL.ink, 1.8));
  els.push(ln(gearbox.x + gearbox.w, yDrum + drumH / 2, 385, yDrum + drumH / 2, DCOL.ink, 1.8));

  const blocks: { cx: number; left: number; right: number; bottom: number }[] = [];
  for (const [left, right] of drumRanges) {
    const margin = 30;
    const usableLeft = left + margin;
    const usableRight = right - margin;
    const spacing = sideFalls > 1 ? (usableRight - usableLeft) / (sideFalls - 1) : 0;
    const xs = Array.from({ length: sideFalls }, (_, i) => usableLeft + i * spacing);
    const yTop = yDrum + drumH;
    const yBlock = 220;
    const r = Math.min(18, Math.max(10, spacing / 2 || 13));

    for (const x of xs) els.push(ln(x, yTop, x, yBlock, DCOL.ink, 1.35));
    // Hareketli makaralar, her iki halat kolunun ortasında gösterilir.
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      els.push({ kind: "circle", cx, cy: yBlock, r, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2 });
      els.push({ kind: "circle", cx, cy: yBlock, r: 2.1, fill: DCOL.ink });
      els.push({
        kind: "path", d: `M ${xs[i]} ${yBlock} A ${r} ${r} 0 0 0 ${xs[i + 1]} ${yBlock}`,
        fill: "none", stroke: DCOL.ink, strokeWidth: 1.35,
      });
    }
    // Denge traversi / yönlendirme noktaları üst sabit düzlemde görünür.
    if (sideFalls >= 4) {
      const mid = (xs[Math.floor(sideFalls / 2) - 1] + xs[Math.floor(sideFalls / 2)]) / 2;
      els.push({ kind: "circle", cx: mid, cy: 125, r: 13, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.1 });
      els.push({ kind: "circle", cx: mid, cy: 125, r: 2, fill: DCOL.ink });
    }
    const blockLeft = xs[0] - r - 8;
    const blockRight = xs[xs.length - 1] + r + 8;
    const blockTop = yBlock - r - 7;
    const blockBottom = yBlock + r + 7;
    els.push({
      kind: "rect", x: blockLeft, y: blockTop, w: blockRight - blockLeft,
      h: blockBottom - blockTop, fill: "none", stroke: DCOL.ink, strokeWidth: 1.25, rx: 4,
    });
    blocks.push({ cx: (left + right) / 2, left: blockLeft, right: blockRight, bottom: blockBottom });
  }

  if (hookSystem === "liftingBeam") {
    const beamY = 300;
    for (const block of blocks) {
      els.push(ln(block.cx, block.bottom, block.cx, beamY, DCOL.ink, 2));
    }
    els.push({
      kind: "rect", x: 105, y: beamY, w: 450, h: 24,
      fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.5, rx: 3,
    });
    els.push(txt(W / 2, beamY + 16, "TEK KALDIRMA KİRİŞİ", 9, {
      anchor: "middle", fill: DCOL.muted, bold: true,
    }));
    loadArrow(els, W / 2, beamY + 32, beamY + 70);
    els.push(txt(W / 2 + 12, beamY + 53, `YÜK Q = ${fmtN(p.capacityT, 2)} t`, 10, {
      fill: DCOL.accent, bold: true,
    }));
  } else {
    for (const block of blocks) {
      const yHook = block.bottom + 9;
      els.push(ln(block.cx, block.bottom, block.cx, yHook + 9, DCOL.ink, 2.2));
      els.push({
        kind: "path", d: `M ${block.cx} ${yHook} v 11 a 13 13 0 1 1 -21 -9`,
        fill: "none", stroke: DCOL.ink, strokeWidth: 2.4, cap: "round",
      });
      loadArrow(els, block.cx, yHook + 30, yHook + 62);
      const halfCapacity = p.capacityT === undefined ? undefined : p.capacityT / 2;
      els.push(txt(block.cx + 10, yHook + 48, `Q/2 = ${fmtN(halfCapacity, 2)} t`, 9.5, {
        fill: DCOL.accent, bold: true,
      }));
      els.push(txt(block.cx, yHook + 76, `Kanca Bloğu · ${sideLabel}`, 8.5, {
        anchor: "middle", fill: DCOL.muted,
      }));
    }
  }

  return fitDiagram(els, W, 405);
}

export function reevingDiagram(p: ReevingParams): Diagram {
  const els: DiagramEl[] = [];
  const nf = Math.min(20, Math.max(1, Math.round(p.totalFalls || 0)));
  const nd = Math.min(nf, Math.max(1, Math.round(p.drivenFalls || 0)));
  const balancingType = p.ropeBalancingType ?? "equalizerSheave";
  if (p.equipmentArrangement === "doubleDrum" && p.totalFalls > 0) {
    return doubleDrumReevingDiagram(p, nd, nf);
  }
  caption(
    els,
    `HALAT DONANIMI · ${fmtN(nd, 0)}/${fmtN(nf, 0)}`,
    balancingType === "equalizerBeam"
      ? "Tambur · Denge Traversi · Kanca Bloğu"
      : "Tambur · Denge Makarası · Kanca Bloğu"
  );

  if (!(p.totalFalls > 0)) {
    els.push(txt(W / 2, H / 2, "Donanım Girdileri Eksik", 11, { anchor: "middle", fill: DCOL.muted }));
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
    els.push(txt(right + 15, ySheave - 8, "Denge Traversi · Sabit Uçlar", 8.5, {
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
  els.push(txt(bR + 10, yBlock + 3, "Kanca Bloğu", 8.5, { fill: DCOL.muted }));

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

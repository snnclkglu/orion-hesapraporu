// Elektrik hesap raporu feston arabası enine yerleşim şeması.

import type { ElectricalInputs, FestoonLayoutResult } from "@/lib/calc/modules/electrical";
import { DCOL, type Diagram, type DiagramEl } from "./model";

const n = (value: number, digits = 1) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: digits });

export function electricalFestoonDiagram(
  inputs: ElectricalInputs,
  layout: FestoonLayoutResult
): Diagram {
  const width = 420;
  const height = 205;
  const frameX = 68;
  const frameY = 39;
  const frameW = 284;
  const frameH = 94;
  const usableW = Math.max(1, inputs.usableWidthMm);
  const usableH = Math.max(1, inputs.usableHeightMm);
  const worldCenterX = usableW / 2;
  const halfW = Math.max(
    usableW / 2,
    ...layout.placements.map((p) => Math.abs(p.xMm - worldCenterX) + p.widthMm / 2)
  );
  const halfH = Math.max(
    usableH / 2,
    ...layout.placements.map((p) => Math.abs(p.yMm) + p.heightMm / 2)
  );
  // Uygunsuz bir kablo paketi b2/s sınırının dışına taşsa da çizimin ve
  // açıklamaların üstüne binmez; paket ile kullanılabilir alan birlikte ölçeklenir.
  const scale = Math.min(frameW / (2 * halfW), frameH / (2 * halfH)) * 0.92;
  const plotCenterX = width / 2;
  const plotCenterY = frameY + frameH / 2;
  const capacityW = usableW * scale;
  const capacityH = usableH * scale;
  const capacityX = plotCenterX - capacityW / 2;
  const capacityY = plotCenterY - capacityH / 2;
  const els: DiagramEl[] = [
    { kind: "text", x: width / 2, y: 15, text: "FESTON ARABASI — ENİNE KABLO YERLEŞİMİ", size: 10, bold: true, anchor: "middle", fill: DCOL.ink, fixed: true },
    { kind: "rect", x: frameX, y: frameY, w: frameW, h: frameH, fill: DCOL.paper, stroke: DCOL.muted, strokeWidth: 0.6 },
    { kind: "rect", x: capacityX, y: capacityY, w: capacityW, h: capacityH, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2 },
    { kind: "line", x1: width / 2, y1: frameY - 10, x2: width / 2, y2: frameY + frameH + 12, stroke: DCOL.accent, strokeWidth: 0.8, dash: "4 3" },
    { kind: "text", x: width / 2, y: frameY - 14, text: "ARABA ORTA EKSENİ", size: 6, anchor: "middle", fill: DCOL.accent, fixed: true },
  ];

  for (const p of layout.placements) {
    const cx = plotCenterX + (p.xMm - worldCenterX) * scale;
    const cy = plotCenterY + p.yMm * scale;
    const w = Math.max(2.5, p.widthMm * scale);
    const h = Math.max(2.5, p.heightMm * scale);
    if (Math.abs(p.widthMm - p.heightMm) < 0.01) {
      els.push({ kind: "circle", cx, cy, r: w / 2, fill: p.color, stroke: DCOL.ink, strokeWidth: 0.5 });
    } else {
      els.push({ kind: "rect", x: cx - w / 2, y: cy - h / 2, w, h, rx: 1, fill: p.color, stroke: DCOL.ink, strokeWidth: 0.5 });
    }
  }

  const cogX = plotCenterX + layout.centerOffsetMm * scale;
  els.push(
    { kind: "line", x1: cogX, y1: frameY - 1, x2: cogX, y2: frameY + frameH + 3, stroke: DCOL.ink, strokeWidth: 1.5 },
    { kind: "polygon", points: [[cogX - 4, frameY - 2], [cogX + 4, frameY - 2], [cogX, frameY + 5]], fill: DCOL.ink },
    { kind: "text", x: cogX, y: frameY - 6, text: `AG · ${n(Math.abs(layout.centerOffsetMm))} mm`, size: 6, anchor: "middle", fill: DCOL.ink, fixed: true },
    { kind: "text", x: width / 2, y: 147, text: `${inputs.trolleyBrand} · ${inputs.trolleyModel}`, size: 8, bold: true, anchor: "middle", fill: DCOL.ink, fixed: true },
    { kind: "text", x: width / 2, y: 159, text: `b2=${n(inputs.usableWidthMm, 0)} mm · s=${n(inputs.usableHeightMm, 0)} mm · D=${n(inputs.supportDiameterMm, 0)} mm · ${layout.rowCount} SIRA`, size: 7, anchor: "middle", fill: DCOL.muted, fixed: true },
    { kind: "text", x: width / 2, y: 171, text: `Paket ${n(layout.packageWidthMm)} × ${n(layout.packageHeightMm)} mm · ${n(layout.packageWeightKgPerM, 3)} kg/m`, size: 7, anchor: "middle", fill: DCOL.muted, fixed: true },
    { kind: "rect", x: 94, y: 184, w: 9, h: 5, fill: "#D94A3A" },
    { kind: "text", x: 108, y: 189, text: "Güç", size: 6, fill: DCOL.muted, fixed: true },
    { kind: "rect", x: 174, y: 184, w: 9, h: 5, fill: "#2F6FEB" },
    { kind: "text", x: 188, y: 189, text: "Kumanda", size: 6, fill: DCOL.muted, fixed: true },
    { kind: "rect", x: 274, y: 184, w: 9, h: 5, fill: "#0F9D8A" },
    { kind: "text", x: 288, y: 189, text: "Sinyal", size: 6, fill: DCOL.muted, fixed: true },
  );

  return { width, height, els };
}

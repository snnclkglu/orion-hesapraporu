// Elektrik hesap raporu feston arabası enine yerleşim şeması.
// Geometri, Vasel I-profil arabasının ön görünüşündeki teker-gövde-askı-
// bombeli kablo mesnedi-sıkma plakası sırasını şematik olarak izler.

import type { ElectricalInputs, FestoonLayoutResult } from "@/lib/calc/modules/electrical";
import { DCOL, dimH, type Diagram, type DiagramEl } from "./model";

const n = (value: number, digits = 1) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: digits });

export function electricalFestoonDiagram(
  _inputs: ElectricalInputs,
  layout: FestoonLayoutResult
): Diagram {
  const width = 420;
  const height = 292;
  const centerX = width / 2;
  const usableW = Math.max(1, layout.usableWidthMm);
  const usableH = Math.max(1, layout.usableHeightMm);
  const worldCenterX = usableW / 2;
  const halfW = Math.max(
    usableW / 2,
    ...layout.placements.map((p) => Math.abs(p.xMm - worldCenterX) + p.widthMm / 2)
  );
  const halfH = Math.max(
    usableH / 2,
    ...layout.placements.map((p) => Math.abs(p.yMm) + p.heightMm / 2)
  );
  const scale = Math.min(220 / (2 * halfW), 52 / (2 * halfH)) * 0.94;
  const cableCenterY = 190;
  const leftB2 = centerX - usableW * scale / 2;
  const rightB2 = centerX + usableW * scale / 2;
  const els: DiagramEl[] = [
    { kind: "text", x: centerX, y: 14, text: "FESTON ARABASI — ENİNE KABLO YERLEŞİMİ", size: 10, bold: true, anchor: "middle", fill: DCOL.ink, fixed: true },
    { kind: "text", x: centerX, y: 26, text: "I-PROFİL ARABASI · ÖN GÖRÜNÜŞ", size: 6.5, anchor: "middle", fill: DCOL.muted, fixed: true },
    { kind: "rect", x: 74, y: 35, w: 272, h: 7, rx: 1, fill: "#57534E", stroke: DCOL.ink, strokeWidth: 0.6 },
    { kind: "rect", x: 201, y: 42, w: 18, h: 22, fill: "#78716C", stroke: DCOL.ink, strokeWidth: 0.6 },
    { kind: "rect", x: 105, y: 61, w: 210, h: 7, rx: 1, fill: "#57534E", stroke: DCOL.ink, strokeWidth: 0.6 },
    { kind: "polygon", points: [[102, 87], [318, 87], [292, 131], [248, 157], [172, 157], [128, 131]], fill: "#D6D3D1", stroke: DCOL.ink, strokeWidth: 1.4 },
    { kind: "rect", x: 197, y: 94, w: 26, h: 50, rx: 10, fill: DCOL.paper, stroke: DCOL.ink, strokeWidth: 1 },
    { kind: "circle", cx: 210, cy: 106, r: 6, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2 },
    { kind: "circle", cx: 210, cy: 137, r: 6, fill: "#FFFFFF", stroke: DCOL.ink, strokeWidth: 1.2 },
    { kind: "rect", x: 203, y: 156, w: 14, h: 35, fill: "#A8A29E", stroke: DCOL.ink, strokeWidth: 1 },
    { kind: "polygon", points: [[165, 184], [255, 184], [235, 166], [185, 166]], fill: "#D6D3D1", stroke: DCOL.ink, strokeWidth: 1 },
  ];

  for (const x of [137, 173, 247, 283]) {
    els.push(
      { kind: "circle", cx: x, cy: 76, r: 15, fill: "#D6D3D1", stroke: DCOL.ink, strokeWidth: 1.4 },
      { kind: "circle", cx: x, cy: 76, r: 5, fill: "#57534E", stroke: DCOL.ink, strokeWidth: 0.8 }
    );
  }

  els.push(
    { kind: "path", d: "M 74 205 Q 210 153 346 205", fill: "none", stroke: "#57534E", strokeWidth: 11, cap: "round" },
    { kind: "path", d: "M 74 204 Q 210 160 346 204", fill: "none", stroke: "#F5F5F4", strokeWidth: 6, cap: "round" }
  );

  for (const p of layout.placements) {
    const cx = centerX + (p.xMm - worldCenterX) * scale;
    const cy = cableCenterY + p.yMm * scale;
    const w = Math.max(4, p.widthMm * scale);
    const h = Math.max(4, p.heightMm * scale);
    if (Math.abs(p.widthMm - p.heightMm) < 0.01) {
      els.push({ kind: "circle", cx, cy, r: w / 2, fill: p.color, stroke: DCOL.ink, strokeWidth: 0.7 });
    } else {
      els.push({ kind: "rect", x: cx - w / 2, y: cy - h / 2, w, h, rx: 1.5, fill: p.color, stroke: DCOL.ink, strokeWidth: 0.7 });
    }
  }

  els.push({ kind: "rect", x: 70, y: 211, w: 280, h: 25, rx: 3, fill: "#C9C5C2", stroke: DCOL.ink, strokeWidth: 1.2 });
  for (let i = 0; i < 23; i++) {
    els.push({ kind: "circle", cx: 82 + i * 11.8, cy: 223.5, r: 2, fill: "#57534E" });
  }

  const cogX = centerX + layout.centerOffsetMm * scale;
  els.push(
    { kind: "line", x1: centerX, y1: 160, x2: centerX, y2: 239, stroke: DCOL.faint, strokeWidth: 0.9, dash: "4 3" },
    { kind: "line", x1: cogX, y1: 164, x2: cogX, y2: 239, stroke: DCOL.accent, strokeWidth: 1.8, dash: "4 2" },
    { kind: "polygon", points: [[cogX - 5, 166], [cogX + 5, 166], [cogX, 174]], fill: DCOL.accent },
    { kind: "text", x: cogX, y: 161, text: `AG · ${n(Math.abs(layout.centerOffsetMm))} mm`, size: 7, bold: true, anchor: "middle", fill: DCOL.accent, fixed: true }
  );

  dimH(els, leftB2, rightB2, 246, `b2 = ${n(layout.usableWidthMm, 0)} mm`, { size: 7, labelDy: 11 });
  els.push(
    { kind: "text", x: 360, y: 193, text: `D = ${n(layout.supportDiameterMm, 0)} mm`, size: 7, fill: DCOL.muted, fixed: true },
    { kind: "text", x: 360, y: 205, text: `s = ${n(layout.usableHeightMm, 0)} mm`, size: 7, fill: DCOL.muted, fixed: true },
    { kind: "text", x: centerX, y: 267, text: `${layout.trolleyBrand} · ${layout.trolleyModel} · ${layout.rowCount} sıra`, size: 8, bold: true, anchor: "middle", fill: DCOL.ink, fixed: true },
    { kind: "text", x: centerX, y: 279, text: `Paket ${n(layout.packageWidthMm)} × ${n(layout.packageHeightMm)} mm · ${n(layout.packageWeightKgPerM, 3)} kg/m · loop yükü ${n(layout.trolleyCableLoadKg, 2)} kg`, size: 7, anchor: "middle", fill: DCOL.muted, fixed: true },
    { kind: "rect", x: 101, y: 285, w: 9, h: 5, fill: "#D94A3A" },
    { kind: "text", x: 115, y: 290, text: "Güç", size: 6, fill: DCOL.muted, fixed: true },
    { kind: "rect", x: 183, y: 285, w: 9, h: 5, fill: "#2F6FEB" },
    { kind: "text", x: 197, y: 290, text: "Kumanda", size: 6, fill: DCOL.muted, fixed: true },
    { kind: "rect", x: 284, y: 285, w: 9, h: 5, fill: "#0F9D8A" },
    { kind: "text", x: 298, y: 290, text: "Sinyal", size: 6, fill: DCOL.muted, fixed: true }
  );

  return { width, height, els };
}

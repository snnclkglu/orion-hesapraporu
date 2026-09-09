// Feston arabası: referans çizimlere göre yan görünüş + A-A kesiti.
// Kesitte sıra üst mesnet → kablo(lar) → sıkma plakasıdır.

import type { ElectricalInputs, FestoonLayoutResult } from "@/lib/calc/modules/electrical";
import { DCOL, dimH, type Diagram, type DiagramEl } from "./model";

const n = (value: number, digits = 1) => value.toLocaleString("tr-TR", { maximumFractionDigits: digits });

function wheels(els: DiagramEl[], xs: number[], y: number) {
  for (const x of xs) els.push(
    { kind: "circle", cx: x, cy: y, r: 10, fill: "#D6D3D1", stroke: DCOL.ink, strokeWidth: 1.2 },
    { kind: "circle", cx: x, cy: y, r: 3.2, fill: "#57534E", stroke: DCOL.ink, strokeWidth: 0.6 },
  );
}

export function electricalFestoonDiagram(
  _inputs: ElectricalInputs,
  layout: FestoonLayoutResult,
): Diagram {
  const width = 420;
  const height = 252;
  const els: DiagramEl[] = [
    { kind: "text", x: 102, y: 13, text: "YAN GÖRÜNÜŞ", size: 8, bold: true, anchor: "middle", fill: DCOL.ink, fixed: true },
    { kind: "rect", x: 26, y: 22, w: 152, h: 6, fill: "#57534E", stroke: DCOL.ink, strokeWidth: 0.6 },
  ];
  wheels(els, [62, 88, 116, 142], 38);
  els.push(
    { kind: "polygon", points: [[42, 50], [162, 50], [147, 77], [123, 91], [81, 91], [57, 77]], fill: "#D6D3D1", stroke: DCOL.ink, strokeWidth: 1.2 },
    { kind: "rect", x: 97, y: 53, w: 10, h: 46, fill: "#A8A29E", stroke: DCOL.ink, strokeWidth: 0.8 },
    { kind: "path", d: "M 38 116 Q 102 88 166 116", fill: "none", stroke: "#57534E", strokeWidth: 9, cap: "round" },
    { kind: "path", d: "M 38 116 Q 102 94 166 116", fill: "none", stroke: "#F5F5F4", strokeWidth: 4.5, cap: "round" },
  );
  const colors = ["#D94A3A", "#2F6FEB", "#0F9D8A", "#D94A3A", "#D94A3A"];
  colors.forEach((color, i) => {
    const x = 70 + i * 16;
    els.push({ kind: "path", d: `M ${x} 111 Q ${x} 174 ${84 + i * 9} 211`, fill: "none", stroke: color, strokeWidth: 3.6, cap: "round" });
  });
  els.push(
    { kind: "rect", x: 35, y: 120, w: 134, h: 10, rx: 2, fill: "#C9C5C2", stroke: DCOL.ink, strokeWidth: 1 },
    { kind: "text", x: 102, y: 231, text: "Kablolar mesnet altında loop oluşturur", size: 6.3, anchor: "middle", fill: DCOL.muted, fixed: true },
    { kind: "line", x1: 210, y1: 8, x2: 210, y2: 235, stroke: DCOL.faint, strokeWidth: 0.8 },
  );

  const centerX = 315;
  const usableW = Math.max(1, layout.usableWidthMm);
  const scale = Math.min(1.05, 145 / usableW);
  const left = centerX - usableW * scale / 2;
  const right = centerX + usableW * scale / 2;
  els.push(
    { kind: "text", x: centerX, y: 13, text: `A-A KESİTİ · ${layout.rowCount === 1 ? "TEK KAT" : "ÇİFT KAT"}`, size: 8, bold: true, anchor: "middle", fill: DCOL.ink, fixed: true },
    { kind: "rect", x: 236, y: 22, w: 158, h: 6, fill: "#57534E", stroke: DCOL.ink, strokeWidth: 0.6 },
  );
  wheels(els, [266, 292, 338, 364], 38);
  els.push(
    { kind: "polygon", points: [[240, 50], [390, 50], [374, 75], [346, 89], [284, 89], [256, 75]], fill: "#D6D3D1", stroke: DCOL.ink, strokeWidth: 1.2 },
    { kind: "rect", x: 310, y: 52, w: 10, h: 40, fill: "#A8A29E", stroke: DCOL.ink, strokeWidth: 0.8 },
    { kind: "path", d: `M ${left} 104 Q ${centerX} 87 ${right} 104`, fill: "none", stroke: "#57534E", strokeWidth: 8, cap: "round" },
    { kind: "path", d: `M ${left} 104 Q ${centerX} 93 ${right} 104`, fill: "none", stroke: "#F5F5F4", strokeWidth: 4, cap: "round" },
  );
  const rows = Array.from({ length: layout.rowCount }, (_, row) => layout.placements.filter((p) => p.row === row));
  rows.forEach((row, rowIndex) => {
    const y = 111 + rowIndex * 37;
    for (const p of row) {
      const cx = centerX + (p.xMm - usableW / 2) * scale;
      const w = Math.max(4, p.widthMm * scale);
      const h = Math.max(4, p.heightMm * scale);
      if (Math.abs(p.widthMm - p.heightMm) < 0.01) els.push({ kind: "circle", cx, cy: y + h / 2, r: w / 2, fill: p.color, stroke: DCOL.ink, strokeWidth: 0.7 });
      else els.push({ kind: "rect", x: cx - w / 2, y, w, h, rx: 1.2, fill: p.color, stroke: DCOL.ink, strokeWidth: 0.7 });
    }
    els.push({ kind: "rect", x: left, y: 133 + rowIndex * 37, w: right - left, h: 8, rx: 2, fill: "#C9C5C2", stroke: DCOL.ink, strokeWidth: 0.9 });
  });
  const cogX = centerX + layout.centerOffsetMm * scale;
  els.push(
    { kind: "line", x1: cogX, y1: 96, x2: cogX, y2: layout.rowCount === 2 ? 184 : 146, stroke: DCOL.accent, strokeWidth: 1.5, dash: "4 2" },
    { kind: "text", x: cogX, y: 94, text: `AG ${n(Math.abs(layout.centerOffsetMm))} mm`, size: 6.2, bold: true, anchor: "middle", fill: DCOL.accent, fixed: true },
  );
  dimH(els, left, right, 204, `b2 = ${n(layout.usableWidthMm, 0)} mm`, { size: 6.5, labelDy: 10 });
  els.push(
    { kind: "text", x: centerX, y: 226, text: `D = ${n(layout.supportDiameterMm, 0)} mm · s = ${n(layout.usableHeightMm, 0)} mm`, size: 6.2, anchor: "middle", fill: DCOL.muted, fixed: true },
    { kind: "text", x: width / 2, y: 244, text: `${layout.trolleyBrand} · ${layout.trolleyModel} · ${layout.rowCount} kat · paket ${n(layout.packageWidthMm)} × ${n(layout.packageHeightMm)} mm · ${n(layout.packageWeightKgPerM, 3)} kg/m`, size: 6.5, bold: true, anchor: "middle", fill: DCOL.ink, fixed: true },
  );
  return { width, height, els };
}

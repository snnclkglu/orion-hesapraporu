import metrics from "./font-metrics.json";
import { BRAND } from "../pdf/palette";

/** Basılan sayfanın ortak ölçüleri; HTML ve PDF aynı değerleri okur. */
export const MANUAL_DESIGN = {
  width: 595.28, height: 841.89, left: 44, right: 44, top: 92, bottom: 774,
  body: 10.5, line: 15, table: 9, tableLine: 12.8, caption: 9,
  ink: BRAND.ink, muted: BRAND.gray600, red: BRAND.red, lineColor: BRAND.line300,
} as const;

export const MANUAL_CONTENT_WIDTH = MANUAL_DESIGN.width - MANUAL_DESIGN.left - MANUAL_DESIGN.right;

export function manualTextWidth(text: string, size: number, bold = false): number {
  const widths: Record<string, number> = metrics[bold ? "bold" : "regular"].widths;
  // Kerning indirimi hesaba katılmaz; küçük pay gerçek çizimin dar olmasını sağlar.
  return [...text].reduce((n, c) => n + (widths[c] ?? 0.8) * size, 0) * 1.035;
}

export function manualTextLines(text: string, width: number, size = MANUAL_DESIGN.body as number, bold = false): string[] {
  const lines: string[] = [];
  for(const paragraph of text.replace(/\r/g, "").split("\n")) {
    if(!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for(const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if(manualTextWidth(candidate, size, bold) <= width) { line = candidate; continue; }
      if(line) lines.push(line);
      line = "";
      for(const c of word) {
        if(line && manualTextWidth(line + c, size, bold) > width) { lines.push(line); line = ""; }
        line += c;
      }
    }
    if(line) lines.push(line);
  }
  return lines;
}

// Parametrik teknik diyagramlar — saf SVG veri modeli (React'siz).
// Üretici fonksiyonlar (girderSection / wheelShaft / reeving) bu modeli
// döndürür; hem web (src/components/diagrams) hem PDF (src/lib/pdf/report.tsx)
// aynı Diagram nesnesini kendi SVG bileşenleriyle çizer.
//
// Stil: ince kömür çizgiler, kırmızı vurgu (yük okları, tarafsız eksen),
// mono etiketler (web: IBM Plex Mono, PDF: DejaVu). Orion marka paleti.

export const DCOL: Record<
  "ink" | "muted" | "faint" | "line" | "paper" | "accent" | "accentSoft",
  string
> = {
  ink: "#262626",     // Kömür — ana çizgiler
  muted: "#8A8480",   // Gri 500 — ölçü okları, ikincil etiketler
  faint: "#C9C5C2",   // Gri 400 — eksen/kılavuz çizgileri
  line: "#DCD9D7",    // Gri 300 — çerçeve
  paper: "#F1EEEC",   // Kağıt — plaka dolgusu
  accent: "#A41E1E",  // Orion Kırmızısı — yük okları, tarafsız eksen
  accentSoft: "#F5E6E6", // moment diyagramı dolgusu
};

export type TextAnchor = "start" | "middle" | "end";

export interface LineEl {
  kind: "line";
  x1: number; y1: number; x2: number; y2: number;
  stroke: string; strokeWidth: number;
  dash?: string;
  cap?: "round" | "butt";
}
export interface RectEl {
  kind: "rect";
  x: number; y: number; w: number; h: number;
  fill?: string; stroke?: string; strokeWidth?: number; rx?: number;
}
export interface CircleEl {
  kind: "circle";
  cx: number; cy: number; r: number;
  fill?: string; stroke?: string; strokeWidth?: number; dash?: string;
}
export interface PathEl {
  kind: "path";
  d: string;
  fill?: string; stroke?: string; strokeWidth?: number; dash?: string;
  cap?: "round" | "butt";
}
export interface PolygonEl {
  kind: "polygon";
  points: [number, number][];
  fill?: string; stroke?: string; strokeWidth?: number;
}
export interface TextEl {
  kind: "text";
  x: number; y: number;
  text: string;
  size: number;
  anchor?: TextAnchor;
  fill?: string;
  bold?: boolean;
}

export type DiagramEl = LineEl | RectEl | CircleEl | PathEl | PolygonEl | TextEl;

export interface Diagram {
  width: number;
  height: number;
  els: DiagramEl[];
}

// ---------------------------------------------------------------- Yardımcılar

/** tr-TR sayı biçimi (etiketler için) */
export function fmtN(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "?";
  if (Number.isInteger(v)) return v.toLocaleString("tr-TR");
  return v.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

export function ln(
  x1: number, y1: number, x2: number, y2: number,
  stroke = DCOL.ink, strokeWidth = 1.2, dash?: string
): LineEl {
  return { kind: "line", x1, y1, x2, y2, stroke, strokeWidth, dash };
}

export function txt(
  x: number, y: number, text: string, size = 9.5,
  opts?: { anchor?: TextAnchor; fill?: string; bold?: boolean }
): TextEl {
  return {
    kind: "text", x, y, text, size,
    anchor: opts?.anchor ?? "start",
    fill: opts?.fill ?? DCOL.ink,
    bold: opts?.bold,
  };
}

/** Ok başı — tip (x,y) noktasında, `dir` yönünü gösterir */
export function arrowHead(
  x: number, y: number,
  dir: "left" | "right" | "up" | "down",
  fill = DCOL.muted, len = 6, half = 2.4
): PolygonEl {
  const pts: [number, number][] =
    dir === "left"
      ? [[x, y], [x + len, y - half], [x + len, y + half]]
      : dir === "right"
        ? [[x, y], [x - len, y - half], [x - len, y + half]]
        : dir === "up"
          ? [[x, y], [x - half, y + len], [x + half, y + len]]
          : [[x, y], [x - half, y - len], [x + half, y - len]];
  return { kind: "polygon", points: pts, fill };
}

/** Yatay ölçü oku: uç tikleri + içe bakan ok başları + üstte etiket */
export function dimH(
  els: DiagramEl[], x1: number, x2: number, y: number, label: string,
  opts?: { size?: number; color?: string; labelDy?: number }
) {
  const c = opts?.color ?? DCOL.muted;
  els.push(ln(x1, y, x2, y, c, 0.8));
  els.push(ln(x1, y - 3.5, x1, y + 3.5, c, 0.8));
  els.push(ln(x2, y - 3.5, x2, y + 3.5, c, 0.8));
  if (Math.abs(x2 - x1) > 18) {
    els.push(arrowHead(x1, y, "left", c));
    els.push(arrowHead(x2, y, "right", c));
  }
  els.push(
    txt((x1 + x2) / 2, y + (opts?.labelDy ?? -4), label, opts?.size ?? 9.5, {
      anchor: "middle", fill: DCOL.ink,
    })
  );
}

/** Dikey ölçü oku: etiket çizginin sağında (yatay metin) */
export function dimV(
  els: DiagramEl[], x: number, y1: number, y2: number, label: string,
  opts?: { size?: number; color?: string; labelSide?: "left" | "right" }
) {
  const c = opts?.color ?? DCOL.muted;
  els.push(ln(x, y1, x, y2, c, 0.8));
  els.push(ln(x - 3.5, y1, x + 3.5, y1, c, 0.8));
  els.push(ln(x - 3.5, y2, x + 3.5, y2, c, 0.8));
  if (Math.abs(y2 - y1) > 18) {
    els.push(arrowHead(x, Math.min(y1, y2), "up", c));
    els.push(arrowHead(x, Math.max(y1, y2), "down", c));
  }
  const side = opts?.labelSide ?? "right";
  els.push(
    txt(x + (side === "right" ? 6 : -6), (y1 + y2) / 2 + 3, label, opts?.size ?? 9.5, {
      anchor: side === "right" ? "start" : "end", fill: DCOL.ink,
    })
  );
}

/** Kırmızı yük oku (dikey) — tip `yTip` ucunda */
export function loadArrow(
  els: DiagramEl[], x: number, yFrom: number, yTip: number,
  opts?: { color?: string; width?: number }
) {
  const c = opts?.color ?? DCOL.accent;
  const w = opts?.width ?? 1.8;
  els.push(ln(x, yFrom, x, yTip + (yTip > yFrom ? -7 : 7), c, w));
  els.push(arrowHead(x, yTip, yTip > yFrom ? "down" : "up", c, 8, 3.2));
}

/** Diyagram başlığı (sol üst köşe): kırmızı büyük başlık + gri alt not */
export function caption(els: DiagramEl[], title: string, note?: string) {
  els.push(txt(14, 20, title, 11, { fill: DCOL.accent, bold: true }));
  if (note) els.push(txt(14, 33, note, 8.5, { fill: DCOL.muted }));
}

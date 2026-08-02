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
  /** viewBox sol üst köşesi — içerik 0'ın soluna/üstüne taşarsa negatif olur */
  x0?: number;
  y0?: number;
}

// ------------------------------------------------------- Yükseklik oturtma

/**
 * SVG `d` dizesindeki mutlak nokta koordinatlarını çözer.
 *
 * Yalnız sınır kutusu için kullanılır; eğri kontrol noktaları da döndürülür —
 * Bézier eğrisi kontrol noktalarının dışbükey zarfının içinde kaldığından bu
 * güvenli (bir miktar ihtiyatlı) bir üst sınır verir. Yay (A) komutunda yalnız
 * uç nokta alınır.
 */
function pathPoints(d: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return out;
  // Komut → argüman sayısı
  const argc: Record<string, number> = {
    m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0,
  };
  let cx = 0, cy = 0;        // geçerli nokta
  let sx = 0, sy = 0;        // alt yolun başlangıcı
  let cmd = "";
  let i = 0;
  const push = (x: number, y: number) => out.push({ x, y });

  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd.toLowerCase() === "z") {
        cx = sx; cy = sy;
        continue;
      }
    }
    const key = cmd.toLowerCase();
    const n = argc[key];
    if (n === undefined) { i++; continue; }
    const rel = cmd === key;                   // küçük harf → bağıl
    const args: number[] = [];
    for (let k = 0; k < n; k++) {
      const v = Number(tokens[i + k]);
      if (!Number.isFinite(v)) return out;
      args.push(v);
    }
    i += n;

    if (key === "h") {
      cx = rel ? cx + args[0] : args[0];
    } else if (key === "v") {
      cy = rel ? cy + args[0] : args[0];
    } else if (key === "a") {
      cx = rel ? cx + args[5] : args[5];
      cy = rel ? cy + args[6] : args[6];
    } else {
      // Çift çift ilerleyen koordinatlar (kontrol noktaları dahil)
      for (let k = 0; k < n; k += 2) {
        const px = rel ? cx + args[k] : args[k];
        const py = rel ? cy + args[k + 1] : args[k + 1];
        push(px, py);
        if (k === n - 2) { cx = px; cy = py; }
      }
    }
    push(cx, cy);
    if (key === "m") { sx = cx; sy = cy; }
    // "M" sonrası argüman tekrarı "L" gibi davranır
    if (key === "m") cmd = rel ? "l" : "L";
  }
  return out;
}

/**
 * Metnin kaba genişliği. DejaVu Sans ortalama ilerlemesi ~0,60 em (kalın için
 * biraz daha fazla). Kesin ölçü değil — sınır kutusunu İHTİYATLI büyütmek için
 * yeterli; fazla tahmin yalnız birkaç birim boşluk bırakır, eksik tahmin ise
 * etiketin çerçeve dışında kalmasına yol açar.
 */
function textWidth(el: TextEl): number {
  return el.text.length * el.size * (el.bold ? 0.64 : 0.6);
}

/** Bir elemanın sınır kutusu [x1, y1, x2, y2] */
function boundsOf(el: DiagramEl): [number, number, number, number] {
  switch (el.kind) {
    case "line":
      return [Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.max(el.x1, el.x2), Math.max(el.y1, el.y2)];
    case "rect":
      return [el.x, el.y, el.x + Math.max(0, el.w), el.y + Math.max(0, el.h)];
    case "circle":
      return [el.cx - el.r, el.cy - el.r, el.cx + el.r, el.cy + el.r];
    case "polygon": {
      const xs = el.points.map((p) => p[0]);
      const ys = el.points.map((p) => p[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    case "text": {
      const w = textWidth(el);
      const x1 = el.anchor === "end" ? el.x - w : el.anchor === "middle" ? el.x - w / 2 : el.x;
      // Metin taban çizgisinden çizilir: üstte çıkıntı, altta alt uzantı payı
      return [x1, el.y - el.size * 0.82, x1 + w, el.y + el.size * 0.28];
    }
    case "path": {
      const pts = pathPoints(el.d);
      if (pts.length === 0) return [Infinity, Infinity, -Infinity, -Infinity];
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
  }
}

/**
 * Diyagram viewBox'ını İÇERİKTEN hesaplar: hiçbir eleman (özellikle kenardaki
 * etiketler) çerçeve dışında kalıp kırpılmaz.
 *
 * Üreticiler sabit bir `W`/`H` yerine bunu döndürür; verilen ölçüler tasarımın
 * istediği TABAN kutudur — içerik dışarı taşarsa kutu o yöne büyütülür, sağa
 * olduğu kadar sola/yukarı da (viewBox köşesi negatife kayar).
 */
export function fitDiagram(
  els: DiagramEl[],
  width: number,
  minHeight: number,
  pad = 12
): Diagram {
  let minX = 0, minY = 0, maxX = -Infinity, maxY = -Infinity;
  for (const el of els) {
    const [x1, y1, x2, y2] = boundsOf(el);
    if (Number.isFinite(x1) && x1 < minX) minX = x1;
    if (Number.isFinite(y1) && y1 < minY) minY = y1;
    if (Number.isFinite(x2) && x2 > maxX) maxX = x2;
    if (Number.isFinite(y2) && y2 > maxY) maxY = y2;
  }
  const x0 = minX < 0 ? Math.floor(minX - pad) : 0;
  const y0 = minY < 0 ? Math.floor(minY - pad) : 0;
  const right = Number.isFinite(maxX) ? Math.max(width, Math.ceil(maxX + pad)) : width;
  const bottom = Number.isFinite(maxY) ? Math.max(minHeight, Math.ceil(maxY + pad)) : minHeight;
  return { width: right - x0, height: bottom - y0, els, x0, y0 };
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

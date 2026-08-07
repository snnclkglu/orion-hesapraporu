// Kartezyen grafik yardımcıları — diyagram veri modelinin (model.ts) üzerine
// eksen / ızgara / eğri / nokta çizen ortak katman.
//
// Şematik teknik resimlerden (girderSection, wheelShaft…) farklı olarak burada
// GERÇEK bir grafik çizilir: eksen değerleri, "güzel sayı" tikleri, ızgara ve
// veri eğrileri. Buruşma bölümündeki Kσ–α, etkileşim ve ρ indirgeme grafikleri
// bu katmanı kullanır; başka modüller de kullanabilir.
//
// Kullanım:
//   const f = pushChartFrame(els, {x: 60, y: 60, w: 400, h: 240}, xAxis, yAxis);
//   pushCurve(els, f, pts, { color: DCOL.ink });
//   pushPoint(els, f, x, y, "çalışma noktası");

import {
  DCOL, type DiagramEl,
  arrowHead, fmtN, ln, textWidth, txt,
} from "./model";

/** Grafiğin bir ekseni. */
export interface ChartAxis {
  min: number;
  max: number;
  /** Eksen başlığı (birimiyle birlikte) */
  label: string;
  /** Elle tik değerleri; verilmezse `niceTicks` ile üretilir */
  ticks?: number[];
  /** Tik etiketi biçimi (varsayılan: tr-TR, 1-2 hane) */
  format?: (v: number) => string;
  /** İstenen yaklaşık tik sayısı (otomatik tik üretiminde) */
  tickCount?: number;
}

/** Çizim alanı [piksel]. */
export interface ChartArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Çözülmüş grafik çerçevesi — veri koordinatını piksele çevirir. */
export interface ChartFrame {
  area: ChartArea;
  ax: ChartAxis;
  ay: ChartAxis;
  /** Veri x → piksel x */
  px: (v: number) => number;
  /** Veri y → piksel y (yukarı doğru artar) */
  py: (v: number) => number;
  /** Nokta çizim alanının içinde mi */
  inside: (x: number, y: number) => boolean;
}

const OK = "#1F8A5B";
const BAD = "#B4322F";
/** Grafiklerde kullanılan yardımcı renkler — kontrol sonucuyla eşleşir. */
export const CHART_COLORS = { ok: OK, bad: BAD, grid: DCOL.faint, axis: DCOL.ink };

/**
 * Verilen aralığı 1 / 2 / 2,5 / 5 / 10 tabanlı "güzel" adımlarla tikler.
 * Aralık geçersizse boş döner (çağıran ekseni yine de çizer).
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 2.25 ? 2.5 : norm >= 1.5 ? 2 : 1) * mag;
  const out: number[] = [];
  const first = Math.ceil(min / step - 1e-9) * step;
  for (let v = first; v <= max + step * 1e-9; v += step) {
    // Kayan nokta artıklarını temizle (0,30000000000000004 → 0,3)
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return out;
}

function axisTicks(a: ChartAxis): number[] {
  return a.ticks ?? niceTicks(a.min, a.max, a.tickCount ?? 5);
}

function axisFormat(a: ChartAxis): (v: number) => string {
  return a.format ?? ((v) => fmtN(v, 2));
}

/**
 * Eksenleri, ızgarayı ve tik etiketlerini çizer; koordinat dönüştürücüsünü
 * döndürür. Eksen çizgileri veri alanının SOL ve ALT kenarındadır (klasik
 * L düzeni), uçlarında ok başı ve başlık vardır.
 */
export function pushChartFrame(
  els: DiagramEl[],
  area: ChartArea,
  ax: ChartAxis,
  ay: ChartAxis,
  opts?: { grid?: boolean; title?: string; note?: string }
): ChartFrame {
  const { x, y, w, h } = area;
  const spanX = ax.max - ax.min || 1;
  const spanY = ay.max - ay.min || 1;
  const px = (v: number) => x + ((v - ax.min) / spanX) * w;
  const py = (v: number) => y + h - ((v - ay.min) / spanY) * h;
  const inside = (dx: number, dy: number) =>
    Number.isFinite(dx) && Number.isFinite(dy) &&
    dx >= ax.min - spanX * 1e-9 && dx <= ax.max + spanX * 1e-9 &&
    dy >= ay.min - spanY * 1e-9 && dy <= ay.max + spanY * 1e-9;

  const xt = axisTicks(ax);
  const yt = axisTicks(ay);
  const fx = axisFormat(ax);
  const fy = axisFormat(ay);

  // Başlık bloğu üst üste DİZİLİR; hiçbir satır sabit boşlukla konmaz.
  // Aşağıdan yukarı: y ekseni başlığı → alt başlık (note) → grafik başlığı.
  // Her satırın yüksekliği kendi puntosundan gelir (üst çıkıntı + alt uzantı).
  const lineBox = (size: number) => size * 1.1 + 3;
  // Sol kenar: y tik etiketlerinin GERÇEK uzunluğundan çıkar — sabit "−44"
  // uzun etiketlerde (1.250) grafiğin içine, kısa etiketlerde çok dışına
  // düşüyordu.
  const yTickW = yt.reduce((m, t) => Math.max(m, textWidth(txt(0, 0, fy(t), 8))), 0);
  const blockLeft = x - 7 - yTickW;
  // Başlık bloğu SABİT DEĞİLDİR: yeri hesapla belirlenir, gerekirse çözücü
  // biraz daha yukarı iter. Sabitlenirse başka bir eleman üstüne binebilirdi.
  let stackY = y - 13;
  els.push(txt(x - 2, stackY, ay.label, 9, { anchor: "start", fill: DCOL.ink, push: "up" }));
  if (opts?.title) {
    stackY -= lineBox(9);
    if (opts.note) {
      els.push(txt(blockLeft, stackY, opts.note, 8, { fill: DCOL.muted, push: "up" }));
      stackY -= lineBox(8);
    }
    els.push(txt(blockLeft, stackY, opts.title, 10.5, { fill: DCOL.accent, bold: true, push: "up" }));
  }

  // Izgara — eksen çizgilerinin ALTINDA kalması için önce çizilir
  if (opts?.grid !== false) {
    for (const t of xt) els.push(ln(px(t), y, px(t), y + h, DCOL.faint, 0.5, "3,3"));
    for (const t of yt) els.push(ln(x, py(t), x + w, py(t), DCOL.faint, 0.5, "3,3"));
  }

  // Eksenler
  els.push(ln(x, y + h, x + w + 10, y + h, DCOL.ink, 1));
  els.push(arrowHead(x + w + 12, y + h, "right", DCOL.ink, 6, 2.6));
  els.push(ln(x, y + h, x, y - 10, DCOL.ink, 1));
  els.push(arrowHead(x, y - 12, "up", DCOL.ink, 6, 2.6));

  // Tikler ve etiketleri — tik değeri tikin TAM ALTINDA/YANINDA durmalı,
  // çakışma çözücü bunları kaydırmaz (`fixed`), kaçan hep karşı taraftır.
  for (const t of xt) {
    const tx = px(t);
    els.push(ln(tx, y + h, tx, y + h + 4, DCOL.ink, 0.8));
    els.push(txt(tx, y + h + 14, fx(t), 8, { anchor: "middle", fill: DCOL.muted, fixed: true }));
  }
  for (const t of yt) {
    const ty = py(t);
    els.push(ln(x - 4, ty, x, ty, DCOL.ink, 0.8));
    els.push(txt(x - 7, ty + 3, fy(t), 8, { anchor: "end", fill: DCOL.muted, fixed: true }));
  }

  // x ekseni başlığı tik SATIRININ ALTINA iner: aynı taban çizgisinde durduğu
  // sürece en sağdaki tik değeriyle ("1.250") üst üste biniyordu. Boşluk
  // sabit değil, tik etiketinin kendi punto yüksekliğinden gelir.
  // Grafiğin altında kullanım oranı çubuğu / gösterge gibi başka bir kutu
  // varsa başlık AŞAĞI kaçar (push), grafiğin içine değil.
  els.push(
    txt(x + w + 14, y + h + 14 + lineBox(8), ax.label, 9, {
      anchor: "end", fill: DCOL.ink, push: "down",
    })
  );

  return { area, ax, ay, px, py, inside };
}

/** Veri noktalarını (x,y) grafiğe uygun SVG yol dizesine çevirir. */
function polyPath(f: ChartFrame, pts: [number, number][]): string {
  const parts: string[] = [];
  let open = false;
  for (const [dx, dy] of pts) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) { open = false; continue; }
    // Grafik dışına taşan noktalar kırpılmaz, sınıra oturtulur: eğri
    // çerçevenin dışına çıkıp fitDiagram'ı şişirmesin.
    const cx = Math.min(f.ax.max, Math.max(f.ax.min, dx));
    const cy = Math.min(f.ay.max, Math.max(f.ay.min, dy));
    parts.push(`${open ? "L" : "M"} ${f.px(cx).toFixed(2)} ${f.py(cy).toFixed(2)}`);
    open = true;
  }
  return parts.join(" ");
}

/** Eğri çizer. `pts` veri koordinatında [x, y] çiftleridir. */
export function pushCurve(
  els: DiagramEl[],
  f: ChartFrame,
  pts: [number, number][],
  opts?: { color?: string; width?: number; dash?: string; fillTo?: number; fill?: string }
) {
  const d = polyPath(f, pts);
  if (!d) return;
  if (opts?.fillTo !== undefined && pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    const base = Math.min(f.ay.max, Math.max(f.ay.min, opts.fillTo));
    els.push({
      kind: "path",
      d: `${d} L ${f.px(last[0]).toFixed(2)} ${f.py(base).toFixed(2)} L ${f.px(first[0]).toFixed(2)} ${f.py(base).toFixed(2)} Z`,
      fill: opts.fill ?? DCOL.accentSoft,
      stroke: "none",
    });
  }
  els.push({
    kind: "path", d, fill: "none",
    stroke: opts?.color ?? DCOL.ink,
    strokeWidth: opts?.width ?? 1.6,
    dash: opts?.dash,
  });
}

/**
 * Bir fonksiyonu `samples` adımda örnekleyerek eğri çizer.
 * Tanımsız (NaN/Infinity) değerler eğriyi böler.
 */
export function pushFunction(
  els: DiagramEl[],
  f: ChartFrame,
  fn: (x: number) => number,
  opts?: { samples?: number; color?: string; width?: number; dash?: string; from?: number; to?: number }
) {
  const n = opts?.samples ?? 120;
  const a = opts?.from ?? f.ax.min;
  const b = opts?.to ?? f.ax.max;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    pts.push([x, fn(x)]);
  }
  pushCurve(els, f, pts, opts);
}

/** Çalışma noktası — dolu daire + kılavuz çizgiler + etiket. */
export function pushPoint(
  els: DiagramEl[],
  f: ChartFrame,
  x: number,
  y: number,
  label?: string,
  opts?: { color?: string; guides?: boolean; anchor?: "start" | "middle" | "end"; dy?: number }
) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const c = opts?.color ?? DCOL.accent;
  const cx = f.px(Math.min(f.ax.max, Math.max(f.ax.min, x)));
  const cy = f.py(Math.min(f.ay.max, Math.max(f.ay.min, y)));
  if (opts?.guides !== false) {
    els.push(ln(f.px(f.ax.min), cy, cx, cy, c, 0.7, "4,3"));
    els.push(ln(cx, f.py(f.ay.min), cx, cy, c, 0.7, "4,3"));
  }
  els.push({ kind: "circle", cx, cy, r: 3.4, fill: c });
  if (label) {
    const anchor = opts?.anchor ?? "start";
    // `leaderTo`: etiket çakışma yüzünden noktadan uzağa kaçarsa aralarına
    // ince bir bağlantı çizgisi çizilir — hangi etiketin hangi noktayı
    // anlattığı kaybolmaz.
    els.push(
      txt(cx + (anchor === "end" ? -7 : anchor === "start" ? 7 : 0), cy + (opts?.dy ?? -7), label, 8.5, {
        anchor, fill: c, bold: true, leaderTo: [cx, cy],
      })
    );
  }
}

/** Dikey kılavuz çizgisi (dal sınırı, orantı sınırı…). */
export function pushVGuide(
  els: DiagramEl[], f: ChartFrame, x: number, label?: string,
  opts?: { color?: string; dash?: string; labelTop?: boolean }
) {
  if (!Number.isFinite(x) || x < f.ax.min || x > f.ax.max) return;
  const c = opts?.color ?? DCOL.muted;
  const cx = f.px(x);
  els.push(ln(cx, f.area.y, cx, f.area.y + f.area.h, c, 0.8, opts?.dash ?? "5,3"));
  if (label) {
    const y = opts?.labelTop === false ? f.area.y + f.area.h - 6 : f.area.y - 3;
    els.push(txt(cx, y, label, 8, { anchor: "middle", fill: c, leaderTo: [cx, y + 3] }));
  }
}

/** Yatay kılavuz çizgisi. */
export function pushHGuide(
  els: DiagramEl[], f: ChartFrame, y: number, label?: string,
  opts?: { color?: string; dash?: string; anchor?: "start" | "end" }
) {
  if (!Number.isFinite(y) || y < f.ay.min || y > f.ay.max) return;
  const c = opts?.color ?? DCOL.muted;
  const cy = f.py(y);
  els.push(ln(f.area.x, cy, f.area.x + f.area.w, cy, c, 0.8, opts?.dash ?? "5,3"));
  if (label) {
    const anchor = opts?.anchor ?? "end";
    const lx = anchor === "end" ? f.area.x + f.area.w - 4 : f.area.x + 4;
    els.push(txt(lx, cy - 4, label, 8, { anchor, fill: c, leaderTo: [lx, cy] }));
  }
}

/** Gösterge (legend) — grafiğin altına ya da içine yerleşen renk/etiket satırı. */
export function pushLegend(
  els: DiagramEl[],
  x: number,
  y: number,
  items: { color: string; label: string; dash?: string }[],
  opts?: { gap?: number; size?: number }
) {
  const gap = opts?.gap ?? 18;
  const size = opts?.size ?? 8.5;
  let cy = y;
  for (const it of items) {
    els.push(ln(x, cy - 3, x + 16, cy - 3, it.color, 1.8, it.dash));
    els.push(txt(x + 21, cy, it.label, size, { fill: DCOL.ink }));
    cy += gap;
  }
}

/**
 * Kullanım oranı çubuğu — hesaplanan / izin verilen.
 * `ratio` 1'i aşarsa çubuk kırmızıya döner ve taşan kısım koyu gösterilir.
 */
export function pushUtilizationBar(
  els: DiagramEl[],
  x: number, y: number, w: number, h: number,
  ratio: number,
  opts?: { label?: string; valueText?: string }
) {
  const r = Number.isFinite(ratio) ? Math.max(0, ratio) : 0;
  const pass = r <= 1;
  const col = pass ? OK : BAD;
  // Çubuğun kendisi bir ENGELDİR: üstüne eksen başlığı ya da başka bir etiket
  // düşerse dolgu okunmaz olur.
  els.push({ kind: "rect", x, y, w, h, rx: 3, fill: "#FFFFFF", stroke: DCOL.line, strokeWidth: 1, obstacle: true });
  els.push({
    kind: "rect", x: x + 1, y: y + 1, w: Math.max(0, Math.min(1, r)) * (w - 2), h: h - 2,
    rx: 2, fill: col,
  });
  // %100 çizgisi — etiketi çizginin ucunda durmalı, kaçmaz
  els.push(ln(x + w, y - 3, x + w, y + h + 3, DCOL.ink, 1));
  els.push(txt(x + w, y - 6, "%100", 7.5, { anchor: "middle", fill: DCOL.ink, fixed: true }));
  // Çubuğun adı %100 etiketinin soluna sığmıyorsa yukarı kaçar (push: "up"):
  // aşağısı çubuğun kendisidir, oraya kaçarsa dolgunun üstüne biner.
  if (opts?.label) els.push(txt(x, y - 6, opts.label, 8.5, { fill: DCOL.ink, push: "up" }));
  els.push(
    txt(x + w + 8, y + h / 2 + 3, opts?.valueText ?? `%${fmtN(r * 100, 1)}`, 9.5, {
      fill: col, bold: true, push: "down",
    })
  );
}

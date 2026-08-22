"use client";

// Saf Diagram veri modelini web SVG'sine çizen jenerik bileşen.
// Etiketler IBM Plex Mono (--font-mono) ile basılır. PDF, modeldeki sabit
// baskı renklerini kullanır; mühendislik ekranı `themeAware` ile aynı
// semantik renkleri uygulamanın açık/koyu paletine bağlayabilir.

import type { Diagram, DiagramEl } from "@/lib/diagrams/model";

const MONO = "var(--font-mono), ui-monospace, monospace";

/**
 * Model renkleri PDF için gerçek hex değerlerdir. Web tarafında bunları
 * semantik CSS değişkenlerine çeviririz; böylece saf hesap/diyagram modeli
 * tema veya DOM bilmek zorunda kalmaz ve PDF daima beyaz kâğıt kalır.
 */
const THEME_PAINT: Readonly<Record<string, string>> = {
  "#262626": "var(--oc-diagram-ink)",
  "#7A7470": "var(--oc-diagram-muted)",
  "#8A8480": "var(--oc-diagram-muted)",
  "#C9C5C2": "var(--oc-diagram-faint)",
  "#DCD9D7": "var(--oc-diagram-line)",
  "#E7E4E2": "var(--oc-diagram-paper-deep)",
  "#F1EEEC": "var(--oc-diagram-paper)",
  "#FAF8F7": "var(--oc-diagram-canvas-soft)",
  "#FFFFFF": "var(--oc-diagram-canvas)",
  "#A41E1E": "var(--oc-diagram-accent)",
  "#B4322F": "var(--oc-diagram-accent)",
  "#EDE6E6": "var(--oc-diagram-accent-soft)",
  "#F5E6E6": "var(--oc-diagram-accent-soft)",
  "#F7E9E9": "var(--oc-diagram-accent-soft)",
  "#FBEDEC": "var(--oc-diagram-accent-soft)",
  "#1D63B8": "var(--oc-diagram-blue)",
  "#3A6EA5": "var(--oc-diagram-blue-muted)",
  "#4A7A96": "var(--oc-diagram-blue-muted)",
  "#DCEAF2": "var(--oc-diagram-blue-soft)",
  "#1F8A5B": "var(--oc-diagram-green)",
  "#5B8C7B": "var(--oc-diagram-green-muted)",
  "#E7F3EC": "var(--oc-diagram-green-soft)",
};

export function diagramWebPaint(
  paint: string | undefined,
  themeAware: boolean
): string | undefined {
  if (!themeAware || !paint) return paint;
  return THEME_PAINT[paint.toUpperCase()] ?? paint;
}

function renderEl(el: DiagramEl, i: number, themeAware: boolean) {
  const paint = (value: string | undefined) => diagramWebPaint(value, themeAware);
  switch (el.kind) {
    case "line":
      return (
        <line
          key={i}
          x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
          stroke={paint(el.stroke)} strokeWidth={el.strokeWidth}
          strokeDasharray={el.dash} strokeLinecap={el.cap}
        />
      );
    case "rect":
      return (
        <rect
          key={i}
          x={el.x} y={el.y} width={el.w} height={el.h} rx={el.rx}
          fill={paint(el.fill) ?? "none"} stroke={paint(el.stroke)}
          strokeWidth={el.strokeWidth}
        />
      );
    case "circle":
      return (
        <circle
          key={i}
          cx={el.cx} cy={el.cy} r={el.r}
          fill={paint(el.fill) ?? "none"} stroke={paint(el.stroke)}
          strokeWidth={el.strokeWidth} strokeDasharray={el.dash}
        />
      );
    case "path":
      return (
        <path
          key={i}
          d={el.d}
          fill={paint(el.fill) ?? "none"} stroke={paint(el.stroke)}
          strokeWidth={el.strokeWidth} strokeDasharray={el.dash}
          strokeLinecap={el.cap}
        />
      );
    case "polygon":
      return (
        <polygon
          key={i}
          points={el.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill={paint(el.fill) ?? "none"} stroke={paint(el.stroke)}
          strokeWidth={el.strokeWidth}
        />
      );
    case "text":
      return (
        <text
          key={i}
          x={el.x} y={el.y}
          fontSize={el.size}
          textAnchor={el.anchor}
          fill={paint(el.fill)}
          fontFamily={MONO}
          fontWeight={el.bold ? 600 : 400}
        >
          {el.text}
        </text>
      );
  }
}

/**
 * Diyagram DOĞAL ÖLÇEĞİNDE çizilir; kap darsa KÜÇÜLMEZ, kaydırılır.
 *
 * Eskiden yalnız `width: 100%` + `maxWidth` vardı: geniş ekranda diyagram
 * tuval genişliğine oturuyor, DAR ekranda ise sessizce küçülüyordu. Kabındaki
 * `overflow-x-auto` bu yüzden hiç tetiklenmiyordu — kod yorumu yatay kaydırma
 * vaat ediyor ama davranış küçültmeydi.
 *
 * Küçülmenin bedeli okunurluk: ölçü yazıları 7–9,5 tuval biriminde çizilir,
 * yani 700 birimlik bir diyagram 325px'lik telefon sütununa sığdırıldığında
 * 8,5 birimlik kot ~3,9 px'e iner; 900 birimlik kamber şeridi 3,1 px. Bu
 * diyagramlar PDF'e giden modelin ta kendisidir — mühendis ekranda gördüğünü
 * doğrulayamıyordu.
 *
 * `minWidth` = tuval genişliği: yazılar her cihazda masaüstündeki boyutta
 * kalır, dar ekran farkı kaydırmayla kapatır.
 */
export function DiagramSvg({
  diagram,
  className,
  themeAware = false,
}: {
  diagram: Diagram;
  className?: string;
  /** Yalnız uygulama içi görünüm; PDF model renklerini aynen kullanır. */
  themeAware?: boolean;
}) {
  return (
    <svg
      viewBox={`${diagram.x0 ?? 0} ${diagram.y0 ?? 0} ${diagram.width} ${diagram.height}`}
      role="img"
      className={className}
      style={{
        width: "100%",
        height: "auto",
        minWidth: diagram.width,
        maxWidth: diagram.width,
        display: "block",
      }}
    >
      {diagram.els.map((el, i) => renderEl(el, i, themeAware))}
    </svg>
  );
}

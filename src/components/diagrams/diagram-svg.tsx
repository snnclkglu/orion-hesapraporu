"use client";

// Saf Diagram veri modelini web SVG'sine çizen jenerik bileşen.
// Etiketler IBM Plex Mono (--font-mono) ile basılır; renkler modelin
// içinde sabittir (teknik çizim "kağıt" görünümü — temadan bağımsız).

import type { Diagram, DiagramEl } from "@/lib/diagrams/model";

const MONO = "var(--font-mono), ui-monospace, monospace";

function renderEl(el: DiagramEl, i: number) {
  switch (el.kind) {
    case "line":
      return (
        <line
          key={i}
          x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
          stroke={el.stroke} strokeWidth={el.strokeWidth}
          strokeDasharray={el.dash} strokeLinecap={el.cap}
        />
      );
    case "rect":
      return (
        <rect
          key={i}
          x={el.x} y={el.y} width={el.w} height={el.h} rx={el.rx}
          fill={el.fill ?? "none"} stroke={el.stroke}
          strokeWidth={el.strokeWidth}
        />
      );
    case "circle":
      return (
        <circle
          key={i}
          cx={el.cx} cy={el.cy} r={el.r}
          fill={el.fill ?? "none"} stroke={el.stroke}
          strokeWidth={el.strokeWidth} strokeDasharray={el.dash}
        />
      );
    case "path":
      return (
        <path
          key={i}
          d={el.d}
          fill={el.fill ?? "none"} stroke={el.stroke}
          strokeWidth={el.strokeWidth} strokeDasharray={el.dash}
          strokeLinecap={el.cap}
        />
      );
    case "polygon":
      return (
        <polygon
          key={i}
          points={el.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill={el.fill ?? "none"} stroke={el.stroke}
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
          fill={el.fill}
          fontFamily={MONO}
          fontWeight={el.bold ? 600 : 400}
        >
          {el.text}
        </text>
      );
  }
}

export function DiagramSvg({ diagram, className }: { diagram: Diagram; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      role="img"
      className={className}
      style={{ width: "100%", height: "auto", maxWidth: diagram.width, display: "block" }}
    >
      {diagram.els.map(renderEl)}
    </svg>
  );
}

"use client";

// Sihirbaz bölümü diyagramı — bölüm/modül anahtarına göre ilgili parametrik
// diyagramı (ana kiriş kesiti / teker mili / halat donanımı) seçer ve çizer.
// Girdiler değiştikçe canlı güncellenir (props → useMemo).

import { useMemo } from "react";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { diagramsForSection } from "@/lib/diagrams/select";
import { DiagramSvg } from "./diagram-svg";

export function SectionDiagram({
  moduleKey, sectionId, input, result,
}: {
  moduleKey: string;
  sectionId: string;
  input: CalcInput;
  result: CalcResult;
}) {
  const diagrams = useMemo(
    () => diagramsForSection(moduleKey, sectionId, input, result),
    [moduleKey, sectionId, input, result]
  );
  if (diagrams.length === 0) return null;
  // Dar kolonda diyagram KIRPILMAZ, yatay kaydırılır (overflow-x-auto).
  // `oc-scrollx` kenar gölgesiyle kaydırılabilir olduğunu gösterir — mobil
  // tarayıcı kaydırma çubuğu çizmediği için tek ipucu budur. Zemin ve SVG
  // boyaları ortak `oc-diagram-theme` paletinden gelir; koyu modda PDF'in
  // beyaz kâğıt paletini uygulama ekranına zorlamaz.
  return (
    <div className="grid gap-2">
      {diagrams.map((d, i) => (
        <div
          key={i}
          data-diagram={`${moduleKey}-${sectionId}-${i}`}
          className="oc-diagram-theme oc-scrollx overflow-x-auto overscroll-x-contain rounded-lg border bg-[var(--oc-diagram-canvas)] p-2 [--oc-scroll-bg:var(--oc-diagram-canvas)]"
        >
          <DiagramSvg diagram={d} className="mx-auto" themeAware />
        </div>
      ))}
    </div>
  );
}

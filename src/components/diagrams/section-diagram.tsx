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
  // Dar kolonda diyagram KIRPILMAZ, yatay kaydırılır (overflow-x-auto)
  return (
    <div className="grid gap-2">
      {diagrams.map((d, i) => (
        <div
          key={i}
          data-diagram={`${moduleKey}-${sectionId}-${i}`}
          className="overflow-x-auto rounded-lg border bg-white p-2"
        >
          <DiagramSvg diagram={d} className="mx-auto" />
        </div>
      ))}
    </div>
  );
}

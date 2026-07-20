"use client";

// Sihirbaz bölümü diyagramı — bölüm/modül anahtarına göre ilgili parametrik
// diyagramı (ana kiriş kesiti / teker mili / halat donanımı) seçer ve çizer.
// Girdiler değiştikçe canlı güncellenir (props → useMemo).

import { useMemo } from "react";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { diagramForSection } from "@/lib/diagrams/select";
import { DiagramSvg } from "./diagram-svg";

export function SectionDiagram({
  moduleKey, sectionId, input, result,
}: {
  moduleKey: string;
  sectionId: string;
  input: CalcInput;
  result: CalcResult;
}) {
  const diagram = useMemo(
    () => diagramForSection(moduleKey, sectionId, input, result),
    [moduleKey, sectionId, input, result]
  );
  if (!diagram) return null;
  return (
    <div
      data-diagram={`${moduleKey}-${sectionId}`}
      className="overflow-hidden rounded-lg border bg-white p-2"
    >
      <DiagramSvg diagram={diagram} className="mx-auto" />
    </div>
  );
}

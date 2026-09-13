import { formatDrawingCode, type DrawingPlanRow } from "../drawing-plan";
import { orderedDrawingPlan } from "./presentation";
import {
  DEFAULT_DRAWING_NUMBERING,
  type DrawingCandidate,
  type DrawingNumbering,
} from "./types";

export function numberingError(numbering: DrawingNumbering): string | null {
  if (
    ![numbering.main, numbering.auxiliary].every(
      (n) => Number.isInteger(n) && n >= 200 && n <= 9000 && n % 100 === 0,
    )
  )
    return "Başlangıçlar 0200–9000 arasında, 100'ün katı olmalı.";
  if (numbering.auxiliary <= numbering.main)
    return "İkinci araba başlangıcı ana arabadan sonra olmalı.";
  return null;
}
export function candidateCode(
  candidate: DrawingCandidate,
  used: Set<string>,
  numbering = DEFAULT_DRAWING_NUMBERING,
): string | null {
  const starts = {
    general: 100,
    main: numbering.main,
    auxiliary: numbering.auxiliary,
    mono1: numbering.auxiliary + 1000,
    mono2: numbering.auxiliary + 2000,
  };
  const ends = {
    general: numbering.main - 100,
    main: numbering.auxiliary - 100,
    auxiliary: numbering.auxiliary + 900,
    mono1: numbering.auxiliary + 1900,
    mono2: 9900,
  };
  const start = starts[candidate.block] + (candidate.parentKey ? 100 : 0);
  const end = candidate.assembly
    ? starts[candidate.block]
    : Math.min(9900, ends[candidate.block]);
  for (let n = start; n <= end; n += 100) {
    const code = formatDrawingCode(n);
    if (!used.has(code)) return code;
  }
  return null;
}

/** Önizleme üretir; bir çakışmada eski defterin tamamı korunur. */
export function renumberDrawingPlan(
  rows: DrawingPlanRow[],
  candidates: DrawingCandidate[],
  numbering: DrawingNumbering,
): { rows: DrawingPlanRow[]; error?: string } {
  const invalid = numberingError(numbering);
  if (invalid) return { rows, error: invalid };
  const used = new Set(
    rows
      .filter((r) => r.overrides?.includes("code") || r.suppressed)
      .map((r) => r.code),
  );
  const byKey = new Map(candidates.map((c) => [c.key, c]));
  const codes = new Map<string, string>();
  for (const { row } of orderedDrawingPlan(rows)) {
    if (row.overrides?.includes("code")) continue;
    const parent = rows.find((r) => r.id === row.parentId);
    const candidate = byKey.get(row.sourceKey ?? "") ?? {
      key: row.id,
      name: row.name,
      reason: "",
      parentKey: parent?.sourceKey ?? (parent ? parent.id : null),
      block: byKey.get(parent?.sourceKey ?? "")?.block ?? "general",
    };
    const code = candidateCode(candidate, used, numbering);
    if (!code)
      return {
        rows,
        error: `${row.name}: numara alanı dolu. Başlangıçları genişletin veya sabitlenmiş kodları kontrol edin.`,
      };
    used.add(code);
    codes.set(row.id, code);
  }
  return {
    rows: rows.map((row) =>
      codes.has(row.id) ? { ...row, code: codes.get(row.id)! } : row,
    ),
  };
}

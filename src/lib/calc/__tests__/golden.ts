// Golden test yardımcıları: Excel dökümünü (reference/excel-dump) okuyup
// FORMULA hücrelerinin VALUE alanlarını motor çıktısıyla karşılaştırır.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface DumpCell {
  cell: string;
  formula: string;
  value: number | string;
}

const DUMP_DIR = join(process.cwd(), "reference", "excel-dump");

export function loadFormulaCells(fileName: string): DumpCell[] {
  const text = readFileSync(join(DUMP_DIR, fileName), "utf-8");
  const cells: DumpCell[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const parts = rawLine.split("\t");
    if (parts.length < 4 || parts[1] !== "FORMULA") continue;
    const cell = parts[0];
    const formula = parts[2];
    const m = rawLine.match(/VALUE=(.*)$/);
    if (!m) continue;
    const raw = m[1];
    const asNum = Number(raw);
    cells.push({ cell, formula, value: raw !== "" && !Number.isNaN(asNum) ? asNum : raw });
  }
  return cells;
}

/** Karşılaştırmadan hariç tutulacak hücreler */
export function isDecorative(c: DumpCell): boolean {
  // K sütunu: sadece "=" işareti basan süsleme hücreleri; P228 de aynı.
  if (/^K\d+$/.test(c.cell)) return true;
  if (c.formula.trim() === "=") return true;
  return false;
}

/** Göreli tolerans karşılaştırması (sayı) / birebir (metin) */
export function compareCell(
  expected: number | string,
  actual: number | string | undefined,
  relTol = 1e-6
): { ok: boolean; message?: string } {
  if (actual === undefined) return { ok: false, message: "motor bu hücreyi üretmiyor" };
  if (typeof expected === "string" || typeof actual === "string") {
    return String(actual) === String(expected)
      ? { ok: true }
      : { ok: false, message: `beklenen "${expected}", gelen "${actual}"` };
  }
  const diff = Math.abs(actual - expected);
  const tol = Math.max(Math.abs(expected) * relTol, 1e-9);
  return diff <= tol
    ? { ok: true }
    : { ok: false, message: `beklenen ${expected}, gelen ${actual} (fark ${diff})` };
}

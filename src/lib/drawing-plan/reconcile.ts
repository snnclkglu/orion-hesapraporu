import type { DrawingPlanRow } from "../drawing-plan";
import { candidateCode } from "./numbering";
import {
  DEFAULT_DRAWING_NUMBERING,
  DRAWING_PLAN_LIMIT,
  type DrawingCandidate,
  type DrawingPlanChange,
  type DrawingNumbering,
} from "./types";

/** Aynı kaynak tekrar geldiğinde satırlar çoğalmaz; elle verilmiş kararlar korunur. */
export function reconcileDrawingPlan(
  rows: DrawingPlanRow[],
  candidates: DrawingCandidate[],
  numbering: DrawingNumbering = DEFAULT_DRAWING_NUMBERING,
  options: {
    applyChanges?: boolean;
    allowExisting?: boolean;
    id?: () => string;
  } = {},
): { rows: DrawingPlanRow[]; changes: DrawingPlanChange[] } {
  const changes: DrawingPlanChange[] = [];
  const result = rows.map((row) => ({ ...row }));
  const byKey = new Map(
    result.filter((r) => r.sourceKey).map((r) => [r.sourceKey!, r]),
  );
  const used = new Set(rows.map((r) => r.code));
  const wanted = new Map(candidates.map((c) => [c.key, c]));
  const legacy = rows.length > 0 && rows.every((r) => !r.sourceKey);
  const structural = candidates.some((c) => {
    const old = byKey.get(c.key);
    return (
      old &&
      !old.suppressed &&
      old.origin !== "manual" &&
      (rows.find((r) => r.id === old.parentId)?.sourceKey ?? null) !==
        c.parentKey &&
      !old.overrides?.includes("parentId")
    );
  });
  for (const old of rows) {
    if (
      old.sourceKey &&
      old.origin !== "manual" &&
      !old.suppressed &&
      !wanted.has(old.sourceKey)
    )
      changes.push({
        key: old.sourceKey,
        kind: "removed",
        message: `${old.name}: hesapta artık bulunmuyor; silin veya manuel tutun.`,
      });
  }
  for (const candidate of candidates) {
    const old = byKey.get(candidate.key);
    if (old?.suppressed || old?.origin === "manual") continue;
    if (candidate.parentKey && byKey.get(candidate.parentKey)?.suppressed)
      continue;
    if (old) {
      const parent = candidate.parentKey
        ? byKey.get(candidate.parentKey)
        : undefined;
      if (
        (rows.find((r) => r.id === old.parentId)?.sourceKey ?? null) !==
          candidate.parentKey &&
        !old.overrides?.includes("parentId")
      ) {
        changes.push({
          key: candidate.key,
          kind: "move",
          message: `${old.name}: bağlı montaj değişti.`,
        });
        if (options.applyChanges) old.parentId = parent?.id ?? null;
      }
      if (old.name !== candidate.name && !old.overrides?.includes("name")) {
        changes.push({
          key: candidate.key,
          kind: "rename",
          message: `${old.name} → ${candidate.name}`,
        });
        if (options.applyChanges) old.name = candidate.name;
      }
      if (options.applyChanges)
        old.generated = {
          name: candidate.name,
          parentKey: candidate.parentKey,
          code: old.code,
        };
      continue;
    }
    if (candidate.optional) continue;
    changes.push({
      key: candidate.key,
      kind: "add",
      message: `${candidate.name}: eklenecek.`,
    });
    if (
      (legacy && !options.allowExisting) ||
      (structural && !options.applyChanges)
    )
      continue;
    const parent = candidate.parentKey
      ? byKey.get(candidate.parentKey)
      : undefined;
    if (candidate.parentKey && (!parent || parent.suppressed)) continue;
    const code = candidateCode(candidate, used, numbering);
    if (!code || result.length >= DRAWING_PLAN_LIMIT) {
      changes.push({
        key: candidate.key,
        kind: "space",
        message: `${candidate.name}: numara alanı veya satır sınırı dolu. Numara düzenini inceleyin.`,
      });
      continue;
    }
    const siblings = result.filter(
      (r) => (r.parentId ?? null) === (parent?.id ?? null),
    );
    const row: DrawingPlanRow = {
      id: options.id?.() ?? crypto.randomUUID(),
      code,
      name: candidate.name,
      status: "bekliyor",
      drawnBy: null,
      drawnByName: "",
      note: "",
      parentId: parent?.id ?? null,
      sortOrder:
        Math.max(-1, ...siblings.map((r) => r.sortOrder ?? Number(r.code))) + 1,
      sourceKey: candidate.key,
      origin: "auto",
      generated: { name: candidate.name, parentKey: candidate.parentKey, code },
      overrides: [],
      suppressed: false,
      reason: candidate.reason,
    };
    result.push(row);
    byKey.set(candidate.key, row);
    used.add(code);
  }
  // Yer yetersizken bir topoloji değişikliğinin yarısını kaydetmeyiz.
  if (
    structural &&
    options.applyChanges &&
    changes.some((c) => c.kind === "space")
  )
    return { rows, changes };
  return { rows: result, changes };
}

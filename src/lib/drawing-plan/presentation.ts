import type { DrawingPlanRow } from "../drawing-plan";

/** Kardeş sırası ve bütün alt montajlar tek yerde düzleştirilir. */
export function orderedDrawingPlan(
  rows: readonly DrawingPlanRow[],
): { row: DrawingPlanRow; depth: number }[] {
  const visible = rows.filter((row) => !row.suppressed);
  const ids = new Set(visible.map((row) => row.id));
  const children = new Map<string | null, DrawingPlanRow[]>();
  for (const row of visible) {
    const parent = row.parentId && ids.has(row.parentId) ? row.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), row]);
  }
  for (const group of children.values())
    group.sort(
      (a, b) =>
        (a.sortOrder ?? Number(a.code)) - (b.sortOrder ?? Number(b.code)) ||
        a.code.localeCompare(b.code),
    );
  const out: { row: DrawingPlanRow; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (row: DrawingPlanRow, depth: number) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    out.push({ row, depth });
    for (const child of children.get(row.id) ?? []) visit(child, depth + 1);
  };
  for (const root of children.get(null) ?? []) visit(root, 0);
  // Eski/bozuk ilişkide satırı gizlemek yerine görünür tutar; yazma doğrulaması döngüyü reddeder.
  for (const row of visible) if (!seen.has(row.id)) visit(row, 0);
  return out;
}

export function drawingDescendants(
  rows: readonly DrawingPlanRow[],
  id: string,
): Set<string> {
  const found = new Set([id]);
  for (let pass = 0; pass < rows.length; pass++) {
    const size = found.size;
    for (const row of rows)
      if (row.parentId && found.has(row.parentId)) found.add(row.id);
    if (found.size === size) break;
  }
  return found;
}

export function moveDrawingRow(
  rows: DrawingPlanRow[],
  id: string,
  direction: -1 | 1,
): DrawingPlanRow[] {
  const row = rows.find((r) => r.id === id);
  if (!row) return rows;
  const siblings = orderedDrawingPlan(rows)
    .map((r) => r.row)
    .filter((r) => (r.parentId ?? null) === (row.parentId ?? null));
  const index = siblings.findIndex((r) => r.id === id);
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return rows;
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  const positions = new Map(siblings.map((r, i) => [r.id, i]));
  return rows.map((r) =>
    positions.has(r.id)
      ? {
          ...r,
          sortOrder: positions.get(r.id)!,
          overrides: [
            ...new Set([...(r.overrides ?? []), "sortOrder" as const]),
          ],
        }
      : r,
  );
}

/** Otomatik silme tercihini saklar; elle eklenmiş ebeveyn silinince yetim ilişki bırakmaz. */
export function removeDrawingGroup(
  rows: DrawingPlanRow[],
  id: string,
  keepChildren: boolean,
): DrawingPlanRow[] {
  const parentId = rows.find((r) => r.id === id)?.parentId ?? null;
  const removed = keepChildren ? new Set([id]) : drawingDescendants(rows, id);
  const result = rows.flatMap((row) =>
    removed.has(row.id)
      ? row.sourceKey
        ? [{ ...row, suppressed: true }]
        : []
      : [
          {
            ...row,
            ...(keepChildren && row.parentId === id
              ? {
                  parentId,
                  overrides: [
                    ...new Set([...(row.overrides ?? []), "parentId" as const]),
                  ],
                }
              : {}),
          },
        ],
  );
  const retained = new Set(result.map((r) => r.id));
  return result.map((row) =>
    row.parentId && !retained.has(row.parentId)
      ? {
          ...row,
          parentId: parentId && retained.has(parentId) ? parentId : null,
        }
      : row,
  );
}

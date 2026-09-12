import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { workflowSchema, weekDays, recurrenceSchema } from "./model";
it("kontrol listesinde aynı adım kimliği ve hatalı tekrar reddedilir", () => {
  const id = crypto.randomUUID(),
    item = { id, text: "Kontrol", done: false };
  expect(
    workflowSchema.safeParse({ id, version: 1, checklist: [item, item] })
      .success,
  ).toBe(false);
  expect(workflowSchema.safeParse({ id, version: 1 }).success).toBe(false);
  expect(workflowSchema.safeParse({ id, checklist: [] }).success).toBe(false);
  expect(
    recurrenceSchema.safeParse({ mode: "weekly", interval: 0 }).success,
  ).toBe(false);
  expect(
    recurrenceSchema.safeParse({ mode: "monthly", interval: 1, day: 32 })
      .success,
  ).toBe(false);
});
it("hafta pazartesi başlar; yıl değişiminde yedi farklı tarih taşır", () => {
  expect(weekDays("2027-01-01")).toEqual([
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
  ]);
});
it("SQL ve istemci tekrar kipleri ve sınırları aynı kalır", () => {
  const sql = readFileSync(
    "supabase/migrations/20260912000011_task_workflow.sql",
    "utf8",
  );
  for (const mode of recurrenceSchema.shape.mode.options)
    expect(sql).toContain(`'${mode}'`);
  expect(sql).toContain("jsonb_array_length(items)>30");
  expect(sql).toContain("between 1 and 180");
  expect(sql).toContain("between 1 and 52");
  expect(sql).toContain("between 1 and 31");
  const weekSql = readFileSync(
    "supabase/migrations/20260912000012_task_week_inbox.sql",
    "utf8",
  );
  expect(weekSql).toContain("date_trunc(''week'',today)::date+7");
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  createTaskSchema,
  updateTaskSchema,
  dateSchema,
  isOverdue,
  goalProgress,
  statuses,
  priorities,
  filtersSchema,
} from "./model";
describe("Görev sözleşmesi", () => {
  it("eski Menü bağlantısını normalleştirir, Yaklaşan sorgusunu korur", () => {
    const result=filtersSchema.parse({view:"menu",period:"upcoming"});
    expect(result.view).toBe("mine");
    expect(result.period).toBe("upcoming");
  });
  it("sayfa imlecindeki zaman ve kimliği veritabanından önce doğrular", () => {
    expect(filtersSchema.safeParse({ cursor: "bozuk|kimlik" }).success).toBe(
      false,
    );
    expect(
      filtersSchema.safeParse({
        cursor: `2026-09-12T09:00:00.123+00:00|${crypto.randomUUID()}`,
      }).success,
    ).toBe(true);
  });
  it("yalnız başlıkla oluşturur; istemci sahip veya aktör atayamaz", () => {
    expect(createTaskSchema.parse({ title: "  Kontrol et " })).toEqual({
      title: "Kontrol et",
    });
    expect(
      createTaskSchema.safeParse({
        title: "İş",
        created_by: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("gerçekte olmayan takvim gününü reddeder", () => {
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(dateSchema.safeParse("2028-02-29").success).toBe(true);
  });
  it("güncellemede sürüm ve kimlik zorunludur", () => {
    expect(
      updateTaskSchema.safeParse({ id: crypto.randomUUID(), title: "Başlık" })
        .success,
    ).toBe(false);
    expect(
      updateTaskSchema.parse({
        id: crypto.randomUUID(),
        version: 2,
        due_date: null,
      }).due_date,
    ).toBeNull();
  });
  it("tamamlanan veya tarihsiz görev gecikmiş değildir", () => {
    expect(
      isOverdue({ status: "done", due_date: "2026-01-01" }, "2026-02-01"),
    ).toBe(false);
    expect(
      isOverdue({ status: "doing", due_date: "2026-01-01" }, "2026-02-01"),
    ).toBe(true);
    expect(isOverdue({ status: "todo", due_date: null }, "2026-02-01")).toBe(
      false,
    );
  });
  it("bağlı görev yoksa hedef yüzdesi uydurmaz", () => {
    expect(goalProgress(0, 0)).toBeNull();
    expect(goalProgress(4, 1)).toBe(25);
  });
  it("SQL ve TypeScript durum/öncelik sözlükleri ayrışmaz", () => {
    const sql = readFileSync(
      "supabase/migrations/20260912000001_task_workspace.sql",
      "utf8",
    );
    for (const dictionary of [statuses, priorities])
      for (const key of Object.keys(dictionary))
        expect(sql).toContain(`'${key}'`);
    expect(sql).toContain("task_done_consistent");
  });
});

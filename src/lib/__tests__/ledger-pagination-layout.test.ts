import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("ana defter tablolarının yerleşim ve sayfalama sözleşmesi", () => {
  it("Teklifler satır zeminini müşteri tonuyla boyamaz ve sütunlar yüzde 100'dür", () => {
    const source = read("src/app/(app)/offers/offers-table.tsx");
    expect(source).not.toContain('className="oc-row-hue"');
    expect(source).toContain('label: "Müşteri", en: "w-[9.1%]"');
    expect(source).toContain('<TableHead className="w-[13.9%]">Kapsam</TableHead>');
    expect(source).toContain('containerClassName="!overflow-x-hidden"');
  });

  it("Satış Takibi tüm satırları süzdükten sonra 100'lük sayfaya böler", () => {
    const source = read("src/app/(app)/sales/sales-table.tsx");
    expect(source).toContain("const PAGE_SIZE = 100");
    expect(source.indexOf("const filtered = useMemo")).toBeLessThan(
      source.indexOf("const visibleRows = filtered.slice")
    );
    expect(source).toContain("visibleRows.map((r)");
    expect(source).toContain("total={filtered.length}");
    expect(source).not.toContain("oc-table-clamp");
    expect(source).toContain("!overflow-x-hidden");
  });

  it("Satış tutarlarını yalnız sunumda tam sayıya yuvarlar", () => {
    const source = read("src/app/(app)/sales/sales-table.tsx");
    expect(source).toContain('maximumFractionDigits: 0');
    expect(source).toContain("fmtWhole(r.totalPrice)");
    expect(source).toContain("fmtWhole(r.eurAmount)");
  });

  it("İşler sıralanmış/süzülmüş kümenin 100 satırlık açık sayfasını gösterir", () => {
    const table = read("src/app/(app)/jobs/jobs-table.tsx");
    const views = read("src/app/(app)/jobs/jobs-views.tsx");
    expect(table).toContain("const PAGE_SIZE = 100");
    expect(table).toContain("const visibleRows = sorted.slice");
    expect(table).toContain("visibleRows.map((j)");
    expect(table).toContain("total={sorted.length}");
    expect(table).not.toContain("oc-table-clamp");
    expect(table).toContain('containerClassName="!overflow-x-hidden"');
    expect(views.indexOf("const filtered = useMemo")).toBeLessThan(
      views.indexOf("<JobsTable")
    );
  });
});

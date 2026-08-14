import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260814000001_consumable_expenses.sql"),
  "utf8"
);
const importSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260814000002_import_consumable_expenses.sql"),
  "utf8"
);

describe("sarf giderleri migration sözleşmesi", () => {
  it("TypeScript ile aynı rol kümelerini ve dar yazma RLS'ini taşır", () => {
    expect(schemaSql).toMatch(/role::text in \('admin', 'purchasing', 'planning'\)/);
    expect(schemaSql).toMatch(/role::text in \('admin', 'purchasing'\)/);
    expect(schemaSql).toMatch(/purchase_consumable_expenses_insert[\s\S]*can_edit_consumable_expenses\(\)/);
    expect(schemaSql).toMatch(/purchase_consumable_expenses_delete[\s\S]*can_edit_consumable_expenses\(\)/);
  });

  it("EUR'u satır kurundan üretir ve import kaynağını değişmez/tekil korur", () => {
    expect(schemaSql).toContain("generated always as (amount / fx_rate) stored");
    expect(schemaSql).toContain("currency <> 'EUR' or fx_rate = 1");
    expect(schemaSql).toContain("purchase_consumable_expense_source_ref");
    expect(schemaSql).toMatch(/new\.source is distinct from old\.source/);
    expect(schemaSql).toMatch(/new\.legacy_payload is distinct from old\.legacy_payload/);
  });

  it("liste ve aylık görünümü RLS'i security_invoker ile korur", () => {
    expect(schemaSql.match(/with \(security_invoker = true\)/g)).toHaveLength(2);
    expect(schemaSql).toContain("purchase_consumable_expense_records");
    expect(schemaSql).toContain("purchase_consumable_monthly");
  });
});

describe("eski sarf Excel aktarım sözleşmesi", () => {
  it("1.364 kaynak satırı ve 751 SM tanımını eksiksiz taşır", () => {
    expect(importSql.match(/\('SARF GİDERLER ESKİ VERİ!\d+'/g)).toHaveLength(1364);
    expect(importSql.match(/^  \('SM\d{4}',/gm)).toHaveLength(751);
    expect(importSql).toContain("actual_rows <> 1364");
    expect(importSql).toContain("actual_items <> 751");
  });

  it("iş benzerliğiyle dedupe etmez; kaynak izi ve kalite sayımlarını korur", () => {
    expect(importSql).toContain("duplicate_candidates <> 10");
    expect(importSql).toContain("blank_items <> 101");
    expect(importSql).toContain("blank_suppliers <> 2");
    expect(importSql).toContain("period_mismatches <> 4");
    expect(importSql).toContain("fx_outliers <> 2");
    expect(importSql).toContain("existing.source_ref = incoming.source_ref");
  });

  it("Excel toplamlarını guard ile doğrular", () => {
    expect(importSql).toContain("actual_try - 5156297.55");
    expect(importSql).toContain("raw_eur - 118577.65");
  });
});

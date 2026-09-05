import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read(
  "supabase/migrations/20260905000001_offer_job_engineering_transfer.sql"
);

describe("teklif → iş emri → mühendislik veri sözleşmesi", () => {
  it("kazanılmış/yayınlı teklifi tek işlemde işe bağlar", () => {
    expect(migration).toContain("create or replace function public.create_job_from_offer");
    expect(migration).toContain("v_offer.status::text <> 'won'");
    expect(migration).toContain("v_revision.status::text <> 'issued'");
    expect(migration).toContain("update public.offers set job_id = v_job_id");
    expect(migration).toContain("insert into public.offer_job_conversions");
    expect(migration).toContain("insert into public.offer_engineering_handoffs");
  });

  it("mühendislik aktarım tablosunda ticari fiyat kolonları yoktur", () => {
    const handoffTable = migration.slice(
      migration.indexOf("create table if not exists public.offer_engineering_handoffs"),
      migration.indexOf("create index if not exists offer_engineering_handoffs_job_idx")
    );
    expect(handoffTable).not.toMatch(/unit_price|manual_cost|discount|payment|total_price/i);
    expect(handoffTable).toContain("technical_facts jsonb");
    expect(handoffTable).toContain("technical_snapshot jsonb");
    expect(migration).toContain("where entry.key = any (array[");
    expect(migration).toContain("'mainCapacityT', 'auxCapacityT', 'spanM'");
    expect(migration).not.toContain("coalesce(v_item->'technical_snapshot'");
    expect(migration).not.toContain("coalesce(v_item->'unmapped_fields'");
  });

  it("V0'ı iş emri ve benzersiz iş kalemi olmadan oluşturmaz", () => {
    expect(migration).toContain("create or replace function public.create_engineering_report_v0");
    expect(migration).toContain("if v_job.status::text <> 'active'");
    expect(migration).toContain("if nullif(btrim(p_job_item_no), '') is null");
    expect(migration).toContain("if v_item_count <> 1");
    expect(migration).toContain("if v_item_project_id is not null");
    expect(migration).toContain("p_source_mode not in ('manual', 'from_offer')");
  });

  it("arayüz bağımsız mühendislik raporu önermiyor ve iki başlangıç modu sunuyor", () => {
    const dialog = read("src/app/(app)/projects/new-project-dialog.tsx");
    const actions = read("src/app/(app)/projects/actions.ts");
    expect(dialog).toContain('<TabsTrigger value="manual">');
    expect(dialog).toContain('<TabsTrigger value="from_offer">');
    expect(dialog).not.toContain("Bağımsız (İşe Atanmamış)");
    expect(actions).toContain('job_id: z.uuid("İş emri seçilmeli")');
    expect(actions).toContain('job_item_id: z.uuid("İş kalemi seçilmeli")');
  });
});

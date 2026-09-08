import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function source(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

describe("hesap raporunu yayımdan geri çekme koruması", () => {
  const migration = source("supabase", "migrations", "20260908000007_revision_withdraw.sql");
  const actions = source(
    "src", "app", "(app)", "projects", "[id]", "revisions", "[revId]", "actions.ts"
  );
  const page = source(
    "src", "app", "(app)", "projects", "[id]", "revisions", "[revId]", "revision-page-view.tsx"
  );

  it("SQL yalnız issued → draft ve boş yayım damgalarına izin verir", () => {
    expect(migration).toContain("new.status = 'draft'");
    expect(migration).toContain("new.issued_at is null");
    expect(migration).toContain("new.issued_by is null");
    expect(migration).toContain("- 'status' - 'issued_at' - 'issued_by' - 'updated_at'");
  });

  it("silme ve şablon yönetimi korumalarını muhafaza eder", () => {
    expect(migration).toContain("Yayınlanmış revizyon silinemez");
    expect(migration).toContain("- 'is_template' - 'updated_at'");
  });

  it("sunucu eylemi içeriğe dokunmaz, yetkiyi doğrular ve denetim izi bırakır", () => {
    expect(actions).toContain('canEditReports(profile?.role)');
    expect(actions).toContain('canEditOffers(profile?.role)');
    expect(actions).toContain('.update({ status: "draft", issued_at: null, issued_by: null })');
    expect(actions).toContain('.eq("status", "issued")');
    expect(actions).toContain('.eq("is_template", false)');
    expect(actions).toContain('action: "revision.withdraw"');
    expect(actions).toContain("archived_pdf_preserved: true");
  });

  it("düğmeyi yalnız yayımlanmış ve yazma yetkili revizyonda gösterir", () => {
    expect(page).toContain('revision.status === "issued" && canWithdraw');
    expect(page).toContain("<WithdrawRevisionButton");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DELETION_ENTITY_TYPES } from "@/lib/deletion-requests";

const migrationSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260823000003_deletion_approval.sql"),
  "utf8"
);

const actionFiles = [
  "src/app/(app)/jobs/actions.ts",
  "src/app/(app)/projects/actions.ts",
  "src/app/(app)/drawings/actions.ts",
  "src/app/(app)/offers/actions.ts",
  "src/app/(app)/offers/cost-actions.ts",
  "src/app/(app)/personnel/actions.ts",
  "src/app/(app)/personnel/document-actions.ts",
  "src/app/(app)/projects/[id]/spec-actions.ts",
  "src/app/(app)/projects/[id]/electrical/actions.ts",
  "src/app/(app)/projects/[id]/manual/actions.ts",
  "src/app/(app)/projects/[id]/revisions/[revId]/equipment/attachment-actions.ts",
];

describe("kalıcı silme onay migration sözleşmesi", () => {
  it("arayüzdeki her hedef türünü kuyruk, koruma ve onay silmesinde taşır", () => {
    for (const entityType of DELETION_ENTITY_TYPES) {
      expect(migrationSql).toContain(`'${entityType}'`);
      expect(migrationSql).toContain(
        `public.guard_approved_deletion('${entityType}', 'id')`
      );
      expect(migrationSql).toMatch(
        new RegExp(`when '${entityType}' then delete from public\\.[a-z_]+`)
      );
    }
  });

  it("kuyruğa doğrudan yazma politikası açmaz ve kararı yalnız dar RPC'lerden geçirir", () => {
    expect(migrationSql).toContain("alter table public.deletion_requests enable row level security");
    expect(migrationSql).toContain("INSERT/UPDATE/DELETE politikası bilinçli olarak YOKTUR");
    expect(migrationSql).not.toMatch(/create policy[\s\S]{0,150}for (insert|update|delete)/i);
    expect(migrationSql).toContain("create or replace function public.request_deletion");
    expect(migrationSql).toContain("create or replace function public.approve_deletion_request");
    expect(migrationSql).toContain("create or replace function public.reject_deletion_request");
    expect(migrationSql).toContain("if v_reviewer is null or not public.is_admin()");
  });

  it("mevcut kalıcı silme Server Action'ları ortak onay kuyruğunu kullanır", () => {
    const sources = actionFiles.map((file) => readFileSync(join(process.cwd(), file), "utf8"));
    for (const entityType of DELETION_ENTITY_TYPES) {
      expect(sources.some((source) => source.includes(`entityType: "${entityType}"`))).toBe(true);
    }
  });

  it("el kitabı oluşturma telafisini normal silme kuyruğundan ayrı ve dar tutar", () => {
    const manualActions = readFileSync(
      join(process.cwd(), "src/app/(app)/projects/[id]/manual/actions.ts"),
      "utf8"
    );
    expect(manualActions).not.toMatch(/from\("manual_revisions"\)\.delete\(/);
    expect(manualActions).toContain('rpc("rollback_manual_revision_copy"');
    expect(migrationSql).toContain("r.created_by = v_user");
    expect(migrationSql).toContain("r.created_at >= now() - interval '15 minutes'");
  });
});

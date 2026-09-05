import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

const engineeringUiFiles = [
  "src/app/(app)/projects/projects-table.tsx",
  "src/app/(app)/projects/jobs/[jobId]/page.tsx",
  "src/app/(app)/projects/[id]/project-header.tsx",
  "src/app/(app)/projects/[id]/project-page-view.tsx",
  "src/app/(app)/projects/[id]/manual/[revId]/page.tsx",
];

describe("Mühendislik gezinme sınırı", () => {
  it("kullanıcıyı İşler listesine veya iş detayına bağlamaz", () => {
    const ui = engineeringUiFiles.map(source).join("\n");

    expect(ui).not.toContain('href="/jobs"');
    expect(ui).not.toContain("href={`/jobs/");
    expect(ui).not.toContain("backHref={`/jobs/");
    expect(ui).not.toContain("backHref={job ? `/jobs/");
    expect(ui).not.toContain("İş Kartını Aç");
  });

  it("Mühendisliğin kendi iş-doküman tablosunu ve kalem bağını korur", () => {
    const table = source("src/app/(app)/projects/projects-table.tsx");
    const header = source("src/app/(app)/projects/[id]/project-header.tsx");
    const dialog = source("src/app/(app)/projects/new-project-dialog.tsx");
    const actions = source("src/app/(app)/projects/actions.ts");

    expect(table).toContain('jobGroupBasePath = "/projects/jobs"');
    expect(header).toContain('href={`${basePath}/jobs/${job.id}`}');
    expect(dialog).toContain('name="job_id"');
    expect(dialog).toContain('name="job_item_id"');
    expect(actions).toContain(".update({ project_id: project.id })");
  });
});

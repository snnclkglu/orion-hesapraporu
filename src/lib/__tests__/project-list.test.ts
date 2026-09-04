import { describe, expect, it } from "vitest";
import {
  buildProjectListEntries,
  projectEntryMatches,
  projectEntryRevisionLabel,
  projectEntryStatusLabel,
  projectRowsFromRecords,
  type ProjectRow,
} from "@/lib/project-list";

function row(
  id: string,
  input: Partial<ProjectRow> & Pick<ProjectRow, "doc_no" | "name">
): ProjectRow {
  return {
    id,
    customer: "ASTOR A.Ş.",
    crane_type: "Gezer Köprülü Vinç",
    status: "active",
    created_at: "2026-08-01T08:00:00Z",
    job_id: null,
    job_no: null,
    lastRevNo: 0,
    lastRevStatus: "draft",
    hasIssuedRevision: false,
    ...input,
  };
}

describe("Mühendislik ana defteri — iş bazında katlama", () => {
  const rows = [
    row("single", {
      doc_no: "0063-00",
      name: "TEK VİNÇ",
      job_id: "job-63",
      job_no: "0063",
      job_title: "TEK KALEMLİ İŞ",
    }),
    row("multi-1", {
      doc_no: "0057-01",
      name: "BİRİNCİ VİNÇ",
      job_id: "job-57",
      job_no: "0057",
      job_title: "MUHTELİF VİNÇLER",
      job_customer: "ASTOR A.Ş.",
      lastRevNo: 1,
      lastRevStatus: "issued",
      hasIssuedRevision: true,
    }),
    row("multi-2", {
      doc_no: "0057-02",
      name: "İKİNCİ VİNÇ",
      job_id: "job-57",
      job_no: "0057",
      job_title: "MUHTELİF VİNÇLER",
      job_customer: "ASTOR A.Ş.",
      status: "archived",
      created_at: "2025-12-01T08:00:00Z",
    }),
    row("free", { doc_no: "B-001", name: "BAĞIMSIZ RAPOR" }),
  ];

  it("tek dokümanlı işi ve bağımsız raporu korur, çok dokümanlı işi tek satıra indirir", () => {
    const entries = buildProjectListEntries(rows, true);

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.kind)).toEqual(["project", "job", "project"]);
    const group = entries[1];
    expect(group.kind).toBe("job");
    if (group.kind !== "job") return;
    expect(group.jobId).toBe("job-57");
    expect(group.jobTitle).toBe("MUHTELİF VİNÇLER");
    expect(group.projects.map((project) => project.doc_no)).toEqual([
      "0057-01",
      "0057-02",
    ]);
  });

  it("işin iç sayfasında katlamayı kapatınca bütün dokümanları ayrı tutar", () => {
    const entries = buildProjectListEntries(rows, false);
    expect(entries).toHaveLength(rows.length);
    expect(entries.every((entry) => entry.kind === "project")).toBe(true);
  });

  it("grubu çocuk doküman no/ad/yıl/müşteri ve karma durum üzerinden bulur", () => {
    const group = buildProjectListEntries(rows, true).find(
      (entry) => entry.kind === "job"
    );
    expect(group).toBeDefined();
    if (!group) return;

    expect(projectEntryMatches(group, { query: "0057-02" })).toBe(true);
    expect(projectEntryMatches(group, { query: "ikinci vinç" })).toBe(true);
    expect(projectEntryMatches(group, { query: "muhtelif" })).toBe(true);
    expect(projectEntryMatches(group, { year: "2025" })).toBe(true);
    expect(projectEntryMatches(group, { customer: "ASTOR A.Ş." })).toBe(true);
    expect(projectEntryMatches(group, { status: "active" })).toBe(true);
    expect(projectEntryMatches(group, { status: "archived" })).toBe(true);
    expect(projectEntryMatches(group, { query: "bulunmayan" })).toBe(false);
  });

  it("grup satırında tek revizyon/durum uydurmak yerine özet sayar", () => {
    const group = buildProjectListEntries(rows, true).find(
      (entry) => entry.kind === "job"
    );
    expect(group).toBeDefined();
    if (!group) return;

    expect(projectEntryRevisionLabel(group)).toBe("1 yayın · 1 taslak");
    expect(projectEntryStatusLabel(group)).toBe("1 Aktif · 1 Arşiv");
  });
});

describe("Supabase proje satırının liste modeline çevrilmesi", () => {
  it("son revizyonu ve yayın/taslak sayılarını aynı yerde çıkarır", () => {
    const [mapped] = projectRowsFromRecords([
      {
        id: "project-1",
        doc_no: "0057-01",
        name: "VİNÇ",
        customer: "ASTOR A.Ş.",
        crane_type: "Portal Vinç",
        status: "active",
        created_at: "2026-08-01T08:00:00Z",
        job_id: "job-57",
        jobs: [{ job_no: "0057", title: "MUHTELİF VİNÇLER", customer: "ASTOR A.Ş." }],
        revisions: [
          { rev_no: 0, status: "issued" },
          { rev_no: 1, status: "draft" },
        ],
      },
    ]);

    expect(mapped).toMatchObject({
      job_no: "0057",
      job_title: "MUHTELİF VİNÇLER",
      lastRevNo: 1,
      lastRevStatus: "draft",
      revisionCount: 2,
      draftRevisionCount: 1,
      issuedRevisionCount: 1,
      hasIssuedRevision: true,
    });
  });
});

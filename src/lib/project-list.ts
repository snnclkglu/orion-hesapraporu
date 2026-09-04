/**
 * Mühendislik proje defterinin saf liste modeli.
 *
 * Hesap raporu bir İŞ KALEMİNE aittir; ana defter ise kalem sayısı büyüdükçe
 * iş başına tek satır kalmalıdır. Bu modül yalnız o sunum kararını verir:
 * aynı işe bağlı tek rapor doğrudan kalır, iki veya daha fazla rapor tek bir
 * iş satırına katlanır. DB/HTTP/React bağımlılığı yoktur.
 */

export interface ProjectRow {
  id: string;
  doc_no: string;
  name: string;
  customer: string;
  crane_type: string;
  crane_location?: string | null;
  report_brand_customer_id?: string | null;
  end_customer_id?: string | null;
  /** projects.status — "active" | "archived" */
  status: string;
  created_at: string;
  job_id: string | null;
  job_no: string | null;
  job_title?: string | null;
  job_customer?: string | null;
  lastRevNo: number | null;
  lastRevStatus: string | null;
  hasIssuedRevision: boolean;
  revisionCount?: number;
  draftRevisionCount?: number;
  issuedRevisionCount?: number;
}

export interface ProjectListRecord {
  id: string;
  doc_no: string;
  name: string;
  customer: string;
  crane_type: string;
  crane_location?: string | null;
  report_brand_customer_id?: string | null;
  end_customer_id?: string | null;
  status: string;
  created_at: string;
  job_id?: string | null;
  jobs?:
    | { job_no: string; title: string; customer: string }
    | { job_no: string; title: string; customer: string }[]
    | null;
  revisions?: { rev_no: number; status: string }[] | null;
}

export type ProjectListEntry =
  | {
      kind: "project";
      key: string;
      project: ProjectRow;
      projects: ProjectRow[];
    }
  | {
      kind: "job";
      key: string;
      jobId: string;
      jobNo: string;
      jobTitle: string;
      jobCustomer: string;
      projects: ProjectRow[];
    };

export interface ProjectListFilters {
  year?: string;
  customer?: string;
  status?: "active" | "archived";
  query?: string;
}

/** Supabase ilişki satırlarını istemciye giden yalın defter satırına çevirir. */
export function projectRowsFromRecords(
  records: readonly ProjectListRecord[]
): ProjectRow[] {
  return records.map((record) => {
    const revisions = record.revisions ?? [];
    const lastRev = [...revisions].sort((a, b) => b.rev_no - a.rev_no)[0];
    const job = Array.isArray(record.jobs) ? record.jobs[0] : record.jobs;
    return {
      id: record.id,
      doc_no: record.doc_no,
      name: record.name,
      customer: record.customer,
      crane_type: record.crane_type,
      crane_location: record.crane_location,
      report_brand_customer_id: record.report_brand_customer_id,
      end_customer_id: record.end_customer_id,
      status: record.status,
      created_at: record.created_at,
      job_id: record.job_id ?? null,
      job_no: job?.job_no ?? null,
      job_title: job?.title ?? null,
      job_customer: job?.customer ?? null,
      lastRevNo: lastRev?.rev_no ?? null,
      lastRevStatus: lastRev?.status ?? null,
      hasIssuedRevision: revisions.some((revision) => revision.status === "issued"),
      revisionCount: revisions.length,
      draftRevisionCount: revisions.filter((revision) => revision.status === "draft").length,
      issuedRevisionCount: revisions.filter((revision) => revision.status === "issued").length,
    };
  });
}

/** Projenin yılı — kayıt tarihinden. */
export function projectYear(p: Pick<ProjectRow, "created_at">): string {
  return /^(\d{4})/.exec(p.created_at ?? "")?.[1] ?? "";
}

function firstNonEmpty(values: readonly (string | null | undefined)[]): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

/**
 * Ana Mühendislik defterini iş bazında katlar.
 *
 * Girdi sırası korunur: grup, o işe ait ilk projenin bulunduğu yerde doğar.
 * İç sayfa ve Teklif Hesap Raporları bu katlamayı kapatarak doküman satırlarını
 * birebir göstermeye devam eder.
 */
export function buildProjectListEntries(
  projects: readonly ProjectRow[],
  groupByJob: boolean
): ProjectListEntry[] {
  if (!groupByJob) {
    return projects.map((project) => ({
      kind: "project",
      key: `project:${project.id}`,
      project,
      projects: [project],
    }));
  }

  const byJob = new Map<string, ProjectRow[]>();
  for (const project of projects) {
    if (!project.job_id) continue;
    const rows = byJob.get(project.job_id) ?? [];
    rows.push(project);
    byJob.set(project.job_id, rows);
  }

  const emittedJobs = new Set<string>();
  const entries: ProjectListEntry[] = [];
  for (const project of projects) {
    const grouped = project.job_id ? byJob.get(project.job_id) ?? [] : [];
    if (project.job_id && grouped.length > 1) {
      if (emittedJobs.has(project.job_id)) continue;
      emittedJobs.add(project.job_id);
      entries.push({
        kind: "job",
        key: `job:${project.job_id}`,
        jobId: project.job_id,
        jobNo: firstNonEmpty(grouped.map((row) => row.job_no)),
        jobTitle: firstNonEmpty(grouped.map((row) => row.job_title)) || project.name,
        jobCustomer:
          firstNonEmpty(grouped.map((row) => row.job_customer)) || project.customer,
        projects: grouped,
      });
      continue;
    }

    entries.push({
      kind: "project",
      key: `project:${project.id}`,
      project,
      projects: [project],
    });
  }
  return entries;
}

export function projectEntryName(entry: ProjectListEntry): string {
  return entry.kind === "job" ? entry.jobTitle : entry.project.name;
}

export function projectEntryCustomer(entry: ProjectListEntry): string {
  return entry.kind === "job" ? entry.jobCustomer : entry.project.customer;
}

export function projectEntryJobNo(entry: ProjectListEntry): string {
  return entry.kind === "job" ? entry.jobNo : entry.project.job_no ?? "";
}

export function projectEntryDocLabel(entry: ProjectListEntry): string {
  return entry.kind === "job"
    ? `${entry.projects.length} doküman`
    : entry.project.doc_no;
}

export function projectEntryCraneTypes(entry: ProjectListEntry): string[] {
  return [...new Set(entry.projects.map((row) => row.crane_type.trim()).filter(Boolean))];
}

export function projectEntryCraneLabel(entry: ProjectListEntry): string {
  const types = projectEntryCraneTypes(entry);
  if (types.length <= 1) return types[0] ?? "—";
  return `${types.length} vinç tipi`;
}

/** Grup satırında tek bir V numarası uydurulmaz; dokümanların güncel hâli sayılır. */
export function projectEntryRevisionLabel(entry: ProjectListEntry): string {
  if (entry.kind === "project") {
    const { lastRevNo, lastRevStatus } = entry.project;
    if (lastRevNo === null) return "—";
    const status = lastRevStatus === "issued" ? "Yayınlandı" : "Taslak";
    return `V${lastRevNo} ${status}`;
  }

  const issued = entry.projects.filter((row) => row.lastRevStatus === "issued").length;
  const draft = entry.projects.filter((row) => row.lastRevStatus === "draft").length;
  const empty = entry.projects.filter((row) => row.lastRevNo === null).length;
  const other = entry.projects.length - issued - draft - empty;
  const parts = [
    issued > 0 ? `${issued} yayın` : "",
    draft > 0 ? `${draft} taslak` : "",
    empty > 0 ? `${empty} rapor yok` : "",
    other > 0 ? `${other} diğer` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

export function projectEntryStatusLabel(entry: ProjectListEntry): string {
  const active = entry.projects.filter((row) => row.status !== "archived").length;
  const archived = entry.projects.length - active;
  if (entry.kind === "project") return archived ? "Arşiv" : "Aktif";
  return [
    active > 0 ? `${active} Aktif` : "",
    archived > 0 ? `${archived} Arşiv` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function projectEntryIsArchived(entry: ProjectListEntry): boolean {
  return entry.projects.every((row) => row.status === "archived");
}

export function projectEntryMatches(
  entry: ProjectListEntry,
  filters: ProjectListFilters
): boolean {
  if (filters.year && !entry.projects.some((row) => projectYear(row) === filters.year)) {
    return false;
  }
  if (
    filters.customer &&
    !entry.projects.some((row) => row.customer.trim() === filters.customer)
  ) {
    return false;
  }
  if (
    filters.status &&
    !entry.projects.some((row) =>
      filters.status === "archived" ? row.status === "archived" : row.status !== "archived"
    )
  ) {
    return false;
  }

  const query = filters.query?.trim().toLocaleLowerCase("tr-TR") ?? "";
  if (!query) return true;
  const haystack = [
    projectEntryJobNo(entry),
    projectEntryName(entry),
    projectEntryCustomer(entry),
    ...entry.projects.flatMap((row) => [
      row.doc_no,
      row.name,
      row.customer,
      row.crane_type,
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase("tr-TR");
  return haystack.includes(query);
}

export type ProjectListSortKey =
  | "job_no"
  | "doc_no"
  | "name"
  | "customer"
  | "crane_type"
  | "rev"
  | "status";

export function projectEntrySortValue(
  entry: ProjectListEntry,
  key: ProjectListSortKey
): string | number {
  switch (key) {
    case "job_no":
      return projectEntryJobNo(entry);
    case "doc_no":
      return entry.projects.reduce(
        (latest, row) =>
          row.doc_no.localeCompare(latest, "tr", { numeric: true }) > 0 ? row.doc_no : latest,
        ""
      );
    case "name":
      return projectEntryName(entry);
    case "customer":
      return projectEntryCustomer(entry);
    case "crane_type":
      return projectEntryCraneLabel(entry);
    case "rev":
      return Math.max(-1, ...entry.projects.map((row) => row.lastRevNo ?? -1));
    case "status":
      return projectEntryStatusLabel(entry);
  }
}

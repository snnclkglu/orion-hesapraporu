/** Fiyatsız teklif teknik aktarımının Yeni Hesap Raporu seçici modeli. */
export interface EngineeringHandoffOption {
  id: string;
  sourceOfferNo: string;
  sourceRevisionNo: number;
  eligibility: "eligible" | "review" | "not_applicable";
  craneType: string;
  technicalFacts: Record<string, string | number>;
  mappedFields: string[];
  warnings: string[];
}

export interface EngineeringHandoffRecord {
  id: string;
  job_id: string;
  job_item_no: string;
  source_offer_no: string;
  source_revision_no: number;
  eligibility: string;
  crane_type: string;
  technical_facts: unknown;
  mapped_fields: unknown;
  warnings: unknown;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function facts(value: unknown): Record<string, string | number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string | number] =>
        typeof entry[1] === "string" ||
        (typeof entry[1] === "number" && Number.isFinite(entry[1]))
    )
  );
}

export function indexEngineeringHandoffs(
  rows: readonly EngineeringHandoffRecord[]
): Map<string, EngineeringHandoffOption> {
  const out = new Map<string, EngineeringHandoffOption>();
  for (const row of rows) {
    const key = `${row.job_id}:${row.job_item_no}`;
    if (out.has(key)) continue;
    out.set(key, {
      id: row.id,
      sourceOfferNo: row.source_offer_no,
      sourceRevisionNo: row.source_revision_no,
      eligibility:
        row.eligibility === "eligible" || row.eligibility === "not_applicable"
          ? row.eligibility
          : "review",
      craneType: row.crane_type ?? "",
      technicalFacts: facts(row.technical_facts),
      mappedFields: stringList(row.mapped_fields),
      warnings: stringList(row.warnings),
    });
  }
  return out;
}

import type { CalcInput } from "@/lib/calc/engine";
import { contentHash } from "./types";
export function readOfferCalculationOrigin(value: unknown): { itemId: string; offerRevisionId?: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const origin = value as Record<string, unknown>;
  if (typeof origin.itemId !== "string" || !origin.itemId || origin.itemId.length > 200) return undefined;
  return { itemId: origin.itemId, ...(typeof origin.offerRevisionId === "string" && origin.offerRevisionId.length <= 200 ? { offerRevisionId: origin.offerRevisionId } : {}) };
}
export interface OfferCalculationSource {
  projectId: string;
  revisionId: string;
  revisionNo: number;
  craneType?: string;
  importedAt: string;
  hash: string;
  /** Belge kaynağı canlı join değildir: yayımlandığı içerik korunur. */
  input: CalcInput;
  rows: Record<string, Record<string, string>>;
  pending?: string[];
  equipment: { key: string; component: string; brand: string; model: string; spec: string; qty: string | number }[];
}

/** Teklif payload okuyucusu hesap motorunu istemci paketine taşımaz. */
export function readOfferCalculationSource(value: unknown): OfferCalculationSource | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as OfferCalculationSource;
  try {
    const object = (item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item);
    const id = (item: unknown) => typeof item === "string" && item.length > 0 && item.length <= 200;
    if (JSON.stringify(v).length > 2_000_000 || !id(v.projectId) || !id(v.revisionId) || !Number.isSafeInteger(v.revisionNo) || v.revisionNo < 0 || typeof v.importedAt !== "string" || !Number.isFinite(Date.parse(v.importedAt)) || typeof v.hash !== "string" || !object(v.input) || !object(v.input.specs) || !object(v.rows) || !Array.isArray(v.equipment)) return undefined;
    if (v.hash !== contentHash(v.input) || Object.values(v.rows).some(row => !object(row) || Object.values(row).some(value => typeof value !== "string"))) return undefined;
    if (Object.entries(v.input).some(([key, state]) => key !== "specs" && (!object(state) || !object(state.inputs) || !object(state.selections)))) return undefined;
    if (v.equipment.some(row => !object(row) || (["key", "component", "brand", "model", "spec"] as const).some(key => typeof row[key] !== "string") || (typeof row.qty !== "string" && !(typeof row.qty === "number" && Number.isFinite(row.qty) && row.qty >= 0)))) return undefined;
    return { projectId: v.projectId, revisionId: v.revisionId, revisionNo: v.revisionNo, craneType: typeof v.craneType === "string" ? v.craneType.slice(0, 300) : undefined, importedAt: v.importedAt, hash: v.hash, input: v.input, rows: v.rows, equipment: v.equipment,
      pending: Array.isArray(v.pending) ? v.pending.filter(value => typeof value === "string").slice(0, 1000) : undefined };
  } catch { return undefined; }
}

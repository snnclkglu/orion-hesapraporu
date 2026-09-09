import type { TechnicalSpecs } from "@/lib/calc/types";
import type { ModulesState } from "@/lib/calc/state";
import type { ModuleKey } from "@/lib/calc/presentation/module-family";
import type { CatalogRow } from "@/lib/catalog-mapping";
import type { AgirlikDokumuDurumu } from "@/lib/weights/types";

export const SELECTION_VERSION = "1.1.0";
export type BrandKey = "motor" | "hoistGearbox" | "travelGearbox" | "brake" | "hoistBrake" | "travelBrake" | "motorCoupling" | "wheelCoupling" | "drumCoupling" | "bearing" | "rope" | "buffer";
export const BRAND_LABELS: Record<BrandKey, string> = {
  motor: "Motor", hoistGearbox: "Kaldırma redüktörü", travelGearbox: "Yürütme redüktörü",
  brake: "Eski ortak fren tercihi", hoistBrake: "Kaldırma servis freni", travelBrake: "Yürütme freni",
  motorCoupling: "Motor kaplini", wheelCoupling: "Teker kaplini", drumCoupling: "Tambur kaplini",
  bearing: "Rulman", rope: "Halat", buffer: "Tampon",
};
export type Brands = Partial<Record<BrandKey, string>>;
export interface EquipmentRow extends CatalogRow { kind: string; datasheet_url?: string | null }
export interface SelectionRequest {
  /** Yalnız destek kapsamı bildirimi; fiziksel hesap ve topoloji girdisi değildir. */
  craneType?: string;
  specs: TechnicalSpecs;
  modules: ModulesState;
  active: ModuleKey[];
  brands: Brands;
  /** Bölüm kilidi: main.2.4; alan kilidi: main.inputs.shaftD2Mm. */
  locks: string[];
  sizeDesigns: boolean;
  enableStructuralChecks?: boolean;
  /** Ölçülmüş kalem/grup ağırlıkları ve mühendis notları aynı döküme girer. */
  weightBreakdown?: AgirlikDokumuDurumu;
  /** Firma tasarım toleransı; standart hükmü değildir. */
  speedTolerancePct: number;
}
export interface SelectionIssue {
  code: string;
  module?: ModuleKey;
  message: string;
  state: "failed" | "missing" | "review" | "unsupported";
}
export interface SelectionDecision {
  module: ModuleKey;
  section: string;
  label: string;
  variantKey: string;
  row: EquipmentRow;
  checked: string[];
  /** Son bağlı hesabın sonuçları; seçimin ilk aday anına ait eski değerler değil. */
  evidence?: SelectionEvidence[];
}
export interface SelectionEvidence {
  id: string;
  label: string;
  computed: number | null;
  limit?: number | null;
  min?: number | null;
  max?: number | null;
  operator: "≤" | "≥" | "…" | "=";
  unit: string;
  pass: boolean;
  standard?: string;
}
export interface SelectionTrace {
  version: string;
  engineVersion: string;
  createdAt: string;
  sourceHash: string;
  resultHash: string;
  catalogHash: string;
  brands: Brands;
  locks: string[];
  decisions: SelectionDecision[];
  issues: SelectionIssue[];
  evaluations: number;
  status: "readyForReview" | "incomplete";
  search: "bounded";
  designProfile?: string;
  weightSourceHash?: string;
  /** Kullanıcının üretici/imalat kontrol notları; bir hesap geçer sonucu değildir. */
  review?: { inputHash: string; notes: Record<string, string>; evidence?: Record<string, ExternalReviewEvidence>; reviewedAt: string; reviewedBy?: string };
}
export interface ExternalReviewEvidence {
  source: string;
  reference: string;
  method: "manufacturer" | "calculation" | "measurement";
  /** Gereken yerde üreticinin doğrulanan sayısal sınırı. */
  value?: number;
  unit?: string;
}
export interface SelectionProposal {
  active?: ModuleKey[];
  specs: TechnicalSpecs;
  modules: ModulesState;
  trace: SelectionTrace;
}
export interface SelectionProgress { stage: string; completed: number; total: number; evaluations: number }

/** Anahtar sırasından bağımsız; sayı hatalarını JSON null'a saklamaz. */
export function stableStringify(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) return `"!${value}"`;
  if (value === undefined) return '"!undefined"';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Yerel eşitlik/iz kimliği; güvenlik veya imza amacı taşımaz. */
export function contentHash(value: unknown): string {
  const text = stableStringify(value);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}
export function selectionSourceHash(specs: TechnicalSpecs, modules: ModulesState, active: ModuleKey[]): string {
  return contentHash({ specs, modules, active: [...active].sort() });
}

import {
  PRODUCT_IDENTITY_FIELDS,
  type IdentitySource,
  type ProductIdentityField,
  type ProductIdentityValues,
  type ProductPortalPayload,
  type ResolvedIdentityField,
} from "./types";

const EMPTY_IDENTITY = Object.fromEntries(
  PRODUCT_IDENTITY_FIELDS.map((key) => [key, ""])
) as ProductIdentityValues;

export function alphaSuffix(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1) return "";
  let value = ordinal;
  let out = "";
  while (value > 0) {
    value -= 1;
    out = String.fromCharCode(65 + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out;
}
/** İş emrindeki "2 Adet" gibi serbest metni yalnız açık bir tam sayıysa okur. */
export function unitCountFromQuantity(value: string | null | undefined): number | null {
  const match = String(value ?? "").match(/(?:^|\s)(\d{1,3})(?:[\s.,]|$)/);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 && count <= 99 ? count : null;
}

export function suggestedSerialNo(serialBase: string, ordinal: number, unitCount: number): string {
  const base = serialBase.trim();
  if (!base) return "";
  return unitCount > 1 ? `${base}-${alphaSuffix(ordinal)}` : base;
}

export function defaultPortalPayload({
  serialBase,
  supportEmail,
  documents = [],
}: {
  serialBase: string;
  supportEmail?: string;
  documents?: ProductPortalPayload["documents"];
}): ProductPortalPayload {
  return {
    v: 1,
    serialBase: serialBase.trim(),
    plate: { widthMm: 240, heightMm: 160 },
    overrides: {},
    hiddenFields: [],
    portal: {
      title: "Teknik Dokümanlar",
      note: "Bu sayfa, vincin güncel teslim dokümanlarına güvenli erişim sağlar.",
      supportEmail: supportEmail?.trim() ?? "",
    },
    documents,
  };
}

function finiteDimension(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 80 && number <= 1000 ? number : fallback;
}

/** Eski/eksik JSONB kayıtlarını bugünkü sözleşmeye sessiz ve uydurmasız taşır. */
export function withProductPortalDefaults(raw: unknown): ProductPortalPayload {
  const value = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const plate = value.plate && typeof value.plate === "object" && !Array.isArray(value.plate)
    ? value.plate as Record<string, unknown>
    : {};
  const portal = value.portal && typeof value.portal === "object" && !Array.isArray(value.portal)
    ? value.portal as Record<string, unknown>
    : {};
  const overridesRaw = value.overrides && typeof value.overrides === "object" && !Array.isArray(value.overrides)
    ? value.overrides as Record<string, unknown>
    : {};
  const overrides: Partial<Record<ProductIdentityField, string>> = {};
  for (const key of PRODUCT_IDENTITY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(overridesRaw, key)) {
      overrides[key] = String(overridesRaw[key] ?? "").slice(0, 180);
    }
  }
  const hidden = new Set(
    Array.isArray(value.hiddenFields) ? value.hiddenFields.map(String) : []
  );
  const documents = Array.isArray(value.documents)
    ? value.documents.filter((entry): entry is ProductPortalPayload["documents"][number] =>
        Boolean(entry && typeof entry === "object" && !Array.isArray(entry)))
    : [];

  let issuedIdentity: ProductIdentityValues | undefined;
  if (value.issuedIdentity && typeof value.issuedIdentity === "object" && !Array.isArray(value.issuedIdentity)) {
    const rawIdentity = value.issuedIdentity as Record<string, unknown>;
    issuedIdentity = { ...EMPTY_IDENTITY };
    for (const key of PRODUCT_IDENTITY_FIELDS) issuedIdentity[key] = String(rawIdentity[key] ?? "");
  }

  return {
    v: 1,
    serialBase: String(value.serialBase ?? "").slice(0, 80),
    plate: {
      widthMm: finiteDimension(plate.widthMm, 240),
      heightMm: finiteDimension(plate.heightMm, 160),
      ...(Number(plate.holeDiameterMm) > 0 ? { holeDiameterMm: Number(plate.holeDiameterMm) } : {}),
      ...(Number(plate.holeInsetMm) > 0 ? { holeInsetMm: Number(plate.holeInsetMm) } : {}),
    },
    overrides,
    hiddenFields: PRODUCT_IDENTITY_FIELDS.filter((key) => hidden.has(key)),
    portal: {
      title: String(portal.title ?? "Teknik Dokümanlar").slice(0, 100),
      note: String(portal.note ?? "").slice(0, 600),
      supportEmail: String(portal.supportEmail ?? "").slice(0, 160),
    },
    documents,
    ...(issuedIdentity ? { issuedIdentity } : {}),
  };
}

export function resolveIdentityFields(
  automatic: ProductIdentityValues,
  sources: Record<ProductIdentityField, IdentitySource>,
  overrides: ProductPortalPayload["overrides"]
): ResolvedIdentityField[] {
  return PRODUCT_IDENTITY_FIELDS.map((key) => {
    const overridden = Object.prototype.hasOwnProperty.call(overrides, key);
    return {
      key,
      autoValue: automatic[key],
      effectiveValue: overridden ? String(overrides[key] ?? "") : automatic[key],
      overridden,
      source: sources[key],
    };
  });
}

export function identityValues(fields: readonly ResolvedIdentityField[]): ProductIdentityValues {
  const values = { ...EMPTY_IDENTITY };
  for (const field of fields) values[field.key] = field.effectiveValue;
  return values;
}

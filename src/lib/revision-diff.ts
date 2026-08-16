// Revizyon karşılaştırma: iki revizyon snapshot'ı (inputs/selections/results)
// arasındaki farkları modül bazında çıkarır. Saf fonksiyon — testlidir.

import type { AnyCheck } from "./calc/types";

export interface FieldDiff {
  module: string;      // specs | mainHoist | ... (MODULE_LABELS anahtarı)
  kind: "input" | "selection";
  key: string;         // alan anahtarı (FIELD_LABELS ile etiketlenir)
  a: unknown;
  b: unknown;
}

export interface CheckDiff {
  id: string;
  label: string;
  aPass: boolean | null;  // null = o revizyonda yok
  bPass: boolean | null;
}

export interface RevisionDiff {
  fields: FieldDiff[];
  checks: CheckDiff[];
  engineVersionA: string;
  engineVersionB: string;
}

type Snapshot = {
  inputs: Record<string, unknown> | null;
  selections: Record<string, unknown> | null;
  results: { allChecks?: AnyCheck[]; engineVersion?: string } | null;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function diffModuleObjects(
  moduleKey: string,
  kind: "input" | "selection",
  a: unknown,
  b: unknown,
  out: FieldDiff[]
) {
  const ao = isPlainObject(a) ? a : {};
  const bo = isPlainObject(b) ? b : {};
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const key of keys) {
    const av = ao[key];
    const bv = bo[key];
    if (isPlainObject(av) || isPlainObject(bv)) {
      // iç içe yapı (ör. buckling side/top panelleri) — bir seviye açılır
      const aInner = isPlainObject(av) ? av : {};
      const bInner = isPlainObject(bv) ? bv : {};
      const innerKeys = new Set([...Object.keys(aInner), ...Object.keys(bInner)]);
      for (const ik of innerKeys) {
        if (JSON.stringify(aInner[ik]) !== JSON.stringify(bInner[ik])) {
          out.push({ module: moduleKey, kind, key: `${key}.${ik}`, a: aInner[ik], b: bInner[ik] });
        }
      }
      continue;
    }
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      out.push({ module: moduleKey, kind, key, a: av, b: bv });
    }
  }
}

export function diffRevisions(a: Snapshot, b: Snapshot): RevisionDiff {
  const fields: FieldDiff[] = [];

  const aInputs = a.inputs ?? {};
  const bInputs = b.inputs ?? {};
  const moduleKeys = new Set([...Object.keys(aInputs), ...Object.keys(bInputs)]);
  for (const mk of moduleKeys) {
    // Kapalı bölüm ve gizli alt bölüm listeleri modül nesnesi değil, dizidir —
    // ayrı ele alınırlar.
    if (mk === "disabledModules" || mk === "hiddenSections") continue;
    diffModuleObjects(mk, "input", aInputs[mk], bInputs[mk], fields);
  }

  // Açık/kapalı hesap bölümü değişimi ayrı bir fark satırı olarak görünür;
  // aksi hâlde bir bölümün rapordan çıkarılması karşılaştırmada kaybolurdu.
  const aOff = Array.isArray(aInputs.disabledModules) ? [...aInputs.disabledModules].sort() : [];
  const bOff = Array.isArray(bInputs.disabledModules) ? [...bInputs.disabledModules].sort() : [];
  if (JSON.stringify(aOff) !== JSON.stringify(bOff)) {
    fields.push({
      module: "specs",
      kind: "input",
      key: "disabledModules",
      a: aOff.length ? aOff.join(", ") : "—",
      b: bOff.length ? bOff.join(", ") : "—",
    });
  }

  // Gizlenen alt bölüm değişimi de aynı biçimde ayrı bir satırdır: raporun
  // içeriğini değiştiren bir karar karşılaştırmada kaybolmamalı.
  const aHid = Array.isArray(aInputs.hiddenSections) ? [...aInputs.hiddenSections].sort() : [];
  const bHid = Array.isArray(bInputs.hiddenSections) ? [...bInputs.hiddenSections].sort() : [];
  if (JSON.stringify(aHid) !== JSON.stringify(bHid)) {
    fields.push({
      module: "specs",
      kind: "input",
      key: "hiddenSections",
      a: aHid.length ? aHid.join(", ") : "—",
      b: bHid.length ? bHid.join(", ") : "—",
    });
  }

  const aSel = a.selections ?? {};
  const bSel = b.selections ?? {};
  const selKeys = new Set([...Object.keys(aSel), ...Object.keys(bSel)]);
  for (const mk of selKeys) {
    if (mk === "alts") continue; // alternatif setleri ayrı gösterilmez
    diffModuleObjects(mk, "selection", aSel[mk], bSel[mk], fields);
  }

  // Kontrol durumu değişimleri
  const aChecks = new Map((a.results?.allChecks ?? []).map((c) => [c.id, c]));
  const bChecks = new Map((b.results?.allChecks ?? []).map((c) => [c.id, c]));
  const checkIds = new Set([...aChecks.keys(), ...bChecks.keys()]);
  const checks: CheckDiff[] = [];
  for (const id of checkIds) {
    const ac = aChecks.get(id);
    const bc = bChecks.get(id);
    const aPass = ac ? ac.pass : null;
    const bPass = bc ? bc.pass : null;
    if (aPass !== bPass) {
      checks.push({ id, label: (bc ?? ac)!.label, aPass, bPass });
    }
  }

  return {
    fields,
    checks,
    engineVersionA: a.results?.engineVersion ?? "",
    engineVersionB: b.results?.engineVersion ?? "",
  };
}

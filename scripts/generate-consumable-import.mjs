#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const SOURCE_FILE = "SARF GİDERLER ESKİ VERİ.xlsx";
const SHEET_NAME = "SARF GİDERLER ESKİ VERİ";
const OUTPUT_FILE = "20260814000002_import_consumable_expenses.sql";
const IMPORT_SOURCE = "excel-consumables-2026-08";
const EXPECTED_HEADERS = [
  "Yıl",
  "Dönem",
  "Tarih",
  "Cari Adı",
  "Belge Numarası",
  "Ana Kategori",
  "Alt Kategori",
  "Tanım",
  "Resim Numarası",
  "Bölüm",
  "Açıklama",
  "Açıklama",
  "Araç Plakası",
  "İç Çap",
  "Dış Çap",
  "Boy",
  "Adet",
  "Teorik Ağırlık (Kg)",
  "Kalite",
  "Miktar",
  "Birimi",
  "Birim Fiyat",
  "Toplam Fiyat",
  "Birim Fiyat",
  "Toplam Fiyat",
  "EUR KUR",
];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourcePath = path.resolve(process.argv[2] ?? path.join(repoRoot, "..", SOURCE_FILE));
const outputPath = path.resolve(
  process.argv[3] ?? path.join(repoRoot, "supabase", "migrations", OUTPUT_FILE)
);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(
    "Usage: node scripts/generate-consumable-import.mjs [source.xlsx] [output.sql]"
  );
  process.exit(0);
}

function fail(message) {
  throw new Error(`Consumable import generation failed: ${message}`);
}

function isBlank(value) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function text(value) {
  return isBlank(value) ? "" : String(value).trim();
}

function number(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${label} must be a finite number; received ${JSON.stringify(value)}`);
  }
  return value;
}

function upperName(value) {
  return text(value).toLocaleUpperCase("tr-TR");
}

/** Keep byte-for-byte parity with src/lib/purchasing/consumable-key.ts. */
function consumableMatchKey(value) {
  return text(value)
    .normalize("NFKC")
    .toLocaleUpperCase("tr-TR")
    .replace(/&/g, " VE ")
    .replace(/Ø/g, " ")
    .replace(/[’'`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** The narrower audit key is used only to explain a key-count contract change. */
function legacyAuditMaterialKey(value) {
  return upperName(value)
    .normalize("NFKC")
    .replace(/[’'`´]/g, "")
    .replace(/&/g, " VE ")
    .replace(/[^0-9A-ZÇĞİÖŞÜ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep parity with src/lib/drawings/tr-text.ts::trKatla for suppliers. */
function supplierMatchKey(value) {
  const fold = {
    i: "I",
    ı: "I",
    İ: "I",
    I: "I",
    ç: "C",
    Ç: "C",
    ğ: "G",
    Ğ: "G",
    ö: "O",
    Ö: "O",
    ş: "S",
    Ş: "S",
    ü: "U",
    Ü: "U",
  };
  return text(value)
    .normalize("NFC")
    .replace(/[iıİIçÇğĞöÖşŞüÜ]/g, (character) => fold[character] ?? character)
    .toUpperCase();
}

function excelDateToIso(value, excelRow) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const timestamp = Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000;
    return new Date(timestamp).toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) fail(`C${excelRow} is not a valid Excel date`);
  return parsed.toISOString().slice(0, 10);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function majority(map, label) {
  const ranked = [...map.entries()].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount || compareText(leftValue, rightValue)
  );
  if (ranked.length === 0) fail(`No values available for ${label}`);
  return ranked[0][0];
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullableString(value) {
  const cleaned = text(value);
  return cleaned ? sqlString(cleaned) : "null";
}

function sqlNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`Invalid SQL number: ${value}`);
  return String(value);
}

function sqlFlags(flags) {
  return flags.length === 0
    ? "'{}'::text[]"
    : `array[${flags.map(sqlString).join(", ")}]::text[]`;
}

function jsonValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(`Non-finite workbook value cannot be serialized: ${value}`);
    return value;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  return String(value);
}

function rawPayload(values) {
  return Object.fromEntries(LETTERS.map((letter, index) => [letter, jsonValue(values[index])]));
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function checksum(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const inputBlob = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(inputBlob);

// `inspect` is deliberately part of the production generator: a renamed/missing
// worksheet fails before any migration is emitted, not after a partial parse.
await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 20_000,
});

let sheet;
try {
  sheet = workbook.worksheets.getItem(SHEET_NAME);
} catch {
  fail(`worksheet ${JSON.stringify(SHEET_NAME)} was not found`);
}

const usedRange = sheet.getUsedRange();
const workbookValues = usedRange.values;
const workbookFormulas = usedRange.formulas;
if (!Array.isArray(workbookValues) || workbookValues.length !== 1_365) {
  fail(`expected 1,365 used rows (header + data), received ${workbookValues?.length ?? "none"}`);
}

const headers = Array.from({ length: 26 }, (_, index) => text(workbookValues[0]?.[index]));
if (JSON.stringify(headers) !== JSON.stringify(EXPECTED_HEADERS)) {
  fail(`A1:Z1 header contract changed: ${JSON.stringify(headers)}`);
}

const formulaCount = (workbookFormulas ?? [])
  .flat()
  .filter((value) => !isBlank(value)).length;
if (formulaCount !== 0) fail(`expected a value-only legacy workbook, found ${formulaCount} formulas`);

const rows = workbookValues.slice(1).map((sourceValues, index) => ({
  excelRow: index + 2,
  values: Array.from({ length: 26 }, (_, column) => sourceValues?.[column] ?? null),
}));
if (rows.some((row) => row.values.every(isBlank))) fail("a blank row exists inside A2:Z1365");
if (rows.length !== 1_364) fail(`expected 1,364 data rows, received ${rows.length}`);

const duplicateCounts = new Map();
for (const row of rows) increment(duplicateCounts, JSON.stringify(row.values.map(jsonValue)));

const ratesByMonth = new Map();
for (const row of rows) {
  const isoDate = excelDateToIso(row.values[2], row.excelRow);
  const rate = number(row.values[25], `Z${row.excelRow}`);
  const month = isoDate.slice(0, 7);
  const rates = ratesByMonth.get(month) ?? [];
  rates.push(rate);
  ratesByMonth.set(month, rates);
}
const medianRateByMonth = new Map(
  [...ratesByMonth.entries()].map(([month, rates]) => [month, median(rates)])
);

const supplierGroups = new Map();
const materialGroups = new Map();
const normalizedRows = rows.map((row) => {
  const values = row.values;
  const expenseDate = excelDateToIso(values[2], row.excelRow);
  const supplierName = text(values[3]);
  const supplierKey = supplierName ? supplierMatchKey(supplierName) : "";
  const itemName = text(values[7]);
  const itemKey = itemName ? consumableMatchKey(itemName) : "";
  const groupName = text(values[6]);
  const unit = text(values[20]);
  const quantity = number(values[19], `T${row.excelRow}`);
  const unitPriceTry = number(values[21], `V${row.excelRow}`);
  const amountTry = number(values[22], `W${row.excelRow}`);
  const unitPriceEur = number(values[23], `X${row.excelRow}`);
  const amountEur = number(values[24], `Y${row.excelRow}`);
  const fxRate = number(values[25], `Z${row.excelRow}`);

  if (quantity <= 0) fail(`T${row.excelRow} must be positive`);
  if (fxRate <= 0) fail(`Z${row.excelRow} must be positive`);
  if (Math.abs(quantity * unitPriceTry - amountTry) > 0.02) {
    fail(`W${row.excelRow} differs from T×V by more than TRY 0.02`);
  }
  if (Math.abs(amountTry / fxRate - amountEur) > 0.02) {
    fail(`Y${row.excelRow} differs from W÷Z by more than EUR 0.02`);
  }
  if (Math.abs(unitPriceTry / fxRate - unitPriceEur) > 0.0002) {
    fail(`X${row.excelRow} differs from V÷Z by more than EUR 0.0002`);
  }

  if (supplierKey) {
    let group = supplierGroups.get(supplierKey);
    if (!group) {
      group = { variants: new Map() };
      supplierGroups.set(supplierKey, group);
    }
    increment(group.variants, upperName(supplierName));
  }

  if (itemKey) {
    let group = materialGroups.get(itemKey);
    if (!group) {
      group = { variants: new Map(), units: new Map(), groups: new Map() };
      materialGroups.set(itemKey, group);
    }
    increment(group.variants, upperName(itemName));
    increment(group.units, unit);
    increment(group.groups, groupName);
  }

  const flags = [];
  if (!supplierName) flags.push("blank_supplier");
  if (!itemName) flags.push("blank_item");
  if ((duplicateCounts.get(JSON.stringify(values.map(jsonValue))) ?? 0) > 1) {
    flags.push("duplicate_candidate");
  }
  if (number(values[0], `A${row.excelRow}`) !== Number(expenseDate.slice(0, 4)) ||
      text(values[1]) !== expenseDate.slice(0, 7)) {
    flags.push("period_mismatch");
  }
  const monthMedian = medianRateByMonth.get(expenseDate.slice(0, 7));
  if (monthMedian && Math.abs(fxRate - monthMedian) / monthMedian > 0.1) {
    flags.push("fx_outlier");
  }

  return {
    excelRow: row.excelRow,
    sourceRef: `${SHEET_NAME}!${row.excelRow}`,
    expenseDate,
    supplierName,
    supplierKey,
    itemName,
    itemKey,
    groupName,
    documentNo: text(values[4]),
    department: text(values[9]),
    note: text(values[10]),
    quantity,
    unit,
    unitPriceTry,
    amountTry,
    fxRate,
    flags,
    payload: rawPayload(values),
  };
});

const suppliers = [...supplierGroups.entries()]
  .map(([matchKey, group]) => ({
    name: majority(group.variants, `supplier ${matchKey}`),
    matchKey,
  }))
  .sort((left, right) => compareText(left.matchKey, right.matchKey));

const materials = [...materialGroups.entries()]
  .sort(([left], [right]) => compareText(left, right))
  .map(([matchKey, group], index) => ({
    code: `SM${String(index + 1).padStart(4, "0")}`,
    name: majority(group.variants, `material ${matchKey}`),
    matchKey,
    groupName: majority(group.groups, `material group ${matchKey}`),
    defaultUnit: majority(group.units, `material unit ${matchKey}`),
  }));

const flagCounts = Object.fromEntries(
  ["blank_supplier", "blank_item", "duplicate_candidate", "period_mismatch", "fx_outlier"].map(
    (flag) => [flag, normalizedRows.filter((row) => row.flags.includes(flag)).length]
  )
);
const expectedFlagCounts = {
  blank_supplier: 2,
  blank_item: 101,
  duplicate_candidate: 10,
  period_mismatch: 4,
  fx_outlier: 2,
};

if (suppliers.length !== 97) fail(`expected 97 supplier keys, received ${suppliers.length}`);
if (materials.length !== 751) {
  const splits = new Map();
  for (const row of normalizedRows) {
    if (!row.itemName) continue;
    const auditKey = legacyAuditMaterialKey(row.itemName);
    let split = splits.get(auditKey);
    if (!split) {
      split = new Map();
      splits.set(auditKey, split);
    }
    let names = split.get(row.itemKey);
    if (!names) {
      names = new Set();
      split.set(row.itemKey, names);
    }
    names.add(row.itemName);
  }
  const changedGroups = [...splits.entries()]
    .filter(([, keys]) => keys.size > 1)
    .map(([auditKey, keys]) => ({
      auditKey,
      liveKeys: [...keys.entries()].map(([key, names]) => ({ key, names: [...names].sort(compareText) })),
    }));
  console.error(`Material key count diagnostics: ${JSON.stringify(changedGroups, null, 2)}`);
  fail(`expected 751 material keys, received ${materials.length}`);
}
if (JSON.stringify(flagCounts) !== JSON.stringify(expectedFlagCounts)) {
  fail(`quality-flag contract changed: ${JSON.stringify(flagCounts)}`);
}
if (new Set(normalizedRows.map((row) => row.sourceRef)).size !== 1_364) {
  fail("source_ref values are not unique");
}

const totalTry = normalizedRows.reduce((sum, row) => sum + row.amountTry, 0);
const totalRawEur = rows.reduce((sum, row) => sum + number(row.values[24], `Y${row.excelRow}`), 0);
if (Math.abs(totalTry - 5_156_297.55) > 0.005) fail(`unexpected TRY total ${totalTry}`);
if (Math.abs(totalRawEur - 118_577.65) > 0.005) fail(`unexpected raw EUR total ${totalRawEur}`);

const supplierValuesSql = suppliers
  .map((supplier) => `  (${sqlString(supplier.name)}, ${sqlString(supplier.matchKey)})`)
  .join(",\n");
const materialValuesSql = materials
  .map(
    (material) =>
      `  (${sqlString(material.code)}, ${sqlString(material.name)}, ` +
      `${sqlString(material.matchKey)}, ${sqlString(material.groupName)}, ` +
      `${sqlString(material.defaultUnit)})`
  )
  .join(",\n");
const expenseValuesSql = normalizedRows
  .map(
    (row) =>
      `  (${sqlString(row.sourceRef)}, ${sqlString(row.expenseDate)}::date, ` +
      `${sqlNullableString(row.supplierName)}, ${sqlNullableString(row.supplierKey)}, ` +
      `${sqlNullableString(row.itemName)}, ${sqlNullableString(row.itemKey)}, ` +
      `${sqlString(row.groupName)}, ${sqlString(row.documentNo)}, ` +
      `${sqlString(row.department)}, ${sqlNumber(row.quantity)}, ${sqlString(row.unit)}, ` +
      `${sqlNumber(row.unitPriceTry)}, ${sqlString(row.note)}, ${sqlNumber(row.amountTry)}, ` +
      `${sqlNumber(row.fxRate)}, ` +
      `${sqlFlags(row.flags)}, ${sqlJson(row.payload)})`
  )
  .join(",\n");

const sql = `-- DEVRALINAN SARF GİDERLERİ — "${SOURCE_FILE}"
--
-- ÜRETİLMİŞTİR (scripts/generate-consumable-import.mjs). Elle düzenlenmez.
-- Kaynak workbook yalnız @oai/artifact-tool ile okunur; C sütunu tarih için
-- source-of-truth'tur. Aynı iş olayı gibi görünen satırlar SİLİNMEZ;
-- yalnız duplicate_candidate kalite işareti alır.
--
-- SABİT SAYILAR (generator tarafından doğrulandı):
--   Excel veri satırı                    : 1364
--   aktarılan sarf gideri                  : 1364
--   benzersiz tedarikçi anahtarı           : 97
--   benzersiz normalize malzeme anahtarı    : 751
--   malzemesiz legacy satır                 : 101
--   tedarikçisiz legacy satır              : 2
--   duplicate_candidate                      : 10
--   period_mismatch                          : 4
--   fx_outlier                               : 2
--   TRY toplamı                             : 5156297.55
--   Excel Y sütunu EUR toplamı             : 118577.65
--
-- KOLON SÖZLEŞMESİ:
--   C tarih · D tedarikçi · G grup snapshot · H malzeme snapshot
--   T miktar · U birim · V TRY birim fiyat · W TRY toplam · Z EUR kuru
--   A:Z'nin tamamı legacy_payload içinde kendi sütun harfiyle korunur.
--
-- İDEMPOTENT: tedarikçi/malzeme match_key ile, gider ise source+source_ref ile
-- yalnız yoksa eklenir. source_ref "sheet!ExcelSatırı" biçimindedir.

-- 97 legacy tedarikçi. Mevcut Fiyat Arşivi tedarikçileri match_key ile tekrar
-- kullanılır; insan kararı gerektiren benzer adlar otomatik birleştirilmez.
with incoming_supplier (name, match_key) as (
  values
${supplierValuesSql}
)
insert into public.purchase_suppliers (name, match_key)
select incoming.name, incoming.match_key
from incoming_supplier incoming
where not exists (
  select 1
  from public.purchase_suppliers existing
  where existing.match_key = incoming.match_key
);

-- 751 normalize malzeme. Kod sırası canonical match_key'nin byte sırasıdır;
-- aynı workbook her çalışmada aynı SM0001…SM0751 eşlemesini üretir.
with incoming_item (code, name, match_key, group_name, default_unit) as (
  values
${materialValuesSql}
)
insert into public.purchase_consumable_items
  (code, name, match_key, group_name, default_unit)
select incoming.code, incoming.name, incoming.match_key, incoming.group_name, incoming.default_unit
from incoming_item incoming
where not exists (
  select 1
  from public.purchase_consumable_items existing
  where existing.match_key = incoming.match_key
);

-- Sequence'i açık SM kodlarının sonrasına taşı; canlı formun bir sonraki
-- varsayılan kodu, import edilmiş bir kodla çakışmasın.
select setval(
  'public.purchase_consumable_item_code_seq',
  greatest(
    1,
    coalesce((
      select max(substring(code from 3)::bigint)
      from public.purchase_consumable_items
      where code ~ '^SM[0-9]+$'
    ), 0)
  ),
  true
);

-- 1.364 satırın tamamı. Snapshotlar kaynak yazımını, master bağları
-- normalize match_key'yi kullanır. Boş H için uydurma malzeme oluşturulmaz.
with incoming_expense (
  source_ref,
  expense_date,
  supplier_name,
  supplier_match_key,
  item_name,
  item_match_key,
  group_name,
  document_no,
  department,
  quantity,
  unit,
  unit_price_try,
  note,
  amount_try,
  fx_rate,
  quality_flags,
  legacy_payload
) as (
  values
${expenseValuesSql}
)
insert into public.purchase_consumable_expenses (
  expense_date,
  item_id,
  item_code,
  item_name,
  group_name,
  supplier_id,
  supplier_name,
  document_no,
  department,
  quantity,
  unit,
  unit_price,
  note,
  amount,
  currency,
  fx_rate,
  fx_rate_date,
  fx_source,
  quality_flags,
  legacy_payload,
  source,
  source_ref
)
select
  incoming.expense_date,
  item.id,
  item.code,
  incoming.item_name,
  incoming.group_name,
  supplier.id,
  coalesce(incoming.supplier_name, ''),
  incoming.document_no,
  incoming.department,
  incoming.quantity,
  incoming.unit,
  incoming.unit_price_try,
  incoming.note,
  incoming.amount_try,
  'TRY',
  incoming.fx_rate,
  incoming.expense_date,
  'legacy_excel',
  incoming.quality_flags,
  incoming.legacy_payload,
  '${IMPORT_SOURCE}',
  incoming.source_ref
from incoming_expense incoming
left join public.purchase_suppliers supplier
  on supplier.match_key = incoming.supplier_match_key
left join public.purchase_consumable_items item
  on item.match_key = incoming.item_match_key
where not exists (
  select 1
  from public.purchase_consumable_expenses existing
  where existing.source = '${IMPORT_SOURCE}'
    and existing.source_ref = incoming.source_ref
);

-- Migration yarım/yanlış uygulanırsa sessizce devam etme. Bu guard, yeniden
-- çalıştırmada da aynı 1.364 kaynak olayını ve tüm master bağlarını arar.
do $$
declare
  actual_rows bigint;
  actual_suppliers bigint;
  actual_items bigint;
  blank_suppliers bigint;
  blank_items bigint;
  duplicate_candidates bigint;
  period_mismatches bigint;
  fx_outliers bigint;
  actual_try numeric;
  raw_eur numeric;
begin
  select
    count(*),
    count(distinct supplier_id),
    count(distinct item_id),
    count(*) filter (where supplier_id is null),
    count(*) filter (where item_id is null),
    count(*) filter (where quality_flags @> array['duplicate_candidate']::text[]),
    count(*) filter (where quality_flags @> array['period_mismatch']::text[]),
    count(*) filter (where quality_flags @> array['fx_outlier']::text[]),
    sum(amount),
    sum((legacy_payload ->> 'Y')::numeric)
  into
    actual_rows,
    actual_suppliers,
    actual_items,
    blank_suppliers,
    blank_items,
    duplicate_candidates,
    period_mismatches,
    fx_outliers,
    actual_try,
    raw_eur
  from public.purchase_consumable_expenses
  where source = '${IMPORT_SOURCE}';

  if actual_rows <> 1364
     or actual_suppliers <> 97
     or actual_items <> 751
     or blank_suppliers <> 2
     or blank_items <> 101
     or duplicate_candidates <> 10
     or period_mismatches <> 4
     or fx_outliers <> 2
     or abs(actual_try - 5156297.55) > 0.005
     or abs(raw_eur - 118577.65) > 0.005 then
    raise exception
      'Sarf import guard failed: rows=%, suppliers=%, items=%, blank_supplier=%, blank_item=%, duplicate=%, period=%, fx=%, TRY=%, raw_EUR=%',
      actual_rows,
      actual_suppliers,
      actual_items,
      blank_suppliers,
      blank_items,
      duplicate_candidates,
      period_mismatches,
      fx_outliers,
      actual_try,
      raw_eur;
  end if;
end;
$$;
`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, sql, "utf8");

console.log(`Generated ${outputPath}`);
console.log(
  `rows=${normalizedRows.length} suppliers=${suppliers.length} materials=${materials.length} ` +
    `flags=${JSON.stringify(flagCounts)}`
);
console.log(`sha256=${checksum(sql)}`);

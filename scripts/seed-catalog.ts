// Katalog seed üretici — catalog_data/*.json dosyalarını okur, cat_equipment
// şemasına normalize eder ve düz INSERT'lerden oluşan bir SQL migration yazar:
//   supabase/migrations/20260719000005_catalog_seed.sql
//
// Çalıştırma (repo kökünden):
//   npx tsx scripts/seed-catalog.ts [catalog_data_klasörü]
//
// Notlar:
// - attrs anahtarları tutarlı snake_case'e ve src/lib/catalog-mapping.ts'in
//   beklediği adlara normalize edilir (dia_mm, breaking_load_kn, rpm, ...).
// - couplings hem mevcut cat_couplings'ten bağımsız olarak kind='coupling'
//   ile cat_equipment'a eklenir (cat_couplings'e dokunulmaz).
// - rails cat_rails tablosunda zaten seed'li olduğundan buraya alınmaz.
// - _version.json içeriği app_settings 'catalog_version' anahtarına yazılır.

import * as fs from "node:fs";
import * as path from "node:path";

const CATALOG_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "..", "..", "catalog_data");
const OUT_FILE = path.resolve(
  __dirname, "..", "supabase", "migrations", "20260719000005_catalog_seed.sql"
);

interface CatalogFile {
  meta: Record<string, unknown>;
  items: Record<string, unknown>[];
}

interface Row {
  kind: string;
  brand: string;
  model: string;
  attrs: Record<string, unknown>;
  sort: number;
}

function readJson(rel: string): CatalogFile {
  const p = path.join(CATALOG_DIR, rel);
  return JSON.parse(fs.readFileSync(p, "utf-8")) as CatalogFile;
}

/** null/undefined alanları at, anahtarları küçük harfe indir (kN→kn, Nm→nm). */
function cleanAttrs(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    out[k.toLowerCase()] = v;
  }
  return out;
}

/** Belirli anahtarları eşleme tablosuna göre yeniden adlandırır. */
function rename(
  attrs: Record<string, unknown>,
  map: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    out[map[k] ?? k] = v;
  }
  return out;
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const rows: Row[] = [];
let sortCounter = 0;

function push(kind: string, brand: string, model: string, attrs: Record<string, unknown>) {
  rows.push({ kind, brand, model, attrs, sort: sortCounter++ });
}

// ------------------------------------------------------------------ motors
for (const file of ["motors/gamak.json", "motors/abb.json"]) {
  const { meta, items } = readJson(file);
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), { speed_rpm: "rpm" });
    a.series = meta.series;
    const model = `${a.power_kw} kW ${a.poles}K ${a.frame_size ?? ""}`.trim();
    push("motor", brand, model, a);
  }
}

// ------------------------------------------------------------------ reducers → gearbox
for (const file of [
  "reducers/yilmaz_dr.json",
  "reducers/yilmaz_h.json",
  "reducers/simogear_parallel.json",
]) {
  const { items } = readJson(file);
  const { meta } = readJson(file);
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      output_torque_nm: "output_torque_nm",
      output_shaft_diameter_mm: "output_shaft_mm",
    });
    const model = String(a.model ?? "");
    delete a.model;
    push("gearbox", brand, model, a);
  }
}

// ------------------------------------------------------------------ ropes
for (const file of ["ropes/hascelik_6x36.json", "ropes/izmit_6x36.json"]) {
  const { meta, items } = readJson(file);
  const brand = String(meta.brand);
  const construction = String(meta.series); // "6x36 WS"
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      diameter_mm: "dia_mm",
      core_type: "core",
      breaking_load_kn: "breaking_load_kn",
    });
    a.construction = construction;
    const grade = num(a.grade_mpa);
    // Tel dayanımı [kg/mm²] — 1770→180, 1960→200, 2160→220 (standart seriler)
    if (grade) a.wire_strength_kgmm2 = Math.round(grade / 9.80665);
    const model = `Ø${a.dia_mm} ${construction} ${a.core} ${a.grade_mpa} MPa`;
    push("rope", brand, model, a);
  }
}

// ------------------------------------------------------------------ brakes
for (const file of [
  "brakes/sibre_te_drum.json",
  "brakes/sibre_usb_disc.json",
  "brakes/sibre_shi_caliper.json",
  "brakes/dereli_dyf_em.json",
]) {
  const { meta, items } = readJson(file);
  const brand = String(meta.brand);
  for (const it of items) {
    const a = cleanAttrs(it);
    a.series = meta.series;
    // Kasnak/disk çapı → ortak wheel_dia_mm anahtarı
    const wheelDia =
      num(a.drum_diameter_mm) ?? num(a.disc_diameter_mm) ?? num(a.min_disc_diameter_mm);
    if (wheelDia !== undefined) a.wheel_dia_mm = wheelDia;
    const model = String(a.model ?? "");
    delete a.model;
    push("brake", brand, model, a);
  }
}

// ------------------------------------------------------------------ couplings
for (const file of [
  "couplings/ozgun_b_motor.json",
  "couplings/ozgun_j_drum.json",
  "couplings/sibre_alc_flexible.json",
  "couplings/sibre_apc_pin.json",
  "couplings/sibre_abc_drum.json",
  "couplings/jaure_mt_gear.json",
  "couplings/jaure_tcbr_barrel.json",
]) {
  const { meta, items } = readJson(file);
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      max_shaft_diameter_mm: "max_shaft_dia_mm",
      min_shaft_diameter_mm: "min_shaft_dia_mm",
      max_bore_mm: "max_shaft_dia_mm",
      hub_diameter_mm: "hub_dia_mm",
      outer_diameter_mm: "outer_dia_mm",
    });
    a.series = meta.series;
    if (a.weight_kg === undefined && a.weight_max_kg !== undefined) {
      a.weight_kg = a.weight_max_kg;
    }
    const model = String(a.model ?? "");
    delete a.model;
    push("coupling", brand, model, a);
  }
}

// ------------------------------------------------------------------ bearings
{
  const { meta, items } = readJson("bearings/skf.json");
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      series: "type",
      outer_diameter_mm: "outer_dia_mm",
      dynamic_load_kn: "dynamic_load_kn",
      static_load_kn: "static_load_kn",
    });
    const model = String(a.designation ?? "");
    delete a.designation;
    push("bearing", brand, model, a);
  }
}

// ------------------------------------------------------------------ hooks
{
  const { meta, items } = readJson("hooks/din15401_forged.json");
  const brand = String(meta.brand); // "DIN"
  for (const it of items) {
    const a = cleanAttrs(it);
    const model = `DIN 15401 Nr ${a.hook_nr}`;
    push("hook", brand, model, a);
  }
}

// ------------------------------------------------------------------ sheaves
{
  const { meta, items } = readJson("sheaves/welded_plate.json");
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      nominal_diameter_mm: "dia_mm",
      pitch_diameter_mm: "pitch_dia_mm",
      outer_diameter_mm: "outer_dia_mm",
      shaft_diameter_mm: "shaft_dia_mm",
    });
    a.series = meta.series;
    const model = `Ø${a.dia_mm} kaynaklı makara`;
    push("sheave", brand, model, a);
  }
}

// ------------------------------------------------------------------ wheels
{
  const { meta, items } = readJson("wheels/fem_standard.json");
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      diameter_mm: "dia_mm",
      max_load_kn: "max_load_kn",
    });
    const model = `Ø${a.dia_mm} FEM teker`;
    push("wheel", brand, model, a);
  }
}

// ------------------------------------------------------------------ SQL üretimi

const esc = (s: string): string => s.replace(/'/g, "''");

function rowSql(r: Row): string {
  const attrsJson = esc(JSON.stringify(r.attrs));
  return `  ('${r.kind}', '${esc(r.brand)}', '${esc(r.model)}', '${attrsJson}'::jsonb, ${r.sort})`;
}

const BATCH = 500;
const parts: string[] = [];
parts.push(`-- Katalog seed — catalog_data JSON'larından scripts/seed-catalog.ts ile üretildi.
-- Yeniden üretmek için: npx tsx scripts/seed-catalog.ts
-- Toplam ${rows.length} ürün.
`);

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  parts.push(
    `insert into public.cat_equipment (kind, brand, model, attrs, sort) values\n` +
    batch.map(rowSql).join(",\n") + ";\n"
  );
}

// Katalog sürümü → app_settings
const version = JSON.parse(
  fs.readFileSync(path.join(CATALOG_DIR, "_version.json"), "utf-8")
) as Record<string, unknown>;
parts.push(
  `insert into public.app_settings (key, value) values\n` +
  `  ('catalog_version', '${esc(JSON.stringify(version))}'::jsonb)\n` +
  `on conflict (key) do update set value = excluded.value, updated_at = now();\n`
);

fs.writeFileSync(OUT_FILE, parts.join("\n"), "utf-8");

// Özet rapor
const byKind = new Map<string, number>();
for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
console.log(`Yazıldı: ${OUT_FILE}`);
console.log(`Toplam ürün: ${rows.length}`);
for (const [k, n] of [...byKind.entries()].sort()) console.log(`  ${k}: ${n}`);

// Katalog seed üretici — catalog_data/*.json dosyalarını okur, cat_equipment
// şemasına normalize eder ve düz INSERT'lerden oluşan bir SQL migration yazar:
//   supabase/migrations/20260719000005_catalog_seed.sql
//
// Çalıştırma (repo kökünden):
//   npx tsx scripts/seed-catalog.ts [catalog_data_klasörü]
//   npx tsx scripts/seed-catalog.ts --kinds gearbox --out 20260806000001_gearbox_reseed
//
// Notlar:
// - attrs anahtarları tutarlı snake_case'e ve src/lib/catalog-mapping.ts'in
//   beklediği adlara normalize edilir (dia_mm, breaking_load_kn, rpm, ...).
// - couplings hem mevcut cat_couplings'ten bağımsız olarak kind='coupling'
//   ile cat_equipment'a eklenir (cat_couplings'e dokunulmaz).
// - rails cat_rails tablosunda zaten seed'li olduğundan buraya alınmaz.
// - _version.json içeriği app_settings 'catalog_version' anahtarına yazılır.
// - `--kinds` verildiğinde çıktı YENİLEME migration'ı olur: yalnız o türler
//   yazılır ve INSERT'lerin önüne o türleri temizleyen DELETE konur. Uygulanmış
//   bir seed dosyasını düzenlemek yerine yeni bir migration üretmek içindir —
//   uzak veritabanı yalnız yeni dosyayı çalıştırır.

import * as fs from "node:fs";
import * as path from "node:path";

function argOf(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const positional = process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2] : undefined;
const CATALOG_DIR = positional
  ? path.resolve(positional)
  : path.resolve(__dirname, "..", "..", "catalog_data");
const ONLY_KINDS = argOf("kinds")?.split(",").map((s) => s.trim()).filter(Boolean);
const ONLY_BRANDS = argOf("brands")?.split(",").map((s) => s.trim()).filter(Boolean);
/**
 * Mevcut katalog satırlarını koruyarak yalnızca eksik tür/marka/model
 * birleşimlerini ekler. Canlı ortama ilk katalog aktarımı için güvenli moddur.
 */
const APPEND_ONLY = process.argv.includes("--append");
if (ONLY_BRANDS && !APPEND_ONLY) {
  throw new Error("--brands yalnızca --append ile kullanılabilir.");
}
const OUT_NAME = argOf("out") ?? "20260719000005_catalog_seed";
const OUT_FILE = path.resolve(
  __dirname, "..", "supabase", "migrations", `${OUT_NAME}.sql`
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
  datasheetUrl: string;
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

function push(
  kind: string,
  brand: string,
  model: string,
  attrs: Record<string, unknown>,
  datasheetUrl = ""
) {
  rows.push({ kind, brand, model, attrs, datasheetUrl, sort: sortCounter++ });
}

// ------------------------------------------------------------------ motors
for (const file of ["motors/gamak.json", "motors/abb.json", "motors/innomatics.json"]) {
  const { meta, items } = readJson(file);
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      speed_rpm: "rpm",
      // Mil çapı: redüktördeki output_shaft_mm / input_shaft_mm deseniyle
      // tutarlı ad. Bu alan kaplin mili çapını besler
      // (hoistGroup: maks(motorShaftMm, gearboxInputShaftMm)).
      shaft_diameter_mm: "shaft_mm",
    });
    // Seri SATIRIN KENDİ alanından okunur ("1LE1503 Basic Line",
    // "Alüminyum gövde", "M3BP"). meta.series yalnız yedektir: o alan
    // katalogun tamamını anlatan uzun bir cümledir ve süzgeç adımında tek
    // bir işe yaramaz değer üretirdi.
    a.series = a.series ?? meta.series;
    // Model = katalogun kendi tip kodu (satın alma bunu ister); kodu olmayan
    // eski dosyalar için güç/kutup/gövde betimlemesine düşülür.
    const code = typeof a.model === "string" ? a.model.trim() : "";
    delete a.model;
    const model = code || `${a.power_kw} kW ${a.poles}K ${a.frame_size ?? ""}`.trim();
    push("motor", brand, model, a);
  }
}

// ------------------------------------------------------------------ reducers → gearbox
// `application` (kaldirma | yurutme) katalog seçicisinde kilitli süzgeçtir:
// 2.3 kaldırma redüktörü yalnız kaldırma, 5.5 yürütme redüktörü yalnız yürütme
// grubunu görür. Kaynağı olmayan kataloglara aşağıda varsayılan atanır.
const REDUCER_FILES: { file: string; application?: string }[] = [
  { file: "reducers/yilmaz_dr.json" },
  { file: "reducers/yilmaz_m.json" },
  { file: "reducers/yilmaz_h.json" },
  { file: "reducers/flender_md20_1.json" },
  // SIMOGEAR paralel milli redüktörler yürütme tahrikinde kullanılır.
  { file: "reducers/simogear_parallel.json", application: "yurutme" },
];

for (const { file, application } of REDUCER_FILES) {
  const { meta, items } = readJson(file);
  const brand = String(meta.brand);
  for (const raw of items) {
    // Bazı kaynak kataloglar bir tip/sizes matrisi yayımlar. Bu biçim, aynı
    // seri bilgisini tekrar etmeden her (tip, boyut) hücresini katalog satırına
    // açar: [gövde, nominal çıkış torku Nm, i_min, i_max].
    const variants = Array.isArray(raw.variants) ? raw.variants : undefined;
    const expandedItems = variants
      ? variants.map((variant) => {
          if (!Array.isArray(variant) || variant.length !== 4) {
            throw new Error(`${file}: variants satırı [size, torque_nm, ratio_min, ratio_max] olmalı.`);
          }
          const [frameSize, outputTorqueNm, ratioMin, ratioMax] = variant;
          const { variants: _variants, ...base } = raw;
          return {
            ...base,
            model: `${String(base.series)}-${String(frameSize).padStart(2, "0")}`,
            frame_size: String(frameSize).padStart(2, "0"),
            output_torque_Nm: outputTorqueNm,
            ratio_range: `1:${String(ratioMin)}…${String(ratioMax)}`,
          };
        })
      : [raw];

    for (const it of expandedItems) {
      const a = rename(cleanAttrs(it), {
        output_shaft_diameter_mm: "output_shaft_mm",
        input_shaft_diameter_mm: "input_shaft_mm",
        permitted_radial_load_output_n: "allowed_radial_output_kn",
        permitted_radial_load_input_n: "allowed_radial_input_kn",
      });
      // İzin verilen radyal yükler katalogda N; motor ve kontroller kN bekliyor.
      for (const k of ["allowed_radial_output_kn", "allowed_radial_input_kn"]) {
        const v = num(a[k]);
        if (v !== undefined) a[k] = Math.round(v / 10) / 100; // N → kN, 2 hane
      }
      const applications = Array.isArray(a.applications)
        ? a.applications.filter((value): value is string => typeof value === "string" && value.length > 0)
        : [String(a.application ?? application ?? meta.application ?? "")].filter(Boolean);
      delete a.applications;
      delete a.application;
      const model = String(a.model ?? "");
      delete a.model;
      for (const usage of applications) {
        push("gearbox", brand, model, { ...a, application: usage });
      }
    }
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
// Fren katalogları seri dosyalarına ayrılır; yeni üretici eklendiğinde seed
// listesine elle ekleme unutulmasın diye klasör kararlı sırada taranır.
const BRAKE_DIR = "brakes";
const brakeFiles = fs
  .readdirSync(path.join(CATALOG_DIR, BRAKE_DIR))
  .filter((f) => f.toLowerCase().endsWith(".json"))
  .sort();

for (const file of brakeFiles) {
  const { meta, items } = readJson(`${BRAKE_DIR}/${file}`);
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
// (Madde 13, 14, 15) Kaplin kataloğu marka başına ONLARCA seri dosyasına
// bölünmüştür (ÖZGÜN 28 tip, SIBRE 11 seri, JAURE MT alt serileri ayrı).
// Dosyalar TEK TEK listelenmez — yeni bir seri eklendiğinde unutulur; klasör
// taranır. Sıra KARARLI olmalı (sort sütunu ve migration çıktısı yeniden
// üretildiğinde değişmemeli), bu yüzden dosya adına göre sıralanır.
const COUPLING_DIR = "couplings";
const couplingFiles = fs
  .readdirSync(path.join(CATALOG_DIR, COUPLING_DIR))
  .filter((f) => f.toLowerCase().endsWith(".json"))
  .sort();

for (const file of couplingFiles) {
  const { meta, items } = readJson(`${COUPLING_DIR}/${file}`);
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      max_shaft_diameter_mm: "max_shaft_dia_mm",
      min_shaft_diameter_mm: "min_shaft_dia_mm",
      max_bore_mm: "max_shaft_dia_mm",
      min_bore_mm: "min_shaft_dia_mm",
      hub_diameter_mm: "hub_dia_mm",
      outer_diameter_mm: "outer_dia_mm",
    });
    // Madde 14: seri ve kaplin tipi SATIRIN KENDİ alanından okunur — JAURE MT
    // alt serileri (MT / MTS / MTG / MTG-HD / MTF / MTFE / MTES) tek "MT"
    // başlığı altında toplanmadan ayrı ayrı seçilebilsin diye. meta yalnız
    // satırda alan yoksa yedektir.
    a.series = a.series ?? meta.series;
    a.coupling_type = a.coupling_type ?? meta.coupling_type;
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

// ---------------------------------------------------- air conditioners
// TMS'nin kamuya açık seri sayfalarından alınan tip kataloğu. Bu satırlar
// kapasite hesabı yapmak için değil; teknik özelliklerdeki tip ön seçimi ve
// ekipman listesi/datasheet bağlantısı için tutulur.
{
  const { meta, items } = readJson("air_conditioners/tms.json");
  const brand = String(meta.brand);
  for (const it of items) {
    const a = cleanAttrs(it);
    const model = String(a.model ?? "");
    const datasheetUrl = String(a.datasheet_url ?? "");
    delete a.model;
    delete a.datasheet_url;
    push("air_conditioner", brand, model, a, datasheetUrl);
  }
}

// ------------------------------------------------------------------ buffers
// (Madde 20, 21) Tampon kataloğu ÜÇ AİLEDEN gelir — SIBRE SP hidrolik,
// Conductix-Wampfler kauçuk (Program 0170) ve hücresel (Program 0180) — ve
// hepsi ORTAK anahtar takımına indirgenir:
//   type · stroke_mm · energy_kj · max_force_kn · diameter_mm · height_mm ·
//   max_compression_pct · weight_kg · program
// BİRİM BİRLİĞİ: kauçuk katalog enerjiyi JOULE basar, hidrolik ve hücresel
// kilojoule basar. Ortak anahtar energy_kj olduğundan kauçukta 1 J = 0,001 kJ
// çevrimi yapılır; ham J değeri energy_j altında traceability için kalır.
// Kaynağı olmayan alan UYDURULMAZ, hiç yazılmaz (ör. hidrolikte
// max_compression_pct yoktur, kauçuk/hücreselde program numarası vardır ama
// SIBRE'de yoktur).

/** Üretici teyidi olmayan firma Excel'i satırlarının marka adı. */
const UNVERIFIED_BUFFER_BRAND = "Marka Belirsiz (Firma Excel'i)";

/**
 * Kauçuk ve hücresel tamponda STROK katalogda ayrı bir sütun olarak basılmaz;
 * izin verilen sıkışma yüzdesi ile tampon yüksekliğinin çarpımıdır. İki çarpan
 * da katalogdan okunur, katsayı uydurulmaz: s = h · sıkışma% / 100.
 */
function compressionStrokeMm(
  heightMm: number | undefined,
  pct: number | undefined
): number | undefined {
  if (heightMm === undefined || pct === undefined) return undefined;
  return Math.round(heightMm * pct) / 100;
}

{
  // ---- SIBRE SP hidrolik ---------------------------------------------
  // Darbe kuvveti matrisi (216 hücre) ve kısma iğnesi tablosu (169 satır)
  // AYRI dosyalardır ama hesabın ikisine de ürün satırından ulaşması gerekir:
  //   · force_matrix   → sönümlenen enerjiye karşılık gelen darbe kuvveti
  //   · metering_pins  → tasarım kütlesine göre sipariş kodunun son parçası
  // İkisi de satırın attrs'ine JSONB dizi olarak İLİŞTİRİLİR; ürün başına
  // birkaç düzine sayı olduğundan ayrı tabloya gerek yoktur.
  const matrix = readJson("buffers/sibre_sp_force_matrix.json");
  const pins = readJson("buffers/sibre_sp_metering_pins.json");

  const matrixByKey = new Map<string, { capacity_kj: number; impact_force_kn: number }[]>();
  for (const m of matrix.items) {
    const key = `${String(m.type)}|${String(m.stroke_mm)}`;
    const list = matrixByKey.get(key) ?? [];
    list.push({
      capacity_kj: Number(m.capacity_kj),
      impact_force_kn: Number(m.impact_force_kn),
    });
    matrixByKey.set(key, list);
  }
  for (const list of matrixByKey.values()) list.sort((a, b) => a.capacity_kj - b.capacity_kj);

  const pinsByKey = new Map<string, { design_mass_t_max: number; metering_pin_code: string }[]>();
  for (const p of pins.items) {
    const key = `${String(p.series)}|${String(p.stroke_mm)}`;
    const list = pinsByKey.get(key) ?? [];
    list.push({
      design_mass_t_max: Number(p.design_mass_t_max),
      metering_pin_code: String(p.metering_pin_code),
    });
    pinsByKey.set(key, list);
  }
  for (const list of pinsByKey.values()) {
    list.sort((a, b) => a.design_mass_t_max - b.design_mass_t_max);
  }

  const { meta, items } = readJson("buffers/sibre_sp_hydraulic.json");
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      energy_capacity_kj: "energy_kj",
      max_end_force_kn: "max_force_kn",
      // Hidrolik tamponda "çap" gövde dış çapıdır (katalog ölçüsü d1); ortak
      // diameter_mm anahtarıyla kauçuk/hücresel tamponla aynı rolü taşır.
      // Yükseklik karşılığı YOKTUR (l1/l2/l3 boy ölçüleri ayrı durur) —
      // height_mm uydurulmaz, boş bırakılır.
      body_dia_d1_mm: "diameter_mm",
    });
    const series = String(a.series ?? "");
    // Matris ve iğne tablosundaki `type` seri adındaki sayıdır (SP 65 → 65).
    const typeCode = Number(series.replace(/[^0-9]/g, ""));
    const strokeMm = num(a.stroke_mm);
    const fm = matrixByKey.get(`${typeCode}|${String(strokeMm)}`);
    if (fm && fm.length > 0) a.force_matrix = fm;
    const mp = pinsByKey.get(`${series}|${String(strokeMm)}`);
    if (mp && mp.length > 0) a.metering_pins = mp;
    a.damping_efficiency = a.damping_efficiency ?? meta.damping_efficiency;
    const model = String(a.model ?? "");
    delete a.model;
    push("buffer", brand, model, a);
  }
}

{
  // ---- Conductix-Wampfler kauçuk (Program 0170) ------------------------
  // Kauçuk tampon DOĞRUSAL DEĞİLDİR: ara sıkışmadaki enerji ve kuvvet ancak
  // yük diyagramından okunur. conductix_curves.json'daki 10 çap eğrisi
  // `applies_to_models` ile hangi ürün koduna ait olduğunu KENDİSİ söyler;
  // eşleme o listeye göre yapılır, çap benzerliğine göre TAHMİN EDİLMEZ.
  // Ø40/Ø50/Ø63 eğrilerinin applies_to_models listesi boştur (o çaplarda
  // silindirik ürün yok, yalnız konik var) — bu üç eğri hiçbir satıra
  // bağlanmaz; konik ürüne bağlamak yanlış olurdu (kaynak dosyanın kendi
  // doğrulaması konik/silindirik oranını 0,87…1,40 arasında buluyor).
  const curves = readJson("buffers/conductix_curves.json");
  const curveByModel = new Map<string, Record<string, unknown>>();
  for (const c of curves.items) {
    for (const m of (c.applies_to_models as string[] | undefined) ?? []) {
      curveByModel.set(m, c);
    }
  }

  const { meta, items } = readJson("buffers/conductix_rubber.json");
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), { energy_capacity_j: "energy_j" });
    const j = num(a.energy_j);
    // J → kJ (ortak birim). toFixed kayan nokta artığını temizler.
    if (j !== undefined) a.energy_kj = Number((j / 1000).toFixed(6));
    const stroke = compressionStrokeMm(num(a.height_mm), num(a.max_compression_pct));
    if (stroke !== undefined) a.stroke_mm = stroke;
    const model = String(a.model ?? "");
    const curve = curveByModel.get(model);
    if (curve) {
      a.energy_curve = curve.energy_curve;
      a.force_curve = curve.force_curve;
      a.curve_units = { x: "sıkışma %", energy: "J", force: "kN" };
      a.curve_source_page = curve.source_page;
    }
    delete a.model;
    push("buffer", brand, model, a);
  }
}

{
  // ---- Conductix-Wampfler hücresel (Program 0180) ----------------------
  // energy_capacity_kj katalogun 4 m/s (dinamik) sütunudur — vinç tamponu bu
  // koşulda çalışır; statik sütun ayrı anahtarda saklanır.
  const { meta, items } = readJson("buffers/conductix_cellular.json");
  const brand = String(meta.brand);
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      energy_capacity_kj: "energy_kj",
      energy_capacity_static_kj: "energy_static_kj",
    });
    const stroke = compressionStrokeMm(num(a.height_mm), num(a.max_compression_pct));
    if (stroke !== undefined) a.stroke_mm = stroke;
    const model = String(a.model ?? "");
    delete a.model;
    push("buffer", brand, model, a);
  }
}

{
  // ---- Firma Excel'i — ÜRETİCİ TEYİDİ YOK ------------------------------
  // Bu 11 satır firma Excel'inden gelir; kaynak dosyanın meta.brand alanı
  // NULL'dır ve hiçbir üretici kataloğuyla karşılaştırılamamıştır.
  // KARAR: satırlar seed EDİLİR ama `unverified: true` taşır ve ayrı bir
  // marka altında durur. Gerekçe: firma bu tamponları fiilen kullanıyor
  // (eski hesaplarda geçiyor), dışarıda bırakmak mühendisi katalog dışı elle
  // girişe iterdi — o zaman uyarı da görünmezdi. Seçici bu satırlarda
  // "teyit edilmemiş" uyarısı gösterir (catalog-picker.tsx).
  const { meta, items } = readJson("buffers/firma_excel_buffers.json");
  const brand = meta.brand ? String(meta.brand) : UNVERIFIED_BUFFER_BRAND;
  for (const it of items) {
    const a = rename(cleanAttrs(it), {
      energy_capacity_kj: "energy_kj",
      max_force_kn: "max_force_kn",
    });
    a.unverified = true;
    const model = String(a.model ?? "");
    delete a.model;
    push("buffer", brand, model, a);
  }
}

// ------------------------------------------------------------------ SQL üretimi

const esc = (s: string): string => s.replace(/'/g, "''");

function rowSql(r: Row): string {
  const attrsJson = esc(JSON.stringify(r.attrs));
  return `  ('${r.kind}', '${esc(r.brand)}', '${esc(r.model)}', '${attrsJson}'::jsonb, '${esc(r.datasheetUrl)}', ${r.sort})`;
}

// `--kinds` verildiyse yalnız o türler yazılır ve önce mevcut satırları silinir.
const emitted = rows.filter((r) =>
  (!ONLY_KINDS || ONLY_KINDS.includes(r.kind)) &&
  (!ONLY_BRANDS || ONLY_BRANDS.includes(r.brand))
);

const BATCH = 500;
const parts: string[] = [];
parts.push(`-- Katalog seed — catalog_data JSON'larından scripts/seed-catalog.ts ile üretildi.
-- Yeniden üretmek için: npx tsx scripts/seed-catalog.ts${
  `${ONLY_KINDS ? ` --kinds ${ONLY_KINDS.join(",")}` : ""}${ONLY_BRANDS ? ` --brands ${ONLY_BRANDS.join(",")}` : ""}${APPEND_ONLY ? " --append" : ""} --out ${OUT_NAME}`}
-- Toplam ${emitted.length} ürün.
`);

if (ONLY_KINDS && !APPEND_ONLY) {
  parts.push(
    `-- Bu türler tamamen katalog dosyalarından üretilir; eski satırlar bırakılmaz.\n` +
    `delete from public.cat_equipment where kind in (${
      ONLY_KINDS.map((k) => `'${esc(k)}'`).join(", ")});\n`
  );
}

for (let i = 0; i < emitted.length; i += BATCH) {
  const batch = emitted.slice(i, i + BATCH);
  const values = batch.map(rowSql).join(",\n");
  if (APPEND_ONLY) {
    parts.push(
      `insert into public.cat_equipment (kind, brand, model, attrs, datasheet_url, sort)\n` +
      `select candidate.kind, candidate.brand, candidate.model, candidate.attrs, candidate.datasheet_url, candidate.sort\n` +
      `from (values\n${values}\n) as candidate(kind, brand, model, attrs, datasheet_url, sort)\n` +
      `where not exists (\n` +
      `  select 1 from public.cat_equipment as existing\n` +
      `  where existing.kind = candidate.kind\n` +
      `    and existing.brand = candidate.brand\n` +
      `    and existing.model = candidate.model\n` +
      `);\n`
    );
  } else {
    parts.push(
      `insert into public.cat_equipment (kind, brand, model, attrs, datasheet_url, sort) values\n` +
      values + ";\n"
    );
  }
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
for (const r of emitted) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
console.log(`Yazıldı: ${OUT_FILE}`);
console.log(`Toplam ürün: ${emitted.length}${
  ONLY_KINDS ? ` (${rows.length} üründen ${ONLY_KINDS.join(",")} süzüldü)` : ""}`);
for (const [k, n] of [...byKind.entries()].sort()) console.log(`  ${k}: ${n}`);

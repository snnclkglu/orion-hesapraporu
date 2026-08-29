/**
 * 0019 elektrik kataloglarını Supabase'e aktarır.
 *
 * Kaynak: workspace kökündeki `Elektrik Katalogları` klasörü ve içindeki
 * `00 - İÇİNDEKİLER ve MALZEME EŞLEŞMESİ.md` defteri.
 *
 *   npm run import:electrical-catalogs -- --apply-migration
 *
 * İşlem yeniden çalıştırılabilir:
 * - kaynak PDF'ler SHA-256 ile tekilleştirilir;
 * - ürünler normalize üretici + tip no anahtarıyla upsert edilir;
 * - uzun kaynaklardan çıkarılan teknik föyler 1-6 sayfadır;
 * - aynı depo yolu varsa baytlar yeniden yüklenmez.
 *
 * Gizli anahtar yazdırılmaz. Betik `.env.local`, `.env.frankfurt` ve
 * `.env.admin` dosyalarını okur; service/secret key verilmemişse Supabase
 * Management API'den yalnız bu süreç için alır.
 */

import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { electricalCategory } from "@/lib/electrical/category";
import { materialRows } from "@/lib/electrical/rollup";
import { catalogIdentityPart, materialCatalogIdentity } from "@/lib/electrical/catalogs";
import type { ElectricalPart, ElectricalMaterialRow } from "@/lib/electrical/types";
import { pdfBirlestir } from "@/lib/pdf/merge";

const REPO = path.resolve(import.meta.dirname, "..");
const WORKSPACE = path.resolve(REPO, "..");
function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const PROJECT_DOC_NO = argumentValue("--project-doc-no") ?? "0019-00";
const CATALOG_DIR = path.join(WORKSPACE, "Elektrik Katalogları");
const INDEX_MD = path.resolve(
  CATALOG_DIR,
  argumentValue("--index") ?? "00 - İÇİNDEKİLER ve MALZEME EŞLEŞMESİ.md"
);
const MIGRATION = path.join(REPO, "supabase", "migrations", "20260823000002_electrical_catalogs.sql");
const OUTPUT_PREFIX = argumentValue("--output-prefix") ?? "0019";
const OUTPUT = path.join(REPO, "output", "pdf", `${OUTPUT_PREFIX}-EK-F-ELEKTRIK-EKIPMAN-KATALOG-SAYFALARI.pdf`);
const OUTPUT_MANIFEST = path.join(REPO, "output", "pdf", `${OUTPUT_PREFIX}-EK-F-ELEKTRIK-EKIPMAN-KATALOG-SAYFALARI.json`);
const BUCKET = "electrical-catalogs";
const MAX_STORAGE_OBJECT_BYTES = 45 * 1024 * 1024;
const APPLY_MIGRATION = process.argv.includes("--apply-migration");
const DRY_RUN = process.argv.includes("--dry-run");
const LOCAL_ONLY = process.argv.includes("--local-only");
const MAPPED_ONLY = process.argv.includes("--mapped-only");
const MAX_TECHNICAL_PAGES = Math.min(
  6,
  Math.max(1, Number.parseInt(argumentValue("--max-technical-pages") ?? "6", 10) || 6)
);
const IS_DEFAULT_0019 = PROJECT_DOC_NO === "0019-00";
const ONLY_TYPES = new Set(
  (argumentValue("--only-types") ?? "")
    .split(",")
    .map((value) => catalogIdentityPart(value))
    .filter(Boolean)
);

// Node 24'e kadar bulunmayan bu yerleşik, PDF.js'in yeni sürümünde kullanılıyor.
// Polyfill dinamik unpdf importundan önce kurulmalı.
const mathWithPreciseSum = Math as typeof Math & {
  sumPrecise?: (values: Iterable<number>) => number;
};
mathWithPreciseSum.sumPrecise ??= (values) => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

/**
 * Klasör denetiminde tam ürün kodu doğrulanamayan veya yalnız muadil belgeye
 * sahip malzemeler. Bunlarda yanlış bir sayfa sunmaktansa föy düğmesi boş kalır;
 * varsa özgün katalog bağı yine saklanır.
 */
const TECHNICAL_DENY = new Set(
  [
    "BST01", "AC-1", "HKA-A-180/11W", "43867", "113319",
    "6SL3054-0FC31-1BA0", "3SK1121-1CB41", "51-67-DZC0Z-499P",
  ].map(catalogIdentityPart)
);

interface CuratedRange {
  fileIncludes: string;
  pages: number[];
}

/** Denetçi tarafından ürün kodu ve teknik tablo içeriği birlikte doğrulanan aralıklar. */
const CURATED_RANGE_ENTRIES: Array<[string, CuratedRange]> = [
  ["170M6464", { fileIncludes: "170M", pages: [202, 203, 204, 205] }],
  ["116062", { fileIncludes: "Aydınlatma Ürün Kataloğu", pages: [96, 97] }],
  ["XB4BA21", { fileIncludes: "Harmony XB4 Metal", pages: [32, 33, 34] }],
  ["XB4BA31", { fileIncludes: "Harmony XB4 Metal", pages: [32, 33, 34] }],
  ["XB4BA42", { fileIncludes: "Harmony XB4 Metal", pages: [32, 33, 34] }],
  ["XB4BA51", { fileIncludes: "Harmony XB4 Metal", pages: [32, 33, 34] }],
  ["XB4BW33B5", { fileIncludes: "Harmony XB4 Metal", pages: [36, 37, 38] }],
  ["XB4BW34B5", { fileIncludes: "Harmony XB4 Metal", pages: [36, 37, 38] }],
  ["XB4BS8442", { fileIncludes: "Harmony XB4 Metal", pages: [44, 45, 46, 47, 48] }],
  // 0026-01: ürün kodu PDF metninde ayraçlı/görsel olduğu için otomatik tam
  // metin eşleşmesi yapılamayan, görsel olarak doğrulanmış üretici sayfaları.
  ["LTF12KC2LDQ", { fileIncludes: "BANNER - LTF", pages: [4, 6, 9, 10, 11] }],
  ["ESX_MID 602", { fileIncludes: "ELFATEK - Kumanda", pages: [9, 10, 11] }],
  ["MATIS 4000", { fileIncludes: "ETA MATIS", pages: [6, 7] }],
  ["AGM 132 M 6B", { fileIncludes: "GAMAK - Teknik Katalog 2025", pages: [70, 71] }],
  ["XB4BD21", { fileIncludes: "Harmony XB4 Metal", pages: [55, 56, 57] }],
  ["XB4BVB1", { fileIncludes: "Harmony XB4 Metal", pages: [62, 63, 64] }],
  ["XB4BVB4", { fileIncludes: "Harmony XB4 Metal", pages: [62, 63, 64] }],
  ["XB4BVB5", { fileIncludes: "Harmony XB4 Metal", pages: [62, 63, 64] }],
  ["ZBZ33", { fileIncludes: "Harmony XB4 Metal", pages: [74, 75, 76] }],
  ...[
    "5SL6363-7", "5SL6325-7", "5SL6332-7", "5SL6302-7", "5SL6210-7",
    "5SL6206-7", "5SL6204-7", "5SL6216-7", "5SL6225-7", "5SL6232-7",
  ].map((typeNo): [string, CuratedRange] => [
    typeNo,
    { fileIncludes: "SENTRON 5SL", pages: [16, 17, 18, 19, 20, 21] },
  ]),
  ["6ES7511-1AL03-0AB0", { fileIncludes: "Ürün Kataloğu ST 70", pages: [350, 351, 352, 353, 354] }],
  ["6ES7521-1BL00-0AB0", { fileIncludes: "Ürün Kataloğu ST 70", pages: [525, 526, 527, 528, 529] }],
  ["6ES7521-1BH00-0AB0", { fileIncludes: "Ürün Kataloğu ST 70", pages: [525, 526, 527, 528, 529] }],
  ["6ES7522-1BH01-0AB0", { fileIncludes: "Ürün Kataloğu ST 70", pages: [535, 536, 537, 538, 539] }],
  ["6ES7531-7QF00-0AB0", { fileIncludes: "Ürün Kataloğu ST 70", pages: [559, 560, 561, 562, 563, 564] }],
  ["6ES7155-5AA01-0AB0", { fileIncludes: "Ürün Kataloğu ST 70", pages: [1242, 1243, 1244, 1245, 1246] }],
  ["6SL3040-1MA01-0AA0", { fileIncludes: "Katalog D 21.4", pages: [76, 77, 78] }],
  ["6SL3120-1TE23-0AC0", { fileIncludes: "Katalog D 21.4", pages: [131, 132, 133, 134, 135, 136] }],
  ["6SL3120-1TE31-3AA3", { fileIncludes: "Katalog D 21.4", pages: [131, 132, 133, 134, 135, 136] }],
  ["6SL3000-0EE38-8AA0", { fileIncludes: "Katalog D 21.4", pages: [263, 264] }],
  ["6SL3055-0AA00-6AA1", { fileIncludes: "Katalog D 21.4", pages: [339, 340, 341, 342] }],
  ["6SL3055-0AA00-5CA2", { fileIncludes: "Katalog D 21.4", pages: [362, 363, 364, 365, 366] }],
  ...([
    ["10365", [27]],
    ["10366", [27]],
    ["10367", [27]],
    ["10368", [27]],
    ["10369", [27]],
    ["10373", [27]],
    ["10374", [27]],
    ["10692", [31, 32]],
    ["10711", [31, 32]],
    ["10721", [31, 32]],
    ["10725", [31, 32]],
    ["16405", [38, 39]],
    ["16501", [93, 94]],
    ["16505", [93, 94]],
    ["19104", [132]],
    ["22972", [142]],
    ["22975", [142]],
    ["75950", [144, 145]],
    ["705221", [151, 152]],
    ["25474", [197]],
    ["27011", [201]],
  ] satisfies Array<[string, number[]]>).map(([typeNo, pages]): [string, CuratedRange] => [
    typeNo,
    { fileIncludes: "HELUKABEL - Hareketli Kablo Kataloğu", pages },
  ]),
];
const CURATED_RANGES = new Map<string, CuratedRange>(
  CURATED_RANGE_ENTRIES.map(([typeNo, range]) => [catalogIdentityPart(typeNo), range])
);

function technicalDenied(typeNo: string): boolean {
  if (!IS_DEFAULT_0019) return false;
  const key = catalogIdentityPart(typeNo);
  return TECHNICAL_DENY.has(key) || /^1LE5504/.test(key);
}

function curatedRange(typeNo: string): CuratedRange | undefined {
  const key = catalogIdentityPart(typeNo);
  const exact = CURATED_RANGES.get(key);
  if (exact) return exact;
  if (/^3RT202[346]1AP00$/.test(key)) return { fileIncludes: "3RT 3RH", pages: [52, 53, 54, 55, 56] };
  if (key === "3RT20231BB40") return { fileIncludes: "3RT 3RH", pages: [60, 61, 62, 63, 64] };
  if (/^3RH2911/.test(key)) return { fileIncludes: "3RT 3RH", pages: [88, 89, 90, 91, 92, 93] };
  if (/^3RV20(11|21|41)/.test(key)) return { fileIncludes: "SIRIUS IC10 Koruma", pages: [29, 30, 31, 32, 33, 34] };
  if (/^3RU21(26|36|46)/.test(key)) return { fileIncludes: "SIRIUS IC10 Koruma", pages: [91, 92, 93, 94, 95, 96] };
  if (/^6SL3162/.test(key)) return { fileIncludes: "Katalog D 21.4", pages: [92, 93, 94, 95, 96, 97] };
  if (key === "6SL33306TE411AA3") return { fileIncludes: "Katalog D 21.4", pages: [195, 196, 197, 198, 199, 200] };
  if (/^6SL3320/.test(key)) return { fileIncludes: "Katalog D 21.4", pages: [205, 206, 207, 208, 209, 210] };
  if (/^2600(3032|3041|3064|3121)$/.test(key)) return { fileIncludes: "SIRCO", pages: [2, 3, 4, 5] };
  if (key === "PL240DG") return { fileIncludes: "Aksesuar", pages: [13, 14, 15, 16] };
  if (key === "XS618B1MAL2") return { fileIncludes: "OsiSense", pages: [40, 41, 42, 43, 44] };
  if (/^SNT7013S1[123]$/.test(key)) return { fileIncludes: "MUCCO", pages: [19, 20] };
  if (key === "SNTB7101") return { fileIncludes: "MUCCO", pages: [71] };
  if (key === "SNTBL1861") return { fileIncludes: "MUCCO", pages: [127, 128, 133] };
  if (key === "1200") return { fileIncludes: "MESAN", pages: [12] };
  if (/^PSEE2G1AC24DC(120|240|480|60)WSC$/.test(key)) {
    const watts = /24DC(120|240|480|60)W/.exec(key)?.[1] ?? "";
    return { fileIncludes: `${watts}W Guc Kaynagi`, pages: [1, 2, 3, 4, 6, 9] };
  }
  if (/^(PT|RBO)/.test(key)) {
    return { fileIncludes: materialFileToken(typeNo), pages: [1, 2, 3, 4, 6, 7] };
  }
  if (key.startsWith("UNOPS1AC12DC30W")) return { fileIncludes: "UNO-PS 12DC 30W", pages: [1, 2, 3, 4, 5, 8] };
  if (key === "G2RVST700DC24") return { fileIncludes: "G2RV-ST G3RV-ST", pages: [3, 4, 5, 6, 9, 10] };
  if (key.startsWith("E690")) return { fileIncludes: "E-690 Serisi Gelişmiş", pages: [3, 4, 5, 12, 13] };
  if (key === "XPEA110") return { fileIncludes: "XPEA110", pages: [1, 4, 5, 6, 7] };
  if (key === "6AV21232MB030AX0") return { fileIncludes: "KTP1200", pages: [1, 2, 3, 4, 5, 6] };
  if (key === "6SL30550AA004CA5") {
    return { fileIncludes: "AOP30 Operator Paneli", pages: [1, 13, 14, 63, 64, 65] };
  }
  return undefined;
}

function materialFileToken(typeNo: string): string {
  return typeNo.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

interface MappingProduct {
  supplier: string;
  typeNo: string;
  designation: string;
  files: string[];
}

interface LocalDocument {
  fileName: string;
  fullPath: string;
  /** Büyük arşiv bellekte tutulmaz; ihtiyaçtan sonra boşaltılıp diskten okunur. */
  bytes?: Uint8Array;
  sizeBytes: number;
  sha256: string;
  pageCount: number;
  title: string;
  manufacturer: string;
  language: string;
  kind: "catalog" | "technical_sheet" | "manual";
  encrypted: boolean;
  id?: string;
  storagePath: string;
  storageParts: string[];
}

interface TechnicalChoice {
  documentId: string;
  bytes: Uint8Array;
  pageCount: number;
  sourcePages: number[];
  label: string;
  sourceFileName: string;
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function loadEnvText(text: string): void {
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]]) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[m[1]] = value;
  }
}

async function loadEnvFiles(): Promise<void> {
  for (const name of [".env.local", ".env.frankfurt", ".env.admin"]) {
    try {
      loadEnvText(await readFile(path.join(REPO, name), "utf8"));
    } catch {
      // Dosya seçimliktir.
    }
  }
}

async function managementRequest<T>(pathname: string, init?: RequestInit): Promise<T> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN bulunamadı.");
  const response = await fetch(`https://api.supabase.com/v1${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase Management API ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

async function applyMigration(): Promise<void> {
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!ref) throw new Error("SUPABASE_PROJECT_REF bulunamadı.");
  const query = await readFile(MIGRATION, "utf8");
  await managementRequest(`/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query, read_only: false }),
  });
  log("Veritabanı şeması uygulandı.");
}

async function elevatedApiKey(): Promise<string> {
  const explicit = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (explicit) return explicit;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!ref) throw new Error("SUPABASE_PROJECT_REF bulunamadı.");
  const keys = await managementRequest<
    { api_key?: string; name?: string; type?: string; id?: string }[]
  >(`/projects/${ref}/api-keys?reveal=true`);
  const preferred =
    keys.find((k) => k.type === "secret" && k.api_key) ??
    keys.find((k) => /service[_ -]?role/i.test(k.name ?? "") && k.api_key);
  if (!preferred?.api_key) throw new Error("Supabase secret/service_role anahtarı alınamadı.");
  return preferred.api_key;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function parseMapping(text: string): MappingProduct[] {
  const products: MappingProduct[] = [];
  let inProducts = false;
  let supplier = "";
  for (const line of text.split(/\r?\n/)) {
    if (/^##\s+2\b/.test(line)) {
      inProducts = true;
      continue;
    }
    if (inProducts && /^##\s+3\b/.test(line)) break;
    if (!inProducts) continue;
    const heading = /^###\s+(.+?)\s*$/.exec(line);
    if (heading) {
      supplier = stripMarkdown(heading[1]);
      continue;
    }
    const row = /^\|\s*`([^`]+)`\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (!row) continue;
    const files = stripMarkdown(row[4])
      .split("\n")
      .map((v) => v.trim())
      .filter((v) => /\.pdf$/i.test(v) && !/[—-]\s*belge yok/i.test(v));
    products.push({ supplier, typeNo: row[1].trim(), designation: stripMarkdown(row[2]), files });
  }
  return products;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function catalogish(fileName: string): boolean {
  return /katalog|catalog|broşür|brosur|brochure|ürün genel|urun genel/i.test(fileName);
}

function manualish(fileName: string): boolean {
  return /kılavuz|kilavuz|manual|montaj|kurulum|işletme|isletme|talimat/i.test(fileName);
}

function documentKind(fileName: string, pageCount: number): LocalDocument["kind"] {
  if (pageCount <= MAX_TECHNICAL_PAGES) return "technical_sheet";
  if (manualish(fileName) && !catalogish(fileName)) return "manual";
  return "catalog";
}

async function inspectDocument(fileName: string): Promise<LocalDocument> {
  const fullPath = path.join(CATALOG_DIR, fileName);
  const buffer = await readFile(fullPath);
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let encrypted = false;
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    if (!(error instanceof Error) || !/encrypted/i.test(error.message)) throw error;
    encrypted = true;
    pdf = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  }
  const digest = sha256(bytes);
  const pageCount = pdf.getPageCount();
  const baseName = path.basename(fileName);
  return {
    fileName,
    fullPath,
    bytes,
    sizeBytes: bytes.byteLength,
    sha256: digest,
    pageCount,
    title: baseName.replace(/\.pdf$/i, ""),
    manufacturer: baseName.split(" - ")[0]?.trim() ?? "",
    language: /\((TR|EN)\)\.pdf$/i.exec(baseName)?.[1]?.toUpperCase() ?? "",
    kind: documentKind(baseName, pageCount),
    encrypted,
    storagePath: `original/${digest}.pdf`,
    storageParts: [],
  };
}

async function documentBytes(document: LocalDocument): Promise<Uint8Array> {
  if (document.bytes) return document.bytes;
  const buffer = await readFile(document.fullPath);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

async function storageObjectExists(supabase: SupabaseClient, storagePath: string): Promise<boolean> {
  const slash = storagePath.lastIndexOf("/");
  const folder = storagePath.slice(0, slash);
  const file = storagePath.slice(slash + 1);
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    limit: 1,
    search: file,
  });
  if (error) throw error;
  return (data ?? []).some((item) => item.name === file);
}

async function uploadIfMissing(
  supabase: SupabaseClient,
  storagePath: string,
  bytes: Uint8Array
): Promise<void> {
  if (await storageObjectExists(supabase, storagePath)) return;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) throw error;
}

async function splitDocumentForStorage(document: LocalDocument): Promise<Uint8Array[]> {
  const sourceBytes = await documentBytes(document);
  if (sourceBytes.byteLength <= MAX_STORAGE_OBJECT_BYTES) return [sourceBytes];
  const source = await PDFDocument.load(sourceBytes, {
    updateMetadata: false,
    ignoreEncryption: document.encrypted,
  });
  const chunks: Uint8Array[] = [];

  async function splitRange(first: number, last: number): Promise<void> {
    const output = await PDFDocument.create();
    const indices = Array.from({ length: last - first }, (_, i) => first + i);
    const copied = await output.copyPages(source, indices);
    copied.forEach((page) => output.addPage(page));
    const bytes = await output.save({ useObjectStreams: true, objectsPerTick: 2000 });
    if (bytes.byteLength <= MAX_STORAGE_OBJECT_BYTES || last - first <= 1) {
      chunks.push(bytes);
      return;
    }
    const middle = first + Math.floor((last - first) / 2);
    await splitRange(first, middle);
    await splitRange(middle, last);
  }

  await splitRange(0, source.getPageCount());
  return chunks;
}

async function uploadDocumentParts(
  supabase: SupabaseClient,
  document: LocalDocument
): Promise<string[]> {
  const chunks = await splitDocumentForStorage(document);
  if (chunks.length === 1) {
    await uploadIfMissing(supabase, document.storagePath, chunks[0]);
    return [document.storagePath];
  }
  const paths: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const storagePath = `original/${document.sha256}/part-${String(i + 1).padStart(3, "0")}.pdf`;
    await uploadIfMissing(supabase, storagePath, chunks[i]);
    paths.push(storagePath);
  }
  return paths;
}

async function upsertDocument(
  supabase: SupabaseClient,
  document: LocalDocument,
  extra: { sourceDocumentId?: string; sourcePages?: number[] } = {}
): Promise<string> {
  const payload = {
    title: document.title,
    manufacturer: document.manufacturer,
    language: document.language,
    document_kind: document.kind,
    file_name: document.fileName,
    storage_path: document.storagePath,
    storage_parts: document.storageParts.length ? document.storageParts : [document.storagePath],
    size_bytes: document.sizeBytes,
    page_count: document.pageCount,
    sha256: document.sha256,
    source_document_id: extra.sourceDocumentId ?? null,
    source_pages: extra.sourcePages ?? [],
  };
  const { data, error } = await supabase
    .from("electrical_catalog_documents")
    .upsert(payload, { onConflict: "sha256" })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error(`${document.fileName} kaydedilemedi.`);
  return String(data.id);
}

async function loadProjectMaterials(supabase: SupabaseClient): Promise<ElectricalMaterialRow[]> {
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("doc_no", PROJECT_DOC_NO)
    .maybeSingle();
  if (!project) throw new Error(`${PROJECT_DOC_NO} projesi bulunamadı.`);
  const { data: current } = await supabase
    .from("electrical_projects")
    .select("id")
    .eq("project_id", project.id)
    .eq("is_current", true)
    .maybeSingle();
  if (!current) throw new Error(`${PROJECT_DOC_NO} güncel elektrik projesi bulunamadı.`);

  const rows: ElectricalPart[] = [];
  const STEP = 1000;
  for (let offset = 0; ; offset += STEP) {
    const { data, error } = await supabase
      .from("electrical_parts")
      .select("device_tag, installation, location, device, qty, designation, type_no, supplier, part_no, page")
      .eq("electrical_project_id", current.id)
      .order("sort")
      .range(offset, offset + STEP - 1);
    if (error) throw error;
    const page = (data ?? []) as Record<string, unknown>[];
    for (const r of page) {
      rows.push({
        deviceTag: String(r.device_tag ?? ""),
        installation: String(r.installation ?? ""),
        location: String(r.location ?? ""),
        device: String(r.device ?? ""),
        qty: r.qty === null || r.qty === undefined ? null : Number(r.qty),
        designation: String(r.designation ?? ""),
        typeNo: String(r.type_no ?? ""),
        supplier: String(r.supplier ?? ""),
        partNo: String(r.part_no ?? ""),
        page: Number(r.page ?? 0),
      });
    }
    if (page.length < STEP) break;
  }
  return materialRows(
    rows.filter((row) => {
      const joined = `${row.deviceTag} ${row.designation} ${row.typeNo} ${row.partNo}`.toUpperCase();
      return row.deviceTag.trim().toUpperCase() !== "REVISION" &&
        !joined.includes(" DATE NAME ") &&
        !joined.includes(" SHEET FORM ") &&
        !joined.includes(" DRAWING NO ") &&
        !joined.includes(" APPROVAL ");
    })
  ).filter((m) => m.typeNo.trim());
}

function mappingForMaterial(
  material: ElectricalMaterialRow,
  mappings: readonly MappingProduct[]
): MappingProduct | undefined {
  const identity = materialCatalogIdentity(material);
  const typeKey = catalogIdentityPart(identity.typeNo);
  const supplierKey = catalogIdentityPart(identity.supplier);
  const exact = mappings.find(
    (m) => catalogIdentityPart(m.typeNo) === typeKey && catalogIdentityPart(m.supplier) === supplierKey
  );
  return exact ?? mappings.find((m) => catalogIdentityPart(m.typeNo) === typeKey);
}

function sourceScore(document: LocalDocument, target: string): number {
  const name = catalogIdentityPart(document.fileName);
  let score = 0;
  if (name.includes(target)) score += 1000;
  if (/teknik|technical|veri sayfa|data sheet|datasheet|ürün föy|urun foy/i.test(document.fileName)) score += 400;
  if (manualish(document.fileName)) score += 80;
  if (catalogish(document.fileName)) score += 40;
  score += Math.max(0, 100 - document.pageCount / 10);
  return score;
}

function fullCatalogScore(document: LocalDocument): number {
  let score = 0;
  if (/genel|ana katalog|main catalog|ürün katalog|urun katalog/i.test(document.fileName)) score += 100;
  if (/katalog|catalog/i.test(document.fileName)) score += 80;
  if (/broşür|brosur|brochure/i.test(document.fileName)) score += 30;
  if (manualish(document.fileName) && !catalogish(document.fileName)) score -= 200;
  score += Math.min(40, document.pageCount / 25);
  return score;
}

const textCache = new Map<string, Promise<string[]>>();

async function pageTexts(document: LocalDocument): Promise<string[]> {
  let pending = textCache.get(document.sha256);
  if (!pending) {
    pending = documentBytes(document).then(async (bytes) => {
      const { extractText } = await import("unpdf");
      const result = await extractText(bytes, { mergePages: false });
      return result.text as string[];
    });
    textCache.set(document.sha256, pending);
  }
  return pending;
}

function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let at = 0;
  while ((at = haystack.indexOf(needle, at)) >= 0) {
    count += 1;
    at += needle.length;
  }
  return count;
}

async function relevantPages(document: LocalDocument, typeNo: string): Promise<number[]> {
  const target = catalogIdentityPart(typeNo);
  // Kısa/jenerik kodlar uzun kataloglarda çok fazla ilgisiz eşleşme üretir.
  // Bunlar ancak denetlenmiş aralıkla veya ürün kodunu taşıyan dosya adıyla seçilir.
  if (target.length < 5 && !catalogIdentityPart(document.fileName).includes(target)) return [];
  const texts = await pageTexts(document);
  const hits = texts
    .map((raw, index) => {
      const folded = catalogIdentityPart(raw);
      const count = occurrences(folded, target);
      const context = /technical data|teknik veri|dimensions|boyut|ölçü|olcu|ordering data|selection data/i.test(raw)
        ? 5
        : 0;
      return { page: index + 1, score: count * 10 + context };
    })
    .filter((hit) => hit.score >= 10)
    .sort((a, b) => b.score - a.score || a.page - b.page);

  if (hits.length === 0) {
    return catalogIdentityPart(document.fileName).includes(target)
      ? Array.from({ length: Math.min(MAX_TECHNICAL_PAGES, document.pageCount) }, (_, i) => i + 1)
      : [];
  }

  const anchor = hits[0].page;
  const selected = new Set<number>();
  // Ürün satırının bir önceki başlık/ölçü sayfasını ve iki devam sayfasını
  // birlikte taşı; ardından başka güçlü tam eşleşmeleri ekle. Toplam üst sınır
  // komut satırındaki --max-technical-pages değeridir (şema gereği en çok 6).
  for (let p = Math.max(1, anchor - 1); p <= Math.min(document.pageCount, anchor + 2); p++) {
    selected.add(p);
  }
  for (const hit of hits) {
    if (selected.size >= MAX_TECHNICAL_PAGES) break;
    selected.add(hit.page);
  }
  return [...selected].sort((a, b) => a - b).slice(0, MAX_TECHNICAL_PAGES);
}

async function extractPages(document: LocalDocument, pages: number[], title: string): Promise<Uint8Array> {
  const source = await PDFDocument.load(await documentBytes(document), {
    updateMetadata: false,
    ignoreEncryption: document.encrypted,
  });
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, pages.map((p) => p - 1));
  copied.forEach((page) => output.addPage(page));
  output.setTitle(title);
  output.setSubject(`${document.title}; kaynak sayfalar: ${pages.join(", ")}`);
  output.setProducer("ORION İş Yönetim Sistemi");
  // Aynı kaynak + sayfa seçimi her çalıştırmada aynı SHA-256'yı üretmeli.
  // pdf-lib'in varsayılan anlık tarihleri aksi halde eş kaynaklardan gereksiz
  // teknik föy kopyaları oluşturuyordu.
  const stableDate = new Date("2000-01-01T00:00:00.000Z");
  output.setCreationDate(stableDate);
  output.setModificationDate(stableDate);
  return output.save({ useObjectStreams: false, objectsPerTick: 2000 });
}

async function ensureProduct(
  supabase: SupabaseClient,
  material: ElectricalMaterialRow
): Promise<string> {
  const identity = materialCatalogIdentity(material);
  const { data, error } = await supabase
    .from("electrical_catalog_products")
    .upsert(
      {
        supplier: identity.supplier,
        type_no: identity.typeNo,
        designation: material.designation,
        lookup_key: identity.lookupKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lookup_key" }
    )
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error(`${identity.typeNo} ürünü kaydedilemedi.`);
  return String(data.id);
}

async function linkDocument(
  supabase: SupabaseClient,
  productId: string,
  documentId: string,
  usage: "technical" | "catalog",
  primary: boolean,
  sort = 0
): Promise<void> {
  if (primary) {
    const { error } = await supabase
      .from("electrical_catalog_product_documents")
      .update({ is_primary: false })
      .eq("product_id", productId)
      .eq("usage", usage);
    if (error) throw error;
  }
  const { error } = await supabase.from("electrical_catalog_product_documents").upsert(
    { product_id: productId, document_id: documentId, usage, is_primary: primary, sort },
    { onConflict: "product_id,document_id,usage" }
  );
  if (error) throw error;
}

async function saveTechnicalExtract(
  supabase: SupabaseClient | null,
  material: ElectricalMaterialRow,
  source: LocalDocument,
  pages: number[]
): Promise<TechnicalChoice> {
  const identity = materialCatalogIdentity(material);
  const family = catalogIdentityPart(identity.typeNo) === catalogIdentityPart(material.typeNo)
    ? ""
    : ` - ${material.typeNo}`;
  const title = `${identity.supplier} ${identity.typeNo}${family} - Teknik Föy`;
  const bytes = await extractPages(source, pages, title);
  const digest = sha256(bytes);
  const storagePath = `technical/${digest}.pdf`;
  if (!supabase) {
    return {
      documentId: `local:${digest}`,
      bytes,
      pageCount: pages.length,
      sourcePages: pages,
      label: `${identity.supplier} · ${identity.typeNo}`,
      sourceFileName: source.fileName,
    };
  }

  await uploadIfMissing(supabase, storagePath, bytes);
  const fileName = `${identity.supplier} - ${identity.typeNo} Teknik Föy.pdf`.replace(
    /[\\/:*?"<>|]+/g,
    "-"
  );
  const { data, error } = await supabase
    .from("electrical_catalog_documents")
    .upsert(
      {
        title,
        manufacturer: identity.supplier,
        language: source.language,
          document_kind: "technical_extract",
          file_name: fileName,
          storage_path: storagePath,
          storage_parts: [storagePath],
        size_bytes: bytes.byteLength,
        page_count: pages.length,
        sha256: digest,
        source_document_id: source.id,
        source_pages: pages,
      },
      { onConflict: "sha256" }
    )
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error(`${identity.typeNo} teknik föyü kaydedilemedi.`);
  return {
    documentId: String(data.id),
    bytes,
    pageCount: pages.length,
    sourcePages: pages,
    label: `${identity.supplier} · ${identity.typeNo}`,
    sourceFileName: source.fileName,
  };
}

async function technicalChoice(
  supabase: SupabaseClient | null,
  material: ElectricalMaterialRow,
  sources: LocalDocument[]
): Promise<TechnicalChoice | null> {
  if (technicalDenied(material.typeNo)) return null;
  const identity = materialCatalogIdentity(material);
  const target = catalogIdentityPart(identity.typeNo);
  const curated = curatedRange(identity.typeNo);
  if (curated) {
    const curatedPages = curated.pages.slice(0, MAX_TECHNICAL_PAGES);
    const source = sources.find(
      (candidate) =>
        candidate.pageCount > MAX_TECHNICAL_PAGES &&
        candidate.id &&
        catalogIdentityPart(candidate.fileName).includes(catalogIdentityPart(curated.fileIncludes)) &&
        curatedPages.every((page) => page >= 1 && page <= candidate.pageCount)
    );
    if (source?.id) {
      return saveTechnicalExtract(supabase, material, source, curatedPages);
    }
  }

  const short = sources
    .filter((d) => d.pageCount <= MAX_TECHNICAL_PAGES && !d.encrypted)
    .sort((a, b) => sourceScore(b, target) - sourceScore(a, target))[0];
  if (short?.id) {
    return {
      documentId: short.id,
      bytes: await documentBytes(short),
      pageCount: short.pageCount,
      sourcePages: [],
      label: `${identity.supplier} · ${identity.typeNo}`,
      sourceFileName: short.fileName,
    };
  }

  const candidates = [...sources].sort((a, b) => sourceScore(b, target) - sourceScore(a, target));
  for (const source of candidates) {
    const pages = await relevantPages(source, identity.typeNo);
    if (pages.length === 0 || !source.id) continue;
    return saveTechnicalExtract(supabase, material, source, pages);
  }
  return null;
}

async function main(): Promise<void> {
  await loadEnvFiles();
  await access(INDEX_MD);
  const mappings = parseMapping(await readFile(INDEX_MD, "utf8"));
  const activeMappings = ONLY_TYPES.size
    ? mappings.filter((mapping) => ONLY_TYPES.has(catalogIdentityPart(mapping.typeNo)))
    : mappings;
  // Ürün tablosunda doğrudan anılmayan iki genel belge de arşivin parçasıdır;
  // klasördeki içerik PDF'i hariç bütün kaynak PDF'ler veritabanına girer.
  const mappedFileNames = [...new Set(activeMappings.flatMap((mapping) => mapping.files))];
  const allFileNames = (MAPPED_ONLY
    ? mappedFileNames
    : [
        ...(await readdir(CATALOG_DIR)).filter(
          (name) => /\.pdf$/i.test(name) && !/^00\s*-\s*/.test(name)
        ),
        // Eşleme defteri proje alt klasöründeki doğrulanmış bir teknik föyü
        // gösterebilir. Restore sırasında yalnız kök klasörü saymak bu bağı
        // sessizce düşürürdü.
        ...mappedFileNames,
      ])
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b, "tr"));
  const existing = new Set(allFileNames);
  const missing = [...new Set(activeMappings.flatMap((m) => m.files))].filter(
    (name) => !existing.has(name)
  );
  if (missing.length > 0) throw new Error(`Eşleme defterindeki PDF bulunamadı: ${missing.join(", ")}`);
  log(`${activeMappings.length} ürün eşlemesi, ${allFileNames.length} kaynak PDF bulundu.`);
  if (DRY_RUN) return;

  if (!LOCAL_ONLY && APPLY_MIGRATION) await applyMigration();
  let supabase: SupabaseClient | null = null;
  if (!LOCAL_ONLY) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL bulunamadı.");
    supabase = createClient(url, await elevatedApiKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const local = new Map<string, LocalDocument>();
  for (let i = 0; i < allFileNames.length; i++) {
    const fileName = allFileNames[i];
    const document = await inspectDocument(fileName);
    local.set(fileName, document);
    if (supabase) {
      document.storageParts = await uploadDocumentParts(supabase, document);
      document.id = await upsertDocument(supabase, document);
    } else {
      document.id = `local:${document.sha256}`;
      document.storageParts = [document.storagePath];
    }
    document.bytes = undefined;
    log(`[${i + 1}/${allFileNames.length}] ${fileName} · ${document.pageCount} s.`);
  }

  const allMaterials = supabase
    ? await loadProjectMaterials(supabase)
    : activeMappings.map<ElectricalMaterialRow>((m, index) => ({
        key: `local:${index}`,
        partNo: "",
        typeNo: m.typeNo,
        supplier: m.supplier,
        designation: m.designation,
        category: electricalCategory({ ...m, partNo: "" }),
        qty: null,
        locations: [],
      }));
  const selectedMaterials = ONLY_TYPES.size
    ? allMaterials.filter((material) =>
        ONLY_TYPES.has(catalogIdentityPart(materialCatalogIdentity(material).typeNo))
      )
    : allMaterials;
  // EPLAN aynı ticari referansı farklı montaj konumlarında veya farklı kısa
  // tedarikçi yazımlarıyla tekrarlayabilir. Katalog ürünü konuma değil kanonik
  // üretici + tip kimliğine bağlıdır; aktarım ve EK-F destesi tekilleştirilir.
  const materials = [...new Map(
    selectedMaterials.map((material) => [materialCatalogIdentity(material).lookupKey, material])
  ).values()];
  const unmatched: string[] = [];
  const withoutTechnical: string[] = [];
  const appendixInputs: { ad: string; bytes: Uint8Array }[] = [];
  const appendixManifest: Array<{
    documentId: string;
    supplier: string;
    typeNo: string;
    sourceFileName: string;
    sourcePages: number[];
    pageCount: number;
  }> = [];
  const seenTechnical = new Set<string>();
  let technicalCount = 0;
  let catalogCount = 0;

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];
    const identity = materialCatalogIdentity(material);
    const mapping = mappingForMaterial(material, mappings);
    if (!mapping || mapping.files.length === 0) {
      unmatched.push(`${identity.supplier} · ${identity.typeNo}`);
      continue;
    }
    const sources = mapping.files.map((name) => local.get(name)).filter((d): d is LocalDocument => Boolean(d));
    const productId = supabase ? await ensureProduct(supabase, material) : `local-product:${i}`;

    // Bütün özgün bağlar DB'de kalır; UI/EK-F yalnız birincil bağları açar.
    let catalogSort = 0;
    for (const source of sources) {
      if (!source.id) continue;
      if (!supabase) continue;
      if (source.pageCount <= MAX_TECHNICAL_PAGES) await linkDocument(supabase, productId, source.id, "technical", false, catalogSort++);
      else if (source.kind === "catalog") await linkDocument(supabase, productId, source.id, "catalog", false, catalogSort++);
    }

    const fullCatalog = sources
      .filter((d) => d.kind === "catalog" && d.pageCount > MAX_TECHNICAL_PAGES && d.id)
      .sort((a, b) => fullCatalogScore(b) - fullCatalogScore(a))[0];
    const catalogDocument = fullCatalog ?? sources
      .filter((d) => d.id)
      .sort((a, b) => fullCatalogScore(b) - fullCatalogScore(a))[0];
    if (catalogDocument?.id) {
      if (supabase) await linkDocument(supabase, productId, catalogDocument.id, "catalog", true);
      catalogCount += 1;
    }

    const technical = await technicalChoice(supabase, material, sources);
    if (technical) {
      if (supabase) await linkDocument(supabase, productId, technical.documentId, "technical", true);
      technicalCount += 1;
      if (!seenTechnical.has(technical.documentId)) {
        seenTechnical.add(technical.documentId);
        appendixManifest.push({
          documentId: technical.documentId,
          supplier: identity.supplier,
          typeNo: identity.typeNo,
          sourceFileName: technical.sourceFileName,
          sourcePages: technical.sourcePages,
          pageCount: technical.pageCount,
        });
        appendixInputs.push({ ad: technical.label, bytes: technical.bytes });
      }
    } else {
      withoutTechnical.push(`${identity.supplier} · ${identity.typeNo}`);
    }
    const pageNote = technical?.sourcePages.length ? ` · kaynak s. ${technical.sourcePages.join(",")}` : "";
    log(`Ürün [${i + 1}/${materials.length}] ${identity.typeNo} · ${technical ? `${technical.pageCount} s. föy${pageNote}` : "föy yok"}`);
  }

  const appendix = await pdfBirlestir(appendixInputs, {
    baslik: `EK-F Elektrik Ekipman Katalog Sayfaları - ${PROJECT_DOC_NO}`,
    konu: `${PROJECT_DOC_NO} elektrik malzeme listesine bağlı teknik föyler`,
    uretici: "ORION CRANES",
    olusturan: "ORION İş Yönetim Sistemi",
  });
  if (appendix.bytes.byteLength > 0) {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, appendix.bytes);
    await writeFile(OUTPUT_MANIFEST, `${JSON.stringify(appendixManifest, null, 2)}\n`, "utf8");
  }

  log(`Aktarım tamamlandı: ${technicalCount} teknik föy, ${catalogCount} tam katalog bağı.`);
  log(`EK-F doğrulama destesi: ${appendix.sayfaSayisi} sayfa, ${appendix.birlesen} belge.`);
  if (unmatched.length > 0) {
    log(`Eşleşmeyen ${unmatched.length} malzeme:\n- ${unmatched.join("\n- ")}`);
  }
  if (withoutTechnical.length > 0) {
    log(`Teknik föysüz ${withoutTechnical.length} malzeme:\n- ${withoutTechnical.join("\n- ")}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Elektrik katalog aktarımı başarısız: ${message}\n`);
  process.exitCode = 1;
});

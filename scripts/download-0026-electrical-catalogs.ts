/**
 * 0026-01 elektrik projesindeki ürünler için gerçek üretici belgelerini indirir
 * ve `import-electrical-catalogs.ts` tarafından okunabilen eşleme defterini
 * üretir.
 *
 * Bu betik ürün özeti veya üretici föyü görünümünde PDF OLUŞTURMAZ. Teknik
 * föyler aktarım sırasında yalnız bu özgün PDF'lerin doğrulanmış sayfalarından
 * çıkarılır. Her ağ kaynağı URL + yayıncı + SHA-256 ile manifestoya yazılır.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const CATALOG_ROOT = path.resolve(REPO, "..", "Elektrik Katalogları");
const OUTPUT_DIR = path.join(CATALOG_ROOT, "0026-01");
const OUTPUT_INDEX = path.join(OUTPUT_DIR, "00 - 0026-01 MALZEME ve DOKÜMAN EŞLEŞMESİ.md");
const OUTPUT_SOURCES = path.join(OUTPUT_DIR, "00 - 0026-01 KAYNAK MANİFESTOSU.json");

type SourceType = "manufacturer" | "authorized";

interface DownloadSpec {
  fileName: string;
  urls: string[];
  publisher: string;
  sourceType: SourceType;
  note: string;
}

interface DownloadResult extends DownloadSpec {
  url: string;
  bytes: number;
  sha256: string;
  status: "downloaded" | "existing";
}

interface ProductSpec {
  supplier: string;
  typeNo: string;
  files: string[];
}

const downloads: DownloadSpec[] = [];

function local(fileName: string): string {
  return fileName;
}

function remote(spec: DownloadSpec): string {
  if (!downloads.some((item) => item.fileName === spec.fileName)) downloads.push(spec);
  return path.posix.join("0026-01", spec.fileName);
}

function manufacturer(fileName: string, urls: string | string[], note: string): string {
  return remote({
    fileName,
    urls: Array.isArray(urls) ? urls : [urls],
    publisher: fileName.split(" - ")[0],
    sourceType: "manufacturer",
    note,
  });
}

function schneiderDownload(documentReference: string): string {
  return `https://download.schneider-electric.com/files?filename=Catalog&p_Doc_Ref=${encodeURIComponent(documentReference)}`;
}

const family = {
  acti9: manufacturer(
    "SCHNEIDER ELECTRIC - Acti9 Tam Katalog 2025 (PT).pdf",
    schneiderDownload("Catalogo Completo Acti9"),
    "Schneider Electric, 25.11.2025 tarihli güncel Acti9 tam kataloğu."
  ),
  controlRelays: manufacturer(
    "SCHNEIDER ELECTRIC - Harmony Kontrol Röleleri Kataloğu 2025 (EN).pdf",
    schneiderDownload("DIA5ED2160501EN"),
    "Schneider Electric Harmony Control Relays katalog sürüm 7.0, 26.06.2025."
  ),
  relays: manufacturer(
    "SCHNEIDER ELECTRIC - Harmony Elektromekanik Röleler Kataloğu 2025 (EN).pdf",
    schneiderDownload("DIA5ED2130303EN"),
    "Schneider Electric Harmony Electromechanical Relays katalog sürüm 8.0, 13.05.2025."
  ),
  tesys: manufacturer(
    "SCHNEIDER ELECTRIC - TeSys Motor Yol Verme Kataloğu 2026 (EN).pdf",
    schneiderDownload("MKTED210011EN"),
    "Schneider Electric TeSys katalog sürüm 17.2, 12.08.2026; Giga, Deca, K ve GV2 aileleri."
  ),
  gopact: manufacturer(
    "SCHNEIDER ELECTRIC - GoPact MCCB 16-800A Kataloğu 2024 (EN).pdf",
    schneiderDownload("SP0368101"),
    "Schneider Electric GoPact MCCB katalog sürüm 03, 23.10.2024."
  ),
  altivar: manufacturer(
    "SCHNEIDER ELECTRIC - Altivar Process ATV900 Kataloğu 2023 (EN).pdf",
    schneiderDownload("DIA2ED2150601EN"),
    "Schneider Electric Altivar Process ATV900 katalog sürüm 12.0, 13.06.2023."
  ),
  omronS8vk: manufacturer(
    "OMRON - S8VK-C Anahtarlamalı Güç Kaynağı Teknik Föyü (EN).pdf",
    "https://assets.omron.eu/downloads/latest/datasheet/en/t058_s8vk-c_switch_mode_power_supply_datasheet_en.pdf",
    "Omron Europe resmi S8VK-C üretici veri sayfası; S8VK-C24024 açıkça listelenir."
  ),
  gamak: manufacturer(
    "GAMAK - Teknik Katalog 2025 (TR).pdf",
    [
      "https://www.gamak.com/uploads/files/2025-Teknik%20Katalog.pdf",
      "https://www.gamak.com/uploads/files/2025-technical-catalog-en.pdf",
    ],
    "GAMAK resmi güncel teknik katalog; GM4E ve AGM motor tabloları ile ölçüleri."
  ),
  gamakGm4eSheet: manufacturer(
    "GAMAK - GM4E 280 S 4a B3 Teknik Föyü 2026 (TR-EN).pdf",
    "https://www.gamak.com/uploads/files/products/datasheet/GM4E%20280%20S%204a%20B3.pdf",
    "GAMAK resmi ürün teknik föyü; GM4E 280 S 4a, B3 montaj, 05.02.2026."
  ),
  bannerLtf: manufacturer(
    "BANNER - LTF IO-Link Lazer Mesafe Sensörü Kullanım Kılavuzu 2025 (EN).pdf",
    "https://info.bannerengineering.com/cs/groups/public/documents/literature/195393.pdf",
    "Banner Engineering resmi LTF ürün kılavuzu, revizyon K, 26.08.2025."
  ),
  adimsanSheet: manufacturer(
    "ADIMSAN - TYP013 B Ağırlıklı Limit Şalteri Teknik Föyü (TR).pdf",
    "https://adimsan.com/wp-content/uploads/2026/07/TYP013-B-TR.pdf",
    "Adımsan resmi WordPress medya kaydı 13606; Temmuz 2026 TYP013 B datasheet."
  ),
  emasSheet: manufacturer(
    "EMAS - CSM04 Çapraz Sınır Şalteri Teknik Föyü (EN).pdf",
    "https://www.emaselectric.com/Export/Datasheet?languageCode=en&productCode=CSM04",
    "EMAS resmi, ürün koduyla üretilen iki sayfalık CSM04 datasheet."
  ),
  emasCrane: manufacturer(
    "EMAS - Vinç Grubu Ürünleri Genel Bakış (EN).pdf",
    "https://www.emaselectric.com/Download/ProductOverview",
    "EMAS resmi Crane Products ürün programı; CSM04 açıkça listelenir."
  ),
  elfatekRemote: remote({
    fileName: "ELFATEK - Kumanda ve Joystick Ürün Kataloğu (TR).pdf",
    urls: ["https://www.elfafin.fi/pdf/Kumanda_ve_Joystick_Katalog_26_06_19.pdf"],
    publisher: "Elfatek / Elfafin",
    sourceType: "authorized",
    note: "Elfatek üretici markalı kumanda kataloğunun Finlandiya distribütörü Elfafin aynası; EN MID 602 açıkça listelenir.",
  }),
  elfatekSafety: remote({
    fileName: "ELFATEK - Yük Kontrol ve Vinç Güvenlik Ekipmanları Broşürü (EN).pdf",
    urls: ["https://www.hetronic.in/wp-content/uploads/2024/09/Elfatek-1.pdf"],
    publisher: "Elfatek / Hetronic India",
    sourceType: "authorized",
    note: "Elfatek üretici markalı güvenlik ekipmanları broşürünün endüstriyel uzaktan kumanda distribütörü aynası; OCS-CU01 açıkça yer alır.",
  }),
  fenac80h: remote({
    fileName: "FENAC - FNC 80H Artımlı Enkoder Teknik Föyü (EN).pdf",
    urls: ["https://www.cael.it/index_htm_files/fnc%2080hg.pdf"],
    publisher: "FENAC / CAEL",
    sourceType: "authorized",
    note: "FENAC üretici markalı FNC 80H veri sayfasının endüstriyel enkoder distribütörü CAEL aynası.",
  }),
};

function siemensSheet(typeNo: string): string {
  return manufacturer(
    `SIEMENS - ${typeNo} Teknik Veri Sayfası (EN).pdf`,
    `https://support.industry.siemens.com/teddatasheet/?caller=SIOS&format=pdf&language=en&mlfbs=${encodeURIComponent(typeNo)}`,
    `Siemens Industry Online Support, tam ${typeNo} MLFB teknik veri sayfası.`
  );
}

function schneider(typeNo: string, catalog: string): ProductSpec {
  // Bazı Schneider referanslarının iPortal kısa föy URL'leri yayınlanmıyor.
  // Bu durumda tahmini URL/yanlış belge bağlamak yerine güncel üretici aile
  // kataloğunu saklıyor, teknik föyü ürün kodunun geçtiği gerçek sayfalardan
  // aktarım betiğiyle çıkarıyoruz.
  return { supplier: "Schneider Electric", typeNo, files: [catalog] };
}

const products: ProductSpec[] = [
  { supplier: "Niki Electronics", typeNo: "N1000-P-2/160W.5000K", files: [local("HABAŞ 50T/NIKI - N1000 P-2 160W LED Projektör Teknik Föyü (TR).pdf")] },

  ...["A9F74210", "A9F74216", "A9F74110", "A9F74332", "A9F74206", "A9A26904"].map((typeNo) => schneider(typeNo, family.acti9)),
  schneider("RM22TG20", family.controlRelays),
  ...["RXG22BD", "RGZE1S48M", "RXM4AB1BD", "RXZE2M114M"].map((typeNo) => schneider(typeNo, family.relays)),
  ...["LC1G185KUEN", "LAG8N113P", "LAG8N113", "LC1D09M7", "LP1K0610BD", "GV2ME20", "GVAE11", "GV2ME07"].map((typeNo) => schneider(typeNo, family.tesys)),
  ...["G25F3A250", "G12F3F63"].map((typeNo) => schneider(typeNo, family.gopact)),
  { supplier: "Schneider Electric", typeNo: "XB4BS8442", files: [local("HABAŞ 50T/SCHNEIDER ELECTRIC - XB4BS8442 Ürün Teknik Föyü (EN).pdf"), local("SCHNEIDER ELECTRIC - Harmony XB4 Metal Kumanda ve Sinyal Katalogu (EN).pdf")] },
  ...["ATV930D90N4", "VW3A3424", "ATV930D15N4"].map((typeNo) => schneider(typeNo, family.altivar)),

  { supplier: "Omron", typeNo: "S8VKC24024", files: [family.omronS8vk] },
  { supplier: "Siemens", typeNo: "3SK1121-2AB40", files: [siemensSheet("3SK1121-2AB40"), local("SIEMENS - SIRIUS IC10 Guvenlik Teknigi 3SK Guvenlik Roleleri (EN).pdf")] },
  { supplier: "Siemens", typeNo: "3RN2010-1CW30", files: [local("HABAŞ 50T/SIEMENS - 3RN2010-1CW30 Teknik Veri Sayfası (EN).pdf"), local("SIEMENS - SIRIUS IC10 Izleme ve Kumanda Cihazlari 3UG 3RN (EN).pdf")] },

  ...["51041", "EG-ET-01"].map((typeNo) => ({ supplier: "EAE", typeNo, files: [local("EAE - E-KABIN Genel Katalog Pano Aksesuarlari (TR).pdf")] })),
  ...["SNT-SL190-22", "SNT-B710-1", "SNT-7024-S3", "SNT-BL186-1"].map((typeNo) => ({ supplier: "MUCCO", typeNo, files: [local("MUCCO - Sinyal ve İkaz Ürünleri Genel Kataloğu (EN).pdf")] })),
  { supplier: "GAMAK", typeNo: "GM4E280S4a", files: [family.gamakGm4eSheet, family.gamak] },
  { supplier: "GAMAK", typeNo: "AGM 132 M 6B", files: [family.gamak] },
  { supplier: "ABB", typeNo: "MOTOR PTC", files: [local("HABAŞ 50T/ABB - MOTOR PTC Teknik Föy - Kılavuz Sayfaları (EN).pdf"), local("HABAŞ 50T/ABB - Asenkron Motorlar ve PTC Termistörler Kılavuzu (EN).pdf")] },
  { supplier: "FENAC", typeNo: "80H20630V1024-R3", files: [family.fenac80h] },
  { supplier: "QUICK", typeNo: "FULL2500", files: [local("QUICK - FULL 2500 Fanli Filtre IP54 Teknik Foyu (TR).pdf"), local("QUICK - Pano Havalandirma Urun Katalogu (TR).pdf")] },
  // RESSA BRSD kodları projeye özel fren direnci konfigürasyonudur. İnternette
  // üretici/yetkili, ürün kodunu doğrulayan PDF bulunmadığı için bilerek boş.
  ...["BRSD-836SW-7503", "BRSD-436SW-1125"].map((typeNo) => ({ supplier: "RESSA", typeNo, files: [] })),
  { supplier: "STROMAG", typeNo: "51-67-DZC0Z-499P", files: [local("HABAŞ 50T/STROMAG - 51-67-DZC0Z-499P Teknik Föy - Katalog Sayfaları (EN).pdf"), local("STROMAG - Seri 51 - 51 DZ Redüktörlü Kamlı Limit Şalterleri Kataloğu (EN).pdf")] },
  { supplier: "Adımsan", typeNo: "TYP013B", files: [family.adimsanSheet] },
  { supplier: "EMAS", typeNo: "CSM04", files: [family.emasSheet, family.emasCrane] },
  { supplier: "Banner Engineering", typeNo: "LTF12KC2LDQ", files: [family.bannerLtf] },
  { supplier: "ETA", typeNo: "MATIS 4000", files: [local("ETA MATIS - Trafo ve Reaktor Urun Katalogu (TR).pdf")] },
  { supplier: "Elfatek", typeNo: "ESX_MID 602", files: [family.elfatekRemote] },
  { supplier: "Elfatek", typeNo: "OCS-CU01", files: [family.elfatekSafety] },
  ...["BC1-3504-7420", "BC1-1403-7420"].map((typeNo) => ({ supplier: "BEMIS", typeNo, files: [local(`BEMIS - ${typeNo} 45 Derece Eğik Makine Prizi ${typeNo.startsWith("BC1-3504") ? "32A 3P+E" : "16A 2P+E"} Teknik Föyü (TR).pdf`), local("BEMIS - Endüstriyel Fiş Priz Genel Kataloğu 2026-2027 (EN).pdf")] })),
  { supplier: "SIBRE", typeNo: "ED 50/6", files: [local("SIBRE - ELDRO Surgu Teknik Veri ve Olculer Ed serisi (EN).pdf"), local("SIBRE - ELDRO Elektrohidrolik Surgu Katalogu ED serisi (EN).pdf")] },
  { supplier: "Kobastar", typeNo: "LPW1", files: [local("KOBASTAR - LPW1 Pim Tipi Yuk Hucresi Veri Sayfasi (TR).pdf")] },
];

async function readExisting(target: string): Promise<Uint8Array | null> {
  try {
    const bytes = new Uint8Array(await readFile(target));
    return Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-" ? bytes : null;
  } catch {
    return null;
  }
}

async function fetchPdf(spec: DownloadSpec): Promise<DownloadResult> {
  const target = path.join(OUTPUT_DIR, spec.fileName);
  const existing = await readExisting(target);
  if (existing) {
    return {
      ...spec,
      url: spec.urls[0],
      bytes: existing.byteLength,
      sha256: createHash("sha256").update(existing).digest("hex"),
      status: "existing",
    };
  }

  const errors: string[] = [];
  for (const url of spec.urls) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          Accept: "application/pdf,*/*",
          Referer: `${new URL(url).origin}/`,
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });
      if (!response.ok) {
        errors.push(`${response.status} ${url}`);
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
        errors.push(`${response.headers.get("content-type") ?? "unknown"} ${url}`);
        continue;
      }
      await writeFile(target, bytes);
      return {
        ...spec,
        url: response.url,
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        status: "downloaded",
      };
    } catch (error) {
      errors.push(`${error instanceof Error ? error.message : String(error)} ${url}`);
    }
  }
  throw new Error(`${spec.fileName}: geçerli PDF alınamadı\n${errors.join("\n")}`);
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const results: DownloadResult[] = [];
  for (let index = 0; index < downloads.length; index += 1) {
    const result = await fetchPdf(downloads[index]);
    results.push(result);
    process.stdout.write(`[${index + 1}/${downloads.length}] ${result.status}: ${result.fileName}\n`);
  }

  const grouped = new Map<string, ProductSpec[]>();
  for (const product of products) {
    const group = grouped.get(product.supplier) ?? [];
    group.push(product);
    grouped.set(product.supplier, group);
  }

  const lines = [
    "# 0026-01 — ELEKTRİK KATALOGLARI VE TEKNİK FÖY EŞLEMESİ",
    "",
    `**Malzeme kapsamı:** ${products.length} benzersiz ürün`,
    "",
    "Bu defter yalnız üretici/yetkili kaynak PDF'lerini eşler. ORION tarafından ürün özeti üretilmez; kısa teknik föy gerekiyorsa tam katalogdan gerçek sayfalar kaynak/sayfa izi korunarak çıkarılır.",
    "",
    "## 1 · KAYNAK ÖZETİ",
    "",
    `- İndirilen/yeniden kullanılan ağ kaynağı: ${results.length}`,
    `- Doğrudan üretici kaynağı: ${results.filter((item) => item.sourceType === "manufacturer").length}`,
    `- Yetkili/distribütör üretici-belgesi aynası: ${results.filter((item) => item.sourceType === "authorized").length}`,
    "- Ürün kodunu doğrulayan yayınlanmış PDF bulunamayan ürün: 2 (RESSA özel BRSD konfigürasyonları; yanlış belge bağlanmadı)",
    "",
    "## 2 · MALZEME LİSTESİ VE DOSYALAR",
    "",
  ];
  for (const [supplier, group] of [...grouped].sort(([a], [b]) => a.localeCompare(b, "tr"))) {
    lines.push(`### ${supplier}`, "", "| Tip No | Tanım | Parça No | Belgeler |", "|---|---|---|---|");
    for (const product of group.sort((a, b) => a.typeNo.localeCompare(b.typeNo, "tr"))) {
      lines.push(`| \`${product.typeNo}\` |  |  | ${product.files.join("<br>") || "— belge yok"} |`);
    }
    lines.push("");
  }
  lines.push(
    "## 3 · DOĞRULAMA NOTLARI",
    "",
    "Ağ URL'si, yayıncı, kaynak türü, SHA-256 ve dosya boyutu yanındaki JSON manifestoda tutulur. Teknik föy sayfaları aktarım manifestosunda `source_document_id` ve `source_pages` ile izlenir.",
    ""
  );

  await writeFile(OUTPUT_INDEX, `${lines.join("\n")}\n`, "utf8");
  await writeFile(
    OUTPUT_SOURCES,
    `${JSON.stringify({ generated_at: new Date().toISOString(), project: "0026-01", products: products.length, sources: results }, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`Tamamlandı: ${products.length} ürün, ${results.length} ağ PDF'i.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

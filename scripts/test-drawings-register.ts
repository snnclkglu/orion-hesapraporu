// Parça defteri çıktıları duman testi — Excel ve PDF gerçekten üretiliyor mu.
//
//     npx tsx scripts/test-drawings-register.ts
//
// Vitest saf çekirdeği sınar; burada asıl soru RENDERER'ın çalışıp çalışmadığı:
// @react-pdf font kaydını dosya sisteminden yapar, exceljs tampon üretir ve
// ikisi de ancak gerçekten çağrıldığında patlar. Ekranda "İndir"e basmadan
// önce bu betiğin geçmesi gerekir.

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBomFileName, parseFile } from "../src/lib/drawings/file-name";
import { parseFolderName } from "../src/lib/drawings/folder-name";
import { readSheet } from "../src/lib/drawings/excel";
import { reconcile } from "../src/lib/drawings/reconcile";
import { PART_KIND_LABELS, type BomRow } from "../src/lib/drawings/types";
import { MONORAY, MTC, type FixturePackage } from "../src/lib/drawings/__tests__/fixtures/packages";
import {
  MONORAY_SHEETS,
  MTC_SHEETS,
  type FixtureSheet,
} from "../src/lib/drawings/__tests__/fixtures/bom-sheets";
import {
  buildRegisterWorkbook,
  type RegisterMeta,
  type RegisterPartOut,
} from "../src/lib/excel/drawing-register";
import { renderRegisterPdf } from "../src/lib/pdf/drawing-register";
import { docCode } from "../src/lib/pdf/doc-naming";

async function uret(pkg: FixturePackage, sheets: FixtureSheet[]): Promise<void> {
  const files = pkg.files.map((f) => parseFile({ relPath: f.path, size: f.size, checksum: f.hash }));
  const bom: BomRow[] = sheets
    .filter((s) => !s.file.split("/").some((seg) => seg === "İPTAL"))
    .flatMap(
      (s) =>
        readSheet(
          { fileRelPath: s.file, sheetName: s.sheet, rows: s.rows },
          parseBomFileName(s.file.split("/").pop() ?? "").kind
        ).rows
    );
  const klasor = parseFolderName(pkg.folder).value;
  const sonuc = reconcile({ folderName: pkg.folder, folder: klasor, files, bom });

  const parts: RegisterPartOut[] = sonuc.parts.map((p) => ({
    partCode: p.partCode,
    description: p.description || p.name || "",
    assemblyTitle: p.assemblyTitle,
    kindLabel: PART_KIND_LABELS[p.kind],
    material: p.material,
    category: p.category,
    qty: p.qty,
    cutLengthMm: p.cutLengthMm,
    thicknessMm: p.thicknessMm,
    weightKg: p.weightKg,
    hasModel: p.hasModel,
    hasSheet: p.hasSheet,
    hasCut: p.hasCut,
    isMontaj: p.kind === "montaj",
  }));

  const paketKodu = [klasor?.itemNo, klasor?.group].filter(Boolean).join("-") || "PAKET";
  const meta: RegisterMeta = {
    packageTitle: `${klasor?.description ?? pkg.folder}${klasor?.capacity ? ` (${klasor.capacity})` : ""}`,
    folderName: pkg.folder,
    itemNo: klasor?.itemNo ?? "",
    groupCode: klasor?.group ?? "",
    docCode: docCode("TR", paketKodu, 1),
    filterText: "süzgeç yok (tüm satırlar)",
    generatedAt: "10.08.2026 00:00",
    preparedBy: "duman testi",
    recognitionPct: sonuc.recognition.pct,
  };

  const xlsx = Buffer.from(
    (await buildRegisterWorkbook(parts, meta).xlsx.writeBuffer()) as ArrayBuffer
  );
  const pdf = await renderRegisterPdf({
    parts,
    meta,
    company: { company: "Orion Vinç Mühendislik", address: "Başkent OSB 1. Cadde No:20, Ankara" },
  });

  const kokAd = paketKodu.replace(/[^\w-]/g, "_");
  const xlsxYol = join(tmpdir(), `orion-defter-${kokAd}.xlsx`);
  const pdfYol = join(tmpdir(), `orion-defter-${kokAd}.pdf`);
  writeFileSync(xlsxYol, xlsx);
  writeFileSync(pdfYol, pdf);

  console.log(`\n${pkg.folder}`);
  console.log(`  ${parts.length} satır · ${meta.docCode} · tanıma %${meta.recognitionPct}`);
  console.log(`  xlsx ${(xlsx.length / 1024).toFixed(0)} KB → ${xlsxYol}`);
  console.log(`  pdf  ${(pdf.length / 1024).toFixed(0)} KB → ${pdfYol}`);

  // Boş bir tampon "üretildi" sayılmaz; ikisi de gerçek bir belge olmalı.
  if (xlsx.length < 4000) throw new Error("xlsx şüpheli derecede küçük");
  if (pdf.length < 4000) throw new Error("pdf şüpheli derecede küçük");
  if (pdf.subarray(0, 4).toString() !== "%PDF") throw new Error("pdf imzası yok");
}

async function main(): Promise<void> {
  await uret(MONORAY, MONORAY_SHEETS);
  await uret(MTC, MTC_SHEETS);
  console.log("\nİki paket için de Excel ve PDF üretildi.\n");
}

void main();

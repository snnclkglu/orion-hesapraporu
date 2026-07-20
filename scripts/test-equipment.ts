// Gerçek üretim testi — V5 şablonuyla ekipman workbook'u üretir, diske yazar,
// exceljs ile geri okuyup sayfa adlarını ve satır sayılarını raporlar.
// Kullanım: npx tsx scripts/test-equipment.ts [çıktı-yolu.xlsx]

import ExcelJS from "exceljs";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { V5_TEMPLATE } from "../src/lib/calc/defaults";
import { runCalc } from "../src/lib/calc/engine";
import {
  buildEquipmentGroups, buildEquipmentWorkbook, buildSummarySections, mergeExtras,
  type EquipmentExtraRow,
} from "../src/lib/excel/equipment";
import { renderEquipmentPdf } from "../src/lib/pdf/equipment-report";

const EXTRAS: EquipmentExtraRow[] = [
  { group: "Ek Ekipman", component: "Uzaktan kumanda", brand: "HBC", model: "radiomatic", spec: "6 fonksiyon, 433 MHz", qty: "1" },
  { group: "Ana Kaldırma", component: "Aşırı yük sensörü", brand: "-", model: "-", spec: "kapasite %110 kesme", qty: "1" },
];

const META = {
  docNo: "TEST-V5",
  projectName: "İSDEMİR - Amonyum Sülfat Vinci (V5 şablon)",
  customer: "İSDEMİR",
  revLabel: "V5 şablon testi",
  revNo: 0,
  date: new Date().toLocaleDateString("tr-TR"),
};

async function main() {
  const outPath =
    process.argv[2] ?? path.join(tmpdir(), "orion-equipment-test.xlsx");
  mkdirSync(path.dirname(outPath), { recursive: true });

  const calcResult = runCalc(V5_TEMPLATE);
  const workbook = buildEquipmentWorkbook(V5_TEMPLATE, calcResult, META, { extras: EXTRAS });
  await workbook.xlsx.writeFile(outPath);

  const size = statSync(outPath).size;
  console.log(`Dosya: ${outPath}`);
  console.log(`Boyut: ${size} bayt (${(size / 1024).toFixed(1)} KB)`);
  if (size <= 8 * 1024) {
    console.error("HATA: dosya boyutu 8KB altinda — icerik eksik olabilir.");
    process.exitCode = 1;
  }

  // Geri oku ve doğrula
  const readBack = new ExcelJS.Workbook();
  await readBack.xlsx.readFile(outPath);
  const expected = ["Ekipman Listesi", "Teknik Ressam Özeti"];
  const names = readBack.worksheets.map((ws) => ws.name);
  console.log(`Sayfalar: ${names.join(" | ")}`);
  for (const name of expected) {
    if (!names.includes(name)) {
      console.error(`HATA: "${name}" sayfası bulunamadı.`);
      process.exitCode = 1;
    }
  }
  for (const ws of readBack.worksheets) {
    let dataRows = 0;
    ws.eachRow({ includeEmpty: false }, () => {
      dataRows += 1;
    });
    console.log(`  "${ws.name}": ${ws.rowCount} satır (dolu: ${dataRows})`);
    if (dataRows < 15) {
      console.error(`HATA: "${ws.name}" beklenenden az satır içeriyor (${dataRows}).`);
      process.exitCode = 1;
    }
  }

  // Yeni sütun başlıkları + ek satır doğrulaması
  const eqWs = readBack.getWorksheet("Ekipman Listesi");
  if (eqWs) {
    const headerRow = eqWs.getRow(8);
    const headers = [1, 2, 3, 4, 5].map((c) => String(headerRow.getCell(c).value ?? ""));
    console.log(`Başlıklar: ${headers.join(" | ")}`);
    const expectedHeaders = ["Ekipman", "Marka", "Model", "Özellikler", "Adet"];
    if (expectedHeaders.join("|") !== headers.join("|")) {
      console.error("HATA: ekipman başlıkları beklenenle eşleşmiyor.");
      process.exitCode = 1;
    }
    let found = false;
    eqWs.eachRow((row) => {
      if (String(row.getCell(1).value ?? "").includes("Uzaktan kumanda")) found = true;
    });
    if (!found) {
      console.error("HATA: ek satır (Uzaktan kumanda) çıktıda yok.");
      process.exitCode = 1;
    } else {
      console.log("Ek satır (Uzaktan kumanda) çıktıda mevcut ✓");
    }
  }

  // PDF üretimi (müşteri + tam) — react-pdf hata vermeden buffer üretmeli
  const groups = mergeExtras(buildEquipmentGroups(V5_TEMPLATE), EXTRAS);
  const summary = buildSummarySections(V5_TEMPLATE, calcResult);
  const outDir = path.join(process.cwd(), ".test-output");
  mkdirSync(outDir, { recursive: true });

  const pdfCustomer = await renderEquipmentPdf({ meta: META, groups });
  const pdfFull = await renderEquipmentPdf({ meta: META, groups, summary });
  const pCustPath = path.join(outDir, "ekipman-listesi-musteri.pdf");
  const pFullPath = path.join(outDir, "ekipman-listesi-tam.pdf");
  writeFileSync(pCustPath, pdfCustomer);
  writeFileSync(pFullPath, pdfFull);
  for (const [label, p] of [["müşteri", pCustPath], ["tam", pFullPath]] as const) {
    const sz = statSync(p).size;
    console.log(`PDF (${label}): ${p} — ${(sz / 1024).toFixed(1)} KB`);
    if (sz <= 4 * 1024) {
      console.error(`HATA: PDF (${label}) çok küçük — üretim başarısız olabilir.`);
      process.exitCode = 1;
    }
  }

  console.log(process.exitCode ? "SONUÇ: BAŞARISIZ" : "SONUÇ: BAŞARILI");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

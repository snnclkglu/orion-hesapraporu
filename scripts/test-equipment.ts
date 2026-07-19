// Gerçek üretim testi — V5 şablonuyla ekipman workbook'u üretir, diske yazar,
// exceljs ile geri okuyup sayfa adlarını ve satır sayılarını raporlar.
// Kullanım: npx tsx scripts/test-equipment.ts [çıktı-yolu.xlsx]

import ExcelJS from "exceljs";
import { mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { V5_TEMPLATE } from "../src/lib/calc/defaults";
import { runCalc } from "../src/lib/calc/engine";
import { buildEquipmentWorkbook } from "../src/lib/excel/equipment";

async function main() {
  const outPath =
    process.argv[2] ?? path.join(tmpdir(), "orion-equipment-test.xlsx");
  mkdirSync(path.dirname(outPath), { recursive: true });

  const calcResult = runCalc(V5_TEMPLATE);
  const workbook = buildEquipmentWorkbook(V5_TEMPLATE, calcResult, {
    docNo: "TEST-V5",
    projectName: "İSDEMİR - Amonyum Sülfat Vinci (V5 şablon)",
    customer: "İSDEMİR",
    revLabel: "V5 şablon testi",
    revNo: 0,
    date: new Date().toLocaleDateString("tr-TR"),
  });
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

  console.log(process.exitCode ? "SONUÇ: BAŞARISIZ" : "SONUÇ: BAŞARILI");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

// PDF rapor duman testi — V5 şablonu + sahte proje bilgisiyle raporu üretir.
// Çalıştırma: npx tsx scripts/test-pdf.ts [çıktı-dizini]
// Doğrular: dosya %PDF ile başlar, >20KB, sayfa sayısını raporlar.

import fs from "node:fs";
import path from "node:path";
import { V5_TEMPLATE } from "../src/lib/calc/defaults";
import { runCalc } from "../src/lib/calc/engine";
import { renderReportPdf } from "../src/lib/pdf/report";

async function main() {
  const outDir = process.argv[2] ?? path.join(process.cwd(), ".test-output");
  fs.mkdirSync(outDir, { recursive: true });

  const input = V5_TEMPLATE;
  const result = runCalc(input);

  const buffer = await renderReportPdf({
    project: {
      doc_no: "0055-HR-001",
      name: "AMONYUM SÜLFAT VİNCİ",
      customer: "İSDEMİR",
      crane_type: "Çift Kirişli Gezer Köprülü Vinç",
    },
    revision: { rev_no: 5, label: "V5", issued_at: new Date().toISOString() },
    preparedBy: "Sinan Çolakoğlu",
    input,
    result,
  });

  const outFile = path.join(outDir, "0055-HR-001-V5.pdf");
  fs.writeFileSync(outFile, buffer);

  const header = buffer.subarray(0, 5).toString("latin1");
  const startsWithPdf = header.startsWith("%PDF");
  const sizeKb = buffer.length / 1024;
  // Sayfa sayısı: /Type /Page nesneleri (/Pages hariç)
  const pageCount = (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

  console.log(`Çıktı        : ${outFile}`);
  console.log(`%PDF başlığı : ${startsWithPdf ? "EVET" : "HAYIR"}`);
  console.log(`Boyut        : ${sizeKb.toFixed(1)} KB`);
  console.log(`Sayfa sayısı : ${pageCount}`);
  console.log(`Kontroller   : ${result.allChecks.length} (${result.allPass ? "tümü uygun" : "uygunsuz var"})`);

  if (!startsWithPdf) throw new Error("Dosya %PDF ile başlamıyor");
  if (sizeKb <= 20) throw new Error(`Dosya çok küçük: ${sizeKb.toFixed(1)} KB (>20KB beklenir)`);
  console.log("PDF duman testi BAŞARILI.");
}

main().catch((err) => {
  console.error("PDF duman testi BAŞARISIZ:", err);
  process.exit(1);
});

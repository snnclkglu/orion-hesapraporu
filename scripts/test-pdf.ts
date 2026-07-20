// PDF rapor duman testi — V5 şablonu + sahte proje bilgisiyle raporu
// üç seviyede (detaylı / standart / özet) üretir.
// Çalıştırma: npx tsx scripts/test-pdf.ts [çıktı-dizini]
// Doğrular: dosya %PDF ile başlar, >20KB (detaylı), sayfa sayılarını raporlar.

import fs from "node:fs";
import path from "node:path";
import { V5_TEMPLATE } from "../src/lib/calc/defaults";
import { runCalc } from "../src/lib/calc/engine";
import { REPORT_LEVELS, renderReportPdf, type ReportLevel } from "../src/lib/pdf/report";

async function main() {
  const outDir = process.argv[2] ?? path.join(process.cwd(), ".test-output");
  fs.mkdirSync(outDir, { recursive: true });

  const input = V5_TEMPLATE;
  const result = runCalc(input);

  const minSizeKb: Record<ReportLevel, number> = { detayli: 20, standart: 20, ozet: 10 };

  for (const level of REPORT_LEVELS) {
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
      level,
    });

    const outFile = path.join(outDir, `0055-HR-001-V5-${level}.pdf`);
    fs.writeFileSync(outFile, buffer);

    const header = buffer.subarray(0, 5).toString("latin1");
    const startsWithPdf = header.startsWith("%PDF");
    const sizeKb = buffer.length / 1024;
    // Sayfa sayısı: /Type /Page nesneleri (/Pages hariç)
    const pageCount = (buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    console.log(`[${level}]`);
    console.log(`  Çıktı        : ${outFile}`);
    console.log(`  %PDF başlığı : ${startsWithPdf ? "EVET" : "HAYIR"}`);
    console.log(`  Boyut        : ${sizeKb.toFixed(1)} KB`);
    console.log(`  Sayfa sayısı : ${pageCount}`);

    if (!startsWithPdf) throw new Error(`[${level}] Dosya %PDF ile başlamıyor`);
    if (sizeKb <= minSizeKb[level])
      throw new Error(
        `[${level}] Dosya çok küçük: ${sizeKb.toFixed(1)} KB (>${minSizeKb[level]}KB beklenir)`
      );
  }

  console.log(
    `Kontroller   : ${result.allChecks.length} (${result.allPass ? "tümü uygun" : "uygunsuz var"})`
  );
  console.log("PDF duman testi BAŞARILI.");
}

main().catch((err) => {
  console.error("PDF duman testi BAŞARISIZ:", err);
  process.exit(1);
});

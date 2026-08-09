// PDF rapor duman testi — V5 şablonu + sahte proje bilgisiyle raporu
// üç seviyede (detaylı / standart / özet) üretir.
// Çalıştırma: npx tsx scripts/test-pdf.ts [çıktı-dizini]
// Doğrular: dosya %PDF ile başlar, >20KB (detaylı), sayfa sayılarını raporlar.
//
// Rapor ALTERNATİFLİ (seçenekli) bir revizyonla üretilir (madde 23/25): 2.1
// Halat bölümüne üç seçenek konur ki "SEÇENEKLER" bloğu gerçek çıktıda görünsün
// ve yerleşim denetçisi (scripts/check-pdf-layout.py) onu da tarasın.

import fs from "node:fs";
import path from "node:path";
import { V5_TEMPLATE } from "../src/lib/calc/defaults";
import { runCalc } from "../src/lib/calc/engine";
import { REPORT_LEVELS, renderReportPdf, type ReportLevel } from "../src/lib/pdf/report";
import type { RevisionAlts } from "../src/lib/revision-load";

/**
 * Alternatif halat fikstürü. ÜÇ SEÇENEK DE GERÇEK KATALOG SATIRIDIR
 * (supabase/migrations/20260719000005_catalog_seed.sql, kind='rope'); sayı
 * uydurulmamıştır:
 *   1) Ø18 6x36 WS IWRC 1960 MPa — 226 kN, 1,33 kg/m  (V5 şablonunun seçimi → AKTİF)
 *   2) Ø20 6x36 WS IWRC 1960 MPa — 279 kN, 1,64 kg/m
 *   3) Ø16 6x36 WS IWRC 1960 MPa — 179 kN, 1,05 kg/m
 * Alanlar hoistSections 2.1 bölümünün `selectionKeys` listesiyle birebirdir.
 */
const ALTS: RevisionAlts = {
  "main-2.1": {
    active: 0,
    options: [
      {
        ropeBrand: "Hasçelik", ropeDiaMm: 18, ropeConstruction: "6x36",
        ropeCore: "Çelik Öz", ropeWireStrength: 200, ropeBreakingLoadKn: 226,
        ropeWeightKgPerM: 1.33,
      },
      {
        ropeBrand: "İzmit A.Ş.", ropeDiaMm: 20, ropeConstruction: "6x36",
        ropeCore: "Çelik Öz", ropeWireStrength: 200, ropeBreakingLoadKn: 279,
        ropeWeightKgPerM: 1.64,
      },
      {
        ropeBrand: "İzmit A.Ş.", ropeDiaMm: 16, ropeConstruction: "6x36",
        ropeCore: "Çelik Öz", ropeWireStrength: 200, ropeBreakingLoadKn: 179,
        ropeWeightKgPerM: 1.05,
      },
    ],
  },
};

async function main() {
  const outDir = process.argv[2] ?? path.join(process.cwd(), ".test-output");
  fs.mkdirSync(outDir, { recursive: true });

  const input = V5_TEMPLATE;
  const result = runCalc(input);

  const minSizeKb: Record<ReportLevel, number> = { detayli: 20, standart: 20, ozet: 10 };

  for (const level of REPORT_LEVELS) {
    const buffer = await renderReportPdf({
      project: {
        // Doküman no = İŞ KALEMİ NUMARASI; belge kodu ORC-HR-0055-01-R05 olur.
        // Fikstür daha önce "0055-HR-001" idi ve kodda "HR" iki kez çıkıyordu.
        doc_no: "0055-01",
        name: "AMONYUM SÜLFAT VİNCİ",
        customer: "İSDEMİR",
        crane_type: "Çift Kirişli Gezer Köprülü Vinç",
      },
      revision: { rev_no: 5, label: "V5", issued_at: new Date().toISOString() },
      preparedBy: "Sinan Çolakoğlu",
      input,
      result,
      alts: ALTS,
      level,
    });

    const outFile = path.join(outDir, `0055-01-V5-${level}.pdf`);
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

// Satın alma talebi çıktıları duman testi — Excel ve PDF gerçekten üretiliyor mu.
//
//     npx tsx scripts/test-drawings-purchasing.ts
//
// Vitest saf çekirdeği sınar; burada asıl soru RENDERER'ın çalışıp
// çalışmadığıdır: @react-pdf font kaydını dosya sisteminden yapar, exceljs
// tampon üretir ve ikisi de ancak gerçekten çağrıldığında patlar. Ekranda
// "PDF"e basmadan önce bu betiğin geçmesi gerekir.

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBomFileName, parseFile } from "../src/lib/drawings/file-name";
import { parseFolderName } from "../src/lib/drawings/folder-name";
import { readSheet } from "../src/lib/drawings/excel";
import { reconcile } from "../src/lib/drawings/reconcile";
import type { BomRow } from "../src/lib/drawings/types";
import { satinAlmaListesi, type TurevParca } from "../src/lib/drawings/derive";
import { MONORAY, MTC, type FixturePackage } from "../src/lib/drawings/__tests__/fixtures/packages";
import {
  MONORAY_SHEETS,
  MTC_SHEETS,
  type FixtureSheet,
} from "../src/lib/drawings/__tests__/fixtures/bom-sheets";
import { buildPurchasingWorkbook } from "../src/lib/excel/drawing-purchasing";
import { renderPurchasingPdf } from "../src/lib/pdf/drawing-purchasing";
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
  const liste = satinAlmaListesi(sonuc.parts as unknown as TurevParca[]);

  // Her üçüncü kalem sipariş edilmiş, her yedincisi teslim alınmış sayılır:
  // durum sütunu ve tarih biçimi ancak dolu veriyle sınanır.
  const bugun = new Date();
  const satirlar = liste.satirlar.map((s, i) => {
    const gun = new Date(bugun);
    gun.setDate(gun.getDate() + ((i % 4) - 1) * 21);
    return {
      sinif: s.sinif,
      tanim: s.tanim,
      adet: s.adet,
      malzeme: s.malzeme,
      malzemeler: s.malzemeler,
      toplamAgirlikKg: s.toplamAgirlikKg,
      parcaKodu: s.parcaKodu,
      sourceRows: s.sourceRows,
      kaynak: s.kaynak,
      alindi: i % 3 === 0,
      teslim: i % 7 === 0,
      dueAt: i % 3 === 0 ? gun.toISOString().slice(0, 10) : "",
    };
  });

  const paketKodu = [klasor?.itemNo, klasor?.group].filter(Boolean).join("-") || "PAKET";
  const kod = docCode("TR", paketKodu, 1);
  const baslik = `${klasor?.description ?? pkg.folder}${klasor?.capacity ? ` (${klasor.capacity})` : ""}`;
  const meta = {
    paketAdi: baslik,
    belgeKodu: kod,
    klasorAdi: pkg.folder,
    kalemNo: klasor?.itemNo ?? "",
    generatedAt: new Date().toLocaleString("tr-TR"),
    preparedBy: "duman testi",
  };
  const filtre = "süzgeç yok (tüm kalemler)";

  const wb = buildPurchasingWorkbook(satirlar, meta, filtre);
  const xlsx = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  const xlsxYol = join(tmpdir(), `orion-satinalma-${paketKodu}.xlsx`);
  writeFileSync(xlsxYol, xlsx);

  const pdf = await renderPurchasingPdf({
    rows: satirlar.map((s) => ({
      sinif: s.sinif,
      tanim: s.tanim,
      adet: s.adet,
      malzeme: s.malzeme,
      toplamAgirlikKg: s.toplamAgirlikKg,
      parcaKodu: s.parcaKodu,
      dueAt: s.dueAt,
      alindi: s.alindi,
      teslim: s.teslim,
    })),
    meta: {
      packageTitle: baslik,
      folderName: pkg.folder,
      itemNo: klasor?.itemNo ?? "",
      groupCode: klasor?.group ?? "",
      docCode: kod,
      generatedAt: meta.generatedAt,
      preparedBy: meta.preparedBy,
      filterText: filtre,
    },
    company: { company: "Orion Cranes", address: "Başkent OSB 1. Cadde No:20, Ankara" },
  });
  const pdfYol = join(tmpdir(), `orion-satinalma-${paketKodu}.pdf`);
  writeFileSync(pdfYol, pdf);

  console.log(
    `${pkg.folder}\n  ${satirlar.length} kalem · ${liste.siniflar.length} kategori` +
      `\n  xlsx ${(xlsx.length / 1024).toFixed(0)} KB → ${xlsxYol}` +
      `\n  pdf  ${(pdf.length / 1024).toFixed(0)} KB → ${pdfYol}`
  );
}

// Üst düzey `await` yok: tsx bu betikleri CJS'e çeviriyor ve orada
// desteklenmiyor (kardeş duman testleriyle aynı kalıp).
async function main(): Promise<void> {
  await uret(MONORAY, MONORAY_SHEETS);
  await uret(MTC, MTC_SHEETS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

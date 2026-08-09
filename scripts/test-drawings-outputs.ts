// Türev çıktılar duman testi — iki GERÇEK paketin fikstüründen üç çalışma
// kitabını da üretir.
//
//     npx tsx scripts/test-drawings-outputs.ts
//
// Vitest koruma testi sayıları DONDURUR; bu betik dosyaların gerçekten
// yazıldığını ve exceljs katmanının ayakta durduğunu gösterir. Üretilen
// kitaplar `tmp/` altına yazılır, sonra GERİ OKUNUR: yinelenen sayfa adı,
// dondurulmuş başlık ve satır×sütun sayıları ancak yazılmış dosyada
// doğrulanabilir — birim testi bu katmanı göremez.

import ExcelJS from "exceljs";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { parseBomFileName, parseFile } from "../src/lib/drawings/file-name";
import { parseFolderName } from "../src/lib/drawings/folder-name";
import { readSheet } from "../src/lib/drawings/excel";
import { reconcile, type PackageSnapshot } from "../src/lib/drawings/reconcile";
import {
  imalatKokleri,
  imalatListesi,
  kesimListesi,
  sacIhtiyaci,
  satinAlmaListesi,
  testereKesim,
  type KesimDosyasi,
  type TurevParca,
} from "../src/lib/drawings/derive";
import {
  buildImalatWorkbook,
  buildKesimWorkbook,
  buildSatinAlmaWorkbook,
  type DrawingExportMeta,
} from "../src/lib/excel/drawing-outputs";
import { docCode, downloadFileName } from "../src/lib/pdf/doc-naming";
import { MONORAY, MTC, type FixturePackage } from "../src/lib/drawings/__tests__/fixtures/packages";
import {
  MONORAY_SHEETS,
  MTC_SHEETS,
  type FixtureSheet,
} from "../src/lib/drawings/__tests__/fixtures/bom-sheets";

function anlikGoruntu(pkg: FixturePackage, sheets: FixtureSheet[]): PackageSnapshot {
  const files = pkg.files.map((f) => parseFile({ relPath: f.path, size: f.size, checksum: f.hash }));
  const bom = sheets
    .filter((s) => !s.file.split("/").some((seg) => seg === "İPTAL"))
    .flatMap(
      (s) =>
        readSheet(
          { fileRelPath: s.file, sheetName: s.sheet, rows: s.rows },
          parseBomFileName(s.file.split("/").pop() ?? "").kind
        ).rows
    );
  return { folderName: pkg.folder, folder: parseFolderName(pkg.folder).value, files, bom };
}

const m2 = (mm2: number) => (mm2 / 1_000_000).toFixed(3);
const kg = (v: number | null) => (v == null ? "—" : v.toFixed(1));

async function yaz(wb: ExcelJS.Workbook, ad: string): Promise<void> {
  const buf = await wb.xlsx.writeBuffer();
  writeFileSync(`tmp/${ad}`, Buffer.from(buf as ArrayBuffer));

  // GERİ OKU: exceljs yinelenen sayfa adına yazarken değil, kitabı kurarken
  // hata fırlatır; dosyanın açılabildiğini görmek ayrı bir güvencedir.
  const geri = new ExcelJS.Workbook();
  await geri.xlsx.readFile(`tmp/${ad}`);
  const kb = (statSync(`tmp/${ad}`).size / 1024).toFixed(0);
  console.log(`    → tmp/${ad}  (${kb} KB, ${geri.worksheets.length} sayfa)`);
  for (const ws of geri.worksheets) {
    const dondurulmus = (ws.views ?? []).some((v) => v.state === "frozen");
    console.log(
      `        ${ws.name.padEnd(24)} ${String(ws.rowCount).padStart(4)} satır × ` +
        `${String(ws.columnCount).padStart(2)} sütun` +
        (dondurulmus ? " · başlık dondurulmuş" : "")
    );
  }
}

async function bas(pkg: FixturePackage, sheets: FixtureSheet[]): Promise<void> {
  const t0 = Date.now();
  const snap = anlikGoruntu(pkg, sheets);
  const r = reconcile(snap);
  const parts = r.parts as TurevParca[];

  // Dosyaların yaşam döngüsü kararları eşleştirmede alınır; kopya ve süperse
  // edilmiş DXF'ler kesim listesine girmemeli.
  const kararlar = new Map(r.fileDecisions.map((d) => [d.relPath, d.lifecycle]));
  const files: KesimDosyasi[] = snap.files.map((f) => ({
    relPath: f.relPath,
    fileName: f.fileName,
    role: f.role,
    lifecycle: kararlar.get(f.relPath) ?? f.lifecycle,
    partCode: f.partCode,
    material: f.material,
    thicknessMm: f.thicknessMm,
    qty: f.qty,
    size: f.size,
  }));

  console.log("\n" + "=".repeat(78));
  console.log(pkg.folder);
  console.log("=".repeat(78));

  const sa = satinAlmaListesi(parts);
  console.log(
    `SATIN ALMA  ${sa.satirlar.length} satır · ${sa.toplamAdet} adet · ` +
      `kodsuz ${sa.satirlar.filter((s) => !s.parcaKodu).length} · ` +
      `malzemeli ${sa.malzemesiBilinen} · ağırlıklı ${sa.agirligiBilinen} · ` +
      `toplam ${kg(sa.toplamAgirlikKg)} kg`
  );
  console.log("  sınıf: " + sa.siniflar.map((s) => `${s.sinif} ${s.satirSayisi}`).join(" · "));

  const sac = sacIhtiyaci(parts);
  console.log(
    `SAC         ${sac.adaySayisi} aday · ${sac.olculuSayisi} ölçülü · ` +
      `${sac.olcusuzSayisi} ölçüsüz · ${sac.gruplar.length} grup · ` +
      `net ${m2(sac.netAlanMm2)} m² · brüt ${m2(sac.brutAlanMm2)} m² (pay ${sac.yerlesimPayi})`
  );
  const enBuyuk = [...sac.gruplar].sort((a, b) => b.netAlanMm2 - a.netAlanMm2)[0];
  if (enBuyuk) {
    console.log(
      `  en büyük grup: ${enBuyuk.malzeme} ${enBuyuk.kalinlikMm} mm · ` +
        `${enBuyuk.parcaSayisi} parça · ${enBuyuk.adet} adet · net ${m2(enBuyuk.netAlanMm2)} m²`
    );
  }
  for (const g of sac.gruplar.filter((x) => x.olcusuzParca > 0)) {
    console.log(
      `  ölçüsüz: ${g.malzeme} ${g.kalinlikMm} mm → ` +
        g.parcalar.filter((p) => !p.olculu).map((p) => `${p.parcaKodu} "${p.tanim}"`).join(" · ")
    );
  }

  const tst = testereKesim(parts);
  console.log(
    `TESTERE     ${tst.satirlar.length} satır · ${tst.kesitler.length} kesit · ` +
      `toplam ${(tst.toplamBoyMm / 1000).toFixed(2)} m · UYUŞMAZLIK ${tst.uyusmazlik}`
  );
  for (const s of tst.satirlar.filter((x) => x.tutarli === false)) {
    console.log(
      `  · ${s.parcaKodu}  adet ${s.adet} × birim ${s.birimBoyMm} = ${s.beklenenToplamMm} ` +
        `ama defter ${s.toplamBoyMm} diyor  ("${s.tanim}")`
    );
  }

  const kes = kesimListesi(parts, files);
  console.log(
    `KESİM DXF   ${kes.dosyaSayisi} dosya · ${kes.gruplar.length} grup · ` +
      `${(kes.boyutBayt / 1024 / 1024).toFixed(1)} MB · bağsız ${kes.bagsizDosya}`
  );

  const kokler = imalatKokleri(parts, snap.folder?.itemNo ?? "");
  const tumu = imalatListesi(parts);
  const naif = parts.reduce((t, p) => t + (p.weightKg ?? 0) * (p.qty ?? 1), 0);
  console.log(
    `İMALAT      ${kokler.length} kök · ${tumu.satirlar.length} satır · ` +
      `yaprak Σ ${kg(tumu.yaprakAgirlikKg)} kg · kök Σ ${kg(tumu.kokAgirlikKg)} kg · ` +
      `naif Σ ${naif.toFixed(1)} kg (çift sayım)`
  );
  for (const k of kokler.filter((x) => x.baskaKalem || x.kopuk)) {
    console.log(
      `  · ${k.partCode} ${k.baskaKalem ? "[başka kalem]" : ""}${k.kopuk ? "[kopuk dal]" : ""} ` +
        `${k.parcaSayisi} parça`
    );
  }

  const kod = snap.folder?.code || snap.folder?.itemNo || pkg.folder;
  const isAdi =
    [snap.folder?.itemNo, snap.folder?.description || pkg.folder].filter(Boolean).join(" ") +
    (snap.folder?.capacity ? ` (${snap.folder.capacity})` : "");
  const meta: DrawingExportMeta = {
    paketAdi: isAdi,
    belgeKodu: docCode("TR", kod, 1),
    klasorAdi: pkg.folder,
    kalemNo: snap.folder?.itemNo ?? "",
    generatedAt: new Date().toLocaleString("tr-TR"),
    preparedBy: "Duman Testi",
  };

  await yaz(
    buildSatinAlmaWorkbook({ satinAlma: sa, sac, testere: tst }, meta),
    downloadFileName([isAdi, meta.belgeKodu, "Satın Alma Listesi"], "xlsx")
  );
  await yaz(
    buildKesimWorkbook({ kesim: kes }, meta),
    downloadFileName([isAdi, meta.belgeKodu, "Kesim Listesi"], "xlsx")
  );
  await yaz(
    buildImalatWorkbook({ imalat: tumu, kokler }, meta),
    downloadFileName([isAdi, meta.belgeKodu, "İmalat Listesi"], "xlsx")
  );

  // En büyük kökün alt ağacı da üretilir: kök seçiminin gerçekten süzdüğünü
  // ve ağırlığın çift sayılmadığını dosyada görmek gerekir.
  const enKalabalik = [...kokler].sort((a, b) => b.parcaSayisi - a.parcaSayisi)[0];
  if (enKalabalik) {
    const alt = imalatListesi(parts, enKalabalik.partCode);
    console.log(
      `  alt ağaç ${enKalabalik.partCode}: ${alt.satirlar.length} satır · ` +
        `yaprak Σ ${kg(alt.yaprakAgirlikKg)} kg · kök Σ ${kg(alt.kokAgirlikKg)} kg`
    );
    await yaz(
      buildImalatWorkbook({ imalat: alt, kokler }, meta),
      downloadFileName(
        [isAdi, meta.belgeKodu, "İmalat Listesi", enKalabalik.partCode],
        "xlsx"
      )
    );
  }

  console.log(`  süre ${Date.now() - t0} ms`);
}

async function main(): Promise<void> {
  mkdirSync("tmp", { recursive: true });
  await bas(MONORAY, MONORAY_SHEETS);
  await bas(MTC, MTC_SHEETS);
  console.log("");
}

void main();

// Teknik Resimler duman testi — iki gerçek paketin İÇE AKTARIM RAPORUNU basar.
//
//     npx tsx scripts/test-drawings.ts
//
// Vitest koruma testi SAYILARI dondurur; bu betik ise raporun İNSANA nasıl
// göründüğünü gösterir. Ekranı yazmadan önce metnin okunur olup olmadığı,
// bulguların suçlayıcı bir dille yazılıp yazılmadığı burada görülür.

import { parseBomFileName, parseFile } from "../src/lib/drawings/file-name";
import { parseFolderName } from "../src/lib/drawings/folder-name";
import { readSheet } from "../src/lib/drawings/excel";
import { reconcile, type PackageSnapshot } from "../src/lib/drawings/reconcile";
import { MONORAY, MTC, type FixturePackage } from "../src/lib/drawings/__tests__/fixtures/packages";
import {
  MONORAY_SHEETS,
  MTC_SHEETS,
  type FixtureSheet,
} from "../src/lib/drawings/__tests__/fixtures/bom-sheets";
import { FINDING_KIND_LABELS } from "../src/lib/drawings/types";

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

function bas(pkg: FixturePackage, sheets: FixtureSheet[]): void {
  const snap = anlikGoruntu(pkg, sheets);
  const r = reconcile(snap);
  const f = snap.folder;

  console.log("\n" + "=".repeat(78));
  console.log(pkg.folder);
  console.log("=".repeat(78));
  console.log(
    `kalem ${f?.itemNo ?? "—"} · grup ${f?.group ?? "—"} · "${f?.description ?? "—"}"` +
      (f?.capacity ? ` (${f.capacity})` : "")
  );
  const mb = pkg.files.reduce((t, x) => t + x.size, 0) / 1024 / 1024;
  console.log(
    `${pkg.files.length} dosya · ${mb.toFixed(0)} MB · ${snap.bom.length} BOM satırı · ` +
      `${r.parts.length} parça · tanıma %${r.recognition.pct}`
  );

  const kodlu = r.parts.filter((p) => p.partCode);
  const agirlikli = r.parts.filter((p) => p.weightKg != null);
  // Yalnız KÖK düğümler toplanır: montajın ağırlığı çocuklarını zaten içerir,
  // hepsini toplamak vinci üç katı ağır gösterirdi.
  const koklerKg = r.parts
    .filter((p) => p.weightKg != null && !p.parentCode)
    .reduce((t, p) => t + (p.weightKg ?? 0), 0);
  console.log(
    `  kodlu ${kodlu.length} · kodsuz ${r.parts.length - kodlu.length} · ` +
      `montaj ${r.parts.filter((p) => p.kind === "montaj").length} · ` +
      `imalat ${r.parts.filter((p) => p.kind === "imalat").length} · ` +
      `satınalma ${r.parts.filter((p) => p.kind === "satinalma").length}`
  );
  console.log(
    `  ağırlığı bilinen ${agirlikli.length} parça · en ağır ` +
      `${Math.max(0, ...agirlikli.map((p) => p.weightKg ?? 0)).toFixed(1)} kg · ` +
      `kök toplamı ${koklerKg.toFixed(0)} kg`
  );

  const sayac = new Map<string, number>();
  for (const b of r.findings) sayac.set(b.code, (sayac.get(b.code) ?? 0) + 1);

  for (const duzey of ["eksik", "celiski", "bilgi"] as const) {
    const grup = r.findings.filter((b) => b.kind === duzey);
    if (!grup.length) continue;
    console.log(`\n  ${FINDING_KIND_LABELS[duzey].toUpperCase()} (${grup.length})`);
    const gorulen = new Set<string>();
    for (const b of grup) {
      if (gorulen.has(b.code)) continue;
      gorulen.add(b.code);
      const n = sayac.get(b.code) ?? 0;
      console.log(`    ${b.code}${n > 1 ? ` ×${n}` : ""}`);
      console.log(`      ${b.title}`);
      if (b.detail) console.log(`      ${b.detail}`);
    }
  }
}

bas(MONORAY, MONORAY_SHEETS);
bas(MTC, MTC_SHEETS);
console.log("");

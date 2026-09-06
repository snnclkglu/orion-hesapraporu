// Pano yerleştiricisinin GERÇEK bir elektrik projesi üzerinde duman testi.
//
// Fikstür repoda DEĞİLDİR (müşteri belgesi); yol argümandan gelir. Birim
// testleri (`src/lib/switchboard/__tests__`) elle yazılmış küçük kutularla
// koşar; bu betik yerleştiricinin 157 sayfalık gerçek bir EPLAN dışa
// aktarımında NE ÜRETTİĞİNİ gösterir — sayı doğru mu, insan bakar.
//
//   npx tsx scripts/test-switchboard-layout.ts "…/185-40T … rev3.pdf"
//   npx tsx scripts/test-switchboard-layout.ts "…rev3.pdf" --svg output/pano
//
// `--svg` verilirse şemalar dosyaya yazılır; gözle bakmak için (değişmez md. 11
// ekran tarafını `/dev/pano-preview` ile karşılar, bu ise indirilen dosyanın
// KENDİ BAŞINA açıldığını gösterir).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readElectricalPdf } from "@/lib/electrical/read-pdf";
import { computeSwitchboardLayout } from "@/lib/switchboard/compute";
import { auditPanel } from "@/lib/switchboard/audit";
import { diagramsToSvg } from "@/lib/diagrams/svg";
import {
  panoDizilimDiagram,
  panoIcYerlesimDiagram,
  panoKapakDiagram,
} from "@/lib/diagrams/panoLayout";

function mm(v: number): string {
  return `${Math.round(v)}`.padStart(5);
}

async function main() {
  const yol = process.argv[2];
  if (!yol) {
    console.error("Kullanım: npx tsx scripts/test-switchboard-layout.ts <pdf yolu>");
    process.exit(1);
  }

  const bytes = new Uint8Array(readFileSync(yol));
  const okuma = await readElectricalPdf(bytes);
  console.log(`Kaynak: ${okuma.pageCount} sayfa · ${okuma.parts.length} aygıt satırı`);

  const t0 = Date.now();
  const sonuc = computeSwitchboardLayout({ parts: okuma.parts });
  const sure = Date.now() - t0;

  console.log(
    `Yerleştirme ${sure} ms · ortak yükseklik ${sonuc.settings.heightMm} · ortak derinlik ${sonuc.settings.depthMm} · parmak izi ${sonuc.fingerprint}`
  );

  for (const [baslik, dizi] of [
    ["ODA PANOLARI", sonuc.room],
    ["SAHA PANOLARI", sonuc.field],
  ] as const) {
    if (dizi.length === 0) continue;
    const toplamEn = dizi.reduce((t, p) => t + p.widthMm, 0);
    console.log(`\n── ${baslik} — ${dizi.length} göz, toplam en ${toplamEn} mm`);
    for (const p of dizi) {
      const tahmin = p.placements.filter((y) => y.dimSource === "tahmin").length;
      console.log(
        `  ${p.code.padEnd(10)} ${mm(p.widthMm)}x${mm(p.heightMm)}x${mm(p.depthMm)} +${p.baseMm} ` +
          `${p.doorConfig.padEnd(5)} ray=${String(p.rails.length).padStart(2)} ` +
          `parça=${String(p.placements.length).padStart(3)} kapak=${String(p.doorPlacements.length).padStart(2)} ` +
          `gövde=${String(p.bodyDevices.length).padStart(2)} doluluk=%${String(Math.round(p.fillRatio * 100)).padStart(3)} ` +
          `tahmin=${String(tahmin).padStart(3)}`
      );
      for (const u of p.warnings) console.log(`      ! ${u}`);
    }
  }

  if (sonuc.excluded.length) {
    console.log(
      `\nPano sayılmayan konumlar: ${sonuc.excluded.map((e) => `${e.code}(${e.devices})`).join(" ")}`
    );
  }

  const sebepler = new Map<string, number>();
  for (const u of sonuc.unplaced) sebepler.set(u.reason, (sebepler.get(u.reason) ?? 0) + 1);
  console.log(
    `\nYerleşmeyen: ${[...sebepler].map(([k, v]) => `${k}=${v}`).join("  ") || "yok"}`
  );
  console.log(`Ölçüsü doğrulanmamış (tahmin) aygıt: ${sonuc.estimatedCount}`);

  const olcusuz = sonuc.unplaced.filter((u) => u.reason === "olcusuz");
  if (olcusuz.length) {
    console.log("\nÖlçüsü olmayan ilk 12 ürün:");
    for (const u of olcusuz.slice(0, 12)) {
      console.log(
        `  ${u.device.panelCode}-${u.device.label.padEnd(6)} ${u.device.supplier} ${u.device.typeNo} — ${u.device.category}`
      );
    }
  }

  console.log("\n── DENETİM");
  let hataliPano = 0;
  for (const p of [...sonuc.room, ...sonuc.field]) {
    const d = auditPanel(p, sonuc.settings);
    if (!d.ok) {
      hataliPano++;
      console.log(`  ${p.code}:`);
      for (const c of d.checks.filter((x) => !x.ok)) console.log(`    ✗ ${c.label} — ${c.detail}`);
    }
  }
  console.log(hataliPano === 0 ? "  Bütün panolar denetimden geçti." : `  ${hataliPano} panoda hata var.`);

  const svgBayragi = process.argv.indexOf("--svg");
  if (svgBayragi > 0) {
    const dizin = process.argv[svgBayragi + 1] ?? "output/pano";
    mkdirSync(dizin, { recursive: true });

    const dizilim = [
      panoDizilimDiagram({ panels: sonuc.room, baslik: "Elektrik odası pano dizilimi" }),
      ...(sonuc.field.length
        ? [panoDizilimDiagram({ panels: sonuc.field, baslik: "Saha panoları" })]
        : []),
    ];
    writeFileSync(
      join(dizin, "dizilim.svg"),
      diagramsToSvg(dizilim, { baslik: "Pano dizilimi", aciklama: `parmak izi ${sonuc.fingerprint}` }),
      "utf8"
    );

    for (const p of [...sonuc.room, ...sonuc.field]) {
      const kapak = panoKapakDiagram({ panel: p, settings: sonuc.settings });
      const cizimler = [
        panoIcYerlesimDiagram({ panel: p, settings: sonuc.settings }),
        ...(kapak ? [kapak] : []),
      ];
      writeFileSync(
        join(dizin, `${p.code.replace(/[^A-Za-z0-9._-]/g, "_")}.svg`),
        diagramsToSvg(cizimler, { baslik: `${p.code} pano yerleşimi` }),
        "utf8"
      );
    }
    console.log(`
SVG yazıldı: ${dizin} (${1 + sonuc.room.length + sonuc.field.length} dosya)`);
  }

  // DETERMİNİZM: aynı girdi iki kez yerleştirilince aynı plan çıkmalı.
  const ikinci = computeSwitchboardLayout({ parts: okuma.parts });
  const ayni = JSON.stringify(sonuc.room) === JSON.stringify(ikinci.room);
  console.log(`\nDeterminizm: ${ayni ? "aynı plan" : "PLAN DEĞİŞTİ — HATA"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

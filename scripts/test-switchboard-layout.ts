// Pano yerleştiricisinin GERÇEK bir elektrik projesi üzerinde duman testi.
//
// Fikstür repoda DEĞİLDİR (müşteri belgesi); yol argümandan gelir. Birim
// testleri (`src/lib/switchboard/__tests__`) elle yazılmış küçük kutularla
// koşar; bu betik yerleştiricinin 157 sayfalık gerçek bir EPLAN dışa
// aktarımında NE ÜRETTİĞİNİ gösterir — sayı doğru mu, insan bakar.
//
//   npx tsx scripts/test-switchboard-layout.ts "…/185-40T … rev3.pdf"
//   npx tsx scripts/test-switchboard-layout.ts "…rev3.pdf" --svg output/pano
//   npx tsx scripts/test-switchboard-layout.ts "…rev3.pdf" --defter .tmp/device-models.json
//
// `--svg` verilirse şemalar dosyaya yazılır; gözle bakmak için (değişmez md. 11
// ekran tarafını `/dev/pano-preview` ile karşılar, bu ise indirilen dosyanın
// KENDİ BAŞINA açıldığını gösterir).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readElectricalPdf } from "@/lib/electrical/read-pdf";
import { readPartsDump } from "./switchboard-parts-dump";
import { computeSwitchboardLayout } from "@/lib/switchboard/compute";
import type { DeviceModel } from "@/lib/switchboard/types";
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
    console.error(
      "Kullanım: npx tsx scripts/test-switchboard-layout.ts <pdf|parts.json> [--is 0026-01]"
    );
    process.exit(1);
  }

  // İKİ KAYNAK: EPLAN PDF'i ya da `electrical_parts` dökümü.
  //
  // Ölçüldü (08.09.2026): 0026-01'in PDF'i yerelde YOK — yalnız Supabase
  // kovasında. Betik yalnız PDF okuduğu için o iş hiç duman testinden
  // geçirilemiyordu, oysa kullanıcının önceliği tam olarak oydu. Ortak temiz
  // okuyucu (`switchboard-parts-dump.ts`) zaten iki kardeş betikte kullanılıyor.
  const isIdx = process.argv.indexOf("--is");
  const isNo = isIdx > 0 ? process.argv[isIdx + 1] : undefined;

  let parts;
  if (yol.toLowerCase().endsWith(".json")) {
    const dokum = readPartsDump(yol, isNo);
    parts = dokum.parts;
    console.log(
      `Kaynak: ${yol} · ${parts.length} aygıt satırı` +
        (isNo ? ` (${isNo})` : ` · projeler: ${dokum.projects.join(", ")}`) +
        ` · antet temizlenen ${dokum.cleaned} · düşen ${dokum.dropped}`
    );
  } else {
    const bytes = new Uint8Array(readFileSync(yol));
    const okuma = await readElectricalPdf(bytes);
    parts = okuma.parts;
    console.log(`Kaynak: ${okuma.pageCount} sayfa · ${parts.length} aygıt satırı`);
  }

  const t0 = Date.now();
  // ÖLÇÜ DEFTERİ OKUNUR: defter olmadan bütün ölçüler tahmindir ve pano
  // GERÇEĞİNDEN sığ çıkar (ölçüldü: ortak derinlik 150 → 600 mm).
  const defterIdx = process.argv.indexOf("--defter");
  const models: DeviceModel[] = [];
  if (defterIdx > 0) {
    const ham = JSON.parse(readFileSync(process.argv[defterIdx + 1], "utf8")) as Record<
      string,
      unknown
    >[];
    const sayi = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
    for (const r of ham) {
      models.push({
        lookupKey: String(r.lookup_key),
        supplier: String(r.supplier ?? ""),
        typeNo: String(r.type_no ?? ""),
        widthMm: sayi(r.width_mm),
        heightMm: sayi(r.height_mm),
        depthMm: sayi(r.depth_mm),
        moduleUnits: sayi(r.module_units),
        mountType: (r.mount_type ?? null) as DeviceModel["mountType"],
        zone: (r.zone ?? null) as DeviceModel["zone"],
        clearanceTopMm: sayi(r.clearance_top_mm),
        clearanceBottomMm: sayi(r.clearance_bottom_mm),
        heatW: sayi(r.heat_w),
        source: (r.source === "elle" ? "elle" : "katalog") as DeviceModel["source"],
        note: String(r.note ?? ""),
      });
    }
    console.log(`Ölçü defteri: ${models.length} ürün okundu.`);
  }

  const sonuc = computeSwitchboardLayout({ parts, models });
  const sure = Date.now() - t0;

  // HER DİZİ KENDİ ÖLÇÜSÜNÜ BASAR (PANO-2).
  const olcu = (ad: string, d: { heightMm: number | null; depthMm: number | null; panelCount: number }) =>
    d.panelCount > 0 ? `${ad} ${d.heightMm}x${d.depthMm} mm (${d.panelCount} göz)` : "";
  console.log(
    `Yerleştirme ${sure} ms · ` +
      [olcu("oda", sonuc.roomSize), olcu("saha", sonuc.fieldSize)].filter(Boolean).join(" · ") +
      ` · parmak izi ${sonuc.fingerprint}`
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
  const ikinci = computeSwitchboardLayout({ parts, models });
  const ayni = JSON.stringify(sonuc.room) === JSON.stringify(ikinci.room);
  console.log(`\nDeterminizm: ${ayni ? "aynı plan" : "PLAN DEĞİŞTİ — HATA"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

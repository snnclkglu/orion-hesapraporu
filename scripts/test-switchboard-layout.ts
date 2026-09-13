// Pano yerleştiricisinin GERÇEK bir elektrik projesi üzerinde duman testi.
//
// Fikstür repoda DEĞİLDİR (müşteri belgesi); yol argümandan gelir. Birim
// testleri (`src/lib/switchboard/__tests__`) elle yazılmış küçük kutularla
// koşar; bu betik yerleştiricinin 157 sayfalık gerçek bir EPLAN dışa
// aktarımında NE ÜRETTİĞİNİ gösterir — sayı doğru mu, insan bakar.
//
//   npx tsx scripts/test-switchboard-layout.ts "…/185-40T … rev3.pdf"
//   npx tsx scripts/test-switchboard-layout.ts .tmp/electrical-parts-all.json --is 0026-01 --defter .tmp/device-models.json
//   npx tsx scripts/test-switchboard-layout.ts .tmp/pano/0026-01/parts.json --kararlar .tmp/pano/0026-01 --svg out --png
//
// `--kararlar <klasör>`: `switchboard-live-dump.py` çıktısı. Defter, pano
// kilitleri, aygıt sabitlemeleri ve kaydedilmiş ayar oradan okunur — ekranda
// görünen plan yalnız malzeme listesinden değil KARARLARDAN da çıkar ve
// kararsız ölçüm canlıyı yeniden üretmez (Plan F0; ölçüldü: 0026'da
// kararsız 1600 mm iki göz, kararlı 2313 mm taşan tek göz). `--kararsiz`
// aynı klasörün yalnız defterini alır — "kararlar kalkarsa ne olur" sorusu.
//
// `--svg` verilirse şemalar dosyaya yazılır; `--png` onları PNG'ye de çevirir
// (kontrol fazlarının görüntü kanıtı). `/dev/pano-preview` ekran tarafını
// karşılar (değişmez md. 11); bu ise indirilen dosyanın KENDİ BAŞINA
// açıldığını gösterir.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readElectricalPdf } from "@/lib/electrical/read-pdf";
import { readPartsDump } from "./switchboard-parts-dump";
import { computeSwitchboardLayout, type ComputeInput } from "@/lib/switchboard/compute";
import {
  deviceModelFromRow,
  panelOverrideFromRow,
  placementOverrideFromRow,
} from "@/lib/switchboard-data";
import { normalizeSettings } from "@/lib/switchboard/settings";
import { plateCapacityHeightMm, railCapacityMm } from "@/lib/switchboard/sizes";
import type { DeviceModel, LayoutSettings, PanelLayout } from "@/lib/switchboard/types";
import { auditPanel } from "@/lib/switchboard/audit";
import { diagramsToSvg } from "@/lib/diagrams/svg";
import {
  panoDizilimDiagram,
  panoIcYerlesimDiagram,
} from "@/lib/diagrams/panoLayout";

function mm(v: number): string {
  return `${Math.round(v)}`.padStart(5);
}

function argDeger(ad: string): string | undefined {
  const i = process.argv.indexOf(ad);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function jsonOku<T>(yol: string): T {
  return JSON.parse(readFileSync(yol, "utf8")) as T;
}

/**
 * ÖLÜ ALAN — plakanın ray kapasitesi içinde ne cihaz ne kanal olan yüzey [m²].
 *
 * Doluluk (`fillRatio`) yalnız ray boyunca eni sayar; 922 mm'lik bir sürücünün
 * yanında kalan 0,28 m² boşluğu göstermez. Plan F4'ün kabul ölçütü bu sayıdır.
 */
function oluAlanM2(p: PanelLayout, s: LayoutSettings): number {
  const plaka = railCapacityMm(p.widthMm, s) * plateCapacityHeightMm(p.heightMm, s);
  const cihaz = p.placements.reduce((t, y) => t + y.widthMm * y.heightMm, 0);
  const kanal = p.rails.reduce((t, r) => t + r.capacityMm * r.ductMm, 0);
  return Math.max(0, plaka - cihaz - kanal) / 1e6;
}

async function main() {
  const yol = process.argv[2];
  if (!yol) {
    console.error(
      "Kullanım: npx tsx scripts/test-switchboard-layout.ts <pdf|parts.json> [--is 0026-01] [--defter x.json] [--kararlar klasör] [--svg klasör] [--png]"
    );
    process.exit(1);
  }

  // İKİ KAYNAK: EPLAN PDF'i ya da `electrical_parts` dökümü.
  //
  // Ölçüldü (08.09.2026): 0026-01'in PDF'i yerelde YOK — yalnız Supabase
  // kovasında. Betik yalnız PDF okuduğu için o iş hiç duman testinden
  // geçirilemiyordu, oysa kullanıcının önceliği tam olarak oydu. Ortak temiz
  // okuyucu (`switchboard-parts-dump.ts`) zaten iki kardeş betikte kullanılıyor.
  const isNo = argDeger("--is");

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

  // ÖLÇÜ DEFTERİ OKUNUR: defter olmadan bütün ölçüler tahmindir ve pano
  // GERÇEĞİNDEN sığ çıkar (ölçüldü: ortak derinlik 150 → 600 mm).
  const kararKlasoru = argDeger("--kararlar");
  const kararsiz = process.argv.includes("--kararsiz");
  const defterYolu =
    argDeger("--defter") ?? (kararKlasoru ? join(kararKlasoru, "models.json") : undefined);

  const models: DeviceModel[] = defterYolu
    ? jsonOku<Record<string, unknown>[]>(defterYolu).map(deviceModelFromRow)
    : [];
  if (defterYolu) console.log(`Ölçü defteri: ${models.length} ürün okundu (${defterYolu}).`);

  const girdi: ComputeInput = { parts, models };
  if (kararKlasoru && !kararsiz) {
    const oku = <T>(ad: string): T[] => {
      const p = join(kararKlasoru, ad);
      return existsSync(p) ? jsonOku<T[]>(p) : [];
    };
    girdi.panelOverrides = oku<Record<string, unknown>>("panels.json").map(panelOverrideFromRow);
    girdi.placementOverrides = oku<Record<string, unknown>>("placements.json").map(
      placementOverrideFromRow
    );
    const ayar = oku<{ settings?: unknown }>("settings.json")[0]?.settings;
    if (ayar) girdi.settings = normalizeSettings(ayar);
    console.log(
      `Kararlar: ${girdi.panelOverrides.length} pano · ${girdi.placementOverrides.length} aygıt · ayar ${ayar ? "var" : "yok"}` +
        (girdi.panelOverrides.some((p) => p.widthLocked || p.heightLocked || p.depthLocked)
          ? ` · kilitli: ${girdi.panelOverrides
              .filter((p) => p.widthLocked || p.heightLocked || p.depthLocked)
              .map((p) => `${p.code}${p.widthLocked ? ` en ${p.widthMm}` : ""}`)
              .join(", ")}`
          : "") +
        (girdi.placementOverrides.some((p) => p.pinned)
          ? ` · sabit: ${girdi.placementOverrides
              .filter((p) => p.pinned)
              .map((p) => `${p.deviceKey.split("|").pop()}@${p.orderInRail ?? "-"}`)
              .join(", ")}`
          : "")
    );
  } else if (kararKlasoru) {
    console.log("Kararlar OKUNMADI (--kararsiz): yalnız defter.");
  }

  const t0 = Date.now();
  const sonuc = computeSwitchboardLayout(girdi);
  const sure = Date.now() - t0;

  // HER DİZİ KENDİ ÖLÇÜSÜNÜ BASAR (PANO-2).
  const olcu = (ad: string, d: { heightMm: number | null; depthMm: number | null; panelCount: number }) =>
    d.panelCount > 0 ? `${ad} ${d.heightMm}x${d.depthMm} mm (${d.panelCount} göz)` : "";
  console.log(
    `Yerleştirme ${sure} ms · ` +
      [olcu("oda", sonuc.roomSize), olcu("saha", sonuc.fieldSize)].filter(Boolean).join(" · ") +
      ` · parmak izi ${sonuc.fingerprint}`
  );

  const rayDetay = process.argv.includes("--ray") || Boolean(kararKlasoru);
  let toplamOlu = 0;

  for (const [baslik, dizi] of [
    ["ODA PANOLARI", sonuc.room],
    ["SAHA PANOLARI", sonuc.field],
  ] as const) {
    if (dizi.length === 0) continue;
    const toplamEn = dizi.reduce((t, p) => t + p.widthMm, 0);
    console.log(`\n── ${baslik} — ${dizi.length} göz, toplam en ${toplamEn} mm`);
    for (const p of dizi) {
      const tahmin = p.placements.filter((y) => y.dimSource === "tahmin").length;
      // YIĞIN = en alttaki rayın alt kenarı + kenar payı (cep rayları bandın içindedir).
      const yigin = p.rails.reduce((t, r) => Math.max(t, r.yMm + r.heightMm), 0) + sonuc.settings.edgeGapMm;
      const olu = oluAlanM2(p, sonuc.settings);
      toplamOlu += olu;
      console.log(
        `  ${p.code.padEnd(10)} ${mm(p.widthMm)}x${mm(p.heightMm)}x${mm(p.depthMm)} +${p.baseMm} ` +
          `${p.doorConfig.padEnd(5)} ray=${String(p.rails.length).padStart(2)} ` +
          `parça=${String(p.placements.length).padStart(3)} ` +
          `gövde=${String(p.bodyDevices.length).padStart(2)} doluluk=%${String(Math.round(p.fillRatio * 100)).padStart(3)} ` +
          `yığın=${Math.round(yigin)}/${Math.round(plateCapacityHeightMm(p.heightMm, sonuc.settings))} ` +
          `ölü=${olu.toFixed(2)} m² tahmin=${String(tahmin).padStart(3)}`
      );
      if (rayDetay) {
        for (const ray of p.rails) {
          const uzerinde = p.placements
            .filter((y) => y.railIndex === ray.index)
            .sort((a, b) => a.xMm - b.xMm)
            .map((y) => (y.unitCount > 1 ? `${y.label}×${y.unitCount}` : y.label))
            .join(" ");
          console.log(
            `      ray${String(ray.index).padStart(2)} ${ray.kind.padEnd(5)} ${ray.zone.padEnd(7)} ` +
              `y=${String(Math.round(ray.yMm)).padStart(4)} h=${String(Math.round(ray.heightMm)).padStart(4)} ` +
              `kullanım=${String(Math.round(ray.usedMm)).padStart(4)}/${Math.round(ray.capacityMm)} :: ${uzerinde}`
          );
        }
      }
      for (const u of p.warnings) console.log(`      ! ${u}`);
    }
  }
  console.log(`\nÖlü alan toplamı: ${toplamOlu.toFixed(2)} m²`);

  if (sonuc.excluded.length) {
    console.log(
      `Pano sayılmayan konumlar: ${sonuc.excluded.map((e) => `${e.code}(${e.devices})`).join(" ")}`
    );
  }

  const sebepler = new Map<string, number>();
  for (const u of sonuc.unplaced) sebepler.set(u.reason, (sebepler.get(u.reason) ?? 0) + 1);
  console.log(
    `Yerleşmeyen: ${[...sebepler].map(([k, v]) => `${k}=${v}`).join("  ") || "yok"}`
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

  const svgDizin = argDeger("--svg");
  if (svgDizin) {
    mkdirSync(svgDizin, { recursive: true });
    const dosyalar: string[] = [];

    const dizilim = [
      panoDizilimDiagram({
        panels: sonuc.room,
        baslik: "Pano dizilimi",
        // YAN ŞERİT DE ÇİZİLİR: uygulama onu geçiriyor ve betik geçirmezse
        // gözle bakılan dosya ekrandakinden EKSİK olur (PANO-37).
        yanCihazlar: sonuc.roomSideDevices,
      }),
      ...(sonuc.field.length
        ? [
            panoDizilimDiagram({
              panels: sonuc.field,
              baslik: "Saha panoları",
              yanCihazlar: sonuc.fieldSideDevices,
            }),
          ]
        : []),
    ];
    const dizilimYolu = join(svgDizin, "dizilim.svg");
    writeFileSync(
      dizilimYolu,
      diagramsToSvg(dizilim, { baslik: "Pano dizilimi", aciklama: `parmak izi ${sonuc.fingerprint}` }),
      "utf8"
    );
    dosyalar.push(dizilimYolu);

    for (const p of [...sonuc.room, ...sonuc.field]) {
      const cizimler = [panoIcYerlesimDiagram({ panel: p, settings: sonuc.settings })];
      const yolu = join(svgDizin, `${p.code.replace(/[^A-Za-z0-9._-]/g, "_")}.svg`);
      writeFileSync(yolu, diagramsToSvg(cizimler, { baslik: `${p.code} pano yerleşimi` }), "utf8");
      dosyalar.push(yolu);
    }
    console.log(`\nSVG yazıldı: ${svgDizin} (${dosyalar.length} dosya)`);

    // PNG: kontrol fazının görüntü kanıtı. `sharp` uygulamanın zaten
    // bağımlılığıdır; tarayıcı paneli yerel SVG dosyasını ekran görüntüsüne
    // almıyor, PNG'ye bakılıyor.
    if (process.argv.includes("--png")) {
      const sharp = (await import("sharp")).default;
      for (const f of dosyalar) {
        await sharp(readFileSync(f), { density: 150 }).png().toFile(f.replace(/\.svg$/, ".png"));
      }
      console.log(`PNG yazıldı: ${dosyalar.length} dosya`);
    }
  }

  // DETERMİNİZM: aynı girdi iki kez yerleştirilince aynı plan çıkmalı.
  const ikinci = computeSwitchboardLayout(girdi);
  const ayni =
    JSON.stringify(sonuc.room) === JSON.stringify(ikinci.room) &&
    JSON.stringify(sonuc.field) === JSON.stringify(ikinci.field);
  console.log(`\nDeterminizm: ${ayni ? "aynı plan" : "PLAN DEĞİŞTİ — HATA"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// KESİM PLANI PDF'i — duman testi.
//
// Kullanıcı bildirimi (15.08.2026): *"Kesim planı pdf açılmıyor."* Belgeyi
// tarayıcıdan istemek hatayı bir HTTP kodunun arkasına saklar; burada belge
// GERÇEKTEN üretilir ve yığın izi ekrana düşer.
//
//   npx tsx scripts/test-nesting-plan.ts

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderKesimPlaniPdf, type KesimPlaniGrubu } from "../src/lib/pdf/nesting-plan";
import {
  sacYerlesimi,
  yerlesimDenetimi,
  type YerlesimParcasi,
} from "../src/lib/purchasing/hammadde/nesting";

const parcalar: YerlesimParcasi[] = [
  { id: "p1", ad: "ANA KİRİŞ ALT SAC 15x600x11800", enMm: 600, boyMm: 11800, adet: 2 },
  { id: "p2", ad: "PERDE 15x480x520", enMm: 480, boyMm: 520, adet: 14 },
  { id: "p3", ad: "KULAK 15x180x240", enMm: 180, boyMm: 240, adet: 8 },
  { id: "p4", ad: "TAKVİYE 15x90x1400", enMm: 90, boyMm: 1400, adet: 6 },
];

const sonuc = sacYerlesimi(
  parcalar,
  { enMm: 2000, boyMm: 12000 },
  { payMm: 5, dondur: true, kalinlikMm: 15 }
);

const gruplar: KesimPlaniGrubu[] = [
  {
    tanim: "SAC 15 MM S355JR",
    kalite: "S355JR",
    kalinlikMm: 15,
    sonuc,
    denetim: yerlesimDenetimi(parcalar, sonuc),
    olcusuzParca: 1,
  },
];

async function main() {
  console.log(
    `Yerleşim: ${sonuc.plakalar.length} plaka · doluluk %${sonuc.dolulukYuzde.toFixed(1)} · ` +
      `sığmayan ${sonuc.sigmayanlar.length}`
  );

  const pdf = await renderKesimPlaniPdf({
    gruplar,
    meta: {
      docCode: "ORC-KP-2026-08-15",
      generatedAt: "15.08.2026",
      preparedBy: "SİNAN ÇOLAKOĞLU",
      scopeText: "1 sac kalemi · pay 5 mm · 2000×12000 mm plaka · döndürme serbest",
    },
    company: {
      company: "ORION CRANES",
      address: "İkitelli OSB, İstanbul",
      phone: "+90 212 000 00 00",
      email: "info@orioncranes.com",
      web: "orioncranes.com",
    },
  });

  const yol = join(process.cwd(), ".test-output", "kesim-plani.pdf");
  writeFileSync(yol, pdf);
  console.log(`PDF üretildi: ${yol} (${(pdf.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error("PDF ÜRETİLEMEDİ:", e);
  process.exit(1);
});

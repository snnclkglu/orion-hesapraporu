// KESİM PLANI PDF'i — duman testi.
//
// Kullanıcı bildirimi (15.08.2026): *"Kesim planı pdf açılmıyor."* Belgeyi
// tarayıcıdan istemek hatayı bir HTTP kodunun arkasına saklar; burada belge
// GERÇEKTEN üretilir ve yığın izi ekrana düşer.
//
// İKİNCİ BİLDİRİM (aynı gün): *"yerleşim ve antet doğru değil."* Fikstür bu
// yüzden ÇOK SAYFALI ve ÇOK GRUPLUdur — antetin her yaprakta tekrar ettiği,
// sayfa numarasının doğru saydığı ve çizimin sayfayı taşırmadığı ancak birden
// çok yaprakta görünür. KARE PLAKA da bilerek vardır: 12 m'lik bir plakada
// yükseklik hiç sorun olmaz, asıl tuzak neredeyse kare olan plakadadır.
//
//   npx tsx scripts/test-nesting-plan.ts
//
// Belge `.test-output/kesim-plani.pdf`e yazılır ve sayfa sayısı ölçülür.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderKesimPlaniPdf, type KesimPlaniGrubu } from "../src/lib/pdf/nesting-plan";
import {
  sacYerlesimi,
  yerlesimDenetimi,
  type YerlesimParcasi,
} from "../src/lib/purchasing/hammadde/nesting";

/** Uzun plaka — 12 m; çizim yatay bir şerit olur ve bir yaprağa ikisi sığar. */
const UZUN: YerlesimParcasi[] = [
  { id: "p1", ad: "ANA KİRİŞ ALT SAC 15x600x11800", enMm: 600, boyMm: 11800, adet: 2 },
  { id: "p2", ad: "PERDE 15x480x520", enMm: 480, boyMm: 520, adet: 14 },
  { id: "p3", ad: "KULAK 15x180x240", enMm: 180, boyMm: 240, adet: 8 },
  { id: "p4", ad: "TAKVİYE 15x90x1400", enMm: 90, boyMm: 1400, adet: 6 },
  { id: "p5", ad: "BAYRAK 15x120x300", enMm: 120, boyMm: 300, adet: 22 },
];

/** NEREDEYSE KARE PLAKA — eski sürümde çizim sayfayı taşırıyordu. */
const KARE: YerlesimParcasi[] = [
  { id: "k1", ad: "KAPAK 20x900x1200", enMm: 900, boyMm: 1200, adet: 3 },
  { id: "k2", ad: "TABLA 20x600x700", enMm: 600, boyMm: 700, adet: 4 },
  { id: "k3", ad: "KÖŞE 20x250x250", enMm: 250, boyMm: 250, adet: 9 },
];

function grup(
  tanim: string,
  kalite: string,
  kalinlik: number,
  parcalar: YerlesimParcasi[],
  plaka: { enMm: number; boyMm: number }
): KesimPlaniGrubu {
  const sonuc = sacYerlesimi(parcalar, plaka, {
    payMm: 5,
    dondur: true,
    kalinlikMm: kalinlik,
  });
  return {
    tanim,
    kalite,
    kalinlikMm: kalinlik,
    sonuc,
    denetim: yerlesimDenetimi(parcalar, sonuc),
    olcusuzParca: 0,
  };
}

async function main() {
  const gruplar: KesimPlaniGrubu[] = [
    grup("SAC 15 MM S235JR", "S235JR", 15, UZUN, { enMm: 2000, boyMm: 12000 }),
    grup("SAC 20 MM S355JR", "S355JR", 20, KARE, { enMm: 2000, boyMm: 3000 }),
  ];

  for (const g of gruplar) {
    console.log(
      `${g.tanim}: ${g.sonuc.plakalar.length} plaka · ` +
        `${g.sonuc.plaka.enMm}×${g.sonuc.plaka.boyMm} mm · ` +
        `doluluk %${g.sonuc.dolulukYuzde.toFixed(1)} · sığmayan ${g.sonuc.sigmayanlar.length}`
    );
  }

  const pdf = await renderKesimPlaniPdf({
    gruplar,
    meta: {
      docCode: "ORC-KP-2026-08-15",
      generatedAt: "15.08.2026",
      preparedBy: "SİNAN ÇOLAKOĞLU",
      scopeText: "2 sac kalemi · pay 5 mm · otomatik plaka · döndürme serbest",
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

  // SAYFA SAYISI ÖLÇÜLÜR, VARSAYILMAZ: antetin her yaprakta tekrar ettiğini
  // ancak birden çok yaprak varken doğrulayabiliriz.
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  console.log(`PDF üretildi: ${yol} (${(pdf.length / 1024).toFixed(0)} KB · ${doc.numPages} sayfa)`);

  // Her yaprakta doküman kodu geçmeli — antet sabit mi?
  let kodlu = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const sayfa = await doc.getPage(p);
    const metin = (await sayfa.getTextContent()).items
      .map((i) => ("str" in i ? i.str : ""))
      .join(" ");
    if (metin.includes("ORC-KP-2026-08-15")) kodlu += 1;
  }
  console.log(`Antet: ${kodlu}/${doc.numPages} yaprakta doküman kodu var.`);
  if (kodlu !== doc.numPages) {
    console.error("HATA: antet bütün yapraklarda tekrar etmiyor.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("PDF ÜRETİLEMEDİ:", e);
  process.exit(1);
});

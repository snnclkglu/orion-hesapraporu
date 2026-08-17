// MALİYET ÇALIŞMASI PDF DUMAN TESTİ.
// Çalıştırma: npx tsx scripts/test-offer-cost-pdf.ts [çıktı-dizini]
//
// FİKSTÜR GERÇEKTİR: devralınan "ÖRNEK ASTOR 32T × 30 m Portal Vinç Teklif
// Maliyet Çalışması V3" çalışma kitabının girdileri ve birim fiyatları. Model
// o kitabın sayılarını üretmek zorundadır; betik hem PDF'i basar hem METNİ
// GERİ OKUR ve şu üç şeyi ölçer:
//
//   1. AĞIRLIK VE MALİYET SAYILARI belgede gerçekten var (51.000 kg çelik,
//      194.258 € proje maliyeti, 231.167 € toplam).
//   2. HER SAYFADA "İÇ BELGE" damgası var. Bu belgenin müşteriye gitmesi bu
//      bölümde olabilecek en pahalı hatadır; damganın bir sayfada düşmesi
//      bileşen ağacına bakarak GÖRÜLMEZ.
//   3. Dosya adı "İÇ BELGE" ile bitiyor — e-posta ekinde ilk okunacak yerde.
//
// Teklif PDF'inin duman testiyle aynı düzendedir (`test-offer-pdf.ts`).

import fs from "node:fs";
import path from "node:path";
import { renderOfferCostPdf, type OfferCostDocumentProps } from "../src/lib/pdf/offer-cost";
import { offerCostFileName } from "../src/lib/pdf/doc-naming";
import { emptyPayload, groupFromKey, newOfferId, withDefaults } from "../src/lib/offers/payload";
import { withTotal } from "../src/lib/offers/pricing";
import {
  costItemFromOfferItem,
  costModels,
  costWeights,
  emptyCostPayload,
  withDefaultRates,
  withModelQuantities,
} from "../src/lib/offers/cost/payload";
import { costTotals, withCostTotals } from "../src/lib/offers/cost/totals";
import { fmtMoney } from "../src/lib/currency";
import type { OfferItem, OfferPayload } from "../src/lib/offers/types";
import type { CostPayload } from "../src/lib/offers/cost/types";

const outDir = process.argv[2] ?? path.join(process.cwd(), ".test-output");
fs.mkdirSync(outDir, { recursive: true });

// ————————————————————————————————————————————————————————— fikstür

/** ASTOR 32T × 30 m tam portal — teklif kalemi (girdilerin kaynağı). */
function astorKalemi(): OfferItem {
  const item: OfferItem = {
    id: newOfferId(),
    title: "32T x 30m ÇİFT KİRİŞ TAM PORTAL VİNÇ",
    craneType: "Portal Vinç",
    capacityT: 32,
    spanM: 30,
    groups: ["general", "mainHoist", "trolley", "gantry", "steel", "electrical"].map((k) =>
      groupFromKey(k)
    ),
  };
  const parca = (g: string, r: string, parts: Record<string, string>) => {
    const row = item.groups.find((x) => x.key === g)?.rows.find((x) => x.key === r);
    if (row) row.parts = { ...row.parts, ...parts };
  };
  const deger = (g: string, r: string, v: string) => {
    const row = item.groups.find((x) => x.key === g)?.rows.find((x) => x.key === r);
    if (row) row.value = v;
  };
  parca("general", "capacity", { main: "32" });
  parca("general", "span", { value: "30" });
  parca("general", "liftHeight", { value: "12" });
  parca("general", "gantryLegHeight", { value: "12" });
  deger("general", "craneClass", "FEM 3m / M6");
  deger("general", "craneType", "Portal Vinç");
  parca("mainHoist", "liftSpeed", { range: "4" });
  parca("mainHoist", "motor", { brand: "GAMAK", power: "30", rpm: "1500" });
  parca("mainHoist", "gearbox", { brand: "YILMAZ" });
  parca("trolley", "travelSpeed", { range: "20" });
  parca("trolley", "motor", { count: "2", brand: "GAMAK", power: "1,5" });
  parca("gantry", "travelSpeed", { range: "20" });
  parca("gantry", "motor", { count: "4", brand: "GAMAK", power: "1,5" });
  parca("gantry", "wheel", { count: "8", dia: "400" });
  deger("electrical", "panel", "EAE / TEMPA, kiriş üzerinde");
  return item;
}

function astorTeklifi(item: OfferItem): OfferPayload {
  const p = emptyPayload("EUR");
  p.items = [item];
  p.pricing.lines = [
    {
      id: newOfferId(),
      itemId: item.id,
      description: "32T x 30m Çift Kiriş Tam Portal Vinç",
      qty: 1,
      unit: "Takım",
      // Devralınan çalışmada satış fiyatı yok; maliyetin üstüne %25 marj
      // konarak yazıldı (231.167 / 0,75). Amaç KÂR SATIRININ basıldığını
      // ölçmek, bir fiyat önermek değil.
      unitPrice: 308_222,
      inTotal: true,
    },
  ];
  p.pricing = withTotal(p.pricing);
  // `withDefaults`TAN GEÇİRİLİR: satır değerleri parçalardan orada DERLENİR
  // (`Motor : GAMAK 30 kW 1500 d/dak`). Gerçek uygulamada payload her okumada
  // bu yoldan geçer; fikstürün atlaması, "teklifteki karşılığı" notunun boş
  // çıkmasına ve testin gerçek davranışı ölçememesine yol açardı.
  return withDefaults(p, "EUR");
}

/** Devralınan çalışmanın birim fiyatları — ELLE girilir, tablodan aranmaz. */
const BIRIM_FIYATLAR: Record<string, Record<string, number>> = {
  steel: { rawMaterial: 0.7, fabrication: 1.25, laserCut: 0.05, paint: 0.15 },
  hoist: {
    motor: 2457, gearbox: 6300, brake: 1256, drum: 2970.24, machining: 3470,
    hookBlock: 2760, bearings: 940, rope: 940, encoder: 337.5, loadpin: 337.5,
    drumLimit: 262.5, weightLimit: 150,
  },
  travel: {
    coupling: 2700, bridgeMotor: 161.4, bridgeGearbox: 792, trolleyMotor: 161.4,
    trolleyGearbox: 576, bridgeWheels: 297, trolleyWheels: 209, buffers: 12.5,
  },
  electrical: {
    hoistDrive: 2300, bridgeDrive: 358, trolleyDrive: 358, panels: 3800,
    brakeResistors: 1800, isolationTrafo: 600, powerSupply: 400,
    electricalLabour: 5800, switchgear: 5000, cables: 4800, cableTray: 1200,
    travelLimits: 400, remote: 500,
  },
  assembly: {
    mechanicalAssembly: 2190, siteAssembly: 2325, shipping: 3423,
    mobileCrane: 5963, fasteners: 10.8,
  },
};

function astorMaliyeti(offer: OfferPayload): CostPayload {
  let p = withDefaultRates(emptyCostPayload("EUR"));
  p.items = [costItemFromOfferItem(offer.items[0], 1)];
  p.sourceRevNo = 0;

  for (const g of p.items[0].groups) {
    const fiyatlar = BIRIM_FIYATLAR[g.key] ?? {};
    for (const l of g.lines) {
      const f = fiyatlar[l.key];
      if (f !== undefined) l.unitPrice = f;
    }
  }
  // Fren adedi defterde BOŞ başlar (bilerek — "çoğunlukla iki" bir sayı
  // değildir); duman testinde iki fren fiyatlanır.
  const kaldirma = p.items[0].groups.find((g) => g.key === "hoist");
  const fren = kaldirma?.lines.find((l) => l.key === "brake");
  if (fren) {
    fren.qty = 2;
    fren.qtyManual = true;
  }
  // FREN SENSÖR PAKETİ SERBEST SATIRDIR. Devralınan çalışmada fren maliyeti
  // "2 adet ELDRO + sensör paketi" olarak TEK hücrede toplanmıştı; defter
  // ikisini ayırır çünkü sensör ayrı bir tedarikçiden gelir ve adedi frenle
  // birlikte değişmez. Serbest satır yolu da böylece sınanmış olur.
  if (kaldirma) {
    kaldirma.lines.push({
      id: newOfferId(),
      key: `serbest-${newOfferId().slice(0, 8)}`,
      label: "Fren Aşınma / Konum Sensör Paketi",
      qty: 1,
      unit: "takım",
      unitPrice: 300,
    });
  }
  // Tampon adedi de elledir (8 adet kauçuk tampon).
  const tampon = p.items[0].groups.find((g) => g.key === "travel")?.lines.find((l) => l.key === "buffers");
  if (tampon) {
    tampon.qty = 8;
    tampon.qtyManual = true;
  }

  p.general.lines = p.general.lines.map((l) =>
    l.key === "documentation" ? { ...l, unitPrice: 0 } : l
  );

  p = withModelQuantities(p);
  return withCostTotals(p, costWeights(costModels(p)));
}

// ————————————————————————————————————————————————————————— yardımcılar

function duz(s: string): string {
  return s.replace(/\s+/g, "");
}

async function sayfaMetinleri(buf: Buffer): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(doc, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

let hata = 0;

function kontrol(kosul: boolean, aciklama: string) {
  console.log(`   ${kosul ? "✓" : "✗"} ${aciklama}`);
  if (!kosul) hata += 1;
}

async function main() {
  const kalem = astorKalemi();
  const teklif = astorTeklifi(kalem);
  const maliyet = astorMaliyeti(teklif);
  const totals = costTotals(maliyet, costWeights(costModels(maliyet)));

  const props: OfferCostDocumentProps = {
    offer: {
      offerNo: "TETR-20260817-1",
      subject: "ASTOR 32T x 30m PORTAL VİNÇ",
      customerName: "ASTOR ENERJİ A.Ş.",
      currency: "EUR",
      offerRevNo: 0,
    },
    costRevNo: 1,
    payload: maliyet,
    offerPayload: teklif,
    company: { company: "ORION CRANES" },
    meta: { generatedAt: "17.08.2026" },
  };

  const t0 = Date.now();
  const buf = await renderOfferCostPdf(props);
  const dosyaAdi = offerCostFileName(props.offer.subject, props.offer.offerNo, props.costRevNo);
  fs.writeFileSync(path.join(outDir, "maliyet-astor.pdf"), buf);

  const sayfalar = await sayfaMetinleri(buf);
  const metin = sayfalar.join(" ");
  console.log(
    `\nmaliyet-astor.pdf  ${sayfalar.length} sayfa · ${(buf.length / 1024).toFixed(0)} KB · ` +
      `${Date.now() - t0} ms\n   → ${dosyaAdi}`
  );

  kontrol(buf.subarray(0, 4).toString() === "%PDF", "geçerli PDF başlığı");

  // 1 — MODELİN SAYILARI BELGEDE
  console.log("\n  model → belge");
  kontrol(duz(metin).includes("51.000"), "çelik ağırlığı 51.000 kg basıldı");
  kontrol(duz(metin).includes("59.500"), "toplam vinç ağırlığı 59.500 kg basıldı");
  kontrol(duz(metin).includes("27.850"), "ana kiriş 27.850 kg basıldı");
  kontrol(duz(metin).includes("750x1900x750t10"), "seçilen kiriş kesiti basıldı");
  kontrol(metin.includes("KURULU GÜÇ"), "kurulu güç satırı var");

  // 2 — DÖRT ANA BAŞLIK VE TOPLAM
  console.log("\n  dört ana başlık");
  const proje = totals.direct ?? 0;
  kontrol(Math.abs(proje - 194_257.74) < 1, `proje maliyeti devralınan çalışmayla tuttu (${proje.toFixed(2)} €)`);
  kontrol(
    Math.abs((totals.total ?? 0) - proje * 1.19) < 0.01,
    "toplam maliyet = proje × 1,19 (oran tabanı PROJE MALİYETİ)"
  );
  for (const baslik of ["PROJE MALİYETİ", "SABİT MALİYETLER", "SARF MALİYETLER", "FİNANSMAN MALİYETLERİ", "TOPLAM MALİYET"]) {
    kontrol(metin.includes(baslik), `"${baslik}" başlığı belgede`);
  }
  kontrol(duz(metin).includes(duz(fmtMoney(totals.total, "EUR"))), "toplam maliyet tutarı basıldı");

  // 3 — KÂR
  console.log("\n  kâr");
  kontrol(metin.includes("KÂR"), "kâr satırı var");
  kontrol(duz(metin).includes(duz("TEKLİF VE KÂR")), "teklif–maliyet karşılaştırma kutusu var");
  kontrol(duz(metin).includes(duz("Teklif Tutarı")), "teklif tutarı satırı var");

  // 4 — İÇ BELGE DAMGASI HER SAYFADA
  console.log("\n  iç belge koruması");
  const damgasiz = sayfalar.findIndex((s) => !duz(s).includes(duz("İÇ BELGE")));
  kontrol(damgasiz === -1, `İÇ BELGE damgası ${sayfalar.length} sayfanın hepsinde`);
  kontrol(dosyaAdi.includes("İÇ BELGE"), `dosya adı İÇ BELGE taşıyor (${dosyaAdi})`);
  kontrol(dosyaAdi.includes("MALİYET M1"), "dosya adı maliyet revizyonunu taşıyor");

  // 5 — TEKLİFLE BAĞ
  console.log("\n  teklifle bağ");
  kontrol(metin.includes("GAMAK"), "satırın teklifteki karşılığı (motor markası) basıldı");
  kontrol(metin.includes("ANA KALEM KIRILIMI"), "kırılım tablosu var");
  kontrol(metin.includes("MODEL KATSAYILARI"), "katsayılar belgede kayıtlı");

  console.log(hata === 0 ? "\nTÜM KONTROLLER GEÇTİ" : `\n${hata} KONTROL DÜŞTÜ`);
  if (hata > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

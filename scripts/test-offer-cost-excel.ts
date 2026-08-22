// MALİYET ÇALIŞMASI EXCEL DUMAN TESTİ.
// Çalıştırma: npx tsx scripts/test-offer-cost-excel.ts [çıktı-dizini]
//
// FİKSTÜR GERÇEKTİR: PDF duman testinin (`test-offer-cost-pdf.ts`) kullandığı
// devralınan "ÖRNEK ASTOR 32T × 30 m Portal Vinç Teklif Maliyet Çalışması V3"
// girdileri ve birim fiyatları. İki belgenin AYNI sayıları göstermesi
// gerektiği için fikstür de aynıdır — Excel'in kendi küçük fikstürü olsaydı
// ayrışma ancak müşteriye gitmiş bir teklifte fark edilirdi.
//
// "ÜRETİLDİ VE BOZULMADI" YETMEZ. Betik dosyayı üretir, DİSKTEN GERİ OKUR ve
// hücre hücre savlar:
//
//   1. Sayfa adları ve başlık satırları yerinde.
//   2. Toplamlar ÇEKİRDEĞİN verdiği sayının BİREBİR aynısı (`costTotals` /
//      `costOverview`) — Excel kendi aritmetiğini kurmamış.
//   3. Hücreler SAYI, metin değil: `typeof === "number"` ve para biçimi
//      hücrenin kendisinde. Metin yazılsaydı kullanıcı toplayamaz, pivot
//      kuramazdı ve Excel istemenin tek sebebi ortadan kalkardı.
//   4. BOŞ ≠ SIFIR: fiyatı beklenen satırın tutarı BOŞ, sıfır DEĞİL.
//   5. İÇ BELGE işareti HER sayfanın künyesinde ve dosya adında (MALIYET-12).

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { buildOfferCostWorkbook } from "../src/lib/xlsx/offer-cost";
import { offerCostFileName } from "../src/lib/pdf/doc-naming";
import { emptyPayload, groupFromKey, newOfferId, withDefaults } from "../src/lib/offers/payload";
import { withTotal } from "../src/lib/offers/pricing";
import {
  costItemFromOfferItem,
  costModels,
  costSteelWeights,
  costWeights,
  emptyCostPayload,
  printedCostPayload,
  withCostDerived,
  withDefaultRates,
} from "../src/lib/offers/cost/payload";
import { costBreakdown, costOverview, costTotals } from "../src/lib/offers/cost/totals";
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

/** Teklifin ELLE MALİYETİ — özetin `manualLines` bloğunu sınayan tek satır. */
const ELLE_MALIYET = 2500;

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
      unitPrice: 308_222,
      inTotal: true,
    },
    // SERBEST SATIR (kaleme bağlı DEĞİL): maliyeti maliyet belgesinde yoktur,
    // elle yazılır ve `costOverview` onu toplama katar (MALIYET-11). Kaleme
    // bağlı bir satıra yazılsaydı okunmazdı — iki kaynak asla toplanmaz.
    {
      id: newOfferId(),
      // SERBEST SATIRIN KALEM BAĞI YOKTUR — alan zorunludur ve `null` yazılır;
      // eksik bırakmak, satırın bir kaleme bağlı sayılması demekti.
      itemId: null,
      description: "Saha montaj ekibi konaklama",
      qty: 1,
      unit: "Takım",
      unitPrice: 4_000,
      inTotal: true,
      manualCost: ELLE_MALIYET,
    },
  ];
  p.pricing = withTotal(p.pricing);
  return withDefaults(p, "EUR");
}

/** Devralınan çalışmanın birim fiyatları — ELLE girilir, tablodan aranmaz. */
const BIRIM_FIYATLAR: Record<string, Record<string, number>> = {
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

const HAMMADDE_FIYATLARI: Record<string, number | null> = {
  sac: 0.7,
  celikIsciligi: 1.25,
  kesim: 0.05,
  boya: 0.15,
};

/** FİYATI BEKLENEN SATIR — "boş ≠ sıfır" savının ölçüldüğü yer. */
const BEKLEYEN_SATIR = "MONTAJ İSKELESİ (TEKLİF BEKLENİYOR)";

function astorMaliyeti(offer: OfferPayload): CostPayload {
  const p = withDefaultRates(emptyCostPayload("EUR"));
  p.items = [costItemFromOfferItem(offer.items[0], 1)];
  p.sourceRevNo = 0;
  p.materialPrices = { ...HAMMADDE_FIYATLARI };

  for (const g of p.items[0].groups) {
    const fiyatlar = BIRIM_FIYATLAR[g.key] ?? {};
    for (const l of g.lines) {
      const f = fiyatlar[l.key];
      if (f !== undefined) l.unitPrice = f;
    }
  }
  const kaldirma = p.items[0].groups.find((g) => g.key === "hoist");
  const fren = kaldirma?.lines.find((l) => l.key === "brake");
  if (fren) {
    fren.qty = 2;
    fren.qtyManual = true;
  }
  // FREN SENSÖR PAKETİ SERBEST SATIRDIR ve fikstürde DURMAK ZORUNDADIR:
  // devralınan çalışmada fren maliyeti "2 adet ELDRO + sensör paketi" olarak
  // tek hücrede toplanmıştı, defter ikisini ayırır (sensör ayrı tedarikçiden
  // gelir). Çıkarılsaydı bu betiğin çapası PDF duman testininkinden 300 €
  // ayrılır ve iki İÇ BELGE birbirini yalanlardı.
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
  const tampon = p.items[0].groups
    .find((g) => g.key === "travel")
    ?.lines.find((l) => l.key === "buffers");
  if (tampon) {
    tampon.qty = 8;
    tampon.qtyManual = true;
  }

  p.general.lines = p.general.lines.map((l) =>
    l.key === "documentation" ? { ...l, unitPrice: 0 } : l
  );
  // MİKTARI OLAN AMA FİYATI HENÜZ OLMAYAN SATIR. Tedarikçi teklifi beklenirken
  // satır belgede durur, toplama girmez ve tutarı BOŞ basılır — sıfır yazmak
  // iskeleyi bedava göstermenin en kısa yoluydu (değişmez md. 4).
  p.general.lines.push({
    id: newOfferId(),
    key: `serbest-${newOfferId().slice(0, 8)}`,
    label: BEKLEYEN_SATIR,
    qty: 1,
    unit: "takım",
    unitPrice: null,
  });

  return withCostDerived(p);
}

// ————————————————————————————————————————————————————————— yardımcılar

let hata = 0;

function kontrol(kosul: boolean, aciklama: string) {
  console.log(`   ${kosul ? "✓" : "✗"} ${aciklama}`);
  if (!kosul) hata += 1;
}

/** Hücrenin ham değeri — okunan dosyadan, biçimlenmemiş hâliyle. */
function hucre(ws: ExcelJS.Worksheet, satir: number, sutun: number): ExcelJS.CellValue {
  return ws.getRow(satir).getCell(sutun).value;
}

/** İlk sütununda verilen metni taşıyan satırın numarası; yoksa 0. */
function satirBul(ws: ExcelJS.Worksheet, metin: string, sutun = 1): number {
  let bulunan = 0;
  ws.eachRow((row, no) => {
    if (bulunan) return;
    if (String(row.getCell(sutun).value ?? "") === metin) bulunan = no;
  });
  return bulunan;
}

/** Aynı başlık birden fazla blokta kullanılıyorsa son eşleşmeyi döndürür. */
function satirBulSon(ws: ExcelJS.Worksheet, metin: string, sutun = 1): number {
  let bulunan = 0;
  ws.eachRow((row, no) => {
    if (String(row.getCell(sutun).value ?? "") === metin) bulunan = no;
  });
  return bulunan;
}

/** Etiketi verilen satırın SAYI hücresi — sayı değilse `null`. */
function sayi(ws: ExcelJS.Worksheet, etiket: string, sutun: number): number | null {
  const r = satirBul(ws, etiket);
  if (!r) return null;
  const v = hucre(ws, r, sutun);
  return typeof v === "number" ? v : null;
}

function yakin(a: number | null, b: number | null, tolerans = 0.005): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) < tolerans;
}

// ————————————————————————————————————————————————————————— koşum

async function main() {
  const kalem = astorKalemi();
  const teklif = astorTeklifi(kalem);
  const maliyet = astorMaliyeti(teklif);

  // ÇEKİRDEĞİN VERDİĞİ SAYILAR — dosyadan okunanlar bunlara tutturulur.
  const basilan = printedCostPayload(maliyet);
  const models = costModels(maliyet);
  const totals = costTotals(basilan, costWeights(models));
  const ozet = costOverview(totals, teklif, costSteelWeights(models), basilan);
  const kirilim = costBreakdown(basilan, totals);

  const t0 = Date.now();
  const wb = buildOfferCostWorkbook({
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
    meta: { generatedAt: "19.08.2026" },
  });

  const dosyaAdi = offerCostFileName("ASTOR 32T x 30m PORTAL VİNÇ", "TETR-20260817-1", 1).replace(
    /\.pdf$/,
    ".xlsx"
  );
  const yol = path.join(outDir, "maliyet-astor.xlsx");
  await wb.xlsx.writeFile(yol);

  // GERİ OKUMA: savlar bellekteki nesneye değil DİSKTEKİ DOSYAYA sorulur.
  // Bellekteki kitabı sorgulamak, yazma yolunda bozulan bir şeyi göremezdi.
  const okunan = new ExcelJS.Workbook();
  await okunan.xlsx.readFile(yol);

  const boyut = fs.statSync(yol).size;
  console.log(
    `\nmaliyet-astor.xlsx  ${okunan.worksheets.length} sayfa · ${(boyut / 1024).toFixed(0)} KB · ` +
      `${Date.now() - t0} ms\n   → ${dosyaAdi}`
  );

  // 1 — SAYFALAR
  console.log("\n  sayfalar");
  const adlar = okunan.worksheets.map((w) => w.name);
  console.log(`      ${adlar.join(" | ")}`);
  kontrol(adlar[0] === "Özet", "ilk sayfa Özet");
  kontrol(adlar.includes("Ana Kalem Kırılımı"), "Ana Kalem Kırılımı sayfası var");
  kontrol(adlar.includes("Proje Geneli ve Oranlar"), "Proje Geneli ve Oranlar sayfası var");
  kontrol(
    adlar.filter((a) => /^\d+\. /.test(a)).length === basilan.items.length,
    `her maliyet kalemi için bir sayfa (${basilan.items.length})`
  );
  kontrol(
    adlar.every((a) => a.length <= 31 && !/[[\]:*?/\\]/.test(a)),
    "sekme adları Excel sınırlarında (≤31 karakter, yasak karakter yok)"
  );

  // 2 — İÇ BELGE HER SAYFADA (MALIYET-12)
  console.log("\n  iç belge koruması");
  const damgasiz = okunan.worksheets.filter(
    (w) => !String(hucre(w, 2, 1) ?? "").includes("İÇ BELGE")
  );
  kontrol(damgasiz.length === 0, `künye satırında İÇ BELGE — ${adlar.length} sayfanın hepsinde`);
  kontrol(dosyaAdi.endsWith(".xlsx"), "dosya adı .xlsx uzantılı");
  kontrol(dosyaAdi.includes("İÇ BELGE"), `dosya adı İÇ BELGE taşıyor (${dosyaAdi})`);
  kontrol(dosyaAdi.includes("MALİYET M1"), "dosya adı maliyet revizyonunu taşıyor");

  // 3 — ÖZETİN ANA BAŞLIKLARI ÇEKİRDEKLE BİREBİR
  console.log("\n  özet → çekirdek");
  const oz = okunan.getWorksheet("Özet")!;
  const dogrudan = sayi(oz, "DOĞRUDAN MALİYET (ORAN TABANI)", 4);
  const toplam = sayi(oz, "TOPLAM MALİYET", 4);
  const imalat = sayi(oz, "İMALAT MALİYETİ", 4);
  const proje = sayi(oz, "PROJE MALİYETİ", 4);
  kontrol(yakin(dogrudan, totals.direct), `doğrudan maliyet = costTotals.direct (${dogrudan})`);
  // ÇAPA: PDF duman testinin ölçtüğü sayının aynısı. İki belge ayrışırsa
  // ikisinden biri değil, İKİSİ birden şüphelidir.
  kontrol(yakin(dogrudan, 198_082.74, 1), "doğrudan maliyet ASTOR çapasında (198.082,74 €)");
  kontrol(yakin(toplam, totals.total), `toplam maliyet = costTotals.total (${toplam})`);
  kontrol(
    yakin(toplam, (totals.direct ?? 0) * 1.19, 0.01),
    "toplam = doğrudan maliyet × 1,19 (oran tabanı DOĞRUDAN MALİYET)"
  );
  kontrol(
    yakin((imalat ?? 0) + (proje ?? 0), totals.direct),
    "imalat + proje = doğrudan maliyet (imalat toplama İKİNCİ KEZ eklenmiyor)"
  );
  kontrol(yakin(imalat, totals.fabrication), "imalat maliyeti = costTotals.fabrication");
  kontrol(yakin(proje, totals.project), "proje maliyeti = costTotals.project");

  // ORAN HÜCRESİ YÜZDE BİÇİMİNDE VE 0–1 ARALIĞINDA
  const sabit = satirBul(oz, "SABİT MALİYETLER");
  const oranHucre = oz.getRow(sabit).getCell(3);
  kontrol(oranHucre.value === 0.15, `sabit maliyetler oranı 0,15 olarak yazıldı (${oranHucre.value})`);
  kontrol(oranHucre.numFmt === "0%", "oran hücresi ondalıksız yüzde biçimli");
  kontrol(
    yakin(sayi(oz, "SABİT MALİYETLER", 4), (totals.direct ?? 0) * 0.15, 0.01),
    "sabit maliyetler tutarı = doğrudan maliyet × %15"
  );

  // 4 — TEKLİF VE KÂR
  console.log("\n  teklif ve kâr");
  const belgeToplami = sayi(oz, "MALİYET BELGESİNİN TOPLAMI", 2);
  const elle = sayi(oz, "FİYAT SATIRLARININ ELLE MALİYETİ", 2);
  const maliyetToplamHucre = hucre(oz, satirBulSon(oz, "TOPLAM MALİYET"), 2);
  const maliyetToplam = typeof maliyetToplamHucre === "number" ? maliyetToplamHucre : null;
  const fiyat = sayi(oz, "TEKLİF TUTARI", 2);
  const kar = sayi(oz, "KÂR", 2);
  kontrol(yakin(belgeToplami, ozet.documentTotal), "belge toplamı = costOverview.documentTotal");
  kontrol(yakin(elle, ELLE_MALIYET), `serbest satırın elle maliyeti taşındı (${elle} €)`);
  kontrol(yakin(maliyetToplam, ozet.margin.cost), "toplam maliyet = belge toplamı + elle maliyet");
  kontrol(yakin(fiyat, ozet.margin.price), "teklif tutarı = iskontolu teklif toplamı");
  kontrol(yakin(kar, ozet.margin.profit), `kâr = teklif − maliyet (${kar})`);
  kontrol(
    yakin((fiyat ?? 0) - (maliyetToplam ?? 0), kar),
    "kâr dosyadaki iki hücreden elle de tutuyor"
  );
  const marj = oz.getRow(satirBul(oz, "KÂR / SATIŞ")).getCell(2);
  const markup = oz.getRow(satirBul(oz, "KÂR / MALİYET")).getCell(2);
  kontrol(
    typeof marj.value === "number" && yakin(marj.value * 100, ozet.margin.marginPercent),
    "satış üzerinden marj 0–1 aralığında ve yüzde biçimli"
  );
  kontrol(
    typeof markup.value === "number" &&
      yakin(markup.value * 100, ozet.margin.markupPercent) &&
      markup.value !== marj.value,
    "maliyet üzerinden kârlılık AYRI bir sayı (MALIYET-11: iki oran birden)"
  );

  // 5 — KALEM BAZINDA VE AĞIRLIKLAR
  console.log("\n  kalem bazında");
  const kalemBaslik = satirBul(oz, "KALEM");
  kontrol(kalemBaslik > 0, "kalem tablosunun başlık satırı var");
  const beklenenBasliklar = [
    "KALEM", "ADET", "ÇELİK [KG]", "TOPLAM AĞIRLIK [KG]",
    "ÇELİK × ADET [KG]", "TOPLAM × ADET [KG]", "BİRİM MALİYET", "PAKET MALİYET", "EUR/KG",
  ];
  const okunanBasliklar = beklenenBasliklar.map((_, i) =>
    String(hucre(oz, kalemBaslik, i + 1) ?? "")
  );
  kontrol(
    okunanBasliklar.join("|") === beklenenBasliklar.join("|"),
    `kalem tablosunun başlıkları yerinde (${okunanBasliklar.join(" · ")})`
  );
  const ilkKalem = kalemBaslik + 1;
  kontrol(hucre(oz, ilkKalem, 3) === 51_000, "çelik ağırlığı 51.000 kg SAYI olarak yazıldı");
  kontrol(hucre(oz, ilkKalem, 4) === 59_500, "toplam vinç ağırlığı 59.500 kg yazıldı");
  kontrol(
    yakin(typeof hucre(oz, ilkKalem, 7) === "number" ? (hucre(oz, ilkKalem, 7) as number) : null,
      totals.items[0].unit),
    "kalemin birim maliyeti = costTotals.items[0].unit"
  );
  kontrol(
    yakin(sayi(oz, "KALEM TOPLAMI", 5), ozet.steelKg) &&
      yakin(sayi(oz, "KALEM TOPLAMI", 6), ozet.weightKg),
    "ağırlık toplamları = costOverview.steelKg / weightKg"
  );

  // 6 — SAYI MI METİN Mİ (Excel istemenin tek sebebi)
  console.log("\n  sayı mı metin mi");
  const paraHucreleri = [
    hucre(oz, satirBul(oz, "TOPLAM MALİYET"), 4),
    hucre(oz, satirBul(oz, "KÂR"), 2),
    hucre(oz, ilkKalem, 8),
  ];
  kontrol(
    paraHucreleri.every((v) => typeof v === "number"),
    "para hücreleri SAYI (metin değil) — toplanabilir"
  );
  const toplamHucre = oz.getRow(satirBul(oz, "TOPLAM MALİYET")).getCell(4);
  kontrol(
    typeof toplamHucre.numFmt === "string" && toplamHucre.numFmt.includes("EUR"),
    `para birimi hücrenin BİÇİMİNDE (${toplamHucre.numFmt})`
  );
  kontrol(
    toplamHucre.numFmt === '#,##0" EUR"',
    "toplam hücresinin görünümü ondalıksız ve binlik ayraçlı"
  );

  // 7 — ANA KALEM KIRILIMI
  console.log("\n  ana kalem kırılımı");
  const kr = okunan.getWorksheet("Ana Kalem Kırılımı")!;
  const krBaslik = satirBul(kr, "GRUP");
  let krToplam = 0;
  let krSatir = 0;
  kr.eachRow((row, no) => {
    if (no <= krBaslik) return;
    const ad = String(row.getCell(1).value ?? "");
    if (!ad || ad === "DOĞRUDAN MALİYET") return;
    const v = row.getCell(2).value;
    if (typeof v === "number") {
      krToplam += v;
      krSatir += 1;
    }
  });
  kontrol(krSatir === kirilim.length, `kırılım satır sayısı çekirdekle aynı (${krSatir})`);
  kontrol(yakin(krToplam, totals.direct, 0.01), "kırılım tutarlarının toplamı = doğrudan maliyet");
  kontrol(
    yakin(sayi(kr, "DOĞRUDAN MALİYET", 2), totals.direct),
    "kırılımın toplam satırı doğrudan maliyeti veriyor"
  );

  // 8 — KALEM SAYFASI VE "BOŞ ≠ SIFIR"
  console.log("\n  kalem sayfası");
  const ks = okunan.worksheets.find((w) => /^1\. /.test(w.name))!;
  const ksBaslik = satirBul(ks, "GRUP");
  kontrol(
    ["GRUP", "KALEM", "MİKTAR", "BİRİM", "BİRİM FİYAT", "TUTAR"].every(
      (h, i) => String(hucre(ks, ksBaslik, i + 1) ?? "") === h
    ),
    "kalem sayfasının başlıkları: GRUP · KALEM · MİKTAR · BİRİM · BİRİM FİYAT · TUTAR"
  );
  kontrol(
    yakin(sayi(ks, "KALEM BİRİM MALİYETİ", 6), totals.items[0].unit),
    "kalem birim maliyeti = costTotals.items[0].unit"
  );
  kontrol(
    yakin(sayi(ks, "PAKET MALİYET (BİRİM × ADET)", 6), totals.items[0].package),
    "paket maliyet = costTotals.items[0].package"
  );
  // GRUP TOPLAMLARININ TOPLAMI KALEMİN BİRİM MALİYETİDİR: sayfayı elle
  // toplayan kullanıcı aynı sayıya varmalıdır, yoksa belge kendi kendini
  // yalanlar.
  let grupToplami = 0;
  ks.eachRow((row) => {
    if (String(row.getCell(2).value ?? "") !== "GRUP TOPLAMI") return;
    const v = row.getCell(6).value;
    if (typeof v === "number") grupToplami += v;
  });
  kontrol(
    yakin(grupToplami, totals.items[0].unit, 0.01),
    "grup toplamlarının toplamı = kalemin birim maliyeti"
  );

  const pg = okunan.getWorksheet("Proje Geneli ve Oranlar")!;
  const bekleyen = satirBul(pg, BEKLEYEN_SATIR, 2);
  kontrol(bekleyen > 0, "fiyatı beklenen satır belgede duruyor");
  const bekleyenTutar = hucre(pg, bekleyen, 6);
  kontrol(
    bekleyenTutar === null || bekleyenTutar === undefined || bekleyenTutar === "",
    `fiyatı girilmemiş satırın tutarı BOŞ, sıfır değil (${JSON.stringify(bekleyenTutar)})`
  );
  kontrol(hucre(pg, bekleyen, 3) === 1, "aynı satırın miktarı yazılı — satır kaybolmuyor");

  console.log(hata === 0 ? "\nTÜM KONTROLLER GEÇTİ" : `\n${hata} KONTROL DÜŞTÜ`);
  if (hata > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

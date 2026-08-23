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
import { teknikDegerBuyuk } from "../src/lib/offers/buyuk";
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

/**
 * BEŞ BAŞLIĞI ÖZETTEN GİRİLMİŞ ikinci bir serbest satır (23.08.2026, md. 1).
 *
 * Kimliği SABİTTİR çünkü iki belge onu bu anahtarla eşleştirir: teklifin
 * `pricing.lines[].id` ile maliyetin `manualLineCosts` anahtarı.
 *
 * BİRİNCİ SERBEST SATIR DOKUNULMAMIŞ KALIR ve bu bilinçlidir: çizelgenin iki
 * hâli birden sınanmalıdır — girilmiş hücre YAZILIR, girilmemiş hücre BOŞ
 * kalır (değişmez md. 4).
 */
const KIRILIMLI_SATIR_ID = "serbest-kaldirma-traversi";
const KIRILIMLI_BASLIKLAR = {
  fabrication: 6_000,
  project: 8_500,
  fixed: 5_000,
  consumable: 500,
  finance: null as number | null,
};
/** Beş kutunun toplamı — satırın geçerli maliyeti (tek maliyet kutusu OKUNMAZ). */
const KIRILIM_TOPLAMI = 20_000;

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
    // BEŞ BAŞLIĞI ÖZETTEN GİRİLMİŞ İKİNCİ SERBEST SATIR (23.08.2026, md. 1).
    // Fikstürde yoktu ve o yüzden hiçbir sav özetin ELLE girilen sütunlarına
    // bakmıyordu — kardeş belgede (PDF) üç sütun sabit "—" basıyordu ve
    // testler yine geçiyordu.
    {
      id: KIRILIMLI_SATIR_ID,
      itemId: null,
      description: "KALDIRMA TRAVERSİ",
      qty: 1,
      unit: "Takım",
      unitPrice: 26_500,
      inTotal: true,
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

  // ÖZET SAYFASINDAN ELLE GİRİLEN VERİ (23.08.2026, md. 1 · 22.08.2026, md. 7).
  // Maliyet payload'ında yaşar, teklifinkinde değil (MALIYET-1).
  p.manualLineWeights = { [KIRILIMLI_SATIR_ID]: { steelKg: 7_000, totalKg: 7_000 } };
  p.manualLineCosts = {
    [KIRILIMLI_SATIR_ID]: {
      // TOPLAM KUTUSU BİLEREK DOLU: kırılım girilmişse OKUNMAZ ve savın
      // ölçtüğü şey tam olarak budur — hücrede 20.000 € durmalı, 99.999 € değil.
      total: 99_999,
      fabrication: KIRILIMLI_BASLIKLAR.fabrication,
      project: KIRILIMLI_BASLIKLAR.project,
      rates: {
        fixed: KIRILIMLI_BASLIKLAR.fixed,
        consumable: KIRILIMLI_BASLIKLAR.consumable,
        finance: KIRILIMLI_BASLIKLAR.finance,
      },
    },
  };

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

/** `bastan`dan itibaren ilk sütunu dolu olan satır numaraları. */
function okunanSatirlar(ws: ExcelJS.Worksheet, bastan: number): number[] {
  const out: number[] = [];
  ws.eachRow((row, no) => {
    if (no < bastan) return;
    if (String(row.getCell(1).value ?? "").trim() !== "") out.push(no);
  });
  return out;
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
  kontrol(adlar[1] === "Maliyet Kalemleri", "ikinci sayfa Maliyet Kalemleri");
  // SEKME SAYISI KALEM SAYISINDAN BAĞIMSIZDIR — kompaktlığın sınanabilir hâli
  // budur (kullanıcı isteği, 22.08.2026). Eskiden vinç başına bir sekme açılıyor
  // ve iki vinçli bir teklif beş sekme ediyordu; bugün kaç vinç olursa olsun
  // iki sekmedir ve vinç ayrımını KAYNAK sütunu taşır.
  kontrol(adlar.length === 2, `kitap İKİ sekme (${adlar.length}) — kalem sayısından bağımsız`);
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
  // İKİ SERBEST SATIRIN TOPLAMI: biri fiyat sayfasından (2.500 €), öteki
  // özetten kırılım olarak (20.000 €). İkisi de aynı satıra girer — kaynak
  // farkı toplamda değil, satırın kendisinde yaşar (`manualLineCost`).
  kontrol(
    yakin(elle, ELLE_MALIYET + KIRILIM_TOPLAMI),
    `serbest satırların elle maliyeti taşındı (${elle} €)`
  );
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
  // TABLO TEK LİSTEDİR (MALIYET-38): vinçler ve teklifin serbest fiyat
  // satırları aynı tablodadır; ayrımı TÜR sütunu söyler. Excel bu ayrımı ayrı
  // bir blokla yapmaya devam ediyordu — ekranla belge iki farklı yapı
  // anlatıyordu.
  // HER ORAN ARTIK İKİ SÜTUN TUTAR (tutar + yüzde, 23.08.2026 md. 6); ağırlık
  // ve beş başlık sütunlarının her birinin yanında da bir yüzde sütunu var.
  const beklenenBasliklar = [
    "KALEM", "TÜR", "ADET", "ÇELİK [KG]", "TOPLAM AĞIRLIK [KG]",
    "ÇELİK × ADET [KG]", "ÇELİK %", "TOPLAM × ADET [KG]", "TOPLAM %",
    "BİRİM MALİYET", "PAKET MALİYET", "İMALAT", "İMALAT %", "PROJE", "PROJE %",
  ];
  const okunanBasliklar = beklenenBasliklar.map((_, i) =>
    String(hucre(oz, kalemBaslik, i + 1) ?? "")
  );
  kontrol(
    okunanBasliklar.join("|") === beklenenBasliklar.join("|"),
    `kalem tablosunun başlıkları yerinde (${okunanBasliklar.join(" · ")})`
  );
  // ORAN SÜTUNLARI DEFTERDEN GELİR: sayıları sabit yazılmaz, `totals.rates`
  // kadardır ve her biri İKİ sütundur; ardından maliyet ile EUR/KG durur.
  const CELIK = 6;
  const CELIK_YUZDE = 7;
  const AGIRLIK = 8;
  const IMALAT = 12;
  const IMALAT_YUZDE = 13;
  const PROJE = 14;
  const maliyetSutunu = 16 + totals.rates.length * 2;
  kontrol(
    String(hucre(oz, kalemBaslik, maliyetSutunu) ?? "") === "GENEL GİDER DAHİL MALİYET" &&
      String(hucre(oz, kalemBaslik, maliyetSutunu + 1) ?? "") === "EUR/KG",
    `oran sütunlarından sonra maliyet ve EUR/KG geliyor (${totals.rates.length} oran)`
  );
  kontrol(
    String(hucre(oz, kalemBaslik, 16) ?? "") === teknikDegerBuyuk(totals.rates[0].title) &&
      String(hucre(oz, kalemBaslik, 17) ?? "") === `${teknikDegerBuyuk(totals.rates[0].title)} %`,
    "her oran grubu TUTAR + YÜZDE olarak iki sütun (md. 6)"
  );
  const ilkKalem = kalemBaslik + 1;
  kontrol(String(hucre(oz, ilkKalem, 2) ?? "") === "vinç", "vinç satırının TÜRÜ yazılı");
  kontrol(hucre(oz, ilkKalem, 4) === 51_000, "çelik ağırlığı 51.000 kg SAYI olarak yazıldı");
  kontrol(hucre(oz, ilkKalem, 5) === 59_500, "toplam vinç ağırlığı 59.500 kg yazıldı");
  kontrol(
    yakin(typeof hucre(oz, ilkKalem, 10) === "number" ? (hucre(oz, ilkKalem, 10) as number) : null,
      totals.items[0].unit),
    "kalemin birim maliyeti = costTotals.items[0].unit"
  );

  // YÜZDENİN TABANI İKİ TÜRLÜDÜR (md. 6) ve sav bunu ayrı ayrı sınar: ağırlık
  // sütunları BELGENİN DİP TOPLAMINA, para sütunları SATIRIN KENDİ MALİYETİNE
  // oranlanır. İkisini karıştıran bir düzenleme hiçbir sayıyı bozmadan belgeyi
  // yanlış okuturdu.
  const celikPayi = hucre(oz, ilkKalem, CELIK_YUZDE);
  kontrol(
    typeof celikPayi === "number" &&
      ozet.steelKgAll !== null &&
      Math.abs(celikPayi - (ozet.items[0].steelPackageKg ?? 0) / ozet.steelKgAll) < 1e-9,
    "çelik yüzdesinin tabanı BELGENİN dip toplamı"
  );
  const imalatPayi = hucre(oz, ilkKalem, IMALAT_YUZDE);
  const bas0 = ozet.items[0].headings;
  kontrol(
    typeof imalatPayi === "number" &&
      bas0.loaded !== null &&
      Math.abs(imalatPayi - (bas0.fabrication ?? 0) / bas0.loaded) < 1e-9,
    "imalat yüzdesinin tabanı SATIRIN KENDİ maliyeti"
  );
  // YÜZDE HÜCRESİ SAYIDIR (0–1) ve biçimi yüzdedir: metin yazılsaydı pivot ve
  // sıralama düşerdi (dosyanın en başındaki sözleşme).
  kontrol(
    oz.getRow(ilkKalem).getCell(IMALAT_YUZDE).numFmt === "0%",
    "yüzde hücresi 0–1 SAYI + yüzde biçimli"
  );

  // TUTAR ISISI HÜCRENİN YAZI RENGİNDEDİR (md. 4) ve dolgu DEĞİLDİR: dolguyu
  // boyamak, koşullu biçimlendirme kuran kullanıcının zeminini elinden alırdı.
  const isiliHucre = oz.getRow(ilkKalem).getCell(maliyetSutunu);
  kontrol(
    typeof isiliHucre.font?.color?.argb === "string" &&
      /^FF[0-9A-F]{6}$/.test(isiliHucre.font.color.argb),
    `maliyet hücresi ısı renginde (${isiliHucre.font?.color?.argb})`
  );
  kontrol(
    isiliHucre.fill === undefined || isiliHucre.fill.type !== "pattern" ||
      isiliHucre.fill.pattern === "none",
    `ısı YAZI rengidir, hücre DOLGUSU değil (${JSON.stringify(isiliHucre.fill)})`
  );

  // SERBEST FİYAT SATIRI AYNI TABLODADIR; beş başlığı ELLE girilebilir
  // (23.08.2026 md. 1) ama girilmemişse BOŞ kalır — uydurulmaz (md. 4).
  const serbest = okunanSatirlar(oz, kalemBaslik + 1).find(
    (no) => String(hucre(oz, no, 2) ?? "") === "fiyat satırı"
  );
  kontrol(serbest !== undefined, "serbest fiyat satırı aynı listede");
  if (serbest !== undefined) {
    kontrol(
      hucre(oz, serbest, IMALAT) === null || hucre(oz, serbest, IMALAT) === undefined,
      "girilmemiş İMALAT payı BOŞ (uydurulmuyor)"
    );
    kontrol(hucre(oz, serbest, maliyetSutunu) === 2_500, "serbest satırın maliyeti listede (2.500 €)");
  }

  // ÖZETTEN ELLE GİRİLEN BEŞ BAŞLIK ÇİZELGEYE DE YAZILIR (md. 1).
  //
  // BU SAV BİR HATADAN DOĞDU (kullanıcı bildirimi 23.08.2026): özet
  // tablosunda girilen imalat/proje/genel gider tutarları kardeş belgede
  // (PDF) hiç basılmıyordu ve fikstürde böyle bir satır olmadığı için testler
  // geçiyordu. İki çıktı aynı veriyi okur; ikisi de sınanır.
  const kirilimli = okunanSatirlar(oz, kalemBaslik + 1).find(
    (no) => String(hucre(oz, no, 1) ?? "") === "KALDIRMA TRAVERSİ"
  );
  kontrol(kirilimli !== undefined, "kırılımı girilmiş serbest satır listede");
  if (kirilimli !== undefined) {
    kontrol(
      hucre(oz, kirilimli, IMALAT) === KIRILIMLI_BASLIKLAR.fabrication,
      `özetten girilen İMALAT çizelgede (${hucre(oz, kirilimli, IMALAT)})`
    );
    kontrol(
      hucre(oz, kirilimli, PROJE) === KIRILIMLI_BASLIKLAR.project,
      `özetten girilen PROJE çizelgede (${hucre(oz, kirilimli, PROJE)})`
    );
    kontrol(
      hucre(oz, kirilimli, 16) === KIRILIMLI_BASLIKLAR.fixed,
      `özetten girilen SABİT çizelgede (${hucre(oz, kirilimli, 16)})`
    );
    // GİRİLMEMİŞ ORAN UYDURULMAZ: `finance` fikstürde `null`dır ve hücre BOŞ
    // kalmalıdır — sıfır yazmak "düşünüldü ve yok" demenin sessiz yoluydu.
    const finansman = hucre(oz, kirilimli, 20);
    kontrol(
      finansman === null || finansman === undefined,
      `girilmemiş FİNANSMAN hücresi BOŞ (${JSON.stringify(finansman)})`
    );
    // KIRILIM GİRİLMİŞSE TEK MALİYET KUTUSU OKUNMAZ (`manualLineCost`).
    kontrol(
      hucre(oz, kirilimli, maliyetSutunu) === KIRILIM_TOPLAMI,
      `satırın maliyeti kırılımın TOPLAMI (${hucre(oz, kirilimli, maliyetSutunu)}), gölgedeki 99.999 € değil`
    );
  }
  // DİP TOPLAM KENDİ SÜTUNUNU TOPLAR: `totals.fabrication` yalnız vinçleri
  // sayar ve sütunu gözle toplayan okuyucu tutturamazdı.
  kontrol(
    yakin(sayi(oz, "TOPLAM", IMALAT), (totals.fabrication ?? 0) + KIRILIMLI_BASLIKLAR.fabrication),
    "İMALAT dip toplamı serbest satırı da sayıyor"
  );
  kontrol(
    yakin(sayi(oz, "TOPLAM", CELIK), ozet.steelKgAll) &&
      yakin(sayi(oz, "TOPLAM", AGIRLIK), ozet.weightKgAll),
    "ağırlık dip toplamları = costOverview.steelKgAll / weightKgAll"
  );
  kontrol(
    yakin(sayi(oz, "TOPLAM", maliyetSutunu), ozet.margin.cost),
    "maliyet sütununun dip toplamı = kâr satırındaki TOPLAM MALİYET"
  );

  // 5b — 23.08.2026 TURU: ÇIKTIDAN DÜŞENLER (md. 8 · 9 · 10)
  console.log("\n  23.08 turu → çıktıdan düşenler");
  kontrol(satirBul(oz, "MODEL KATSAYILARI") === 0, "MODEL KATSAYILARI bloğu YOK (md. 8)");
  // ExcelJS okurken `views`i `null` da bırakabilir; sav "donmuş bölme yok"
  // demektir, "alan tanımsız" değil.
  const donmus = (w: ExcelJS.Worksheet) =>
    (w.views ?? []).some((v) => v?.state === "frozen");
  kontrol(!donmus(oz), "Özet sekmesinde donmuş bölme YOK (md. 9)");

  // 6 — SAYI MI METİN Mİ (Excel istemenin tek sebebi)
  console.log("\n  sayı mı metin mi");
  const paraHucreleri = [
    hucre(oz, satirBul(oz, "TOPLAM MALİYET"), 4),
    hucre(oz, satirBul(oz, "KÂR"), 2),
    hucre(oz, ilkKalem, 11),
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

  // 7 — ANA KALEM KIRILIMI (artık ÖZETİN bir bloğu)
  console.log("\n  ana kalem kırılımı");
  const krBaslik = satirBulSon(oz, "GRUP");
  let krToplam = 0;
  let krSatir = 0;
  oz.eachRow((row, no) => {
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
    yakin(sayi(oz, "DOĞRUDAN MALİYET", 2), totals.direct),
    "kırılımın toplam satırı doğrudan maliyeti veriyor"
  );

  // 8 — MALİYET KALEMLERİ ÇİZELGESİ VE "BOŞ ≠ SIFIR"
  console.log("\n  maliyet kalemleri çizelgesi");
  const ks = okunan.getWorksheet("Maliyet Kalemleri")!;
  const ksBaslik = satirBul(ks, "KAYNAK");
  // MİKTAR KAYNAĞI SÜTUNU KALDIRILDI (23.08.2026, md. 9): her satırda tekrar
  // eden ve süzgeçte hiç kullanılmayan bir metindi. MALIYET-4 değişmedi —
  // miktarın kaynağı EKRANDA görünür.
  const ksBeklenen = [
    "KAYNAK", "ADET", "GRUP", "KALEM", "MİKTAR", "BİRİM",
    "BİRİM FİYAT", "TUTAR", "PAKET TUTAR", "TEKLİFTE", "NOT",
  ];
  kontrol(
    ksBeklenen.every((h, i) => String(hucre(ks, ksBaslik, i + 1) ?? "") === h),
    `çizelgenin başlıkları yerinde (${ksBeklenen.length} sütun)`
  );
  // KAYNAK SÜTUNU VİNCİ TAŞIR: sekmeler kalktığı için satırın hangi vince ait
  // olduğu ancak bu sütundan okunur. Süzgeç de onun üstüne kurulur.
  kontrol(
    String(hucre(ks, ksBaslik + 1, 1) ?? "") === teknikDegerBuyuk(basilan.items[0].title),
    "ilk satır KAYNAK sütununda vincin adını taşıyor"
  );
  kontrol(ks.autoFilter !== undefined && ks.autoFilter !== null, "çizelge SÜZGEÇLİ açılıyor");
  // SÜZGEÇ KALIR, DONDURMA KALKAR (md. 9): ikisi ayrı şeydir — biri okuyanın
  // sorusunu daraltır, öteki pencerenin kendisine el koyar.
  kontrol(!donmus(ks), "çizelgede donmuş bölme YOK (md. 9)");

  // PAKET TUTAR TOPLANABİLİR OLANIDIR: TUTAR bir adedin maliyetidir. İki
  // vinçli bir teklifte TUTAR sütununu toplayan okuyucu doğrudan maliyeti yarı
  // bulurdu — sav bu yüzden PAKET sütununu toplar.
  let paketToplam = 0;
  ks.eachRow((row, no) => {
    if (no <= ksBaslik) return;
    if (String(row.getCell(1).value ?? "").startsWith("DOĞRUDAN MALİYET")) return;
    // Kalem kipindeki oranlı grupların satırları doğrudan maliyetin İÇİNDE
    // DEĞİLDİR; onlar orandan sonra gelir ve bu toplama girmez.
    const kaynak = String(row.getCell(1).value ?? "");
    const oranAdlari = totals.rates.map((x) => teknikDegerBuyuk(x.title));
    if (oranAdlari.includes(kaynak)) return;
    const v = row.getCell(9).value;
    if (typeof v === "number") paketToplam += v;
  });
  kontrol(
    yakin(paketToplam, totals.direct, 0.01),
    `PAKET TUTAR sütunu doğrudan maliyeti tutuyor (${paketToplam.toFixed(2)})`
  );
  kontrol(
    yakin(sayi(ks, "DOĞRUDAN MALİYET (KALEM PAKETLERİ + PROJE GENELİ)", 9), totals.direct),
    "çizelgenin dip toplamı = costTotals.direct"
  );
  // ARA TOPLAM SATIRI YOK: süzülebilir bir tabloda grup toplamı satırı,
  // pivotta ve SUM'da İKİNCİ KEZ sayılırdı.
  let araToplamSatiri = 0;
  ks.eachRow((row) => {
    if (String(row.getCell(4).value ?? "") === "GRUP TOPLAMI") araToplamSatiri += 1;
  });
  kontrol(araToplamSatiri === 0, "çizelgede ARA TOPLAM satırı yok (pivot çift saymaz)");

  const bekleyen = satirBul(ks, BEKLEYEN_SATIR, 4);
  kontrol(bekleyen > 0, "fiyatı beklenen satır belgede duruyor");
  const bekleyenTutar = hucre(ks, bekleyen, 8);
  kontrol(
    bekleyenTutar === null || bekleyenTutar === undefined || bekleyenTutar === "",
    `fiyatı girilmemiş satırın tutarı BOŞ, sıfır değil (${JSON.stringify(bekleyenTutar)})`
  );
  kontrol(hucre(ks, bekleyen, 5) === 1, "aynı satırın miktarı yazılı — satır kaybolmuyor");

  console.log(hata === 0 ? "\nTÜM KONTROLLER GEÇTİ" : `\n${hata} KONTROL DÜŞTÜ`);
  if (hata > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

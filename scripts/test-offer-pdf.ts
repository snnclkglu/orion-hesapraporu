// TEKLİF PDF DUMAN TESTİ.
// Çalıştırma: npx tsx scripts/test-offer-pdf.ts [çıktı-dizini]
//
// ÜÇ BELGE üretir ve ÜÇÜNÜ DE GERİ OKUR (`unpdf` ile metin katmanından):
//   1) SADE — HABAŞ deseni: tek vinç, 4 takım, 223.600 EUR.
//   2) GİZLEMELİ — bir satır, bir grup ve bir fiyat satırı gizli. Belgede
//      hiçbirinin İZİ olmamalıdır (ne metin, ne boş başlık, ne tire).
//   3) ÇOK KALEMLİ — 8 ekipman, 19 fiyat satırı. Amaç sayfa dengesini ve
//      fiyat tablosu başlığının her sayfada tekrar ettiğini görmek.
//
// FİKSTÜRLER GERÇEK BÜYÜKLÜKTEDİR. Uydurma küçük sayılarla ("100 €") sütun
// taşması hiç görülmez; teklifler yedi haneli tutarlar taşır ve tablo asıl
// orada kırılır.

import fs from "node:fs";
import path from "node:path";
import { renderOfferPdf, type OfferDocumentProps } from "../src/lib/pdf/offer";
import { offerFileName } from "../src/lib/pdf/doc-naming";
import { emptyPayload, freeItem, groupFromKey, newOfferId } from "../src/lib/offers/payload";
import { applyDiscountToLines, offerTotal } from "../src/lib/offers/pricing";
import { offerDocLine } from "../src/lib/offers/no";
import { fmtMoney } from "../src/lib/currency";
import type { OfferGroup, OfferPayload, OfferPriceLine } from "../src/lib/offers/types";

const outDir = process.argv[2] ?? path.join(process.cwd(), ".test-output");
fs.mkdirSync(outDir, { recursive: true });

// KÜNYE GERÇEK UZUNLUKTADIR: altbilgi adres · telefon · e-posta · web'i TEK
// satıra basar ve satırın A4 içerik genişliğine sığdığı ancak firmanın kendi
// (uzun) adresiyle ölçülebilir. Kısaltılmış bir adresle taşma hiç görülmezdi.
const COMPANY = {
  company: "ORION CRANES",
  address: "Malıköy, 1. Cd. No:20, 06909 Başkent Organize Sanayi Bölgesi/Sincan/Ankara",
  phone: "(0312) 511 48 06",
  email: "info@orioncranes.com",
  web: "orioncranes.com",
};

// ————————————————————————————————————————————————————————— fikstür kurma

/** Defterden gelen grubu kurup satır değerlerini doldurur. */
function grup(key: string, degerler: Record<string, string>): OfferGroup {
  const g = groupFromKey(key);
  for (const row of g.rows) {
    const v = degerler[row.key];
    if (v !== undefined) row.value = v;
  }
  return g;
}

/**
 * Satırı MÜŞTERİ KAPSAMINA alır. Kapsam bir DEĞER değil satırın niteliğidir:
 * eskiden bu bilgi değerin metnine ("Müşteri Kapsamında") yazılıyordu ve
 * süzülemez, listelenemez, sayılamazdı.
 */
function musteriKapsami(g: OfferGroup, key: string) {
  const row = g.rows.find((r) => r.key === key);
  if (row) row.scope = "customer";
}

function satirDegeri(rows: { key: string; value: string }[], key: string, value: string) {
  const row = rows.find((r) => r.key === key);
  if (row) row.value = value;
}

function fiyatSatiri(p: Partial<OfferPriceLine> & { description: string }): OfferPriceLine {
  return {
    id: newOfferId(),
    itemId: null,
    qty: 1,
    unit: "Takım",
    unitPrice: null,
    inTotal: true,
    ...p,
  };
}

/**
 * HABAŞ deseninin teknik gövdesi — bir çift kirişli gezer köprülü vinç.
 *
 * ÜÇ SATIR MÜŞTERİ KAPSAMINDADIR (yürüme yolu, araba freni, hol boyu elektrik)
 * — kullanıcının anlattığı gerçek durum budur: *"bazen müşteri arabanın frenini
 * ben vereceğim diyebiliyor."* Kalan onlarca satır Orion kapsamındadır ve
 * belgede kapsamdan HİÇ söz etmemelidir; fikstür bu oranı bilerek taşır.
 */
function vincGruplari(): OfferGroup[] {
  const genel = grup("general", {
    capacity: "20.000 kg",
    environment: "Kapalı Alan, -10 / +40 º C",
    span: "22,5 m",
    liftHeight: "8 m",
    craneClass: "FEM 2m / ISO M5 - ISO/FEM A5 H3/B4",
    craneType: "Çift Kirişli Gezer Köprülü Vinç",
    // Kapsam artık DEĞERİN METNİNDE değil satırın kendi alanında durur;
    // değer yürüme yolunun ne olduğunu söyler, ek kimin verdiğini.
    runway: "A55 Ray, 96 m",
  });
  musteriKapsami(genel, "runway");

  const araba = grup("trolley", {
    travelSpeed: "2-20 m/dk – Frekans İnvertörlü",
    motor: "2 x 1,5 kW 1500 d/dak",
    gearbox: "YILMAZ R. VR Tipi",
    brake: "Elektromanyetik Motor Freni x 2 Adet",
    driveSystem: "2 Tekerden Tahrik",
    wheel: "4 x Ø315 DIN15090 C4140 35-42 HRC",
    controlType: "İnvertör Kontrollü",
  });
  musteriKapsami(araba, "brake");

  const elektrik = grup("electrical", {
    supplyVoltage: "400 VAC 50 Hz",
    controlVoltage: "220 – 24 VDC",
    runwayPower: "Kapalı Kutu Bara Tesisatı",
    busbar: "Vasel",
    pendant: "Elfatek EN-MİD Serisi",
    drives: "SCHNEIDER ATV-320",
    crossLimit: "Terr",
    drumLimit: "Stromag",
    powerSupply: "Omron",
    terminals: "Phoenix",
    loadcell: "Esit",
    signalization: "Mucco",
    cable: "Üntel",
    resistors: "Ressa",
    switchgear: "Schneider",
    panel: "EAE, Kiriş Üzeri",
    kst: "Dahil",
  });
  musteriKapsami(elektrik, "runwayPower");

  return [
    genel,
    grup("mainHoist", {
      liftSpeed: "1-6 m/dk – Çift Hız Kontrolü (Frekans İnvertörlü)",
      reeving: "4/1",
      motor: "GAMAK 22 kW 1500 d/dak, Encoderli, F/S3",
      gearbox: "YILMAZ R. HT Sandık Tipi, Delik Milli, Emniyet: 1,5",
      brake: "SIBRE Elektrohidrolik Kasnak Fren x 2 Adet",
      drive: "SCHNEIDER ATV-340",
      hook: "DIN 15401/P Tek Ağızlı Kanca",
      rope: "Ø16 6x36 Halat 1960 N/mm2 Çelik Özlü",
      controlType: "İnvertör Kontrollü",
    }),
    araba,
    grup("bridge", {
      rail: "A45",
      runwayRail: "A55",
      travelSpeed: "3-30 m/dk – Frekans İnvertörlü",
      travelSystem: "4 Teker",
      driveSystem: "2 Tekerden Tahrik",
      motor: "2 x 5,5 kW 1500 d/dak",
      gearbox: "YILMAZ R. HT Tipi, Delik Milli",
      brake: "Elektromanyetik Motor Freni x 2 Adet",
      drive: "SCHNEIDER ATV-320",
      wheel: "4 x Ø400 DIN15090 C4140 35-42 HRC",
      bearings: "SKF",
      controlType: "İnvertör Kontrollü",
    }),
    grup("steel", {
      girder: "Kutu Çelik Konstrüksiyon, St52",
      girderCalc: "FEM / DIN15018 - 1/1000 Maksimum Sehim",
      girderMaterial: "S355JR",
      platform: "Çift Taraflı Yürüme Platformu",
      paint: "Kumlama + Astar + Son Kat, Renk : RAL1007 Sarı",
    }),
    elektrik,
  ];
}

/** Ortak gövde: kapak, ticari şartlar, notlar, kapsam dışı işler. */
function temelPayload(): OfferPayload {
  const p = emptyPayload("EUR");
  p.cover = {
    fromName: "SİNAN ÇOLAKOĞLU",
    fromTitle: "Satış Müdürü",
    fromEmail: "sinan@orioncranes.com",
    toName: "ALİCAN ERASLAN",
    toDept: "Satın Alma Departmanı",
    toPhone: "+90 216 453 67 51",
    customerRef: "6000294866",
    greeting: "Sn. Alican ERASLAN Bey,",
    intro:
      "Tarafımızdan talep etmiş olduğunuz konu iş için teknik ve ticari teklifimizi aşağıda dikkatinize sunar, kıymetli siparişleriniz bekleriz.",
    signatories: [
      { name: "SİNAN ÇOLAKOĞLU", title: "Satış Müdürü" },
      { name: "ORHAN ÇOLAKOĞLU", title: "Genel Müdür" },
    ],
  };

  satirDegeri(p.testLoad.rows, "dynamic", "Q x 1,1");
  satirDegeri(p.testLoad.rows, "static", "Q x 1,25");

  satirDegeri(p.terms.rows, "validity", "14 iş günü");
  satirDegeri(p.terms.rows, "deliveryTime", "Avans Ödemesi Sonrası 10-12 Hafta");
  satirDegeri(p.terms.rows, "freight", "Dahil");
  satirDegeri(p.terms.rows, "erection", "Vinçlerin yerine montajı ve devreye alınması dahildir.");
  satirDegeri(p.terms.rows, "deliveryPlace", "Yerinde çalışır halde teslim");
  // GARANTİ BİLEREK BOŞ: devralınan tekliflerin hiçbirinde garanti maddesi
  // yok. Belgede o satır HİÇ ÇİZİLMEMELİDİR (yer tutucu yasağı).
  satirDegeri(p.terms.rows, "payment", "KDV Dahil ödeme şekli aşağıda belirtilen şekildedir.");
  p.terms.paymentLines = [
    { id: newOfferId(), text: "%40 Avans Sipariş ile Nakit" },
    { id: newOfferId(), text: "%60 Teslimat Sonrası Nakit (Fatura + 30 Gün)" },
  ];

  p.notes = [
    {
      id: newOfferId(),
      text: "Teklif fiyatına hiçbir yurtiçi vergi, harç, pul avans damga vergisi, banka komisyonu ve masrafları v.b. dahil değildir.",
    },
    {
      id: newOfferId(),
      text: "Malzemenin kısmen veya tamamen alınması firmamız dışındaki nedenlerden ötürü (inşaat işlerinin tamamlanmaması, nakliye alıcıya ait ise araç bulunamaması v.b.) gecikmesi halinde malzemenin sevkiyata hazır olduğunun müşteriye bildirilmesini takiben 5 gün içerisinde ödeme koşulları aynen devam edecektir.",
    },
    { id: newOfferId(), text: "Teslim sonrası vincin tüm imalat projeleri dwg. formatında paylaşılacaktır." },
  ];
  p.exclusions = [
    { id: newOfferId(), text: "Vincin montaj sahasında gerekli olan tüm inşaat işleri" },
    { id: newOfferId(), text: "Köprü rayı ve hol bara montajı" },
    { id: newOfferId(), text: "Hol boyu bara tesisatı ve besleme" },
    { id: newOfferId(), text: "Montajda kullanılacak mobil ve sepetli vinçler" },
    { id: newOfferId(), text: "Sahada ihtiyaç duyulacak her türlü enerji temini" },
  ];
  return p;
}

// —————————————————————————————————————————————————————————— 1) SADE

function sadeTeklif(): OfferDocumentProps {
  const p = temelPayload();
  const item = {
    id: newOfferId(),
    title: "20T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ",
    craneType: "Çift Kirişli Gezer Köprülü Vinç",
    capacityT: 20,
    spanM: 22.5,
    groups: vincGruplari(),
  };
  p.items = [item];
  p.pricing.lines = [
    fiyatSatiri({
      itemId: item.id,
      description: "20 Ton x 22,5 m Çift Kirişli Gezer Köprülü Vinç",
      qty: 4,
      unit: "Takım",
      unitPrice: 55900,
    }),
  ];
  return {
    offer: {
      offerNo: "TETR-20260127-1",
      revNo: 2,
      issueDate: "2026-01-27",
      subject: "HABAŞ DÖRTYOL 20T VİNÇ",
      customerName: "HABAŞ SINAİ VE TIBBİ GAZLAR İSTİHSAL ENDÜSTRİSİ A.Ş.",
      currency: "EUR",
    },
    payload: p,
    company: COMPANY,
    meta: { generatedAt: "17.08.2026" },
  };
}

// ————————————————————————————————————————————— 1b) İSKONTOLU / SERBEST

/**
 * İSKONTOLU + SERBEST KALEMLİ teklif.
 *
 * İki yeni kural aynı fikstürde sınanır çünkü ikisi de aynı soruyu soruyor:
 * belgeye BASILAN şey veriyle tutuyor mu?
 *   · İskonto satırları YALNIZ satır toplamından farklıysa basılır ve
 *     "İSKONTOLU TOPLAM" ödenecek rakamı gösterir (TEKLIF-35).
 *   · SERBEST kalemin satır etiketleri defterde yoktur; elle yazılan etiket ve
 *     değer belgeye aynen girer, boş satır ise HİÇ girmez (TEKLIF-33).
 */
function iskontoluTeklif(): OfferDocumentProps {
  const props = sadeTeklif();
  const p = props.payload;

  const yedek = freeItem("YEDEK PARÇA GRUBU");
  const rows = yedek.groups[0].rows;
  rows[0] = { ...rows[0], label: "Redüktör Gövdesi", value: "YILMAZ R. HT 0823 — Komple" };
  rows[1] = { ...rows[1], label: "Kaplin Takozu", value: "SIBRE 200 Serisi, 6 Adet" };
  // Üçüncü satır BOŞ bırakılır: belgede görünmemesi gerekir.
  p.items = [...p.items, yedek];

  p.pricing.lines = [
    ...p.pricing.lines,
    fiyatSatiri({ itemId: yedek.id, description: "Yedek Parça Grubu", qty: 1, unit: "Takım", unitPrice: 8_400 }),
  ];
  // Satır toplamı 223.600 + 8.400 = 232.000; iskontolu 215.000 (17.000 iskonto).
  p.pricing.discountTotal = 215_000;
  return props;
}

// ———————————————————————————————————————————————————— 2) GİZLEMELİ

/** Gizlenen her şey bu damgayı taşır; belgede damganın hiç geçmemesi gerekir. */
const GIZLI = "GIZLIDAMGA";

function gizlemeliTeklif(): OfferDocumentProps {
  const props = sadeTeklif();
  const p = props.payload;
  const item = p.items[0];

  // (a) TEK SATIR — elektrik grubunda bir loadcell satırı.
  const elektrik = item.groups.find((g) => g.key === "electrical")!;
  const loadcell = elektrik.rows.find((r) => r.key === "loadcell")!;
  loadcell.value = `${GIZLI} LOADCELL`;
  loadcell.hidden = true;

  // (b) TÜM GRUP — vinç arabası. Başlığıyla birlikte düşmelidir.
  const araba = item.groups.find((g) => g.key === "trolley")!;
  araba.title = `${GIZLI} VİNÇ ARABASI`;
  araba.hidden = true;

  // (c) FİYAT SATIRI — gizlenen satır toplama da girmemelidir.
  p.pricing.lines.push(
    fiyatSatiri({
      description: `${GIZLI} Yedek Parça Paketi`,
      qty: 1,
      unit: "Takım",
      unitPrice: 999999,
      hidden: true,
    })
  );
  // Toplama GİRMEYEN ama görünen satır: tutarı belgede yazar, TOPLAM'a girmez.
  p.pricing.lines.push(
    fiyatSatiri({
      description: "Montaj Süpervizör Hizmeti (Günlük)",
      qty: 1,
      unit: "Kişi",
      unitPrice: 400,
      inTotal: false,
    })
  );

  props.offer.offerNo = "TETR-20260212-3";
  props.offer.revNo = 0;
  props.offer.subject = "GİZLEME SINAMASI";
  return props;
}

// ——————————————————————————————————————————————————— 3) ÇOK KALEMLİ

const KALEM_ADLARI = [
  "5T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ",
  "10T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ",
  "20/5T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ",
  "32T ÇİFT KİRİŞ GEZER KÖPRÜLÜ PORTAL VİNÇ",
  "50/10T ŞARJ / DÖKÜM VİNCİ",
  "12,5T MONORAY VİNÇ",
  "16T KALDIRMA KİRİŞİ",
  "OPERATÖR KABİNİ",
];

function cokKalemliTeklif(): OfferDocumentProps {
  const p = temelPayload();
  p.testLoad.position = "teknik";

  p.items = KALEM_ADLARI.map((ad, i) => ({
    id: newOfferId(),
    title: ad,
    capacityT: null,
    spanM: null,
    groups: vincGruplari().slice(0, i === 7 ? 2 : 6),
  }));

  // 19 FİYAT SATIRI — sekiz ekipman + montaj/nakliye/opsiyon kalemleri.
  const birimFiyatlar = [48500, 62400, 118750, 254000, 486300, 39900, 71200, 28400];
  const lines: OfferPriceLine[] = p.items.map((it, i) =>
    fiyatSatiri({
      itemId: it.id,
      description: it.title,
      qty: i === 0 ? 4 : i === 2 ? 2 : 1,
      unit: "Takım",
      unitPrice: birimFiyatlar[i],
    })
  );
  lines.push(
    fiyatSatiri({ description: "Hol Boyu Kapalı Kutu Bara Tesisatı", qty: 240, unit: "Metre", unitPrice: 96 }),
    fiyatSatiri({ description: "Vinç Barası ve Fırça Takımı", qty: 8, unit: "Takım", unitPrice: 1850 }),
    fiyatSatiri({ description: "Montaj ve Devreye Alma", qty: 1, unit: "Takım", unitPrice: 78500 }),
    fiyatSatiri({ description: "Nakliye (Ankara — Dörtyol)", qty: 1, unit: "Takım", unitPrice: 42750 }),
    fiyatSatiri({ description: "Uzaktan Kumanda Sistemi", qty: 8, unit: "Adet", unitPrice: 2450, optional: true }),
    fiyatSatiri({ description: "Kablosuz Yük Göstergesi", qty: 8, unit: "Adet", unitPrice: 1975, optional: true }),
    fiyatSatiri({ description: "Anti-Sway (Salınım Önleme) Sistemi", qty: 3, unit: "Takım", unitPrice: 18600, optional: true }),
    fiyatSatiri({ description: "Yedek Parça Paketi (2 Yıllık)", qty: 1, unit: "Takım", unitPrice: 34200, optional: true }),
    fiyatSatiri({ description: "Operatör Eğitimi", qty: 2, unit: "Gün", unitPrice: 1200 }),
    fiyatSatiri({ description: "Montaj Süpervizör Hizmeti", qty: 1, unit: "Kişi", unitPrice: 400, inTotal: false }),
    fiyatSatiri({ description: "Devreye Alma Süpervizörü", qty: 1, unit: "Kişi", unitPrice: 450, inTotal: false })
  );
  p.pricing.lines = lines;

  return {
    offer: {
      offerNo: "TETR-20260702-1",
      revNo: 1,
      issueDate: "2026-07-02",
      subject: "MUHTELİF VİNÇLER — SEKİZ KALEM",
      customerName: "İSDEMİR İSKENDERUN DEMİR VE ÇELİK A.Ş.",
      currency: "EUR",
    },
    payload: p,
    company: COMPANY,
    meta: { generatedAt: "17.08.2026" },
  };
}

// ————————————————————————————————————————————————————————— doğrulama

/** PDF'in sayfa adedi — `/Type /Page` sayımı (test-job-list.ts ile aynı). */
function sayfaAdedi(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

/**
 * ÜST ÜSTE BİNEN METİN VAR MI — sayfanın çözülmüş metin katmanından.
 *
 * Bu, 18.08.2026'da müşteriye giden bir teklifte GERÇEKTEN olan hatadır:
 * sayfa başlığı sağ üstteki künyenin üzerine biniyor, iki metin birbirini
 * okunmaz kılıyordu. Sebebi görünmez bir yerleşim tuzağıydı — esnek satırda
 * yalnız `flexShrink` verilmiş bir kutuda @react-pdf metni daraltılmış
 * genişliğe göre YENİDEN SARMAZ, ölçtüğü doğal genişlikte çizer ve komşusunun
 * üstüne taşar. Ne bir uyarı verir ne de metin kaybolur: belge üretilir,
 * testler geçer, kâğıt bozuktur.
 *
 * Ölçü: aynı yatay şeritteki (taban çizgileri punto'nun %70'inden yakın) iki
 * kutunun x aralıkları kesişiyorsa çakışma vardır. İki sütunlu teknik sayfa
 * yanlış alarm vermez — sütunlar aynı şeritte ama ayrı x aralıklarındadır.
 */
async function cakisanMetinler(buf: Buffer): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const bulgular: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const kutular = (await page.getTextContent()).items.flatMap((ham) => {
      // `TextMarkedContent` öğeleri metin taşımaz; yalnız `TextItem`lar ölçülür.
      const i = ham as Partial<{ str: string; transform: number[]; width: number; height: number }>;
      if (typeof i.str !== "string" || i.str.trim() === "" || !i.transform) return [];
      return [{ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width ?? 0, h: i.height ?? 0 }];
    });
    for (let a = 0; a < kutular.length; a++) {
      for (let b = a + 1; b < kutular.length; b++) {
        const A = kutular[a];
        const B = kutular[b];
        if (Math.abs(A.y - B.y) > Math.min(A.h, B.h) * 0.7) continue;
        // 0,8pt tolerans: harf aralıklı dizgide bitişik kutular teğet geçebilir.
        const ustuste = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
        if (ustuste > 0.8) bulgular.push(`s.${n} ${ustuste.toFixed(1)}pt: "${A.s}" ↔ "${B.s}"`);
      }
    }
  }
  return bulgular;
}

/**
 * Metin karşılaştırması BOŞLUKSUZ yapılır: PDF metin katmanı sözcük araları
 * için ayrı konumlandırma kullanır ve "223.600 €" çözüldüğünde araya fazladan
 * boşluk girebilir. Aranan şey rakamların kendisidir, dizgi değil.
 */
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

async function uret(ad: string, props: OfferDocumentProps) {
  const t0 = Date.now();
  const buf = await renderOfferPdf(props);
  const dosya = path.join(outDir, ad);
  fs.writeFileSync(dosya, buf);

  const sayfalar = await sayfaMetinleri(buf);
  const metin = sayfalar.join(" ");
  console.log(
    `\n${ad}  ${sayfaAdedi(buf)} sayfa · ${(buf.length / 1024).toFixed(0)} KB · ` +
      `${Date.now() - t0} ms\n   → ${offerFileName(props.offer.subject, props.offer.offerNo, props.offer.revNo)}`
  );

  kontrol(buf.subarray(0, 4).toString() === "%PDF", "geçerli PDF başlığı");

  const cakisan = await cakisanMetinler(buf);
  kontrol(cakisan.length === 0, `hiçbir metin üst üste binmiyor${cakisan.length ? ` — ${cakisan[0]}` : ""}`);

  // ALTBİLGİ KÜNYESİ HER SAYFADA: müşteri belgenin bir yaprağını tek başına
  // fotoğraflasa bile hangi teklifin hangi revizyonu olduğu okunmalıdır.
  const kimlik = duz(offerDocLine(props.offer.offerNo, props.offer.revNo));
  const eksik = sayfalar.findIndex((s) => !duz(s).includes(kimlik));
  kontrol(eksik === -1, `altbilgi künyesi ${sayfalar.length} sayfanın hepsinde (${kimlik})`);

  // ALTBİLGİ KÜNYESİ TEK SATIRDIR: adres · telefon · e-posta · web.
  //
  // Ölçü METİN KATMANINDAN alınır: adres ile telefonun ARASINDA satır sonu
  // bulunmamalıdır. Bu kontrol aynı zamanda TAŞMA BEKÇİSİDİR — satır A4
  // genişliğine sığmasaydı react-pdf onu sarar ve tam o noktada bir "\n"
  // belirirdi. Punto değiştiğinde ilk düşecek kontrol budur.
  if (!props.payload.cover.hidden) {
    const kapak = sayfalar[0] ?? "";
    const a = kapak.indexOf("Ankara");
    const t = kapak.indexOf(COMPANY.phone);
    kontrol(
      a >= 0 && t > a && !kapak.slice(a, t).includes("\n"),
      "künye tek satırda (telefon adresten satır sonuyla ayrılmıyor)"
    );
  }

  // TOPLAM satırla tutuyor mu.
  const toplam = offerTotal(props.payload.pricing.lines);
  if (toplam !== null) {
    kontrol(
      duz(metin).includes(duz(fmtMoney(toplam, props.offer.currency))),
      `TOPLAM belgede yazıyor (${fmtMoney(toplam, props.offer.currency)})`
    );
  }

  return { buf, metin, sayfalar };
}

async function main() {
  console.log(`Çıktı: ${outDir}`);

  const s = await uret("teklif-sade.pdf", sadeTeklif());
  // KAPSAM: istisna görünür, olağan görünmez.
  kontrol(
    duz(s.metin).includes(duz("A55 Ray, 96 m (Müşteri Kapsamında)")),
    "müşteri kapsamındaki satırın eki değerin devamında basıldı"
  );
  kontrol(
    duz(s.metin).includes(duz("Elektromanyetik Motor Freni x 2 Adet (Müşteri Kapsamında)")),
    "araba freni müşteri kapsamında işaretlendi"
  );
  // Orion kapsamı BELGEDE HİÇ GEÇMEZ — onlarca satırın hepsine kapsam yazmak
  // belgeyi okunmaz yapardı; kural "istisnayı yaz"dır.
  kontrol(!s.metin.includes("Orion Kapsam"), "Orion kapsamı belgede iz bırakmıyor");
  // KALEM ADI SAYFANIN BÜYÜK BAŞLIĞIDIR (kullanıcı bildirimi 18.08.2026).
  // Bir gün öbek adları ("GENEL · KALDIRMA · ARABA") başlığın yerini almış,
  // kalem adı sağ üstte küçük bir künyeye düşmüştü; ikisi üst üste biniyordu.
  // Ad başlığa dönünce künye de kalktı, öbek adları başlığın altında sessiz bir
  // dizin oldu. Ölçülen şey değişmedi: kalemin adı belgede DURUYOR MU.
  kontrol(
    s.metin.includes("20T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ"),
    "kalem adı teknik sayfanın başlığında"
  );
  kontrol(
    duz(s.metin).includes(duz("GENEL · KALDIRMA · ARABA")),
    "öbek dizini başlığın altında"
  );
  kontrol(
    duz(s.metin).includes(duz("TEKNİK ÖZELLİKLER")),
    "teknik sayfa kicker'ı basıldı"
  );
  kontrol(
    duz(s.metin).includes(duz("GENEL ÖZELLİKLER")),
    "grup başlıkları sütunlarda basıldı"
  );

  const i = await uret("teklif-iskontolu.pdf", iskontoluTeklif());
  kontrol(duz(i.metin).includes(duz(fmtMoney(232000, "EUR"))), "satır TOPLAMI belgede (232.000 €)");
  kontrol(i.metin.includes("İSKONTO"), "iskonto satırı basıldı");
  kontrol(
    duz(i.metin).includes(duz(fmtMoney(215000, "EUR"))),
    "İSKONTOLU TOPLAM ödenecek rakamı gösteriyor (215.000 €)"
  );
  // SERBEST KALEM: elle yazılan etiket ve değer belgede; boş satır YOK.
  // BOŞLUKSUZ karşılaştırılır: bölüm adları harf aralıklı dizilir ve PDF metin
  // katmanında harfler arasına konum kaynaklı boşluklar girer.
  kontrol(duz(i.metin).includes(duz("TEKNİK ÖZELLİKLER")), "serbest kalemin bölüm başlığı basıldı");
  kontrol(
    i.metin.includes("Redüktör Gövdesi") && i.metin.includes("Kaplin Takozu"),
    "serbest satırların etiketi ve değeri belgede"
  );
  // İSKONTO BİRİM FİYATLARA YANSITILDIYSA ayrı satır basılmaz: aynı sayıyı iki
  // kez yazmak müşteriye ikinci bir indirim vaat etmek gibi okunurdu.
  const yansitilmis = iskontoluTeklif();
  yansitilmis.payload.pricing.lines = applyDiscountToLines(
    yansitilmis.payload.pricing.lines,
    215_000
  );
  const y = await uret("teklif-iskonto-yansitilmis.pdf", yansitilmis);
  kontrol(!y.metin.includes("İSKONTOLU TOPLAM"), "yansıtılmış iskontoda ayrı satır BASILMADI");
  kontrol(
    duz(y.metin).includes(duz(fmtMoney(215000, "EUR"))),
    "yansıtılmış iskontoda TOPLAM hedefi tuttu (215.000 €)"
  );

  const gizlemeli = gizlemeliTeklif();
  const g = await uret("teklif-gizlemeli.pdf", gizlemeli);
  kontrol(!g.metin.includes(GIZLI), "gizlenen satır/grup/fiyat belgede HİÇ geçmiyor");
  kontrol(!g.metin.includes("VİNÇ ARABASI"), "gizlenen grubun BAŞLIĞI da düştü");
  kontrol(!duz(g.metin).includes(duz("999.999")), "gizlenen fiyat satırının tutarı yok");
  // Toplama girmeyen satır GÖRÜNÜR ama toplamı 223.600 € olarak bırakır.
  kontrol(g.metin.includes("Montaj Süpervizör Hizmeti"), "toplam dışı satır belgede duruyor");
  kontrol(g.metin.includes("Toplam fiyata dahil değildir"), "toplam dışı satırın dipnotu var");
  kontrol(
    duz(g.metin).includes(duz(fmtMoney(223600, "EUR"))),
    "TOPLAM toplam dışı satırdan etkilenmedi (223.600 €)"
  );
  // Değeri girilmemiş satır (Garanti) TİCARİ BLOKTA çizilmez.
  //
  // KONTROL SAYFAYA DARALTILDI: "Garanti" kelimesi 18.08.2026'dan beri
  // belgenin SON sayfasında meşru olarak geçiyor (GENEL ŞARTLAR'ın 6.
  // maddesinin başlığı, md. 9). Bütün belgede aramak, yeni bir sayfanın
  // eklenmesiyle düşen ve gerçek bir hatayı göstermeyen bir kontrol olurdu.
  const ticariSayfa = g.sayfalar.find((t) => t.includes("TOPLAM")) ?? "";
  kontrol(!ticariSayfa.includes("Garanti"), "değersiz ticari satır (Garanti) çizilmedi");
  // GENEL ŞARTLAR SON SAYFADADIR ve numaralıdır (md. 9).
  const sonSayfa = g.sayfalar[g.sayfalar.length - 1] ?? "";
  kontrol(duz(sonSayfa).includes(duz("GENEL ŞARTLAR")), "genel şartlar son sayfada");
  kontrol(duz(sonSayfa).includes(duz("1. Kapsam ve Öncelik")), "genel şartlar 1'den numaralı");
  kontrol(duz(sonSayfa).includes(duz("10. Fikri Haklar")), "on maddenin onu da basıldı");

  const c = await uret("teklif-cok-kalemli.pdf", cokKalemliTeklif());
  kontrol(c.sayfalar.length >= 10, `sekiz kalem ayrı sayfalara dağıldı (${c.sayfalar.length} sayfa)`);
  kontrol(c.metin.includes("(Opsiyonel)"), "opsiyonel satırlar rozetli");
  kontrol(
    KALEM_ADLARI.every((ad) => c.metin.includes(ad)),
    "sekiz kalemin sekizi de belgede"
  );

  console.log(hata === 0 ? "\nTÜM KONTROLLER GEÇTİ" : `\n${hata} KONTROL DÜŞTÜ`);
  if (hata > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

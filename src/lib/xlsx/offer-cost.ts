// MALİYET ÇALIŞMASININ EXCEL ÇIKTISI — İÇ BELGE.
//
// Kullanıcı isteği (19.08.2026, md. 11 ve 13): *"Maliyeti PDF İndir'in yanında
// EXCEL olarak indir seçeneği de olsun"* ve *"indirdiğim PDF ve Excel de GENEL
// bir yapıda olsun."* Dosya bu yüzden İKİ soruyu birden cevaplar: ilk sayfa EN
// GENEL ÖZETtir (yönetim orada karar verir), kalem sayfaları ise maliyeti satır
// satır açar (mühendis orada tutturur).
//
// ZİNCİR KOPYALANMAZ, ÇAĞRILIR. Sayılar PDF'in çağırdığı fonksiyonların
// aynısından gelir: `printedCostPayload` → `costModels` → `costWeights` /
// `costSteelWeights` → `costTotals` → `costOverview` / `costBreakdown`. Excel
// kendi toplamını kursaydı iki İÇ BELGE birbirini yalanlardı ve hangisinin
// doğru olduğu ancak elle tutturarak anlaşılırdı. `printedCostPayload`
// atlanırsa götürü kipteki (MALIYET-23) grubun kalem satırları basılır ama
// toplama girmez — okuyan toplamı hiç tutturamaz.
//
// HÜCREYE SAYI YAZILIR, METİN DEĞİL. `fmtMoney` / `fmtNum` ekran ve PDF
// içindir; burada değer HAM SAYIDIR ve biçim `numFmt` ile verilir. Metin
// yazılsaydı kullanıcı bir sütunu toplayamaz, pivot kuramazdı — Excel istemenin
// tek sebebi de o zaman ortadan kalkardı.
//
// EXCEL FORMÜLÜ YAZILMAZ: toplamlar hesaplanmış değerdir, `=SUM()` değil. Dosya
// bir FOTOĞRAFTIR (`excel/payroll.ts` sözleşmesi); formül yazılsaydı kullanıcı
// bir satırı süzdüğünde ya da sildiğinde dosya o günün kaydı olmaktan çıkardı.
//
// BOŞ ≠ SIFIR (değişmez md. 4 · MALIYET-13): miktarı ya da birim fiyatı
// girilmemiş satırın hücresi BOŞ kalır. Sıfır yazmak, maliyeti henüz
// girilmemiş bir vinci bedava göstermenin en kısa yoluydu.
//
// İÇ BELGE İŞARETİ HER SAYFADADIR (MALIYET-12). PDF'te damga her sayfaya
// `fixed` basılır; Excel'de sayfa altbilgisi yoktur, o yüzden işaret her
// worksheet'in künye satırında ve dosya adında durur — sekmeler ayrı ayrı
// kopyalanabilir ve tek bir sekme dışarı çıktığında damgasını da götürmelidir.

import ExcelJS from "exceljs";
import {
  HAIRLINE,
  MUTED_GRAY,
  ORION_RED,
  TOTAL_FILL,
  autoWidth,
  styleHeaderRow,
  writeTitleBlock,
} from "@/lib/excel/brand";
import { teknikDegerBuyuk } from "@/lib/offers/buyuk";
import { baslikDuzeni } from "@/lib/tr-text";
import { qtySourceLabel } from "@/lib/offers/cost/labels";
import {
  costModels,
  costSteelWeights,
  costWeights,
  printedCostPayload,
} from "@/lib/offers/cost/payload";
import { MATERIAL_PRICE_DEFS, offerRefValue } from "@/lib/offers/cost/registry";
import {
  costBreakdown,
  costGroupTotal,
  costLineAmount,
  costOverview,
  costPerKg,
  costTotals,
  type CostTotals,
} from "@/lib/offers/cost/totals";
import type { CostGroup, CostItem, CostPayload } from "@/lib/offers/cost/types";
import type { OfferPayload } from "@/lib/offers/types";

/**
 * Başlık bandının modül kimliği — `MODULE_PREFIX` (excel/brand.ts) ile aynı
 * biçimde. Kısa marka işareti bilinçlidir: bant tek satırdır ve belgenin kendi
 * adıyla yarışmamalıdır.
 */
const MODUL_ONEKI = "ORION — MALİYET ÇALIŞMASI";

/** Künye satırının ve belge sınıfının değişmez işareti (MALIYET-12). */
const IC_BELGE = "İÇ BELGE — MÜŞTERİYE VERİLMEZ";

/** Sayfaların ortak sütun sayısı — bant ve ayraç bu genişliğe basılır. */
const SUTUN = 9;

// Biçimler: PARA ve ORAN dışındaki her sayı (kg, adet, miktar) tek biçimdedir.
const SAYI = "#,##0";
const ORAN = "0%";

/**
 * PARA BİRİMİ BİÇİMİN İÇİNE YAZILIR, hücreye metin olarak DEĞİL.
 *
 * Sütun başlığına yazmak da olurdu ve bir şeyi bozardı: tek bir hücre
 * kopyalandığında birimi düşerdi. Biçimin içindeyken hücre SAYI kalır (toplanır,
 * pivota girer) ama nereye gidilirse gidilsin para birimini taşır.
 */
function paraBicimi(currency: string): string {
  const kod = (currency || "EUR").replace(/[^\p{L}\p{N}]/gu, "");
  return `#,##0" ${kod}"`;
}

/**
 * BİRİM FİYATIN BİÇİMİ AYRIDIR: hammadde fiyatları kuruşun altındadır (kesim
 * 0,05 · boya işçiliği 0,07 €/kg) ve iki hane, 0,065 €'yu 0,07 gösterip
 * satırın tutarını okuyana yanlış doğrulatırdı.
 */
function birimFiyatBicimi(currency: string): string {
  const kod = (currency || "EUR").replace(/[^\p{L}\p{N}]/gu, "");
  return `#,##0.00##" ${kod}"`;
}

// ————————————————————————————————————————————————————————— hücreler

/**
 * SAYI HÜCRESİ — `null` ise hücre BOŞ kalır (değişmez md. 4).
 *
 * `Number.isFinite` süzgeci de aynı kuralın parçasıdır: bir bölmeden çıkan
 * `Infinity` ya da `NaN`, Excel'de `#SAYI/0!` olarak görünüp toplamı da
 * hatalıya çevirirdi.
 */
function sayiHucresi(
  row: ExcelJS.Row,
  col: number,
  value: number | null | undefined,
  numFmt: string
): void {
  if (value === null || value === undefined || !Number.isFinite(value)) return;
  const c = row.getCell(col);
  c.value = value;
  c.numFmt = numFmt;
}

/**
 * YÜZDE HÜCRESİ — çekirdek yüzdeyi 0–100 verir (`%15` = `15`), Excel ise
 * `0.0%` biçiminde 0–1 bekler. Bölme burada TEK yerde yapılır; iki çağrı
 * yerinde tekrarlansaydı biri unutulduğunda hücre "%1500" gösterirdi.
 */
function yuzdeHucresi(row: ExcelJS.Row, col: number, yuzde: number | null | undefined): void {
  if (yuzde === null || yuzde === undefined || !Number.isFinite(yuzde)) return;
  const c = row.getCell(col);
  c.value = yuzde / 100;
  c.numFmt = ORAN;
}

/** 0–1 arasında verilmiş pay (kırılım `share`i) — bölme YAPILMAZ. */
function payHucresi(row: ExcelJS.Row, col: number, pay: number | null | undefined): void {
  if (pay === null || pay === undefined || !Number.isFinite(pay)) return;
  const c = row.getCell(col);
  c.value = pay;
  c.numFmt = ORAN;
}

/** Etiket / değer satırı — künye blokları için. */
function kunyeSatiri(
  ws: ExcelJS.Worksheet,
  r: number,
  etiket: string,
  deger: string,
  vurgu?: "kirmizi"
): void {
  const row = ws.getRow(r);
  row.getCell(1).value = etiket;
  row.getCell(1).font = { bold: true, size: 10 };
  row.getCell(2).value = deger;
  if (vurgu === "kirmizi") row.getCell(2).font = { bold: true, color: { argb: ORION_RED } };
}

/** Blok başlığı — sayfanın içindeki bölüm ayracı. */
function blokBasligi(ws: ExcelJS.Worksheet, r: number, metin: string): void {
  const row = ws.getRow(r);
  const c = row.getCell(1);
  c.value = metin;
  c.font = { bold: true, size: 11 };
  row.height = 18;
}

/** Açıklama / uyarı satırı — gri, küçük; tablo değildir, cümledir. */
function notSatiri(ws: ExcelJS.Worksheet, r: number, metin: string, kirmizi = false): void {
  const c = ws.getRow(r).getCell(1);
  c.value = metin;
  c.font = { size: 9, italic: !kirmizi, color: { argb: kirmizi ? ORION_RED : MUTED_GRAY } };
}

/** Tablo başlığı satırı — marka katmanının biçimiyle. */
function basliklar(ws: ExcelJS.Worksheet, r: number, adlar: readonly string[]): void {
  const row = ws.getRow(r);
  adlar.forEach((ad, i) => {
    row.getCell(i + 1).value = ad;
  });
  styleHeaderRow(row, adlar.length);
}

/** Toplam satırının zemini — okuyan gözün tabloda durduğu yer. */
function toplamBicimi(row: ExcelJS.Row, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = TOTAL_FILL;
    row.getCell(c).font = { bold: true };
  }
}

/** Veri satırının ince alt çizgisi. */
function cizgi(row: ExcelJS.Row, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).border = { bottom: { style: "thin", color: { argb: HAIRLINE } } };
  }
}

/**
 * SEKME ADI — Excel'in kendi sınırları.
 *
 * 31 karakteri aşan ya da `[ ] : * ? / \` taşıyan bir ad dosyayı BOZUK açtırır
 * ve kullanıcı hatayı "Excel çıktısı çalışmıyor" olarak görür. Aynı ad iki kez
 * kullanılırsa ExcelJS ikincisini sessizce reddeder; iki vinci aynı başlığı
 * taşıyan bir teklifte (aynı vinçten iki takım) kalem sayfalarından biri hiç
 * yazılmazdı — o yüzden ad benzersizleştirilir, kısaltma değil SIRA eklenir.
 */
function sekmeAdi(wb: ExcelJS.Workbook, ham: string): string {
  const temiz = ham.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim();
  let ad = (temiz || "Sayfa").slice(0, 31);
  let n = 2;
  while (wb.worksheets.some((w) => w.name === ad)) {
    const ek = ` (${n})`;
    ad = `${(temiz || "Sayfa").slice(0, 31 - ek.length)}${ek}`;
    n += 1;
  }
  return ad;
}

// ————————————————————————————————————————————————————————— sözleşme

export interface OfferCostWorkbookProps {
  offer: {
    offerNo: string;
    subject: string;
    customerName: string;
    currency: string;
    /** Teklifin GÜNCEL revizyonu — maliyetin geride kalıp kalmadığı buna göre. */
    offerRevNo: number | null;
  };
  costRevNo: number;
  /** HAM payload — süzgeci (`printedCostPayload`) bu modül KENDİ çağırır. */
  payload: CostPayload;
  /** Teklifin belgesi: satırların teknik karşılığı, fiyatı ve elle maliyetleri. */
  offerPayload: OfferPayload;
  company: { company: string };
  meta: { generatedAt: string };
}

/**
 * Marka bandı — HER sayfada aynı künye, İÇ BELGE işareti dahil.
 * Tablo başlığının satır numarasını döndürür; çağıran taraf satır saymaz.
 */
function bant(ws: ExcelJS.Worksheet, baslik: string, p: OfferCostWorkbookProps): number {
  return writeTitleBlock(ws, baslik, SUTUN, {
    prefix: MODUL_ONEKI,
    meta: [
      p.offer.offerNo,
      `MALİYET M${p.costRevNo}`,
      p.offer.customerName,
      p.meta.generatedAt,
      IC_BELGE,
    ],
  });
}

// ————————————————————————————————————————————————————————— 1. ÖZET

const OZET_BASLIKLARI = (cur: string) =>
  [
    "KALEM",
    "ADET",
    "ÇELİK [KG]",
    "TOPLAM AĞIRLIK [KG]",
    "ÇELİK × ADET [KG]",
    "TOPLAM × ADET [KG]",
    "BİRİM MALİYET",
    "PAKET MALİYET",
    `${cur}/KG`,
  ] as const;

function ozetSayfasi(
  wb: ExcelJS.Workbook,
  p: OfferCostWorkbookProps,
  totals: CostTotals,
  steelWeights: Record<string, number | null>
): void {
  const cur = p.payload.currency || p.offer.currency;
  const para = paraBicimi(cur);
  // BELGE DE VERİLİR: beş başlık dağıtımı ve serbest satırların elle girilen
  // ağırlıkları oradan okunur (md. 7). Verilmezse Excel özeti ekrandakinden
  // eksik çıkardı — MALIYET-24'ün yasakladığı ayrışma.
  const ozet = costOverview(totals, p.offerPayload, steelWeights, p.payload);

  const ws = wb.addWorksheet(sekmeAdi(wb, "Özet"), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  let r = bant(ws, "Maliyet Çalışması — Özet", p);

  // A — KÜNYE
  kunyeSatiri(ws, r++, "TEKLİF NO", p.offer.offerNo);
  kunyeSatiri(ws, r++, "KONU", teknikDegerBuyuk(p.offer.subject));
  kunyeSatiri(ws, r++, "MÜŞTERİ", p.offer.customerName);
  kunyeSatiri(ws, r++, "PARA BİRİMİ", cur);
  kunyeSatiri(ws, r++, "MALİYET REVİZYONU", `M${p.costRevNo}`);
  kunyeSatiri(
    ws,
    r++,
    "KURULDUĞU TEKLİF REVİZYONU",
    p.payload.sourceRevNo === null ? "—" : `R${p.payload.sourceRevNo}`
  );
  // MALİYET GERİDE KALABİLİR (MALIYET-2): teklif R1'e geçtiğinde maliyet M0'da
  // durabilir ve bu meşrudur — ama sessiz kalması kâr marjını yanlış gösterir.
  if (
    p.payload.sourceRevNo !== null &&
    p.offer.offerRevNo !== null &&
    p.payload.sourceRevNo !== p.offer.offerRevNo
  ) {
    notSatiri(
      ws,
      r++,
      `DİKKAT: teklif R${p.offer.offerRevNo}'e geçmiş — maliyet tazelenmemiş olabilir.`,
      true
    );
  }
  kunyeSatiri(ws, r++, "BELGE SINIFI", IC_BELGE, "kirmizi");
  r += 1;

  // B — ANA BAŞLIKLAR
  blokBasligi(ws, r++, "MALİYETİN ANA BAŞLIKLARI");
  basliklar(ws, r++, ["BAŞLIK", "KİP", "ORAN", "TUTAR"]);
  const anaSatir = (etiket: string, tutar: number | null, kip = "", yuzde: number | null = null) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = etiket;
    row.getCell(2).value = kip || null;
    yuzdeHucresi(row, 3, yuzde);
    sayiHucresi(row, 4, tutar, para);
    cizgi(row, 4);
    return row;
  };
  // İMALAT VE PROJE AYRI SATIRDIR AMA TOPLAMA İKİ KEZ GİRMEZ: imalat
  // `direct`in İÇİNDEDİR (totals.ts) ve altındaki DOĞRUDAN MALİYET satırı
  // ikisinin toplamıdır. Ayrı satır olarak gösterilip toplama tekrar
  // eklenseydi toplam maliyet şişer, kâr marjı olduğundan düşük çıkardı.
  anaSatir("İMALAT MALİYETİ", totals.fabrication, "çelik imalat işçiliği (fire dahil)");
  anaSatir("PROJE MALİYETİ", totals.project, "kalem kalem + proje geneli");
  toplamBicimi(anaSatir("DOĞRUDAN MALİYET (ORAN TABANI)", totals.direct, "imalat + proje"), 4);
  for (const oran of totals.rates) {
    anaSatir(
      teknikDegerBuyuk(oran.title),
      oran.amount,
      oran.mode === "oran" ? "doğrudan maliyet × oran" : "kalem",
      oran.mode === "oran" ? oran.percent : null
    );
  }
  toplamBicimi(anaSatir("TOPLAM MALİYET", totals.total), 4);
  notSatiri(
    ws,
    r++,
    "Oranların tabanı DOĞRUDAN MALİYETTİR (kullanıcı kararı, 17.08.2026): toplam = doğrudan maliyet × (1 + oranların toplamı)."
  );
  r += 1;

  // C — TEKLİF VE KÂR
  blokBasligi(ws, r++, "TEKLİF VE KÂR");
  const karSatiri = (etiket: string, tutar: number | null, kalin = false) => {
    const row = ws.getRow(r++);
    row.getCell(1).value = etiket;
    if (kalin) row.getCell(1).font = { bold: true };
    sayiHucresi(row, 2, tutar, para);
    if (kalin) row.getCell(2).font = { bold: true };
  };
  // ETİKET, ANA BAŞLIKLARDAKİ "TOPLAM MALİYET"TEN AYRIDIR ve ayrı olmak
  // ZORUNDADIR: bu satır belge toplamının ÜSTÜNE fiyat satırlarına elle
  // yazılmış maliyetleri de ekler (`costOverview`). İki farklı sayı aynı adı
  // taşısaydı belge kendi kendisiyle çelişir, okuyan hangisinin kâr hesabına
  // girdiğini ancak toplayarak anlardı.
  karSatiri("MALİYET BELGESİNİN TOPLAMI", ozet.documentTotal);
  karSatiri("FİYAT SATIRLARININ ELLE MALİYETİ", ozet.manualTotal);
  karSatiri("TOPLAM MALİYET", ozet.margin.cost, true);
  karSatiri("TEKLİF TUTARI", ozet.margin.price, true);
  karSatiri("KÂR", ozet.margin.profit, true);
  // İKİ ORAN BİRDEN (MALIYET-11): "%25 kâr" cümlesi satışın %25'ini de
  // maliyetin %25'ini de anlatabilir ve ikisi aynı belgede farklı sayılardır.
  const marj = ws.getRow(r++);
  marj.getCell(1).value = "KÂR / SATIŞ";
  yuzdeHucresi(marj, 2, ozet.margin.marginPercent);
  const markup = ws.getRow(r++);
  markup.getCell(1).value = "KÂR / MALİYET";
  yuzdeHucresi(markup, 2, ozet.margin.markupPercent);
  r += 1;

  // ELLE MALİYETLER — yalnız SERBEST fiyat satırlarından (MALIYET-11).
  if (ozet.manualLines.length > 0) {
    blokBasligi(ws, r++, "FİYAT SATIRLARININ ELLE MALİYETLERİ (KALEME BAĞLI OLMAYAN)");
    basliklar(ws, r++, ["AÇIKLAMA", "TUTAR"]);
    for (const l of ozet.manualLines) {
      const row = ws.getRow(r++);
      row.getCell(1).value = teknikDegerBuyuk(l.description);
      sayiHucresi(row, 2, l.amount, para);
      cizgi(row, 2);
    }
    const t = ws.getRow(r++);
    t.getCell(1).value = "ELLE MALİYET TOPLAMI";
    sayiHucresi(t, 2, ozet.manualTotal, para);
    toplamBicimi(t, 2);
    r += 1;
  }

  // E — KALEM BAZINDA
  blokBasligi(ws, r++, "KALEM BAZINDA");
  const kalemBaslikSatiri = r;
  basliklar(ws, r++, OZET_BASLIKLARI(cur));
  for (const i of ozet.items) {
    const row = ws.getRow(r++);
    row.getCell(1).value = teknikDegerBuyuk(i.title) || "—";
    sayiHucresi(row, 2, i.qty, SAYI);
    sayiHucresi(row, 3, i.steelKg, SAYI);
    sayiHucresi(row, 4, i.weightKg, SAYI);
    sayiHucresi(row, 5, i.steelPackageKg, SAYI);
    sayiHucresi(row, 6, i.weightPackageKg, SAYI);
    sayiHucresi(row, 7, i.unit, para);
    sayiHucresi(row, 8, i.package, para);
    // Özet sayfasındaki hesaplanan EUR/kg metriği de diğer özet rakamları
    // gibi ondalıksız görünür; hammadde defterindeki gerçek giriş fiyatları
    // aşağıdaki ayrı tabloda hassasiyetini korur.
    sayiHucresi(row, 9, costPerKg(i.unit, i.weightKg), SAYI);
    cizgi(row, SUTUN);
  }
  const kalemToplam = ws.getRow(r++);
  kalemToplam.getCell(1).value = "KALEM TOPLAMI";
  sayiHucresi(kalemToplam, 5, ozet.steelKg, SAYI);
  sayiHucresi(kalemToplam, 6, ozet.weightKg, SAYI);
  // PAKET MALİYET SÜTUNUNUN TOPLAMI proje geneli TAŞIMAZ: doğrudan maliyet
  // (`totals.direct`) bunun üstüne bir de PROJE GENELİ grubunu ekler. İkisini
  // aynı hücrede göstermek, okuyanın sütunu toplayıp tutturamamasına yol
  // açardı — proje geneli kendi sayfasında ayrı durur.
  sayiHucresi(kalemToplam, 8, ozet.packageTotal, para);
  toplamBicimi(kalemToplam, SUTUN);
  r += 1;

  // MALİYETİ AÇILMAMIŞ KALEMLER — sayılmaz ama SÖYLENİR (costOverview).
  if (ozet.uncostedItems.length > 0) {
    blokBasligi(ws, r++, "MALİYETİ AÇILMAMIŞ TEKLİF KALEMLERİ");
    notSatiri(
      ws,
      r++,
      "Bu kalemler teklif tutarına GİRER, maliyet toplamına GİRMEZ — kâr olduğundan yüksek görünür.",
      true
    );
    for (const i of ozet.uncostedItems) {
      ws.getRow(r++).getCell(1).value = teknikDegerBuyuk(i.title) || "—";
    }
    r += 1;
  }

  // F — HAMMADDE BİRİM FİYATLARI (MALIYET-22): "bu toplam hangi sac fiyatıyla
  // çıktı" sorusunun cevabı özette de durmalıdır; o soru altı ay sonra sorulur.
  blokBasligi(ws, r++, "HAMMADDE BİRİM FİYATLARI");
  basliklar(ws, r++, ["AD", "BİRİM", "BİRİM FİYAT"]);
  for (const d of MATERIAL_PRICE_DEFS) {
    const row = ws.getRow(r++);
    row.getCell(1).value = d.label;
    row.getCell(2).value = `${cur}/${d.unit}`;
    sayiHucresi(row, 3, p.payload.materialPrices?.[d.key] ?? null, birimFiyatBicimi(cur));
    cizgi(row, 3);
  }
  r += 1;

  if (p.payload.notes.trim()) {
    blokBasligi(ws, r++, "NOTLAR");
    for (const satir of p.payload.notes.split(/\r?\n/)) {
      ws.getRow(r++).getCell(1).value = satir;
    }
  }

  // Kalem tablosunun başlığı donar: özet uzun bir sayfadır ve okuyan aşağı
  // indiğinde hangi sütunun ne olduğunu kaybetmemelidir.
  ws.views = [{ state: "frozen", ySplit: kalemBaslikSatiri }];
  autoWidth(ws, 12, 46);
  // Basılan uzun cümleler (uyarı ve not satırları) ilk sütunda yaşar ve
  // `autoWidth` birleşik olmayan her hücreyi ölçtüğü için sütunu 46 karaktere
  // kadar şişirirdi; kalem adları için 34 yeter.
  ws.getColumn(1).width = 34;
}

// ————————————————————————————————————————————— 2. ANA KALEM KIRILIMI

function kirilimSayfasi(
  wb: ExcelJS.Workbook,
  p: OfferCostWorkbookProps,
  totals: CostTotals,
  basilan: CostPayload
): void {
  const cur = p.payload.currency || p.offer.currency;
  const para = paraBicimi(cur);
  // Kırılım BASILAN payload'dan çıkar (PDF ile aynı çağrı): götürü kipteki
  // grubun kalem satırları toplama girmediği gibi kırılımda da yer almaz.
  const satirlar = costBreakdown(basilan, totals).sort((a, b) => b.amount - a.amount);

  const ws = wb.addWorksheet(sekmeAdi(wb, "Ana Kalem Kırılımı"), {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  let r = bant(ws, "Ana Kalem Kırılımı", p);
  notSatiri(
    ws,
    r++,
    "Gruplar bütün kalemler boyunca toplanır (adetle çarpılmış); pay DOĞRUDAN MALİYETE göredir."
  );
  r += 1;

  const baslikSatiri = r;
  basliklar(ws, r++, ["GRUP", "TUTAR", "PAY"]);
  for (const s of satirlar) {
    const row = ws.getRow(r++);
    row.getCell(1).value = teknikDegerBuyuk(s.title);
    sayiHucresi(row, 2, s.amount, para);
    payHucresi(row, 3, s.share);
    cizgi(row, 3);
  }
  const t = ws.getRow(r++);
  t.getCell(1).value = "DOĞRUDAN MALİYET";
  sayiHucresi(t, 2, totals.direct, para);
  payHucresi(t, 3, totals.direct === null ? null : 1);
  toplamBicimi(t, 3);

  ws.views = [{ state: "frozen", ySplit: baslikSatiri }];
  autoWidth(ws, 12, 46);
}

// ————————————————————————————————————————————— 3. KALEM SAYFALARI

const KALEM_BASLIKLARI = [
  "GRUP",
  "KALEM",
  "MİKTAR",
  "BİRİM",
  "BİRİM FİYAT",
  "TUTAR",
  "MİKTAR KAYNAĞI",
  "TEKLİFTE",
  "NOT",
] as const;

/**
 * Bir maliyet grubunun satırları — kalem sayfasında ve proje geneli sayfasında
 * AYNI biçimde. GRUP ADI HER SATIRDA TEKRARLANIR: sütun başlığı altında bir
 * kez yazılsaydı tablo süzüldüğünde ya da pivota alındığında satırların hangi
 * gruba ait olduğu kaybolurdu.
 */
function grupSatirlari(
  ws: ExcelJS.Worksheet,
  baslangic: number,
  group: CostGroup,
  cur: string,
  refOf: (groupKey: string, lineKey: string) => string | null
): number {
  const para = paraBicimi(cur);
  const hassasBirimFiyat = birimFiyatBicimi(cur);
  let r = baslangic;
  const grupAdi = teknikDegerBuyuk(group.title);
  for (const l of group.lines) {
    const row = ws.getRow(r++);
    row.getCell(1).value = grupAdi;
    row.getCell(2).value = teknikDegerBuyuk(l.label) || "—";
    sayiHucresi(row, 3, l.qty, SAYI);
    row.getCell(4).value = baslikDuzeni(l.unit) || "";
    // Malzeme şeridinden gelen €/kg fiyatlarında 0,70 gibi hassasiyet
    // zorunludur; diğer satın alma fiyatları kullanıcının istediği biçimde
    // ondalıksız ve binlik ayraçlı görünür.
    sayiHucresi(row, 5, l.unitPrice, l.priceSource ? hassasBirimFiyat : para);
    sayiHucresi(row, 6, costLineAmount(l), para);
    // MİKTARIN KAYNAĞI YAZILIR (MALIYET-4): iki kaynak asla toplanmaz ve
    // hangisinin geçerli olduğu belgeye bakarak anlaşılmalıdır.
    row.getCell(7).value = l.qtyManual ? "elle" : qtySourceLabel(l.qtySource) ?? "elle";
    row.getCell(8).value = refOf(group.key, l.key) ?? "";
    row.getCell(9).value = l.note ?? "";
    cizgi(row, KALEM_BASLIKLARI.length);
  }
  const t = ws.getRow(r++);
  t.getCell(1).value = grupAdi;
  t.getCell(2).value = "GRUP TOPLAMI";
  sayiHucresi(t, 6, costGroupTotal(group), para);
  toplamBicimi(t, KALEM_BASLIKLARI.length);
  return r;
}

function kalemSayfasi(
  wb: ExcelJS.Workbook,
  p: OfferCostWorkbookProps,
  totals: CostTotals,
  item: CostItem,
  sira: number,
  eksik: readonly string[],
  steelKg: number | null,
  weightKg: number | null
): void {
  const cur = p.payload.currency || p.offer.currency;
  const para = paraBicimi(cur);
  const ws = wb.addWorksheet(sekmeAdi(wb, `${sira}. ${item.title || "KALEM"}`), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  let r = bant(ws, `Maliyet Kalemleri — ${item.title || "Kalem"}`, p);

  const kunye = [
    item.craneType,
    item.inputs.capacityT === null ? null : `${item.inputs.capacityT} ton`,
    item.inputs.spanM === null ? null : `${item.inputs.spanM} m açıklık`,
    item.inputs.liftHeightM === null ? null : `${item.inputs.liftHeightM} m kaldırma`,
    item.inputs.craneClass,
  ]
    .filter(Boolean)
    .join(" · ");
  kunyeSatiri(ws, r++, "KALEM", teknikDegerBuyuk(item.title) || "—");
  if (kunye) kunyeSatiri(ws, r++, "TEKNİK", teknikDegerBuyuk(kunye));
  const adetSatiri = ws.getRow(r++);
  adetSatiri.getCell(1).value = "ADET";
  adetSatiri.getCell(1).font = { bold: true, size: 10 };
  sayiHucresi(adetSatiri, 2, item.qty, SAYI);
  const agirlik = ws.getRow(r++);
  agirlik.getCell(1).value = "ÇELİK / TOPLAM AĞIRLIK [KG]";
  agirlik.getCell(1).font = { bold: true, size: 10 };
  sayiHucresi(agirlik, 2, steelKg, SAYI);
  sayiHucresi(agirlik, 3, weightKg, SAYI);
  // MODELİN ÇALIŞAMADIĞI DAL GEREKÇESİYLE YAZILIR (MALIYET-13): eksik girdi
  // sessizce sıfır sayılmaz, cümleyle söylenir.
  for (const cumle of eksik) notSatiri(ws, r++, cumle, true);
  r += 1;

  const baslikSatiri = r;
  basliklar(ws, r++, KALEM_BASLIKLARI);
  const refOf = (groupKey: string, lineKey: string) =>
    offerRefValue(p.offerPayload, item.offerItemId, groupKey, lineKey);
  for (const g of item.groups) {
    // GÖTÜRÜ KİP BELGEDE YAZAR (MALIYET-23): `printedCostPayload` götürü
    // kipte kalem satırlarını süzer; işaret olmasaydı okuyan on üç satırlık
    // bir grubun neden tek satır bastığını anlayamaz, "eksik" sanırdı.
    if (g.lump) notSatiri(ws, r++, `${teknikDegerBuyuk(g.title)} — GÖTÜRÜ (TEK FİYAT)`);
    r = grupSatirlari(ws, r, g, cur, refOf);
  }

  const kalemToplam = totals.items.find((i) => i.id === item.id);
  r += 1;
  const birim = ws.getRow(r++);
  birim.getCell(1).value = "KALEM BİRİM MALİYETİ";
  sayiHucresi(birim, 6, kalemToplam?.unit ?? null, para);
  toplamBicimi(birim, KALEM_BASLIKLARI.length);
  const paket = ws.getRow(r++);
  paket.getCell(1).value = "PAKET MALİYET (BİRİM × ADET)";
  sayiHucresi(paket, 6, kalemToplam?.package ?? null, para);
  toplamBicimi(paket, KALEM_BASLIKLARI.length);

  ws.views = [{ state: "frozen", ySplit: baslikSatiri }];
  autoWidth(ws, 10, 40);
}

// ————————————————————————————————— 4. PROJE GENELİ VE ORANLI GRUPLAR

function projeGeneliSayfasi(
  wb: ExcelJS.Workbook,
  p: OfferCostWorkbookProps,
  totals: CostTotals,
  basilan: CostPayload
): void {
  const cur = p.payload.currency || p.offer.currency;
  const para = paraBicimi(cur);
  const ws = wb.addWorksheet(sekmeAdi(wb, "Proje Geneli ve Oranlar"), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  let r = bant(ws, "Proje Geneli ve Oranlı Gruplar", p);
  notSatiri(
    ws,
    r++,
    "Tek bir vince atfedilemeyen kalemler ve oranla hesaplanan gruplar; kalem sayfalarının toplamına EK olarak doğrudan maliyete girer."
  );
  r += 1;

  const baslikSatiri = r;
  basliklar(ws, r++, KALEM_BASLIKLARI);
  // Proje genelinin satırları bir kaleme bağlı değildir; teklifte karşılığı da
  // yoktur (`offerRefValue` kalem kimliği ister) — sütun boş kalır.
  r = grupSatirlari(ws, r, basilan.general, cur, () => null);
  r += 1;

  blokBasligi(ws, r++, "ORANLI GRUPLAR");
  notSatiri(
    ws,
    r++,
    "Kip TEKTİR: oran kipinde satırlar hiç okunmaz, kalem kipinde yüzde hiç okunmaz (MALIYET-5)."
  );
  basliklar(ws, r++, ["GRUP", "KİP", "ORAN", "TABAN", "TUTAR"]);
  for (const oran of totals.rates) {
    const row = ws.getRow(r++);
    row.getCell(1).value = teknikDegerBuyuk(oran.title);
    row.getCell(2).value = oran.mode === "oran" ? "oran" : "kalem";
    yuzdeHucresi(row, 3, oran.mode === "oran" ? oran.percent : null);
    sayiHucresi(row, 4, oran.mode === "oran" ? totals.direct : null, para);
    sayiHucresi(row, 5, oran.amount, para);
    cizgi(row, 5);
  }
  const oranToplam = ws.getRow(r++);
  oranToplam.getCell(1).value = "ORANLI GRUPLAR TOPLAMI";
  sayiHucresi(oranToplam, 5, totals.rateTotal, para);
  toplamBicimi(oranToplam, 5);
  r += 1;

  // `kalem` kipindeki oranlı grubun satırları da basılır: yüzde okunmaz ama
  // tutar o satırlardan gelir ve okuyan onu tutturabilmelidir.
  for (const rate of basilan.rates) {
    if (rate.mode !== "kalem" || rate.lines.length === 0) continue;
    blokBasligi(ws, r++, `${teknikDegerBuyuk(rate.title)} — KALEMLER`);
    basliklar(ws, r++, ["KALEM", "MİKTAR", "BİRİM", "BİRİM FİYAT", "TUTAR", "NOT"]);
    for (const l of rate.lines) {
      const row = ws.getRow(r++);
      row.getCell(1).value = teknikDegerBuyuk(l.label) || "—";
      sayiHucresi(row, 2, l.qty, SAYI);
      row.getCell(3).value = baslikDuzeni(l.unit) || "";
      sayiHucresi(row, 4, l.unitPrice, birimFiyatBicimi(cur));
      sayiHucresi(row, 5, costLineAmount(l), para);
      row.getCell(6).value = l.note ?? "";
      cizgi(row, 6);
    }
    r += 1;
  }

  ws.views = [{ state: "frozen", ySplit: baslikSatiri }];
  autoWidth(ws, 10, 40);
}

// ————————————————————————————————————————————————————————— çalışma kitabı

/**
 * MALİYET ÇALIŞMASININ ÇALIŞMA KİTABI.
 *
 * SAFTIR (değişmez md. 7): DB/HTTP/React bilmez. Route handler veriyi çeker,
 * burası kitabı kurar — PDF'in `renderOfferCostPdf`i ile aynı ayrım ve aynı
 * prop biçimi, ki uç ikisine de AYNI nesneyi verebilsin.
 *
 * SAYFA SIRASI KARARIN SIRASIDIR (PDF'in sırası): önce ÖZET, sonra KIRILIM,
 * sonra kalem kalem maliyet, en sonda proje geneli ve oranlar. Yönetici ilk
 * sekmede kararını verebilmeli, detayı ancak sorusu varsa açmalıdır.
 */
export function buildOfferCostWorkbook(p: OfferCostWorkbookProps): ExcelJS.Workbook {
  const basilan = printedCostPayload(p.payload);
  const models = costModels(p.payload);
  const weights = costWeights(models);
  const totals = costTotals(basilan, weights);
  const steelWeights = costSteelWeights(models);

  const wb = new ExcelJS.Workbook();
  wb.creator = p.company.company;
  wb.created = new Date();
  // Belgenin sınıfı dosyanın ÖZELLİKLERİNDE de durur: sekmeler tek tek
  // kopyalansa bile kitabın kendisi ne olduğunu söyler (MALIYET-12).
  wb.title = `Maliyet Çalışması — ${p.offer.offerNo} M${p.costRevNo}`;
  wb.subject = IC_BELGE;

  ozetSayfasi(wb, p, totals, steelWeights);
  kirilimSayfasi(wb, p, totals, basilan);
  basilan.items.forEach((item, i) => {
    kalemSayfasi(
      wb,
      p,
      totals,
      item,
      i + 1,
      models[item.id]?.eksik ?? [],
      steelWeights[item.id] ?? null,
      weights[item.id] ?? null
    );
  });
  projeGeneliSayfasi(wb, p, totals, basilan);

  return wb;
}

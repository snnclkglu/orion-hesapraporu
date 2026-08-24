// MALİYET ÇALIŞMASININ EXCEL ÇIKTISI — İÇ BELGE.
//
// Kullanıcı isteği (19.08.2026, md. 11 ve 13): *"Maliyeti PDF İndir'in yanında
// EXCEL olarak indir seçeneği de olsun"* ve *"indirdiğim PDF ve Excel de GENEL
// bir yapıda olsun."* Dosya bu yüzden İKİ soruyu birden cevaplar: ilk sayfa EN
// GENEL ÖZETtir (yönetim orada karar verir), kalem çizelgesi ise maliyeti satır
// satır açar (mühendis orada tutturur).
//
// KİTAP İKİ SEKMEDİR VE BU BİR TASARIM KARARIDIR (kullanıcı isteği,
// 22.08.2026: *"kompakt hale getirmek istiyorum … sayfalarca doküman
// olmasın"*). Eskiden vinç başına bir sekme, üstüne kırılım ve proje geneli
// sekmeleri vardı — iki vinçli bir teklifte beş sekme. Hepsi AYNI sütunları
// taşıyordu, yani bölünme bir yapı farkı değil bir bölmeydi; düz tek tablo
// hem daha kısa hem Excel'in kendi erdemine (süzgeç, pivot) uygun.
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
  styleHeaderRow,
  writeTitleBlock,
} from "@/lib/excel/brand";
import { teknikDegerBuyuk } from "@/lib/offers/buyuk";
import { baslikDuzeni } from "@/lib/tr-text";
import {
  costModels,
  costSteelWeights,
  costWeights,
  printedCostPayload,
} from "@/lib/offers/cost/payload";
import { MATERIAL_PRICE_DEFS, offerRefValue } from "@/lib/offers/cost/registry";
import { costHeatArgb, costLargestAmount } from "@/lib/offers/cost/heat";
import {
  costBreakdown,
  costLineAmount,
  costOverview,
  costPerKg,
  costTotals,
  type CostTotals,
} from "@/lib/offers/cost/totals";
import type { CostLine, CostPayload } from "@/lib/offers/cost/types";
import type { OfferPayload } from "@/lib/offers/types";

/**
 * Başlık bandının modül kimliği — `MODULE_PREFIX` (excel/brand.ts) ile aynı
 * biçimde. Kısa marka işareti bilinçlidir: bant tek satırdır ve belgenin kendi
 * adıyla yarışmamalıdır.
 */
const MODUL_ONEKI = "ORION — MALİYET ÇALIŞMASI";

/** Künye satırının ve belge sınıfının değişmez işareti (MALIYET-12). */
const IC_BELGE = "İÇ BELGE — MÜŞTERİYE VERİLMEZ";

/**
 * Marka bandının kaplayacağı sütun sayısı.
 *
 * Her iki sayfa sekiz sütunluk aynı dikey baskı genişliğini kullanır; başlık
 * bandı böylece her yaprakta aynı yerde biter.
 */
const SUTUN = 8;

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
 * ISI RENKLİ SAYI HÜCRESİ — sayının BÜYÜKLÜĞÜNÜ mürekkebiyle söyler.
 *
 * Kullanıcı isteği (23.08.2026, md. 4): *"İndirilen teklif maliyet pdf ve
 * excellerde de renklendirme kullan."* Rampa ekranınkiyle AYNIDIR
 * (`costHeatArgb` → `.oc-amount`, MALIYET-44) ve tek bir yerden gelir;
 * Excel'e ayrı bir renk tablosu yazmak, aynı sayının üç belgede üç farklı
 * renk alması demekti.
 *
 * RENK TEK TAŞIYICI DEĞİLDİR (WCAG 1.4.1'in çizelgedeki karşılığı): sayının
 * kendisi zaten hücrededir ve süzülebilir, sıralanabilir. Renk yalnız gözü
 * hızlandırır. HÜCRE SAYI KALIR — dolgu değil YAZI rengi değişir, yoksa
 * koşullu biçimlendirme kuran kullanıcı kendi zeminini kaybederdi.
 */
function isiliSayi(
  row: ExcelJS.Row,
  col: number,
  value: number | null | undefined,
  numFmt: string,
  taban: number
): void {
  sayiHucresi(row, col, value, numFmt);
  const argb = costHeatArgb(value ?? null, taban);
  if (argb === null) return;
  const c = row.getCell(col);
  c.font = { ...(c.font ?? {}), color: { argb } };
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

function ozetSayfasi(
  wb: ExcelJS.Workbook,
  p: OfferCostWorkbookProps,
  totals: CostTotals,
  basilan: CostPayload,
  steelWeights: Record<string, number | null>,
  models: Record<string, { eksik: readonly string[] } | undefined>
): void {
  const cur = p.payload.currency || p.offer.currency;
  const para = paraBicimi(cur);
  // BELGE DE VERİLİR: beş başlık dağıtımı ve serbest satırların elle girilen
  // ağırlıkları oradan okunur (md. 7). Verilmezse Excel özeti ekrandakinden
  // eksik çıkardı — MALIYET-24'ün yasakladığı ayrışma.
  const ozet = costOverview(totals, p.offerPayload, steelWeights, p.payload);

  const ws = wb.addWorksheet(sekmeAdi(wb, "Özet"), {
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
    },
  });
  ws.views = [{ showGridLines: false }];
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
  // NOT EXCEL'DE KALIR, PDF'TEN KALKTI (kullanıcı isteği 23.08.2026, md. 5
  // yalnız PDF'i saydı). Ayrım bilinçli TUTULDU: Excel üzerinde ÇALIŞILAN bir
  // çizelgedir ve ORAN sütununu görüp tabanı arayan okuyucu buradadır; PDF ise
  // okunan bir belgedir ve orada aynı kural ara toplamın etiketinde zaten
  // yazılıdır ("DOĞRUDAN MALİYET (ORAN TABANI)").
  notSatiri(
    ws,
    r++,
    "Oranların tabanı DOĞRUDAN MALİYETTİR: toplam = doğrudan maliyet × (1 + oranların toplamı)."
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

  // İlk basılı sayfa yönetim kararını tek başına taşır; kalem özeti ikinci
  // dikey sayfada başlar. Geniş bir çizelgeyi A4'e küçültmek yerine içerik
  // PDF gibi anlamlı yapraklara bölünür.
  ws.getRow(r).addPageBreak();

  // D — MALİYET ÖZETİ: DİKEY SAYFAYA SIĞAN TEK LİSTE
  blokBasligi(ws, r++, "MALİYET ÖZETİ");
  notSatiri(
    ws,
    r++,
    "Vinçler ve serbest fiyat satırları tek listede; ayrıntılı gider dağılımı aşağıdaki bölümlerde ve Maliyet Kalemleri sayfasındadır."
  );
  basliklar(ws, r++, ["KALEM", "TÜR", "ADET", "ÇELİK KG", "TOPLAM KG", "MALİYET", `${cur}/KG`]);
  const enBuyukCelik = costLargestAmount([
    ...ozet.items.map((i) => i.steelPackageKg),
    ...ozet.manualLines.map((l) => l.steelKg),
  ]);
  const enBuyukAgirlik = costLargestAmount([
    ...ozet.items.map((i) => i.weightPackageKg),
    ...ozet.manualLines.map((l) => l.totalKg),
  ]);
  const enBuyukMaliyet = costLargestAmount([
    ...ozet.items.map((i) => i.headings.loaded),
    ...ozet.manualLines.map((l) => l.amount),
  ]);

  for (const i of ozet.items) {
    const row = ws.getRow(r++);
    row.getCell(1).value = teknikDegerBuyuk(i.title) || "—";
    row.getCell(2).value = "vinç";
    sayiHucresi(row, 3, i.qty, SAYI);
    isiliSayi(row, 4, i.steelPackageKg, SAYI, enBuyukCelik);
    isiliSayi(row, 5, i.weightPackageKg, SAYI, enBuyukAgirlik);
    isiliSayi(row, 6, i.headings.loaded, para, enBuyukMaliyet);
    sayiHucresi(row, 7, costPerKg(i.unit, i.weightKg), SAYI);
    cizgi(row, 7);
  }
  for (const l of ozet.manualLines) {
    const row = ws.getRow(r++);
    row.getCell(1).value = teknikDegerBuyuk(l.description) || "—";
    row.getCell(2).value = "fiyat satırı";
    isiliSayi(row, 4, l.steelKg, SAYI, enBuyukCelik);
    isiliSayi(row, 5, l.totalKg, SAYI, enBuyukAgirlik);
    isiliSayi(row, 6, l.amount, para, enBuyukMaliyet);
    cizgi(row, 7);
  }
  const kalemToplam = ws.getRow(r++);
  kalemToplam.getCell(1).value = "TOPLAM";
  sayiHucresi(kalemToplam, 4, ozet.steelKgAll, SAYI);
  sayiHucresi(kalemToplam, 5, ozet.weightKgAll, SAYI);
  sayiHucresi(kalemToplam, 6, ozet.margin.cost, para);
  toplamBicimi(kalemToplam, 7);
  r += 1;

  // DAĞITILAMAYAN YÜK SESSİZ GEÇİLMEZ (ekranla aynı uyarı).
  if (Math.abs(ozet.unallocated) > 0) {
    notSatiri(
      ws,
      r++,
      `Proje geneli ve oranlı giderlerin ${ozet.unallocated.toFixed(0)} ${cur} kadarı hiçbir kaleme dağıtılamadı — dağıtım paket maliyete göredir, fiyatı girilmemiş kalemin payı sıfırdır.`,
      true
    );
    r += 1;
  }

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

  // E — ANA KALEM KIRILIMI (kendi sekmesinden BURAYA taşındı)
  //
  // Sekiz satırlık bir tablo için ayrı bir sekme açmak, özeti okuyan kişiyi
  // "bu 51.000 € neyin payı" sorusunda başka bir yaprağa gönderiyordu. Kırılım
  // özetin bir parçasıdır; ayrı sekmede yaşaması kompaktlığın tersiydi.
  blokBasligi(ws, r++, "ANA KALEM KIRILIMI");
  notSatiri(
    ws,
    r++,
    "Gruplar bütün kalemler boyunca toplanır (adetle çarpılmış); pay DOĞRUDAN MALİYETE göredir."
  );
  basliklar(ws, r++, ["GRUP", "TUTAR", "PAY"]);
  const kirilim = costBreakdown(basilan, totals).sort((a, b) => b.amount - a.amount);
  for (const s of kirilim) {
    const row = ws.getRow(r++);
    row.getCell(1).value = teknikDegerBuyuk(s.title);
    sayiHucresi(row, 2, s.amount, para);
    payHucresi(row, 3, s.share);
    cizgi(row, 3);
  }
  const kirilimToplam = ws.getRow(r++);
  kirilimToplam.getCell(1).value = "DOĞRUDAN MALİYET";
  sayiHucresi(kirilimToplam, 2, totals.direct, para);
  payHucresi(kirilimToplam, 3, totals.direct === null ? null : 1);
  toplamBicimi(kirilimToplam, 3);
  r += 1;

  // F — KALEM KÜNYELERİ (kalem sekmelerinden BURAYA taşındı)
  //
  // Teknik künye ve MODELİN ÇALIŞAMADIĞI DAL (MALIYET-13) kalem sekmelerinin
  // tepesinde duruyordu; sekmeler kalkınca bu bilginin düşmemesi gerekiyordu —
  // eksik girdi sessizce sıfır sayılmaz, cümleyle söylenir.
  if (basilan.items.length > 0) {
    blokBasligi(ws, r++, "KALEM KÜNYELERİ");
    basliklar(ws, r++, ["KALEM", "TEKNİK", "ADET"]);
    for (const item of basilan.items) {
      const kunye = [
        item.craneType,
        item.inputs.capacityT === null ? null : `${item.inputs.capacityT} ton`,
        item.inputs.spanM === null ? null : `${item.inputs.spanM} m açıklık`,
        item.inputs.liftHeightM === null ? null : `${item.inputs.liftHeightM} m kaldırma`,
        item.inputs.craneClass,
      ]
        .filter(Boolean)
        .join(" · ");
      const row = ws.getRow(r++);
      row.getCell(1).value = teknikDegerBuyuk(item.title) || "—";
      row.getCell(2).value = teknikDegerBuyuk(kunye);
      sayiHucresi(row, 3, item.qty, SAYI);
      cizgi(row, 3);
      for (const cumle of models[item.id]?.eksik ?? []) notSatiri(ws, r++, cumle, true);
    }
    r += 1;
  }

  // G — HAMMADDE BİRİM FİYATLARI (MALIYET-22): "bu toplam hangi sac fiyatıyla
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

  // MODEL KATSAYILARI BU ÇIKTIDA YOKTUR (kullanıcı isteği 23.08.2026, md. 8:
  // *"Hesaplar ve MODEL KATSAYILARI kısmı maliyet hem pdf hem excelde
  // olmasın."*). Kırk satır, okunma sıklığı belgedeki en düşük olan blok.
  //
  // MALIYET-6 DEĞİŞMEDİ: katsayılar hâlâ BELGEYE aittir ve `payload.params`ta
  // saklanır; yalnız BASILMAZLAR. Kaydın kendisi kaynaktır — bir revizyonun
  // katsayıları ekranda Katsayılar bölümünden okunur.

  if (p.payload.notes.trim()) {
    blokBasligi(ws, r++, "NOTLAR");
    for (const satir of p.payload.notes.split(/\r?\n/)) {
      ws.getRow(r++).getCell(1).value = satir;
    }
  }

  // BAŞLIK DONDURULMAZ (kullanıcı isteği 23.08.2026, md. 9: *"excelde üst satır
  // dondurma olmasın"*). Donmuş bölme kullanıcının kendi görünümüne el koyar:
  // dosyayı açan kişi kaydırırken pencerenin üst kısmının neden takılı
  // kaldığını çözmek zorunda kalıyordu ve dondurmayı kaldırmak Excel'de bir
  // menü gezisidir. Sütun başlıkları zaten tablonun ilk satırındadır.
  [34, 16, 10, 14, 14, 18, 12, 3].forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  ws.pageSetup.printArea = `A1:G${Math.max(1, r)}`;
  ws.headerFooter.oddFooter = `&L${IC_BELGE}&R&P / &N`;
}

// ————————————————————————————————— 2. MALİYET KALEMLERİ (TEK ÇİZELGE)

/**
 * MALİYET KALEMLERİ — bütün kalemler, proje geneli ve oranlı grup satırları
 * TEK DÜZ TABLODA.
 *
 * Kullanıcı isteği (22.08.2026): *"kompakt hale getirmek istiyorum … sayfalarca
 * doküman olmasın."* Kitap her vinç için ayrı bir sekme, üstüne bir de "Proje
 * Geneli ve Oranlar" sekmesi açıyordu: iki vinçli bir teklifte beş sekme.
 * Sekmeler aynı sütunları taşıyordu, yani ayrım bir YAPI değil bir BÖLMEYDİ.
 *
 * DÜZ TABLO EXCEL'İN KENDİ ERDEMİDİR: KAYNAK sütunu süzülür, pivot kurulur,
 * "hangi vinçte elektrik ne tutuyor" sorusu tek tıkla cevaplanır. Bölünmüş
 * sekmelerde aynı soru için sekmeler arasında elle toplama yapmak gerekiyordu.
 *
 * GRUP TOPLAMI SATIRI YAZILMAZ ve bu bilinçlidir: süzülebilir bir tabloda ara
 * toplam satırı, pivotta ve `SUM`da İKİNCİ KEZ sayılır. Grup toplamları
 * özetteki ANA KALEM KIRILIMI bloğundadır; kalem bazındaki dağılımı ise
 * pivotun kendisi verir.
 *
 * PAKET TUTAR SÜTUNU TOPLANABİLİR OLANIDIR: satırın TUTAR'ı BİR adedin
 * maliyetidir (`costLineAmount`), paket ise adetle çarpılmış hâli. İki vinçli
 * bir teklifte TUTAR sütununu toplayan okuyucu doğrudan maliyeti yarı bulurdu.
 */
const KALEM_BASLIKLARI = [
  "KAYNAK",
  "GRUP",
  "KALEM",
  "MİKTAR",
  "BİRİM",
  "BİRİM FİYAT",
  "TOPLAM",
  "AÇIKLAMA",
] as const;

/** Sütun numaraları — başlık listesiyle AYNI sıradan; elle sayılmaz. */
const KS = {
  kaynak: 1,
  grup: 2,
  kalem: 3,
  miktar: 4,
  birim: 5,
  birimFiyat: 6,
  toplam: 7,
  aciklama: 8,
} as const;

/**
 * En küçük ortak şekil: hem `CostGroup` hem `CostRateGroup` bunu karşılar.
 * Tip zorlaması (`as unknown as CostGroup`) YAZILMAZ — zorlama, iki tipten
 * biri değiştiğinde derleyicinin susması demektir.
 */
interface YazilabilirGrup {
  key: string;
  title: string;
  lines: readonly CostLine[];
  lump?: boolean;
}

function grupSatirlari(
  ws: ExcelJS.Worksheet,
  baslangic: number,
  kaynak: string,
  adet: number | null,
  group: YazilabilirGrup,
  cur: string,
  /** Isı ölçeğinin tabanı — ÇİZELGENİN en büyük satır tutarı (MALIYET-44). */
  enBuyukTutar: number,
  refOf: (groupKey: string, lineKey: string) => string | null
): number {
  const para = paraBicimi(cur);
  const hassasBirimFiyat = birimFiyatBicimi(cur);
  let r = baslangic;
  const grupAdi = teknikDegerBuyuk(group.title);
  // GÖTÜRÜ KİP SATIRDA YAZAR (MALIYET-23): `printedCostPayload` götürü kipte
  // kalem satırlarını süzer; işaret olmasaydı okuyan on üç satırlık bir grubun
  // neden tek satır bastığını anlayamaz, "eksik" sanırdı. Ayrı bir not satırı
  // düz tabloyu bozardı — işaret grup adının yanındadır.
  const grupEtiketi = group.lump ? `${grupAdi} · GÖTÜRÜ (TEK FİYAT)` : grupAdi;
  const carpan = adet === null || adet <= 0 ? 1 : adet;
  for (const l of group.lines) {
    const row = ws.getRow(r++);
    row.height = 30;
    row.getCell(KS.kaynak).value = adet !== null && adet > 1 ? `${kaynak} · ${adet} ADET` : kaynak;
    row.getCell(KS.grup).value = grupEtiketi;
    row.getCell(KS.kalem).value = teknikDegerBuyuk(l.label) || "—";
    sayiHucresi(row, KS.miktar, l.qty, SAYI);
    row.getCell(KS.birim).value = baslikDuzeni(l.unit) || "";
    // Malzeme şeridinden gelen €/kg fiyatlarında 0,70 gibi hassasiyet
    // zorunludur; diğer satın alma fiyatları kullanıcının istediği biçimde
    // ondalıksız ve binlik ayraçlı görünür.
    sayiHucresi(row, KS.birimFiyat, l.unitPrice, l.priceSource ? hassasBirimFiyat : para);
    const tutar = costLineAmount(l);
    // Dikey düzende tek sonuç sütunu vardır: paket/adet etkisi uygulanmış,
    // doğrudan maliyet toplamına gerçekten giren rakam.
    isiliSayi(
      row,
      KS.toplam,
      tutar === null ? null : tutar * carpan,
      para,
      enBuyukTutar * (carpan > 0 ? carpan : 1)
    );
    // MİKTAR KAYNAĞI SÜTUNU KALDIRILDI (kullanıcı isteği 23.08.2026, md. 9).
    // MALIYET-4 DEĞİŞMEDİ — iki kaynak hâlâ toplanmaz ve hangisinin geçerli
    // olduğu EKRANDA görünür (asa düğmesi); çizelgede o sütun her satırda
    // tekrar eden ve süzgeçte hiç kullanılmayan bir metindi.
    const teklifRef = refOf(group.key, l.key);
    const note = String(l.note ?? "").trim();
    const aciklama = [teklifRef ? `Teklif: ${teklifRef}` : "", note ? `Not: ${note}` : ""]
      .filter(Boolean)
      .join(" · ");
    row.getCell(KS.aciklama).value = aciklama || "—";
    for (let col = 1; col <= KALEM_BASLIKLARI.length; col += 1) {
      row.getCell(col).alignment = {
        horizontal: col === KS.aciklama ? "left" : undefined,
        vertical: "middle",
        wrapText: col === KS.kaynak || col === KS.grup || col === KS.kalem || col === KS.aciklama,
      };
    }
    cizgi(row, KALEM_BASLIKLARI.length);
  }
  return r;
}

function kalemlerSayfasi(
  wb: ExcelJS.Workbook,
  p: OfferCostWorkbookProps,
  totals: CostTotals,
  basilan: CostPayload
): void {
  const cur = p.payload.currency || p.offer.currency;
  const para = paraBicimi(cur);
  const ws = wb.addWorksheet(sekmeAdi(wb, "Maliyet Kalemleri"), {
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.45, header: 0.2, footer: 0.2 },
    },
  });
  ws.views = [{ showGridLines: false }];
  let r = bant(ws, "Maliyet Kalemleri", p);
  // AÇIKLAMA NOTU KALDIRILDI (kullanıcı isteği 23.08.2026, md. 10). Söylediği
  // üç şeyin üçü de zaten çizelgenin kendisinde duruyordu: KAYNAK sütunu
  // görünür ve süzgeçlidir, TUTAR ile PAKET TUTAR ayrı başlıklardır.
  r += 1;

  // ISI ÖLÇEĞİNİN TABANI BİR KEZ HESAPLANIR VE AŞAĞI GEÇİRİLİR (MALIYET-44):
  // her grubun kendi tabanını bulması, aynı sayının çizelgenin iki yerinde iki
  // farklı renk alması demekti.
  const enBuyukTutar = costLargestAmount([
    ...basilan.items.flatMap((i) => i.groups.flatMap((g) => g.lines.map(costLineAmount))),
    ...basilan.general.lines.map(costLineAmount),
    ...basilan.rates.flatMap((x) => x.lines.map(costLineAmount)),
  ]);

  const baslikSatiri = r;
  basliklar(ws, r++, KALEM_BASLIKLARI);
  ws.getRow(baslikSatiri).height = 24;
  const ilkVeri = r;

  for (const item of basilan.items) {
    const kaynak = teknikDegerBuyuk(item.title) || "KALEM";
    const refOf = (groupKey: string, lineKey: string) =>
      offerRefValue(p.offerPayload, item.offerItemId, groupKey, lineKey);
    for (const g of item.groups) {
      r = grupSatirlari(ws, r, kaynak, item.qty, g, cur, enBuyukTutar, refOf);
    }
  }

  // Proje genelinin satırları bir kaleme bağlı değildir; teklifte karşılığı da
  // yoktur (`offerRefValue` kalem kimliği ister) — sütun boş kalır. ADET de
  // yoktur: proje geneli TEK kez gerçekleşir, adetle çarpılmaz.
  if (basilan.general.lines.length > 0) {
    r = grupSatirlari(ws, r, "PROJE GENELİ", null, basilan.general, cur, enBuyukTutar, () => null);
  }

  // `kalem` kipindeki oranlı grubun satırları da basılır: yüzde okunmaz ama
  // tutar o satırlardan gelir ve okuyan onu tutturabilmelidir (MALIYET-5).
  for (const rate of basilan.rates) {
    if (rate.mode !== "kalem" || rate.lines.length === 0) continue;
    r = grupSatirlari(
      ws,
      r,
      teknikDegerBuyuk(rate.title),
      null,
      rate,
      cur,
      enBuyukTutar,
      () => null
    );
  }

  const sonVeri = r - 1;
  r += 1;
  const dip = ws.getRow(r++);
  dip.getCell(KS.kaynak).value = "DOĞRUDAN MALİYET (KALEM PAKETLERİ + PROJE GENELİ)";
  sayiHucresi(dip, KS.toplam, totals.direct, para);
  toplamBicimi(dip, KALEM_BASLIKLARI.length);

  // SÜZGEÇ TABLONUN KENDİSİNE KURULUR, dip toplama DEĞİL: filtre aralığına
  // giren bir toplam satırı süzüldüğünde tablonun içinde kaybolur ve okuyan
  // onu bir kalem sanardı.
  if (sonVeri >= ilkVeri) {
    ws.autoFilter = {
      from: { row: baslikSatiri, column: 1 },
      to: { row: sonVeri, column: KALEM_BASLIKLARI.length },
    };
  }
  // Ekranda dondurma yoktur; baskıda ise her dikey yaprak sütun adlarını
  // tekrar eder. Bu, çok sayfalı PDF benzeri okumanın temelidir.
  ws.pageSetup.printTitlesRow = `${baslikSatiri}:${baslikSatiri}`;
  ws.pageSetup.printArea = `A1:H${Math.max(1, r)}`;
  [23, 20, 30, 10, 10, 16, 18, 28].forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  ws.getColumn(KS.kalem).alignment = { wrapText: true, vertical: "top" };
  ws.getColumn(KS.aciklama).alignment = { wrapText: true, vertical: "top" };
  ws.headerFooter.oddFooter = `&L${IC_BELGE}&R&P / &N`;
}

// ————————————————————————————————————————————————————————— çalışma kitabı

/**
 * MALİYET ÇALIŞMASININ ÇALIŞMA KİTABI.
 *
 * SAFTIR (değişmez md. 7): DB/HTTP/React bilmez. Route handler veriyi çeker,
 * burası kitabı kurar — PDF'in `renderOfferCostPdf`i ile aynı ayrım ve aynı
 * prop biçimi, ki uç ikisine de AYNI nesneyi verebilsin.
 *
 * KİTAP İKİ SEKMEDİR (kullanıcı isteği, 22.08.2026): *"Maliyet PDF ve
 * excellerini … kompakt hale getirmek istiyorum. En başta özet olsun.
 * Sayfalarca doküman olmasın."*
 *
 *   1. **Özet** — kararın verildiği yer: künye, ana başlıklar, kâr, TEK listeli
 *      kalem özeti, ana kalem kırılımı, kalem künyeleri, hammadde fiyatları ve
 *      model katsayıları. Kendi başına yeter; PDF'e bakmayı gerektirmez.
 *   2. **Maliyet Kalemleri** — üzerinde ÇALIŞILACAK düz çizelge: bütün
 *      vinçlerin, proje genelinin ve kalem kipindeki oranlı grupların satırları
 *      tek tabloda, süzgeçli.
 *
 * ESKİDEN DÖRT VE FAZLASIYDI: Özet, Ana Kalem Kırılımı, vinç başına bir sekme
 * ve Proje Geneli ve Oranlar. Sekmeler aynı sütunları taşıyordu, yani ayrım bir
 * YAPI değil bir BÖLMEYDİ — ve iki vinçli bir teklifte beş sekme ediyordu.
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

  ozetSayfasi(wb, p, totals, basilan, steelWeights, models);
  kalemlerSayfasi(wb, p, totals, basilan);

  return wb;
}

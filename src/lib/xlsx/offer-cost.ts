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
  autoWidth,
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
 * Özet listesinin sütun sayısı defterdeki oran grubu sayısına göre değişir
 * (`ozetBasliklari`); bant ise SABİT bir genişlikte durur — bandı tablonun
 * genişliğine bağlamak, üç oranlı bir teklifte bandı, dört oranlıda başka bir
 * yerde bitirirdi.
 */
const SUTUN = 12;

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

/**
 * ÖZET LİSTESİNİN SÜTUNLARI — vinçler VE serbest fiyat satırları TEK tabloda.
 *
 * Kullanıcı kararı (22.08.2026, MALIYET-38): *"Özet kısmında tek bir liste
 * istiyorum."* Ekran o gün üç bloktan tek listeye indi; Excel ise ayrı bir
 * "FİYAT SATIRLARININ ELLE MALİYETLERİ" bloğu basmaya devam ediyordu — aynı
 * belgenin iki yüzü iki farklı yapı anlatıyordu.
 *
 * ORAN SÜTUNLARI DEFTERDEN GELİR, sayısı sabit yazılmaz: yarın dördüncü bir
 * oran grubu açılırsa tablo kendiliğinden bir sütun daha çizer.
 */
function ozetBasliklari(cur: string, oranlar: readonly { title: string }[]): string[] {
  return [
    "KALEM",
    "TÜR",
    "ADET",
    "ÇELİK [KG]",
    "TOPLAM AĞIRLIK [KG]",
    "ÇELİK × ADET [KG]",
    "ÇELİK %",
    "TOPLAM × ADET [KG]",
    "TOPLAM %",
    "BİRİM MALİYET",
    "PAKET MALİYET",
    "İMALAT",
    "İMALAT %",
    "PROJE",
    "PROJE %",
    ...oranlar.flatMap((r) => [teknikDegerBuyuk(r.title), `${teknikDegerBuyuk(r.title)} %`]),
    "GENEL GİDER DAHİL MALİYET",
    `${cur}/KG`,
  ];
}

/**
 * ÖZET TABLOSUNUN SÜTUN NUMARALARI — TEK yerde.
 *
 * Oran grubu sayısı defterden gelir ve her oran artık İKİ sütun tutar (tutar +
 * yüzde, md. 6); numaraları çağrı yerlerinde elle saymak, dördüncü bir oran
 * grubu açıldığında başlıkla verinin sessizce kaymasına yol açardı. Başlık
 * listesi ile bu harita AYNI sıradan üretilir ve bir duman testi ikisini
 * karşılaştırır.
 */
function ozetSutunlari(oranSayisi: number) {
  const oranTutar = (j: number) => 16 + j * 2;
  const maliyet = 16 + oranSayisi * 2;
  return {
    kalem: 1,
    tur: 2,
    adet: 3,
    celikBirim: 4,
    agirlikBirim: 5,
    celik: 6,
    celikYuzde: 7,
    agirlik: 8,
    agirlikYuzde: 9,
    birimMaliyet: 10,
    paketMaliyet: 11,
    imalat: 12,
    imalatYuzde: 13,
    proje: 14,
    projeYuzde: 15,
    oranTutar,
    oranYuzde: (j: number) => oranTutar(j) + 1,
    maliyet,
    kg: maliyet + 1,
  };
}

/**
 * BİR SAYININ TABANINA ORANI (0–1) — ekran ve PDF ile AYNI kural.
 *
 * Kullanıcı isteği (23.08.2026, md. 6). İKİ TABAN vardır: para sütunları
 * SATIRIN KENDİ MALİYETİNE, ağırlık sütunları belgenin dip toplamına oranlanır
 * (gerekçesi `overview-view.tsx`te). Excel yüzdeyi 0–1 bekler, o yüzden burada
 * 100 ile çarpılmaz — `payHucresi` doğrudan yazar.
 */
function oranPayi(pay: number | null, taban: number | null): number | null {
  if (pay === null || taban === null || taban === 0 || !Number.isFinite(taban)) return null;
  return pay / taban;
}

/** Boş değeri SIFIR SAYMAYAN toplam — hiç sayı yoksa `null` (değişmez md. 4). */
function toplaSayilar(list: readonly (number | null)[]): number | null {
  const dolu = list.filter((n): n is number => n !== null && Number.isFinite(n));
  return dolu.length ? dolu.reduce((t, n) => t + n, 0) : null;
}

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
  const oranlar = totals.rates;
  const basliklarListesi = ozetBasliklari(cur, oranlar);
  const SON = basliklarListesi.length;

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

  // D — MALİYET ÖZETİ: TEK LİSTE (MALIYET-38)
  blokBasligi(ws, r++, "MALİYET ÖZETİ");
  notSatiri(
    ws,
    r++,
    "Vinçler ve teklifin serbest fiyat satırları TEK listede; beş ana başlık kalem bazında dağıtılmıştır. Serbest satırın beş başlığı YOKTUR ve uydurulmaz — hücreler boş kalır."
  );
  basliklar(ws, r++, basliklarListesi);
  const K = ozetSutunlari(oranlar.length);

  // ISI ÖLÇEKLERİ SÜTUN BAZINDADIR (md. 4): "bu sütunun en büyüğü" cümlesi
  // literal olarak doğrudur. Tek bir ölçek kurulsaydı çelik ağırlığı toplam
  // ağırlıkla yarışır ve HER ZAMAN daha soğuk görünürdü — sütunun kendi
  // içindeki fark hiç okunmazdı.
  const satirlar = [
    ...ozet.items.map((i) => ({
      celik: i.steelPackageKg,
      agirlik: i.weightPackageKg,
      maliyet: i.headings.loaded,
      imalat: i.headings.fabrication,
      proje: i.headings.project,
      rates: i.headings.rates,
    })),
    ...ozet.manualLines.map((l) => ({
      celik: l.steelKg,
      agirlik: l.totalKg,
      maliyet: l.amount,
      imalat: l.headings.fabrication,
      proje: l.headings.project,
      rates: l.headings.rates,
    })),
  ];
  const enBuyukCelik = costLargestAmount(satirlar.map((x) => x.celik));
  const enBuyukAgirlik = costLargestAmount(satirlar.map((x) => x.agirlik));
  const enBuyukMaliyet = costLargestAmount(satirlar.map((x) => x.maliyet));

  for (const i of ozet.items) {
    const row = ws.getRow(r++);
    row.getCell(K.kalem).value = teknikDegerBuyuk(i.title) || "—";
    row.getCell(K.tur).value = "vinç";
    sayiHucresi(row, K.adet, i.qty, SAYI);
    sayiHucresi(row, K.celikBirim, i.steelKg, SAYI);
    sayiHucresi(row, K.agirlikBirim, i.weightKg, SAYI);
    isiliSayi(row, K.celik, i.steelPackageKg, SAYI, enBuyukCelik);
    // AĞIRLIK YÜZDESİNİN TABANI BELGENİN DİP TOPLAMIDIR; PARA yüzdelerininki
    // SATIRIN KENDİ MALİYETİ (md. 6, iki taban — gerekçesi `oranPayi`da).
    payHucresi(row, K.celikYuzde, oranPayi(i.steelPackageKg, ozet.steelKgAll));
    isiliSayi(row, K.agirlik, i.weightPackageKg, SAYI, enBuyukAgirlik);
    payHucresi(row, K.agirlikYuzde, oranPayi(i.weightPackageKg, ozet.weightKgAll));
    sayiHucresi(row, K.birimMaliyet, i.unit, para);
    sayiHucresi(row, K.paketMaliyet, i.package, para);
    sayiHucresi(row, K.imalat, i.headings.fabrication, para);
    payHucresi(row, K.imalatYuzde, oranPayi(i.headings.fabrication, i.headings.loaded));
    sayiHucresi(row, K.proje, i.headings.project, para);
    payHucresi(row, K.projeYuzde, oranPayi(i.headings.project, i.headings.loaded));
    i.headings.rates.forEach((x, j) => {
      sayiHucresi(row, K.oranTutar(j), x.amount, para);
      payHucresi(row, K.oranYuzde(j), oranPayi(x.amount, i.headings.loaded));
    });
    isiliSayi(row, K.maliyet, i.headings.loaded, para, enBuyukMaliyet);
    // Özet sayfasındaki hesaplanan EUR/kg metriği de diğer özet rakamları
    // gibi ondalıksız görünür; hammadde defterindeki gerçek giriş fiyatları
    // aşağıdaki ayrı tabloda hassasiyetini korur.
    sayiHucresi(row, K.kg, costPerKg(i.unit, i.weightKg), SAYI);
    cizgi(row, SON);
  }
  // SERBEST FİYAT SATIRLARI AYNI TABLONUN SATIRLARIDIR (MALIYET-38); ayrımı
  // TÜR sütunu söyler, ayrı bir blok değil. Ağırlıkları ELLE girilmiştir
  // (md. 7); BEŞ BAŞLIĞI DA artık elle girilebilir (23.08.2026, md. 1) ve
  // dokunulmamış hücre BOŞ kalır — uydurulmaz (değişmez md. 4).
  for (const l of ozet.manualLines) {
    const row = ws.getRow(r++);
    row.getCell(K.kalem).value = teknikDegerBuyuk(l.description) || "—";
    row.getCell(K.tur).value = "fiyat satırı";
    sayiHucresi(row, K.celikBirim, l.steelKg, SAYI);
    sayiHucresi(row, K.agirlikBirim, l.totalKg, SAYI);
    isiliSayi(row, K.celik, l.steelKg, SAYI, enBuyukCelik);
    payHucresi(row, K.celikYuzde, oranPayi(l.steelKg, ozet.steelKgAll));
    isiliSayi(row, K.agirlik, l.totalKg, SAYI, enBuyukAgirlik);
    payHucresi(row, K.agirlikYuzde, oranPayi(l.totalKg, ozet.weightKgAll));
    sayiHucresi(row, K.imalat, l.headings.fabrication, para);
    payHucresi(row, K.imalatYuzde, oranPayi(l.headings.fabrication, l.amount));
    sayiHucresi(row, K.proje, l.headings.project, para);
    payHucresi(row, K.projeYuzde, oranPayi(l.headings.project, l.amount));
    l.headings.rates.forEach((x, j) => {
      sayiHucresi(row, K.oranTutar(j), x.amount, para);
      payHucresi(row, K.oranYuzde(j), oranPayi(x.amount, l.amount));
    });
    isiliSayi(row, K.maliyet, l.amount, para, enBuyukMaliyet);
    cizgi(row, SON);
  }
  const kalemToplam = ws.getRow(r++);
  kalemToplam.getCell(K.kalem).value = "TOPLAM";
  sayiHucresi(kalemToplam, K.celik, ozet.steelKgAll, SAYI);
  sayiHucresi(kalemToplam, K.agirlik, ozet.weightKgAll, SAYI);
  // PAKET MALİYET SÜTUNUNUN TOPLAMI proje geneli TAŞIMAZ: doğrudan maliyet
  // (`totals.direct`) bunun üstüne bir de PROJE GENELİ grubunu ekler. İkisini
  // aynı hücrede göstermek, okuyanın sütunu toplayıp tutturamamasına yol
  // açardı — proje geneli maliyet kalemleri sekmesinde ayrı durur.
  sayiHucresi(kalemToplam, K.paketMaliyet, ozet.packageTotal, para);
  // BEŞ BAŞLIĞIN DİP TOPLAMI KENDİ SÜTUNUNU TOPLAR, `costTotals`i DEĞİL:
  // serbest fiyat satırlarının başlıkları artık elle girilebiliyor
  // (23.08.2026, md. 1) ve `totals.fabrication` yalnız VİNÇLERİ sayar. İkisi
  // karışsaydı sütunu toplayan okuyucu dip toplamı tutturamazdı.
  sayiHucresi(kalemToplam, K.imalat, toplaSayilar(satirlar.map((x) => x.imalat)), para);
  sayiHucresi(kalemToplam, K.proje, toplaSayilar(satirlar.map((x) => x.proje)), para);
  oranlar.forEach((_, j) =>
    sayiHucresi(
      kalemToplam,
      K.oranTutar(j),
      toplaSayilar(satirlar.map((x) => x.rates[j]?.amount ?? null)),
      para
    )
  );
  // DİP YÜZDELERİN TABANI BELGENİN TOPLAM MALİYETİDİR: satırdaki cümlenin
  // belge düzeyindeki karşılığı. AĞIRLIK dip toplamlarında yüzde YOKTUR —
  // onlar zaten satır yüzdelerinin tabanıdır ve %100 yazmak hiçbir şey
  // söylemezdi.
  payHucresi(
    kalemToplam,
    K.imalatYuzde,
    oranPayi(toplaSayilar(satirlar.map((x) => x.imalat)), ozet.margin.cost)
  );
  payHucresi(
    kalemToplam,
    K.projeYuzde,
    oranPayi(toplaSayilar(satirlar.map((x) => x.proje)), ozet.margin.cost)
  );
  oranlar.forEach((_, j) =>
    payHucresi(
      kalemToplam,
      K.oranYuzde(j),
      oranPayi(toplaSayilar(satirlar.map((x) => x.rates[j]?.amount ?? null)), ozet.margin.cost)
    )
  );
  // MALİYET SÜTUNUNUN DİP TOPLAMI belge toplamı + elle maliyetlerdir: sütunu
  // toplamak dağıtılamayan yükü (`unallocated`) dışarıda bırakır ve okuyan
  // yukarıdaki KÂR satırıyla tutturamazdı.
  sayiHucresi(kalemToplam, K.maliyet, ozet.margin.cost, para);
  toplamBicimi(kalemToplam, SON);
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
  autoWidth(ws, 12, 46);
  // Basılan uzun cümleler (uyarı ve not satırları) ilk sütunda yaşar ve
  // `autoWidth` birleşik olmayan her hücreyi ölçtüğü için sütunu 46 karaktere
  // kadar şişirirdi; kalem adları için 34 yeter.
  ws.getColumn(1).width = 34;
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
  "ADET",
  "GRUP",
  "KALEM",
  "MİKTAR",
  "BİRİM",
  "BİRİM FİYAT",
  "TUTAR",
  "PAKET TUTAR",
  "TEKLİFTE",
  "NOT",
] as const;

/** Sütun numaraları — başlık listesiyle AYNI sıradan; elle sayılmaz. */
const KS = {
  kaynak: 1,
  adet: 2,
  grup: 3,
  kalem: 4,
  miktar: 5,
  birim: 6,
  birimFiyat: 7,
  tutar: 8,
  paketTutar: 9,
  teklifte: 10,
  not: 11,
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
    row.getCell(KS.kaynak).value = kaynak;
    sayiHucresi(row, KS.adet, adet, SAYI);
    row.getCell(KS.grup).value = grupEtiketi;
    row.getCell(KS.kalem).value = teknikDegerBuyuk(l.label) || "—";
    sayiHucresi(row, KS.miktar, l.qty, SAYI);
    row.getCell(KS.birim).value = baslikDuzeni(l.unit) || "";
    // Malzeme şeridinden gelen €/kg fiyatlarında 0,70 gibi hassasiyet
    // zorunludur; diğer satın alma fiyatları kullanıcının istediği biçimde
    // ondalıksız ve binlik ayraçlı görünür.
    sayiHucresi(row, KS.birimFiyat, l.unitPrice, l.priceSource ? hassasBirimFiyat : para);
    const tutar = costLineAmount(l);
    // TUTAR ISISI ÇİZELGEDE DE VARDIR (md. 4): ekranla ve PDF'le AYNI rampa.
    // İki sütun da renklenir çünkü ikisi de bir tutardır ve okuyan hangisine
    // bakarsa baksın aynı büyüklük işaretini görmelidir.
    isiliSayi(row, KS.tutar, tutar, para, enBuyukTutar);
    isiliSayi(
      row,
      KS.paketTutar,
      tutar === null ? null : tutar * carpan,
      para,
      enBuyukTutar * (carpan > 0 ? carpan : 1)
    );
    // MİKTAR KAYNAĞI SÜTUNU KALDIRILDI (kullanıcı isteği 23.08.2026, md. 9).
    // MALIYET-4 DEĞİŞMEDİ — iki kaynak hâlâ toplanmaz ve hangisinin geçerli
    // olduğu EKRANDA görünür (asa düğmesi); çizelgede o sütun her satırda
    // tekrar eden ve süzgeçte hiç kullanılmayan bir metindi.
    row.getCell(KS.teklifte).value = refOf(group.key, l.key) ?? "";
    row.getCell(KS.not).value = l.note ?? "";
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
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
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
  sayiHucresi(dip, KS.paketTutar, totals.direct, para);
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
  // BAŞLIK VE İLK SÜTUN DONDURULMAZ (md. 9) — özet sekmesiyle aynı gerekçe:
  // donmuş bölme kullanıcının kendi görünümüne el koyar.
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

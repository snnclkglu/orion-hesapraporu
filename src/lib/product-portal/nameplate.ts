// VİNÇ KİMLİK PLAKASI — SAF BASKI GEOMETRİSİ.
//
// SVG önizleme/indirme ve @react-pdf çizicisi AYNI `createNameplateLayout`
// sonucunu okur. Burada tek bir piksel bile çizilmez; yalnız mm cinsinden
// koordinat üretilir.
//
// ————————————————————————————— NEDEN YENİDEN YAZILDI
//
// Önceki sürüm 240×160'a GÖMÜLÜ sabit koordinatlar taşıyordu ve başka bir ölçü
// istendiğinde çizimi `scale = min(w/240, h/160)` ile orantılı küçültüp kalan
// yeri boş bırakıyordu. Üç bedeli vardı:
//
//   1. Küçük plakada bütün yazılar birlikte küçülüyordu; 2,05 mm'lik satırlar
//      metal kazımada okunmaz hâle geliyordu. "Ölçüyü değiştir" gerçekte
//      "tasarımı yeniden akıt" demektir.
//   2. 3:2 dışındaki bir ölçüde çizim mektup kutusuna düşüyor, plakanın
//      kenarlarında boş bantlar kalıyordu.
//   3. Yasal blok (CE, imalatçı adresi, tip/model, kütle) için yer yoktu.
//
// Artık yerleşim GERÇEK mm kutusundan hesaplanır: bantlar oranla, yazılar
// sığdırmayla belirlenir ve zorunlu blok taşımıyorsa `fits` false döner.
//
// ————————————————————————————— HARF ARALIĞI NEDEN ELLE VERİLİR
//
// @react-pdf'in yerleşim motoru `letterSpacing`i OKUMAZ (bkz.
// `@react-pdf/layout`: `getFragments` özellik listesinde yoktur). SVG'de
// `letter-spacing` çalıştığı için önizleme ile baskı sessizce ayrışıyordu.
// Bu yüzden aralıklı yazılar `trackedGlyphs` ile KARAKTER KARAKTER konumlanır;
// iki çizici de aynı x dizisini basar, ayrışma imkânsızdır.

import QRCode from "qrcode";
import { BRAND, trUpper } from "@/lib/pdf/palette";
import type { ProductIdentityField, ProductIdentityValues } from "./types";

/** Plakada gösterilip gizlenebilen alanlar. Yasal zorunlular BURADA DEĞİLDİR. */
export const NAMEPLATE_TOGGLE_FIELDS = [
  "craneType",
  "projectCode",
  "span",
  "liftHeight",
  "mass",
  "dutyClass",
  "supplyVoltage",
  "controlVoltage",
  "frequency",
  "customer",
] as const satisfies readonly ProductIdentityField[];

/**
 * YASAL ZORUNLU ALANLAR GİZLENEMEZ.
 *
 * 2006/42/AT Ek I md. 1.7.3 ve md. 4.3.3 bunları makinenin üzerinde ister;
 * kullanıcının "plakada gösterme" anahtarı bu alanlara AÇILMAZ. Anahtarı
 * sunmak, bir gün birinin yasal bir satırı kapatması demekti.
 */
export const NAMEPLATE_MANDATORY_FIELDS = [
  "manufacturer",
  "manufacturerAddress",
  "product",
  "machineModel",
  "productionYear",
  "capacity",
] as const satisfies readonly ProductIdentityField[];

/** Hazır ölçüler; her biri zorunlu bloğu okunur taşıyabildiği doğrulanmıştır. */
export const NAMEPLATE_SIZE_PRESETS = [
  { label: "Köprü · 240 × 160 mm", widthMm: 240, heightMm: 160 },
  { label: "Köprü · 200 × 140 mm", widthMm: 200, heightMm: 140 },
  { label: "Pano · 160 × 110 mm", widthMm: 160, heightMm: 110 },
] as const;

/*
 * 120 × 80 mm BİLEREK LİSTEDE YOKTUR.
 *
 * O ölçüde CE işareti, imalatçı künyesi, azami yük ve veri satırları okunur
 * biçimde birlikte sığmıyor (ölçüldü: satırlar sığmıyor + QR modülü 0,56 mm).
 * Kullanıcı yine de elle girebilir — ama hazır seçenek olarak sunmak, çalışmayan
 * bir ölçüyü önermek olurdu. Denetim listesi elle girilen her ölçüyü sınar.
 */

export interface NameplateInput {
  widthMm: number;
  heightMm: number;
  serialNo: string;
  publicUrl: string;
  identity: ProductIdentityValues;
  hiddenFields?: readonly ProductIdentityField[];
  logoDataUrl: string;
  customerLogoDataUrl?: string | null;
  holeDiameterMm?: number;
  holeInsetMm?: number;
  ceMark?: boolean;
  monochrome?: boolean;
  embeddedFontsCss?: string;
}

export interface TrackedGlyph {
  char: string;
  x: number;
}

export interface NameplateRow {
  label: string;
  value: string;
  y: number;
  labelSize: number;
  valueSize: number;
  /** Satırın ayırıcı çizgisi — konum YERLEŞİMDEDİR, çizicide değil. */
  ruleY: number;
}

export interface NameplatePalette {
  accent: string;
  band: string;
  bandText: string;
  paper: string;
  ink: string;
  muted: string;
  hairline: string;
}

export interface NameplateLayout {
  widthMm: number;
  heightMm: number;
  palette: NameplatePalette;
  /** Zorunlu blok okunur biçimde sığdı mı; sığmadıysa `issues` doludur. */
  fits: boolean;
  issues: string[];
  frameInset: number;
  accent: { width: number };
  header: {
    y: number;
    height: number;
    logo: { x: number; y: number; width: number; height: number };
    customerLogo: { x: number; y: number; width: number; height: number } | null;
    customerName: string;
    customerNameX: number;
    customerNameY: number;
    customerNameSize: number;
    rule: { y: number; height: number };
  };
  kicker: { glyphs: TrackedGlyph[]; y: number; size: number };
  title: { lines: string[]; x: number; y: number; size: number; lineHeight: number };
  capacity: { x: number; y: number; width: number; height: number; label: string; value: string; labelSize: number; valueSize: number } | null;
  rows: NameplateRow[];
  labelX: number;
  valueX: number;
  rowRuleX2: number;
  divider: { x: number; y1: number; y2: number } | null;
  qr: { path: string; x: number; y: number; size: number; moduleMm: number };
  qrCaption: { glyphs: TrackedGlyph[]; y: number; size: number; centerX: number };
  /** QR okunmazsa geri dönüş yolu: kod ve insan-okunur adres. */
  fallback: { code: string; url: string; x: number; codeY: number; urlY: number; codeSize: number; urlSize: number };
  serialBox: { x: number; y: number; width: number; height: number; labelY: number; valueY: number; labelSize: number; valueSize: number; centerX: number; label: string; value: string } | null;
  legal: {
    y: number;
    height: number;
    rule: { y: number };
    ce: { x: number; y: number; height: number; path: string; width: number } | null;
    lines: Array<{ text: string; y: number; size: number }>;
    x: number;
  };
  holes: Array<{ cx: number; cy: number; r: number }>;
  customerLogoDataUrl: string | null;
}

/**
 * TABAN ÖLÇÜLER OKUNABİLİRLİK SINIRINDAN KÜÇÜK OLAMAZ.
 *
 * İlk sürümde taban 1,7 mm'ye iniyordu ama denetim 2 mm istiyordu; sonuç,
 * 200×140 ve 160×110'da HER ZAMAN görünen ve düzeltilemeyen bir uyarıydı.
 * Susturulamayan uyarı okunmaz hâle gelir. Taban artık eşikle aynıdır: yazı
 * küçülmez, onun yerine "satırlar sığmıyor" der — asıl söylenmesi gereken bu.
 */
/** Kazımada ve 30 cm mesafeden okunabilirliğin pratik alt sınırı. */
export const READABLE_MIN_MM = 2.0;
const MIN_LABEL_SIZE = READABLE_MIN_MM;
const MIN_VALUE_SIZE = 2.2;
const MIN_TITLE_SIZE = 3.2;
const MIN_LEGAL_SIZE = READABLE_MIN_MM;
/** QR modülü bunun altına inerse ucuz okuyucular kodu tanımaz. */
export const QR_MODULE_MIN_MM = 0.6;

export function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalized(value: string): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

/** Plex Mono'nun sabit ilerlemesi — aralıklı yazı bunu karakter başına sayar. */
const MONO_ILERLEME = 0.61;

/** Archivo/Plex için baskı öncesi muhafazakâr glif genişliği tahmini. */
export function estimatedTextWidth(value: string, fontSize: number, mono = false): number {
  if (mono) return normalized(value).length * fontSize * MONO_ILERLEME;
  let units = 0;
  for (const character of normalized(value)) {
    if (/[MW@%&]/.test(character)) units += 0.94;
    else if (/[IİJ1|.,:;!'`]/.test(character)) units += 0.34;
    else if (/\s/.test(character)) units += 0.31;
    else if (/[ÇĞÖŞÜQO0]/.test(character)) units += 0.69;
    else units += 0.59;
  }
  return units * fontSize;
}

/**
 * Aralıklı yazıyı karakter karakter konumlar.
 *
 * @react-pdf `letterSpacing`i yok sayar; SVG sayar. Aynı görüntüyü iki çizicide
 * garanti etmenin tek yolu konumu BURADA hesaplamaktır.
 */
export function trackedGlyphs(value: string, x: number, size: number, tracking: number): TrackedGlyph[] {
  const text = normalized(value);
  const glyphs: TrackedGlyph[] = [];
  let cursor = x;
  for (const char of text) {
    glyphs.push({ char, x: cursor });
    // BOŞLUK DA BİR KARAKTERDİR ve mono yüzde hepsi aynı genişliktedir.
    // `estimatedTextWidth` burada KULLANILMAZ: içindeki `normalized` boşluğu
    // `trim()` ile yiyor, tek karakterlik " " için 0 dönüyordu — "TEKNİK
    // DOKÜMANLAR" kelime arası harf arasından DAR basılıyor, iki kelime
    // bitişik okunuyordu (ölçüldü: 3 mm puntoda kelime arası 0,66 mm, harf
    // arası 0,33 mm).
    cursor += size * MONO_ILERLEME + tracking;
  }
  return glyphs;
}

export function trackedWidth(glyphs: readonly TrackedGlyph[], size: number): number {
  if (glyphs.length === 0) return 0;
  const last = glyphs[glyphs.length - 1];
  return last.x - glyphs[0].x + size * MONO_ILERLEME;
}

/** Metni en fazla `maxLines` satıra, kelime sınırında ve dengeli böler. */
function wrapToWidth(value: string, size: number, maxWidth: number, maxLines: number): string[] | null {
  const text = trUpper(normalized(value));
  if (!text) return [];
  if (estimatedTextWidth(text, size) <= maxWidth) return [text];
  if (maxLines < 2) return null;
  const words = text.split(" ");
  if (words.length < 2) return null;
  let best: { lines: string[]; score: number } | null = null;
  for (let index = 1; index < words.length; index += 1) {
    const first = words.slice(0, index).join(" ");
    const second = words.slice(index).join(" ");
    const firstWidth = estimatedTextWidth(first, size);
    const secondWidth = estimatedTextWidth(second, size);
    if (firstWidth > maxWidth || secondWidth > maxWidth) continue;
    const score = Math.max(firstWidth, secondWidth) + Math.abs(firstWidth - secondWidth) * 0.35;
    if (!best || score < best.score) best = { lines: [first, second], score };
  }
  return best?.lines ?? null;
}

/**
 * Başlığı sığdırır; SIĞMIYORSA KIRPMAK YERİNE KÜÇÜLTÜR, en sonda kırpar.
 *
 * Önceki sürüm sığmayan başlığı olduğu gibi basıyordu: metin dikey ayracı
 * geçip QR kutusunun üstüne yazıyordu. Taşan bir başlık bir uyarıdır, bir
 * çizim hatası değil — ama basılan plakada asla üst üste binmemelidir.
 */
function fitTitle(value: string, maxWidth: number, sizes: readonly number[]) {
  for (const size of sizes) {
    const lines = wrapToWidth(value, size, maxWidth, 2);
    if (lines) return { lines, size, clipped: false };
  }
  const smallest = sizes[sizes.length - 1];
  const text = trUpper(normalized(value));
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimatedTextWidth(candidate, smallest) <= maxWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === 2) break;
    }
  }
  if (lines.length < 2 && current) lines.push(current);
  /*
   * SON ÇARE: KARAKTER DÜZEYİNDE KIRP.
   *
   * Tek bir kelime satır genişliğinden uzunsa (kullanıcı boşluksuz bir ad
   * yazmışsa) kelime sınırında bölünemez ve metin dikey ayracı geçip QR
   * kutusunun üstüne yazar. Basılmış bir plakada üst üste binen yazı, kırpılmış
   * yazıdan çok daha kötüdür — kırpma hiç değilse görünür ve `issues` zaten
   * "adı kısaltın" diyor.
   */
  return {
    lines: lines.slice(0, 2).map((line) => clampToWidth(line, smallest, maxWidth)),
    size: smallest,
    clipped: true,
  };
}

function clampToWidth(text: string, size: number, maxWidth: number): string {
  if (estimatedTextWidth(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && estimatedTextWidth(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function fitMonoSize(value: string, maxWidth: number, sizes: readonly number[]): number {
  for (const size of sizes) {
    if (estimatedTextWidth(value, size, true) <= maxWidth) return size;
  }
  return sizes[sizes.length - 1];
}

function qrGeometry(value: string, x: number, y: number, size: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "Q" });
  const quiet = 4;
  const cells = qr.modules.size + quiet * 2;
  const cell = size / cells;
  let path = "";
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let col = 0; col < qr.modules.size; col += 1) {
      if (!qr.modules.get(row, col)) continue;
      const px = x + (col + quiet) * cell;
      const py = y + (row + quiet) * cell;
      // Bitişik kareler arasında saç çizgisi dikiş kalmaması için modüller
      // yarım binde bir üst üste biner; kazımada o çizgiler iz bırakıyordu.
      const w = cell * 1.02;
      path += `M${px.toFixed(3)} ${py.toFixed(3)}h${w.toFixed(3)}v${w.toFixed(3)}h-${w.toFixed(3)}z`;
    }
  }
  return { path, x, y, size, moduleMm: cell };
}

/*
 * CE İŞARETİ — 765/2008/AT Ek II oranlarında VEKTÖR.
 *
 * Ölçüler YÜZ BİRİMLİK bir ızgarada verilir ve `s = height/100` ile mm'ye
 * indirilir. Harfler EŞ MERKEZLİ birer halkadır: dış yarıçap 50, iç yarıçap
 * 34 — yani et kalınlığı her yerde 16 birimdir. Ağız (+x yönündeki açıklık)
 * yarı-açısı `CE_AGIZ`tır ve uç noktalar çemberden TÜRETİLİR.
 *
 * ÖNCEKİ SÜRÜMÜN İKİ HATASI (01.09.2026, kullanıcı bildirimi "sol altta CE
 * işareti koymaya çalışmışız ama olmamış"):
 *  1. YAY YARIÇAPLARI ÖLÇEKLENMİYORDU (`A50 50 …` ham yazılmıştı). viewBox
 *     birimi mm olduğu için 10 mm'lik bir işarette 50 mm yarıçap isteniyor,
 *     SVG yarıçapı küçültmez ve ~356°'lik dev bir yay çizerdi: ekrandaki
 *     kocaman siyah hilal ve veri tablosunun etiket sütununu ezen "kalın
 *     çizgi" bundandı.
 *  2. UÇ NOKTALAR ÇEMBER ÜZERİNDE DEĞİLDİ (x=72 elle yazılmıştı), yani iki
 *     yay eş merkezli çıkmıyor ve halkanın kalınlığı yer yer 23 birime
 *     çıkıyordu.
 *
 * E'nin orta kolu halkanın İÇ kenarından başlar (gövdeye değer) ve ağız
 * hattına varmadan biter — gerçek işarette orta kol kollardan kısadır.
 */
const CE_DIS = 50;
const CE_IC = 34;
const CE_AGIZ_DERECE = 40;

/** İki harfin merkezleri arası; mürekkep çakışmayan en küçük mesafe ölçüldü. */
const CE_HARF_ARALIGI = 127;

/** İşaretin en/boy oranı — `legalX` bu genişliğin sağından başlar. */
const CE_GENISLIK_ORANI = (CE_HARF_ARALIGI + CE_DIS) / 100;

function ceHalkasi(
  cx: number,
  px: (v: number) => string,
  py: (v: number) => string,
  s: number
): string {
  const rad = (CE_AGIZ_DERECE * Math.PI) / 180;
  const disX = cx + CE_DIS * Math.cos(rad);
  const disY = CE_DIS * Math.sin(rad);
  const icX = cx + CE_IC * Math.cos(rad);
  const icY = CE_IC * Math.sin(rad);
  const R = (CE_DIS * s).toFixed(3);
  const r = (CE_IC * s).toFixed(3);
  return (
    `M${px(disX)} ${py(50 - disY)}` +
    `A${R} ${R} 0 1 0 ${px(disX)} ${py(50 + disY)}` +
    `L${px(icX)} ${py(50 + icY)}` +
    `A${r} ${r} 0 1 1 ${px(icX)} ${py(50 - icY)}` +
    `Z`
  );
}

function ceMarkPath(x: number, y: number, height: number): { path: string; width: number } {
  const s = height / 100;
  const px = (v: number) => (x + v * s).toFixed(3);
  const py = (v: number) => (y + v * s).toFixed(3);
  const agizX = CE_DIS * Math.cos((CE_AGIZ_DERECE * Math.PI) / 180);
  // E'nin orta kolu: iç kenardan başlar, ağız hattının %72'sinde biter.
  const kolSol = CE_HARF_ARALIGI - CE_IC;
  const kolSag = CE_HARF_ARALIGI + agizX * 0.72;
  const kol =
    `M${px(kolSol)} ${py(42)}` +
    `H${px(kolSag)}` +
    `V${py(58)}` +
    `H${px(kolSol)}` +
    `Z`;
  return {
    path: `${ceHalkasi(50, px, py, s)}${ceHalkasi(CE_HARF_ARALIGI, px, py, s)}${kol}`,
    width: +(height * CE_GENISLIK_ORANI).toFixed(2),
  };
}

function visibleValue(
  identity: ProductIdentityValues,
  hidden: Set<ProductIdentityField>,
  field: ProductIdentityField
): string {
  if (MANDATORY_SET.has(field)) return normalized(identity[field]);
  return hidden.has(field) ? "" : normalized(identity[field]);
}

const MANDATORY_SET = new Set<ProductIdentityField>(NAMEPLATE_MANDATORY_FIELDS);

const MONO_PALETTE: NameplatePalette = {
  accent: BRAND.ink,
  band: BRAND.ink,
  bandText: BRAND.white,
  paper: BRAND.white,
  ink: BRAND.ink,
  muted: BRAND.ink,
  hairline: BRAND.ink,
};

const COLOR_PALETTE: NameplatePalette = {
  accent: BRAND.red,
  band: BRAND.ink,
  bandText: BRAND.paper100,
  paper: BRAND.paper100,
  ink: BRAND.ink,
  muted: BRAND.gray700,
  hairline: BRAND.line350,
};

export function createNameplateLayout(input: NameplateInput): NameplateLayout {
  const widthMm = clampDimension(input.widthMm, 240, 120, 1000);
  const heightMm = clampDimension(input.heightMm, 160, 80, 1000);
  const palette = input.monochrome ? MONO_PALETTE : COLOR_PALETTE;
  const hidden = new Set(input.hiddenFields ?? []);
  const issues: string[] = [];

  // Ölçek etkeni: 240×160 referansına göre; yazılar bununla küçülür ama
  // kendi alt sınırlarının altına İNMEZ — okunmayan bir plaka boş plakadır.
  const k = Math.min(widthMm / 240, heightMm / 160);
  const size = (base: number, min: number) => Math.max(min, +(base * k).toFixed(2));

  const frameInset = +(Math.max(1.0, 1.4 * k)).toFixed(2);
  const accentW = +(Math.max(2.5, 8 * k)).toFixed(2);
  const padX = +(accentW + Math.max(4, 10 * k)).toFixed(2);
  const rightPad = +(Math.max(4, 10 * k)).toFixed(2);

  // ————————————————————————————————————————————————— marka bandı
  const headerY = +(Math.max(2.5, 8 * k)).toFixed(2);
  const headerH = +(Math.max(9, 24 * k)).toFixed(2);
  const headerRuleH = +(Math.max(0.8, 2 * k)).toFixed(2);
  const bandX = accentW;
  const bandW = widthMm - accentW - headerY;

  const logoH = +(headerH * 0.42).toFixed(2);
  const logoW = +(logoH * 8.2).toFixed(2);
  const logo = {
    x: +(bandX + Math.max(3, 7 * k)).toFixed(2),
    y: +(headerY + (headerH - logoH) / 2).toFixed(2),
    width: logoW,
    height: logoH,
  };

  const customerName = visibleValue(input.identity, hidden, "customer");
  const customerLogoDataUrl = hidden.has("customer") ? null : input.customerLogoDataUrl ?? null;
  const customerPlateW = +(Math.min(bandW * 0.28, 57 * k)).toFixed(2);
  const customerLogo = customerLogoDataUrl
    ? {
        x: +(bandX + bandW - customerPlateW - Math.max(2, 4 * k)).toFixed(2),
        y: +(headerY + headerH * 0.14).toFixed(2),
        width: customerPlateW,
        height: +(headerH * 0.72).toFixed(2),
      }
    : null;

  // ————————————————————————————————————————————— içerik ve yasal bant
  const legalH = +(Math.max(8, 20 * k)).toFixed(2);
  const legalY = +(heightMm - headerY - legalH).toFixed(2);
  const contentTop = +(headerY + headerH + headerRuleH + Math.max(2.5, 6 * k)).toFixed(2);
  const contentBottom = +(legalY - Math.max(1.5, 3 * k)).toFixed(2);

  // ————————————————————————————————————————————————— sağ sütun (QR)
  const qrSize = +(Math.min(widthMm * 0.26, (contentBottom - contentTop) * 0.52, 58 * k)).toFixed(2);
  const rightColW = +(Math.max(qrSize, 40 * k)).toFixed(2);
  const rightX = +(widthMm - rightPad - rightColW).toFixed(2);
  const dividerX = +(rightX - Math.max(3, 8 * k)).toFixed(2);
  const leftColW = +(dividerX - padX - Math.max(2, 5 * k)).toFixed(2);

  // ————————————————————————————————————————————————— kicker + başlık
  const kickerSize = size(3.1, 2.0);
  const kicker = {
    glyphs: trackedGlyphs("VİNÇ KİMLİK PLAKASI", padX, kickerSize, kickerSize * 0.16),
    y: +(contentTop + kickerSize).toFixed(2),
    size: kickerSize,
  };

  const product = visibleValue(input.identity, hidden, "product");
  const craneType = visibleValue(input.identity, hidden, "craneType");
  const titleSizes = [size(6.2, MIN_TITLE_SIZE), size(5.6, MIN_TITLE_SIZE), size(5.0, MIN_TITLE_SIZE), size(4.5, MIN_TITLE_SIZE), MIN_TITLE_SIZE];
  const fitted = fitTitle(product || craneType || "VİNÇ", leftColW, titleSizes);
  if (fitted.clipped) issues.push("Ürün adı iki satırlık baskı alanına sığmıyor; plaka adını kısaltın.");
  const titleLineHeight = +(fitted.size * 1.18).toFixed(2);
  const title = {
    lines: fitted.lines,
    x: padX,
    y: +(kicker.y + Math.max(3, 8 * k) + fitted.size).toFixed(2),
    size: fitted.size,
    lineHeight: titleLineHeight,
  };

  // ————————————————————————————— AZAMİ YÜK: md. 4.3.3 "belirgin" ister
  const capacityValue = normalized(input.identity.capacity);
  const capacityH = +(Math.max(7, 15 * k)).toFixed(2);
  const capacityY = +(title.y + (title.lines.length - 1) * titleLineHeight + Math.max(2.5, 6 * k)).toFixed(2);
  const capacityLabelSize = size(2.4, MIN_LABEL_SIZE);
  const capacityValueSize = capacityValue
    ? fitMonoSize(capacityValue, leftColW * 0.62, [size(7.5, 3.4), size(6.5, 3.4), size(5.5, 3.4), size(4.5, 3.4), 3.4])
    : 0;
  const capacity = capacityValue
    ? {
        x: padX,
        y: capacityY,
        width: +(leftColW).toFixed(2),
        height: capacityH,
        label: "AZAMİ ÇALIŞMA YÜKÜ",
        value: capacityValue,
        labelSize: capacityLabelSize,
        valueSize: capacityValueSize,
      }
    : null;
  if (!capacityValue) issues.push("Azami çalışma yükü boş; kaldırma makinesinde bu işaret zorunludur (md. 4.3.3).");

  // ————————————————————————————————————————————————— veri satırları
  const titleIncludesType = product && craneType ? trUpper(product).includes(trUpper(craneType)) : true;
  /* BESLEME SATIRI FREKANSI İKİ KEZ YAZMAZ. `frequency` bağımsız bir girdi
     değil, `supplyVoltage` metninden çekilen bir türevdir
     (`identity.ts` · `frequencyFromSupplyVoltage`) ve üretimdeki seçenek
     metinleri frekansı zaten taşır ("380 VAC, 3 Faz, 50 Hz"). Koşulsuz
     birleştirme plakaya "380 VAC, 3 Faz, 50 Hz · 50 Hz" bastırıyordu. */
  const supplyVoltage = visibleValue(input.identity, hidden, "supplyVoltage");
  const frequency = visibleValue(input.identity, hidden, "frequency");
  const supply = [
    supplyVoltage,
    /Hz/i.test(supplyVoltage) ? "" : frequency,
  ].filter(Boolean).join(" · ");
  const candidates: Array<[string, string]> = [
    ["SERİ NUMARASI", normalized(input.serialNo)],
    ["TİP / MODEL", visibleValue(input.identity, hidden, "machineModel")],
    ...(!titleIncludesType && craneType ? [["VİNÇ TİPİ", craneType] as [string, string]] : []),
    ["PROJE / ÜRÜN KODU", visibleValue(input.identity, hidden, "projectCode")],
    ["AÇIKLIK", visibleValue(input.identity, hidden, "span")],
    ["KALDIRMA YÜKSEKLİĞİ", visibleValue(input.identity, hidden, "liftHeight")],
    ["KÜTLE", visibleValue(input.identity, hidden, "mass")],
    ["ÇALIŞMA SINIFI", visibleValue(input.identity, hidden, "dutyClass")],
    ["BESLEME", supply],
    ["KUMANDA GERİLİMİ", visibleValue(input.identity, hidden, "controlVoltage")],
  ];
  const present = candidates.filter(([, value]) => Boolean(value));
  if (!normalized(input.identity.machineModel)) {
    issues.push("Tip / model tanımlaması boş; md. 1.7.3 seri veya tip tanımlaması ister.");
  }

  const rowsTop = +((capacity ? capacityY + capacityH : capacityY) + Math.max(2, 5 * k)).toFixed(2);
  const rowsSpace = Math.max(0, contentBottom - rowsTop);
  const labelSize = size(2.75, MIN_LABEL_SIZE);
  const labelX = padX;

  /* DEĞER SÜTUNU ETİKETİN GERÇEK GENİŞLİĞİNDEN BAŞLAR, sabit bir orandan
     değil. Eski `leftColW * 0.46` en uzun etiketi ("KALDIRMA YÜKSEKLİĞİ")
     ölçmüyordu: kısa etiketli plakalarda ortada 24 mm'lik ölü bir oluk
     bırakıyor, uzun etiketli olanlarda değerin üstüne binme riski taşıyordu. */
  const enUzunEtiket = present.reduce(
    (en, [label]) => Math.max(en, estimatedTextWidth(label, labelSize, true)),
    0
  );
  const valueX = +Math.min(
    padX + enUzunEtiket + Math.max(2, 4 * k),
    padX + leftColW * 0.62
  ).toFixed(2);
  const valueMaxWidth = +(padX + leftColW - valueX).toFixed(2);
  const valueSizes = [size(4.2, MIN_VALUE_SIZE), size(3.8, MIN_VALUE_SIZE), size(3.4, MIN_VALUE_SIZE), size(3.0, MIN_VALUE_SIZE), MIN_VALUE_SIZE];

  /* PUNTO SÜTUN BOYU SEÇİLİR, SATIR SATIR DEĞİL — VE İKİ KAPIDAN GEÇER.
     Her satır kendi puntosunu seçseydi kısa değer 4,2 mm, uzun değer 3,0 mm
     olur ve aynı sütun kendi içinde dalgalanırdı; etiket sütunu zaten tek
     puntodadır. Birinci kapı GENİŞLİK (en uzun değer sütuna sığmalı), ikinci
     kapı YÜKSEKLİK (n satır kalan boşluğa sığmalı). İkincisi eksikti: satır
     bloğu içerik penceresini taşıyor, son satırlar yasal bandın üstüne
     çıkıyordu (ölçüldü). */
  const genislikPuntosu = present.length > 0
    ? Math.min(...present.map(([, value]) => fitMonoSize(value, valueMaxWidth, valueSizes)))
    : valueSizes[0];
  const satirYuksekligiIcin = (punto: number) => +(Math.max(labelSize, punto) * 1.45).toFixed(2);
  const valueSize = present.length > 0
    ? valueSizes.find(
        (punto) =>
          punto <= genislikPuntosu &&
          satirYuksekligiIcin(punto) * present.length <= rowsSpace
      ) ?? Math.min(genislikPuntosu, MIN_VALUE_SIZE)
    : genislikPuntosu;

  /* SATIR ADIMI DEĞER PUNTOSUNU GÖRÜR. Eski hâl adımı yalnız kalan boşluğa
     bölüyor, çakışmayı ise ETİKET puntosuyla denetliyordu; oysa satırın
     yüksekliğini büyük olan DEĞER belirler. Ölçülmüştü: adım 3,84 mm iken
     değer 4,2 mm ve her satırın saç çizgisi bir alttaki rakamın içinden
     geçiyordu — kullanıcının "tablo bozuk" dediği şey buydu. */
  const satirYuksekligi = satirYuksekligiIcin(valueSize);
  const rowStep = present.length > 0
    ? +Math.max(satirYuksekligi, Math.min(8.1 * k, rowsSpace / present.length)).toFixed(2)
    : 0;

  const rows: NameplateRow[] = present.map(([label, value], index) => {
    const y = +(rowsTop + valueSize + index * rowStep).toFixed(2);
    return {
      label,
      value,
      y,
      labelSize,
      valueSize,
      // Ayırıcı çizgi İKİ TABAN ÇİZGİSİNİN ORTASINDADIR ve yerleşimden gelir;
      // iki çizici onu ayrı ayrı hesaplarsa biri gün gelip kayar.
      ruleY: +(y + rowStep / 2).toFixed(2),
    };
  });
  const sonSatirAlti = rows.length > 0 ? rows[rows.length - 1].ruleY : rowsTop;
  if (sonSatirAlti > contentBottom) {
    issues.push("Veri satırları bu ölçüye sığmıyor; plakayı büyütün veya alan gizleyin.");
  }

  // ————————————————————————————————————————————————— QR ve yedeği
  const qrX = +(rightX + (rightColW - qrSize) / 2).toFixed(2);
  const qrCaptionSize = size(3.0, 1.9);
  const qrY = +(contentTop + qrCaptionSize + Math.max(2, 5 * k)).toFixed(2);
  const qr = qrGeometry(input.publicUrl, qrX, qrY, qrSize);
  if (qr.moduleMm < QR_MODULE_MIN_MM) {
    issues.push(`QR modülü ${qr.moduleMm.toFixed(2)} mm; ${QR_MODULE_MIN_MM} mm altında ucuz okuyucular kodu tanımayabilir.`);
  }
  const centerX = +(rightX + rightColW / 2).toFixed(2);
  const captionGlyphs = trackedGlyphs("TEKNİK DOKÜMANLAR", 0, qrCaptionSize, qrCaptionSize * 0.11);
  const captionWidth = trackedWidth(captionGlyphs, qrCaptionSize);
  const qrCaption = {
    glyphs: captionGlyphs.map((glyph) => ({ ...glyph, x: +(glyph.x + centerX - captionWidth / 2).toFixed(3) })),
    y: +(contentTop + qrCaptionSize).toFixed(2),
    size: qrCaptionSize,
    centerX,
  };

  /*
   * QR'IN YAZILI YEDEĞİ — kod kirlenir, çizilir, boya alır.
   *
   * Plaka on yıl sahada durur. Okunmayan bir QR, elinde telefonla duran bir
   * servisçiyi çıkmaza sokar; kodun ve adresin insan gözüyle okunabilir hâli
   * tek geri dönüş yoludur.
   */
  const codeFromUrl = input.publicUrl.split("/").filter(Boolean).pop() ?? "";
  const fallbackCodeSize = size(2.6, 1.8);
  const fallbackUrlSize = size(2.0, MIN_LEGAL_SIZE);
  const shortUrl = input.publicUrl.replace(/^https?:\/\//i, "");
  const fallback = {
    code: codeFromUrl,
    url: shortUrl,
    x: centerX,
    codeY: +(qrY + qrSize + fallbackCodeSize + Math.max(1.2, 3 * k)).toFixed(2),
    urlY: +(qrY + qrSize + fallbackCodeSize + fallbackUrlSize + Math.max(2.4, 5.5 * k)).toFixed(2),
    codeSize: fallbackCodeSize,
    urlSize: fallbackUrlSize,
  };

  // Seri numarası kutusu yalnız yer kaldıysa basılır; satırlarda zaten vardır.
  const serialBoxTop = +(fallback.urlY + Math.max(1.5, 4 * k)).toFixed(2);
  const serialBoxH = +(Math.max(8, 16 * k)).toFixed(2);
  const serialBox = serialBoxTop + serialBoxH <= contentBottom
    ? {
        x: rightX,
        y: serialBoxTop,
        width: rightColW,
        height: serialBoxH,
        label: "SERİ NUMARASI",
        value: normalized(input.serialNo),
        labelY: +(serialBoxTop + serialBoxH * 0.36).toFixed(2),
        valueY: +(serialBoxTop + serialBoxH * 0.82).toFixed(2),
        labelSize: size(2.25, MIN_LEGAL_SIZE),
        valueSize: fitMonoSize(normalized(input.serialNo), rightColW * 0.9, [size(4.1, 2.4), size(3.6, 2.4), size(3.1, 2.4), 2.4]),
        centerX,
      }
    : null;

  // ————————————————————————————————————————————————— yasal bant
  const legalSize = size(2.2, MIN_LEGAL_SIZE);
  /* ASGARİ 5 mm KELEPÇESİ UYARIYI ÖLDÜRÜYORDU: yükseklik `Math.max(5, …)` ile
     kurulup sonra `< 5` diye sınanıyordu, yani koşul matematiksel olarak
     imkânsızdı ve BELGE-3'ün "5 mm altına inerse yerleşim uyarı üretir"
     güvencesi pratikte yoktu. Doğal yükseklik AYRI ölçülür, kelepçe sonra
     uygulanır ve fark kullanıcıya söylenir. */
  const ceDogalYukseklik = +(legalH * 0.52).toFixed(2);
  const ceHeight = Math.max(5, ceDogalYukseklik);
  const ceY = +(legalY + (legalH - ceHeight) / 2).toFixed(2);
  const ce = input.ceMark === false
    ? null
    : (() => {
        const mark = ceMarkPath(padX, ceY, ceHeight);
        return { x: padX, y: ceY, height: ceHeight, path: mark.path, width: mark.width };
      })();
  if (ce && ceDogalYukseklik < 5) {
    issues.push(
      "Yasal bant CE işareti için dar; işaret 765/2008/AT asgarisi olan 5 mm'ye kelepçelendi ve banttan taşabilir."
    );
  }

  const legalX = +(padX + (ce ? ce.width + Math.max(2, 5 * k) : 0)).toFixed(2);
  const manufacturer = normalized(input.identity.manufacturer);
  const address = normalized(input.identity.manufacturerAddress);
  const year = normalized(input.identity.productionYear);
  if (!address) issues.push("İmalatçı adresi boş; md. 1.7.3 ticari unvan ve TAM ADRES ister.");
  if (!year) issues.push("Üretim yılı boş; md. 1.7.3 imalatın tamamlandığı yılı ister.");

  const legalMaxWidth = +(widthMm - rightPad - legalX).toFixed(2);
  const legalLineOne = trUpper([manufacturer, year ? `İMAL YILI ${year}` : ""].filter(Boolean).join(" · "));
  const legalLines = [
    { text: legalLineOne, y: +(legalY + legalH * 0.42).toFixed(2), size: legalSize },
    ...(address ? [{ text: address, y: +(legalY + legalH * 0.82).toFixed(2), size: +(legalSize * 0.92).toFixed(2) }] : []),
  ].filter((line) => line.text);
  for (const line of legalLines) {
    if (estimatedTextWidth(line.text, line.size) > legalMaxWidth) {
      issues.push("İmalatçı künyesi yasal banda sığmıyor; adresi kısaltın veya plakayı büyütün.");
      break;
    }
  }

  // ————————————————————————————————————————————————— montaj delikleri
  const diameter = Number(input.holeDiameterMm);
  const inset = Number(input.holeInsetMm);
  const holes = Number.isFinite(diameter) && diameter > 0 && Number.isFinite(inset) && inset > diameter / 2
    ? [
        { cx: inset, cy: inset, r: diameter / 2 },
        { cx: widthMm - inset, cy: inset, r: diameter / 2 },
        { cx: inset, cy: heightMm - inset, r: diameter / 2 },
        { cx: widthMm - inset, cy: heightMm - inset, r: diameter / 2 },
      ]
    : [];
  // Delik çizimin ÜSTÜNE düşmemelidir: sol delikler kırmızı şeridin içinde
  // kalmalı, aksi hâlde delme sırasında yazı gider.
  if (holes.length > 0 && inset + diameter / 2 > padX) {
    issues.push("Montaj delikleri yazı alanına giriyor; delik payını artırın.");
  }

  const smallestText = Math.min(
    labelSize,
    ...rows.map((row) => row.valueSize),
    legalSize,
    fallback.urlSize
  );
  // Tabanlar eşikle aynı olduğu için bu normalde ATEŞLENMEZ; biri tabanı
  // düşürürse diye duran bir değişmez bekçisidir.
  if (smallestText < READABLE_MIN_MM) {
    issues.push(`En küçük yazı ${smallestText.toFixed(2)} mm; kazımada ${READABLE_MIN_MM} mm altı okunmaz.`);
  }

  return {
    widthMm,
    heightMm,
    palette,
    fits: issues.length === 0,
    issues,
    frameInset,
    accent: { width: accentW },
    header: {
      y: headerY,
      height: headerH,
      logo,
      customerLogo,
      customerName,
      customerNameX: +(bandX + bandW - Math.max(2, 4 * k)).toFixed(2),
      customerNameY: +(headerY + headerH * 0.62).toFixed(2),
      customerNameSize: size(3.4, 2.2),
      rule: { y: +(headerY + headerH).toFixed(2), height: headerRuleH },
    },
    kicker,
    title,
    capacity,
    rows,
    labelX,
    valueX,
    rowRuleX2: +(padX + leftColW).toFixed(2),
    divider: rows.length > 0 || serialBox
      ? { x: dividerX, y1: contentTop, y2: contentBottom }
      : null,
    qr,
    qrCaption,
    fallback,
    serialBox,
    legal: {
      y: legalY,
      height: legalH,
      rule: { y: legalY },
      ce,
      lines: legalLines,
      x: legalX,
    },
    holes,
    customerLogoDataUrl,
  };
}

function clampDimension(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * PLAKAYA KAZINAN ADRES — kısa ve KALICI.
 *
 * `/qr/<kod>`, `next.config.ts` rewrite'ıyla portala yönlenir. Portalın iç yolu
 * değişse bile bu adres sabit kalır; plaka sökülemeyeceği için tek doğru
 * tasarım budur. Kısalığı da bedava değildir: 11 karakter az adres, aynı
 * fiziksel alanda daha büyük QR modülü demektir.
 *
 * Eski `/paylas/vinc/<kod>` adresi ÇALIŞMAYA DEVAM EDER — daha önce basılmış
 * bir plaka varsa geçerliliğini korur.
 */
export function productPortalUrl(origin: string, publicCode: string): string {
  const normalizedOrigin = origin.trim().replace(/\/+$/, "");
  return `${normalizedOrigin}/qr/${encodeURIComponent(publicCode)}`;
}

// ————————————————————————————————————————————————————————— SVG çizici

function glyphRun(glyphs: readonly TrackedGlyph[], y: number, size: number, fill: string, weight = 700): string {
  return glyphs
    .map((glyph) => `<text x="${glyph.x.toFixed(3)}" y="${y}" class="mono" fill="${fill}" font-size="${size}" font-weight="${weight}">${xmlEscape(glyph.char)}</text>`)
    .join("");
}

export function buildNameplateSvg(input: NameplateInput): string {
  const l = createNameplateLayout(input);
  const p = l.palette;
  const bandX = l.accent.width;
  const bandW = l.widthMm - l.accent.width - l.header.y;

  const customer = l.header.customerLogo && l.customerLogoDataUrl
    ? `<rect x="${l.header.customerLogo.x - 2}" y="${l.header.customerLogo.y - 1.5}" width="${l.header.customerLogo.width + 4}" height="${l.header.customerLogo.height + 3}" fill="${p.paper}"/>
       <image href="${xmlEscape(l.customerLogoDataUrl)}" x="${l.header.customerLogo.x}" y="${l.header.customerLogo.y}" width="${l.header.customerLogo.width}" height="${l.header.customerLogo.height}" preserveAspectRatio="xMidYMid meet"/>`
    : l.header.customerName
      ? `<text x="${l.header.customerNameX}" y="${l.header.customerNameY}" text-anchor="end" class="sans" fill="${p.bandText}" font-size="${l.header.customerNameSize}" font-weight="700">${xmlEscape(trUpper(l.header.customerName))}</text>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${l.widthMm}mm" height="${l.heightMm}mm" viewBox="0 0 ${l.widthMm} ${l.heightMm}" role="img" aria-label="${xmlEscape(input.serialNo)} vinç kimlik plakası">
  <style>
    ${input.embeddedFontsCss ?? ""}
    .sans{font-family:Archivo,Arial,sans-serif}.mono{font-family:PlexMono,"IBM Plex Mono",monospace}
  </style>
  <rect width="${l.widthMm}" height="${l.heightMm}" fill="${p.paper}"/>
  <rect x="${l.frameInset}" y="${l.frameInset}" width="${(l.widthMm - l.frameInset * 2).toFixed(2)}" height="${(l.heightMm - l.frameInset * 2).toFixed(2)}" fill="none" stroke="${p.ink}" stroke-width="${(l.frameInset * 0.5).toFixed(2)}"/>
  <rect x="0" y="0" width="${l.accent.width}" height="${l.heightMm}" fill="${p.accent}"/>
  <rect x="${bandX}" y="${l.header.y}" width="${bandW.toFixed(2)}" height="${l.header.height}" fill="${p.band}"/>
  <image href="${xmlEscape(input.logoDataUrl)}" x="${l.header.logo.x}" y="${l.header.logo.y}" width="${l.header.logo.width}" height="${l.header.logo.height}" preserveAspectRatio="xMinYMid meet"/>
  ${customer}
  <rect x="${bandX}" y="${l.header.rule.y}" width="${bandW.toFixed(2)}" height="${l.header.rule.height}" fill="${p.accent}"/>
  ${glyphRun(l.kicker.glyphs, l.kicker.y, l.kicker.size, p.accent)}
  ${l.title.lines.map((line, index) => `<text data-nameplate-title-line="${index + 1}" x="${l.title.x}" y="${(l.title.y + index * l.title.lineHeight).toFixed(2)}" class="sans" fill="${p.ink}" font-size="${l.title.size}" font-weight="800">${xmlEscape(line)}</text>`).join("")}
  ${l.capacity ? `<rect x="${l.capacity.x}" y="${l.capacity.y}" width="${l.capacity.width}" height="${l.capacity.height}" fill="none" stroke="${p.accent}" stroke-width="${(l.frameInset * 0.45).toFixed(2)}"/>
  <text x="${(l.capacity.x + l.capacity.height * 0.24).toFixed(2)}" y="${(l.capacity.y + l.capacity.height * 0.38).toFixed(2)}" class="mono" fill="${p.accent}" font-size="${l.capacity.labelSize}" font-weight="700">${xmlEscape(l.capacity.label)}</text>
  <text x="${(l.capacity.x + l.capacity.height * 0.24).toFixed(2)}" y="${(l.capacity.y + l.capacity.height * 0.88).toFixed(2)}" class="mono" fill="${p.ink}" font-size="${l.capacity.valueSize}" font-weight="700">${xmlEscape(l.capacity.value)}</text>` : ""}
  ${l.divider ? `<line x1="${l.divider.x}" y1="${l.divider.y1}" x2="${l.divider.x}" y2="${l.divider.y2}" stroke="${p.accent}" stroke-width="${(l.frameInset * 0.45).toFixed(2)}"/>` : ""}
  ${l.rows.map((row) => `<g>
    <line x1="${l.labelX}" y1="${row.ruleY}" x2="${l.rowRuleX2}" y2="${row.ruleY}" stroke="${p.hairline}" stroke-width="0.32"/>
    <text x="${l.labelX}" y="${row.y}" class="mono" fill="${p.muted}" font-size="${row.labelSize}" font-weight="600">${xmlEscape(row.label)}</text>
    <text x="${l.valueX}" y="${row.y}" class="mono" fill="${p.ink}" font-size="${row.valueSize}" font-weight="700">${xmlEscape(row.value)}</text>
  </g>`).join("")}
  ${glyphRun(l.qrCaption.glyphs, l.qrCaption.y, l.qrCaption.size, p.accent)}
  <rect x="${l.qr.x}" y="${l.qr.y}" width="${l.qr.size}" height="${l.qr.size}" fill="#FFFFFF" stroke="${p.hairline}" stroke-width="0.35"/>
  <path d="${l.qr.path}" fill="#000000" shape-rendering="crispEdges"/>
  <text x="${l.fallback.x}" y="${l.fallback.codeY}" text-anchor="middle" class="mono" fill="${p.ink}" font-size="${l.fallback.codeSize}" font-weight="700">${xmlEscape(l.fallback.code)}</text>
  <text x="${l.fallback.x}" y="${l.fallback.urlY}" text-anchor="middle" class="mono" fill="${p.muted}" font-size="${l.fallback.urlSize}">${xmlEscape(l.fallback.url)}</text>
  ${l.serialBox ? `<rect x="${l.serialBox.x}" y="${l.serialBox.y}" width="${l.serialBox.width}" height="${l.serialBox.height}" fill="${p.band}"/>
  <text x="${l.serialBox.centerX}" y="${l.serialBox.labelY}" text-anchor="middle" class="mono" fill="${p.paper}" font-size="${l.serialBox.labelSize}">${xmlEscape(l.serialBox.label)}</text>
  <text x="${l.serialBox.centerX}" y="${l.serialBox.valueY}" text-anchor="middle" class="mono" fill="${p.bandText}" font-size="${l.serialBox.valueSize}" font-weight="700">${xmlEscape(l.serialBox.value)}</text>` : ""}
  <line x1="${l.accent.width}" y1="${l.legal.rule.y}" x2="${(l.widthMm - l.header.y).toFixed(2)}" y2="${l.legal.rule.y}" stroke="${p.hairline}" stroke-width="0.35"/>
  ${l.legal.ce ? `<path d="${l.legal.ce.path}" fill="${p.ink}"/>` : ""}
  ${l.legal.lines.map((line) => `<text x="${l.legal.x}" y="${line.y}" class="sans" fill="${p.ink}" font-size="${line.size}" font-weight="700">${xmlEscape(line.text)}</text>`).join("")}
  ${l.holes.map((hole) => `<circle cx="${hole.cx}" cy="${hole.cy}" r="${hole.r}" fill="${p.paper}" stroke="${p.ink}" stroke-width="0.8"/>`).join("")}
</svg>`;
}

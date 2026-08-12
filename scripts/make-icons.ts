// Tarayıcı ve uygulama ikonlarını MARKA SEMBOLÜNDEN üretir.
//
//     npx tsx scripts/make-icons.ts
//
// ————————————————————————————————— NEDEN ÜRETİLİYOR, ELLE ÇİZİLMİYOR
//
// Kullanıcı bildirimi (12.08.2026): Chrome sekmesinde ve telefona kaydedilen
// uygulamada firma logosu yoktu — `src/app/favicon.ico` hâlâ Next'in kurulum
// şablonundan gelen üçgendi ve manifest hiç yoktu.
//
// İkon TEK KAYNAKTAN türer: `public/brand/orion-symbol.svg`. Marka sembolü bir
// gün rötuşlanırsa dokuz ayrı PNG'yi elle güncellemek gerekmesin diye bu betik
// yazıldı; sembolün `d` yolları buradan OKUNUR, kopyalanmaz.
//
// ————————————————————————————————— ÜÇ AYRI İKON, ÜÇ AYRI SEBEP
//
// 1. `icon.svg` / `favicon.ico` — SEKME. 16 pikselde okunması gereken tek şey
//    sembolün silueti; bu yüzden sembol karenin %76'sını kaplar. Zemin KÖMÜR,
//    sembol KAĞIT: kabuğun sol menüsüyle aynı okuma, ve tarayıcının açık/koyu
//    temasından bağımsız (kutu kendi zeminini taşır). Şeffaf zeminli bir
//    sembol, koyu temalı sekme şeridinde kaybolurdu.
//
// 2. `apple-icon.png` — iOS ANA EKRAN. Safari maskeleme yapmaz ama köşeleri
//    kendi yuvarlar; tam kanama (full-bleed) zemin şart.
//
// 3. `icon-maskable-512.png` — ANDROID ANA EKRAN. Launcher ikonu daire ya da
//    squircle'a KIRPAR ve yalnız ortadaki %80'lik daireyi garanti eder. Bu
//    yüzden maskelenebilir sürümde sembol %54'e iner ve köşe yuvarlaması
//    YOKTUR: kırpmayı işletim sistemi yapar, biz zemini kenara kadar
//    taşırırız. Aynı dosyayı ikisi için birden kullanmak, Android'de sembolün
//    kenarlarından kesilmesi demekti.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const KOK = process.cwd();
const MARKA = join(KOK, "public/brand");
const APP = join(KOK, "src/app");

/** Kömür — kabuğun sol menüsüyle aynı ton (`--sidebar`). */
const ZEMIN = "#262626";
/** Kağıt — marka nötrü (`orion-symbol-white.svg`in dolgusu). */
const ISARET = "#F4F1EF";

// ————————————————————————————————————————— sembolün yolları TEK KAYNAK

const kaynak = readFileSync(join(MARKA, "orion-symbol.svg"), "utf8");

const kutu = kaynak.match(/viewBox="([\d.\s-]+)"/)?.[1]?.trim().split(/\s+/).map(Number);
if (!kutu || kutu.length !== 4) throw new Error("orion-symbol.svg: viewBox okunamadı");
const [, , SEMBOL_EN, SEMBOL_BOY] = kutu;

// Sembolün yolları bir `<g transform="translate(...)">` içindedir; ölçekleme
// yaparken o kaydırma korunmalı, yoksa şekil kutunun dışına düşer.
const kaydirma = kaynak.match(/<g transform="(translate\([^)]+\))"/)?.[1];
if (!kaydirma) throw new Error("orion-symbol.svg: iç translate okunamadı");

const yollar = [...kaynak.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
if (yollar.length === 0) throw new Error("orion-symbol.svg: hiç path bulunamadı");

/**
 * Kare bir marka karosu üretir.
 *
 * `oran` sembolün GENİŞLİĞİNİN karenin kaçta kaçı olacağıdır. Sembol geniş bir
 * şekildir (147×96) — yüksekliğe göre ölçeklemek onu yatayda taşırırdı.
 */
function karo({ oran, yuvarlak }: { oran: number; yuvarlak: number }): string {
  const BOY = 512;
  const hedefEn = BOY * oran;
  const olcek = hedefEn / SEMBOL_EN;
  const x = (BOY - hedefEn) / 2;
  const y = (BOY - SEMBOL_BOY * olcek) / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOY} ${BOY}" width="${BOY}" height="${BOY}">`,
    `<rect width="${BOY}" height="${BOY}" rx="${yuvarlak}" fill="${ZEMIN}"/>`,
    `<g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${olcek.toFixed(6)}) ${kaydirma}" fill="${ISARET}">`,
    ...yollar.map((d) => `<path d="${d}"/>`),
    `</g></svg>`,
  ].join("");
}

/** Sekme ve ana ekran karosu — köşeler hafif yuvarlak. */
const KARO = karo({ oran: 0.76, yuvarlak: 64 });
/** Android maskeleme karosu — güvenli alan için küçük sembol, köşe yuvarlaması YOK. */
const KARO_MASKE = karo({ oran: 0.54, yuvarlak: 0 });

// —————————————————————————————————————————————————————————————— PNG

/**
 * SVG'yi hedef boyda RASTERLER — büyük bir PNG'yi küçültmez.
 *
 * `density` librsvg'ye hangi çözünürlükte çizeceğini söyler; 512'lik bir
 * rasterı 16'ya indirmek ince hilalleri bulanıklaştırıyordu.
 */
async function png(svg: string, boy: number): Promise<Buffer> {
  const density = Math.max(72, Math.round((72 * boy) / 512));
  return sharp(Buffer.from(svg), { density }).resize(boy, boy).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * ICO kabı — içine PNG konur (Vista+ ve bütün modern tarayıcılar okur).
 *
 * `.ico` hâlâ gereklidir: Chrome sekmede SVG'yi tercih eder ama Windows'ta yer
 * imi çubuğu ve kısayol ikonu bu dosyaya düşer — kullanıcının ekran
 * görüntüsündeki üçgen tam olarak oradaydı.
 */
function ico(pngler: { boy: number; veri: Buffer }[]): Buffer {
  const baslik = Buffer.alloc(6);
  baslik.writeUInt16LE(0, 0); // ayrılmış
  baslik.writeUInt16LE(1, 2); // tür: ikon
  baslik.writeUInt16LE(pngler.length, 4);

  const girisler: Buffer[] = [];
  let ofset = 6 + pngler.length * 16;
  for (const { boy, veri } of pngler) {
    const g = Buffer.alloc(16);
    g.writeUInt8(boy >= 256 ? 0 : boy, 0); // 256 => 0
    g.writeUInt8(boy >= 256 ? 0 : boy, 1);
    g.writeUInt8(0, 2); // palet yok
    g.writeUInt8(0, 3);
    g.writeUInt16LE(1, 4); // düzlem
    g.writeUInt16LE(32, 6); // bit derinliği
    g.writeUInt32LE(veri.length, 8);
    g.writeUInt32LE(ofset, 12);
    ofset += veri.length;
    girisler.push(g);
  }
  return Buffer.concat([baslik, ...girisler, ...pngler.map((p) => p.veri)]);
}

// ———————————————————————————————————————————————————————————— üretim

async function main() {
  mkdirSync(MARKA, { recursive: true });

  writeFileSync(join(MARKA, "orion-icon.svg"), KARO);
  writeFileSync(join(MARKA, "orion-icon-maskable.svg"), KARO_MASKE);
  // Next `app/icon.svg`i metadata dosyası olarak tanır ve `<link rel="icon">`
  // etiketini kendisi basar; ayrıca yazmak yerine aynı karo oraya da konur.
  writeFileSync(join(APP, "icon.svg"), KARO);

  const boylar = [16, 32, 48, 64, 180, 192, 512];
  const uretilen = new Map<number, Buffer>();
  for (const boy of boylar) uretilen.set(boy, await png(KARO, boy));

  writeFileSync(join(APP, "favicon.ico"), ico([16, 32, 48].map((boy) => ({ boy, veri: uretilen.get(boy)! }))));
  // iOS ana ekranı 180×180 ister; `app/apple-icon.png` Next'in tanıdığı addır.
  writeFileSync(join(APP, "apple-icon.png"), uretilen.get(180)!);
  writeFileSync(join(MARKA, "icon-192.png"), uretilen.get(192)!);
  writeFileSync(join(MARKA, "icon-512.png"), uretilen.get(512)!);
  writeFileSync(join(MARKA, "icon-maskable-512.png"), await png(KARO_MASKE, 512));

  console.log("İkonlar üretildi:");
  console.log("  src/app/icon.svg · favicon.ico (16·32·48) · apple-icon.png (180)");
  console.log("  public/brand/icon-192.png · icon-512.png · icon-maskable-512.png");
}

void main();

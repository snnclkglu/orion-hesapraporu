// Katalog SAYFASI defteri — bir katalog ürününün üretici kataloğundaki
// GERÇEK sayfası.
//
// Uygulama katalogdan seçilen ürünün özelliklerini tablo olarak gösterir; ama
// mühendis çoğu zaman sayfanın kendisini de görmek ister (ölçü resmi, dipnot,
// bağlantı ölçüleri, üretici uyarısı). Bu defter, seçilen MARKA + MODEL'i o
// ürünün katalog sayfasına bağlar.
//
// Sayfalar `scripts/catalog-sheets.py` ile üretilir: kaynak PDF'ten hem birebir
// sayfa dilimi (.pdf) hem ekranda gösterilecek görüntü (.webp) kesilir ve
// `manifest.json` yazılır. Dosyalar `catalog-sheets/` altındadır ve YALNIZ
// oturum açmış kullanıcıya `/api/catalog-sheet/...` ucundan sunulur — üretici
// kataloğu herkese açık bir adreste durmaz.
//
// ŞİMDİLİK YALNIZ KAPLİNLER (ÖZGÜN · SIBRE · JAURE). Yeni bir tür eklemek
// betikteki SHEETS listesine satır yazmakla olur; buradaki kod türden bağımsızdır.

import manifest from "./catalog-sheets/manifest.json";

export interface CatalogSheet {
  /** Defter anahtarı — `<tür>/<marka>-<seri>` */
  id: string;
  /** cat_equipment.kind */
  kind: string;
  /** cat_equipment.brand ile BİREBİR aynı yazım */
  brand: string;
  /** attrs.series */
  series: string;
  /** Pop-up başlığı */
  title: string;
  /** Kaynak katalog dosyasının adı (köken bilgisi) */
  source: string;
  /** Basılı sayfa numarası/aralığı (ör. "s.15", "s.44-45") */
  printedPages: string;
  /** Sayfanın birebir PDF dilimi (uç yolu içindeki göreli yol) */
  pdf: string;
  /** Sayfa görüntüleri, basılı sırayla */
  images: string[];
  /**
   * Bu sayfaya düşen model kodları — `cat_equipment.model` ile birebir.
   * Eşleme SERİ üzerinden değil MODEL üzerinden yapılır: "A" serisi ile
   * "ABC-V 260" modeli önek karşılaştırmasında karışırdı.
   */
  models: string[];
}

const SHEETS: CatalogSheet[] = (manifest as { sheets: CatalogSheet[] }).sheets;

/**
 * Karşılaştırma için normalleştirme.
 *
 * Marka alanı katalogdan seçilince veri tabanındaki yazımla ("OZGUN") dolar;
 * elle girildiğinde ya da eski revizyonlarda Türkçe yazımıyla ("ÖZGÜN")
 * durabilir. Bu yüzden boşluk/işaret farkının yanında AKSAN da temizlenir —
 * aksi hâlde aynı ürün iki farklı anahtara düşerdi.
 */
function norm(value: string): string {
  return value
    // Noktasız/noktalı i, Unicode ayrıştırmasıyla sadeleşmez; elle eşlenir.
    .replace(/[ıİ]/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // birleşen aksan işaretleri
    .replace(/[\s._-]+/g, "")
    .toUpperCase();
}

/** tür|marka|model → sayfa */
const BY_BRAND_MODEL = new Map<string, CatalogSheet>();
/**
 * tür|model → sayfa. Marka alanı serbest metin olabildiği için (eski
 * revizyonlarda "SİBRE PİN KAPLİN" gibi) yalnız modelle de aranır. Model kodu
 * bu tür içinde BİRDEN ÇOK markada geçiyorsa kayıt DÜŞÜRÜLÜR: yanlış markanın
 * sayfasını açmaktansa hiç açmamak doğrudur.
 */
const BY_MODEL = new Map<string, CatalogSheet | null>();
/** tür|marka → o markanın sayfası var mı */
const BRANDS = new Set<string>();

for (const sheet of SHEETS) {
  BRANDS.add(`${sheet.kind}|${norm(sheet.brand)}`);
  for (const model of sheet.models) {
    const brandKey = `${sheet.kind}|${norm(sheet.brand)}|${norm(model)}`;
    if (!BY_BRAND_MODEL.has(brandKey)) BY_BRAND_MODEL.set(brandKey, sheet);

    const modelKey = `${sheet.kind}|${norm(model)}`;
    const seen = BY_MODEL.get(modelKey);
    if (seen === undefined) BY_MODEL.set(modelKey, sheet);
    else if (seen && seen.brand !== sheet.brand) BY_MODEL.set(modelKey, null);
  }
}

/**
 * Seçilen ürünün katalog sayfası (yoksa undefined).
 *
 * Eşleme MODEL kodu üzerindendir; seri koduyla önek karşılaştırması YAPILMAZ
 * ("A" serisi ile "ABC-V 260" modeli karışırdı). Model tam eşleşmiyorsa sayfa
 * açılmaz — yakın bir sayfayı göstermek, yanlış ölçü tablosuna bakılmasına
 * yol açardı.
 */
export function findCatalogSheet(
  kind: string,
  brand: string | undefined | null,
  model: string | undefined | null
): CatalogSheet | undefined {
  if (!model) return undefined;
  if (brand) {
    const exact = BY_BRAND_MODEL.get(`${kind}|${norm(brand)}|${norm(model)}`);
    if (exact) return exact;
  }
  return BY_MODEL.get(`${kind}|${norm(model)}`) ?? undefined;
}

/** Bu tür + marka için defterde HERHANGİ bir sayfa var mı? */
export function hasCatalogSheets(kind: string, brand?: string | null): boolean {
  if (!brand) return SHEETS.some((s) => s.kind === kind);
  return BRANDS.has(`${kind}|${norm(brand)}`);
}

/** Uç adresi — dosya yolu defterde geçmiyorsa uç 404 döner. */
export function catalogSheetUrl(relativePath: string): string {
  return `/api/catalog-sheet/${relativePath}`;
}

/**
 * Uçtan sunulmasına izin verilen dosyaların TAM listesi. Yol defterde yoksa
 * dosya okunmaz; böylece uç bir dizin gezme (path traversal) yüzeyi açmaz.
 */
export function catalogSheetFiles(): ReadonlySet<string> {
  const files = new Set<string>();
  for (const sheet of SHEETS) {
    files.add(sheet.pdf);
    for (const image of sheet.images) files.add(image);
  }
  return files;
}

/** Defterdeki tüm sayfalar (yönetim ekranı / test için). */
export function allCatalogSheets(): readonly CatalogSheet[] {
  return SHEETS;
}

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
// `manifest.json` yazılır. Müşteri ekipman listesindeki bağlantıyı üyelik
// olmadan açabilsin diye yalnız manifest izin listesindeki sayfalar
// `/api/catalog-sheet/...` ucundan sunulur; dizin gezme yolu açılmaz.
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
  /** Basılı sayfa numarası/aralığı (ör. "s.15", "s.44-45", "PDF s.106") */
  printedPages: string;
  /**
   * Sayfa görüntüleri, basılı sırayla. PDF dilimi SAKLANMAZ: kaynak sayfanın
   * taranmış görüntüsünü olduğu gibi taşıdığı için dosya başına 200–800 KB
   * tutuyordu ve 260'ı aşkın sayfada depoyu gereksiz şişirirdi. Görüntü her
   * tarayıcıda açılır, indirilir ve yazdırılır.
   */
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
    .toUpperCase()
    // SIBRE TE freninin eski kayıtları "TE 315 Ed 50/6" / "TE 315 50/6",
    // düzeltilmiş katalog ise üreticinin sipariş düzeniyle "TE315/50/6"
    // taşır. Üç yazım aynı üründür; eski revizyonun katalog sayfası kopmaz.
    .replace(/TE(\d{3})(?:ED)?(\d+\/\d+)/g, "TE$1/$2");
}

/**
 * Sunum katmanının "boş" işaretlerini gerçek marka saymaz.
 *
 * Ekipman listesi, markası olmayan satırlara MARKA sütununda "-" yazar
 * (`textOr`). Bu metin markaymış gibi ele alındığında iki şey birden bozuluyordu:
 * `<tür>|-|<model>` anahtarı hiçbir zaman tutmuyor VE marka önekini modelden
 * ayıklayan yol hiç çalışmıyordu (`brand` dolu sayıldığı için defterdeki marka
 * adları denenmiyordu). Sonuç: redüktör ve tampon gibi kimliği tek birleşik
 * "MARKA MODEL" alanında duran bölümlerin HİÇBİRİ katalog sayfası bulamıyordu.
 */
function realBrand(brand: string | null | undefined): string | null {
  const trimmed = (brand ?? "").trim();
  return trimmed === "" || trimmed === "-" || trimmed === "—" ? null : trimmed;
}

/**
 * Kod SONEKİNİ atar: "22212 E" → "22212".
 *
 * Rulman kodları katalogda tasarım sonekiyle basılır (E, EK, CC/W33); mühendis
 * ise çoğu zaman temel kodu girer. `bearingHousingCompatibilityKey` aynı
 * gerçeği yatak eşlemesinde zaten kabul eder. Sonek yalnız kod RAKAMLA
 * bitiyorsa atılır — "SNL 205" gibi kodların sonu zaten rakamdır ve dokunulmaz.
 */
function baseCode(normalized: string): string {
  const m = /^(.*\d)[A-Z]{1,3}$/.exec(normalized);
  return m && m[1].length >= 3 ? m[1] : normalized;
}

/** tür|marka|model → sayfa */
const BY_BRAND_MODEL = new Map<string, CatalogSheet>();
/**
 * tür|marka|temel kod → sayfa. Tam kod bulunamazsa başvurulur. Aynı temel kod
 * FARKLI sayfalara düşüyorsa kayıt düşürülür: iki üründen birini tahminle
 * seçmektense sayfa açmamak doğrudur.
 */
const BY_BASE = new Map<string, CatalogSheet | null>();
/**
 * tür|temel kod → sayfa. Bazı bölümlerin katalog eşlemesinde MARKA alanı hiç
 * yoktur (ör. 2.2.6 tambur rulmanı yalnız kod ve yük sayılarını doldurur);
 * orada marka bilinmeden aranır.
 */
const BY_BASE_MODEL = new Map<string, CatalogSheet | null>();
/**
 * tür|model → sayfa. Marka alanı serbest metin olabildiği için (eski
 * revizyonlarda "SİBRE PİN KAPLİN" gibi) yalnız modelle de aranır. Model kodu
 * bu tür içinde BİRDEN ÇOK markada geçiyorsa kayıt DÜŞÜRÜLÜR: yanlış markanın
 * sayfasını açmaktansa hiç açmamak doğrudur.
 */
const BY_MODEL = new Map<string, CatalogSheet | null>();
/** tür|marka → o markanın sayfası var mı */
const BRANDS = new Set<string>();
/** Defterdeki markaların normalleştirilmiş adları — model önekini ayıklamak için */
const BRAND_TOKENS = new Set<string>();

for (const sheet of SHEETS) {
  BRANDS.add(`${sheet.kind}|${norm(sheet.brand)}`);
  BRAND_TOKENS.add(norm(sheet.brand));
  for (const model of sheet.models) {
    const normalized = norm(model);
    const brandKey = `${sheet.kind}|${norm(sheet.brand)}|${normalized}`;
    if (!BY_BRAND_MODEL.has(brandKey)) BY_BRAND_MODEL.set(brandKey, sheet);

    const modelKey = `${sheet.kind}|${normalized}`;
    const seen = BY_MODEL.get(modelKey);
    if (seen === undefined) BY_MODEL.set(modelKey, sheet);
    else if (seen && seen.brand !== sheet.brand) BY_MODEL.set(modelKey, null);

    const base = baseCode(normalized);
    if (base !== normalized) {
      const baseKey = `${sheet.kind}|${norm(sheet.brand)}|${base}`;
      const prior = BY_BASE.get(baseKey);
      if (prior === undefined) BY_BASE.set(baseKey, sheet);
      else if (prior && prior.id !== sheet.id) BY_BASE.set(baseKey, null);

      const plainKey = `${sheet.kind}|${base}`;
      const priorPlain = BY_BASE_MODEL.get(plainKey);
      if (priorPlain === undefined) BY_BASE_MODEL.set(plainKey, sheet);
      else if (priorPlain && priorPlain.id !== sheet.id) BY_BASE_MODEL.set(plainKey, null);
    }
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
  brandInput: string | undefined | null,
  model: string | undefined | null
): CatalogSheet | undefined {
  if (!model) return undefined;
  const brand = realBrand(brandInput);
  const normalized = norm(model);
  const candidates = [normalized];
  // Eski kayıtlarda model alanına marka da yazılmış olabilir
  // ("SIBRE TE250 Ed 50/6"); katalogdaki kod yalnız "TE 250 Ed 50/6"dır.
  for (const b of brand ? [norm(brand)] : [...BRAND_TOKENS]) {
    if (b.length >= 3 && normalized.startsWith(b) && normalized.length > b.length) {
      candidates.push(normalized.slice(b.length));
    }
  }

  for (const key of candidates) {
    if (brand) {
      const exact = BY_BRAND_MODEL.get(`${kind}|${norm(brand)}|${key}`);
      if (exact) return exact;
    }
    const byModel = BY_MODEL.get(`${kind}|${key}`);
    if (byModel) return byModel;
  }
  // Son çare: tasarım soneki atılmış temel kod ("22212" → "22212 E").
  for (const key of candidates) {
    const base = baseCode(key);
    if (brand) {
      const hit = BY_BASE.get(`${kind}|${norm(brand)}|${base}`);
      if (hit) return hit;
    }
    const plain = BY_BASE_MODEL.get(`${kind}|${base}`);
    if (plain) return plain;
  }
  return undefined;
}

/** Bu tür + marka için defterde HERHANGİ bir sayfa var mı? */
export function hasCatalogSheets(kind: string, brand?: string | null): boolean {
  const real = realBrand(brand);
  if (!real) return SHEETS.some((s) => s.kind === kind);
  return BRANDS.has(`${kind}|${norm(real)}`);
}

/** Uç adresi — dosya yolu defterde geçmiyorsa uç 404 döner. */
export function catalogSheetUrl(relativePath: string): string {
  return `/api/catalog-sheet/${relativePath}`;
}

/**
 * Katalog sayfasının MÜŞTERİYE AÇIK adresi — ekipman listesinden, Excel'den ve
 * PDF'ten aynı sade sayfaya gidilir; müşteri üyeliği gerekmez.
 *
 * Adres ürünün KİMLİĞİNİ taşır (tür + marka + model), defterin iç kimliğini
 * değil: `manifest.json` yeniden üretildiğinde sayfa kimlikleri değişebilir ama
 * ürün kimliği değişmez, dolayısıyla eskiden indirilmiş bir Excel'in bağlantısı
 * ölü kalmaz.
 *
 * `origin` verilirse MUTLAK adres üretilir. Excel ve PDF çıktıları uygulamanın
 * dışında (Excel, Acrobat) açıldığı için orada göreli adres çalışmaz.
 */
export function catalogSheetPageUrl(
  kind: string,
  brand: string | null | undefined,
  model: string,
  origin = ""
): string {
  const q = new URLSearchParams({ tur: kind, model });
  const real = realBrand(brand);
  if (real) q.set("marka", real);
  return `${origin}/paylas/katalog?${q.toString()}`;
}

/**
 * Uçtan sunulmasına izin verilen dosyaların TAM listesi. Yol defterde yoksa
 * dosya okunmaz; böylece uç bir dizin gezme (path traversal) yüzeyi açmaz.
 */
export function catalogSheetFiles(): ReadonlySet<string> {
  const files = new Set<string>();
  for (const sheet of SHEETS) {
    for (const image of sheet.images) files.add(image);
  }
  return files;
}

/** Defterdeki tüm sayfalar (yönetim ekranı / test için). */
export function allCatalogSheets(): readonly CatalogSheet[] {
  return SHEETS;
}

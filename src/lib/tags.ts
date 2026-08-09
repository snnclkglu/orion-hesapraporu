// Pastel etiket dili — müşteri adları ve satış kapsamları tek bir mekanizmadan
// renklenir.
//
// RENK BİR AÇIDIR, HEX DEĞİL. Bir hex hem açık hem koyu temada okunamaz: açık
// temada güzel duran soluk pastel, koyu zeminde kaybolur. Bu yüzden veri yalnız
// OKLCH TON AÇISINI (0–359) taşır; doygunluk ve parlaklık `globals.css`teki
// `.oc-tag` kuralındadır ve tema başına ayrı verilir. Sonuç: kullanıcı tonu
// seçer, "soft pastel" kuralını bozamaz.
//
// Müşteri rengi DEFTERDE saklanır (`customers.color_hue`) — kalıcı ve
// düzenlenebilir olması gerekir. Kapsam ve deftere bağlanmamış müşteri adı gibi
// kendi kaydı olmayan etiketler ise metinden TÜRETİLİR (`hueFromText`): aynı
// metin her ekranda aynı rengi alır, tablo tutmaya gerek kalmaz.

/** Etiketin renk açısını CSS'e taşıyan inline stil. */
export function tagStyle(hue: number): React.CSSProperties {
  return { "--oc-hue": `${normalizeHue(hue)}` } as React.CSSProperties;
}

/** 0–359 aralığına indirger (negatif ve taşan değerler dâhil). */
export function normalizeHue(hue: number): number {
  if (!Number.isFinite(hue)) return 0;
  return ((Math.round(hue) % 360) + 360) % 360;
}

/**
 * Metinden kararlı ton açısı — kendi kaydı olmayan etiketler için.
 *
 * FNV-1a: kısa metinlerde iyi dağılır ve her çalıştırmada aynı sonucu verir
 * (sunucuda üretilen renk ile istemcide üretilen renk aynı olmalıdır).
 * Sonuç ALTIN AÇIYA oturtulur: ardışık kovalar renk çemberinde birbirinden
 * uzağa düşer, benzer metinler benzer renk almaz.
 */
export function hueFromText(text: string): number {
  const key = (text ?? "").trim().toLocaleLowerCase("tr");
  if (!key) return 0;
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ((hash % 360) * 137) % 360;
}

/**
 * Var olanlardan EN UZAK ton — yeni müşteri açılırken çağrılır.
 *
 * Sırayla artan bir sayaç kullanmak (n × 137) kayıt silinince çakışırdı;
 * burada aday tonlar taranır ve en yakın komşusuna uzaklığı en büyük olan
 * seçilir. Defter boşsa 0 (mercan) ile başlanır.
 */
export function nextDistinctHue(used: readonly number[]): number {
  const taken = used.map(normalizeHue);
  if (taken.length === 0) return 0;
  let best = 0;
  let bestGap = -1;
  for (let hue = 0; hue < 360; hue += 5) {
    let gap = 360;
    for (const t of taken) {
      const d = Math.abs(hue - t);
      gap = Math.min(gap, Math.min(d, 360 - d));
    }
    if (gap > bestGap) {
      bestGap = gap;
      best = hue;
    }
  }
  return best;
}

// ------------------------------------------------------------------ müşteri

/** Resmî unvanın sonundaki şirket türü ekleri — kısaltmada anlam taşımazlar. */
const LEGAL_SUFFIX =
  /\b(a\.?\s?ş\.?|ltd\.?|şti\.?|t\.?a\.?ş\.?|san\.?|tic\.?|ith\.?|ihr\.?|inş\.?|anonim|şirketi|sanayi|ticaret|limited)\b/gi;

/**
 * Kısaltmanın otomatik değeri: adın İLK KELİMESİ (firma kuralı).
 *
 * "LITEC MAKİNA SAN. VE TİC. A.Ş." → "LITEC". Kullanıcı bunu her zaman
 * düzeltebilir; burada üretilen yalnız başlangıç değeridir. İlk kelime bir
 * şirket türü ekiyse (ör. adı "A.Ş. ..." ile başlıyorsa) atlanır.
 */
export function autoShortName(name: string): string {
  const cleaned = (name ?? "").replace(LEGAL_SUFFIX, " ").replace(/\s+/g, " ").trim();
  const first = (cleaned || (name ?? "").trim()).split(" ")[0] ?? "";
  return first.replace(/[.,;]+$/, "");
}

export interface CustomerTag {
  /** Ekranda görünen kısa ad */
  short: string;
  /** Tam unvan — başlık (title) ve arama için */
  full: string;
  hue: number;
}

/**
 * Bir müşteri satırının etiketi. Defter kaydı yoksa (iş emrine elle yazılmış
 * eski müşteri) ad metninden türetilir; ekran hiçbir zaman renksiz/kısaltmasız
 * kalmaz.
 */
export function customerTag(input: {
  name: string;
  shortName?: string | null;
  hue?: number | null;
}): CustomerTag {
  const full = (input.name ?? "").trim();
  const short = (input.shortName ?? "").trim() || autoShortName(full) || full;
  const hue =
    input.hue === null || input.hue === undefined ? hueFromText(full) : normalizeHue(input.hue);
  return { short, full, hue };
}

// ------------------------------------------------------------------- kapsam

/**
 * Satış kapsamı seçenekleri — Satış Takibi penceresindeki açılır liste.
 *
 * Liste devralınan verideki gerçek kapsamlardan çıkarıldı (ORİON-İş Fiyatları
 * "İş Listesi" sayfası): satırların büyük çoğunluğu "Komple İmalat"tır, geri
 * kalanı hizmet (mühendislik, hesap raporu, işçilik), malzeme satışı ve
 * "… hariç" kurgulu kısmi kapsamlardır.
 *
 * Seçenek listesi KAPALI DEĞİLDİR: kayıtta listede olmayan bir kapsam varsa
 * pencere onu kendi seçeneği olarak korur ve "Diğer" ile yeni serbest metin
 * yazılabilir. Aksi hâlde eski satırlardaki ayrıntılı kapsam metinleri ilk
 * kaydetmede sessizce silinirdi.
 */
export const SALE_SCOPES: readonly string[] = [
  "Komple İmalat",
  "Kısmi İmalat",
  "Mühendislik ve Tasarım Hizmeti",
  "Hesap Raporu ve Analiz",
  "İşçilik",
  "Malzeme Satışı",
  "Montaj ve Devreye Alma",
  "Nakliye",
  "Yedek Parça",
  "Revizyon ve Modernizasyon",
];

/**
 * Sık kullanılan kapsamların SABİT tonları. Hash'e bırakılsaydı liste
 * sıralaması ya da yazım düzeltmesi rengi kaydırırdı; bu üç-beş etiket her gün
 * görüldüğü için tanınabilir kalmalıdır. Listede olmayan kapsam metinden
 * türetilir.
 */
const SCOPE_HUES: Record<string, number> = {
  "komple imalat": 150, // yeşil — tam kapsam
  "kısmi imalat": 75, // zeytin
  "mühendislik ve tasarım hizmeti": 250, // mavi — hizmet
  "hesap raporu ve analiz": 285, // mor
  "işçilik": 40, // amber
  "malzeme satışı": 200, // camgöbeği
  "montaj ve devreye alma": 175, // deniz yeşili
  "nakliye": 320, // eflatun
  "yedek parça": 15, // mercan
  "revizyon ve modernizasyon": 105, // fıstık
};

/** Kapsam etiketinin ton açısı. */
export function scopeHue(scope: string): number {
  const key = (scope ?? "").trim().toLocaleLowerCase("tr");
  return SCOPE_HUES[key] ?? hueFromText(key);
}

/**
 * Kapsam metnini ekranda tek satıra sığdırır. Devralınan kayıtlarda kapsam
 * bazen satır sonlu bir paragraftır ("Köprü İmalatı.\nElektrik, Devreye Alma ve
 * Araba Hariç"); tabloda ilk cümle yeter, tamamı `title` ile görünür.
 */
export function scopeLabel(scope: string): string {
  const flat = (scope ?? "").replace(/\s*\n\s*/g, " · ").replace(/\s+/g, " ").trim();
  return flat.length > 46 ? `${flat.slice(0, 45)}…` : flat;
}

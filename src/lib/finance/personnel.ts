// Personel sözlüğü — kategori, görev, sözleşme, belge türü.
//
// LİSTELER KAPALI DEĞİLDİR (Satış Takibi'ndeki `SALE_SCOPES` kuralının aynısı):
// devralınan kayıtta listede olmayan bir değer varsa pencere onu KENDİ
// seçeneği olarak korur. Aksi hâlde ilk kaydetmede sessizce silinirdi.
//
// Renkler HEX DEĞİL TON AÇISIDIR (`lib/tags.ts`): aynı hex açık ve koyu temada
// birden okunmaz.

import { hueFromText } from "@/lib/tags";

// ————————————————————————————————————————————————————————————— kategori

/**
 * Personel kategorisi — devralınan Excel'deki "KATEGORİ" sütunu.
 *
 * Değerler numaralı gelir ("01 - ÜST YÖNETİM") ve SIRA O NUMARADADIR: özet
 * tablosu yönetim ile personeli ayrı sütunlarda toplar, alfabetik sıralama
 * o ayrımı bozardı.
 */
export const PERSONNEL_CATEGORIES = [
  "01 - ÜST YÖNETİM",
  "02 - ALT YÖNETİM",
  "03 - PERSONEL",
] as const;

export type PersonnelCategory = (typeof PERSONNEL_CATEGORIES)[number];

/**
 * ÖZET İKİ SÜTUNLUDUR: "PERSONEL" ve "YÖNETİM" (Excel'in Maaş Özet Tablosu).
 * Kategori numarası 03 ise personel, değilse yönetimdir — ayrım TEK yerde.
 */
export function yonetimMi(category: string | null | undefined): boolean {
  return !String(category ?? "").trim().startsWith("03");
}

const CATEGORY_HUES: Record<string, number> = {
  "01 - üst yönetim": 25,
  "02 - alt yönetim": 45,
  "03 - personel": 210,
};

export function categoryHue(category: string | null | undefined): number {
  const key = String(category ?? "").trim().toLocaleLowerCase("tr");
  return CATEGORY_HUES[key] ?? hueFromText(key);
}

/** "03 - PERSONEL" → "PERSONEL". Numara sıralama içindir, ekranda gürültüdür. */
export function categoryLabel(category: string | null | undefined): string {
  const s = String(category ?? "").trim();
  const m = /^\d+\s*-\s*(.+)$/.exec(s);
  return (m ? m[1] : s) || "—";
}

// ———————————————————————————————————————————————————————————————— görev

/**
 * Görev tanımı önerileri — devralınan kayıttaki 16 gerçek değer.
 * Alan SERBEST METİNdir (`editable-combobox`), liste yalnız öneridir:
 * yeni bir görev bir migration beklememelidir.
 */
export const JOB_TITLES: readonly string[] = [
  "GENEL MÜDÜR",
  "FİNANS MÜDÜRÜ",
  "PROJE MÜDÜRÜ",
  "ÜRETİM PLANLAMA",
  "SATINALMA",
  "MAKİNE MÜHENDİSİ",
  "TEKNİK RESSAM",
  "KALİTE KONTROL",
  "USTA - İMALAT",
  "USTA - KAYNAKÇI",
  "USTA - TALAŞLI İMALAT",
  "USTA - MEKANİK MONTAJ",
  "USTA - İNCE SAC",
  "YARDIMCI - İMALAT",
  "YEMEKHANE",
  "GENEL",
];

/** Departman önerileri — atölye ve ofis ayrımı. */
export const DEPARTMENTS: readonly string[] = [
  "YÖNETİM",
  "MÜHENDİSLİK",
  "ÜRETİM",
  "MONTAJ",
  "KALİTE",
  "SATIN ALMA",
  "İDARİ İŞLER",
];

// ——————————————————————————————————————————————————————— künye sözlükleri

export const GENDERS = ["kadin", "erkek"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = { kadin: "Kadın", erkek: "Erkek" };

export const MARITAL_STATUSES = ["bekar", "evli"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];
export const MARITAL_LABELS: Record<MaritalStatus, string> = { bekar: "Bekâr", evli: "Evli" };

export const EDUCATION_LEVELS = [
  "ilkokul", "ortaokul", "lise", "onlisans", "lisans", "yukseklisans", "doktora",
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  ilkokul: "İlkokul",
  ortaokul: "Ortaokul",
  lise: "Lise",
  onlisans: "Ön Lisans",
  lisans: "Lisans",
  yukseklisans: "Yüksek Lisans",
  doktora: "Doktora",
};

/** Kan grubu — İSG kaydının zorunlu alanı (acil müdahale). */
export const BLOOD_TYPES = [
  "A Rh+", "A Rh-", "B Rh+", "B Rh-", "AB Rh+", "AB Rh-", "0 Rh+", "0 Rh-",
] as const;

/**
 * Sözleşme türü — 4857 sayılı İş Kanunu md. 9-13.
 * Kıdem/ihbar hesabının girdisidir; bugün yalnız KAYDEDİLİR, hesaplanmaz.
 */
export const CONTRACT_TYPES = [
  "belirsiz", "belirli", "kismi", "cagri", "stajyer", "cirak",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];
export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  belirsiz: "Belirsiz Süreli",
  belirli: "Belirli Süreli",
  kismi: "Kısmi Süreli",
  cagri: "Çağrı Üzerine",
  stajyer: "Stajyer",
  cirak: "Çırak",
};

export const WORK_MODES = ["tam", "yarim", "vardiya"] as const;
export type WorkMode = (typeof WORK_MODES)[number];
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  tam: "Tam Zamanlı",
  yarim: "Yarı Zamanlı",
  vardiya: "Vardiyalı",
};

/** İşten ayrılma nedeni — SGK çıkış kodlarının sadeleştirilmiş karşılığı. */
export const EXIT_REASONS = [
  "istifa", "fesih", "sure", "emeklilik", "askerlik", "devamsizlik", "karsilikli", "diger",
] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];
export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  istifa: "İstifa",
  fesih: "İşveren Feshi",
  sure: "Süre Bitimi",
  emeklilik: "Emeklilik",
  askerlik: "Askerlik",
  devamsizlik: "Devamsızlık",
  karsilikli: "Karşılıklı Fesih",
  diger: "Diğer",
};

// ————————————————————————————————————————————————————————————— belgeler

/**
 * ÖZLÜK DOSYASI TÜRLERİ.
 *
 * Kaynak 4857 md. 75 (işveren özlük dosyası tutmakla yükümlüdür) ve 6331
 * sayılı İSG Kanunu md. 15-17 (sağlık gözetimi + eğitim kayıtları). Liste
 * mevzuattan çıkarıldı, hayal edilmedi.
 *
 * `expires` TÜRÜN ÖZELLİĞİDİR, satırın değil: periyodik muayene ve İSG
 * eğitimi SÜRELİDİR ve süresi dolan belge bir HATIRLATMAYA dönüşür; kimlik
 * fotokopisinin süresi yoktur ve o alanı sormak gürültüdür.
 */
export const DOCUMENT_KINDS = [
  "sozlesme", "ozluk", "kimlik", "diploma", "isg", "saglik",
  "ehliyet", "sertifika", "sgk", "izin", "ihtar", "zimmet", "diger",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  sozlesme: "İş Sözleşmesi",
  ozluk: "Özlük Formu",
  kimlik: "Kimlik / İkametgâh",
  diploma: "Diploma / Öğrenim",
  isg: "İSG Eğitim Belgesi",
  saglik: "Sağlık Raporu / Periyodik Muayene",
  ehliyet: "Ehliyet / Operatör Belgesi",
  sertifika: "Mesleki Sertifika (Kaynakçı vb.)",
  sgk: "SGK Belgesi (İşe Giriş / Çıkış)",
  izin: "İzin Formu",
  ihtar: "İhtar / Tutanak",
  zimmet: "Zimmet / KKD Teslim",
  diger: "Diğer",
};

/** Süresi olan belge türleri — geçerlilik tarihi yalnız bunlarda sorulur. */
export const EXPIRING_DOCUMENT_KINDS: readonly DocumentKind[] = [
  "isg", "saglik", "ehliyet", "sertifika",
];

export function expiresByDefault(kind: string): boolean {
  return (EXPIRING_DOCUMENT_KINDS as readonly string[]).includes(kind);
}

export function documentKindLabel(kind: string): string {
  return DOCUMENT_KIND_LABELS[kind as DocumentKind] ?? kind;
}

const DOCUMENT_HUES: Record<string, number> = {
  sozlesme: 250,
  ozluk: 210,
  kimlik: 195,
  diploma: 285,
  isg: 25,
  saglik: 155,
  ehliyet: 105,
  sertifika: 320,
  sgk: 235,
  izin: 60,
  ihtar: 10,
  zimmet: 175,
  diger: 0,
};

export function documentKindHue(kind: string): number {
  return DOCUMENT_HUES[kind] ?? hueFromText(kind);
}

/** Belge boyut tavanı — bucket `file_size_limit` ile AYNI SAYI olmalıdır. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const PERSONNEL_BUCKET = "personnel";

/**
 * DEPO YOLU — kural SAF ÇEKİRDEKTE, çünkü İKİ TARAF DA kurmak zorunda.
 *
 * Tarayıcı baytları doğrudan depoya yükler (server action gövdesi 1 MB'tır ve
 * taranmış bir sözleşme bunu aşar), sunucu ise kaydı yazmadan önce AYNI yolu
 * yeniden kurup dosyayı geri indirir. İki yerde ayrı yazılsaydı uzantı
 * kuralındaki en küçük fark "dosya depoda bulunamadı" hatasına dönüşürdü ve
 * kullanıcı sebebini asla anlamazdı.
 *
 * Sunucu istemciden gelen bir yola ASLA güvenmez — güvenseydi başka bir
 * personelin klasörüne yazmanın yolu olurdu; bu yüzden yol PARAMETRELERDEN
 * yeniden üretilir, taşınmaz.
 *
 * Birinci segment daima sahip kaydın kimliğidir (`drawings`, `reports`,
 * `equipment-attachments` ile aynı kural): silme ve doğrulama
 * `list(<employee_id>)` ile o klasörde çalışır.
 *
 * Kullanıcının yazdığı ad yolun parçası OLMAZ; yalnız uzantısı korunur —
 * Türkçe "İ" (U+0130) taşıyan gerçek bir yol imzalı bağlantıda sessiz hatalar
 * üretiyordu (`lib/drawings/mime.ts` başlığındaki ölçülmüş tuzak).
 */
export function personnelStoragePath(
  employeeId: string,
  documentId: string,
  fileName: string
): string {
  return `${employeeId}/${documentId}${dosyaUzantisi(fileName)}`;
}

/** Son noktadan sonrası, küçük harf. Uzantı yoksa boş dizgi. */
export function dosyaUzantisi(fileName: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec((fileName ?? "").trim());
  return m ? `.${m[1].toLowerCase()}` : "";
}

/**
 * Yüklenebilir belge türleri.
 *
 * Özlük dosyası çoğu zaman TARANMIŞtır: sözleşme PDF, kimlik fotokopisi JPEG.
 * `<input accept>` yalnız KOLAYLIKTIR, doğrulama değildir; asıl güvence
 * sunucudaki pdf-lib ölçümü ve bucket `file_size_limit`tir.
 */
export const DOCUMENT_ACCEPT = "application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const IZINLI_UZANTI = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

export function belgeTuruUygunMu(fileName: string, browserType?: string): boolean {
  if (IZINLI_UZANTI.has(dosyaUzantisi(fileName))) return true;
  // Tarayıcı `File.type` alanını yalnız tanıdığı türler için doldurur; uzantısı
  // olmayan bir dosyada tip tek ipucudur.
  return /^(application\/pdf|image\/(jpeg|png|webp))$/.test(browserType ?? "");
}

/**
 * Depoya yazılacak içerik tipi.
 *
 * TUZAK: `supabase.storage.upload` gövdesi bir `File`/`Blob` olduğunda
 * FormData dalına düşer ve `contentType` seçeneğini YOK SAYAR — nesne
 * `application/octet-stream` olarak yazılır ve tarayıcıda açılmaz. Çözüm
 * `file.slice(0, file.size, mime)`: kopya çıkarmaz, yalnız TİPİ olan yeni bir
 * görünüm verir (`folder-picker.tsx`te de belgeli).
 */
export function belgeMimeTuru(fileName: string, browserType?: string): string {
  if (browserType) return browserType;
  const u = dosyaUzantisi(fileName);
  if (u === ".pdf") return "application/pdf";
  if (u === ".jpg" || u === ".jpeg") return "image/jpeg";
  if (u === ".png") return "image/png";
  if (u === ".webp") return "image/webp";
  // "Bilmiyorum" demek, yanlış bir şey söylemekten iyidir.
  return "application/octet-stream";
}

// ——————————————————————————————————————————————————————— geçerlilik durumu

export type ExpiryState = "yok" | "gecerli" | "yaklasiyor" | "gecti";

/** Süresi dolmaya kaç gün kala uyarıya döner. */
export const EXPIRY_WARN_DAYS = 30;

/**
 * Bir belgenin geçerlilik durumu.
 *
 * "yaklaşıyor" bir UYARI, "geçti" bir OLGUdur; ikisi de ENGELLEYİCİ DEĞİLDİR
 * (hesap motorundaki `severity` ayrımı — süresi geçmiş bir sağlık raporu
 * personeli sistemden silmez, insanın bakması gereken bir satır üretir).
 */
export function expiryState(
  expiresOn: string | null | undefined,
  bugun: string
): ExpiryState {
  if (!expiresOn) return "yok";
  if (expiresOn < bugun) return "gecti";
  const uyariSiniri = new Date(Date.parse(`${bugun}T00:00:00Z`) + EXPIRY_WARN_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return expiresOn <= uyariSiniri ? "yaklasiyor" : "gecerli";
}

export const EXPIRY_LABELS: Record<ExpiryState, string> = {
  yok: "Süresiz",
  gecerli: "Geçerli",
  yaklasiyor: "Süresi Doluyor",
  gecti: "Süresi Geçmiş",
};

// —————————————————————————————————————————————————————————— TC kimlik no

/**
 * TC Kimlik No doğrulaması (NVİ algoritması).
 *
 * ZORUNLU DEĞİLDİR ve olamaz: devralınan kayıtta yabancı uyruklu üç personelin
 * numarası yok ya da 99 ile başlayan yabancı kimlik numarası. Doğrulama bir
 * ENGEL değil bir UYARIdır — yazım hatasını girerken yakalar, kaydı reddetmez.
 */
export function tcKimlikGecerliMi(value: string | null | undefined): boolean {
  const s = String(value ?? "").trim();
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = s.split("").map(Number);
  const tek = d[0] + d[2] + d[4] + d[6] + d[8];
  const cift = d[1] + d[3] + d[5] + d[7];
  if ((tek * 7 - cift) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

/** IBAN'ı okunur öbeklere böler: "TR12 3456 …". Doğrulama YAPMAZ. */
export function ibanBiciminde(value: string | null | undefined): string {
  const s = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  return s.replace(/(.{4})/g, "$1 ").trim();
}

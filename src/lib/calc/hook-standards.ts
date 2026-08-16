// Kanca TANIMI — hangi standardın kancası seçildi ve o standardın kendi tablosu.
//
// `hook-table.ts` DIN 15400 Tablo 3'tür ve TAŞIMA KAPASİTESİNİ verir (kanca no ×
// malzeme sınıfı × mekanizma grubu). Bu dosya bir kat üstündedir: kancanın
// HANGİ STANDARDA göre seçildiğini ve o standardın ölçü tablosunu taşır.
//
// Dört tanım vardır ve ikişerli iki çifttir:
//
//   DIN 15401  tek ağızlı dövme kanca   ┐ kapasite DIN 15400 Tablo 3'ten
//   DIN 15402  çift ağızlı dövme kanca  ┘ (kanca no + mukavemet sınıfı)
//   DIN 15407  tek ağızlı LAMEL kanca   ┐ kapasite tablonun KENDİSİNDEDİR
//   DIN 15408  çift ağızlı LAMEL kanca  ┘ (satır zaten "Tragfähigkeit t")
//
// LAMEL KANCADA MUKAVEMET SINIFI SORULMAZ. Dövme kancanın kapasitesi malzemenin
// mukavemet sınıfına ve çalışma grubuna göre değişir; lamel kanca ise saclardan
// perçinlenir ve standardın satırı doğrudan "şu boy şu tonu kaldırır" der.
// Aynı sebeple mekanizma grubu da kapasiteyi değiştirmez.
//
// DIN 15408 TABLOSU HENÜZ YOKTUR ve UYDURULMAZ: 15407'nin ölçülerini çift ağızlı
// kancaya kopyalamak, ölçü resmine yanlış sayı yazdırmanın en kısa yoludur.
// Standart seçilebilir (mühendis kancanın çift ağızlı olduğunu rapora yazabilir),
// kapasite elle girilir ve rapor bunu AÇIKÇA söyler (`kind: "bilgi"` kontrol).

/** Kanca tanımları — seçim listesinin değerleri. */
export const HOOK_STANDARDS = [
  "DIN 15401",
  "DIN 15402",
  "DIN 15407",
  "DIN 15408",
] as const;
export type HookStandard = (typeof HOOK_STANDARDS)[number];

/** Seçim listesinde görünen etiketler. */
export const HOOK_STANDARD_LABELS: Record<string, string> = {
  "DIN 15401": "DIN 15401 — Tek Ağızlı Kanca",
  "DIN 15402": "DIN 15402 — Çift Ağızlı Kanca",
  "DIN 15407": "DIN 15407 — Lamel Kanca (Tek Ağızlı)",
  "DIN 15408": "DIN 15408 — Lamel Kanca (Çift Ağızlı)",
};

/**
 * Kanca tanımı verilmemiş (eski) kayıtların standardı. Uygulamanın bugüne
 * kadarki tek davranışı DIN 15400/15401 yoluydu; varsayılan onu korur.
 */
export const DEFAULT_HOOK_STANDARD: HookStandard = "DIN 15401";

/** Seçilen (ya da eksik) standardı çözer. */
export function hookStandardOf(value: string | undefined): HookStandard {
  return (HOOK_STANDARDS as readonly string[]).includes(value ?? "")
    ? (value as HookStandard)
    : DEFAULT_HOOK_STANDARD;
}

/** Lamel (sac perçinli) kanca mı — DIN 15407 ve DIN 15408. */
export function isLamellaHook(standard: string | undefined): boolean {
  const s = hookStandardOf(standard);
  return s === "DIN 15407" || s === "DIN 15408";
}

/** Kapasiteyi DIN 15400 Tablo 3'ten okuyan dövme kancalar. */
export function usesDin15400Capacity(standard: string | undefined): boolean {
  return !isLamellaHook(standard);
}

// --------------------------------------------------------- DIN 15407 Tablo 1

/**
 * DIN 15407 Teil 1 (Eylül 1977) — "Lamellen-Einfachhaken für Roheisen- und
 * Stahlgießpfannen; Zusammenstellung, Hauptmaße" ana ölçü tablosu.
 *
 * Sütun adları standardın kendi sembolleridir: a₁ ağız yarıçapı, a₂ ağız
 * genişliği, b₁ lamel paketi kalınlığı, b₂ paketin dış genişliği, d₁ askı
 * deliği çapı (E9), g₁ üst lamel genişliği, l₁ toplam boy, l₂ üst delik
 * ekseninden ölçülen boy, s₁ tek lamel kalınlığı.
 *
 * `capacityT` kancanın KENDİ taşıma kapasitesi, `craneCapacityT` ise standardın
 * son sütunudur ("Tragfähigkeit der zugeordneten Gießkrane") — o kancanın
 * takıldığı döküm vincinin anma kapasitesi. İkisi AYNI ŞEY DEĞİLDİR ve
 * karıştırılırsa kanca iki kat büyük seçilir: 63 t'lik kanca 125 t'lik vincin
 * kancasıdır çünkü pota iki kancaya asılır.
 *
 * `plateCount` standardın "Stückzahl für lfd Nr 1" sütunudur: taşıyıcı ana
 * lamel (poz. 1) adedi.
 *
 * ÖLÇÜLEN SAPMA — g₁, a₁ = 250 satırında: standardın taranmış sayfası **550**
 * yazar; kullanıcının elindeki yeniden dizilmiş tabloda 560 görünüyor. Kaynak
 * standardın kendi baskısı esas alınmıştır (AGENTS: "hesap yöntemi standartlara
 * dayanır, bir tabloya değil"). Diğer 219 hücrenin tamamı iki kaynakta aynıdır.
 */
export interface Din15407Row {
  /** Lamel kancanın taşıma kapasitesi [t] */
  capacityT: number;
  /** a₁ — ağız (maul) yarıçapı [mm]; tanımın ikinci sayısıdır */
  a1: number;
  /** a₂ — ağız genişliği [mm] */
  a2: number;
  /** b₁ — lamel paketi kalınlığı [mm] */
  b1: number;
  /** b₂ — paketin dış genişliği [mm] */
  b2: number;
  /** d₁ — askı deliği çapı [mm], tolerans E9 */
  d1: number;
  /** g₁ — üst lamel genişliği [mm] */
  g1: number;
  /** l₁ — toplam boy [mm] */
  l1: number;
  /** l₂ — üst delik ekseninden boy [mm] */
  l2: number;
  /** s₁ — tek lamel (sac) kalınlığı [mm] */
  s1: number;
  /** Ana lamel adedi (lfd Nr 1) */
  plateCount: number;
  /** Bu kancanın takıldığı döküm vincinin kapasitesi [t] */
  craneCapacityT: number;
}

export const DIN15407_ROWS: readonly Din15407Row[] = [
  // a₁ = 110
  { capacityT: 16, a1: 110, a2: 130, b1: 64, b2: 96, d1: 100, g1: 220, l1: 1000, l2: 170, s1: 16, plateCount: 2, craneCapacityT: 32 },
  { capacityT: 20, a1: 110, a2: 145, b1: 64, b2: 96, d1: 100, g1: 220, l1: 1000, l2: 170, s1: 16, plateCount: 2, craneCapacityT: 40 },
  { capacityT: 25, a1: 110, a2: 160, b1: 80, b2: 112, d1: 100, g1: 220, l1: 1000, l2: 170, s1: 16, plateCount: 3, craneCapacityT: 50 },
  // a₁ = 130
  { capacityT: 25, a1: 130, a2: 160, b1: 64, b2: 96, d1: 125, g1: 280, l1: 1120, l2: 200, s1: 16, plateCount: 2, craneCapacityT: 50 },
  { capacityT: 32, a1: 130, a2: 180, b1: 80, b2: 112, d1: 125, g1: 280, l1: 1120, l2: 200, s1: 16, plateCount: 3, craneCapacityT: 63 },
  { capacityT: 40, a1: 130, a2: 200, b1: 112, b2: 144, d1: 125, g1: 280, l1: 1120, l2: 200, s1: 16, plateCount: 5, craneCapacityT: 80 },
  // a₁ = 150
  { capacityT: 40, a1: 150, a2: 200, b1: 80, b2: 112, d1: 160, g1: 340, l1: 1250, l2: 250, s1: 20, plateCount: 2, craneCapacityT: 80 },
  { capacityT: 50, a1: 150, a2: 225, b1: 100, b2: 132, d1: 160, g1: 340, l1: 1250, l2: 250, s1: 20, plateCount: 3, craneCapacityT: 100 },
  { capacityT: 63, a1: 150, a2: 225, b1: 140, b2: 172, d1: 160, g1: 340, l1: 1250, l2: 250, s1: 20, plateCount: 5, craneCapacityT: 125 },
  // a₁ = 170
  { capacityT: 63, a1: 170, a2: 225, b1: 125, b2: 157, d1: 180, g1: 380, l1: 1400, l2: 300, s1: 25, plateCount: 3, craneCapacityT: 125 },
  { capacityT: 80, a1: 170, a2: 250, b1: 150, b2: 182, d1: 180, g1: 380, l1: 1400, l2: 300, s1: 25, plateCount: 4, craneCapacityT: 160 },
  { capacityT: 100, a1: 170, a2: 250, b1: 175, b2: 207, d1: 180, g1: 380, l1: 1400, l2: 300, s1: 25, plateCount: 5, craneCapacityT: 200 },
  // a₁ = 205
  { capacityT: 100, a1: 205, a2: 250, b1: 175, b2: 207, d1: 225, g1: 460, l1: 1600, l2: 350, s1: 25, plateCount: 5, craneCapacityT: 200 },
  { capacityT: 125, a1: 205, a2: 280, b1: 200, b2: 232, d1: 225, g1: 460, l1: 1600, l2: 350, s1: 25, plateCount: 6, craneCapacityT: 250 },
  { capacityT: 160, a1: 205, a2: 320, b1: 250, b2: 282, d1: 225, g1: 460, l1: 1600, l2: 350, s1: 25, plateCount: 8, craneCapacityT: 320 },
  // a₁ = 250  (g₁ = 550 — bkz. tip başlığındaki ölçülen sapma notu)
  { capacityT: 160, a1: 250, a2: 320, b1: 225, b2: 265, d1: 250, g1: 550, l1: 1800, l2: 420, s1: 25, plateCount: 7, craneCapacityT: 320 },
  { capacityT: 200, a1: 250, a2: 360, b1: 275, b2: 315, d1: 250, g1: 550, l1: 1800, l2: 420, s1: 25, plateCount: 9, craneCapacityT: 400 },
  { capacityT: 250, a1: 250, a2: 400, b1: 325, b2: 365, d1: 250, g1: 550, l1: 1800, l2: 420, s1: 25, plateCount: 11, craneCapacityT: 500 },
  // a₁ = 300
  { capacityT: 250, a1: 300, a2: 400, b1: 315, b2: 355, d1: 290, g1: 620, l1: 2000, l2: 470, s1: 35, plateCount: 7, craneCapacityT: 500 },
  { capacityT: 320, a1: 300, a2: 500, b1: 385, b2: 425, d1: 290, g1: 620, l1: 2000, l2: 470, s1: 35, plateCount: 9, craneCapacityT: 630 },
];

/**
 * Bir satırın anahtarı: `"63x150"`.
 *
 * KAPASİTE TEK BAŞINA YETMEZ — tabloda 25, 40, 63, 100, 160 ve 250 t'nin İKİŞER
 * satırı var ve ikisi farklı ağız yarıçapıyla (a₁) farklı kancalardır. Standart
 * da tam bu yüzden kancayı "63 × 150" diye adlandırır; anahtar o adlandırmanın
 * makine okunur hâlidir.
 */
export function din15407Key(row: Din15407Row): string {
  return `${row.capacityT}x${row.a1}`;
}

/** Seçim listesinde görünen ad: `"63 × 150"`. */
export function din15407Label(row: Din15407Row): string {
  return `${row.capacityT} × ${row.a1}`;
}

export const DIN15407_KEYS: readonly string[] = DIN15407_ROWS.map(din15407Key);

export const DIN15407_LABELS: Record<string, string> = Object.fromEntries(
  DIN15407_ROWS.map((r) => [
    din15407Key(r),
    `${din15407Label(r)}  ·  ${r.capacityT} t  ·  ${r.plateCount} lamel`,
  ])
);

/** Anahtardan satır; tanınmayan anahtarda `undefined` (uydurma satır dönmez). */
export function din15407Row(key: string | undefined): Din15407Row | undefined {
  if (!key) return undefined;
  return DIN15407_ROWS.find((r) => din15407Key(r) === key);
}

/**
 * Verilen yükü taşıyan EN KÜÇÜK lamel kanca — seçim önerisi. Eşit kapasiteli
 * iki satırdan küçük ağızlı olan (tablo sırası) önce gelir.
 */
export function smallestDin15407Key(requiredKg: number): string | undefined {
  if (!Number.isFinite(requiredKg) || requiredKg <= 0) return undefined;
  const row = [...DIN15407_ROWS]
    .sort((a, b) => a.capacityT - b.capacityT || a.a1 - b.a1)
    .find((r) => r.capacityT * 1000 >= requiredKg);
  return row ? din15407Key(row) : undefined;
}

// ------------------------------------------------- Kanca numarası seçenekleri

/**
 * "Kanca Numarası" kutusunun seçenekleri SEÇİLEN TANIMA bağlıdır: dövme kancada
 * DIN 15400 numaraları (`"10"`), lamel kancada standardın kendi adlandırması
 * (`"63x150"`). Tek bir alan kullanılır — iki ayrı kutu, biri her zaman boş
 * duran bir ekran demekti.
 *
 * DIN 15408'in tablosu yoktur: liste BOŞ döner ve alan kapasiteyi elle girmeye
 * bırakılır (bkz. dosya başlığı).
 */
export function hookNumberOptions(
  standard: string | undefined,
  din15400Numbers: readonly string[]
): readonly string[] {
  const s = hookStandardOf(standard);
  if (s === "DIN 15407") return DIN15407_KEYS;
  if (s === "DIN 15408") return [];
  return din15400Numbers;
}

// -------------------------------------------------------------- Kanca tanımı

/**
 * Kancanın tam tanımı — ekipman listesine ve rapora giden metin.
 *
 *   DIN 15401 / 15402 : `"DIN 15401 Nr 10 S"`   (numara + mukavemet sınıfı)
 *   DIN 15407 / 15408 : `"DIN 15407 — 63 × 150"` (standardın kendi adlandırması)
 *
 * Metin TÜRETİLİR, elle yazılmaz: standart ile numara ayrı kutularda dururken
 * tanımın da elle tutulması, üç kutunun birbiriyle çelişmesi demekti. Alanın
 * "OTOMATİK" anahtarı kapatılırsa mühendisin yazdığı metin korunur (uygulamanın
 * `*Auto` deseni).
 */
export function hookDesignationText(sel: {
  hookStandard?: string;
  hookNumber?: string;
  hookStrengthClass?: string;
}): string | undefined {
  const s = hookStandardOf(sel.hookStandard);
  if (isLamellaHook(s)) {
    const row = din15407Row(sel.hookNumber);
    // DIN 15408'de (ve tanınmayan anahtarda) ölçü tablosu yok: standardın adı
    // tek başına yazılır — olmayan bir boy uydurulmaz.
    return row ? `${s} — ${din15407Label(row)}` : s;
  }
  const nr = sel.hookNumber?.trim();
  if (!nr) return s;
  const cls = sel.hookStrengthClass?.trim();
  return cls ? `${s} Nr ${nr} ${cls}` : `${s} Nr ${nr}`;
}

// Standart katsayı tabloları — DIN 15018 ve FEM 1.001 tablolarının kod karşılığı.

/** DIN 15018 Tablo 17 — izin verilen yorulma gerilmeleri [N/mm²].
 * material: St37 (S235) | St52 (S355); notch: W0-W2 (kaynaksız) / K0-K4 (kaynaklı); loadGroup: B1-B6 */
export const DIN15018_T17: Record<string, Record<string, Record<string, number>>> = {
  "St37": {
    "W0": { "B1": 180, "B2": 180, "B3": 180, "B4": 169.7, "B5": 142.7, "B6": 120 },
    "W1": { "B1": 180, "B2": 180, "B3": 161.4, "B4": 135.8, "B5": 114.2, "B6": 96 },
    "W2": { "B1": 180, "B2": 168, "B3": 141.3, "B4": 118.8, "B5": 99.9, "B6": 84 },
    "K0": { "B1": 180, "B2": 180, "B3": 180, "B4": 168, "B5": 118.8, "B6": 84 },
    "K1": { "B1": 180, "B2": 180, "B3": 180, "B4": 150, "B5": 106.1, "B6": 75 },
    "K2": { "B1": 180, "B2": 180, "B3": 178.2, "B4": 126, "B5": 86.1, "B6": 63 },
    "K3": { "B1": 180, "B2": 180, "B3": 127.3, "B4": 90, "B5": 63.6, "B6": 45 },
    "K4": { "B1": 152.7, "B2": 108, "B3": 76.4, "B4": 54, "B5": 38.2, "B6": 27 },
  },
  "St52": {
    "W0": { "B1": 270, "B2": 270, "B3": 252.2, "B4": 203.2, "B5": 163.8, "B6": 132 },
    "W1": { "B1": 270, "B2": 249, "B3": 200.6, "B4": 161.1, "B5": 130.3, "B6": 105 },
    "W2": { "B1": 247.2, "B2": 199.2, "B3": 160.5, "B4": 129.3, "B5": 104.2, "B6": 84 },
    "K0": { "B1": 270, "B2": 270, "B3": 237.6, "B4": 168, "B5": 118.8, "B6": 84 },
    "K1": { "B1": 270, "B2": 270, "B3": 212.1, "B4": 150, "B5": 89.1, "B6": 63 },
    "K2": { "B1": 270, "B2": 252, "B3": 178.2, "B4": 126, "B5": 89.1, "B6": 63 },
    "K3": { "B1": 254, "B2": 180, "B3": 127.3, "B4": 90, "B5": 63.6, "B6": 45 },
    "K4": { "B1": 152.7, "B2": 108, "B3": 76.4, "B4": 54, "B5": 38.2, "B6": 27 },
  },
};

/** FEM T.4.2.4.1.4.a — c1 hız bandı başlıkları (d/dak) */
export const C1_SPEEDS = [10, 12.5, 16, 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250] as const;

/** c1 katsayı tablosu: teker çapı [mm] -> hız bandı sütunları (null = tablo dışı) */
export const C1_TABLE: Record<number, (number | null)[]> = {
  200: [1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72, 0.66, null, null, null],
  250: [1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72, 0.66, null, null],
  315: [1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72, 0.66, null],
  400: [1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72, 0.66],
  500: [1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72],
  630: [1.17, 1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77],
  710: [null, 1.16, 1.14, 1.13, 1.12, 1.1, 1.07, 1.04, 1.02, 0.99, 0.96, 0.92, 0.89, 0.84, 0.79],
  800: [null, 1.17, 1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82],
  900: [null, null, 1.16, 1.14, 1.13, 1.12, 1.1, 1.07, 1.04, 1.02, 0.99, 0.96, 0.92, 0.89, 0.84],
  1000: [null, null, 1.17, 1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87],
  1120: [null, null, null, 1.16, 1.14, 1.13, 1.12, 1.1, 1.07, 1.04, 1.02, 0.99, 0.96, 0.92, 0.89],
  1250: [null, null, null, 1.17, 1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91],
};

/** KATSAYILAR!Q81/R81 karşılığı: hız [m/dak] -> c1 sütun indeksi (0 tabanlı). */
export function c1SpeedIndex(speed: number): number {
  for (let i = 0; i < C1_SPEEDS.length - 1; i++) {
    if (speed >= C1_SPEEDS[i] && speed < C1_SPEEDS[i + 1]) return i;
  }
  return C1_SPEEDS.length - 1;
}

/** c1 katsayısı: teker çapı + yürüyüş hızı (FEM 1.001 T.4.2.4.1.4.b) */
export function c1Factor(wheelDiaMm: number, speed: number): number | null {
  const row = C1_TABLE[wheelDiaMm];
  if (!row) return null;
  return row[c1SpeedIndex(speed)] ?? null;
}

/** Ray AİLESİ — seçim iki kutuludur: önce aile, sonra o ailenin ölçüleri. */
export const RAIL_FAMILIES = ["a", "s", "bar"] as const;
export type RailFamily = (typeof RAIL_FAMILIES)[number];

/** Ailelerin ekranda ve raporda görünen adları. */
export const RAIL_FAMILY_LABELS: Record<RailFamily, string> = {
  a: "A Tipi — DIN 536 Vinç Rayı",
  s: "S Tipi — Hafif (Vignole) Ray",
  bar: "Kare / Dikdörtgen — Dolu Çubuk",
};

/**
 * Ray tablosu: AİLE, baş genişliği [mm], köşe yarıçapı ve metre ağırlığı [kg/m].
 *
 * `headWidth` teker basıncının yayıldığı ETKİN genişliktir (DIN 15018 Şekil 9
 * hesabı için); rayın anma baş genişliği değildir.
 *
 * `massKgPerM` A ve S serilerinde TABLODAN gelir — A serisi DIN 536-1 Form A
 * vinç rayı, S serisi ise DIN 5901 / DIN 17100 / NF A 45-310 / E1 hafif ray
 * anma kütleleridir. Kare/dikdörtgen çubuk raylarda kütle geometriden
 * hesaplanır (bkz. `railMassKgPerM`), tabloya yazılmaz ki kesit ölçüsüyle
 * tutarsız kalmasın.
 *
 * S SERİSİNDE KÖŞE YARIÇAPI YOKTUR (`radius: null`). Elimizdeki hafif ray
 * çizelgesi yalnız baş genişliği C, taban B, yükseklik H ve gövde kalınlığı
 * E'yi veriyor; köşe yuvarlaklığı yayımlanmamış. Uydurulmuş bir yarıçap
 * yerine baş genişliği ETKİN genişlik kabul edilir — yarıçap sonradan
 * belgelenirse buraya yazılır ve etkin genişlik kendiliğinden daralır.
 */
export const RAILS: Record<
  string,
  { family: RailFamily; radius: number | null; headWidth: number; massKgPerM?: number }
> = {
  // --- A serisi (DIN 536-1 Form A vinç rayı) --------------------------------
  "A150": { family: "a", radius: 10, headWidth: 136.666666666667, massKgPerM: 150.2 },
  "A120": { family: "a", radius: 10, headWidth: 106.666666666667, massKgPerM: 100.0 },
  "A100": { family: "a", radius: 10, headWidth: 86.6666666666667, massKgPerM: 74.3 },
  "A75": { family: "a", radius: 8, headWidth: 64.3333333333333, massKgPerM: 56.2 },
  "A65": { family: "a", radius: 6, headWidth: 57, massKgPerM: 43.1 },
  "A55": { family: "a", radius: 5, headWidth: 48.3333333333333, massKgPerM: 31.8 },
  "A45": { family: "a", radius: 4, headWidth: 39.6666666666667, massKgPerM: 22.1 },
  // --- S serisi (hafif / Vignole ray) ---------------------------------------
  // Baş genişliği C ve metre ağırlığı üretici çizelgesinden; normlar satır
  // başına ayrıdır (DIN 5901 · DIN 17100 · NF A 45-310 · E1).
  "S10": { family: "s", radius: null, headWidth: 33, massKgPerM: 11.0 },
  "S14": { family: "s", radius: null, headWidth: 38, massKgPerM: 14.0 },
  "S18": { family: "s", radius: null, headWidth: 43, massKgPerM: 18.3 },
  "S20": { family: "s", radius: null, headWidth: 44, massKgPerM: 21.0 },
  "S24": { family: "s", radius: null, headWidth: 53, massKgPerM: 24.43 },
  "S30": { family: "s", radius: null, headWidth: 60, massKgPerM: 30.03 },
  "S31": { family: "s", radius: null, headWidth: 56, massKgPerM: 31.57 },
  "S39": { family: "s", radius: null, headWidth: 66, massKgPerM: 39.8 },
  "S41": { family: "s", radius: null, headWidth: 63, massKgPerM: 40.0 },
  "S46": { family: "s", radius: null, headWidth: 64, massKgPerM: 46.0 },
  "S49": { family: "s", radius: null, headWidth: 67, massKgPerM: 49.46 },
  // --- Kare / dikdörtgen dolu çubuk ray -------------------------------------
  // Kod "EN x YÜKSEKLİK"tir: ilk sayı ray başının genişliği, ikincisi kesit
  // yüksekliğidir. Metre ağırlığı bu iki ölçüden hesaplanır.
  "30x30": { family: "bar", radius: null, headWidth: 30 },
  "40x30": { family: "bar", radius: null, headWidth: 40 },
  "40x40": { family: "bar", radius: null, headWidth: 40 },
  "50x30": { family: "bar", radius: null, headWidth: 50 },
  "50x50": { family: "bar", radius: null, headWidth: 50 },
  "60x40": { family: "bar", radius: null, headWidth: 60 },
  "60x60": { family: "bar", radius: null, headWidth: 60 },
  "70x40": { family: "bar", radius: null, headWidth: 70 },
  "80x80": { family: "bar", radius: null, headWidth: 80 },
  "100x50": { family: "bar", radius: null, headWidth: 100 },
  "100x100": { family: "bar", radius: null, headWidth: 100 },
  "120x80": { family: "bar", radius: null, headWidth: 120 },
};

/** Bir ailenin ray kodları — tablodaki sırayla (seçim kutusunun listesi). */
export function railCodesOfFamily(family: string): string[] {
  return Object.keys(RAILS).filter((code) => RAILS[code].family === family);
}

/**
 * Bir ray kodunun ailesi. Tabloda yoksa YAZIMINDAN çıkarılır ("A65" → A tipi,
 * "S24" → S tipi, "70x40" → çubuk) — eski revizyonlarda aile alanı hiç yoktur
 * ve kod tek başına saklanmıştır.
 */
export function railFamilyOf(code: string | undefined): RailFamily {
  const c = (code ?? "").trim();
  const known = RAILS[c];
  if (known) return known.family;
  if (/^A\s*\d+$/i.test(c)) return "a";
  if (/^S\s*\d+$/i.test(c)) return "s";
  return "bar";
}

/**
 * Rayın ANMA baş genişliği [mm] — rayın üstten görünen gerçek genişliği.
 *
 * `RAILS.headWidth` teker basıncı için ETKİN genişliktir; DIN 15018 Şekil 9
 * köşe yuvarlaklıklarını düşer (b_etkin = k − 4r/3). Savrulma açısının aşınma
 * payı (FEM 1.001 Kitapçık 9 md. 9.4.1.5, α_w = 0,1·b/w_b) ise rayın ANMA baş
 * genişliğini ister — köşe yuvarlaklığı aşınmayı azaltmaz. Bu yüzden A serisi
 * için etkin genişlikten geri çevrilir; kare/dikdörtgen çubuk raylarda ikisi
 * zaten aynıdır.
 *
 * Tanınmayan kod için `NaN` döner — çağıran taraf değeri hesaba sokmadan önce
 * kontrol etmelidir.
 */
export function railNominalHeadWidthMm(code: string): number {
  const row = RAILS[code];
  if (!row) return Number.NaN;
  return row.radius === null ? row.headWidth : row.headWidth + (4 * row.radius) / 3;
}

/**
 * Rayın metre ağırlığı [kg/m] — ana kirişin ölü yüküne girer.
 *
 * A ve S serileri tablodaki ANMA kütlesini kullanır. Kare/dikdörtgen çubuk
 * raylar ("50x50", "70x40") kod içindeki ölçülerden hesaplanır: A[mm] × B[mm]
 * kesit alanı × çelik yoğunluğu. Tanınmayan kod için `null` döner — çağıran
 * taraf ray payını sıfır sayar ve bunu raporda belirtir.
 */
export function railMassKgPerM(
  code: string | undefined,
  steelDensityKgPerCm3: number
): number | null {
  if (!code) return null;
  const entry = RAILS[code];
  if (entry?.massKgPerM !== undefined) return entry.massKgPerM;
  const m = /^(\d+)\s*[xX]\s*(\d+)$/.exec(code.trim());
  if (!m) return null;
  const areaCm2 = (Number(m[1]) * Number(m[2])) / 100; // mm² → cm²
  return areaCm2 * 100 * steelDensityKgPerCm3;         // cm³/m × kg/cm³
}

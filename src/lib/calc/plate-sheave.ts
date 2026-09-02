// KAYNAKLI SAC MAKARA DEFTERİ — anma çapı → ağırlık.
//
// `drum-brake.ts` ve `wedge-socket.ts` ile aynı desendedir: SAF, statik, tek
// soruya cevap veren küçük bir defter.
//
// NEDEN BURADA: kanca bloğu makarası KATALOGDAN SEÇİLİR (`sheaveWeightKg`,
// `catalog-mapping.ts` 2.2.x) ve ağırlığını oradan alır. DENGE MAKARASI ise
// seçilmez — bölüm yalnız bir ÇAP sorar (`balanceSheaveDiaMm`, `fields.ts`) —
// ve bu yüzden hiçbir katalog satırına bağlı değildir. Ağırlık dökümünde
// "imalattır, elle girilir" diye boş duruyordu; oysa aynı yayımlanmış tablo
// zaten uygulamada var ve çap doğrudan onun anahtarıdır.
//
// KAYNAK: kaynaklı tek saclı makara boy tablosu (S275JR sac, S355 göbek,
// yiv sertliği ≥ 200 HB, Ø160–1120), katalog verisinin `sheaves/welded_plate`
// yaprağıyla AYNI satırlar. Sayılar burada YENİDEN TÜRETİLMEZ, olduğu gibi
// yazılır.
//
// ARA DEĞER ALINMAZ. "Ø 500 mm makara" diye bir ürün yoktur; yayımlanmamış bir
// çapta defter `null` döner ve döküm gerekçesini yazar (değişmez md. 4). Halat
// ve tambur tarafındaki `firstAtLeast` mantığı burada YANLIŞ olurdu: oradaki
// soru "hangi boy yeter", buradaki "bu boy kaç kilo".

export interface PlateSheaveSpec {
  /** Anma çapı [mm] — bölümün sorduğu ölçü. */
  nominalDiaMm: number;
  /** Ağırlık [kg]. */
  weightKg: number;
  /**
   * AYNI ÇAPTA İKİ YAYIM VARSA ÜST UÇ. Ø450 iki farklı yataklama düzeninde
   * (6220-2RS ve SL04 5020PP) 31,5 ve 34,0 kg olarak basılıdır; hangisinin
   * seçileceğini bölüm sormuyor, o yüzden tek sayıya indirilmez.
   */
  weightMaxKg?: number;
}

export const PLATE_SHEAVES: readonly PlateSheaveSpec[] = [
  { nominalDiaMm: 160, weightKg: 3.5 },
  { nominalDiaMm: 200, weightKg: 5 },
  { nominalDiaMm: 280, weightKg: 12 },
  { nominalDiaMm: 355, weightKg: 17.5 },
  { nominalDiaMm: 450, weightKg: 31.5, weightMaxKg: 34 },
  { nominalDiaMm: 550, weightKg: 43 },
  { nominalDiaMm: 650, weightKg: 67 },
  { nominalDiaMm: 710, weightKg: 120 },
  { nominalDiaMm: 800, weightKg: 150 },
  { nominalDiaMm: 900, weightKg: 200 },
  { nominalDiaMm: 1000, weightKg: 260 },
  { nominalDiaMm: 1120, weightKg: 359 },
];

/** Yayımlanmış çapların listesi — gerekçe metni "hangi boylar var" diye yazar. */
export const PLATE_SHEAVE_DIAMETERS: readonly number[] = PLATE_SHEAVES.map(
  (s) => s.nominalDiaMm
);

/**
 * Anma çapından makara — TAM EŞLEŞME, ara değer YOK.
 *
 * `1` mm hoşgörü, kutuya "450" yerine "450,0" yazılmış olabileceği için değil
 * (sayı zaten sayıdır); ölçüsü milimetreye yuvarlanmış eski revizyonlar için
 * bırakılmıştır. İki boy arasındaki en küçük fark 40 mm'dir, yani hoşgörü iki
 * satırı asla birbirine karıştıramaz.
 */
export function plateSheaveByDia(diaMm: number | undefined | null): PlateSheaveSpec | null {
  if (typeof diaMm !== "number" || !Number.isFinite(diaMm) || diaMm <= 0) return null;
  return PLATE_SHEAVES.find((s) => Math.abs(s.nominalDiaMm - diaMm) <= 1) ?? null;
}

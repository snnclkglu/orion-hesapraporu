// SKF SNL / SE YATAK GÖVDESİ AĞIRLIK DEFTERİ — model kodu → kütle [kg].
//
// `drum-brake.ts`, `load-cell.ts` ve `plate-sheave.ts` ile aynı desendedir:
// SAF, statik, tek soruya cevap veren küçük bir defter.
//
// NEDEN BURADA VE NEDEN KATALOG SATIRINDA DEĞİL: yatak gövdesi katalogdan
// SEÇİLİR ve seçim anında ölçüleri revizyona yazılır — ama ağırlık alanı hiç
// yoktu, çünkü çıkarım sırasında kütle sütunu okunmamıştı. Ağırlığı bugün
// katalog satırına eklemek, YALNIZ ürünü yeniden seçen revizyonlara akardı;
// oysa ağırlık dökümü eski revizyonlarda da doğru sayıyı göstermek zorunda.
// Model KODU zaten revizyonda duruyor, defter onu çözüyor.
//
// KAYNAK: SKF PUB BU/P1 13186/1 EN (Şubat 2015), Bölüm 2.3 "SNL and SE plummer
// block housings for bearings on a cylindrical seat", basılı sayfa 120–137
// (PDF fiziksel sayfa = basılı + 4). Kütle sütunu TEK numaralı sayfalardadır
// ("Mass / Housing / kg"), gövde adı karşı ÇİFT numaralı sayfadadır; iki sayfa
// aynı y taban çizgisine basıldığı için eşleme koordinatla yapıldı ve her satır
// gövde adı + rulman dış çapı Da + keçeli genişlik A2 ile ÜÇ KEZ doğrulandı.
// Katalog PDF'i workspace kökündedir (`13186_1_EN_SKF_bearing_housings…pdf`);
// SKF verisi WEBDEN ÇEKİLMEZ (kullanım koşulları ticari üründe çoğaltmayı
// yasaklıyor — 2026-08-06 kararı), kaynak yalnız bu yerel yayımdır.
//
// KÜTLENİN KAPSAMI: değer TAM GÖVDEDİR (taban + kapak). SNL/SE gövdeler imalatta
// eşleştirilmiş tek üründür (basılı s. 63–64). Rulman, keçe (TSN/FS), son kapak
// (ASNH), konumlandırma halkası (FRB) ve adaptör kovanı DÂHİL DEĞİLDİR —
// katalogda "Appropriate parts" altında ayrı ürünlerdir.
//
// KATALOG DÖRT GÖVDEDE KENDİ İÇİNDE ÇELİŞİYOR: aynı gövde iki ayrı mil çapı
// bloğunda BİREBİR AYNI ölçülerle ama farklı kütleyle basılmış. Sayı tek değere
// indirilmez; `kgUst` ile ARALIK verilir ve ağırlık dökümü aralığı gösterir —
// yayımlanmamış bir kesinlik uydurmaktansa yayımlanmış bir belirsizliği
// göstermek doğrudur (değişmez md. 4).

export interface BearingHousingSpec {
  /** SKF gövde kodu — katalog seçiminde `bearingHousingCode`. */
  model: string;
  /** Kütle [kg] — çelişkili satırlarda ALT uç. */
  kg: number;
  /** Katalog aynı gövdeyi iki blokta farklı basmışsa ÜST uç. */
  kgUst?: number;
}

export const BEARING_HOUSINGS: readonly BearingHousingSpec[] = [
  { model: "SNL 205", kg: 1.4 },
  { model: "SNL 206-305", kg: 1.9 },
  { model: "SE 207", kg: 2.45 },
  { model: "SE 208-307", kg: 3.3 },
  { model: "SE 209", kg: 3.2 },
  { model: "SE 210", kg: 3.65 },
  { model: "SE 211", kg: 5.85 },
  { model: "SE 212", kg: 5.8 },
  { model: "SE 213", kg: 7.45 },
  { model: "SE 215", kg: 8.1 },
  { model: "SNL 216", kg: 9 },
  { model: "SNL 217", kg: 9.5 },
  { model: "SNL 218", kg: 11.8 },
  { model: "SE 510-608", kg: 3.85 },
  { model: "SE 511-609", kg: 5.45 },
  { model: "SE 512-610", kg: 6.15 },
  { model: "SE 513-611", kg: 7.9 },
  // ——— katalogun kendi içinde çeliştiği dört gövde (bkz. dosya başlığı)
  { model: "SE 515-612", kg: 8.55, kgUst: 8.6 },
  { model: "SNL 516-613", kg: 9, kgUst: 9.5 },
  { model: "SNL 517", kg: 9.5, kgUst: 10 },
  { model: "SNL 518-615", kg: 11.8, kgUst: 12.5 },
  // ———
  { model: "SNL 519-616", kg: 13.7 },
  { model: "SNL 520-617", kg: 17.6 },
  { model: "SNL 522-619", kg: 22 },
  { model: "SNL 524-620", kg: 26.2 },
  { model: "SNL 526", kg: 33 },
];

/**
 * Model kodundan gövde — büyük/küçük harf ve fazla boşluk hoş görülür.
 *
 * Kod bulunamazsa `null`: katalogda 26 gövde var ve seçilen ürün başka bir
 * seriden (SD, SAF, SONL…) olabilir. Uydurma bir kilo yerine boş bir hücre ve
 * gerekçe döner (değişmez md. 4).
 */
export function bearingHousingByModel(
  model: string | undefined | null
): BearingHousingSpec | null {
  const aranan = (model ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!aranan) return null;
  return BEARING_HOUSINGS.find((h) => h.model.toUpperCase() === aranan) ?? null;
}

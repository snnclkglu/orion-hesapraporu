// PANO GÖVDE IZGARASI ve yerleşim payları (PANO-1 · PANO-3 · PANO-8).
//
// Buradaki sayılar bir tercih değil, SİPARİŞ EDİLEBİLİRLİK sınırıdır: pano
// imalatçısı ara ölçü kesmez, bu ızgaradan üretir. Ara bir en seçmek panoyu
// özel imalata çevirir ve hem fiyatı hem termini değiştirir.
//
// `src/lib/calc/modules/cabin.ts` elektrik ODASI hesabı için daha dar bir
// ızgara taşıyor (en'de 900 yok, derinlik yalnız 400/600/700, baza sabit 200).
// Burası KANONİK olandır ve o dosyanın alt küme kaldığını
// `__tests__/sizes.guard.test.ts` gerçek içe aktarmayla sabitler (değişmez
// md. 8). İki ızgaranın birleştirilmesi ayrı bir iştir.

import type { DoorConfig, LayoutSettings } from "./types";

/** Sipariş edilebilir pano gövde enleri [mm]. */
export const PANEL_WIDTHS_MM = [400, 500, 600, 700, 800, 900, 1000, 1200] as const;

/** Sipariş edilebilir pano gövde yükseklikleri [mm]. */
export const PANEL_HEIGHTS_MM = [1400, 1600, 1800, 2000] as const;

/** Sipariş edilebilir pano gövde derinlikleri [mm]. */
export const PANEL_DEPTHS_MM = [200, 250, 300, 400, 500, 600, 700] as const;

/** Baza (kaide) yükseklikleri [mm] — kablo girişi buradandır. */
export const PANEL_BASE_HEIGHTS_MM = [200, 250, 300] as const;

/**
 * YÜKSEKLİK TERCİH SIRASI — kullanıcının sırası (06.09.2026):
 * "genellikle 1800 ilk tercih, sonra 1600 ve 2000, sonra 1400".
 */
export const HEIGHT_PREFERENCE_MM = [1800, 2000, 1600, 1400] as const;

/**
 * ÖNCELİKLİ YÜKSEKLİK — otomatik seçimin varsayılan cevabı.
 *
 * Bunun altındaki bir gövde ancak RAHATÇA sığıyorsa seçilir (PANO-9); üstü
 * ise yalnız sığmadığı için seçilir.
 */
export const PREFERRED_HEIGHT_MM = 1800;

/**
 * Otomatik aramanın deneyeceği yükseklikler, KÜÇÜKTEN BÜYÜĞE (PANO-9).
 *
 * Kullanıcı düzeltmesi (06.09.2026): *"1800 öncelikli seçsin ama hep 1800
 * seçmesin, bazen küçük bir işte 1400 de yeterli olur; gereksiz büyük seçmeye
 * gerek yok."* İlk sürüm 1800'den başlıyordu ve tek panolu küçük bir vinçte
 * bile 1800 döndürüyordu — 400×1800 bir gövde, içinde on şalter olan bir işe
 * gereksiz para ve gereksiz yer demektir.
 *
 * Öncelik SIRADAN DEĞİL EŞİKTEN gelir: 1800'ün ALTINDAKİ bir gövde ancak
 * doluluk payını koruyorsa ve panoyu bölmüyorsa seçilir (PANO-9). Böylece
 * küçük iş küçük panoyu alır, sıkışan iş 1800'e çıkar.
 */
export const AUTO_HEIGHTS_MM = [1400, 1600, 1800, 2000] as const;

export const DEFAULT_BASE_MM = 200;

/**
 * SAHA KUTUSU ODANIN IZGARASINI KULLANMAZ (kullanıcı kararı, 09.09.2026).
 *
 * Kullanıcının verdiği saha ızgarası: yükseklik 300…1400, en 400…800,
 * derinlik 200…400. Ölçüldü — bugün ODANIN ızgarası dayatıldığı için her saha
 * kutusu en küçük oda boyunu, 1400 mm'yi alıyordu ve %18…%53 doluydu:
 * 0019'un `TBW` kutusunda 1250 mm'lik plakada 220 mm ray var.
 *
 * Duvara asılan bir klemens kutusu için 1400 mm ne gereklidir ne alışıldıktır;
 * gerçek karşılığı 400 mm'dir.
 */
export const FIELD_HEIGHTS_MM = [
  300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400,
] as const;

/** Saha kutusu enleri [mm]. */
export const FIELD_WIDTHS_MM = [400, 500, 600, 700, 800] as const;

/** Saha kutusu derinlikleri [mm] — 350 ODA ızgarasında YOKTUR. */
export const FIELD_DEPTHS_MM = [200, 250, 300, 350, 400] as const;

/**
 * BİR DİZİNİN sipariş edilebilir gövde ızgarası (PANO-33).
 *
 * İki dizi iki ayrı ızgara kullanır ve bu ayrım ÇÖZÜCÜYE GİRDİDİR: `solveLineup`
 * hangi diziyi çözdüğünü bilmez, çağıran ızgarayı da tercihi de birlikte verir
 * (`SolveAllInput.prefs` ile aynı gerekçe).
 */
export interface LineupGrid {
  widths: readonly number[];
  heights: readonly number[];
  depths: readonly number[];
  bases: readonly number[];
  /**
   * Bunun ALTINDAKİ boy ancak RAHATÇA sığıyorsa seçilir (PANO-9);
   * `null` = eşik yok, her zaman sığan EN KÜÇÜK gövde alınır.
   */
  preferredHeightMm: number | null;
  /**
   * Dizideki bütün gözler ORTAK yükseklik paylaşır mı?
   *
   * Odada EVET (PANO-2): yan yana dizilen gövdelerin üstü hizalı olmak
   * zorundadır. Sahada HAYIR (kullanıcı kararı, 09.09.2026) — saha kutuları
   * dizi değildir, her biri ayrı bir duvara/ayağa asılır.
   */
  sharedHeight: boolean;
}

/** Elektrik odası dizisinin ızgarası — kanonik `PANEL_*` sabitleri. */
export const ROOM_GRID: LineupGrid = {
  widths: PANEL_WIDTHS_MM,
  heights: AUTO_HEIGHTS_MM,
  depths: PANEL_DEPTHS_MM,
  bases: PANEL_BASE_HEIGHTS_MM,
  preferredHeightMm: PREFERRED_HEIGHT_MM,
  sharedHeight: true,
};

/**
 * Saha kutularının ızgarası.
 *
 * `preferredHeightMm` NULL'DUR ve bu bilinçlidir: 1800 eşiği "küçük iş küçük
 * gövde alsın ama sıkışan iş tıkıştırılmasın" kuralıydı (PANO-9) ve 300 mm'lik
 * bir klemens kutusunda karşılığı yoktur. Saha kutusu her zaman sığan EN KÜÇÜK
 * boyu alır.
 */
export const FIELD_GRID: LineupGrid = {
  widths: FIELD_WIDTHS_MM,
  heights: FIELD_HEIGHTS_MM,
  depths: FIELD_DEPTHS_MM,
  bases: PANEL_BASE_HEIGHTS_MM,
  preferredHeightMm: null,
  sharedHeight: false,
};

/** Bu enden büyük panoda çift kapak SEÇİLEBİLİR; küçüğünde tek kapak zorunlu. */
export const DOUBLE_DOOR_MIN_WIDTH_MM = 600;

/** DIN ray modül adımı [mm] — 1 kutup MCB = 1 modül (PANO-5). */
export const MODULE_PITCH_MM = 17.5;


/**
 * Kapak yapılandırması ızgaradan ÇIKARILIR ama kullanıcı seçimi üstündür.
 *
 * 600 mm sınırdır ve iki tarafa da aittir: 600'de tek kapak da çift kapak da
 * yapılır. 600'den dar bir gövdede çift kapak kanadı 300 mm'nin altına iner ve
 * menteşe/kilit payıyla birlikte kapak kullanışsızlaşır.
 */
export function doorConfigFor(widthMm: number, secilen: DoorConfig | null): DoorConfig {
  if (widthMm < DOUBLE_DOOR_MIN_WIDTH_MM) return "tek";
  if (secilen) return secilen;
  return widthMm > DOUBLE_DOOR_MIN_WIDTH_MM ? "cift" : "tek";
}

/** Değeri ızgaradaki bir üst kademeye yuvarlar; taşarsa `null`. */
export function ceilToGrid(deger: number, izgara: readonly number[]): number | null {
  for (const adim of izgara) if (adim >= deger) return adim;
  return null;
}


/**
 * ÖNTANIM AYARLAR.
 *
 * Payların hiçbiri sabit değildir: pano markası değiştiğinde profil kalınlığı,
 * menteşe payı ve kanal ölçüsü de değişir. Bir panoyu ölçüsüne göre sipariş
 * edip cihazın sığmadığını sahada öğrenmek tam olarak bu payların tahmin
 * edilmesinden doğar — bu yüzden hepsi ekrandan görülebilir ve düzeltilebilir.
 */
export const DEFAULT_SETTINGS: LayoutSettings = {
  // İKİ DİZİ, İKİ AYRI TERCİH: elektrik odasındaki gövde ile duvara asılan saha
  // kutusu aynı sipariş kararına bağlı değildir (kullanıcı kararı 08.09.2026).
  room: { heightMm: null, depthMm: null, baseMm: DEFAULT_BASE_MM },
  field: { heightMm: null, depthMm: null, baseMm: DEFAULT_BASE_MM },
  fieldPrefixes: ["TB"],
  plateSideMm: 30,
  plateTopMm: 50,
  plateBottomMm: 50,
  sideDuctMm: 40,
  railDuctMm: 60,
  edgeGapMm: 25,
  familyGapMm: 10,
  defaultClearanceMm: 100,
  backGapMm: 40,
  doorGapMm: 20,
  fillWarnRatio: 0.8,
  // SÜTUNLU YERLEŞİM AÇIK (PANO-39, Plan F4). Ölçüldü (0026): 922 mm'lik
  // sürücünün yanındaki 0,28 m² boşluk fazladan bir 400 mm göz açtırıyordu.
  columnsEnabled: true,
  minRailMm: 200,
  columnGapMm: 50,
};

/**
 * DİKEY KANAL BİR TANEDİR VE HEP SOLDADIR (PANO-37).
 *
 * Kullanıcı kararı (09.09.2026): *"kablo geçişlerinde dikey olanlar ya sağda ya
 * solda olur; tek tarafta olsun, seçime gerek yok, hep solda olsun."*
 *
 * İlk sürüm plaka enine bakıp 500 mm'nin üstünde İKİ kanal açıyordu. Bu bir
 * seçimdi ve seçim olmaması gerekiyordu: pano imalatçısı kanalı bir yandan
 * çeker, iki yanlı kanal hem plakadan iki kat yer yer ki hem de kablonun hangi
 * yandan gideceğini belirsiz bırakır. Sabit kural, ray kapasitesini geniş
 * gövdede 40 mm ARTIRIR.
 *
 * Sayı bir sabit olarak durur (işlev değil): ray kapasitesi ve çizim aynı
 * gerçeği iki yerde hesaplamasın (değişmez md. 8).
 */
export const SIDE_DUCT_COUNT = 1;

/** Montaj plakasının eni [mm] — gövdeden kenar payı kadar küçüktür. */
export function plateWidthMm(panelWidthMm: number, s: LayoutSettings): number {
  return panelWidthMm - 2 * s.plateSideMm;
}

/** Montaj plakasının boyu [mm]. */
export function plateHeightMm(panelHeightMm: number, s: LayoutSettings): number {
  return panelHeightMm - s.plateTopMm - s.plateBottomMm;
}

/**
 * Bir ray satırında kullanılabilir genişlik [mm].
 *
 * Dikey kablo kanalı SOLDA yer kaplar; cihaz onun sağında başlar. Kenar payı
 * `nesting.ts` modelindeki gibi İKİ YÖNDE düşülür — yalnız cihazı büyütmek
 * kenar payını sessizce sıfır bırakırdı (PANO-8).
 */
export function railCapacityMm(panelWidthMm: number, s: LayoutSettings): number {
  return plateWidthMm(panelWidthMm, s) - SIDE_DUCT_COUNT * s.sideDuctMm - 2 * s.edgeGapMm;
}

/** Ray satırlarının toplam kullanabileceği yükseklik [mm]. */
export function plateCapacityHeightMm(panelHeightMm: number, s: LayoutSettings): number {
  return plateHeightMm(panelHeightMm, s) - 2 * s.edgeGapMm;
}

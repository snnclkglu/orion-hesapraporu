// TEKLİFTE İSTENEN ↔ HESAPLANAN — Hesaplar sayfasının üst şeridi.
//
// Kullanıcı isteği (18.08.2026): *"Hesaplar sayfasının en üstüne çok kısa yan
// yana vinç özellikleri gelsin. Teklifte istenen hızlar, teker çapları,
// tonaj, motor güçleri vb. Bunların hemen yanına hesaplananlar ve sapma kısaca
// yazsın. Sapma çoksa kırmızı, değer yakınsa yeşil."*
//
// İSTENEN DEĞER HER ZAMAN TEKLİF BELGESİNDEN TAZE OKUNUR, `item.inputs`tan
// DEĞİL. Girdiler teklifin bir KOPYASIDIR ve elle düzeltilebilir
// (`inputsFromOfferItem`in `doldur`u yazılmış değeri ezmez); şerit onları
// okusaydı belgeyi kendisiyle karşılaştırır ve sapmayı her zaman sıfır
// gösterirdi — yani tam olarak sormak istediğimiz soruyu cevaplayamazdı
// (TEKLIF-20'nin tek okuma noktası kuralının aynısı).
//
// AYRIŞTIRMA `oku.ts`TEDİR, `trSayi`de DEĞİL — gerekçesi o dosyanın başında.
// Aynı okuyucuyu `payload.ts` de kullanır: şerit ile girdiler teklifteki AYNI
// metni farklı okusaydı sapma satırı kendi ayrıştırma farkını ölçerdi.

import type { OfferItem, OfferPayload } from "../types";
import type { CostModelResult } from "./model";
import { costFirstNumber, costNumbersIn, costUpperBound } from "./oku";
import { travelGroupKey } from "./payload";
import type { CostInputs } from "./types";

// AYRIŞTIRICI BURADAN DA GÖRÜNÜR: şeridin okuma kuralını sınayan test doğal
// olarak bu dosyayı çağırır. Tanım `oku.ts`tedir ve TEKTİR — ikinci bir kopya
// değil, aynı fonksiyonun ikinci adı.
export { costNumbersIn };

/**
 * SAPMA EŞİĞİ — bunun altındaki fark "uygun", üstündeki "sapma".
 *
 * %5 bir katalog boyu farkının altındadır ve bir yuvarlamayı sapma saymaz;
 * bir teker boyu (⌀ 400 → 500) ya da bir motor kademesi (30 → 37 kW) ise
 * eşiğin üstünde kalır ve KIRMIZI görünür — ki zaten sorulan sorunun tamamı
 * budur: teklifte söz verilen ekipman hesaptan çıkanla aynı mı.
 */
export const COST_DEVIATION_LIMIT = 0.05;

export type CostDeviationLevel = "uygun" | "sapma" | null;

export function costDeviationLevel(deviation: number | null): CostDeviationLevel {
  if (deviation === null || !Number.isFinite(deviation)) return null;
  return Math.abs(deviation) <= COST_DEVIATION_LIMIT ? "uygun" : "sapma";
}

export interface CostCompareRow {
  key: string;
  label: string;
  unit: string;
  /** Değerin önüne basılan işaret — çaplarda "⌀". */
  prefix?: string;
  decimals: number;
  /** TEKLİFTE YAZAN metin — aralıksa olduğu gibi ("1-6"). */
  requestedText: string | null;
  /** Sapma hesabına giren sayı; okunamıyorsa `null` (uydurulmaz). */
  requested: number | null;
  calculated: number | null;
  /** (hesaplanan − istenen) ÷ istenen; taraflardan biri yoksa `null`. */
  deviation: number | null;
}

// ————————————————————————————————————————————————— teklifi okuma

function part(item: OfferItem, groupKey: string, rowKey: string, partKey: string): string | null {
  const g = item.groups.find((x) => x.key === groupKey);
  const v = (g?.rows.find((r) => r.key === rowKey)?.parts?.[partKey] ?? "").trim();
  return v || null;
}

function value(item: OfferItem, groupKey: string, rowKey: string): string | null {
  const g = item.groups.find((x) => x.key === groupKey);
  const v = (g?.rows.find((r) => r.key === rowKey)?.value ?? "").trim();
  return v || null;
}

function sapma(requested: number | null, calculated: number | null): number | null {
  if (requested === null || calculated === null || requested === 0) return null;
  return (calculated - requested) / requested;
}

// —————————————————————————————————————————————————————— şerit

/**
 * ŞERİDİN SATIRLARI — teklifin istediği, hesabın çıkardığı ve aradaki fark.
 *
 * TEKLİF KALEMİ BULUNAMAZSA ŞERİT BOŞ DÖNER, sıfırlarla dolu bir şerit değil:
 * serbest bir maliyet kaleminin (teklif bağı kopmuş) karşılaştıracağı bir
 * belge yoktur (MALIYET-11'in "serbest satırda maliyet yoktur" kuralı).
 */
export function costCompareRows(
  offer: OfferPayload,
  offerItemId: string | null,
  inputs: CostInputs,
  model: CostModelResult | undefined
): CostCompareRow[] {
  const item = offerItemId ? offer.items.find((i) => i.id === offerItemId) : undefined;
  if (!item) return [];

  const yur = travelGroupKey(item);
  const v = (key: string): number | null => model?.values[key] ?? null;

  const satir = (
    key: string,
    label: string,
    unit: string,
    decimals: number,
    requestedText: string | null,
    requested: number | null,
    calculated: number | null,
    prefix?: string
  ): CostCompareRow => ({
    key,
    label,
    unit,
    prefix,
    decimals,
    requestedText,
    requested,
    calculated,
    deviation: sapma(requested, calculated),
  });

  // KÜNYE — teklifin künyesi ile maliyetin girdisi aynı mı. İkisi ayrışırsa
  // bütün model yanlış vinci hesaplıyor demektir, o yüzden en başta durur.
  const kapasiteMetin = value(item, "general", "capacity") ?? part(item, "general", "capacity", "main");
  const acilikMetin =
    part(item, "general", "span", "value") ?? part(item, "general", "boomSpan", "value");
  const yukseklikMetin = part(item, "general", "liftHeight", "value");

  const rows: CostCompareRow[] = [
    satir(
      "capacity",
      "Kapasite",
      "ton",
      1,
      kapasiteMetin,
      // METİN İLE SAYI AYNI KAYNAĞI OKUR. Sayı bir süre yalnız künyeden ve
      // `parts.main`ten geliyordu; kapasitesi künyeye girilmemiş ve satırı
      // elle "32 ton" diye yazılmış bir kalemde şerit metni gösteriyor ama
      // sapmayı SESSİZCE hiç hesaplamıyordu.
      item.capacityT ?? costFirstNumber(part(item, "general", "capacity", "main")) ?? costFirstNumber(kapasiteMetin),
      inputs.capacityT
    ),
    satir("span", "Açıklık", "m", 1, acilikMetin, item.spanM ?? costFirstNumber(acilikMetin), inputs.spanM),
    satir("liftHeight", "Kaldırma Yüksekliği", "m", 1, yukseklikMetin, costFirstNumber(yukseklikMetin), inputs.liftHeightM),
  ];

  // HIZLAR — teklifte çoğunlukla ARALIKTIR ("1-6"); şerit metni olduğu gibi
  // gösterir, sapmayı üst uçtan hesaplar.
  const hizlar: [string, string, string | null, number | null][] = [
    ["liftSpeed", "Kaldırma Hızı", part(item, "mainHoist", "liftSpeed", "range"), inputs.liftSpeedMpm],
    ["trolleySpeed", "Araba Hızı", part(item, "trolley", "travelSpeed", "range"), inputs.trolleySpeedMpm],
    ["bridgeSpeed", "Köprü / Portal Hızı", part(item, yur, "travelSpeed", "range"), inputs.bridgeSpeedMpm],
  ];
  for (const [key, label, metin, hesap] of hizlar) {
    rows.push(satir(key, label, "m/dk", 1, metin, costUpperBound(metin), hesap));
  }

  // MOTOR GÜÇLERİ — teklifte parça olarak "22" yazar, birim eki belgede
  // basılır; şerit birimi KENDİ ekler, metinden ayıklamaya çalışmaz.
  const motorlar: [string, string, string | null, number | null][] = [
    ["hoistMotor", "Kaldırma Motoru", part(item, "mainHoist", "motor", "power"), v("c.hoistMotorKw")],
    ["trolleyMotor", "Araba Motoru", part(item, "trolley", "motor", "power"), v("c.trolleyMotorKw")],
    ["bridgeMotor", "Köprü / Portal Motoru", part(item, yur, "motor", "power"), v("c.bridgeMotorKw")],
  ];
  for (const [key, label, metin, hesap] of motorlar) {
    rows.push(satir(key, label, "kW", 2, metin, costFirstNumber(metin), hesap));
  }

  // TEKER ÇAPLARI — hesaptaki karşılığı ETKİN çaptır (hız kademesi dahil),
  // çünkü sahaya takılan teker odur.
  const tekerler: [string, string, string | null, number | null][] = [
    ["trolleyWheel", "Araba Teker ⌀", part(item, "trolley", "wheel", "dia"), v("c.trolleyWheelEffDiaMm")],
    ["bridgeWheel", "Köprü / Portal Teker ⌀", part(item, yur, "wheel", "dia"), v("c.bridgeWheelEffDiaMm")],
  ];
  for (const [key, label, metin, hesap] of tekerler) {
    rows.push(satir(key, label, "mm", 0, metin, costFirstNumber(metin), hesap, "⌀"));
  }

  // HALAT DONANIMI — teklifte "4/1" biçiminde ve PARÇASIZ bir satırdır
  // (`row.value`). İlk sayı KAT sayısıdır; ikincisi tambur/blok düzenidir ve
  // hesabın karşılığı yoktur.
  const donanim = value(item, "mainHoist", "reeving");
  rows.push(satir("reeving", "Halat Donanımı", "kat", 0, donanim, costFirstNumber(donanim), v("c.hoistRopeCount")));

  // İKİ TARAFI DA BOŞ OLAN SATIR HİÇ GÖSTERİLMEZ: ne teklifte yazan ne de
  // hesaplanan bir değer varsa o satır bu vinç için yok demektir; "—  —"
  // basmak şeridi okunmaz yapardı.
  return rows.filter((r) => r.requestedText !== null || r.calculated !== null);
}

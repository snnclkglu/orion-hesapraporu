// GİRDİLERİ TEKLİFLE EŞİTLEME — hangi alan belgeden farklı ve ne olacak.
//
// Kullanıcı isteği (19.08.2026, md. 6): *"Teklifteki açıklık/tonaj değişip
// girdiler elle düzeltilince Ağırlıklar ve Hesaplar yeniden hesaplansın; elle
// girilmiş değerler kaybolmamalı."*
//
// EKSİK OLAN "HESAP" DEĞİL, EŞİTLEMEDİR. Ağırlıklar ve Hesaplar zaten HER TUŞ
// VURUŞUNDA yeniden koşar (`cost-editor.tsx`: `withCostDerived` + `costModels`
// useMemo'su), yani ekranda beklenen bir gecikme yoktur. Geride kalan tek şey
// GİRDİLERDİR: `inputsFromOfferItem`in `doldur`u yalnız BOŞ alanı doldurur ve
// dolu olanı bilerek EZMEZ (MALIYET-9), çünkü teklifte "yaklaşık 20 m" yazan
// bir açıklığı burada 19,5 diye düzelten kullanıcı onu her tazelemede geri
// almak zorunda kalmamalıdır. Teklifteki açıklık gerçekten 30'dan 28'e
// düştüğünde ise aynı kural ters yönde ısırır — bu modül o eşitlemeyi AÇIK bir
// eyleme çevirir ve neyin değişeceğini önce SÖYLER.
//
// SUNUCU YOLU DEĞİŞMEZ (`withOfferSync`): orada `doldur`un davranışı
// MALIYET-9'un yazılı kuralıdır ve "Tekliften Tazele" ekleyici kalır. Zorla
// eşitleme yalnız kullanıcının onayladığı bu eylemde olur.
//
// ELLE GİRİLEN İKİ KATMAN KARIŞTIRILMAZ:
//   · `item.inputs`   — girdiler. Riski taşıyan katman BUDUR; eşitleme yalnız
//                       buna dokunur ve dokunacağı alanları listeler.
//   · `item.overrides`— model ÇIKTISI ezmeleri (ana kiriş ağırlığı, seçilen
//                       motor). Eşitleme bunlara HİÇ dokunmaz: MALIYET-7
//                       gereği ezilen değer `hesapla` içinde aşağıya akar,
//                       yani yeni girdiyle birlikte doğru şekilde yeniden
//                       kullanılır. Onları silmek AYRI bir eylemdir ve ayrı
//                       sorulur — biri belgeyle eşitleme, öteki mühendisin
//                       bilgisini atma kararıdır.

import { fmtCostField } from "@/lib/offers/cost/labels";
import { inputsFromOfferItem } from "@/lib/offers/cost/payload";
import type { CostInputs } from "@/lib/offers/cost/types";
import type { OfferItem } from "@/lib/offers/types";

/**
 * TEKLİF BELGESİNDEN OKUNAN ÖLÇÜLER.
 *
 * Hepsi `number | null`dır ve okunamadığında `null` kalır — bu liste tam da o
 * yüzden ayrı durur: eşitleme öncesinde bu alanlar BOŞALTILARAK okunur, böylece
 * `doldur` kelepçesi kalkar ve belgenin kendi değeri görünür.
 */
const OLCU_ALANLARI = [
  "capacityT",
  "auxCapacityT",
  "spanM",
  "liftHeightM",
  "liftSpeedMpm",
  "trolleySpeedMpm",
  "bridgeSpeedMpm",
  "legHeightM",
] as const;

/**
 * BELGEDEN OKUNAN ADETLER — okunamazsa TABANDAN döner (`adet(..., yedek)`).
 *
 * Bu yüzden boşaltılmazlar: taban mevcut girdi olduğu için teklifte teker
 * adedi yazmıyorsa okuma kullanıcının sayısını aynen geri verir ve ortada bir
 * fark görünmez. Boşaltılsaydı okuma koddaki varsayılana (portalde 8, köprüde
 * 4) düşerdi ve "teklif böyle diyor" başlığı altında bir VARSAYIM yazılırdı
 * (değişmez md. 4).
 */
const ADET_ALANLARI = ["bridgeWheelCount", "bridgeDriveCount", "trolleyDriveCount"] as const;

/**
 * BELGEDEN OKUNAN METİNLER — ray kodları (md. 12).
 *
 * `OLCU_ALANLARI` gibi boşaltılmazlar ve `ADET_ALANLARI` gibi de değildirler:
 * `inputsFromOfferItem` ray kodunu ancak MEVCUT BOŞSA yazar (`taban.x || …`).
 * Yani kullanıcının listeden seçtiği ray "eşitleme" adı altında sessizce
 * değişmez; boşsa teklifin satırı doldurur.
 */
const METIN_ALANLARI = ["bridgeRailCode", "trolleyRailCode"] as const;

/**
 * GİRDİLERİN AD DEFTERİ — kutu da fark listesi de BURADAN okur.
 *
 * `Record<keyof CostInputs, …>`tır ve tip bunu bir SÖZ hâline getirir: modele
 * yeni bir girdi eklendiğinde derleyici burada da bir ad ister. Adlar çağrı
 * yerine yazılsaydı eşitleme penceresi "spanM 30 → 28" gibi ham anahtarlar
 * basardı — MALIYET-18'de aynı hata ölçüldü ("c.capacityT" ekrana böyle
 * düşmüştü).
 */
const ETIKETLER: Record<keyof CostInputs, { etiket: string; birim?: string }> = {
  capacityT: { etiket: "Ana Kaldırma", birim: "ton" },
  auxCapacityT: { etiket: "Yardımcı Kaldırma", birim: "ton" },
  spanM: { etiket: "Açıklık", birim: "m" },
  liftHeightM: { etiket: "Kaldırma Yüksekliği", birim: "m" },
  liftSpeedMpm: { etiket: "Kaldırma Hızı", birim: "m/dk" },
  trolleySpeedMpm: { etiket: "Araba Hızı", birim: "m/dk" },
  bridgeSpeedMpm: { etiket: "Köprü / Portal Hızı", birim: "m/dk" },
  legHeightM: { etiket: "Portal Ayak Yüksekliği", birim: "m" },
  ambientC: { etiket: "Ortam Sıcaklığı", birim: "°C" },
  girderCount: { etiket: "Kiriş Adedi" },
  bridgeWheelCount: { etiket: "Köprü Teker Adedi" },
  bridgeDriveCount: { etiket: "Köprü Tahrik Adedi" },
  trolleyDriveCount: { etiket: "Araba Tahrik Adedi" },
  craneClass: { etiket: "Vinç Sınıfı" },
  gantry: { etiket: "Portal (ayaklı)" },
  cabin: { etiket: "Operatör Kabini" },
  movingCabin: { etiket: "Hareketli Kabin" },
  electricRoom: { etiket: "Elektrik Odası" },
  heatShield: { etiket: "Isı Kalkanı" },
  bridgeRailCode: { etiket: "Köprü / Portal Rayı" },
  trolleyRailCode: { etiket: "Araba Rayı" },
};

/** Alanın ekrandaki adı — girdi kutusu ve fark listesi AYNI metni okur. */
export function girdiEtiketi(key: keyof CostInputs): { etiket: string; birim?: string } {
  return ETIKETLER[key];
}

/** Eşitlemenin bir satırı — "Açıklık 30 → 28". */
export interface GirdiFarki {
  key: keyof CostInputs;
  etiket: string;
  birim?: string;
  eski: string;
  yeni: string;
}

export interface GirdiEsitlemesi {
  /** Eşitlenmiş girdiler; fark yoksa GELEN NESNENİN AYNISI. */
  inputs: CostInputs;
  farklar: GirdiFarki[];
}

function sayiMetni(v: number | null): string {
  return v === null ? "—" : fmtCostField(v, Number.isInteger(v) ? 0 : 2);
}

/**
 * GİRDİLERİ TEKLİF BELGESİYLE EŞİTLER ve NEYİ DEĞİŞTİRDİĞİNİ söyler.
 *
 * OKUMA İKİ AŞAMALIDIR ve bu bilinçlidir. `inputsFromOfferItem` tek başına
 * "belgede ne yazıyor" sorusuna cevap vermez: dolu bir alanı korur (ölçüler),
 * okunamayan bir adedi ise tabandan doldurur. Taban olarak ÖLÇÜLERİ BOŞALTILMIŞ
 * mevcut girdi verilir; böylece
 *   · ölçüler belgenin kendi değerini (ya da `null`) döner,
 *   · adetler, sınıf ve portal bayrağı okunamadığında MEVCUDU döner.
 * Sonuç: belgenin sustuğu hiçbir alan değişmez, yani elle girilmiş bir değer
 * "eşitleme" adı altında sessizce silinemez.
 *
 * `gantry` yalnız AÇILABİLİR (`gantry || taban.gantry`): teklif başlığında
 * PORTAL geçmiyor diye ayaklı bir vinci köprüye düşürmek, ayak modelini ve
 * onunla birlikte ağırlığın üçte birini yok etmek olurdu.
 */
export function teklifleEsitle(mevcut: CostInputs, teklifKalemi: OfferItem): GirdiEsitlemesi {
  const taban: CostInputs = { ...mevcut };
  for (const k of OLCU_ALANLARI) taban[k] = null;
  const taze = inputsFromOfferItem(teklifKalemi, taban);

  const inputs: CostInputs = { ...mevcut };
  const farklar: GirdiFarki[] = [];
  const ekle = (key: keyof CostInputs, eski: string, yeni: string) =>
    farklar.push({ key, ...girdiEtiketi(key), eski, yeni });

  for (const k of OLCU_ALANLARI) {
    const yeni = taze[k];
    // BELGENİN SUSTUĞU ALANA DOKUNULMAZ: "yaklaşık 20 m" `null` okunur ve dolu
    // bir açıklığı silmemelidir.
    if (yeni === null || yeni === mevcut[k]) continue;
    inputs[k] = yeni;
    ekle(k, sayiMetni(mevcut[k]), sayiMetni(yeni));
  }

  for (const k of ADET_ALANLARI) {
    const yeni = taze[k];
    if (yeni === mevcut[k]) continue;
    inputs[k] = yeni;
    ekle(k, sayiMetni(mevcut[k]), sayiMetni(yeni));
  }

  // RAY KODU YALNIZ BOŞKEN DOLAR (`inputsFromOfferItem`in `taban.x || …`
  // kelepçesi): kullanıcının seçtiği ray eşitlemeyle geri alınmaz.
  for (const k of METIN_ALANLARI) {
    const yeni = taze[k];
    if (!yeni || yeni === mevcut[k]) continue;
    inputs[k] = yeni;
    ekle(k, mevcut[k] || "—", yeni);
  }

  if (taze.craneClass !== mevcut.craneClass) {
    inputs.craneClass = taze.craneClass;
    ekle("craneClass", mevcut.craneClass, taze.craneClass);
  }

  if (taze.gantry !== mevcut.gantry) {
    inputs.gantry = taze.gantry;
    ekle("gantry", mevcut.gantry ? "Evet" : "Hayır", taze.gantry ? "Evet" : "Hayır");
  }

  return { inputs: farklar.length ? inputs : mevcut, farklar };
}

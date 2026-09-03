// KOMPAKT (BASİT) HESAP RAPORUNUN PLANI VE YERLEŞİM ÇEKİRDEĞİ — SAF.
//
// Kullanıcı kararı (02.09.2026): Özet ile Standart arasında dördüncü bir seviye.
// "Şemaların hiçbiri olmasın, sade kompakt bir yapıda olsun. Sayfayı yatayda
// ikiye de bölebiliriz. Hesapların tamamı, formüllerin tamamı olmasına gerek
// yok; gereken yerlerde sadeleştirmeler de yapabiliriz."
//
// İÇ ADI "BASİT", MÜŞTERİYE GİDEN ADI "KOMPAKT". Kullanıcı: *"Müşteri tabi
// basit olarak bilmeyecek."* Menüde ve yönetim ekranlarında seviye "Basit"
// diye anılır; dosya adına, portal belge başlığına ve PDF'in kendisine
// "basit" sözcüğü HİÇ girmez (`REPORT_LEVEL_LABELS.basit = "Kompakt"`,
// `PORTAL_REPORT_TITLE_LABELS`). `report.smoke.test.tsx` bunu belgenin
// METNİNDEN ölçer.
//
// Bu dosya React, react-pdf ve DB içe aktarmaz: plan ve yerleşim hesabı burada
// sınanır, çizim `pdf/report.tsx`tedir (stiller ve ortak bileşenler orada
// yaşıyor; ikinci bir stil kopyası bir gün ayrışırdı).
//
// PLAN NEDEN ELLE SEÇİLİYOR: bölüm satırlarının "hangisi önemli" bilgisi
// tanımlarında YOKTUR (formül zinciri her satırı eşit basar). Genel bir
// kural ("kontrole bağlı satırlar" gibi) rastgele sonuç üretiyordu — halat
// bölümünde emniyet katsayısı çıkarken yiv boyu hiç çıkmıyordu. Seçim
// mühendislik yargısıdır ve burada tek yerde durur; `report-compact.test.ts`
// her anahtarın adaptörde GERÇEKTEN var olduğunu doğrular (yanlış yazılmış ya
// da yeniden adlandırılmış anahtar sessizce düşmez, test düşer).
//
// PLANDA OLMAYAN BÖLÜM GENEL KURALLA basılır: seçim özeti (varsa) + kontroller.
// Yeni eklenen bir alt bölüm böylece kompakt rapora kendiliğinden ama
// sadece yargısıyla girer.

import type { ModuleFamily } from "@/lib/calc/presentation/module-family";
import type { AnyCheck } from "@/lib/calc/types";

export interface CompactSectionPlan {
  /** Bölüm kartı kompakt raporda hiç basılmaz. */
  skip?: boolean;
  /** Kart iki sütunu birden kaplar; satırları iki iç sütuna yayılır. */
  wide?: boolean;
  /**
   * Kartın ÜRÜN SATIRI — seçim alanlarının değerleri " · " ile birleştirilir
   * ("SKF · SE 212"). Özet sayfasının hazır satırı olan bölümlerde (halat,
   * tambur, redüktör, motor, fren, kaplinler, teker, kanca, makara) bu alan
   * KULLANILMAZ; oradaki satır aynen gelir — iki belge aynı ekipmanı farklı
   * yazmasın diye.
   */
  line?: readonly string[];
  /** Kart satırı olarak basılacak girdi anahtarları (`inputDefs` + `extraInputDefs`). */
  inputs?: readonly string[];
  /** Kart satırı olarak basılacak seçim anahtarları (`selectionDefs`). */
  selections?: readonly string[];
  /** Kart satırı olarak basılacak hesap satırı anahtarları (`rows`). */
  rows?: readonly string[];
  /** Bölüm sonu tablosu da basılır — yalnız kısa ve müşteriye anlamlı tablolar. */
  table?: boolean;
  /**
   * Sayısal değeri 0 olan girdi satırı düşer. Ana kiriş kesitinde ek flanş
   * (t6/b6) çoğu vinçte yoktur; "Ek Flanş Kalınlığı 0 mm" satırı olmayan bir
   * sacı varmış gibi okutur. Yalnız bu bayrakla açılır — sıfırın anlam
   * taşıdığı alanlarda (sıcaklık, yanaşma) satır kalır.
   */
  hideZero?: boolean;
}

type FamilyPlan = Record<string, CompactSectionPlan>;

const HOIST_PLAN: FamilyPlan = {
  "2.1": {
    rows: ["load.total", "rope.load", "rope.requiredBreakingLoad", "rope.breakingLoad"],
  },
  "2.2.1": { inputs: ["drumWallThicknessMm"], rows: ["drum.groovePitch"] },
  "2.2.2": {
    selections: ["drumGrooveLengthText"],
    rows: ["drum.requiredGrooveLength", "rope.totalLength"],
  },
  "2.2.3": {
    inputs: ["shaftD1Mm", "shaftD2Mm"],
    selections: ["shaftMaterial"],
    rows: ["drumShaft.moment"],
  },
  "2.2.4": { inputs: ["drumWeldThicknessMm"] },
  "2.2.5": { inputs: ["shaftWeldThicknessMm"] },
  "2.2.6": {
    line: ["bearingBrand", "bearingType", "bearingCode"],
    selections: ["bearingBoreMm", "bearingDynCKn", "bearingStatC0Kn"],
  },
  "2.2.7": {
    line: ["bearingHousingBrand", "bearingHousingCode", "bearingHousingSeatType"],
  },
  "2.3": { rows: ["gearbox.actualLiftSpeed"] },
  "2.4": {},
  "2.5": { rows: ["brake.combinedSafety"] },
  "2.6": {},
  "2.7": {},
  "2.8": {
    line: ["safetyBrakeModel", "safetyBrakeArrangement"],
    selections: ["safetyBrakeFlangeDiaMm", "safetyBrakeFlangeThicknessMm", "safetyBrakeHydraulicUnit"],
    rows: ["safety.achievedFactor"],
  },
  "2.9": {
    line: ["balanceSocketType", "balanceLoadcellBrand"],
    rows: ["balance.load", "balance.socket", "balance.loadcellSel"],
  },
  "2.10": {
    line: ["balanceLoadcellBrand"],
    selections: ["balanceSheaveDiaMm"],
    rows: ["balance.load", "balance.sheaveMinDia", "balance.loadcellSel"],
  },
};

const HOOKBLOCK_PLAN: FamilyPlan = {
  "4.1": { rows: ["hook.load", "hook.dinGroup"] },
  "4.2": { rows: ["sheave.count"] },
  "4.3": {
    line: ["sheaveBearingBrand", "sheaveBearingType", "sheaveBearingCode"],
    selections: ["sheaveBearingDynCKn", "sheaveBearingStatC0Kn"],
  },
  "4.4": { inputs: ["shaftD1Mm"], selections: ["shaftMaterial"], rows: ["shaft.moment"] },
  "4.5": {
    line: ["hookBearingBrand", "hookBearingType", "hookBearingCode"],
    selections: ["hookBearingStatC0Kn"],
  },
  "4.6": {
    wide: true,
    inputs: [
      "beamXMm", "beamYMm", "beamZMm",
      "midTopPlateThkMm", "midTopPlateWidthMm", "midWebPlateThkMm", "midWebPlateHeightMm",
      "midBottomPlateThkMm", "midBottomPlateWidthMm", "thickWebPlateThkMm", "thickBottomPlateThkMm",
      "fatigueMaterial",
    ],
    rows: [
      "girder.span", "girder.forceMax", "girder.momentMax",
      "girder.midSectionModulus", "girder.dynamicFactor",
    ],
  },
  "4.7": { inputs: ["loadGroup", "notchClass"] },
};

const TRAVEL_PLAN: FamilyPlan = {
  "5.1": { inputs: ["wheelCount", "driveCount"], rows: ["wheel.maxLoad", "wheel.minLoad"] },
  "5.2": { inputs: ["shaftDiaMm"], selections: ["shaftMaterial"], rows: ["shaft.maxMoment"] },
  "5.3": {
    line: ["bearingBrand", "bearingType", "bearingCode"],
    selections: ["bearingBoreMm", "bearingDynCKn", "bearingStatC0Kn"],
  },
  "5.4": { rows: ["weight.movingTonnes", "drive.startupTime"] },
  "5.5": { rows: ["gearbox.requiredRatio"] },
  "5.5b": { rows: ["brake.requiredTorque"] },
  "5.6": {},
  "5.7": {},
  "5.8": {
    line: ["bufferModel", "bufferCatalogType"],
    inputs: ["bufferCount"],
    selections: ["bufferStrokeMm", "bufferEnergyKj", "bufferLoadKn"],
    rows: ["buffer.impactSpeed"],
  },
  "5.9": {
    line: ["festoonBrand", "festoonSeries", "festoonLine"],
    selections: ["festoonTrolleyCode", "festoonTowTrolleyCode"],
    rows: ["festoon.travelDistance", "festoon.loadPerTrolley"],
  },
};

const WHEELLOADS_PLAN: FamilyPlan = {
  "10.1": {
    inputs: ["guideSpacingMm", "guideClearanceMm", "coupledPairCount"],
    selections: ["guideMeans", "wheelPairMode"],
    rows: ["vertical.totalLoad", "wheelSet.total", "wheelSet.wheelbase"],
  },
  "10.2": {
    selections: ["hoistingClass", "hoistDriveClass"],
    rows: [
      "vertical.maxWheelLoad", "vertical.minWheelLoad", "dynamic.phi2", "vertical.designWheelLoad",
    ],
  },
  "10.3": { rows: ["skew.guideForce", "skew.maxLateralNear"] },
  "10.4": {
    rows: ["longitudinal.perRail", "longitudinal.perDrivenWheel", "buffer.reactionForce"],
  },
  // Yol kirişini boyutlayan mühendise verilen kuvvet seti: müşteriye giden
  // özün ta kendisidir, tablo bütünüyle basılır.
  "10.5": { wide: true, table: true },
};

const GIRDER_PLAN: FamilyPlan = {
  "7.1": {
    wide: true,
    hideZero: true,
    inputs: [
      "railHeightMm", "t1Mm", "b1Mm", "t2Mm", "b2Mm",
      "railTProfileTopThkMm", "railTProfileTopWidthMm", "railTProfileWebThkMm", "railTProfileWebHeightMm",
      "t3Mm", "h3Mm", "t4Mm", "t5Mm", "b5Mm", "t6Mm", "b6Mm", "aMm", "xMm",
    ],
    rows: [
      "section.height", "section.area", "section.weightPerLength", "section.approxGirderWeight",
      "section.inertiaY", "section.modulusYBottom", "section.inertiaZ", "section.modulusZBottom",
    ],
  },
  "7.2": {
    inputs: ["hookTopPositionM", "bridgeAxleSpacingM", "trolleyAxleSpacingM"],
    rows: [
      "load.bridgeDeadWeight", "load.trolleyWeightOnGirder", "load.hoistLoadOnGirder",
      "load.dynamicFactor", "load.psiHA", "load.psiHK", "load.trolleySkew", "load.bridgeSkew",
    ],
  },
  "7.3": { rows: ["load.amplifyFactor", "stress.testFactor"] },
  "7.4": {
    inputs: ["diaphragmSpacingMm"],
    selections: ["staticMaterial"],
    rows: [
      "moment.verticalTotal", "stress.sigmaXBottomCase1", "stress.sigmaXTopCase1", "stress.shearMainCase1",
    ],
  },
  "7.5": { selections: ["fatigueMaterial", "fatigueNotchClass"], rows: ["fatigue.kappaX"] },
  "7.6": { inputs: ["deflectionLimitRatio"], rows: ["deflection.value"] },
  // Kamber şeridi bir İMALAT ölçüsüdür; kompakt raporda açıklık ortası
  // değerleri yeter, perde perde kot tablosu basılmaz.
  "7.7": {
    rows: ["camber.deadLoadPerM", "camber.girderTotalWeight", "camber.cutting", "camber.supported"],
  },
  "7.8": { rows: ["dynamics.naturalFrequency"] },
};

const BUCKLING_PLAN: FamilyPlan = {
  "8.1": {
    inputs: ["thicknessMm", "panelWidthMm", "stiffenerSpacingMm"],
    rows: ["sidePanel.safetyFactor", "sidePanel.utilization"],
  },
  "8.2": {
    inputs: ["thicknessMm", "panelWidthMm", "stiffenerSpacingMm"],
    rows: ["topPanel.safetyFactor", "topPanel.utilization"],
  },
};

const ENDCARRIAGE_PLAN: FamilyPlan = {
  "9.1": {
    inputs: ["wheelSpanAMm", "loadOffsetBMm"],
    rows: ["wheel.loadMax", "wheel.loadMin", "moment.max"],
  },
  "9.2": {
    inputs: [
      "topPlateThicknessMm", "topPlateWidthMm", "sidePlateThicknessMm",
      "sidePlateHeightMm", "bottomPlateThicknessMm", "bottomPlateWidthMm",
    ],
    rows: ["section.weightPerLength", "section.modulus", "section.inertia"],
  },
  "9.3": {
    selections: ["material"],
    rows: ["load.dynamicFactor", "stress.bending", "stress.shear"],
  },
  "9.4": { selections: ["fatigueMaterial", "fatigueNotchClass"], rows: ["fatigue.kappa"] },
};

const CABIN_PLAN: FamilyPlan = {
  "11.1": {
    line: ["cabinAcBrand", "cabinAcModel"],
    inputs: ["cabinWidthM", "cabinLengthM", "cabinHeightM", "cabinInsulation", "cabinIndoorTempC"],
    rows: ["cabinAc.total", "cabinAc.coolingMax"],
  },
  "11.2": {
    line: ["roomAcBrand", "roomAcModel"],
    inputs: [
      "roomWidthM", "roomLengthM", "roomHeightM", "roomInsulation", "roomIndoorTempC", "roomAcRedundancy",
    ],
    rows: ["room.panelCount", "room.acUnitCount", "roomAc.total", "roomAc.coolingMax"],
  },
  "11.3": {
    line: ["panelAcBrand", "panelAcModel"],
    inputs: ["panelCount", "panelIpClass", "panelAcRedundancy"],
    rows: ["panel.acUnitCount", "panelAc.total", "panelAc.coolingMax"],
  },
};

/** Aile → ham bölüm id'si → plan. Ham id kullanılır (köprüde 6.x değil 5.x). */
export const COMPACT_PLAN: Record<ModuleFamily, FamilyPlan> = {
  hoist: HOIST_PLAN,
  hookBlock: HOOKBLOCK_PLAN,
  travel: TRAVEL_PLAN,
  wheelLoads: WHEELLOADS_PLAN,
  girder: GIRDER_PLAN,
  buckling: BUCKLING_PLAN,
  endCarriage: ENDCARRIAGE_PLAN,
  cabin: CABIN_PLAN,
};

const EMPTY_PLAN: CompactSectionPlan = {};

export function compactPlanFor(family: ModuleFamily, rawId: string): CompactSectionPlan {
  return COMPACT_PLAN[family]?.[rawId] ?? EMPTY_PLAN;
}

// ---------------------------------------------------------------- Kontroller

/**
 * ONAY / VARLIK kontrolü: iki sayısı olmayan kontrol ("tahvil oranı seçilmiş",
 * "fren boşluğu modelin bandında"). Motor bunları `1 ≥ 1` diye kodlar; kompakt
 * raporda sayı basılmaz, yalnız yargı basılır — "1 ≥ 1" okuyana bir şey
 * söylemez (başlık şeridi de aynı gerekçeyle bunları dışarıda bırakır).
 *
 * Ölçüt bilerek DARDIR: birimsiz, gereken tam olarak 1 ve sağlanan 0 ya da 1.
 * Emniyet katsayısı kontrolleri de birimsizdir ama sağlanan taraf 3,19 gibi
 * bir kesirdir ve bu kapıdan geçmez.
 */
export function isExistenceCheck(check: AnyCheck): boolean {
  if (check.op === "range") return false;
  return (
    check.unit.trim() === "-" &&
    check.required === 1 &&
    (check.provided === 0 || check.provided === 1)
  );
}

// ---------------------------------------------------------------- Yerleşim

export type CompactRow<T> =
  | { kind: "wide"; item: T }
  | { kind: "pair"; left: T; right?: T };

/**
 * Kartları İKİŞERLİ SATIRLARA dizer — numara sırasıyla, soldan sağa.
 *
 * ÖNCEKİ DÜZEN GAZETE SÜTUNUYDU ve kullanıcı onu düzeltmemi istedi
 * (03.09.2026: *"alt bölüm yerleşimleri ekteki resimlerdeki gibi olmak zorunda
 * mı, daha düzgün yapılamaz mı"*). İki kusuru vardı:
 *
 *  1. **Numaralar zikzak okunuyordu.** Kartlar yükseklik tahminiyle dengelenmiş
 *     bloklara bölünüyor, blok içinde önce sol sütun sonra sağ sütun
 *     okunuyordu: sol sütunda 5.1 · 5.3 · 5.4, sağ sütunda 5.2 · 5.5 · 5.6.
 *     Gazetede doğru olan bu düzen, NUMARALI bölümlerde hata gibi görünür —
 *     okuyucu 5.2'yi 5.1'in altında arar.
 *  2. **Blok dikişlerinde bant bant boşluk kalıyordu.** İki sütunun yüksekliği
 *     eşitlenemediği için her bloğun altında düzensiz bir hava payı oluşuyor,
 *     kartların üst kenarları hiçbir yerde hizalanmıyordu.
 *
 * Satır düzeninde ikisi de biter: satırın iki kartı AYNI ÜST KENARDAN başlar
 * ve yoga'nın `alignItems: stretch` öntanımıyla AYNI YÜKSEKLİKTE biter, sıra
 * 1→2 / 3→4 diye okunur. Bedeli, kısa kartın içinde kalan boşluktur; o boşluk
 * kartın ÇERÇEVESİNİN İÇİNDEDİR ve sayfada delik gibi durmaz — eski düzendeki
 * bant boşluğu ise duruyordu.
 *
 * YÜKSEKLİK TAHMİNİ ARTIK GEREKMİYOR: eşleştirme sıradan gelir, dengelenecek
 * bir şey yoktur. Tahmin makinesi (`estimateCompactCardHeight` ve metrikleri)
 * bu yüzden kaldırıldı — çizimdeki her punto değişiminde bakımı gereken,
 * yalnız bloklama için var olan bir kopyaydı.
 *
 * Geniş kart (`wide`) tek başına bir satırdır; eşini bekleyen yarım satır
 * ondan önce kapanır (sıra bozulmaz).
 */
export function pairCompactRows<T extends { wide?: boolean }>(
  items: readonly T[]
): CompactRow<T>[] {
  const rows: CompactRow<T>[] = [];
  let pending: T | undefined;

  for (const item of items) {
    if (item.wide) {
      if (pending) {
        rows.push({ kind: "pair", left: pending });
        pending = undefined;
      }
      rows.push({ kind: "wide", item });
      continue;
    }
    if (pending) {
      rows.push({ kind: "pair", left: pending, right: item });
      pending = undefined;
    } else {
      pending = item;
    }
  }
  if (pending) rows.push({ kind: "pair", left: pending });
  return rows;
}

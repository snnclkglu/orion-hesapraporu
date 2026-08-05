// Kontrol ↔ hesap satırı bağlantı haritası.
//
// Rapor okunurluğu için kontroller ("✓ UYGUN / ✗ UYGUN DEĞİL") bölümün en
// altında toplu değil, ilgili oldukları hesap satırının hemen altında
// gösterilir. Bu dosya hangi kontrolün hangi satıra bağlanacağını sabitler.
//
// Anahtar: `${modül ailesi}|${bölüm id}|${kontrol soneki}` → satırın SEMANTİK
// ANAHTARI (`<blok>.<büyüklük>`). Araba ve köprü aynı semantik anahtarları
// kullandığından harita tektir; varyanta göre adres dallanması yoktur.
//
// Haritada karşılığı olmayan kontroller, bölümün sonundaki "Diğer Kontroller"
// bloğunda gösterilir — yani eksik eşleme kontrolü kaybetmez. Bağlantının
// gerçekten var olan bir satırı gösterdiğini `__tests__/anchors.guard.test.ts`
// doğrular.

import type { ModuleKey } from "./module-family";
import { moduleFamily } from "./module-family";

type AnchorMap = Record<string, Record<string, string>>;

/** 02 / 03 — Ana ve Yardımcı Kaldırma */
const HOIST_ANCHORS: AnchorMap = {
  "2.1": { "rope.safety": "rope.actualSafety" },
  "2.2.1": { "drum.stress": "drum.allowableStress", "drum.dia": "drum.minDia" },
  "2.2.3": {
    "shaft.bending": "drumShaft.allowableBending",
    "shaft.shear": "drumShaft.allowableShear",
    "shaft.stress": "drumShaft.allowableCombined",
  },
  "2.2.4": { "drumWeld.stress": "drumWeld.combinedStress" },
  "2.2.5": { "shaftWeld.stress": "shaftWeld.shearStress" },
  "2.2.6": {
    "bearing.static": "drumBearing.staticSafety",
    "bearing.life": "drumBearing.requiredLifeMin",
  },
  "2.3": {
    "gearbox.torque": "gearbox.requiredTorque",
    "gearbox.ratio": "gearbox.ratioDeviation",
    "gearbox.radial": "gearbox.radialLoad",
  },
  "2.4": { "motor.power": "motor.installedPower" },
  "2.5": { "brake.torque": "brake.requiredTorque" },
  "2.6": {
    "motorCoupling.torque": "motorCoupling.requiredTorque",
    "motorCoupling.bore": "motorCoupling.shaftDia",
  },
  "2.7": {
    "drumCoupling.torque": "drumCoupling.requiredTorque",
    "drumCoupling.radial": "drumCoupling.requiredRadial",
    "drumCoupling.bore": "drumCoupling.shaftDia",
  },
  "2.8": {
    "safety.torque": "safety.totalTorque",
    "safety.flange": "safety.minFlangeDia",
    "safety.airGap": "safety.clampForce",
  },
};

/** 04 — Kanca Bloğu */
const HOOKBLOCK_ANCHORS: AnchorMap = {
  "4.1": { "hook.capacity": "hook.capacity" },
  "4.2": { "sheave.dia": "sheave.minDia" },
  "4.3": {
    "sheaveBearing.static": "sheaveBearing.equivalentStatic",
    "sheaveBearing.life": "sheaveBearing.requiredLifeMin",
    "sheaveBearing.bore": "sheaveBearing.bore",
  },
  "4.4": {
    "shaft.bending": "shaft.allowableBending",
    "shaft.shear": "shaft.allowableShear",
    "shaft.stress": "shaft.allowableCombined",
  },
  "4.5": { "hookBearing.static": "hookBearing.staticSafety" },
  "4.6": {
    "girder.static": "girder.allowableStress",
    "fatigue.sigma": "fatigue.allowableSigma",
    "fatigue.tau": "fatigue.allowableTau",
    "fatigue.combined": "fatigue.combined",
  },
};

/** 05 / 06 — Araba ve Köprü Yürütme */
const TRAVEL_ANCHORS: AnchorMap = {
  "5.1": { "wheel.pressure": "wheel.allowablePressure" },
  "5.2": { "shaft.stress": "shaft.allowableCombined" },
  "5.3": {
    "bearing.static": "bearing.staticSafety",
    "bearing.life": "bearing.requiredLifeMin",
  },
  "5.4": { "motor.power": "motor.installedPower" },
  "5.5": {
    "gearbox.ratio": "gearbox.ratioDeviation",
    "gearbox.safety": "gearbox.actualSafety",
  },
  "5.5b": { "brake.torque": "brake.requiredTorque" },
  "5.6": {
    "motorCoupling.torque": "motorCoupling.requiredTorque",
    "motorCoupling.bore": "motorCoupling.shaftDia",
  },
  "5.7": {
    "wheelCoupling.torque": "wheelCoupling.requiredTorque",
    // Teker mili çapı ayrı bir hesap satırı değil (seçimin yankısıydı);
    // delik çapı kontrolü aynı bölümün gerekli tork satırına bağlanır.
    "wheelCoupling.bore": "wheelCoupling.requiredTorque",
  },
  "5.8": {
    "buffer.energy": "buffer.totalEnergy",
    "buffer.load": "buffer.reactionForce",
  },
};

/** 10 — Teker Yükleri */
const WHEELLOAD_ANCHORS: AnchorMap = {
  "10.3": {
    "skew.angle": "skew.angle",
    "skew.balance": "skew.guideForceBalance",
  },
  "10.4": { "longitudinal.transferable": "longitudinal.inertiaForce" },
};

/** 07 — Ana Kiriş */
const GIRDER_ANCHORS: AnchorMap = {
  "7.4": {
    "stress.case1": "stress.amplifiedCombinedBottom",
    "stress.case3": "stress.combinedCase3",
  },
  "7.5": {
    "fatigue.sigmaX": "fatigue.allowableSigmaX",
    "fatigue.sigmaY": "fatigue.allowableSigmaY",
    "fatigue.tau": "fatigue.allowableTau",
    "fatigue.combined": "fatigue.combined",
  },
  "7.6": { deflection: "deflection.ratio" },
  // 7.7 Ters Sehim (Kamber) yalnız imalat verisi taşır — kontrolü yoktur.
};

/** 08 — Buruşma */
const BUCKLING_ANCHORS: AnchorMap = {
  "8.1": {
    "side.interaction": "sidePanel.allowable",
    "side.corrected": "sidePanel.correctedCritical",
  },
  "8.2": { "top.interaction": "topPanel.allowable" },
};

/** 09 — Başkiriş */
const ENDCARRIAGE_ANCHORS: AnchorMap = {
  "9.3": { stress: "stress.allowable" },
  "9.4": {
    "fatigue.sigma": "fatigue.allowableSigmaKgCm2",
    "fatigue.tau": "fatigue.allowableTauKgCm2",
    "fatigue.combined": "fatigue.combined",
  },
};

const ANCHORS_BY_FAMILY: Record<string, AnchorMap> = {
  hoist: HOIST_ANCHORS,
  hookBlock: HOOKBLOCK_ANCHORS,
  travel: TRAVEL_ANCHORS,
  wheelLoads: WHEELLOAD_ANCHORS,
  girder: GIRDER_ANCHORS,
  buckling: BUCKLING_ANCHORS,
  endCarriage: ENDCARRIAGE_ANCHORS,
};

/**
 * Bir kontrolün bağlanacağı satırın semantik anahtarı.
 * @param moduleKey  modül anahtarı (main/aux/trolley/…)
 * @param sectionId  bölümün ham id'si ("2.1", "5.5b", …)
 * @param checkSuffix  kontrol id'sinin modül önekinden sonraki kısmı
 */
export function checkAnchor(
  moduleKey: ModuleKey,
  sectionId: string,
  checkSuffix: string
): string | undefined {
  return ANCHORS_BY_FAMILY[moduleFamily(moduleKey)]?.[sectionId]?.[checkSuffix];
}

/** Haritadaki tüm bağlantılar — koruma testi ölü bağlantı avında kullanır. */
export function anchorEntries(): {
  family: string;
  sectionId: string;
  checkSuffix: string;
  anchorId: string;
}[] {
  const out: {
    family: string;
    sectionId: string;
    checkSuffix: string;
    anchorId: string;
  }[] = [];
  for (const [family, map] of Object.entries(ANCHORS_BY_FAMILY)) {
    for (const [sectionId, byCheck] of Object.entries(map)) {
      for (const [checkSuffix, anchorId] of Object.entries(byCheck)) {
        out.push({ family, sectionId, checkSuffix, anchorId });
      }
    }
  }
  return out;
}

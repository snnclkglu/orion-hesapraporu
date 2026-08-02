// Yürütme grubu (araba + köprü) tarihsel doğrulama eşlemesi.
//
// Bu dosya TEST katmanına aittir; üretim kodu buradan hiçbir şey içe aktarmaz.
// Motorun yöntemi FEM 1.001 / CMAA 70'e dayanır; buradaki eşleme yalnızca ilk
// portun sayısal birikimini regresyon ağı olarak kullanılabilir tutar.
// Kural için bu klasördeki README.md'ye bakın.
//
// Araba ve köprü mekanizmaları motorda AYNI semantik anahtarları kullanır;
// yalnızca eski dökümdeki adresler farklıdır. Bu yüzden iki ayrı harita vardır
// ve ikisi de aynı anahtar kümesine gider.

import type { AliasMap } from "./excel-alias";

/** Araba yürütme dökümü → motorun semantik anahtarları */
export const TROLLEY_ALIASES: AliasMap = {
  // --- Tekerlekler
  L11: "wheel.maxLoad",
  L12: "wheel.minLoad",
  L13: "wheel.meanLoad",
  L80: "wheel.meanLoad",          // gösterim tekrarı
  L15: "rail.headWidth",
  L19: "wheel.rpm",
  L100: "wheel.rpm",              // gösterim tekrarı
  L20: "wheel.speedFactor",
  L21: "wheel.mechanismFactor",
  L22: "wheel.limitPressure",
  L23: "wheel.contactPressure",
  O24: "wheel.contactPressure",   // gösterim tekrarı
  L24: "wheel.allowablePressure",

  // --- Teker mili
  L46: "shaft.reactionA",
  L47: "shaft.reactionB",
  L51: "shaft.maxMoment",
  L56: "shaft.sectionModulus",
  L61: "shaft.bendingStress",
  L65: "shaft.shearStress",
  L69: "shaft.combinedStress",
  L73: "shaft.allowableBending",
  L74: "shaft.allowableShear",
  L75: "shaft.allowableCombined",

  // --- Tekerlek rulmanı
  L82: "bearing.radialLoad",
  L83: "bearing.axialLoad",
  L89: "bearing.equivalentStatic",
  L90: "bearing.equivalentDynamic",
  L98: "bearing.staticSafety",
  L101: "bearing.lifeHours",
  L103: "bearing.requiredLifeMin",
  Q103: "bearing.requiredLifeMax",

  // --- Yürütme motoru
  L107: "weight.moving",
  L108: "weight.design",
  L109: "drive.actualSpeed",
  L141: "drive.actualSpeed",      // gösterim tekrarı
  L187: "drive.actualSpeed",      // gösterim tekrarı
  L110: "drive.startupTime",
  L114: "drive.frictionFactor",
  L115: "drive.reducerEfficiency",
  L117: "drive.accelerationFps2",
  L118: "drive.inertiaFactor",
  L119: "drive.accelFactor",
  L120: "motor.requiredPower",
  L143: "motor.requiredPower",    // gösterim tekrarı
  L122: "motor.requiredMaxPower",
  L133: "motor.requiredMaxPower", // gösterim tekrarı
  L124: "motor.maxPowerPerMotor",
  I133: "motor.installedPower",

  // --- Dişli kutusu
  L138: "gearbox.requiredRatio",
  L140: "gearbox.ratioDeviation",
  L145: "motor.powerPerMotor",
  L148: "gearbox.requiredInputTorque",
  L162: "gearbox.requiredInputTorque", // gösterim tekrarı
  L150: "gearbox.nominalOutputTorque",
  L174: "gearbox.nominalOutputTorque", // gösterim tekrarı
  L152: "gearbox.requiredOutputTorque",
  L157: "gearbox.actualSafety",

  // --- Kaplinler
  L164: "motorCoupling.requiredTorque",
  O169: "motorCoupling.requiredTorque", // gösterim tekrarı
  O170: "motorCoupling.shaftDia",
  L171: "motorCoupling.actualSafety",
  L176: "wheelCoupling.requiredTorque",
  O181: "wheelCoupling.requiredTorque", // gösterim tekrarı
  L183: "wheelCoupling.actualSafety",

  // --- Tampon
  L189: "buffer.collisionLoad",
  L191: "buffer.impactEnergy",
  L194: "buffer.drivePower",
  L197: "buffer.driveForcePerMotor",
  L200: "buffer.totalDriveForce",
  L202: "buffer.driveForcePerBuffer",
  L205: "buffer.driveEnergy",
  L207: "buffer.totalEnergy",
  L211: "buffer.reactionForce",
};

/** Köprü yürütme dökümü → motorun semantik anahtarları (aynı anahtar kümesi) */
export const BRIDGE_ALIASES: AliasMap = {
  // --- Ağırlıklar
  L8: "weight.crane",
  L200: "weight.bridgeTotal",

  // --- Tekerlekler
  L15: "wheel.maxLoad",
  L16: "wheel.minLoad",
  L17: "wheel.meanLoad",
  L84: "wheel.meanLoad",          // gösterim tekrarı
  L19: "rail.headWidth",
  L23: "wheel.rpm",
  L105: "wheel.rpm",              // gösterim tekrarı
  L24: "wheel.speedFactor",
  L25: "wheel.mechanismFactor",
  L26: "wheel.limitPressure",
  L27: "wheel.contactPressure",
  O28: "wheel.contactPressure",   // gösterim tekrarı
  L28: "wheel.allowablePressure",

  // --- Teker mili
  L50: "shaft.reactionA",
  L51: "shaft.reactionB",
  L55: "shaft.maxMoment",
  L60: "shaft.sectionModulus",
  L65: "shaft.bendingStress",
  L69: "shaft.shearStress",
  L73: "shaft.combinedStress",
  L77: "shaft.allowableBending",
  L78: "shaft.allowableShear",
  L79: "shaft.allowableCombined",

  // --- Tekerlek rulmanı
  L86: "bearing.radialLoad",
  L87: "bearing.axialLoad",
  L93: "bearing.equivalentStatic",
  L94: "bearing.equivalentDynamic",
  L102: "bearing.staticSafety",
  L107: "bearing.lifeHours",
  L109: "bearing.requiredLifeMin",
  Q109: "bearing.requiredLifeMax",

  // --- Yürütme motoru
  L113: "weight.moving",
  L114: "weight.design",
  L115: "drive.actualSpeed",
  L148: "drive.actualSpeed",      // gösterim tekrarı
  L202: "drive.actualSpeed",      // gösterim tekrarı
  L117: "drive.startupTime",
  L121: "drive.frictionFactor",
  L122: "drive.reducerEfficiency",
  L124: "drive.accelerationFps2",
  L125: "drive.inertiaFactor",
  L126: "drive.accelFactor",
  L127: "motor.requiredPower",
  L149: "motor.requiredPower",    // gösterim tekrarı
  L129: "motor.requiredMaxPower",
  L140: "motor.requiredMaxPower", // gösterim tekrarı
  L131: "motor.maxPowerPerMotor",
  I140: "motor.installedPower",

  // --- Dişli kutusu
  L145: "gearbox.requiredRatio",
  L147: "gearbox.ratioDeviation",
  L151: "motor.powerPerMotor",
  L153: "gearbox.requiredInputTorque",
  L167: "gearbox.requiredInputTorque", // gösterim tekrarı
  L176: "gearbox.requiredInputTorque", // gösterim tekrarı
  L154: "gearbox.nominalOutputTorque",
  L188: "gearbox.nominalOutputTorque", // gösterim tekrarı
  L156: "gearbox.requiredOutputTorque",
  L161: "gearbox.actualSafety",

  // --- Yürütme freni
  L169: "brake.requiredTorque",
  O172: "brake.requiredTorque",   // gösterim tekrarı

  // --- Kaplinler
  L178: "motorCoupling.requiredTorque",
  O183: "motorCoupling.requiredTorque", // gösterim tekrarı
  L180: "motorCoupling.shaftDia",
  O184: "motorCoupling.shaftDia",       // gösterim tekrarı
  L190: "wheelCoupling.requiredTorque",
  O195: "wheelCoupling.requiredTorque", // gösterim tekrarı

  // --- Tampon
  L205: "buffer.collisionLoad",
  L207: "buffer.impactEnergy",
  L210: "buffer.drivePower",
  L213: "buffer.driveForcePerMotor",
  L216: "buffer.totalDriveForce",
  L218: "buffer.driveForcePerBuffer",
  L221: "buffer.driveEnergy",
  L223: "buffer.totalEnergy",
  L227: "buffer.reactionForce",
};

/**
 * Eski dökümdeki tik/çarpı hücreleri → motorun kontrol kimliği.
 * Motorda tik hücresi YOKTUR; karşılaştırma `tickFromCheck` ile yapılır.
 */
export const TROLLEY_TICKS: Record<string, string> = {
  Q24: "trolley.wheel.pressure",
  Q133: "trolley.motor.power",
  O140: "trolley.gearbox.ratio",
  O157: "trolley.gearbox.safety",
  R169: "trolley.motorCoupling.torque",
  R170: "trolley.motorCoupling.bore",
  R181: "trolley.wheelCoupling.torque",
  R182: "trolley.wheelCoupling.bore",
  N215: "trolley.buffer.energy",
  N216: "trolley.buffer.load",
};

export const BRIDGE_TICKS: Record<string, string> = {
  Q28: "bridge.wheel.pressure",
  Q140: "bridge.motor.power",
  O147: "bridge.gearbox.ratio",
  R172: "bridge.brake.torque",
  R183: "bridge.motorCoupling.torque",
  R184: "bridge.motorCoupling.bore",
  R195: "bridge.wheelCoupling.torque",
  R196: "bridge.wheelCoupling.bore",
  N231: "bridge.buffer.energy",
  N232: "bridge.buffer.load",
};

/**
 * Motorda karşılığı BİLİNÇLİ olarak bulunmayan hücreler ve çıkarılma nedenleri.
 *
 * Büyük çoğunluğu girdinin/seçimin aynen yankılandığı hücrelerdir: bu değerler
 * motorda zaten girdi (`inp`) veya seçim (`sel`) olarak vardır, hesaplanan
 * büyüklük değildir ve bu yüzden semantik anahtar almazlar.
 */
export const TROLLEY_KAPSAM_DISI: Record<string, string> = {
  L4: "Kaldırma kapasitesi — teknik özellikler girdisinin yankısı.",
  L6: "Kanca donanımı ağırlığı — kaldırma grubundan gelen bağımlılığın yankısı.",
  L139: "Seçilen redüktör çevrim oranının yankısı (katalog seçimi).",
  L144: "Seçilen motor adedinin yankısı (katalog seçimi).",
  L146: "Seçilen motor devrinin yankısı (katalog seçimi).",
  O182: "Seçilen teker mili çapının yankısı (katalog seçimi).",
  L186: "Araba ağırlığı girdisinin yankısı.",
  L195: "Seçilen motor devrinin yankısı (tampon bölümünde tekrar).",
  L196: "Seçilen çevrim oranının yankısı (tampon bölümünde tekrar).",
  L199: "Seçilen motor adedinin yankısı (tampon bölümünde tekrar).",
  L204: "Seçilen tampon stroğunun yankısı.",
  L209: "Seçilen tampon stroğunun yankısı (tekrar).",
};

export const BRIDGE_KAPSAM_DISI: Record<string, string> = {
  L4: "Kaldırma kapasitesi — teknik özellikler girdisinin yankısı.",
  L5: "Araba ağırlığı — araba modülünden gelen bağımlılığın yankısı.",
  L10: "Açıklık — teknik özellikler girdisinin yankısı.",
  L146: "Seçilen redüktör çevrim oranının yankısı (katalog seçimi).",
  L150: "Seçilen motor adedinin yankısı (katalog seçimi).",
  L152: "Seçilen motor devrinin yankısı (katalog seçimi).",
  O160: "Kaynak hücre bozuktu: boş bir hücreye başvurduğu için koşul her zaman sağlanıyordu. Motorda redüktör emniyeti `bridge.gearbox.safety` kontrolüyle doğru şekilde yapılır.",
  O196: "Seçilen teker mili çapının yankısı (katalog seçimi).",
  L201: "Araba ağırlığının yankısı (tampon bölümünde tekrar).",
  L211: "Seçilen motor devrinin yankısı (tampon bölümünde tekrar).",
  L212: "Seçilen çevrim oranının yankısı (tampon bölümünde tekrar).",
  L215: "Seçilen motor adedinin yankısı (tampon bölümünde tekrar).",
  L220: "Seçilen tampon stroğunun yankısı.",
  L225: "Seçilen tampon stroğunun yankısı (tekrar).",
};

/**
 * Bilinçli SAYISAL sapmalar: eski değerden ayrılan hücreler ve gerekçeleri.
 * Bu hücreler karşılaştırmadan çıkarılır.
 *
 * Yürütme grubunda 1e-4 göreli tolerans içinde kalmayan bilinçli bir sapma
 * YOKTUR. Yöntem iyileştirmeleri (π'nin tam hassasiyetle kullanılması, kiriş
 * statiğinin ortak çözücüye taşınması, sürtünme katsayısı tablosunun kademe
 * sınırlarıyla yazılması) hiçbir V5 değerini tolerans dışına taşımaz; bu
 * yüzden hepsi karşılaştırma kapsamında kalır.
 */
export const TROLLEY_SAPMA: Record<string, string> = {};
export const BRIDGE_SAPMA: Record<string, string> = {};

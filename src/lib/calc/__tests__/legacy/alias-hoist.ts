// Kaldırma grubu (ana + yardımcı) — tarihsel doğrulama eşlemesi.
//
// Bu dosya TEST katmanına aittir; üretim kodu buradan hiçbir şey içe aktarmaz.
// Motorun hesap yöntemi standartlara dayanır (FEM 1.001 / DIN 15061 / CMAA 70);
// buradaki eşleme yalnızca ilk portun sayısal birikimini regresyon ağı olarak
// kullanılabilir tutar. Kural için bu klasördeki README.md'ye bakın.
//
// Eşleme yönü tek yönlüdür: eski döküm hücresi → motorun semantik anahtarı.

import type { AliasMap } from "./excel-alias";

/**
 * Eski döküm hücresi → motorun semantik anahtarı.
 *
 * Birden çok hücre aynı anahtara bakabilir: eski tabloda bir büyüklük
 * gösterim amacıyla birkaç kez tekrarlanıyordu (ör. `L18` ve `O30` aynı
 * gerekli emniyet katsayısıdır). Motorda büyüklük TEK anahtarla yaşar;
 * tekrarlar burada aynı anahtara bağlanır ve karşılaştırma kapsamında kalır.
 */
export const HOIST_ALIASES: AliasMap = {
  // --- 2.1 Halat ve donanım
  L9: "reeving.mechanicalAdvantage",
  L11: "reeving.ropeEfficiency",
  L13: "load.hoisted",
  L16: "load.total",
  L18: "rope.requiredSafety",
  O30: "rope.requiredSafety",
  L19: "rope.load",
  L67: "rope.load",
  L20: "rope.requiredBreakingLoad",
  L28: "rope.breakingLoad",
  L30: "rope.actualSafety",

  // --- 2.2.1 Tambur çapı ve gövde gerilmeleri
  L36: "drum.coefficient",
  L38: "drum.minDia",
  L41: "drum.groovePitch",
  L56: "drum.groovePitch",
  L44: "drum.bearingStress",
  L46: "drum.bendingStress",
  L48: "drum.combinedStress",
  O50: "drum.combinedStress",
  L50: "drum.allowableStress",

  // --- 2.2.2 Oluk boyu
  L60: "drum.requiredGrooves",
  L62: "drum.requiredGrooveLength",

  // --- 2.2.3 Tambur mili
  L80: "drumShaft.reactionGearbox",
  L81: "drumShaft.reactionBearing",
  L84: "drumShaft.moment",
  L86: "drumShaft.bendingStress",
  L92: "drumShaft.allowableBending",
  L93: "drumShaft.allowableShear",
  L94: "drumShaft.allowableCombined",

  // --- 2.2.4 Tambur kaynağı
  L98: "drumWeld.length",
  L100: "drumWeld.throatArea",
  // L103 / L105 / L106 / L107 / L108 / L109 eşlenmez — HOIST_SAPMA'da
  // gerekçelendirildi (taşıyıcı kesit BOĞAZ alanıdır; izdüşüm halka alanı ve
  // ona dayanan büyüklükler motorda artık yoktur).

  // --- 2.2.5 Mil kaynağı
  L114: "shaftWeld.length",
  L116: "shaftWeld.throatArea",
  // L119 / L121 / L122 / L124 / L125 eşlenmez — HOIST_SAPMA (aynı gerekçe).

  // --- 2.2.6 Tambur rulmanı
  L130: "drumBearing.radialLoad",
  L131: "drumBearing.axialLoad",
  L137: "drumBearing.equivalentStatic",
  L138: "drumBearing.equivalentDynamic",
  L146: "drumBearing.staticSafety",
  L149: "drum.rpm",
  L150: "drum.rpm",
  L170: "drum.rpm",
  L152: "drumBearing.lifeHours",
  L154: "drumBearing.requiredLifeMin",
  Q154: "drumBearing.requiredLifeMax",

  // --- 2.3 Redüktör
  L158: "drum.radius",
  L160: "rope.loadKn",
  L162: "drum.torque",
  L164: "drum.torquePerDrum",
  L167: "gearbox.requiredTorque",
  L172: "gearbox.requiredRatio",
  L179: "gearbox.actualSafety",
  L182: "gearbox.ratioDeviation",
  L185: "gearbox.actualLiftSpeed",
  L187: "gearbox.radialLoad",

  // --- 2.4 Motor
  L192: "gearbox.outputTorque",
  L197: "gearbox.efficiency",
  L199: "motor.inputTorque",
  L202: "motor.requiredPower",
  L204: "motor.adjustedPower",
  L215: "motor.adjustedPower",
  L206: "motor.powerPerMotor",
  L212: "motor.installedPower",
  I215: "motor.installedPower",

  // --- 2.5 Fren
  L218: "motor.shaftTorque",
  L233: "motor.shaftTorque",
  L220: "brake.requiredTorque",
  O224: "brake.requiredTorque",
  L228: "brake.actualSafety",
  Q228: "brake.combinedSafety",

  // --- 2.6 Motor – redüktör kaplini
  L235: "motorCoupling.requiredTorque",
  O240: "motorCoupling.requiredTorque",
  L236: "motorCoupling.shaftDia",
  L243: "motorCoupling.actualSafety",

  // --- 2.7 Tambur kaplini
  L249: "drumCoupling.designTorque",
  L251: "drumCoupling.requiredTorque",
  O258: "drumCoupling.requiredTorque",
  L252: "drumCoupling.requiredRadial",
  O259: "drumCoupling.requiredRadial",
  L254: "drumCoupling.shaftDia",
  O260: "drumCoupling.shaftDia",
  L262: "drumCoupling.actualSafety",
};

/**
 * Eski tablodaki tik/çarpı hücreleri → motordaki kontrolün soneki.
 *
 * Motorda tik hücresi YOKTUR; kontrol sonucu `Check.pass` alanından türetilir.
 * Karşılaştırma `tickFromCheck` yardımcısıyla yapılır.
 */
export const HOIST_TICK_CHECKS: Record<string, string> = {
  R30: "rope.safety",
  S50: "drum.stress",
  O176: "gearbox.torque",
  O182: "gearbox.ratio",
  Q215: "motor.power",
  R224: "brake.torque",
  R258: "drumCoupling.torque",
  R259: "drumCoupling.radial",
  R260: "drumCoupling.bore",
};

/**
 * Motorda karşılığı BİLİNÇLİ olarak bulunmayan hücreler ve çıkarılma gerekçesi.
 *
 * Bunlar hesaplanmış büyüklük değil, eski tablonun gösterim alışkanlıklarıdır:
 * girdinin aynen yankılandığı hücreler ve birim dönüşümü ikizleri. Motor bu
 * değerleri girdi/seçim nesnelerinden okuduğu için ayrıca üretmez.
 */
export const HOIST_KAPSAM_DISI: Record<string, string> = {
  L37: "Halat çapı girdisinin yankısı — motor değeri seçim nesnesinden okur.",
  L54: "Tahrikli halat kolu sayısı girdisinin yankısı; donanım nesnesinde yaşar.",
  L55: "Toplam halat kolu sayısı girdisinin yankısı; donanım nesnesinde yaşar.",
  L57: "Kaldırma yüksekliği teknik özellik girdisinin yankısı.",
  L104: "Tambur çapı seçiminin yankısı (kaynak iç çapı olarak tekrar basılmış).",
  L120: "Mil D1 çapının mm cinsinden yankısı — yalnız birim dönüşümü.",
  L159: "Tahrikli halat kolu sayısı girdisinin yankısı.",
  L169: "Motor devri seçiminin yankısı.",
  L184: "Beyan edilen kaldırma hızı teknik özellik girdisinin yankısı.",
  L193: "Redüktör çevrim oranı seçiminin yankısı.",
  L200: "Motor devri seçiminin yankısı.",
  O241: "Motor mili çapı seçiminin yankısı.",
  L247: "Tambur torkunun Nm cinsinden ikizi — yalnız birim dönüşümü; " +
    "tasarım torku `drumCoupling.designTorque` anahtarında yaşar.",
};

/**
 * Motorun eski tablodan BİLİNÇLİ olarak saptığı hücreler.
 *
 * Bu hücreler karşılaştırmadan çıkarılır; sapma mühendislik gerekçesiyle
 * belgelenmiştir. Değer farkı bir hata değil, yöntem iyileştirmesidir.
 */
export const HOIST_SAPMA: Record<string, string> = {
  L87:
    "Mil kesme gerilmesi. Eski tablo dolu dairesel kesitin tepe kayma oranını " +
    "1,33 diye yuvarlıyordu; motor kesin oranı 4/3 kullanır " +
    "(shaftStress.ts, CIRCULAR_PEAK_SHEAR_FACTOR). Sonuç yaklaşık %0,25 artar " +
    "— emniyetli yöndedir. Ana kaldırma: 281,11 → 281,81 kg/cm²; " +
    "yardımcı kaldırma: 115,82 → 116,11 kg/cm².",
  L88:
    "Mil bileşik gerilmesi √(σ² + τ²). Kesme gerilmesindeki 1,33 → 4/3 " +
    "düzeltmesinin doğrudan sonucudur. Ana kaldırma: 1207,39 → 1207,55 kg/cm²; " +
    "yardımcı kaldırma: 497,45 → 497,52 kg/cm².",
  L106:
    "Tambur kaynağının burulma direnç momenti Wp. Eski tablo π(D⁴−d⁴)/32 " +
    "yazıyordu; bu bağıntı polar ATALET MOMENTİ Ip'dir (cm⁴) ve mukavemet " +
    "momenti (cm³) yerine kullanılamaz — boyut hatasıdır. Doğrusu " +
    "Wp = Ip / (D_dış/2) = π(D⁴−d⁴)/(16·D_dış). Eski değer tam olarak " +
    "D_dış/2 katı büyüktü. Ana kaldırma: 84.312,52 → 3.921,52 cm³ " +
    "(D_dış = 430 mm, oran 21,5); yardımcı kaldırma: 33.506,53 → 2.094,16 cm³ " +
    "(D_dış = 320 mm, oran 16,0).",
  L107:
    "Tambur kaynağı burulma gerilmesi. L106'daki Wp boyut hatasının doğrudan " +
    "sonucudur: gerilme aynı oranda ARTAR, yani eski tablo kaynağı olduğundan " +
    "emniyetli gösteriyordu. Ana kaldırma: 1,78 → 38,25 kg/cm²; " +
    "yardımcı kaldırma: 1,13 → 18,14 kg/cm². Düzeltme EMNİYETLİ yöndedir.",
  L109:
    "Tambur kaynağı bileşik gerilmesi. Burulma bileşenindeki L107 " +
    "düzeltmesinin doğrudan sonucudur (kesme bileşeni L108 değişmedi). " +
    "Ana kaldırma: 23,00 → 59,47 kg/cm²; yardımcı kaldırma: " +
    "13,03 → 30,03 kg/cm². Yeni değer izin verilen gerilmenin (FEM 1.001 " +
    "T.3.2.2.3 ile CMAA 70 md. 3.4.1'in küçüğü) hâlâ çok altındadır.",
  L122:
    "Mil kaynağının burulma direnç momenti — L106 ile AYNI boyut hatası. " +
    "274,89 → 68,72 cm³ (D_dış = 80 mm, oran 4,0). Her iki kaldırma " +
    "grubunda da aynı, çünkü mil kaynağı çapı ikisinde de eşittir.",
};

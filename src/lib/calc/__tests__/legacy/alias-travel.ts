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
  // L51 / L61 / L69 eşlenmez — TROLLEY_SAPMA'da gerekçelendirildi
  // (teker yükünün bandaj genişliği boyunca YAYILI çözülmesi).
  L56: "shaft.sectionModulus",
  L65: "shaft.shearStress",
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
  // L189 / L191 / L197 / L200 / L202 / L205 / L207 / L211 eşlenmez —
  // TROLLEY_SAPMA'da gerekçelendirildi (tampon başına kütle + birim düzeltmesi).
  L194: "buffer.drivePower",
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
  // L55 / L65 / L73 eşlenmez — BRIDGE_SAPMA'da gerekçelendirildi
  // (teker yükünün bandaj genişliği boyunca YAYILI çözülmesi).
  L60: "shaft.sectionModulus",
  L69: "shaft.shearStress",
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
  // L213 / L216 / L218 / L221 / L223 / L227 eşlenmez — BRIDGE_SAPMA'da
  // gerekçelendirildi (tahrik kuvveti birim düzeltmesi + sönümleme verimi).
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
 * Yürütme grubundaki TEK sapma kaynağı teker mili kirişinin yükleme modelidir:
 * eski tablo teker yükünü mile TEKİL kuvvet olarak veriyordu, uygulama ise
 * yükü tekerin bandaj genişliği boyunca YAYILI çözer (bkz. travelGroup.ts).
 * Diğer yöntem iyileştirmeleri (π'nin tam hassasiyetle kullanılması, kiriş
 * statiğinin ortak çözücüye taşınması, sürtünme katsayısı tablosunun kademe
 * sınırlarıyla yazılması) hiçbir V5 değerini tolerans dışına taşımaz.
 */

/**
 * Yayılı yük sapmasının ortak gerekçesi.
 *
 * Teker göbeği mile bir ÇİZGİ üzerinden basmaz; yük bandaj genişliği kadar bir
 * BANT boyunca aktarılır. Bant açıklığın ortasında merkezlendiğinde mesnet
 * tepkileri (Pmaks/2) ve maksimum kesme kuvveti AYNI kalır, yalnız açıklık
 * ortasındaki moment q·b_t²/8 = Pmaks·b_t/8 kadar KÜÇÜLÜR — moment
 * diyagramının sivri tepesi düzleşir. Sapmanın yönü bu yüzden her zaman
 * AZALTICIDIR ve fizik olarak doğrudur; eski tablo mili gereğinden kalın
 * boyutlandırıyordu. Teker genişliği girilmemiş (eski) revizyonlarda tekil yük
 * modeline geri dönülür ve o revizyonların sayıları değişmez.
 */
const WHEEL_WIDTH_SAPMA =
  "Teker yükü artık bandaj genişliği boyunca YAYILI çözülüyor (tekil kuvvet " +
  "yerine q = Pmaks / b_teker, bant açıklığın ortasında). Mesnet tepkileri ve " +
  "kesme kuvveti değişmez; açıklık ortasındaki moment Pmaks·b_teker/8 kadar " +
  "AZALIR.";

/**
 * Tampon hesabının üç sapma kaynağı (hepsi `calc/buffer.ts`te uygulanır).
 *
 * 1) TAHRİK KUVVETİ BİRİM HATASI. Eski tablo 9550·P/n·i ile MOTORUN ÇIKIŞ
 *    MOMENTİNİ (Nm) hesaplayıp onu doğrudan KUVVET (N) yerine kullanıyordu;
 *    yani teker yarıçapını örtük olarak 1 m alıyordu. Doğrusu F₀ = P[W] / v[m/s]
 *    (= T_çıkış / r_teker). Düzeltmenin çarpanı 1/r'dir: araba tekeri Ø250 mm →
 *    ×8,00; köprü tekeri Ø315 mm → ×6,349.
 * 2) SÖNÜMLEME VERİMİ 0,80 → 0,85. SIBRE SP kataloğu (M 1501 486 E-EN-2021-11,
 *    s. 18) son kuvvetlerini η = 0,85 ile basar ve bunu açıkça yazar; eski
 *    tablonun 0,80'i kaynaksızdı. Aynı enerjide kuvveti %5,9 DÜŞÜRÜR.
 * 3) TAMPON BAŞINA KÜTLE. Çarpışan kütle aynı anda temas eden tamponlara
 *    paylaşılır. Köprüde eski tablo bunu zaten yapıyordu (G_köprü/2 + araba
 *    payı = bir tampona gelen kütle); ARABADA yapmıyor, arabanın TAMAMINI tek
 *    tampona yüklüyordu. Araba iki kirişin ucundaki iki durdurucuya aynı anda
 *    çarptığı için doğrusu m/2'dir.
 */
const BRIDGE_MOVING_W_SAPMA =
  "Köprü yürütmesinde W artık köprü ağırlığına her aktif arabanın kapasite + " +
  "kanca/halat donanımı + araba ağırlığını ekler. Eski tablo kanca/halat " +
  "donanımını dışarıda bırakıyordu; motor zincirindeki tüm türemiş değerler " +
  "bu nedenle bilinçli olarak farklıdır. (Ağırlığın KISA TONA çevrilmesi " +
  "eski tabloyla AYNIDIR — ×1,1 çarpanı geri alınmış bir sapma değildir.)";

export const TROLLEY_SAPMA: Record<string, string> = {
  L189:
    "Tampon başına çarpışan kütle. Araba iki kirişin ucundaki İKİ durdurucuya " +
    "aynı anda çarpar; kütle iki tampona paylaşılır (FEM 1.001 md. 2.2.3.4.1, " +
    "tampon adedi girdisi n = 2). Eski tablo arabanın tamamını tek tampona " +
    "yüklüyordu: 2,50 → 1,25 t (−50,0 %).",
  L191:
    "Çarpma enerjisi E = ½·m_t·v_ç². Yalnız kütle yarıya indiği için enerji de " +
    "yarıya iner: 0,5578 → 0,2789 kJ (−50,0 %). Çarpma hızı oranı k = 1,00 " +
    "(araba) DEĞİŞMEDİ.",
  L197:
    "Motor başına tahrik kuvveti — BİRİM DÜZELTMESİ (yukarıdaki 1. madde). " +
    "Ø250 mm teker, r = 0,125 m: 261,80 N → 2.094,26 N (×8,00).",
  L200:
    "Toplam tahrik kuvveti — L197'nin motor adediyle çarpımı; aynı ×8,00 " +
    "birim düzeltmesi: 261,80 → 2.094,26 N.",
  L202:
    "Tampon başına tahrik kuvveti (toplam / 2): 130,90 → 1.047,13 N (×8,00).",
  L205:
    "Tahrik enerjisi E_pot = F₀·f′. Kuvvetle doğru orantılı: " +
    "0,01309 → 0,10471 kJ (×8,00).",
  L207:
    "Toplam sönümlenmesi gereken enerji E_a = E_kin + E_pot. İki karşıt etki " +
    "birleşir: kinetik enerji yarıya iner (−0,2789), tahrik enerjisi sekize " +
    "katlanır (+0,0916). Net: 0,5709 → 0,3836 kJ (−32,8 %).",
  L211:
    "Tampon tepki kuvveti F_t = E_a/(s·η) + F₀. Üç etkinin bileşkesi: kütle " +
    "yarılanması ve η = 0,85 düşürücü, birim düzeltmesi artırıcıdır. " +
    "7,268 → 5,560 kN (−23,5 %).",
  L51:
    `Teker mili maksimum eğilme momenti. ${WHEEL_WIDTH_SAPMA} ` +
    "Araba tekeri b = 90 mm: 9.062,5 → 6.250 kg·cm (−31,0 %).",
  L61:
    "Teker mili eğilme gerilmesi — L51'deki moment düşüşünün doğrudan " +
    "sonucudur (kesit modülü ve gerilme yığılması katsayısı değişmedi). " +
    "69,35 → 47,83 kg/cm² (−31,0 %).",
  L69:
    "Teker mili bileşik gerilmesi √(σ² + 3τ²). Yalnız eğilme bileşeni " +
    "küçüldü; kesme gerilmesi (L65) aynı kaldığı için düşüş daha ılımlıdır: " +
    "73,00 → 52,98 kg/cm² (−27,4 %). Sapma EMNİYETLİ tarafta değil, " +
    "GERÇEKÇİ taraftadır — eski değer aşırı ihtiyatlıydı.",
  // NOT: Araba yürütme motoru zinciri (L108 W, L120 gerekli güç ve ondan
  // türeyen redüktör/kaplin momentleri) artık SAPMA DEĞİLDİR: CMAA 70
  // bağıntısındaki W kısa tondur (US ton) ve eski tablonun ×1,1 çarpanı tam
  // olarak bu birim dönüşümüdür. Değerler tarihsel dökümle yeniden örtüşür.
};

export const BRIDGE_SAPMA: Record<string, string> = {
  ...Object.fromEntries(
    [
      "L113", "L114", "L127", "L129", "L131", "L140", "L149", "L151", "L153", "L154",
      "L156", "L161", "L167", "L169", "O172", "L176", "L178", "O183", "L188", "L190", "O195",
    ].map((cell) => [cell, BRIDGE_MOVING_W_SAPMA])
  ),
  // Köprüde ÇARPIŞAN KÜTLE ve ÇARPMA ENERJİSİ DEĞİŞMEDİ (L205 / L207 hâlâ
  // eşlenir): eski tablonun G_köprü/2 + G_araba·(L−y)/L bağıntısı zaten BİR
  // tampona gelen payı veriyordu ve çarpma hızı oranı k = 0,70'tir.
  L213:
    "Motor başına tahrik kuvveti — BİRİM DÜZELTMESİ (bkz. TROLLEY_SAPMA " +
    "başlığı, 1. madde). Ø315 mm teker, r = 0,1575 m: " +
    "464,59 N → 2.949,59 N (×6,349).",
  L216:
    "Toplam tahrik kuvveti (2 motor): 929,19 → 5.899,18 N (×6,349).",
  L218:
    "Tampon başına tahrik kuvveti (toplam / 2): 464,59 → 2.949,59 N (×6,349).",
  L221:
    "Tahrik enerjisi E_pot = F₀·f′: 0,04646 → 0,29496 kJ (×6,349).",
  L223:
    "Toplam enerji E_a = E_kin + E_pot. Kinetik enerji (2,7155 kJ) değişmedi; " +
    "yalnız tahrik enerjisi büyüdü: 2,7620 → 3,0105 kJ (+9,00 %).",
  L227:
    "Tampon tepki kuvveti F_t = E_a/(s·η) + F₀. Birim düzeltmesi kuvveti " +
    "+16,0 % büyütür, η = 0,80 → 0,85 ise −5,9 % küçültür; net etki " +
    "34,989 → 38,367 kN (+9,65 %). Bu kuvvet yol kirişine YÜKLEME DURUMU III " +
    "olarak teslim edilir (`modules/wheelLoads.ts`), dolayısıyla köprü tampon " +
    "tepkisi yapı hesabında da %9,65 artar.",
  L55:
    `Teker mili maksimum eğilme momenti. ${WHEEL_WIDTH_SAPMA} ` +
    "Köprü tekeri b = 100 mm: 27.428,57 → 18.285,71 kg·cm (−33,3 %).",
  L65:
    "Teker mili eğilme gerilmesi — L55'teki moment düşüşünün doğrudan " +
    "sonucudur. 101,82 → 67,88 kg/cm² (−33,3 %).",
  L73:
    "Teker mili bileşik gerilmesi √(σ² + 3τ²). Kesme gerilmesi (L69) " +
    "değişmediğinden düşüş eğilmeninkinden azdır: 109,82 → 79,38 kg/cm² " +
    "(−27,7 %).",
};

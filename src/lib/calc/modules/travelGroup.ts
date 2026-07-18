// Yürütme grubu hesabı — Excel "05-ARABA YÜRÜTME GRUBU" / "06-KÖPRÜ YÜRÜTME
// GRUBU" sayfalarının parametrik tek modül karşılığı. Formül zinciri hücre
// hücre korunmuştur; her hesaplanan değer `cells` haritasında kendi
// varyantının Excel adresiyle yer alır ve golden testler bu haritayı Excel V5
// dökümüyle karşılaştırır.
//
// Varyant farkları (Excel'den birebir):
// - Köprüde teker yükleri araba yanaşma eksantrikliğiyle hesaplanır (06!L9).
// - Fren bölümü (6.6) sadece köprüde vardır; V5'te fren seçilmemiştir ve
//   kontrol "û" çıkar (bilinçli olarak korunur).
// - Köprü tamponunda çarpma enerjisi 0.7 hız faktörüyle hesaplanır ve motor
//   gücü olarak SEÇİLEN motor gücü (06!L210=L134) kullanılır; arabada motor
//   başına GEREKLİ güç (05!L194=L145) kullanılır.
// - Sapma toleransı arabada +10/−5 (05!O140), köprüde +5/−10 (06!O147).
// - Bilinen Excel kusuru: 06!O160 formülü boş H156'ya bakar (doğrusu L156).
//   Bu hücre üretilmez; doğru kontrol `bridge.gearbox.torque` olarak eklenir.
//
// Birimler Excel ile aynıdır: t, kg, mm, cm, cm³, kg/cm², N/mm², kN, Nm, kNm,
// kW, kJ, m/dak, d/dak, saat.

import { mechanismLife, shaftMaterialAllowables } from "../coefficients";
import { c1Factor, RAILS } from "../tables";
import type {
  AnyCheck,
  MechanismClass,
  ModuleResult,
  TechnicalSpecs,
} from "../types";

// Excel bazı hücrelerde PI() (tam hassasiyet), bazılarında 3.14159 kullanır.
// Golden sadakat için ikisi de aynen korunur (mil kesme gerilmesi 3.14159'ludur).
const PI_EXCEL = 3.14159;

export type TravelWhich = "trolley" | "bridge";

/** Sayfalar arası bağımlılıklar — modül saf kalsın diye parametre olarak alınır */
export interface TravelDeps {
  /** Kanca bloğu + halat [t] — Excel 05!L6 = ('02-ANA KALDIRMA GRUBU'!L14+L15)/1000 */
  hookEquipmentT: number;
  /** Araba ağırlığı [t] — Excel 06!L5 = '05-ARABA YÜRÜTME GRUBU'!L5 (köprü varyantı) */
  trolleyWeightT: number;
}

/** Kullanıcı girdileri (tasarım kabulleri) — Excel L sütunundaki statikler.
 *  Hücre yorumları: 05!araba / 06!köprü adresi. */
export interface TravelInputs {
  trolleyWeightT: number;       // 05!L5 — araba ağırlığı [t] (köprüde deps.trolleyWeightT kullanılır)
  bridgeWeightT: number;        // 06!L6 — köprü ağırlığı [t] (sadece köprü)
  otherWeightsT: number;        // 06!L7 — diğer ağırlıklar [t] (sadece köprü)
  minApproachM: number;         // 06!L9 — minimum araba yanaşması [m] (sadece köprü)
  wheelCount: number;           // 05!L10 / 06!L14 — tekerlek adedi
  shaftSpanACm: number;         // 05!L38 / 06!L42 — mil mesnet ölçüsü a [cm]
  shaftSpanBCm: number;         // 05!L39 / 06!L43 — b [cm] (gösterim)
  shaftDiaCm: number;           // 05!L52 / 06!L56 — teker mili çapı [cm]
  stressConcFactor: number;     // 05!L57 / 06!L61 — gerilme yığılması katsayısı
  bearingCount: number;         // 05!L81 / 06!L85 — rulman adedi
  bearingFactorY0: number;      // 05!L94 / 06!L98 — eşdeğer yük katsayısı Y0 (statik)
  bearingFactorY1: number;      // 05!L95 / 06!L99 — eşdeğer yük katsayısı Y1 (dinamik)
  applicationClass: string;     // 06!L116 — uygulama sınıfı (H/O/Y, gösterim; arabada boş)
  serviceFactorKs: number;      // 05!L111 / 06!L118 — Ks servis faktörü (CMAA 70)
  accelTorqueFactorKt: number;  // 05!L112 / 06!L119 — Kt ivmelenme tork faktörü
  reducerStages: number;        // 05!L113 / 06!L120 — redüktör kademe sayısı
  accelerationMs2: number;      // 05!L116 / 06!L123 — ivme a [m/s²]
  tempFactor: number;           // 05!L121 / 06!L128 — sıcaklık faktörü
  motorCalcCount: number;       // 05!L123 / 06!L130 — motor adedi (güç bölüşümü)
  gearboxServiceFactor: number; // 05!L151 / 06!L155 — redüktör emniyet katsayısı
  brakeServiceFactor: number;   // 06!L168 — fren emniyet katsayısı (sadece köprü)
  motorCouplingServiceFactor: number; // 05!L163 / 06!L177
  wheelCouplingServiceFactor: number; // 05!L175 / 06!L189
  bufferApproachM: number;      // 06!L203 — tampon hesabı araba yanaşması [m] (sadece köprü)
}

/** Katalog seçimleri — mühendisin seçtiği bileşenler */
export interface TravelSelections {
  railCode: string;             // 05!L14 / 06!L18 — ray (KATSAYILAR C68:O70 anahtarı)
  wheelMaterial: string;        // 05!L16 / 06!L20
  wheelTensileNmm2: number;     // 05!L17 / 06!L21 — teker malzemesi çekme dayanımı [N/mm²]
  wheelDiaMm: number;           // 05!L18 / 06!L22 — tekerlek çapı [mm]
  shaftMaterial: string;        // 05!L71 / 06!L75 — mil malzemesi (gösterim; izinler 42CrMo4/4140)
  bearingType: string;          // 05!L85 / 06!L89
  bearingCode: string;          // 05!L86 / 06!L90
  bearingDynCKn: number;        // 05!L92 / 06!L96
  bearingStatC0Kn: number;      // 05!L93 / 06!L97
  motorBrand: string;           // 05!L126 / 06!L133
  motorPowerKw: number;         // 05!L127 / 06!L134
  motorRpm: number;             // 05!L128 / 06!L135
  motorCount: number;           // 05!L129 / 06!L136
  motorShaftMm: number;         // 05!L130 / 06!L137
  gearboxModel: string;         // 05!L154 / 06!L158
  gearboxRatio: number;         // 05!L155 / 06!L159
  gearboxOutputTorqueKnm: number; // 05!L156 / 06!L160
  gearboxInputShaftText: string;  // 05!L158 / 06!L162 (ör. "-")
  gearboxOutputShaftMm: number;   // 05!L159 / 06!L163
  brakeBrand: string;           // 06!L171 — seçilen fren (V5'te boş/0)
  brakeTorqueNm: number;        // 06!L172 — fren torku (V5'te 0 → kontrol "û")
  brakeWheelDiaMm: number;      // 06!L173 — kasnak/disk çapı (V5'te 0)
  couplingMotorShaftMm: number; // 05!L166 — kapline bağlanan motor mili (arabada ayrı statik;
                                //           köprüde 06!L180 = L137 = motorShaftMm hesaplanır)
  motorCouplingBrand: string;   // 05!L167 / 06!L181
  motorCouplingModel: string;   // 05!L168 / 06!L182
  motorCouplingTorqueNm: number; // 05!L169 / 06!L183
  motorCouplingDmaxMm: number;   // 05!L170 / 06!L184
  wheelShaftDiaMm: number;      // 05!L178 / 06!L192 — teker mili çapı (kaplin) [mm]
  wheelCouplingBrand: string;   // 05!L179 / 06!L193
  wheelCouplingModel: string;   // 05!L180 / 06!L194
  wheelCouplingTorqueNm: number; // 05!L181 / 06!L195
  wheelCouplingDmaxMm: number;   // 05!L182 / 06!L196
  bufferModel: string;          // 05!L213 / 06!L229
  bufferStrokeMm: number;       // 05!L214 / 06!L230
  bufferEnergyKj: number;       // 05!L215 / 06!L231
  bufferLoadKn: number;         // 05!L216 / 06!L232
}

export interface TravelValues {
  // Ağırlıklar / tekerlekler
  craneWeightT: number | null;  // 06!L8 (sadece köprü)
  maxWheelLoadKg: number;
  minWheelLoadKg: number;
  avgWheelLoadKg: number;
  railHeadWidthMm: number;
  wheelRpm: number;
  c1: number;
  c2: number;
  limitPressure: number | string;
  actualPressure: number;
  allowedPressure: number;
  // Teker mili
  reactionAKg: number;
  reactionBKg: number;
  maxMomentKgCm: number;
  sectionModulusCm3: number;
  shaftBendingStress: number;
  shaftShearStress: number;
  shaftCombinedStress: number;
  shaftAllowables: { bending: number; shear: number; combined: number };
  // Rulman
  bearingRadialKn: number;
  bearingAxialKn: number;
  bearingEqStaticKn: number;
  bearingEqDynamicKn: number;
  bearingStaticSafety: number;
  bearingLifeHours: number;
  requiredLifeMin: number;
  requiredLifeMax: number | null;
  // Motor
  totalWeightKg: number;
  designWeightTons: number;
  actualSpeedMpm: number;
  startupTimeS: number;
  frictionFactor: number;
  reducerEfficiency: number;
  rotationInertiaFactor: number;
  accelFactorKa: number;
  requiredPowerKw: number;
  requiredMaxPowerKw: number;
  requiredPowerPerMotorKw: number;
  installedPowerKw: number;
  // Redüktör
  requiredRatio: number;
  ratioDeviationPct: number;
  requiredInputTorqueNm: number;
  nominalOutputTorqueNm: number;
  requiredMinOutputTorqueNm: number;
  gearboxActualSafety: number;
  // Fren (sadece köprü)
  requiredBrakeTorqueNm: number | null;
  // Kaplinler
  requiredMotorCouplingTorqueNm: number;
  motorCouplingShaftMm: number;
  motorCouplingSafety: number;
  requiredWheelCouplingTorqueNm: number;
  wheelCouplingSafety: number;
  // Tampon
  collisionLoadT: number;
  impactEnergyKj: number;
  driveLoadPerMotorN: number;
  totalDriveLoadN: number;
  bufferDriveLoadN: number;
  totalEnergyKj: number;
  bufferForceKn: number;
}

/** Mekanizma katsayısı c2 (05!L21 / 06!L25 IF zinciri, FEM T.4.2.4.1.5).
 *  Excel her iki sayfada da P12'yi (kaldırma mekanizma sınıfı) okur. */
function mechanismFactorC2(mech: MechanismClass): number {
  if (mech === "M1" || mech === "M2" || mech === "M3" || mech === "M4") return 1.12;
  if (mech === "M5") return 1;
  if (mech === "M6") return 0.9;
  return 0.8; // M7 / M8
}

/** Limit gerilme PL [N/mm²] (05!L22 / 06!L26 IF zinciri, FEM T.4.2.4.1.3) */
function wheelLimitPressure(tensileNmm2: number): number | string {
  if (tensileNmm2 >= 500 && tensileNmm2 < 600) return 5;
  if (tensileNmm2 >= 600 && tensileNmm2 < 700) return 5.6;
  if (tensileNmm2 >= 700 && tensileNmm2 < 800) return 6.5;
  if (tensileNmm2 >= 800 && tensileNmm2 < 900) return 7.2;
  if (tensileNmm2 >= 900 && tensileNmm2 < 1000) return 7.8;
  if (tensileNmm2 >= 1000) return 8.5;
  return "Hatalı Değer"; // Excel'deki hata metniyle birebir
}

/** Sürtünme katsayısı f [lb/ton] (05!L114 / 06!L121, CMAA 70 T.5.2.9.1.2.1-D) */
function travelFrictionFactor(wheelDiaMm: number): number {
  if (wheelDiaMm === 200) return 16;
  if (wheelDiaMm === 250) return 15;
  if (wheelDiaMm === 315 || wheelDiaMm === 400 || wheelDiaMm === 500) return 15;
  if (wheelDiaMm === 630 || wheelDiaMm === 710 || wheelDiaMm === 800 || wheelDiaMm === 900) return 12;
  return Number.NaN; // Excel IF zinciri eşleşme yoksa FALSE döndürür
}

export function computeTravelGroup(
  specs: TechnicalSpecs,
  which: TravelWhich,
  inp: TravelInputs,
  sel: TravelSelections,
  deps: TravelDeps
): ModuleResult<TravelValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];
  const tick = (b: boolean) => (b ? "ü" : "û");
  // Hücre yazıcı: aynı büyüklüğün araba (05) ve köprü (06) adresleri farklıdır.
  const put = (
    trolleyCell: string | null,
    bridgeCell: string | null,
    value: number | string
  ) => {
    const addr = which === "trolley" ? trolleyCell : bridgeCell;
    if (addr !== null) cells[addr] = value;
  };

  const speedMpm = which === "trolley" ? specs.trolleySpeedMpm : specs.bridgeSpeedMpm; // P17 / P14

  // --- Ağırlıklar (sayfa başı) --------------------------------------------
  const capacityT = specs.mainCapacityT; // 05!L4 / 06!L4 = 01!P4
  put("L4", "L4", capacityT);
  // Araba ağırlığı: arabada girdi (05!L5 statik), köprüde 05'ten gelir (06!L5 formül).
  const trolleyWeightT = which === "trolley" ? inp.trolleyWeightT : deps.trolleyWeightT;
  let craneWeightT: number | null = null;
  if (which === "trolley") {
    cells.L6 = deps.hookEquipmentT; // 05!L6 = (02!L14+L15)/1000
  } else {
    cells.L5 = trolleyWeightT; // 06!L5 = 05!L5
    craneWeightT = inp.bridgeWeightT + inp.otherWeightsT + trolleyWeightT; // 06!L8
    cells.L8 = craneWeightT;
    cells.L10 = specs.spanM; // 06!L10 = 01!P27
  }

  // --- 5.1 / 6.1 Tekerlekler ----------------------------------------------
  let Pmax: number; // maksimum tekerlek yükü [kg]
  let Pmin: number; // minimum tekerlek yükü [kg]
  if (which === "trolley") {
    // 05!L11 = (L5+L4+L6)/L10*1000 ; 05!L12 = (L5+L6)/L10*1000
    Pmax = ((trolleyWeightT + capacityT + deps.hookEquipmentT) / inp.wheelCount) * 1000;
    Pmin = ((trolleyWeightT + deps.hookEquipmentT) / inp.wheelCount) * 1000;
  } else {
    // Köprüde araba yanaşma eksantrikliği: 06!L15 / 06!L16
    const span = specs.spanM;
    const halfBridge = (inp.bridgeWeightT + inp.otherWeightsT) / 2;
    Pmax = (((capacityT + trolleyWeightT) * ((span - inp.minApproachM) / span) + halfBridge) * 1000) / (inp.wheelCount / 2);
    Pmin = ((trolleyWeightT * (inp.minApproachM / span) + halfBridge) * 1000) / (inp.wheelCount / 2);
  }
  const Port = (2 * Pmax + Pmin) / 3; // 05!L13 / 06!L17
  put("L11", "L15", Pmax);
  put("L12", "L16", Pmin);
  put("L13", "L17", Port);

  const railHeadWidth = RAILS[sel.railCode]?.headWidth ?? Number.NaN; // HLOOKUP KATSAYILAR C68:O70 satır 3
  put("L15", "L19", railHeadWidth);
  const wheelRpm = speedMpm / (sel.wheelDiaMm / 1000) / Math.PI; // 05!L19 / 06!L23 — PI()
  put("L19", "L23", wheelRpm);
  const c1 = c1Factor(sel.wheelDiaMm, speedMpm) ?? Number.NaN; // VLOOKUP + KATSAYILAR Q81/R81
  put("L20", "L24", c1);
  const c2 = mechanismFactorC2(specs.hoistMechanismClass); // Excel P12 okur (kaldırma sınıfı!)
  put("L21", "L25", c2);
  const PL = wheelLimitPressure(sel.wheelTensileNmm2);
  put("L22", "L26", PL);
  const actualPressure = (Port * 9.81) / railHeadWidth / sel.wheelDiaMm; // 05!L23 / 06!L27 [N/mm²]
  put("L23", "L27", actualPressure);
  const PLnum = typeof PL === "number" ? PL : Number.NaN;
  const allowedPressure = PLnum * c1 * c2; // 05!L24 / 06!L28
  put("L24", "L28", allowedPressure);
  put("O24", "O28", actualPressure);
  put("Q24", "Q28", tick(allowedPressure >= actualPressure));
  checks.push({
    id: `${which}.wheel.pressure`,
    label: "Tekerlek yüzey basıncı (PL·c1·c2)",
    required: actualPressure, provided: allowedPressure, unit: "N/mm²", op: ">=",
    pass: allowedPressure >= actualPressure,
    standard: "FEM 1.001 T.4.2.4.1",
  });

  // --- 5.2 / 6.2 Teker Mili ------------------------------------------------
  const RA = Pmax / 2; // 05!L46 / 06!L50
  const RB = Pmax / 2; // 05!L47 / 06!L51
  put("L46", "L50", RA);
  put("L47", "L51", RB);
  const Mmax = RA * inp.shaftSpanACm; // 05!L51 / 06!L55 [kg·cm]
  put("L51", "L55", Mmax);
  const sectionModulus = (Math.PI * inp.shaftDiaCm ** 3) / 32; // 05!L56 / 06!L60 — PI()
  put("L56", "L60", sectionModulus);
  const bendingStress = (Mmax * inp.stressConcFactor) / sectionModulus; // 05!L61 / 06!L65
  put("L61", "L65", bendingStress);
  const shearStress = (RB / (PI_EXCEL * (inp.shaftDiaCm / 2) ** 2)) * inp.stressConcFactor; // 05!L65 / 06!L69 — 3.14159!
  put("L65", "L69", shearStress);
  const combinedStress = Math.sqrt(bendingStress ** 2 + 3 * shearStress ** 2); // 05!L69 / 06!L73
  put("L69", "L73", combinedStress);
  // Excel izin gerilmelerini KATSAYILAR!J34:J36'dan (42CrMo4 = 4140 satırı) sabit okur.
  const shaftAllow = shaftMaterialAllowables("4140");
  put("L73", "L77", shaftAllow.bending);
  put("L74", "L78", shaftAllow.shear);
  put("L75", "L79", shaftAllow.combined);
  checks.push({
    id: `${which}.shaft.stress`,
    label: "Teker mili bileşik gerilmesi",
    required: combinedStress, provided: shaftAllow.combined, unit: "kg/cm²", op: ">=",
    pass: shaftAllow.combined >= combinedStress,
    nonExcel: true, // Excel'de tik hücresi yok
  });

  // --- 5.3 / 6.3 Tekerlek Rulmanı -----------------------------------------
  put("L80", "L84", Port);
  // Excel formülünde bölen 2 sabittir; rulman adedi girdisiyle eşdeğerdir (V5'te 2).
  const bearingRadial = (Port * 9.81) / 1000 / inp.bearingCount; // 05!L82 / 06!L86 [kN]
  put("L82", "L86", bearingRadial);
  const bearingAxial = 0.1 * bearingRadial; // 05!L83 / 06!L87
  put("L83", "L87", bearingAxial);
  const eqStatic = bearingRadial + bearingAxial * inp.bearingFactorY0; // 05!L89 / 06!L93
  put("L89", "L93", eqStatic);
  const eqDynamic = bearingRadial + inp.bearingFactorY1 * bearingAxial; // 05!L90 / 06!L94
  put("L90", "L94", eqDynamic);
  const staticSafety = sel.bearingStatC0Kn / eqStatic; // 05!L98 / 06!L102
  put("L98", "L102", staticSafety);
  put("L100", "L105", wheelRpm); // rulman devri = tekerlek devri
  const lifeHours = (1000000 / (60 * wheelRpm)) * (sel.bearingDynCKn / eqDynamic) ** (10 / 3); // 05!L101 / 06!L107
  put("L101", "L107", lifeHours);
  // Excel her iki sayfada da P13'ü (kaldırma kullanım sınıfı) okur.
  const life = mechanismLife(specs.hoistUsageClass);
  const requiredLifeMin = life.min ?? 0;
  put("L103", "L109", requiredLifeMin);
  if (life.max !== null) put("Q103", "Q109", life.max);
  checks.push({
    id: `${which}.bearing.life`,
    label: "Tekerlek rulmanı ömrü",
    required: requiredLifeMin, provided: lifeHours, unit: "saat", op: ">=",
    pass: lifeHours >= requiredLifeMin,
    standard: "FEM 1.001 T.2.1.3.2",
  });
  checks.push({
    id: `${which}.bearing.static`,
    label: "Rulman statik emniyeti",
    required: 1, provided: staticSafety, unit: "-", op: ">=", pass: staticSafety >= 1,
    nonExcel: true,
  });

  // --- 5.4 / 6.4 Yürütme Motoru (CMAA 70) ----------------------------------
  const totalWeightKg =
    which === "trolley"
      ? (capacityT + deps.hookEquipmentT + trolleyWeightT) * 1000 // 05!L107
      : (capacityT + trolleyWeightT + inp.bridgeWeightT + inp.otherWeightsT) * 1000; // 06!L113
  put("L107", "L113", totalWeightKg);
  const designWeightTons = (totalWeightKg * 1.1) / 1000; // 05!L108 / 06!L114 [ton, %10 pay]
  put("L108", "L114", designWeightTons);
  // Gerçek hız redüktör bölümünde hesaplanır ama motor bölümünde kullanılır (05!L109=L141).
  const actualSpeed = (sel.motorRpm / sel.gearboxRatio) * Math.PI * (sel.wheelDiaMm / 1000); // PI()
  put("L109", "L115", actualSpeed);
  const startupTime = actualSpeed / 60 / inp.accelerationMs2; // 05!L110 / 06!L117 [sn]
  put("L110", "L117", startupTime);
  const friction = travelFrictionFactor(sel.wheelDiaMm); // 05!L114 / 06!L121
  put("L114", "L121", friction);
  const reducerEff = 0.98 ** inp.reducerStages; // 05!L115 / 06!L122 (0.98 Excel'de sabittir)
  put("L115", "L122", reducerEff);
  put("L117", "L124", inp.accelerationMs2 * 3.2808); // ivme [ft/s²]
  const inertiaCr = 1.05 + (inp.accelerationMs2 * 3.28) / 7.5; // 05!L118 / 06!L125
  put("L118", "L125", inertiaCr);
  const accelKa =
    (friction + (2000 * inp.accelerationMs2 * inertiaCr) / (9.81 * reducerEff)) /
    (inp.accelTorqueFactorKt * 33000); // 05!L119 / 06!L126
  put("L119", "L126", accelKa);
  const requiredPower = designWeightTons * (actualSpeed * 3.28) * accelKa * inp.serviceFactorKs * 0.745; // 05!L120 / 06!L127 [kW]
  put("L120", "L127", requiredPower);
  const requiredMaxPower = inp.tempFactor * requiredPower; // 05!L122 / 06!L129
  put("L122", "L129", requiredMaxPower);
  put("L124", "L131", requiredMaxPower / inp.motorCalcCount); // motor başına gerekli güç
  const installedPower = sel.motorPowerKw * sel.motorCount; // 05!I133 / 06!I140
  put("I133", "I140", installedPower);
  put("L133", "L140", requiredMaxPower);
  put("Q133", "Q140", tick(installedPower >= requiredMaxPower));
  checks.push({
    id: `${which}.motor.power`,
    label: "Yürütme motoru gücü",
    required: requiredMaxPower, provided: installedPower, unit: "kW", op: ">=",
    pass: installedPower >= requiredMaxPower,
    standard: "CMAA 70 5.2.9.1.2.1",
  });

  // --- 5.5 / 6.5 Yürütme Dişli Kutusu --------------------------------------
  const requiredRatio = sel.motorRpm / wheelRpm; // 05!L138 / 06!L145
  put("L138", "L145", requiredRatio);
  put("L139", "L146", sel.gearboxRatio);
  const ratioDeviation = (100 * (requiredRatio - sel.gearboxRatio)) / requiredRatio; // 05!L140 / 06!L147 [%]
  put("L140", "L147", ratioDeviation);
  // Sapma toleransı varyanta göre farklıdır: araba +10/−5 (05!O140), köprü +5/−10 (06!O147).
  const devMax = which === "trolley" ? 10 : 5;
  const devMin = which === "trolley" ? -5 : -10;
  const devOk = ratioDeviation <= devMax && ratioDeviation >= devMin;
  put("O140", "O147", tick(devOk));
  checks.push({
    id: `${which}.gearbox.ratio`,
    label: "Çevrim oranı sapması",
    min: devMin, max: devMax, provided: ratioDeviation, unit: "%", op: "range",
    pass: devOk,
  });
  put("L141", "L148", actualSpeed);
  put("L143", "L149", requiredPower);
  put("L144", "L150", sel.motorCount);
  const powerPerMotor = requiredPower / sel.motorCount; // 05!L145 / 06!L151
  put("L145", "L151", powerPerMotor);
  put("L146", "L152", sel.motorRpm);
  const requiredInputTorque = (9550 * powerPerMotor) / sel.motorRpm; // 05!L148 / 06!L153 [Nm]
  put("L148", "L153", requiredInputTorque);
  const nominalOutputTorque = requiredInputTorque * sel.gearboxRatio; // 05!L150 / 06!L154 [Nm]
  put("L150", "L154", nominalOutputTorque);
  const requiredMinOutputTorque = nominalOutputTorque * inp.gearboxServiceFactor; // 05!L152 / 06!L156 [Nm]
  put("L152", "L156", requiredMinOutputTorque);
  const gearboxSafety = sel.gearboxOutputTorqueKnm / (nominalOutputTorque / 1000); // 05!L157 / 06!L161
  put("L157", "L161", gearboxSafety);
  if (which === "trolley") {
    // 05!O157 = IF(L157>=L151,"ü","û")
    cells.O157 = tick(gearboxSafety >= inp.gearboxServiceFactor);
    checks.push({
      id: `${which}.gearbox.safety`,
      label: "Redüktör emniyet katsayısı",
      required: inp.gearboxServiceFactor, provided: gearboxSafety, unit: "-", op: ">=",
      pass: gearboxSafety >= inp.gearboxServiceFactor,
    });
  } else {
    // Excel kusuru: 06!O160 = IF(L160>=H156/1000,...) boş H156'ya bakar ve daima
    // "ü" verir. Hücre üretilmez (golden'da hariç); doğru kontrol L156 ile yapılır.
    checks.push({
      id: `${which}.gearbox.torque`,
      label: "Redüktör çıkış torku",
      required: requiredMinOutputTorque / 1000, provided: sel.gearboxOutputTorqueKnm,
      unit: "kNm", op: ">=",
      pass: sel.gearboxOutputTorqueKnm >= requiredMinOutputTorque / 1000,
    });
  }

  // --- 6.6 Köprü Yürütme Freni (sadece köprü) ------------------------------
  let requiredBrakeTorque: number | null = null;
  if (which === "bridge") {
    cells.L167 = requiredInputTorque; // 06!L167 = L153
    requiredBrakeTorque = requiredInputTorque * inp.brakeServiceFactor; // 06!L169
    cells.L169 = requiredBrakeTorque;
    cells.O172 = requiredBrakeTorque;
    cells.R172 = tick(sel.brakeTorqueNm >= requiredBrakeTorque); // V5'te fren seçilmemiş → "û"
    checks.push({
      id: `${which}.brake.torque`,
      label: "Köprü yürütme freni torku",
      required: requiredBrakeTorque, provided: sel.brakeTorqueNm, unit: "Nm", op: ">=",
      pass: sel.brakeTorqueNm >= requiredBrakeTorque,
    });
  }

  // --- 5.6 / 6.7 Motor-Dişli Kutusu Kaplini --------------------------------
  put("L162", "L176", requiredInputTorque);
  const requiredMotorCouplingTorque = requiredInputTorque * inp.motorCouplingServiceFactor; // 05!L164 / 06!L178
  put("L164", "L178", requiredMotorCouplingTorque);
  // Arabada kapline bağlanan mil ayrı statiktir (05!L166); köprüde 06!L180 = L137 formülüdür.
  const motorCouplingShaft = which === "trolley" ? sel.couplingMotorShaftMm : sel.motorShaftMm;
  if (which === "bridge") cells.L180 = motorCouplingShaft;
  put("O169", "O183", requiredMotorCouplingTorque);
  put("R169", "R183", tick(sel.motorCouplingTorqueNm >= requiredMotorCouplingTorque));
  put("O170", "O184", motorCouplingShaft);
  put("R170", "R184", tick(sel.motorCouplingDmaxMm >= motorCouplingShaft));
  const motorCouplingSafety = sel.motorCouplingTorqueNm / requiredMotorCouplingTorque; // 05!L171 (sadece arabada hücre)
  put("L171", null, motorCouplingSafety);
  checks.push({
    id: `${which}.motorCoupling.torque`,
    label: "Motor kaplini tork kapasitesi",
    required: requiredMotorCouplingTorque, provided: sel.motorCouplingTorqueNm, unit: "Nm", op: ">=",
    pass: sel.motorCouplingTorqueNm >= requiredMotorCouplingTorque,
  });
  checks.push({
    id: `${which}.motorCoupling.bore`,
    label: "Motor kaplini delik çapı",
    required: motorCouplingShaft, provided: sel.motorCouplingDmaxMm, unit: "mm", op: ">=",
    pass: sel.motorCouplingDmaxMm >= motorCouplingShaft,
  });

  // --- 5.7 / 6.8 Teker-Dişli Kutusu Kaplini --------------------------------
  put("L174", "L188", nominalOutputTorque);
  const requiredWheelCouplingTorque = nominalOutputTorque * inp.wheelCouplingServiceFactor; // 05!L176 / 06!L190
  put("L176", "L190", requiredWheelCouplingTorque);
  put("O181", "O195", requiredWheelCouplingTorque);
  put("R181", "R195", tick(sel.wheelCouplingTorqueNm >= requiredWheelCouplingTorque));
  put("O182", "O196", sel.wheelShaftDiaMm);
  put("R182", "R196", tick(sel.wheelCouplingDmaxMm >= sel.wheelShaftDiaMm));
  // 05!L183 = L181/L174 — kapasite/nominal çıkış torku (servis faktörsüz; sadece arabada hücre)
  const wheelCouplingSafety = sel.wheelCouplingTorqueNm / nominalOutputTorque;
  put("L183", null, wheelCouplingSafety);
  checks.push({
    id: `${which}.wheelCoupling.torque`,
    label: "Teker kaplini tork kapasitesi",
    required: requiredWheelCouplingTorque, provided: sel.wheelCouplingTorqueNm, unit: "Nm", op: ">=",
    pass: sel.wheelCouplingTorqueNm >= requiredWheelCouplingTorque,
  });
  checks.push({
    id: `${which}.wheelCoupling.bore`,
    label: "Teker kaplini delik çapı",
    required: sel.wheelShaftDiaMm, provided: sel.wheelCouplingDmaxMm, unit: "mm", op: ">=",
    pass: sel.wheelCouplingDmaxMm >= sel.wheelShaftDiaMm,
  });

  // --- 5.8-5.9 / 6.9-6.10 Tampon -------------------------------------------
  let collisionLoadT: number;
  let impactEnergy: number;
  if (which === "trolley") {
    cells.L186 = trolleyWeightT; // araba ağırlığı [t]
    cells.L187 = actualSpeed;
    collisionLoadT = trolleyWeightT; // 05!L189 = L186
    cells.L189 = collisionLoadT;
    impactEnergy = 0.5 * collisionLoadT * (actualSpeed / 60) ** 2; // 05!L191 [kJ]
    cells.L191 = impactEnergy;
  } else {
    cells.L200 = inp.bridgeWeightT + inp.otherWeightsT; // köprü ağırlığı [t]
    cells.L201 = trolleyWeightT;
    cells.L202 = actualSpeed;
    // 06!L205 = (köprü/2) + araba·(açıklık−yanaşma)/açıklık — eksantrik çarpışma yükü
    collisionLoadT =
      (inp.bridgeWeightT + inp.otherWeightsT) / 2 +
      (trolleyWeightT * (specs.spanM - inp.bufferApproachM)) / specs.spanM;
    cells.L205 = collisionLoadT;
    // Köprüde 0.7 hız faktörü: 06!L207 = 0.5·We·(0.7·v/60)²
    impactEnergy = 0.5 * collisionLoadT * ((0.7 * actualSpeed) / 60) ** 2;
    cells.L207 = impactEnergy;
  }
  // Yürütme yükü: arabada motor başına GEREKLİ güç (05!L194=L145), köprüde
  // SEÇİLEN motor gücü (06!L210=L134) kullanılır — Excel'e sadık.
  const bufferPowerKw = which === "trolley" ? powerPerMotor : sel.motorPowerKw;
  put("L194", "L210", bufferPowerKw);
  put("L195", "L211", sel.motorRpm);
  put("L196", "L212", sel.gearboxRatio);
  const drivePerMotor = (bufferPowerKw * sel.gearboxRatio * 9550) / sel.motorRpm; // 05!L197 / 06!L213 [N]
  put("L197", "L213", drivePerMotor);
  put("L199", "L215", sel.motorCount);
  const totalDrive = sel.motorCount * drivePerMotor; // 05!L200 / 06!L216 [N]
  put("L200", "L216", totalDrive);
  const bufferDrive = totalDrive / 2; // 05!L202 / 06!L218 — tampon başına
  put("L202", "L218", bufferDrive);
  put("L204", "L220", sel.bufferStrokeMm);
  const driveTimesStroke = (bufferDrive * sel.bufferStrokeMm) / 1000000; // 05!L205 / 06!L221 [kJ]
  put("L205", "L221", driveTimesStroke);
  const totalEnergy = driveTimesStroke + impactEnergy; // 05!L207 / 06!L223 [kJ]
  put("L207", "L223", totalEnergy);
  put("L209", "L225", sel.bufferStrokeMm);
  const bufferForce = totalEnergy / (sel.bufferStrokeMm / 1000) / 0.8 + bufferDrive / 1000; // 05!L211 / 06!L227 [kN]
  put("L211", "L227", bufferForce);
  put("N215", "N231", tick(sel.bufferEnergyKj >= totalEnergy));
  put("N216", "N232", tick(sel.bufferLoadKn >= bufferForce));
  checks.push({
    id: `${which}.buffer.energy`,
    label: "Tampon enerji kapasitesi",
    required: totalEnergy, provided: sel.bufferEnergyKj, unit: "kJ", op: ">=",
    pass: sel.bufferEnergyKj >= totalEnergy,
  });
  checks.push({
    id: `${which}.buffer.load`,
    label: "Tampon yük kapasitesi",
    required: bufferForce, provided: sel.bufferLoadKn, unit: "kN", op: ">=",
    pass: sel.bufferLoadKn >= bufferForce,
  });

  const values: TravelValues = {
    craneWeightT,
    maxWheelLoadKg: Pmax,
    minWheelLoadKg: Pmin,
    avgWheelLoadKg: Port,
    railHeadWidthMm: railHeadWidth,
    wheelRpm,
    c1,
    c2,
    limitPressure: PL,
    actualPressure,
    allowedPressure,
    reactionAKg: RA,
    reactionBKg: RB,
    maxMomentKgCm: Mmax,
    sectionModulusCm3: sectionModulus,
    shaftBendingStress: bendingStress,
    shaftShearStress: shearStress,
    shaftCombinedStress: combinedStress,
    shaftAllowables: shaftAllow,
    bearingRadialKn: bearingRadial,
    bearingAxialKn: bearingAxial,
    bearingEqStaticKn: eqStatic,
    bearingEqDynamicKn: eqDynamic,
    bearingStaticSafety: staticSafety,
    bearingLifeHours: lifeHours,
    requiredLifeMin,
    requiredLifeMax: life.max,
    totalWeightKg,
    designWeightTons,
    actualSpeedMpm: actualSpeed,
    startupTimeS: startupTime,
    frictionFactor: friction,
    reducerEfficiency: reducerEff,
    rotationInertiaFactor: inertiaCr,
    accelFactorKa: accelKa,
    requiredPowerKw: requiredPower,
    requiredMaxPowerKw: requiredMaxPower,
    requiredPowerPerMotorKw: powerPerMotor,
    installedPowerKw: installedPower,
    requiredRatio,
    ratioDeviationPct: ratioDeviation,
    requiredInputTorqueNm: requiredInputTorque,
    nominalOutputTorqueNm: nominalOutputTorque,
    requiredMinOutputTorqueNm: requiredMinOutputTorque,
    gearboxActualSafety: gearboxSafety,
    requiredBrakeTorqueNm: requiredBrakeTorque,
    requiredMotorCouplingTorqueNm: requiredMotorCouplingTorque,
    motorCouplingShaftMm: motorCouplingShaft,
    motorCouplingSafety,
    requiredWheelCouplingTorqueNm: requiredWheelCouplingTorque,
    wheelCouplingSafety,
    collisionLoadT,
    impactEnergyKj: impactEnergy,
    driveLoadPerMotorN: drivePerMotor,
    totalDriveLoadN: totalDrive,
    bufferDriveLoadN: bufferDrive,
    totalEnergyKj: totalEnergy,
    bufferForceKn: bufferForce,
  };

  return { values, checks, cells };
}

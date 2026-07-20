// Kaldırma grubu hesabı — Excel "02-ANA KALDIRMA GRUBU" / "03-YRD KALDIRMA GRUBU"
// sayfalarının parametrik karşılığı. Formül zinciri hücre hücre korunmuştur;
// her hesaplanan değer `cells` haritasında Excel adresiyle yer alır ve golden
// testler bu haritayı Excel V5 dökümüyle karşılaştırır.
//
// Birimler Excel ile aynıdır: kg, kg/cm², cm, mm, kN, kNm, Nm, kW, m/dak, d/dak.

import {
  drumAllowableStress,
  drumCoefficient,
  groovePitch,
  mechanismLife,
  ropeSafetyFactor,
  shaftMaterialAllowables,
} from "../coefficients";
import type {
  AnyCheck,
  DrumMaterial,
  ModuleResult,
  ShaftMaterial,
  TechnicalSpecs,
} from "../types";

// Excel bazı hücrelerde PI() (tam hassasiyet), bazılarında 3.14159 kullanır.
// Golden sadakat için ikisi de aynen korunur.
const PI_EXCEL = 3.14159;

export type HoistWhich = "main" | "aux";

/** Kullanıcı girdileri (tasarım kabulleri) — Excel L sütunundaki statikler */
export interface HoistInputs {
  drivenFalls: number;          // L5  — tahrikli halat sayısı
  totalFalls: number;           // O5  — toplam halat sayısı
  sheaveEfficiency: number;     // L7  — makara verimi (0.985)
  fixedSheaveCount: number;     // L8  — sabit makara adedi
  hookBlockWeightKg: number;    // L14 — kanca bloğu/kepçe ağırlığı
  ropeWeightKg: number;         // L15 — halat ağırlığı
  drumWallThicknessMm: number;  // L42 — tambur et kalınlığı
  safetyGrooveCount: number;    // L58 — emniyet sarımı
  drumWeightKg: number;         // L69 — tambur ağırlığı
  shaftSpanACm: number;         // L70 — mil mesnet geometrisi a
  shaftSpanBCm: number;         // L71 — b
  shaftSpanCCm: number;         // L72 — c
  shaftMomentArmCm: number;     // L73 — moment kolu
  shaftArm2Cm: number;          // L74 — (gösterim)
  shaftDiaCm: number;           // L76 — mil çapı (eğilme)
  shaftShearDiaCm: number;      // L77 — mil çapı (kesme)
  drumWeldThicknessCm: number;  // L99  — tambur kaynak kalınlığı
  drumWeldAllowable: number;    // L101 — kaynak izin gerilmesi [kg/cm²]
  shaftWeldThicknessCm: number; // L115 — mil kaynak kalınlığı
  shaftWeldAllowable: number;   // L117
  bearingFactorY1: number;      // L142 — rulman eşdeğer yük katsayısı (statik)
  bearingFactorY2: number;      // L143 — (dinamik)
  drumCount: number;            // L163 — tambur adedi
  gearboxServiceFactor: number; // L166 — redüktör emniyet katsayısı
  reducerStages: number;        // L195 — kademe sayısı
  stageEfficiency: number;      // L196 — kademe verimi
  tempFactor: number;           // L203 — sıcaklık faktörü
  motorDivisor: number;         // L205 — güç bölücü (motor başına)
  brakeServiceFactor: number;   // L219 — fren emniyet katsayısı
  motorCouplingServiceFactor: number; // L234
  drumCouplingDivisor: number;  // L248
  drumCouplingServiceFactor: number;  // L250
}

/** Katalog seçimleri — mühendisin seçtiği bileşenler */
export interface HoistSelections {
  ropeBrand: string;            // L23
  ropeDiaMm: number;            // L24
  ropeConstruction: string;     // L25 (6x36)
  ropeCore: string;             // L26
  ropeWireStrength: number;     // L27 [kg/mm²]
  ropeBreakingLoadKn: number;   // Q28
  drumDiaMm: number;            // L39
  drumMaterial: DrumMaterial;   // L40
  drumGrooveLengthText: string; // L63 (ör. "2 x 220")
  shaftMaterial: ShaftMaterial; // L90
  bearingType: string;          // L133
  bearingCode: string;          // L134 (ör. 22212)
  bearingDynCKn: number;        // L140
  bearingStatC0Kn: number;      // L141
  gearboxModel: string;         // L174
  gearboxRatio: number;         // L175
  gearboxNominalTorqueKnm: number; // L176
  gearboxInputShaftMm: number;  // L177
  gearboxOutputShaftMm: number; // L178
  gearboxWeightKg: number;      // L180
  gearboxAllowedRadialKn: number; // L188
  motorPowerKw: number;         // L208
  motorRpm: number;             // O208
  motorShaftMm: number;         // L209
  motorBrand: string;           // L210
  motorCount: number;           // L211
  brakeBrand: string;           // L222
  brakeModel: string;           // L223
  brakeTorqueNm: number;        // L224
  brakeWheelDiaMm: number;      // L225
  brakeQty: number;             // L226 / O228
  motorCouplingBrand: string;   // L237
  motorCouplingModel: string;   // L238
  motorCouplingWheelDiaMm: number; // L239
  motorCouplingTorqueNm: number;   // L240
  motorCouplingDmaxMm: number;     // L241
  drumCouplingBrand: string;    // L256
  drumCouplingModel: string;    // L257
  drumCouplingTorqueNm: number; // L258
  drumCouplingRadialN: number;  // L259
  drumCouplingDmaxMm: number;   // L260
}

export interface HoistValues {
  // 2.1 Halat
  mechanicalAdvantage: number;
  ropeEfficiency: number;
  loadKg: number;
  totalLoadKg: number;
  requiredRopeSafety: number;
  ropeLoadKg: number;
  requiredBreakingKg: number;
  actualBreakingKg: number;
  actualRopeSafety: number;
  // 2.2 Tambur
  drumCoefficientH: number;
  minDrumDiaMm: number;
  groovePitchMm: number;
  drumBearingStress: number;
  drumBendingStress: number;
  drumCombinedStress: number;
  drumAllowable: number;
  requiredGrooves: number;
  requiredGrooveLengthMm: number;
  // Mil
  reactionAKg: number;
  reactionBKg: number;
  shaftMomentKgCm: number;
  shaftBendingStress: number;
  shaftShearStress: number;
  shaftCombinedStress: number;
  shaftAllowables: { bending: number; shear: number; combined: number };
  // Kaynaklar
  drumWeldCombinedStress: number;
  shaftWeldStress: number;
  // Rulman
  bearingRadialKn: number;
  bearingAxialKn: number;
  bearingEqStaticKn: number;
  bearingEqDynamicKn: number;
  bearingStaticSafety: number;
  drumRpm: number;
  bearingLifeHours: number;
  requiredLifeMin: number;
  requiredLifeMax: number | null;
  // Redüktör
  drumTorqueKnm: number;
  requiredGearboxTorqueKnm: number;
  requiredRatio: number;
  ratioDeviationPct: number;
  actualLiftSpeedMpm: number;
  gearboxActualSafety: number;
  gearboxRadialKn: number;
  // Motor
  reducerEfficiency: number;
  motorInputTorqueNm: number;
  requiredPowerKw: number;
  requiredPowerAdjustedKw: number;
  installedPowerKw: number;
  // Fren
  brakeShaftTorqueNm: number;
  requiredBrakeTorqueNm: number;
  brakeActualSafety: number;
  // Kaplinler
  requiredMotorCouplingTorqueNm: number;
  couplingShaftDiaMm: number;
  motorCouplingActualSafety: number;
  requiredDrumCouplingTorqueNm: number;
  requiredDrumCouplingRadialN: number;
  drumCouplingActualSafety: number;
}

export function computeHoistGroup(
  specs: TechnicalSpecs,
  which: HoistWhich,
  inp: HoistInputs,
  sel: HoistSelections
): ModuleResult<HoistValues> {
  const capacityT = which === "main" ? specs.mainCapacityT : specs.auxCapacityT;
  const liftHeightM = which === "main" ? specs.mainLiftHeightM : specs.auxLiftHeightM;
  const liftSpeedMpm = which === "main" ? specs.mainLiftSpeedMpm : specs.auxLiftSpeedMpm;
  // Excel her iki sayfada da AnakaldırmaM (P12) ve P13 kullanır (yrd için ayrı sınıf yok).
  const mech = specs.hoistMechanismClass;
  const usage = specs.hoistUsageClass;

  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];
  const tick = (b: boolean) => (b ? "ü" : "û");

  // --- 2.1 Halat -----------------------------------------------------------
  const L9 = inp.totalFalls / inp.drivenFalls; // mekanik avantaj
  const L11 =
    ((inp.sheaveEfficiency ** inp.fixedSheaveCount) / L9) *
    ((1 - inp.sheaveEfficiency ** L9) / (1 - inp.sheaveEfficiency)); // halat verimi
  const L13 = capacityT * 1000;
  const L16 = L13 + inp.hookBlockWeightKg + inp.ropeWeightKg;
  const L18 = ropeSafetyFactor(mech, "moving");
  const L19 = L16 / inp.totalFalls / L11; // halat yükü [kg]
  const L20 = L19 * L18; // gerekli min kopma yükü [kg]
  const L28 = (sel.ropeBreakingLoadKn / 9.81) * 1000; // seçilen halat kopma yükü [kg]
  const L30 = L28 / L19; // gerçekleşen emniyet
  Object.assign(cells, { L9, L11, L13, L16, L18, L19, L20, L28, L30, O30: L18, R30: tick(L30 >= L18) });
  checks.push({
    id: `${which}.rope.safety`,
    label: "Halat emniyet katsayısı",
    required: L18, provided: L30, unit: "-", op: ">=", pass: L30 >= L18,
    standard: "FEM 1.001 T.4.2.2.1.2",
  });

  // --- 2.2.1 Tambur çapı ve gerilmeler -------------------------------------
  const L36 = drumCoefficient(mech); // H katsayısı
  const L37 = sel.ropeDiaMm;
  const L38 = L36 * L37; // min tambur çapı [mm]
  const L41 = groovePitch(sel.ropeDiaMm); // oluk adımı [mm]
  const L44 = (0.5 * L19 * 100) / L41 / inp.drumWallThicknessMm; // ezilme [kg/cm²]
  const L46 =
    0.96 * L19 * (1 / ((sel.drumDiaMm / 10) ** 2 * (inp.drumWallThicknessMm / 10) ** 6) ** 0.25); // eğilme
  const L48 = (L46 ** 2 + L44 ** 2 - L44 * L46) ** 0.5; // bileşik
  const L50 = drumAllowableStress(sel.drumMaterial);
  Object.assign(cells, { L36, L37, L38, L41, L44, L46, L48, L50, O50: L48, S50: tick(L50 >= L48) });
  checks.push({
    id: `${which}.drum.stress`,
    label: "Tambur bileşik gerilmesi",
    required: L48, provided: L50, unit: "kg/cm²", op: ">=", pass: L50 >= L48,
  });
  checks.push({
    id: `${which}.drum.dia`,
    label: "Tambur çapı (min H·d)",
    required: L38, provided: sel.drumDiaMm, unit: "mm", op: ">=", pass: sel.drumDiaMm >= L38,
    standard: "FEM 1.001 T.4.2.3.1.1", nonExcel: true,
  });

  // --- 2.2.2 Oluk boyu -----------------------------------------------------
  const L54 = inp.drivenFalls;
  const L55 = inp.totalFalls;
  const L56 = L41;
  const L57 = liftHeightM;
  const L60 = ((L55 / L54) * L57) / PI_EXCEL / (sel.drumDiaMm / 1000) + inp.safetyGrooveCount; // gerekli sarım
  const L62 = L60 * L41; // gerekli oluk boyu [mm]
  Object.assign(cells, { L54, L55, L56, L57, L60, L62 });

  // --- 2.2.3 Tambur mili ---------------------------------------------------
  const L67 = L19;
  const { drumWeightKg: L69, shaftSpanACm: L70, shaftSpanBCm: L71, shaftSpanCCm: L72 } = inp;
  const L80 = (L67 * L70 + L67 * (2 * L71 + L70) + L69 * (L70 + L71)) / (L70 + 2 * L71 + L72); // Ra
  const L81 = 2 * L67 + L69 - L80; // Rb
  const L84 = L80 * inp.shaftMomentArmCm; // M [kg·cm]
  const L86 = (L84 * inp.shaftDiaCm) / 2 / ((PI_EXCEL / 4) * (inp.shaftDiaCm / 2) ** 4); // eğilme
  const L87 =
    (1.33 * Math.max(L80, L81)) / (PI_EXCEL * (inp.shaftShearDiaCm / 2) ** 2); // kesme
  const L88 = Math.sqrt(L86 ** 2 + L87 ** 2); // bileşik
  const shaftAllow = shaftMaterialAllowables(sel.shaftMaterial);
  const L92 = shaftAllow.bending;
  const L93 = shaftAllow.shear;
  const L94 = shaftAllow.combined;
  Object.assign(cells, { L67, L80, L81, L84, L86, L87, L88, L92, L93, L94 });
  checks.push({
    id: `${which}.shaft.stress`,
    label: "Tambur mili bileşik gerilmesi",
    required: L88, provided: L94, unit: "kg/cm²", op: ">=", pass: L94 >= L88,
    nonExcel: true,
  });

  // --- 2.3 Redüktör (tork; kaynak hesabı L107 tambur torkuna bağlı) --------
  const L158 = sel.drumDiaMm / 2000; // tambur yarıçapı [m]
  const L159 = inp.drivenFalls;
  const L160 = (L19 * 9.81) / 1000; // halat yükü [kN]
  const L162 = L158 * L159 * L160; // tambur torku [kNm]
  const L164 = L162 / inp.drumCount;
  const L167 = inp.gearboxServiceFactor * L164; // gerekli redüktör torku [kNm]

  // --- 2.2.4 Tambur kaynağı ------------------------------------------------
  const L98 = (Math.PI * sel.drumDiaMm) / 10; // kaynak boyu [cm]
  const L100 = inp.drumWeldThicknessCm * L98;
  const L103 = sel.drumDiaMm + 2 * inp.drumWeldThicknessCm * 10;
  const L104 = sel.drumDiaMm;
  const L105 = (Math.PI * ((L103 / 2) ** 2 - (L104 / 2) ** 2)) / 100; // halka alan [cm²]
  const L106 = (PI_EXCEL * ((L103 / 10) ** 4 - (L104 / 10) ** 4)) / 32; // polar modül [cm⁴→cm³]
  const L107 = (L164 * 100000) / 9.81 / L106; // burulma [kg/cm²]
  const L108 = L81 / L105; // kesme
  const L109 = L108 + L107; // bileşik
  Object.assign(cells, { L98, L100, L103, L104, L105, L106, L107, L108, L109 });
  checks.push({
    id: `${which}.drumWeld.stress`,
    label: "Tambur kaynağı gerilmesi",
    required: L109, provided: inp.drumWeldAllowable, unit: "kg/cm²", op: ">=",
    pass: inp.drumWeldAllowable >= L109, nonExcel: true,
  });

  // --- 2.2.5 Mil kaynağı ---------------------------------------------------
  const L114 = Math.PI * inp.shaftDiaCm;
  const L116 = inp.shaftWeldThicknessCm * L114;
  const L119 = inp.shaftDiaCm * 10 + 2 * inp.shaftWeldThicknessCm * 10;
  const L120 = inp.shaftDiaCm * 10;
  const L121 = (Math.PI * ((L119 / 2) ** 2 - (L120 / 2) ** 2)) / 100;
  const L122 = (PI_EXCEL * ((L119 / 10) ** 4 - (L120 / 10) ** 4)) / 32;
  const L124 = L81 / L121;
  const L125 = L124;
  Object.assign(cells, { L114, L116, L119, L120, L121, L122, L124, L125 });
  checks.push({
    id: `${which}.shaftWeld.stress`,
    label: "Mil kaynağı gerilmesi",
    required: L125, provided: inp.shaftWeldAllowable, unit: "kg/cm²", op: ">=",
    pass: inp.shaftWeldAllowable >= L125, nonExcel: true,
  });

  // --- 2.2.6 Tambur rulmanı ------------------------------------------------
  const L130 = L80 * 0.00981; // radyal [kN]
  const L131 = 0.1 * L130; // eksenel [kN]
  const L137 = L130 + L131 * inp.bearingFactorY1; // eşdeğer statik [kN]
  const L138 = L130 + inp.bearingFactorY2 * L131; // eşdeğer dinamik [kN]
  const L146 = sel.bearingStatC0Kn / L137; // statik emniyet
  const L149 = ((liftSpeedMpm * inp.totalFalls) / inp.drivenFalls) / (sel.drumDiaMm / 1000) / PI_EXCEL; // tambur devri [d/dak]
  const L150 = L149;
  const L152 = (1000000 / (60 * L150)) * (sel.bearingDynCKn / L138) ** (10 / 3); // L10 ömür [saat]
  const life = mechanismLife(usage);
  const L154 = life.min ?? 0;
  const Q154 = life.max;
  Object.assign(cells, {
    L130, L131, L137, L138, L146, L149, L150, L152, L154,
    ...(Q154 !== null ? { Q154 } : {}),
  });
  checks.push({
    id: `${which}.bearing.life`,
    label: "Tambur rulmanı ömrü",
    required: L154, provided: L152, unit: "saat", op: ">=", pass: L152 >= L154,
    standard: "FEM 1.001 T.2.1.3.2",
  });
  checks.push({
    id: `${which}.bearing.static`,
    label: "Rulman statik emniyeti",
    required: 1, provided: L146, unit: "-", op: ">=", pass: L146 >= 1, nonExcel: true,
  });

  // --- 2.3 Redüktör (seçim ve kontroller) ----------------------------------
  const L169 = sel.motorRpm;
  const L170 = L149;
  const L172 = L169 / L149; // gerekli çevrim oranı
  const L176 = sel.gearboxNominalTorqueKnm;
  const L179 = L176 / L164; // gerçekleşen emniyet
  const L182 = (100 * (sel.gearboxRatio - L172)) / L172; // oran sapması [%]
  const L184 = liftSpeedMpm;
  const L185 = (L169 / sel.gearboxRatio) * Math.PI * (sel.drumDiaMm / 1000) / (inp.totalFalls / inp.drivenFalls); // gerçekleşen hız
  const L187 = (L80 * 9.81) / 1000; // redüktöre gelen radyal yük [kN]
  Object.assign(cells, {
    L158, L159, L160, L162, L164, L167, L169, L170, L172,
    O176: tick(L176 >= L167), L179, L182, O182: tick(L182 <= 5 && L182 >= -10),
    L184, L185, L187,
  });
  checks.push({
    id: `${which}.gearbox.torque`,
    label: "Redüktör tork kapasitesi",
    required: L167, provided: L176, unit: "kNm", op: ">=", pass: L176 >= L167,
  });
  checks.push({
    id: `${which}.gearbox.ratio`,
    label: "Çevrim oranı sapması",
    min: -10, max: 5, provided: L182, unit: "%", op: "range",
    pass: L182 <= 5 && L182 >= -10,
  });
  checks.push({
    id: `${which}.gearbox.radial`,
    label: "Redüktör radyal yük",
    required: L187, provided: sel.gearboxAllowedRadialKn, unit: "kN", op: ">=",
    pass: sel.gearboxAllowedRadialKn >= L187, nonExcel: true,
  });

  // --- 2.4 Motor -----------------------------------------------------------
  const L192 = L164 * 1000; // çıkış torku [Nm]
  const L193 = sel.gearboxRatio;
  const L197 = inp.stageEfficiency ** inp.reducerStages; // redüktör verimi
  const L199 = L192 / (L193 * L197); // motor giriş torku [Nm]
  const L200 = sel.motorRpm;
  const L202 = (L199 * L200) / 9550; // gerekli güç [kW]
  const L204 = inp.tempFactor * L202;
  const L206 = L204 / inp.motorDivisor;
  const L212 = sel.motorCount * sel.motorPowerKw;
  const I215 = sel.motorPowerKw * sel.motorCount;
  const L215 = L204;
  Object.assign(cells, {
    L192, L193, L197, L199, L200, L202, L204, L206, L212, I215, L215,
    Q215: tick(I215 >= L215),
  });
  checks.push({
    id: `${which}.motor.power`,
    label: "Motor gücü",
    required: L215, provided: I215, unit: "kW", op: ">=", pass: I215 >= L215,
    standard: "CMAA 70 5.2.9.1.1",
  });

  // --- 2.5 Fren ------------------------------------------------------------
  const L218 = L199 / sel.motorCount; // fren miline gelen tork [Nm]
  const L220 = L218 * inp.brakeServiceFactor; // gerekli fren torku [Nm]
  const L228 = sel.brakeTorqueNm / L218; // gerçekleşen emniyet
  Object.assign(cells, {
    L218, L220, O224: L220, R224: tick(sel.brakeTorqueNm >= L220), L228,
  });
  if (which === "main") {
    // Excel'de sadece 02 sayfasında var: fren adedi × emniyet gösterimi
    Object.assign(cells, { Q228: sel.brakeQty * L228 });
  }
  checks.push({
    id: `${which}.brake.torque`,
    label: "Fren torku",
    required: L220, provided: sel.brakeTorqueNm, unit: "Nm", op: ">=",
    pass: sel.brakeTorqueNm >= L220,
  });

  // --- 2.6 Motor-redüktör kaplini ------------------------------------------
  const L233 = L199 / sel.motorCount;
  const L235 = L233 * inp.motorCouplingServiceFactor; // gerekli kapasite [Nm]
  const L236 = Math.max(sel.motorShaftMm, sel.gearboxInputShaftMm); // bağlanacak mil [mm]
  const L243 = sel.motorCouplingTorqueNm / L233;
  Object.assign(cells, {
    L233, L235, L236, O240: L235, O241: sel.motorShaftMm, L243,
  });
  checks.push({
    id: `${which}.motorCoupling.torque`,
    label: "Motor kaplini tork kapasitesi",
    required: L235, provided: sel.motorCouplingTorqueNm, unit: "Nm", op: ">=",
    pass: sel.motorCouplingTorqueNm >= L235,
  });
  checks.push({
    id: `${which}.motorCoupling.bore`,
    label: "Motor kaplini delik çapı",
    required: L236, provided: sel.motorCouplingDmaxMm, unit: "mm", op: ">=",
    pass: sel.motorCouplingDmaxMm >= L236,
  });

  // --- 2.7 Tambur kaplini --------------------------------------------------
  const L247 = L162 * 1000; // [Nm]
  const L249 = L247 / inp.drumCouplingDivisor;
  const L251 = L249 * inp.drumCouplingServiceFactor; // gerekli kapasite [Nm]
  const L252 = L80 * 9.81; // gerekli radyal [N]
  const L254 = sel.gearboxOutputShaftMm;
  const L262 = sel.drumCouplingTorqueNm / L249;
  Object.assign(cells, {
    L247, L249, L251, L252, L254,
    O258: L251, R258: tick(sel.drumCouplingTorqueNm >= L251),
    O259: L252, R259: tick(sel.drumCouplingRadialN >= L252),
    O260: L254, R260: tick(sel.drumCouplingDmaxMm >= L254),
    L262,
  });
  checks.push({
    id: `${which}.drumCoupling.torque`,
    label: "Tambur kaplini tork kapasitesi",
    required: L251, provided: sel.drumCouplingTorqueNm, unit: "Nm", op: ">=",
    pass: sel.drumCouplingTorqueNm >= L251,
  });
  checks.push({
    id: `${which}.drumCoupling.radial`,
    label: "Tambur kaplini radyal yük",
    required: L252, provided: sel.drumCouplingRadialN, unit: "N", op: ">=",
    pass: sel.drumCouplingRadialN >= L252,
  });
  checks.push({
    id: `${which}.drumCoupling.bore`,
    label: "Tambur kaplini delik çapı",
    required: L254, provided: sel.drumCouplingDmaxMm, unit: "mm", op: ">=",
    pass: sel.drumCouplingDmaxMm >= L254,
  });

  const values: HoistValues = {
    mechanicalAdvantage: L9,
    ropeEfficiency: L11,
    loadKg: L13,
    totalLoadKg: L16,
    requiredRopeSafety: L18,
    ropeLoadKg: L19,
    requiredBreakingKg: L20,
    actualBreakingKg: L28,
    actualRopeSafety: L30,
    drumCoefficientH: L36,
    minDrumDiaMm: L38,
    groovePitchMm: L41,
    drumBearingStress: L44,
    drumBendingStress: L46,
    drumCombinedStress: L48,
    drumAllowable: L50,
    requiredGrooves: L60,
    requiredGrooveLengthMm: L62,
    reactionAKg: L80,
    reactionBKg: L81,
    shaftMomentKgCm: L84,
    shaftBendingStress: L86,
    shaftShearStress: L87,
    shaftCombinedStress: L88,
    shaftAllowables: shaftAllow,
    drumWeldCombinedStress: L109,
    shaftWeldStress: L125,
    bearingRadialKn: L130,
    bearingAxialKn: L131,
    bearingEqStaticKn: L137,
    bearingEqDynamicKn: L138,
    bearingStaticSafety: L146,
    drumRpm: L149,
    bearingLifeHours: L152,
    requiredLifeMin: L154,
    requiredLifeMax: Q154,
    drumTorqueKnm: L164,
    requiredGearboxTorqueKnm: L167,
    requiredRatio: L172,
    ratioDeviationPct: L182,
    actualLiftSpeedMpm: L185,
    gearboxActualSafety: L179,
    gearboxRadialKn: L187,
    reducerEfficiency: L197,
    motorInputTorqueNm: L199,
    requiredPowerKw: L202,
    requiredPowerAdjustedKw: L204,
    installedPowerKw: I215,
    brakeShaftTorqueNm: L218,
    requiredBrakeTorqueNm: L220,
    brakeActualSafety: L228,
    requiredMotorCouplingTorqueNm: L235,
    couplingShaftDiaMm: L236,
    motorCouplingActualSafety: L243,
    requiredDrumCouplingTorqueNm: L251,
    requiredDrumCouplingRadialN: L252,
    drumCouplingActualSafety: L262,
  };

  return { values, checks, cells };
}

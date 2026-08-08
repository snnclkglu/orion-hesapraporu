// Mahal iklimlendirme yükü — kabin, elektrik odası ve pano yerleşimi ortak
// çekirdeği. Saf fonksiyon; DB/UI bağımlılığı yoktur.
//
// YÖNTEM (bir üretici tablosu değil, standart):
//   Q = iletim + güneş + ışınım + cihaz ısısı + taze hava   ⟶  × (1 + emniyet)
//
//   · İletim   : U·A·ΔT, U değeri EN ISO 6946 (Rsi 0,13 · Rse 0,04).
//   · Güneş    : ASHRAE güneş-hava (sol-air) sıcaklığı — AYRI bir kalem
//                değildir, iletimin İÇİNE girer. Yalnız açık havada.
//   · Işınım   : çevredeki sıcak yüzeylerden gelen yük. Uygulama BUNU
//                HESAPLAMAZ (yüzey sıcaklığı, görüş faktörü ve ısı kalkanı
//                bilinmeden hesaplanamaz); mühendis girer, girmezse sıfırdır
//                ve rapor bunu açıkça söyler.
//   · Taze hava: basınçlandırmayı ayakta tutan sızıntı debisinin TAM ENTALPİ
//                farkı (duyulur + gizli birlikte).
//
// İKİ NOKTA ÇOĞU HESAPTA ATLANIR, BURADA ATLANMAZ:
//
// 1. λ SICAKLIKLA ARTAR. Taş yününün beyan değeri 10 °C ortalama sıcaklıkta
//    verilir; yalıtımın gerçek ortalama sıcaklığı (dış+iç)/2'dir. 60 °C
//    ortamda bu 41 °C eder ve λ yaklaşık %15 yükselir — beyan değerini
//    doğrudan kullanmak ısı geçişini o kadar EKSİK hesaplar.
//
// 2. ISI KÖPRÜSÜ. Sandviç panelin çelik yüzeyleri, ekler ve karkas düz panel
//    U'sunu yükseltir. Düz plaka değeri gerçeği olduğundan iyi gösterir.
//
// KAPSAM SINIRI: bu bir ÖN BOYUTLANDIRMA ve KONTROL hesabıdır. Klimanın nihai
// kapasitesi; gerçek pano kayıpları, eşzamanlılık, mahallin gerçek
// sızdırmazlığı ve kondenser kirlenmesine göre üretici tarafından proje
// bazında doğrulanır.

/** Yalıtım sınıfı — mahal panelinin taş yünü kalınlığı. */
export type RoomInsulationKind = "rockWool50" | "rockWool100";

/** Mahallin bulunduğu ortam; açık havada güneş yükü devreye girer. */
export type InstallationEnvironment = "indoor" | "outdoor";

// ------------------------------------------------------------------ sabitler

/** EN ISO 6946 iç yüzey ısıl direnci [m²K/W]. */
export const R_SI = 0.13;
/** EN ISO 6946 dış yüzey ısıl direnci [m²K/W]. */
export const R_SE = 0.04;
/** Dış yüzey ısı taşınım katsayısı [W/m²K] — sol-air'de kullanılır (1/R_se). */
export const H_OUTER = 1 / R_SE;

/**
 * 85 kg/m³ taş yününün 10 °C beyan iletkenliği [W/mK] ve sıcaklık eğimi
 * [W/mK per K]. Firma kabulüdür: tedarikçinin EN 12667'ye göre beyan ettiği
 * λ_D varsa onunla değiştirilmelidir.
 */
export const ROCKWOOL_LAMBDA_10C = 0.036;
export const ROCKWOOL_LAMBDA_SLOPE = 0.00017;

/** Yalıtım sınıfının kalınlığı [m]. */
const THICKNESS: Record<RoomInsulationKind, number> = {
  rockWool50: 0.05,
  rockWool100: 0.10,
};

/** Panel ekleri ve çelik karkas için düz plaka U'suna eklenen pay. */
export const THERMAL_BRIDGE_FACTOR = 0.15;

/** Yalıtımlı çelik kapının ısı geçirgenliği [W/m²K] — firma kabulü. */
export const DOOR_U_VALUE = 2.0;

/** Standart kapı ölçüsü [m] — kapı alanı adetten türetilir. */
export const DOOR_WIDTH_M = 1.0;
export const DOOR_HEIGHT_M = 2.1;

/** Mahallin tasarım iç sıcaklığı [°C] ve bağıl nemi [%] — firma kabulü. */
export const ROOM_DESIGN_TEMP_C = 25;
export const ROOM_DESIGN_RH_PCT = 50;

/** Basınçlandırma farkı [Pa] — mahalde toz/kirli hava tutulmasını sağlar. */
export const PRESSURIZATION_PA = 4;

/** Sızıntı alanı payları [m²]: kapı çevresi ve kablo/kanal geçişleri. */
export const LEAKAGE_PER_DOOR_M2 = 0.0003;   //  3 cm²
export const LEAKAGE_FIXED_M2 = 0.0004;      //  4 cm² — kablo geçişleri, ekler

/** Üfleme havası ile mahal arasındaki tasarım sıcaklık farkı [K]. */
export const SUPPLY_AIR_DELTA_T = 8;

/** Standart atmosfer basıncı [Pa] ve kuru hava gaz sabiti [J/kgK]. */
const P_ATM = 101_325;
const R_DRY_AIR = 287.05;
/** Kuru hava ve su buharı özgül ısıları [J/kgK], buharlaşma ısısı [J/kg]. */
const CP_AIR = 1006;
const CP_VAPOUR = 1860;
const H_FG_0C = 2_501_000;

/**
 * Yüzeyin güneş soğurma katsayısı. Açık renk boya klimayı küçültür: α 0,3 ile
 * 0,7 arasında çatının güneş-hava sıcaklığı 15 K değişir.
 */
export const SOLAR_ABSORPTANCE = 0.5;

/**
 * Tasarım güneş ışınımı [W/m²] — Türkiye, yaz öğle saati. Duvarlar ÇATI ile
 * aynı saatte değerlendirilir: her yüzeyi kendi tepe saatiyle toplamak, aynı
 * anda gerçekleşmeyen yükleri üst üste koyardı. Küçük bir mahalde çatı baskın
 * olduğu için tasarım saati öğledir.
 */
export const SOLAR_ROOF_W_M2 = 950;
export const SOLAR_WALL_W_M2 = 350;
/** Yatay yüzeyin gökyüzüne uzun dalga ışınım kaybı düzeltmesi [K]. */
export const SKY_RADIATION_CORRECTION_K = 4;

// -------------------------------------------------------------- psikrometri

/** Doymuş buhar basıncı [Pa] — Magnus bağıntısı. */
export function saturationPressure(tempC: number): number {
  return 610.94 * Math.exp((17.625 * tempC) / (tempC + 243.04));
}

/** Nem oranı [kg su / kg kuru hava]. */
export function humidityRatio(tempC: number, rhPct: number): number {
  const pv = (rhPct / 100) * saturationPressure(tempC);
  return (0.622 * pv) / (P_ATM - pv);
}

/** Nemli hava entalpisi [J/kg kuru hava]. */
export function moistAirEnthalpy(tempC: number, rhPct: number): number {
  const w = humidityRatio(tempC, rhPct);
  return CP_AIR * tempC + w * (H_FG_0C + CP_VAPOUR * tempC);
}

/** Kuru hava yoğunluğu [kg/m³]. */
export function airDensity(tempC: number): number {
  return P_ATM / (R_DRY_AIR * (tempC + 273.15));
}

// ------------------------------------------------------------ zarf ısı geçişi

/** Taş yününün ortalama sıcaklığındaki ısıl iletkenliği [W/mK]. */
export function insulationLambda(meanTempC: number): number {
  return ROCKWOOL_LAMBDA_10C + ROCKWOOL_LAMBDA_SLOPE * (meanTempC - 10);
}

/**
 * Panelin ısı geçirgenliği [W/m²K] — EN ISO 6946 + λ(T) düzeltmesi + ısı
 * köprüsü payı.
 */
export function panelUValue(
  insulation: RoomInsulationKind,
  meanTempC: number,
  bridgeFactor = THERMAL_BRIDGE_FACTOR
): number {
  const d = THICKNESS[insulation] ?? THICKNESS.rockWool50;
  const flat = 1 / (R_SI + d / insulationLambda(meanTempC) + R_SE);
  return flat * (1 + bridgeFactor);
}

/**
 * Güneş-hava (sol-air) sıcaklığı [°C] — ASHRAE.
 * Güneşin etkisi ayrı bir yük kalemi değil, yüzeyin gördüğü sıcaklığın
 * yükselmesidir; iletim bu sıcaklıkla hesaplanır.
 */
export function solAirTemperature(
  outdoorTempC: number,
  irradianceWm2: number,
  horizontal: boolean,
  absorptance = SOLAR_ABSORPTANCE
): number {
  const skyLoss = horizontal ? SKY_RADIATION_CORRECTION_K : 0;
  return outdoorTempC + (absorptance * irradianceWm2) / H_OUTER - skyLoss;
}

// ------------------------------------------------------------------ ana hesap

export interface ClimateLoadInput {
  /** Mahal iç ölçüleri [m] */
  widthM: number;
  lengthM: number;
  heightM: number;
  insulation: RoomInsulationKind;
  /** Kapı adedi — hem zarf ısı geçişine hem sızıntıya girer. */
  doorCount: number;
  /** Dış ortam sıcaklığı [°C] ve bağıl nemi [%] (teknik özellikler). */
  ambientTempC: number;
  ambientRhPct: number;
  /** Kapalı mahal mi açık hava mı — güneş yükünü belirler. */
  environment: InstallationEnvironment;
  /** Mahalde üretilen cihaz ısısı [kW] (pano kayıpları, kumanda, aydınlatma). */
  deviceHeatKw: number;
  /** Çevredeki sıcak yüzeylerden gelen ilave ışınım yükü [kW]; bilinmiyorsa 0. */
  radiationKw: number;
  /** Emniyet katsayısı [%] — ortamın kirliliğine göre. */
  safetyFactorPct: number;
}

export interface ClimateLoadResult {
  /** Zarf yüzey alanı [m²] ve kapı alanı [m²] */
  envelopeAreaM2: number;
  doorAreaM2: number;
  /** Yalıtımın ortalama sıcaklığı [°C] ve o sıcaklıktaki U [W/m²K] */
  insulationMeanTempC: number;
  uValue: number;
  /** Çatının gördüğü güneş-hava sıcaklığı [°C] (kapalı mahalde dış sıcaklık) */
  roofSolAirTempC: number;
  wallSolAirTempC: number;
  /** Yük kalemleri [kW] */
  transmissionKw: number;
  /** Güneşin iletime kattığı fazladan yük [kW] — kapalı mahalde 0 */
  solarKw: number;
  radiationKw: number;
  deviceHeatKw: number;
  freshAirKw: number;
  /** Emniyet katsayısı öncesi ve sonrası [kW] */
  calculatedKw: number;
  totalKw: number;
  /** Basınçlandırma sızıntı debisi [m³/h] ve yoğuşan su [kg/h] */
  infiltrationM3h: number;
  condensateKgH: number;
  /** Gereken üfleme havası debisi [m³/h] */
  airFlowM3h: number;
}

const positive = (v: number | undefined): number =>
  Number.isFinite(v) && (v ?? 0) > 0 ? (v as number) : 0;

export function computeClimateLoad(inp: ClimateLoadInput): ClimateLoadResult {
  const w = positive(inp.widthM);
  const l = positive(inp.lengthM);
  const h = positive(inp.heightM);
  const roomTemp = ROOM_DESIGN_TEMP_C;
  const ambient = inp.ambientTempC;

  // --- Zarf ------------------------------------------------------------------
  const wallArea = 2 * (l * h) + 2 * (w * h);
  const roofArea = l * w;
  const envelopeAreaM2 = wallArea + 2 * roofArea;
  const doorArea = Math.max(0, Math.floor(positive(inp.doorCount))) * DOOR_WIDTH_M * DOOR_HEIGHT_M;
  // Kapı duvarın İÇİNDEDİR: panel alanından düşülür, yoksa aynı yüzey iki kez sayılır.
  const netWallArea = Math.max(0, wallArea - doorArea);

  const outdoor = inp.environment === "outdoor";
  const roofSolAir = outdoor
    ? solAirTemperature(ambient, SOLAR_ROOF_W_M2, true)
    : ambient;
  const wallSolAir = outdoor
    ? solAirTemperature(ambient, SOLAR_WALL_W_M2, false)
    : ambient;

  // λ, yalıtımın ORTALAMA sıcaklığında okunur; yüzey başına ayrı ayrı.
  const uFor = (surfaceTempC: number) =>
    panelUValue(inp.insulation, (surfaceTempC + roomTemp) / 2);

  // Döşeme güneş görmez ve mahal üstünde durduğu yüzeyin sıcaklığındadır;
  // dış hava sıcaklığı muhafazakâr bir kabuldür.
  const qWall = uFor(wallSolAir) * netWallArea * (wallSolAir - roomTemp);
  const qRoof = uFor(roofSolAir) * roofArea * (roofSolAir - roomTemp);
  const qFloor = uFor(ambient) * roofArea * (ambient - roomTemp);
  const qDoor = DOOR_U_VALUE * doorArea * (wallSolAir - roomTemp);
  const transmissionTotal = qWall + qRoof + qFloor + qDoor;

  // Güneşsiz durumdaki iletim — farkı "güneş yükü" olarak ayrı raporlanır ki
  // açık hava seçiminin etkisi rapordan okunabilsin.
  const uPlain = panelUValue(inp.insulation, (ambient + roomTemp) / 2);
  const dTPlain = ambient - roomTemp;
  const transmissionNoSun =
    uPlain * (netWallArea + 2 * roofArea) * dTPlain + DOOR_U_VALUE * doorArea * dTPlain;
  const solarKw = Math.max(0, transmissionTotal - transmissionNoSun) / 1000;
  const transmissionKw = transmissionNoSun / 1000;

  // --- Basınçlandırma sızıntısı ---------------------------------------------
  // Orifis denklemi: mahalde Δp fazla basıncı tutmak için üflenmesi gereken
  // debi, sızıntı açıklıklarından kaçan debiye eşittir.
  const leakageArea =
    Math.max(0, Math.floor(positive(inp.doorCount))) * LEAKAGE_PER_DOOR_M2 + LEAKAGE_FIXED_M2;
  const rhoOut = airDensity(ambient);
  const leakVelocity = Math.sqrt((2 * PRESSURIZATION_PA) / rhoOut);
  const infiltrationM3s = leakageArea * leakVelocity;
  const infiltrationM3h = infiltrationM3s * 3600;

  // --- Taze hava (duyulur + gizli, tam entalpi farkı) ------------------------
  const rhoRoom = airDensity(roomTemp);
  const mInfiltration = infiltrationM3s * rhoRoom; // kg/s
  const dEnthalpy =
    moistAirEnthalpy(ambient, inp.ambientRhPct) -
    moistAirEnthalpy(roomTemp, ROOM_DESIGN_RH_PCT);
  const freshAirKw = Math.max(0, (mInfiltration * dEnthalpy) / 1000);

  // Yoğuşan su: klimanın havadan aldığı nem.
  const dw =
    humidityRatio(ambient, inp.ambientRhPct) - humidityRatio(roomTemp, ROOM_DESIGN_RH_PCT);
  const condensateKgH = Math.max(0, mInfiltration * dw * 3600);

  // --- Toplam ---------------------------------------------------------------
  const deviceHeatKw = positive(inp.deviceHeatKw);
  const radiationKw = positive(inp.radiationKw);
  const calculatedKw = transmissionKw + solarKw + radiationKw + deviceHeatKw + freshAirKw;
  const totalKw = calculatedKw * (1 + positive(inp.safetyFactorPct) / 100);

  // --- Gereken üfleme debisi -------------------------------------------------
  const airFlowM3h =
    ((totalKw * 1000) / (rhoRoom * CP_AIR * SUPPLY_AIR_DELTA_T)) * 3600;

  return {
    envelopeAreaM2,
    doorAreaM2: doorArea,
    insulationMeanTempC: (ambient + roomTemp) / 2,
    uValue: uPlain,
    roofSolAirTempC: roofSolAir,
    wallSolAirTempC: wallSolAir,
    transmissionKw,
    solarKw,
    radiationKw,
    deviceHeatKw,
    freshAirKw,
    calculatedKw,
    totalKw,
    infiltrationM3h,
    condensateKgH,
    airFlowM3h,
  };
}

// Başlangıç girdi setleri.
//
// İki şablon vardır:
//   · V5_TEMPLATE       — İSDEMİR Amonyum Sülfat Vinci referans işi. Tarihsel
//                         doğrulama fikstürünün girdi tarafıdır; DEĞİŞTİRİLİRSE
//                         `__tests__/legacy` karşılaştırması bozulur.
//   · NEW_WORK_TEMPLATE — yeni bir hesap raporu açıldığında gelen değerler.
//                         ORION'un en çok ürettiği vinç tipi esas alınmıştır:
//                         20 m açıklık, 10 ton, tek kancalı, uzaktan kumandalı
//                         çift kirişli gezer köprülü vinç.

import type { CalcInput } from "./engine";
import { ROPE_POSITION_AUTO, type HoistInputs, type HoistSelections } from "./modules/hoistGroup";
import type { TechnicalSpecs } from "./types";
import {
  DEFAULT_ROOM_DOOR_HEIGHT_MM,
  DEFAULT_ROOM_DOOR_WIDTH_MM,
  DEFAULT_ROOM_PANEL_DEPTH_MM,
  DEFAULT_ROOM_PANEL_HEIGHT_MM,
  DEFAULT_ROOM_PANEL_WIDTH_MM,
  type CabinInputs,
  type CabinSelections,
} from "./modules/cabin";
import { STANDARD_SHEAVE_EFFICIENCY } from "./derive";
import { V5_HOOKBLOCK_INPUTS, V5_HOOKBLOCK_SELECTIONS } from "./defaults/hookBlock";
import {
  V5_BRIDGE_INPUTS,
  V5_BRIDGE_SELECTIONS,
  V5_TROLLEY_INPUTS,
  V5_TROLLEY_SELECTIONS,
} from "./defaults/travel";
import {
  V5_BUCKLING_INPUTS,
  V5_ENDCARRIAGE_INPUTS,
  V5_ENDCARRIAGE_SELECTIONS,
  V5_GIRDER_INPUTS,
  V5_GIRDER_SELECTIONS,
} from "./defaults/structural";
import { V5_WHEELLOAD_INPUTS, V5_WHEELLOAD_SELECTIONS } from "./defaults/wheelLoads";

export const V5_SPECS: TechnicalSpecs = {
  mainCapacityT: 4,
  mainLiftHeightM: 10,
  mainLiftSpeedMpm: 35,
  mainHoistEquipmentArrangement: "standard",
  mainDoubleDrumHookSystem: "doubleHookBlock",
  auxCapacityT: 5,
  auxLiftHeightM: 22,
  auxLiftSpeedMpm: 8,
  auxHoistEquipmentArrangement: "standard",
  auxDoubleDrumHookSystem: "doubleHookBlock",
  mono1HoistEquipmentArrangement: "standard",
  mono1DoubleDrumHookSystem: "doubleHookBlock",
  mono2HoistEquipmentArrangement: "standard",
  mono2DoubleDrumHookSystem: "doubleHookBlock",
  structureClass: "A6",
  hoistLoadClass: "H3/B4",
  hoistMechanismClass: "M6",
  hoistUsageClass: "T6",
  bridgeSpeedMpm: 60,
  bridgeMechanismClass: "M6",
  bridgeUsageClass: "T6",
  trolleySpeedMpm: 40,
  trolleyMechanismClass: "M6",
  trolleyUsageClass: "T6",
  hookType: "Kepçe",
  controlType: "Sabit Kabin + Uzaktan Kumanda",
  hoistBrakeType: "Eldro Fren",
  hoistSafetyBrake: "Ana ve Yardımcı Kaldırmada",
  travelBrakeType: "Eldro Fren",
  ambientTempMinC: -10,
  ambientTempMaxC: 40,
  ambientRelHumidityPct: 50,
  installationEnvironment: "indoor",
  supplyVoltage: "380 VAC, 3 Faz, 50 Hz",
  controlVoltage: "24 VDC",
  spanM: 17.5,
  hasOperatorCabin: "no",
  operatorCabinHasAirConditioner: "no",
  electricalAccommodationType: "none",
  electricalRoomHasAirConditioner: "no",
  electricalPanelHasAirConditioner: "no",
  // Konfigürasyon ve ağırlıklar
  travelArrangement: "traveling",
  auxTrolleyMode: "shared",
  monorailCount: 0,
  // Taşıyıcı kiriş düzeni AÇIKÇA yazılır: alan boş bırakılsaydı seçim
  // kutusu boş açılır ve "hangisi seçili" sorusu ekrandan
  // cevaplanamazdı. Değer, alanın hiç olmadığı eski revizyonların
  // okunuşuyla AYNIDIR (`girderArrangement()` → "iki").
  girderArrangement: "iki",
  mainTrolleyWeightT: 2.5,
  bridgeWeightT: 17,   // ana kirişler 15 t + başkirişler 2 t
  // Tamponlar — referans işte hidrolik tampon (GLHB 63/100) kullanılmıştır.
  // Çarpma hızı oranı: arabada %100 (muhafazakâr firma kabulü), köprüde %70
  // (FEM 1.001 md. 2.2.3.4.1). Bu iki değer referans hesabın davranışıdır.
  trolleyBufferType: "hidrolik",
  bridgeBufferType: "hidrolik",
  trolleyBufferImpactSpeedPct: 100,
  bridgeBufferImpactSpeedPct: 70,
};

export const V5_MAIN_HOIST_INPUTS: HoistInputs = {
  reevingLabel: "2/2",          // tahrikli/toplam halat kolu — hazır donanım
  drivenFalls: 2,
  totalFalls: 2,
  // Tarihsel V5 düzeni denge makaralıdır. Yeni iş şablonu aşağıda traversli
  // düzene geçer; eski referansın ekipman bölünümü değişmesin.
  ropeBalancingType: "equalizerSheave",
  balanceRopeCount: 2,
  ropeOrderLengthAuto: true,
  sheaveEfficiency: STANDARD_SHEAVE_EFFICIENCY,
  fixedSheaveCount: 0,
  hookBlockWeightKg: 3250,      // kepçe
  ropeWeightKg: 250,
  drumWallThicknessMm: 16,
  safetyGrooveCount: 3,
  drumWeightKg: 800,            // tambur ağırlığı W
  // Tambur mili ölçü zinciri (A…G, mm) — mesnetler arası 1300 mm, her iki
  // yanda 60 mm konsol (moment kolu), 2 x 220 mm yiv bölgesi.
  drumSpanAMm: 60,
  drumSpanBMm: 50,
  drumSpanCMm: 220,
  drumSpanDMm: 640,
  drumSpanEMm: 220,
  drumSpanFMm: 50,
  drumSpanGMm: 60,
  ropeLoadPosition: ROPE_POSITION_AUTO,
  shaftD1Mm: 60,                // D1 — eğilme gerilmesi kesiti
  shaftD2Mm: 50,                // D2 — yatak oturma çapı (kesme kesiti)
  drumWeldThicknessMm: 15,
  drumWeldAllowable: 156.9,     // kaynak izin gerilmesi [MPa] (≈1600 kg/cm²)
  shaftWeldThicknessMm: 10,
  shaftWeldAllowable: 156.9,    // kaynak izin gerilmesi [MPa] (≈1600 kg/cm²)
  bearingFactorY1: 2.8,
  bearingFactorY2: 2.8,
  drumCount: 1,
  gearboxServiceFactor: 1.5,
  reducerStages: 3,
  stageEfficiency: 0.99,
  tempFactor: 1,                // 40 °C
  motorDivisor: 1,
  brakeServiceFactor: 1.7,
  motorCouplingServiceFactor: 2,
  drumCouplingDivisor: 1,
  drumCouplingServiceFactor: 1.7,
  // Emniyet freni: aktarma koptuğunda yükü tutan tek eleman → statik yük
  // momentinin 1,5 katı istenir. Flanş payı montaj boşluğudur.
  safetyBrakeServiceFactor: 1.5,
  safetyBrakeFlangeClearanceMm: 140,
};

export const V5_MAIN_HOIST_SELECTIONS: HoistSelections = {
  // Halat dengeleme: soket standart Normal, loadcell markası Esit (kullanıcı
  // Kobastar seçebilir). Model/kapasite/MBL otomatik.
  balanceSocketType: "Normal",
  balanceLoadcellBrand: "Esit",
  ropeBrand: "Hasçelik",
  ropeDiaMm: 18,
  ropeConstruction: "6x36",
  ropeCore: "Çelik Öz",
  ropeWireStrength: 200,
  ropeBreakingLoadKn: 226,
  drumDiaMm: 400,
  drumMaterial: "St52",
  drumGrooveLengthText: "2 x 220",
  shaftMaterial: "C30",
  bearingType: "Çift Sıra Makaralı Rulman",
  bearingCode: "22212",
  bearingBoreMm: 60,
  bearingDynCKn: 159,
  bearingStatC0Kn: 166,
  bearingHousingBrand: "SKF",
  bearingHousingCode: "SE 212",
  bearingHousingSeries: "SE",
  bearingHousingCompatibleBearing: "22212",
  bearingHousingBoreMm: 60,
  bearingHousingWidthMm: 105,
  bearingHousingSeatType: "Silindirik yataklama",
  gearboxModel: "YILMAZ HT0823",
  gearboxRatio: 52.57,
  gearboxNominalTorqueKnm: 22,
  gearboxInputShaftMm: 55,
  gearboxOutputShaftMm: 120,
  gearboxWeightKg: 775,
  gearboxAllowedRadialKn: 60,
  motorPowerKw: 55,
  motorRpm: 1480,
  motorShaftMm: 70,
  motorBrand: "GAMAK",
  // Tarihsel V5 referansı motorun tip kodunu kaydetmiyordu; alan katalogdan
  // ürün seçilince dolar.
  motorModel: "",
  motorCount: 1,
  brakeBrand: "SİBRE",
  brakeModel: "SIBRE TE250 Ed 50/6",
  brakeTorqueNm: 850,
  brakeWheelDiaMm: 250,
  brakeQty: 2,
  motorCouplingBrand: "ÖZGÜN",
  motorCouplingModel: "B3-3",
  motorCouplingWheelDiaMm: 200,
  motorCouplingTorqueNm: 5500,
  motorCouplingDmaxMm: 75,
  drumCouplingBrand: "ÖZGÜN",
  drumCouplingModel: "J7",
  drumCouplingTorqueNm: 37000,
  drumCouplingRadialN: 88000,
  drumCouplingDmaxMm: 150,
  // Emniyet freni seçimi — tambur çapına göre en küçük uygun SIBRE SHI modeli
  safetyBrakeModel: "SHI 105",
  safetyBrakeAirGapMm: 2,
  safetyBrakeArrangement: "B · Çift fren — karşılıklı alt konsol",
  safetyBrakeFlangeDiaMm: 900,
  safetyBrakeFlangeThicknessMm: 25,
  safetyBrakeHydraulicUnit: "",
};

export const V5_AUX_HOIST_INPUTS: HoistInputs = {
  ...V5_MAIN_HOIST_INPUTS,
  reevingLabel: "2/4",
  totalFalls: 4,
  hookBlockWeightKg: 150,
  ropeWeightKg: 50,
  safetyGrooveCount: 2,
  gearboxServiceFactor: 1.8,
  tempFactor: 1.1,              // 60 °C
  brakeServiceFactor: 1.6,
  drumCouplingServiceFactor: 1.8,
  safetyBrakeServiceFactor: 1.5,
  safetyBrakeFlangeClearanceMm: 140,
};

export const V5_AUX_HOIST_SELECTIONS: HoistSelections = {
  ...V5_MAIN_HOIST_SELECTIONS,
  ropeDiaMm: 12,
  ropeBreakingLoadKn: 100.5,
  drumDiaMm: 290,
  drumGrooveLengthText: "2 x 730",
  gearboxModel: "SEW X3FS100",
  gearboxRatio: 86,
  gearboxNominalTorqueKnm: 6.8,
  gearboxOutputShaftMm: 90,
  motorPowerKw: 11,
  brakeModel: "TE200 Ed 23/5",
  brakeTorqueNm: 350,
  brakeWheelDiaMm: 315,
  drumCouplingModel: "J5",
  drumCouplingTorqueNm: 36800,
  drumCouplingRadialN: 18400,
  drumCouplingDmaxMm: 110,
  // Emniyet freni seçimi — tambur çapına göre en küçük uygun SIBRE SHI modeli
  safetyBrakeModel: "SHI 105",
  safetyBrakeAirGapMm: 2,
  safetyBrakeArrangement: "B · Çift fren — karşılıklı alt konsol",
  safetyBrakeFlangeDiaMm: 900,
  safetyBrakeFlangeThicknessMm: 25,
  safetyBrakeHydraulicUnit: "",
};

/** V5 işinin tam girdi seti — tarihsel doğrulama fikstürü */
/**
 * Kabin ve elektrik odası varsayılanları. Ölçüler ORION'un standart kabin ve
 * elektrik odası gabarisidir; klima seçimi BOŞ gelir — teknik özelliklerde
 * "var" denen mahalde katalogdan ürün seçilmesi bir kontroldür ve şablonun
 * doldurduğu bir ürün o kontrolü sessizce geçerdi.
 */
export const DEFAULT_CABIN_INPUTS: CabinInputs = {
  cabinWidthM: 2,
  cabinLengthM: 2.5,
  cabinHeightM: 2.4,
  cabinInsulation: "rockWool50",
  cabinDoorCount: 1,
  // Kumanda masası, ekranlar, aydınlatma ve operatör — küçük ve sabit.
  cabinDeviceHeatKw: 0.3,
  cabinRadiationKw: 0,
  cabinOccupantCount: 1,
  // Ön ve yan cam — kumanda kabininde tipik görüş alanı.
  cabinGlazingAreaM2: 2.5,
  cabinGlazingKind: "double",
  roomWidthM: 3,
  roomLengthM: 4,
  roomHeightM: 2.6,
  roomInsulation: "rockWool100",
  roomAcRedundancy: "none",
  roomDoorCount: 1,
  roomDoorWidthMm: DEFAULT_ROOM_DOOR_WIDTH_MM,
  roomDoorHeightMm: DEFAULT_ROOM_DOOR_HEIGHT_MM,
  roomPanelWidthsText: String(DEFAULT_ROOM_PANEL_WIDTH_MM),
  roomPanelHeightMm: DEFAULT_ROOM_PANEL_HEIGHT_MM,
  roomPanelDepthMm: DEFAULT_ROOM_PANEL_DEPTH_MM,
  roomDeviceHeatKw: 0,
  // Pano kaybı motor güçlerinden türetilir; mühendis anahtarı kapatıp kendi
  // elektrik taşeronundan gelen gerçek listeyi yazabilir.
  roomDeviceHeatAuto: true,
  roomRadiationKw: 0,
  panelCount: 1,
  panelIpClass: "IP55",
  panelAcRedundancy: "none",
  panelDeviceHeatKw: 0,
  panelDeviceHeatAuto: true,
  panelRadiationKw: 0,
};

export const DEFAULT_CABIN_SELECTIONS: CabinSelections = {
  cabinAcBrand: "", cabinAcModel: "", cabinAcSeries: "", cabinAcApplication: "",
  cabinAcCoolingKwMin: 0, cabinAcCoolingKwMax: 0, cabinAcAmbientMaxC: 0,
  roomAcBrand: "", roomAcModel: "", roomAcSeries: "", roomAcApplication: "",
  roomAcCoolingKwMin: 0, roomAcCoolingKwMax: 0, roomAcAmbientMaxC: 0,
  panelAcBrand: "", panelAcModel: "", panelAcSeries: "", panelAcApplication: "",
  panelAcCoolingKwMin: 0, panelAcCoolingKwMax: 0, panelAcAmbientMaxC: 0,
};

export const V5_TEMPLATE: CalcInput = {
  specs: V5_SPECS,
  mainHoist: { inputs: V5_MAIN_HOIST_INPUTS, selections: V5_MAIN_HOIST_SELECTIONS },
  auxHoist: { inputs: V5_AUX_HOIST_INPUTS, selections: V5_AUX_HOIST_SELECTIONS },
  hookBlock: { inputs: V5_HOOKBLOCK_INPUTS, selections: V5_HOOKBLOCK_SELECTIONS },
  trolley: { inputs: V5_TROLLEY_INPUTS, selections: V5_TROLLEY_SELECTIONS },
  bridge: { inputs: V5_BRIDGE_INPUTS, selections: V5_BRIDGE_SELECTIONS },
  // Teker yükleri bölümü Excel'de yoktu; şablona tam vinç kapsamı için eklendi
  // (PDF/ekipman duman testleri bu şablonu koşturur). Tarihsel karşılaştırma
  // modül modül eşleştiği için bu ekleme fikstürü etkilemez.
  wheelLoads: { inputs: V5_WHEELLOAD_INPUTS, selections: V5_WHEELLOAD_SELECTIONS },
  girder: { inputs: V5_GIRDER_INPUTS, selections: V5_GIRDER_SELECTIONS },
  buckling: { inputs: V5_BUCKLING_INPUTS },
  endCarriage: { inputs: V5_ENDCARRIAGE_INPUTS, selections: V5_ENDCARRIAGE_SELECTIONS },
  cabin: { inputs: DEFAULT_CABIN_INPUTS, selections: DEFAULT_CABIN_SELECTIONS },
};

// ------------------------------------------------------- Yeni iş şablonu

/**
 * Yeni bir hesap raporu açıldığında gelen teknik özellikler.
 * ORION'un en çok ürettiği vinç: 20 m açıklık, 10 ton tek kancalı ana kaldırma,
 * uzaktan kumandalı, manyetik frenli, iç ortamda çalışan çift kirişli vinç.
 */
export const NEW_WORK_SPECS: TechnicalSpecs = {
  spanM: 20,
  runwayLengthM: 60,
  structureClass: "A6",
  hoistLoadClass: "H3/B4",
  hookType: "DIN 15401 Tekli Kanca",
  controlType: "Uzaktan Kumanda",
  hasOperatorCabin: "no",
  operatorCabinHasAirConditioner: "no",

  electricalAccommodationType: "none",
  electricalRoomHasAirConditioner: "no",
  electricalPanelHasAirConditioner: "no",

  travelArrangement: "traveling",
  auxTrolleyMode: "shared",
  monorailCount: 0,
  // Taşıyıcı kiriş düzeni AÇIKÇA yazılır: alan boş bırakılsaydı seçim
  // kutusu boş açılır ve "hangisi seçili" sorusu ekrandan
  // cevaplanamazdı. Değer, alanın hiç olmadığı eski revizyonların
  // okunuşuyla AYNIDIR (`girderArrangement()` → "iki").
  girderArrangement: "iki",

  mainTrolleyWeightT: 2.5,
  bridgeWeightT: 12,

  mainCapacityT: 10,
  mainLiftHeightM: 10,
  mainLiftSpeedMpm: 4,
  mainHoistEquipmentArrangement: "standard",
  mainDoubleDrumHookSystem: "doubleHookBlock",
  hoistMechanismClass: "M6",
  hoistUsageClass: "T6",

  // Yardımcı kaldırma bölümü varsayılan olarak KAPALIDIR; açılırsa bu
  // değerlerle başlar.
  auxCapacityT: 2,
  auxLiftHeightM: 10,
  auxLiftSpeedMpm: 8,
  auxHoistEquipmentArrangement: "standard",
  auxDoubleDrumHookSystem: "doubleHookBlock",
  mono1HoistEquipmentArrangement: "standard",
  mono1DoubleDrumHookSystem: "doubleHookBlock",
  mono2HoistEquipmentArrangement: "standard",
  mono2DoubleDrumHookSystem: "doubleHookBlock",
  auxMechanismClass: "M6",
  auxUsageClass: "T6",

  trolleySpeedMpm: 20,
  trolleyMechanismClass: "M6",
  trolleyUsageClass: "T6",
  trolleyPowerSupply: "cableChain",

  bridgeSpeedMpm: 30,
  bridgeMechanismClass: "M6",
  bridgeUsageClass: "T6",
  bridgePowerSupply: "conductorBar",

  // Enerji besleme ayrıntısı proje bazında rapora isteğe bağlı girer.
  showFestoonDetailsInReport: false,

  hoistBrakeType: "Manyetik Fren",
  hoistSafetyBrake: "Yok",
  travelBrakeType: "Manyetik Fren",

  supplyVoltage: "380 VAC, 3 Faz, 50 Hz",
  controlVoltage: "24 VDC",

  ambientTempMinC: -10,
  ambientTempMaxC: 40,
  ambientRelHumidityPct: 50,
  installationEnvironment: "indoor",

  // Tamponlar — yeni işte hidrolik tampon varsayılır.
  trolleyBufferType: "hidrolik",
  bridgeBufferType: "hidrolik",
  trolleyBufferImpactSpeedPct: 100,
  bridgeBufferImpactSpeedPct: 70,
};

/**
 * Yeni işte kapalı gelen hesap bölümleri. En yaygın vinçte yardımcı kaldırma,
 * buruşma ve başkiriş bölümleri hesaplanmaz; kanca bloğu ve ana kiriş açıktır.
 *
 * Vinç konfigürasyonundan doğan bölümler (yardımcı araba, monoray grupları)
 * bu listede YER ALMAZ: onları teknik özelliklerdeki seçim açar/kapatır
 * (`moduleAllowedByConfig`). Listeye konsalardı kullanıcı "2 Monoray" seçtiğinde
 * bölümler yine kapalı kalır, ayrıca kutucuk işaretlemesi gerekirdi.
 */
export const NEW_WORK_DISABLED_MODULES: readonly string[] = [
  "aux",
  "auxHookBlock",
  "buckling",
  "endCarriage",
];

/**
 * Yeni işte otomatik doldurulan kaldırma girdileri açık gelir.
 * Donanım 2/4: 10 tonluk tek kancalı bir ana kaldırmada halat yükünü Ø18
 * halatın emniyet katsayısını sağlayacak düzeye indiren yaygın seçim.
 */
const NEW_WORK_HOIST_INPUTS: HoistInputs = {
  ...V5_MAIN_HOIST_INPUTS,
  ropeBalancingType: "equalizerBeam",
  // Başlangıç rulmanı 22212'nin iç çapı Ø60 ile birebir eşleşir.
  shaftD2Mm: 60,
  reevingLabel: "2/4",
  drivenFalls: 2,
  totalFalls: 4,
  sheaveEfficiency: STANDARD_SHEAVE_EFFICIENCY,
  ropeWeightAuto: true,
  hookBlockWeightAuto: true,
  tempFactorAuto: true,
  sheaveEfficiencyAuto: true,
  drumGrooveLengthAuto: true,
  ropeOrderLengthAuto: true,
  drumGrooveSpanAuto: true,
  drumSpanCMm: 380,
  drumSpanEMm: 380,
  drumWeightAuto: true,
  gearboxServiceFactor: 1.3,
  gearboxServiceFactorAuto: true,
  drumCouplingServiceFactor: 1.5,
  drumCouplingServiceFactorAuto: true,
  // Otomatik türetmenin bu şablon için verdiği değer — şablon kendi içinde
  // tutarlı olsun (editör açılmadan üretilen PDF/Excel de aynı sayıyı görsün).
  drumWeightKg: 460,
  // Rulman markası kutuları ORTAK markaya bağlı açılır (bkz.
  // `calc/bearing-brand.ts`): mühendis markayı bir kez seçer, bütün rulman
  // kutuları onu gösterir. Bir kutunun anahtarı kapatılarak ayrıştırılabilir.
  bearingBrandAuto: true,
  balanceBearingBrandAuto: true,
};

const NEW_WORK_HOIST_SELECTIONS: HoistSelections = {
  ...V5_MAIN_HOIST_SELECTIONS,
  // KAPLİN VE REDÜKTÖR SİPARİŞ STANDARTLARI (kullanıcı kararı, 24.08.2026):
  // keçe standart O-Ring, tambur kaplini aşınma indikatörsüz, redüktör
  // opsiyonsuz. Üçü de standart olduğu sürece ekipman listesine YAZILMAZ.
  motorCouplingSealType: "Standart O-Ring",
  drumCouplingSealType: "Standart O-Ring",
  drumCouplingWearDetection: "Standart",
  // MOTOR SİPARİŞ STANDARTLARI (kullanıcı kararı, 24.08.2026): yalıtım F,
  // çalışma sınıfı S1, sargı koruması yok. Üçü de kutudan değiştirilebilir;
  // burada duran şey firmanın varsayılan siparişidir.
  motorInsulationClass: "F",
  motorDutyType: "S1",
  motorThermalProtection: "Yok",
  // Fren kasnağı = kaplin kasnağı olmalı (servis freni kaplinin kasnağı
  // üzerinde oturur; brake.wheelMatch uyarısı). Fren kasnağı Ø250 olduğundan
  // kaplin kasnağı da Ø250 gelir — yeni iş tutarlı başlasın.
  motorCouplingWheelDiaMm: 250,
  ropeWeightKgPerM: 1.33,
  drumGrooveLengthText: "2 x 380",   // 2/4 donanım, 10 m, Ø400 → otomatik
  shaftMaterial: "S355JR",
};

const NEW_WORK_AUX_HOIST_INPUTS: HoistInputs = {
  ...V5_AUX_HOIST_INPUTS,
  ropeBalancingType: "equalizerBeam",
  shaftD2Mm: 60,
  sheaveEfficiency: STANDARD_SHEAVE_EFFICIENCY,
  ropeWeightAuto: true,
  hookBlockWeightAuto: true,
  tempFactorAuto: true,
  sheaveEfficiencyAuto: true,
  drumGrooveLengthAuto: true,
  ropeOrderLengthAuto: true,
  drumGrooveSpanAuto: true,
  drumSpanCMm: 336,
  drumSpanEMm: 336,
  drumWeightAuto: true,
  gearboxServiceFactor: 1.3,
  gearboxServiceFactorAuto: true,
  drumCouplingServiceFactor: 1.5,
  drumCouplingServiceFactorAuto: true,
  drumWeightKg: 270,
  // Rulman markası kutuları ORTAK markaya bağlı açılır (bkz.
  // `calc/bearing-brand.ts`): mühendis markayı bir kez seçer, bütün rulman
  // kutuları onu gösterir. Bir kutunun anahtarı kapatılarak ayrıştırılabilir.
  bearingBrandAuto: true,
  balanceBearingBrandAuto: true,
};

const NEW_WORK_AUX_HOIST_SELECTIONS: HoistSelections = {
  ...V5_AUX_HOIST_SELECTIONS,
  // KAPLİN VE REDÜKTÖR SİPARİŞ STANDARTLARI (kullanıcı kararı, 24.08.2026):
  // keçe standart O-Ring, tambur kaplini aşınma indikatörsüz, redüktör
  // opsiyonsuz. Üçü de standart olduğu sürece ekipman listesine YAZILMAZ.
  motorCouplingSealType: "Standart O-Ring",
  drumCouplingSealType: "Standart O-Ring",
  drumCouplingWearDetection: "Standart",
  // MOTOR SİPARİŞ STANDARTLARI (kullanıcı kararı, 24.08.2026): yalıtım F,
  // çalışma sınıfı S1, sargı koruması yok. Üçü de kutudan değiştirilebilir;
  // burada duran şey firmanın varsayılan siparişidir.
  motorInsulationClass: "F",
  motorDutyType: "S1",
  motorThermalProtection: "Yok",
  // Fren seçimi kendi içinde tutarlı gelir: TE200/30/5 (kasnak Ø200, ayar
  // 85..400 Nm) → kasnak 200 mm, tork 350 Nm aralıkta. Kaplin kasnağı da 200
  // (V5_MAIN'den devralınır). Böylece yeni iş fren/kaplin uyarısı üretmez.
  brakeModel: "TE200/30/5",
  brakeWheelDiaMm: 200,
  ropeWeightKgPerM: 0.59,
  drumGrooveLengthText: "2 x 336",   // 24 tam yiv × 14 mm hatve
  shaftMaterial: "S355JR",
};

/** 2/4 donanımın iki makarası: merkezden ±75 mm, askı sacları ±125 mm. */
const NEW_WORK_HOOKBLOCK_INPUTS = {
  ...V5_HOOKBLOCK_INPUTS,
  shaftSupportOffsetMm: 125,
  shaftSheaveOffsetsText: "75",
  // Rulman markası kutuları ORTAK markaya bağlı açılır (bkz.
  // `calc/bearing-brand.ts`): mühendis markayı bir kez seçer, bütün rulman
  // kutuları onu gösterir. Bir kutunun anahtarı kapatılarak ayrıştırılabilir.
  sheaveBearingBrandAuto: true,
  hookBearingBrandAuto: true,
};

const NEW_WORK_HOOKBLOCK_SELECTIONS = {
  ...V5_HOOKBLOCK_SELECTIONS,
  // Yeni iş donanımı 2/4'tür: toplam dört halat kolu / 2 = iki makara.
  sheaveCount: 2,
};

/**
 * Yeni işte yürütme girdileri: CMAA 70 servis faktörü Ks ve ivmelenme tork
 * faktörü Kt OTOMATİK gelir.
 *
 * · Ks — Tablo 5.2.9.1.2.1-E: satır = CMAA uygulama sınıfı (M6 → D), sütun =
 *   tahrik/kumanda tipi (AC manyetik). D × AC manyetik = **1,1**.
 * · Kt — Tablo 5.2.9.1.2.1-C: AC bilezikli rotor (Mill) + kontaktör-direnç
 *   satırı 1,5–1,7; alt uç **1,5** kullanılır.
 *
 * Şablondaki sayılar türetmenin verdiği değerlerle BİREBİR aynıdır (editör
 * açılmadan üretilen PDF/Excel de aynı sayıyı görsün).
 *
 * DİKKAT: Referans V5 işi Ks'yi ELLE 1,0 girmişti; o fikstürde otomatik
 * kapalıdır (bkz. `defaults/travel.ts`). Yeni işlerde tablodan gelen 1,1
 * kullanılır ve gerekli yürütme motoru gücü %10 artar.
 */
const NEW_WORK_TROLLEY_INPUTS = {
  ...V5_TROLLEY_INPUTS,
  driveCount: 2,
  motorCountAuto: true,
  serviceFactorKs: 1.1,
  serviceFactorKsAuto: true,
  accelTorqueFactorKt: 1.5,
  accelTorqueFactorKtAuto: true,
  gearboxServiceFactor: 1.6,
  gearboxServiceFactorAuto: true,
  // Araba yürütme freni köprüyle aynı yöntemle hesaplanır.
  brakeServiceFactor: 1.6,
  // İvme mekanizma sınıfından gelir (M6 → 0,15); anahtar kapatılıp elle
  // düzeltilebilir (bkz. `travelAcceleration`).
  accelerationMs2: 0.15,
  accelerationAuto: true,
  // TAHVİL ORANI SEÇİM BEKLİYOR: kutu gereken orana eşitlenir, kırmızı basar
  // ve 5.5 bölümü redüktör seçilene kadar UYGUN DEĞİLDİR (`gearboxRatioAuto`).
  gearboxRatioAuto: true,
  // Rulman markası kutuları ORTAK markaya bağlı açılır (bkz.
  // `calc/bearing-brand.ts`): mühendis markayı bir kez seçer, bütün rulman
  // kutuları onu gösterir. Bir kutunun anahtarı kapatılarak ayrıştırılabilir.
  bearingBrandAuto: true,
};

const NEW_WORK_BRIDGE_INPUTS = {
  ...V5_BRIDGE_INPUTS,
  driveCount: 2,
  motorCountAuto: true,
  serviceFactorKs: 1.1,
  serviceFactorKsAuto: true,
  accelTorqueFactorKt: 1.5,
  accelTorqueFactorKtAuto: true,
  gearboxServiceFactor: 1.6,
  gearboxServiceFactorAuto: true,
  accelerationMs2: 0.15,
  accelerationAuto: true,
  gearboxRatioAuto: true,
  // Rulman markası kutuları ORTAK markaya bağlı açılır (bkz.
  // `calc/bearing-brand.ts`): mühendis markayı bir kez seçer, bütün rulman
  // kutuları onu gösterir. Bir kutunun anahtarı kapatılarak ayrıştırılabilir.
  bearingBrandAuto: true,
};

/**
 * Yeni iş şablonunun tahvil oranları GEREKEN ORANA EŞİTLENMİŞTİR — türetmenin
 * (`deriveTravelInputs`) editör açılır açılmaz yazacağı sayının aynısı, dört
 * basamağa yuvarlanmış hâli:
 *   · araba : 1480 d/dak ÷ (20 m/dak ÷ (Ø250 mm ÷ 1000) ÷ π) = 58,1195
 *   · köprü : 1480 d/dak ÷ (30 m/dak ÷ (Ø315 mm ÷ 1000) ÷ π) = 48,8203
 * Şablon kendi içinde tutarlı kalsın diye burada da yazılıdır: editör hiç
 * açılmadan üretilen PDF/Excel aynı sayıyı görür.
 *
 * BEDELİ BİLİNÇLİDİR: şablonun katalog redüktörü (i = 29 / 24) bu oranı
 * karşılamaz, dolayısıyla yeni bir rapor 5.5'te "UYGUN DEĞİL" ile açılır.
 * İstenen budur — mühendis önce motoru seçer, sonra gerçek redüktörü.
 */
const NEW_WORK_TROLLEY_SELECTIONS = {
  ...V5_TROLLEY_SELECTIONS,
  // KAPLİN VE REDÜKTÖR SİPARİŞ STANDARTLARI (kullanıcı kararı, 24.08.2026):
  // keçe standart O-Ring, tambur kaplini aşınma indikatörsüz, redüktör
  // opsiyonsuz. Üçü de standart olduğu sürece ekipman listesine YAZILMAZ.
  motorCouplingSealType: "Standart O-Ring",
  wheelCouplingSealType: "Standart O-Ring",
  motorCount: 2,
  // MOTOR SİPARİŞ STANDARTLARI (kullanıcı kararı, 24.08.2026): yalıtım F,
  // çalışma sınıfı S1, sargı koruması yok. Üçü de kutudan değiştirilebilir;
  // burada duran şey firmanın varsayılan siparişidir.
  motorInsulationClass: "F",
  motorDutyType: "S1",
  motorThermalProtection: "Yok",
  gearboxRatio: 58.1195,
  // Kauçuk tampon seçilirse gövde malzemesi varsayılan N (doğal kauçuk).
  bufferRubberQuality: "N",
};

/**
 * Ks = 1,1 ile köprü yürütmesinde gerekli güç artar; referans işte Ks = 1,0
 * elle girilmişti. Yeni iş
 * şablonu bu yüzden 2 × 4 kW motorla gelir — şablonun kendi içinde tutarlı
 * olması, açılır açılmaz "UYGUN DEĞİL" gösteren bir rapordan iyidir.
 */
const NEW_WORK_BRIDGE_SELECTIONS = {
  ...V5_BRIDGE_SELECTIONS,
  // KAPLİN VE REDÜKTÖR SİPARİŞ STANDARTLARI (kullanıcı kararı, 24.08.2026):
  // keçe standart O-Ring, tambur kaplini aşınma indikatörsüz, redüktör
  // opsiyonsuz. Üçü de standart olduğu sürece ekipman listesine YAZILMAZ.
  motorCouplingSealType: "Standart O-Ring",
  wheelCouplingSealType: "Standart O-Ring",
  motorPowerKw: 4,
  // MOTOR SİPARİŞ STANDARTLARI (kullanıcı kararı, 24.08.2026): yalıtım F,
  // çalışma sınıfı S1, sargı koruması yok. Üçü de kutudan değiştirilebilir;
  // burada duran şey firmanın varsayılan siparişidir.
  motorInsulationClass: "F",
  motorDutyType: "S1",
  motorThermalProtection: "Yok",
  gearboxRatio: 48.8203,
  bufferRubberQuality: "N",
};

/**
 * Yeni iş başlangıç şablonu — bütün bölümlerin verisi doludur (kapalı bölümler
 * de dâhil), böylece bir bölüm sonradan açıldığında makul değerlerle gelir.
 * Hangi bölümlerin hesaba gireceğini `NEW_WORK_DISABLED_MODULES` belirler.
 */
export const NEW_WORK_TEMPLATE: CalcInput = {
  specs: NEW_WORK_SPECS,
  mainHoist: { inputs: NEW_WORK_HOIST_INPUTS, selections: NEW_WORK_HOIST_SELECTIONS },
  auxHoist: { inputs: NEW_WORK_AUX_HOIST_INPUTS, selections: NEW_WORK_AUX_HOIST_SELECTIONS },
  mono1Hoist: { inputs: NEW_WORK_AUX_HOIST_INPUTS, selections: NEW_WORK_AUX_HOIST_SELECTIONS },
  mono2Hoist: { inputs: NEW_WORK_AUX_HOIST_INPUTS, selections: NEW_WORK_AUX_HOIST_SELECTIONS },
  hookBlock: { inputs: NEW_WORK_HOOKBLOCK_INPUTS, selections: NEW_WORK_HOOKBLOCK_SELECTIONS },
  auxHookBlock: { inputs: NEW_WORK_HOOKBLOCK_INPUTS, selections: NEW_WORK_HOOKBLOCK_SELECTIONS },
  mono1HookBlock: { inputs: NEW_WORK_HOOKBLOCK_INPUTS, selections: NEW_WORK_HOOKBLOCK_SELECTIONS },
  mono2HookBlock: { inputs: NEW_WORK_HOOKBLOCK_INPUTS, selections: NEW_WORK_HOOKBLOCK_SELECTIONS },
  trolley: { inputs: NEW_WORK_TROLLEY_INPUTS, selections: NEW_WORK_TROLLEY_SELECTIONS },
  auxTrolley: { inputs: NEW_WORK_TROLLEY_INPUTS, selections: NEW_WORK_TROLLEY_SELECTIONS },
  mono1Trolley: { inputs: NEW_WORK_TROLLEY_INPUTS, selections: NEW_WORK_TROLLEY_SELECTIONS },
  mono2Trolley: { inputs: NEW_WORK_TROLLEY_INPUTS, selections: NEW_WORK_TROLLEY_SELECTIONS },
  bridge: { inputs: NEW_WORK_BRIDGE_INPUTS, selections: NEW_WORK_BRIDGE_SELECTIONS },
  wheelLoads: {
    inputs: {
      ...V5_WHEELLOAD_INPUTS,
      measurementsConfirmed: false,
      guideClearanceMm: 7.5,
      guideClearanceAuto: true,
      coupledPairCount: 0,
      coupledPairAuto: false,
      creepSpeedMpm: NEW_WORK_SPECS.mainLiftSpeedMpm * 0.1,
      creepSpeedAuto: true,
      hoistingClassAuto: true,
    },
    selections: {
      ...V5_WHEELLOAD_SELECTIONS,
      hoistingClass: "HC2",
      hoistDriveClass: "HD3",
      wheelPairMode: "IFF",
    },
  },
  girder: {
    // 7.2 / 7.3'ün üç katsayısı (ψhA, ψhK, γc) yeni işte OTOMATİKtir: kütle
    // oranından ve çelik yapı sınıfından türetilip kutulara yazılır.
    inputs: {
      ...V5_GIRDER_INPUTS,
      loadMeasurementsConfirmed: false,
      diaphragmSpacingMm: 1500,
      deflectionLimitRatio: 1000,
      psiHAAuto: true,
      psiHKAuto: true,
      amplifyYcAuto: true,
      hookTopPositionM: NEW_WORK_SPECS.mainLiftHeightM,
      hookTopPositionAuto: true,
      bridgeAxleSpacingM: 3,
      bridgeAxleSpacingAuto: true,
      wheelContactTMm: V5_GIRDER_INPUTS.t3Mm,
      wheelContactTAuto: true,
    },
    selections: V5_GIRDER_SELECTIONS,
  },
  // İKİNCİ ANA KİRİŞ TAKIMI şablonda HER ZAMAN doludur ama hesaba yalnız
  // "Dört Kirişli" seçildiğinde girer (`activeModules`). Şablonda bulunması
  // ZORUNLUDUR: `revision-load.fullInput` bölüm verisini buradan tamamlar ve
  // alan yoksa bölüm açıldığında girdisiz kalırdı. Başlangıç kesiti birinciyle
  // aynıdır; mühendis ikinci takımı kendi geometrisiyle değiştirir.
  girder2: {
    inputs: {
      ...V5_GIRDER_INPUTS,
      loadMeasurementsConfirmed: false,
      diaphragmSpacingMm: 1500,
      deflectionLimitRatio: 1000,
      psiHAAuto: true,
      psiHKAuto: true,
      amplifyYcAuto: true,
      hookTopPositionM: NEW_WORK_SPECS.auxLiftHeightM,
      hookTopPositionAuto: true,
      bridgeAxleSpacingM: 3,
      bridgeAxleSpacingAuto: true,
      wheelContactTMm: V5_GIRDER_INPUTS.t3Mm,
      wheelContactTAuto: true,
    },
    selections: V5_GIRDER_SELECTIONS,
  },
  buckling: { inputs: V5_BUCKLING_INPUTS },
  endCarriage: { inputs: V5_ENDCARRIAGE_INPUTS, selections: V5_ENDCARRIAGE_SELECTIONS },
  cabin: { inputs: DEFAULT_CABIN_INPUTS, selections: DEFAULT_CABIN_SELECTIONS },
};

// Kabin ve elektrik odası — operatör kabini, elektrik odası / pano yerleşimi
// ve bunların iklimlendirmesi.
//
// NEDEN AYRI BİR BÖLÜM: klima bir KATALOG ÜRÜNÜDÜR (TMS, `kind =
// "air_conditioner"`) ve uygulamada katalogdan seçim yalnız hesap
// bölümlerinde yapılır. Teknik özelliklerde bu yüzden yalnız "kabin var mı",
// "elektrik yerleşimi ne" ve "klima var mı" sorulur; ölçüler, izolasyon,
// kurulu yedek düzeni ve ürünün kendisi buraya aittir.
//
// ISI YÜKÜ BURADA HESAPLANIR. Çekirdek `calc/climate-load.ts`tedir (zarf ısı
// geçişi + güneş + basınçlandırma sızıntısı + psikrometri); bu dosya yalnız
// mahallin girdilerini toplar ve üç kontrolü üretir:
//   1. Klima "var" denen mahalde katalogdan gerçekten bir ürün seçilmiş mi,
//   2. Seçilen ürünün ORTAM SICAKLIĞI üst sınırı projeninkini karşılıyor mu,
//   3. Seçilen ürünün SOĞUTMA KAPASİTESİ hesaplanan yükü karşılıyor mu.
//
// GİRDİ EN AZDA TUTULUR. Oda tasarım sıcaklığı/nemi, basınçlandırma farkı,
// üfleme sıcaklık farkı ve sızıntı açıklıkları firma kabulü olarak sabittir
// (climate-load.ts). Mühendisten yalnız şunlar istenir: mahal ölçüleri,
// izolasyon, KAPI ADEDİ ve — bilinmiyorsa boş bırakılan — ilave ışınım yükü.
// Pano kayıp gücü seçilmiş MOTOR GÜÇLERİNDEN otomatik türetilir; sürücü gücü
// ayrıca sorulmaz (bkz. `drive-losses.ts`).
//
// KAPSAM SINIRI: bu bir ÖN BOYUTLANDIRMA ve KONTROLdür; nihai kapasite
// üreticinin proje bazlı teyidine tabidir ve rapor bunu açıkça yazar.

import {
  CABIN_DOOR_SIZE_M,
  computeClimateLoad,
  ROOM_DESIGN_TEMP_C,
  ROOM_DOOR_SIZE_M,
  type ClimateLoadResult,
  type GlazingKind,
  type InstallationEnvironment,
  type RoomInsulationKind,
} from "../climate-load";
import type { DriveHeatItem } from "../drive-losses";
import type { AnyCheck, ModuleResult, TechnicalSpecs } from "../types";

/** Elektrik odasında seçilebilen standart pano gözü enleri [mm]. */
export const ROOM_PANEL_WIDTH_OPTIONS_MM = [400, 500, 600, 700, 800, 1000, 1200] as const;
/** Bütün oda panolarında ortak gövde yüksekliği seçenekleri [mm]. */
export const ROOM_PANEL_HEIGHT_OPTIONS_MM = [1400, 1600, 1800, 2000] as const;
/** Bütün oda panolarında ortak gövde derinliği seçenekleri [mm]. */
export const ROOM_PANEL_DEPTH_OPTIONS_MM = [400, 600, 700] as const;
/** Her pano gövdesinin altındaki sabit baza yüksekliği [mm]. */
export const ROOM_PANEL_BASE_HEIGHT_MM = 200;
export const DEFAULT_ROOM_PANEL_WIDTH_MM = 800;
export const DEFAULT_ROOM_PANEL_HEIGHT_MM = 1800;
export const DEFAULT_ROOM_PANEL_DEPTH_MM = 600;
export const DEFAULT_ROOM_DOOR_WIDTH_MM = 800;
export const DEFAULT_ROOM_DOOR_HEIGHT_MM = 2000;

/** Bir mahallin iklimlendirme seçimi — kabin, elektrik odası ve pano ortak. */
export interface AirConditionerPick {
  brand: string;
  model: string;
  series: string;
  /** Katalog kullanım grubu: panel | industrial | heavy_industrial */
  application: string;
  coolingKwMin: number;
  coolingKwMax: number;
  /** Katalogun ortam sıcaklığı üst sınırı [°C]; verilmemişse 0 */
  ambientMaxC: number;
  datasheetUrl: string;
}

export interface CabinInputs {
  // --- Operatör kabini
  cabinWidthM: number;
  cabinLengthM: number;
  cabinHeightM: number;
  /** Taş yünü izolasyon kalınlığı sınıfı (`RoomInsulation`) */
  cabinInsulation: string;
  /** Kapı adedi — zarf ısı geçişine ve basınçlandırma sızıntısına girer. */
  cabinDoorCount: number;
  /**
   * Kabinde üretilen ısı [kW]: kumanda masası, ekranlar, aydınlatma ve
   * operatör. Pano kaybı yoktur; küçük ve sabit bir değerdir.
   */
  cabinDeviceHeatKw: number;
  /**
   * Çevredeki sıcak yüzeylerden gelen ilave ışınım yükü [kW].
   * BOŞ BIRAKILABİLİR: ışınım görüş hattı ister; kabin sıcak yükü doğrudan
   * görmüyorsa ya da arada ısı kalkanı varsa yük ihmal edilebilir düzeydedir.
   * Sıfır bırakıldığında rapor bunu bilgilendirme kontrolüyle söyler.
   */
  cabinRadiationKw: number;
  /**
   * Kabindeki kişi adedi. İki şeyi birden belirler: operatörün duyulur + gizli
   * ısısı ve KİŞİ BAŞI TEMİZ HAVA gereği. İkincisi çoğu zaman basınçlandırma
   * sızıntısından büyüktür ve kabinin taze hava yükünü o belirler.
   */
  cabinOccupantCount: number;
  /**
   * Kabin camının toplam alanı [m²]. Kabini elektrik odasından ayıran şey
   * budur: tek cam panelin 13 katı ısı geçirir ve açık havada güneşi doğrudan
   * içeri alır.
   */
  cabinGlazingAreaM2: number;
  /** Cam tipi (`GlazingKind`): tek cam / çift cam / ısıcam + reflektif. */
  cabinGlazingKind: string;

  // --- Elektrik odası
  roomWidthM: number;
  roomLengthM: number;
  roomHeightM: number;
  roomInsulation: string;
  /** Kurulu yedek klima düzeni (`AirConditioningRedundancy`) */
  roomAcRedundancy: string;
  roomDoorCount: number;
  /** Elektrik odası kapısının net eni ve yüksekliği [mm]. */
  roomDoorWidthMm: number;
  roomDoorHeightMm: number;
  /**
   * Oda içindeki panoların enleri [mm], pano sırasıyla noktalı virgül ayrımlı.
   * Adet `panelCount` alanındadır; yükseklik ve derinlik bütün panolarda ortaktır.
   */
  roomPanelWidthsText: string;
  roomPanelHeightMm: number;
  roomPanelDepthMm: number;
  /** Pano kayıp gücü [kW]; otomatikken motor güçlerinden türetilir. */
  roomDeviceHeatKw: number;
  /** Pano kayıp gücü otomatik: seçilmiş motor güçlerinden (bkz. derive.ts). */
  roomDeviceHeatAuto?: boolean;
  roomRadiationKw: number;

  // --- Pano tipi yerleşim
  panelCount: number;
  /** Pano koruma sınıfı (IP54 / IP55 / IP65) */
  panelIpClass: string;
  panelAcRedundancy: string;
  panelDeviceHeatKw: number;
  panelDeviceHeatAuto?: boolean;
  panelRadiationKw: number;
}

/** Elektrik odası pano ve geçiş geometrisinin hesaplanmış görünümü. */
export interface RoomPanelLayout {
  count: number;
  widthsMm: number[];
  panelHeightMm: number;
  panelDepthMm: number;
  baseHeightMm: number;
  overallHeightMm: number;
  totalWidthMm: number;
  walkingClearanceMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
}

const positiveOr = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) && (value ?? 0) > 0 ? (value as number) : fallback;

/**
 * Pano en metnini adet kadar sıraya açar. Eski revizyonda en bulunmuyorsa veya
 * pano adedi sonradan artırılmışsa yeni satırlar 800 mm standartla gelir.
 */
export function roomPanelWidths(
  text: string | undefined,
  panelCount: number
): number[] {
  const count = Number.isFinite(panelCount) && panelCount > 0
    ? Math.floor(panelCount)
    : 0;
  const parsed = String(text ?? "")
    .split(/[;|]+/)
    .map((part) => Number(part.trim().replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0);
  return Array.from({ length: count }, (_, index) =>
    parsed[index] ?? DEFAULT_ROOM_PANEL_WIDTH_MM
  );
}

/** “Yeni Pano Ekle” işlemi: sayacı artırır ve eksik yeni eni 800 mm tamamlar. */
export function addRoomPanel(
  text: string | undefined,
  panelCountValue: number
): Pick<CabinInputs, "panelCount" | "roomPanelWidthsText"> {
  const panelCount = Number.isFinite(panelCountValue) && panelCountValue > 0
    ? Math.floor(panelCountValue) + 1
    : 1;
  return {
    panelCount,
    roomPanelWidthsText: roomPanelWidths(text, panelCount).join("; "),
  };
}

/** Seçilen pano satırını ve ona ait eni kaldırır; kalan panoları yeniden sıralar. */
export function removeRoomPanel(
  text: string | undefined,
  panelCountValue: number,
  index: number
): Pick<CabinInputs, "panelCount" | "roomPanelWidthsText"> {
  const widths = roomPanelWidths(text, panelCountValue);
  if (index >= 0 && index < widths.length) widths.splice(index, 1);
  return {
    panelCount: widths.length,
    roomPanelWidthsText: widths.join("; "),
  };
}

/** Oda ölçüleri ve ortak pano boyutlarından yerleşim ölçülerini türetir. */
export function roomPanelLayout(inp: CabinInputs): RoomPanelLayout {
  const widthsMm = roomPanelWidths(inp.roomPanelWidthsText, inp.panelCount);
  const panelHeightMm = positiveOr(inp.roomPanelHeightMm, DEFAULT_ROOM_PANEL_HEIGHT_MM);
  const panelDepthMm = positiveOr(inp.roomPanelDepthMm, DEFAULT_ROOM_PANEL_DEPTH_MM);
  return {
    count: widthsMm.length,
    widthsMm,
    panelHeightMm,
    panelDepthMm,
    baseHeightMm: ROOM_PANEL_BASE_HEIGHT_MM,
    overallHeightMm: panelHeightMm + ROOM_PANEL_BASE_HEIGHT_MM,
    totalWidthMm: widthsMm.reduce((sum, width) => sum + width, 0),
    walkingClearanceMm: positiveOr(inp.roomWidthM, 0) * 1000 - panelDepthMm,
    doorWidthMm: positiveOr(inp.roomDoorWidthMm, DEFAULT_ROOM_DOOR_WIDTH_MM),
    doorHeightMm: positiveOr(inp.roomDoorHeightMm, DEFAULT_ROOM_DOOR_HEIGHT_MM),
  };
}

/**
 * Otomatik pano kaybı açıkken form ve rapor girdisinde gösterilecek kaynak.
 * Kayıttaki elle-giriş değeri korunur; anahtar kapatılırsa kullanıcı kendi
 * değerine dönebilir. Otomatikken ise hesap motorunun gerçek değeri görünür.
 */
export function cabinInputsForDisplay(
  inp: CabinInputs,
  cells: Record<string, number | string> | undefined
): CabinInputs {
  const derived = cells?.["drive.panelHeat"];
  if (typeof derived !== "number" || !Number.isFinite(derived)) return inp;
  // IEEE-754 artıkları (örn. 1.7280000000000002) kullanıcı girdisi gibi
  // görünmemeli; hesap satırlarının kW hassasiyetiyle aynı çözünürlüğü kullan.
  const displayed = Math.round(derived * 1000) / 1000;
  const roomDiffers = inp.roomDeviceHeatAuto === true && inp.roomDeviceHeatKw !== displayed;
  const panelDiffers = inp.panelDeviceHeatAuto === true && inp.panelDeviceHeatKw !== displayed;
  if (!roomDiffers && !panelDiffers) return inp;
  return {
    ...inp,
    ...(roomDiffers ? { roomDeviceHeatKw: displayed } : {}),
    ...(panelDiffers ? { panelDeviceHeatKw: displayed } : {}),
  };
}

export interface CabinSelections {
  cabinAcBrand: string;
  cabinAcModel: string;
  cabinAcSeries: string;
  cabinAcApplication: string;
  cabinAcCoolingKwMin: number;
  cabinAcCoolingKwMax: number;
  cabinAcAmbientMaxC: number;

  roomAcBrand: string;
  roomAcModel: string;
  roomAcSeries: string;
  roomAcApplication: string;
  roomAcCoolingKwMin: number;
  roomAcCoolingKwMax: number;
  roomAcAmbientMaxC: number;

  panelAcBrand: string;
  panelAcModel: string;
  panelAcSeries: string;
  panelAcApplication: string;
  panelAcCoolingKwMin: number;
  panelAcCoolingKwMax: number;
  panelAcAmbientMaxC: number;
}

/**
 * Modüller arası bağımlılık: vincin seçilmiş motorlarının sürücü kayıpları.
 * Motor gücü ve adedi kaldırma/yürütme bölümlerinin SEÇİMİDİR; kabin bölümü
 * onu yalnız okur (bkz. engine.ts `cabinDepsFrom`).
 */
export interface CabinDeps {
  /** Sürücü kayıplarından türetilen pano ısısı [kW] */
  panelHeatKw: number;
  /** Türetmeye giren kurulu tahrik gücü [kW] — raporda gösterilir */
  installedDrivePowerKw: number;
  /** Sürücü gövdelerinin katalog kayıpları toplamı [kW]. */
  inverterLossKw: number;
  /** Besleme/trafo/PLC/UPS/aydınlatma için eklenen yardımcı pay [kW]. */
  auxiliaryLossKw: number;
  /** Eşzamanlılık uygulanmadan önceki cihaz kaybı [kW]. */
  beforeDiversityKw: number;
  diversityFactor: number;
  /** Motor grubu bazında seçilen ağır hizmet sınıfı ve atık ısı. */
  driveHeatItems: DriveHeatItem[];
}

export interface CabinValues {
  cabinPresent: boolean;
  roomPresent: boolean;
  panelPresent: boolean;
  cabinFloorAreaM2: number;
  cabinVolumeM3: number;
  roomFloorAreaM2: number;
  roomVolumeM3: number;
  roomPanelLayout: RoomPanelLayout;
  /** Kurulu yedekle birlikte elektrik odasına takılacak klima adedi */
  roomAcUnitCount: number;
  /** Pano başına klima × pano adedi (yedek dâhil) */
  panelAcUnitCount: number;
  ambientTempMaxC: number;
  ambientRhPct: number;
  environment: InstallationEnvironment;
  roomDesignTempC: number;
  /** Yalıtımın ortalama sıcaklığı [°C] — λ bu sıcaklıkta okunur */
  insulationMeanTempC: number;
  /** Mahal başına iklimlendirme yükü sonucu (mahal yoksa undefined) */
  cabinLoad?: ClimateLoadResult;
  roomLoad?: ClimateLoadResult;
  panelLoad?: ClimateLoadResult;
  /** Pano kayıp gücünün raporda gösterilen açıklanabilir cihaz dökümü. */
  driveHeatItems: DriveHeatItem[];
  inverterLossKw: number;
  auxiliaryLossKw: number;
  beforeDiversityKw: number;
  diversityFactor: number;
}

/** Operatör kabini projeye dâhil mi (teknik özellik). */
export function hasOperatorCabin(specs: TechnicalSpecs): boolean {
  return specs.hasOperatorCabin === "yes";
}

/** Elektrik ekipmanı ayrı odada mı? */
export function hasElectricalRoom(specs: TechnicalSpecs): boolean {
  return specs.electricalAccommodationType === "room";
}

/** Elektrik ekipmanı yan yana panolarda mı? */
export function hasElectricalPanels(specs: TechnicalSpecs): boolean {
  return specs.electricalAccommodationType === "panel";
}

/**
 * Bir mahalde klima öngörülmüş mü (teknik özellik: yalnız VAR / YOK).
 *
 * Eski revizyonlar iklimlendirme SINIFINI tutuyordu ("standard", "industrial",
 * …). O alan artık düzenlenmiyor ama snapshot'larda duruyor; "none" dışındaki
 * her değer "var" sayılır ki eski bir raporda klima sessizce kaybolmasın.
 */
function presence(
  flag: string | undefined,
  legacyType: string | undefined
): boolean {
  if (flag === "yes") return true;
  if (flag === "no") return false;
  return legacyType !== undefined && legacyType !== "none";
}

export function cabinHasAirConditioner(specs: TechnicalSpecs): boolean {
  return hasOperatorCabin(specs)
    && presence(specs.operatorCabinHasAirConditioner, specs.operatorCabinAirConditioning);
}

export function roomHasAirConditioner(specs: TechnicalSpecs): boolean {
  return hasElectricalRoom(specs)
    && presence(specs.electricalRoomHasAirConditioner, specs.electricalRoomAirConditioning);
}

export function panelHasAirConditioner(specs: TechnicalSpecs): boolean {
  return hasElectricalPanels(specs)
    && presence(specs.electricalPanelHasAirConditioner, specs.electricalPanelAirConditioning);
}

/** Kabin bölümü hesaba girebilir mi (kabin ya da elektrik yerleşimi var mı). */
export function cabinModuleApplies(specs: TechnicalSpecs): boolean {
  return hasOperatorCabin(specs) || hasElectricalRoom(specs) || hasElectricalPanels(specs);
}

const nonNeg = (v: number | undefined): number =>
  Number.isFinite(v) && (v ?? 0) > 0 ? (v as number) : 0;

/** Kurulu yedek düzeninin adet çarpanı: 1+1 → iki ünite. */
function redundancyUnits(redundancy: string | undefined): number {
  return redundancy === "nPlusOne" ? 2 : 1;
}

/** Emniyet katsayısı [%] — ortam sınıfına göre firma kabulü. */
export const SAFETY_FACTOR_PCT = 15;

/** Yalıtım sınıfını hesap çekirdeğinin beklediği türe indirger. */
function insulationKind(value: string | undefined): RoomInsulationKind {
  return value === "rockWool100" ? "rockWool100" : "rockWool50";
}

/** Cam tipini hesap çekirdeğinin beklediği türe indirger. */
function glazingKind(value: string | undefined): GlazingKind {
  if (value === "single" || value === "reflective") return value;
  return "double";
}

export function computeCabin(
  specs: TechnicalSpecs,
  inp: CabinInputs,
  sel: CabinSelections,
  deps: CabinDeps
): ModuleResult<CabinValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];
  const set = (key: string, value: number | string) => {
    cells[key] = value;
  };

  const cabinPresent = hasOperatorCabin(specs);
  const roomPresent = hasElectricalRoom(specs);
  const panelPresent = hasElectricalPanels(specs);
  const ambientTempMaxC = nonNeg(specs.ambientTempMaxC);
  // Nem verilmemişse %50 kabul edilir: gizli yükü sıfır saymak taze hava
  // kalemini sıcak ortamlarda ciddi biçimde eksik gösterirdi.
  const ambientRhPct = Number.isFinite(specs.ambientRelHumidityPct)
    ? (specs.ambientRelHumidityPct as number)
    : 50;
  const environment: InstallationEnvironment =
    specs.installationEnvironment === "outdoor" ? "outdoor" : "indoor";

  const cabinFloorAreaM2 = nonNeg(inp.cabinWidthM) * nonNeg(inp.cabinLengthM);
  const cabinVolumeM3 = cabinFloorAreaM2 * nonNeg(inp.cabinHeightM);
  const roomFloorAreaM2 = nonNeg(inp.roomWidthM) * nonNeg(inp.roomLengthM);
  const roomVolumeM3 = roomFloorAreaM2 * nonNeg(inp.roomHeightM);
  const panelLayout = roomPanelLayout(inp);
  const roomAcUnitCount = redundancyUnits(inp.roomAcRedundancy);
  const panelCount = Math.max(0, Math.floor(nonNeg(inp.panelCount)));
  const panelAcUnitCount = panelCount * redundancyUnits(inp.panelAcRedundancy);

  /**
   * Mahallin ısı yükü — üç mahal de aynı çekirdekten geçer. Kabine özgü
   * kalemler (operatör, cam, kabin kapısı ölçüsü) yalnız kabinde verilir.
   */
  const loadFor = (
    widthM: number, lengthM: number, heightM: number,
    insulation: string, doorCount: number,
    deviceHeatKw: number, radiationKw: number,
    roomDoorSize?: { width: number; height: number },
    cabinSpecific?: {
      occupantCount: number;
      glazingAreaM2: number;
      glazingKind: GlazingKind;
    }
  ) => computeClimateLoad({
    widthM, lengthM, heightM,
    insulation: insulationKind(insulation),
    doorCount,
    doorSize: cabinSpecific ? CABIN_DOOR_SIZE_M : (roomDoorSize ?? ROOM_DOOR_SIZE_M),
    glazingAreaM2: cabinSpecific?.glazingAreaM2,
    glazingKind: cabinSpecific?.glazingKind,
    occupantCount: cabinSpecific?.occupantCount,
    ambientTempC: ambientTempMaxC,
    ambientRhPct,
    environment,
    deviceHeatKw,
    radiationKw,
    safetyFactorPct: SAFETY_FACTOR_PCT,
  });

  // Pano kayıp gücü OTOMATİK: seçilmiş motor güçlerinden türetilen sürücü
  // kayıpları. Anahtar kapalıysa mühendisin yazdığı değer geçerlidir.
  const autoPanelHeat = deps.panelHeatKw;
  const roomDeviceHeatKw = inp.roomDeviceHeatAuto ? autoPanelHeat : nonNeg(inp.roomDeviceHeatKw);
  const panelDeviceHeatKw = inp.panelDeviceHeatAuto ? autoPanelHeat : nonNeg(inp.panelDeviceHeatKw);

  const cabinLoad = cabinPresent
    ? loadFor(inp.cabinWidthM, inp.cabinLengthM, inp.cabinHeightM, inp.cabinInsulation,
        inp.cabinDoorCount, nonNeg(inp.cabinDeviceHeatKw), nonNeg(inp.cabinRadiationKw),
        undefined,
        {
          occupantCount: nonNeg(inp.cabinOccupantCount),
          glazingAreaM2: nonNeg(inp.cabinGlazingAreaM2),
          glazingKind: glazingKind(inp.cabinGlazingKind),
        })
    : undefined;
  const roomLoad = roomPresent
    ? loadFor(inp.roomWidthM, inp.roomLengthM, inp.roomHeightM, inp.roomInsulation,
        inp.roomDoorCount, roomDeviceHeatKw, nonNeg(inp.roomRadiationKw), {
          width: panelLayout.doorWidthMm / 1000,
          height: panelLayout.doorHeightMm / 1000,
        })
    : undefined;
  // Pano yerleşiminde "mahal" panoların dizildiği hacimdir; ölçüsü ayrıca
  // sorulmaz, oda ölçüleri kullanılır ve kapı yerine PANO adedi sızıntıyı
  // belirler (her pano kapağı bir sızıntı yoludur).
  const panelLoad = panelPresent
    ? loadFor(inp.roomWidthM, inp.roomLengthM, inp.roomHeightM, inp.roomInsulation,
        panelCount, panelDeviceHeatKw, nonNeg(inp.panelRadiationKw))
    : undefined;

  if (cabinPresent) {
    set("cabin.floorArea", cabinFloorAreaM2);
    set("cabin.volume", cabinVolumeM3);
  }
  if (roomPresent) {
    set("room.floorArea", roomFloorAreaM2);
    set("room.volume", roomVolumeM3);
    set("room.acUnitCount", roomAcUnitCount);
    set("room.doorSize", `${panelLayout.doorWidthMm} × ${panelLayout.doorHeightMm}`);
    set("room.panelCount", panelLayout.count);
    set("room.panelWidths", panelLayout.widthsMm.join(" + "));
    set("room.panelHeight", panelLayout.panelHeightMm);
    set("room.panelBaseHeight", panelLayout.baseHeightMm);
    set("room.panelOverallHeight", panelLayout.overallHeightMm);
    set("room.panelDepth", panelLayout.panelDepthMm);
    set("room.panelTotalWidth", panelLayout.totalWidthMm);
    set("room.walkingClearance", panelLayout.walkingClearanceMm);

    const roomLengthMm = nonNeg(inp.roomLengthM) * 1000;
    const roomHeightMm = nonNeg(inp.roomHeightM) * 1000;
    const roomWidthMm = nonNeg(inp.roomWidthM) * 1000;
    checks.push(
      {
        id: "cabin.room.panelWidthFit",
        label: "Elektrik Odası — Pano Dizisi Boyuna Sığıyor",
        required: panelLayout.totalWidthMm,
        provided: roomLengthMm,
        unit: "mm", op: ">=", computedSide: "required",
        pass: roomLengthMm >= panelLayout.totalWidthMm,
        kind: "firma", severity: "engelleyici",
      },
      {
        id: "cabin.room.panelHeightFit",
        label: "Elektrik Odası — Pano ve Baza Yüksekliği Sığıyor",
        required: panelLayout.overallHeightMm,
        provided: roomHeightMm,
        unit: "mm", op: ">=", computedSide: "required",
        pass: roomHeightMm >= panelLayout.overallHeightMm,
        kind: "firma", severity: "engelleyici",
      },
      {
        id: "cabin.room.panelDepthFit",
        label: "Elektrik Odası — Pano Derinliği Sonrası Yürüme Alanı Kalıyor",
        required: panelLayout.panelDepthMm,
        provided: roomWidthMm,
        unit: "mm", op: ">=", computedSide: "required",
        pass: roomWidthMm > panelLayout.panelDepthMm,
        kind: "firma", severity: "engelleyici",
      }
    );
  }
  if (panelPresent) {
    set("panel.count", panelCount);
    set("panel.acUnitCount", panelAcUnitCount);
  }
  if (roomPresent || panelPresent) {
    set("drive.installedPower", deps.installedDrivePowerKw);
    set("drive.inverterLoss", deps.inverterLossKw);
    set("drive.auxiliaryLoss", deps.auxiliaryLossKw);
    set("drive.beforeDiversity", deps.beforeDiversityKw);
    set("drive.diversityFactor", deps.diversityFactor);
    set("drive.panelHeat", autoPanelHeat);
  }

  /**
   * Bir mahallin ısı yükü satırları ve kontrolleri. Üç mahal de aynı kalıptan
   * geçer; mahal başına tekrarlanan metin yerine tek yerde tanımlanır.
   */
  const climate = (
    block: "cabinAc" | "roomAc" | "panelAc",
    label: string,
    selected: boolean,
    pick: AirConditionerPick,
    load: ClimateLoadResult | undefined,
    /** Yükü kaç ünite paylaşıyor — pano yerleşiminde yük panolara bölünür. */
    unitCount: number
  ) => {
    if (!selected || !load) return;

    set(block + ".uValue", load.uValue);
    set(block + ".transmission", load.transmissionKw);
    set(block + ".solar", load.solarKw);
    set(block + ".radiation", load.radiationKw);
    set(block + ".deviceHeat", load.deviceHeatKw);
    set(block + ".occupant", load.occupantKw);
    set(block + ".glazingArea", load.glazingAreaM2);
    set(block + ".freshAirFlow", load.freshAirM3h);
    set(block + ".freshAir", load.freshAirKw);
    set(block + ".calculated", load.calculatedKw);
    set(block + ".total", load.totalKw);
    set(block + ".infiltration", load.infiltrationM3h);
    set(block + ".condensate", load.condensateKgH);
    set(block + ".airFlow", load.airFlowM3h);
    set(block + ".coolingMin", pick.coolingKwMin);
    set(block + ".coolingMax", pick.coolingKwMax);
    set(block + ".ambientMax", pick.ambientMaxC);

    const hasProduct = pick.model.trim() !== "";
    checks.push({
      id: "cabin." + block + ".selected",
      label: label + " — Katalogdan Seçilmiş Ürün",
      required: 1, provided: hasProduct ? 1 : 0, unit: "adet", op: ">=",
      computedSide: "required",
      pass: hasProduct,
      kind: "firma", severity: "engelleyici",
    });

    // Ortam sıcaklığı: katalogun üst sınırı projenin üst sınırını karşılamalı.
    // Katalogda sınır YAYIMLANMAMIŞSA (0) kontrol bilgilendirmeye düşer —
    // sıfırı gerçek bir sınır gibi kullanmak ürünü haksız yere düşürürdü.
    checks.push(
      pick.ambientMaxC > 0
        ? {
            id: "cabin." + block + ".ambient",
            label: label + " — Ortam Sıcaklığı Üst Sınırı",
            required: ambientTempMaxC, provided: pick.ambientMaxC, unit: "°C", op: ">=",
            computedSide: "required",
            pass: pick.ambientMaxC >= ambientTempMaxC,
            kind: "uretici", severity: "engelleyici",
          }
        : {
            id: "cabin." + block + ".ambient",
            label: label + " — Ortam Sıcaklığı Sınırı Katalogda Yayımlanmamış",
            required: ambientTempMaxC, provided: 0, unit: "°C", op: ">=",
            computedSide: "required",
            pass: true,
            kind: "bilgi", severity: "uyari",
          }
    );

    // KAPASİTE — artık gerçek bir kontrol: hesaplanan yük, seçilen ünitenin
    // katalog soğutma kapasitesini aşmamalı. Katalog bir BAND verdiği için üst
    // uç kullanılır; pano yerleşiminde yük pano adedine bölünür.
    const perUnitLoadKw = load.totalKw / Math.max(1, unitCount);
    const capacityKw = pick.coolingKwMax;
    checks.push(
      capacityKw > 0
        ? {
            id: "cabin." + block + ".capacity",
            label: label + " — Soğutma Kapasitesi",
            required: perUnitLoadKw, provided: capacityKw, unit: "kW", op: ">=",
            computedSide: "required",
            pass: capacityKw >= perUnitLoadKw,
            kind: "uretici", severity: "engelleyici",
          }
        : {
            id: "cabin." + block + ".capacity",
            label: label + " — Kapasite Katalogda Okunamadı, Üretici Teyidi Gerekli",
            required: perUnitLoadKw, provided: 0, unit: "kW", op: ">=",
            computedSide: "required",
            pass: true,
            kind: "bilgi", severity: "uyari",
          }
    );

    // Işınım kalemi girilmediyse bunu SESSİZ bırakmayız: mahal çevresinde
    // doğrudan bir ısı kaynağı varsa (arada ısı kalkanı yoksa) yük ciddi
    // olabilir — ışınım görüş hattı ister, uygulama bunu bilemez.
    if (load.radiationKw === 0) {
      checks.push({
        id: "cabin." + block + ".radiationScope",
        label: label + " — Çevre Işınım Yükü Girilmedi, Hesaba Katılmadı",
        required: 0, provided: 0, unit: "kW", op: ">=",
        computedSide: "provided",
        pass: true,
        kind: "bilgi", severity: "uyari",
      });
    }
  };

  climate("cabinAc", "Kabin Kliması", cabinHasAirConditioner(specs), {
    brand: sel.cabinAcBrand, model: sel.cabinAcModel, series: sel.cabinAcSeries,
    application: sel.cabinAcApplication,
    coolingKwMin: nonNeg(sel.cabinAcCoolingKwMin),
    coolingKwMax: nonNeg(sel.cabinAcCoolingKwMax),
    ambientMaxC: nonNeg(sel.cabinAcAmbientMaxC),
    datasheetUrl: "",
  }, cabinLoad, 1);
  // Kurulu yedek (1+1) kapasiteyi PAYLAŞTIRMAZ: tek ünite yükün tamamını
  // karşılamalıdır, ikincisi yedektir.
  climate("roomAc", "Elektrik Odası Kliması", roomHasAirConditioner(specs), {
    brand: sel.roomAcBrand, model: sel.roomAcModel, series: sel.roomAcSeries,
    application: sel.roomAcApplication,
    coolingKwMin: nonNeg(sel.roomAcCoolingKwMin),
    coolingKwMax: nonNeg(sel.roomAcCoolingKwMax),
    ambientMaxC: nonNeg(sel.roomAcAmbientMaxC),
    datasheetUrl: "",
  }, roomLoad, 1);
  climate("panelAc", "Pano Kliması", panelHasAirConditioner(specs), {
    brand: sel.panelAcBrand, model: sel.panelAcModel, series: sel.panelAcSeries,
    application: sel.panelAcApplication,
    coolingKwMin: nonNeg(sel.panelAcCoolingKwMin),
    coolingKwMax: nonNeg(sel.panelAcCoolingKwMax),
    ambientMaxC: nonNeg(sel.panelAcAmbientMaxC),
    datasheetUrl: "",
  }, panelLoad, Math.max(1, panelCount));

  const values: CabinValues = {
    cabinPresent,
    roomPresent,
    panelPresent,
    cabinFloorAreaM2,
    cabinVolumeM3,
    roomFloorAreaM2,
    roomVolumeM3,
    roomPanelLayout: panelLayout,
    roomAcUnitCount,
    panelAcUnitCount,
    ambientTempMaxC,
    ambientRhPct,
    environment,
    roomDesignTempC: ROOM_DESIGN_TEMP_C,
    insulationMeanTempC: (ambientTempMaxC + ROOM_DESIGN_TEMP_C) / 2,
    cabinLoad,
    roomLoad,
    panelLoad,
    driveHeatItems: deps.driveHeatItems,
    inverterLossKw: deps.inverterLossKw,
    auxiliaryLossKw: deps.auxiliaryLossKw,
    beforeDiversityKw: deps.beforeDiversityKw,
    diversityFactor: deps.diversityFactor,
  };

  return { values, checks, cells };
}

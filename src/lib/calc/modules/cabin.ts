// Kabin ve elektrik odası — operatör kabini, elektrik odası / pano yerleşimi
// ve bunların iklimlendirmesi.
//
// NEDEN AYRI BİR BÖLÜM: klima bir KATALOG ÜRÜNÜDÜR (TMS, `kind =
// "air_conditioner"`) ve uygulamada katalogdan seçim yalnız hesap
// bölümlerinde yapılır. Teknik özelliklerde bu yüzden yalnız "kabin var mı",
// "elektrik yerleşimi ne" ve "klima var mı" sorulur; ölçüler, izolasyon,
// kurulu yedek düzeni ve ürünün kendisi buraya aittir.
//
// KAPSAM SINIRI — burada ısı yükü hesaplanmaz. Klimanın nihai kapasitesi;
// pano kayıp güçleri, güneş kazancı, hava sirkülasyonu, montaj ve bakım
// erişimine göre üretici tarafından proje bazında doğrulanır (TMS katalog
// notu). Uygulamanın doğrulayabildiği iki şey vardır ve ikisi de kontrol
// olarak yazılır:
//   1. Klima "var" denen mahalde katalogdan gerçekten bir ürün seçilmiş mi,
//   2. Seçilen ürünün ORTAM SICAKLIĞI üst sınırı, projenin ortam sıcaklığı
//      üst sınırını karşılıyor mu (teknik özelliklerden okunur).
// Kapasite doğrulaması bilgilendirme kontrolü olarak açıkça belirtilir —
// sessiz bir eksiklik olarak kalmaz.

import type { AnyCheck, ModuleResult, TechnicalSpecs } from "../types";

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

  // --- Elektrik odası
  roomWidthM: number;
  roomLengthM: number;
  roomHeightM: number;
  roomInsulation: string;
  /** Kurulu yedek klima düzeni (`AirConditioningRedundancy`) */
  roomAcRedundancy: string;

  // --- Pano tipi yerleşim
  panelCount: number;
  /** Pano koruma sınıfı (IP54 / IP55 / IP65) */
  panelIpClass: string;
  panelAcRedundancy: string;
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

export interface CabinValues {
  cabinPresent: boolean;
  roomPresent: boolean;
  panelPresent: boolean;
  cabinFloorAreaM2: number;
  cabinVolumeM3: number;
  roomFloorAreaM2: number;
  roomVolumeM3: number;
  /** Kurulu yedekle birlikte elektrik odasına takılacak klima adedi */
  roomAcUnitCount: number;
  /** Pano başına klima × pano adedi (yedek dâhil) */
  panelAcUnitCount: number;
  ambientTempMaxC: number;
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

export function computeCabin(
  specs: TechnicalSpecs,
  inp: CabinInputs,
  sel: CabinSelections
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

  const cabinFloorAreaM2 = nonNeg(inp.cabinWidthM) * nonNeg(inp.cabinLengthM);
  const cabinVolumeM3 = cabinFloorAreaM2 * nonNeg(inp.cabinHeightM);
  const roomFloorAreaM2 = nonNeg(inp.roomWidthM) * nonNeg(inp.roomLengthM);
  const roomVolumeM3 = roomFloorAreaM2 * nonNeg(inp.roomHeightM);
  const roomAcUnitCount = redundancyUnits(inp.roomAcRedundancy);
  const panelAcUnitCount =
    Math.max(0, Math.floor(nonNeg(inp.panelCount))) * redundancyUnits(inp.panelAcRedundancy);

  if (cabinPresent) {
    set("cabin.floorArea", cabinFloorAreaM2);
    set("cabin.volume", cabinVolumeM3);
  }
  if (roomPresent) {
    set("room.floorArea", roomFloorAreaM2);
    set("room.volume", roomVolumeM3);
    set("room.acUnitCount", roomAcUnitCount);
  }
  if (panelPresent) {
    set("panel.count", Math.max(0, Math.floor(nonNeg(inp.panelCount))));
    set("panel.acUnitCount", panelAcUnitCount);
  }

  /**
   * Bir mahallin iklimlendirme kontrolleri. Üçü de aynı üç soruyu sorar;
   * mahal başına tekrarlanan bir metin yerine tek yerde tanımlanır.
   */
  const climate = (
    block: "cabinAc" | "roomAc" | "panelAc",
    label: string,
    selected: boolean,
    pick: AirConditionerPick
  ) => {
    if (!selected) return;
    set(`${block}.coolingMin`, pick.coolingKwMin);
    set(`${block}.coolingMax`, pick.coolingKwMax);
    set(`${block}.ambientMax`, pick.ambientMaxC);

    const hasProduct = pick.model.trim() !== "";
    checks.push({
      id: `cabin.${block}.selected`,
      label: `${label} — Katalogdan Seçilmiş Ürün`,
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
            id: `cabin.${block}.ambient`,
            label: `${label} — Ortam Sıcaklığı Üst Sınırı`,
            required: ambientTempMaxC, provided: pick.ambientMaxC, unit: "°C", op: ">=",
            computedSide: "required",
            pass: pick.ambientMaxC >= ambientTempMaxC,
            kind: "uretici", severity: "engelleyici",
          }
        : {
            id: `cabin.${block}.ambient`,
            label: `${label} — Ortam Sıcaklığı Sınırı Katalogda Yayımlanmamış`,
            required: ambientTempMaxC, provided: 0, unit: "°C", op: ">=",
            computedSide: "required",
            pass: true,
            kind: "bilgi", severity: "uyari",
          }
    );

    checks.push({
      id: `cabin.${block}.capacity`,
      label: `${label} — Kapasite Üretici Tarafından Proje Bazında Doğrulanır`,
      required: 0, provided: 0, unit: "-", op: ">=",
      computedSide: "provided",
      pass: true,
      kind: "bilgi", severity: "uyari",
    });
  };

  climate("cabinAc", "Kabin Kliması", cabinHasAirConditioner(specs), {
    brand: sel.cabinAcBrand, model: sel.cabinAcModel, series: sel.cabinAcSeries,
    application: sel.cabinAcApplication,
    coolingKwMin: nonNeg(sel.cabinAcCoolingKwMin),
    coolingKwMax: nonNeg(sel.cabinAcCoolingKwMax),
    ambientMaxC: nonNeg(sel.cabinAcAmbientMaxC),
    datasheetUrl: "",
  });
  climate("roomAc", "Elektrik Odası Kliması", roomHasAirConditioner(specs), {
    brand: sel.roomAcBrand, model: sel.roomAcModel, series: sel.roomAcSeries,
    application: sel.roomAcApplication,
    coolingKwMin: nonNeg(sel.roomAcCoolingKwMin),
    coolingKwMax: nonNeg(sel.roomAcCoolingKwMax),
    ambientMaxC: nonNeg(sel.roomAcAmbientMaxC),
    datasheetUrl: "",
  });
  climate("panelAc", "Pano Kliması", panelHasAirConditioner(specs), {
    brand: sel.panelAcBrand, model: sel.panelAcModel, series: sel.panelAcSeries,
    application: sel.panelAcApplication,
    coolingKwMin: nonNeg(sel.panelAcCoolingKwMin),
    coolingKwMax: nonNeg(sel.panelAcCoolingKwMax),
    ambientMaxC: nonNeg(sel.panelAcAmbientMaxC),
    datasheetUrl: "",
  });

  const values: CabinValues = {
    cabinPresent,
    roomPresent,
    panelPresent,
    cabinFloorAreaM2,
    cabinVolumeM3,
    roomFloorAreaM2,
    roomVolumeM3,
    roomAcUnitCount,
    panelAcUnitCount,
    ambientTempMaxC,
  };

  return { values, checks, cells };
}

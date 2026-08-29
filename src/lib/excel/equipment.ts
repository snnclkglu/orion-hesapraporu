// Ekipman listesi Excel çıktısı — revizyonun seçim (selections) verilerinden
// iki sayfalık .xlsx üretir:
//   1. "Ekipman Listesi"     — satın alma / montaj için bileşen dökümü
//   2. "Teknik Ressam Özeti" — çizim için ana ölçüler (plaka, teker, tambur...)
// Saf fonksiyondur (DB/HTTP bağımlılığı yok); route handler ve test script'i
// aynı fonksiyonu kullanır.

import ExcelJS from "exceljs";
import {
  COL_FILL,
  HAIRLINE,
  HEADER_FILL,
  MONO_FONT,
  MUTED_GRAY,
  ORION_RED,
  PAPER,
  TITLE_FONT,
  autoWidth,
  colLetter,
  writeTitleBlock,
} from "@/lib/excel/brand";
import { baslikDuzeni, kimlikBuyuk } from "@/lib/tr-text";
import { MODULE_LABELS } from "@/lib/calc/labels";
import { moduleResult, moduleState } from "@/lib/calc/presentation/module-access";
import {
  BRIDGE_WEIGHT_READER_KEYS,
  MAIN_TROLLEY_WEIGHT_READER_KEYS,
  HOIST_OF_HOOKBLOCK,
  MODULE_ORDER,
  isHoistKey,
  isHookBlockKey,
  isTravelKey,
  type HoistKey,
  type HookBlockKey,
  type ModuleKey,
} from "@/lib/calc/presentation/module-family";
import {
  COUPLING_SEAL_TYPE_STANDARD,
  COUPLING_WEAR_DETECTION_STANDARD,
} from "@/lib/calc/fields";
import { splitAltKey, type RevisionAlts } from "@/lib/revision-load";
import { HOIST_SECTIONS } from "@/lib/calc/presentation/hoistSections";
import { HOOKBLOCK_SECTIONS } from "@/lib/calc/presentation/hookBlockSections";
import {
  din15407Row,
  hookStandardOf,
  isLamellaHook,
} from "@/lib/calc/hook-standards";
import { hookCapacityKg } from "@/lib/calc/hook-table";
import { TRAVEL_SECTIONS } from "@/lib/calc/presentation/travelSections";
import { CABIN_SECTIONS } from "@/lib/calc/presentation/cabinSections";
import {
  AIR_CONDITIONING_REDUNDANCY_LABELS,
  ROOM_INSULATION_LABELS,
  withDiameterSign,
} from "@/lib/calc/fields";
import { attrValueLabel } from "@/lib/catalog-mapping";
import { catalogSheetPageUrl, findCatalogSheet } from "@/lib/catalog-sheets";
import { fullDrawingNo, groupDrawingPlan, type DrawingPlanRow } from "@/lib/drawing-plan";
import {
  cabinHasAirConditioner,
  computeCabin,
  panelHasAirConditioner,
  roomPanelLayout,
  roomHasAirConditioner,
  type CabinInputs,
  type CabinSelections,
  type CabinValues,
} from "@/lib/calc/modules/cabin";
import type { ClimateLoadResult } from "@/lib/calc/climate-load";
import type { Diagram } from "@/lib/diagrams/model";
import { diagramsForSection, girderCamberProfile } from "@/lib/diagrams/select";
import { cabinDepsFrom } from "@/lib/calc/engine";
import { CABIN_CLIMATE_SITES } from "@/lib/calc/presentation/cabinSections";
import { GLAZING_KIND_LABELS } from "@/lib/calc/presentation/cabinFields";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import {
  drumShaftGeometry,
  hoistSpecView,
  ropeLengthPlan,
  computeHoistGroup,
} from "@/lib/calc/modules/hoistGroup";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type {
  HookBlockInputs,
  HookBlockSelections,
  HookBlockValues,
} from "@/lib/calc/modules/hookBlock";
import {
  bufferOrderQty, travelHasFestoon, travelSpecView, travelWheelHardnessText,
} from "@/lib/calc/modules/travelGroup";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import { railTProfile } from "@/lib/calc/modules/mainGirder";
import type { GirderInputs } from "@/lib/calc/modules/mainGirder";
import type { EndCarriageInputs } from "@/lib/calc/modules/endCarriage";
import {
  HOIST_EQUIPMENT_ARRANGEMENT_LABELS,
  doubleDrumHookSystem,
  hoistEquipmentArrangement,
  hoistEquipmentQuantityFactor,
  hookBlockLoadShare,
  type TechnicalSpecs,
} from "@/lib/calc/types";
import {
  ENDCARRIAGE_INPUT_FIELDS,
  GIRDER_INPUT_FIELDS,
} from "@/lib/calc/presentation/structuralFields";

export interface EquipmentMeta {
  docNo: string;
  projectName: string;
  customer: string;
  revLabel: string;
  revNo: number;
  date: string;
  preparedBy?: string;
  checkedBy?: string;
}

// --- yardımcılar -------------------------------------------------------------

/** Sayı biçimleme: gereksiz ondalık olmadan, NaN/boş için "-" */
const fmt = (n: number | null | undefined, digits = 0): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n.toFixed(digits)).toString();
};

const textOr = (s: string | null | undefined, fallback = "-"): string =>
  s && s.trim() !== "" ? s.trim() : fallback;

/**
 * Redüktör sipariş kodu: modele çıkış özelliği eklenir (DT472 + ".03" →
 * DT472.03). Özellik seçilmemişse yalın model döner (eski kayıt uyumu).
 */
const gearboxOrderCode = (model: unknown, feature: unknown): string => {
  const m = gearboxIdentity(model).model;
  const f = typeof feature === "string" ? feature.trim() : "";
  if (!m) return "-";
  return f ? `${m}.${f}` : m;
};

/**
 * REDÜKTÖRÜN MARKASI MODEL ALANININ İÇİNDEDİR.
 *
 * Katalog eşlemesi redüktörü tek bir birleşik alandan okur
 * (`from: "brand_model"` → "Yılmaz Redüktör HT0823"), çünkü marka adında
 * boşluk olan ürünlerde metni ikiye bölmek sessizce yanlış eşleme üretir
 * (bkz. `catalogIdentityFields`). Ekipman listesinin MARKA sütunu bu yüzden
 * boş kalıyordu (kullanıcı bildirimi, 24.08.2026).
 *
 * Ayrıştırma TAHMİNLE YAPILMAZ: metin yalnız BİLİNEN marka adlarıyla
 * karşılaştırılır ve en uzun eşleşme kazanır ("Yılmaz Redüktör", "Yılmaz"dan
 * önce gelmelidir). Tanınmayan bir önek varsa metin OLDUĞU GİBİ modele
 * bırakılır ve marka boş kalır — yanlış bir marka basmaktansa boş bırakmak
 * doğrudur (md. 4).
 */
const GEARBOX_BRANDS: readonly string[] = [
  "Yılmaz Redüktör",
  "FLENDER",
  "SEW-EURODRIVE",
  "POLAT (PGR)",
  "Siemens",
];

/**
 * ESKİ KAYITLARDAKİ KISA YAZIMLAR kataloğun kendi marka adına çevrilir.
 * Ekipman listesinin marka sütunu satın almaya ve katalog sayfası defterine
 * gider; oralarda marka `cat_equipment.brand` ile BİREBİR eşleşmelidir.
 */
const GEARBOX_BRAND_ALIASES: Record<string, string> = {
  YILMAZ: "Yılmaz Redüktör",
  "YILMAZ REDÜKTÖR": "Yılmaz Redüktör",
  POLAT: "POLAT (PGR)",
  "SEW EURODRIVE": "SEW-EURODRIVE",
  SEW: "SEW-EURODRIVE",
};

/** Aranacak önekler: gerçek markalar + eski yazımlar, uzundan kısaya. */
const GEARBOX_BRAND_PREFIXES = [
  ...GEARBOX_BRANDS,
  ...Object.keys(GEARBOX_BRAND_ALIASES),
].sort((a, b) => b.length - a.length);

export function gearboxIdentity(combined: unknown): { brand: string; model: string } {
  const text = typeof combined === "string" ? combined.trim() : "";
  if (!text) return { brand: "", model: "" };
  const upper = text.toLocaleUpperCase("tr-TR");
  for (const prefix of GEARBOX_BRAND_PREFIXES) {
    const p = prefix.toLocaleUpperCase("tr-TR");
    const brand = GEARBOX_BRAND_ALIASES[p] ?? prefix;
    if (upper === p) return { brand, model: "" };
    if (upper.startsWith(`${p} `)) {
      return { brand, model: text.slice(prefix.length).trim() };
    }
  }
  return { brand: "", model: text };
}

/** Montaj pozisyonu ve mil yönü varsa spec'e ek metin, yoksa boş. */
const gearboxMountingNote = (pos: unknown, dir?: unknown): string => {
  const p = typeof pos === "string" ? pos.trim() : "";
  const d = typeof dir === "string" ? dir.trim() : "";
  return `${d ? `, mil yönü ${d}` : ""}${p ? `, montaj ${p}` : ""}`;
};

/**
 * Motor sipariş nitelikleri spec sonuna eklenir: bağlantı biçimi (B5/B14),
 * fren bobini gerilimi, verim sınıfı, enkoder. Yalnız GİRİLMİŞ olanlar
 * yazılır — boş alan uydurma değer üretmez (md. 4).
 */
/**
 * Redüktörün sipariş opsiyonları (çoklu seçim) spec metnine eklenir. "Yok"
 * bir donanım değildir ve satırda yer kaplamaz.
 */
const gearboxOptionsNote = (options: unknown): string => {
  const t = typeof options === "string" ? options.trim() : "";
  if (!t || t === "Yok") return "";
  return `, ${t}`;
};

/**
 * SESSİZ VARSAYILAN: bir seçim STANDART olduğunda ekipman satırına yazılmaz.
 *
 * Kaplin keçe tipi ve tambur kaplini aşınma algılaması böyledir (kullanıcı
 * kararı, 24.08.2026): standart değer zaten her siparişte geçerlidir, satıra
 * yazmak listeyi hiçbir şey söylemeyen tekrarlarla doldurur. Yalnız standart
 * DIŞINDAKİ seçim görünür — çünkü onu ayrıca sipariş etmek gerekir.
 */
const nonDefaultNote = (value: unknown, standard: string): string => {
  const t = typeof value === "string" ? value.trim() : "";
  return t && t !== standard ? `, ${t}` : "";
};

/** Rulman spec'ine tip önekini ekler ("222XX Küresel Makaralı · "). */
const bearingTypePrefix = (type: unknown): string => {
  const t = typeof type === "string" ? type.trim() : "";
  return t ? `${t} · ` : "";
};

const motorAttributesNote = (sel: {
  motorMountType?: unknown; motorBrakeType?: unknown;
  motorEfficiencyClass?: unknown; motorEncoder?: unknown;
  motorInsulationClass?: unknown; motorDutyType?: unknown;
  motorThermalProtection?: unknown;
}): string => {
  const parts: string[] = [];
  const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (t(sel.motorMountType)) parts.push(t(sel.motorMountType));
  const motorBrake = t(sel.motorBrakeType);
  // Eski revizyonlardaki değer okunmaya devam eder; yeni seçimler bobin
  // gerilimini kaybetmeden sipariş metnine aynen taşınır.
  if (motorBrake === "Kendinden Frenli") parts.push("kendinden frenli");
  else if (motorBrake && motorBrake !== "Frensiz") parts.push(motorBrake);
  if (t(sel.motorEfficiencyClass)) parts.push(t(sel.motorEfficiencyClass));
  // Yalıtım ve çalışma sınıfı SİPARİŞ BİLGİSİDİR: satıcı motoru bu ikisi
  // olmadan teklif edemez. Sınıf harfi tek başına okunmaz ("F" neyin F'i
  // olduğu belli değildir), önekle basılır.
  if (t(sel.motorInsulationClass)) parts.push(`${t(sel.motorInsulationClass)} yalıtım`);
  if (t(sel.motorDutyType)) parts.push(t(sel.motorDutyType));
  // "Yok" bir donanım değildir; satırda yer kaplamaz.
  const ptc = t(sel.motorThermalProtection);
  if (ptc && ptc !== "Yok") parts.push(ptc);
  if (t(sel.motorEncoder) === "Var") parts.push("enkoderli");
  return parts.length ? `, ${parts.join(", ")}` : "";
};

/**
 * Frenin sipariş opsiyonları (çoklu seçim) ekipman satırının teknik özellik
 * metnine eklenir: fren ancak bu donanımla birlikte sipariş edilebilir.
 * Hiçbiri seçilmemişse satır kısalır — boş bir "opsiyon:" eki yazılmaz.
 */
const brakeOptionsNote = (options: unknown): string => {
  const t = typeof options === "string" ? options.trim() : "";
  return t ? `, ${t}` : "";
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: HAIRLINE } },
  bottom: { style: "thin", color: { argb: HAIRLINE } },
  left: { style: "thin", color: { argb: HAIRLINE } },
  right: { style: "thin", color: { argb: HAIRLINE } },
};

/**
 * Ekipman listesinin sütun genişliği sınırı ortak varsayılandan (9..46)
 * geniştir: "Özellikler" ve "Ek Özellikler" sütunları serbest metin taşır ve
 * 46 karakterde satın alma satırı okunmaz hâle geliyordu.
 */
const WIDTH_MIN = 8;
const WIDTH_MAX = 60;

/**
 * Sayfanın marka bandı: kömür başlık + künye + kırmızı ayraç + proje
 * sorumluları. Tablo başlık satırının numarasını döndürür.
 *
 * BAŞLIKTA MARKA ÖNEKİ YOKTUR — İş Takibi ve Teknik Resimler çıktıları
 * "ORION — <MODÜL> · <sayfa>" yazarken burası yalnız belgenin kendi adını
 * ("EKİPMAN LİSTESİ") basar. Bu bir eksik değil KARARDIR: ekipman listesi
 * müşteriye teslim edilen bir belgedir (`scope: "customer"`) ve PDF eşiyle
 * aynı anatomiyi taşır — orada da başlık belgenin/projenin adıdır, marka
 * lockup logoda, doküman satırında ve altbilgide durur. Excel'de de öyledir:
 * `writeFooterRow` her sayfaya "ORION CRANES · … " basar. Öneki eklemek
 * markayı çoğaltmakla kalmaz, teslim edilmiş belgenin görünümünü değiştirirdi.
 */
function writeBand(
  ws: ExcelJS.Worksheet,
  title: string,
  meta: EquipmentMeta,
  colCount: number
): number {
  return writeTitleBlock(ws, title, colCount, {
    meta: [
      textOr(meta.projectName),
      textOr(meta.docNo),
      `REV V${meta.revNo}${meta.revLabel ? ` — ${meta.revLabel}` : ""}`,
      meta.date,
    ],
    details: [
      ["Müşteri", textOr(meta.customer)],
      ["Hazırlayan", textOr(meta.preparedBy)],
      ["Kontrol", textOr(meta.checkedBy)],
    ],
  });
}

// --- Sayfa 1: Ekipman Listesi ------------------------------------------------

export interface EqRow {
  /** cat_equipment kind (datasheet link eşlemesi için) */
  kind?: string;
  /**
   * Satır bir ALTERNATİF (seçenekli) ekipmandır: değeri seçeneğin sırasıdır
   * (raporun "SEÇENEKLER" bloğundaki numarayla aynı). Aktif seçim ana satırdır
   * ve bu alanı taşımaz; alternatifler ana satırın hemen ALTINDA listelenir.
   */
  alt?: number;
  /**
   * Satırın KARARLI kimliği — `equipment_notes.row_key`.
   * Biçim: `<modulKey>:<slug>` (ör. "main:rope", "bridge:wheel").
   * Slug ham kaynak alandan gelir, ETİKET METNİNDEN TÜRETİLMEZ: etiketler
   * `baslikDuzeni` ile büyütülür ve dile göre değişebilir; anahtar bu yüzden
   * dilden ve biçimlemeden bağımsız tutulur, aksi hâlde notlar satırdan kopar.
   * Panelden eklenen serbest satırlarda yoktur (not tutulmaz).
   */
  rowKey?: string;
  component: string;
  brand: string;
  model: string;
  /**
   * Katalog sayfası aramasında MODEL yerine kullanılacak kimlik.
   *
   * Çoğu satırda kimlik zaten görünen sütunlardadır. Yürütme freninde ise ürün
   * kimliğini tek birleşik alan taşır (`brakeBrand` = "MARKA MODEL") ve o alan
   * MARKA sütununda görünür, model sütunu "-"dir. Görünen sütunları kimliğe
   * uydurmak müşteriye giden tabloyu değiştirirdi; arama kimliği bu yüzden
   * ayrıca taşınır.
   */
  catalogModel?: string;
  /**
   * Aynı redüktör modeli farklı giriş devri tablolarında geçiyorsa seçilen
   * katalog satırının n1 değeri. Görünen sipariş koduna eklenmez; yalnız doğru
   * teknik katalog sayfasını çözmek için kullanılır.
   */
  catalogInputRpm?: number;
  spec: string;
  /** "Ek Özellikler" — kullanıcının satıra elle yazdığı serbest açıklama */
  note?: string;
  /**
   * "Ek Belge" — kullanıcının bu satıra yüklediği PDF ekleri
   * (`equipment_attachments`). Katalog SAYFASINDAN farklıdır: o defterden
   * (manifest.json) gelir ve yalnız kaynak PDF'i workspace'te olan üreticileri
   * kapsar; bu ise mühendisin kendi elindeki yaprağıdır.
   */
  attachments?: EqAttachmentRef[];
  qty: number | string;
  /** Panelden eklenen serbest satır (silinebilir/düzenlenebilir) */
  custom?: boolean;
}

/** row_key → not metni (equipment_notes tablosundan okunur) */
export type EquipmentNotes = Record<string, string>;

/** Bir satıra yüklenmiş PDF ekinin listedeki görünen yüzü. */
export interface EqAttachmentRef {
  /** Kullanıcının dosya adı — ek kapağında ve Excel hücresinde görünür */
  fileName: string;
  /** Sunucunun OKUYARAK saydığı sayfa adedi (0 = dosya açılamadı) */
  pageCount: number;
}

/** row_key → o satıra yüklenmiş ekler (equipment_attachments) */
export type EquipmentAttachments = Record<string, EqAttachmentRef[]>;

/**
 * "Ek Belge" hücresinin metni — listede, Excel'de ve PDF'te AYNI cümle.
 *
 * Sayfa adedi yazılır çünkü listeyi okuyanın sorusu "ek var mı" değil "kaç
 * sayfa geliyor"dur: detaylı PDF'in kalınlığı buradan tahmin edilir. Tek
 * belgede dosya adı da yazılır; iki ve üstünde ad yerine sayı yazılır, aksi
 * hâlde hücre bir dosya adı listesine dönerdi.
 */
export function attachmentSummaryText(list?: EqAttachmentRef[]): string {
  if (!list || list.length === 0) return "";
  const sayfa = list.reduce((n, a) => n + (a.pageCount || 0), 0);
  const sayfaMetni = sayfa > 0 ? `${sayfa} sayfa` : "sayfa okunamadı";
  if (list.length === 1) return `${sayfaMetni} · ${list[0].fileName}`;
  return `${list.length} belge · ${sayfaMetni}`;
}

export interface EqGroup {
  name: string;
  rows: EqRow[];
}

/** Klima ürünleri müşteri çıktılarına website bağlantısı olarak yazılmaz. */
export function canLinkEquipmentModel(kind: EqRow["kind"]): boolean {
  return kind !== "air_conditioner";
}

/** Panelden eklenen ek ekipman/özellik satırı (equipment_extras.rows) */
export interface EquipmentExtraRow {
  group: string;
  component: string;
  brand: string;
  model: string;
  spec: string;
  qty: string;
}

/**
 * Halat dengeleme düzeni ekipmanı (denge traversi / makarası). Soket, loadcell
 * ve yük OTOMATİK seçimden (computeHoistGroup cells) okunur — ekipman listesi
 * hesapla aynı değerleri gösterir. "Yok" düzeninde boş döner.
 */
function balanceRows(
  moduleKey: HoistKey,
  inp: HoistInputs,
  sel: HoistSelections,
  specs: TechnicalSpecs
): EqRow[] {
  if (inp.ropeBalancingType === "none") return [];
  const rk = (slug: string) => `${moduleKey}:${slug}`;
  const c = computeHoistGroup(specs, moduleKey, inp, sel).cells as Record<string, number | string>;
  const numOf = (k: string) => (typeof c[k] === "number" ? (c[k] as number) : undefined);
  const strOf = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : undefined);
  const ropeCount = numOf("balance.ropeCount") ?? 2;
  const loadKg = numOf("balance.load");
  const loadcellModel = strOf("balance.loadcellModel");
  const loadcellCap = numOf("balance.loadcellCapacity");
  const rows: EqRow[] = [];

  if (inp.ropeBalancingType === "equalizerBeam") {
    const socketModel = strOf("balance.socketModel");
    const socketMbl = numOf("balance.socketMbl");
    rows.push({
      rowKey: rk("balanceSocket"),
      kind: "other",
      component: "Halat soketi (denge traversi)",
      brand: "Van Beest",
      model: textOr(socketModel),
      spec: `Ø${fmt(sel.ropeDiaMm)} mm halat · ${textOr(sel.balanceSocketType, "Normal")} tip${socketMbl ? ` · MBL ${fmt(socketMbl, 0)} t` : ""}`,
      qty: Math.round(ropeCount),
    });
  } else {
    rows.push({
      rowKey: rk("balanceSheave"),
      kind: "other",
      component: "Denge makarası",
      brand: "-",
      model: sel.balanceSheaveDiaMm ? `Ø${fmt(sel.balanceSheaveDiaMm)} mm` : "-",
      spec: `min çap ${fmt(numOf("balance.sheaveMinDia"), 0)} mm (FEM T.4.2.3.1.1)`,
      qty: 1,
    });
  }

  rows.push({
    rowKey: rk("balanceLoadcell"),
    // Üretici föyü ekipman listesine bağlanabilsin; katalog verisi ayrı
    // `load_cell` türünde tutulur (Esit PLC / Kobastar LPW1).
    kind: "load_cell",
    component: "Yük hücresi (loadcell)",
    brand: textOr(sel.balanceLoadcellBrand, "Esit"),
    model: textOr(strOf("balance.loadcellModelShort") ?? loadcellModel),
    spec: `kapasite ${fmt(loadcellCap, 0)} kg · denge yükü ${fmt(loadKg, 0)} kg`,
    qty: 1,
  });
  // Rulman ELLE girilir (NA/NNF). Boşken de satır çıkar ama alanlar "—" olur
  // (uydurma değer yok, md. 4); satır mühendise "rulman seçilecek" der.
  rows.push({
    rowKey: rk("balanceBearing"),
    kind: "bearing",
    component: "Denge rulmanı",
    brand: textOr(sel.balanceBearingBrand),
    model: textOr(sel.balanceBearingCode),
    spec: sel.balanceBearingStatC0Kn
      ? `${sel.balanceBearingType ? sel.balanceBearingType + " · " : ""}C0 = ${fmt(sel.balanceBearingStatC0Kn, 1)} kN`
      : `${textOr(sel.balanceBearingType, "NA/NNF tipi")} · seçilecek`,
    qty: 2,
  });
  return rows;
}

/**
 * Eski revizyonlardaki kg/mm² değerini kataloğun basılı MPa sınıfına çevirir.
 *
 * Seed ters yönde `Math.round(MPa / 9.80665)` kullanır. Yuvarlanmış değeri
 * genel bir çarpımla geri çevirmek 200 → 1961 üretir ve birebir ürün modeli
 * olan `… 1960 MPa` bağlantısını koparır; bu yüzden yalnız kataloglarda
 * gerçekten yayımlanan sınıfların ters tablosu kullanılır.
 */
const ROPE_GRADE_MPA_BY_KGMM2: Readonly<Record<number, number>> = {
  180: 1770,
  200: 1960,
  220: 2160,
  241: 2360,
};

/** Türkçe seçim etiketini kataloğun kısa öz koduna çevirir. */
function ropeCatalogCoreCode(value: string): string {
  const trimmed = value.trim();
  const parenthesized = /\((FC|IWRC(?:-[A-Z]+)?)\)\s*$/i.exec(trimmed)?.[1];
  if (parenthesized) return parenthesized.toUpperCase();
  if (/^(FC|IWRC(?:-[A-Z]+)?)$/i.test(trimmed)) return trimmed.toUpperCase();
  const upper = trimmed.toLocaleUpperCase("tr-TR");
  if (upper.includes("ÇELİK")) return "IWRC";
  if (upper.includes("ELYAF") || upper.includes("LİF")) return "FC";
  return trimmed;
}

/** 2026 föyündeki tam konstrüksiyon adı; eski "6x36" kayıtlarıyla uyumlu. */
function ropeCatalogConstruction(value: string): string {
  const trimmed = value.trim();
  return /^6\s*[x×]\s*36$/i.test(trimmed) ? "6x36 WS" : trimmed;
}

/**
 * Halatın katalog ürünü kimliği.
 *
 * Yeni seçimlerde `ropeCatalogModel` birebir DB modelidir. Eski revizyonlarda
 * bu alan yoktur; çap + konstrüksiyon + öz + standart mukavemet sınıfından
 * aday kurulur. Mukavemet sınıfı basılmayan birkaç CASAR ürününde ikinci aday
 * MPa parçası olmadan denenir. Aday ancak manifestte gerçekten bulunuyorsa
 * seçilir; yakın ürün tahmini yapılmaz.
 */
function ropeCatalogModelOf(sel: HoistSelections): string | undefined {
  const candidates: string[] = [];
  const add = (value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
  };
  add(sel.ropeCatalogModel);

  const diameter = Number(sel.ropeDiaMm);
  const construction = ropeCatalogConstruction(sel.ropeConstruction ?? "");
  const core = ropeCatalogCoreCode(sel.ropeCore ?? "");
  if (Number.isFinite(diameter) && diameter > 0 && construction && core) {
    const base = `Ø${fmt(diameter)} ${construction} ${core}`;
    const grade = ROPE_GRADE_MPA_BY_KGMM2[Math.round(Number(sel.ropeWireStrength))];
    if (grade) add(`${base} ${grade} MPa`);
    add(base);
  }

  return candidates.find((model) =>
    findCatalogSheet("rope", sel.ropeBrand, model)
  ) ?? candidates[0];
}

/** Ana / yardımcı kaldırma grubu bileşen satırları (aynı set) */
function hoistRows(
  moduleKey: HoistKey,
  inp: HoistInputs,
  sel: HoistSelections,
  specs: TechnicalSpecs
): EqRow[] {
  const rk = (slug: string) => `${moduleKey}:${slug}`;
  const ropePlan = ropeLengthPlan(inp, sel, hoistSpecView(specs, moduleKey).liftHeightM);
  const doubleDrum = hoistEquipmentArrangement(specs, moduleKey) === "doubleDrum";
  const ropeRows: EqRow[] = ropePlan.lines.map((line) => {
    const layLabel = line.lay === "right" ? "Sağ Helis" : "Sol Helis";
    return {
      rowKey: rk(line.lay === "right" ? "rope" : "ropeLeft"),
      kind: "rope",
      component: "Çelik halat",
      brand: textOr(sel.ropeBrand),
      model: `${textOr(sel.ropeConstruction)} ${layLabel}`,
      // Sağ/sol helis satın alma satırının görünür modelidir; üretici katalog
      // sayfası ise çap + konstrüksiyon + öz + MPa ürün kimliğiyle bulunur.
      catalogModel: ropeCatalogModelOf(sel),
      spec:
        `Ø${fmt(sel.ropeDiaMm)} mm, öz: ${textOr(sel.ropeCore)}, ` +
        `tel ${fmt(sel.ropeWireStrength)} kg/mm², ` +
        `kopma yükü ${fmt(sel.ropeBreakingLoadKn, 1)} kN, ` +
        `boy ${fmt(line.lengthPerPieceM, 2)} m/adet`,
      qty: line.quantity,
    };
  });
  return [
    ...ropeRows,
    {
      rowKey: rk("drum"),
      component: "Tambur",
      brand: "-",
      model: "-",
      spec: `Ø${fmt(sel.drumDiaMm)} mm, malzeme ${textOr(sel.drumMaterial)}, yiv boyu ${textOr(sel.drumGrooveLengthText)} mm`,
      qty: doubleDrum ? 2 : inp.drumCount,
    },
    {
      rowKey: rk("drumBearing"),
      kind: "bearing",
      component: "Tambur rulmanı",
      brand: textOr(sel.bearingBrand),
      model: textOr(sel.bearingCode),
      spec: `${bearingTypePrefix(sel.bearingType)}C = ${fmt(sel.bearingDynCKn, 1)} kN, C0 = ${fmt(sel.bearingStatC0Kn, 1)} kN`,
      // Redüktör tarafı tamburu taşır; serbest uçta tambur başına tek rulman
      // vardır. Çift tamburda iki simetrik tamburun serbest uçları sayılır.
      qty: doubleDrum ? 2 : 1,
    },
    {
      rowKey: rk("drumBearingHousing"),
      kind: "bearing_housing",
      component: "Tambur rulman yatağı",
      brand: textOr(sel.bearingHousingBrand),
      model: textOr(sel.bearingHousingCode),
      spec: `${textOr(sel.bearingHousingSeries)} · ${textOr(sel.bearingHousingCompatibleBearing)} rulmanı ile uyumlu · Ø${fmt(sel.bearingHousingBoreMm)} mm · A₂ ${fmt(sel.bearingHousingWidthMm)} mm · ${textOr(sel.bearingHousingSeatType)}`,
      qty: doubleDrum ? 2 : 1,
    },
    {
      rowKey: rk("gearbox"),
      kind: "gearbox",
      component: "Redüktör",
      // Marka model alanının içindedir ("Yılmaz Redüktör HT0823"); sütun
      // ayrıştırılmadığı için boş kalıyordu (bkz. `gearboxIdentity`).
      brand: textOr(gearboxIdentity(sel.gearboxModel).brand),
      model: gearboxOrderCode(sel.gearboxModel, sel.gearboxOutputFeature),
      // Görünen model sipariş kodudur (örn. HT1423.03); katalog tablosu ise
      // ana gövde koduyla basılır. Aramayı görünür koddan ayır.
      catalogModel: gearboxIdentity(sel.gearboxModel).model,
      catalogInputRpm: sel.gearboxCatalogInputRpm,
      spec: `i = ${fmt(sel.gearboxRatio, 2)}, nominal tork ${fmt(sel.gearboxNominalTorqueKnm, 1)} kNm, giriş mili Ø${fmt(sel.gearboxInputShaftMm)} / çıkış mili Ø${fmt(sel.gearboxOutputShaftMm)} mm${gearboxMountingNote(sel.gearboxMountingPosition, sel.gearboxShaftDirection)}${gearboxOptionsNote(sel.gearboxOptions)}`,
      // Çift tamburun ikisini de ortadaki TEK redüktör taşır.
      qty: 1,
    },
    {
      rowKey: rk("motor"),
      kind: "motor",
      component: "Motor",
      brand: textOr(sel.motorBrand),
      model: textOr(sel.motorModel),
      spec: `${fmt(sel.motorPowerKw, 1)} kW, ${fmt(sel.motorRpm)} d/dak, mil Ø${fmt(sel.motorShaftMm)} mm${motorAttributesNote(sel)}`,
      qty: sel.motorCount,
    },
    {
      rowKey: rk("brake"),
      kind: "brake",
      component: "Fren",
      brand: textOr(sel.brakeBrand),
      model: textOr(sel.brakeModel),
      spec: `fren torku ${fmt(sel.brakeTorqueNm)} Nm, kasnak/disk Ø${fmt(sel.brakeWheelDiaMm)} mm${brakeOptionsNote(sel.brakeOptions)}`,
      qty: sel.brakeQty,
    },
    {
      rowKey: rk("motorCoupling"),
      kind: "coupling",
      component: "Motor-redüktör kaplini",
      brand: textOr(sel.motorCouplingBrand),
      model: textOr(sel.motorCouplingModel),
      spec: `tork ${fmt(sel.motorCouplingTorqueNm)} Nm, kasnak Ø${fmt(sel.motorCouplingWheelDiaMm)} mm, Dmaks Ø${fmt(sel.motorCouplingDmaxMm)} mm`,
      qty: 1,
    },
    {
      rowKey: rk("drumCoupling"),
      kind: "coupling",
      component: "Tambur kaplini",
      brand: textOr(sel.drumCouplingBrand),
      model: textOr(sel.drumCouplingModel),
      spec: `tork ${fmt(sel.drumCouplingTorqueNm)} Nm, radyal yük ${fmt(sel.drumCouplingRadialN)} N, Dmaks Ø${fmt(sel.drumCouplingDmaxMm)} mm${nonDefaultNote(sel.drumCouplingSealType, COUPLING_SEAL_TYPE_STANDARD)}${nonDefaultNote(sel.drumCouplingWearDetection, COUPLING_WEAR_DETECTION_STANDARD)}`,
      qty: doubleDrum ? 2 : 1,
    },
    ...balanceRows(moduleKey, inp, sel, specs),
  ];
}

/** Araba / köprü yürütme grubu bileşen satırları */
function travelRows(
  moduleKey: string,
  inp: TravelInputs,
  sel: TravelSelections,
  /** Bu eksende enerji beslemesi feston mu (teknik özellik) */
  hasFestoon: boolean
): EqRow[] {
  const rk = (slug: string) => `${moduleKey}:${slug}`;
  const wheelHardness = travelWheelHardnessText(sel.wheelHardness);
  const rows: EqRow[] = [
    {
      rowKey: rk("wheel"),
      kind: "wheel",
      component: "Tekerlek",
      brand: "-",
      model: "-",
      spec: `Ø${fmt(sel.wheelDiaMm)} mm, malzeme ${textOr(sel.wheelMaterial)} (${fmt(sel.wheelTensileNmm2)} N/mm²)${wheelHardness ? `, sertlik ${wheelHardness}` : ""}, ray ${textOr(sel.railCode)}`,
      qty: inp.wheelCount,
    },
    {
      rowKey: rk("wheelBearing"),
      kind: "bearing",
      component: "Teker rulmanı",
      brand: textOr(sel.bearingBrand),
      model: textOr(sel.bearingCode),
      spec: `${bearingTypePrefix(sel.bearingType)}C = ${fmt(sel.bearingDynCKn, 1)} kN, C0 = ${fmt(sel.bearingStatC0Kn, 1)} kN`,
      qty:
        inp.wheelCount > 0 && inp.bearingCount > 0
          ? inp.wheelCount * inp.bearingCount
          : "-",
    },
    {
      rowKey: rk("motor"),
      kind: "motor",
      component: "Motor",
      brand: textOr(sel.motorBrand),
      model: textOr(sel.motorModel),
      spec: `${fmt(sel.motorPowerKw, 2)} kW, ${fmt(sel.motorRpm)} d/dak, mil Ø${fmt(sel.motorShaftMm)} mm${motorAttributesNote(sel)}`,
      qty: sel.motorCount,
    },
    {
      rowKey: rk("gearbox"),
      kind: "gearbox",
      component: "Redüktör",
      // Marka model alanının içindedir ("Yılmaz Redüktör HT0823"); sütun
      // ayrıştırılmadığı için boş kalıyordu (bkz. `gearboxIdentity`).
      brand: textOr(gearboxIdentity(sel.gearboxModel).brand),
      model: gearboxOrderCode(sel.gearboxModel, sel.gearboxOutputFeature),
      catalogModel: gearboxIdentity(sel.gearboxModel).model,
      catalogInputRpm: sel.gearboxCatalogInputRpm,
      // YÜRÜTMEDE MİL YÖNÜ SORULMAZ (kullanıcı kararı, 24.08.2026): kutu
      // kaldırıldı, spec de onu basmaz.
      spec: `i = ${fmt(sel.gearboxRatio, 2)}, çıkış torku ${fmt(sel.gearboxOutputTorqueKnm, 2)} kNm, çıkış mili Ø${fmt(sel.gearboxOutputShaftMm)} mm${gearboxMountingNote(sel.gearboxMountingPosition)}${gearboxOptionsNote(sel.gearboxOptions)}`,
      qty: sel.motorCount,
    },
  ];

  // SEÇİLMEYEN EKİPMAN SATIR AÇMAZ. “Seçim yapılmadı” bir teknik özellik
  // değildir; hem ekipman listesinde hem özet raporda doğrudan düşer.
  if (sel.brakeTorqueNm > 0) {
    rows.push({
      rowKey: rk("brake"),
      kind: "brake",
      component: "Fren",
      brand: textOr(sel.brakeBrand),
      model: "-",
      // Yürütme freninin kimliği tek birleşik alandadır ve MARKA sütununda
      // görünür; katalog sayfası o metinle aranır.
      catalogModel: sel.brakeBrand,
      spec: `fren torku ${fmt(sel.brakeTorqueNm)} Nm, kasnak/disk Ø${fmt(sel.brakeWheelDiaMm)} mm${brakeOptionsNote(sel.brakeOptions)}`,
      qty: sel.motorCount,
    });
  }

  rows.push(
    {
      rowKey: rk("motorCoupling"),
      kind: "coupling",
      component: "Motor kaplini",
      brand: textOr(sel.motorCouplingBrand),
      model: textOr(sel.motorCouplingModel),
      spec: `tork ${fmt(sel.motorCouplingTorqueNm)} Nm, Dmaks Ø${fmt(sel.motorCouplingDmaxMm)} mm${nonDefaultNote(sel.motorCouplingSealType, COUPLING_SEAL_TYPE_STANDARD)}`,
      qty: sel.motorCount,
    },
    {
      rowKey: rk("wheelCoupling"),
      kind: "coupling",
      component: "Teker kaplini",
      brand: textOr(sel.wheelCouplingBrand),
      model: textOr(sel.wheelCouplingModel),
      spec: `tork ${fmt(sel.wheelCouplingTorqueNm)} Nm, teker mili Ø${fmt(sel.wheelShaftDiaMm)} mm, Dmaks Ø${fmt(sel.wheelCouplingDmaxMm)} mm${nonDefaultNote(sel.wheelCouplingSealType, COUPLING_SEAL_TYPE_STANDARD)}`,
      qty: sel.motorCount,
    },
    {
      rowKey: rk("buffer"),
      // Tampon bir KATALOG ürünüdür (SIBRE SP · Conductix kauçuk/hücresel);
      // `kind` yazılmadığı için satır katalog sayfası eşlemesine hiç girmiyordu.
      kind: "buffer",
      component: "Tampon",
      brand: "-",
      model: textOr(sel.bufferModel),
      spec: `${textOr(sel.bufferCatalogType, "tip belirtilmemiş")}, strok ${fmt(sel.bufferStrokeMm)} mm, enerji ${fmt(sel.bufferEnergyKj, 2)} kJ, yük ${fmt(sel.bufferLoadKn, 1)} kN`,
      // ADET SABİT DEĞİL, KURULU TAMPON ADEDİNDEN TÜRER: kutuda 2 seçiliyken
      // liste yine 2 basıyordu, oysa vinç tamponu her iki uçta taşır
      // (bkz. `bufferOrderQty`).
      qty: bufferOrderQty(inp.bufferCount),
    }
  );

  // Feston, artık bu yürütme grubunun bir KATALOG bölümüdür (5.9): satır da
  // grubun kendi satırlarıyla birlikte, ayrı bir "Enerji Besleme" grubu
  // açmadan listeye girer. Adet = kablo taşıyıcı adedi.
  if (hasFestoon) {
    const codes = [
      sel.festoonTrolleyCode ? `kablo arabası ${sel.festoonTrolleyCode}` : undefined,
      sel.festoonTowTrolleyCode ? `öncü ${sel.festoonTowTrolleyCode}` : undefined,
      sel.festoonEndClampCode ? `sonlandırıcı ${sel.festoonEndClampCode}` : undefined,
    ].filter(Boolean).join(", ");
    const trolleyCount = inp.festoonTrolleyCount ?? 0;
    const perTrolley = trolleyCount > 0
      ? (inp.festoonCablePackageWeightKg ?? 0) / trolleyCount
      : 0;
    rows.push({
      rowKey: rk("festoon"),
      kind: "festoon",
      component: "Feston kablo taşıyıcı sistemi",
      brand: textOr(sel.festoonBrand, "Seçilmedi"),
      model: textOr(sel.festoonSeries),
      spec:
        `${textOr(sel.festoonCableForm, "kablo formu belirtilmemiş")}; ` +
        `kablo paketi ${fmt(inp.festoonCablePackageWeightKg, 2)} kg, ` +
        `taşıyıcı başına ${fmt(perTrolley, 2)} kg / katalog ${fmt(sel.festoonTrolleyLoadKg, 2)} kg; ` +
        `loop h ${fmt(inp.festoonLoopHeightM, 2)} m; ` +
        (sel.festoonMaxSpeedMpm ? `hız sınırı ${fmt(sel.festoonMaxSpeedMpm, 1)} m/dak` : "hız üretici teyidi") +
        (codes ? `; ${codes}` : ""),
      qty: trolleyCount > 0 ? trolleyCount : "-",
    });
  }
  return rows;
}

/**
 * Rapora GİRMEYEN bölümlerin grup adları.
 *
 * Elle eklenen ekipman satırı grubunu SERBEST METİN olarak taşır; kullanıcı
 * "Köprü Yürütme" yazıp sonra o bölümü kapattığında satır, kapalı bölümün
 * başlığını indirilen dosyada diriltiyordu (ekranda ek satırlar ayrı durduğu
 * için fark edilmiyordu). Bu küme, o adları tanımaya yarar.
 */
export function absentModuleGroupNames(input: CalcInput): Set<string> {
  const out = new Set<string>();
  for (const key of MODULE_ORDER) {
    if (moduleState(input, key) === undefined) out.add(groupName(key));
  }
  return out;
}

/**
 * Ek satırları gruplara katar: eşleşen grup varsa ona ekler, yoksa yeni grup.
 *
 * `absentGroups` verilirse, RAPORDA OLMAYAN bir bölümün adıyla yeni grup
 * AÇILMAZ; satır "Ek Ekipman" altında durur. Satır silinmez — kullanıcının
 * kendi yazdığı bir kalemdir ve sessizce yok olması, kapalı bir bölümün
 * başlığını diriltmekten daha kötüdür; yalnız başlığı gitmez.
 */
export function mergeExtras(
  groups: EqGroup[],
  extras?: EquipmentExtraRow[],
  absentGroups?: ReadonlySet<string>
): EqGroup[] {
  if (!extras || extras.length === 0) return groups;
  const merged = groups.map((g) => ({ name: g.name, rows: [...g.rows] }));
  for (const ex of extras) {
    // Grup adı otomatik gruplarla AYNI düzenden geçer; aksi hâlde "ana kaldırma"
    // yazan bir ek satır "Ana Kaldırma" grubuna denk gelmez ve yeni grup açardı.
    const wanted = baslikDuzeni(ex.group.trim()) || "Ek Ekipman";
    const groupName = absentGroups?.has(wanted) ? "Ek Ekipman" : wanted;
    const row: EqRow = {
      component: baslikDuzeni(ex.component),
      // Marka ve model BÜYÜK HARF — otomatik satırlarla aynı kural
      // (`baslikDuzeniniUygula`). Elle eklenen satır listede onlarla yan yana
      // durur; iki farklı yazım tek tabloda kabul edilemez.
      brand: kimlikBuyuk(ex.brand) || "-",
      model: kimlikBuyuk(ex.model) || "-",
      spec: baslikDuzeni(ex.spec),
      qty: ex.qty || "-",
      custom: true,
    };
    const existing = merged.find((g) => g.name === groupName);
    if (existing) existing.rows.push(row);
    else merged.push({ name: groupName, rows: [row] });
  }
  return merged;
}

/** Kanca bloğu bölümünün ekipman satırları. */
function hookBlockRows(
  moduleKey: HookBlockKey,
  m: { inputs: HookBlockInputs; selections: HookBlockSelections },
  specs: TechnicalSpecs
): EqRow[] {
  const sel = m.selections;
  const rk = (slug: string) => `${moduleKey}:${slug}`;
  const hoistKey = HOIST_OF_HOOKBLOCK[moduleKey];
  const blockQuantity = hookBlockLoadShare(specs, hoistKey) === 0.5 ? 2 : 1;
  const hasSingleLiftingBeam =
    hoistEquipmentArrangement(specs, hoistKey) === "doubleDrum" &&
    doubleDrumHookSystem(specs, hoistKey) === "liftingBeam";
  const sheaveCount = Number.isFinite(sel.sheaveCount) && sel.sheaveCount > 0
    ? Math.round(sel.sheaveCount)
    : 1;
  // Kancanın kapasitesi hangi standarttan okunuyorsa özellik satırı ONU yazar.
  // Lamel kancada ölçüler de sipariş bilgisidir: ağız yarıçapı ve lamel adedi
  // olmadan satır hangi kancanın ısmarlanacağını söylemez.
  const lamella = din15407Row(sel.hookNumber);
  const forgedCapacityKg = sel.hookNumber && sel.hookStrengthClass
    ? hookCapacityKg(
        sel.hookNumber,
        sel.hookStrengthClass,
        hoistSpecView(specs, HOIST_OF_HOOKBLOCK[moduleKey]).mechanismClass
      )
    : undefined;
  const hookSpec = lamella
    ? `kapasite ${fmt(lamella.capacityT * 1000)} kg · a₁ ${fmt(lamella.a1)} mm · ` +
      `${fmt(lamella.plateCount)} lamel × ${fmt(lamella.s1)} mm (DIN 15407)`
    : `kapasite ${fmt(forgedCapacityKg ?? sel.hookCapacityKg)} kg (${
        isLamellaHook(sel.hookStandard) ? hookStandardOf(sel.hookStandard) : "DIN 15400"
      })`;
  return [
    ...(hasSingleLiftingBeam
      ? []
      : [{
          rowKey: rk("hook"),
          kind: "hook",
          component: "Kanca",
          brand: "-",
          model: textOr(sel.hookDesignation),
          spec: hookSpec,
          qty: blockQuantity,
        }]),
    {
      rowKey: rk("sheave"),
      kind: "sheave",
      component: "Halat makarası",
      brand: "-",
      model: "-",
      spec: `halat ekseninde Ø${fmt(sel.sheaveDiaMm)} mm`,
      qty: sheaveCount * blockQuantity,
    },
    {
      rowKey: rk("sheaveBearing"),
      kind: "bearing",
      component: "Makara rulmanı",
      brand: textOr(sel.sheaveBearingBrand),
      model: textOr(sel.sheaveBearingCode),
      spec: `${bearingTypePrefix(sel.sheaveBearingType)}C = ${fmt(sel.sheaveBearingDynCKn, 1)} kN, C0 = ${fmt(sel.sheaveBearingStatC0Kn, 1)} kN`,
      qty: sheaveCount * 2 * blockQuantity,
    },
    ...(hasSingleLiftingBeam
      ? []
      : [{
          rowKey: rk("hookBearing"),
          kind: "bearing",
          component: "Kanca (eksenel) rulmanı",
          // MARKA SÜTUNU MARKAYI BASAR: kutu marka sormadığı sürece buraya
          // rulman TİPİ yazılıyordu ("Eksenel Bilyalı Rulman" bir marka
          // değildir). Tip artık teknik özellik metnindedir.
          brand: textOr(sel.hookBearingBrand),
          model: textOr(sel.hookBearingCode),
          spec: `${bearingTypePrefix(sel.hookBearingType)}C0 = ${fmt(sel.hookBearingStatC0Kn, 1)} kN`,
          qty: blockQuantity,
        }]),
    {
      rowKey: rk("shaft"),
      component: "Kanca bloğu mili",
      brand: "-",
      model: "-",
      spec: `malzeme ${textOr(sel.shaftMaterial)}, Ø${fmt(m.inputs.shaftD1Mm ?? 0)} mm`,
      qty: blockQuantity,
    },
    ...(hasSingleLiftingBeam
      ? [{
          rowKey: rk("liftingBeam"),
          component: "Kaldırma kirişi",
          brand: "-",
          model: "-",
          spec: `malzeme ${textOr(m.inputs.fatigueMaterial)}, açıklık ${fmt(m.inputs.beamXMm + m.inputs.beamYMm + m.inputs.beamZMm)} mm`,
          qty: 1,
        }]
      : []),
  ];
}

/**
 * Ekipman grupları vincin GERÇEK topolojisinden üretilir: hangi kaldırma
 * grupları, kanca blokları ve arabalar hesaba giriyorsa listede o kadar bölüm
 * olur (yardımcı kaldırma, ayrı yardımcı araba, monoray grupları dâhil).
 * Bölüm adları arayüzdekiyle aynı kaynaktan (`MODULE_LABELS`) gelir.
 */
/**
 * Bölüm adından rapor numarasını atar ("04 · Yardımcı Kaldırma" → "Yardımcı
 * Kaldırma"). Ekipman listesi bir satın alma belgesidir; hesap raporunun bölüm
 * numaralandırmasını taşımaz.
 */
function groupName(key: string): string {
  return baslikDuzeni((MODULE_LABELS[key] ?? key).replace(/^\d+\s*·\s*/, ""));
}

/**
 * Satır metinlerini yazım düzenine sokar.
 *
 * EKİPMAN ADI ve ÖZELLİKLER "Baş Harfler Büyük" düzenindedir (madde 33) —
 * onlar cümledir, okunmak için yazılır.
 *
 * MARKA VE MODEL ise BÜYÜK HARFLİDİR (kullanıcı kararı, 12.08.2026): ikisi de
 * bir ürünün KİMLİĞİDİR, siparişe ve teklife o yazımla geçer. Üreticiler kendi
 * adlarını zaten büyük basar ("SIBRE", "SKF", "INNOMOTICS") ve katalogdan
 * gelen satır ile elle yazılan satırın aynı markayı iki yazımla göstermesi
 * ("Haşçelik" / "HAŞÇELİK") listeyi iki ayrı üründen söz ediyor gibi
 * gösteriyordu. Model kodu bir süre HİÇ dokunulmadan bırakılıyordu; gerekçesi
 * "kod katalog kimliğidir" idi ve doğruydu ama eksikti — kimliğin tek yazımı
 * olmalıdır, ham hâli değil.
 *
 * Büyütme `kimlikBuyuk` iledir: markaların çoğu yabancıdır ve Türkçe
 * büyütme "Conductix-Wampfler"i "CONDUCTİX-WAMPFLER" yapardı. Katalog sayfası
 * ve datasheet eşlemeleri bundan ETKİLENMEZ: `dsKey` tr-küçük harfe, katalog
 * defterinin `norm`u büyük harfe indirger — ikisi de yazımdan bağımsızdır.
 *
 * Adet dışarıdadır (sayıdır); `rowKey` ham slug'tan üretildiği için bu adımdan
 * etkilenmez. "Ek Özellikler" (note) de dışarıda kalır: orası kullanıcının
 * KENDİ yazdığı serbest metindir, ekranda ne yazdıysa çıktıda da odur.
 */
function baslikDuzeniniUygula(row: EqRow): EqRow {
  return {
    ...row,
    component: baslikDuzeni(row.component),
    brand: kimlikBuyuk(row.brand),
    model: kimlikBuyuk(row.model),
    spec: baslikDuzeni(row.spec),
  };
}

/**
 * Bir modülün bileşen satırları — seçimler DIŞARIDAN verilebilir.
 *
 * Alternatif seçenekler aynı satır üreticisinden geçsin diye seçim nesnesi
 * parametredir: "Seçenek 2" satırı, ana satırla birebir aynı biçimlemeden
 * (aynı alan sırası, aynı birimler) çıkar.
 */
function moduleEquipmentRows(
  key: ModuleKey,
  inputs: object,
  selections: object,
  specs: TechnicalSpecs,
  cabinValues?: CabinValues
): EqRow[] | null {
  if (isHoistKey(key)) {
    return hoistRows(key, inputs as HoistInputs, selections as HoistSelections, specs);
  }
  if (isHookBlockKey(key)) {
    return hookBlockRows(key, {
      inputs: inputs as HookBlockInputs,
      selections: selections as HookBlockSelections,
    }, specs);
  }
  if (key === "cabin") {
    return cabinRows(specs, inputs as CabinInputs, selections as CabinSelections, cabinValues);
  }
  if (isTravelKey(key)) {
    return travelRows(
      key,
      inputs as TravelInputs,
      selections as TravelSelections,
      travelHasFestoon(specs, key)
    );
  }
  return null;
}

/**
 * Kabin ve elektrik odası bölümünün (11.x) ekipman satırları.
 *
 * Mahaller (kabin, oda, pano) ve iklimlendirmeleri artık modül girdisi ve
 * KATALOG SEÇİMİDİR; satırlar da diğer bölümlerle aynı üreticiden geçer.
 */
function cabinRows(
  specs: TechnicalSpecs,
  inp: CabinInputs,
  sel: CabinSelections,
  /** Hesaplanan mahal ısı yükleri — satın alma satırında yükü de göstermek için */
  values?: CabinValues
): EqRow[] {
  const rows: EqRow[] = [];
  const acRow = (
    site: (typeof CABIN_CLIMATE_SITES)[number],
    unitQty: number | string,
    load: ClimateLoadResult | undefined
  ): void => {
    if (!site.selected(specs)) return;
    const get = (suffix: string): unknown =>
      (sel as unknown as Record<string, unknown>)[`${site.block}${suffix}`];
    const model = typeof get("Model") === "string" ? (get("Model") as string) : "";
    const cooling = `${fmt(get("CoolingKwMin") as number, 2)}–${fmt(get("CoolingKwMax") as number, 2)} kW`;
    const ambient = (get("AmbientMaxC") as number) > 0
      ? `; ortam ≤ ${fmt(get("AmbientMaxC") as number, 0)} °C`
      : "; ortam sıcaklığı sınırı katalogda yayımlanmamış";
    // Hesaplanan yük satın alma satırında da görünür: teklif veren, seçilen
    // ünitenin hangi yükü karşılaması gerektiğini raporu açmadan görsün.
    const duty = load
      ? `; hesaplanan yük ${fmt(load.totalKw, 2)} kW, üfleme ${fmt(load.airFlowM3h, 0)} m³/h`
      : "";
    rows.push({
      rowKey: `cabin:${site.rowKey}`,
      kind: "air_conditioner",
      component: site.label,
      brand: textOr(get("Brand") as string, "Seçilmedi"),
      model: textOr(model),
      spec: model
        ? `${attrValueLabel("application", get("Application"))}; ${textOr(get("Series") as string)}; kapasite ${cooling}${ambient}${duty}`
        : `Katalogdan ürün seçilmedi${duty}`,
      qty: unitQty,
    });
  };

  if (specs.hasOperatorCabin === "yes") {
    rows.push({
      rowKey: "cabin:operator-cabin",
      component: "Operatör kabini",
      brand: "-",
      model: "İzole operatör kabini",
      // Cam ve operatör adedi satın almaya girer: kabin gövdesi bunlarla
      // sipariş edilir ve klima yükünü de bu ikisi belirler.
      spec:
        `${fmt(inp.cabinWidthM, 2)} × ${fmt(inp.cabinLengthM, 2)} × ${fmt(inp.cabinHeightM, 2)} m; ` +
        `izolasyon ${ROOM_INSULATION_LABELS[inp.cabinInsulation ?? "rockWool50"]}; ` +
        `cam ${fmt(inp.cabinGlazingAreaM2, 2)} m² ${GLAZING_KIND_LABELS[inp.cabinGlazingKind] ?? ""}; ` +
        `${fmt(inp.cabinOccupantCount, 0)} operatör`,
      qty: 1,
    });
    acRow(CABIN_CLIMATE_SITES[0], 1, values?.cabinLoad);
  }

  if (specs.electricalAccommodationType === "room") {
    const layout = values?.roomPanelLayout ?? roomPanelLayout(inp);
    const panelWidths = layout.widthsMm
      .map((width, index) => `P${index + 1} ${fmt(width, 0)}`)
      .join(", ");
    rows.push({
      rowKey: "cabin:electrical-room",
      component: "Elektrik odası",
      brand: "-",
      model: "İzole elektrik odası",
      spec:
        `${fmt(inp.roomWidthM, 2)} × ${fmt(inp.roomLengthM, 2)} × ${fmt(inp.roomHeightM, 2)} m; ` +
        `izolasyon ${ROOM_INSULATION_LABELS[inp.roomInsulation ?? "rockWool100"]}; ` +
        `${layout.count} pano (${panelWidths}); ortak H ${fmt(layout.panelHeightMm, 0)} + ` +
        `${fmt(layout.baseHeightMm, 0)} mm baza, D ${fmt(layout.panelDepthMm, 0)} mm; ` +
        `kapı ${fmt(layout.doorWidthMm, 0)} × ${fmt(layout.doorHeightMm, 0)} mm; ` +
        `pano önü geçiş ${fmt(layout.walkingClearanceMm, 0)} mm`,
      qty: 1,
    });
    acRow(CABIN_CLIMATE_SITES[1], inp.roomAcRedundancy === "nPlusOne" ? "2 (1+1)" : 1, values?.roomLoad);
  }

  if (specs.electricalAccommodationType === "panel") {
    const panelCount = inp.panelCount > 0 ? inp.panelCount : 1;
    rows.push({
      rowKey: "cabin:electrical-panel",
      component: "Elektrik panosu",
      brand: "-",
      model: "Pano tipi yerleşim",
      spec: `Yan yana pano yerleşimi; koruma sınıfı ${textOr(inp.panelIpClass, "IP55")}; oda izolasyonu uygulanmaz`,
      qty: panelCount,
    });
    acRow(
      CABIN_CLIMATE_SITES[2],
      inp.panelAcRedundancy === "nPlusOne" ? `${panelCount * 2} (1+1)` : panelCount,
      values?.panelLoad
    );
  }

  return rows;
}

/** İki satır aynı ekipmanı mı anlatıyor (alternatif gerçekten farklı mı)? */
function sameEquipment(a: EqRow, b: EqRow): boolean {
  return (
    a.brand === b.brand &&
    a.model === b.model &&
    a.spec === b.spec &&
    String(a.qty) === String(b.qty)
  );
}

/**
 * Alternatif (seçenekli) satırları ana satırların ALTINA yerleştirir.
 *
 * Bir seçenek yalnız kendi bölümünün seçim alanlarını taşır; canlı seçimlerin
 * üzerine bindirilip aynı satır üreticisi koşturulur ve ana satırdan FARKLI
 * çıkan satırlar alınır. Böylece halat alternatifi yalnız halat satırını
 * çoğaltır, tamburu/redüktörü tekrar etmez.
 *
 * Alternatif satırın `rowKey`i KENDİNE aittir (`...#<bölüm>-<seçenek>`): ana
 * satırın anahtarını çalarsa "Ek Özellikler" notları (madde 34) yanlış satıra
 * bağlanır.
 */
function withAlternativeRows(
  key: ModuleKey,
  state: { inputs: object; selections: object },
  mainRows: EqRow[],
  alts: RevisionAlts,
  specs: TechnicalSpecs,
  cabinValues?: CabinValues
): EqRow[] {
  const variants: { label: number; sectionRawId: string; rows: EqRow[] }[] = [];
  for (const [altKey, st] of Object.entries(alts)) {
    const parts = splitAltKey(altKey);
    if (!parts || parts.moduleKey !== key) continue;
    st.options.forEach((option, i) => {
      if (i === st.active) return;
      const rows = moduleEquipmentRows(key, state.inputs, {
        ...state.selections,
        ...option,
      }, specs, cabinValues);
      if (rows) variants.push({ label: i + 1, sectionRawId: parts.sectionRawId, rows });
    });
  }
  if (variants.length === 0) return mainRows;

  const out: EqRow[] = [];
  for (const main of mainRows) {
    out.push(main);
    // Halat dengeleme ekipmanı (soket/loadcell/rulman/makara) OTOMATİK türetilir
    // ve halat seçeneğine göre değişebilir; ama bunlar kullanıcının seçtiği bir
    // "alternatif" değildir. Rope alternatifleri denge satırlarını çoğaltmasın.
    if (main.rowKey && main.rowKey.includes(":balance")) continue;
    for (const v of variants) {
      const alt = v.rows.find((r) => r.rowKey === main.rowKey);
      if (!alt || sameEquipment(alt, main)) continue;
      out.push({
        ...alt,
        rowKey: main.rowKey ? `${main.rowKey}#${v.sectionRawId}-${v.label}` : undefined,
        component: `${main.component} — Seçenek ${v.label}`,
        alt: v.label,
      });
    }
  }
  return out;
}

/**
 * Gizlenen alt bölümlerin ekipman satırı slug'ları — MODÜL başına.
 *
 * Bölüm → satır bağı bölüm tanımının kendi `equipmentSlugs` bildiriminden
 * okunur (checkSuffixes ile aynı desen); burada ikinci bir eşleme tutulmaz.
 * Anahtar biçimi `sectionHideKeyFor` iledir ve HAM bölüm id'sini taşır —
 * köprüde görünen "6.8" değil, tanımdaki "5.7".
 */
function hiddenEquipmentSlugs(key: ModuleKey, hidden: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  if (hidden.size === 0) return out;
  const defs: readonly { id: string; equipmentSlugs?: readonly string[] }[] = isHoistKey(key)
    ? HOIST_SECTIONS
    : isHookBlockKey(key)
      ? HOOKBLOCK_SECTIONS
      : isTravelKey(key)
        ? TRAVEL_SECTIONS
        : key === "cabin"
          ? CABIN_SECTIONS
          : [];
  for (const s of defs) {
    if (!hidden.has(`${key}-${s.id}`)) continue;
    for (const slug of s.equipmentSlugs ?? []) out.add(slug);
  }
  return out;
}

/**
 * Satırın slug'ı: `<modulKey>:<slug>`. Alternatif satırlar ana anahtarı
 * `#<bölüm>-<seçenek>` sonekiyle taşır; gizlenen bölümün alternatifi de ana
 * satırıyla birlikte düşsün diye sonek atılarak okunur.
 */
function rowSlug(rowKey: string | undefined, key: ModuleKey): string | undefined {
  if (!rowKey || !rowKey.startsWith(`${key}:`)) return undefined;
  const rest = rowKey.slice(key.length + 1);
  const hash = rest.indexOf("#");
  return hash >= 0 ? rest.slice(0, hash) : rest;
}

export function buildEquipmentGroups(
  input: CalcInput,
  notes?: EquipmentNotes,
  /** Alternatif (seçenekli) seçimler — `selections.alts` (altsFromRevision) */
  alts?: RevisionAlts,
  /** row_key → yüklenmiş PDF ekleri (equipment_attachments) */
  attachments?: EquipmentAttachments,
  /**
   * Gizlenen alt bölümler (`inputs.hiddenSections`, `hiddenSectionsFromRevision`
   * ile okunur). Gizlenen bölümün ekipman satırları listeye GİRMEZ — ekran,
   * Excel ve PDF aynı fonksiyondan geçtiği için üçü birden düşer.
   */
  hiddenSections?: readonly string[]
): EqGroup[] {
  const hiddenSet = new Set(hiddenSections ?? []);
  const groups: EqGroup[] = [];
  // Mahal ısı yükleri satın alma satırında da gösterilir; hesap saf olduğu
  // için burada yeniden koşturulur (sonuç nesnesi bu imzada yok).
  const cabinValues = input.cabin
    ? computeCabin(
        input.specs, input.cabin.inputs, input.cabin.selections, cabinDepsFrom(input)
      ).values
    : undefined;
  for (const key of MODULE_ORDER) {
    const state = moduleState(input, key);
    if (!state) continue;
    const rows = moduleEquipmentRows(key, state.inputs, state.selections, input.specs, cabinValues);
    if (!rows) continue;
    const rowsWithAlternatives = alts
      ? withAlternativeRows(key, state, rows, alts, input.specs, cabinValues)
      : rows;
    // Gizlenen alt bölümün satırları düşer (alternatifleri dâhil). Süzgeç
    // slug bazlıdır: bölüm tanımı hangi satırların kendisine ait olduğunu
    // `equipmentSlugs` ile bildirir.
    const hiddenSlugs = hiddenEquipmentSlugs(key, hiddenSet);
    const visibleRows = hiddenSlugs.size === 0
      ? rowsWithAlternatives
      : rowsWithAlternatives.filter((row) => {
          const slug = rowSlug(row.rowKey, key);
          return !slug || !hiddenSlugs.has(slug);
        });
    // BOŞ GRUP BASILMAZ — sebebi ne olursa olsun. İki yol da buraya çıkar:
    // gizleme bölümün bütün satırlarını düşürmüş olabilir ya da bölüm baştan
    // hiç satır üretmemiş olabilir (kabin bölümünde mahal seçilmemişse).
    // Koşul bir süre yalnız BİRİNCİ yolu kapatıyordu (`&& rowsWithAlternatives
    // .length > 0`); ikinci yol o zaman erişilemezdi, yalnız araba yenilenen
    // raporlarla erişilebilir oldu ve boş bir grup bandı "satırları
    // unutulmuş" gibi okunurdu.
    if (visibleRows.length === 0) continue;
    // İkiz kaldırma, mühendislik hesabını değil satın alma/montaj için hazır
    // ekipman adetlerini iki katına çıkarır. Kanca bloğu ve diğer gruplar tek
    // hesap düzeninde kalır.
    const quantityFactor = isHoistKey(key)
      ? hoistEquipmentQuantityFactor(input.specs, key)
      : 1;
    groups.push({
      name: groupName(key),
      rows: quantityFactor === 1
        ? visibleRows
        : visibleRows.map((row) => ({
            ...row,
            qty: typeof row.qty === "number" ? row.qty * quantityFactor : row.qty,
          })),
    });
  }
  // Notlar ve ekler satırlara KARARLI anahtarla bağlanır, ardından başlık
  // düzeni uygulanır. Sıra bu yöndedir: anahtar önce, biçimleme sonra —
  // `baslikDuzeni` etiketi değiştirir, anahtar ondan türetilseydi kopardı.
  return groups.map((g) => ({
    name: g.name,
    rows: g.rows.map((r) =>
      baslikDuzeniniUygula(
        r.rowKey
          ? {
              ...r,
              note: notes?.[r.rowKey] ?? "",
              ...(attachments?.[r.rowKey]?.length
                ? { attachments: attachments[r.rowKey] }
                : {}),
            }
          : r
      )
    ),
  }));
}

const HYPERLINK_FONT = { color: { argb: "FF1155CC" }, underline: true as const };

function writeEquipmentSheet(
  ws: ExcelJS.Worksheet,
  groups: EqGroup[],
  meta: EquipmentMeta,
  datasheetUrls?: Map<string, string>,
  /** Ekipman ADINA bağlanan katalog sayfası adresleri (mutlak) */
  sheetUrls?: Map<string, string>,
  /** Ekipman listesinin üstünde açılan müşteri ana pafta bağlantısı. */
  mainDrawingUrl?: string
): number {
  // Sütunlar: Ekipman · Marka · Model · Özellikler · Ek Özellikler · Ek Belge · Adet
  const COL_COUNT = 7;
  const QTY_COL = 7;
  const ATTACH_COL = 6;
  let headerRowNo = writeBand(ws, "EKİPMAN LİSTESİ", meta, COL_COUNT);

  if (mainDrawingUrl) {
    ws.mergeCells(`A${headerRowNo}:${colLetter(COL_COUNT)}${headerRowNo}`);
    const link = ws.getCell(`A${headerRowNo}`);
    link.value = { text: "Proje Ana Paftasını Aç ↗", hyperlink: mainDrawingUrl };
    link.font = { ...HYPERLINK_FONT, name: TITLE_FONT, size: 10 };
    link.alignment = { vertical: "middle" };
    ws.getRow(headerRowNo).height = 19;
    headerRowNo += 1;
  }

  // Tablo başlığı — müşteriye teslim edilebilir profesyonel sütunlar.
  // Ortak `styleHeaderRow` KULLANILMAZ: o, açık (Kağıt 200) zeminli iç
  // çıktıların başlığıdır; müşteri belgesi kömür zeminli, çerçeveli ve adet
  // sütunu sağa dayalı başlık taşır.
  const header = ws.getRow(headerRowNo);
  ["Ekipman", "Marka", "Model", "Özellikler", "Ek Özellikler", "Ek Belge", "Adet"].forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { name: TITLE_FONT, bold: true, color: { argb: PAPER } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = {
      horizontal: i + 1 === QTY_COL ? "right" : "left",
      vertical: "middle",
    };
  });
  header.height = 18;

  // Başlığa kadar dondur + başlık satırında filtre
  ws.views = [{ state: "frozen", ySplit: headerRowNo }];
  ws.autoFilter = {
    from: { row: headerRowNo, column: 1 },
    to: { row: headerRowNo, column: COL_COUNT },
  };

  let rowNo = headerRowNo + 1;
  let componentCount = 0;

  groups.forEach((group) => {
    // Grup başlığı: birleşik satır (marka kırmızısı üst çizgi, nötr dolgu)
    ws.mergeCells(`A${rowNo}:${colLetter(COL_COUNT)}${rowNo}`);
    const gc = ws.getCell(`A${rowNo}`);
    gc.value = group.name;
    gc.font = { bold: true };
    gc.fill = COL_FILL;
    for (let c = 1; c <= COL_COUNT; c++) {
      ws.getRow(rowNo).getCell(c).border = {
        ...THIN_BORDER,
        top: { style: "medium", color: { argb: ORION_RED } },
      };
    }
    rowNo += 1;

    group.rows.forEach((r) => {
      const row = ws.getRow(rowNo);
      // Ekipman adı: katalog sayfası varsa müşteriye açık görüntüleyiciye köprü.
      // Excel dosyası uygulamanın dışında açıldığı için adres MUTLAKTIR.
      const sheetUrl = rowSheetUrl(r, sheetUrls);
      if (sheetUrl) {
        row.getCell(1).value = { text: r.component, hyperlink: sheetUrl };
        row.getCell(1).font = HYPERLINK_FONT;
      } else {
        row.getCell(1).value = r.component;
      }
      row.getCell(2).value = r.brand;
      // Model hücresi: üreticinin teknik föyü varsa köprüle. Anahtar KATALOG
      // kimliğidir, görünen model değil (bkz. `rowDatasheetUrl`). Klima
      // satırlarında website bağlantısı müşteri çıktılarında gösterilmez.
      const url = rowDatasheetUrl(r, datasheetUrls);
      if (url && r.model && r.model !== "-") {
        row.getCell(3).value = { text: r.model, hyperlink: url };
        row.getCell(3).font = HYPERLINK_FONT;
      } else {
        row.getCell(3).value = r.model;
      }
      row.getCell(4).value = r.spec;
      row.getCell(5).value = r.note ?? "";
      // "Ek Belge": baytlar Excel'e GİRMEZ, yalnız sayfa adedi ve dosya adı
      // yazılır. Ekin kendisi DETAYLI PDF'in sonundadır; çalışma kitabına
      // gömülü bir PDF, dosyayı hem şişirir hem de her açanda güven uyarısı
      // çıkarırdı.
      row.getCell(ATTACH_COL).value = attachmentSummaryText(r.attachments);
      row.getCell(QTY_COL).value = r.qty;
      // Adet: sayılar TR ayraçlı, sağa dayalı, mono
      if (typeof r.qty === "number") {
        row.getCell(QTY_COL).numFmt = Number.isInteger(r.qty) ? "#,##0" : "#,##0.00";
        row.getCell(QTY_COL).font = { name: MONO_FONT };
      }
      for (let c = 1; c <= COL_COUNT; c++) {
        const cell = row.getCell(c);
        cell.border = THIN_BORDER;
        cell.alignment = {
          horizontal: c === QTY_COL ? "right" : "left",
          vertical: "middle",
          wrapText: c === 4 || c === 5 || c === ATTACH_COL,
          // Alternatif satır ana satırın altında GİRİNTİLİ durur: satın alma
          // listesinde hangi satırın asıl seçim olduğu tek bakışta görünsün.
          indent: r.alt && c === 1 ? 1 : undefined,
        };
        // Alternatifler ikincil bilgidir: eğik ve soluk yazılır. Köprülü
        // hücrelerin (ekipman adı, model) rengi bozulmaz — bağlantı mavisi
        // kalmazsa tıklanabilir olduğu anlaşılmaz.
        if (r.alt && !cell.font?.underline) {
          cell.font = { ...(cell.font ?? {}), italic: true, color: { argb: MUTED_GRAY } };
        }
      }
      rowNo += 1;
      componentCount += 1;
    });
  });

  writeFooterRow(ws, rowNo + 1, COL_COUNT, "EKİPMAN LİSTESİ", meta);

  autoWidth(ws, WIDTH_MIN, WIDTH_MAX);
  ws.getColumn(4).width = 46; // özellik metni uzun; sabit geniş + wrap
  ws.getColumn(5).width = 32; // ek özellikler: kullanıcı metni, wrap
  ws.getColumn(ATTACH_COL).width = 26; // ek belge: sayfa adedi + dosya adı
  return componentCount;
}

/** Altbilgi: gri küçük mono satır — "ORION CRANES · {sayfa} · {doküman no}" */
function writeFooterRow(
  ws: ExcelJS.Worksheet,
  rowNo: number,
  colCount: number,
  sheetLabel: string,
  meta: EquipmentMeta
): void {
  const lastCol = colLetter(colCount);
  ws.mergeCells(`A${rowNo}:${lastCol}${rowNo}`);
  const cell = ws.getCell(`A${rowNo}`);
  cell.value = `ORION CRANES · ${sheetLabel} · ${textOr(meta.docNo)}`;
  cell.font = { name: MONO_FONT, size: 8, color: { argb: MUTED_GRAY } };
  cell.alignment = { horizontal: "left", vertical: "middle" };
}

/** Datasheet link eşleme anahtarı (kind|brand|model, normalize) */
export function dsKey(
  kind: string,
  brand: string,
  model: string,
  catalogInputRpm?: number
): string {
  const norm = (s: string) => (s ?? "").trim().toLocaleLowerCase("tr");
  const rpm = catalogInputRpm !== undefined && Number.isFinite(catalogInputRpm)
    ? `|n1=${Number(catalogInputRpm.toFixed(3))}`
    : "";
  return `${norm(kind)}|${norm(brand)}|${norm(model)}${rpm}`;
}

/**
 * Ekipman satırının ekran/Excel/PDF bağlantı sözlüğündeki tek anahtarı.
 *
 * H serisinde `n1` anahtarın parçasıdır. Anahtarı çağrı yerlerinde yeniden
 * kurmak ekran düğmesinin `n1`i unutmasına, PDF'nin ise doğru çalışmasına yol
 * açmıştı; bütün yüzeyler artık bu yardımcıyı kullanır.
 */
export function rowCatalogSheetKey(
  row: Pick<EqRow, "kind" | "brand" | "model" | "catalogModel" | "catalogInputRpm">
): string | undefined {
  if (!row.kind) return undefined;
  const model = (row.catalogModel ?? row.model ?? "").trim();
  if (!model || model === "-") return undefined;
  return dsKey(row.kind, row.brand, model, row.catalogInputRpm);
}

/**
 * Satır → KATALOG SAYFASI adresi eşlemesi.
 *
 * `datasheetUrls` ile karıştırılmaz: o, yönetim panelinden elle girilen ÜRETİCİ
 * WEB SAYFASIDIR ve model hücresine bağlanır. Buradaki adres ise uygulamanın
 * kendi müşteri katalog sayfası görüntüleyicisidir (`/paylas/katalog`) ve EKİPMAN ADINA
 * bağlanır — mühendisin aradığı şey çoğu zaman ölçü resmidir, üretici sitesi
 * değil.
 *
 * Sayfası olmayan ürün eşlemeye GİRMEZ; bağlantı ancak gerçekten açılacak bir
 * sayfa varsa kurulur.
 */
export function buildCatalogSheetUrls(groups: EqGroup[], origin = ""): Map<string, string> {
  const urls = new Map<string, string>();
  for (const group of groups) {
    for (const row of group.rows) {
      const id = catalogIdentityOf(row);
      if (!id) continue;
      // Anahtar gerçek katalog kimliğinden üretilir: ana ve yardımcı kaldırma
      // aynı görünen halat modelini taşısa bile çap/öz/MPa ürünü çakışmaz.
      const key = rowCatalogSheetKey(row);
      if (!key) continue;
      if (urls.has(key)) continue;
      if (!findCatalogSheet(id.kind, id.brand, id.model, { inputRpm: id.inputRpm })) continue;
      urls.set(
        key,
        catalogSheetPageUrl(id.kind, id.brand, id.model, origin, {
          inputRpm: id.inputRpm,
        })
      );
    }
  }
  return urls;
}

/**
 * Satırın katalog KİMLİĞİ — yoksa (kataloga bağlanmayan imalat kalemi) null.
 *
 * Kimlik çoğu satırda görünen marka/model sütunlarıdır; `catalogModel` taşıyan
 * satırlarda ise o alandır (bkz. `EqRow.catalogModel`).
 */
export function catalogIdentityOf(
  row: Pick<EqRow, "kind" | "brand" | "model" | "catalogModel" | "catalogInputRpm">
): { kind: string; brand: string; model: string; inputRpm?: number } | null {
  if (!row.kind) return null;
  const model = (row.catalogModel ?? row.model ?? "").trim();
  if (!model || model === "-") return null;
  return {
    kind: row.kind,
    brand: row.brand,
    model,
    inputRpm: row.catalogInputRpm,
  };
}

/** Satırın katalog sayfası adresi (yoksa undefined). */
export function rowSheetUrl(
  row: Pick<EqRow, "kind" | "brand" | "model" | "catalogModel" | "catalogInputRpm">,
  urls?: Map<string, string> | Record<string, string>
): string | undefined {
  return lookupByCatalogKey(row, urls);
}

/**
 * Satırın ÜRETİCİ FÖYÜ adresi — `cat_equipment.datasheet_url` (yoksa undefined).
 *
 * Katalog SAYFASINDAN farklı bir belgedir (o uygulamanın kendi görüntüleyicisi,
 * bu üreticinin kendi PDF'i) ama ANAHTARI aynıdır ve aynı olmak ZORUNDADIR:
 * sözlük `cat_equipment` satırlarından kurulur, dolayısıyla anahtardaki model
 * KATALOG modelidir ("Ø20 6x36 WS IWRC 1960 MPa"). Satırda GÖRÜNEN model ise
 * satın almanın istediği tanımdır ("6X36 WS SAĞ HELİS").
 *
 * Bağlantı bir süre görünen modelle arandı; o anahtar hiçbir zaman tutmuyordu
 * ve kimliği `catalogModel`de duran satırların — HALAT, redüktör (2.3/5.5) ve
 * yürütme freni — HİÇBİRİ föy bulamıyordu. Sessiz bir kayıptı: model hücresi
 * düz metin kalıyor, eksik olduğu ancak üreticinin föyü aranınca anlaşılıyordu.
 */
export function rowDatasheetUrl(
  row: Pick<EqRow, "kind" | "brand" | "model" | "catalogModel" | "catalogInputRpm">,
  urls?: Map<string, string> | Record<string, string>
): string | undefined {
  if (!canLinkEquipmentModel(row.kind)) return undefined;
  return lookupByCatalogKey(row, urls);
}

/** İki sözlük de `rowCatalogSheetKey` ile anahtarlanır; arama tek yerdedir. */
function lookupByCatalogKey(
  row: Pick<EqRow, "kind" | "brand" | "model" | "catalogModel" | "catalogInputRpm">,
  urls?: Map<string, string> | Record<string, string>
): string | undefined {
  if (!urls) return undefined;
  const key = rowCatalogSheetKey(row);
  if (!key) return undefined;
  return urls instanceof Map ? urls.get(key) : urls[key];
}

// --- Sayfa 2: Teknik Ressam Özeti --------------------------------------------

export interface SummaryRow {
  label: string;
  value: number | string;
  unit?: string;
  /** Değer teknik resimde bir çap ölçüsüdür; ekran/Excel/PDF başına Ø koyar. */
  diameter?: true;
  /**
   * Satırın ALTINA düşen tek cümlelik açıklama — ressamın çizerken bilmesi
   * gereken ama bir ölçü olmayan şey ("mesnette 6,3 mm", "yalnız tek helisli
   * tamburda"). Ölçüyü ikinci bir sütuna taşımak yerine buraya yazılır: özet
   * üç yüzeyde birden (ekran · Excel · PDF) ÜÇ SÜTUNDUR ve dördüncü bir sütun
   * üçünü birden yeniden ölçmeyi gerektirirdi.
   */
  note?: string;
}

/** Teknik ressam özetinin üç çıktısında kullanılan tek değer biçimleyicisi. */
export function summaryRowValue(row: SummaryRow): string {
  return withDiameterSign(String(row.value), row);
}

/**
 * Özet bölümünün TÜRÜ. Verilmezse `"table"` — yani eski davranış.
 * `"notes"` mühendisin ressama yazdığı serbest metindir ve satır taşımaz.
 */
export type SummarySectionKind = "table" | "notes";

export interface SummarySection {
  name: string;
  rows: SummaryRow[];
  /** Varsayılan "table"; alan yoksa bugünkü yazıcılar aynen doğrudur. */
  kind?: SummarySectionKind;
  /** `kind: "notes"` — satır sonları KORUNAN serbest metin. */
  text?: string;
  /**
   * Bölümün başına basılan ŞEMA (yalnız PDF ve ekran; Excel atlar).
   *
   * Ressamın gerçekten baktığı şey sayı tablosu değil resmin kendisidir:
   * kiriş kesiti, tambur, teker mili. Şema hesap raporundakiyle AYNI
   * üreticiden gelir (`lib/diagrams`) — ikinci bir çizim yazılmaz, yoksa
   * kâğıttaki iki resim bir gün ayrışır ve o fark yanlış kesilmiş bir sactır.
   */
  diagram?: Diagram;
}

/** GirderInputs / EndCarriageInputs plaka alanlarını etiketleriyle listeler */
function plateRows<T extends object>(
  fields: { key: keyof T & string; label: string; unit?: string }[],
  keys: (keyof T & string)[],
  values: T
): SummaryRow[] {
  return keys.map((key) => {
    const def = fields.find((f) => f.key === key);
    const raw = values[key];
    return {
      label: def?.label ?? key,
      value: typeof raw === "number" ? Number(raw.toFixed(2)) : String(raw),
      unit: def?.unit,
    };
  });
}

const GIRDER_PLATE_KEYS: (keyof GirderInputs & string)[] = [
  "railHeightMm", "t1Mm", "b1Mm", "t2Mm", "b2Mm", "t3Mm", "h3Mm",
  "t4Mm", "t5Mm", "b5Mm", "t6Mm", "b6Mm", "aMm", "xMm",
];

/**
 * Ray altı T profil ölçüleri — AYRI liste, çünkü yalnız profil VARKEN basılır.
 * Anahtar kapalıyken değerler korunur ama kesite girmez (HESAP-8c); girmeyen
 * bir sac ölçüsünü ressama göndermek yanlış kesim demektir.
 */
const GIRDER_T_PROFILE_KEYS: (keyof GirderInputs & string)[] = [
  "railTProfileWebThkMm", "railTProfileWebHeightMm",
  "railTProfileTopThkMm", "railTProfileTopWidthMm",
];

/**
 * `ModuleResult.cells`ten SAYI okur. Hücreler `number | string` taşır; eksik
 * ya da metin bir hücre `NaN` döner ve `fmt` onu "-" basar (uydurma sıfır
 * yazılmaz — AGENTS md. 4).
 */
function numCell(
  cells: Record<string, number | string> | undefined,
  key: string
): number {
  const v = cells?.[key];
  return typeof v === "number" ? v : Number.NaN;
}

const ENDCARRIAGE_PLATE_KEYS: (keyof EndCarriageInputs & string)[] = [
  "wheelSpanAMm", "loadOffsetBMm",
  "topPlateThicknessMm", "topPlateWidthMm",
  "sidePlateThicknessMm", "sidePlateHeightMm",
  "bottomPlateThicknessMm", "bottomPlateWidthMm",
];

/**
 * Teknik Resim Takibi defterinin özete düşen hâli.
 *
 * Ekipman listesi hesap motorundan beslenir, bu defter ise projeden — ikisi
 * ayrı kaynaktır, bu yüzden AYRI BİR PARAMETRE olarak girer. `CalcInput`a
 * konsaydı numaralandırma revizyon snapshot'ına gömülür ve proje başında
 * verilmiş bir karar, sonradan açılan her revizyonda donardı.
 */
export interface EquipmentDrawingPlan {
  /** Tam resim numarasının kökü — iş kalemi no ("0055-00"). Boşsa yalnız kod basılır. */
  itemNo: string;
  rows: DrawingPlanRow[];
}

export function buildSummarySections(
  input: CalcInput,
  result: CalcResult,
  drawingPlan?: EquipmentDrawingPlan,
  /**
   * Mühendisin RESSAMA yazdığı serbest not (`equipment_drawing_notes`).
   * Özetin EN SONUNA kendi bölümüyle iner; boşsa bölüm hiç açılmaz.
   */
  drawingNote?: string
): SummarySection[] {
  const specs = input.specs;
  const sections: SummarySection[] = [];

  // Yalnız vinçte GERÇEKTEN olan kaldırma grupları listelenir; kapalı bir
  // yardımcı kaldırmanın kapasitesini ilan etmek teknik ressamı yanıltır.
  const genelRows: SummaryRow[] = [
    { label: "Açıklık (L)", value: specs.spanM, unit: "m" },
  ];
  for (const key of MODULE_ORDER) {
    if (!isHoistKey(key)) continue;
    const state = moduleState(input, key);
    if (!state) continue;
    const view = hoistSpecView(specs, key);
    const ad = groupName(key);
    const arrangement = HOIST_EQUIPMENT_ARRANGEMENT_LABELS[hoistEquipmentArrangement(specs, key)];
    const reeving = (state.inputs as { reevingLabel?: string }).reevingLabel?.trim();
    genelRows.push(
      { label: `${ad} kapasitesi`, value: view.capacityT, unit: "ton" },
      { label: `${ad} yüksekliği`, value: view.liftHeightM, unit: "m" },
      { label: `${ad} hızı`, value: view.liftSpeedMpm, unit: "m/dak" },
      {
        label: `${ad} Donanımı`,
        value: reeving ? `${arrangement} - ${reeving}` : arrangement,
      }
    );
  }
  for (const key of MODULE_ORDER) {
    if (!isTravelKey(key) || !moduleState(input, key)) continue;
    genelRows.push({
      label: `${groupName(key)} hızı`,
      value: travelSpecView(specs, key, { hookEquipmentT: 0, trolleyWeightT: 0 }).speedMpm,
      unit: "m/dak",
    });
  }
  genelRows.push({ label: "Kanca tipi", value: specs.hookType });
  sections.push({ name: "Genel Ölçüler ve Kapasiteler", rows: genelRows });

  // Kabin / oda / pano ölçüleri artık 11. bölümün girdisidir; teknik ressam
  // özeti de oradan okur (teknik özelliklerde yalnız "var mı" bilgisi kalır).
  const cabin = input.cabin;
  if (cabin && specs.hasOperatorCabin === "yes") {
    sections.push({
      name: "Operatör Kabini",
      rows: [
        { label: "Kabin genişliği", value: cabin.inputs.cabinWidthM || "-", unit: "m" },
        { label: "Kabin uzunluğu", value: cabin.inputs.cabinLengthM || "-", unit: "m" },
        { label: "Kabin yüksekliği", value: cabin.inputs.cabinHeightM || "-", unit: "m" },
        { label: "Kabin izolasyonu", value: ROOM_INSULATION_LABELS[cabin.inputs.cabinInsulation ?? "rockWool50"] },
        {
          label: "Kabin kliması",
          value: cabinHasAirConditioner(specs)
            ? textOr(cabin.selections.cabinAcModel, "Katalogdan seçilmedi")
            : "Yok",
        },
      ],
    });
  }

  if (cabin && specs.electricalAccommodationType === "room") {
    const layout = roomPanelLayout(cabin.inputs);
    sections.push({
      name: "Elektrik Odası",
      rows: [
        { label: "Oda genişliği", value: cabin.inputs.roomWidthM || "-", unit: "m" },
        { label: "Oda uzunluğu", value: cabin.inputs.roomLengthM || "-", unit: "m" },
        { label: "Oda yüksekliği", value: cabin.inputs.roomHeightM || "-", unit: "m" },
        { label: "Oda izolasyonu", value: ROOM_INSULATION_LABELS[cabin.inputs.roomInsulation ?? "rockWool100"] },
        { label: "Kapı ölçüsü", value: `${layout.doorWidthMm} × ${layout.doorHeightMm}`, unit: "mm" },
        { label: "Pano adedi", value: layout.count, unit: "adet" },
        { label: "Pano enleri", value: layout.widthsMm.join(" + "), unit: "mm" },
        { label: "Pano yüksekliği", value: `${layout.panelHeightMm} + ${layout.baseHeightMm} baza`, unit: "mm" },
        { label: "Pano derinliği", value: layout.panelDepthMm, unit: "mm" },
        { label: "Pano önü yürüme mesafesi", value: layout.walkingClearanceMm, unit: "mm" },
        {
          label: "Elektrik odası kliması",
          value: roomHasAirConditioner(specs)
            ? textOr(cabin.selections.roomAcModel, "Katalogdan seçilmedi")
            : "Yok",
        },
        {
          label: "Klima yedeği",
          value: AIR_CONDITIONING_REDUNDANCY_LABELS[cabin.inputs.roomAcRedundancy ?? "none"],
        },
      ],
    });
  }

  if (cabin && specs.electricalAccommodationType === "panel") {
    sections.push({
      name: "Pano Tipi",
      rows: [
        { label: "Pano adedi", value: cabin.inputs.panelCount || 1, unit: "adet" },
        { label: "Pano koruma sınıfı", value: textOr(cabin.inputs.panelIpClass, "IP55") },
        {
          label: "Pano kliması",
          value: panelHasAirConditioner(specs)
            ? textOr(cabin.selections.panelAcModel, "Katalogdan seçilmedi")
            : "Yok",
        },
        {
          label: "Klima yedeği",
          value: AIR_CONDITIONING_REDUNDANCY_LABELS[cabin.inputs.panelAcRedundancy ?? "none"],
        },
      ],
    });
  }

  // ---------------------------------------------------------------- Yürütme
  // BÖLÜM BAŞINA BİR ÇİZELGE. Eskiden tek bir "Ray ve Tekerlekler" bölümü
  // vardı ve YALNIZ ana araba ile köprüye bakıyordu: yardımcı araba ve
  // monoray arabaları ressama hiç ulaşmıyordu. Döngü artık `MODULE_ORDER`
  // üzerindedir — vinçte hangi yürütme grubu varsa çizelgesi de vardır.
  for (const key of MODULE_ORDER) {
    if (!isTravelKey(key)) continue;
    const st = moduleState(input, key);
    if (!st) continue;
    const inp = st.inputs as TravelInputs;
    const sel = st.selections as TravelSelections;
    const c = moduleResult(result, key)?.cells;
    const ad = groupName(key);
    const rows: SummaryRow[] = [
      { label: "Ray tipi", value: textOr(sel.railCode) },
      { label: "Ray baş genişliği", value: fmt(numCell(c, "rail.headWidth"), 0), unit: "mm" },
      { label: "Teker çapı", value: sel.wheelDiaMm, unit: "mm", diameter: true },
      { label: "Teker adedi", value: inp.wheelCount, unit: "adet" },
      {
        label: "Tahrikli teker adedi",
        value: fmt(numCell(c, "drive.drivenWheels"), 0),
        unit: "adet",
        note: `motor başına ${fmt(numCell(c, "drive.wheelsPerMotor"), 0)} teker`,
      },
      { label: "Teker bandaj genişliği", value: inp.wheelWidthMm ?? "-", unit: "mm" },
      { label: "Teker malzemesi", value: textOr(sel.wheelMaterial) },
      ...(travelWheelHardnessText(sel.wheelHardness)
        ? [{ label: "Teker sertliği", value: travelWheelHardnessText(sel.wheelHardness)! }]
        : []),
      // Teker mili ölçüleri doğrudan teknik resme geçer.
      { label: "Teker mili çapı", value: inp.shaftDiaMm, unit: "mm", diameter: true },
      { label: "Teker mili mesnet ölçüsü a", value: inp.shaftSpanAMm, unit: "mm" },
      { label: "Teker mili ölçüsü b", value: inp.shaftSpanBMm, unit: "mm" },
      { label: "Kapline bağlanan mil çapı", value: sel.wheelShaftDiaMm, unit: "mm", diameter: true },
      { label: "Teker rulmanı iç çapı", value: sel.bearingBoreMm ?? "-", unit: "mm", diameter: true },
      { label: "Teker rulmanı dış çapı", value: sel.bearingOuterDiaMm ?? "-", unit: "mm", diameter: true },
      { label: "Teker rulmanı genişliği", value: sel.bearingWidthMm ?? "-", unit: "mm" },
      {
        label: "Motor",
        value: `${textOr(sel.motorBrand, "")} ${textOr(sel.motorModel, "")}`.trim() || "-",
      },
      { label: "Motor gücü", value: sel.motorPowerKw, unit: "kW", note: `${sel.motorCount} adet` },
      { label: "Motor mil çapı", value: sel.motorShaftMm, unit: "mm", diameter: true },
      { label: "Redüktör", value: textOr(sel.gearboxModel) },
      { label: "Redüktör oranı", value: sel.gearboxRatio },
      { label: "Redüktör giriş mili", value: sel.gearboxInputShaftMm ?? "-", unit: "mm", diameter: true },
      { label: "Redüktör çıkış mili", value: sel.gearboxOutputShaftMm, unit: "mm", diameter: true },
      {
        label: "Fren",
        value: `${textOr(sel.brakeBrand, "")} ${fmt(sel.brakeTorqueNm, 0)} Nm`.trim(),
      },
      { label: "Fren kasnak çapı", value: sel.brakeWheelDiaMm || "-", unit: "mm", diameter: true },
      { label: "Gerçekleşen hız", value: fmt(numCell(c, "drive.actualSpeed"), 1), unit: "m/dak" },
    ];
    if (key === "bridge") {
      rows.push({ label: "Minimum araba yanaşması", value: inp.minApproachM, unit: "m" });
    }
    // Tampon bir yürütme grubunun ucundadır; ressam montaj yerini ona göre
    // bırakır (tamponsuz seçimde bölüm zaten hiç yoktur).
    if (textOr(sel.bufferModel, "") !== "") {
      rows.push(
        { label: "Tampon", value: textOr(sel.bufferModel) },
        { label: "Tampon strok", value: sel.bufferStrokeMm, unit: "mm" },
        { label: "Tampon adedi", value: fmt(numCell(c, "buffer.count"), 0), unit: "adet" }
      );
    }
    sections.push({
      name: `Yürütme · ${ad}`,
      rows,
      // Teker mili şeması: hesap raporundaki 5.2 ile AYNI üreticiden.
      diagram: diagramsForSection(key, "5.2", input, result)[0],
    });
    // Redüktör mil yönleri şeması (5.5) — sipariş için; yalnız mil yönü seçiliyse.
    const gbDir = diagramsForSection(key, "5.5", input, result)[0];
    if (gbDir) sections.push({ name: `Redüktör Mil Yönleri · ${ad}`, rows: [], diagram: gbDir });
  }

  // ---------------------------------------------------------------- Tamburlar
  // Kaldırma grubu başına AYRI çizelge; her biri kendi tambur şemasıyla.
  // Ressamın tambur çizmek için ihtiyacı olan ne varsa buradadır — yiv dibi
  // et kalınlığı, hatve, sarım sayısı, namlu boyu ve A…G mil zinciri dâhil
  // (kullanıcı isteği, 19.08.2026).
  for (const key of MODULE_ORDER) {
    if (!isHoistKey(key)) continue;
    const st = moduleState(input, key);
    if (!st) continue;
    const inp = st.inputs as HoistInputs;
    const sel = st.selections as HoistSelections;
    const c = moduleResult(result, key)?.cells;
    const ad = groupName(key);
    // Yiv derinliği ve cidar kalınlığı hücrede DEĞİL, türetilir: motor yalnız
    // yiv dibi etini (s₀) sorar, ressam ikisini birden çizer. Bağıntı
    // `derive.ts`teki tambur ağırlığı türetmesinin aynısıdır.
    const grooveDepthMm = sel.ropeDiaMm > 0 ? sel.ropeDiaMm / 2 : 0;
    const wallMm = inp.drumWallThicknessMm + grooveDepthMm;
    const barrelMm = drumShaftGeometry(inp).barrelCm * 10;
    sections.push({
      name: `Tambur · ${ad}`,
      rows: [
        { label: "Tambur çapı D", value: sel.drumDiaMm, unit: "mm", diameter: true },
        {
          label: "Minimum tambur çapı",
          value: fmt(numCell(c, "drum.minDia"), 0),
          unit: "mm",
          diameter: true,
          note: "FEM 1.001 · D ≥ H · d",
        },
        { label: "Halat çapı d", value: sel.ropeDiaMm, unit: "mm", diameter: true },
        {
          label: "Yiv adımı (hatve) p",
          value: fmt(numCell(c, "drum.groovePitch"), 1),
          unit: "mm",
          note: "DIN 15061",
        },
        { label: "Yiv derinliği", value: fmt(grooveDepthMm, 1), unit: "mm", note: "≈ d / 2" },
        { label: "Yiv dibi et kalınlığı s₀", value: inp.drumWallThicknessMm, unit: "mm" },
        { label: "Cidar kalınlığı s", value: fmt(wallMm, 1), unit: "mm", note: "s = s₀ + d / 2" },
        { label: "Sarım sayısı z", value: fmt(numCell(c, "drum.requiredGrooves"), 0), unit: "adet" },
        { label: "Emniyet sarımı", value: inp.safetyGrooveCount, unit: "adet" },
        { label: "Yiv boyu (seçilen)", value: textOr(sel.drumGrooveLengthText), unit: "mm" },
        {
          label: "Gerekli yiv boyu",
          value: fmt(numCell(c, "drum.requiredGrooveLength"), 0),
          unit: "mm",
        },
        {
          label: "Namlu boyu (yanaklar arası)",
          value: fmt(barrelMm, 0),
          unit: "mm",
          note: "B + C + D + E + F",
        },
        { label: "Mil ölçüsü A (redüktör tarafı)", value: inp.drumSpanAMm, unit: "mm" },
        { label: "Mil ölçüsü B", value: inp.drumSpanBMm, unit: "mm" },
        { label: "Mil ölçüsü C (sol yiv)", value: inp.drumSpanCMm, unit: "mm" },
        { label: "Mil ölçüsü D (yivsiz orta)", value: inp.drumSpanDMm, unit: "mm" },
        { label: "Mil ölçüsü E (sağ yiv)", value: inp.drumSpanEMm, unit: "mm" },
        { label: "Mil ölçüsü F", value: inp.drumSpanFMm, unit: "mm" },
        { label: "Mil ölçüsü G (yatak tarafı)", value: inp.drumSpanGMm, unit: "mm" },
        {
          label: "Mesnet açıklığı",
          value: fmt(numCell(c, "drumShaft.span") * 10, 0),
          unit: "mm",
        },
        { label: "Mil çapı D1 (yanak dibi)", value: inp.shaftD1Mm, unit: "mm", diameter: true },
        { label: "Mil çapı D2 (yatak)", value: inp.shaftD2Mm, unit: "mm", diameter: true },
        { label: "Tambur kaynağı boğaz a", value: inp.drumWeldThicknessMm, unit: "mm" },
        { label: "Mil kaynağı boğaz a", value: inp.shaftWeldThicknessMm, unit: "mm" },
        { label: "Tambur malzemesi", value: textOr(sel.drumMaterial) },
        { label: "Tambur adedi", value: inp.drumCount, unit: "adet" },
        { label: "Tambur ağırlığı", value: fmt(inp.drumWeightKg, 0), unit: "kg" },
        {
          label: "Tambur yatağı",
          value:
            `${textOr(sel.bearingHousingBrand, "")} ${textOr(sel.bearingHousingCode, "")}`.trim() ||
            "-",
        },
      ],
      diagram: diagramsForSection(key, "2.2.1", input, result)[0],
    });
    // Tambur mili yükleme şeması ayrı bir çizimdir (A…G zinciri + tepkiler).
    const shaftDiagram = diagramsForSection(key, "2.2.3", input, result)[0];
    if (shaftDiagram) {
      sections.push({ name: `Tambur Mili · ${ad}`, rows: [], diagram: shaftDiagram });
    }
    // Redüktör mil yönleri şeması (2.3) — sipariş için; yalnız mil yönü seçiliyse.
    const gbDirDiagram = diagramsForSection(key, "2.3", input, result)[0];
    if (gbDirDiagram) {
      sections.push({ name: `Redüktör Mil Yönleri · ${ad}`, rows: [], diagram: gbDirDiagram });
    }
  }

  // ------------------------------------------------------------- Ana kirişler
  for (const key of ["girder", "girder2"] as const) {
    const st = input[key];
    if (!st) continue;
    const ad = groupName(key);
    const c = moduleResult(result, key)?.cells;
    const rows = plateRows(GIRDER_INPUT_FIELDS, GIRDER_PLATE_KEYS, st.inputs);
    // Ray altı T profil ölçüleri YALNIZ profil varken basılır: kapalı
    // anahtarda değerler korunur ama kesite girmez (HESAP-8c) — girmeyen bir
    // sac ölçüsünü ressama göndermek yanlış kesim demektir.
    if (railTProfile(st.inputs).present) {
      rows.push(...plateRows(GIRDER_INPUT_FIELDS, GIRDER_T_PROFILE_KEYS, st.inputs));
    }
    rows.push(
      { label: "Perde aralığı l₁", value: st.inputs.diaphragmSpacingMm, unit: "mm" },
      { label: "Perde adedi", value: fmt(numCell(c, "camber.diaphragmCount"), 0), unit: "adet" },
      {
        label: "Perde sacı kalınlığı",
        value: fmt(numCell(c, "camber.diaphragmThickness"), 1),
        unit: "mm",
      },
      { label: "Boyuna berkitme mesafesi", value: st.inputs.webStiffenerOffsetMm, unit: "mm" },
      { label: "Araba tekerlek açıklığı", value: st.inputs.trolleyWheelSpacingM, unit: "m" },
      { label: "Araba dingil açıklığı", value: st.inputs.trolleyAxleSpacingM, unit: "m" }
    );
    const gr = result[key];
    if (gr) {
      rows.push(
        {
          label: "Kiriş toplam yüksekliği (hesap)",
          value: Number(gr.values.heightMm.toFixed(0)),
          unit: "mm",
        },
        { label: "Kesit alanı (hesap)", value: fmt(numCell(c, "section.area"), 1), unit: "cm²" },
        {
          label: "Kiriş birim ağırlığı (hesap)",
          value: Number(gr.values.weightPerM.toFixed(1)),
          unit: "kg/m",
        },
        {
          label: "Kiriş toplam ağırlığı (hesap)",
          value: fmt(numCell(c, "camber.girderTotalWeight"), 0),
          unit: "kg",
        }
      );
    }
    sections.push({
      name: `${ad} Kesiti`,
      rows,
      diagram: diagramsForSection(key, "7.1", input, result)[0],
    });

    // TERS SEHİM (KAMBER) KOTLARI — atölyenin ölçtüğü sayılar.
    // Kotlar hesap raporundaki 7.7 ile AYNI saf fonksiyondan gelir
    // (`girderCamberProfile`); ikinci bir yöntem yazılmaz.
    const camber = girderCamberProfile(key, input, result);
    if (camber) {
      sections.push({
        name: `${ad} Ters Sehim Kotları`,
        rows: camber.stations.map((station) => ({
          label: `${station.code} · x = ${fmt(station.xMm, 0)} mm`,
          value: fmt(station.cuttingMm, 1),
          unit: "mm",
          note: `mesnette ${fmt(station.supportedMm, 1)} mm`,
        })),
        diagram: diagramsForSection(key, "7.7", input, result)[0],
      });
    }
  }

  if (input.endCarriage) {
    const rows = plateRows(
      ENDCARRIAGE_INPUT_FIELDS,
      ENDCARRIAGE_PLATE_KEYS,
      input.endCarriage.inputs
    );
    const c = moduleResult(result, "endCarriage")?.cells;
    if (result.endCarriage) {
      rows.push(
        { label: "Kesit alanı (hesap)", value: fmt(numCell(c, "section.area"), 1), unit: "cm²" },
        {
          label: "Başkiriş birim ağırlığı (hesap)",
          value: Number(result.endCarriage.values.weightPerM.toFixed(1)),
          unit: "kg/m",
        },
        {
          label: "Maksimum teker yükü (hesap)",
          value: fmt(numCell(c, "wheel.loadMax"), 0),
          unit: "kg",
        },
        {
          label: "Minimum teker yükü (hesap)",
          value: fmt(numCell(c, "wheel.loadMin"), 0),
          unit: "kg",
        }
      );
    }
    sections.push({ name: "Başkiriş Plaka Ölçüleri", rows });
  }

  // ------------------------------------------------------------ Kanca blokları
  for (const key of MODULE_ORDER) {
    if (!isHookBlockKey(key)) continue;
    const st = moduleState(input, key);
    if (!st) continue;
    const inp = st.inputs as HookBlockInputs;
    const sel = st.selections as HookBlockSelections;
    const mr = moduleResult(result, key);
    const c = mr?.cells;
    const v = mr?.values as HookBlockValues | undefined;
    const hoistState = moduleState(input, HOIST_OF_HOOKBLOCK[key]);
    sections.push({
      name: groupName(key),
      rows: [
        { label: "Kanca tanımı", value: textOr(v?.hookDesignationText || sel.hookDesignation) },
        { label: "Kanca numarası", value: textOr(sel.hookNumber) },
        { label: "Kanca kapasitesi", value: v?.hookCapacityKg ?? sel.hookCapacityKg, unit: "kg" },
        { label: "Makara çapı (halat ekseni)", value: sel.sheaveDiaMm, unit: "mm", diameter: true },
        {
          label: "Minimum makara çapı",
          value: fmt(numCell(c, "sheave.minDia"), 0),
          unit: "mm",
          diameter: true,
          note: "FEM 1.001 · D ≥ H · d",
        },
        { label: "Makara adedi", value: v?.sheaveCount ?? "-", unit: "adet" },
        { label: "Makara kapak düzeni", value: sel.sheaveEnclosure },
        ...(sel.sheaveEnclosure === "Kapaksız"
          ? [{ label: "Rulman kapak tipi", value: textOr(sel.sheaveBearingClosure) }]
          : [{ label: "Keçe tipi", value: textOr(sel.sheaveSealCode) }]),
        { label: "Makara rulmanı", value: textOr(sel.sheaveBearingCode) },
        { label: "Makara rulmanı iç çapı", value: sel.sheaveBearingBoreMm ?? "-", unit: "mm", diameter: true },
        { label: "Mil çapı D1", value: inp.shaftD1Mm, unit: "mm", diameter: true },
        { label: "Merkez → askı sacı ekseni", value: inp.shaftSupportOffsetMm, unit: "mm" },
        { label: "Merkez → makara eksenleri (tek taraf)", value: inp.shaftSheaveOffsetsText, unit: "mm" },
        ...(hoistState
          ? [
              {
                label: "Kanca bloğu ağırlığı",
                value: (hoistState.inputs as HoistInputs).hookBlockWeightKg,
                unit: "kg",
              },
            ]
          : []),
      ],
      diagram: diagramsForSection(key, "4.4", input, result)[0],
    });
  }

  // Ağırlıklar artık teknik özelliklerdedir; yürütme grupları oradan okur.
  const weightRows: SummaryRow[] = [];
  if (MAIN_TROLLEY_WEIGHT_READER_KEYS.some((k) => moduleState(input, k) !== undefined)) {
    weightRows.push({
      label: "Ana araba ağırlığı",
      value: input.specs.mainTrolleyWeightT,
      unit: "t",
    });
  }
  if (input.auxTrolley && input.specs.auxTrolleyWeightT) {
    weightRows.push({
      label: "Yardımcı araba ağırlığı",
      value: input.specs.auxTrolleyWeightT,
      unit: "t",
    });
  }
  // KÖPRÜ AĞIRLIĞI ancak onu okuyan bir hesap varken basılır — teknik özellik
  // kutusuyla AYNI kümeden karar verilir (`BRIDGE_WEIGHT_READER_KEYS`).
  // Yalnız araba yenilenen bir raporda satır koşulsuz basılıyordu ve belge
  // kendi içinde çelişiyordu: hesabı olmayan bir köprünün ağırlığı.
  if (BRIDGE_WEIGHT_READER_KEYS.some((k) => moduleState(input, k) !== undefined)) {
    weightRows.push({ label: "Köprü ağırlığı", value: input.specs.bridgeWeightT, unit: "t" });
  }
  const craneT = result.bridge?.values.craneWeightT;
  if (craneT !== null && craneT !== undefined) {
    weightRows.push({ label: "Toplam vinç ağırlığı (hesap)", value: Number(craneT.toFixed(2)), unit: "t" });
  }
  if (weightRows.length > 0) {
    sections.push({ name: "Ağırlıklar", rows: weightRows });
  }

  // TEKNİK RESİM NUMARALANDIRMASI EN SONDADIR ve bilinçli olarak öyledir:
  // ressam özeti yukarıdan aşağı "neyi çizeceğim"i anlatır, en altta da
  // "hangi numarayı vereceğim" durur. Ressamın mühendise sorduğu son soru budur.
  // Köprü ve araba grupları alt alta ayrı başlıklar hâlinde basılır — bant
  // ayrımı numaranın kendisinde saklıdır ve okuyan onu başlıkta görmelidir.
  for (const grup of groupDrawingPlan(drawingPlan?.rows ?? [])) {
    sections.push({
      name: `Teknik Resim No · ${grup.label}`,
      rows: grup.rows.map((r) => ({
        label: r.name.trim() || "(adı girilmemiş grup)",
        value: fullDrawingNo(drawingPlan?.itemNo, r.code),
      })),
    });
  }

  // NOTLAR EN SONDADIR — teknik resim numarasından da sonra.
  // Bölüm bir ÇİZELGE DEĞİLDİR (`kind: "notes"`): mühendisin cümleleri satır
  // sonlarıyla birlikte korunur, üç yazıcı da (ekran · Excel · PDF) onu
  // ölçü tablosu gibi değil metin gibi basar.
  const note = (drawingNote ?? "").trim();
  if (note !== "") {
    sections.push({ name: "Notlar", kind: "notes", rows: [], text: note });
  }

  return sections;
}

/**
 * Notun Excel'de kaç SATIR yer kaplayacağı — hücre yüksekliği bundan türer.
 *
 * Hem gerçek satır sonları hem 90 karakterlik sarma sayılır. Yalnız uzunluğa
 * bakmak, kısa ama madde madde yazılmış bir notu tek satıra sıkıştırıyordu.
 */
export function notLineCount(text: string): number {
  return text
    .split(NOTE_LINE_BREAK)
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 90)), 0);
}

/** Satır sonu ayracı — CRLF ve LF birlikte (Windows'ta yazılan not da doğru sayılsın). */
const NOTE_LINE_BREAK = /\r?\n/;

function writeSummarySheet(
  ws: ExcelJS.Worksheet,
  input: CalcInput,
  result: CalcResult,
  meta: EquipmentMeta,
  drawingPlan?: EquipmentDrawingPlan,
  drawingNote?: string
): void {
  const headerRowNo = writeBand(ws, "TEKNİK RESSAM ÖZETİ", meta, 3);

  const header = ws.getRow(headerRowNo);
  ["Ölçü / Özellik", "Değer", "Birim"].forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { name: TITLE_FONT, bold: true, color: { argb: PAPER } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: i === 1 ? "right" : "left", vertical: "middle" };
  });
  header.height = 18;

  // Başlığa kadar dondur + başlık satırında filtre
  ws.views = [{ state: "frozen", ySplit: headerRowNo }];
  ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo, column: 3 } };

  let rowNo = headerRowNo + 1;
  const sections = buildSummarySections(input, result, drawingPlan, drawingNote);
  /** Bölüm başlığı bandı — üç hücresi de kenarlıklıdır (merge kenarlığı A'da kalmaz). */
  const sectionBand = (title: string) => {
    ws.mergeCells(`A${rowNo}:C${rowNo}`);
    const sc = ws.getCell(`A${rowNo}`);
    sc.value = title;
    sc.font = { bold: true };
    sc.fill = COL_FILL;
    for (let c = 1; c <= 3; c += 1) ws.getRow(rowNo).getCell(c).border = THIN_BORDER;
    rowNo += 1;
  };

  for (const section of sections) {
    // ŞEMALAR EXCEL'E GİRMEZ. ExcelJS yalnız raster basar (png/jpeg/gif) ve
    // diyagramlar vektördür; hücre ızgarasına oturmayan bir görüntü, tablo
    // filtrelendiğinde yerinde kalır. Şema yalnız PDF ve ekrandadır ve bunu
    // BÖLÜM ATLANMADAN söyleriz — sessiz bir boşluk "unutulmuş" okunurdu.
    if (section.kind === "notes") {
      // NOTLAR filtre bölgesinden bir boş satırla ayrılır: merge'lü çok
      // satırlı bir hücre otomatik süzgecin içinde kalırsa Excel uyarır.
      rowNo += 1;
      sectionBand(section.name);
      ws.mergeCells(`A${rowNo}:C${rowNo}`);
      const nc = ws.getCell(`A${rowNo}`);
      nc.value = section.text ?? "";
      nc.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
      nc.border = THIN_BORDER;
      // Yükseklik hem SATIR SAYISINDAN hem uzunluktan türer: yalnız uzunluğa
      // bakmak, kısa ama madde madde yazılmış bir notu tek satıra sıkıştırır.
      const satirSayisi = notLineCount(section.text ?? "");
      ws.getRow(rowNo).height = Math.max(16, satirSayisi * 14);
      rowNo += 1;
      continue;
    }

    sectionBand(section.name);

    if (section.rows.length === 0 && section.diagram) {
      const row = ws.getRow(rowNo);
      row.getCell(1).value = "Şema — yalnız PDF ve ekran";
      row.getCell(1).font = { italic: true, color: { argb: MUTED_GRAY } };
      for (let c = 1; c <= 3; c += 1) row.getCell(c).border = THIN_BORDER;
      rowNo += 1;
      continue;
    }

    for (const r of section.rows) {
      const row = ws.getRow(rowNo);
      // AÇIKLAMA ETİKETİN İÇİNE GİRER, dördüncü bir sütun AÇILMAZ: bant
      // genişliği, filtre aralığı, merge ve kenarlık döngüsü sütun sayısına
      // beş ayrı yerde bağlıdır ve biri unutulursa sessizce bozulur.
      row.getCell(1).value = r.note ? `${r.label}  —  ${r.note}` : r.label;
      row.getCell(2).value = r.diameter ? summaryRowValue(r) : r.value;
      row.getCell(3).value = r.unit ?? "";
      // Değer kolonu: sayılar TR ayraçlı, sağa dayalı, mono
      if (typeof r.value === "number" && !r.diameter) {
        row.getCell(2).numFmt = Number.isInteger(r.value) ? "#,##0" : "#,##0.00";
        row.getCell(2).font = { name: MONO_FONT };
      }
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c);
        cell.border = THIN_BORDER;
        cell.alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" };
      }
      rowNo += 1;
    }
  }

  writeFooterRow(ws, rowNo + 1, 3, "TEKNİK RESSAM ÖZETİ", meta);

  autoWidth(ws, WIDTH_MIN, WIDTH_MAX);
}

// --- ana giriş ---------------------------------------------------------------

export interface EquipmentWorkbookOptions {
  /** kind|brand|model → datasheet URL (Model hücresi köprülenir) */
  datasheetUrls?: Map<string, string>;
  /**
   * "full"    → Ekipman Listesi + Teknik Ressam Özeti (dahili, varsayılan)
   * "customer"→ yalnızca Ekipman Listesi (müşteriye teslim edilecek dosya)
   */
  scope?: "full" | "customer";
  /** Panelden eklenen ek ekipman/özellik satırları */
  extras?: EquipmentExtraRow[];
  /** row_key → "Ek Özellikler" notu (equipment_notes) */
  notes?: EquipmentNotes;
  /** row_key → "Ek Belge" yüklemeleri (equipment_attachments) */
  attachments?: EquipmentAttachments;
  /** Alternatif (seçenekli) seçimler — `selections.alts` (altsFromRevision) */
  alts?: RevisionAlts;
  /**
   * Uygulamanın kök adresi (`https://…`). Verilirse ekipman ADI, ürünün katalog
   * sayfasını açan uygulama adresine köprülenir. Excel dosyası uygulamanın
   * dışında açıldığından adresin MUTLAK olması şarttır; kök bilinmiyorsa
   * (ör. birim testi) bağlantı hiç kurulmaz.
   */
  appOrigin?: string;
  /** Müşterinin üyelik olmadan açacağı seçilmiş proje ana paftası (mutlak). */
  mainDrawingUrl?: string;
  /**
   * Teknik Resim Takibi defteri — Teknik Ressam Özeti sayfasının sonuna ana
   * grup numaralandırması olarak basılır. Yalnız `scope: "full"` çıktısında
   * görünür (özet sayfasının kendisi gibi).
   */
  drawingPlan?: EquipmentDrawingPlan;
  /** Mühendisin ressama yazdığı serbest not — özetin en sonundaki Notlar bölümü. */
  drawingNote?: string;
  /** Gizlenen alt bölümler — satırları listeye girmez (buildEquipmentGroups). */
  hiddenSections?: readonly string[];
}

export function buildEquipmentWorkbook(
  calcInput: CalcInput,
  calcResult: CalcResult,
  meta: EquipmentMeta,
  options: EquipmentWorkbookOptions = {}
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION Hesap Raporu";
  wb.created = new Date();

  const groups = mergeExtras(
    buildEquipmentGroups(
      calcInput, options.notes, options.alts, options.attachments, options.hiddenSections
    ),
    options.extras,
    absentModuleGroupNames(calcInput)
  );

  const wsEquipment = wb.addWorksheet("Ekipman Listesi", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const sheetUrls = options.appOrigin
    ? buildCatalogSheetUrls(groups, options.appOrigin)
    : undefined;
  writeEquipmentSheet(
    wsEquipment,
    groups,
    meta,
    options.datasheetUrls,
    sheetUrls,
    options.mainDrawingUrl
  );

  // Teknik ressam özeti dahili bir çıktıdır; müşteri dosyasına dahil edilmez.
  if (options.scope !== "customer") {
    // YATAY: özet çizelgesi genişledi (ölçü + değer + birim ve uzun açıklama
    // satırları) ve dikey A4'te etiket sütunu kırpılıyordu. Ekipman Listesi
    // sayfası da yataydır; workbook artık kendi içinde tutarlı.
    const wsSummary = wb.addWorksheet("Teknik Ressam Özeti", {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    writeSummarySheet(
      wsSummary, calcInput, calcResult, meta, options.drawingPlan, options.drawingNote
    );
  }

  return wb;
}

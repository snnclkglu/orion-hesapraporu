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
import { moduleState } from "@/lib/calc/presentation/module-access";
import {
  MODULE_ORDER,
  isHoistKey,
  isHookBlockKey,
  isTravelKey,
  type ModuleKey,
} from "@/lib/calc/presentation/module-family";
import { splitAltKey, type RevisionAlts } from "@/lib/revision-load";
import { HOIST_SECTIONS } from "@/lib/calc/presentation/hoistSections";
import { HOOKBLOCK_SECTIONS } from "@/lib/calc/presentation/hookBlockSections";
import { TRAVEL_SECTIONS } from "@/lib/calc/presentation/travelSections";
import { CABIN_SECTIONS } from "@/lib/calc/presentation/cabinSections";
import {
  AIR_CONDITIONING_REDUNDANCY_LABELS,
  ROOM_INSULATION_LABELS,
} from "@/lib/calc/fields";
import { attrValueLabel } from "@/lib/catalog-mapping";
import { catalogSheetPageUrl, findCatalogSheet } from "@/lib/catalog-sheets";
import { fullDrawingNo, groupDrawingPlan, type DrawingPlanRow } from "@/lib/drawing-plan";
import {
  cabinHasAirConditioner,
  computeCabin,
  panelHasAirConditioner,
  roomHasAirConditioner,
  type CabinInputs,
  type CabinSelections,
  type CabinValues,
} from "@/lib/calc/modules/cabin";
import type { ClimateLoadResult } from "@/lib/calc/climate-load";
import { cabinDepsFrom } from "@/lib/calc/engine";
import { CABIN_CLIMATE_SITES } from "@/lib/calc/presentation/cabinSections";
import { GLAZING_KIND_LABELS } from "@/lib/calc/presentation/cabinFields";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { hoistSpecView } from "@/lib/calc/modules/hoistGroup";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { HookBlockInputs, HookBlockSelections } from "@/lib/calc/modules/hookBlock";
import { travelHasFestoon, travelSpecView } from "@/lib/calc/modules/travelGroup";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderInputs } from "@/lib/calc/modules/mainGirder";
import type { EndCarriageInputs } from "@/lib/calc/modules/endCarriage";
import {
  HOIST_EQUIPMENT_ARRANGEMENT_LABELS,
  hoistEquipmentArrangement,
  hoistEquipmentQuantityFactor,
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

/** Ana / yardımcı kaldırma grubu bileşen satırları (aynı set) */
function hoistRows(moduleKey: string, inp: HoistInputs, sel: HoistSelections): EqRow[] {
  const rk = (slug: string) => `${moduleKey}:${slug}`;
  return [
    {
      rowKey: rk("rope"),
      kind: "rope",
      component: "Çelik halat",
      brand: textOr(sel.ropeBrand),
      model: textOr(sel.ropeConstruction),
      spec: `Ø${fmt(sel.ropeDiaMm)} mm, öz: ${textOr(sel.ropeCore)}, tel ${fmt(sel.ropeWireStrength)} kg/mm², kopma yükü ${fmt(sel.ropeBreakingLoadKn, 1)} kN`,
      qty: 1,
    },
    {
      rowKey: rk("drum"),
      component: "Tambur",
      brand: "-",
      model: "-",
      spec: `Ø${fmt(sel.drumDiaMm)} mm, malzeme ${textOr(sel.drumMaterial)}, yiv boyu ${textOr(sel.drumGrooveLengthText)} mm`,
      qty: inp.drumCount,
    },
    {
      rowKey: rk("drumBearing"),
      kind: "bearing",
      component: "Tambur rulmanı",
      brand: textOr(sel.bearingType),
      model: textOr(sel.bearingCode),
      spec: `C = ${fmt(sel.bearingDynCKn, 1)} kN, C0 = ${fmt(sel.bearingStatC0Kn, 1)} kN`,
      qty: 2,
    },
    {
      rowKey: rk("drumBearingHousing"),
      kind: "bearing_housing",
      component: "Tambur rulman yatağı",
      brand: textOr(sel.bearingHousingBrand),
      model: textOr(sel.bearingHousingCode),
      spec: `${textOr(sel.bearingHousingSeries)} · ${textOr(sel.bearingHousingCompatibleBearing)} rulmanı ile uyumlu · Ø${fmt(sel.bearingHousingBoreMm)} mm · A₂ ${fmt(sel.bearingHousingWidthMm)} mm · ${textOr(sel.bearingHousingSeatType)}`,
      qty: 2,
    },
    {
      rowKey: rk("gearbox"),
      kind: "gearbox",
      component: "Redüktör",
      brand: "-",
      model: textOr(sel.gearboxModel),
      spec: `i = ${fmt(sel.gearboxRatio, 2)}, nominal tork ${fmt(sel.gearboxNominalTorqueKnm, 1)} kNm, giriş mili Ø${fmt(sel.gearboxInputShaftMm)} / çıkış mili Ø${fmt(sel.gearboxOutputShaftMm)} mm`,
      qty: 1,
    },
    {
      rowKey: rk("motor"),
      kind: "motor",
      component: "Motor",
      brand: textOr(sel.motorBrand),
      model: textOr(sel.motorModel),
      spec: `${fmt(sel.motorPowerKw, 1)} kW, ${fmt(sel.motorRpm)} d/dak, mil Ø${fmt(sel.motorShaftMm)} mm`,
      qty: sel.motorCount,
    },
    {
      rowKey: rk("brake"),
      kind: "brake",
      component: "Fren",
      brand: textOr(sel.brakeBrand),
      model: textOr(sel.brakeModel),
      spec: `fren torku ${fmt(sel.brakeTorqueNm)} Nm, kasnak/disk Ø${fmt(sel.brakeWheelDiaMm)} mm`,
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
      spec: `tork ${fmt(sel.drumCouplingTorqueNm)} Nm, radyal yük ${fmt(sel.drumCouplingRadialN)} N, Dmaks Ø${fmt(sel.drumCouplingDmaxMm)} mm`,
      qty: 1,
    },
  ];
}

/** Araba / köprü yürütme grubu bileşen satırları */
function travelRows(
  moduleKey: string,
  which: "trolley" | "bridge",
  inp: TravelInputs,
  sel: TravelSelections,
  /** Bu eksende enerji beslemesi feston mu (teknik özellik) */
  hasFestoon: boolean
): EqRow[] {
  const rk = (slug: string) => `${moduleKey}:${slug}`;
  const rows: EqRow[] = [
    {
      rowKey: rk("wheel"),
      kind: "wheel",
      component: "Tekerlek",
      brand: "-",
      model: "-",
      spec: `Ø${fmt(sel.wheelDiaMm)} mm, malzeme ${textOr(sel.wheelMaterial)} (${fmt(sel.wheelTensileNmm2)} N/mm²), ray ${textOr(sel.railCode)}`,
      qty: inp.wheelCount,
    },
    {
      rowKey: rk("wheelBearing"),
      kind: "bearing",
      component: "Teker rulmanı",
      brand: textOr(sel.bearingType),
      model: textOr(sel.bearingCode),
      spec: `C = ${fmt(sel.bearingDynCKn, 1)} kN, C0 = ${fmt(sel.bearingStatC0Kn, 1)} kN`,
      qty: inp.bearingCount > 0 ? inp.bearingCount : 2,
    },
    {
      rowKey: rk("motor"),
      kind: "motor",
      component: "Motor",
      brand: textOr(sel.motorBrand),
      model: textOr(sel.motorModel),
      spec: `${fmt(sel.motorPowerKw, 2)} kW, ${fmt(sel.motorRpm)} d/dak, mil Ø${fmt(sel.motorShaftMm)} mm`,
      qty: sel.motorCount,
    },
    {
      rowKey: rk("gearbox"),
      kind: "gearbox",
      component: "Redüktör",
      brand: "-",
      model: textOr(sel.gearboxModel),
      spec: `i = ${fmt(sel.gearboxRatio, 2)}, çıkış torku ${fmt(sel.gearboxOutputTorqueKnm, 2)} kNm, çıkış mili Ø${fmt(sel.gearboxOutputShaftMm)} mm`,
      qty: sel.motorCount,
    },
  ];

  // Fren bölümü yalnızca köprü grubunda seçilir.
  if (which === "bridge") {
    rows.push({
      rowKey: rk("brake"),
      kind: "brake",
      component: "Fren",
      brand: textOr(sel.brakeBrand, "Seçilmedi"),
      model: "-",
      // Yürütme freninin kimliği tek birleşik alandadır ve MARKA sütununda
      // görünür; katalog sayfası o metinle aranır.
      catalogModel: sel.brakeBrand,
      spec:
        sel.brakeTorqueNm > 0
          ? `fren torku ${fmt(sel.brakeTorqueNm)} Nm, kasnak/disk Ø${fmt(sel.brakeWheelDiaMm)} mm`
          : "Seçim yapılmadı",
      qty: sel.brakeTorqueNm > 0 ? sel.motorCount : "-",
    });
  }

  rows.push(
    {
      rowKey: rk("motorCoupling"),
      kind: "coupling",
      component: "Motor kaplini",
      brand: textOr(sel.motorCouplingBrand),
      model: textOr(sel.motorCouplingModel),
      spec: `tork ${fmt(sel.motorCouplingTorqueNm)} Nm, Dmaks Ø${fmt(sel.motorCouplingDmaxMm)} mm`,
      qty: sel.motorCount,
    },
    {
      rowKey: rk("wheelCoupling"),
      kind: "coupling",
      component: "Teker kaplini",
      brand: textOr(sel.wheelCouplingBrand),
      model: textOr(sel.wheelCouplingModel),
      spec: `tork ${fmt(sel.wheelCouplingTorqueNm)} Nm, teker mili Ø${fmt(sel.wheelShaftDiaMm)} mm, Dmaks Ø${fmt(sel.wheelCouplingDmaxMm)} mm`,
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
      qty: 2,
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

/** Ek satırları gruplara katar: eşleşen grup varsa ona ekler, yoksa yeni grup. */
export function mergeExtras(groups: EqGroup[], extras?: EquipmentExtraRow[]): EqGroup[] {
  if (!extras || extras.length === 0) return groups;
  const merged = groups.map((g) => ({ name: g.name, rows: [...g.rows] }));
  for (const ex of extras) {
    // Grup adı otomatik gruplarla AYNI düzenden geçer; aksi hâlde "ana kaldırma"
    // yazan bir ek satır "Ana Kaldırma" grubuna denk gelmez ve yeni grup açardı.
    const groupName = baslikDuzeni(ex.group.trim()) || "Ek Ekipman";
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
  moduleKey: string,
  m: { inputs: HookBlockInputs; selections: HookBlockSelections }
): EqRow[] {
  const sel = m.selections;
  const rk = (slug: string) => `${moduleKey}:${slug}`;
  return [
    {
      rowKey: rk("hook"),
      kind: "hook",
      component: "Kanca",
      brand: "-",
      model: textOr(sel.hookDesignation),
      spec: `kapasite ${fmt(sel.hookCapacityKg)} kg (DIN 15400)`,
      qty: 1,
    },
    {
      rowKey: rk("sheave"),
      kind: "sheave",
      component: "Halat makarası",
      brand: "-",
      model: "-",
      spec: `halat ekseninde Ø${fmt(sel.sheaveDiaMm)} mm`,
      qty: "-",
    },
    {
      rowKey: rk("sheaveBearing"),
      kind: "bearing",
      component: "Makara rulmanı",
      brand: textOr(sel.sheaveBearingType),
      model: textOr(sel.sheaveBearingCode),
      spec: `C = ${fmt(sel.sheaveBearingDynCKn, 1)} kN, C0 = ${fmt(sel.sheaveBearingStatC0Kn, 1)} kN`,
      qty: 2,
    },
    {
      rowKey: rk("hookBearing"),
      kind: "bearing",
      component: "Kanca (eksenel) rulmanı",
      brand: textOr(sel.hookBearingType),
      model: textOr(sel.hookBearingCode),
      spec: `C0 = ${fmt(sel.hookBearingStatC0Kn, 1)} kN`,
      qty: 1,
    },
    {
      rowKey: rk("shaft"),
      component: "Kanca bloğu mili",
      brand: "-",
      model: "-",
      spec: `malzeme ${textOr(sel.shaftMaterial)}, Ø${fmt(m.inputs.shaftD1Mm ?? 0)} mm`,
      qty: 1,
    },
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
    return hoistRows(key, inputs as HoistInputs, selections as HoistSelections);
  }
  if (isHookBlockKey(key)) {
    return hookBlockRows(key, {
      inputs: inputs as HookBlockInputs,
      selections: selections as HookBlockSelections,
    });
  }
  if (key === "cabin") {
    return cabinRows(specs, inputs as CabinInputs, selections as CabinSelections, cabinValues);
  }
  if (isTravelKey(key)) {
    return travelRows(
      key,
      key === "bridge" ? "bridge" : "trolley",
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
    rows.push({
      rowKey: "cabin:electrical-room",
      component: "Elektrik odası",
      brand: "-",
      model: "İzole elektrik odası",
      spec: `${fmt(inp.roomWidthM, 2)} × ${fmt(inp.roomLengthM, 2)} × ${fmt(inp.roomHeightM, 2)} m; izolasyon ${ROOM_INSULATION_LABELS[inp.roomInsulation ?? "rockWool100"]}`,
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
    // Gizleme bir grubun BÜTÜN satırlarını düşürdüyse grup başlığı da düşer —
    // boş bir grup bandı "satırları unutulmuş" gibi okunurdu.
    if (visibleRows.length === 0 && rowsWithAlternatives.length > 0) continue;
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
  sheetUrls?: Map<string, string>
): number {
  // Sütunlar: Ekipman · Marka · Model · Özellikler · Ek Özellikler · Ek Belge · Adet
  const COL_COUNT = 7;
  const QTY_COL = 7;
  const ATTACH_COL = 6;
  const headerRowNo = writeBand(ws, "EKİPMAN LİSTESİ", meta, COL_COUNT);

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
      // Ekipman adı: katalog sayfası varsa uygulamadaki görüntüleyiciye köprü.
      // Excel dosyası uygulamanın dışında açıldığı için adres MUTLAKTIR.
      const sheetUrl = rowSheetUrl(r, sheetUrls);
      if (sheetUrl) {
        row.getCell(1).value = { text: r.component, hyperlink: sheetUrl };
        row.getCell(1).font = HYPERLINK_FONT;
      } else {
        row.getCell(1).value = r.component;
      }
      row.getCell(2).value = r.brand;
      // Model hücresi: katalog datasheet linki varsa köprüle. Klima
      // satırlarında website bağlantısı müşteri çıktılarında gösterilmez.
      const url = r.kind ? datasheetUrls?.get(dsKey(r.kind, r.brand, r.model)) : undefined;
      if (canLinkEquipmentModel(r.kind) && url && r.model && r.model !== "-") {
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
export function dsKey(kind: string, brand: string, model: string): string {
  const norm = (s: string) => (s ?? "").trim().toLocaleLowerCase("tr");
  return `${norm(kind)}|${norm(brand)}|${norm(model)}`;
}

/**
 * Satır → KATALOG SAYFASI adresi eşlemesi.
 *
 * `datasheetUrls` ile karıştırılmaz: o, yönetim panelinden elle girilen ÜRETİCİ
 * WEB SAYFASIDIR ve model hücresine bağlanır. Buradaki adres ise uygulamanın
 * kendi katalog sayfası görüntüleyicisidir (`/katalog`) ve EKİPMAN ADINA
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
      // Anahtar GÖRÜNEN sütunlardan üretilir: panelde, Excel'de ve PDF'te satır
      // aynı anahtarla aranır, arama kimliği ise ayrı olabilir.
      const key = dsKey(row.kind!, row.brand, row.model);
      if (urls.has(key)) continue;
      if (!findCatalogSheet(id.kind, id.brand, id.model)) continue;
      urls.set(key, catalogSheetPageUrl(id.kind, id.brand, id.model, origin));
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
  row: Pick<EqRow, "kind" | "brand" | "model" | "catalogModel">
): { kind: string; brand: string; model: string } | null {
  if (!row.kind) return null;
  const model = (row.catalogModel ?? row.model ?? "").trim();
  if (!model || model === "-") return null;
  return { kind: row.kind, brand: row.brand, model };
}

/** Satırın katalog sayfası adresi (yoksa undefined). */
export function rowSheetUrl(
  row: Pick<EqRow, "kind" | "brand" | "model">,
  urls?: Map<string, string> | Record<string, string>
): string | undefined {
  if (!row.kind || !urls) return undefined;
  const key = dsKey(row.kind, row.brand, row.model);
  return urls instanceof Map ? urls.get(key) : urls[key];
}

// --- Sayfa 2: Teknik Ressam Özeti --------------------------------------------

export interface SummaryRow {
  label: string;
  value: number | string;
  unit?: string;
}

export interface SummarySection {
  name: string;
  rows: SummaryRow[];
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
  drawingPlan?: EquipmentDrawingPlan
): SummarySection[] {
  const specs = input.specs;
  const sections: SummarySection[] = [];

  // Yalnız vinçte GERÇEKTEN olan kaldırma grupları listelenir; kapalı bir
  // yardımcı kaldırmanın kapasitesini ilan etmek teknik ressamı yanıltır.
  const genelRows: SummaryRow[] = [
    { label: "Açıklık (L)", value: specs.spanM, unit: "m" },
  ];
  for (const key of MODULE_ORDER) {
    if (!isHoistKey(key) || !moduleState(input, key)) continue;
    const view = hoistSpecView(specs, key);
    const ad = groupName(key);
    genelRows.push(
      { label: `${ad} kapasitesi`, value: view.capacityT, unit: "ton" },
      { label: `${ad} yüksekliği`, value: view.liftHeightM, unit: "m" },
      { label: `${ad} hızı`, value: view.liftSpeedMpm, unit: "m/dak" },
      {
        label: `${ad} donanımı`,
        value: HOIST_EQUIPMENT_ARRANGEMENT_LABELS[hoistEquipmentArrangement(specs, key)],
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
    sections.push({
      name: "Elektrik Odası",
      rows: [
        { label: "Oda genişliği", value: cabin.inputs.roomWidthM || "-", unit: "m" },
        { label: "Oda uzunluğu", value: cabin.inputs.roomLengthM || "-", unit: "m" },
        { label: "Oda yüksekliği", value: cabin.inputs.roomHeightM || "-", unit: "m" },
        { label: "Oda izolasyonu", value: ROOM_INSULATION_LABELS[cabin.inputs.roomInsulation ?? "rockWool100"] },
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

  const trolleyRows: SummaryRow[] = [];
  if (input.trolley) {
    trolleyRows.push(
      { label: "Araba ray tipi", value: textOr(input.trolley.selections.railCode) },
      { label: "Araba teker çapı", value: input.trolley.selections.wheelDiaMm, unit: "mm" },
      { label: "Araba teker adedi", value: input.trolley.inputs.wheelCount, unit: "adet" }
    );
  }
  if (input.bridge) {
    trolleyRows.push(
      { label: "Köprü ray tipi", value: textOr(input.bridge.selections.railCode) },
      { label: "Köprü teker çapı", value: input.bridge.selections.wheelDiaMm, unit: "mm" },
      { label: "Köprü teker adedi", value: input.bridge.inputs.wheelCount, unit: "adet" }
    );
  }
  if (trolleyRows.length > 0) {
    sections.push({ name: "Ray ve Tekerlekler", rows: trolleyRows });
  }

  const drumRows: SummaryRow[] = [];
  if (input.mainHoist) {
    drumRows.push(
      { label: "Ana tambur çapı", value: input.mainHoist.selections.drumDiaMm, unit: "mm" },
      { label: "Ana tambur yiv boyu (seçilen)", value: textOr(input.mainHoist.selections.drumGrooveLengthText), unit: "mm" },
      {
        label: "Ana tambur gerekli yiv boyu",
        value: fmt(result.mainHoist?.values.requiredGrooveLengthMm, 0),
        unit: "mm",
      }
    );
  }
  if (input.auxHoist) {
    drumRows.push(
      { label: "Yrd tambur çapı", value: input.auxHoist.selections.drumDiaMm, unit: "mm" },
      { label: "Yrd tambur yiv boyu (seçilen)", value: textOr(input.auxHoist.selections.drumGrooveLengthText), unit: "mm" },
      {
        label: "Yrd tambur gerekli yiv boyu",
        value: fmt(result.auxHoist?.values.requiredGrooveLengthMm, 0),
        unit: "mm",
      }
    );
  }
  if (drumRows.length > 0) {
    sections.push({ name: "Tamburlar", rows: drumRows });
  }

  if (input.girder) {
    const rows = plateRows(GIRDER_INPUT_FIELDS, GIRDER_PLATE_KEYS, input.girder.inputs);
    if (result.girder) {
      rows.push(
        { label: "Kiriş toplam yüksekliği (hesap)", value: Number(result.girder.values.heightMm.toFixed(0)), unit: "mm" },
        { label: "Kiriş birim ağırlığı (hesap)", value: Number(result.girder.values.weightPerM.toFixed(1)), unit: "kg/m" }
      );
    }
    sections.push({ name: "Ana Kiriş Plaka Ölçüleri", rows });
  }

  if (input.endCarriage) {
    const rows = plateRows(
      ENDCARRIAGE_INPUT_FIELDS,
      ENDCARRIAGE_PLATE_KEYS,
      input.endCarriage.inputs
    );
    if (result.endCarriage) {
      rows.push({
        label: "Başkiriş birim ağırlığı (hesap)",
        value: Number(result.endCarriage.values.weightPerM.toFixed(1)),
        unit: "kg/m",
      });
    }
    sections.push({ name: "Başkiriş Plaka Ölçüleri", rows });
  }

  if (input.hookBlock) {
    const sel = input.hookBlock.selections;
    sections.push({
      name: "Kanca Bloğu",
      rows: [
        { label: "Kanca tanımı", value: textOr(sel.hookDesignation) },
        { label: "Kanca kapasitesi", value: result.hookBlock?.values.hookCapacityKg ?? sel.hookCapacityKg, unit: "kg" },
        { label: "Makara çapı (halat ekseni)", value: sel.sheaveDiaMm, unit: "mm" },
        { label: "Mil çapı (D1)", value: input.hookBlock.inputs.shaftD1Mm, unit: "mm" },
        ...(input.mainHoist
          ? [{ label: "Kanca bloğu ağırlığı", value: input.mainHoist.inputs.hookBlockWeightKg, unit: "kg" }]
          : []),
      ],
    });
  }

  // Ağırlıklar artık teknik özelliklerdedir; yürütme grupları oradan okur.
  const weightRows: SummaryRow[] = [
    { label: "Ana araba ağırlığı", value: input.specs.mainTrolleyWeightT, unit: "t" },
  ];
  if (input.auxTrolley && input.specs.auxTrolleyWeightT) {
    weightRows.push({
      label: "Yardımcı araba ağırlığı",
      value: input.specs.auxTrolleyWeightT,
      unit: "t",
    });
  }
  weightRows.push({ label: "Köprü ağırlığı", value: input.specs.bridgeWeightT, unit: "t" });
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

  return sections;
}

function writeSummarySheet(
  ws: ExcelJS.Worksheet,
  input: CalcInput,
  result: CalcResult,
  meta: EquipmentMeta,
  drawingPlan?: EquipmentDrawingPlan
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
  const sections = buildSummarySections(input, result, drawingPlan);
  for (const section of sections) {
    // Bölüm başlığı (birleşik hücre, dolgu)
    ws.mergeCells(`A${rowNo}:C${rowNo}`);
    const sc = ws.getCell(`A${rowNo}`);
    sc.value = section.name;
    sc.font = { bold: true };
    sc.fill = COL_FILL;
    sc.border = THIN_BORDER;
    rowNo += 1;

    for (const r of section.rows) {
      const row = ws.getRow(rowNo);
      row.getCell(1).value = r.label;
      row.getCell(2).value = r.value;
      row.getCell(3).value = r.unit ?? "";
      // Değer kolonu: sayılar TR ayraçlı, sağa dayalı, mono
      if (typeof r.value === "number") {
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
  /**
   * Teknik Resim Takibi defteri — Teknik Ressam Özeti sayfasının sonuna ana
   * grup numaralandırması olarak basılır. Yalnız `scope: "full"` çıktısında
   * görünür (özet sayfasının kendisi gibi).
   */
  drawingPlan?: EquipmentDrawingPlan;
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
    options.extras
  );

  const wsEquipment = wb.addWorksheet("Ekipman Listesi", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const sheetUrls = options.appOrigin
    ? buildCatalogSheetUrls(groups, options.appOrigin)
    : undefined;
  writeEquipmentSheet(wsEquipment, groups, meta, options.datasheetUrls, sheetUrls);

  // Teknik ressam özeti dahili bir çıktıdır; müşteri dosyasına dahil edilmez.
  if (options.scope !== "customer") {
    const wsSummary = wb.addWorksheet("Teknik Ressam Özeti", {
      pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    writeSummarySheet(wsSummary, calcInput, calcResult, meta, options.drawingPlan);
  }

  return wb;
}

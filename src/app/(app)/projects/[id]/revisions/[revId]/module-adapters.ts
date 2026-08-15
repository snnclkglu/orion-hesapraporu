// Revizyon editörü modül adaptörleri.
// Her hesap modülünün sunum katmanı (hoistSections, hookBlockSections, ...)
// kendi Ctx/RowDef tipini taşır; bu dosya hepsini editörün tek tip
// AdapterSection/AdapterRow sözleşmesine indirger. Böylece sihirbaz tek bir
// jenerik bölüm kartı deseniyle tüm modülleri çizer.
//
// Bölüm numaraları GÖRÜNTÜ numarasıdır ve vince dahil modüllere göre çalışma
// anında yeniden dizilir (`moduleDisplayNumbers`). Sunum dosyalarındaki ham
// id'ler (2.x kaldırma, 4.x kanca bloğu, 5.x yürütme, 7.x ana kiriş, 8.x
// buruşma, 9.x başkiriş) DEĞİŞMEZ — kontrol bağlantıları ve alternatif
// anahtarları onlara dayanır.

import {
  CABIN_AUTO_FIELDS,
  GIRDER_AUTO_FIELDS,
  HOIST_AUTO_FIELDS,
  HOIST_AUTO_SELECTION_FIELDS,
  HOIST_INPUT_FIELDS,
  HOIST_SELECTION_FIELDS,
  TRAVEL_AUTO_FIELDS,
} from "@/lib/calc/fields";
import {
  deriveGirderInputs,
  deriveHoistInputs,
  deriveTravelInputs,
  type GirderDeriveContext,
} from "@/lib/calc/derive";
import {
  HOIST_SECTIONS,
  type HoistCtx,
} from "@/lib/calc/presentation/hoistSections";
import {
  HOOKBLOCK_SECTIONS,
  type HookBlockCtx,
} from "@/lib/calc/presentation/hookBlockSections";
import {
  HOOKBLOCK_INPUT_FIELDS,
  HOOKBLOCK_SELECTION_FIELDS,
} from "@/lib/calc/presentation/hookBlockFields";
import {
  TRAVEL_SECTIONS,
  type TravelCtx,
} from "@/lib/calc/presentation/travelSections";
import {
  TRAVEL_INPUT_FIELDS,
  TRAVEL_SELECTION_FIELDS,
} from "@/lib/calc/presentation/travelFields";
import {
  GIRDER_SECTIONS,
  type GirderCtx,
} from "@/lib/calc/presentation/girderSections";
import {
  BUCKLING_SECTIONS,
  type BucklingCtx,
} from "@/lib/calc/presentation/bucklingSections";
import {
  ENDCARRIAGE_SECTIONS,
  type EndCarriageCtx,
} from "@/lib/calc/presentation/endCarriageSections";
import {
  WHEELLOAD_SECTIONS,
  type WheelLoadCtx,
} from "@/lib/calc/presentation/wheelLoadSections";
import {
  WHEELLOAD_INPUT_FIELDS,
  WHEELLOAD_SELECTION_FIELDS,
} from "@/lib/calc/presentation/wheelLoadFields";
import {
  BUCKLING_EXTRA_FIELDS,
  BUCKLING_PANEL_FIELDS,
  ENDCARRIAGE_INPUT_FIELDS,
  ENDCARRIAGE_SELECTION_FIELDS,
  GIRDER_INPUT_FIELDS,
  GIRDER_SELECTION_FIELDS,
} from "@/lib/calc/presentation/structuralFields";
import { bridgeMovingTrolleyWeightT, bridgeTrolleyWeightT, girderDepsFor } from "@/lib/calc/engine";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import {
  computeHoistGroup,
  hoistSpecView,
  type HoistInputs,
  type HoistSelections,
} from "@/lib/calc/modules/hoistGroup";
import {
  computeHookBlock,
  hookBlockDepsFromHoist,
  type HookBlockDeps,
} from "@/lib/calc/modules/hookBlock";
import {
  computeTravelGroup,
  travelSpecView,
  type TravelDeps,
  type TravelInputs,
} from "@/lib/calc/modules/travelGroup";
import {
  computeMainGirder,
  type GirderDeps,
  type GirderInputs,
  type GirderWhich,
} from "@/lib/calc/modules/mainGirder";
import { computeBuckling } from "@/lib/calc/modules/buckling";
import { computeEndCarriage, type EndCarriageDeps } from "@/lib/calc/modules/endCarriage";
import { cabinModuleApplies } from "@/lib/calc/modules/cabin";
import { CABIN_SECTIONS, type CabinCtx } from "@/lib/calc/presentation/cabinSections";
import {
  CABIN_INPUT_FIELDS,
  CABIN_SELECTION_FIELDS,
} from "@/lib/calc/presentation/cabinFields";
import {
  computeWheelLoads,
  wheelLoadDepsFrom,
  type WheelLoadDeps,
} from "@/lib/calc/modules/wheelLoads";
import type { AnyCheck, TechnicalSpecs } from "@/lib/calc/types";
import { hasSecondGirder, hasSeparateAuxTrolley, monorailCount } from "@/lib/calc/types";
import {
  HOIST_OF_HOOKBLOCK,
  MODULE_ORDER,
  isHoistKey,
  isHookBlockKey,
  isTravelKey,
  type HoistKey,
  type HookBlockKey,
  type ModuleKey,
  type TravelKey,
} from "@/lib/calc/presentation/module-family";
import { HOIST_FIELD } from "@/lib/calc/presentation/module-access";

// ---------------------------------------------------------------- Tipler

export type { ModuleKey } from "@/lib/calc/presentation/module-family";

/** Alan tanımlarının modülden bağımsız (gevşetilmiş) hali — FieldDef<T> ile
 *  yapısal uyumludur; keyof T'nin kontravaryansından kaçınmak için ayrı tanımlıdır. */
export interface AnyFieldDef {
  key: string;
  label: string;
  /** Teknik özelliklere göre değişen etiket (ör. kanca/tutucu tipi adı) */
  labelFor?: (specs: TechnicalSpecs) => string;
  unit?: string;
  type: "number" | "text" | "select";
  options?: readonly string[];
  /** Teknik özellik seçimlerine göre değişen select seçenekleri. */
  optionsFor?: (specs: TechnicalSpecs) => readonly string[];
  /** select değerleri sayısal alana yazılır */
  numeric?: boolean;
  /**
   * Seçim listesi bir ÖNERİDİR: kullanıcı listede olmayan bir değeri elle
   * yazabilir ("Elle Gir…"). Bayrağı sunum katmanı koyar; burada yalnız okunur.
   */
  allowCustom?: boolean;
  /** select seçeneklerinin gösterim etiketi */
  optionLabels?: Record<string, string>;
  /** Standart referansı (standards/registry.ts anahtarı) */
  standardRef?: string;
  /** Alanın altında gösterilecek kısa açıklama */
  hint?: string;
  /**
   * Alan bir ÇAP büyüklüğüdür: değer "Ø" işaretiyle gösterilir (arayüz + PDF).
   * Bayrağı sunum katmanı (fields.ts / *Fields.ts) koyar; burada yalnız okunur.
   * Bayrak yoksa hiçbir şey değişmez.
   */
  diameter?: boolean;
}

export interface AdapterRow {
  key: string;
  /**
   * Kontrol↔satır bağlantısı için kararlı kimlik (check-anchors.ts).
   * Aynı sunumu paylaşan varyantlarda (ana/yardımcı kaldırma, araba/köprü)
   * her varyantta AYNI değerdir, böylece harita tek kalır.
   */
  anchorId: string;
  label: string;
  formula?: string;
  formulaHint?: string;
  unit?: string;
  digits?: number;
  standard?: string;
  read: (ctx: unknown) => number | string | undefined;
  subst?: (ctx: unknown) => string;
  /** Satırın sonucu bir ÇAPtır: değerin başına "Ø" konur (arayüz + PDF) */
  diameter?: boolean;
  visible?: (ctx: unknown) => boolean;
}

/**
 * BAŞLIK KONTROLÜ (headline check) — bölümün özünü tek bakışta veren kontrol.
 *
 * Bir bölümün ayrıntılı hesap satırları aşağıda AYNEN kalır; başlık kontrolü
 * yalnızca "gereken ↔ gerçekleşen" (ya da "izin verilen ↔ oluşan") çiftini
 * seçimin YANINDA/ÜSTÜNDE tekrar eder, çünkü mühendis katalogdan seçim
 * yaparken kararını bu iki sayıya bakarak verir.
 *
 * Kavram jeneriktir: hangi kontrolün başlığa çıkacağını bölüm tanımı söyler,
 * sayılar ve uygunluk (yeşil/kırmızı) kontrolün KENDİ `pass` değerinden gelir —
 * burada eşik uydurulmaz.
 */
export interface AdapterHeadlineCheck {
  /** Kontrol id soneki — bölümün `checkSuffixes` sözlüğünden bir değer */
  suffix: string;
  /** Başlıkta görünen kısa ad (kontrolün tam etiketi şerit için uzun kalır) */
  label?: string;
}

export interface AdapterHeadline {
  /**
   * Yerleşim:
   * - `"catalog"` — katalog seçim başlığının (ve "Katalogdan Seç" düğmesinin)
   *   hemen yanında rozet çifti (madde 3: halat emniyet katsayısı).
   * - `"band"` — girdilerin hemen altında, katalog seçiminin üstünde kısa bir
   *   özet şeridi (madde 7: tambur mili gerilmeleri).
   */
  placement: "catalog" | "band";
  /** Şerit başlığı (yalnız `"band"`) */
  title?: string;
  /** Hesaptan çıkan değerin etiketi (ör. "Gerçekleşen", "Oluşan") */
  computedLabel: string;
  /** Sınır değerin etiketi (ör. "Gereken", "İzin verilen") */
  limitLabel: string;
  checks: readonly AdapterHeadlineCheck[];
}

/**
 * Bölüm sonunda gösterilen özet tablosu. Satır satır okunması zor olan
 * bileşen dökümlerini (ör. ana kiriş gerilme tablosu) tek bakışta verir.
 */
export interface AdapterTable {
  title: string;
  headers: string[];
  build: (ctx: unknown) => (string | number)[][];
  note?: string;
}

export interface AdapterSection {
  /** Görünen bölüm numarası (modül sırasına göre yeniden dizilir) */
  id: string;
  /** Kaynak sunum dosyasındaki ham id — alternatif anahtarlarında kullanılır */
  rawId: string;
  title: string;
  description?: string;
  inputDefs: AnyFieldDef[];
  /** inputDefs alt bir nesneye yazılıyorsa (buruşma panelleri) kapsam erişimcileri */
  inputScope?: {
    get: (inputs: object) => object;
    set: (inputs: object, next: object) => object;
  };
  /** Kök inputs nesnesine yazılan ek alanlar (kapsamdan bağımsız) */
  extraInputDefs?: AnyFieldDef[];
  selectionDefs: AnyFieldDef[];
  selectionKeys: readonly string[];
  /**
   * Bölümün girdi ızgarasından önce çizilecek özel düzenleyici. Jenerik alan
   * ızgarasıyla anlatılamayan geometriler için arayüz adanmış bir bileşen
   * çizer (teker düzeni ölçü zinciri). PDF tarafı bu alanı yok sayar.
   */
  editor?: "wheelSpacing" | "festoon";
  /**
   * Bölümün başlık kontrolü — girdiler ile katalog seçimi arasında (ya da
   * katalog başlığının yanında) gösterilen "gereken ↔ gerçekleşen" özeti.
   * Ayrıntılı hesap satırları bundan etkilenmez.
   */
  headline?: AdapterHeadline;
  checkSuffixes: readonly string[];
  rows: AdapterRow[];
  table?: AdapterTable;
  /**
   * Bölüm yalnız bu koşul sağlandığında çizilir (arayüz ve PDF ortak kullanır).
   * Koşul teknik özelliklerden okunur — hesap sonucuna bağlı değildir, bu
   * yüzden adım listesi kurulurken de değerlendirilebilir. Tanımsızsa bölüm
   * her zaman görünür.
   */
  visible?: (specs: TechnicalSpecs) => boolean;
}

/** Ana kiriş takımı anahtarları — adaptör iki takımı da aynı fabrikadan üretir. */
export type GirderModuleKey = GirderWhich;

export interface ModuleAdapter {
  key: ModuleKey;
  /** Kenar çubuğu / kart başlığı ("02 · Ana Kaldırma") */
  title: string;
  /**
   * Teknik özelliklere göre değişen başlık. Dört kirişli köprüde ana kiriş
   * "Ana Kiriş - 1" olur; tek takımda sade "Ana Kiriş" kalır. Tanımsızsa
   * `title` geçerlidir.
   */
  titleFor?: (specs: TechnicalSpecs) => string;
  /** Kontrol id öneki ("main.", "auxHookBlock.", ...) */
  checkPrefix: string;
  sections: AdapterSection[];
}

// ---------------------------------------------------------------- Yardımcılar

function fieldMap(fields: readonly AnyFieldDef[]): Map<string, AnyFieldDef> {
  return new Map(fields.map((f) => [f.key, f]));
}

const HOIST_INPUT_MAP = fieldMap(HOIST_INPUT_FIELDS);
const HOIST_SELECTION_MAP = fieldMap(HOIST_SELECTION_FIELDS);
const HOOKBLOCK_INPUT_MAP = fieldMap(HOOKBLOCK_INPUT_FIELDS);
const HOOKBLOCK_SELECTION_MAP = fieldMap(HOOKBLOCK_SELECTION_FIELDS);
const TRAVEL_INPUT_MAP = fieldMap(TRAVEL_INPUT_FIELDS);
const TRAVEL_SELECTION_MAP = fieldMap(TRAVEL_SELECTION_FIELDS);
const GIRDER_INPUT_MAP = fieldMap(GIRDER_INPUT_FIELDS);
const GIRDER_SELECTION_MAP = fieldMap(GIRDER_SELECTION_FIELDS);
const BUCKLING_PANEL_MAP = fieldMap(BUCKLING_PANEL_FIELDS);
const ENDCARRIAGE_INPUT_MAP = fieldMap(ENDCARRIAGE_INPUT_FIELDS);
const ENDCARRIAGE_SELECTION_MAP = fieldMap(ENDCARRIAGE_SELECTION_FIELDS);
const WHEELLOAD_INPUT_MAP = fieldMap(WHEELLOAD_INPUT_FIELDS);
const WHEELLOAD_SELECTION_MAP = fieldMap(WHEELLOAD_SELECTION_FIELDS);

function defs(keys: readonly string[], map: Map<string, AnyFieldDef>): AnyFieldDef[] {
  return keys
    .map((k) => map.get(k))
    .filter((f): f is AnyFieldDef => Boolean(f));
}

/**
 * Sunum satırındaki `diameter` bayrağı (madde 30).
 *
 * Bayrağı sunum katmanı (hoistSections, travelSections, …) koyar; satır tipleri
 * onu HENÜZ tanımlamıyor olabilir, bu yüzden yapısal olarak okunur: bayrak
 * yoksa `undefined` döner ve gösterimde hiçbir şey değişmez.
 */
function diameterFlag(def: object): true | undefined {
  return (def as { diameter?: unknown }).diameter === true ? true : undefined;
}

/** Başlık kontrolünün çözülmüş hali: kısa ad + motorun ürettiği kontrol. */
export interface HeadlineItem {
  label: string;
  check: AnyCheck;
}

/**
 * Bölümün başlık kontrollerini modül sonucundan çözer (arayüz + PDF ortak).
 * Kontrol üretilmemişse (bölüm hesaba girmemiş, seçim boş) satır düşer —
 * boş bir rozet basılmaz.
 */
export function headlineItems(
  checkPrefix: string,
  section: AdapterSection,
  checks: readonly AnyCheck[] | undefined
): HeadlineItem[] {
  const headline = section.headline;
  if (!headline || !checks) return [];
  const out: HeadlineItem[] = [];
  for (const h of headline.checks) {
    const c = checks.find((x) => x.id === `${checkPrefix}${h.suffix}`);
    if (c) out.push({ label: h.label ?? c.label, check: c });
  }
  return out;
}

// ---------------------------------------------------------------- Kaldırma

/** Kaldırma grubu başlıkları — numara çalışma anında yeniden dizilir. */
const HOIST_TITLES: Record<HoistKey, string> = {
  main: "Ana Kaldırma",
  aux: "Yardımcı Kaldırma",
  mono1: "Monoray 1 Kaldırma",
  mono2: "Monoray 2 Kaldırma",
};

/**
 * Kaldırma bölümlerinin başlık kontrolleri (bkz. AdapterHeadline).
 *
 * - 2.1 Halat: mühendis halatı katalogdan seçerken kararını GEREKEN ve
 *   GERÇEKLEŞEN emniyet katsayısına bakarak verir; ikisi seçim düğmesinin
 *   yanında durur (madde 3).
 * - 2.2.3 Tambur Mili: izin verilen ve oluşan gerilmeler girdilerin hemen
 *   altında özetlenir; ayrıntılı hesap satırları alt bölümde AYNEN kalır
 *   (madde 7).
 *
 * Sonekler bölümün `checkSuffixes` listesinden gelir — kontrolün kendisi ve
 * `pass` değeri motordan okunur, burada eşik tanımlanmaz.
 */
const HOIST_HEADLINES: Record<string, AdapterHeadline> = {
  "2.1": {
    placement: "catalog",
    computedLabel: "Gerçekleşen",
    limitLabel: "Gereken",
    checks: [{ suffix: "rope.safety", label: "Emniyet katsayısı" }],
  },
  "2.2.3": {
    placement: "band",
    title: "İzin Verilen / Oluşan Gerilmeler",
    computedLabel: "Oluşan",
    limitLabel: "İzin verilen",
    checks: [
      { suffix: "shaft.bending", label: "Eğilme" },
      { suffix: "shaft.shear", label: "Kesme" },
      { suffix: "shaft.stress", label: "Bileşik" },
    ],
  },
};

function hoistAdapter(which: HoistKey): ModuleAdapter {
  return {
    key: which,
    title: `02 · ${HOIST_TITLES[which]}`,
    checkPrefix: `${which}.`,
    sections: HOIST_SECTIONS.map((s) => ({
      id: s.id,
      rawId: s.id,
      title: s.title,
      description: s.description,
      inputDefs: defs(s.inputKeys, HOIST_INPUT_MAP),
      selectionDefs: defs(s.selectionKeys, HOIST_SELECTION_MAP),
      selectionKeys: s.selectionKeys,
      headline: HOIST_HEADLINES[s.id],
      checkSuffixes: s.checkSuffixes,
      visible: s.visible ? (specs: TechnicalSpecs) => s.visible!(specs, which) : undefined,
      rows: s.rows.map((r) => {
        const sub = r.subst;
        const valueFrom = r.valueFrom;
        return {
          key: r.key,
          anchorId: r.key,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          standard: r.standard,
          diameter: diameterFlag(r),
          read: (ctx: unknown) =>
            valueFrom ? valueFrom(ctx as HoistCtx) : (ctx as HoistCtx).c[r.key],
          subst: sub ? (ctx: unknown) => sub(ctx as HoistCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Kanca bloğu

const HOOKBLOCK_TITLES: Record<HookBlockKey, string> = {
  hookBlock: "Ana Kanca Bloğu",
  auxHookBlock: "Yardımcı Kanca Bloğu",
  mono1HookBlock: "Monoray 1 Kanca Bloğu",
  mono2HookBlock: "Monoray 2 Kanca Bloğu",
};

function hookBlockAdapter(which: HookBlockKey): ModuleAdapter {
  return {
    key: which,
    title: `04 · ${HOOKBLOCK_TITLES[which]}`,
    checkPrefix: `${which}.`,
    sections: HOOKBLOCK_SECTIONS.map((s) => ({
      id: s.id,
      rawId: s.id,
      title: s.title,
      description: s.description,
      inputDefs: defs(s.inputKeys, HOOKBLOCK_INPUT_MAP),
      selectionDefs: defs(s.selectionKeys, HOOKBLOCK_SELECTION_MAP),
      selectionKeys: s.selectionKeys,
      checkSuffixes: s.checkSuffixes,
      rows: s.rows.map((r) => {
        const sub = r.subst;
        const valueFrom = r.valueFrom;
        const key = r.key;
        return {
          key,
          anchorId: key,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          standard: r.standard,
          diameter: diameterFlag(r),
          // Değer ya motorun haritasından ya da girdi/bağımlılık yankısından okunur
          read: (ctx: unknown) =>
            valueFrom ? valueFrom(ctx as HookBlockCtx) : (ctx as HookBlockCtx).c[key],
          subst: sub ? (ctx: unknown) => sub(ctx as HookBlockCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Yürütme

/** Yürütme bölümlerinin köprü numaraları — 5.5b fren bölümü 6.6 olur. */
const BRIDGE_ID_MAP: Record<string, string> = {
  "5.1": "6.1",
  "5.2": "6.2",
  "5.3": "6.3",
  "5.4": "6.4",
  "5.5": "6.5",
  "5.5b": "6.6",
  "5.6": "6.7",
  "5.7": "6.8",
  "5.8": "6.9",
  "5.9": "6.10",
};

const TRAVEL_TITLES: Record<TravelKey, string> = {
  trolley: "Ana Araba Yürütme",
  auxTrolley: "Yardımcı Araba Yürütme",
  mono1Trolley: "Monoray 1 Araba Yürütme",
  mono2Trolley: "Monoray 2 Araba Yürütme",
  bridge: "Köprü Yürütme",
};

const FESTOON_TITLES: Record<TravelKey, string> = {
  trolley: "Ana Araba",
  auxTrolley: "Yardımcı Araba",
  mono1Trolley: "Monoray 1 Arabası",
  mono2Trolley: "Monoray 2 Arabası",
  bridge: "Köprü",
};

function travelAdapter(which: TravelKey): ModuleAdapter {
  const isBridge = which === "bridge";
  return {
    key: which,
    title: `${isBridge ? "06" : "05"} · ${TRAVEL_TITLES[which]}`,
    checkPrefix: `${which}.`,
    sections: TRAVEL_SECTIONS.filter((s) => isBridge || !s.bridgeOnly).map((s) => ({
      id: isBridge ? BRIDGE_ID_MAP[s.id] ?? s.id.replace(/^5/, "6") : s.id,
      rawId: s.id,
      title: s.editor === "festoon" ? `${FESTOON_TITLES[which]} Feston` : s.title,
      description: s.description,
      inputDefs: defs(s.inputKeys, TRAVEL_INPUT_MAP),
      selectionDefs: defs(s.selectionKeys, TRAVEL_SELECTION_MAP),
      selectionKeys: s.selectionKeys,
      editor: s.editor,
      checkSuffixes: s.checkSuffixes,
      // Koşullu bölümler (ör. 5.8 tampon — tampon tipi "Yok" ise görünmez).
      // hoistAdapter ile aynı desen; koşul teknik özelliklerden okunur.
      visible: s.visible ? (specs: TechnicalSpecs) => s.visible!(specs, which) : undefined,
      // Tüm yürütme varyantları AYNI semantik anahtarları kullanır; yalnız tek
      // varyantta üretilen satırlar diğerinde gösterilmez.
      rows: s.rows
        .filter(
          (r) =>
            r.variant === undefined ||
            (r.variant === "bridge" ? isBridge : !isBridge)
        )
        .map((r) => {
          const sub = r.subst;
          const valueFrom = r.valueFrom;
          return {
            key: r.key,
            anchorId: r.key,
            label: r.label,
            formula: r.formula,
            formulaHint: r.formulaHint,
            unit: r.unit,
            digits: r.digits,
            standard: r.standard,
            diameter: diameterFlag(r),
            visible: r.visible ? (ctx: unknown) => r.visible!(ctx as TravelCtx) : undefined,
            read: (ctx: unknown) =>
              valueFrom ? valueFrom(ctx as TravelCtx) : (ctx as TravelCtx).c[r.key],
            subst: sub ? (ctx: unknown) => sub(ctx as TravelCtx) : undefined,
          };
        }),
    })),
  };
}

// ------------------------------------------------------------- Teker yükleri

function wheelLoadAdapter(): ModuleAdapter {
  return {
    key: "wheelLoads",
    title: "07 · Teker Yükleri",
    checkPrefix: "wheelLoads.",
    sections: WHEELLOAD_SECTIONS.map((s) => {
      const t = s.table;
      return {
        id: s.id,
        rawId: s.id,
        title: s.title,
        description: s.description,
        inputDefs: defs(s.inputKeys, WHEELLOAD_INPUT_MAP),
        selectionDefs: defs(s.selectionKeys, WHEELLOAD_SELECTION_MAP),
        selectionKeys: s.selectionKeys,
        editor: s.editor,
        checkSuffixes: s.checkSuffixes,
        table: t
          ? {
              title: t.title,
              headers: t.headers,
              note: t.note,
              build: (ctx: unknown) => t.build(ctx as WheelLoadCtx),
            }
          : undefined,
        rows: s.rows.map((r) => {
          const sub = r.subst;
          return {
            key: r.key,
            anchorId: r.key,
            label: r.label,
            formula: r.formula,
            unit: r.unit,
            digits: r.digits,
            standard: r.standard,
            diameter: diameterFlag(r),
            read: (ctx: unknown) => (ctx as WheelLoadCtx).c[r.key],
            subst: sub ? (ctx: unknown) => sub(ctx as WheelLoadCtx) : undefined,
          };
        }),
      };
    }),
  };
}

// ---------------------------------------------------------------- Ana kiriş

function girderAdapter(key: GirderModuleKey): ModuleAdapter {
  const ikinci = key === "girder2";
  return {
    key,
    // Dört kirişli köprüde iki takım vardır; başlık o zaman "Ana Kiriş - 1" /
    // "Ana Kiriş - 2" olur. Tek takımda sade "Ana Kiriş" kalır — olmayan bir
    // ikincinin varlığını ima etmez (`titleFor`, MODULE_LABEL_FOR).
    title: ikinci ? "07 · Ana Kiriş - 2" : "07 · Ana Kiriş",
    titleFor: (specs) =>
      ikinci
        ? "07 · Ana Kiriş - 2"
        : hasSecondGirder(specs) ? "07 · Ana Kiriş - 1" : "07 · Ana Kiriş",
    checkPrefix: `${key}.`,
    sections: GIRDER_SECTIONS.map((s) => {
      const t = s.table;
      return {
        id: s.id,
        rawId: s.id,
        title: s.title,
        description: s.description,
        inputDefs: defs(s.inputKeys, GIRDER_INPUT_MAP),
        selectionDefs: defs(s.selectionKeys, GIRDER_SELECTION_MAP),
        selectionKeys: s.selectionKeys,
        checkSuffixes: s.checkSuffixes,
        table: t
          ? {
              title: t.title,
              headers: t.headers,
              note: t.note,
              build: (ctx: unknown) => t.build(ctx as GirderCtx),
            }
          : undefined,
        rows: s.rows.map((r) => {
          const sub = r.subst;
          return {
            key: r.key,
            anchorId: r.key,
            label: r.label,
            formula: r.formula,
            unit: r.unit,
            digits: r.digits,
            standard: r.standard,
            diameter: diameterFlag(r),
            read: (ctx: unknown) => (ctx as GirderCtx).c[r.key],
            subst: sub ? (ctx: unknown) => sub(ctx as GirderCtx) : undefined,
          };
        }),
      };
    }),
  };
}

// ---------------------------------------------------------------- Buruşma

function bucklingAdapter(): ModuleAdapter {
  return {
    key: "buckling",
    title: "08 · Buruşma",
    checkPrefix: "buckling.",
    sections: BUCKLING_SECTIONS.map((s) => ({
      id: s.id,
      rawId: s.id,
      title: s.title,
      description: s.description,
      inputDefs: defs(s.inputKeys, BUCKLING_PANEL_MAP),
      // Panel alanları inputs.side / inputs.top alt nesnelerine yazılır
      inputScope: {
        get: (inputs: object) => (inputs as Record<string, object>)[s.panel] ?? {},
        set: (inputs: object, next: object) => ({ ...inputs, [s.panel]: next }),
      },
      // Düzeltilmiş kritik gerilme kök inputs alanıdır; yalnız yan sacda görünür
      extraInputDefs: s.panel === "side" ? [...BUCKLING_EXTRA_FIELDS] : undefined,
      selectionDefs: [],
      selectionKeys: [],
      checkSuffixes: s.checkSuffixes,
      rows: s.rows.map((r) => {
        const sub = r.subst;
        return {
          key: r.key,
          anchorId: r.key,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          standard: r.standard,
          diameter: diameterFlag(r),
          read: (ctx: unknown) => (ctx as BucklingCtx).c[r.key],
          subst: sub ? (ctx: unknown) => sub(ctx as BucklingCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Başkiriş

function endCarriageAdapter(): ModuleAdapter {
  return {
    key: "endCarriage",
    title: "09 · Başkiriş",
    checkPrefix: "endCarriage.",
    sections: ENDCARRIAGE_SECTIONS.map((s) => ({
      id: s.id,
      rawId: s.id,
      title: s.title,
      description: s.description,
      inputDefs: defs(s.inputKeys, ENDCARRIAGE_INPUT_MAP),
      selectionDefs: defs(s.selectionKeys, ENDCARRIAGE_SELECTION_MAP),
      selectionKeys: s.selectionKeys,
      checkSuffixes: s.checkSuffixes,
      rows: s.rows.map((r) => {
        const sub = r.subst;
        return {
          key: r.key,
          anchorId: r.key,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          standard: r.standard,
          diameter: diameterFlag(r),
          read: (ctx: unknown) => (ctx as EndCarriageCtx).c[r.key],
          subst: sub ? (ctx: unknown) => sub(ctx as EndCarriageCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Kabin

const CABIN_INPUT_MAP = fieldMap(CABIN_INPUT_FIELDS as AnyFieldDef[]);
const CABIN_SELECTION_MAP = fieldMap(CABIN_SELECTION_FIELDS as AnyFieldDef[]);

function cabinAdapter(): ModuleAdapter {
  return {
    key: "cabin",
    title: "11 · Kabin ve Elektrik Odası",
    checkPrefix: "cabin.",
    sections: CABIN_SECTIONS.map((s) => ({
      id: s.id,
      rawId: s.id,
      title: s.title,
      description: s.description,
      visible: s.visible,
      inputDefs: defs(s.inputKeys, CABIN_INPUT_MAP),
      selectionDefs: defs(s.selectionKeys, CABIN_SELECTION_MAP),
      selectionKeys: s.selectionKeys,
      checkSuffixes: s.checkSuffixes,
      rows: s.rows.map((r) => {
        const sub = r.subst;
        const from = r.valueFrom;
        return {
          key: r.key,
          anchorId: r.key,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          read: from
            ? (ctx: unknown) => from(ctx as CabinCtx)
            : (ctx: unknown) => (ctx as CabinCtx).c[r.key],
          subst: sub ? (ctx: unknown) => sub(ctx as CabinCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Dışa aktarım

const ADAPTER_FACTORY: Record<ModuleKey, () => ModuleAdapter> = {
  main: () => hoistAdapter("main"),
  hookBlock: () => hookBlockAdapter("hookBlock"),
  aux: () => hoistAdapter("aux"),
  auxHookBlock: () => hookBlockAdapter("auxHookBlock"),
  trolley: () => travelAdapter("trolley"),
  auxTrolley: () => travelAdapter("auxTrolley"),
  mono1: () => hoistAdapter("mono1"),
  mono1HookBlock: () => hookBlockAdapter("mono1HookBlock"),
  mono1Trolley: () => travelAdapter("mono1Trolley"),
  mono2: () => hoistAdapter("mono2"),
  mono2HookBlock: () => hookBlockAdapter("mono2HookBlock"),
  mono2Trolley: () => travelAdapter("mono2Trolley"),
  bridge: () => travelAdapter("bridge"),
  wheelLoads: wheelLoadAdapter,
  girder: () => girderAdapter("girder"),
  girder2: () => girderAdapter("girder2"),
  buckling: bucklingAdapter,
  endCarriage: endCarriageAdapter,
  cabin: cabinAdapter,
};

/** Sihirbaz adım sırası — her kaldırma grubunu kendi kanca bloğu izler. */
export const MODULE_ADAPTERS: ModuleAdapter[] = MODULE_ORDER.map((k) => ADAPTER_FACTORY[k]());

export const ADAPTER_BY_KEY: Record<ModuleKey, ModuleAdapter> = Object.fromEntries(
  MODULE_ADAPTERS.map((a) => [a.key, a])
) as Record<ModuleKey, ModuleAdapter>;

// -------------------------------------------------- Esnek modül / numaralandırma
// Bazı bölümler vince göre olmayabilir (yardımcı kaldırma yok, kanca yerine
// kaldırma kirişi/mıknatıs → kanca bloğu yok, monoray yok). Bu bölümler açılıp
// kapatılabilir; görüntü numaraları (02, 03…) mevcut bölümlere göre yeniden
// dizilir. rawId, checkPrefix ve hücre referansları DEĞİŞMEZ.

/**
 * Vince göre eklenip çıkarılabilen bölümler.
 *
 * Ana kaldırma, ana araba ve köprü yürütme kapatılamaz: diğer bölümler hesap
 * girdilerini bunlardan alır.
 */
export const OPTIONAL_MODULE_KEYS: readonly ModuleKey[] = [
  "hookBlock",
  "aux",
  "auxHookBlock",
  "auxTrolley",
  "mono1",
  "mono1HookBlock",
  "mono1Trolley",
  "mono2",
  "mono2HookBlock",
  "mono2Trolley",
  "wheelLoads",
  "girder",
  "girder2",
  "buckling",
  "endCarriage",
  "cabin",
];

/**
 * Vinç konfigürasyonundan (teknik özellikler) türeyen bölümler: kullanıcı
 * bunları tek tek açıp kapatmaz, konfigürasyon alanını değiştirir.
 * Anahtar → o bölümün görünür olması için gereken koşul.
 */
export const CONFIG_DRIVEN_MODULE_KEYS: readonly ModuleKey[] = [
  "auxTrolley",
  "girder2",
  "cabin",
  "mono1",
  "mono1HookBlock",
  "mono1Trolley",
  "mono2",
  "mono2HookBlock",
  "mono2Trolley",
];

/**
 * Bölüm, vincin konfigürasyonuna göre hiç var olabilir mi?
 * (Kullanıcının aç/kapa tercihinden bağımsız yapısal uygunluk.)
 */
export function moduleAllowedByConfig(specs: TechnicalSpecs, key: ModuleKey): boolean {
  const monos = monorailCount(specs);
  switch (key) {
    case "auxTrolley":
      return hasSeparateAuxTrolley(specs);
    case "mono1":
    case "mono1HookBlock":
    case "mono1Trolley":
      return monos >= 1;
    case "mono2":
    case "mono2HookBlock":
    case "mono2Trolley":
      return monos >= 2;
    // İkinci ana kiriş takımı yalnız DÖRT KİRİŞLİ köprüde vardır.
    case "girder2":
      return hasSecondGirder(specs);
    // Kabin bölümü ancak vinçte operatör kabini ya da bir elektrik yerleşimi
    // (oda / pano) varsa listede görünür — ikisi de yoksa boş bir bölüm olurdu.
    case "cabin":
      return cabinModuleApplies(specs);
    default:
      return true;
  }
}

/**
 * Bölüm bir üst bölüme bağlıysa onun anahtarı. Üst bölüm kapalıysa alt bölüm de
 * hesaba girmez (yardımcı kaldırma kapalıyken yardımcı kanca bloğu olamaz).
 */
export const MODULE_PARENT: Partial<Record<ModuleKey, ModuleKey>> = {
  // İkinci kiriş takımı birincisiyle birlikte var olur: ikisi aynı köprünün
  // iki takımıdır, birincisi kapalıyken ikincisi anlamsızdır.
  girder2: "girder",
  hookBlock: "main",
  auxHookBlock: "aux",
  auxTrolley: "aux",
  mono1HookBlock: "mono1",
  mono1Trolley: "mono1",
  mono2HookBlock: "mono2",
  mono2Trolley: "mono2",
};

/** Bölüm aç/kapa kontrollerinde görünen kısa etiketler. */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  main: "Ana Kaldırma",
  hookBlock: "Ana Kanca Bloğu",
  aux: "Yardımcı Kaldırma",
  auxHookBlock: "Yardımcı Kanca Bloğu",
  trolley: "Ana Araba Yürütme",
  auxTrolley: "Yardımcı Araba Yürütme",
  mono1: "Monoray 1 Kaldırma",
  mono1HookBlock: "Monoray 1 Kanca Bloğu",
  mono1Trolley: "Monoray 1 Araba Yürütme",
  mono2: "Monoray 2 Kaldırma",
  mono2HookBlock: "Monoray 2 Kanca Bloğu",
  mono2Trolley: "Monoray 2 Araba Yürütme",
  bridge: "Köprü Yürütme",
  wheelLoads: "Teker Yükleri",
  girder: "Ana Kiriş",
  girder2: "Ana Kiriş - 2",
  buckling: "Buruşma",
  endCarriage: "Başkiriş",
  cabin: "Kabin ve Elektrik Odası",
};

/**
 * Bölümün TEKNİK ÖZELLİKLERE göre çözülmüş başlığı.
 *
 * Çoğu bölümün başlığı sabittir; ana kiriş dört kirişli köprüde "Ana Kiriş - 1"
 * olur (yanında bir "Ana Kiriş - 2" varken sade "Ana Kiriş" hangi takım olduğunu
 * söylemez). Numara ayrıca `renumberTitle` ile yeniden dizilir — bu fonksiyon
 * yalnız ADI çözer.
 */
export function adapterTitle(adapter: ModuleAdapter, specs?: TechnicalSpecs): string {
  return (specs && adapter.titleFor?.(specs)) || adapter.title;
}

/** Kısa etiketin teknik özelliklere göre çözülmüş hali (aç/kapa kontrolleri). */
export function moduleLabelFor(key: ModuleKey, specs?: TechnicalSpecs): string {
  if (key === "girder" && specs && hasSecondGirder(specs)) return "Ana Kiriş - 1";
  return MODULE_LABELS[key];
}

export function isOptionalModule(key: ModuleKey): boolean {
  return OPTIONAL_MODULE_KEYS.includes(key);
}

/**
 * present(key) yüklem — modül dahil mi. Modül anahtarı → görüntü numarası
 * (Teknik Özellikler = 1 kabul edilir; ilk dahil modül = 2).
 */
export function moduleDisplayNumbers(
  present: (k: ModuleKey) => boolean
): Partial<Record<ModuleKey, number>> {
  const out: Partial<Record<ModuleKey, number>> = {};
  let n = 1;
  for (const a of MODULE_ADAPTERS) {
    if (present(a.key)) {
      n += 1;
      out[a.key] = n;
    }
  }
  return out;
}

/** "02 · Ana Kaldırma" + 3 → "03 · Ana Kaldırma" (baştaki numara değişir). */
export function renumberTitle(title: string, n: number): string {
  return title.replace(/^\d+/, String(n).padStart(2, "0"));
}

/** "2.2.1" + 5 → "5.2.1" (ilk segment = modül numarası). */
export function renumberSectionId(id: string, n: number): string {
  const parts = id.split(".");
  parts[0] = String(n);
  return parts.join(".");
}

// ---------------------------------------------------------------- Deps üretimi

/**
 * Modüller arası bağımlılıklar — runCalc'taki bağlama mantığının editör tarafı
 * karşılığı (alternatif hesapları ve sunum ctx'leri için). Motor dosyalarına
 * dokunmadan aynı kaynaklardan okunur.
 */
export interface ModuleDepsBundle {
  /** Kanca bloğu bölümü başına, bağlı olduğu kaldırma grubundan türetilmiş */
  hookBlock: Record<HookBlockKey, HookBlockDeps>;
  /** Yürütme bölümü başına */
  travel: Record<TravelKey, TravelDeps>;
  wheelLoads: WheelLoadDeps;
  girder: GirderDeps;
  /** İkinci ana kiriş takımı (dört kirişli köprü) */
  girder2: GirderDeps;
  endCarriage: EndCarriageDeps;
}

/** Bir yürütme grubu hangi kaldırma grubunun donanımını taşır. */
const HOIST_OF_TRAVEL: Record<TravelKey, HoistKey> = {
  trolley: "main",
  auxTrolley: "aux",
  mono1Trolley: "mono1",
  mono2Trolley: "mono2",
  bridge: "main",
};

const EMPTY_HOOKBLOCK_DEPS: HookBlockDeps = {
  ropeDiaMm: 0,
  ropeLoadKg: 0,
  loadKg: 0,
  hookBlockWeightKg: 0,
  ropeWeightKg: 0,
  totalLoadKg: 0,
  drumRpm: 0,
  drumDiaMm: 0,
  blockSheaveCount: 1,
};

/**
 * Ana kiriş bağımlılıklarının YEDEĞİ — köprü ya da araba sonucu henüz yokken.
 *
 * Editör ilk çizimde hesap sonucu olmadan da kurulur; motorun bağlayıcısı bu
 * durumda `undefined` döner ve `deps.girder` alanı zorunlu olduğu için bir
 * değer gerekir. Yedek sıfır/varsayılan taşır ve hiçbir kontrolü besleyemez —
 * sonuç geldiğinde gerçek bağlayıcı devreye girer.
 */
function girderDepsYedek(
  specs: TechnicalSpecs,
  input: CalcInput,
  result: CalcResult
): GirderDeps {
  return {
    hoistLoadKg: specs.mainCapacityT * 1000,
    liftSpeedMpm: specs.mainLiftSpeedMpm,
    girdersInBridge: hasSecondGirder(specs) ? 4 : 2,
    mainHookBlockWeightKg: input.mainHoist?.inputs.hookBlockWeightKg ?? 0,
    mainRopeWeightKg: input.mainHoist?.inputs.ropeWeightKg ?? 0,
    trolleyWeightT: specs.mainTrolleyWeightT,
    trolleyWheelCount: input.trolley?.inputs.wheelCount ?? 4,
    trolleyRailCode: input.trolley?.selections.railCode ?? "",
    trolleyDrivenWheels: result.trolley?.values.drivenWheels ?? 2,
    trolleyActualSpeedMpm: result.trolley?.values.actualSpeedMpm ?? 0,
    trolleyAccelTimeS: result.trolley?.values.startupTimeS ?? 0,
    bridgeWeightT: specs.bridgeWeightT,
    bridgeWheelCount: input.bridge?.inputs.wheelCount ?? 4,
    bridgeDrivenWheels: result.bridge?.values.drivenWheels ?? 2,
    bridgeActualSpeedMpm: result.bridge?.values.actualSpeedMpm ?? 0,
    bridgeAccelTimeS: result.bridge?.values.startupTimeS ?? 0,
  };
}

export function buildModuleDeps(input: CalcInput, result: CalcResult): ModuleDepsBundle {
  const specs = input.specs;

  const hoistState = (k: HoistKey) => input[HOIST_FIELD[k]];
  const hoistResult = (k: HoistKey) => result[HOIST_FIELD[k]];

  const hookEquipmentT = (k: HoistKey): number => {
    const st = hoistState(k) ?? input.mainHoist;
    if (!st) return 0;
    return (st.inputs.hookBlockWeightKg + st.inputs.ropeWeightKg) / 1000;
  };

  const hookBlock = {} as Record<HookBlockKey, HookBlockDeps>;
  for (const key of Object.keys(HOIST_OF_HOOKBLOCK) as HookBlockKey[]) {
    const hk = HOIST_OF_HOOKBLOCK[key];
    const st = hoistState(hk);
    const res = hoistResult(hk);
    hookBlock[key] =
      st && res
        ? hookBlockDepsFromHoist({
            values: res.values,
            inputs: st.inputs,
            selections: st.selections,
          })
        : EMPTY_HOOKBLOCK_DEPS;
  }

  // Köprü tüm arabaları taşır; motorun kabulüyle aynı kaynak kullanılır.
  const src = input as unknown as Record<string, unknown>;
  const activeTravel = new Set(
    (Object.keys(HOIST_OF_TRAVEL) as TravelKey[]).filter((k) => src[k] !== undefined)
  );
  const bridgeTrolleyT = bridgeTrolleyWeightT(specs, activeTravel);
  const bridgeMovingTrolleyT = bridgeMovingTrolleyWeightT(specs, input);
  const travel = {} as Record<TravelKey, TravelDeps>;
  for (const key of Object.keys(HOIST_OF_TRAVEL) as TravelKey[]) {
    travel[key] = {
      hookEquipmentT: hookEquipmentT(HOIST_OF_TRAVEL[key]),
      trolleyWeightT: bridgeTrolleyT,
      bridgeMovingTrolleyWeightT: bridgeMovingTrolleyT,
    };
  }

  return {
    hookBlock,
    travel,
    wheelLoads: wheelLoadDepsFrom({
      bridgeWheelCount: input.bridge?.inputs.wheelCount ?? 4,
      bridgeDrivenWheels: result.bridge?.values.drivenWheels ?? 2,
      bridgeActualSpeedMpm:
        result.bridge?.values.actualSpeedMpm ?? specs.bridgeSpeedMpm,
      bridgeAccelerationMs2: input.bridge?.inputs.accelerationMs2 ?? 0.1,
      bridgeMinApproachM: input.bridge?.inputs.minApproachM ?? 1,
      bridgeRailCode: input.bridge?.selections.railCode ?? "",
      bridgeBufferForceKn: result.bridge?.values.bufferForceKn ?? 0,
      mainHoistTotalLoadKg: result.mainHoist?.values.totalLoadKg ?? 0,
      trolleyWeightT: bridgeTrolleyT,
      bridgeWeightT: specs.bridgeWeightT,
    }),
    // İKİ TAKIM DA MOTORUN KENDİ BAĞLAYICISINDAN gelir (`girderDepsFor`):
    // "hangi kiriş hangi kaldırma grubunun yükünü taşır" sorusunun tek bir
    // cevabı olsun. Bağımlılık kurulamıyorsa (köprü/araba sonucu henüz yok)
    // yedek değerlerle devam edilir — editör açılışta boş sonuçla da çizilir.
    girder: girderDepsFor(specs, "girder", input, result) ?? girderDepsYedek(specs, input, result),
    girder2:
      girderDepsFor(specs, "girder2", input, result) ?? girderDepsYedek(specs, input, result),
    endCarriage: {
      mainHoistTotalLoadKg: result.mainHoist?.values.totalLoadKg ?? 0,
      trolleyWeightT: bridgeTrolleyT,
      bridgeWeightT: specs.bridgeWeightT,
    },
  };
}

// ------------------------------------------------ Otomatik girdi türetmesi
//
// "Otomatik" anahtarı açık olan alanlar bir GİRDİ gibi saklanır ama değerleri
// başka verilerden türetilir (bkz. calc/derive.ts). Editör türetilen değeri
// state'e YAZAR — motor, PDF raporu ve ekipman listesi hep aynı sayıyı görsün
// diye. Bu bölüm o yazma işleminin SAF karşılığıdır: React'ten bağımsızdır,
// bu yüzden doğrudan test edilebilir.
//
// KRİTİK: yalnız DEĞİŞEN alan patch'lenir ve hiçbir değişiklik yoksa AYNI
// nesne geri döner. Referans eşitliği korunmazsa `setMods` her turda yeni
// nesne üretir ve editör sonsuz yeniden çizime girer.

/** Bir hesap bölümünün girdi + seçim durumu. */
export type ModuleState = { inputs: object; selections: object };
/** Tüm bölümlerin durumu — anahtar bazlı, vinç topolojisinden bağımsız. */
export type ModulesState = Record<ModuleKey, ModuleState>;

/** Otomatik açık ama kaynak veri eksikse alanın altında gösterilen uyarı. */
export interface DerivationWarning {
  field: string;
  message: string;
}

/**
 * Yürütme türetmesi teknik özelliklerden yalnız MEKANİZMA SINIFINI okur;
 * ağırlık bağımlılıkları (kanca donanımı, araba) bu türetmeye girmediği için
 * görünüm sıfır ağırlıkla kurulur.
 */
const TRAVEL_VIEW_DEPS: TravelDeps = { hookEquipmentT: 0, trolleyWeightT: 0 };

/**
 * Ana kirişin türetmesi TAŞIDIĞI kaldırma grubunun girdilerinden beslenir:
 * birinci takım ana kaldırmayı, dört kirişli köprüde ikinci takım YARDIMCI
 * kaldırmayı taşır. ψhA / ψhK kütle oranından çıktığı için bu ayrım gerçektir —
 * ikinci takımı ana kaldırmanın kütlesiyle türetmek yanlış bir yatay dinamik
 * katsayı yazardı.
 */
function girderDeriveContext(
  mods: ModulesState,
  specs: TechnicalSpecs,
  which: GirderWhich = "girder"
): GirderDeriveContext {
  const ikinci = which === "girder2";
  const auxVar = ikinci && mods.aux !== undefined;
  const h = (auxVar ? mods.aux : mods.main)?.inputs as HoistInputs | undefined;
  return {
    mainHookBlockWeightKg: h?.hookBlockWeightKg ?? 0,
    mainRopeWeightKg: h?.ropeWeightKg ?? 0,
    hoistLoadKg: (auxVar ? specs.auxCapacityT : specs.mainCapacityT) * 1000,
    trolleyWeightT:
      auxVar && hasSeparateAuxTrolley(specs)
        ? specs.auxTrolleyWeightT ?? specs.mainTrolleyWeightT
        : specs.mainTrolleyWeightT,
  };
}

/**
 * Kaldırma grubunun otomatik alanları.
 *
 * İki hedef vardır: halat/kanca/sıcaklık/makara verimi/tambur ağırlığı GİRDİYE,
 * yiv boyu metni ise KATALOG SEÇİMİNE yazılır (`HoistSelections`), çünkü yiv
 * boyu bir seçim alanıdır — anahtarı yine girdilerde durur.
 */
export function withDerivedHoist(
  state: ModuleState,
  specs: TechnicalSpecs,
  which: HoistKey
): ModuleState {
  const inputs = state.inputs as HoistInputs;
  const selections = state.selections as HoistSelections;
  const view = hoistSpecView(specs, which);
  const d = deriveHoistInputs(inputs, selections, {
    liftHeightM: view.liftHeightM,
    capacityT: view.capacityT,
    ambientTempMaxC: specs.ambientTempMaxC,
  });

  const patch: Partial<HoistInputs> = {};
  const put = <K extends keyof HoistInputs>(k: K, v: HoistInputs[K] | undefined) => {
    if (v !== undefined && v !== inputs[k]) patch[k] = v;
  };
  // Hazır donanım seçiliyse tahrikli/toplam halat kutuları da o donanıma uyar.
  put("drivenFalls", d.drivenFalls);
  put("totalFalls", d.totalFalls);
  put("ropeWeightKg", d.ropeWeightKg);
  put("hookBlockWeightKg", d.hookBlockWeightKg);
  put("tempFactor", d.tempFactor);
  put("sheaveEfficiency", d.sheaveEfficiency);
  put("drumWeightKg", d.drumWeightKg);

  const selPatch: Partial<HoistSelections> = {};
  if (
    d.drumGrooveLengthText !== undefined &&
    d.drumGrooveLengthText !== selections.drumGrooveLengthText
  ) {
    selPatch.drumGrooveLengthText = d.drumGrooveLengthText;
  }

  const inputsChanged = Object.keys(patch).length > 0;
  const selChanged = Object.keys(selPatch).length > 0;
  if (!inputsChanged && !selChanged) return state;
  return {
    inputs: inputsChanged ? { ...inputs, ...patch } : state.inputs,
    selections: selChanged ? { ...selections, ...selPatch } : state.selections,
  };
}

/**
 * Yürütme grubunun otomatik alanları: sıcaklık faktörü, CMAA uygulama sınıfı
 * ve ona bağlı Ks / Kt katsayıları. Teknik Özellikler'de mekanizma sınıfı
 * değiştiğinde uygulama sınıfı ve Ks BURADAN güncellenir.
 */
export function withDerivedTravel(
  state: ModuleState,
  specs: TechnicalSpecs,
  which: TravelKey
): ModuleState {
  const inputs = state.inputs as TravelInputs;
  const view = travelSpecView(specs, which, TRAVEL_VIEW_DEPS);
  const d = deriveTravelInputs(inputs, {
    ambientTempMaxC: specs.ambientTempMaxC,
    mechanismClass: view.mechanismClass,
  });

  const patch: Partial<TravelInputs> = {};
  const put = <K extends keyof TravelInputs>(k: K, v: TravelInputs[K] | undefined) => {
    if (v !== undefined && v !== inputs[k]) patch[k] = v;
  };
  put("tempFactor", d.tempFactor);
  put("applicationClass", d.applicationClass);
  put("serviceFactorKs", d.serviceFactorKs);
  put("accelTorqueFactorKt", d.accelTorqueFactorKt);

  if (Object.keys(patch).length === 0) return state;
  return { ...state, inputs: { ...inputs, ...patch } };
}

/** Ana kirişin 7.2 / 7.3 otomatik katsayıları: ψhA, ψhK, γc. */
export function withDerivedGirder(
  state: ModuleState,
  specs: TechnicalSpecs,
  ctx: GirderDeriveContext
): ModuleState {
  const inputs = state.inputs as GirderInputs;
  const d = deriveGirderInputs(inputs, specs, ctx);

  const patch: Partial<GirderInputs> = {};
  const put = <K extends keyof GirderInputs>(k: K, v: GirderInputs[K] | undefined) => {
    if (v !== undefined && v !== inputs[k]) patch[k] = v;
  };
  put("psiHAOverride", d.psiHAOverride);
  put("psiHKOverride", d.psiHKOverride);
  put("amplifyYcOverride", d.amplifyYcOverride);

  if (Object.keys(patch).length === 0) return state;
  return { ...state, inputs: { ...inputs, ...patch } };
}

/** Bir bölümün durumunu ailesine göre türetmelerden geçirir. */
export function withDerivedModule(
  key: ModuleKey,
  state: ModuleState,
  specs: TechnicalSpecs,
  all: ModulesState
): ModuleState {
  if (isHoistKey(key)) return withDerivedHoist(state, specs, key);
  if (isTravelKey(key)) return withDerivedTravel(state, specs, key);
  if (key === "girder" || key === "girder2") {
    return withDerivedGirder(state, specs, girderDeriveContext(all, specs, key));
  }
  return state;
}

/**
 * TÜM bölümlerin otomatik alanlarını tek geçişte tazeler.
 *
 * Bölümler `MODULE_ORDER` sırasıyla işlenir; ana kaldırma ana kirişten ÖNCE
 * geldiği için kirişin ψh katsayıları ana kaldırmanın AYNI turda güncellenmiş
 * kanca/halat ağırlıklarını görür. Hiçbir bölüm değişmediyse giriş nesnesi
 * olduğu gibi döner (referans eşitliği → gereksiz yeniden çizim yok).
 */
export function withDerivedModules(
  mods: ModulesState,
  specs: TechnicalSpecs
): ModulesState {
  let out = mods;
  for (const key of MODULE_ORDER) {
    const cur = out[key];
    if (!cur) continue;
    const next = withDerivedModule(key, cur, specs, out);
    if (next === cur) continue;
    if (out === mods) out = { ...mods };
    out[key] = next;
  }
  return out;
}

/**
 * Bölüm başına türetme uyarıları (otomatik açık ama kaynak veri eksik).
 * Alanın altında kırmızı satır olarak gösterilir.
 */
export function derivationWarnings(
  mods: ModulesState,
  specs: TechnicalSpecs
): Record<ModuleKey, DerivationWarning[]> {
  const out = {} as Record<ModuleKey, DerivationWarning[]>;
  for (const key of MODULE_ORDER) {
    const st = mods[key];
    if (!st) {
      out[key] = [];
      continue;
    }
    if (isHoistKey(key)) {
      const view = hoistSpecView(specs, key);
      out[key] = deriveHoistInputs(
        st.inputs as HoistInputs,
        st.selections as HoistSelections,
        {
          liftHeightM: view.liftHeightM,
          capacityT: view.capacityT,
          ambientTempMaxC: specs.ambientTempMaxC,
        }
      ).warnings;
    } else if (isTravelKey(key)) {
      out[key] = deriveTravelInputs(st.inputs as TravelInputs, {
        ambientTempMaxC: specs.ambientTempMaxC,
        mechanismClass: travelSpecView(specs, key, TRAVEL_VIEW_DEPS).mechanismClass,
      }).warnings;
    } else {
      out[key] = [];
    }
  }
  return out;
}

/**
 * Bir GİRDİ alanının otomatik anahtarı (yoksa alan otomatik değildir).
 * Kaldırma, yürütme ve ana kiriş aynı mekanizmayı paylaşır.
 */
export function autoInputFlag(key: ModuleKey, fieldKey: string): string | undefined {
  if (isHoistKey(key)) return HOIST_AUTO_FIELDS[fieldKey];
  if (isTravelKey(key)) return TRAVEL_AUTO_FIELDS[fieldKey];
  if (key === "girder" || key === "girder2") return GIRDER_AUTO_FIELDS[fieldKey];
  if (key === "cabin") return CABIN_AUTO_FIELDS[fieldKey];
  return undefined;
}

/**
 * Bir KATALOG SEÇİMİ alanının otomatik anahtarı. Anahtar yine GİRDİLERDE
 * durur (revision-load AUTO_FLAGS koruması girdi nesnesine bakar); türetilen
 * değer seçimlere yazılır.
 */
export function autoSelectionFlag(key: ModuleKey, fieldKey: string): string | undefined {
  if (isHoistKey(key)) return HOIST_AUTO_SELECTION_FIELDS[fieldKey];
  return undefined;
}

// ------------------------------------------------- Alternatiflerin uygunluğu
//
// Alternatif (seçenekli) ekipmanın uygunluğu TEK yerde hesaplanır: editördeki
// rozet ile PDF raporundaki "SEÇENEKLER" bloğu aynı fonksiyonu çağırır. Aynı
// sayının iki ayrı yerde hesaplanması, iki yüzeyin sessizce ayrışmasının en
// kısa yoludur; bu yüzden mantık saf bir yardımcıya çıkarılmıştır.

/**
 * Bir modülün kontrollerini VERİLEN seçim setiyle yeniden hesaplar (saf).
 *
 * Motorun `runCalc` yolundan farkı: yalnız tek modül koşar ve bağımlılıkları
 * dışarıdan (`ModuleDepsBundle`) alır — alternatif bir seçim tüm vinci
 * yeniden hesaplatmadan denenebilsin diye.
 */
export function computeModuleChecksWith(
  key: ModuleKey,
  specs: TechnicalSpecs,
  inputs: object,
  selections: object,
  deps: ModuleDepsBundle
): AnyCheck[] {
  if (isHoistKey(key)) {
    return computeHoistGroup(specs, key, inputs as never, selections as never).checks;
  }
  if (isHookBlockKey(key)) {
    return computeHookBlock(
      specs, key, inputs as never, selections as never, deps.hookBlock[key]
    ).checks;
  }
  if (isTravelKey(key)) {
    return computeTravelGroup(
      specs, key, inputs as never, selections as never, deps.travel[key]
    ).checks;
  }
  switch (key) {
    case "girder":
    case "girder2":
      return computeMainGirder(
        specs, key, inputs as never, selections as never,
        key === "girder2" ? deps.girder2 : deps.girder
      ).checks;
    case "buckling":
      return computeBuckling(inputs as never).checks;
    case "endCarriage":
      return computeEndCarriage(
        specs, inputs as never, selections as never, deps.endCarriage
      ).checks;
    case "wheelLoads":
      return computeWheelLoads(
        specs, inputs as never, selections as never, deps.wheelLoads
      ).checks;
  }
  return [];
}

/**
 * Bir alternatif seçeneğin BÖLÜM kontrollerini geçip geçmediği.
 *
 * Seçenek, bölümün seçim alanlarının bir alt kümesidir; canlı seçimlerin
 * üzerine bindirilerek modül yeniden koşturulur ve yalnız bu bölümün
 * kontrollerine bakılır. Dönüş:
 *   `true`  — bölümün tüm kontrolleri uygun
 *   `false` — en az biri uygun değil
 *   `null`  — bölümde kontrol yok ya da hesap bu seçimle koşamıyor (uydurma
 *             bir "uygun" basmaktansa bilinmez bırakılır)
 */
export function altOptionPass(
  key: ModuleKey,
  section: AdapterSection,
  specs: TechnicalSpecs,
  inputs: object,
  selections: object,
  option: Record<string, unknown>,
  deps: ModuleDepsBundle
): boolean | null {
  const prefix = ADAPTER_BY_KEY[key]?.checkPrefix;
  if (!prefix) return null;
  try {
    const all = computeModuleChecksWith(key, specs, inputs, { ...selections, ...option }, deps);
    const checks = section.checkSuffixes
      .map((suffix) => all.find((c) => c.id === `${prefix}${suffix}`))
      .filter((c): c is AnyCheck => Boolean(c));
    if (checks.length === 0) return null;
    return checks.every((c) => c.pass);
  } catch {
    return null;
  }
}

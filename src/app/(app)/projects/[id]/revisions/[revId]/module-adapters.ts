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
  HOIST_INPUT_FIELDS,
  HOIST_SELECTION_FIELDS,
} from "@/lib/calc/fields";
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
  BUCKLING_EXTRA_FIELDS,
  BUCKLING_PANEL_FIELDS,
  ENDCARRIAGE_INPUT_FIELDS,
  ENDCARRIAGE_SELECTION_FIELDS,
  GIRDER_INPUT_FIELDS,
  GIRDER_SELECTION_FIELDS,
} from "@/lib/calc/presentation/structuralFields";
import { bridgeTrolleyWeightT } from "@/lib/calc/engine";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { hookBlockDepsFromHoist, type HookBlockDeps } from "@/lib/calc/modules/hookBlock";
import type { TravelDeps } from "@/lib/calc/modules/travelGroup";
import type { GirderDeps } from "@/lib/calc/modules/mainGirder";
import type { EndCarriageDeps } from "@/lib/calc/modules/endCarriage";
import type { TechnicalSpecs } from "@/lib/calc/types";
import { hasSeparateAuxTrolley, monorailCount } from "@/lib/calc/types";
import {
  HOIST_OF_HOOKBLOCK,
  MODULE_ORDER,
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
  /** select değerleri sayısal alana yazılır */
  numeric?: boolean;
  /** select seçeneklerinin gösterim etiketi */
  optionLabels?: Record<string, string>;
  /** Standart referansı (standards/registry.ts anahtarı) */
  standardRef?: string;
  /** Alanın altında gösterilecek kısa açıklama */
  hint?: string;
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
  unit?: string;
  digits?: number;
  standard?: string;
  read: (ctx: unknown) => number | string | undefined;
  subst?: (ctx: unknown) => string;
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

export interface ModuleAdapter {
  key: ModuleKey;
  /** Kenar çubuğu / kart başlığı ("02 · Ana Kaldırma") */
  title: string;
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

function defs(keys: readonly string[], map: Map<string, AnyFieldDef>): AnyFieldDef[] {
  return keys
    .map((k) => map.get(k))
    .filter((f): f is AnyFieldDef => Boolean(f));
}

// ---------------------------------------------------------------- Kaldırma

/** Kaldırma grubu başlıkları — numara çalışma anında yeniden dizilir. */
const HOIST_TITLES: Record<HoistKey, string> = {
  main: "Ana Kaldırma",
  aux: "Yardımcı Kaldırma",
  mono1: "Monoray 1 Kaldırma",
  mono2: "Monoray 2 Kaldırma",
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
      checkSuffixes: s.checkSuffixes,
      visible: s.visible ? (specs: TechnicalSpecs) => s.visible!(specs, which) : undefined,
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
          read: (ctx: unknown) => (ctx as HoistCtx).c[r.key],
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
};

const TRAVEL_TITLES: Record<TravelKey, string> = {
  trolley: "Ana Araba Yürütme",
  auxTrolley: "Yardımcı Araba Yürütme",
  mono1Trolley: "Monoray 1 Araba Yürütme",
  mono2Trolley: "Monoray 2 Araba Yürütme",
  bridge: "Köprü Yürütme",
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
      title: s.title,
      description: s.description,
      inputDefs: defs(s.inputKeys, TRAVEL_INPUT_MAP),
      selectionDefs: defs(s.selectionKeys, TRAVEL_SELECTION_MAP),
      selectionKeys: s.selectionKeys,
      checkSuffixes: s.checkSuffixes,
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
          return {
            key: r.key,
            anchorId: r.key,
            label: r.label,
            formula: r.formula,
            unit: r.unit,
            digits: r.digits,
            standard: r.standard,
            read: (ctx: unknown) => (ctx as TravelCtx).c[r.key],
            subst: sub ? (ctx: unknown) => sub(ctx as TravelCtx) : undefined,
          };
        }),
    })),
  };
}

// ---------------------------------------------------------------- Ana kiriş

function girderAdapter(): ModuleAdapter {
  return {
    key: "girder",
    title: "07 · Ana Kiriş",
    checkPrefix: "girder.",
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
          read: (ctx: unknown) => (ctx as EndCarriageCtx).c[r.key],
          subst: sub ? (ctx: unknown) => sub(ctx as EndCarriageCtx) : undefined,
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
  girder: girderAdapter,
  buckling: bucklingAdapter,
  endCarriage: endCarriageAdapter,
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
  "girder",
  "buckling",
  "endCarriage",
];

/**
 * Vinç konfigürasyonundan (teknik özellikler) türeyen bölümler: kullanıcı
 * bunları tek tek açıp kapatmaz, konfigürasyon alanını değiştirir.
 * Anahtar → o bölümün görünür olması için gereken koşul.
 */
export const CONFIG_DRIVEN_MODULE_KEYS: readonly ModuleKey[] = [
  "auxTrolley",
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
    default:
      return true;
  }
}

/**
 * Bölüm bir üst bölüme bağlıysa onun anahtarı. Üst bölüm kapalıysa alt bölüm de
 * hesaba girmez (yardımcı kaldırma kapalıyken yardımcı kanca bloğu olamaz).
 */
export const MODULE_PARENT: Partial<Record<ModuleKey, ModuleKey>> = {
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
  girder: "Ana Kiriş",
  buckling: "Buruşma",
  endCarriage: "Başkiriş",
};

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
  girder: GirderDeps;
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
  const travel = {} as Record<TravelKey, TravelDeps>;
  for (const key of Object.keys(HOIST_OF_TRAVEL) as TravelKey[]) {
    travel[key] = {
      hookEquipmentT: hookEquipmentT(HOIST_OF_TRAVEL[key]),
      trolleyWeightT: bridgeTrolleyT,
    };
  }

  return {
    hookBlock,
    travel,
    girder: {
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
    },
    endCarriage: {
      mainHoistTotalLoadKg: result.mainHoist?.values.totalLoadKg ?? 0,
      trolleyWeightT: bridgeTrolleyT,
      bridgeWeightT: specs.bridgeWeightT,
    },
  };
}

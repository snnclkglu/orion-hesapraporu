// Revizyon editörü modül adaptörleri.
// Her hesap modülünün sunum katmanı (hoistSections, hookBlockSections, ...)
// kendi Ctx/RowDef tipini taşır; bu dosya hepsini editörün tek tip
// AdapterSection/AdapterRow sözleşmesine indirger. Böylece sihirbaz tek bir
// jenerik bölüm kartı deseniyle 01..09 tüm modülleri çizer.
//
// Bölüm numaraları: ana kaldırma 2.x, yardımcı 3.x (2.x'ten çevrilir),
// kanca bloğu 4.x, araba 5.x, köprü 6.x (travel 5.x id'lerinden çevrilir;
// 5.5b fren bölümü Excel'de 6.6'dır ve sonrakiler +1 kayar), ana kiriş 7.x,
// buruşma 8.x, başkiriş 9.x.

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
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import { hookBlockDepsFromHoist, type HookBlockDeps } from "@/lib/calc/modules/hookBlock";
import type { TravelDeps } from "@/lib/calc/modules/travelGroup";
import type { GirderDeps } from "@/lib/calc/modules/mainGirder";
import type { EndCarriageDeps } from "@/lib/calc/modules/endCarriage";

// ---------------------------------------------------------------- Tipler

export type ModuleKey =
  | "main"
  | "aux"
  | "hookBlock"
  | "trolley"
  | "bridge"
  | "girder"
  | "buckling"
  | "endCarriage";

/** Alan tanımlarının modülden bağımsız (gevşetilmiş) hali — FieldDef<T> ile
 *  yapısal uyumludur; keyof T'nin kontravaryansından kaçınmak için ayrı tanımlıdır. */
export interface AnyFieldDef {
  key: string;
  label: string;
  unit?: string;
  type: "number" | "text" | "select";
  options?: readonly string[];
  excelCell?: string;
}

export interface AdapterRow {
  key: string;
  label: string;
  formula?: string;
  unit?: string;
  digits?: number;
  standard?: string;
  /** Excel hücre referansı; null → temiz yeniden yazım (Excel'de sağlam hücre yok) */
  excelRef: string | null;
  read: (ctx: unknown) => number | string | undefined;
  subst?: (ctx: unknown) => string;
}

export interface AdapterSection {
  /** Görünen bölüm numarası (yardımcıda 3.x, köprüde 6.x) */
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
}

export interface ModuleAdapter {
  key: ModuleKey;
  /** Kenar çubuğu / kart başlığı ("02 · Ana Kaldırma") */
  title: string;
  /** Kontrol id öneki ("main.", "hookBlock.", ...) */
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

// ---------------------------------------------------------------- Kaldırma (02/03)

function hoistAdapter(which: "main" | "aux"): ModuleAdapter {
  return {
    key: which,
    title: which === "main" ? "02 · Ana Kaldırma" : "03 · Yrd Kaldırma",
    checkPrefix: `${which}.`,
    sections: HOIST_SECTIONS.map((s) => ({
      id: which === "aux" ? s.id.replace(/^2/, "3") : s.id,
      rawId: s.id,
      title: s.title,
      description: s.description,
      inputDefs: defs(s.inputKeys, HOIST_INPUT_MAP),
      selectionDefs: defs(s.selectionKeys, HOIST_SELECTION_MAP),
      selectionKeys: s.selectionKeys,
      checkSuffixes: s.checkSuffixes,
      rows: s.rows.map((r) => {
        const sub = r.subst;
        return {
          key: r.cell,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          standard: r.standard,
          excelRef: r.cell,
          read: (ctx: unknown) => (ctx as HoistCtx).c[r.cell],
          subst: sub ? (ctx: unknown) => sub(ctx as HoistCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Kanca bloğu (04)

function hookBlockAdapter(): ModuleAdapter {
  return {
    key: "hookBlock",
    title: "04 · Kanca Bloğu",
    checkPrefix: "hookBlock.",
    sections: HOOKBLOCK_SECTIONS.map((s) => ({
      id: s.id,
      rawId: s.id,
      title: s.title,
      description: s.description,
      inputDefs: defs(s.inputKeys, HOOKBLOCK_INPUT_MAP),
      selectionDefs: defs(s.selectionKeys, HOOKBLOCK_SELECTION_MAP),
      selectionKeys: s.selectionKeys,
      checkSuffixes: s.checkSuffixes,
      rows: s.rows.map((r, i) => {
        const sub = r.subst;
        const valueFrom = r.valueFrom;
        const cell = r.cell;
        return {
          key: cell ?? `rw-${s.id}-${i}`,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          standard: r.standard,
          // valueFrom satırları Excel'in bozuk hücrelerinin yeniden yazımıdır
          excelRef: cell && !r.nonExcel ? cell : null,
          read: (ctx: unknown) =>
            cell !== undefined
              ? (ctx as HookBlockCtx).c[cell]
              : valueFrom?.(ctx as HookBlockCtx),
          subst: sub ? (ctx: unknown) => sub(ctx as HookBlockCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Yürütme (05/06)

/** Travel 5.x id'lerinin köprü (06) numaraları — 5.5b = Excel 6.6, sonrakiler +1 kayar */
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

function travelAdapter(which: "trolley" | "bridge"): ModuleAdapter {
  const isBridge = which === "bridge";
  return {
    key: which,
    title: isBridge ? "06 · Köprü Yürütme" : "05 · Araba Yürütme",
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
      rows: s.rows
        // Köprüde adresi olmayan satırlar sadece araba sayfasında hücrelidir
        .filter((r) => !isBridge || r.bridgeCell !== undefined)
        .map((r) => {
          const sub = r.subst;
          const cell = isBridge ? r.bridgeCell! : r.cell;
          return {
            key: cell,
            label: r.label,
            formula: r.formula,
            unit: r.unit,
            digits: r.digits,
            standard: r.standard,
            excelRef: cell,
            read: (ctx: unknown) => (ctx as TravelCtx).c[cell],
            subst: sub ? (ctx: unknown) => sub(ctx as TravelCtx) : undefined,
          };
        }),
    })),
  };
}

// ---------------------------------------------------------------- Ana kiriş (07)

function girderAdapter(): ModuleAdapter {
  return {
    key: "girder",
    title: "07 · Ana Kiriş",
    checkPrefix: "girder.",
    // depKeys motor tarafından otomatik bağlanır; UI'da gösterilmez.
    sections: GIRDER_SECTIONS.map((s) => ({
      id: s.id,
      rawId: s.id,
      title: s.title,
      description: s.description,
      inputDefs: defs(s.inputKeys, GIRDER_INPUT_MAP),
      selectionDefs: defs(s.selectionKeys, GIRDER_SELECTION_MAP),
      selectionKeys: s.selectionKeys,
      checkSuffixes: s.checkSuffixes,
      rows: s.rows.map((r) => {
        const sub = r.subst;
        return {
          key: r.cell,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          standard: r.standard,
          excelRef: r.cell,
          read: (ctx: unknown) => (ctx as GirderCtx).c[r.cell],
          subst: sub ? (ctx: unknown) => sub(ctx as GirderCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Buruşma (08)

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
        get: (inputs: object) =>
          (inputs as Record<string, object>)[s.panel] ?? {},
        set: (inputs: object, next: object) => ({ ...inputs, [s.panel]: next }),
      },
      // L54 (düzeltilmiş kritik gerilme) kök inputs alanıdır; sadece yan sacda
      extraInputDefs: s.panel === "side" ? [...BUCKLING_EXTRA_FIELDS] : undefined,
      selectionDefs: [],
      selectionKeys: [],
      checkSuffixes: s.checkSuffixes,
      rows: s.rows.map((r) => {
        const sub = r.subst;
        return {
          key: r.cell,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          standard: r.standard,
          excelRef: r.cell,
          read: (ctx: unknown) => (ctx as BucklingCtx).c[r.cell],
          subst: sub ? (ctx: unknown) => sub(ctx as BucklingCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Başkiriş (09)

function endCarriageAdapter(): ModuleAdapter {
  return {
    key: "endCarriage",
    title: "09 · Başkiriş",
    checkPrefix: "endCarriage.",
    // depKeys motor tarafından otomatik bağlanır; UI'da gösterilmez.
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
        // "fatigue.*" anahtarları Excel'in bozuk bloğunun yeniden yazımıdır
        const isRewrite = r.cell.startsWith("fatigue.");
        return {
          key: r.cell,
          label: r.label,
          formula: r.formula,
          unit: r.unit,
          digits: r.digits,
          standard: r.standard,
          excelRef: isRewrite ? null : r.cell,
          read: (ctx: unknown) => (ctx as EndCarriageCtx).c[r.cell],
          subst: sub ? (ctx: unknown) => sub(ctx as EndCarriageCtx) : undefined,
        };
      }),
    })),
  };
}

// ---------------------------------------------------------------- Dışa aktarım

/** Sihirbaz adım sırası: 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 */
export const MODULE_ADAPTERS: ModuleAdapter[] = [
  hoistAdapter("main"),
  hoistAdapter("aux"),
  hookBlockAdapter(),
  travelAdapter("trolley"),
  travelAdapter("bridge"),
  girderAdapter(),
  bucklingAdapter(),
  endCarriageAdapter(),
];

export const ADAPTER_BY_KEY: Record<ModuleKey, ModuleAdapter> = Object.fromEntries(
  MODULE_ADAPTERS.map((a) => [a.key, a])
) as Record<ModuleKey, ModuleAdapter>;

// ---------------------------------------------------------------- Deps üretimi

/**
 * Modüller arası bağımlılıklar — runCalc'taki bağlama mantığının editör tarafı
 * karşılığı (alternatif hesapları ve sunum ctx'leri için). Motor dosyalarına
 * dokunmadan aynı kaynaklardan okunur.
 */
export interface ModuleDepsBundle {
  hookBlock: HookBlockDeps;
  /** Araba ve köprü aynı deps'i kullanır (Excel 05!L6 / 06!L5 kaynakları) */
  travel: TravelDeps;
  girder: GirderDeps;
  endCarriage: EndCarriageDeps;
}

const num = (v: number | string | undefined, fallback = 0): number =>
  typeof v === "number" ? v : fallback;

export function buildModuleDeps(input: CalcInput, result: CalcResult): ModuleDepsBundle {
  const main = input.mainHoist!;
  const trolley = input.trolley!;
  const bridge = input.bridge!;
  const hookEquipmentT = (main.inputs.hookBlockWeightKg + main.inputs.ropeWeightKg) / 1000;

  return {
    hookBlock: hookBlockDepsFromHoist({
      values: result.mainHoist!.values,
      inputs: main.inputs,
      selections: main.selections,
    }),
    travel: {
      hookEquipmentT,
      trolleyWeightT: trolley.inputs.trolleyWeightT,
    },
    girder: {
      mainHookBlockWeightKg: main.inputs.hookBlockWeightKg,          // 02!L14
      mainRopeWeightKg: main.inputs.ropeWeightKg,                    // 02!L15
      trolleyWeightT: trolley.inputs.trolleyWeightT,                 // 05!L5
      trolleyWheelCount: trolley.inputs.wheelCount,                  // 05!L10
      trolleyActualSpeedMpm: num(result.trolley?.cells.L109),        // 05!L109
      trolleyAccelTimeS: num(result.trolley?.cells.L110),            // 05!L110
      bridgeGirdersWeightT: bridge.inputs.bridgeWeightT,             // 06!L6
      bridgeEndCarriagesWeightT: bridge.inputs.otherWeightsT,        // 06!L7
      bridgeWheelCount: bridge.inputs.wheelCount,                    // 06!L14
      bridgeActualSpeedMpm: num(result.bridge?.cells.L115),          // 06!L115
      bridgeAccelTimeS: num(result.bridge?.cells.L117),              // 06!L117
    },
    endCarriage: {
      mainHoistTotalLoadKg: result.mainHoist!.values.totalLoadKg,    // 02!L16
      trolleyWeightT: trolley.inputs.trolleyWeightT,                 // 06!L5
      bridgeGirdersWeightT: bridge.inputs.bridgeWeightT,             // 06!L6
      bridgeEndCarriagesWeightT: bridge.inputs.otherWeightsT,        // 06!L7
    },
  };
}

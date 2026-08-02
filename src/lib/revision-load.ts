// Revizyon snapshot'ından (inputs/selections jsonb) CalcInput kurar.
// Boş alanlar V5 şablonuyla doldurulur — editör, PDF ve Excel çıktıları
// aynı yükleyiciyi kullanır.
//
// Kapatılmış hesap bölümleri: kullanıcı bir bölümü (ör. başkiriş) kapattığında
// o bölüm hesaba ve rapora GİRMEZ, ama girdileri KORUNUR — bölüm yeniden
// açıldığında elle ayarlanmış değerler geri gelir. Kapalı bölümlerin listesi
// `inputs.disabledModules` içinde tutulur.

import { NEW_WORK_TEMPLATE as V5_TEMPLATE } from "@/lib/calc/defaults";
import type { CalcInput } from "@/lib/calc/engine";
import type { ModuleKey } from "@/lib/calc/presentation/module-family";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { HookBlockInputs, HookBlockSelections } from "@/lib/calc/modules/hookBlock";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderInputs, GirderSelections } from "@/lib/calc/modules/mainGirder";
import type { BucklingInputs } from "@/lib/calc/modules/buckling";
import type { EndCarriageInputs, EndCarriageSelections } from "@/lib/calc/modules/endCarriage";
import type { TechnicalSpecs } from "@/lib/calc/types";

export interface RevisionInputsJson {
  specs?: TechnicalSpecs;
  mainHoist?: HoistInputs | null;
  auxHoist?: HoistInputs | null;
  hookBlock?: HookBlockInputs | null;
  trolley?: TravelInputs | null;
  bridge?: TravelInputs | null;
  girder?: GirderInputs | null;
  buckling?: BucklingInputs | null;
  endCarriage?: EndCarriageInputs | null;
  /** Kullanıcının kapattığı hesap bölümleri (hesaba ve rapora girmez) */
  disabledModules?: string[] | null;
}

export interface RevisionSelectionsJson {
  mainHoist?: HoistSelections | null;
  auxHoist?: HoistSelections | null;
  hookBlock?: HookBlockSelections | null;
  trolley?: TravelSelections | null;
  bridge?: TravelSelections | null;
  girder?: GirderSelections | null;
  endCarriage?: EndCarriageSelections | null;
  alts?: Record<string, { active: number; options: Record<string, unknown>[] }>;
}

/** Kapatılabilen bölümler — ana kaldırma/araba/köprü diğerlerini besler. */
export const DISABLEABLE_MODULES = [
  "aux",
  "hookBlock",
  "girder",
  "buckling",
  "endCarriage",
] as const satisfies readonly ModuleKey[];

export interface LoadedRevision {
  /** Hesaba giren girdi seti — kapalı bölümler yoktur */
  input: CalcInput;
  /** Tüm bölümlerin verisi — editör kapalı bölümü tekrar açabilsin diye */
  full: CalcInput;
  /** Kapalı bölümler */
  disabled: ModuleKey[];
}

/**
 * Bir bölüm kapalı mı: önce açık liste (`disabledModules`), yoksa eski kayıt
 * kuralı (anahtar var ve değeri null).
 */
function disabledSet(inputs: RevisionInputsJson | null): Set<ModuleKey> {
  const out = new Set<ModuleKey>();
  const list = inputs?.disabledModules;
  if (Array.isArray(list)) {
    for (const k of list) {
      if ((DISABLEABLE_MODULES as readonly string[]).includes(k)) out.add(k as ModuleKey);
    }
    return out;
  }
  // Eski kayıtlar: kapalı bölüm null olarak saklanmıştı
  const legacy: Record<ModuleKey, keyof RevisionInputsJson> = {
    aux: "auxHoist",
    hookBlock: "hookBlock",
    girder: "girder",
    buckling: "buckling",
    endCarriage: "endCarriage",
    main: "mainHoist",
    trolley: "trolley",
    bridge: "bridge",
  };
  for (const k of DISABLEABLE_MODULES) {
    const field = legacy[k];
    if (inputs && field in inputs && inputs[field] === null) out.add(k);
  }
  return out;
}

/**
 * Kayıtta olmayan alanları şablondan tamamlar (şema evrimi güvenliği).
 * Motora yeni bir girdi eklendiğinde eski revizyonlar `undefined` yerine
 * şablon değerini görür — hesap NaN'a düşmez.
 */
function withDefaults<T extends object>(stored: T | null | undefined, template: T): T {
  if (!stored || typeof stored !== "object") return template;
  return { ...template, ...stored };
}

/** Tüm bölümleri (kapalılar dâhil) şablonla tamamlanmış olarak kurar. */
function fullInput(
  inputs: RevisionInputsJson | null,
  selections: RevisionSelectionsJson | null
): CalcInput {
  return {
    specs: withDefaults(inputs?.specs, V5_TEMPLATE.specs),
    mainHoist: {
      inputs: withDefaults(inputs?.mainHoist, V5_TEMPLATE.mainHoist!.inputs),
      selections: withDefaults(selections?.mainHoist, V5_TEMPLATE.mainHoist!.selections),
    },
    auxHoist: {
      inputs: withDefaults(inputs?.auxHoist, V5_TEMPLATE.auxHoist!.inputs),
      selections: withDefaults(selections?.auxHoist, V5_TEMPLATE.auxHoist!.selections),
    },
    hookBlock: {
      inputs: withDefaults(inputs?.hookBlock, V5_TEMPLATE.hookBlock!.inputs),
      selections: withDefaults(selections?.hookBlock, V5_TEMPLATE.hookBlock!.selections),
    },
    trolley: {
      inputs: withDefaults(inputs?.trolley, V5_TEMPLATE.trolley!.inputs),
      selections: withDefaults(selections?.trolley, V5_TEMPLATE.trolley!.selections),
    },
    bridge: {
      inputs: withDefaults(inputs?.bridge, V5_TEMPLATE.bridge!.inputs),
      selections: withDefaults(selections?.bridge, V5_TEMPLATE.bridge!.selections),
    },
    girder: {
      inputs: withDefaults(inputs?.girder, V5_TEMPLATE.girder!.inputs),
      selections: withDefaults(selections?.girder, V5_TEMPLATE.girder!.selections),
    },
    buckling: {
      inputs: withDefaults(inputs?.buckling, V5_TEMPLATE.buckling!.inputs),
    },
    endCarriage: {
      inputs: withDefaults(inputs?.endCarriage, V5_TEMPLATE.endCarriage!.inputs),
      selections: withDefaults(selections?.endCarriage, V5_TEMPLATE.endCarriage!.selections),
    },
  };
}

/** Modül anahtarı → CalcInput alan adı (kapatma için). */
const CALC_FIELD: Record<(typeof DISABLEABLE_MODULES)[number], keyof CalcInput> = {
  aux: "auxHoist",
  hookBlock: "hookBlock",
  girder: "girder",
  buckling: "buckling",
  endCarriage: "endCarriage",
};

export function loadRevision(
  inputs: RevisionInputsJson | null,
  selections: RevisionSelectionsJson | null
): LoadedRevision {
  const full = fullInput(inputs, selections);
  const disabled = [...disabledSet(inputs)];
  const input: CalcInput = { ...full };
  for (const key of disabled) {
    const field = CALC_FIELD[key as (typeof DISABLEABLE_MODULES)[number]];
    // Kapalı bölüm hesaba girmez: alanı sil (undefined ata).
    if (field) delete (input as unknown as Record<string, unknown>)[field];
  }
  return { input, full, disabled };
}

/** Hesaba giren girdi seti (kapalı bölümler hariç). */
export function calcInputFromRevision(
  inputs: RevisionInputsJson | null,
  selections: RevisionSelectionsJson | null
): CalcInput {
  return loadRevision(inputs, selections).input;
}

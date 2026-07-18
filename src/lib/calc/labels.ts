// Alan etiketi haritası — revizyon karşılaştırma ve raporlar için.
// Tüm modüllerin FieldDef listelerinden anahtar -> {label, unit} üretir.

import { HOIST_INPUT_FIELDS, HOIST_SELECTION_FIELDS, SPEC_FIELDS } from "./fields";
import { HOOKBLOCK_INPUT_FIELDS, HOOKBLOCK_SELECTION_FIELDS } from "./presentation/hookBlockFields";
import { TRAVEL_INPUT_FIELDS, TRAVEL_SELECTION_FIELDS } from "./presentation/travelFields";
import {
  BUCKLING_EXTRA_FIELDS,
  BUCKLING_PANEL_FIELDS,
  ENDCARRIAGE_INPUT_FIELDS,
  ENDCARRIAGE_SELECTION_FIELDS,
  GIRDER_INPUT_FIELDS,
  GIRDER_SELECTION_FIELDS,
} from "./presentation/structuralFields";

export interface FieldLabel {
  label: string;
  unit?: string;
}

function collect(lists: { key: string; label: string; unit?: string }[][]): Map<string, FieldLabel> {
  const map = new Map<string, FieldLabel>();
  for (const list of lists) {
    for (const f of list) {
      if (!map.has(f.key)) map.set(f.key, { label: f.label, unit: f.unit });
    }
  }
  return map;
}

/** Alan anahtarı -> Türkçe etiket (+birim). Modüller arası anahtar çakışmasında ilk kazanır. */
export const FIELD_LABELS: Map<string, FieldLabel> = collect([
  SPEC_FIELDS,
  HOIST_INPUT_FIELDS,
  HOIST_SELECTION_FIELDS,
  HOOKBLOCK_INPUT_FIELDS,
  HOOKBLOCK_SELECTION_FIELDS,
  TRAVEL_INPUT_FIELDS,
  TRAVEL_SELECTION_FIELDS,
  GIRDER_INPUT_FIELDS,
  GIRDER_SELECTION_FIELDS,
  BUCKLING_PANEL_FIELDS,
  BUCKLING_EXTRA_FIELDS,
  ENDCARRIAGE_INPUT_FIELDS,
  ENDCARRIAGE_SELECTION_FIELDS,
] as { key: string; label: string; unit?: string }[][]);

/** Modül anahtarı -> görünen ad (karşılaştırma/özet/rapor başlıkları) */
export const MODULE_LABELS: Record<string, string> = {
  specs: "01 · Teknik Özellikler",
  mainHoist: "02 · Ana Kaldırma",
  auxHoist: "03 · Yrd Kaldırma",
  hookBlock: "04 · Kanca Bloğu",
  trolley: "05 · Araba Yürütme",
  bridge: "06 · Köprü Yürütme",
  girder: "07 · Ana Kiriş",
  buckling: "08 · Buruşma Kontrolü",
  endCarriage: "09 · Başkiriş",
};

export function fieldLabel(key: string): FieldLabel {
  return FIELD_LABELS.get(key) ?? { label: key };
}

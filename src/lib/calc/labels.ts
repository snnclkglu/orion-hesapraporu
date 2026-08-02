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

/**
 * Modül anahtarı -> görünen ad (karşılaştırma/özet/rapor başlıkları).
 *
 * Anahtarlar motorun modül anahtarlarıdır (`CalcInput` alanları); sıra
 * karşılaştırma ekranının bölüm sırasıdır. Baştaki numaralar YALNIZCA yedek
 * etikettir: gerçek numaralandırma, kapatılan/olmayan modüllere göre çalışma
 * anında yeniden dizilir (bkz. `moduleDisplayNumbers`).
 */
export const MODULE_LABELS: Record<string, string> = {
  specs: "01 · Teknik Özellikler",
  main: "02 · Ana Kaldırma",
  hookBlock: "03 · Ana Kanca Bloğu",
  aux: "04 · Yardımcı Kaldırma",
  auxHookBlock: "05 · Yardımcı Kanca Bloğu",
  trolley: "06 · Ana Araba Yürütme",
  auxTrolley: "07 · Yardımcı Araba Yürütme",
  mono1: "08 · Monoray 1 Kaldırma",
  mono1HookBlock: "09 · Monoray 1 Kanca Bloğu",
  mono1Trolley: "10 · Monoray 1 Araba Yürütme",
  mono2: "11 · Monoray 2 Kaldırma",
  mono2HookBlock: "12 · Monoray 2 Kanca Bloğu",
  mono2Trolley: "13 · Monoray 2 Araba Yürütme",
  bridge: "14 · Köprü Yürütme",
  girder: "15 · Ana Kiriş",
  buckling: "16 · Buruşma",
  endCarriage: "17 · Başkiriş",
  // Revizyon karşılaştırması snapshot'ın JSON alan adlarını kullanır; kaldırma
  // gruplarında bu ad modül anahtarından farklıdır (`main` → `mainHoist`).
  mainHoist: "02 · Ana Kaldırma",
  auxHoist: "04 · Yardımcı Kaldırma",
  mono1Hoist: "08 · Monoray 1 Kaldırma",
  mono2Hoist: "11 · Monoray 2 Kaldırma",
};

/** Alan listelerinde yer almayan, yalnız karşılaştırmada görünen anahtarlar. */
const EXTRA_LABELS: Record<string, FieldLabel> = {
  disabledModules: { label: "Kapatılan Hesap Bölümleri" },
  ropeWeightAuto: { label: "Halat Ağırlığı Otomatik" },
  hookBlockWeightAuto: { label: "Kanca Bloğu Ağırlığı Otomatik" },
  tempFactorAuto: { label: "Sıcaklık Faktörü Otomatik" },
};

export function fieldLabel(key: string): FieldLabel {
  return FIELD_LABELS.get(key) ?? EXTRA_LABELS[key] ?? { label: key };
}

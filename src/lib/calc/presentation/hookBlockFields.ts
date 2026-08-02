// Kanca bloğu form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler motor tiplerinin (HookBlockInputs, HookBlockSelections) alan
// adlarıyla birebir aynıdır.

import type { FieldDef } from "../fields";
import {
  HOOK_NUMBERS,
  HOOK_STRENGTH_CLASSES,
  HOOK_STRENGTH_CLASS_INFO,
} from "../hook-table";
import type { HookBlockInputs, HookBlockSelections } from "../modules/hookBlock";

/** "S" → "S — Rm ≥ 630 N/mm²" biçiminde açıklamalı etiketler */
const HOOK_CLASS_LABELS: Record<string, string> = Object.fromEntries(
  HOOK_STRENGTH_CLASSES.map((c) => [c, `${c} — ${HOOK_STRENGTH_CLASS_INFO[c]}`])
);

export const HOOK_SHAFT_MATERIALS = ["S355JR", "C25", "C30", "C35", "C45", "4140+QT", "4140"] as const;
export const FATIGUE_MATERIALS = ["S235JR", "S355JR"] as const;
export const NOTCH_CLASSES = ["W0", "W1", "W2", "K0", "K1", "K2", "K3", "K4"] as const;
export const LOAD_GROUPS = ["B1", "B2", "B3", "B4", "B5", "B6"] as const;

export const HOOKBLOCK_INPUT_FIELDS: FieldDef<HookBlockInputs>[] = [
  { key: "shaftEdgeGapCm", label: "A · Yan sac → ilk makara", unit: "cm", type: "number", hint: "Mesnet ekseninden ilk makara eksenine." },
  { key: "shaftSheavePitchCm", label: "B · Makara adımı (küme içi)", unit: "cm", type: "number" },
  { key: "shaftCenterGapCm", label: "D · Kümeler arası orta boşluk", unit: "cm", type: "number", hint: "Kanca sapının geçtiği boşluk; 2 makarada iki makara arası." },
  { key: "shaftD1Cm", label: "D1 · Mil çapı", unit: "cm", type: "number" },
  { key: "girderSpanMm", label: "Kiriş açıklığı a", unit: "mm", type: "number" },
  { key: "loadOffsetMm", label: "Yük mesafesi b", unit: "mm", type: "number" },
  { key: "midTopPlateThkMm", label: "Orta kesit üst sac kalınlığı", unit: "mm", type: "number" },
  { key: "midTopPlateWidthMm", label: "Orta kesit üst sac genişliği", unit: "mm", type: "number" },
  { key: "midWebPlateThkMm", label: "Orta kesit yan sac kalınlığı", unit: "mm", type: "number" },
  { key: "midWebPlateHeightMm", label: "Orta kesit yan sac yüksekliği", unit: "mm", type: "number" },
  { key: "midBottomPlateThkMm", label: "Orta kesit alt sac kalınlığı", unit: "mm", type: "number" },
  { key: "midBottomPlateWidthMm", label: "Orta kesit alt sac genişliği", unit: "mm", type: "number" },
  { key: "thickTopPlateThkMm", label: "Kalın kesit üst sac kalınlığı", unit: "mm", type: "number" },
  { key: "thickTopPlateWidthMm", label: "Kalın kesit üst sac genişliği", unit: "mm", type: "number" },
  { key: "thickWebPlateThkMm", label: "Kalın kesit yan sac kalınlığı", unit: "mm", type: "number" },
  { key: "thickWebPlateHeightMm", label: "Kalın kesit yan sac yüksekliği", unit: "mm", type: "number" },
  { key: "thickBottomPlateThkMm", label: "Kalın kesit alt sac kalınlığı", unit: "mm", type: "number" },
  { key: "thickBottomPlateWidthMm", label: "Kalın kesit alt sac genişliği", unit: "mm", type: "number" },
  { key: "loadGroup", label: "Yük sınıfı", type: "select", options: LOAD_GROUPS, standardRef: "DIN 15018 Tablo 17" },
  { key: "notchClass", label: "Kaynak / çentik sınıfı", type: "select", options: NOTCH_CLASSES, standardRef: "DIN 15018 Tablo 17" },
  { key: "fatigueMaterial", label: "Kiriş malzemesi (yorulma)", type: "select", options: FATIGUE_MATERIALS },
  // ψ katsayıları normalde teknik özelliklerdeki kaldırma sınıfından türetilir;
  // aşağıdaki iki alan yalnız projeye özel gerekçe varsa doldurulur.
  {
    key: "dynamicFactorKOverride", label: "ψ katsayısı k (elle ezme)", type: "number",
    standardRef: "DIN 15018 Tablo 2",
    hint: "Boş bırakılırsa kaldırma sınıfından türetilir (H1:1,1 · H2:1,2 · H3:1,3 · H4:1,4).",
  },
  {
    key: "dynamicFactorLOverride", label: "ψ katsayısı l (elle ezme)", type: "number",
    standardRef: "DIN 15018 Tablo 2",
    hint: "Boş bırakılırsa kaldırma sınıfından türetilir (H1:0,0022 · H2:0,0044 · H3:0,0066 · H4:0,0088).",
  },
];

export const HOOKBLOCK_SELECTION_FIELDS: FieldDef<HookBlockSelections>[] = [
  { key: "hookDesignation", label: "Kanca tanımı", type: "text" },
  { key: "hookNumber", label: "Kanca numarası", type: "select", options: HOOK_NUMBERS, standardRef: "DIN 15400" },
  { key: "hookStrengthClass", label: "Kanca malzeme sınıfı", type: "select", options: HOOK_STRENGTH_CLASSES, optionLabels: HOOK_CLASS_LABELS, standardRef: "DIN 15400" },
  { key: "hookCapacityKg", label: "Kanca kapasitesi (tablo dışıysa)", unit: "kg", type: "number", hint: "Kanca no + malzeme sınıfı seçiliyse kapasite DIN 15400 Tablo 3'ten okunur." },
  { key: "sheaveDiaMm", label: "Halat ekseninde makara çapı", unit: "mm", type: "number" },
  { key: "sheaveBearingType", label: "Makara rulmanı tipi", type: "text" },
  { key: "sheaveBearingCode", label: "Makara rulmanı kodu", type: "text" },
  { key: "sheaveBearingDynCKn", label: "Makara rulmanı dinamik yük C", unit: "kN", type: "number" },
  { key: "sheaveBearingStatC0Kn", label: "Makara rulmanı statik yük C0", unit: "kN", type: "number" },
  { key: "sheaveBearingBoreMm", label: "Makara rulmanı iç çapı", unit: "mm", type: "number", hint: "Mil çapı D1 ile eşleşmelidir." },
  { key: "shaftMaterial", label: "Mil malzemesi", type: "select", options: HOOK_SHAFT_MATERIALS },
  { key: "hookBearingType", label: "Kanca rulmanı tipi", type: "text" },
  { key: "hookBearingCode", label: "Kanca rulmanı kodu", type: "text" },
  { key: "hookBearingStatC0Kn", label: "Kanca rulmanı statik yük C0", unit: "kN", type: "number" },
];

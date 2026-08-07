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
  { key: "shaftEdgeGapCm", label: "A · Yan Sac → İlk Makara", unit: "cm", type: "number", hint: "Mesnet ekseninden ilk makara eksenine." },
  { key: "shaftSheavePitchCm", label: "B · Makara Adımı (Küme İçi)", unit: "cm", type: "number" },
  { key: "shaftCenterGapCm", label: "D · Kümeler Arası Orta Boşluk", unit: "cm", type: "number", hint: "Kanca sapının geçtiği boşluk; 2 makarada iki makara arası." },
  { key: "shaftD1Cm", label: "D1 · Mil Çapı", unit: "cm", type: "number", diameter: true },
  { key: "girderSpanMm", label: "Kiriş Açıklığı a", unit: "mm", type: "number" },
  { key: "loadOffsetMm", label: "Yük Mesafesi b", unit: "mm", type: "number" },
  { key: "midTopPlateThkMm", label: "Orta Kesit Üst Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "midTopPlateWidthMm", label: "Orta Kesit Üst Sac Genişliği", unit: "mm", type: "number" },
  { key: "midWebPlateThkMm", label: "Orta Kesit Yan Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "midWebPlateHeightMm", label: "Orta Kesit Yan Sac Yüksekliği", unit: "mm", type: "number" },
  { key: "midBottomPlateThkMm", label: "Orta Kesit Alt Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "midBottomPlateWidthMm", label: "Orta Kesit Alt Sac Genişliği", unit: "mm", type: "number" },
  { key: "thickTopPlateThkMm", label: "Kalın Kesit Üst Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "thickTopPlateWidthMm", label: "Kalın Kesit Üst Sac Genişliği", unit: "mm", type: "number" },
  { key: "thickWebPlateThkMm", label: "Kalın Kesit Yan Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "thickWebPlateHeightMm", label: "Kalın Kesit Yan Sac Yüksekliği", unit: "mm", type: "number" },
  { key: "thickBottomPlateThkMm", label: "Kalın Kesit Alt Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "thickBottomPlateWidthMm", label: "Kalın Kesit Alt Sac Genişliği", unit: "mm", type: "number" },
  { key: "loadGroup", label: "Yük Sınıfı", type: "select", options: LOAD_GROUPS, standardRef: "DIN 15018 Tablo 17" },
  { key: "notchClass", label: "Kaynak / Çentik Sınıfı", type: "select", options: NOTCH_CLASSES, standardRef: "DIN 15018 Tablo 17" },
  { key: "fatigueMaterial", label: "Kiriş Malzemesi (Yorulma)", type: "select", options: FATIGUE_MATERIALS },
  // ψ katsayıları normalde teknik özelliklerdeki kaldırma sınıfından türetilir;
  // aşağıdaki iki alan yalnız projeye özel gerekçe varsa doldurulur.
  {
    key: "dynamicFactorKOverride", label: "ψ Katsayısı k (Elle Ezme)", type: "number",
    standardRef: "DIN 15018 Tablo 2",
    hint: "Boş bırakılırsa kaldırma sınıfından türetilir (H1:1,1 · H2:1,2 · H3:1,3 · H4:1,4).",
  },
  {
    key: "dynamicFactorLOverride", label: "ψ Katsayısı l (Elle Ezme)", type: "number",
    standardRef: "DIN 15018 Tablo 2",
    hint: "Boş bırakılırsa kaldırma sınıfından türetilir (H1:0,0022 · H2:0,0044 · H3:0,0066 · H4:0,0088).",
  },
];

export const HOOKBLOCK_SELECTION_FIELDS: FieldDef<HookBlockSelections>[] = [
  { key: "hookDesignation", label: "Kanca Tanımı", type: "text" },
  { key: "hookNumber", label: "Kanca Numarası", type: "select", options: HOOK_NUMBERS, standardRef: "DIN 15400" },
  { key: "hookStrengthClass", label: "Kanca Malzeme Sınıfı", type: "select", options: HOOK_STRENGTH_CLASSES, optionLabels: HOOK_CLASS_LABELS, standardRef: "DIN 15400" },
  { key: "hookCapacityKg", label: "Kanca Kapasitesi (Tablo Dışıysa)", unit: "kg", type: "number", hint: "Kanca no + malzeme sınıfı seçiliyse kapasite DIN 15400 Tablo 3'ten okunur." },
  { key: "sheaveDiaMm", label: "Halat Ekseninde Makara Çapı", unit: "mm", type: "number", diameter: true },
  { key: "sheaveBearingType", label: "Makara Rulmanı Tipi", type: "text" },
  { key: "sheaveBearingCode", label: "Makara Rulmanı Kodu", type: "text" },
  { key: "sheaveBearingDynCKn", label: "Makara Rulmanı Dinamik Yük C", unit: "kN", type: "number" },
  { key: "sheaveBearingStatC0Kn", label: "Makara Rulmanı Statik Yük C0", unit: "kN", type: "number" },
  { key: "sheaveBearingBoreMm", label: "Makara Rulmanı İç Çapı", unit: "mm", type: "number", diameter: true, hint: "Mil çapı D1 ile eşleşmelidir." },
  { key: "shaftMaterial", label: "Mil Malzemesi", type: "select", options: HOOK_SHAFT_MATERIALS },
  { key: "hookBearingType", label: "Kanca Rulmanı Tipi", type: "text" },
  { key: "hookBearingCode", label: "Kanca Rulmanı Kodu", type: "text" },
  { key: "hookBearingStatC0Kn", label: "Kanca Rulmanı Statik Yük C0", unit: "kN", type: "number" },
];

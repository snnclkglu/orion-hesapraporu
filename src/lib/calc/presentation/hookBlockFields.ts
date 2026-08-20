// Kanca bloğu form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler motor tiplerinin (HookBlockInputs, HookBlockSelections) alan
// adlarıyla birebir aynıdır.

import { DRUM_DIA_SERIES_MM, type FieldDef } from "../fields";
import {
  HOOK_NUMBERS,
  HOOK_STRENGTH_CLASSES,
  HOOK_STRENGTH_CLASS_INFO,
} from "../hook-table";
import {
  DIN15407_LABELS,
  HOOK_STANDARDS,
  HOOK_STANDARD_LABELS,
  hookNumberOptions,
  isLamellaHook,
} from "../hook-standards";
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
  { key: "shaftSupportOffsetMm", label: "Merkez → Askı Sacı Ekseni", unit: "mm", type: "number", hint: "Simetrik tasarımda yalnız bir taraf girilir; toplam açıklık bu ölçünün iki katıdır." },
  { key: "shaftSheaveOffsetsText", label: "Merkez → Makara Eksenleri (Tek Taraf)", unit: "mm", type: "text", hint: "Merkezden bir taraftaki ölçüleri küçükten büyüğe noktalı virgülle ayırın: 75; 175; 275. Karşı taraf otomatik aynalanır." },
  { key: "shaftD1Mm", label: "D1 · Mil Çapı", unit: "mm", type: "number", diameter: true },
  // Kaldırma kirişi ölçü zinciri — teknik resimdeki x · y · z
  {
    key: "beamXMm", label: "x · Sol Mesnet → 1. Askı", unit: "mm", type: "number",
    hint: "Kirişin sol askı noktasından birinci kanca bloğuna olan mesafe.",
  },
  {
    key: "beamYMm", label: "y · Askılar Arası", unit: "mm", type: "number",
    hint: "İki kanca bloğu (yük noktası) arası mesafe.",
  },
  {
    key: "beamZMm", label: "z · 2. Askı → Sağ Mesnet", unit: "mm", type: "number",
    hint: "Kiriş açıklığı L = x + y + z olarak türetilir; ayrıca sorulmaz.",
  },
  { key: "midTopPlateThkMm", label: "Kesit 1 Üst Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "midTopPlateWidthMm", label: "Kesit 1 Üst Sac Genişliği", unit: "mm", type: "number" },
  { key: "midWebPlateThkMm", label: "Kesit 1 Yan Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "midWebPlateHeightMm", label: "Kesit 1 Yan Sac Yüksekliği", unit: "mm", type: "number" },
  { key: "midBottomPlateThkMm", label: "Kesit 1 Alt Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "midBottomPlateWidthMm", label: "Kesit 1 Alt Sac Genişliği", unit: "mm", type: "number" },
  { key: "thickTopPlateThkMm", label: "Kesit 2 Üst Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "thickTopPlateWidthMm", label: "Kesit 2 Üst Sac Genişliği", unit: "mm", type: "number" },
  { key: "thickWebPlateThkMm", label: "Kesit 2 Yan Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "thickWebPlateHeightMm", label: "Kesit 2 Yan Sac Yüksekliği", unit: "mm", type: "number" },
  { key: "thickBottomPlateThkMm", label: "Kesit 2 Alt Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "thickBottomPlateWidthMm", label: "Kesit 2 Alt Sac Genişliği", unit: "mm", type: "number" },
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

/** Kanca numarası kutusunun etiketleri: lamel boyları adlandırılır, DIN 15400
 *  numaraları olduğu gibi görünür (tek sözlük — liste hangisi olursa olsun). */
const HOOK_NUMBER_LABELS: Record<string, string> = { ...DIN15407_LABELS };

export const HOOKBLOCK_SELECTION_FIELDS: FieldDef<HookBlockSelections>[] = [
  {
    // Standart rozeti SABİTTİR ve bu kutunun değeri onu değiştirir; yanına
    // "DIN 15400" koymak, lamel kanca seçiliyken yanlış tabloyu açardı.
    // Kapasitenin nereden geldiğini alanın kendi ipucu ve hesap satırları söyler.
    key: "hookStandard", label: "Kanca Tanımı", type: "select",
    options: HOOK_STANDARDS, optionLabels: HOOK_STANDARD_LABELS,
    hint:
      "Dövme kancada (15401/15402) kapasite DIN 15400 Tablo 3'ten, lamel " +
      "kancada (15407) standardın kendi satırından okunur.",
  },
  {
    key: "hookDesignation", label: "Kanca Tam Tanımı", type: "text",
    hint: "Otomatik: seçilen standart + kanca numarası (ör. \"DIN 15407 — 63 × 150\").",
  },
  {
    // Seçenekler SEÇİLEN STANDARDA göre değişir: DIN 15400 numaraları ya da
    // DIN 15407 lamel boyları. İki ayrı kutu, biri her zaman boş duran bir
    // ekran demekti.
    key: "hookNumber", label: "Kanca Numarası", type: "select",
    options: HOOK_NUMBERS,
    optionsFrom: (sel) =>
      hookNumberOptions(sel.hookStandard as string | undefined, HOOK_NUMBERS),
    optionLabels: HOOK_NUMBER_LABELS,
    hint:
      "Liste seçilen kanca tanımına göre değişir: DIN 15400 numaraları ya da " +
      "DIN 15407 lamel boyları (kapasite × ağız yarıçapı).",
  },
  {
    key: "hookStrengthClass", label: "Kanca Malzeme Sınıfı", type: "select",
    options: HOOK_STRENGTH_CLASSES, optionLabels: HOOK_CLASS_LABELS,
    standardRef: "DIN 15400",
    // Lamel kancanın kapasitesi tablonun kendi satırındadır; mukavemet sınıfı
    // orada bir şey belirlemez ve kutunun ekranda yeri yoktur.
    visibleWhen: (sel) => !isLamellaHook(sel.hookStandard as string | undefined),
  },
  {
    // Makara çapı da TAMBURLA AYNI standart seriden seçilir (kullanıcı kararı,
    // 16.08.2026); liste tek yerdedir (`DRUM_DIA_SERIES_MM`), iki ayrı seri
    // yazmak aynı atölyeye iki farklı çap dünyası anlatırdı. Liste yine bir
    // ÖNERİDİR: `allowCustom` ile ara bir çap elle yazılabilir.
    key: "sheaveDiaMm", label: "Halat Ekseninde Makara Çapı", unit: "mm",
    type: "select", options: DRUM_DIA_SERIES_MM, numeric: true,
    diameter: true, allowCustom: true,
    standardRef: "FEM 1.001 T.4.2.3.1.1",
    hint:
      "Seri, tambur çapıyla aynıdır. FEM'in istediği D_min = H·d yuvarlak " +
      "çıkmaz; serinin bir alt basamağı D_min'in %2'sinden az aşağıdaysa kabul " +
      "edilir (ör. D_min 1008 mm → 1000 mm uygundur) ve rapor bunu yazar.",
  },
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

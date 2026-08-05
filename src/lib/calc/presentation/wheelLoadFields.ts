// Teker yükleri bölümünün form alanı metadata'sı — UI formları bu tanımlardan
// üretilir. key'ler WheelLoadInputs / WheelLoadSelections alan adlarıyla
// birebir aynıdır.
//
// Bu bölümün girdileri BİLEREK azdır: ağırlıklar, hızlar, ivme, teker adedi,
// tahrikli teker sayısı, ray ve tampon verileri teknik özelliklerden ve köprü
// yürütme bölümünden otomatik gelir. Burada yalnız yol kirişi geometrisine ve
// kılavuzlamaya ait, başka hiçbir yerde sorulmayan büyüklükler istenir.

import type { FieldDef } from "../fields";
import type { WheelLoadInputs, WheelLoadSelections } from "../modules/wheelLoads";

export const HOISTING_CLASS_OPTIONS = ["HC1", "HC2", "HC3", "HC4"] as const;

export const HOISTING_CLASS_LABELS: Record<string, string> = {
  HC1: "HC1 — Hassas kaldırma (yumuşak devreye girme)",
  HC2: "HC2 — Normal kaldırma (genel amaçlı vinç)",
  HC3: "HC3 — Sert kaldırma (kepçe, mıknatıs)",
  HC4: "HC4 — Çok sert kaldırma (ağır hizmet)",
};

export const HOIST_DRIVE_CLASS_OPTIONS = ["HD1", "HD2", "HD3", "HD4", "HD5"] as const;

export const HOIST_DRIVE_CLASS_LABELS: Record<string, string> = {
  HD1: "HD1 — Sürünme hızı yok",
  HD2: "HD2 — Sürünme hızını operatör seçer",
  HD3: "HD3 — Yük yerden kalkana kadar sürünme hızı zorunlu",
  HD4: "HD4 — Kademesiz hız kontrolü, operatör kumandalı",
  HD5: "HD5 — Ön germeli kademesiz hız kontrolü, otomatik",
};

export const WHEEL_PAIR_MODE_OPTIONS = ["CFF", "IFF", "CFM", "IFM"] as const;

export const WHEEL_PAIR_MODE_LABELS: Record<string, string> = {
  CFF: "CFF — Bağlı teker çifti, iki taraf da yanal sabit",
  IFF: "IFF — Bağımsız teker çifti, iki taraf da yanal sabit",
  CFM: "CFM — Bağlı teker çifti, bir taraf yanal hareketli",
  IFM: "IFM — Bağımsız teker çifti, bir taraf yanal hareketli",
};

export const GUIDE_MEANS_OPTIONS = ["flange", "roller"] as const;

export const GUIDE_MEANS_LABELS: Record<string, string> = {
  flange: "Teker Flanşı",
  roller: "Kılavuz Makarası",
};

export const WHEELLOAD_INPUT_FIELDS: FieldDef<WheelLoadInputs>[] = [
  // `wheelSpacingsText` görsel teker düzeni düzenleyicisinden yazılır
  // (bkz. WheelSpacingEditor); burada ayrıca bir metin kutusu gösterilmez.
  {
    key: "guideSpacingMm",
    label: "Kılavuz Elemanları Arası wb",
    unit: "mm",
    type: "number",
    hint: "Teker flanşıyla kılavuzlamada dingil mesafesine eşittir; kılavuz makarasında makaralar arası mesafedir.",
    standardRef: "FEM 1.001 9.4.1.5",
  },
  {
    key: "guideClearanceMm",
    label: "Kılavuz Boşluğu (Tek Taraf)",
    unit: "mm",
    type: "number",
    hint: "Flanş ile ray başı arasındaki tek taraf boşluk. FEM'in sg değeri bunun iki katıdır.",
  },
  {
    key: "coupledPairCount",
    label: "Bağlı Teker Çifti Adedi p",
    type: "number",
    hint: "İki rayın tekerlerini birbirine bağlayan (mil ya da elektriksel senkron) çift adedi. Otomatikte tahrikli teker çiftlerinden okunur.",
    standardRef: "FEM 1.001 9.4.1.3",
  },
  {
    key: "creepSpeedMpm",
    label: "Kaldırma Sürünme Hızı",
    unit: "m/dak",
    type: "number",
    hint: "HD2 ve HD3 tahrik sınıflarında φ2 bu hızla hesaplanır.",
    standardRef: "FEM 1.001 T.9.3.b",
  },
];

export const WHEELLOAD_SELECTION_FIELDS: FieldDef<WheelLoadSelections>[] = [
  {
    key: "hoistingClass",
    label: "Kaldırma Sınıfı (HC)",
    type: "select",
    options: HOISTING_CLASS_OPTIONS,
    optionLabels: HOISTING_CLASS_LABELS,
    standardRef: "FEM 1.001 T.9.3.a",
  },
  {
    key: "hoistDriveClass",
    label: "Kaldırma Tahrik Sınıfı (HD)",
    type: "select",
    options: HOIST_DRIVE_CLASS_OPTIONS,
    optionLabels: HOIST_DRIVE_CLASS_LABELS,
    standardRef: "FEM 1.001 T.9.3.b",
  },
  {
    key: "guideMeans",
    label: "Yanal Kılavuzlama",
    type: "select",
    options: GUIDE_MEANS_OPTIONS,
    optionLabels: GUIDE_MEANS_LABELS,
  },
  {
    key: "wheelPairMode",
    label: "Teker Çifti Düzeni",
    type: "select",
    options: WHEEL_PAIR_MODE_OPTIONS,
    optionLabels: WHEEL_PAIR_MODE_LABELS,
    standardRef: "FEM 1.001 T.9.4",
  },
];

// Yapısal modüllerin (ana kiriş, buruşma, başkiriş) form alanı metadata'sı —
// UI formları bu tanımlardan üretilir. key'ler motor tiplerinin alan adlarıyla
// birebir aynıdır (bkz. fields.ts deseni).
//
// "…Override" ile biten alanlar normalde BOŞ bırakılır: değerleri teknik
// özelliklerden türetilir (yapı sınıfı → γc, kaldırma/yük sınıfı → H ve B
// bileşenleri). Alan doldurulduğunda türetme devre dışı kalır.

import type { FieldDef } from "../fields";
import type { BucklingInputs, BucklingPanelInputs } from "../modules/buckling";
import type {
  EndCarriageDeps,
  EndCarriageInputs,
  EndCarriageSelections,
} from "../modules/endCarriage";
import type { GirderDeps, GirderInputs, GirderSelections } from "../modules/mainGirder";

export const FATIGUE_MATERIALS = ["S235JR", "S355JR"] as const;
export const NOTCH_CLASSES = ["W0", "W1", "W2", "K0", "K1", "K2", "K3", "K4"] as const;
export const LOAD_GROUPS = ["B1", "B2", "B3", "B4", "B5", "B6"] as const;
export const GIRDER_STATIC_MATERIALS = ["St37", "St44", "St52"] as const;
export const HOIST_CLASSES = ["H1", "H2", "H3", "H4"] as const;

// --- ANA KİRİŞ --------------------------------------------------------------

export const GIRDER_DEP_FIELDS: FieldDef<GirderDeps>[] = [
  { key: "mainHookBlockWeightKg", label: "Kanca Bloğu / Kepçe Ağırlığı", unit: "kg", type: "number" },
  { key: "mainRopeWeightKg", label: "Halat Ağırlığı", unit: "kg", type: "number" },
  { key: "trolleyWeightT", label: "Araba Ağırlığı", unit: "t", type: "number" },
  { key: "trolleyWheelCount", label: "Araba Teker Sayısı", type: "number" },
  { key: "trolleyDrivenWheels", label: "Araba Tahrikli Teker Sayısı", type: "number" },
  { key: "trolleyActualSpeedMpm", label: "Gerçekleşen Araba Hızı", unit: "m/dak", type: "number" },
  { key: "trolleyAccelTimeS", label: "Araba İvmelenme Süresi", unit: "s", type: "number" },
  { key: "bridgeWeightT", label: "Köprü Toplam Ağırlığı (Kirişler + Başkirişler)", unit: "t", type: "number" },
  { key: "bridgeWheelCount", label: "Köprü Teker Sayısı", type: "number" },
  { key: "bridgeDrivenWheels", label: "Köprü Tahrikli Teker Sayısı", type: "number" },
  { key: "bridgeActualSpeedMpm", label: "Gerçekleşen Köprü Hızı", unit: "m/dak", type: "number" },
  { key: "bridgeAccelTimeS", label: "Köprü İvmelenme Süresi", unit: "s", type: "number" },
];

export const GIRDER_INPUT_FIELDS: FieldDef<GirderInputs>[] = [
  { key: "railHeightMm", label: "Ray Yüksekliği hr", unit: "mm", type: "number" },
  { key: "t1Mm", label: "Ray Altı Sacı Kalınlığı t1", unit: "mm", type: "number" },
  {
    key: "b1Mm", label: "Ray Altı Sacı Genişliği b1", unit: "mm", type: "number",
    hint: "b1'in merkezi kirişin ortasında değil, RAY EKSENİNDEDİR (x + t3/2).",
  },
  { key: "t2Mm", label: "Üst İç Flanş Kalınlığı t2", unit: "mm", type: "number" },
  { key: "b2Mm", label: "Üst İç Flanş Genişliği b2", unit: "mm", type: "number" },
  { key: "t3Mm", label: "Ana Gövde Sacı Kalınlığı t3", unit: "mm", type: "number" },
  { key: "h3Mm", label: "Gövde Yüksekliği h3", unit: "mm", type: "number" },
  { key: "t4Mm", label: "Yardımcı Gövde Sacı Kalınlığı t4", unit: "mm", type: "number" },
  { key: "t5Mm", label: "Alt Flanş Kalınlığı t5", unit: "mm", type: "number" },
  { key: "b5Mm", label: "Alt Flanş Genişliği b5", unit: "mm", type: "number" },
  { key: "t6Mm", label: "Ek Flanş Kalınlığı t6", unit: "mm", type: "number" },
  { key: "b6Mm", label: "Ek Flanş Genişliği b6", unit: "mm", type: "number" },
  { key: "aMm", label: "Gövde Sacları Arası Mesafe a", unit: "mm", type: "number" },
  { key: "xMm", label: "Kenar Mesafesi x", unit: "mm", type: "number" },
  { key: "hookTopPositionM", label: "Kancanın En Üst Konumu l", unit: "m", type: "number" },
  { key: "bridgeAxleSpacingM", label: "Köprü Dingil Açıklığı", unit: "m", type: "number" },
  { key: "trolleyWheelSpacingM", label: "Araba Tekerlek Açıklığı", unit: "m", type: "number" },
  { key: "trolleyAxleSpacingM", label: "Araba Dingil Açıklığı", unit: "m", type: "number" },
  // 7.2 / 7.3'ün üç katsayısı ARTIK ELLE SORULMAZ: otomatik türetilip kutuya
  // yazılır (bkz. derive.ts `deriveGirderInputs`, fields.ts GIRDER_AUTO_FIELDS).
  // Anahtar kapatılınca alan serbest kalır ve mühendisin değeri kullanılır.
  {
    key: "psiHAOverride", label: "Yatay Dinamik Katsayı ψhA (Araba)", type: "number",
    standardRef: "FEM 1.001 A.2.2.1",
    hint:
      "Otomatik: araba kütle oranından türetilir — µA = asılı yük / araba " +
      "ağırlığı; µ ≤ 1 → 2, µ > 1 → √(2 + µ + 1/µ).",
  },
  {
    key: "psiHKOverride", label: "Yatay Dinamik Katsayı ψhK (Köprü)", type: "number",
    standardRef: "FEM 1.001 A.2.2.1",
    hint:
      "Otomatik: köprü kütle oranından türetilir — µK = asılı yük / " +
      "(köprü + araba); µ ≤ 1 → 2, µ > 1 → √(2 + µ + 1/µ).",
  },
  {
    key: "amplifyYcOverride", label: "Arttırma Katsayısı γc", type: "number",
    standardRef: "FEM 1.001 T.2.3.4",
    hint: "Otomatik: çelik yapı sınıfından getirilir (A1 → 1,00 … A8 → 1,20).",
  },
  {
    key: "dynTestFactorR1", label: "Dinamik Test Katsayısı ρ1", type: "number",
    standardRef: "FEM 1.001 §2.3.3",
  },
  {
    key: "statTestFactorR2", label: "Statik Test Katsayısı ρ2", type: "number",
    standardRef: "FEM 1.001 §2.3.3",
  },
  { key: "railLeverCMm", label: "Kayma Merkezi Kolu c", unit: "mm", type: "number" },
  {
    key: "diaphragmSpacingMm", label: "İki Perde Arası l1", unit: "mm",
    type: "select", options: ["1000", "1500", "2000"], numeric: true,
    standardRef: "FEM 1.001 A-3.4",
    hint: "Buruşma kontrolünde panel uzunluğu a bu değerdir (α = a / b).",
  },
  {
    key: "webStiffenerOffsetMm", label: "Boyuna Berkitme (Köşebent) Mesafesi",
    unit: "mm", type: "number", standardRef: "FEM 1.001 A-3.4",
    hint:
      "Gövde sacındaki boyuna berkitmenin ÜST BAŞLIĞA uzaklığı. Kesit " +
      "özelliklerine girmez; yalnız buruşma panelini böler — 0 girilirse " +
      "gövdenin tamamı tek panel olarak kontrol edilir.",
  },
  {
    key: "wheelContactHMm", label: "Teker Basıncı Yayılım Yüksekliği h", unit: "mm",
    type: "number", standardRef: "DIN 15018 Şekil 9",
  },
  {
    key: "wheelContactTMm", label: "Teker Basıncı Taşıyan Sac (Ray T-Profil) Kalınlığı t",
    unit: "mm", type: "number", standardRef: "DIN 15018 Şekil 9",
  },
  {
    key: "sigmaYMaxOverrideNmm2", label: "σy,maks (Elle)", unit: "N/mm²", type: "number",
    standardRef: "DIN 15018 Şekil 9",
    hint: "Boş bırakılırsa gerilme analizindeki teker basıncından gelir: σy,maks = |σz(I)| / 9,81.",
  },
  {
    key: "sigmaYMinOverrideNmm2", label: "σy,min (Elle)", unit: "N/mm²", type: "number",
    standardRef: "DIN 15018 Şekil 9",
    hint: "Boş bırakılırsa gerilme analizinden gelir: σy,min = |σz(araba)| / 9,81.",
  },
  {
    key: "fatigueTensileOverrideNmm2", label: "Malzeme Kopma Dayanımı σB (Elle)",
    unit: "N/mm²", type: "number",
    hint: "Boş bırakılırsa yorulma malzemesinden türetilir (S235JR → 360, S355JR → 510).",
  },
  {
    key: "deflectionLimitRatio", label: "Sehim Sınırı", type: "select",
    options: ["250", "500", "750", "1000", "1100"], numeric: true,
    optionLabels: { "250": "1/250", "500": "1/500", "750": "1/750", "1000": "1/1000", "1100": "1/1100" },
    standardRef: "CMAA 70 3.5.5.1",
    hint:
      "Sehim yalnız CANLI yükle (araba + nominal kaldırma yükü) hesaplanır; " +
      "darbe katsayısı girmez. FEM/CMAA yaygın hedefi δ ≤ L/1000'dir.",
  },
  {
    key: "camberExtraDeadLoadKgPerM", label: "Kamber — İlave Sabit Yük",
    unit: "kg/m", type: "number", standardRef: "CMAA 70 3.5.5.2",
    hint:
      "Ters sehim hesabında kirişe kalıcı binen ilave yük: ray, yürüme yolu, " +
      "festun, kablo tavası. Kirişin kendi ağırlığı kesitten hesaplanır ve " +
      "otomatik eklenir; buraya YAZILMAZ. Başkiriş ağırlığı da girmez " +
      "(mesnet üzerinde durur, kirişi eğmez).",
  },
];

export const GIRDER_SELECTION_FIELDS: FieldDef<GirderSelections>[] = [
  {
    key: "fatigueMaterial", label: "Yorulma Malzemesi", type: "select",
    options: FATIGUE_MATERIALS, standardRef: "DIN 15018 Tablo 17",
  },
  {
    key: "fatigueLoadGroupOverride", label: "Yük Grubu (DIN 15018, Elle)",
    type: "select", options: LOAD_GROUPS, standardRef: "DIN 15018 Tablo 17",
    hint: "Boş bırakılırsa teknik özelliklerdeki kaldırma/yük sınıfının B bileşeninden türetilir.",
  },
  {
    key: "fatigueNotchClass", label: "Kaynak / Çentik Sınıfı (DIN 15018)", type: "select",
    options: NOTCH_CLASSES, standardRef: "DIN 15018 Tablo 17",
  },
  {
    key: "staticMaterial", label: "Kiriş Malzemesi", type: "select",
    options: GIRDER_STATIC_MATERIALS, standardRef: "FEM 1.001 T.3.2.1.1",
  },
];

// --- BURUŞMA KONTROLÜ -------------------------------------------------------

/**
 * Panel alanları. NORMALDE ELLE GİRİLMEZ: ana kiriş açıkken ölçüler kesitten,
 * kenar gerilmeleri 7.4 gerilme analizinden türetilir (bkz. modules/buckling.ts
 * `bucklingDepsFrom`). Bu alanlar yalnız "Ana Kirişten Otomatik" anahtarı
 * kapatıldığında kullanılır.
 *
 * İŞARET KURALI her gerilme alanının ipucunda tekrarlanır — buruşmada bir
 * işaret hatası doğrudan yanlış Kσ dalına düşürür.
 */
export const BUCKLING_PANEL_FIELDS: FieldDef<BucklingPanelInputs>[] = [
  {
    key: "thicknessMm", label: "Sac Kalınlığı e", unit: "mm", type: "number",
    standardRef: "FEM 1.001 A-3.4",
    hint: "Otomatik türetmede yan sac için gövde sacı t3, üst sac için üst iç başlık t2.",
  },
  {
    key: "panelWidthMm", label: "Panel Genişliği b", unit: "mm", type: "number",
    standardRef: "FEM 1.001 A-3.4",
    hint:
      "Basınç kuvvetlerine DİK ölçü. Yan sacta gövdenin boyuna berkitmeye " +
      "(köşebent) kadar olan yüksekliği, berkitme yoksa gövdenin tamamı h3; " +
      "üst sacta gövde sacları arası net açıklık a.",
  },
  {
    key: "stiffenerSpacingMm", label: "Panel Uzunluğu a (Perde Aralığı)", unit: "mm",
    type: "number", standardRef: "FEM 1.001 A-3.4",
    hint: "Basınç yönündeki ölçü = ana kirişin iki perdesi arası. α = a / b.",
  },
  {
    key: "sigma1", label: "Basınç Kenarı Gerilmesi σ1", unit: "N/mm²", type: "number",
    standardRef: "FEM 1.001 T.A.3.4.1",
    hint:
      "BASINÇ POZİTİF girilir. σ1 panelin basınç kenarıdır (iki kenarın " +
      "büyüğü). Yükleme Durumu I gerilmesidir ve γc arttırma katsayısını içerir.",
  },
  {
    key: "sigma2", label: "Karşı Kenar Gerilmesi σ2", unit: "N/mm²", type: "number",
    standardRef: "FEM 1.001 T.A.3.4.1",
    hint:
      "Panelin diğer kenarı; ÇEKME ise NEGATİF girilir. ψ = σ2/σ1 buradan " +
      "çıkar: +1 düzgün basınç, 0 üçgen basınç, −1 saf eğilme. ψ < −1 (çekme " +
      "baskın eğilme) geçerlidir ve Kσ = 23,9 ile karşılanır.",
  },
  {
    key: "tau", label: "Ortalama Kayma Gerilmesi τ", unit: "N/mm²", type: "number",
    standardRef: "FEM 1.001 A-3.4",
    hint:
      "Panelin ortalama kayma gerilmesi (işareti sonucu etkilemez). Yan sacta " +
      "gövde kayması, üst sacta kapalı kesitin burulma akışından gelen kayma.",
  },
];

export const BUCKLING_EXTRA_FIELDS: FieldDef<BucklingInputs>[] = [
  {
    key: "autoFromGirder", label: "Panelleri Ana Kirişten Otomatik Türet",
    type: "select", options: ["Evet", "Hayır"],
    standardRef: "FEM 1.001 A-3.4",
    hint:
      "Açıkken panel ölçüleri kesit geometrisinden, kenar gerilmeleri 7.4 " +
      "gerilme analizinden gelir; yukarıdaki alanlar kullanılmaz. Kapatılırsa " +
      "değerler elle girilir.",
  },
];

// --- BAŞKİRİŞ ---------------------------------------------------------------

export const ENDCARRIAGE_DEP_FIELDS: FieldDef<EndCarriageDeps>[] = [
  { key: "mainHoistTotalLoadKg", label: "Ana Kaldırma Toplam Yükü", unit: "kg", type: "number" },
  { key: "trolleyWeightT", label: "Araba Ağırlığı", unit: "t", type: "number" },
  { key: "bridgeWeightT", label: "Köprü Toplam Ağırlığı (Kirişler + Başkirişler)", unit: "t", type: "number" },
];

export const ENDCARRIAGE_INPUT_FIELDS: FieldDef<EndCarriageInputs>[] = [
  { key: "wheelSpanAMm", label: "Tekerlekler Arası Mesafe a", unit: "mm", type: "number" },
  { key: "loadOffsetBMm", label: "Kiriş Oturma Noktası b", unit: "mm", type: "number" },
  { key: "topPlateThicknessMm", label: "Üst Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "topPlateWidthMm", label: "Üst Sac Genişliği", unit: "mm", type: "number" },
  { key: "sidePlateThicknessMm", label: "Yan Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "sidePlateHeightMm", label: "Yan Sac Yüksekliği", unit: "mm", type: "number" },
  { key: "bottomPlateThicknessMm", label: "Alt Sac Kalınlığı", unit: "mm", type: "number" },
  { key: "bottomPlateWidthMm", label: "Alt Sac Genişliği", unit: "mm", type: "number" },
  { key: "fatigueTensileNmm2", label: "Malzeme Kopma Dayanımı σB", unit: "N/mm²", type: "number" },
];

export const ENDCARRIAGE_SELECTION_FIELDS: FieldDef<EndCarriageSelections>[] = [
  {
    key: "hoistClassOverride", label: "Kaldırma Sınıfı (Elle)",
    type: "select", options: HOIST_CLASSES, standardRef: "DIN 15018 Tablo 2",
    hint: "Boş bırakılırsa teknik özelliklerdeki kaldırma/yük sınıfının H bileşeninden türetilir.",
  },
  { key: "material", label: "Malzeme", type: "select", options: FATIGUE_MATERIALS },
  { key: "fatigueMaterial", label: "Yorulma Malzemesi", type: "select", options: FATIGUE_MATERIALS },
  {
    key: "fatigueLoadGroupOverride", label: "Yük Grubu (DIN 15018, Elle)",
    type: "select", options: LOAD_GROUPS,
    hint: "Boş bırakılırsa teknik özelliklerdeki kaldırma/yük sınıfının B bileşeninden türetilir.",
  },
  { key: "fatigueNotchClass", label: "Kaynak / Çentik Sınıfı (DIN 15018)", type: "select", options: NOTCH_CLASSES },
];

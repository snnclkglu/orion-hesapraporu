// Ana kiriş sunum katmanı: raporun 7.1 … 7.6 bölüm yapısı + her hesap
// satırının SEMBOLİK FORMÜLÜ ve SAYILARIN YERİNE KONMUŞ hali.
// Hesabın kendisi mainGirder.ts'tedir; burası yalnız gösterimdir.
//
// Satırlar motorun semantik anahtarlarını (`<blok>.<büyüklük>`) okur.
//
// GERİLME NUMARALARI (σ1…σ10, τ1…τ5) motorda tanımlanmıştır ve burada,
// diyagramda ve 7.4 gerilme tablosunda AYNI anlamı taşır — bir bileşenin
// hangi toplama hangi çarpanla girdiği numarasından izlenebilir.

import { camberProfile } from "../camber";
import { GIRDER_ELASTIC_MODULUS_KG_CM2, railTProfile } from "../modules/mainGirder";
import type { GirderDeps, GirderInputs, GirderSelections } from "../modules/mainGirder";
import type { TechnicalSpecs } from "../types";
import { KGF_TO_MPA } from "@/lib/units";

export interface GirderCtx {
  c: Record<string, number | string>; // motorun ürettiği değerler
  inp: GirderInputs;
  sel: GirderSelections;
  deps: GirderDeps;
  specs: TechnicalSpecs;
}

export interface GirderRowDef {
  key: string;               // sonucun okunacağı semantik anahtar
  label: string;
  formula?: string;          // sembolik formül
  subst?: (ctx: GirderCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
  /**
   * Ölçü bir ÇAPTIR — gösterilen değerin başına "Ø" konur (bkz. fields.ts
   * `withDiameterSign`). Arayüz ve PDF aynı bayrağı okur.
   */
  diameter?: true;
}

/** Bölüm sonunda gösterilen özet tablosu (örneğin gerilme tablosu). */
export interface GirderSectionTable {
  title: string;
  headers: string[];
  build: (ctx: GirderCtx) => (string | number)[][];
  note?: string;
}

export interface GirderSectionDef {
  id: string;                // "7.1"
  title: string;
  description?: string;
  depKeys: (keyof GirderDeps & string)[];
  inputKeys: (keyof GirderInputs & string)[];
  selectionKeys: (keyof GirderSelections & string)[];
  rows: GirderRowDef[];
  /** Bölüm sonunda gösterilecek özet tablo (varsa) */
  table?: GirderSectionTable;
  /** Bölümde gösterilecek kontrol id sonekleri ("girder." öneki hariç) */
  checkSuffixes: string[];
}

// Sayı biçimleyici (formül substitüsyonu için, TR yerel)
const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};
const num = (v: number | string | undefined): number => (typeof v === "number" ? v : NaN);

/** kg/cm² → MPa, tablo hücresi için tr-TR biçiminde metin. */
const mpa = (v: number | string | undefined, d = 1): string => {
  const x = num(v);
  if (!Number.isFinite(x)) return "—";
  return (x * KGF_TO_MPA).toLocaleString("tr-TR", {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });
};

/** Ray altı T profil bu kesitte kullanılıyor mu (formül metinleri için). */
const tOn = (x: GirderCtx): boolean => railTProfile(x.inp).present;

export const GIRDER_SECTIONS: GirderSectionDef[] = [
  {
    id: "7.1",
    title: "Kesit Özellikleri",
    description:
      "Kutu kesit alanı, ağırlık merkezi, atalet ve mukavemet momentleri, burulma sabiti. " +
      "Ray altı sacı b1, kirişin ortasında değil ray ekseninde oturur. Büyük " +
      "tonajlı vinçlerde rayın altına bir T PROFİL konur; profil kirişin " +
      "ÜSTÜNE oturmaz, ÜST BÖLÜMÜNÜN İÇİNE girer: T'nin üst sacı ana kirişin " +
      "üst sacıyla aynı seviyededir, ray altı sacı (t1) iptal olur, üst iç " +
      "flanş T'nin genişliği kadar kesilir ve ana gövde sacı T'nin yan sacı " +
      "kadar kısalır. TOPLAM YÜKSEKLİK DEĞİŞMEZ.",
    depKeys: [],
    inputKeys: [
      "t1Mm", "b1Mm", "t2Mm", "b2Mm", "t3Mm", "h3Mm", "t4Mm", "t5Mm", "b5Mm",
      "t6Mm", "b6Mm", "aMm", "xMm",
      "railTProfile",
      "railTProfileTopThkMm", "railTProfileTopWidthMm",
      "railTProfileWebThkMm", "railTProfileWebHeightMm",
    ],
    selectionKeys: [],
    rows: [
      {
        key: "section.height", label: "Toplam Yükseklik h",
        // T profil varken t1 = 0'dır (ray altı sacı iptal); ifade değişmez.
        formula: "h = t1 + t2 + h3 + t5 + t6",
        subst: (x) =>
          `${n(tOn(x) ? 0 : x.inp.t1Mm)} + ${n(x.inp.t2Mm)} + ${n(x.inp.h3Mm)} + ${n(x.inp.t5Mm)} + ${n(x.inp.t6Mm)}` +
          (tOn(x) ? "   (t1 = 0 · ray altı sacı T profille iptal)" : ""),
        unit: "mm",
      },
      {
        key: "section.mainWebHeight", label: "Ana Gövde Sacı Yüksekliği",
        formula: "h3' = h3 + t2 − t_T,üst − h_T   (T profil varsa)",
        subst: (x) =>
          tOn(x)
            ? `${n(x.inp.h3Mm)} + ${n(x.inp.t2Mm)} − ${n(x.inp.railTProfileTopThkMm ?? 0)} − ${n(x.inp.railTProfileWebHeightMm ?? 0)}`
            : `T profil yok → h3 = ${n(x.inp.h3Mm)}`,
        unit: "mm",
      },
      {
        key: "section.topInnerEffectiveWidth", label: "Üst İç Flanşın Kesilmiş Genişliği",
        formula: "b2' = b2 − (T üst sacının b2 içindeki payı)",
        subst: (x) =>
          tOn(x)
            ? `${n(x.inp.b2Mm)} − T üst sacı ${n(x.inp.railTProfileTopWidthMm ?? 0)} (ray ekseninde)`
            : `T profil yok → b2 = ${n(x.inp.b2Mm)}`,
        unit: "mm",
      },
      {
        key: "section.areaTProfileTop", label: "T Profil Üst Sac Alanı",
        formula: "A_T,üst = t_T,üst · b_T",
        subst: (x) => `${n(x.inp.railTProfileTopThkMm ?? 0)} · ${n(x.inp.railTProfileTopWidthMm ?? 0)}`,
        unit: "mm²",
      },
      {
        key: "section.areaTProfileWeb", label: "T Profil Yan Sac Alanı",
        formula: "A_T,yan = t_T,yan · h_T",
        subst: (x) => `${n(x.inp.railTProfileWebThkMm ?? 0)} · ${n(x.inp.railTProfileWebHeightMm ?? 0)}`,
        unit: "mm²",
      },
      {
        key: "section.area", label: "Kesit Alanı A", formula: "A = Σ(ti · bi) · 0,01",
        subst: (x) => `(${n(num(x.c["section.areaTopFlange"]))} + ${n(num(x.c["section.areaTopInnerFlange"]))} + ${n(num(x.c["section.areaMainWeb"]))} + ${n(num(x.c["section.areaSecondaryWeb"]))} + ${n(num(x.c["section.areaBottomFlange"]))} + ${n(num(x.c["section.areaExtraFlange"]))} + ${n(num(x.c["section.areaTProfileTop"]))} + ${n(num(x.c["section.areaTProfileWeb"]))}) · 0,01`,
        unit: "cm²",
      },
      {
        key: "section.weightPerLength", label: "Birim Ağırlık G", formula: "G = A · 0,8",
        subst: (x) => `${n(num(x.c["section.area"]))} · 0,8`, unit: "kg/m",
      },
      {
        key: "section.centroidZ", label: "Ağırlık Merkezi Cz", formula: "Cz = Σ(Ai · zi) / A", unit: "mm",
      },
      {
        key: "section.inertiaY", label: "Atalet Momenti Iyy", formula: "Iyy = Σ(Ii + Ai · di²)", unit: "cm⁴",
      },
      {
        key: "section.modulusYBottom", label: "Mukavemet Momenti Wyy (Alt)", formula: "Wyy,alt = Iyy · 10 / Cz",
        subst: (x) => `${n(num(x.c["section.inertiaY"]))} · 10 / ${n(num(x.c["section.centroidZ"]))}`, unit: "cm³",
      },
      {
        key: "section.modulusYTop", label: "Mukavemet Momenti Wyy (Üst)", formula: "Wyy,üst = Iyy · 10 / (h − Cz)",
        subst: (x) => `${n(num(x.c["section.inertiaY"]))} · 10 / (${n(num(x.c["section.height"]))} − ${n(num(x.c["section.centroidZ"]))})`, unit: "cm³",
      },
      {
        key: "section.railCenterY", label: "Ray Ekseni (b1 Merkezi)",
        formula: "y_ray = x + t3/2   (b2 sol kenarından)",
        subst: (x) => `${n(x.inp.xMm)} + ${n(x.inp.t3Mm)}/2`,
        unit: "mm",
      },
      {
        key: "section.centroidY", label: "Ağırlık Merkezi Cy", formula: "Cy = Σ(Ai · yi) / A", unit: "mm",
      },
      {
        key: "section.inertiaZ", label: "Atalet Momenti Izz", formula: "Izz = Σ(Ii + Ai · di²)", unit: "cm⁴",
      },
      {
        key: "section.modulusZBottom", label: "Mukavemet Momenti Wzz (Alt)", formula: "Wzz,alt = 10 · Izz / Cy",
        subst: (x) => `10 · ${n(num(x.c["section.inertiaZ"]))} / ${n(num(x.c["section.centroidY"]))}`, unit: "cm³",
      },
      {
        key: "section.modulusZTop", label: "Mukavemet Momenti Wzz (Üst)",
        // Yataydaki dış lif normalde b2 kenarıdır; T profilin üst sacı b2'yi
        // aşarsa dış lif ODUR — aksi hâlde Wzz olduğundan büyük çıkardı.
        formula: "Wzz,üst = 10 · Izz / (y_dış − Cy),  y_dış = maks(b2 ; y_ray + b_T/2)",
        subst: (x) => `10 · ${n(num(x.c["section.inertiaZ"]))} / (maks(${n(x.inp.b2Mm)} ; ${n(num(x.c["section.railCenterY"]))} + ${n((x.inp.railTProfileTopWidthMm ?? 0) / 2)}) − ${n(num(x.c["section.centroidY"]))})`, unit: "cm³",
      },
      {
        key: "section.inertiaTorsion", label: "Burulma Sabiti Ixx", formula: "Ixx = 4·(b·h)² / Σ(si/ti)  [kapalı kutu]",
        subst: (x) => `4·(${n(num(x.c["section.torsionBoxWidth"]))}·${n(num(x.c["section.torsionBoxHeight"]))})² / Σ(si/ti)`, unit: "cm⁴",
      },
      {
        key: "section.spanToDepthRatio", label: "Kiriş Narinliği L/h", formula: "L / h ≤ 25",
        subst: (x) => `${n(x.specs.spanM * 1000)} / ${n(num(x.c["section.height"]))}`,
        digits: 1, standard: "CMAA 70 3.5.1",
      },
      {
        key: "section.spanToWidthRatio", label: "Kiriş Narinliği L/b", formula: "L / a ≤ 65",
        subst: (x) => `${n(x.specs.spanM * 1000)} / ${n(x.inp.aMm)}`,
        digits: 1, standard: "CMAA 70 3.5.1",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "7.2",
    title: "Yükler",
    description:
      "Ölü/hareketli yükler, FEM dinamik katsayı ψ, yatay ivme dinamik katsayıları ψh ve " +
      "yatay hareket yükleri. Teker sayıları, tahrikli teker sayıları ve hızlar yürütme " +
      "modüllerinden otomatik gelir; ψhA / ψhK kütle oranından türetilir.",
    depKeys: ["bridgeWeightT", "trolleyWeightT", "mainHookBlockWeightKg", "mainRopeWeightKg", "trolleyWheelCount", "trolleyDrivenWheels", "trolleyActualSpeedMpm", "trolleyAccelTimeS", "bridgeWheelCount", "bridgeDrivenWheels", "bridgeActualSpeedMpm", "bridgeAccelTimeS"],
    inputKeys: ["hookTopPositionM", "psiHAOverride", "psiHKOverride", "bridgeAxleSpacingM", "trolleyWheelSpacingM", "trolleyAxleSpacingM"],
    selectionKeys: [],
    rows: [
      {
        key: "load.bridgeDeadWeight", label: "Bir Kirişe Düşen Köprü Ağırlığı Wv",
        formula: "Wv = G_köprü / 2 · 1000",
        subst: (x) => `${n(x.deps.bridgeWeightT)} / 2 · 1000`,
        unit: "kg",
      },
      {
        key: "load.trolleyWeight", label: "Araba Ağırlığı Wa", formula: "Wa = G_araba · 1000",
        subst: (x) => `${n(x.deps.trolleyWeightT)} · 1000`, unit: "kg",
      },
      {
        key: "load.hoistLoad", label: "Kaldırma Yükü W1", formula: "W1 = Q · 1000",
        subst: (x) => `${n(x.specs.mainCapacityT)} · 1000`, unit: "kg",
      },
      {
        key: "load.totalLiveLoad", label: "Toplam Hareketli Yük W", formula: "W = W1 + G_kanca + G_halat",
        subst: (x) => `${n(num(x.c["load.hoistLoad"]))} + ${n(num(x.c["load.belowHookWeight"]))}`, unit: "kg",
      },
      {
        key: "load.dynamicFactor", label: "Dinamik Katsayı ψ",
        formula: "ψ = Vl<0,25 → 1,15; Vl>1 → 1,6; aksi 1 + 0,6·Vl",
        subst: (x) => `Vl = ${n(num(x.c["load.liftSpeed"]), 3)} m/s → ${n(num(x.c["load.dynamicFactor"]), 3)}`,
        digits: 3, standard: "FEM 1.001 2.2.2.1.1",
      },
      {
        key: "load.trolleyAccel", label: "Araba İvmesi aA", formula: "aA = VA / tA",
        subst: (x) => `${n(num(x.c["load.trolleySpeed"]), 3)} / ${n(x.deps.trolleyAccelTimeS, 3)}`, unit: "m/s²",
      },
      {
        key: "load.bridgeAccel", label: "Köprü İvmesi aK", formula: "aK = VK / tK",
        subst: (x) => `${n(num(x.c["load.bridgeSpeed"]), 3)} / ${n(x.deps.bridgeAccelTimeS, 3)}`, unit: "m/s²",
      },
      {
        key: "load.pendulumPeriod", label: "Salınım Periyodu T1", formula: "T1 = 2π · √(l / g)",
        subst: (x) => `2π · √(${n(x.inp.hookTopPositionM)} / 9,81)`, unit: "s",
        standard: "FEM 1.001 A.2.2.1",
      },
      {
        key: "load.massRatioTrolley", label: "Kütle Oranı µA (Araba)", formula: "µA = W / Wa",
        subst: (x) => `${n(num(x.c["load.totalLiveLoad"]))} / ${n(num(x.c["load.trolleyWeight"]))}`,
        digits: 3, standard: "FEM 1.001 A.2.2.1",
      },
      {
        key: "load.massRatioBridge", label: "Kütle Oranı µK (Köprü)",
        formula: "µK = W / (G_köprü·1000 + Wa)",
        subst: (x) => `${n(num(x.c["load.totalLiveLoad"]))} / ${n(num(x.c["load.bridgeMovingMass"]))}`,
        digits: 3, standard: "FEM 1.001 A.2.2.1",
      },
      {
        key: "load.betaTrolley", label: "Süre Oranı βA", formula: "βA = tA / T1",
        subst: (x) => `${n(x.deps.trolleyAccelTimeS, 3)} / ${n(num(x.c["load.pendulumPeriod"]), 3)}`,
        digits: 3, standard: "FEM 1.001 A.2.2.1",
      },
      {
        key: "load.betaBridge", label: "Süre Oranı βK", formula: "βK = tK / T1",
        subst: (x) => `${n(x.deps.bridgeAccelTimeS, 3)} / ${n(num(x.c["load.pendulumPeriod"]), 3)}`,
        digits: 3, standard: "FEM 1.001 A.2.2.1",
      },
      {
        key: "load.psiHA", label: "Yatay Dinamik Katsayı ψhA (Araba)",
        formula: "µ ≤ 1 → ψh = 2 ;  µ > 1 → ψh = √(2 + µ + 1/µ)",
        subst: (x) => `µA = ${n(num(x.c["load.massRatioTrolley"]), 3)} → ${n(num(x.c["load.psiHA"]), 3)}`,
        digits: 3, standard: "FEM 1.001 A.2.2.1",
      },
      {
        key: "load.psiHK", label: "Yatay Dinamik Katsayı ψhK (Köprü)",
        formula: "µ ≤ 1 → ψh = 2 ;  µ > 1 → ψh = √(2 + µ + 1/µ)",
        subst: (x) => `µK = ${n(num(x.c["load.massRatioBridge"]), 3)} → ${n(num(x.c["load.psiHK"]), 3)}`,
        digits: 3, standard: "FEM 1.001 A.2.2.1",
      },
      {
        key: "load.trolleyDrivenWheels", label: "Araba Tahrikli Teker Sayısı",
        formula: "araba yürütme modülünden gelir",
        subst: (x) => `${n(x.deps.trolleyDrivenWheels)} / ${n(x.deps.trolleyWheelCount)} teker tahrikli`,
        digits: 0,
      },
      {
        key: "load.bridgeDrivenWheels", label: "Köprü Tahrikli Teker Sayısı",
        formula: "köprü yürütme modülünden gelir",
        subst: (x) => `${n(x.deps.bridgeDrivenWheels)} / ${n(x.deps.bridgeWheelCount)} teker tahrikli`,
        digits: 0,
      },
      {
        key: "load.trolleyWheelPressure", label: "Araba Teker Basıncı P_teker",
        formula: "P_teker = Wa / n_teker",
        subst: (x) => `${n(num(x.c["load.trolleyWeight"]))} / ${n(x.deps.trolleyWheelCount)}`, unit: "kg",
      },
      {
        key: "load.trolleyInertia", label: "Araba Atalet Yükü F'ha1",
        formula: "F'ha1 = aA · (W1 · ψhA + 2 · Wa) / g",
        subst: (x) => `${n(num(x.c["load.trolleyAccel"]), 3)} · (${n(num(x.c["load.hoistLoad"]))} · ${n(num(x.c["load.psiHA"]), 3)} + 2 · ${n(num(x.c["load.trolleyWeight"]))}) / 9,81`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "load.trolleyTractionLimit", label: "Araba Sürtünme Sınırı F''ha1",
        formula: "F''ha1 = n_tahrikli · P_teker · μ / 2 = n_tahrikli · P_teker / 14   (μ = 1/7, çift teker)",
        subst: (x) => `${n(x.deps.trolleyDrivenWheels)} · ${n(num(x.c["load.trolleyWheelPressure"]))} / 14`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "load.trolleyHorizontal", label: "Araba Yatay Yükü Fha1",
        formula: "Fha1 = min(F'ha1, F''ha1) / 2",
        subst: (x) => `min(${n(num(x.c["load.trolleyInertia"]))}, ${n(num(x.c["load.trolleyTractionLimit"]))}) / 2`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "load.skewFactorTrolley", label: "Çapraz Yürüyüş Katsayısı λA",
        formula: "λA = 0,025 · p / a   (0,05 … 0,20 bandına kırpılır)",
        subst: (x) => `0,025 · ${n(x.inp.trolleyWheelSpacingM)} / ${n(x.inp.trolleyAxleSpacingM)}`,
        digits: 3, standard: "FEM 1.001 2.2.3.3",
      },
      {
        key: "load.trolleySkew", label: "Araba Yürüme Yatay Yükü Fha2", formula: "Fha2 = (Wa + W1) · λA",
        subst: (x) => `(${n(num(x.c["load.trolleyWeight"]))} + ${n(num(x.c["load.hoistLoad"]))}) · ${n(num(x.c["load.skewFactorTrolley"]), 3)}`,
        unit: "kg", standard: "FEM 1.001 2.2.3.3",
      },
      {
        key: "load.bridgeWheelPressure", label: "Köprü Teker Basıncı P_teker",
        formula: "P_teker = Wv / n_teker",
        subst: (x) => `${n(num(x.c["load.bridgeDeadWeight"]))} / ${n(x.deps.bridgeWheelCount)}`, unit: "kg",
      },
      {
        key: "load.bridgeInertia", label: "Köprü Atalet Yükü F'hk1",
        formula: "F'hk1 = aK · (W1 · ψhK + 2 · Wv) / g",
        subst: (x) => `${n(num(x.c["load.bridgeAccel"]), 3)} · (${n(num(x.c["load.hoistLoad"]))} · ${n(num(x.c["load.psiHK"]), 3)} + 2 · ${n(num(x.c["load.bridgeDeadWeight"]))}) / 9,81`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "load.bridgeTractionLimit", label: "Köprü Sürtünme Sınırı F''hk1",
        formula: "F''hk1 = n_tahrikli · P_teker / 14   (μ = 1/7, çift teker)",
        subst: (x) => `${n(x.deps.bridgeDrivenWheels)} · ${n(num(x.c["load.bridgeWheelPressure"]))} / 14`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "load.bridgeHorizontal", label: "Köprü Yatay Yükü Fhk1",
        formula: "Fhk1 = min(F'hk1, F''hk1) / 2",
        subst: (x) => `min(${n(num(x.c["load.bridgeInertia"]))}, ${n(num(x.c["load.bridgeTractionLimit"]))}) / 2`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "load.skewFactorBridge", label: "Çapraz Yürüyüş Katsayısı λK",
        formula: "λK = 0,025 · L / a_köprü   (0,05 … 0,20 bandına kırpılır)",
        subst: (x) => `0,025 · ${n(x.specs.spanM)} / ${n(x.inp.bridgeAxleSpacingM)}`,
        digits: 3, standard: "FEM 1.001 2.2.3.3",
      },
      {
        key: "load.bridgeSkew", label: "Köprü Yürüme Yatay Yükü Fhk2", formula: "Fhk2 = (Wv + W1) · λK",
        subst: (x) => `(${n(num(x.c["load.bridgeDeadWeight"]))} + ${n(num(x.c["load.hoistLoad"]))}) · ${n(num(x.c["load.skewFactorBridge"]), 3)}`,
        unit: "kg", standard: "FEM 1.001 2.2.3.3",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "7.3",
    title: "Yükleme Durumları",
    description:
      "FEM 2.3 kombinasyonları: I) γc·(SG + ψ·SL + SH); II) + rüzgar (içeride çalışan vinçte hesaplanmaz); III) test durumları.",
    depKeys: [],
    inputKeys: ["amplifyYcOverride", "dynTestFactorR1", "statTestFactorR2"],
    selectionKeys: [],
    rows: [
      {
        key: "load.amplifyFactor", label: "Arttırma Katsayısı γc",
        formula: "γc = f(çelik yapı sınıfı)",
        subst: (x) => `${x.specs.structureClass} → ${n(num(x.c["load.amplifyFactor"]), 3)}`,
        digits: 3, standard: "FEM 1.001 T.2.3.4",
      },
      {
        key: "stress.amplifiedCombinedBottom", label: "Yükleme Durumu I — Bileşik Gerilme γc·σcomb (Alt)",
        formula: "SI = γc·(SG + ψ·SL + SH)", unit: "kg/cm²", standard: "FEM 1.001 §2.3.1",
      },
      {
        key: "stress.testFactor", label: "Test Katsayısı k (Durum III)", formula: "k = max(ψ·ρ1, ρ2)",
        digits: 3, standard: "FEM 1.001 §2.3.3",
      },
      {
        key: "stress.combinedCase3", label: "Yükleme Durumu III — Bileşik Gerilme (Test)",
        formula: "SIII = test yükleri (ρ1 dinamik / ρ2 statik)", unit: "kg/cm²", standard: "FEM 1.001 §2.3.3",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "7.4",
    title: "Gerilme Analizi",
    description:
      "Bileşen gerilmeler numaralandırılmıştır (σ1…σ10, τ1…τ5): her bileşen önce tek başına, " +
      "sonra alt lif / üst lif ve ana gövde / ikincil gövde toplamlarında görünür. Bileşik " +
      "gerilme her gövde sacı için ayrı hesaplanır, kontrol kritik olan üzerinden yürür.",
    depKeys: [],
    inputKeys: ["railLeverCMm", "diaphragmSpacingMm", "wheelContactHMm", "wheelContactTMm"],
    selectionKeys: ["staticMaterial"],
    rows: [
      // --- Momentler ---
      {
        key: "moment.girderSelfWeight", label: "Kiriş Ağırlığı Momenti My",
        formula: "My = L · Wv / 8  (L mm verildiğinden /80 ile kg·cm)",
        subst: (x) => `${n(x.specs.spanM * 1000)} · ${n(num(x.c["load.bridgeDeadWeight"]))} / 80`, unit: "kg·cm",
      },
      {
        key: "moment.trolleyWheel", label: "Araba Ağırlığı Momenti My",
        formula: "My = b · P_teker  (b mm verildiğinden /10 ile kg·cm)",
        subst: (x) => `${n(num(x.c["geometry.wheelToSupport"]))} · ${n(num(x.c["load.trolleyWheelLoad"]))} / 10`, unit: "kg·cm",
      },
      {
        key: "moment.hoistLoad", label: "Kaldırma Yükü Momenti My",
        formula: "My = b · P_yük  (b mm verildiğinden /10 ile kg·cm)",
        subst: (x) => `${n(num(x.c["geometry.wheelToSupport"]))} · ${n(num(x.c["load.hoistWheelLoad"]))} / 10`, unit: "kg·cm",
      },
      {
        key: "moment.verticalTotal", label: "Toplam Düşey Moment My", formula: "My = My,kiriş + My,araba + My,yük",
        unit: "kg·cm",
      },
      {
        key: "moment.bridgeHorizontal", label: "Köprü Yatay Yükü Momenti Mz", formula: "Mz = L · Fhk1 / 8",
        unit: "kg·cm",
      },
      {
        key: "moment.trolleySkew", label: "Araba Yanal Yükü Momenti Mz", formula: "Mz = a · Fha2 / 2",
        unit: "kg·cm",
      },
      {
        key: "moment.railLever", label: "Ray Kolu Momenti M_ray", formula: "M_ray = c · Fha1",
        unit: "kg·cm",
      },
      {
        key: "moment.secondaryTrolley", label: "İkincil Moment — Araba", formula: "M_sec = l1 · P_araba / 5",
        unit: "kg·cm",
      },
      {
        key: "moment.secondaryHoist", label: "İkincil Moment — Kaldırma Yükü", formula: "M_sec = l1 · P_yük / 5",
        unit: "kg·cm",
      },
      {
        key: "geometry.torsionLever", label: "Burulma Kolu e", formula: "e = Cy − y_ray",
        subst: (x) => `${n(num(x.c["section.centroidY"]))} − ${n(num(x.c["section.railCenterY"]))}`, unit: "mm",
      },
      {
        key: "moment.torsionTrolley", label: "Burulma Momenti — Araba", formula: "T = P_araba · e",
        unit: "kg·cm",
      },
      {
        key: "moment.torsionHoist", label: "Burulma Momenti — Kaldırma Yükü", formula: "T = P_yük · e",
        unit: "kg·cm",
      },

      // --- σx bileşenleri — ALT LİF (çekme) ---
      {
        key: "stress.sigmaXSelfWeightBottom", label: "σ1 · Düşey Eğilme — Kiriş Öz Ağırlığı (Alt Lif)",
        formula: "σ1,alt = My,kiriş / Wyy,alt", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXTrolleyBottom", label: "σ2 · Düşey Eğilme — Araba Ağırlığı (Alt Lif)",
        formula: "σ2,alt = My,araba / Wyy,alt", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXHoistBottom", label: "σ3 · Düşey Eğilme — Kaldırma Yükü (Alt Lif, ×ψ)",
        formula: "σ3,alt = My,yük / Wyy,alt", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXLateralBridgeBottom", label: "σ4 · Yatay Eğilme — Köprü Yatay Yükü (Alt Lif)",
        formula: "σ4,alt = Mz,köprü / Wzz,alt", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXLateralTrolleyBottom", label: "σ5 · Yatay Eğilme — Araba Yanal Yükü (Alt Lif)",
        formula: "σ5,alt = Mz,araba / Wzz,alt", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXRailLeverBottom", label: "σ6 · Ray Kolu / Kaçıklık (Alt Lif)",
        formula: "σ6,alt = M_ray / Wyy,alt", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXSecondaryTrolleyBottom", label: "σ7 · İkincil Moment — Araba (Alt Lif)",
        formula: "σ7,alt = M_sec,araba / (3 · Wyy,alt)", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXSecondaryHoistBottom", label: "σ8 · İkincil Moment — Kaldırma Yükü (Alt Lif, ×ψ)",
        formula: "σ8,alt = M_sec,yük / Wyy,alt", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXBottomCase1", label: "σx,alt TOPLAM — Yükleme Durumu I",
        formula: "σx,alt = σ1 + σ2 + ψ·σ3 + σ4 + σ5 + σ6 + σ7 + ψ·σ8",
        subst: (x) => `${n(num(x.c["stress.sigmaXSelfWeightBottom"]))} + ${n(num(x.c["stress.sigmaXTrolleyBottom"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.sigmaXHoistBottom"]))} + ${n(num(x.c["stress.sigmaXLateralBridgeBottom"]))} + ${n(num(x.c["stress.sigmaXLateralTrolleyBottom"]))} + ${n(num(x.c["stress.sigmaXRailLeverBottom"]))} + ${n(num(x.c["stress.sigmaXSecondaryTrolleyBottom"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.sigmaXSecondaryHoistBottom"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },

      // --- σx bileşenleri — ÜST LİF (basınç) ---
      {
        key: "stress.sigmaXSelfWeightTop", label: "σ1 · Düşey Eğilme — Kiriş Öz Ağırlığı (Üst Lif)",
        formula: "σ1,üst = −My,kiriş / Wyy,üst", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXTrolleyTop", label: "σ2 · Düşey Eğilme — Araba Ağırlığı (Üst Lif)",
        formula: "σ2,üst = −My,araba / Wyy,üst", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXHoistTop", label: "σ3 · Düşey Eğilme — Kaldırma Yükü (Üst Lif, ×ψ)",
        formula: "σ3,üst = −My,yük / Wyy,üst", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXLateralBridgeTop", label: "σ4 · Yatay Eğilme — Köprü Yatay Yükü (Üst Lif)",
        formula: "σ4,üst = Mz,köprü / Wzz,üst", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXLateralTrolleyTop", label: "σ5 · Yatay Eğilme — Araba Yanal Yükü (Üst Lif)",
        formula: "σ5,üst = Mz,araba / Wzz,üst", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXRailLeverTop", label: "σ6 · Ray Kolu / Kaçıklık (Üst Lif)",
        formula: "σ6,üst = M_ray / Wyy,üst", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXSecondaryTrolleyTop", label: "σ7 · İkincil Moment — Araba (Üst Lif)",
        formula: "σ7,üst = −M_sec,araba / (3 · Wyy,üst)", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXSecondaryHoistTop", label: "σ8 · İkincil Moment — Kaldırma Yükü (Üst Lif, ×ψ)",
        formula: "σ8,üst = −M_sec,yük / Wyy,üst", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXTopCase1", label: "σx,üst TOPLAM — Yükleme Durumu I",
        formula: "σx,üst = σ1 + σ2 + ψ·σ3 − σ4 − σ5 − σ6 + σ7 + ψ·σ8",
        subst: (x) => `${n(num(x.c["stress.sigmaXSelfWeightTop"]))} + ${n(num(x.c["stress.sigmaXTrolleyTop"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.sigmaXHoistTop"]))} − ${n(num(x.c["stress.sigmaXLateralBridgeTop"]))} − ${n(num(x.c["stress.sigmaXLateralTrolleyTop"]))} − ${n(num(x.c["stress.sigmaXRailLeverTop"]))} + ${n(num(x.c["stress.sigmaXSecondaryTrolleyTop"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.sigmaXSecondaryHoistTop"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },

      // --- σz bileşenleri (teker basıncı) ---
      {
        key: "geometry.wheelContactLength", label: "Teker Basıncı Yayılım Boyu l",
        formula: "l = 2·h + 40", unit: "mm", digits: 0, standard: "DIN 15018 Şekil 9",
      },
      {
        key: "section.wheelContactWidth", label: "Teker Basıncı Etkin Alanı",
        formula: "A_z = (0,2·h + 5) · t · 0,1", unit: "cm²",
        subst: (x) => `(0,2·${n(x.inp.wheelContactHMm)} + 5) · ${n(x.inp.wheelContactTMm)} · 0,1`,
        standard: "DIN 15018 Şekil 9",
      },
      {
        key: "stress.sigmaZTrolley", label: "σ9 · Teker Basıncı — Araba",
        formula: "σ9 = −(P_araba/2) / A_z", unit: "kg/cm²", standard: "DIN 15018 Şekil 9",
      },
      {
        key: "stress.sigmaZHoist", label: "σ10 · Teker Basıncı — Kaldırma Yükü (×ψ)",
        formula: "σ10 = −(P_yük/2) / A_z", unit: "kg/cm²", standard: "DIN 15018 Şekil 9",
      },
      {
        key: "stress.sigmaZCase1", label: "σz TOPLAM — Yükleme Durumu I", formula: "σz = σ9 + ψ·σ10",
        subst: (x) => `${n(num(x.c["stress.sigmaZTrolley"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.sigmaZHoist"]))}`,
        unit: "kg/cm²", standard: "DIN 15018 Şekil 9",
      },

      // --- Kayma bileşenleri (burulma + kesme) ---
      {
        key: "stress.torsionTrolley", label: "τ1 · Burulma — Araba",
        formula: "τ1 = T_araba / (2·A·t_gövde)", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.torsionHoist", label: "τ2 · Burulma — Kaldırma Yükü (×ψ)",
        formula: "τ2 = T_yük / (2·A·t_gövde)", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.shearMainSelfWeight", label: "τ3 · Kesme — Öz Ağırlık (Ana Gövde)",
        formula: "τ3 = Q_öz / A_gövde", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.shearMainTrolley", label: "τ4 · Kesme — Araba (Ana Gövde)",
        formula: "τ4 = P_araba / A_gövde", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.shearMainHoist", label: "τ5 · Kesme — Kaldırma Yükü (Ana Gövde, ×ψ)",
        formula: "τ5 = P_yük / A_gövde", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.shearMainCase1", label: "τ TOPLAM (Ana Gövde) — Yükleme Durumu I",
        formula: "τ_ana = τ1 + ψ·τ2 + τ3 + τ4 + ψ·τ5",
        subst: (x) => `${n(num(x.c["stress.torsionTrolley"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.torsionHoist"]))} + ${n(num(x.c["stress.shearMainSelfWeight"]))} + ${n(num(x.c["stress.shearMainTrolley"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.shearMainHoist"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.shearSecondarySelfWeight", label: "τ3 · Kesme — Öz Ağırlık (İkincil Gövde)",
        formula: "τ3' = 0,5·Q_öz,pay / A_gövde2", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.shearSecondaryTrolley", label: "τ4 · Kesme — Araba (İkincil Gövde)",
        formula: "τ4' = (P_araba/2) / A_gövde2", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.shearSecondaryHoist", label: "τ5 · Kesme — Kaldırma Yükü (İkincil Gövde, ×ψ)",
        formula: "τ5' = (P_yük/2) / A_gövde2", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.shearSecondaryCase1", label: "τ TOPLAM (İkincil Gövde) — Yükleme Durumu I",
        formula: "τ_ikincil = τ1 + ψ·τ2 + τ3' + τ4' + ψ·τ5'",
        subst: (x) => `${n(num(x.c["stress.torsionTrolley"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.torsionHoist"]))} + ${n(num(x.c["stress.shearSecondarySelfWeight"]))} + ${n(num(x.c["stress.shearSecondaryTrolley"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.shearSecondaryHoist"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },

      // --- γc ile arttırılmış ara değerler ---
      {
        key: "stress.amplifiedSigmaXBottom", label: "γc · σx,alt", formula: "γc · σx,alt",
        subst: (x) => `${n(num(x.c["load.amplifyFactor"]), 3)} · ${n(num(x.c["stress.sigmaXBottomCase1"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.2.3.4",
      },
      {
        key: "stress.amplifiedSigmaXTop", label: "γc · σx,üst", formula: "γc · σx,üst",
        subst: (x) => `${n(num(x.c["load.amplifyFactor"]), 3)} · ${n(num(x.c["stress.sigmaXTopCase1"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.2.3.4",
      },
      {
        key: "stress.amplifiedSigmaZ", label: "γc · σz", formula: "γc · σz",
        subst: (x) => `${n(num(x.c["load.amplifyFactor"]), 3)} · ${n(num(x.c["stress.sigmaZCase1"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.2.3.4",
      },
      {
        key: "stress.amplifiedShearMain", label: "γc · τ (Ana Gövde)", formula: "γc · τ_ana",
        subst: (x) => `${n(num(x.c["load.amplifyFactor"]), 3)} · ${n(num(x.c["stress.shearMainCase1"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.2.3.4",
      },
      {
        key: "stress.amplifiedShearSecondary", label: "γc · τ (İkincil Gövde)", formula: "γc · τ_ikincil",
        subst: (x) => `${n(num(x.c["load.amplifyFactor"]), 3)} · ${n(num(x.c["stress.shearSecondaryCase1"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.2.3.4",
      },

      // --- Bileşik gerilmeler (her gövde sacı için ayrı) ---
      {
        key: "stress.combinedBottomMainCase1", label: "σcomb (Alt Lif · Ana Gövde)",
        formula: "σcomb = √(σx² + σz² − |σx·σz| + 3·τ_ana²)",
        subst: (x) => `√(${n(num(x.c["stress.sigmaXBottomCase1"]))}² + ${n(num(x.c["stress.sigmaZCase1"]))}² − |σx·σz| + 3·${n(num(x.c["stress.shearMainCase1"]))}²)`,
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.3",
      },
      {
        key: "stress.combinedBottomSecondaryCase1", label: "σcomb (Alt Lif · İkincil Gövde)",
        formula: "σcomb = √(σx² + σz² − |σx·σz| + 3·τ_ikincil²)",
        subst: (x) => `√(${n(num(x.c["stress.sigmaXBottomCase1"]))}² + ${n(num(x.c["stress.sigmaZCase1"]))}² − |σx·σz| + 3·${n(num(x.c["stress.shearSecondaryCase1"]))}²)`,
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.3",
      },
      {
        key: "stress.combinedBottomCase1", label: "σcomb (Alt Lif) — Kritik Gövde",
        formula: "σcomb,alt = maks(σcomb,ana ; σcomb,ikincil)",
        subst: (x) => `maks(${n(num(x.c["stress.combinedBottomMainCase1"]))} ; ${n(num(x.c["stress.combinedBottomSecondaryCase1"]))})`,
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.3",
      },
      {
        key: "stress.combinedTopMainCase1", label: "σcomb (Üst Lif · Ana Gövde)",
        formula: "σcomb = √(σx,üst² + σz² − |σx·σz| + 3·τ_ana²)",
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.3",
      },
      {
        key: "stress.combinedTopSecondaryCase1", label: "σcomb (Üst Lif · İkincil Gövde)",
        formula: "σcomb = √(σx,üst² + σz² − |σx·σz| + 3·τ_ikincil²)",
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.3",
      },
      {
        key: "stress.combinedTopCase1", label: "σcomb (Üst Lif) — Kritik Gövde",
        formula: "σcomb,üst = maks(σcomb,ana ; σcomb,ikincil)",
        subst: (x) => `maks(${n(num(x.c["stress.combinedTopMainCase1"]))} ; ${n(num(x.c["stress.combinedTopSecondaryCase1"]))})`,
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.3",
      },
      {
        key: "stress.amplifiedCombinedBottom", label: "γc · σcomb (Alt Lif)", formula: "γc · σcomb,alt",
        subst: (x) => `${n(num(x.c["load.amplifyFactor"]), 3)} · ${n(num(x.c["stress.combinedBottomCase1"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.2.3.4",
      },
      {
        key: "stress.amplifiedCombinedTop", label: "γc · σcomb (Üst Lif)", formula: "γc · σcomb,üst",
        subst: (x) => `${n(num(x.c["load.amplifyFactor"]), 3)} · ${n(num(x.c["stress.combinedTopCase1"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.2.3.4",
      },
      {
        key: "stress.allowableCase1", label: "İzin Gerilmesi — Yükleme Durumu I",
        formula: "σem = σE / 1,5",
        subst: (x) => `${x.sel.staticMaterial} → ${n(num(x.c["stress.allowableCase1"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.3.2.1.1",
      },

      // --- Yükleme Durumu III (test) ---
      {
        key: "stress.testFactor", label: "Test Katsayısı k", formula: "k = max(ψ·ρ1, ρ2)",
        subst: (x) => `max(${n(num(x.c["load.dynamicFactor"]), 2)}·${n(x.inp.dynTestFactorR1)}, ${n(x.inp.statTestFactorR2)})`,
        digits: 3, standard: "FEM 1.001 §2.3.3",
      },
      {
        key: "stress.sigmaXBottomCase3", label: "σx,alt TOPLAM — Yükleme Durumu III",
        formula: "σx,alt = σ1 + σ2 + k·σ3 + σ4 + σ5 + σ6 + σ7 + k·σ8",
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaXTopCase3", label: "σx,üst TOPLAM — Yükleme Durumu III",
        formula: "σx,üst = σ1 + σ2 + k·σ3 − σ4 − σ5 − σ6 + σ7 + k·σ8",
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "stress.sigmaZCase3", label: "σz TOPLAM — Yükleme Durumu III", formula: "σz = σ9 + k·σ10",
        unit: "kg/cm²", standard: "DIN 15018 Şekil 9",
      },
      {
        key: "stress.shearMainCase3", label: "τ TOPLAM (Ana Gövde) — Yükleme Durumu III",
        formula: "τ_ana = τ1 + k·τ2 + τ3 + τ4 + k·τ5", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.shearSecondaryCase3", label: "τ TOPLAM (İkincil Gövde) — Yükleme Durumu III",
        formula: "τ_ikincil = τ1 + k·τ2 + τ3' + τ4' + k·τ5'", unit: "kg/cm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "stress.combinedCase3", label: "σcomb — Yükleme Durumu III (Kritik)",
        formula: "σcomb = maks(alt/üst lif × ana/ikincil gövde)",
        subst: (x) => `maks(${n(num(x.c["stress.combinedBottomCase3"]))} ; ${n(num(x.c["stress.combinedTopCase3"]))})`,
        unit: "kg/cm²", standard: "FEM 1.001 3.2.1.3",
      },
      {
        key: "stress.allowableCase3", label: "İzin Gerilmesi — Yükleme Durumu III",
        formula: "σem = σE / 1,1",
        subst: (x) => `${x.sel.staticMaterial} → ${n(num(x.c["stress.allowableCase3"]))}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.3.2.1.1",
      },
    ],
    table: {
      title: "Gerilme Tablosu — Bileşenler ve Toplamlar",
      headers: [
        "No", "Gerilme", "Etkidiği Yer", "Değer [MPa]",
        "Yükleme Durumu I", "Yükleme Durumu III", "Dayanak",
      ],
      note:
        "“+” bileşenin kombinasyona doğrudan girdiğini, “+ψ” dinamik katsayıyla, " +
        "“+k” test katsayısıyla girdiğini gösterir. Değerler MPa'dır " +
        "(kg/cm² × 0,0980665). σcomb her gövde sacı için ayrı hesaplanır; " +
        "kontrol kritik (en büyük) değer üzerinden yürür.",
      build: (x) => {
        const c = x.c;
        const B1 = "FEM 1.001 3.2.1.1";
        const B2 = "FEM 1.001 3.2.1.2";
        const B3 = "FEM 1.001 3.2.1.3";
        const D9 = "DIN 15018 Şekil 9";
        const rows: (string | number)[][] = [
          ["σ1", "Düşey Eğilme — Kiriş Öz Ağırlığı", "Alt lif (çekme)", mpa(c["stress.sigmaXSelfWeightBottom"]), "+", "+", B1],
          ["σ1", "Düşey Eğilme — Kiriş Öz Ağırlığı", "Üst lif (basınç)", mpa(c["stress.sigmaXSelfWeightTop"]), "+", "+", B1],
          ["σ2", "Düşey Eğilme — Araba Ağırlığı", "Alt lif (çekme)", mpa(c["stress.sigmaXTrolleyBottom"]), "+", "+", B1],
          ["σ2", "Düşey Eğilme — Araba Ağırlığı", "Üst lif (basınç)", mpa(c["stress.sigmaXTrolleyTop"]), "+", "+", B1],
          ["σ3", "Düşey Eğilme — Kaldırma Yükü", "Alt lif (çekme)", mpa(c["stress.sigmaXHoistBottom"]), "+ψ", "+k", B1],
          ["σ3", "Düşey Eğilme — Kaldırma Yükü", "Üst lif (basınç)", mpa(c["stress.sigmaXHoistTop"]), "+ψ", "+k", B1],
          ["σ4", "Yatay Eğilme — Köprü Yatay Yükü", "Alt lif", mpa(c["stress.sigmaXLateralBridgeBottom"]), "+", "+", B1],
          ["σ4", "Yatay Eğilme — Köprü Yatay Yükü", "Üst lif", mpa(c["stress.sigmaXLateralBridgeTop"]), "−", "−", B1],
          ["σ5", "Yatay Eğilme — Araba Yanal Yükü", "Alt lif", mpa(c["stress.sigmaXLateralTrolleyBottom"]), "+", "+", B1],
          ["σ5", "Yatay Eğilme — Araba Yanal Yükü", "Üst lif", mpa(c["stress.sigmaXLateralTrolleyTop"]), "−", "−", B1],
          ["σ6", "Ray Kolu / Kaçıklık", "Alt lif", mpa(c["stress.sigmaXRailLeverBottom"]), "+", "+", B1],
          ["σ6", "Ray Kolu / Kaçıklık", "Üst lif", mpa(c["stress.sigmaXRailLeverTop"]), "−", "−", B1],
          ["σ7", "İkincil Moment — Araba", "Alt lif", mpa(c["stress.sigmaXSecondaryTrolleyBottom"]), "+", "+", B1],
          ["σ7", "İkincil Moment — Araba", "Üst lif", mpa(c["stress.sigmaXSecondaryTrolleyTop"]), "+", "+", B1],
          ["σ8", "İkincil Moment — Kaldırma Yükü", "Alt lif", mpa(c["stress.sigmaXSecondaryHoistBottom"]), "+ψ", "+k", B1],
          ["σ8", "İkincil Moment — Kaldırma Yükü", "Üst lif", mpa(c["stress.sigmaXSecondaryHoistTop"]), "+ψ", "+k", B1],
          ["σ9", "Teker Basıncı — Araba", "Gövde üstü (σz)", mpa(c["stress.sigmaZTrolley"]), "+", "+", D9],
          ["σ10", "Teker Basıncı — Kaldırma Yükü", "Gövde üstü (σz)", mpa(c["stress.sigmaZHoist"]), "+ψ", "+k", D9],
          ["τ1", "Burulma — Araba", "Her iki gövde", mpa(c["stress.torsionTrolley"]), "+", "+", B2],
          ["τ2", "Burulma — Kaldırma Yükü", "Her iki gövde", mpa(c["stress.torsionHoist"]), "+ψ", "+k", B2],
          ["τ3", "Kesme — Öz Ağırlık", "Ana gövde", mpa(c["stress.shearMainSelfWeight"]), "+", "+", B2],
          ["τ3", "Kesme — Öz Ağırlık", "İkincil gövde", mpa(c["stress.shearSecondarySelfWeight"]), "+", "+", B2],
          ["τ4", "Kesme — Araba", "Ana gövde", mpa(c["stress.shearMainTrolley"]), "+", "+", B2],
          ["τ4", "Kesme — Araba", "İkincil gövde", mpa(c["stress.shearSecondaryTrolley"]), "+", "+", B2],
          ["τ5", "Kesme — Kaldırma Yükü", "Ana gövde", mpa(c["stress.shearMainHoist"]), "+ψ", "+k", B2],
          ["τ5", "Kesme — Kaldırma Yükü", "İkincil gövde", mpa(c["stress.shearSecondaryHoist"]), "+ψ", "+k", B2],
          // --- Toplamlar ---
          ["Σ", "σx,alt TOPLAM", "Alt lif", mpa(c["stress.sigmaXBottomCase1"]), mpa(c["stress.sigmaXBottomCase1"]), mpa(c["stress.sigmaXBottomCase3"]), B1],
          ["Σ", "σx,üst TOPLAM", "Üst lif", mpa(c["stress.sigmaXTopCase1"]), mpa(c["stress.sigmaXTopCase1"]), mpa(c["stress.sigmaXTopCase3"]), B1],
          ["Σ", "σz TOPLAM", "Gövde üstü", mpa(c["stress.sigmaZCase1"]), mpa(c["stress.sigmaZCase1"]), mpa(c["stress.sigmaZCase3"]), D9],
          ["Σ", "τ TOPLAM (ana gövde)", "Ana gövde", mpa(c["stress.shearMainCase1"]), mpa(c["stress.shearMainCase1"]), mpa(c["stress.shearMainCase3"]), B2],
          ["Σ", "τ TOPLAM (ikincil gövde)", "İkincil gövde", mpa(c["stress.shearSecondaryCase1"]), mpa(c["stress.shearSecondaryCase1"]), mpa(c["stress.shearSecondaryCase3"]), B2],
          ["σcomb", "Bileşik Gerilme (kritik)", "Alt lif", mpa(c["stress.combinedBottomCase1"]), mpa(c["stress.combinedBottomCase1"]), mpa(c["stress.combinedBottomCase3"]), B3],
          ["σcomb", "Bileşik Gerilme (kritik)", "Üst lif", mpa(c["stress.combinedTopCase1"]), mpa(c["stress.combinedTopCase1"]), mpa(c["stress.combinedTopCase3"]), B3],
          ["γc·σcomb", "Arttırılmış Bileşik Gerilme", "Alt lif", mpa(c["stress.amplifiedCombinedBottom"]), mpa(c["stress.amplifiedCombinedBottom"]), "—", "FEM 1.001 T.2.3.4"],
          ["γc·σcomb", "Arttırılmış Bileşik Gerilme", "Üst lif", mpa(c["stress.amplifiedCombinedTop"]), mpa(c["stress.amplifiedCombinedTop"]), "—", "FEM 1.001 T.2.3.4"],
          ["σem", `İzin Gerilmesi (${x.sel.staticMaterial})`, "—", mpa(c["stress.allowableCase1"]), mpa(c["stress.allowableCase1"]), mpa(c["stress.allowableCase3"]), "FEM 1.001 T.3.2.1.1"],
        ];
        return rows;
      },
    },
    checkSuffixes: ["stress.case1", "stress.case3"],
  },
  {
    id: "7.5",
    title: "Yorulma Kontrolü",
    description:
      "DIN 15018 Tablo 17/18 izin gerilmeleri, κ oranları ve bileşik yorulma. " +
      "σx, σy ve τ değerleri ELLE GİRİLMEZ: hepsi 7.4 gerilme analizinden gelir " +
      "(gerekirse elle ezilebilir).",
    depKeys: [],
    inputKeys: ["sigmaYMaxOverrideNmm2", "sigmaYMinOverrideNmm2", "fatigueTensileOverrideNmm2"],
    selectionKeys: ["fatigueMaterial", "fatigueLoadGroupOverride", "fatigueNotchClass"],
    rows: [
      {
        key: "fatigue.sigmaXMax", label: "σx,maks", formula: "σx,maks = σx,alt(I) / 9,81",
        subst: (x) => `${n(num(x.c["stress.sigmaXBottomCase1"]))} / 9,81`, unit: "N/mm²",
        standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "fatigue.sigmaXMin", label: "σx,min", formula: "σx,min = σ1 (yalnız öz ağırlık) / 9,81",
        subst: (x) => `${n(num(x.c["stress.sigmaXSelfWeightBottom"]))} / 9,81`, unit: "N/mm²",
        standard: "FEM 1.001 3.2.1.1",
      },
      {
        key: "fatigue.sigmaYMax", label: "σy,maks", formula: "σy,maks = |σz(I)| / 9,81",
        subst: (x) => `|${n(num(x.c["stress.sigmaZCase1"]))}| / 9,81`, unit: "N/mm²",
        standard: "DIN 15018 Şekil 9",
      },
      {
        key: "fatigue.sigmaYMin", label: "σy,min", formula: "σy,min = |σ9 (araba, ψ'siz)| / 9,81",
        subst: (x) => `|${n(num(x.c["stress.sigmaZTrolley"]))}| / 9,81`, unit: "N/mm²",
        standard: "DIN 15018 Şekil 9",
      },
      {
        key: "fatigue.tauMax", label: "τ,maks", formula: "τ,maks = maks(τ_ana(I) ; τ_ikincil(I)) / 9,81",
        subst: (x) => `maks(${n(num(x.c["stress.shearMainCase1"]))} ; ${n(num(x.c["stress.shearSecondaryCase1"]))}) / 9,81`,
        unit: "N/mm²", standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "fatigue.tauMin", label: "τ,min", formula: "τ,min = τ3 (yalnız öz ağırlık) / 9,81",
        subst: (x) => `${n(num(x.c["stress.shearMainSelfWeight"]))} / 9,81`, unit: "N/mm²",
        standard: "FEM 1.001 3.2.1.2",
      },
      {
        key: "fatigue.tensileStrength", label: "Kopma Dayanımı σB",
        formula: "σB = f(yorulma malzemesi)",
        subst: (x) => `${x.sel.fatigueMaterial} → ${n(num(x.c["fatigue.tensileStrength"]))}`,
        unit: "N/mm²",
      },
      {
        key: "fatigue.allowableD1", label: "zul σD(-1)", formula: "T17(malzeme, çentik, yük grubu)",
        subst: (x) => `${x.sel.fatigueMaterial} / ${x.sel.fatigueNotchClass} / ${x.c["fatigue.loadGroup"]} → ${n(num(x.c["fatigue.allowableD1"]))}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.allowableDz0", label: "zul σDz(0)", formula: "zul σDz(0) = zul σD(-1) · 5/3",
        subst: (x) => `${n(num(x.c["fatigue.allowableD1"]))} · 5/3`, unit: "N/mm²",
        standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.kappaX", label: "κ (σx)", formula: "κ = σx,min / σx,maks",
        subst: (x) => `${n(num(x.c["fatigue.sigmaXMin"]))} / ${n(num(x.c["fatigue.sigmaXMax"]))}`, digits: 3,
        standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.allowableSigmaX", label: "zul σDz(κ) — σx",
        formula: "zul σDz(κ) = zul σDz(0) / (1 − (1 − zul σDz(0)/(0,75·σB)) · κ)",
        subst: (x) => `${n(num(x.c["fatigue.allowableDz0"]))} / (1 − (1 − ${n(num(x.c["fatigue.allowableDz0"]))}/(0,75·${n(num(x.c["fatigue.tensileStrength"]))})) · ${n(num(x.c["fatigue.kappaX"]), 3)})`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.kappaY", label: "κ (σy)", formula: "κ = σy,min / σy,maks",
        subst: (x) => `${n(num(x.c["fatigue.sigmaYMin"]))} / ${n(num(x.c["fatigue.sigmaYMax"]))}`, digits: 3,
        standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.allowableSigmaY", label: "zul σDz(κ) — σy", unit: "N/mm²",
        formula: "zul σDz(κ) = zul σDz(0) / (1 − (1 − zul σDz(0)/(0,75·σB)) · κ)",
        standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.allowableTauW0", label: "zul σD(-1) — W0 (Kayma İçin)", formula: "T17(malzeme, W0, yük grubu)",
        subst: (x) => `${x.sel.fatigueMaterial} / W0 / ${x.c["fatigue.loadGroup"]} → ${n(num(x.c["fatigue.allowableTauW0"]))}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.kappaTau", label: "κ (τ)", formula: "κ = τ,min / τ,maks",
        subst: (x) => `${n(num(x.c["fatigue.tauMin"]))} / ${n(num(x.c["fatigue.tauMax"]))}`, digits: 3,
        standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.allowableTau", label: "zul τD(κ)",
        formula: "zul τD(κ) = zul σDz,W0(κ) / √3",
        subst: (x) => `zul σDz,W0(${n(num(x.c["fatigue.kappaTau"]), 3)}) / √3`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.combined", label: "Bileşik Yorulma Oranı",
        formula: "(σx/zul σx)² + (σy/zul σy)² − σx·σy/(zul σx·zul σy) + (τ/zul τ)² ≤ 1,1",
        subst: (x) => `(${n(num(x.c["fatigue.sigmaXMax"]))}/${n(num(x.c["fatigue.allowableSigmaX"]))})² + (${n(num(x.c["fatigue.sigmaYMax"]))}/${n(num(x.c["fatigue.allowableSigmaY"]))})² − … + (${n(num(x.c["fatigue.tauMax"]))}/${n(num(x.c["fatigue.allowableTau"]))})²`,
        digits: 4, standard: "DIN 15018 7.4.5",
      },
    ],
    checkSuffixes: ["fatigue.sigmaX", "fatigue.sigmaY", "fatigue.tau", "fatigue.combined"],
  },
  {
    id: "7.6",
    title: "Sehim Kontrolü",
    description:
      "Sehim, YALNIZ canlı yükün (araba + nominal kaldırma yükü) oluşturduğu " +
      "düşey çökmedir; darbe/dinamik katsayı girmez. Kullanılabilirlik ölçütü " +
      "L/δ oranıdır — oran seçilen sınırdan büyük olmalıdır (ör. δ ≤ L/1000).",
    depKeys: [],
    inputKeys: ["deflectionLimitRatio"],
    selectionKeys: [],
    rows: [
      {
        key: "deflection.wheelLoad", label: "Tekerlek Yükü (Canlı)", formula: "P = P_araba + P_yük",
        subst: (x) => `${n(num(x.c["load.trolleyWheelLoad"]))} + ${n(num(x.c["load.hoistWheelLoad"]))}`, unit: "kg",
      },
      {
        key: "deflection.value", label: "Canlı Yük Sehimi δ (Açıklık Ortası)",
        formula: "δ = P·b·(3·L² − 4·b²) / (24 · E · I) · 10   [cm → mm]",
        subst: (x) => `${n(num(x.c["deflection.wheelLoad"]))}·${n(num(x.c["deflection.loadOffset"]))}·(3·${n(num(x.c["deflection.span"]))}² − 4·${n(num(x.c["deflection.loadOffset"]))}²) / (24 · 2100000 · ${n(num(x.c["section.inertiaY"]))}) · 10`,
        unit: "mm", digits: 2,
      },
      {
        key: "deflection.ratio", label: "Sehim Oranı (L/δ)", formula: "L / δ   (ikisi de mm)",
        subst: (x) => `${n(num(x.c["deflection.spanMm"]))} / ${n(num(x.c["deflection.value"]), 2)}`, digits: 0,
        standard: "CMAA 70 3.5.5.1",
      },
    ],
    checkSuffixes: ["deflection"],
  },
  {
    id: "7.7",
    title: "Ters Sehim",
    description:
      "Ters sehim, kirişe imalatta verilen yukarı yönlü ön eğriliktir; uygunluk " +
      "kontrolü değil imalat ölçüsüdür. CMAA 70 md. 3.5.5.2 uyarınca kutu " +
      "kirişler ölü yük sehimi ile canlı yük sehiminin yarısı toplamı kadar " +
      "kamberlenir:  kesimde(x) = δ_ölü(x) + δ_canlı(x)/2.  Kiriş üretilip iki " +
      "ucundan mesnetlendiğinde kendi ağırlığıyla δ_ölü(x) kadar çöker; geriye " +
      "kalan  mesnette(x) = kesimde(x) − δ_ölü(x) = δ_canlı(x)/2  değeridir. " +
      "Ölü yük terimi bu farkta sadeleşir; dolayısıyla mesnette kotu yalnız " +
      "canlı yüke ve kesit ataletine bağlıdır, ölü yük değişince değişmez. " +
      "KESİMDE kotları gövde saclarının kesim hattının ve spot ayarının " +
      "belirlenmesinde kullanılır; MESNETTE kotları kirişin mesnetlenmiş " +
      "hâldeki ölçüm verisidir. Kotlar açıklık ortasından başlayıp sağa ve sola " +
      "perde aralığınca, her perde ekseninde verilir.",
    depKeys: [],
    inputKeys: ["camberExtraDeadLoadKgPerM"],
    selectionKeys: [],
    rows: [
      {
        key: "camber.diaphragmThickness", label: "Perde Sacı Kalınlığı (En İnce Kutu Sacı)",
        formula: "t_perde = min(t2 ; t3 ; t4 ; t5)",
        subst: (x) => `min(${n(x.inp.t2Mm)} ; ${n(x.inp.t3Mm)} ; ${n(x.inp.t4Mm)} ; ${n(x.inp.t5Mm)})`,
        unit: "mm", digits: 0,
      },
      {
        key: "camber.diaphragmMass", label: "Bir Perdenin Ağırlığı",
        formula: "G_perde = a · h3 · t_perde · ρ",
        subst: (x) => `${n(x.inp.aMm)} · ${n(x.inp.h3Mm)} · ${n(num(x.c["camber.diaphragmThickness"]), 0)} · 8,0 / 10⁶`,
        unit: "kg", digits: 2,
      },
      {
        key: "camber.diaphragmPerM", label: "Perdelerin Yayılı Karşılığı",
        formula: "w_perde = n_perde · G_perde / L",
        subst: (x) => `${n(num(x.c["camber.diaphragmCount"]), 0)} · ${n(num(x.c["camber.diaphragmMass"]), 2)} / ${n(x.specs.spanM)}`,
        unit: "kg/m", digits: 2,
      },
      {
        key: "camber.railPerM", label: "Ray Metre Ağırlığı",
        formula: "w_ray = f(ray tipi)   [DIN 536-1 / kesit alanı]",
        subst: (x) => `${x.deps.trolleyRailCode || "—"} → ${n(num(x.c["camber.railPerM"]), 2)}`,
        unit: "kg/m", digits: 2,
      },
      {
        key: "camber.deadLoadPerM", label: "Ölü Yük w (Kesit + Perde + Ray + İlave)",
        formula: "w = G_kesit + w_perde + w_ray + w_ilave",
        subst: (x) =>
          `${n(num(x.c["section.weightPerLength"]), 2)} + ${n(num(x.c["camber.diaphragmPerM"]), 2)}` +
          ` + ${n(num(x.c["camber.railPerM"]), 2)} + ${n(num(x.inp.camberExtraDeadLoadKgPerM))}`,
        unit: "kg/m", digits: 2,
      },
      {
        key: "camber.girderTotalWeight", label: "Bir Ana Kirişin Toplam Ağırlığı",
        formula: "G_kiriş = w · L", unit: "kg", digits: 0,
      },
      {
        key: "camber.deadValue", label: "Ölü Yük Sehimi δ_ölü (Açıklık Ortası)",
        formula: "δ_ölü = 5 · w · L⁴ / (384 · E · I)",
        unit: "mm", digits: 2,
      },
      {
        key: "camber.cutting", label: "KESİMDE Ters Sehim (Açıklık Ortası)",
        formula: "kesimde = δ_ölü + δ / 2",
        subst: (x) => `${n(num(x.c["camber.deadValue"]), 2)} + ${n(num(x.c["deflection.value"]), 2)} / 2`,
        unit: "mm", digits: 2, standard: "CMAA 70 3.5.5.2",
      },
      {
        key: "camber.supported", label: "MESNETTE Ters Sehim (Açıklık Ortası)",
        formula: "mesnette = kesimde − δ_ölü = δ / 2",
        subst: (x) => `${n(num(x.c["camber.cutting"]), 2)} − ${n(num(x.c["camber.deadValue"]), 2)}`,
        unit: "mm", digits: 2, standard: "CMAA 70 3.5.5.2",
      },
      {
        key: "camber.stationSpacing", label: "Perde Aralığı (Kot Adımı)",
        formula: "l1   (girdiden)", unit: "mm", digits: 0,
      },
    ],
    table: {
      title: "Kamber Şeridi — Perde Eksenlerinde Ters Sehim Kotları",
      headers: [
        "Perde", "Sol Mesnetten [mm]", "Ortadan [mm]",
        "Canlı Sehim [mm]", "Ölü Sehim [mm]", "KESİMDE [mm]", "MESNETTE [mm]",
      ],
      note:
        "Perde kodları soldan sağa tekildir: M1 sol mesnet, P1…Pn perdeler, " +
        "O açıklık ortası, M2 sağ mesnet. Uçlarda (teker ekseni) tüm kotlar " +
        "sıfırdır. KESİMDE = δ_ölü + δ_canlı/2 (CMAA 70 3.5.5.2) — kesim hattı " +
        "ve spot ayarı verisi. MESNETTE = δ_canlı/2 — kiriş mesnetlendiğinde " +
        "ölçüm verisi. Kotlar yukarı yönde (ters sehim) pozitiftir.",
      build: (x) => camberRows(x),
    },
    // Kamber bir uygunluk ölçütü değil imalat ölçüsüdür — kontrolü yoktur.
    checkSuffixes: [],
  },
];

/**
 * Kamber şeridi satırları — motorun sakladığı skalerlerden değil, aynı saf
 * `camberProfile()` fonksiyonundan üretilir; böylece tablo ile hesap satırları
 * tek kaynaktan gelir ve ayrışamaz.
 */
function camberRows(x: GirderCtx): (string | number)[][] {
  const spanCm = num(x.c["deflection.span"]);
  const inertia = num(x.c["section.inertiaY"]);
  const wheelLoad = num(x.c["deflection.wheelLoad"]);
  const deadPerM = num(x.c["camber.deadLoadPerM"]);
  if (![spanCm, inertia, wheelLoad, deadPerM].every(Number.isFinite)) return [];

  const profile = camberProfile(
    {
      spanCm,
      deadLoadPerCm: deadPerM / 100, // kg/m → kg/cm
      wheelLoadKg: wheelLoad,
      wheelSpacingCm: x.inp.trolleyAxleSpacingM * 100, // m → cm
      elasticModulus: GIRDER_ELASTIC_MODULUS_KG_CM2,
      inertiaCm4: inertia,
    },
    x.inp.diaphragmSpacingMm
  );
  const mm = (v: number) => Number(v.toFixed(1));
  return profile.stations.map((st) => [
    st.code,
    Math.round(st.xMm),
    Math.round(st.fromCenterMm),
    mm(st.liveMm),
    mm(st.deadMm),
    mm(st.cuttingMm),
    mm(st.supportedMm),
  ]);
}

// Teker yükleri sunum katmanı: raporun 10.1 … 10.5 bölümleri.
// Hesap wheelLoads.ts'tedir; burası yalnız gösterimdir.
//
// Satırlar motorun semantik anahtarlarını (`<blok>.<büyüklük>`) okur.
// Kuvvetler kN cinsinden gösterilir: bu bölümün muhatabı yol kirişini boyutlayan
// yapı mühendisidir ve tabloyu kN olarak bekler.

import type {
  WheelLoadDeps,
  WheelLoadInputs,
  WheelLoadSelections,
  WheelLoadValues,
} from "../modules/wheelLoads";
import { WHEEL_PAIR_MODE_LABELS } from "./wheelLoadFields";
import type { TechnicalSpecs } from "../types";

export interface WheelLoadCtx {
  c: Record<string, number | string>; // motorun ürettiği değerler
  v: WheelLoadValues;
  inp: WheelLoadInputs;
  sel: WheelLoadSelections;
  deps: WheelLoadDeps;
  specs: TechnicalSpecs;
}

export interface WheelLoadRowDef {
  key: string;
  label: string;
  formula?: string;
  subst?: (ctx: WheelLoadCtx) => string;
  unit?: string;
  digits?: number;
  standard?: string;
}

export interface WheelLoadTableDef {
  title: string;
  headers: string[];
  build: (ctx: WheelLoadCtx) => (string | number)[][];
  note?: string;
}

export interface WheelLoadSectionDef {
  id: string; // "10.1"
  title: string;
  description?: string;
  depKeys: (keyof WheelLoadDeps & string)[];
  inputKeys: (keyof WheelLoadInputs & string)[];
  selectionKeys: (keyof WheelLoadSelections & string)[];
  rows: WheelLoadRowDef[];
  table?: WheelLoadTableDef;
  /**
   * Bölümün girdi alanlarından önce çizilecek özel düzenleyici. Jenerik alan
   * ızgarasıyla anlatılamayan geometriler için (teker düzeni ölçü zinciri)
   * arayüz tarafında adanmış bir bileşen çizilir.
   */
  editor?: "wheelSpacing";
  /** Bölüm başlığında gösterilen kullanıcı ölçü onayı. */
  confirmation?: {
    inputKey: keyof WheelLoadInputs & string;
    actionLabel: string;
    confirmedLabel: string;
    warning: string;
  };
  /** "wheelLoads." öneki hariç kontrol id sonekleri */
  checkSuffixes: string[];
}

const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (!Number.isFinite(v)) return "?";
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};
const num = (v: number | string | undefined): number =>
  typeof v === "number" ? v : NaN;
/** N → kN, tabloda gösterim için */
const kN = (v: number, d = 1): string => n(v / 1000, d);
/** kg cinsinden bir kuvveti kN'a çevirir (1 kgf = 9,81 N) */
const kgToKn = (kg: number): number => (kg * 9.81) / 1000;

export const WHEELLOAD_SECTIONS: WheelLoadSectionDef[] = [
  {
    id: "10.1",
    title: "Vinç Verileri ve Teker Düzeni",
    description:
      "Ağırlıklar, hızlar, teker adedi ve ray teknik özelliklerden ve köprü " +
      "yürütme bölümünden otomatik okunur. Burada yalnız yol kirişi geometrisine " +
      "ve yanal kılavuzlamaya ait büyüklükler girilir.",
    depKeys: [
      "wheelCount",
      "drivenWheels",
      "hoistLoadT",
      "trolleyWeightT",
      "bridgeWeightT",
      "minApproachM",
      "travelSpeedMpm",
      "accelerationMs2",
      "railCode",
    ],
    inputKeys: [
      "guideSpacingMm",
      "guideClearanceMm",
      "coupledPairCount",
      "creepSpeedMpm",
    ],
    selectionKeys: ["guideMeans", "wheelPairMode"],
    editor: "wheelSpacing",
    confirmation: {
      inputKey: "measurementsConfirmed",
      actionLabel: "Ölçü Onayı Ver",
      confirmedLabel: "Ölçüler Onaylandı",
      warning:
        "Teker düzeni ölçüleri kullanıcı tarafından onaylanmadı; bölüm uygun değildir.",
    },
    rows: [
      {
        key: "wheelSet.measurementsConfirmed",
        label: "Kullanıcı Ölçü Onayı",
      },
      {
        key: "vertical.hoistLoad",
        label: "Kaldırma Yükü SL",
        formula: "SL = kapasite + kanca bloğu + halat",
        subst: (x) => `${n(x.deps.hoistLoadT, 3)} t`,
        unit: "kg",
        standard: "FEM 1.001 9.3",
      },
      {
        key: "vertical.deadLoad",
        label: "Ölü Yük SG (Köprü + Arabalar)",
        formula: "SG = G_köprü + G_araba",
        subst: (x) =>
          `(${n(x.deps.bridgeWeightT, 3)} + ${n(x.deps.trolleyWeightT, 3)}) · 1000`,
        unit: "kg",
      },
      {
        key: "vertical.totalLoad",
        label: "Toplam Yüklü Ağırlık",
        formula: "m = SG + SL",
        subst: (x) => `${n(num(x.c["vertical.deadLoad"]))} + ${n(num(x.c["vertical.hoistLoad"]))}`,
        unit: "kg",
      },
      {
        key: "wheelSet.total",
        label: "Toplam Teker Adedi",
        formula: "Vinç dört köşesinde eşit tekerle yürür → adet dördün katıdır",
        subst: (x) => `köprü yürütmeden: ${n(x.deps.wheelCount)}`,
      },
      {
        key: "wheelSet.perCorner",
        label: "Köşe Başına Teker Adedi",
        formula: "toplam / 4",
        subst: (x) => `${n(x.v.totalWheels)} / 4`,
      },
      {
        key: "wheelSet.perSide",
        label: "Ray Başına Teker Adedi n",
        formula: "n = toplam / 2",
        subst: (x) => `${n(x.v.totalWheels)} / 2 → ${x.v.codes.join(", ")}`,
      },
      {
        key: "wheelSet.wheelbase",
        label: "Dingil Mesafesi",
        formula: "ilk ve son teker ekseni arası = Σ (ardışık mesafeler)",
        subst: (x) => x.v.spacingsMm.map((s) => n(s, 0)).join(" + "),
        unit: "mm",
        standard: "FEM 1.001 9.4.1.5",
      },
      {
        key: "wheelSet.railHeadWidth",
        label: "Ray Başı Genişliği b",
        formula: "seçilen köprü rayının anma baş genişliği",
        subst: (x) => `${x.deps.railCode}`,
        unit: "mm",
      },
      {
        key: "wheelSet.sumDistance",
        label: "Teker Mesafeleri Toplamı Σdᵢ",
        formula: "Σdᵢ = d₁ + d₂ + … + dₙ   (dᵢ: kılavuz elemandan uzaklık)",
        subst: (x) => x.v.positionsM.map((d) => n(d, 3)).join(" + "),
        unit: "m",
        digits: 3,
        standard: "FEM 1.001 9.4.1.3",
      },
      {
        key: "wheelSet.sumDistanceSq",
        label: "Mesafe Kareleri Toplamı Σdᵢ²",
        formula: "Σdᵢ² = d₁² + d₂² + … + dₙ²",
        subst: (x) => x.v.positionsM.map((d) => `${n(d, 3)}²`).join(" + "),
        unit: "m²",
        digits: 3,
      },
      {
        key: "wheelSet.coupledPairs",
        label: "Bağlı Teker Çifti Adedi p",
        subst: (x) =>
          x.inp.coupledPairAuto
            ? `otomatik · ${WHEEL_PAIR_MODE_LABELS[x.sel.wheelPairMode]?.split(" — ")[0] ?? x.sel.wheelPairMode} · tahrikli teker ${n(x.deps.drivenWheels)} → ${n(x.v.coupledPairs)}`
            : `elle girildi → ${n(x.v.coupledPairs)}`,
        standard: "FEM 1.001 9.4.1.3",
      },
    ],
    checkSuffixes: ["measurements.confirmed"],
  },
  {
    id: "10.2",
    title: "Düşey Teker Yükleri",
    description:
      "Araba en yakın konumdayken maksimum, karşı uçtayken minimum teker yükü. " +
      "Köprü kendi ağırlığını iki raya eşit paylaştırır. Değerler karakteristiktir; " +
      "tasarım değeri φ2 ile büyütülmüş kaldırma yükünü içerir.",
    depKeys: ["minApproachM"],
    inputKeys: ["creepSpeedMpm"],
    selectionKeys: ["hoistingClass", "hoistDriveClass"],
    rows: [
      {
        key: "vertical.nearLever",
        label: "Yakın Ray Kol Oranı",
        formula: "(l − e) / l",
        subst: (x) =>
          `(${n(x.specs.spanM, 3)} − ${n(x.deps.minApproachM, 3)}) / ${n(x.specs.spanM, 3)}`,
        digits: 4,
      },
      {
        key: "vertical.maxWheelLoad",
        label: "Maksimum Teker Yükü Pmaks",
        formula: "Pmaks = [ (SL + G_araba)·(l − e)/l + G_köprü/2 ] / n",
        subst: (x) =>
          `[ (${n(num(x.c["vertical.hoistLoad"]))} + ${n(x.deps.trolleyWeightT * 1000)}) · ${n(num(x.c["vertical.nearLever"]), 4)} + ${n((x.deps.bridgeWeightT * 1000) / 2)} ] / ${n(x.v.wheelsPerSide)}`,
        unit: "kg",
      },
      {
        key: "vertical.minWheelLoad",
        label: "Minimum Teker Yükü Pmin (Yüklü)",
        formula: "Pmin = [ (SL + G_araba)·e/l + G_köprü/2 ] / n",
        subst: (x) =>
          `[ (${n(num(x.c["vertical.hoistLoad"]))} + ${n(x.deps.trolleyWeightT * 1000)}) · ${n(x.deps.minApproachM / x.specs.spanM, 4)} + ${n((x.deps.bridgeWeightT * 1000) / 2)} ] / ${n(x.v.wheelsPerSide)}`,
        unit: "kg",
      },
      {
        key: "vertical.minUnloadedWheelLoad",
        label: "Minimum Teker Yükü (Yüksüz Vinç)",
        formula: "Pmin,0 = [ G_araba·e/l + G_köprü/2 ] / n",
        subst: (x) =>
          `[ ${n(x.deps.trolleyWeightT * 1000)} · ${n(x.deps.minApproachM / x.specs.spanM, 4)} + ${n((x.deps.bridgeWeightT * 1000) / 2)} ] / ${n(x.v.wheelsPerSide)}`,
        unit: "kg",
      },
      {
        key: "dynamic.hoistSpeed",
        label: "Kaldırma Hızı νh",
        formula: "T.9.3.b: tahrik sınıfına göre νh,maks / νh,sürünme / 0,5·νh,maks",
        subst: (x) =>
          `${x.sel.hoistDriveClass} · vmaks ${n(x.specs.mainLiftSpeedMpm)} m/dak · vsürünme ${n(x.inp.creepSpeedMpm)} m/dak`,
        unit: "m/s",
        digits: 4,
        standard: "FEM 1.001 T.9.3.b",
      },
      {
        key: "dynamic.phi2",
        label: "Dinamik Katsayı φ2",
        formula: "φ2 = φ2min + β2 · νh",
        subst: (x) =>
          `${x.sel.hoistingClass}: ${n(num(x.c["dynamic.phi2Min"]), 2)} + ${n(num(x.c["dynamic.beta2"]), 2)} · ${n(num(x.c["dynamic.hoistSpeed"]), 4)}`,
        digits: 4,
        standard: "FEM 1.001 T.9.3.a",
      },
      {
        key: "vertical.designWheelLoad",
        label: "Tasarım Teker Yükü Pmaks,d",
        formula: "Pmaks,d = [ φ2·SL·(l−e)/l + G_araba·(l−e)/l + G_köprü/2 ] / n",
        subst: (x) =>
          `[ ${n(num(x.c["dynamic.phi2"]), 4)} · ${n(num(x.c["vertical.hoistLoad"]))} · ${n(num(x.c["vertical.nearLever"]), 4)} + ${n(x.deps.trolleyWeightT * 1000)} · ${n(num(x.c["vertical.nearLever"]), 4)} + ${n((x.deps.bridgeWeightT * 1000) / 2)} ] / ${n(x.v.wheelsPerSide)}`,
        unit: "kg",
        standard: "FEM 1.001 2.3.1",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "10.3",
    title: "Enine Yatay Kuvvetler — Savrulma",
    description:
      "Vinç yürürken raya göre α açısı kadar savrulur; kılavuz eleman ile ray " +
      "arasında bir kılavuz kuvveti, tekerlerde ise enine ve boyuna teğetsel " +
      "kuvvetler doğar. Kuvvetler anlık kayma kutbu etrafındaki dönmeden çıkar.",
    depKeys: [],
    // Kılavuz geometrisi ve düzen seçimi 10.1'de BİR KEZ girilir. Bu bölüm
    // aynı değerleri yalnız hesapta kullanır; tekrar kutu açmaz.
    inputKeys: [],
    selectionKeys: [],
    rows: [
      {
        key: "skew.alphaGuide",
        label: "Kılavuz Boşluğu Payı αg",
        formula: "αg = sg / wb   (sg = 2 · tek taraf boşluk)",
        subst: (x) =>
          `2 · ${n(x.inp.guideClearanceMm)} / ${n(x.inp.guideSpacingAuto ? x.v.wheelbaseMm : x.inp.guideSpacingMm)}`,
        unit: "mrad",
        digits: 3,
        standard: "FEM 1.001 9.4.1.5",
      },
      {
        key: "skew.alphaWear",
        label: "Aşınma Payı αw",
        formula: "αw = 0,1 · b / wb",
        subst: (x) =>
          `0,1 · ${n(x.v.railHeadWidthMm)} / ${n(x.inp.guideSpacingAuto ? x.v.wheelbaseMm : x.inp.guideSpacingMm)}`,
        unit: "mrad",
        digits: 3,
        standard: "FEM 1.001 9.4.1.5",
      },
      {
        key: "skew.alphaTolerance",
        label: "Tolerans Payı αt",
        formula: "αt = 1 mrad (0,001 rad — sabit)",
        unit: "mrad",
        digits: 3,
        standard: "FEM 1.001 9.4.1.5",
      },
      {
        key: "skew.angle",
        label: "Savrulma Açısı α",
        formula: "α = αg + αw + αt ≤ 15 mrad (0,015 rad)",
        subst: (x) =>
          `${n(num(x.c["skew.alphaGuide"]), 3)} + ${n(num(x.c["skew.alphaWear"]), 3)} + ${n(num(x.c["skew.alphaTolerance"]), 3)}`,
        unit: "mrad",
        digits: 3,
        standard: "FEM 1.001 9.4.1.5",
      },
      {
        key: "skew.friction",
        label: "Sürtünme Fonksiyonu f",
        formula: "f = 0,3 · (1 − e^(−250·α))   (α radyan)",
        subst: (x) => `0,3 · (1 − e^(−250 · ${n(num(x.c["skew.angle"]) / 1000, 5)}))`,
        digits: 4,
        standard: "FEM 1.001 9.4.1.3",
      },
      {
        key: "skew.weightForce",
        label: "Yüklü Vinç Ağırlık Kuvveti mg",
        formula: "mg = m · 9,81",
        subst: (x) => `${n(num(x.c["vertical.totalLoad"]))} · 9,81 / 1000`,
        unit: "kN",
      },
      {
        key: "skew.muPrime",
        label: "Yakın Rayın Yük Payı µ'",
        formula: "µ' = Σ(yakın ray teker yükü) / m   ·   µ = 1 − µ'",
        subst: (x) =>
          `${n(num(x.c["vertical.maxWheelLoad"]))} · ${n(x.v.wheelsPerSide)} / ${n(num(x.c["vertical.totalLoad"]))}`,
        digits: 4,
        standard: "FEM 1.001 9.4.1.3",
      },
      {
        key: "skew.poleDistance",
        label: "Anlık Kayma Kutbu Uzaklığı h",
        formula: "h = (p·µ·µ'·l² + Σdᵢ²) / Σdᵢ",
        subst: (x) =>
          `(${n(x.v.coupledPairs)} · ${n(num(x.c["skew.mu"]), 4)} · ${n(num(x.c["skew.muPrime"]), 4)} · ${n(x.specs.spanM, 3)}² + ${n(num(x.c["wheelSet.sumDistanceSq"]), 3)}) / ${n(num(x.c["wheelSet.sumDistance"]), 3)}`,
        unit: "m",
        digits: 3,
        standard: "FEM 1.001 9.4.1.3",
      },
      {
        key: "skew.nu",
        label: "Kılavuz Kuvveti Katsayısı ν",
        formula: "ν = 1 − Σdᵢ / (n·h)",
        subst: (x) =>
          `1 − ${n(num(x.c["wheelSet.sumDistance"]), 3)} / (${n(x.v.wheelsPerSide)} · ${n(num(x.c["skew.poleDistance"]), 3)})`,
        digits: 4,
        standard: "FEM 1.001 9.4.1.3",
      },
      {
        key: "skew.xi",
        label: "Boyuna Kuvvet Katsayısı ξ",
        formula: "ξ = µ·µ'·l / (n·h)   (bağımsız teker çiftinde ξ = 0)",
        subst: (x) =>
          `${n(num(x.c["skew.mu"]), 4)} · ${n(num(x.c["skew.muPrime"]), 4)} · ${n(x.specs.spanM, 3)} / (${n(x.v.wheelsPerSide)} · ${n(num(x.c["skew.poleDistance"]), 3)})`,
        digits: 5,
        standard: "FEM 1.001 T.9.4",
      },
      {
        key: "skew.guideForce",
        label: "Kılavuz Kuvveti S",
        formula: "S = ν · f · mg",
        subst: (x) =>
          `${n(num(x.c["skew.nu"]), 4)} · ${n(num(x.c["skew.friction"]), 4)} · ${n(num(x.c["skew.weightForce"]), 1)}`,
        unit: "kN",
        standard: "FEM 1.001 9.4.1.3",
      },
      {
        key: "skew.guideForceBalance",
        label: "Teker Kuvvetleri Toplamı ΣFy",
        formula: "ΣFy = Σ(Fy1ᵢ + Fy2ᵢ)   —   S ile aynı olmalıdır",
        unit: "kN",
      },
      {
        key: "skew.maxLateralNear",
        label: "En Büyük Enine Teker Kuvveti Fy1",
        formula: "Fy1ᵢ = (µ'/n)·(1 − dᵢ/h) · f · mg",
        subst: (x) =>
          `(${n(num(x.c["skew.muPrime"]), 4)}/${n(x.v.wheelsPerSide)}) · (1 − 0/${n(num(x.c["skew.poleDistance"]), 3)}) · ${n(num(x.c["skew.friction"]), 4)} · ${n(num(x.c["skew.weightForce"]), 1)}`,
        unit: "kN",
        standard: "FEM 1.001 T.9.4",
      },
    ],
    table: {
      title: "Teker Başına Savrulma Kuvvetleri",
      headers: [
        "Teker",
        "dᵢ [m]",
        "Fy1 — yakın ray [kN]",
        "Fy2 — uzak ray [kN]",
        "Fx — raya paralel [kN]",
      ],
      build: (x) => [
        ...x.v.wheels.map((w) => [
          w.code,
          n(w.distanceM, 3),
          kN(w.lateralNearN),
          kN(w.lateralFarN),
          kN(w.longitudinalN, 2),
        ]),
        [
          "Toplam",
          "",
          kN(x.v.wheels.reduce((a, w) => a + w.lateralNearN, 0)),
          kN(x.v.wheels.reduce((a, w) => a + w.lateralFarN, 0)),
          kN(x.v.wheels.reduce((a, w) => a + w.longitudinalN, 0), 2),
        ],
      ],
      note:
        "Teker kodları bir ray içindir; karşı ray aynı kodları ve aynı " +
        "geometriyi taşır. Yakın ray, arabanın yanaştığı raydır — araba karşı " +
        "uca gittiğinde iki rayın değerleri yer değiştirir, bu yüzden HER İKİ " +
        "ray da Fy1 sütunundaki değerlere göre boyutlandırılır. Fx yalnız bağlı " +
        "(C) teker çiftinde doğar.",
    },
    checkSuffixes: ["skew.angle", "skew.balance"],
  },
  {
    id: "10.4",
    title: "Boyuna Yatay Kuvvetler",
    description:
      "Köprünün ivmelenme ve frenlemesinden doğan, raya paralel kuvvetler. " +
      "Kuvvet tahrikli tekerlerin tabanında etkir ve sürtünmeyle aktarılabildiği " +
      "kadarı hesaba girer.",
    depKeys: ["drivenWheels", "accelerationMs2", "travelSpeedMpm"],
    inputKeys: [],
    selectionKeys: [],
    rows: [
      {
        key: "longitudinal.travelSpeed",
        label: "Yürütme Hızı v",
        formula: "v = v[m/dak] / 60",
        subst: (x) => `${n(x.deps.travelSpeedMpm, 2)} / 60`,
        unit: "m/s",
        digits: 3,
      },
      {
        key: "longitudinal.accelTime",
        label: "İvmelenme / Frenleme Süresi t",
        formula: "t = v / a",
        subst: (x) =>
          `${n(num(x.c["longitudinal.travelSpeed"]), 3)} / ${n(x.deps.accelerationMs2, 3)}`,
        unit: "s",
        digits: 2,
      },
      {
        key: "longitudinal.inertiaForce",
        label: "Atalet Kuvveti H",
        formula: "H = m · a",
        subst: (x) =>
          `${n(num(x.c["vertical.totalLoad"]))} · ${n(x.deps.accelerationMs2, 3)} / 1000`,
        unit: "kN",
        standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "longitudinal.drivenWheelLoad",
        label: "Tahrikli Tekerlerin Taşıdığı Yük",
        formula: "W_t = m·g · tahrikli teker / toplam teker",
        subst: (x) =>
          `${n(num(x.c["vertical.totalLoad"]))} · 9,81 · ${n(x.v.wheels.length > 0 ? num(x.c["longitudinal.drivenWheels"]) : 0)} / ${n(x.deps.wheelCount)} / 1000`,
        unit: "kN",
      },
      {
        key: "longitudinal.ratio",
        label: "H / W_t Oranı",
        formula: "1/30 ≤ H / W_t ≤ 1/4 bandı",
        subst: (x) =>
          `${n(num(x.c["longitudinal.inertiaForce"]), 2)} / ${n(num(x.c["longitudinal.drivenWheelLoad"]), 2)} → band [${n(1 / 30, 4)} … ${n(0.25, 2)}]`,
        digits: 4,
        standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "longitudinal.designForce",
        label: "Tasarım Boyuna Kuvveti H_t",
        formula: "H_t = H, ancak W_t/30 ile W_t/4 arasına sıkıştırılır",
        subst: (x) =>
          `${n(num(x.c["longitudinal.inertiaForce"]), 2)} → [${n(num(x.c["longitudinal.drivenWheelLoad"]) / 30, 2)} … ${n(num(x.c["longitudinal.drivenWheelLoad"]) / 4, 2)}] · belirleyen: ${x.c["longitudinal.bound"] ?? "?"}`,
        unit: "kN",
        standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "longitudinal.perRail",
        label: "Ray Başına Boyuna Kuvvet",
        formula: "H_t / 2",
        subst: (x) => `${n(num(x.c["longitudinal.designForce"]), 2)} / 2`,
        unit: "kN",
      },
      {
        key: "longitudinal.perDrivenWheel",
        label: "Tahrikli Teker Başına Boyuna Kuvvet",
        formula: "H_t / tahrikli teker adedi",
        subst: (x) =>
          `${n(num(x.c["longitudinal.designForce"]), 2)} / ${n(num(x.c["longitudinal.drivenWheels"]))}`,
        unit: "kN",
      },
      {
        key: "buffer.reactionForce",
        label: "Tampon Tepki Kuvveti (Tampon Başına)",
        formula: "Köprü yürütme bölümünden okunur; v ≤ 0,4 m/s ise hesaba katılmaz",
        subst: (x) =>
          x.v.bufferConsidered
            ? `v = ${n(x.v.travelSpeedMs, 3)} m/s > 0,4 m/s → tampon etkisi hesaba katılır`
            : `v = ${n(x.v.travelSpeedMs, 3)} m/s ≤ 0,4 m/s → tampon etkisi aranmaz`,
        unit: "kN",
        standard: "FEM 1.001 2.2.3.4.1",
      },
    ],
    checkSuffixes: ["longitudinal.transferable"],
  },
  {
    id: "10.5",
    title: "Yol Kirişine Aktarılan Kuvvetler — Özet",
    description:
      "Yol kirişini ve konsolları boyutlayan yapı mühendisine verilen kuvvet " +
      "setidir. Karakteristik değerler dinamik katsayı içermez; tasarım teker " +
      "yükü φ2 ile büyütülmüş kaldırma yükünü içerir.",
    depKeys: [],
    inputKeys: [],
    selectionKeys: [],
    rows: [],
    table: {
      title: "Tasarım Kuvvetleri",
      headers: ["Kuvvet", "Yön", "kN", "kg", "Dayanak"],
      build: (x) => {
        const v = x.v;
        const row = (
          label: string,
          dir: string,
          kg: number,
          std: string
        ): (string | number)[] => [label, dir, n(kgToKn(kg), 1), n(kg, 0), std];
        const rowN = (
          label: string,
          dir: string,
          forceN: number,
          std: string
        ): (string | number)[] => [
          label,
          dir,
          n(forceN / 1000, 1),
          n(forceN / 9.81, 0),
          std,
        ];
        const out: (string | number)[][] = [
          row("Maksimum teker yükü Pmaks", "↓", v.maxWheelLoadKg, "FEM 2.2.2"),
          row("Tasarım teker yükü Pmaks,d (φ2 dahil)", "↓", v.designWheelLoadKg, "FEM 9.3"),
          row("Minimum teker yükü Pmin (yüklü)", "↓", v.minWheelLoadKg, "FEM 2.2.2"),
          row("Minimum teker yükü (yüksüz vinç)", "↓", v.minUnloadedWheelLoadKg, "FEM 2.2.2"),
          rowN("En büyük enine teker kuvveti Fy1", "↔", v.maxLateralNearN, "FEM T.9.4"),
          rowN("Karşı ray enine teker kuvveti Fy2", "↔", v.maxLateralFarN, "FEM T.9.4"),
          rowN("Kılavuz kuvveti S", "↔", v.guideForceN, "FEM 9.4.1.3"),
          rowN(
            "Savrulma boyuna teker kuvveti Fx",
            "⇄",
            v.longitudinalSkewPerWheelN,
            "FEM T.9.4"
          ),
          rowN("Boyuna kuvvet — ray başına", "⇄", v.longitudinalPerRailN, "FEM 2.2.3.1.1"),
          rowN(
            "Boyuna kuvvet — tahrikli teker başına",
            "⇄",
            v.longitudinalPerDrivenWheelN,
            "FEM 2.2.3.1.1"
          ),
        ];
        if (v.bufferConsidered) {
          out.push([
            "Tampon tepki kuvveti (tampon başına)",
            "⇄",
            n(v.bufferForceKn, 1),
            n((v.bufferForceKn * 1000) / 9.81, 0),
            "FEM 2.2.3.4.1",
          ]);
        }
        out.push([
          "Dinamik katsayı φ2",
          "",
          n(v.phi2, 4),
          "",
          "FEM T.9.3.a",
        ]);
        return out;
      },
      note:
        "Enine kuvvetler her iki ray için Fy1 değerleriyle boyutlandırılır — " +
        "araba karşı uca gittiğinde raylar yer değiştirir. Kuvvetler " +
        "karakteristiktir; kısmi güvenlik katsayıları yol kirişi tasarımında " +
        "uygulanır.",
    },
    checkSuffixes: [],
  },
];

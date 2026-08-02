// Ana kiriş sunum katmanı: raporun 7.1 … 7.6 bölüm yapısı + her hesap
// satırının SEMBOLİK FORMÜLÜ ve SAYILARIN YERİNE KONMUŞ hali.
// Hesabın kendisi mainGirder.ts'tedir; burası yalnız gösterimdir.
//
// Satırlar motorun semantik anahtarlarını (`<blok>.<büyüklük>`) okur.

import type { GirderDeps, GirderInputs, GirderSelections } from "../modules/mainGirder";
import type { TechnicalSpecs } from "../types";

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
}

export interface GirderSectionDef {
  id: string;                // "7.1"
  title: string;
  description?: string;
  depKeys: (keyof GirderDeps & string)[];
  inputKeys: (keyof GirderInputs & string)[];
  selectionKeys: (keyof GirderSelections & string)[];
  rows: GirderRowDef[];
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

export const GIRDER_SECTIONS: GirderSectionDef[] = [
  {
    id: "7.1",
    title: "Kesit Özellikleri",
    description: "Kutu kesit alanı, ağırlık merkezi, atalet ve mukavemet momentleri, burulma sabiti.",
    depKeys: [],
    inputKeys: ["t1Mm", "b1Mm", "t2Mm", "b2Mm", "t3Mm", "h3Mm", "t4Mm", "t5Mm", "b5Mm", "t6Mm", "b6Mm", "aMm", "xMm"],
    selectionKeys: [],
    rows: [
      {
        key: "section.height", label: "Toplam yükseklik h", formula: "h = t1 + t2 + h3 + t5 + t6",
        subst: (x) => `${n(x.inp.t1Mm)} + ${n(x.inp.t2Mm)} + ${n(x.inp.h3Mm)} + ${n(x.inp.t5Mm)} + ${n(x.inp.t6Mm)}`,
        unit: "mm",
      },
      {
        key: "section.area", label: "Kesit alanı A", formula: "A = Σ(ti · bi) · 0,01",
        subst: (x) => `(${n(num(x.c["section.areaTopFlange"]))} + ${n(num(x.c["section.areaTopInnerFlange"]))} + ${n(num(x.c["section.areaMainWeb"]))} + ${n(num(x.c["section.areaSecondaryWeb"]))} + ${n(num(x.c["section.areaBottomFlange"]))} + ${n(num(x.c["section.areaExtraFlange"]))}) · 0,01`,
        unit: "cm²",
      },
      {
        key: "section.weightPerLength", label: "Birim ağırlık G", formula: "G = A · 0,8",
        subst: (x) => `${n(num(x.c["section.area"]))} · 0,8`, unit: "kg/m",
      },
      {
        key: "section.centroidZ", label: "Ağırlık merkezi Cz", formula: "Cz = Σ(Ai · zi) / A", unit: "mm",
      },
      {
        key: "section.inertiaY", label: "Atalet momenti Iyy", formula: "Iyy = Σ(Ii + Ai · di²)", unit: "cm⁴",
      },
      {
        key: "section.modulusYBottom", label: "Mukavemet momenti Wyy (alt)", formula: "Wyy,alt = Iyy · 10 / Cz",
        subst: (x) => `${n(num(x.c["section.inertiaY"]))} · 10 / ${n(num(x.c["section.centroidZ"]))}`, unit: "cm³",
      },
      {
        key: "section.modulusYTop", label: "Mukavemet momenti Wyy (üst)", formula: "Wyy,üst = Iyy · 10 / (h − Cz)",
        subst: (x) => `${n(num(x.c["section.inertiaY"]))} · 10 / (${n(num(x.c["section.height"]))} − ${n(num(x.c["section.centroidZ"]))})`, unit: "cm³",
      },
      {
        key: "section.centroidY", label: "Ağırlık merkezi Cy", formula: "Cy = Σ(Ai · yi) / A", unit: "mm",
      },
      {
        key: "section.inertiaZ", label: "Atalet momenti Izz", formula: "Izz = Σ(Ii + Ai · di²)", unit: "cm⁴",
      },
      {
        key: "section.modulusZBottom", label: "Mukavemet momenti Wzz (alt)", formula: "Wzz,alt = 10 · Izz / Cy",
        subst: (x) => `10 · ${n(num(x.c["section.inertiaZ"]))} / ${n(num(x.c["section.centroidY"]))}`, unit: "cm³",
      },
      {
        key: "section.modulusZTop", label: "Mukavemet momenti Wzz (üst)", formula: "Wzz,üst = 10 · Izz / (b2 − Cy)",
        subst: (x) => `10 · ${n(num(x.c["section.inertiaZ"]))} / (${n(x.inp.b2Mm)} − ${n(num(x.c["section.centroidY"]))})`, unit: "cm³",
      },
      {
        key: "section.inertiaTorsion", label: "Burulma sabiti Ixx", formula: "Ixx = 4·(b·h)² / Σ(si/ti)  [kapalı kutu]",
        subst: (x) => `4·(${n(num(x.c["section.torsionBoxWidth"]))}·${n(num(x.c["section.torsionBoxHeight"]))})² / Σ(si/ti)`, unit: "cm⁴",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "7.2",
    title: "Yükler",
    description: "Ölü/hareketli yükler, FEM dinamik katsayı ve yatay ivme yükleri (FEM T.2.2.3.1.1).",
    depKeys: ["bridgeGirdersWeightT", "bridgeEndCarriagesWeightT", "trolleyWeightT", "mainHookBlockWeightKg", "mainRopeWeightKg", "trolleyWheelCount", "trolleyActualSpeedMpm", "trolleyAccelTimeS", "bridgeWheelCount", "bridgeActualSpeedMpm", "bridgeAccelTimeS"],
    inputKeys: ["hookTopPositionM", "psiHK", "psiHA", "bridgeAxleSpacingM", "trolleyWheelSpacingM", "trolleyAxleSpacingM", "trolleyDrivenWheels", "bridgeDrivenWheels"],
    selectionKeys: [],
    rows: [
      {
        key: "load.bridgeDeadWeight", label: "Köprü ağırlığı Wv", formula: "Wv = (G_kiriş + G_başkiriş) / 2 · 1000",
        subst: (x) => `(${n(x.deps.bridgeGirdersWeightT)} + ${n(x.deps.bridgeEndCarriagesWeightT)}) / 2 · 1000`,
        unit: "kg",
      },
      {
        key: "load.trolleyWeight", label: "Araba ağırlığı Wa", formula: "Wa = G_araba · 1000",
        subst: (x) => `${n(x.deps.trolleyWeightT)} · 1000`, unit: "kg",
      },
      {
        key: "load.hoistLoad", label: "Yük", formula: "W1 = Q · 1000",
        subst: (x) => `${n(x.specs.mainCapacityT)} · 1000`, unit: "kg",
      },
      {
        key: "load.totalLiveLoad", label: "Toplam hareketli yük W", formula: "W = W1 + G_kanca",
        subst: (x) => `${n(num(x.c["load.hoistLoad"]))} + ${n(num(x.c["load.belowHookWeight"]))}`, unit: "kg",
      },
      {
        key: "load.dynamicFactor", label: "Dinamik katsayı ψ",
        formula: "ψ = Vl<0,25 → 1,15; Vl>1 → 1,6; aksi 1 + 0,6·Vl",
        subst: (x) => `Vl = ${n(num(x.c["load.liftSpeed"]), 3)} m/s → ${n(num(x.c["load.dynamicFactor"]), 3)}`,
        standard: "FEM 1.001 2.2.2.1.1",
      },
      {
        key: "load.trolleyAccel", label: "Araba ivmesi aA", formula: "aA = VA / tA",
        subst: (x) => `${n(num(x.c["load.trolleySpeed"]), 3)} / ${n(x.deps.trolleyAccelTimeS, 3)}`, unit: "m/s²",
      },
      {
        key: "load.bridgeAccel", label: "Köprü ivmesi aK", formula: "aK = VK / tK",
        subst: (x) => `${n(num(x.c["load.bridgeSpeed"]), 3)} / ${n(x.deps.bridgeAccelTimeS, 3)}`, unit: "m/s²",
      },
      {
        key: "load.pendulumPeriod", label: "Salınım periyodu T1", formula: "T1 = 2π · √(l / g)",
        subst: (x) => `2π · √(${n(x.inp.hookTopPositionM)} / 9,81)`, unit: "s",
      },
      {
        key: "load.trolleyHorizontal", label: "Araba yatay yükü Fha1",
        formula: "Fha1 = min(F'ha1, F''ha1) / 2",
        subst: (x) => `min(${n(num(x.c["load.trolleyInertia"]))}, ${n(num(x.c["load.trolleyTractionLimit"]))}) / 2`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "load.trolleySkew", label: "Araba yürüme yatay yükü Fha2", formula: "Fha2 = (Wa + W1) · λA",
        subst: (x) => `(${n(num(x.c["load.trolleyWeight"]))} + ${n(num(x.c["load.hoistLoad"]))}) · ${n(num(x.c["load.skewFactorTrolley"]), 3)}`, unit: "kg",
      },
      {
        key: "load.bridgeHorizontal", label: "Köprü yatay yükü Fhk1",
        formula: "Fhk1 = min(F'hk1, F''hk1) / 2",
        subst: (x) => `min(${n(num(x.c["load.bridgeInertia"]))}, ${n(num(x.c["load.bridgeTractionLimit"]))}) / 2`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        key: "load.bridgeSkew", label: "Köprü yürüme yatay yükü Fhk2", formula: "Fhk2 = (Wv + W1) · λK",
        subst: (x) => `(${n(num(x.c["load.bridgeDeadWeight"]))} + ${n(num(x.c["load.hoistLoad"]))}) · ${n(num(x.c["load.skewFactorBridge"]), 3)}`, unit: "kg",
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
        key: "load.amplifyFactor", label: "Arttırma katsayısı γc",
        formula: "γc = f(çelik yapı sınıfı)",
        subst: (x) => `${x.specs.structureClass} → ${n(num(x.c["load.amplifyFactor"]), 3)}`,
        digits: 3, standard: "FEM 1.001 T.2.3.4",
      },
      {
        key: "stress.amplifiedCombinedBottom", label: "Yükleme Durumu I — bileşik gerilme γc·σcomb (alt)",
        formula: "SI = γc·(SG + ψ·SL + SH)", unit: "kg/cm²", standard: "FEM 1.001 §2.3.1",
      },
      {
        key: "stress.testFactor", label: "Test katsayısı k (Durum III)", formula: "k = max(ψ·ρ1, ρ2)",
      },
      {
        key: "stress.combinedCase3", label: "Yükleme Durumu III — bileşik gerilme (test)",
        formula: "SIII = test yükleri (ρ1 dinamik / ρ2 statik)", unit: "kg/cm²", standard: "FEM 1.001 §2.3.3",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "7.4",
    title: "Gerilme Analizi",
    description:
      "Bileşen gerilmeler (eğilme, ikincil, teker basıncı, burulma, kesme) ve von Mises bileşik gerilmeler.",
    depKeys: [],
    inputKeys: ["railLeverCMm", "diaphragmSpacingMm", "wheelContactHMm", "wheelContactTMm"],
    selectionKeys: ["staticMaterial"],
    rows: [
      {
        key: "moment.girderSelfWeight", label: "Kiriş ağırlığı momenti My",
        formula: "My = L · Wv / 8  (L mm verildiğinden /80 ile kg·cm)",
        subst: (x) => `${n(x.specs.spanM * 1000)} · ${n(num(x.c["load.bridgeDeadWeight"]))} / 80`, unit: "kg·cm",
      },
      {
        key: "moment.trolleyWheel", label: "Araba ağırlığı momenti My",
        formula: "My = b · P_teker  (b mm verildiğinden /10 ile kg·cm)",
        subst: (x) => `${n(num(x.c["geometry.wheelToSupport"]))} · ${n(num(x.c["load.trolleyWheelLoad"]))} / 10`, unit: "kg·cm",
      },
      {
        key: "moment.hoistLoad", label: "Yük momenti My",
        formula: "My = b · P_tek  (b mm verildiğinden /10 ile kg·cm)",
        subst: (x) => `${n(num(x.c["geometry.wheelToSupport"]))} · ${n(num(x.c["load.hoistWheelLoad"]))} / 10`, unit: "kg·cm",
      },
      // --- σx bileşenleri (alt lif) ---
      {
        key: "stress.sigmaXSelfWeightBottom", label: "σx · düşey eğilme — kiriş öz ağırlığı",
        formula: "σx = M_y,kiriş / W_y,alt", unit: "kg/cm²", standard: "FEM 1.001 4.1.1",
      },
      {
        key: "stress.sigmaXTrolleyBottom", label: "σx · düşey eğilme — araba ağırlığı",
        formula: "σx = M_y,araba / W_y,alt", unit: "kg/cm²", standard: "FEM 1.001 4.1.1",
      },
      {
        key: "stress.sigmaXHoistBottom", label: "σx · düşey eğilme — kaldırma yükü (×ψ)",
        formula: "σx = M_y,yük / W_y,alt", unit: "kg/cm²", standard: "FEM 1.001 4.1.1",
      },
      {
        key: "stress.sigmaXLateralBridgeBottom", label: "σx · yatay eğilme — köprü yatay yükü",
        formula: "σx = M_z,köprü / W_z,alt", unit: "kg/cm²", standard: "FEM 1.001 4.1.2",
      },
      {
        key: "stress.sigmaXLateralTrolleyBottom", label: "σx · yatay eğilme — araba yanal yükü",
        formula: "σx = M_z,araba / W_z,alt", unit: "kg/cm²", standard: "FEM 1.001 4.1.2",
      },
      {
        key: "stress.sigmaXRailLeverBottom", label: "σx · yanal — ray kolu / kaçıklık",
        formula: "σx = M_ray / W_y,alt", unit: "kg/cm²", standard: "FEM 1.001 4.1.3",
      },
      {
        key: "stress.sigmaXSecondaryTrolleyBottom", label: "σx · ikincil moment — araba (perde arası)",
        formula: "σx = M_sec,araba / (3 · W_y,alt)", unit: "kg/cm²", standard: "FEM 1.001 4.1.4",
      },
      {
        key: "stress.sigmaXSecondaryHoistBottom", label: "σx · ikincil moment — kaldırma yükü (×ψ)",
        formula: "σx = M_sec,yük / W_y,alt", unit: "kg/cm²", standard: "FEM 1.001 4.1.4",
      },
      {
        key: "stress.sigmaXBottomCase1", label: "σx,alt TOPLAM — Yükleme Durumu I",
        formula: "σx,alt = σ1 + σ2 + ψ·σ3 + σ4 + σ5 + σ6 + σ7 + ψ·σ8",
        subst: (x) => `${n(num(x.c["stress.sigmaXSelfWeightBottom"]))} + ${n(num(x.c["stress.sigmaXTrolleyBottom"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.sigmaXHoistBottom"]))} + ${n(num(x.c["stress.sigmaXLateralBridgeBottom"]))} + ${n(num(x.c["stress.sigmaXLateralTrolleyBottom"]))} + ${n(num(x.c["stress.sigmaXRailLeverBottom"]))} + ${n(num(x.c["stress.sigmaXSecondaryTrolleyBottom"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.sigmaXSecondaryHoistBottom"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "stress.sigmaXTopCase1", label: "σx (üst) — Yükleme Durumu I", unit: "kg/cm²",
      },
      // --- σz bileşenleri (teker basıncı) ---
      {
        key: "geometry.wheelContactLength", label: "Teker basıncı yayılım boyu l",
        formula: "l = 2·h + 40", unit: "mm", digits: 0, standard: "FEM 1.001 4.2",
      },
      {
        key: "stress.sigmaZTrolley", label: "σz · teker basıncı — araba",
        formula: "σz = −P_araba / (2·(0,2h+5)·t·0,1)", unit: "kg/cm²", standard: "FEM 1.001 4.2",
      },
      {
        key: "stress.sigmaZHoist", label: "σz · teker basıncı — kaldırma yükü (×ψ)",
        formula: "σz = −P_yük / (2·(0,2h+5)·t·0,1)", unit: "kg/cm²", standard: "FEM 1.001 4.2",
      },
      {
        key: "stress.sigmaZCase1", label: "σz TOPLAM — Yükleme Durumu I", formula: "σz = σ9 + ψ·σ10",
        subst: (x) => `${n(num(x.c["stress.sigmaZTrolley"]))} + ${n(num(x.c["load.dynamicFactor"]), 2)}·${n(num(x.c["stress.sigmaZHoist"]))}`, unit: "kg/cm²",
      },
      // --- kayma bileşenleri (burulma + kesme) ---
      {
        key: "stress.torsionTrolley", label: "τ · burulma — araba",
        formula: "τ = T_araba / (2·A_m·t_gövde)", unit: "kg/cm²", standard: "FEM 1.001 4.3.1",
      },
      {
        key: "stress.torsionHoist", label: "τ · burulma — kaldırma yükü (×ψ)",
        formula: "τ = T_yük / (2·A_m·t_gövde)", unit: "kg/cm²", standard: "FEM 1.001 4.3.1",
      },
      {
        key: "stress.shearMainCase1", label: "τ TOPLAM (ana gövde)", unit: "kg/cm²",
      },
      {
        key: "stress.shearSecondaryCase1", label: "τ TOPLAM (ikincil gövde)", unit: "kg/cm²",
      },
      {
        key: "stress.combinedBottomCase1", label: "σcomb (alt)", formula: "σcomb = √(σx² + σz² − |σx·σz| + 3·τ²)",
        subst: (x) => `√(${n(num(x.c["stress.sigmaXBottomCase1"]))}² + ${n(num(x.c["stress.sigmaZCase1"]))}² − |${n(num(x.c["stress.sigmaXBottomCase1"]))}·${n(num(x.c["stress.sigmaZCase1"]))}| + 3·${n(num(x.c["stress.shearSecondaryCase1"]))}²)`,
        unit: "kg/cm²",
      },
      {
        key: "stress.amplifiedCombinedBottom", label: "γc · σcomb (alt)", formula: "γc · σcomb",
        subst: (x) => `${n(num(x.c["load.amplifyFactor"]), 3)} · ${n(num(x.c["stress.combinedBottomCase1"]))}`, unit: "kg/cm²",
        standard: "FEM 1.001 T.2.3.4",
      },
      {
        key: "stress.amplifiedCombinedTop", label: "γc · σcomb (üst)", formula: "γc · σcomb",
        subst: (x) => `${n(num(x.c["load.amplifyFactor"]), 3)} · ${n(num(x.c["stress.combinedTopCase1"]))}`, unit: "kg/cm²",
      },
      {
        key: "stress.testFactor", label: "Test katsayısı k", formula: "k = max(ψ·ρ1, ρ2)",
        subst: (x) => `max(${n(num(x.c["load.dynamicFactor"]), 2)}·${n(x.inp.dynTestFactorR1)}, ${n(x.inp.statTestFactorR2)})`,
      },
      {
        key: "stress.combinedCase3", label: "σcomb — Yükleme Durumu III",
        formula: "σcomb = √(σx² + σz² − |σx·σz| + 3·τ²)",
        subst: (x) => `√(${n(num(x.c["stress.sigmaXBottomCase3"]))}² + ${n(num(x.c["stress.sigmaZCase3"]))}² − |${n(num(x.c["stress.sigmaXBottomCase3"]))}·${n(num(x.c["stress.sigmaZCase3"]))}| + 3·${n(num(x.c["stress.shearMainCase3"]))}²)`,
        unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["stress.case1", "stress.case3"],
  },
  {
    id: "7.5",
    title: "Yorulma Kontrolü",
    description: "DIN 15018 Tablo 17/18 izin gerilmeleri, κ oranları ve bileşik yorulma.",
    depKeys: [],
    inputKeys: ["sigmaYMaxNmm2", "sigmaYMinNmm2", "fatigueTensileNmm2"],
    selectionKeys: ["fatigueMaterial", "fatigueLoadGroupOverride", "fatigueNotchClass"],
    rows: [
      {
        key: "fatigue.sigmaXMax", label: "σx,maks", formula: "σx,maks = σx,alt(I) / 9,81",
        subst: (x) => `${n(num(x.c["stress.sigmaXBottomCase1"]))} / 9,81`, unit: "N/mm²",
      },
      {
        key: "fatigue.sigmaXMin", label: "σx,min", formula: "σx,min = σ1 / 9,81",
        subst: (x) => `${n(num(x.c["stress.sigmaXSelfWeightBottom"]))} / 9,81`, unit: "N/mm²",
      },
      {
        key: "fatigue.tauMax", label: "τ,maks", formula: "τ,maks = σz(I) / 9,81",
        subst: (x) => `${n(num(x.c["stress.sigmaZCase1"]))} / 9,81`, unit: "N/mm²",
      },
      {
        key: "fatigue.allowableD1", label: "zul σD(-1)", formula: "T17(malzeme, çentik, yük grubu)",
        subst: (x) => `${x.sel.fatigueMaterial} / ${x.sel.fatigueNotchClass} / ${x.c["fatigue.loadGroup"]} → ${n(num(x.c["fatigue.allowableD1"]))}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.allowableDz0", label: "zul σDz(0)", formula: "zul σDz(0) = zul σD(-1) · 5/3",
        subst: (x) => `${n(num(x.c["fatigue.allowableD1"]))} · 5/3`, unit: "N/mm²",
      },
      {
        key: "fatigue.kappaX", label: "κ (σx)", formula: "κ = σx,min / σx,maks",
        subst: (x) => `${n(num(x.c["fatigue.sigmaXMin"]))} / ${n(num(x.c["fatigue.sigmaXMax"]))}`, digits: 3,
      },
      {
        key: "fatigue.allowableSigmaX", label: "zul σDz(κ)",
        formula: "zul σDz(κ) = zul σDz(0) / (1 − (1 − zul σDz(0)/(0,75·σB)) · κ)",
        subst: (x) => `${n(num(x.c["fatigue.allowableDz0"]))} / (1 − (1 − ${n(num(x.c["fatigue.allowableDz0"]))}/(0,75·${n(x.inp.fatigueTensileNmm2)})) · ${n(num(x.c["fatigue.kappaX"]), 3)})`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.kappaY", label: "κ (σy)", formula: "κ = σy,min / σy,maks",
        subst: (x) => `${n(x.inp.sigmaYMinNmm2)} / ${n(x.inp.sigmaYMaxNmm2)}`, digits: 3,
      },
      {
        key: "fatigue.allowableSigmaY", label: "zul σDz(κ) — σy", unit: "N/mm²", standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.allowableTauW0", label: "zul τ için W0 değeri", formula: "T17(malzeme, W0, yük grubu)",
        subst: (x) => `${x.sel.fatigueMaterial} / W0 / ${x.c["fatigue.loadGroup"]} → ${n(num(x.c["fatigue.allowableTauW0"]))}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.allowableTau", label: "zul τD(κ)", formula: "zul τD = zul τW0 / √3",
        subst: (x) => `${n(num(x.c["fatigue.allowableTauW0"]))} / √3`, unit: "N/mm²",
      },
      {
        key: "fatigue.combined", label: "Bileşik yorulma oranı",
        formula: "(σx/zul σx)² + (σy/zul σy)² − σx·σy/(zul σx·zul σy) + (τ/zul τ)² ≤ 1,1",
        subst: (x) => `(${n(num(x.c["fatigue.sigmaXMax"]))}/${n(num(x.c["fatigue.allowableSigmaX"]))})² + (${n(x.inp.sigmaYMaxNmm2)}/${n(num(x.c["fatigue.allowableSigmaY"]))})² − … + (${n(num(x.c["fatigue.tauMax"]))}/${n(num(x.c["fatigue.allowableTau"]))})²`,
        digits: 4, standard: "DIN 15018 7.4.5",
      },
    ],
    checkSuffixes: ["fatigue.sigmaX", "fatigue.sigmaY", "fatigue.tau", "fatigue.combined"],
  },
  {
    id: "7.6",
    title: "Sehim Kontrolü",
    depKeys: [],
    inputKeys: ["deflectionLimitRatio"],
    selectionKeys: [],
    rows: [
      {
        key: "deflection.wheelLoad", label: "Tekerlek yükü", formula: "P = P_araba + P_yük",
        subst: (x) => `${n(num(x.c["load.trolleyWheelLoad"]))} + ${n(num(x.c["load.hoistWheelLoad"]))}`, unit: "kg",
      },
      {
        key: "deflection.value", label: "Sehim δ",
        formula: "δ = −P·a·(4a² − 3l²) / (24 · E · I)",
        subst: (x) => `−${n(num(x.c["deflection.wheelLoad"]))}·${n(num(x.c["deflection.loadOffset"]))}·(4·${n(num(x.c["deflection.loadOffset"]))}² − 3·${n(num(x.c["deflection.span"]))}²) / (24 · 2100000 · ${n(num(x.c["section.inertiaY"]))})`,
        unit: "cm", digits: 3,
      },
      {
        key: "deflection.ratio", label: "Sehim oranı (L/δ)", formula: "L / δ",
        subst: (x) => `${n(num(x.c["deflection.span"]))} / ${n(num(x.c["deflection.value"]), 3)}`, digits: 0,
        standard: "CMAA 70 3.5.5.1",
      },
    ],
    checkSuffixes: ["deflection"],
  },
];

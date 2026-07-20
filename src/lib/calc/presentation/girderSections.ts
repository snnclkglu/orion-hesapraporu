// Ana kiriş sunum katmanı: Excel 07 sayfasının bölüm yapısı (7.1 ... 7.6) +
// her hesap satırının SEMBOLİK FORMÜLÜ ve SAYILARIN YERİNE KONMUŞ hali.
// Hesabın kendisi mainGirder.ts'tedir (golden testli); burası yalnız
// gösterimdir (hoistSections deseni).

import type { GirderDeps, GirderInputs, GirderSelections } from "../modules/mainGirder";
import type { TechnicalSpecs } from "../types";

export interface GirderCtx {
  c: Record<string, number | string>; // hücre haritası (motor çıktısı)
  inp: GirderInputs;
  sel: GirderSelections;
  deps: GirderDeps;
  specs: TechnicalSpecs;
}

export interface GirderRowDef {
  cell: string;              // sonucun okunacağı Excel hücresi
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
        cell: "C20", label: "Toplam yükseklik h", formula: "h = t1 + t2 + h3 + t5 + t6",
        subst: (x) => `${n(x.inp.t1Mm)} + ${n(x.inp.t2Mm)} + ${n(x.inp.h3Mm)} + ${n(x.inp.t5Mm)} + ${n(x.inp.t6Mm)}`,
        unit: "mm",
      },
      {
        cell: "C21", label: "Kesit alanı A", formula: "A = Σ(ti · bi) · 0,01",
        subst: (x) => `(${n(num(x.c.A6))} + ${n(num(x.c.A8))} + ${n(num(x.c.A10))} + ${n(num(x.c.A11))} + ${n(num(x.c.A13))} + ${n(num(x.c.A15))}) · 0,01`,
        unit: "cm²",
      },
      {
        cell: "C22", label: "Birim ağırlık G", formula: "G = A · 100000 · 0,000008",
        subst: (x) => `${n(num(x.c.C21))} · 100000 · 0,000008`, unit: "kg/m",
      },
      {
        cell: "C23", label: "Ağırlık merkezi Cz", formula: "Cz = Σ(Ai · zi) / A", unit: "mm",
      },
      {
        cell: "C24", label: "Atalet momenti Iyy", formula: "Iyy = Σ(Ii + Ai · di²)", unit: "cm⁴",
      },
      {
        cell: "C25", label: "Mukavemet momenti Wyy (alt)", formula: "Wyy,alt = Iyy · 10 / Cz",
        subst: (x) => `${n(num(x.c.C24))} · 10 / ${n(num(x.c.C23))}`, unit: "cm³",
      },
      {
        cell: "C26", label: "Mukavemet momenti Wyy (üst)", formula: "Wyy,üst = Iyy · 10 / (h − Cz)",
        subst: (x) => `${n(num(x.c.C24))} · 10 / (${n(num(x.c.C20))} − ${n(num(x.c.C23))})`, unit: "cm³",
      },
      {
        cell: "I21", label: "Ağırlık merkezi Cy", formula: "Cy = Σ(Ai · yi) / A", unit: "mm",
      },
      {
        cell: "I22", label: "Atalet momenti Izz", formula: "Izz = Σ(Ii + Ai · di²)", unit: "cm⁴",
      },
      {
        cell: "I23", label: "Mukavemet momenti Wzz (alt)", formula: "Wzz,alt = 10 · Izz / Cy",
        subst: (x) => `10 · ${n(num(x.c.I22))} / ${n(num(x.c.I21))}`, unit: "cm³",
      },
      {
        cell: "I24", label: "Mukavemet momenti Wzz (üst)", formula: "Wzz,üst = 10 · Izz / (b2 − Cy)",
        subst: (x) => `10 · ${n(num(x.c.I22))} / (${n(x.inp.b2Mm)} − ${n(num(x.c.I21))})`, unit: "cm³",
      },
      {
        cell: "I20", label: "Burulma sabiti Ixx (tors)", formula: "Ixx = 4·(b·h)² / (Σ si/ti)",
        subst: (x) => `4·(${n(num(x.c.I26))}·${n(num(x.c.I27))})² / Σ(si/ti)`, unit: "cm⁴",
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
        cell: "D34", label: "Köprü ağırlığı Wv", formula: "Wv = (G_kiriş + G_başkiriş) / 2 · 1000",
        subst: (x) => `(${n(x.deps.bridgeGirdersWeightT)} + ${n(x.deps.bridgeEndCarriagesWeightT)}) / 2 · 1000`,
        unit: "kg",
      },
      {
        cell: "D35", label: "Araba ağırlığı Wa", formula: "Wa = G_araba · 1000",
        subst: (x) => `${n(x.deps.trolleyWeightT)} · 1000`, unit: "kg",
      },
      {
        cell: "D39", label: "Yük", formula: "W1 = Q · 1000",
        subst: (x) => `${n(x.specs.mainCapacityT)} · 1000`, unit: "kg",
      },
      {
        cell: "D41", label: "Toplam hareketli yük W", formula: "W = W1 + G_kanca",
        subst: (x) => `${n(num(x.c.D39))} + ${n(num(x.c.D40))}`, unit: "kg",
      },
      {
        cell: "D46", label: "Dinamik katsayı ψ",
        formula: "ψ = Vl<0,25 → 1,15; Vl>1 → 1,6; aksi 1 + 0,6·Vl",
        subst: (x) => `Vl = ${n(num(x.c.D45), 3)} m/s → ${n(num(x.c.D46), 3)}`,
        standard: "FEM 1.001 2.2.2.1.1",
      },
      {
        cell: "D57", label: "Araba ivmesi aA", formula: "aA = VA / tA",
        subst: (x) => `${n(num(x.c.D55), 3)} / ${n(num(x.c.D56), 3)}`, unit: "m/s²",
      },
      {
        cell: "D61", label: "Köprü ivmesi aK", formula: "aK = VK / tK",
        subst: (x) => `${n(num(x.c.D59), 3)} / ${n(num(x.c.D60), 3)}`, unit: "m/s²",
      },
      {
        cell: "D70", label: "Salınım periyodu T1", formula: "T1 = 2π · √(l / g)",
        subst: (x) => `2π · √(${n(x.inp.hookTopPositionM)} / 9,81)`, unit: "s",
      },
      {
        cell: "D105", label: "Araba yatay yükü Fha1",
        formula: "Fha1 = min(F'ha1, F''ha1) / 2",
        subst: (x) => `min(${n(num(x.c.D98))}, ${n(num(x.c.D103))}) / 2`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        cell: "D109", label: "Araba yürüme yatay yükü Fha2", formula: "Fha2 = (Wa + W1) · λA",
        subst: (x) => `(${n(num(x.c.D35))} + ${n(num(x.c.D39))}) · ${n(num(x.c.D90), 3)}`, unit: "kg",
      },
      {
        cell: "D124", label: "Köprü yatay yükü Fhk1",
        formula: "Fhk1 = min(F'hk1, F''hk1) / 2",
        subst: (x) => `min(${n(num(x.c.D117))}, ${n(num(x.c.D122))}) / 2`,
        unit: "kg", standard: "FEM 1.001 2.2.3.1.1",
      },
      {
        cell: "D128", label: "Köprü yürüme yatay yükü Fhk2", formula: "Fhk2 = (Wv + W1) · λK",
        subst: (x) => `(${n(num(x.c.D34))} + ${n(num(x.c.D39))}) · ${n(num(x.c.D89), 3)}`, unit: "kg",
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
    inputKeys: ["amplifyYc", "dynTestFactorR1", "statTestFactorR2"],
    selectionKeys: [],
    rows: [],
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
        cell: "D184", label: "Kiriş ağırlığı momenti My", formula: "My = L · W / 80",
        subst: (x) => `${n(num(x.c.D174))} · ${n(num(x.c.D183))} / 80`, unit: "kg·cm",
      },
      {
        cell: "D192", label: "Araba ağırlığı momenti My", formula: "My = b · P_teker / 10",
        subst: (x) => `${n(num(x.c.D173))} · ${n(num(x.c.D191))} / 10`, unit: "kg·cm",
      },
      {
        cell: "D200", label: "Yük momenti My", formula: "My = b · P_tek / 10",
        subst: (x) => `${n(num(x.c.D173))} · ${n(num(x.c.D199))} / 10`, unit: "kg·cm",
      },
      {
        cell: "E362", label: "σx (alt) — Yükleme Durumu I",
        formula: "σx,alt = σ1 + σ2 + ψ·σ3 + σ4 + σ5 + σ6 + σ7 + ψ·σ8",
        subst: (x) => `${n(num(x.c.D186))} + ${n(num(x.c.D194))} + ${n(num(x.c.D46), 2)}·${n(num(x.c.D202))} + ${n(num(x.c.D212))} + ${n(num(x.c.D220))} + ${n(num(x.c.D234))} + ${n(num(x.c.D249))} + ${n(num(x.c.D46), 2)}·${n(num(x.c.D257))}`,
        unit: "kg/cm²",
      },
      {
        cell: "E363", label: "σx (üst) — Yükleme Durumu I", unit: "kg/cm²",
      },
      {
        cell: "E364", label: "σz — Yükleme Durumu I", formula: "σz = σ9 + ψ·σ10",
        subst: (x) => `${n(num(x.c.D271))} + ${n(num(x.c.D46), 2)}·${n(num(x.c.D275))}`, unit: "kg/cm²",
      },
      {
        cell: "E365", label: "σs (ana gövde)", unit: "kg/cm²",
      },
      {
        cell: "E366", label: "σs (ikincil gövde)", unit: "kg/cm²",
      },
      {
        cell: "E367", label: "σcomb (alt)", formula: "σcomb = √(σx² + σz² − |σx·σz| + 3·σs²)",
        subst: (x) => `√(${n(num(x.c.E362))}² + ${n(num(x.c.E364))}² − |${n(num(x.c.E362))}·${n(num(x.c.E364))}| + 3·${n(num(x.c.E366))}²)`,
        unit: "kg/cm²",
      },
      {
        cell: "E374", label: "γc · σcomb (alt)", formula: "γc · σcomb",
        subst: (x) => `${n(x.inp.amplifyYc)} · ${n(num(x.c.E367))}`, unit: "kg/cm²",
        standard: "FEM 1.001 T.2.3.4",
      },
      {
        cell: "E376", label: "γc · σcomb (üst)", formula: "γc · σcomb",
        subst: (x) => `${n(x.inp.amplifyYc)} · ${n(num(x.c.E368))}`, unit: "kg/cm²",
      },
      {
        cell: "D386", label: "Test katsayısı k", formula: "k = max(ψ·ρ1, ρ2)",
        subst: (x) => `max(${n(num(x.c.D46), 2)}·${n(x.inp.dynTestFactorR1)}, ${n(x.inp.statTestFactorR2)})`,
      },
      {
        cell: "D391", label: "σcomb — Yükleme Durumu III",
        formula: "σcomb = √(σx² + σz² − |σx·σz| + 3·σs²)",
        subst: (x) => `√(${n(num(x.c.D388))}² + ${n(num(x.c.D390))}² − |${n(num(x.c.D388))}·${n(num(x.c.D390))}| + 3·${n(num(x.c.D389))}²)`,
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
    selectionKeys: ["fatigueMaterial", "fatigueLoadGroup", "fatigueNotchClass"],
    rows: [
      {
        cell: "F396", label: "σx,maks", formula: "σx,maks = σx,alt(I) / 9,81",
        subst: (x) => `${n(num(x.c.E362))} / 9,81`, unit: "N/mm²",
      },
      {
        cell: "F401", label: "σx,min", formula: "σx,min = σ1 / 9,81",
        subst: (x) => `${n(num(x.c.D186))} / 9,81`, unit: "N/mm²",
      },
      {
        cell: "F398", label: "τ,maks", formula: "τ,maks = σz(I) / 9,81",
        subst: (x) => `${n(num(x.c.E364))} / 9,81`, unit: "N/mm²",
      },
      {
        cell: "F409", label: "zul σD(-1)", formula: "T17(malzeme, çentik, yük grubu)",
        subst: (x) => `${x.sel.fatigueMaterial} / ${x.sel.fatigueNotchClass} / ${x.sel.fatigueLoadGroup} → ${n(num(x.c.F409))}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        cell: "F411", label: "zul σDz(0)", formula: "zul σDz(0) = zul σD(-1) · 5/3",
        subst: (x) => `${n(num(x.c.F409))} · 5/3`, unit: "N/mm²",
      },
      {
        cell: "F414", label: "κ (σx)", formula: "κ = σx,min / σx,maks",
        subst: (x) => `${n(num(x.c.F401))} / ${n(num(x.c.F396))}`, digits: 3,
      },
      {
        cell: "F419", label: "zul σDz(κ)",
        formula: "zul σDz(κ) = zul σDz(0) / (1 − (1 − zul σDz(0)/(0,75·σB)) · κ)",
        subst: (x) => `${n(num(x.c.F411))} / (1 − (1 − ${n(num(x.c.F411))}/(0,75·${n(x.inp.fatigueTensileNmm2)})) · ${n(num(x.c.F414), 3)})`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 18",
      },
      {
        cell: "G424", label: "κ (σy)", formula: "κ = σy,min / σy,maks",
        subst: (x) => `${n(x.inp.sigmaYMinNmm2)} / ${n(x.inp.sigmaYMaxNmm2)}`, digits: 3,
      },
      {
        cell: "G426", label: "zul σDz(κ) — σy", unit: "N/mm²", standard: "DIN 15018 Tablo 18",
      },
      {
        cell: "G430", label: "zul τ için W0 değeri", formula: "T17(malzeme, W0, yük grubu)",
        subst: (x) => `${x.sel.fatigueMaterial} / W0 / ${x.sel.fatigueLoadGroup} → ${n(num(x.c.G430))}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        cell: "G431", label: "zul τD(κ)", formula: "zul τD = zul τW0 / √3",
        subst: (x) => `${n(num(x.c.G430))} / √3`, unit: "N/mm²",
      },
      {
        cell: "E435", label: "Bileşik yorulma oranı",
        formula: "(σx/zul σx)² + (σy/zul σy)² − σx·σy/(zul σx·zul σy) + (τ/zul τ)² ≤ 1,1",
        subst: (x) => `(${n(num(x.c.E422))}/${n(num(x.c.G422))})² + (${n(num(x.c.E428))}/${n(num(x.c.G428))})² − ... + (${n(num(x.c.E433))}/${n(num(x.c.G433))})²`,
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
        cell: "G441", label: "Tekerlek yükü", formula: "P = P_araba + P_yük",
        subst: (x) => `${n(num(x.c.D191))} + ${n(num(x.c.D199))}`, unit: "kg",
      },
      {
        cell: "G446", label: "Sehim δ",
        formula: "δ = −P·a·(4a² − 3l²) / (24 · E · I)",
        subst: (x) => `−${n(num(x.c.G441))}·${n(num(x.c.G443))}·(4·${n(num(x.c.G443))}² − 3·${n(num(x.c.G444))}²) / (24 · 2100000 · ${n(num(x.c.G445))})`,
        unit: "cm", digits: 3,
      },
      {
        cell: "G447", label: "Sehim oranı (L/δ)", formula: "L / δ",
        subst: (x) => `${n(num(x.c.G444))} / ${n(num(x.c.G446), 3)}`, digits: 0,
        standard: "CMAA 70 3.5.5.1",
      },
    ],
    checkSuffixes: ["deflection"],
  },
];

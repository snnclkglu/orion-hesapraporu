// Kaldırma grubu sunum katmanı: Excel'in bölüm yapısı (2.1 ... 2.7) +
// her hesap satırının SEMBOLİK FORMÜLÜ ve SAYILARIN YERİNE KONMUŞ hali.
// Hesabın kendisi hoistGroup.ts'tedir (golden testli); burası yalnız gösterimdir
// ve ileride PDF raporun formül satırlarını da bu katman üretir.

import type { HoistInputs, HoistSelections } from "../modules/hoistGroup";
import type { TechnicalSpecs } from "../types";

export interface HoistCtx {
  c: Record<string, number | string>; // hücre haritası (motor çıktısı)
  inp: HoistInputs;
  sel: HoistSelections;
  specs: TechnicalSpecs;
  which: "main" | "aux";
}

export interface HoistRowDef {
  cell: string;              // sonucun okunacağı Excel hücresi
  label: string;
  formula?: string;          // sembolik formül (ör. "F = G / n / η")
  subst?: (ctx: HoistCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
}

export interface HoistSectionDef {
  id: string;                // "2.1"
  title: string;
  description?: string;
  inputKeys: (keyof HoistInputs & string)[];
  selectionKeys: (keyof HoistSelections & string)[];
  rows: HoistRowDef[];
  /** Bölümde gösterilecek kontrol id sonekleri (örn. "rope.safety") */
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

export const HOIST_SECTIONS: HoistSectionDef[] = [
  {
    id: "2.1",
    title: "Halat",
    description: "Donanım, halat verimi, halat yükü ve halat seçimi (FEM 1.001).",
    inputKeys: ["drivenFalls", "totalFalls", "sheaveEfficiency", "fixedSheaveCount", "hookBlockWeightKg", "ropeWeightKg"],
    selectionKeys: ["ropeBrand", "ropeDiaMm", "ropeConstruction", "ropeCore", "ropeWireStrength", "ropeBreakingLoadKn"],
    rows: [
      {
        cell: "L9", label: "Mekanik avantaj", formula: "i = n_toplam / n_tahrik",
        subst: (x) => `${n(x.inp.totalFalls)} / ${n(x.inp.drivenFalls)}`,
      },
      {
        cell: "L11", label: "Halat donanımı verimi",
        formula: "η = (η_m^s / i) · (1 − η_m^i) / (1 − η_m)",
        subst: (x) => `(${n(x.inp.sheaveEfficiency, 3)}^${n(x.inp.fixedSheaveCount)} / ${n(num(x.c.L9))}) · (1 − ${n(x.inp.sheaveEfficiency, 3)}^${n(num(x.c.L9))}) / (1 − ${n(x.inp.sheaveEfficiency, 3)})`,
        digits: 4,
      },
      {
        cell: "L13", label: "Kaldırılan yük", formula: "G_yük = Q · 1000",
        subst: (x) => `${n(x.which === "main" ? x.specs.mainCapacityT : x.specs.auxCapacityT)} · 1000`, unit: "kg",
      },
      {
        cell: "L16", label: "Toplam yük", formula: "G_t = G_yük + G_blok + G_halat",
        subst: (x) => `${n(num(x.c.L13))} + ${n(x.inp.hookBlockWeightKg)} + ${n(x.inp.ropeWeightKg)}`, unit: "kg",
      },
      {
        cell: "L18", label: "Gerekli halat emniyet katsayısı",
        formula: "Zp = f(mekanizma sınıfı)  [FEM tablosu]",
        subst: (x) => `${x.specs.hoistMechanismClass} → ${n(num(x.c.L18))}`,
        standard: "FEM 1.001",
      },
      {
        cell: "L19", label: "Halat yükü", formula: "F = G_t / n_toplam / η",
        subst: (x) => `${n(num(x.c.L16))} / ${n(x.inp.totalFalls)} / ${n(num(x.c.L11), 4)}`, unit: "kg",
      },
      {
        cell: "L20", label: "Gerekli min. kopma yükü", formula: "F_k,min = F · Zp",
        subst: (x) => `${n(num(x.c.L19))} · ${n(num(x.c.L18))}`, unit: "kg",
      },
      {
        cell: "L28", label: "Seçilen halatın kopma yükü", formula: "F_k = F_k,kN / 9,81 · 1000",
        subst: (x) => `${n(x.sel.ropeBreakingLoadKn)} / 9,81 · 1000`, unit: "kg",
      },
      {
        cell: "L30", label: "Gerçekleşen emniyet katsayısı", formula: "n = F_k / F",
        subst: (x) => `${n(num(x.c.L28))} / ${n(num(x.c.L19))}`,
      },
    ],
    checkSuffixes: ["rope.safety"],
  },
  {
    id: "2.2.1",
    title: "Tambur — Çap ve Gövde",
    description: "Minimum tambur çapı (FEM H katsayısı) ve tambur sacı gerilme kontrolü.",
    inputKeys: ["drumWallThicknessMm"],
    selectionKeys: ["drumDiaMm", "drumMaterial"],
    rows: [
      {
        cell: "L36", label: "Tambur çap katsayısı", formula: "H = f(mekanizma sınıfı)  [FEM tablosu]",
        subst: (x) => `${x.specs.hoistMechanismClass} → ${n(num(x.c.L36))}`, standard: "FEM 1.001",
      },
      {
        cell: "L38", label: "Minimum tambur çapı", formula: "D_min = H · d",
        subst: (x) => `${n(num(x.c.L36))} · ${n(x.sel.ropeDiaMm)}`, unit: "mm",
      },
      {
        cell: "L41", label: "Oluk adımı", formula: "t = d + pay  [DIN 15061]",
        subst: (x) => `${n(x.sel.ropeDiaMm)} + ${n(num(x.c.L41) - x.sel.ropeDiaMm, 1)}`, unit: "mm", standard: "DIN 15061",
      },
      {
        cell: "L44", label: "Ezilme gerilmesi", formula: "σ_ez = 0,5 · F · 100 / (t · s)",
        subst: (x) => `0,5 · ${n(num(x.c.L19))} · 100 / (${n(num(x.c.L41))} · ${n(x.inp.drumWallThicknessMm)})`,
        unit: "kg/cm²",
      },
      {
        cell: "L46", label: "Eğilme gerilmesi",
        formula: "σ_eğ = 0,96 · F · (1 / ((D/10)² · (s/10)⁶))^0,25",
        subst: (x) => `0,96 · ${n(num(x.c.L19))} · (1 / ((${n(x.sel.drumDiaMm)}/10)² · (${n(x.inp.drumWallThicknessMm)}/10)⁶))^0,25`,
        unit: "kg/cm²",
      },
      {
        cell: "L48", label: "Bileşik gerilme", formula: "σ_b = √(σ_eğ² + σ_ez² − σ_ez·σ_eğ)",
        subst: (x) => `√(${n(num(x.c.L46))}² + ${n(num(x.c.L44))}² − ${n(num(x.c.L44))}·${n(num(x.c.L46))})`,
        unit: "kg/cm²",
      },
      {
        cell: "L50", label: "İzin verilen gerilme", formula: "σ_em = f(malzeme)",
        subst: (x) => `${x.sel.drumMaterial} → ${n(num(x.c.L50))}`, unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["drum.stress", "drum.dia"],
  },
  {
    id: "2.2.2",
    title: "Tambur — Oluk Boyu",
    inputKeys: ["safetyGrooveCount"],
    selectionKeys: ["drumGrooveLengthText"],
    rows: [
      {
        cell: "L60", label: "Gerekli sarım sayısı",
        formula: "z = ((n_t/n_tah) · h) / (π · D) + z_emn",
        subst: (x) => `((${n(x.inp.totalFalls)}/${n(x.inp.drivenFalls)}) · ${n(num(x.c.L57))}) / (π · ${n(x.sel.drumDiaMm / 1000, 3)}) + ${n(x.inp.safetyGrooveCount)}`,
      },
      {
        cell: "L62", label: "Gerekli oluk boyu", formula: "L = z · t",
        subst: (x) => `${n(num(x.c.L60))} · ${n(num(x.c.L41))}`, unit: "mm", digits: 1,
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "2.2.3",
    title: "Tambur Mili",
    description: "Mesnet reaksiyonları, eğilme/kesme ve bileşik gerilme kontrolü.",
    inputKeys: ["drumWeightKg", "shaftSpanACm", "shaftSpanBCm", "shaftSpanCCm", "shaftMomentArmCm", "shaftDiaCm", "shaftShearDiaCm"],
    selectionKeys: ["shaftMaterial"],
    rows: [
      {
        cell: "L80", label: "Mesnet reaksiyonu A",
        formula: "R_A = (F·a + F·(2b+a) + G_tam·(a+b)) / (a + 2b + c)",
        subst: (x) => `(${n(num(x.c.L67))}·${n(x.inp.shaftSpanACm)} + ${n(num(x.c.L67))}·(2·${n(x.inp.shaftSpanBCm)}+${n(x.inp.shaftSpanACm)}) + ${n(x.inp.drumWeightKg)}·(${n(x.inp.shaftSpanACm)}+${n(x.inp.shaftSpanBCm)})) / (${n(x.inp.shaftSpanACm)} + 2·${n(x.inp.shaftSpanBCm)} + ${n(x.inp.shaftSpanCCm)})`,
        unit: "kg",
      },
      {
        cell: "L81", label: "Mesnet reaksiyonu B", formula: "R_B = 2F + G_tam − R_A",
        subst: (x) => `2·${n(num(x.c.L67))} + ${n(x.inp.drumWeightKg)} − ${n(num(x.c.L80))}`, unit: "kg",
      },
      {
        cell: "L84", label: "Eğilme momenti", formula: "M = R_A · l",
        subst: (x) => `${n(num(x.c.L80))} · ${n(x.inp.shaftMomentArmCm)}`, unit: "kg·cm",
      },
      {
        cell: "L86", label: "Eğilme gerilmesi", formula: "σ_eğ = M · (d/2) / (π/4 · (d/2)⁴)",
        subst: (x) => `${n(num(x.c.L84))} · ${n(x.inp.shaftDiaCm / 2)} / (π/4 · ${n(x.inp.shaftDiaCm / 2)}⁴)`,
        unit: "kg/cm²",
      },
      {
        cell: "L87", label: "Kesme gerilmesi", formula: "τ = 1,33 · max(R_A, R_B) / (π · (d_k/2)²)",
        subst: (x) => `1,33 · ${n(Math.max(num(x.c.L80), num(x.c.L81)))} / (π · ${n(x.inp.shaftShearDiaCm / 2, 2)}²)`,
        unit: "kg/cm²",
      },
      {
        cell: "L88", label: "Bileşik gerilme", formula: "σ_b = √(σ_eğ² + τ²)",
        subst: (x) => `√(${n(num(x.c.L86))}² + ${n(num(x.c.L87))}²)`, unit: "kg/cm²",
      },
      {
        cell: "L94", label: "İzin verilen bileşik gerilme", formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c.L94))}`, unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["shaft.stress"],
  },
  {
    id: "2.2.4",
    title: "Tambur Kaynağı",
    inputKeys: ["drumWeldThicknessCm", "drumWeldAllowable"],
    selectionKeys: [],
    rows: [
      {
        cell: "L98", label: "Kaynak boyu", formula: "L_k = π · D / 10",
        subst: (x) => `π · ${n(x.sel.drumDiaMm)} / 10`, unit: "cm",
      },
      {
        cell: "L105", label: "Kaynak halka alanı", formula: "A = π·((D_d/2)² − (D_i/2)²) / 100",
        subst: (x) => `π·((${n(num(x.c.L103))}/2)² − (${n(num(x.c.L104))}/2)²) / 100`, unit: "cm²",
      },
      {
        cell: "L106", label: "Polar mukavemet momenti", formula: "W_p = π·((D_d/10)⁴ − (D_i/10)⁴) / 32",
        subst: (x) => `π·((${n(num(x.c.L103))}/10)⁴ − (${n(num(x.c.L104))}/10)⁴) / 32`, unit: "cm³",
      },
      {
        cell: "L107", label: "Burulma gerilmesi", formula: "τ_b = M_t · 100000 / 9,81 / W_p",
        subst: (x) => `${n(num(x.c.L164), 3)} · 100000 / 9,81 / ${n(num(x.c.L106))}`, unit: "kg/cm²",
      },
      {
        cell: "L108", label: "Kesme gerilmesi", formula: "τ_k = R_B / A",
        subst: (x) => `${n(num(x.c.L81))} / ${n(num(x.c.L105))}`, unit: "kg/cm²",
      },
      {
        cell: "L109", label: "Bileşik gerilme", formula: "σ_b = τ_k + τ_b",
        subst: (x) => `${n(num(x.c.L108))} + ${n(num(x.c.L107))}`, unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["drumWeld.stress"],
  },
  {
    id: "2.2.5",
    title: "Tambur Mili Kaynağı",
    inputKeys: ["shaftWeldThicknessCm", "shaftWeldAllowable"],
    selectionKeys: [],
    rows: [
      {
        cell: "L114", label: "Kaynak boyu", formula: "L_k = π · d",
        subst: (x) => `π · ${n(x.inp.shaftDiaCm)}`, unit: "cm",
      },
      {
        cell: "L121", label: "Kaynak halka alanı", formula: "A = π·((d_d/2)² − (d_i/2)²) / 100",
        subst: (x) => `π·((${n(num(x.c.L119))}/2)² − (${n(num(x.c.L120))}/2)²) / 100`, unit: "cm²",
      },
      {
        cell: "L124", label: "Kesme gerilmesi", formula: "τ = R_B / A",
        subst: (x) => `${n(num(x.c.L81))} / ${n(num(x.c.L121))}`, unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["shaftWeld.stress"],
  },
  {
    id: "2.2.6",
    title: "Tambur Rulmanı",
    description: "Eşdeğer yükler, statik emniyet ve L10 yorulma ömrü (FEM T.2.1.3.2).",
    inputKeys: ["bearingFactorY1", "bearingFactorY2"],
    selectionKeys: ["bearingType", "bearingCode", "bearingDynCKn", "bearingStatC0Kn"],
    rows: [
      {
        cell: "L130", label: "Radyal yük", formula: "F_r = R_A · 0,00981",
        subst: (x) => `${n(num(x.c.L80))} · 0,00981`, unit: "kN",
      },
      {
        cell: "L131", label: "Eksenel yük", formula: "F_a = 0,1 · F_r",
        subst: (x) => `0,1 · ${n(num(x.c.L130))}`, unit: "kN",
      },
      {
        cell: "L137", label: "Eşdeğer statik yük", formula: "P₀ = F_r + Y₁ · F_a",
        subst: (x) => `${n(num(x.c.L130))} + ${n(x.inp.bearingFactorY1)} · ${n(num(x.c.L131))}`, unit: "kN",
      },
      {
        cell: "L146", label: "Statik emniyet", formula: "s₀ = C₀ / P₀",
        subst: (x) => `${n(x.sel.bearingStatC0Kn)} / ${n(num(x.c.L137))}`,
      },
      {
        cell: "L149", label: "Tambur devri", formula: "n_t = (v · n_top/n_tah) / (D · π)",
        subst: (x) => `(${n(x.which === "main" ? x.specs.mainLiftSpeedMpm : x.specs.auxLiftSpeedMpm)} · ${n(x.inp.totalFalls)}/${n(x.inp.drivenFalls)}) / (${n(x.sel.drumDiaMm / 1000, 3)} · π)`,
        unit: "d/dak",
      },
      {
        cell: "L152", label: "Rulman ömrü (L10)", formula: "L₁₀ = (10⁶ / (60·n)) · (C/P)^(10/3)",
        subst: (x) => `(10⁶ / (60·${n(num(x.c.L150))})) · (${n(x.sel.bearingDynCKn)}/${n(num(x.c.L138))})^(10/3)`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
      {
        cell: "L154", label: "Gerekli minimum ömür", formula: "L_min = f(kullanım sınıfı)",
        subst: (x) => `${x.specs.hoistUsageClass} → ${n(num(x.c.L154), 0)}`, unit: "saat", digits: 0,
      },
    ],
    checkSuffixes: ["bearing.life", "bearing.static"],
  },
  {
    id: "2.3",
    title: "Redüktör (Dişli Kutusu)",
    description: "Tambur torku, gerekli çevrim oranı ve redüktör seçimi.",
    inputKeys: ["drumCount", "gearboxServiceFactor"],
    selectionKeys: ["gearboxModel", "gearboxRatio", "gearboxNominalTorqueKnm", "gearboxInputShaftMm", "gearboxOutputShaftMm", "gearboxAllowedRadialKn"],
    rows: [
      {
        cell: "L162", label: "Tambur torku", formula: "M_t = r · n_tah · F_kN",
        subst: (x) => `${n(num(x.c.L158), 3)} · ${n(x.inp.drivenFalls)} · ${n(num(x.c.L160), 3)}`, unit: "kNm", digits: 3,
      },
      {
        cell: "L167", label: "Gerekli redüktör torku", formula: "M_g = k_e · M_t",
        subst: (x) => `${n(x.inp.gearboxServiceFactor)} · ${n(num(x.c.L164), 3)}`, unit: "kNm", digits: 3,
      },
      {
        cell: "L172", label: "Gerekli çevrim oranı", formula: "i_g = n_motor / n_tambur",
        subst: (x) => `${n(x.sel.motorRpm)} / ${n(num(x.c.L149))}`,
      },
      {
        cell: "L182", label: "Oran sapması", formula: "Δi = 100 · (i_seç − i_g) / i_g",
        subst: (x) => `100 · (${n(x.sel.gearboxRatio)} − ${n(num(x.c.L172))}) / ${n(num(x.c.L172))}`, unit: "%",
      },
      {
        cell: "L185", label: "Gerçekleşen kaldırma hızı", formula: "v = (n_m / i) · π · D / (n_top/n_tah)",
        subst: (x) => `(${n(x.sel.motorRpm)} / ${n(x.sel.gearboxRatio)}) · π · ${n(x.sel.drumDiaMm / 1000, 3)} / ${n(x.inp.totalFalls / x.inp.drivenFalls)}`,
        unit: "m/dak",
      },
      {
        cell: "L179", label: "Gerçekleşen emniyet", formula: "n = M_nominal / M_t",
        subst: (x) => `${n(x.sel.gearboxNominalTorqueKnm)} / ${n(num(x.c.L164), 3)}`,
      },
      {
        cell: "L187", label: "Redüktöre gelen radyal yük", formula: "F_rad = R_A · 9,81 / 1000",
        subst: (x) => `${n(num(x.c.L80))} · 9,81 / 1000`, unit: "kN",
      },
    ],
    checkSuffixes: ["gearbox.torque", "gearbox.ratio", "gearbox.radial"],
  },
  {
    id: "2.4",
    title: "Motor",
    description: "Motor giriş torku ve gerekli güç (CMAA 70).",
    inputKeys: ["reducerStages", "stageEfficiency", "tempFactor", "motorDivisor"],
    selectionKeys: ["motorBrand", "motorPowerKw", "motorRpm", "motorShaftMm", "motorCount"],
    rows: [
      {
        cell: "L192", label: "Redüktör çıkış torku", formula: "M_ç = M_t · 1000",
        subst: (x) => `${n(num(x.c.L164), 3)} · 1000`, unit: "Nm",
      },
      {
        cell: "L197", label: "Redüktör verimi", formula: "η_r = η_kademe^s",
        subst: (x) => `${n(x.inp.stageEfficiency)}^${n(x.inp.reducerStages)}`, digits: 4,
      },
      {
        cell: "L199", label: "Motor giriş torku", formula: "M_m = M_ç / (i · η_r)",
        subst: (x) => `${n(num(x.c.L192))} / (${n(x.sel.gearboxRatio)} · ${n(num(x.c.L197), 4)})`, unit: "Nm",
      },
      {
        cell: "L202", label: "Gerekli güç", formula: "P = M_m · n_m / 9550",
        subst: (x) => `${n(num(x.c.L199))} · ${n(x.sel.motorRpm)} / 9550`, unit: "kW",
      },
      {
        cell: "L204", label: "Sıcaklık düzeltmeli güç", formula: "P' = k_t · P",
        subst: (x) => `${n(x.inp.tempFactor)} · ${n(num(x.c.L202))}`, unit: "kW",
      },
      {
        cell: "I215", label: "Kurulu güç", formula: "P_kurulu = P_motor · adet",
        subst: (x) => `${n(x.sel.motorPowerKw)} · ${n(x.sel.motorCount)}`, unit: "kW",
      },
    ],
    checkSuffixes: ["motor.power"],
  },
  {
    id: "2.5",
    title: "Fren",
    inputKeys: ["brakeServiceFactor"],
    selectionKeys: ["brakeBrand", "brakeModel", "brakeTorqueNm", "brakeWheelDiaMm", "brakeQty"],
    rows: [
      {
        cell: "L218", label: "Fren miline gelen tork", formula: "M_f = M_m / adet",
        subst: (x) => `${n(num(x.c.L199))} / ${n(x.sel.motorCount)}`, unit: "Nm",
      },
      {
        cell: "L220", label: "Gerekli fren torku", formula: "M_f,g = M_f · k_f",
        subst: (x) => `${n(num(x.c.L218))} · ${n(x.inp.brakeServiceFactor)}`, unit: "Nm",
      },
      {
        cell: "L228", label: "Gerçekleşen emniyet", formula: "n = M_fren / M_f",
        subst: (x) => `${n(x.sel.brakeTorqueNm)} / ${n(num(x.c.L218))}`,
      },
    ],
    checkSuffixes: ["brake.torque"],
  },
  {
    id: "2.6",
    title: "Motor — Redüktör Kaplini",
    inputKeys: ["motorCouplingServiceFactor"],
    selectionKeys: ["motorCouplingBrand", "motorCouplingModel", "motorCouplingTorqueNm", "motorCouplingDmaxMm"],
    rows: [
      {
        cell: "L235", label: "Gerekli kaplin kapasitesi", formula: "M_k = M_m · k",
        subst: (x) => `${n(num(x.c.L233))} · ${n(x.inp.motorCouplingServiceFactor)}`, unit: "Nm",
      },
      {
        cell: "L236", label: "Bağlanacak en büyük mil", formula: "d = max(d_motor, d_redüktör)",
        subst: (x) => `max(${n(x.sel.motorShaftMm)}, ${n(x.sel.gearboxInputShaftMm)})`, unit: "mm",
      },
      {
        cell: "L243", label: "Gerçekleşen emniyet", formula: "n = M_kaplin / M_m",
        subst: (x) => `${n(x.sel.motorCouplingTorqueNm)} / ${n(num(x.c.L233))}`,
      },
    ],
    checkSuffixes: ["motorCoupling.torque", "motorCoupling.bore"],
  },
  {
    id: "2.7",
    title: "Tambur Kaplini",
    inputKeys: ["drumCouplingServiceFactor"],
    selectionKeys: ["drumCouplingBrand", "drumCouplingModel", "drumCouplingTorqueNm", "drumCouplingRadialN", "drumCouplingDmaxMm"],
    rows: [
      {
        cell: "L251", label: "Gerekli kaplin kapasitesi", formula: "M_k = M_t · 1000 · k",
        subst: (x) => `${n(num(x.c.L249))} · ${n(x.inp.drumCouplingServiceFactor)}`, unit: "Nm",
      },
      {
        cell: "L252", label: "Gerekli radyal yük kapasitesi", formula: "F_rad = R_A · 9,81",
        subst: (x) => `${n(num(x.c.L80))} · 9,81`, unit: "N",
      },
      {
        cell: "L262", label: "Gerçekleşen emniyet", formula: "n = M_kaplin / M_t",
        subst: (x) => `${n(x.sel.drumCouplingTorqueNm)} / ${n(num(x.c.L249))}`,
      },
    ],
    checkSuffixes: ["drumCoupling.torque", "drumCoupling.radial", "drumCoupling.bore"],
  },
];

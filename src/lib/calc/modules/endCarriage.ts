// Başkiriş hesabı — Excel "09-BAŞKİRİŞ" sayfasının parametrik karşılığı.
// Akış: tekerlek yükleri Fmax/Fmin → eğilme momentleri → kutu kesit
// özellikleri → DIN 15018 dinamik katsayı (ψ = k + l·v) → gerilmeler ve
// statik kontrol → yorulma.
//
// NOT — Yorulma bloğu: Excel'in L70..N104 aralığı BOZUKTUR (L70/L93 `#ref!`
// içerir, L82 ArrayFormula artığıdır; N88/N99/N104 #NAME?/#VALUE! üretir).
// Bu hücreler `cells` haritasına KONMAZ; yorulma bloğu 07-ANA KİRİŞ'in
// çalışan DIN 15018 mantığıyla (tables.DIN15018_T17 + Tablo 18 formülü)
// temiz yeniden yazılmıştır ve sonuçları `cells` içinde Excel-dışı anahtar
// adlarıyla (fatigue.*) yer alır. İlgili kontroller nonExcel: true'dur.
//
// Birimler: kg, mm, cm³, cm⁴, kg/m, kg·cm, kg/cm² (Excel "kg.cm2" yazsa da
// kastedilen kg/cm²'dir), N/mm².

import { DIN15018_T17 } from "../tables";
import type { AnyCheck, HoistClass, LoadGroup, ModuleResult, TechnicalSpecs } from "../types";
import type { FatigueMaterial, NotchClass } from "./mainGirder";

/** Diğer sayfalardan çekilen değerler */
export interface EndCarriageDeps {
  mainHoistTotalLoadKg: number;      // 02!L16 — yük + kanca bloğu + halat [kg]
  trolleyWeightT: number;            // 06!L5  — araba ağırlığı [t]
  bridgeGirdersWeightT: number;      // 06!L6  — köprü ana kirişleri ağırlığı [t]
  bridgeEndCarriagesWeightT: number; // 06!L7  — başkirişler ağırlığı [t]
}

/** Kullanıcı girdileri — Excel 09 sayfası statikleri */
export interface EndCarriageInputs {
  wheelSpanAMm: number;        // L14 — tekerlekler arası mesafe a [mm]
  loadOffsetBMm: number;       // L15 — kiriş oturma noktası b [mm]
  topPlateThicknessMm: number; // L24 — üst sac kalınlığı [mm]
  topPlateWidthMm: number;     // N24 — üst sac genişliği [mm]
  sidePlateThicknessMm: number; // L25 — yan sac kalınlığı [mm]
  sidePlateHeightMm: number;   // N25 — yan sac yüksekliği [mm]
  bottomPlateThicknessMm: number; // L26 — alt sac kalınlığı [mm]
  bottomPlateWidthMm: number;  // N26 — alt sac genişliği [mm]
  fatigueTensileNmm2: number;  // σB [N/mm²] — 07!F417 deseni (Excel 09'da bozuk L82)
}

/** Mühendis seçimleri */
export interface EndCarriageSelections {
  hoistClass: HoistClass;          // L37 — kaldırma sınıfı (H2)
  material: FatigueMaterial;       // L49 — S235JR / S355JR (statik izin için)
  fatigueMaterial: FatigueMaterial; // Excel niyeti: bozuk `#ref!` malzeme hücresi (L49 ile aynı)
  fatigueLoadGroup: LoadGroup;     // L64 — B1..B6 (DIN 15018)
  fatigueNotchClass: NotchClass;   // L65 — W0..K4 (DIN 15018)
}

export interface EndCarriageValues {
  fMaxKg: number;            // L11
  fMinKg: number;            // L12
  mMaxKgCm: number;          // L18
  mMinKgCm: number;          // L21
  weightPerM: number;        // L29
  inertiaCm4: number;        // L30
  sectionModulusCm3: number; // L31
  areaCm2: number;           // L32
  shearAreaCm2: number;      // L33
  dynamicFactor: number;     // L39 — ψ = k + l·v
  sigmaKgCm2: number;        // L45
  tauKgCm2: number;          // L46
  sigmaCombinedKgCm2: number; // L47
  allowableKgCm2: number;    // L50
  // Yorulma (temiz yeniden yazım)
  sigmaMaxKgCm2: number;     // L55
  tauMaxKgCm2: number;       // L56
  sigmaCombMaxKgCm2: number; // L57
  sigmaMinKgCm2: number;     // L60
  tauMinKgCm2: number;       // L61
  sigmaCombMinKgCm2: number; // L62
  kappa: number;             // L77 — κ = σbil,min / σbil,maks
  zulSigmaD1Nmm2: number;    // zul σD(-1) — DIN 15018 T17 [N/mm²]
  zulSigmaD1KgCm2: number;   // kg/cm² karşılığı (·100/9,81)
  zulSigmaDz0KgCm2: number;  // zul σDz(0) = zul σD(-1)·5/3
  sigmaBKgCm2: number;       // σB [kg/cm²]
  zulSigmaDzKappaKgCm2: number; // zul σDz(κ) — DIN 15018 T18
  zulTauW0Nmm2: number;      // zul τ için W0 T17 değeri [N/mm²]
  zulTauDKgCm2: number;      // zul τD(κ) = W0/√3 [kg/cm²]
  fatigueCombined: number;   // (σmax/zul σ)² + (τmax/zul τ)²
}

const tick = (b: boolean) => (b ? "ü" : "û");

/** DIN 15018 Tablo 17 lookup (07!F409 deseni) */
function t17(material: FatigueMaterial, notch: NotchClass, group: LoadGroup): number {
  return DIN15018_T17[material === "S355JR" ? "St52" : "St37"][notch][group];
}

export function computeEndCarriage(
  specs: TechnicalSpecs,
  inp: EndCarriageInputs,
  sel: EndCarriageSelections,
  deps: EndCarriageDeps
): ModuleResult<EndCarriageValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // --- 9.1 Tekerlek yükleri ve momentler -----------------------------------
  // Fmax = (02!L16/2 + 06!L5·1000/2)·0,9 + (06!L6 + 06!L7)·1000/4 — Excel L11
  const L11 =
    (deps.mainHoistTotalLoadKg / 2 + (deps.trolleyWeightT * 1000) / 2) * 0.9 +
    ((deps.bridgeGirdersWeightT + deps.bridgeEndCarriagesWeightT) * 1000) / 4;
  // Fmin = (06!L5·1000/2)·0,5 + (06!L6 + 06!L7)·1000/4 — Excel L12
  const L12 =
    ((deps.trolleyWeightT * 1000) / 2) * 0.5 +
    ((deps.bridgeGirdersWeightT + deps.bridgeEndCarriagesWeightT) * 1000) / 4;
  const L14 = inp.wheelSpanAMm;
  const L15 = inp.loadOffsetBMm;
  const L18 = (L11 * L15) / 10; // Mmaks [kg·cm]
  const L21 = (L12 * L15) / 10; // Mmin [kg·cm]
  Object.assign(cells, { L11, L12, L14, L15, L18, L21 });

  // --- 9.2 Kutu kesit özellikleri ------------------------------------------
  const L24 = inp.topPlateThicknessMm, N24 = inp.topPlateWidthMm;
  const L25 = inp.sidePlateThicknessMm, N25 = inp.sidePlateHeightMm;
  const L26 = inp.bottomPlateThicknessMm, N26 = inp.bottomPlateWidthMm;
  const L29 = ((L24 * N24 + L25 * N25 * 2 + L26 * N26) * 1000 * 7.85) / 10 ** 6; // G [kg/m]
  const L30 =
    ((L25 / 10) * (N25 / 10) ** 3 / 12) * 2 +
    ((N24 / 10) * (L24 / 10) ** 3 / 12 + (L24 / 10) * (N24 / 10) * ((N25 / 10) / 2) ** 2) +
    (L26 / 10) * (N26 / 10) * ((N25 / 10) / 2) ** 2; // I [cm⁴]
  const L31 = L30 / (N25 / 20); // W [cm³]
  const L32 = (L24 / 10) * (N24 / 10) + (L25 / 10) * (N25 / 10) * 2 + (L26 / 10) * (N26 / 10); // A [cm²]
  const L33 = (L25 / 10) * (N25 / 10) * 2; // Ay [cm²]
  Object.assign(cells, { L29, L30, L31, L32, L33 });

  // --- 9.3 DIN 15018 dinamik katsayı ---------------------------------------
  const hc = sel.hoistClass;
  // k — Excel L41
  const L41 = hc === "H1" ? 1.1 : hc === "H2" ? 1.2 : hc === "H3" ? 1.3 : 1.4;
  // l — Excel L42
  const L42 = hc === "H1" ? 0.0022 : hc === "H2" ? 0.0044 : hc === "H3" ? 0.0066 : 0.0088;
  // ψ = k + l·v (v: ana kaldırma hızı 01!P6) — Excel L39, DIN 15018 Tablo 2
  const L39 = L41 + L42 * specs.mainLiftSpeedMpm;
  Object.assign(cells, { L39, L41, L42 });

  // --- 9.4 Gerilmeler ve statik kontrol ------------------------------------
  const L45 = (L18 * L39) / L31; // σ [kg/cm²]
  const L46 = (L11 * L39) / L33; // τ [kg/cm²]
  const L47 = Math.sqrt(L45 ** 2 + 3 * L46 ** 2); // σbil [kg/cm²]
  // İzin verilen gerilme — Excel L50 (FEM T.3.2.1.1)
  const L50 = sel.material === "S355JR" ? 2300 : 1530;
  const P47 = tick(L47 <= L50);
  Object.assign(cells, { L45, L46, L47, L50, P47 });
  checks.push({
    id: "endCarriage.stress",
    label: "Başkiriş bileşik gerilmesi",
    required: L47, provided: L50, unit: "kg/cm²", op: ">=", pass: L47 <= L50,
    standard: "FEM T.3.2.1.1",
  });

  // --- 9.5 Yorulma gerilmeleri (Excel'in sağlam hücreleri) ------------------
  const L55 = L18 / L31; // σmaks [kg/cm²]
  const L56 = L11 / L33; // τmaks [kg/cm²]
  const L57 = Math.sqrt(L55 ** 2 + 3 * L56 ** 2);
  const L60 = L21 / L31; // σmin [kg/cm²]
  const L61 = L12 / L33; // τmin [kg/cm²]
  const L62 = Math.sqrt(L60 ** 2 + 3 * L61 ** 2);
  const L77 = L62 / L57; // κ
  // I88/I99: Excel karşılaştırma göstergeleri (=L55 / =L56) — sağlamdır
  Object.assign(cells, { L55, L56, L57, L60, L61, L62, L77, I88: L55, I99: L56 });

  // --- 9.6 Yorulma izin gerilmeleri — TEMİZ YENİDEN YAZIM -------------------
  // Excel L70/L71/L73/L85/L93/L94/L96 bozuktur; 07-ANA KİRİŞ'in çalışan
  // deseni uygulanır: T17 lookup → zul σDz(0) → Tablo 18 κ düzeltmesi.
  // (Excel'in bozuk L94'ü N/mm²→kg/cm² için ·9,81 kullanıyordu; doğru
  // dönüşüm ·100/9,81'dir ve L71 ile tutarlı olan bu kullanılır.)
  const zulSigmaD1Nmm2 = t17(sel.fatigueMaterial, sel.fatigueNotchClass, sel.fatigueLoadGroup);
  const zulSigmaD1KgCm2 = (zulSigmaD1Nmm2 * 100) / 9.81;   // Excel L71 niyeti
  const zulSigmaDz0KgCm2 = (zulSigmaD1KgCm2 * 5) / 3;      // Excel L73 niyeti
  const sigmaBKgCm2 = (inp.fatigueTensileNmm2 * 100) / 9.81;
  // zul σDz(κ) — DIN 15018 Tablo 18 (07!F419 deseni)
  const zulSigmaDzKappaKgCm2 =
    zulSigmaDz0KgCm2 / (1 - (1 - zulSigmaDz0KgCm2 / sigmaBKgCm2 / 0.75) * L77);
  const zulTauW0Nmm2 = t17(sel.fatigueMaterial, "W0", sel.fatigueLoadGroup);
  const zulTauDKgCm2 = ((zulTauW0Nmm2 * 100) / 9.81) / Math.sqrt(3); // 07!G431 deseni
  // Bileşik yorulma — Excel I104 niyeti (DIN 15018 7.4.5)
  const fatigueCombined = (L55 / zulSigmaDzKappaKgCm2) ** 2 + (L56 / zulTauDKgCm2) ** 2;
  // Excel-dışı anahtarlar (bozuk Excel adresleri bilinçli olarak kullanılmaz)
  Object.assign(cells, {
    "fatigue.zulSigmaD1Nmm2": zulSigmaD1Nmm2,
    "fatigue.zulSigmaD1KgCm2": zulSigmaD1KgCm2,
    "fatigue.zulSigmaDz0KgCm2": zulSigmaDz0KgCm2,
    "fatigue.sigmaBKgCm2": sigmaBKgCm2,
    "fatigue.zulSigmaDzKappaKgCm2": zulSigmaDzKappaKgCm2,
    "fatigue.zulTauW0Nmm2": zulTauW0Nmm2,
    "fatigue.zulTauDKgCm2": zulTauDKgCm2,
    "fatigue.combined": fatigueCombined,
  });
  checks.push({
    id: "endCarriage.fatigue.sigma",
    label: "Yorulma σmaks ≤ zul σDz(κ)",
    required: L55, provided: zulSigmaDzKappaKgCm2, unit: "kg/cm²", op: ">=",
    pass: L55 <= zulSigmaDzKappaKgCm2,
    standard: "DIN 15018 T.17/18", nonExcel: true,
  });
  checks.push({
    id: "endCarriage.fatigue.tau",
    label: "Yorulma τmaks ≤ zul τD(κ)",
    required: L56, provided: zulTauDKgCm2, unit: "kg/cm²", op: ">=",
    pass: L56 <= zulTauDKgCm2,
    standard: "DIN 15018 T.17", nonExcel: true,
  });
  checks.push({
    id: "endCarriage.fatigue.combined",
    label: "Bileşik yorulma oranı",
    required: fatigueCombined, provided: 1.1, unit: "-", op: ">=",
    pass: fatigueCombined <= 1.1,
    standard: "DIN 15018 7.4.5", nonExcel: true,
  });

  const values: EndCarriageValues = {
    fMaxKg: L11,
    fMinKg: L12,
    mMaxKgCm: L18,
    mMinKgCm: L21,
    weightPerM: L29,
    inertiaCm4: L30,
    sectionModulusCm3: L31,
    areaCm2: L32,
    shearAreaCm2: L33,
    dynamicFactor: L39,
    sigmaKgCm2: L45,
    tauKgCm2: L46,
    sigmaCombinedKgCm2: L47,
    allowableKgCm2: L50,
    sigmaMaxKgCm2: L55,
    tauMaxKgCm2: L56,
    sigmaCombMaxKgCm2: L57,
    sigmaMinKgCm2: L60,
    tauMinKgCm2: L61,
    sigmaCombMinKgCm2: L62,
    kappa: L77,
    zulSigmaD1Nmm2,
    zulSigmaD1KgCm2,
    zulSigmaDz0KgCm2,
    sigmaBKgCm2,
    zulSigmaDzKappaKgCm2,
    zulTauW0Nmm2,
    zulTauDKgCm2,
    fatigueCombined,
  };
  return { values, checks, cells };
}

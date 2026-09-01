// Kaldırma grubu hesabı — ana ve yardımcı kaldırma mekanizmasının tek
// parametrik modülü (`which` ile hangi mekanizma olduğu seçilir).
//
// YÖNTEM doğrudan standartlara dayanır:
//   · FEM 1.001 T.4.2.2.1.2 — halat emniyet katsayısı Zp
//   · FEM 1.001 T.4.2.3.1.1 — minimum tambur çapı katsayısı H
//   · FEM 1.001 T.2.1.3.2   — mekanizma kullanım sınıfı → gerekli rulman ömrü
//   · DIN 15061             — tambur yiv hatvesi
//   · CMAA 70 4.11.4.1      — mil gerilmeleri
//   · CMAA 70 5.2.9.1.1     — kaldırma motoru gücü
//
// Hesaplanan her büyüklük `cells` haritasında SEMANTİK anahtarla
// (`<blok>.<büyüklük>`) yer alır: `rope.load`, `drum.minDia`,
// `drumShaft.reactionGearbox`, `gearbox.requiredTorque` gibi. Sunum katmanı ve
// tarihsel doğrulama fikstürü yalnız bu anahtarları okur.
//
// Ortak kütüphaneler: halat donanımı `reeving.ts`, kiriş statiği `beam.ts`,
// dairesel kesit gerilmeleri `shaftStress.ts` üzerinden çözülür.
//
// Birimler: kg, kg/cm², cm, mm, kN, kNm, Nm, kW, m/dak, d/dak.

import {
  SAFETY_BRAKE_FRICTION,
  brakeTorqueNm,
  brakesInArrangement,
  clampForceKn,
  minFlangeDiaMm,
  hydraulicUnitByCode,
  recommendHydraulicUnit,
  safetyBrakeByCode,
} from "../safety-brake";
import { solveBeam, type PointLoad } from "../beam";
import {
  drumAllowableStress,
  drumCoefficient,
  equalizerCoefficient,
  groovePitch,
  mechanismLife,
  ropeSafetyFactor,
  shaftMaterialAllowables,
} from "../coefficients";
import { commonReevingByLabel, deriveReeving, type Reeving } from "../reeving";
import { wedgeSocketForRope } from "../wedge-socket";
import { loadCellForLoad } from "../load-cell";
import { shaftStress } from "../shaftStress";
import { drumBrakeSpec } from "../drum-brake";
import { KGF_TO_MPA } from "@/lib/units";
import { hasSafetyBrake, hoistEquipmentArrangement } from "../types";
import type {
  AnyCheck,
  DrumMaterial,
  MechanismClass,
  ModuleResult,
  ShaftMaterial,
  TechnicalSpecs,
  UsageClass,
} from "../types";

/**
 * Kaldırma grubu varyantı. Aynı hesap; yalnız kapasite/yükseklik/hız ve
 * FEM sınıfları teknik özelliklerin farklı alanlarından okunur.
 */
export type HoistWhich = "main" | "aux" | "mono1" | "mono2";

// ------------------------------------------------ kaynak izin gerilmeleri

/**
 * FEM 1.001 T.3.2.2.3 — köşe (fillet) kaynak dikişinde izin verilen en büyük
 * EŞDEĞER gerilme, yükleme durumu I [N/mm²].
 *
 * Tabloda köşe kaynağın "enine çekme" ve "kayma" satırları AYNI değeri verir
 * (A.37: 113 · A.42: 124 · A.52: 170); tambur ve mil dikişleri her iki etkiyi
 * de gördüğü için bu ortak değer sınırdır. Durum II/III değerleri (127/152 ve
 * 138/170 ve 191/230) daha yüksektir; uygulama yalnız normal işletmeyi
 * (Durum I) hesapladığından en muhafazakâr olan alınır.
 */
const FEM_FILLET_WELD_CASE_I_MPA: Record<DrumMaterial, number> = {
  St44: 124, // A.42
  St52: 170, // A.52
  "St44/St52": 124, // karışık imalatta zayıf malzeme belirleyicidir
  S235: 113, // A.37 (Fe 360)
  S355: 170, // A.52 (Fe 510)
};

/** Yapı çeliğinin akma gerilmesi σ_akma [N/mm²] — EN 10025-2 */
const STRUCTURAL_YIELD_MPA: Record<DrumMaterial, number> = {
  St44: 275,
  St52: 355,
  "St44/St52": 275,
  S235: 235,
  S355: 355,
};

/**
 * CMAA 70 md. 3.4.1 — Durum 1 (Stress Level 1) izin verilen KAYMA gerilmesi
 * katsayısı: τ_em = 0,35 · σ_akma. SAF KAYMA için geçerlidir.
 */
export const CMAA_WELD_SHEAR_FACTOR = 0.35;

/**
 * CMAA 70 md. 3.4.1 — Durum 1 izin verilen ÇEKME/EĞİLME gerilmesi katsayısı:
 * σ_em = 0,60 · σ_akma. Md. 3.4.4.2'nin kaynak için tanımladığı ASAL gerilme
 * (σv) bu sınırla karşılaştırılır ("… ≤ σALL"); asal gerilme bir NORMAL
 * gerilmedir, kayma sınırıyla karşılaştırılamaz.
 */
export const CMAA_WELD_TENSION_FACTOR = 0.6;

/** Bir kaynak dikişinin iki standarttan gelen izin gerilmeleri [MPa] */
export interface WeldAllowableStress {
  /** FEM 1.001 T.3.2.2.3 — köşe kaynak, Durum I (eşdeğer gerilme σcp sınırı) */
  femMPa: number;
  /** CMAA 70 md. 3.4.1 — 0,60 · σ_akma (md. 3.4.4.2 asal gerilme sınırı) */
  cmaaTensionMPa: number;
  /** CMAA 70 md. 3.4.1 — 0,35 · σ_akma (saf kayma sınırı) */
  cmaaShearMPa: number;
  /** Dayanak metalin akma gerilmesi [N/mm²] */
  yieldMPa: number;
}

/**
 * Kaynak dikişi izin gerilmeleri — İKİ standardın sınırları da üretilir.
 *
 * Dayanak metal olarak tambur sacı (yapı çeliği) alınır: FEM 1.001 3.2.2.3
 * "kaynak metali en az ana metal kadar iyidir" kabulünü yapar ve bir birleşimin
 * dayanımını ZAYIF ana metal yönetir. Tambur–göbek ve mil–göbek dikişlerinde
 * zayıf taraf her zaman yapı çeliğinden yanak/göbek sacıdır; mil malzemesi
 * (C30, 42CrMo4 …) ıslah çeliğidir ve daha dayanıklıdır.
 *
 * SINIRLAR DOĞRUDAN KARŞILAŞTIRILMAZ (bkz. `assessWeld`): her standart kendi
 * gerilme tanımını kullanır; min(FEM ; CMAA) almak elmayla armudu toplamaktı.
 */
export function weldAllowableStress(material: DrumMaterial): WeldAllowableStress {
  const femMPa = FEM_FILLET_WELD_CASE_I_MPA[material] ?? FEM_FILLET_WELD_CASE_I_MPA.S235;
  const yieldMPa = STRUCTURAL_YIELD_MPA[material] ?? STRUCTURAL_YIELD_MPA.S235;
  return {
    femMPa,
    cmaaTensionMPa: CMAA_WELD_TENSION_FACTOR * yieldMPa,
    cmaaShearMPa: CMAA_WELD_SHEAR_FACTOR * yieldMPa,
    yieldMPa,
  };
}

/** Kaynak kontrolünü YÖNETEN kural. */
export type WeldRule = "FEM" | "CMAA-asal" | "CMAA-kayma" | "elle";

/** Yöneten kuralın rapordaki adı ve standart rozeti. */
const WELD_RULE_INFO: Record<WeldRule, { label: string; standard?: string }> = {
  FEM: { label: "FEM — eşdeğer gerilme", standard: "FEM 1.001 T.3.2.2.3" },
  "CMAA-asal": { label: "CMAA — asal gerilme", standard: "CMAA 70 3.4.4.2" },
  "CMAA-kayma": { label: "CMAA — kayma", standard: "CMAA 70 3.4.1" },
  elle: { label: "Elle girilen sınır" },
};

/** Bir kaynak dikişinin iki standarda göre değerlendirilmesi. */
export interface WeldAssessment {
  allow: WeldAllowableStress;
  /** FEM Ek A-3.2.2.3 md.3 eşdeğer gerilmesi σcp = √(σ² + 2·τ²) [kg/cm²] */
  femEquivalent: number;
  /** CMAA 70 md. 3.4.4.2 asal gerilmesi σv [kg/cm²] (mutlak değeri büyük kök) */
  cmaaPrincipal: number;
  /** Dikişteki toplam kayma gerilmesi τ [kg/cm²] */
  shear: number;
  /** σcp / σ_a,k (FEM) */
  femUtilization: number;
  /** max(σv / 0,60σ_akma ; τ / 0,35σ_akma) (CMAA) */
  cmaaUtilization: number;
  /** Yöneten (büyük) kullanım oranı */
  utilization: number;
  rule: WeldRule;
  ruleLabel: string;
  /** Yöneten kuralın standart rozeti (elle girilen sınırda yoktur) */
  standard?: string;
  /** Yöneten kuralın karşılaştırdığı GERİLME [MPa] */
  stressMPa: number;
  /** Yöneten kuralın SINIRI [MPa] */
  allowableMPa: number;
}

/**
 * Bir köşe kaynak dikişini FEM ve CMAA kurallarıyla AYRI AYRI değerlendirir ve
 * kullanım oranı büyük olanı yönetici seçer.
 *
 * NEDEN AYRI: iki standart aynı dikiş için FARKLI gerilme tanımlar.
 *   · FEM 1.001 Ek A-3.2.2.3 md.3 — eşdeğer gerilme
 *         σcp = ( σ² + 2·τ² )^0,5              ≤ σ_a,k (T.3.2.2.3)
 *     Kayma teriminin katsayısı 2'dir; √(σ²+τ²) yazmak dikişi olduğundan
 *     EMNİYETLİ gösterir ve standarda aykırıdır.
 *   · CMAA 70 md. 3.4.4.2 — kaynakta ASAL gerilme
 *         σv = ½(σx+σy) ± ½·√((σx−σy)² + 4·τ²) ≤ σ_ALL
 *     Burada σy = 0 (dikişe dik ikinci normal gerilme yoktur); σ_ALL, md.
 *     3.4.1'in Durum 1 çekme sınırıdır (0,60·σ_akma).
 *   · CMAA 70 md. 3.4.1 — saf kayma sınırı τ ≤ 0,35·σ_akma. Asal gerilme
 *     kuralı kaymayı tek başına sınırlamadığından bu da ayrıca aranır.
 *
 * Eski yöntem √(σ²+τ²) bileşkesini 0,35·σ_akma ile karşılaştırıyordu: ne
 * FEM'in gerilmesi ne CMAA'nın gerilmesiydi; rapor "CMAA 0,35σ_akma" derken
 * CMAA'nın tanımlamadığı bir büyüklüğü sınırlıyordu.
 *
 * `manualAllowableMPa` verilirse (otomatik türetme KAPALI) sınır mühendisin
 * girdiği değerdir; karşılaştırılan gerilme yine FEM eşdeğer gerilmesidir.
 */
export function assessWeld(args: {
  /** Dikişe dik normal gerilme σ [kg/cm²] (yoksa 0) */
  normalKgCm2: number;
  /** Dikişteki TOPLAM kayma gerilmesi τ [kg/cm²] (kesme + burulma) */
  shearKgCm2: number;
  material: DrumMaterial;
  manualAllowableMPa?: number;
}): WeldAssessment {
  const sigma = args.normalKgCm2;
  const tau = args.shearKgCm2;
  const allow = weldAllowableStress(args.material);

  // FEM Ek A-3.2.2.3 md.3 — τ² katsayısı 2'dir.
  const femEquivalent = Math.sqrt(sigma ** 2 + 2 * tau ** 2);
  // CMAA 70 md. 3.4.4.2 — σy = 0 ile iki kök; mutlak değeri büyük olan yönetir.
  const root = Math.sqrt(sigma ** 2 + 4 * tau ** 2);
  const rootPlus = 0.5 * sigma + 0.5 * root;
  const rootMinus = 0.5 * sigma - 0.5 * root;
  const cmaaPrincipal = Math.abs(rootPlus) >= Math.abs(rootMinus) ? rootPlus : rootMinus;

  const femMPa = femEquivalent * KGF_TO_MPA;
  const cmaaPrincipalMPa = Math.abs(cmaaPrincipal) * KGF_TO_MPA;
  const shearMPa = Math.abs(tau) * KGF_TO_MPA;

  const femUtilization = femMPa / allow.femMPa;
  const cmaaAxialUtil = cmaaPrincipalMPa / allow.cmaaTensionMPa;
  const cmaaShearUtil = shearMPa / allow.cmaaShearMPa;
  const cmaaUtilization = Math.max(cmaaAxialUtil, cmaaShearUtil);

  let rule: WeldRule;
  let stressMPa: number;
  let allowableMPa: number;
  if (args.manualAllowableMPa !== undefined) {
    rule = "elle";
    stressMPa = femMPa;
    allowableMPa = args.manualAllowableMPa;
  } else if (femUtilization >= cmaaUtilization) {
    rule = "FEM";
    stressMPa = femMPa;
    allowableMPa = allow.femMPa;
  } else if (cmaaAxialUtil >= cmaaShearUtil) {
    rule = "CMAA-asal";
    stressMPa = cmaaPrincipalMPa;
    allowableMPa = allow.cmaaTensionMPa;
  } else {
    rule = "CMAA-kayma";
    stressMPa = shearMPa;
    allowableMPa = allow.cmaaShearMPa;
  }
  const info = WELD_RULE_INFO[rule];
  return {
    allow,
    femEquivalent,
    cmaaPrincipal,
    shear: tau,
    femUtilization,
    cmaaUtilization,
    utilization: allowableMPa > 0 ? stressMPa / allowableMPa : Number.NaN,
    rule,
    ruleLabel: info.label,
    standard: info.standard,
    stressMPa,
    allowableMPa,
  };
}

// ------------------------------------------------- tambur mili geometrisi

/** Halat yükü konumu seçenekleri (girdi alanı listesiyle aynı metinler). */
// DEĞER DEĞİŞMEZ: kayıtlı revizyonlardaki select değerleri bu dizgeye bağlıdır.
// Kullanıcıya görünen etiket `fields.ts` → `ROPE_POSITION_LABELS` ile verilir
// ("En Kritik Konum").
export const ROPE_POSITION_AUTO = "En elverişsiz (otomatik)";
export const ROPE_POSITION_OUTER = "Dış uçlarda (yanaklara yakın)";
export const ROPE_POSITION_INNER = "İç uçlarda (ortaya yakın)";
export const ROPE_POSITIONS = [
  ROPE_POSITION_AUTO,
  ROPE_POSITION_OUTER,
  ROPE_POSITION_INNER,
] as const;

export function ropePositionMode(v: string | undefined): "auto" | "outer" | "inner" {
  if (v === ROPE_POSITION_OUTER) return "outer";
  if (v === ROPE_POSITION_INNER) return "inner";
  return "auto";
}

/** Yiv bölgesinin uç konumları (mesnet A'dan uzaklık, cm). */
interface GrooveSection {
  /** Yanaklara yakın uç */
  outer: number;
  /** Tambur ortasına yakın uç */
  inner: number;
}

/**
 * Tambur mili ölçüleri GİRDİDE mm, MOTOR İÇİNDE cm'dir.
 *
 * Ölçüler mühendisin teknik resminden okunduğu gibi (mm) sorulur ve saklanır;
 * motorun geri kalanı ise AGENTS.md "Birimler" maddesindeki cm tabanında
 * çalışır (kg·cm moment, kg/cm² gerilme, cm³ direnç momenti).
 *
 * SEÇİLEN YOL — (a) girdiyi mm sakla, TEK NOKTADA cm'ye çevir.
 * Gerekçe: kaldırma zincirinin tamamı (beam.ts kiriş statiği, shaftStress.ts
 * mil gerilmeleri, kaynak kesitleri, derive.ts tambur ağırlığı) cm tabanlıdır.
 * (b) yolunda — tüm zinciri mm'ye taşımak — bu bağıntıların hepsi ile birlikte
 * malzeme izin gerilmesi tabloları ve golden değerler de değişirdi; kazancı
 * olmayan, yüksek riskli bir dokunuş olurdu.
 *
 * DÖNÜŞÜM İKİNCİ BİR YERDE TEKRARLANMAZ: `*Mm` alanları yalnızca aşağıdaki
 * `drumShaftDimsCm` içinde (tek `mmToCm` çağrı kümesi) cm'ye çevrilir. Sunum
 * ve diyagram katmanları da bu iki yardımcıyı kullanır; hiçbir yerde elle
 * "/ 10" yazılmaz.
 */
export const mmToCm = (mm: number): number => mm / 10;

/** cm → mm (sunum/diyagram tarafında motorun cm çıktısını mm göstermek için). */
export const cmToMm = (cm: number): number => cm * 10;

/** Tambur mili ölçü zincirinin motor birimindeki (cm) karşılığı. */
export interface DrumShaftDimsCm {
  aCm: number; bCm: number; cCm: number; dCm: number;
  eCm: number; fCm: number; gCm: number;
  /** D1 — eğilme gerilmesi kesiti çapı (yanak dibi) */
  d1Cm: number;
  /** D2 — yatak / rulman oturma çapı (kesme kesiti) */
  d2Cm: number;
  /** Tambur kaynak dikişi boğaz kalınlığı a */
  drumWeldThroatCm: number;
  /** Mil kaynak dikişi boğaz kalınlığı a */
  shaftWeldThroatCm: number;
}

/**
 * mm cinsinden girilen tambur mili ölçülerini motorun cm birimine çevirir.
 * **Bu, mm → cm dönüşümünün TEK noktasıdır.**
 */
export function drumShaftDimsCm(inp: HoistInputs): DrumShaftDimsCm {
  return {
    aCm: mmToCm(inp.drumSpanAMm),
    bCm: mmToCm(inp.drumSpanBMm),
    cCm: mmToCm(inp.drumSpanCMm),
    dCm: mmToCm(inp.drumSpanDMm),
    eCm: mmToCm(inp.drumSpanEMm),
    fCm: mmToCm(inp.drumSpanFMm),
    gCm: mmToCm(inp.drumSpanGMm),
    d1Cm: mmToCm(inp.shaftD1Mm),
    d2Cm: mmToCm(inp.shaftD2Mm),
    drumWeldThroatCm: mmToCm(inp.drumWeldThicknessMm),
    shaftWeldThroatCm: mmToCm(inp.shaftWeldThicknessMm),
  };
}

export interface DrumShaftGeometry {
  aCm: number;          // redüktör tarafı konsol (moment kolu)
  gCm: number;          // tambur yatağı tarafı konsol (moment kolu)
  spanCm: number;       // mesnetler arası açıklık L
  /**
   * Yanaklar arası NAMLU boyu B+C+D+E+F [cm] — tambur gövdesinin (borusunun)
   * gerçek uzunluğu. Yiv boyu (C ve E) bunun yalnız bir parçasıdır; tambur
   * ağırlığı namlu boyundan hesaplanır (bkz. `derive.ts`).
   */
  barrelCm: number;
  weightArmCm: number;  // tambur ağırlık merkezinin mesnet A'ya uzaklığı
  sections: GrooveSection[];
}

const pos = (v: number | undefined): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * A…G ölçü zincirinden mesnet açıklığını, tambur ağırlık merkezini ve yiv
 * bölgelerinin uç konumlarını türetir. Sağ yiv bölgesi (E) sıfırsa tek helisli
 * tambur kabul edilir ve tek yük noktası kullanılır.
 */
export function drumShaftGeometry(inp: HoistInputs): DrumShaftGeometry {
  // Girdiler mm; motor cm ile çalışır (bkz. `drumShaftDimsCm` — tek dönüşüm noktası).
  const dims = drumShaftDimsCm(inp);
  const A = pos(dims.aCm);
  const B = pos(dims.bCm);
  const C = pos(dims.cCm);
  const D = pos(dims.dCm);
  const E = pos(dims.eCm);
  const F = pos(dims.fCm);
  const G = pos(dims.gCm);
  const barrel = B + C + D + E + F;   // yanaklar arası namlu boyu
  const span = A + barrel + G;
  const sections: GrooveSection[] = [{ outer: A + B, inner: A + B + C }];
  if (E > 0) sections.push({ outer: A + B + C + D + E, inner: A + B + C + D });
  return {
    aCm: A,
    gCm: G,
    spanCm: span > 0 ? span : 1,
    barrelCm: barrel,
    weightArmCm: A + barrel / 2,
    sections,
  };
}

/**
 * Bir yiv helisinin gerekli sarım sayısı z ve yiv boyu L = z · p.
 *
 * Kaldırma yüksekliğinde tambura sarılan halat boyu mekanik avantajla
 * (i = n_toplam / n_tahrik) çarpılır, tambur çevresine bölünür ve üzerine
 * emniyet sarımı eklenir. Sonuç TEK helis içindir; tahrikli kol sayısı kadar
 * helis vardır (yiv boyu "2 x 220 mm" biçiminde gösterilir).
 *
 * Hem hesap motoru hem de "Yiv Boyu" kutusunun otomatik türetmesi (derive.ts)
 * bu tek fonksiyonu okur — iki yerde ayrı formül yazılmaz.
 */
export function drumGrooveRequirement(
  inp: Pick<HoistInputs, "drivenFalls" | "totalFalls" | "fixedSheaveCount" | "sheaveEfficiency" | "reevingLabel" | "safetyGrooveCount">,
  sel: Pick<HoistSelections, "drumDiaMm" | "ropeDiaMm">,
  liftHeightM: number
): { grooves: number; lengthMm: number; pitchMm: number } {
  const rig = deriveReeving(hoistReeving(inp as HoistInputs));
  const pitchMm = groovePitch(sel.ropeDiaMm);
  const rawGrooves =
    (rig.mechanicalAdvantage * liftHeightM) / Math.PI / (sel.drumDiaMm / 1000) +
    inp.safetyGrooveCount;
  // İmalat boyunu keyfî 10/50 mm adımına büyütmek yerine tamamlanmamış son
  // yivi TAM yive çıkarırız. 32,7 yiv gerekiyorsa 33 yiv açılır ve boy 33·p'dir.
  const grooves = Math.ceil(rawGrooves);
  return { grooves, lengthMm: grooves * pitchMm, pitchMm };
}

/**
 * Halatın üstte nasıl dengelendiği; yeni işlerde denge traversi esastır.
 * "none" (Yok): üstte denge elemanı YOKTUR. Halat sipariş matematiğinde denge
 * traversi gibi ele alınır (ayrı sağ/sol helis); farkı SUNUMDADIR — denge
 * ekipmanı bölümü (soket/loadcell/rulman veya makara) hiç açılmaz.
 */
export const ROPE_BALANCING_TYPES = ["equalizerBeam", "equalizerSheave", "none"] as const;
export type RopeBalancingType = (typeof ROPE_BALANCING_TYPES)[number];

export const ROPE_BALANCING_TYPE_LABELS: Record<RopeBalancingType, string> = {
  equalizerBeam: "Denge Traversli",
  equalizerSheave: "Denge Makaralı",
  none: "Yok",
};

export type RopeLay = "right" | "left";

export interface RopeOrderLine {
  lay: RopeLay;
  quantity: number;
  /** Satın alınacak tek halat parçasının boyu [m]. */
  lengthPerPieceM: number;
  /** Bu satırdaki bütün halat parçalarının toplam boyu [m]. */
  totalLengthM: number;
}

export interface RopeLengthPlan {
  /** Tek yiv/helis için gereken halat boyu [m]. */
  lengthPerGrooveM: number;
  /** Yuvarlama öncesi teorik toplam halat boyu [m]. */
  rawTotalLengthM: number;
  /** Her parça yukarı tam metreye çıkarıldığında tek parça sipariş boyu [m]. */
  automaticLengthPerPieceM: number;
  /** Her parça yukarı tam metreye çıkarıldığında otomatik toplam sipariş boyu [m]. */
  automaticTotalLengthM: number;
  /** Otomatik ya da kullanıcı tarafından seçilmiş etkin tek parça boyu [m]. */
  lengthPerPieceM: number;
  /** Otomatik ya da kullanıcı tarafından seçilmiş etkin toplam sipariş boyu [m]. */
  totalLengthM: number;
  pieceCount: number;
  rightLayCount: number;
  leftLayCount: number;
  layLabel: "Sağ Helis" | "Sağ ve Sol Helis";
  lines: RopeOrderLine[];
  arrangementText: string;
}

/**
 * Tambur yiv hesabından satın alınacak halat parçalarını üretir.
 *
 * Tek yiv boyu:
 *   L = z · π · D + %10 h · (n_toplam / n_tahrik)
 *
 * Denge traversinde her tahrikli uç ayrı halattır ve helis yönleri sağ/sol
 * sırayla bölünür. Denge makarasındaysa iki yiv tek sürekli sağ helis halatta
 * birleşir; dolayısıyla parça adedi tahrikli uç sayısının yarısıdır.
 */
/**
 * Halat boyu payı oranı — kaldırma yüksekliğine göre (kullanıcı kararı,
 * 2026-08-24). Kısa kaldırmada uçtaki artık pay oransal olarak büyüktür:
 *   · h ≤ 10 m           → %10
 *   · 10 m < h < 30 m    → %10'dan %5'e LİNEER düşer
 *   · h ≥ 30 m           → %5
 * Pay, tek yiv halat boyuna `pay · h · mekanik avantaj` olarak eklenir.
 */
export function ropeAllowanceFraction(liftHeightM: number): number {
  const h = Number.isFinite(liftHeightM) ? liftHeightM : 0;
  if (h <= 10) return 0.1;
  if (h >= 30) return 0.05;
  return 0.1 - ((h - 10) / 20) * 0.05;
}

export function ropeLengthPlan(
  inp: Pick<HoistInputs, "drivenFalls" | "totalFalls" | "fixedSheaveCount" | "sheaveEfficiency" | "reevingLabel" | "safetyGrooveCount" | "ropeBalancingType" | "ropeOrderLengthAuto">,
  sel: Pick<HoistSelections, "drumDiaMm" | "ropeDiaMm" | "ropeOrderLengthM">,
  liftHeightM: number
): RopeLengthPlan {
  const reeving = hoistReeving(inp as HoistInputs);
  const rig = deriveReeving(reeving);
  const groove = drumGrooveRequirement(inp as HoistInputs, sel, liftHeightM);
  const drumCircumferenceM = Math.PI * (sel.drumDiaMm / 1000);
  const allowanceM = ropeAllowanceFraction(liftHeightM) * liftHeightM * rig.mechanicalAdvantage;
  const lengthPerGrooveM = groove.grooves * drumCircumferenceM + allowanceM;
  const driven = Math.max(1, Math.round(reeving.drivenFalls));
  const rawTotalLengthM = lengthPerGrooveM * driven;
  const equalizerSheave = inp.ropeBalancingType === "equalizerSheave";
  const pieceCount = equalizerSheave ? Math.max(1, Math.ceil(driven / 2)) : driven;
  const rightLayCount = equalizerSheave ? pieceCount : Math.ceil(driven / 2);
  const leftLayCount = equalizerSheave ? 0 : Math.floor(driven / 2);
  const automaticLengthPerPieceM = Math.ceil(rawTotalLengthM / pieceCount);
  const automaticTotalLengthM = automaticLengthPerPieceM * pieceCount;
  const manualTotalLengthM = Number(sel.ropeOrderLengthM);
  const totalLengthM =
    inp.ropeOrderLengthAuto === false &&
    Number.isFinite(manualTotalLengthM) &&
    manualTotalLengthM > 0
      ? manualTotalLengthM
      : automaticTotalLengthM;
  const lengthPerPieceM = totalLengthM / pieceCount;

  if (equalizerSheave) {
    const lines: RopeOrderLine[] = [{
      lay: "right",
      quantity: pieceCount,
      lengthPerPieceM,
      totalLengthM,
    }];
    return {
      lengthPerGrooveM,
      rawTotalLengthM,
      automaticLengthPerPieceM,
      automaticTotalLengthM,
      lengthPerPieceM,
      totalLengthM,
      pieceCount,
      rightLayCount: pieceCount,
      leftLayCount: 0,
      layLabel: "Sağ Helis",
      lines,
      arrangementText:
        `Sağ helis ${pieceCount} × ${lengthPerPieceM.toFixed(2)} m ` +
        "(denge makarası: iki yiv tek halat)",
    };
  }

  const lines: RopeOrderLine[] = [
    {
      lay: "right",
      quantity: rightLayCount,
      lengthPerPieceM,
      totalLengthM: lengthPerPieceM * rightLayCount,
    },
    ...(leftLayCount > 0
      ? [{
          lay: "left" as const,
          quantity: leftLayCount,
          lengthPerPieceM,
          totalLengthM: lengthPerPieceM * leftLayCount,
        }]
      : []),
  ];
  return {
    lengthPerGrooveM,
    rawTotalLengthM,
    automaticLengthPerPieceM,
    automaticTotalLengthM,
    lengthPerPieceM,
    totalLengthM,
    pieceCount: driven,
    rightLayCount,
    leftLayCount,
    layLabel: leftLayCount > 0 ? "Sağ ve Sol Helis" : "Sağ Helis",
    lines,
    arrangementText:
      `Sağ helis ${rightLayCount} × ${lengthPerPieceM.toFixed(2)} m` +
      (leftLayCount > 0 ? ` · Sol helis ${leftLayCount} × ${lengthPerPieceM.toFixed(2)} m` : ""),
  };
}


/** Kullanıcı girdileri (tasarım kabulleri) */
export interface HoistInputs {
  /** Tambura sarılan (tahrikli) halat kolu sayısı */
  drivenFalls: number;
  /** Kanca bloğunu taşıyan toplam halat kolu sayısı */
  totalFalls: number;
  /** Tek makara verimi η_m */
  sheaveEfficiency: number;
  /** Verim zincirindeki sabit (yönlendirme) makara adedi */
  fixedSheaveCount: number;
  /**
   * Hazır halat donanımı etiketi ("2/4", "4/8" …). Tanınan bir etiket
   * seçildiğinde tahrikli/toplam kol sayıları o donanımdan okunur; "Elle giriş"
   * veya tanınmayan bir değerde yukarıdaki iki alan geçerlidir.
   */
  reevingLabel?: string;
  /** Denge traversi (ayrı sağ/sol halatlar) veya denge makarası (tek sürekli halat). */
  ropeBalancingType: RopeBalancingType;
  /**
   * Denge elemanının (traversi/makarası) taşıdığı halat kolu adedi. Loadcell
   * ve rulman yükü = halat yükü × bu adet. Genelde 2 (nadiren 1). Varsayılan 2.
   */
  balanceRopeCount?: number;
  hookBlockWeightKg: number;    // kanca bloğu / kepçe ağırlığı
  ropeWeightKg: number;         // askıdaki halatların ağırlığı
  drumWallThicknessMm: number;  // tambur et kalınlığı
  safetyGrooveCount: number;    // emniyet sarımı adedi
  drumWeightKg: number;         // tambur ağırlığı W
  /**
   * Tambur mili ölçü zinciri (mm) — teknik resimdeki A…G bölümleri, soldan
   * (redüktör tarafı) sağa (tambur yatağı tarafı):
   *   A: redüktör tarafı mesnet ekseni → sol yanak   (aynı zamanda moment kolu)
   *   B: sol yanak → sol yiv bölgesi başlangıcı
   *   C: sol yiv bölgesi uzunluğu
   *   D: ortadaki yivsiz bölge (iki helis arası)
   *   E: sağ yiv bölgesi uzunluğu
   *   F: sağ yiv bölgesi sonu → sağ yanak
   *   G: sağ yanak → tambur yatağı mesnet ekseni     (aynı zamanda moment kolu)
   *
   * Motor bu ölçüleri cm ile çözer; dönüşüm `drumShaftDimsCm` içindedir.
   */
  drumSpanAMm: number;
  drumSpanBMm: number;
  drumSpanCMm: number;
  drumSpanDMm: number;
  drumSpanEMm: number;
  drumSpanFMm: number;
  drumSpanGMm: number;
  /** Halat yüklerinin yiv bölgesindeki konumu (bkz. ROPE_POSITION_*) */
  ropeLoadPosition?: string;
  shaftD1Mm: number;            // D1: eğilme gerilmesi kesiti çapı (yanak dibi) [mm]
  shaftD2Mm: number;            // D2: yatak / rulman oturma çapı (kesme kesiti) [mm]
  drumWeldThicknessMm: number;  // tambur kaynak dikişi boğaz kalınlığı a [mm]
  /** Tambur kaynağı izin gerilmesi [MPa] — yalnız otomatik türetme KAPALIYKEN */
  drumWeldAllowable: number;
  shaftWeldThicknessMm: number; // mil kaynak dikişi boğaz kalınlığı a [mm]
  /** Mil kaynağı izin gerilmesi [MPa] — yalnız otomatik türetme KAPALIYKEN */
  shaftWeldAllowable: number;
  /**
   * Kaynak izin gerilmesi otomatik türetilsin mi?
   *
   * VARSAYILAN AÇIKTIR: alan tanımsızsa (eski revizyonlar) da otomatik türetme
   * geçerlidir — elle girilen 156,9 MPa'lık sabit standartların verdiği sınırın
   * üzerindeydi ve sessizce emniyetsiz kalmamalıdır. Kapatmak için alanın
   * açıkça `false` olması gerekir; o zaman `drumWeldAllowable` /
   * `shaftWeldAllowable` değerleri kullanılır.
   */
  weldAllowableAuto?: boolean;
  bearingFactorY1: number;      // rulman eşdeğer yük katsayısı (statik)
  bearingFactorY2: number;      // rulman eşdeğer yük katsayısı (dinamik)
  drumCount: number;            // tambur adedi
  gearboxServiceFactor: number; // redüktör emniyet katsayısı
  reducerStages: number;        // redüktör kademe sayısı
  stageEfficiency: number;      // kademe verimi
  tempFactor: number;           // sıcaklık faktörü
  motorDivisor: number;         // güç bölücü (motor başına)
  brakeServiceFactor: number;   // fren emniyet katsayısı
  motorCouplingServiceFactor: number;
  drumCouplingDivisor: number;
  drumCouplingServiceFactor: number;
  /**
   * Emniyet freni için istenen frenleme emniyet katsayısı.
   * Emniyet freni servis freninin yedeği değil, aktarma organı koptuğunda yükü
   * tutan tek elemandır; bu yüzden statik yük momentinin katı istenir.
   */
  safetyBrakeServiceFactor: number;
  /**
   * Flanş dış çapına eklenen montaj payı [mm]. Katalogun geometrik alt sınırı
   * (kaliperin tambur gövdesine çarpmadan oturması) bu payın üstüne biner.
   */
  safetyBrakeFlangeClearanceMm: number;
  /**
   * Otomatik alan anahtarları (sunum tarafı; hesap zincirini değiştirmez).
   * Açıkken sihirbaz ilgili girdiyi `lib/calc/derive.ts` türetmesiyle doldurur
   * ve alanı salt-okunur yapar.
   */
  ropeWeightAuto?: boolean;
  /**
   * Kanca bloğu / tutucu ağırlığı otomatik: kaldırma kapasitesinin %10'u
   * (firma tasarım kabulü, bkz. `derive.ts`). Kepçe, mıknatıs gibi özel
   * tutucularda kapatılıp gerçek ağırlık girilir.
   */
  hookBlockWeightAuto?: boolean;
  /** Sıcaklık faktörü otomatik: ortam sıcaklığı üst sınırından türetilir. */
  tempFactorAuto?: boolean;
  /**
   * Makara verimi otomatik: ORION makaraları istisnasız rulmanlı yataklanır,
   * η_m bir seçim değil sabit firma kabulüdür (`STANDARD_SHEAVE_EFFICIENCY`).
   * Anahtar kapatılırsa mühendis kendi değerini girer.
   */
  sheaveEfficiencyAuto?: boolean;
  /**
   * "Yiv Boyu" kutusu otomatik: tahrikli kol sayısı × gerekli yiv boyu
   * ("2 x 220" gibi), yukarı yuvarlanmış (bkz. `derive.ts`).
   */
  drumGrooveLengthAuto?: boolean;
  /** Halat sipariş boyu her parçayı yukarı tam metreye çıkararak hesaplansın mı? */
  ropeOrderLengthAuto?: boolean;
  /** C/E yiv bölgeleri gerekli yiv boyundan otomatik doldurulsun mu? */
  drumGrooveSpanAuto?: boolean;
  /** Redüktör servis katsayısı FEM mekanizma sınıfından türetilsin mi? */
  gearboxServiceFactorAuto?: boolean;
  /** Tambur kaplini servis katsayısı FEM mekanizma sınıfından türetilsin mi? */
  drumCouplingServiceFactorAuto?: boolean;
  /**
   * Tambur ağırlığı otomatik: yiv dibi et kalınlığına halat çapının yarısı
   * eklenerek bulunan et kalınlığında, tambur çapında ve NAMLU boyunda çelik
   * borunun ağırlığı × 1,3 (bkz. `derive.ts` → `deriveDrumWeightKg`).
   */
  drumWeightAuto?: boolean;
  /**
   * Rulman markası kutuları ORTAK markaya bağlı mı (bkz. `bearing-brand.ts`).
   * Açıkken kutu, otomatik olan bütün rulman kutularıyla aynı markayı
   * gösterir; kapatılınca o kutu bağdan çıkar ve kendi markasını tutar.
   */
  bearingBrandAuto?: boolean;
  /** Denge rulmanı markası ortak markaya bağlı mı (bkz. `bearingBrandAuto`). */
  balanceBearingBrandAuto?: boolean;
}

/** Katalog seçimleri — mühendisin seçtiği bileşenler */
export interface HoistSelections {
  ropeBrand: string;
  /**
   * Katalog satırının birebir ürün kimliği (örn. "Ø20 6x36 WS IWRC 1960 MPa").
   *
   * Görünen ekipman modeli sağ/sol helisi de taşır; o metin üretici katalog
   * satırının modeli değildir. Bu alan katalog sayfası bağlantısının revizyon
   * yeniden açıldığında da aynı ürünü bulmasını sağlar. Eski revizyonlarda
   * yoktur; ekipman katmanı seçim ölçülerinden güvenli bir geri dönüş kurar.
   */
  ropeCatalogModel?: string;
  ropeDiaMm: number;
  ropeConstruction: string;     // ör. "6x36"
  ropeCore: string;
  ropeWireStrength: number;     // [kg/mm²]
  ropeBreakingLoadKn: number;
  /** Halat metre ağırlığı [kg/m] — katalogdan gelir, halat ağırlığı türetmesinde kullanılır */
  ropeWeightKgPerM?: number;
  /** Makara yataklama tipi — makara verimi türetmesinde kullanılır */
  sheaveBearingKind?: string;
  drumDiaMm: number;
  drumMaterial: DrumMaterial;
  drumGrooveLengthText: string; // ör. "2 x 220"
  /** Satın alınacak bütün halat parçalarının etkin toplam boyu [m]. */
  ropeOrderLengthM?: number;
  shaftMaterial: ShaftMaterial;
  /** Kabul edilen rulman markaları (çoklu, virgülle ayrık: "SKF, FAG") */
  bearingBrand?: string;
  bearingType: string;
  bearingCode: string;          // ör. 22212
  /** Rulman iç çapı [mm] — tambur milinin D2 oturma çapıyla birebir eşleşir. */
  bearingBoreMm: number;
  bearingDynCKn: number;
  bearingStatC0Kn: number;
  /** SKF SNL/SE tambur rulman yatağı — rulman koduna göre katalogdan seçilir. */
  bearingHousingBrand: string;
  bearingHousingCode: string;
  bearingHousingSeries: string;
  /** Yatağın katalogda uyumlu olduğu temel rulman kodu (örn. 22212). */
  bearingHousingCompatibleBearing: string;
  bearingHousingBoreMm: number;
  /** TSN .. A keçe düzenindeki katalog genişliği A₂ [mm]. */
  bearingHousingWidthMm: number;
  bearingHousingSeatType: string;
  gearboxModel: string;
  /** Seçilen katalog satırının gerçek giriş devri; doğru H teknik sayfası için. */
  gearboxCatalogInputRpm?: number;
  /** Redüktör çıkış özelliği sipariş kodu (00/01/02/03/0S) → DT472.03 */
  gearboxOutputFeature?: string;
  /** Redüktör çıkış mili/flanş yönü + giriş mili adedi (R1/L1/…/V2) */
  gearboxShaftDirection?: string;
  /** Redüktör montaj pozisyonu (M1…M6) — sipariş/rapor için */
  gearboxMountingPosition?: string;
  /** Redüktörün sipariş opsiyonları (çoklu, virgülle ayrık). "Yok" = donanımsız. */
  gearboxOptions?: string;
  gearboxRatio: number;
  gearboxNominalTorqueKnm: number;
  gearboxInputShaftMm: number;
  gearboxOutputShaftMm: number;
  gearboxWeightKg: number;
  gearboxAllowedRadialKn: number;
  motorPowerKw: number;
  motorRpm: number;
  motorShaftMm: number;
  motorBrand: string;
  /** Katalogun kendi tip kodu (ör. "1LE1503-1DB23-4AA4"); satın alma bunu ister. */
  motorModel: string;
  /** Motor bağlantı biçimi (B3/B5/B14…) — sipariş için */
  motorMountType?: string;
  /** Motor freni ve fren bobini besleme gerilimi (`MOTOR_BRAKE_OPTIONS`). */
  motorBrakeType?: string;
  /** IEC verim sınıfı (IE1…IE4) */
  motorEfficiencyClass?: string;
  /** Enkoder: "Yok" | "Var" */
  motorEncoder?: string;
  /** IEC 60034-1 sargı yalıtım sınıfı (B/F/H) — ORION standardı F */
  motorInsulationClass?: string;
  /** IEC 60034-1 çalışma sınıfı (S1…S10) — ORION standardı S1 */
  motorDutyType?: string;
  /** Sargı sıcaklık koruması: "PTC" | "3PTC" | "PT100" | "Yok" */
  motorThermalProtection?: string;
  motorCount: number;
  brakeBrand: string;
  brakeModel: string;
  brakeTorqueNm: number;
  brakeWheelDiaMm: number;
  brakeQty: number;
  /** Frenin sipariş opsiyonları (çoklu, virgülle ayrık: "İçten Yaylı, Elle Açma Kolu") */
  brakeOptions?: string;
  motorCouplingBrand: string;
  motorCouplingModel: string;
  motorCouplingWheelDiaMm: number;
  motorCouplingTorqueNm: number;
  motorCouplingDmaxMm: number;
  /** Kaplin keçe tipi: "Standart O-Ring" | "Keçeli" (standart olan listeye yazılmaz) */
  motorCouplingSealType?: string;
  // --- Halat dengeleme düzeni (denge traversi / denge makarası) ---
  /** Halat soketi tipi: "Normal" | "Uzun" (model halat çapından otomatik). */
  balanceSocketType?: string;
  /** Loadcell markası: "Esit" | "Kobastar" (model/kapasite yükten otomatik). */
  balanceLoadcellBrand?: string;
  /** Denge rulmanı (elle) — traversi ve makarada ortak. */
  balanceBearingBrand?: string;
  balanceBearingType?: string;
  balanceBearingCode?: string;
  balanceBearingDynCKn?: number;
  balanceBearingStatC0Kn?: number;
  /** Denge makarası çapı [mm] (yalnız denge makaralı düzende). */
  balanceSheaveDiaMm?: number;
  drumCouplingBrand: string;
  drumCouplingModel: string;
  drumCouplingTorqueNm: number;
  drumCouplingRadialN: number;
  drumCouplingDmaxMm: number;
  /** Kaplin keçe tipi: "Standart O-Ring" | "Keçeli" (standart olan listeye yazılmaz) */
  drumCouplingSealType?: string;
  /** Tambur kaplininde aşınma indikatörü: "Standart" | "İndikatörlü" */
  drumCouplingWearDetection?: string;
  /** Emniyet freni katalog tipi (SIBRE SHI) */
  safetyBrakeModel: string;
  /** Ayarlanan hava aralığı c [mm] — sıkma kuvveti buna göre değişir */
  safetyBrakeAirGapMm: number;
  /** Tambur üzerindeki fren yerleşim düzeni (1…6) */
  safetyBrakeArrangement: string;
  /** Seçilen flanş (fren diski) kalınlığı [mm] — katalogun b sınırını sağlamalı */
  safetyBrakeFlangeThicknessMm: number;
  /** Hidrolik güç ünitesi sipariş kodu; boşsa katalogdan önerilen kullanılır */
  safetyBrakeHydraulicUnit: string;
  /** Seçilen flanş (fren diski) dış çapı [mm] */
  safetyBrakeFlangeDiaMm: number;

  // ————————————————————————————— KATALOG AĞIRLIKLARI (hesaba GİRMEZ)
  //
  // Seçilen ürünün katalogdaki ağırlığı, seçimle BİRLİKTE revizyona yazılır
  // (`catalog-mapping.ts`). Görünür bir form alanı YOKTUR — `gearboxCatalogInputRpm`
  // deseninin aynısı: değer seçimin bir parçasıdır, mühendisin cevaplayacağı bir
  // soru değil. Tek okuyucusu AĞIRLIK DÖKÜMÜ penceresidir; hesap motoru bu
  // alanları HİÇ okumaz ve hiçbir kontrol onlardan beslenmez.
  //
  // Alanlar OPSİYONELDİR: eski revizyonlarda yoktur, uydurulmaz (değişmez md. 4)
  // ve döküm o satırda "—" basıp ürünün yeniden seçilmesini önerir. Katalogda
  // ağırlık ARALIK verilen ürünlerde (Jaure kaplinleri) alt sınır `*WeightKg`,
  // üst sınır `*WeightMaxKg` alanındadır — uydurma tek bir sayı üretilmez.
  bearingWeightKg?: number;
  motorWeightKg?: number;
  brakeWeightKg?: number;
  motorCouplingWeightKg?: number;
  motorCouplingWeightMaxKg?: number;
  drumCouplingWeightKg?: number;
  drumCouplingWeightMaxKg?: number;
  balanceBearingWeightKg?: number;
}

export interface HoistValues {
  // 2.1 Halat
  /** Bu kaldırma grubunun kaldırma kapasitesi [t] */
  capacityT: number;
  mechanicalAdvantage: number;
  ropeEfficiency: number;
  loadKg: number;
  totalLoadKg: number;
  requiredRopeSafety: number;
  ropeLoadKg: number;
  requiredBreakingKg: number;
  actualBreakingKg: number;
  actualRopeSafety: number;
  ropeLengthPerGrooveM: number;
  ropeRawTotalLengthM: number;
  ropeAutomaticTotalLengthM: number;
  ropeLengthPerPieceM: number;
  ropeTotalLengthM: number;
  ropePieceCount: number;
  ropeRightLayCount: number;
  ropeLeftLayCount: number;
  ropeLayText: string;
  ropeArrangementText: string;
  // 2.2 Tambur
  drumCoefficientH: number;
  minDrumDiaMm: number;
  groovePitchMm: number;
  drumBearingStress: number;
  drumBendingStress: number;
  drumCombinedStress: number;
  drumAllowable: number;
  requiredGrooves: number;
  requiredGrooveLengthMm: number;
  // Mil (tambur mili — iki mesnetli kiriş)
  /** Mesnetler arası açıklık L = A+B+C+D+E+F+G [cm] */
  drumShaftSpanCm: number;
  /** Tambur ağırlık merkezinin redüktör tarafı mesnede uzaklığı [cm] */
  drumWeightArmCm: number;
  /** Yönetici yükleme halindeki halat yükü konumları [cm] */
  ropeLoadPositionsCm: number[];
  /** Tambur üzerindeki halat yükü sayısı ve tekil yük [kg] */
  ropeLoadCount: number;
  ropeLoadPerPointKg: number;
  /** Redüktör tarafı mesnet reaksiyonu (Ra) [kg] */
  reactionGearboxKg: number;
  /** Tambur yatağı tarafı mesnet reaksiyonu (Rg) [kg] */
  reactionBearingKg: number;
  /** Geriye uyum: Ra / Rg takma adları */
  reactionAKg: number;
  reactionBKg: number;
  momentGearboxKgCm: number;
  momentBearingKgCm: number;
  shaftMomentKgCm: number;
  /** Gerilmelerin yönetici olduğu taraf */
  shaftGoverningSide: "redüktör" | "tambur yatağı";
  shaftBendingStress: number;
  shaftShearStress: number;
  shaftCombinedStress: number;
  shaftAllowables: { bending: number; shear: number; combined: number };
  // Kaynaklar
  /** Tambur kaynağı FEM eşdeğer gerilmesi √(σ² + 2τ²) [kg/cm²] */
  drumWeldCombinedStress: number;
  /** Tambur kaynağı değerlendirmesi (FEM ve CMAA ayrı ayrı) */
  drumWeldAssessment: WeldAssessment;
  /** Mil kaynağı kesme gerilmesi [kg/cm²] */
  shaftWeldStress: number;
  /** Mil kaynağındaki eğilme momenti M = R · G [kg·cm] */
  shaftWeldMomentKgCm: number;
  /** Mil kaynağı eğilme gerilmesi [kg/cm²] */
  shaftWeldBendingStress: number;
  /** Mil kaynağı FEM eşdeğer gerilmesi √(σ² + 2τ²) [kg/cm²] */
  shaftWeldCombinedStress: number;
  /** Mil kaynağı değerlendirmesi (FEM ve CMAA ayrı ayrı) */
  shaftWeldAssessment: WeldAssessment;
  /** Kaynak dikişi izin gerilmeleri [MPa] — FEM / CMAA çekme / CMAA kayma */
  weldAllowable: WeldAllowableStress;
  // Rulman
  bearingRadialKn: number;
  bearingAxialKn: number;
  bearingEqStaticKn: number;
  bearingEqDynamicKn: number;
  bearingStaticSafety: number;
  drumRpm: number;
  bearingLifeHours: number;
  requiredLifeMin: number;
  requiredLifeMax: number | null;
  // Redüktör
  drumTorqueKnm: number;
  requiredGearboxTorqueKnm: number;
  requiredRatio: number;
  ratioDeviationPct: number;
  actualLiftSpeedMpm: number;
  gearboxActualSafety: number;
  gearboxRadialKn: number;
  // Motor
  reducerEfficiency: number;
  motorInputTorqueNm: number;
  requiredPowerKw: number;
  requiredPowerAdjustedKw: number;
  installedPowerKw: number;
  // Fren
  brakeShaftTorqueNm: number;
  requiredBrakeTorqueNm: number;
  brakeActualSafety: number;
  // Kaplinler
  requiredMotorCouplingTorqueNm: number;
  couplingShaftDiaMm: number;
  motorCouplingActualSafety: number;
  requiredDrumCouplingTorqueNm: number;
  requiredDrumCouplingRadialN: number;
  drumCouplingActualSafety: number;
}

/**
 * Girdilerden halat donanımı tanımını kurar — donanımın TEK kaynağı budur.
 * Hazır bir donanım etiketi seçilmişse ("2/4", "4/8" …) kol sayıları o
 * seçimden okunur; aksi hâlde girdideki serbest değerler geçerlidir.
 */
export function hoistReeving(inp: HoistInputs): Reeving {
  const preset = inp.reevingLabel ? commonReevingByLabel(inp.reevingLabel) : undefined;
  return {
    drivenFalls: preset?.drivenFalls ?? inp.drivenFalls,
    totalFalls: preset?.totalFalls ?? inp.totalFalls,
    fixedSheaveCount: inp.fixedSheaveCount,
    sheaveEfficiency: inp.sheaveEfficiency,
  };
}

/**
 * Bir kaldırma grubunun teknik özelliklerden okunan büyüklükleri.
 *
 * Her grup bağımsız bir mekanizmadır: kendi kapasitesi, yüksekliği, hızı ve
 * FEM sınıfları vardır. Grup için değer tanımlı değilse (eski revizyonlar,
 * yeni açılmış monoray) ana kaldırmanınki kullanılır — hesap asla NaN'a düşmez.
 */
export interface HoistSpecView {
  capacityT: number;
  liftHeightM: number;
  liftSpeedMpm: number;
  mechanismClass: MechanismClass;
  usageClass: UsageClass;
}

const posOr = (v: number | undefined, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;

export function hoistSpecView(specs: TechnicalSpecs, which: HoistWhich): HoistSpecView {
  switch (which) {
    case "aux":
      return {
        capacityT: specs.auxCapacityT,
        liftHeightM: specs.auxLiftHeightM,
        liftSpeedMpm: specs.auxLiftSpeedMpm,
        mechanismClass: specs.auxMechanismClass ?? specs.hoistMechanismClass,
        usageClass: specs.auxUsageClass ?? specs.hoistUsageClass,
      };
    case "mono1":
      return {
        capacityT: posOr(specs.mono1CapacityT, specs.mainCapacityT),
        liftHeightM: posOr(specs.mono1LiftHeightM, specs.mainLiftHeightM),
        liftSpeedMpm: posOr(specs.mono1LiftSpeedMpm, specs.mainLiftSpeedMpm),
        mechanismClass: specs.mono1MechanismClass ?? specs.hoistMechanismClass,
        usageClass: specs.mono1UsageClass ?? specs.hoistUsageClass,
      };
    case "mono2":
      return {
        capacityT: posOr(specs.mono2CapacityT, specs.mainCapacityT),
        liftHeightM: posOr(specs.mono2LiftHeightM, specs.mainLiftHeightM),
        liftSpeedMpm: posOr(specs.mono2LiftSpeedMpm, specs.mainLiftSpeedMpm),
        mechanismClass: specs.mono2MechanismClass ?? specs.hoistMechanismClass,
        usageClass: specs.mono2UsageClass ?? specs.hoistUsageClass,
      };
    default:
      return {
        capacityT: specs.mainCapacityT,
        liftHeightM: specs.mainLiftHeightM,
        liftSpeedMpm: specs.mainLiftSpeedMpm,
        mechanismClass: specs.hoistMechanismClass,
        usageClass: specs.hoistUsageClass,
      };
  }
}

export function computeHoistGroup(
  specs: TechnicalSpecs,
  which: HoistWhich,
  inp: HoistInputs,
  sel: HoistSelections
): ModuleResult<HoistValues> {
  const view = hoistSpecView(specs, which);
  const capacityT = view.capacityT;
  const liftHeightM = view.liftHeightM;
  const liftSpeedMpm = view.liftSpeedMpm;
  const mech = view.mechanismClass;
  const usage = view.usageClass;

  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // --- 2.1 Halat -----------------------------------------------------------
  // Donanım (mekanik avantaj + halat verimi) tek kaynaktan gelir: reeving.ts.
  const reeving = hoistReeving(inp);
  const rig = deriveReeving(reeving);
  const mechanicalAdvantage = rig.mechanicalAdvantage;
  const ropeEfficiency = rig.ropeEfficiency;
  const hoistedLoadKg = capacityT * 1000;
  const totalLoadKg = hoistedLoadKg + inp.hookBlockWeightKg + inp.ropeWeightKg;
  const requiredRopeSafety = ropeSafetyFactor(mech, "moving");
  const ropeLoadKg = totalLoadKg / reeving.totalFalls / ropeEfficiency;
  const requiredBreakingKg = ropeLoadKg * requiredRopeSafety;
  const actualBreakingKg = (sel.ropeBreakingLoadKn / 9.81) * 1000;
  const actualRopeSafety = actualBreakingKg / ropeLoadKg;
  Object.assign(cells, {
    // Yükün tonajı halat zincirinin BAŞIDIR: rapor okuyucusu 2.1'de önce
    // hangi yükün kaldırıldığını görmeli, sonra halat kuvvetine inmelidir.
    "load.capacityT": capacityT,
    "reeving.mechanicalAdvantage": mechanicalAdvantage,
    "reeving.ropeEfficiency": ropeEfficiency,
    "load.hoisted": hoistedLoadKg,
    "load.total": totalLoadKg,
    "rope.requiredSafety": requiredRopeSafety,
    "rope.load": ropeLoadKg,
    "rope.requiredBreakingLoad": requiredBreakingKg,
    "rope.breakingLoad": actualBreakingKg,
    "rope.actualSafety": actualRopeSafety,
  });
  checks.push({
    id: `${which}.rope.safety`,
    label: "Halat Emniyet Katsayısı",
    required: requiredRopeSafety, provided: actualRopeSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: actualRopeSafety >= requiredRopeSafety,
    standard: "FEM 1.001 T.4.2.2.1.2",
    kind: "standart", severity: "engelleyici",
  });

  // --- 2.2.1 Tambur çapı ve gerilmeler -------------------------------------
  const drumCoefficientH = drumCoefficient(mech);
  const minDrumDiaMm = drumCoefficientH * sel.ropeDiaMm;
  const groovePitchMm = groovePitch(sel.ropeDiaMm);
  // Yiv tabanı ezilme gerilmesi: sarım başına düşen halat kuvvetinin hatve
  // ve et kalınlığı üzerine yayılması (klasik tambur gövdesi bağıntısı).
  const drumBearingStress =
    (0.5 * ropeLoadKg * 100) / groovePitchMm / inp.drumWallThicknessMm;
  // Tambur gövdesinin yerel eğilme gerilmesi (çap ve et kalınlığına bağlı).
  const drumBendingStress =
    0.96 *
    ropeLoadKg *
    (1 / ((sel.drumDiaMm / 10) ** 2 * (inp.drumWallThicknessMm / 10) ** 6) ** 0.25);
  const drumCombinedStress = Math.sqrt(
    drumBendingStress ** 2 + drumBearingStress ** 2 - drumBearingStress * drumBendingStress
  );
  const drumAllowable = drumAllowableStress(sel.drumMaterial);
  Object.assign(cells, {
    "drum.coefficient": drumCoefficientH,
    "drum.minDia": minDrumDiaMm,
    "drum.groovePitch": groovePitchMm,
    "drum.bearingStress": drumBearingStress,
    "drum.bendingStress": drumBendingStress,
    "drum.combinedStress": drumCombinedStress,
    "drum.allowableStress": drumAllowable,
  });
  checks.push({
    id: `${which}.drum.stress`,
    label: "Tambur Bileşik Gerilmesi",
    required: drumCombinedStress, provided: drumAllowable, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: drumAllowable >= drumCombinedStress,
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.drum.dia`,
    label: "Tambur Çapı (min H·d)",
    required: minDrumDiaMm, provided: sel.drumDiaMm, unit: "mm", op: ">=",
    computedSide: "required",
    pass: sel.drumDiaMm >= minDrumDiaMm,
    standard: "FEM 1.001 T.4.2.3.1.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- 2.2.2 Yiv boyu -----------------------------------------------------
  // Sarım sayısı: kaldırma yüksekliğinde tambura sarılacak halat boyu, tambur
  // çevresine bölünür; üzerine emniyet sarımı eklenir.
  const grooveReq = drumGrooveRequirement(inp, sel, liftHeightM);
  const requiredGrooves = grooveReq.grooves;
  const requiredGrooveLengthMm = grooveReq.lengthMm;
  const ropePlan = ropeLengthPlan(inp, sel, liftHeightM);
  Object.assign(cells, {
    "drum.requiredGrooves": requiredGrooves,
    "drum.requiredGrooveLength": requiredGrooveLengthMm,
    "rope.lengthPerGroove": ropePlan.lengthPerGrooveM,
    "rope.rawTotalLength": ropePlan.rawTotalLengthM,
    "rope.automaticTotalLength": ropePlan.automaticTotalLengthM,
    "rope.lengthPerPiece": ropePlan.lengthPerPieceM,
    "rope.totalLength": ropePlan.totalLengthM,
    "rope.pieceCount": ropePlan.pieceCount,
    "rope.rightLayCount": ropePlan.rightLayCount,
    "rope.leftLayCount": ropePlan.leftLayCount,
    "rope.lay": ropePlan.layLabel,
    "rope.arrangement": ropePlan.arrangementText,
  });

  // --- 2.2.3 Tambur mili ---------------------------------------------------
  // Model (teknik resimdeki A…G ölçü zinciri): tambur, redüktör tarafı mesnet
  // (Ra) ile tambur yatağı tarafı mesnet (Rg) arasında iki mesnetli kiriştir.
  // Yükler: her yiv bölgesindeki halat yükü T ve tambur ağırlığı W (namlu
  // ortasında). Statik çözüm ortak kiriş çözücüsüyle (beam.ts) yapılır.
  // Halatlar yiv boyunca hareket ettiğinden iki uç hâli (dış uçlar / iç uçlar)
  // ayrı çözülür ve her mesnet için kritik olan alınır.
  const geo = drumShaftGeometry(inp);
  // Ölçüler girdide mm; motorun cm karşılıkları TEK noktadan alınır.
  const dims = drumShaftDimsCm(inp);
  // Çift tamburda sağ ve sol namlu simetriktir; bu bölüm yalnız BİR tamburun
  // milini inceler. Halat uçlarının yarısı incelenen tambura gelir. Ortak
  // redüktör/motor/fren hesabı aşağıda yine tüm mekanizma yüküyle yürür.
  const ropeLoadCount = hoistEquipmentArrangement(specs, which) === "doubleDrum"
    ? rig.drumRopeEnds / 2
    : rig.drumRopeEnds;
  const ropePerPoint = (ropeLoadKg * ropeLoadCount) / (geo.sections.length || 1);

  /**
   * Bir yükleme hâlini kiriş olarak çözer. Mesnet A (redüktör tarafı) x=0,
   * mesnet B (tambur yatağı tarafı) x=L konumundadır. Yanak dibi kesitleri
   * x=A ve x=L−G'dir; bu kesitlerle mesnetler arasında yük bulunmadığından
   * kesit momentleri doğrudan M = R · kol değerine eşittir.
   */
  const caseFor = (edge: "outer" | "inner") => {
    const xs = geo.sections.map((sec) => (edge === "outer" ? sec.outer : sec.inner));
    const pointLoads: PointLoad[] = xs.map((x, i) => ({
      xCm: x,
      loadKg: ropePerPoint,
      label: `Halat yükü T${i + 1}`,
    }));
    pointLoads.push({ xCm: geo.weightArmCm, loadKg: inp.drumWeightKg, label: "Tambur Ağırlığı W" });
    const beam = solveBeam({
      lengthCm: geo.spanCm,
      supportACm: 0,
      supportBCm: geo.spanCm,
      pointLoads,
    });
    return {
      xs,
      ra: beam.reactionAKg,
      rg: beam.reactionBKg,
      momentGearbox: Math.abs(beam.momentAt(geo.aCm)),
      momentBearing: Math.abs(beam.momentAt(geo.spanCm - geo.gCm)),
    };
  };
  const outer = caseFor("outer");
  const inner = caseFor("inner");
  const mode = ropePositionMode(inp.ropeLoadPosition);
  const cases = mode === "outer" ? [outer] : mode === "inner" ? [inner] : [outer, inner];

  // Her yükleme hâli kendi içinde dengededir (Ra + Rg = ΣT + W). Halat konumu
  // "en kritik konum" seçildiğinde her mesnet KENDİ kritik hâliyle boyutlandırılır;
  // bu bir ZARF değeridir, iki reaksiyon aynı anda oluşmayabilir.
  const reactionGearboxKg = Math.max(...cases.map((c) => c.ra));
  const reactionBearingKg = Math.max(...cases.map((c) => c.rg));
  /** Tambur yatağını boyutlandıran hâlin halat konumları (diyagram + rapor) */
  const govBearing = cases.reduce((a, b) => (b.rg > a.rg ? b : a));
  const momentGearboxKgCm = Math.max(...cases.map((c) => c.momentGearbox));
  const momentBearingKgCm = Math.max(...cases.map((c) => c.momentBearing));

  const shaftAllow = shaftMaterialAllowables(sel.shaftMaterial);
  /**
   * Mil gerilmeleri ortak modülle (shaftStress.ts) bulunur. KONVANSİYONLAR
   * açık parametre olarak verilir:
   *   · combined: "resultant" → √(σ² + τ²). Firma kabulüdür; tambur milinde
   *     kesme gerilmesi eğilmenin yanında küçüktür ve izin verilen bileşik
   *     gerilme zaten malzeme tablosundan ayrıca sınırlanır.
   *   · shear: "maksimum" → dolu dairesel kesitte parabolik kayma dağılımının
   *     tepe değeri, ortalamanın tam 4/3 katıdır (tarafsız eksende).
   */
  const sideStress = (momentKgCm: number, reactionKg: number) =>
    shaftStress({
      momentKgCm,
      shearKg: reactionKg,
      bendingDiameterCm: dims.d1Cm,
      shearDiameterCm: dims.d2Cm,
      combined: "resultant",
      shear: "maksimum",
    });
  const sGearbox = sideStress(momentGearboxKgCm, reactionGearboxKg);
  const sBearing = sideStress(momentBearingKgCm, reactionBearingKg);
  const governing = sGearbox.combinedStress >= sBearing.combinedStress ? sGearbox : sBearing;
  const governingSide: "redüktör" | "tambur yatağı" =
    sGearbox.combinedStress >= sBearing.combinedStress ? "redüktör" : "tambur yatağı";

  const shaftMomentKgCm = Math.max(momentGearboxKgCm, momentBearingKgCm);
  const shaftBendingStress = governing.bendingStress;
  const shaftShearStress = governing.shearStress;
  const shaftCombinedStress = governing.combinedStress;
  /** Kaynak/kesit kontrollerinde kritik mesnet reaksiyonu */
  const maxReactionKg = Math.max(reactionGearboxKg, reactionBearingKg);
  Object.assign(cells, {
    "drumShaft.span": geo.spanCm,
    "drumShaft.armGearbox": geo.aCm,
    "drumShaft.armBearing": geo.gCm,
    "drumShaft.weightArm": geo.weightArmCm,
    "drumShaft.ropeLoadPerPoint": ropePerPoint,
    "drumShaft.ropeX1": govBearing.xs[0] ?? 0,
    "drumShaft.ropeX2": govBearing.xs[1] ?? govBearing.xs[0] ?? 0,
    "drumShaft.reactionGearboxOuter": outer.ra,
    "drumShaft.reactionBearingOuter": outer.rg,
    "drumShaft.reactionGearboxInner": inner.ra,
    "drumShaft.reactionBearingInner": inner.rg,
    "drumShaft.ropeXOuter1": outer.xs[0] ?? 0,
    "drumShaft.ropeXOuter2": outer.xs[1] ?? outer.xs[0] ?? 0,
    "drumShaft.ropeXInner1": inner.xs[0] ?? 0,
    "drumShaft.ropeXInner2": inner.xs[1] ?? inner.xs[0] ?? 0,
    "drumShaft.momentGearbox": momentGearboxKgCm,
    "drumShaft.momentBearing": momentBearingKgCm,
    "drumShaft.reactionGearbox": reactionGearboxKg,
    "drumShaft.reactionBearing": reactionBearingKg,
    "drumShaft.moment": shaftMomentKgCm,
    "drumShaft.bendingStress": shaftBendingStress,
    "drumShaft.shearStress": shaftShearStress,
    "drumShaft.combinedStress": shaftCombinedStress,
    "drumShaft.allowableBending": shaftAllow.bending,
    "drumShaft.allowableShear": shaftAllow.shear,
    "drumShaft.allowableCombined": shaftAllow.combined,
  });
  checks.push({
    id: `${which}.shaft.stress`,
    label: "Tambur Mili Bileşik Gerilmesi",
    required: shaftCombinedStress, provided: shaftAllow.combined, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: shaftAllow.combined >= shaftCombinedStress,
    standard: "CMAA 70 4.11.4.1",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.shaft.bending`,
    label: "Tambur Mili Eğilme Gerilmesi",
    required: shaftBendingStress, provided: shaftAllow.bending, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: shaftAllow.bending >= shaftBendingStress,
    standard: "CMAA 70 4.11.4.1",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.shaft.shear`,
    label: "Tambur Mili Kesme Gerilmesi",
    required: shaftShearStress, provided: shaftAllow.shear, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: shaftAllow.shear >= shaftShearStress,
    standard: "CMAA 70 4.11.4.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- Tambur torku (kaynak ve redüktör hesapları buna dayanır) ------------
  const drumRadiusM = sel.drumDiaMm / 2000;
  const ropeLoadKn = (ropeLoadKg * 9.81) / 1000;
  const drumTorqueKnm = drumRadiusM * reeving.drivenFalls * ropeLoadKn;
  const drumTorquePerDrumKnm = drumTorqueKnm / inp.drumCount;
  const requiredGearboxTorqueKnm = inp.gearboxServiceFactor * drumTorquePerDrumKnm;

  // --- Kaynak dikişi izin gerilmesi (2.2.4 ve 2.2.5 ortak) ------------------
  // İKİ standart da KENDİ gerilme tanımıyla hesaplanır ve kullanım oranı büyük
  // olan yönetir (bkz. `assessWeld`). Otomatik türetme varsayılandır; alan
  // açıkça `false` yapılmadıkça elle girilen sabitler kullanılmaz.
  const weldAllow = weldAllowableStress(sel.drumMaterial);
  const weldAllowanceAuto = inp.weldAllowableAuto !== false;

  // --- 2.2.4 Tambur kaynağı ------------------------------------------------
  // Tambur namlusu ile yanak sacı arasındaki çevresel köşe kaynağı: burulma
  // (tambur torku) ve kesme (mesnet reaksiyonu) birlikte etkir. Dikişe dik
  // normal gerilme yoktur (σ = 0).
  //
  // KESİT — FEM 1.001 Ek A-3.2.2.3 md.4: "In a fillet weld, the width of the
  // section considered is the depth of the weld to the bottom of the throat and
  // its length is the effective length of the weld". Yani taşıyıcı kesit
  // BOĞAZ alanıdır (A_k = a · L_k), dikişin izdüşüm halka alanı değil.
  // Eski kod boğaz alanını hesaplayıp yalnız rapora basıyor, gerilmede daha
  // BÜYÜK olan izdüşüm alanını kullanıyordu — gerilmeyi olduğundan küçük,
  // yani dikişi olduğundan emniyetli gösteriyordu.
  const drumWeldLengthCm = (Math.PI * sel.drumDiaMm) / 10;
  const drumWeldThroatAreaCm2 = dims.drumWeldThroatCm * drumWeldLengthCm;
  // BURULMA DİRENÇ MOMENTİ — aynı boğaz kesiti üzerinden:
  // ince halka kabulüyle Wp = A_k · (D/2); boğaz alanının tamamı D/2 kolunda
  // teğetsel kayma akışı taşır. (İzdüşüm halkasının polar modülü ile hesaplamak
  // taşımayan bir kesit varsayardı.)
  const drumWeldPolarModulusCm3 = drumWeldThroatAreaCm2 * (sel.drumDiaMm / 20);
  const drumWeldTorsionStress =
    (drumTorquePerDrumKnm * 100000) / 9.81 / drumWeldPolarModulusCm3;
  const drumWeldShearStress = maxReactionKg / drumWeldThroatAreaCm2;
  // İki kayma bileşeni aynı kesitte etkir; en elverişsiz noktada üst üste
  // binebileceği için toplanır (muhafazakâr kabul).
  const drumWeldTotalShear = drumWeldShearStress + drumWeldTorsionStress;
  const drumWeldAssess = assessWeld({
    normalKgCm2: 0,
    shearKgCm2: drumWeldTotalShear,
    material: sel.drumMaterial,
    manualAllowableMPa: weldAllowanceAuto ? undefined : inp.drumWeldAllowable,
  });
  const drumWeldCombinedStress = drumWeldAssess.femEquivalent;
  Object.assign(cells, {
    "drumWeld.length": drumWeldLengthCm,
    "drumWeld.throatArea": drumWeldThroatAreaCm2,
    "drumWeld.polarModulus": drumWeldPolarModulusCm3,
    "drumWeld.torsionStress": drumWeldTorsionStress,
    "drumWeld.shearStress": drumWeldShearStress,
    "drumWeld.totalShear": drumWeldTotalShear,
    "drumWeld.combinedStress": drumWeldCombinedStress,
    "drumWeld.principalStress": drumWeldAssess.cmaaPrincipal,
    "drumWeld.allowableFem": weldAllow.femMPa,
    "drumWeld.allowableCmaa": weldAllow.cmaaTensionMPa,
    "drumWeld.allowableCmaaShear": weldAllow.cmaaShearMPa,
    "drumWeld.utilizationFem": drumWeldAssess.femUtilization,
    "drumWeld.utilizationCmaa": drumWeldAssess.cmaaUtilization,
    "drumWeld.governing": drumWeldAssess.ruleLabel,
    "drumWeld.governingStress": drumWeldAssess.stressMPa,
    "drumWeld.allowable": drumWeldAssess.allowableMPa,
  });
  checks.push({
    id: `${which}.drumWeld.stress`,
    label: `Tambur Kaynağı Gerilmesi (${drumWeldAssess.ruleLabel})`,
    required: drumWeldAssess.stressMPa, provided: drumWeldAssess.allowableMPa,
    unit: "MPa", op: ">=",
    computedSide: "required",
    pass: drumWeldAssess.allowableMPa >= drumWeldAssess.stressMPa,
    standard: drumWeldAssess.standard,
    kind: "standart", severity: "engelleyici",
  });

  // --- 2.2.5 Mil kaynağı ---------------------------------------------------
  // Mil ile tambur göbeği arasındaki çevresel köşe kaynağı YALNIZ kesme
  // taşımaz. Mesnet reaksiyonu kaynak düzleminden (yanak/flanş sacı) bir kol
  // kadar UZAKTA etkir — tambur yatağı tarafında bu kol tam olarak ölçü
  // zincirindeki G ölçüsüdür, redüktör tarafında A'dır. Dolayısıyla dikişte
  // eğilme momenti doğar:
  //     M_k = R · kol                       (kg·cm)
  //     W_k = π · a · D1² / 4               (ince dairesel dikişin eğilme
  //                                          direnç momenti; a boğaz kalınlığı)
  //     σ_eğ = M_k / W_k   ·   τ = R / A_k
  //     σcp  = √(σ_eğ² + 2·τ²)              (FEM Ek A-3.2.2.3 md.3)
  // İki mesnedin momenti ayrı hesaplanıp ZARFI alınır (kesme gerilmesi de
  // kritik reaksiyonla bulunur); böylece hangi taraf yönetiyorsa o boyutlandırır.
  //
  // KESİT — eğilme direnç momenti zaten BOĞAZ kalınlığı a üzerinden kurulmuştu;
  // kesme gerilmesi de aynı boğaz alanından (A_k = a · π · D1) okunur
  // (FEM Ek A-3.2.2.3 md.4). Dikişin izdüşüm halka alanı taşıyıcı kesit
  // değildir ve gerilmeyi olduğundan küçük gösterir.
  //
  // BURULMA YOKTUR — tambur torku bu dikişten GEÇMEZ. Tork yolu:
  // redüktör çıkış mili → tambur kaplini → redüktör tarafı yanak → tambur
  // namlusu; namluya girdiği çevresel dikiş 2.2.4'tür ve burulmayı O taşır.
  // 2.2.5'in dikişi tambur yatağı tarafındaki TAŞIYICI (tahriksiz) mil
  // ucunu göbeğe bağlar; bu uç yalnız mesnet reaksiyonunu aktarır. Bu yüzden
  // burulma direnç momenti (polar modül) hesaplanmaz ve RAPORDA GÖSTERİLMEZ —
  // kullanılmayan bir direnç momenti mühendisi yanıltır.
  const shaftWeldLengthCm = Math.PI * dims.d1Cm;
  const shaftWeldThroatAreaCm2 = dims.shaftWeldThroatCm * shaftWeldLengthCm;
  const shaftWeldShearStress =
    shaftWeldThroatAreaCm2 > 0 ? maxReactionKg / shaftWeldThroatAreaCm2 : 0;
  const shaftWeldMomentBearingKgCm = reactionBearingKg * geo.gCm;
  const shaftWeldMomentGearboxKgCm = reactionGearboxKg * geo.aCm;
  const bearingSideGoverns = shaftWeldMomentBearingKgCm >= shaftWeldMomentGearboxKgCm;
  const shaftWeldArmCm = bearingSideGoverns ? geo.gCm : geo.aCm;
  const shaftWeldMomentKgCm = Math.max(
    shaftWeldMomentBearingKgCm,
    shaftWeldMomentGearboxKgCm
  );
  const shaftWeldSectionModulusCm3 =
    (Math.PI * dims.shaftWeldThroatCm * dims.d1Cm ** 2) / 4;
  const shaftWeldBendingStress =
    shaftWeldSectionModulusCm3 > 0 ? shaftWeldMomentKgCm / shaftWeldSectionModulusCm3 : 0;
  const shaftWeldAssess = assessWeld({
    normalKgCm2: shaftWeldBendingStress,
    shearKgCm2: shaftWeldShearStress,
    material: sel.drumMaterial,
    manualAllowableMPa: weldAllowanceAuto ? undefined : inp.shaftWeldAllowable,
  });
  const shaftWeldCombinedStress = shaftWeldAssess.femEquivalent;
  Object.assign(cells, {
    "shaftWeld.length": shaftWeldLengthCm,
    "shaftWeld.throatArea": shaftWeldThroatAreaCm2,
    "shaftWeld.shearStress": shaftWeldShearStress,
    "shaftWeld.arm": shaftWeldArmCm,
    "shaftWeld.bendingMoment": shaftWeldMomentKgCm,
    "shaftWeld.sectionModulus": shaftWeldSectionModulusCm3,
    "shaftWeld.bendingStress": shaftWeldBendingStress,
    "shaftWeld.combinedStress": shaftWeldCombinedStress,
    "shaftWeld.principalStress": shaftWeldAssess.cmaaPrincipal,
    "shaftWeld.allowableFem": weldAllow.femMPa,
    "shaftWeld.allowableCmaa": weldAllow.cmaaTensionMPa,
    "shaftWeld.allowableCmaaShear": weldAllow.cmaaShearMPa,
    "shaftWeld.utilizationFem": shaftWeldAssess.femUtilization,
    "shaftWeld.utilizationCmaa": shaftWeldAssess.cmaaUtilization,
    "shaftWeld.governing": shaftWeldAssess.ruleLabel,
    "shaftWeld.governingStress": shaftWeldAssess.stressMPa,
    "shaftWeld.allowable": shaftWeldAssess.allowableMPa,
  });
  checks.push({
    id: `${which}.shaftWeld.stress`,
    label: `Mil Kaynağı Gerilmesi (${shaftWeldAssess.ruleLabel})`,
    required: shaftWeldAssess.stressMPa, provided: shaftWeldAssess.allowableMPa,
    unit: "MPa", op: ">=",
    computedSide: "required",
    pass: shaftWeldAssess.allowableMPa >= shaftWeldAssess.stressMPa,
    standard: shaftWeldAssess.standard,
    kind: "standart", severity: "engelleyici",
  });

  // --- 2.2.6 Tambur rulmanı ------------------------------------------------
  // Tambur yatağı rulmanı, TAMBUR YATAĞI tarafı reaksiyonunu taşır.
  const bearingRadialKn = reactionBearingKg * 0.00981;
  const bearingAxialKn = 0.1 * bearingRadialKn;
  const bearingEqStaticKn = bearingRadialKn + bearingAxialKn * inp.bearingFactorY1;
  const bearingEqDynamicKn = bearingRadialKn + inp.bearingFactorY2 * bearingAxialKn;
  const bearingStaticSafety = sel.bearingStatC0Kn / bearingEqStaticKn;
  const drumRpm =
    (liftSpeedMpm * mechanicalAdvantage) / (sel.drumDiaMm / 1000) / Math.PI;
  const bearingLifeHours =
    (1000000 / (60 * drumRpm)) * (sel.bearingDynCKn / bearingEqDynamicKn) ** (10 / 3);
  const life = mechanismLife(usage);
  const requiredLifeMin = life.min ?? 0;
  const requiredLifeMax = life.max;
  Object.assign(cells, {
    "drumBearing.bore": sel.bearingBoreMm,
    "drumBearing.shaftSeat": inp.shaftD2Mm,
    "drumBearing.radialLoad": bearingRadialKn,
    "drumBearing.axialLoad": bearingAxialKn,
    "drumBearing.equivalentStatic": bearingEqStaticKn,
    "drumBearing.equivalentDynamic": bearingEqDynamicKn,
    "drumBearing.staticSafety": bearingStaticSafety,
    "drum.rpm": drumRpm,
    "drumBearing.lifeHours": bearingLifeHours,
    "drumBearing.requiredLifeMin": requiredLifeMin,
    ...(requiredLifeMax !== null ? { "drumBearing.requiredLifeMax": requiredLifeMax } : {}),
  });
  checks.push({
    id: `${which}.bearing.bore`,
    label: "Tambur Rulmanı İç Çapı = Mil Yatak Oturma Çapı (D2)",
    min: inp.shaftD2Mm, max: inp.shaftD2Mm,
    provided: sel.bearingBoreMm, unit: "mm", op: "range",
    pass: Number.isFinite(sel.bearingBoreMm) && sel.bearingBoreMm === inp.shaftD2Mm,
    kind: "uretici", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.bearing.life`,
    label: "Tambur Rulmanı Ömrü",
    required: requiredLifeMin, provided: bearingLifeHours, unit: "saat", op: ">=",
    computedSide: "provided",
    pass: bearingLifeHours >= requiredLifeMin,
    standard: "FEM 1.001 T.2.1.3.2",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.bearing.static`,
    label: "Rulman Statik Emniyeti",
    required: 1, provided: bearingStaticSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: bearingStaticSafety >= 1,
    kind: "uretici", severity: "engelleyici",
  });

  // --- 2.3 Redüktör (seçim ve kontroller) ----------------------------------
  const requiredRatio = sel.motorRpm / drumRpm;
  const gearboxActualSafety = sel.gearboxNominalTorqueKnm / drumTorquePerDrumKnm;
  const ratioDeviationPct = (100 * (sel.gearboxRatio - requiredRatio)) / requiredRatio;
  const actualLiftSpeedMpm =
    ((sel.motorRpm / sel.gearboxRatio) * Math.PI * (sel.drumDiaMm / 1000)) / mechanicalAdvantage;
  // Redüktör çıkış miline gelen radyal yük REDÜKTÖR tarafı reaksiyonudur.
  const gearboxRadialKn = (reactionGearboxKg * 9.81) / 1000;
  Object.assign(cells, {
    "drum.radius": drumRadiusM,
    "rope.loadKn": ropeLoadKn,
    "drum.torque": drumTorqueKnm,
    "drum.torquePerDrum": drumTorquePerDrumKnm,
    "gearbox.requiredTorque": requiredGearboxTorqueKnm,
    "gearbox.requiredRatio": requiredRatio,
    "gearbox.actualSafety": gearboxActualSafety,
    "gearbox.ratioDeviation": ratioDeviationPct,
    "gearbox.actualLiftSpeed": actualLiftSpeedMpm,
    "gearbox.radialLoad": gearboxRadialKn,
  });
  checks.push({
    id: `${which}.gearbox.torque`,
    label: "Redüktör Tork Kapasitesi",
    required: requiredGearboxTorqueKnm, provided: sel.gearboxNominalTorqueKnm,
    unit: "kNm", op: ">=",
    computedSide: "required",
    pass: sel.gearboxNominalTorqueKnm >= requiredGearboxTorqueKnm,
    kind: "uretici", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.gearbox.ratio`,
    label: "Çevrim Oranı Sapması",
    min: -10, max: 5, provided: ratioDeviationPct, unit: "%", op: "range",
    pass: ratioDeviationPct <= 5 && ratioDeviationPct >= -10,
    // Band bir tasarım kabulüdür: dışına çıkmak kaldırma hızını beyan edilenden
    // saptırır, taşıyıcı bir yetersizlik yaratmaz.
    kind: "firma", severity: "uyari",
  });
  checks.push({
    id: `${which}.gearbox.radial`,
    label: "Redüktör Radyal Yük",
    required: gearboxRadialKn, provided: sel.gearboxAllowedRadialKn, unit: "kN", op: ">=",
    computedSide: "required",
    pass: sel.gearboxAllowedRadialKn >= gearboxRadialKn,
    kind: "uretici", severity: "engelleyici",
  });

  // --- 2.4 Motor -----------------------------------------------------------
  const gearboxOutputTorqueNm = drumTorquePerDrumKnm * 1000;
  const gearboxEfficiency = inp.stageEfficiency ** inp.reducerStages;
  const motorInputTorqueNm =
    gearboxOutputTorqueNm / (sel.gearboxRatio * gearboxEfficiency);
  const requiredPowerKw = (motorInputTorqueNm * sel.motorRpm) / 9550;
  const requiredPowerAdjustedKw = inp.tempFactor * requiredPowerKw;
  const powerPerMotorKw = requiredPowerAdjustedKw / inp.motorDivisor;
  const installedPowerKw = sel.motorPowerKw * sel.motorCount;
  Object.assign(cells, {
    "gearbox.outputTorque": gearboxOutputTorqueNm,
    "gearbox.efficiency": gearboxEfficiency,
    "motor.inputTorque": motorInputTorqueNm,
    "motor.requiredPower": requiredPowerKw,
    "motor.adjustedPower": requiredPowerAdjustedKw,
    "motor.powerPerMotor": powerPerMotorKw,
    "motor.installedPower": installedPowerKw,
  });
  checks.push({
    id: `${which}.motor.power`,
    label: "Motor Gücü",
    required: requiredPowerAdjustedKw, provided: installedPowerKw, unit: "kW", op: ">=",
    computedSide: "required",
    pass: installedPowerKw >= requiredPowerAdjustedKw,
    standard: "CMAA 70 5.2.9.1.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- 2.5 Fren ------------------------------------------------------------
  // Fren de motor–redüktör kaplini de motor miline oturur: ikisinin gördüğü
  // tork aynı büyüklüktür (motor giriş torku / motor adedi).
  const motorShaftTorqueNm = motorInputTorqueNm / sel.motorCount;
  const requiredBrakeTorqueNm = motorShaftTorqueNm * inp.brakeServiceFactor;
  const brakeActualSafety = sel.brakeTorqueNm / motorShaftTorqueNm;
  Object.assign(cells, {
    "motor.shaftTorque": motorShaftTorqueNm,
    "brake.requiredTorque": requiredBrakeTorqueNm,
    "brake.actualSafety": brakeActualSafety,
    "brake.combinedSafety": sel.brakeQty * brakeActualSafety,
  });
  checks.push({
    id: `${which}.brake.torque`,
    label: "Fren Torku",
    required: requiredBrakeTorqueNm, provided: sel.brakeTorqueNm, unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.brakeTorqueNm >= requiredBrakeTorqueNm,
    // Gerekli tork, firma servis faktörüyle ölçeklenir; sağlanmadan yayınlanamaz.
    kind: "firma", severity: "engelleyici",
  });
  // Fren SEÇİM tutarlılığı (uyarı, kullanıcı kararı 2026-08-24): seçilen SIBRE
  // TE kasnak freninin katalog kaydı çözülüyorsa, saklı kasnak çapı ve tork
  // bununla TUTARLI olmalıdır. Tutarsızsa bölüm "uygun değil" görünür ve
  // mühendisi yanlış/eski seçimi (ör. TE315/30/5 yerine 50/6, ya da model 250
  // iken kasnak 315) düzeltmeye yönlendirir. `uyari`: yayını sert bloklamaz.
  const brakeSpec = drumBrakeSpec(sel.brakeModel);
  if (brakeSpec) {
    checks.push({
      id: `${which}.brake.torqueModel`,
      label: "Fren Torku Modelin Ayar Aralığında",
      min: brakeSpec.minTorqueNm, max: brakeSpec.maxTorqueNm,
      provided: sel.brakeTorqueNm, unit: "Nm", op: "range",
      pass:
        Number.isFinite(sel.brakeTorqueNm) &&
        sel.brakeTorqueNm >= brakeSpec.minTorqueNm &&
        sel.brakeTorqueNm <= brakeSpec.maxTorqueNm,
      kind: "firma", severity: "uyari",
    });
    checks.push({
      id: `${which}.brake.wheelModel`,
      label: "Fren Kasnağı = Seçilen Model Kasnak Çapı",
      min: brakeSpec.drumDiaMm, max: brakeSpec.drumDiaMm,
      provided: sel.brakeWheelDiaMm, unit: "mm", op: "range",
      pass:
        Number.isFinite(sel.brakeWheelDiaMm) &&
        sel.brakeWheelDiaMm === brakeSpec.drumDiaMm,
      kind: "firma", severity: "uyari",
    });
  }

  // --- 2.6 Motor-redüktör kaplini ------------------------------------------
  const requiredMotorCouplingTorqueNm = motorShaftTorqueNm * inp.motorCouplingServiceFactor;
  const couplingShaftDiaMm = Math.max(sel.motorShaftMm, sel.gearboxInputShaftMm);
  const motorCouplingActualSafety = sel.motorCouplingTorqueNm / motorShaftTorqueNm;
  Object.assign(cells, {
    "motorCoupling.requiredTorque": requiredMotorCouplingTorqueNm,
    "motorCoupling.shaftDia": couplingShaftDiaMm,
    "motorCoupling.actualSafety": motorCouplingActualSafety,
  });
  checks.push({
    id: `${which}.motorCoupling.torque`,
    label: "Motor Kaplini Tork Kapasitesi",
    required: requiredMotorCouplingTorqueNm, provided: sel.motorCouplingTorqueNm,
    unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.motorCouplingTorqueNm >= requiredMotorCouplingTorqueNm,
    kind: "uretici", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.motorCoupling.bore`,
    label: "Motor Kaplini Delik Çapı",
    required: couplingShaftDiaMm, provided: sel.motorCouplingDmaxMm, unit: "mm", op: ">=",
    // İki taraf da katalogdan gelir; TALEP tarafı burada türetilir (motor mili ile
    // redüktör giriş mili çaplarının büyüğü), sınır ise kaplinin delik kapasitesidir.
    computedSide: "required",
    pass: sel.motorCouplingDmaxMm >= couplingShaftDiaMm,
    kind: "uretici", severity: "engelleyici",
  });
  // Servis freni motor-redüktör kaplininin KASNAĞI üzerinde oturur: fren
  // kasnağı ile kaplin kasnağı aynı parçadır. İkisi girilip farklıysa uyarı
  // (kullanıcı kararı 2026-08-24). İkisi de girilmemişse kontrol çıkmaz.
  if (sel.brakeWheelDiaMm > 0 && sel.motorCouplingWheelDiaMm > 0) {
    checks.push({
      id: `${which}.motorCoupling.brakeWheelMatch`,
      label: "Kaplin Kasnağı = Fren Kasnağı",
      min: sel.brakeWheelDiaMm, max: sel.brakeWheelDiaMm,
      provided: sel.motorCouplingWheelDiaMm, unit: "mm", op: "range",
      pass: sel.motorCouplingWheelDiaMm === sel.brakeWheelDiaMm,
      kind: "firma", severity: "uyari",
    });
  }

  // --- 2.7 Tambur kaplini --------------------------------------------------
  const drumCouplingDesignTorqueNm = (drumTorqueKnm * 1000) / inp.drumCouplingDivisor;
  const requiredDrumCouplingTorqueNm =
    drumCouplingDesignTorqueNm * inp.drumCouplingServiceFactor;
  const requiredDrumCouplingRadialN = reactionGearboxKg * 9.81;
  const drumCouplingShaftDiaMm = sel.gearboxOutputShaftMm;
  const drumCouplingActualSafety = sel.drumCouplingTorqueNm / drumCouplingDesignTorqueNm;
  Object.assign(cells, {
    "drumCoupling.designTorque": drumCouplingDesignTorqueNm,
    "drumCoupling.requiredTorque": requiredDrumCouplingTorqueNm,
    "drumCoupling.requiredRadial": requiredDrumCouplingRadialN,
    "drumCoupling.shaftDia": drumCouplingShaftDiaMm,
    "drumCoupling.actualSafety": drumCouplingActualSafety,
  });
  checks.push({
    id: `${which}.drumCoupling.torque`,
    label: "Tambur Kaplini Tork Kapasitesi",
    required: requiredDrumCouplingTorqueNm, provided: sel.drumCouplingTorqueNm,
    unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.drumCouplingTorqueNm >= requiredDrumCouplingTorqueNm,
    kind: "uretici", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.drumCoupling.radial`,
    label: "Tambur Kaplini Radyal Yük",
    required: requiredDrumCouplingRadialN, provided: sel.drumCouplingRadialN,
    unit: "N", op: ">=",
    computedSide: "required",
    pass: sel.drumCouplingRadialN >= requiredDrumCouplingRadialN,
    kind: "uretici", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.drumCoupling.bore`,
    label: "Tambur Kaplini Delik Çapı",
    required: drumCouplingShaftDiaMm, provided: sel.drumCouplingDmaxMm, unit: "mm", op: ">=",
    // İki taraf da katalogdan gelir; TALEP redüktör çıkış mili çapıdır (kaplinin
    // karşılaması gereken), sınır ise kaplinin en büyük delik çapıdır.
    computedSide: "required",
    pass: sel.drumCouplingDmaxMm >= drumCouplingShaftDiaMm,
    kind: "uretici", severity: "engelleyici",
  });

  // --- Halat dengeleme düzeni (denge traversi / denge makarası) -------------
  // Yalnız `ropeBalancingType` "Yok" DEĞİLKEN hesaplanır. Denge elemanı halat
  // yükünü `balanceRopeCount` kadar halat kolundan taşır (genelde 2). Loadcell
  // ve rulman bu birleşik yükle boyutlandırılır; soket halat çapına, denge
  // makarası FEM 1.001 T.4.2.3.1.1 "dengeleme makarası" katsayısına göre.
  // Kontroller yalnız İLGİLİ SEÇİM DOLUYKEN üretilir (boş şablon uyarı üretmez);
  // hepsi `uyari` — yanlış/eksik seçimi gösterir ama yayını sert bloklamaz.
  const balancingActive = inp.ropeBalancingType !== "none";
  if (balancingActive) {
    const balanceRopeCount =
      Number.isFinite(inp.balanceRopeCount) && (inp.balanceRopeCount ?? 0) > 0
        ? Math.round(inp.balanceRopeCount as number)
        : 2;
    const balanceLoadKg = ropeLoadKg * balanceRopeCount;
    const balanceLoadKn = (balanceLoadKg * 9.81) / 1000;
    Object.assign(cells, {
      "balance.ropeCount": balanceRopeCount,
      "balance.load": balanceLoadKg,
    });

    // Loadcell OTOMATİK: markaya göre gerekli yükün üstündeki en küçük kapasite.
    const loadcell = loadCellForLoad(balanceLoadKg, sel.balanceLoadcellBrand);
    if (loadcell) {
      Object.assign(cells, {
        "balance.loadcellModel": `${loadcell.brand} ${loadcell.model}`,
        "balance.loadcellModelShort": loadcell.model,
        "balance.loadcellCapacity": loadcell.capacityKg,
      });
      checks.push({
        id: `${which}.balance.loadcell`,
        label: "Loadcell Kapasitesi",
        required: balanceLoadKg, provided: loadcell.capacityKg,
        unit: "kg", op: ">=", computedSide: "required",
        pass: loadcell.capacityKg >= balanceLoadKg,
        kind: "uretici", severity: "uyari",
      });
    }

    // Denge rulmanı statik yükü (C0) birleşik yükü karşılamalı [kN] — elle girilir.
    if (Number.isFinite(sel.balanceBearingStatC0Kn) && (sel.balanceBearingStatC0Kn ?? 0) > 0) {
      checks.push({
        id: `${which}.balance.bearing`,
        label: "Denge Rulmanı Statik Yük C0",
        required: balanceLoadKn, provided: sel.balanceBearingStatC0Kn as number,
        unit: "kN", op: ">=", computedSide: "required",
        pass: (sel.balanceBearingStatC0Kn as number) >= balanceLoadKn,
        kind: "uretici", severity: "uyari",
      });
    }

    if (inp.ropeBalancingType === "equalizerBeam") {
      // Denge traversi: halat soketi OTOMATİK (halat çapı + tip).
      const socket = wedgeSocketForRope(sel.ropeDiaMm, sel.balanceSocketType);
      if (socket) {
        const socketMblKg = socket.mblTon * 1000;
        Object.assign(cells, {
          "balance.socketModel": socket.model,
          "balance.socketMbl": socket.mblTon,
        });
        checks.push({
          id: `${which}.balance.socketMbl`,
          label: "Soket MBL (Minimum Kırılma Yükü)",
          required: balanceLoadKg, provided: socketMblKg,
          unit: "kg", op: ">=", computedSide: "required",
          pass: socketMblKg >= balanceLoadKg,
          kind: "uretici", severity: "uyari",
        });
      }
    } else {
      // Denge makarası: minimum çap D ≥ H_dengeleme · d (FEM T.4.2.3.1.1).
      const balanceSheaveMinDiaMm = equalizerCoefficient(mech) * sel.ropeDiaMm;
      cells["balance.sheaveMinDia"] = balanceSheaveMinDiaMm;
      if (Number.isFinite(sel.balanceSheaveDiaMm) && (sel.balanceSheaveDiaMm ?? 0) > 0) {
        checks.push({
          id: `${which}.balance.sheaveDia`,
          label: "Denge Makarası Çapı (FEM T.4.2.3.1.1)",
          required: balanceSheaveMinDiaMm, provided: sel.balanceSheaveDiaMm as number,
          unit: "mm", op: ">=", computedSide: "required",
          pass: (sel.balanceSheaveDiaMm as number) >= balanceSheaveMinDiaMm,
          kind: "standart", severity: "uyari",
        });
      }
    }
  }

  // --- 2.8 Emniyet freni (tambur üstü kaliper) ------------------------------
  // Yalnız emniyet freni ÖNGÖRÜLEN kaldırma gruplarında hesaplanır; olmayan
  // grupta ne hücre ne kontrol üretilir, bölüm de raporda görünmez.
  const safetyBrakeFitted = hasSafetyBrake(specs, which);
  const sbModel = safetyBrakeByCode(sel.safetyBrakeModel);
  const sbClampKn = clampForceKn(sbModel, sel.safetyBrakeAirGapMm);
  const sbCount = brakesInArrangement(sel.safetyBrakeArrangement);
  const sbMinFlangeDiaMm = minFlangeDiaMm({
    model: sbModel,
    drumDiaMm: sel.drumDiaMm,
    clearanceMm: inp.safetyBrakeFlangeClearanceMm,
  });
  // Gereken moment tamburun statik yük momentidir — modül zaten üretiyor.
  const sbRequiredTorqueNm = drumTorquePerDrumKnm * 1000;
  const sbDemandTorqueNm = sbRequiredTorqueNm * inp.safetyBrakeServiceFactor;
  const sbTorqueEachNm = brakeTorqueNm({
    clampForceN: (sbClampKn ?? 0) * 1000,
    frictionCoeff: SAFETY_BRAKE_FRICTION,
    flangeDiaMm: sel.safetyBrakeFlangeDiaMm,
    leverXMm: sbModel?.leverXMm ?? 0,
  });
  const sbTotalTorqueNm = sbTorqueEachNm * sbCount;
  const sbAchievedFactor =
    sbRequiredTorqueNm > 0 ? sbTotalTorqueNm / sbRequiredTorqueNm : Number.NaN;
  // Hidrolik güç ünitesi: mühendis seçmediyse katalogun HPU seçim tablosundan
  // önerilen ünite kullanılır. Seri kaliper adedine bağlıdır (V2'ye en çok iki
  // fren bağlanır); basınç kademesi fren tipinden gelir.
  const sbRecommendedUnit = recommendHydraulicUnit(sbModel, sbCount);
  const sbUnit = hydraulicUnitByCode(sel.safetyBrakeHydraulicUnit) ?? sbRecommendedUnit;
  // Bir fren açmak için gereken yağ hacmi — ünite deposunun karşılaması gerekir.
  const sbOilLitre = (sbModel?.volumeLitre ?? 0) * sbCount;

  if (safetyBrakeFitted) {
    Object.assign(cells, {
      "safety.requiredTorque": sbRequiredTorqueNm,
      "safety.demandTorque": sbDemandTorqueNm,
      "safety.clampForce": (sbClampKn ?? Number.NaN) * 1000,
      "safety.leverX": sbModel?.leverXMm ?? Number.NaN,
      "safety.minFlangeDia": sbMinFlangeDiaMm,
      "safety.flangeDia": sel.safetyBrakeFlangeDiaMm,
      "safety.brakeCount": sbCount,
      "safety.torqueEach": sbTorqueEachNm,
      "safety.totalTorque": sbTotalTorqueNm,
      "safety.achievedFactor": sbAchievedFactor,
      "safety.releasePressure": sbModel?.releasePressureBar ?? Number.NaN,
      "safety.maxPressure": sbModel?.maxPressureBar ?? Number.NaN,
      "safety.minDiscThickness": sbModel?.minDiscThicknessMm ?? Number.NaN,
      "safety.flangeThickness": sel.safetyBrakeFlangeThicknessMm,
      "safety.oilVolume": sbOilLitre,
      "safety.unitCode": sbUnit?.code ?? "—",
      "safety.unitSeries": sbUnit?.series ?? "—",
      "safety.unitPressure": sbUnit?.releasePressureBar ?? Number.NaN,
      "safety.unitRelief": sbUnit?.reliefValveBar ?? Number.NaN,
      "safety.unitPump": sbUnit?.pumpLpm ?? Number.NaN,
      "safety.unitMotor": sbUnit?.motorKw ?? Number.NaN,
      "safety.unitTank": sbUnit?.tankLitre ?? Number.NaN,
    });
    checks.push({
      id: `${which}.safety.torque`,
      label: "Emniyet Freni Frenleme Momenti",
      required: sbDemandTorqueNm, provided: sbTotalTorqueNm, unit: "Nm", op: ">=",
      computedSide: "provided",
      pass: sbTotalTorqueNm >= sbDemandTorqueNm,
      standard: "FEM 1.001 T.2.1.3.2",
      kind: "standart", severity: "engelleyici",
    });
    checks.push({
      id: `${which}.safety.flange`,
      label: "Flanş Dış Çapı",
      required: sbMinFlangeDiaMm, provided: sel.safetyBrakeFlangeDiaMm, unit: "mm", op: ">=",
      computedSide: "required",
      pass: sel.safetyBrakeFlangeDiaMm >= sbMinFlangeDiaMm,
      kind: "uretici", severity: "engelleyici",
    });
    // Fren boşluğu modelin çalışma bandı dışındaysa sıkma kuvveti tanımsızdır
    // (ör. SHI 231/232 yalnız 2…3 mm); moment hesabı anlamını yitirir.
    checks.push({
      id: `${which}.safety.airGap`,
      label: "Fren Boşluğu Modelin Bandında",
      required: 1, provided: sbClampKn === undefined ? 0 : 1, unit: "-", op: ">=",
      computedSide: "provided",
      pass: sbClampKn !== undefined,
      kind: "uretici", severity: "engelleyici",
    });
    // Flanş, katalogun istediği en küçük disk kalınlığını sağlamalıdır; ince
    // disk ısınır ve balata basıncını taşıyamaz.
    checks.push({
      id: `${which}.safety.flangeThickness`,
      label: "Flanş Kalınlığı",
      required: sbModel?.minDiscThicknessMm ?? Number.NaN,
      provided: sel.safetyBrakeFlangeThicknessMm, unit: "mm", op: ">=",
      computedSide: "required",
      pass: sel.safetyBrakeFlangeThicknessMm >= (sbModel?.minDiscThicknessMm ?? Infinity),
      kind: "uretici", severity: "engelleyici",
    });
    // Hidrolik ünite frenin açma basıncını sağlamalı, emniyet valfi ayarı da
    // frenin azami basıncını AŞMAMALIDIR (aşarsa kaliper zorlanır).
    checks.push({
      id: `${which}.safety.hydraulic`,
      label: "Hidrolik Ünite Basıncı",
      required: sbModel?.releasePressureBar ?? Number.NaN,
      provided: sbUnit?.releasePressureBar ?? Number.NaN, unit: "bar", op: ">=",
      computedSide: "required",
      pass:
        sbUnit !== undefined && sbModel !== undefined &&
        sbUnit.releasePressureBar >= sbModel.releasePressureBar &&
        sbUnit.reliefValveBar <= sbModel.maxPressureBar,
      kind: "uretici", severity: "engelleyici",
    });
  }

  const values: HoistValues = {
    capacityT,
    mechanicalAdvantage,
    ropeEfficiency,
    loadKg: hoistedLoadKg,
    totalLoadKg,
    requiredRopeSafety,
    ropeLoadKg,
    requiredBreakingKg,
    actualBreakingKg,
    actualRopeSafety,
    ropeLengthPerGrooveM: ropePlan.lengthPerGrooveM,
    ropeRawTotalLengthM: ropePlan.rawTotalLengthM,
    ropeAutomaticTotalLengthM: ropePlan.automaticTotalLengthM,
    ropeLengthPerPieceM: ropePlan.lengthPerPieceM,
    ropeTotalLengthM: ropePlan.totalLengthM,
    ropePieceCount: ropePlan.pieceCount,
    ropeRightLayCount: ropePlan.rightLayCount,
    ropeLeftLayCount: ropePlan.leftLayCount,
    ropeLayText: ropePlan.layLabel,
    ropeArrangementText: ropePlan.arrangementText,
    drumCoefficientH,
    minDrumDiaMm,
    groovePitchMm,
    drumBearingStress,
    drumBendingStress,
    drumCombinedStress,
    drumAllowable,
    requiredGrooves,
    requiredGrooveLengthMm,
    drumShaftSpanCm: geo.spanCm,
    drumWeightArmCm: geo.weightArmCm,
    ropeLoadPositionsCm: govBearing.xs,
    ropeLoadCount,
    ropeLoadPerPointKg: ropePerPoint,
    reactionGearboxKg,
    reactionBearingKg,
    reactionAKg: reactionGearboxKg,
    reactionBKg: reactionBearingKg,
    momentGearboxKgCm,
    momentBearingKgCm,
    shaftGoverningSide: governingSide,
    shaftMomentKgCm,
    shaftBendingStress,
    shaftShearStress,
    shaftCombinedStress,
    shaftAllowables: shaftAllow,
    drumWeldCombinedStress,
    drumWeldAssessment: drumWeldAssess,
    shaftWeldStress: shaftWeldShearStress,
    shaftWeldMomentKgCm,
    shaftWeldBendingStress,
    shaftWeldCombinedStress,
    shaftWeldAssessment: shaftWeldAssess,
    weldAllowable: weldAllow,
    bearingRadialKn,
    bearingAxialKn,
    bearingEqStaticKn,
    bearingEqDynamicKn,
    bearingStaticSafety,
    drumRpm,
    bearingLifeHours,
    requiredLifeMin,
    requiredLifeMax,
    drumTorqueKnm: drumTorquePerDrumKnm,
    requiredGearboxTorqueKnm,
    requiredRatio,
    ratioDeviationPct,
    actualLiftSpeedMpm,
    gearboxActualSafety,
    gearboxRadialKn,
    reducerEfficiency: gearboxEfficiency,
    motorInputTorqueNm,
    requiredPowerKw,
    requiredPowerAdjustedKw,
    installedPowerKw,
    brakeShaftTorqueNm: motorShaftTorqueNm,
    requiredBrakeTorqueNm,
    brakeActualSafety,
    requiredMotorCouplingTorqueNm,
    couplingShaftDiaMm,
    motorCouplingActualSafety,
    requiredDrumCouplingTorqueNm,
    requiredDrumCouplingRadialN,
    drumCouplingActualSafety,
  };

  return { values, checks, cells };
}

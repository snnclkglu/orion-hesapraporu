// Ortak kiriş çözücüsü — iki mesnetli, tekil ve düzgün yayılı yükler altında
// statik olarak belirli kirişin kesme kuvveti ve eğilme momenti dağılımı.
//
// Bu modül SAF STATİKTİR: hiçbir gerilme konvansiyonu, malzeme emniyeti veya
// kesit özelliği içermez. Kesitten gerilmeye geçiş `shaftStress.ts` (dairesel
// miller) veya ilgili modülün kendi kesit hesabı ile yapılır.
//
// İŞARET KABULÜ
//   · x ekseni kirişin sol ucundan sağa doğru artar [cm].
//   · Yükler AŞAĞI yönde pozitiftir [kg]. Negatif yük yukarı kaldırma demektir.
//   · Mesnet tepkileri YUKARI yönde pozitiftir [kg].
//   · Kesme kuvveti V(x) = kesitin SOLUNDA kalan kuvvetlerin yukarı yöndeki
//     bileşke toplamıdır [kg].
//   · Moment M(x) = solda kalan kuvvetlerin x noktasına göre momentidir
//     [kg·cm]. Pozitif moment SARKMA (alt lif çekme) demektir; mesnet dışına
//     taşan konsol yükleri açıklık içinde NEGATİF moment üretir.
//
// GEOMETRİ SERBESTLİĞİ
//   · Mesnetler kiriş uçlarında olmak zorunda değildir (konsol destekli kiriş).
//   · Yükler mesnetlerin dışında da bulunabilir.
//   · Denge her koşulda korunur: reactionAKg + reactionBKg = ΣP.
//
// SAYISAL DAYANIKLILIK
//   Girdilerdeki NaN/Infinity değerler 0'a indirgenir, mesnetler çakışıksa
//   (tek mesnet) tüm yük A mesnedine aktarılır. Böylece sonuçta hiçbir zaman
//   NaN veya Infinity oluşmaz.

/** Kiriş üzerinde tekil (noktasal) yük */
export interface PointLoad {
  /** Sol uçtan itibaren konum [cm] */
  xCm: number;
  /** Aşağı yönde pozitif yük [kg] */
  loadKg: number;
  /** Raporlamada kullanılacak serbest etiket */
  label?: string;
}

/** Kiriş üzerinde düzgün yayılı yük */
export interface DistributedLoad {
  /** Yayılı yükün başlangıcı [cm] */
  fromCm: number;
  /** Yayılı yükün bitişi [cm] */
  toCm: number;
  /** Birim uzunluk başına aşağı yönde pozitif yük [kg/cm] */
  intensityKgPerCm: number;
  /** Raporlamada kullanılacak serbest etiket */
  label?: string;
}

/** Çözülecek kiriş tanımı */
export interface BeamModel {
  /** Kirişin toplam uzunluğu [cm] */
  lengthCm: number;
  /** A mesnedinin konumu [cm] */
  supportACm: number;
  /** B mesnedinin konumu [cm] */
  supportBCm: number;
  /** Tekil yükler */
  pointLoads: PointLoad[];
  /** Düzgün yayılı yükler (isteğe bağlı) */
  distributedLoads?: DistributedLoad[];
}

/** Diyagram düğümü. Kesme süreksizliğinin bulunduğu konumlarda iki düğüm
 *  üretilir: kesitin solu (`side: "left"`) ve sağı (`side: "right"`). */
export interface BeamStation {
  /** Düğüm konumu [cm] */
  xCm: number;
  /** Kesme süreksizliği varsa kesitin hangi yüzü olduğunu belirtir */
  side?: "left" | "right";
  /** Bu yüzdeki kesme kuvveti [kg] */
  shearKg: number;
  /** Bu konumdaki eğilme momenti [kg·cm] */
  momentKgCm: number;
}

/** Çözüm sonucu */
export interface BeamResult {
  /** A mesnedi tepkisi, yukarı pozitif [kg] */
  reactionAKg: number;
  /** B mesnedi tepkisi, yukarı pozitif [kg] */
  reactionBKg: number;
  /** Konuma göre sıralı diyagram düğümleri (doğrudan çizime uygundur) */
  stations: BeamStation[];
  /** Mutlak değeri en büyük moment, İŞARETİYLE birlikte [kg·cm] */
  maxMomentKgCm: number;
  /** Mutlak değeri en büyük momentin konumu [cm] */
  maxMomentXCm: number;
  /** Mutlak değeri en büyük kesme kuvveti, İŞARETİYLE birlikte [kg] */
  maxShearKg: number;
  /** İstenen konumdaki eğilme momenti [kg·cm] */
  momentAt(xCm: number): number;
}

/** Mesnet tepkileri */
export interface BeamReactions {
  reactionAKg: number;
  reactionBKg: number;
}

/** Konum ve kuvvet karşılaştırmalarında kullanılan sayısal tolerans */
const EPS = 1e-9;

/** Sayısallaştırılmış, iç kullanıma hazır kiriş tanımı */
interface NormalizedBeam {
  lengthCm: number;
  supportACm: number;
  supportBCm: number;
  pointLoads: PointLoad[];
  distributedLoads: DistributedLoad[];
}

/** NaN/Infinity girdileri 0'a indirger */
function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Negatif değerleri 0'a kırpar (Macaulay parantezi) */
function positivePart(value: number): number {
  return value > 0 ? value : 0;
}

/** Modeli sayısal olarak güvenli hale getirir ve yayılı yükleri sıralar */
function normalize(model: BeamModel): NormalizedBeam {
  const pointLoads: PointLoad[] = (model.pointLoads ?? []).map((load) => ({
    xCm: finiteOrZero(load.xCm),
    loadKg: finiteOrZero(load.loadKg),
    label: load.label,
  }));

  const distributedLoads: DistributedLoad[] = (model.distributedLoads ?? [])
    .map((load) => {
      const a = finiteOrZero(load.fromCm);
      const b = finiteOrZero(load.toCm);
      return {
        fromCm: Math.min(a, b),
        toCm: Math.max(a, b),
        intensityKgPerCm: finiteOrZero(load.intensityKgPerCm),
        label: load.label,
      };
    })
    // Sıfır uzunluklu veya sıfır şiddetli yayılı yük diyagrama katkı vermez
    .filter(
      (load) =>
        load.toCm - load.fromCm > EPS && Math.abs(load.intensityKgPerCm) > 0
    );

  return {
    lengthCm: Math.max(0, finiteOrZero(model.lengthCm)),
    supportACm: finiteOrZero(model.supportACm),
    supportBCm: finiteOrZero(model.supportBCm),
    pointLoads,
    distributedLoads,
  };
}

/** Toplam düşey yük ΣP [kg] */
function totalLoadKg(beam: NormalizedBeam): number {
  let total = 0;
  for (const load of beam.pointLoads) total += load.loadKg;
  for (const load of beam.distributedLoads) {
    total += load.intensityKgPerCm * (load.toCm - load.fromCm);
  }
  return total;
}

/** Yüklerin `originCm` noktasına göre momenti [kg·cm] */
function loadMomentAboutKgCm(beam: NormalizedBeam, originCm: number): number {
  let moment = 0;
  for (const load of beam.pointLoads) {
    moment += load.loadKg * (load.xCm - originCm);
  }
  for (const load of beam.distributedLoads) {
    const length = load.toCm - load.fromCm;
    const centroid = (load.fromCm + load.toCm) / 2;
    moment += load.intensityKgPerCm * length * (centroid - originCm);
  }
  return moment;
}

/** Mesnet tepkilerini denge denklemlerinden çözer */
function solveReactions(beam: NormalizedBeam): BeamReactions {
  const total = totalLoadKg(beam);
  const span = beam.supportBCm - beam.supportACm;

  // Mesnetler çakışıksa moment dengesi kurulamaz; tüm yük A'ya aktarılır.
  // Bu, sonucun sonsuz/NaN olmasını engelleyen bilinçli bir indirgemedir.
  if (Math.abs(span) < EPS) {
    return { reactionAKg: total, reactionBKg: 0 };
  }

  const reactionBKg = loadMomentAboutKgCm(beam, beam.supportACm) / span;
  return { reactionAKg: total - reactionBKg, reactionBKg };
}

/** Normalize edilmiş model üzerinde kesme kuvveti */
function shearOf(
  beam: NormalizedBeam,
  reactions: BeamReactions,
  xCm: number,
  side: "left" | "right"
): number {
  // "left"  → x noktasındaki tekil kuvvetler kesitin SAĞINDA kalır, sayılmaz.
  // "right" → x noktasındaki tekil kuvvetler kesitin SOLUNDA kalır, sayılır.
  const applies = (positionCm: number): boolean =>
    side === "right" ? positionCm <= xCm + EPS : positionCm < xCm - EPS;

  let shear = 0;
  if (applies(beam.supportACm)) shear += reactions.reactionAKg;
  if (applies(beam.supportBCm)) shear += reactions.reactionBKg;
  for (const load of beam.pointLoads) {
    if (applies(load.xCm)) shear -= load.loadKg;
  }
  // Yayılı yük sürekli olduğundan kesitin iki yüzünde de aynı katkıyı verir
  for (const load of beam.distributedLoads) {
    const covered = positivePart(Math.min(load.toCm, xCm) - load.fromCm);
    shear -= load.intensityKgPerCm * covered;
  }
  return shear;
}

/** Normalize edilmiş model üzerinde eğilme momenti */
function momentOf(
  beam: NormalizedBeam,
  reactions: BeamReactions,
  xCm: number
): number {
  let moment = 0;
  moment += reactions.reactionAKg * positivePart(xCm - beam.supportACm);
  moment += reactions.reactionBKg * positivePart(xCm - beam.supportBCm);
  for (const load of beam.pointLoads) {
    moment -= load.loadKg * positivePart(xCm - load.xCm);
  }
  for (const load of beam.distributedLoads) {
    const hiCm = Math.min(load.toCm, xCm);
    if (hiCm <= load.fromCm) continue;
    // ∫ w·(x − t) dt , t ∈ [from, hi]
    const armFrom = xCm - load.fromCm;
    const armHi = xCm - hiCm;
    moment -=
      (load.intensityKgPerCm * (armFrom * armFrom - armHi * armHi)) / 2;
  }
  return moment;
}

/** Mesnet tepkilerini döndürür (saf yardımcı) */
export function beamReactions(model: BeamModel): BeamReactions {
  return solveReactions(normalize(model));
}

/**
 * `xCm` konumundaki kesme kuvveti [kg].
 * Tekil yükün / mesnedin tam üzerinde kesme süreksiz olduğundan `side` ile
 * hangi kesit yüzünün istendiği belirtilir (varsayılan: sağ yüz).
 */
export function shearAtX(
  model: BeamModel,
  xCm: number,
  side: "left" | "right" = "right"
): number {
  const beam = normalize(model);
  return shearOf(beam, solveReactions(beam), finiteOrZero(xCm), side);
}

/** `xCm` konumundaki eğilme momenti [kg·cm] (moment her yerde süreklidir) */
export function momentAtX(model: BeamModel, xCm: number): number {
  const beam = normalize(model);
  return momentOf(beam, solveReactions(beam), finiteOrZero(xCm));
}

/** Değeri, listede toleransa göre yoksa ekler */
function pushUnique(values: number[], value: number): void {
  if (!values.some((existing) => Math.abs(existing - value) <= EPS)) {
    values.push(value);
  }
}

/** Diyagramın kırılma noktaları: uçlar, mesnetler, tekil yükler, yayılı sınırlar */
function breakpointsOf(beam: NormalizedBeam): number[] {
  const values: number[] = [];
  pushUnique(values, 0);
  pushUnique(values, beam.lengthCm);
  pushUnique(values, beam.supportACm);
  pushUnique(values, beam.supportBCm);
  for (const load of beam.pointLoads) pushUnique(values, load.xCm);
  for (const load of beam.distributedLoads) {
    pushUnique(values, load.fromCm);
    pushUnique(values, load.toCm);
  }
  values.sort((a, b) => a - b);
  return values;
}

/**
 * Kirişi çözer: mesnet tepkileri, sıralı kesme/moment düğümleri ve
 * maksimum değerler. Düğümler kesme süreksizliklerinde çiftlenir; kesmenin
 * işaret değiştirdiği ara noktalar (moment ekstremumları) da eklenir.
 */
export function solveBeam(model: BeamModel): BeamResult {
  const beam = normalize(model);
  const reactions = solveReactions(beam);
  const breaks = breakpointsOf(beam);

  const stations: BeamStation[] = [];
  for (let i = 0; i < breaks.length; i += 1) {
    const xCm = breaks[i];
    const shearLeft = shearOf(beam, reactions, xCm, "left");
    const shearRight = shearOf(beam, reactions, xCm, "right");
    const momentKgCm = momentOf(beam, reactions, xCm);

    if (Math.abs(shearRight - shearLeft) > EPS) {
      stations.push({ xCm, side: "left", shearKg: shearLeft, momentKgCm });
      stations.push({ xCm, side: "right", shearKg: shearRight, momentKgCm });
    } else {
      stations.push({ xCm, shearKg: shearRight, momentKgCm });
    }

    // İki kırılma noktası arasında kesme doğrusaldır; işaret değiştiriyorsa
    // orada moment ekstremumu vardır ve sıfır geçişi tam olarak bulunabilir.
    const nextX = breaks[i + 1];
    if (nextX === undefined) continue;
    const shearNextLeft = shearOf(beam, reactions, nextX, "left");
    const changesSign =
      (shearRight > EPS && shearNextLeft < -EPS) ||
      (shearRight < -EPS && shearNextLeft > EPS);
    if (!changesSign) continue;
    const ratio = shearRight / (shearRight - shearNextLeft);
    const crossingCm = xCm + ratio * (nextX - xCm);
    if (crossingCm > xCm + EPS && crossingCm < nextX - EPS) {
      stations.push({
        xCm: crossingCm,
        shearKg: 0,
        momentKgCm: momentOf(beam, reactions, crossingCm),
      });
    }
  }

  let maxMomentKgCm = 0;
  let maxMomentXCm = stations.length > 0 ? stations[0].xCm : 0;
  let maxShearKg = 0;
  for (const station of stations) {
    if (Math.abs(station.momentKgCm) > Math.abs(maxMomentKgCm)) {
      maxMomentKgCm = station.momentKgCm;
      maxMomentXCm = station.xCm;
    }
    if (Math.abs(station.shearKg) > Math.abs(maxShearKg)) {
      maxShearKg = station.shearKg;
    }
  }

  return {
    reactionAKg: reactions.reactionAKg,
    reactionBKg: reactions.reactionBKg,
    stations,
    maxMomentKgCm,
    maxMomentXCm,
    maxShearKg,
    momentAt: (xCm: number) =>
      momentOf(beam, reactions, finiteOrZero(xCm)),
  };
}

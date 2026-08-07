// Tampon (buffer) çekirdeği — araba ve köprü yürütme gruplarının ortak tampon
// hesabı. Modül değil KÜTÜPHANEDİR: aynı fizik iki kez yazılmasın diye
// `modules/travelGroup.ts` bu dosyayı çağırır.
//
// DAYANAK
//   · FEM 1.001 (3rd Ed. Rev. 1998) md. 2.2.3.4.1 — "Buffer effects on the
//     structure". Yük SALINABİLİYORSA çarpışan kütleye DAHİL EDİLMEZ; yük RİJİT
//     KILAVUZLU ise dahil edilir. Standart, tamponun anma hızın 0,7 katındaki
//     kinetik enerjiyi yutabilmesini ister.
//   · FEM 1.001 Kitapçık 9 md. 9.4.2 — "In clause 2.2.3.4.1 replace 0,7 m/s
//     with 0,4 m/s": tampon tepkisinin YAPIYA taşınması için eşik hız 0,4 m/s'ye
//     indirilmiştir. Eşiğin altında tampon yine boyutlandırılır, ancak tepki
//     kuvveti yol kirişi/ana kiriş yüklemesine girmez.
//   · FEM 1.001 md. 7.7.1.2 — yavaşlama kabin içinde 5 m/s²'yi aşmamalıdır;
//     yürüyüş sınırına normal işletmede SIK ulaşılıyorsa sınır 2,5 m/s²'dir.
//   · CMAA 70 md. 3.3.2.1.3.2 — aynı ayrımı (salınan yük hariç) yapar.
//
// ÇARPMA HIZI ORANI k
//   v_ç = (v_anma / 60) · k. FEM 2.2.3.4.1 cihaz için k = 0,7 verir. Uygulamada
//   ARABA tamponunda k = 1,0 (muhafazakâr firma kabulü — araba kütlesi küçük,
//   frenleme mesafesi kısa), KÖPRÜ tamponunda k = 0,7 varsayılandır. Oran
//   teknik özelliklerde DÜZENLENEBİLİR bir alandır.
//
// TAMPON BAŞINA KÜTLE
//   Çarpışma anında yük, aynı anda temas eden tamponlara paylaşılır. ARABA
//   simetriktir: kütle tampon adedine eşit bölünür. KÖPRÜDE araba eksantriktir:
//   yakın raya düşen pay köprü ağırlığının yarısı + arabanın (L−y)/L payıdır ve
//   bu pay o raydaki tamponlara (n/2 adet) bölünür. İki bağıntı da "BİR tampona
//   gelen kütle"yi verir; ikinci bir bölme YAPILMAZ (çift sayma olurdu).
//
// BİRİMLER: t, kg, kJ, kN, N, mm, m, m/s, m/dak, m/s².

import type { AnyCheck } from "./types";

// --------------------------------------------------------------- sabitler

/** Tampon tipi — teknik özelliklerde araba ve köprü için ayrı seçilir. */
export type BufferType = "hidrolik" | "kaucuk" | "hucresel" | "yok";

/**
 * Teknik özelliklerde görünen iki ana tampon ailesi. Hücresel poliüretan
 * tampon, kauçuk/elastomer ailesinin katalog alt türüdür; ayrı bir teknik
 * özellik seçeneği değildir.
 */
export const BUFFER_TECHNICAL_TYPES = ["hidrolik", "kaucuk"] as const;

/**
 * Kaydedilmiş eski revizyonlar ve hesap çekirdeği için tanınan tüm türler.
 * `hucresel` üst seçimde gösterilmez ama eski kayıtlarda ve katalog satırında
 * fiziksel davranışı belirtmek için korunur.
 */
export const BUFFER_TYPES = ["hidrolik", "kaucuk", "hucresel", "yok"] as const;

export const BUFFER_TYPE_LABELS: Record<string, string> = {
  hidrolik: "Hidrolik Tampon",
  kaucuk: "Kauçuk Tampon",
  hucresel: "Hücresel Tampon",
  yok: "Yok",
};

/** Katalogdaki tampon tipi değeri; seçici bu değerle teknik seçimi kilitler. */
export const BUFFER_CATALOG_TYPE: Record<BufferType, string> = {
  hidrolik: "hidrolik",
  kaucuk: "kauçuk",
  hucresel: "hücresel",
  yok: "yok",
};

/** Hücresel katalog satırının Wmaks/Fmaks limitlerinden türetilen eğriler. */
export interface CellularBufferCurves {
  /** Sıkışma [%] → yutulan enerji [J] */
  energyCurve: CurvePoint[];
  /** Sıkışma [%] → tampon kuvveti [kN] */
  forceCurve: CurvePoint[];
}

/**
 * Conductix Program 0180 ürün tabloları çalışma eğrisini basmaz; ancak her
 * ürün için dinamik enerji kapasitesi, azami kuvvet ve izinli sıkışmayı verir.
 * Bu üç katalog limitinden, uç noktaları bire bir sağlayan sürekli bir eğri
 * oluşturulur:
 *
 *   F(x) = Fmaks · (x / xmax)^p
 *   E(x) = Wmaks · (x / xmax)^(p + 1)
 *
 * p, integral enerji tam olarak Wmaks olacak şekilde seçilir. Böylece grafik
 * ve hesap 0 kN gibi yanıltıcı bir sonuç üretmez; eğrinin katalog grafiği
 * değil, katalog limitlerinden türetilmiş hesap eğrisi olduğu raporda açıkça
 * belirtilir.
 */
export function cellularCurvesFromCatalog(input: {
  /** İzin verilen toplam sıkışma yolu [mm] */
  strokeMm: number;
  /** İzin verilen azami sıkışma [%] */
  maxCompressionPct: number;
  /** Katalog dinamik enerji kapasitesi Wmaks [kJ] */
  catalogEnergyKj: number;
  /** Katalog azami kuvveti Fmaks [kN] */
  catalogMaxForceKn: number;
}): CellularBufferCurves | undefined {
  const strokeM = input.strokeMm / 1000;
  const maxPct = input.maxCompressionPct;
  const energyJ = input.catalogEnergyKj * 1000;
  const forceKn = input.catalogMaxForceKn;
  if (
    !Number.isFinite(strokeM) || strokeM <= 0 ||
    !Number.isFinite(maxPct) || maxPct <= 0 ||
    !Number.isFinite(energyJ) || energyJ <= 0 ||
    !Number.isFinite(forceKn) || forceKn <= 0
  ) return undefined;

  // F[kN] · s[m] = kJ. p ≥ 0 olduğunda kuvvet eğrisi monoton artar.
  const exponent = Math.max(0, (forceKn * strokeM) / input.catalogEnergyKj - 1);
  const fractions = [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1];
  return {
    energyCurve: fractions.map((r) => [maxPct * r, energyJ * r ** (exponent + 1)]),
    forceCurve: fractions.map((r) => [maxPct * r, forceKn * r ** exponent]),
  };
}

/**
 * Hidrolik tamponun sönümleme verimi η.
 *
 * SIBRE SP kataloğu (M 1501 486 E-EN-2021-11, s. 18) son kuvvetlerini
 * F = E_a / (s · 0,85) bağıntısıyla basar ve "The specified final forces are
 * already applied with a damping efficiency of 0.85" der. Eski hesap tablosu
 * 0,80 kullanıyordu; katalog değeri esas alınmıştır (bkz. paket raporu).
 */
export const HYDRAULIC_DAMPING_EFFICIENCY = 0.85;

/**
 * Tampon tepkisinin YAPIYA aktarılması için alt eşik hız [m/s].
 * FEM 1.001 Kitapçık 9 md. 9.4.2 (2.2.3.4.1'deki 0,7 m/s → 0,4 m/s).
 * `modules/wheelLoads.ts` aynı eşiği kullanır.
 */
export const BUFFER_SPEED_THRESHOLD_MPS = 0.4;

/** FEM 1.001 md. 7.7.1.2 — azami yavaşlama [m/s²]. */
export const DECELERATION_LIMIT_MPS2 = 5;

/** FEM 1.001 md. 7.7.1.2 — yürüyüş sınırına sık ulaşılıyorsa [m/s²]. */
export const DECELERATION_LIMIT_FREQUENT_MPS2 = 2.5;

/** FEM 1.001 md. 2.2.3.4.1'in cihaz için verdiği çarpma hızı oranı. */
export const FEM_IMPACT_SPEED_RATIO = 0.7;

/** Araba tamponunda kullanılan muhafazakâr firma varsayılanı. */
export const TROLLEY_IMPACT_SPEED_RATIO = 1;

// ------------------------------------------------------------ eğri araçları

/** Katalog eğrisinin bir noktası: [sıkışma %, büyüklük]. */
export type CurvePoint = readonly [number, number];

/** SIBRE SP katalog satırına bağlı kısma iğnesi seçeneği. */
export interface MeteringPin {
  design_mass_t_max: number;
  metering_pin_code: string;
}

export interface SelectedMeteringPin {
  code: string;
  designMassMaxT: number;
}

/**
 * Tampon başına tasarım kütlesini karşılayan en küçük SIBRE SP kısma iğnesini
 * seçer. Katalog tablosu yoksa ya da kütle en büyük sınıfı geçerse sonuç yoktur.
 */
export function selectMeteringPin(
  pins: readonly MeteringPin[] | undefined,
  designMassT: number
): SelectedMeteringPin | undefined {
  if (!Array.isArray(pins) || !Number.isFinite(designMassT) || designMassT <= 0) return undefined;
  const pin = pins
    .filter(
      (pin) =>
        Number.isFinite(pin.design_mass_t_max) &&
        pin.design_mass_t_max > 0 &&
        typeof pin.metering_pin_code === "string" &&
        pin.metering_pin_code.trim() !== ""
    )
    .sort((a, b) => a.design_mass_t_max - b.design_mass_t_max)
    .find((item) => item.design_mass_t_max >= designMassT);
  return pin
    ? { code: pin.metering_pin_code, designMassMaxT: pin.design_mass_t_max }
    : undefined;
}

/**
 * Eğriyi x'e göre artan sırada, sayısal olmayan noktaları eleyerek verir.
 * Katalog JSON'u zaten sıralıdır; bu yalnız bozuk veriye karşı korumadır.
 */
function cleanCurve(curve: readonly CurvePoint[] | undefined): CurvePoint[] {
  if (!Array.isArray(curve)) return [];
  return curve
    .filter(
      (p): p is CurvePoint =>
        Array.isArray(p) &&
        p.length >= 2 &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1])
    )
    .map((p) => [p[0], p[1]] as CurvePoint)
    .sort((a, b) => a[0] - b[0]);
}

/**
 * x → y doğrusal enterpolasyon. x eğrinin dışındaysa UÇ NOKTA döner
 * (ekstrapolasyon YAPILMAZ — katalog eğrisinin ötesi ölçülmemiş bölgedir).
 * Eğri boşsa `undefined`.
 */
export function interpolateCurve(
  curve: readonly CurvePoint[] | undefined,
  x: number
): number | undefined {
  const pts = cleanCurve(curve);
  if (pts.length === 0 || !Number.isFinite(x)) return undefined;
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x <= x1) {
      if (x1 === x0) return y1;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * y → x ters enterpolasyon (eğri y'de ARTAN kabul edilir — enerji ve kuvvet
 * eğrileri sıkışmayla monoton artar). y eğrinin tepesini aşıyorsa son x döner;
 * çağıran bunu "kapasite yetmiyor" olarak yorumlar (sıkışma kontrolü yakalar).
 */
export function inverseCurve(
  curve: readonly CurvePoint[] | undefined,
  y: number
): number | undefined {
  const pts = cleanCurve(curve);
  if (pts.length === 0 || !Number.isFinite(y)) return undefined;
  if (y <= pts[0][1]) return pts[0][0];
  if (y >= pts[pts.length - 1][1]) return pts[pts.length - 1][0];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (y <= y1) {
      if (y1 === y0) return x1;
      return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
  }
  return pts[pts.length - 1][0];
}

// ------------------------------------------------------------------ girdi

export interface BufferInput {
  /** Kontrol kimliklerinin öneki (`trolley`, `bridge`, …) */
  which: string;
  /** Seçilen tampon tipi */
  type: BufferType;
  /** Gerçekleşen anma yürüyüş hızı [m/dak] */
  nominalSpeedMpm: number;
  /** Çarpma hızı oranı k (v_ç = v/60 · k) */
  impactSpeedRatio: number;
  /** BİR tampona gelen çarpışan kütle [t] */
  massPerBufferT: number;
  /** Aynı anda temas eden tampon adedi (gösterim + tahrik payı) */
  bufferCount: number;
  /** Tahrik gücü — tampon sıkışırken itmeye devam eden toplam güç [kW] */
  drivePowerTotalKw: number;
  /**
   * Hidrolik tamponun tam stroğu veya elastomer tamponun izinli toplam
   * sıkışma yolu [mm]. Elastomer eğrileri, `maxCompressionPct` ile tam gövde
   * yüksekliğine geri ölçeklenir.
   */
  strokeMm: number;
  /** Katalog enerji yutma kapasitesi W_max [kJ] */
  catalogEnergyKj: number;
  /** Katalog azami son kuvveti [kN] */
  catalogMaxForceKn: number;
  /** Katalog kısma iğnesi tasarım kütlesi sınıfı tavanı [t] — 0 ise kontrol edilmez */
  catalogDesignMassMaxT: number;
  /** Kauçuk: enerji–sıkışma eğrisi [[%, J], …] */
  energyCurve?: readonly CurvePoint[];
  /** Kauçuk: kuvvet–sıkışma eğrisi [[%, kN], …] */
  forceCurve?: readonly CurvePoint[];
  /** Kauçuk/hücresel: izin verilen azami sıkışma [%] */
  maxCompressionPct: number;
  /** Yürüyüş sınırına normal işletmede sık ulaşılıyor mu (FEM 7.7.1.2) */
  frequentEndApproach: boolean;
}

export interface BufferValues {
  type: BufferType;
  /** Çarpma hızı [m/s] */
  impactSpeedMps: number;
  /** Anma yürüyüş hızı [m/s] — eşik kontrolünde kullanılır */
  nominalSpeedMps: number;
  /** Tampon başına çarpışan kütle [t] */
  massPerBufferT: number;
  /** Çarpma (kinetik) enerjisi [kJ] */
  impactEnergyKj: number;
  /** Tampon başına tahrik kuvveti [N] */
  driveForcePerBufferN: number;
  /** Toplam tahrik kuvveti [N] */
  totalDriveForceN: number;
  /** Hesapta kullanılan sıkışma yolu f′ [mm] */
  strokeUsedMm: number;
  /** Tahrik enerjisi [kJ] */
  driveEnergyKj: number;
  /** Sönümlenmesi gereken toplam enerji E_a [kJ] */
  totalEnergyKj: number;
  /** Tampon tepki kuvveti [kN] */
  reactionForceKn: number;
  /** Kauçukta gerçekleşen sıkışma [%] — hidrolikte tam strok (100) */
  compressionPct: number;
  /** Ortalama yavaşlama [m/s²] */
  avgDecelerationMps2: number;
  /** Azami yavaşlama [m/s²] */
  maxDecelerationMps2: number;
  /** Tepki yapıya aktarılıyor mu (FEM Kitapçık 9 md. 9.4.2) */
  transferredToStructure: boolean;
  /** Hesap yapılabildi mi (tip "yok" ya da eğri verisi eksikse false) */
  computed: boolean;
}

export interface BufferResult {
  values: BufferValues;
  cells: Record<string, number | string>;
  checks: AnyCheck[];
}

// ------------------------------------------------------------------ hesap

/** Sıfır/negatif/NaN'a karşı güvenli pozitif okuma. */
const pos = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Kauçuk tamponda enerji dengesinin ITERATİF çözümü.
 *
 * Kauçuk yay karakteristiği DOĞRUSAL DEĞİLDİR: kapalı formül kullanılamaz.
 * Tahrik enerjisi sıkışma yoluna bağlı olduğundan (E_pot = F0 · f′) hesap
 * döngüseldir ve şöyle yakınsatılır:
 *   1. f′ = 0 kabulüyle E_a = E_kin
 *   2. enerji eğrisinden E_a'ya karşılık gelen sıkışma yüzdesi okunur
 *   3. f′ = % · h / 100 ile tahrik enerjisi güncellenir
 *   4. 2–3 tekrarlanır (2–3 tur içinde yakınsar)
 */
function solveRubberCompression(
  energyCurve: readonly CurvePoint[],
  impactEnergyKj: number,
  driveForceN: number,
  heightMm: number
): {
  compressionPct: number;
  totalEnergyKj: number;
  strokeUsedMm: number;
  /** Gereken enerji eğrinin ÖLÇÜLMÜŞ tepesini aşıyor mu */
  beyondCurve: boolean;
} {
  const topEnergyJ = energyCurve[energyCurve.length - 1][1];
  let pct = 0;
  let totalKj = impactEnergyKj;
  let strokeMm = 0;
  for (let i = 0; i < 8; i++) {
    const next = inverseCurve(energyCurve, totalKj * 1000) ?? 0;
    const nextStroke = (next / 100) * heightMm;
    const nextTotal = impactEnergyKj + (driveForceN * (nextStroke / 1000)) / 1000;
    const converged = Math.abs(next - pct) < 1e-6 && Math.abs(nextTotal - totalKj) < 1e-9;
    pct = next;
    strokeMm = nextStroke;
    totalKj = nextTotal;
    if (converged) break;
  }
  // Eğrinin tepesinin ÖTESİ ölçülmemiş bölgedir: enterpolasyon orada son
  // noktada kelepçelenir. Kelepçelenmiş bir sıkışma "sınır sağlandı" gibi
  // görünmemelidir — durum ayrıca işaretlenir.
  return {
    compressionPct: pct,
    totalEnergyKj: totalKj,
    strokeUsedMm: strokeMm,
    beyondCurve: totalKj * 1000 > topEnergyJ * (1 + 1e-9),
  };
}

/**
 * Tampon hesabı. `cells` anahtarları `buffer.<büyüklük>` biçimindedir ve
 * doğrudan yürütme modülünün hücre haritasına yazılır.
 */
export function computeBuffer(inp: BufferInput): BufferResult {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];
  const set = (key: string, value: number | string) => {
    cells[key] = value;
  };
  const id = (suffix: string) => `${inp.which}.${suffix}`;

  const nominalSpeedMps = pos(inp.nominalSpeedMpm) / 60;
  const ratio = Number.isFinite(inp.impactSpeedRatio) && inp.impactSpeedRatio > 0
    ? inp.impactSpeedRatio
    : FEM_IMPACT_SPEED_RATIO;
  const impactSpeedMps = nominalSpeedMps * ratio;
  const massPerBufferT = pos(inp.massPerBufferT);
  const strokeMm = pos(inp.strokeMm);

  set("buffer.impactSpeedRatio", ratio);
  set("buffer.impactSpeed", impactSpeedMps);
  set("buffer.collisionLoad", massPerBufferT);

  // 1) Çarpma (kinetik) enerjisi. t · (m/s)² = kJ — birim dönüşümü gerekmez.
  const impactEnergyKj = 0.5 * massPerBufferT * impactSpeedMps ** 2;
  set("buffer.impactEnergy", impactEnergyKj);

  // 2) Tahrik kuvveti. Tampon sıkışırken tahrik itmeye DEVAM eder.
  //    F0 = P[W] / v[m/s]. Bu, çıkış momentinin teker yarıçapına bölümüyle
  //    ÖZDEŞTİR (T_çıkış / r); eski hesap tablosu momenti (Nm) doğrudan kuvvet
  //    (N) yerine kullanıyordu — yani teker yarıçapını örtük olarak 1 m
  //    alıyordu. Bu birim hatası burada düzeltilmiştir.
  const bufferCount = Math.max(1, Math.round(pos(inp.bufferCount) || 2));
  const drivePowerW = pos(inp.drivePowerTotalKw) * 1000;
  const totalDriveForceN = nominalSpeedMps > 0 ? drivePowerW / nominalSpeedMps : 0;
  const driveForcePerBufferN = totalDriveForceN / bufferCount;
  set("buffer.totalDriveForce", totalDriveForceN);
  set("buffer.driveForcePerBuffer", driveForcePerBufferN);

  // Tampon tepkisinin yapıya aktarılıp aktarılmadığı (FEM Kitapçık 9 md. 9.4.2)
  const transferred = nominalSpeedMps > BUFFER_SPEED_THRESHOLD_MPS;
  set("buffer.speedThreshold", BUFFER_SPEED_THRESHOLD_MPS);
  checks.push({
    id: id("buffer.speedThreshold"),
    label: transferred
      ? "Tampon Tepkisi Yapıya Aktarılır (v > 0,4 m/s)"
      : "Tampon Tepkisi Yapıya Aktarılmaz (v ≤ 0,4 m/s)",
    required: BUFFER_SPEED_THRESHOLD_MPS,
    provided: nominalSpeedMps,
    unit: "m/s",
    op: ">=",
    computedSide: "provided",
    // Bilgilendirme kontrolü: hiçbir tasarımı reddetmez, yalnız tampon
    // tepkisinin yapı hesabına girip girmediğini raporda görünür kılar.
    pass: true,
    standard: "FEM 1.001 9.4.2",
    kind: "bilgi",
    severity: "uyari",
  });

  // Tip "yok": tampon hesabı koşmaz, sessiz kalmaz. Hücre anahtarları yine
  // üretilir (sıfır değerle) — böylece varyantlar arasında anahtar kümesi ve
  // rapor iskeleti sabit kalır.
  if (inp.type === "yok") {
    // Tampon yoksa çarpma ve tahrik büyüklükleri de RAPORLANMAZ: hücreler
    // sıfırlanır ki `values` ile `cells` aynı şeyi söylesin.
    set("buffer.impactEnergy", 0);
    set("buffer.totalDriveForce", 0);
    set("buffer.driveForcePerBuffer", 0);
    set("buffer.strokeUsed", 0);
    set("buffer.driveEnergy", 0);
    set("buffer.totalEnergy", 0);
    set("buffer.reactionForce", 0);
    set("buffer.compression", 0);
    set("buffer.avgDeceleration", 0);
    set("buffer.maxDeceleration", 0);
    set("buffer.decelerationLimit", inp.frequentEndApproach
      ? DECELERATION_LIMIT_FREQUENT_MPS2
      : DECELERATION_LIMIT_MPS2);
    set("buffer.designMass", massPerBufferT);
    checks.push({
      id: id("buffer.scope"),
      label: "Tampon Seçilmedi — Bu Grupta Tampon Hesabı Yapılmadı",
      required: 0,
      provided: 0,
      unit: "-",
      op: ">=",
      computedSide: "provided",
      pass: true,
      kind: "bilgi",
      severity: "uyari",
    });
    return {
      values: {
        type: inp.type,
        impactSpeedMps,
        nominalSpeedMps,
        massPerBufferT,
        impactEnergyKj: 0,
        driveForcePerBufferN: 0,
        totalDriveForceN: 0,
        strokeUsedMm: 0,
        driveEnergyKj: 0,
        totalEnergyKj: 0,
        reactionForceKn: 0,
        compressionPct: 0,
        avgDecelerationMps2: 0,
        maxDecelerationMps2: 0,
        transferredToStructure: false,
        computed: false,
      },
      cells,
      checks,
    };
  }

  // 3) Sıkışma yolu, toplam enerji ve tepki kuvveti — tipe göre dallanır.
  let strokeUsedMm: number;
  let totalEnergyKj: number;
  let compressionPct: number;
  let reactionForceKn: number;
  let computed = true;
  /** Kauçukta gereken enerji katalog eğrisinin tepesini aşıyor mu */
  let beyondCurve = false;

  const curveDriven = inp.type === "kaucuk" || inp.type === "hucresel";
  if (curveDriven) {
    const cellularFallback = inp.type === "hucresel"
      ? cellularCurvesFromCatalog({
          strokeMm,
          maxCompressionPct: inp.maxCompressionPct,
          catalogEnergyKj: inp.catalogEnergyKj,
          catalogMaxForceKn: inp.catalogMaxForceKn,
        })
      : undefined;
    const energyCurve = cleanCurve(inp.energyCurve ?? cellularFallback?.energyCurve);
    const forceCurve = cleanCurve(inp.forceCurve ?? cellularFallback?.forceCurve);
    const elasticHeightMm = inp.maxCompressionPct > 0
      ? (strokeMm * 100) / inp.maxCompressionPct
      : strokeMm;
    if (energyCurve.length < 2 || forceCurve.length < 2 || elasticHeightMm <= 0) {
      // EĞRİ YOK → hesap SESSİZCE YAPILMAZ. Kauçuk/hücresel tampon doğrusal
      // olmadığı için kapalı formülle "yaklaşık" bir sayı üretmek yanıltıcı olur.
      computed = false;
      strokeUsedMm = 0;
      totalEnergyKj = impactEnergyKj;
      compressionPct = 0;
      reactionForceKn = 0;
      checks.push({
        id: id("buffer.scope"),
        label: inp.type === "hucresel"
          ? "Hücresel Tampon Yük Diyagramı Yok — Sıkışma ve Kuvvet Hesaplanmadı"
          : "Kauçuk Tampon Yük Diyagramı Yok — Sıkışma ve Kuvvet Hesaplanmadı",
        required: 0,
        provided: 0,
        unit: "-",
        op: ">=",
        computedSide: "provided",
        pass: true,
        kind: "bilgi",
        severity: "uyari",
      });
    } else {
      const solved = solveRubberCompression(
        energyCurve,
        impactEnergyKj,
        driveForcePerBufferN,
        elasticHeightMm
      );
      compressionPct = solved.compressionPct;
      totalEnergyKj = solved.totalEnergyKj;
      strokeUsedMm = solved.strokeUsedMm;
      beyondCurve = solved.beyondCurve;
      // Kuvvet AYNI sıkışma yüzdesinden okunur. Eğrinin verdiği kuvvet,
      // tamponun hareketli kütleye karşı direnç kuvvetidir; tahrik kuvveti
      // buna EKLENMEZ. Tahrik etkisi zaten enerji denkleminde F₀·f′ olarak
      // sıkışma ihtiyacına dahil edilmiştir.
      const curveForceKn = interpolateCurve(forceCurve, compressionPct) ?? 0;
      reactionForceKn = curveForceKn;
    }
  } else {
    // HİDROLİK (SIBRE SP): sabit kuvvetli sönümleme — tam strok kullanılır.
    strokeUsedMm = strokeMm;
    const driveEnergy = (driveForcePerBufferN * (strokeUsedMm / 1000)) / 1000;
    totalEnergyKj = impactEnergyKj + driveEnergy;
    compressionPct = 100;
    const strokeM = strokeUsedMm / 1000;
    reactionForceKn =
      strokeM > 0
        ? totalEnergyKj / (strokeM * HYDRAULIC_DAMPING_EFFICIENCY)
        : 0;
  }

  const driveEnergyKj = totalEnergyKj - impactEnergyKj;
  set("buffer.strokeUsed", strokeUsedMm);
  set("buffer.driveEnergy", driveEnergyKj);
  set("buffer.totalEnergy", totalEnergyKj);
  set("buffer.reactionForce", reactionForceKn);
  set("buffer.compression", compressionPct);

  // 4) Yavaşlama (FEM 1.001 md. 7.7.1.2)
  //
  // ORTALAMA yavaşlama saf kinematiktir: kütle v_ç hızından f′ yolunda durur.
  // AZAMİ yavaşlama, tamponun TEPE KUVVETİNDEN çıkar. `reactionForceKn`,
  // tamponun yapıya aktardığı gerçek direnç kuvvetidir. Tahrik kuvveti F₀
  // hareket yönünde kaldığından net yavaşlatan kuvvet F_tampon − F₀'dır.
  // F₀, enerji denklemine zaten ek iş olarak girmiştir; burada bir kez daha
  // net kuvvetten düşülmesi gerekir. Önceki uygulama F₀'ı hem katalog
  // kuvvetine ekliyor hem de ivme hesabında düşmüyordu; özellikle araba
  // tamponunda yavaşlama gereğinden büyük çıkıyordu.
  const strokeUsedM = strokeUsedMm / 1000;
  const avgDecel = strokeUsedM > 0 ? impactSpeedMps ** 2 / (2 * strokeUsedM) : 0;
  const massPerBufferKg = massPerBufferT * 1000;
  const netDeceleratingForceN = Math.max(
    0,
    reactionForceKn * 1000 - driveForcePerBufferN
  );
  const maxDecel = massPerBufferKg > 0 ? netDeceleratingForceN / massPerBufferKg : 0;
  set("buffer.avgDeceleration", avgDecel);
  set("buffer.maxDeceleration", maxDecel);

  const decelLimit = inp.frequentEndApproach
    ? DECELERATION_LIMIT_FREQUENT_MPS2
    : DECELERATION_LIMIT_MPS2;
  set("buffer.decelerationLimit", decelLimit);

  // 5) Kontroller
  if (computed) {
    checks.push({
      id: id("buffer.energy"),
      label: "Tampon Enerji Kapasitesi",
      required: totalEnergyKj,
      provided: inp.catalogEnergyKj,
      unit: "kJ",
      op: ">=",
      computedSide: "required",
      pass: inp.catalogEnergyKj >= totalEnergyKj,
      standard: "FEM 1.001 2.2.3.4.1",
      kind: "standart",
      severity: "engelleyici",
    });
    checks.push({
      id: id("buffer.load"),
      label:
        inp.type === "hidrolik"
          ? "Tampon Azami Son Kuvveti"
          : "Tampon Yük Kapasitesi",
      required: reactionForceKn,
      provided: inp.catalogMaxForceKn,
      unit: "kN",
      op: ">=",
      computedSide: "required",
      pass: inp.catalogMaxForceKn >= reactionForceKn,
      // İki taraf da katalogdan gelir; sınır üreticinin son kuvvet sınırıdır.
      kind: "uretici",
      severity: "engelleyici",
    });
    checks.push({
      id: id("buffer.deceleration"),
      label: "Tampon Yavaşlaması",
      required: Math.max(avgDecel, maxDecel),
      provided: decelLimit,
      unit: "m/s²",
      op: ">=",
      computedSide: "required",
      pass: decelLimit >= Math.max(avgDecel, maxDecel),
      standard: "FEM 1.001 7.7.1.2",
      kind: "standart",
      severity: "engelleyici",
    });
  }

  if (curveDriven && computed && pos(inp.maxCompressionPct) > 0) {
    checks.push({
      id: id("buffer.compression"),
      label: beyondCurve
        ? "Tampon Sıkışma Oranı (gereken enerji katalog eğrisinin ötesinde)"
        : "Tampon Sıkışma Oranı",
      required: compressionPct,
      provided: inp.maxCompressionPct,
      unit: "%",
      op: ">=",
      computedSide: "required",
      // Eğrinin tepesi aşıldığında sıkışma yüzdesi KELEPÇELENMİŞTİR; gerçek
      // sıkışma daha büyüktür ve ölçülmemiştir → kontrol sağlanmış sayılmaz.
      pass: !beyondCurve && inp.maxCompressionPct >= compressionPct,
      kind: "uretici",
      severity: "engelleyici",
    });
  }

  // Tasarım kütlesi her tipte yayımlanır (rapor iskeleti sabit kalsın);
  // kısma iğnesi kontrolü yalnız hidrolikte anlamlıdır.
  set("buffer.designMass", massPerBufferT);
  if (inp.type === "hidrolik") {
    if (pos(inp.catalogDesignMassMaxT) > 0) {
      // SIBRE kısma iğnesi (metering pin) tasarım kütlesi sınıfından seçilir;
      // hesaplanan tampon başına kütle sınıf tavanını aşamaz.
      checks.push({
        id: id("buffer.designMass"),
        label: "Kısma İğnesi Tasarım Kütlesi Sınıfı",
        required: massPerBufferT,
        provided: inp.catalogDesignMassMaxT,
        unit: "t",
        op: ">=",
        computedSide: "required",
        pass: inp.catalogDesignMassMaxT >= massPerBufferT,
        kind: "uretici",
        severity: "engelleyici",
      });
    }
  }

  return {
    values: {
      type: inp.type,
      impactSpeedMps,
      nominalSpeedMps,
      massPerBufferT,
      impactEnergyKj,
      driveForcePerBufferN,
      totalDriveForceN,
      strokeUsedMm,
      driveEnergyKj,
      totalEnergyKj,
      reactionForceKn,
      compressionPct,
      avgDecelerationMps2: avgDecel,
      maxDecelerationMps2: maxDecel,
      transferredToStructure: transferred,
      computed,
    },
    cells,
    checks,
  };
}

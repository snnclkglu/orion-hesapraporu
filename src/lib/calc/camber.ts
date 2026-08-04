// Ana kiriş sehim eğrisi ve TERS SEHİM (kamber) — saf hesap kütüphanesi.
//
// Üç ayrı büyüklük vardır, birbirine karıştırılmamalıdır:
//
//   1. SEHİM (canlı yük sehimi) — yalnız hareketli yükün (araba + nominal
//      kaldırma yükü) oluşturduğu aşağı yöndeki çökme. Darbe/dinamik katsayı
//      GİRMEZ. FEM/CMAA kullanılabilirlik sınırı bu değere uygulanır
//      (δ ≤ L/1000 → L/δ ≥ 1000).
//
//   2. KESİMDE VERİSİ (imalat kamberi) — kiriş sacları kesilirken verilecek
//      yukarı yöndeki ters sehim. CMAA 70 md. 3.5.5.2: kutu kirişler ölü yük
//      sehimi + canlı yük sehiminin YARISI kadar kamberlenir.
//         kamber(x) = δ_ölü(x) + δ_canlı(x) / 2
//
//   3. MESNETTE VERİSİ (imalat kontrolü) — kiriş üretilip iki ucundan sehpaya
//      alındığında kendi ağırlığıyla çöktükten SONRA ölçülmesi beklenen ters
//      sehim. Kesimde verisinden ölü yük sehimi düşülür:
//         mesnette(x) = kamber(x) − δ_ölü(x) = δ_canlı(x) / 2
//      Atölye bu değeri ölçerek kirişin doğru üretildiğini doğrular.
//
// Her üçü de yalnız orta noktada değil, PERDE (diyafram) aralıklarında ayrı
// ayrı verilir: imalat şeridi ortadan başlayıp sağa ve sola doğru her perde
// aralığında bir kot taşır (bkz. atölye kamber şeridi çizimi).
//
// Birimler: girdiler kg, cm, kg/cm² (motorun iç birimleri); dönen sehim
// değerleri mm'dir — vinç pratiğinde sehim milimetre ile konuşulur.

/** Basit kirişin yük durumu — tüm uzunluklar cm, yükler kg. */
export interface CamberBeam {
  /** Açıklık L (teker ekseninden teker eksenine) [cm] */
  spanCm: number;
  /** Yayılı ölü yük w (kirişin kendi ağırlığı + üstündeki sabit yükler) [kg/cm] */
  deadLoadPerCm: number;
  /** Araba tekerlek yükü (bir teker) [kg] — kiriş üzerinde iki adet */
  wheelLoadKg: number;
  /** İki araba tekerleği arası mesafe (dingil açıklığı) [cm] */
  wheelSpacingCm: number;
  /** Elastisite modülü E [kg/cm²] */
  elasticModulus: number;
  /** Atalet momenti Iyy [cm⁴] */
  inertiaCm4: number;
}

/**
 * Düzgün yayılı yük altında basit kirişin x noktasındaki sehimi [cm].
 *
 *     δ(x) = w·x·(L³ − 2·L·x² + x³) / (24·E·I)
 *
 * Açıklık ortasında klasik 5wL⁴/(384EI) değerine indirgenir.
 */
export function udlDeflectionCm(
  w: number, spanCm: number, xCm: number, eiKgCm2: number
): number {
  if (!(eiKgCm2 > 0) || !(spanCm > 0)) return 0;
  const L = spanCm;
  const x = Math.min(Math.max(xCm, 0), L);
  return (w * x * (L ** 3 - 2 * L * x ** 2 + x ** 3)) / (24 * eiKgCm2);
}

/**
 * Sol mesnetten `aCm` uzaklıktaki TEKİL yük altında x noktasındaki sehim [cm].
 *
 *     x ≤ a :  δ(x) = P·b·x·(L² − b² − x²) / (6·L·E·I)      (b = L − a)
 *     x > a :  aynı bağıntı sağdan bakılarak (aynadan) uygulanır
 *
 * Açıklık ortasındaki tekil yük için PL³/(48EI) değerine indirgenir.
 */
export function pointLoadDeflectionCm(
  pKg: number, aCm: number, spanCm: number, xCm: number, eiKgCm2: number
): number {
  if (!(eiKgCm2 > 0) || !(spanCm > 0)) return 0;
  const L = spanCm;
  const a = Math.min(Math.max(aCm, 0), L);
  const x = Math.min(Math.max(xCm, 0), L);
  if (x <= a) {
    const b = L - a;
    return (pKg * b * x * (L ** 2 - b ** 2 - x ** 2)) / (6 * L * eiKgCm2);
  }
  // Aynadan: sağ mesnetten ölç, yükün sağ mesnete uzaklığı (L − a)
  const xr = L - x;
  return (pKg * a * xr * (L ** 2 - a ** 2 - xr ** 2)) / (6 * L * eiKgCm2);
}

/** Bir istasyondaki (perde noktasındaki) sehim/kamber kotları — hepsi mm. */
export interface CamberStation {
  /** Sol mesnetten (sol teker ekseninden) uzaklık [mm] */
  xMm: number;
  /** Açıklık ortasından işaretli uzaklık [mm] — sol taraf negatif */
  fromCenterMm: number;
  /** Canlı yük sehimi (araba + nominal yük), aşağı pozitif [mm] */
  liveMm: number;
  /** Ölü yük sehimi (kirişin kendi ağırlığı), aşağı pozitif [mm] */
  deadMm: number;
  /** KESİMDE verilecek ters sehim = ölü + canlı/2 [mm] */
  cuttingMm: number;
  /** MESNETTE ölçülecek ters sehim = canlı/2 [mm] */
  supportedMm: number;
}

/**
 * Bir sayfaya/şeride sığacak en çok istasyon sayısı. Perde aralığı çok küçükse
 * (ör. 17,5 m açıklıkta 500 mm) tablo okunmaz hâle gelir; adım katlanarak
 * seyreltilir ve `spacingUsedMm` gerçekte kullanılan adımı bildirir.
 */
const MAX_STATIONS = 41;

export interface CamberProfile {
  stations: CamberStation[];
  /** Tabloda gerçekten kullanılan istasyon adımı [mm] */
  spacingUsedMm: number;
  /** Perde aralığı seyreltildi mi (adım katına çıkarıldı mı) */
  thinned: boolean;
  /** Açıklık ortası değerleri — hızlı erişim */
  mid: CamberStation;
}

/**
 * Ortadan başlayıp sağa ve sola perde aralığınca ilerleyen istasyon listesi.
 * Uçlara mesnet noktaları (x = 0 ve x = L) her hâlükârda eklenir; oralarda
 * sehim de kamber de sıfırdır.
 */
function stationXs(spanMm: number, spacingMm: number): { xs: number[]; step: number; thinned: boolean } {
  const half = spanMm / 2;
  const base = spacingMm > 0 && Number.isFinite(spacingMm) ? spacingMm : half;
  // Kaç adım sığıyor? (mesnetin kendisi ayrıca eklenir)
  const stepsFor = (s: number) => Math.max(0, Math.floor((half - 1) / s));
  let step = base;
  let thinned = false;
  while (2 * stepsFor(step) + 3 > MAX_STATIONS) {
    step += base;
    thinned = true;
  }
  const k = stepsFor(step);
  const xs: number[] = [0];
  for (let i = k; i >= 1; i--) xs.push(half - i * step);
  xs.push(half);
  for (let i = 1; i <= k; i++) xs.push(half + i * step);
  xs.push(spanMm);
  return { xs, step, thinned };
}

/**
 * Perde aralıklarında sehim ve ters sehim kotlarını üretir.
 *
 * Araba açıklık ORTASINDA kabul edilir (en elverişsiz konum): iki tekerlek
 * ortaya göre simetrik, aralarında dingil açıklığı kadar mesafe vardır.
 */
export function camberProfile(
  beam: CamberBeam,
  diaphragmSpacingMm: number
): CamberProfile {
  const spanCm = beam.spanCm;
  const spanMm = spanCm * 10;
  const ei = beam.elasticModulus * beam.inertiaCm4;
  // Tekerlek konumları: ortadan ± yarım dingil açıklığı
  const a1 = spanCm / 2 - beam.wheelSpacingCm / 2;
  const a2 = spanCm / 2 + beam.wheelSpacingCm / 2;

  const { xs, step, thinned } = stationXs(spanMm, diaphragmSpacingMm);
  const stations: CamberStation[] = xs.map((xMm) => {
    const xCm = xMm / 10;
    const live =
      pointLoadDeflectionCm(beam.wheelLoadKg, a1, spanCm, xCm, ei) +
      pointLoadDeflectionCm(beam.wheelLoadKg, a2, spanCm, xCm, ei);
    const dead = udlDeflectionCm(beam.deadLoadPerCm, spanCm, xCm, ei);
    const liveMm = live * 10;
    const deadMm = dead * 10;
    return {
      xMm,
      fromCenterMm: xMm - spanMm / 2,
      liveMm,
      deadMm,
      // CMAA 70 3.5.5.2 — ölü yük sehimi + canlı yük sehiminin yarısı
      cuttingMm: deadMm + liveMm / 2,
      supportedMm: liveMm / 2,
    };
  });
  const mid =
    stations.find((s) => s.fromCenterMm === 0) ?? stations[Math.floor(stations.length / 2)];
  return { stations, spacingUsedMm: step, thinned, mid };
}

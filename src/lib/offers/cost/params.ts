// MALİYET MODELİNİN KATSAYILARI VE MÜHENDİSLİK TABLOLARI.
//
// KAYNAK FİRMANIN KENDİ MALİYET ÇALIŞMASIDIR, bir standart değil — ve bu,
// AGENTS.md'deki "Excel'e bakarak kod yazma" değişmezinin İSTİSNASI DEĞİL,
// KAPSAMI DIŞIDIR. O kural HESAP MOTORU içindir (`lib/calc`): bir vincin
// FEM/DIN'e göre yeterli olup olmadığı bir tabloya değil standardın maddesine
// dayanır. Burada sorulan soru başkadır: "bu vinç kaç kilo gelir ve bize kaça
// mal olur." Bunun kaynağı ancak firmanın kendi imalat geçmişidir.
//
// MODEL BİR TAHMİNDİR, BİR HESAP DEĞİLDİR (MALIYET-3). Buradan çıkan hiçbir
// sayı bir hesap raporuna girmez, bir kesit onaylamaz, bir motoru yeterli
// ilan etmez. Teklif aşamasında vincin tasarımı henüz yoktur; maliyet o
// tasarımı BEKLEMEDEN fiyat verebilmek içindir.
//
// FİYAT TABLOSU YOKTUR (kullanıcı kararı, 17.08.2026: *"maliyetlerin sabit
// tablo belli tablolar olması devre dışı; geri kalan hesap modeli yapısı
// ağırlık modeli yapısı kullanılabilir"*). Devralınan çalışma kitabındaki
// motor €, redüktör €, teker paketi €, sürücü € ve kapasite skalaları BUNA
// GÖRE ALINMADI; yalnız AĞIRLIK ve BOYUTLANDIRMA sütunları taşındı. Birim
// fiyatı her maliyet satırında insan yazar.

// ————————————————————————————————————————————————————————— sınıf

export const CRANE_CLASSES = ["M3", "M4", "M5", "M6", "M7", "M8"] as const;
export type CraneClass = (typeof CRANE_CLASSES)[number];

export const DEFAULT_CRANE_CLASS: CraneClass = "M5";

/** Mekanizma boyutlandırma emniyet katsayısı (tambur momenti × katsayı). */
export const CLASS_SAFETY: Record<CraneClass, number> = {
  M3: 1, M4: 1.05, M5: 1.1, M6: 1.3, M7: 1.7, M8: 2,
};

/** Mekanizma/ekipman ağırlıkları sınıfla büyür. */
export const CLASS_WEIGHT: Record<CraneClass, number> = {
  M3: 1, M4: 1, M5: 1, M6: 1.15, M7: 1.25, M8: 1.35,
};

/** Sehim limiti (L/x) — sınıf arttıkça daha rijit kiriş istenir. */
export const CLASS_DEFLECTION: Record<CraneClass, number> = {
  M3: 1000, M4: 1000, M5: 1000, M6: 1100, M7: 1300, M8: 1500,
};

/** Yürütme hesap gücü × katsayı (araba ve köprü). */
export const CLASS_TRAVEL_POWER: Record<CraneClass, number> = {
  M3: 1, M4: 1, M5: 1, M6: 1.2, M7: 1.4, M8: 1.6,
};

/** Kiriş kg/m (perde + ray dahil) × katsayı. */
export const CLASS_GIRDER_KGM: Record<CraneClass, number> = {
  M3: 1, M4: 1, M5: 1, M6: 1.05, M7: 1.1, M8: 1.15,
};

/**
 * FEM grubu (`1Am`/`2m`/`3m`…) ya da serbest metinden SINIF okur.
 *
 * Teklifte vinç sınıfı `val.craneClass` listesinden gelir ve yazımı belgeden
 * belgeye değişir ("FEM 3m", "M6 / A6", "ISO M5"). Okunamayan bir metinden
 * sınıf UYDURULMAZ (değişmez md. 4): `null` döner ve çağıran varsayılana
 * düşerken bunu ekranda söyler.
 */
export function craneClassFrom(text: string | null | undefined): CraneClass | null {
  const s = (text ?? "").toUpperCase();
  const m = s.match(/\bM\s*([3-8])\b/);
  if (m) return `M${m[1]}` as CraneClass;
  // FEM grubu → ISO sınıfı: 1Am→M5, 2m→M6, 3m→M6, 4m→M7 (devralınan çalışma
  // kitabındaki eşleme; kaynağı firmanın kendi kullanımıdır).
  const fem = s.match(/\b([1-5])\s*A?M\b/);
  if (fem) {
    const n = Number(fem[1]);
    return n <= 1 ? "M5" : n <= 3 ? "M6" : "M7";
  }
  return null;
}

/** Ortam sıcaklığı → motor gücü artırım katsayısı (ilk ≥ eşleşmesi). */
export const TEMP_FACTORS: readonly { maxC: number; factor: number }[] = [
  { maxC: 40, factor: 1 },
  { maxC: 50, factor: 1.1 },
  { maxC: 60, factor: 1.15 },
  { maxC: 70, factor: 1.2 },
  { maxC: 80, factor: 1.25 },
];

// ——————————————————————————————————————————————————— katalog serileri

/**
 * TEKER GRUBU — çift flanşlı, 4140 ıslah, 40-45 HRC.
 * `groupKg` DÖRT tekerin grup ağırlığıdır (mil, yatak, gövde dahil).
 */
export const WHEEL_TABLE: readonly { diaMm: number; maxLoadT: number; groupKg: number }[] = [
  { diaMm: 120, maxLoadT: 1.8, groupKg: 60 },
  { diaMm: 160, maxLoadT: 4, groupKg: 100 },
  { diaMm: 200, maxLoadT: 7, groupKg: 160 },
  { diaMm: 250, maxLoadT: 9, groupKg: 280 },
  { diaMm: 315, maxLoadT: 11, groupKg: 580 },
  { diaMm: 400, maxLoadT: 16, groupKg: 850 },
  { diaMm: 500, maxLoadT: 24, groupKg: 1250 },
  { diaMm: 630, maxLoadT: 34, groupKg: 1850 },
  { diaMm: 710, maxLoadT: 45, groupKg: 2600 },
  { diaMm: 800, maxLoadT: 56, groupKg: 3600 },
  { diaMm: 900, maxLoadT: 70, groupKg: 4800 },
];

/**
 * TAMBUR — grup kapasitesine göre çap ve kaldırma yüksekliğine göre ağırlık.
 * Ağırlıklar boru kesitinden türetilmiştir (iç çap = Ø×0,8, ×7850 kg/m³, flanş
 * ve yiv payı ×1,3).
 */
export const DRUM_TABLE: readonly {
  capT: number; diaMm: number; kg10: number; kg15: number; kg20: number; kg25: number; kg30: number;
}[] = [
  { capT: 1, diaMm: 160, kg10: 37, kg15: 46, kg20: 56, kg25: 65, kg30: 74 },
  { capT: 2, diaMm: 180, kg10: 54, kg15: 68, kg20: 81, kg25: 94, kg30: 108 },
  { capT: 5, diaMm: 200, kg10: 92, kg15: 115, kg20: 138, kg25: 161, kg30: 184 },
  { capT: 7.5, diaMm: 225, kg10: 124, kg15: 155, kg20: 186, kg25: 217, kg30: 248 },
  { capT: 10, diaMm: 250, kg10: 180, kg15: 225, kg20: 270, kg25: 315, kg30: 360 },
  { capT: 12, diaMm: 275, kg10: 240, kg15: 300, kg20: 360, kg25: 420, kg30: 480 },
  { capT: 16, diaMm: 300, kg10: 338, kg15: 422, kg20: 507, kg25: 592, kg30: 676 },
  { capT: 20, diaMm: 325, kg10: 457, kg15: 571, kg20: 686, kg25: 800, kg30: 914 },
  { capT: 25, diaMm: 350, kg10: 574, kg15: 718, kg20: 861, kg25: 1004, kg30: 1148 },
  { capT: 30, diaMm: 400, kg10: 808, kg15: 1010, kg20: 1212, kg25: 1414, kg30: 1616 },
  { capT: 40, diaMm: 450, kg10: 1168, kg15: 1460, kg20: 1752, kg25: 2044, kg30: 2336 },
  { capT: 50, diaMm: 500, kg10: 1600, kg15: 2000, kg20: 2400, kg25: 2800, kg30: 3200 },
  { capT: 60, diaMm: 560, kg10: 2100, kg15: 2625, kg20: 3150, kg25: 3675, kg30: 4200 },
  { capT: 80, diaMm: 630, kg10: 2900, kg15: 3625, kg20: 4350, kg25: 5075, kg30: 5800 },
  { capT: 100, diaMm: 710, kg10: 3800, kg15: 4750, kg20: 5700, kg25: 6650, kg30: 7600 },
];

/** ARABA ŞASİSİ — kapalı kutu tip; 10 m üzeri her 10 m için ek ağırlık. */
export const FRAME_TABLE: readonly { capT: number; kg10: number; addPer10m: number }[] = [
  { capT: 1, kg10: 100, addPer10m: 50 },
  { capT: 2, kg10: 150, addPer10m: 80 },
  { capT: 5, kg10: 250, addPer10m: 150 },
  { capT: 10, kg10: 700, addPer10m: 200 },
  { capT: 20, kg10: 1100, addPer10m: 300 },
  { capT: 30, kg10: 1600, addPer10m: 380 },
  { capT: 50, kg10: 2600, addPer10m: 500 },
  { capT: 60, kg10: 3200, addPer10m: 560 },
  { capT: 100, kg10: 5500, addPer10m: 800 },
];

/** KANCA BLOĞU / TRAVERS — DIN 15401 dövme kanca, travers dahil. */
export const HOOK_BLOCK_TABLE: readonly { capT: number; kg: number }[] = [
  { capT: 1, kg: 40 }, { capT: 2, kg: 70 }, { capT: 5, kg: 150 }, { capT: 10, kg: 350 },
  { capT: 20, kg: 600 }, { capT: 30, kg: 900 }, { capT: 50, kg: 1600 },
  { capT: 60, kg: 2000 }, { capT: 100, kg: 3800 },
];

/**
 * KALDIRMA REDÜKTÖRÜ — final momente göre seçilir (sandık tipi).
 * Seçim İLK ≥ eşleşmesidir, ara değer alınmaz: redüktör bir KATALOG
 * boyudur, ara boy diye bir şey yoktur.
 */
export const GEARBOX_TABLE: readonly { maxNm: number; kg: number }[] = [
  { maxNm: 500, kg: 50 }, { maxNm: 1000, kg: 75 }, { maxNm: 1500, kg: 100 },
  { maxNm: 3000, kg: 150 }, { maxNm: 5000, kg: 210 }, { maxNm: 10000, kg: 330 },
  { maxNm: 15000, kg: 530 }, { maxNm: 19000, kg: 580 }, { maxNm: 24000, kg: 630 },
  { maxNm: 30000, kg: 820 }, { maxNm: 55000, kg: 1300 }, { maxNm: 80000, kg: 2500 },
  { maxNm: 100000, kg: 2900 }, { maxNm: 150000, kg: 4000 }, { maxNm: 200000, kg: 5200 },
];

/** IEC motor güç serisi [kW] — seçim İLK ≥ eşleşmesidir. */
export const MOTOR_KW: readonly number[] = [
  0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22,
  30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250,
];

/** Sürücü güç serisi [kW] — motor serisinden AYRIDIR ve daha kabadır. */
export const DRIVE_KW: readonly number[] = [
  0.75, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110,
  132, 160, 200, 250, 315,
];

/**
 * HALAT DONANIMI (reeving) seçenekleri — kullanıcı listesi (18.08.2026).
 *
 * Model kapasiteye göre 2 · 4 · 8 önerir; makara sayısını artırarak tamburu
 * ve motoru küçültmek MÜHENDİSİN KARARIDIR ve teklif aşamasında sıkça
 * verilir. Bu yüzden alan bir dropdown'dır: öneri otomatik gelir, seçim
 * insanındır ve seçildiği anda halat yükü, tambur momenti, tahvil oranı ve
 * motor gücü onunla birlikte değişir (ezilen değer aşağıya akar, MALIYET-7).
 *
 * SERBEST SAYI DEĞİL, LİSTEDİR: 3 ya da 5 katlı bir donanım yoktur — halat
 * çift taraflı sarılır, kat sayısı çifttir.
 */
export const ROPE_REEVING_CHOICES: readonly number[] = [2, 4, 8, 12, 16, 20];

/** Katalogdaki tambur çapları — elle seçim listesi (ara boy yoktur). */
export const DRUM_DIA_CHOICES: readonly number[] = DRUM_TABLE.map((r) => r.diaMm);

/**
 * Katalogdaki teker çapları.
 *
 * LİSTE OLMASI ZORUNLUDUR: teker grubu ağırlığı (`w.*TravelGroup`) çapı
 * `WHEEL_TABLE`de ARAYARAK bulur; listede olmayan bir çap yazılırsa grup
 * ağırlığı `null` düşer ve toplam ağırlık sessizce eksilirdi.
 */
export const WHEEL_DIA_CHOICES: readonly number[] = WHEEL_TABLE.map((w) => w.diaMm);

/**
 * ANA KİRİŞ KUTU KESİT LİSTESİ — sac ölçüleri; atalet ve birim ağırlık
 * BURADAN HESAPLANIR, tabloya yazılmaz (`sectionProps`). Ölçü değişirse iki
 * sayının elle güncellenmesi gerekmesin diye.
 */
export const SECTION_TABLE: readonly { topMm: number; webMm: number; botMm: number; tMm: number }[] = [
  { topMm: 250, webMm: 500, botMm: 250, tMm: 6 },
  { topMm: 250, webMm: 600, botMm: 250, tMm: 6 },
  { topMm: 300, webMm: 650, botMm: 300, tMm: 6 },
  { topMm: 300, webMm: 700, botMm: 300, tMm: 6 },
  { topMm: 350, webMm: 750, botMm: 350, tMm: 6 },
  { topMm: 350, webMm: 800, botMm: 350, tMm: 6 },
  { topMm: 400, webMm: 900, botMm: 400, tMm: 6 },
  { topMm: 400, webMm: 1000, botMm: 400, tMm: 6 },
  { topMm: 450, webMm: 1000, botMm: 450, tMm: 6 },
  { topMm: 400, webMm: 1100, botMm: 400, tMm: 6 },
  { topMm: 400, webMm: 1200, botMm: 400, tMm: 6 },
  { topMm: 450, webMm: 1100, botMm: 450, tMm: 8 },
  { topMm: 450, webMm: 1200, botMm: 450, tMm: 8 },
  { topMm: 500, webMm: 1200, botMm: 500, tMm: 8 },
  { topMm: 500, webMm: 1300, botMm: 500, tMm: 8 },
  { topMm: 550, webMm: 1400, botMm: 550, tMm: 8 },
  { topMm: 600, webMm: 1500, botMm: 600, tMm: 8 },
  { topMm: 650, webMm: 1600, botMm: 650, tMm: 8 },
  { topMm: 700, webMm: 1700, botMm: 700, tMm: 8 },
  { topMm: 700, webMm: 1800, botMm: 700, tMm: 8 },
  { topMm: 750, webMm: 1900, botMm: 750, tMm: 10 },
  { topMm: 800, webMm: 2000, botMm: 800, tMm: 10 },
  { topMm: 800, webMm: 2100, botMm: 800, tMm: 10 },
  { topMm: 850, webMm: 2200, botMm: 850, tMm: 10 },
  { topMm: 900, webMm: 2300, botMm: 900, tMm: 12 },
  { topMm: 950, webMm: 2400, botMm: 950, tMm: 12 },
  { topMm: 1000, webMm: 2500, botMm: 1000, tMm: 12 },
  { topMm: 1000, webMm: 2600, botMm: 1000, tMm: 14 },
  { topMm: 1100, webMm: 2800, botMm: 1100, tMm: 14 },
  { topMm: 1200, webMm: 3000, botMm: 1200, tMm: 16 },
];

export interface SectionProps {
  name: string;
  /** Kesit alanı [cm²]. */
  areaCm2: number;
  /** Atalet momenti [cm⁴]. */
  inertiaCm4: number;
  /** Sacların metre ağırlığı [kg/m] — perde ve ray HARİÇ. */
  kgPerM: number;
}

/**
 * Kutu kesidin alanı, ataleti ve metre ağırlığı.
 *
 * Atalet iki başlık sacının (Steiner terimiyle) ve iki yan sacın katkısıdır.
 * Diyafram, ray ve aşınma levhası BURAYA GİRMEZ — onlar `girderExtraRatio`
 * ile ayrıca eklenir, çünkü kesit dayanımına değil yalnız ağırlığa katılırlar.
 */
export function sectionProps(
  s: { topMm: number; webMm: number; botMm: number; tMm: number },
  densityFactor: number
): SectionProps {
  const top = s.topMm / 10;
  const bot = s.botMm / 10;
  const web = s.webMm / 10;
  const t = s.tMm / 10;
  const areaCm2 = (top + bot) * t + 2 * web * t;
  const flange = (b: number) => (b * t ** 3) / 12 + b * t * ((web + t) / 2) ** 2;
  const inertiaCm4 = flange(top) + flange(bot) + 2 * ((t * web ** 3) / 12);
  return {
    name: `${s.topMm}x${s.webMm}x${s.botMm} t${s.tMm}`,
    areaCm2,
    inertiaCm4,
    kgPerM: areaCm2 * densityFactor,
  };
}

// ———————————————————————————————————————————————————————— katsayılar

export interface CostParamDef {
  key: string;
  label: string;
  unit: string;
  /** Ekranda hangi başlık altında gösterilecek. */
  group: string;
  value: number;
  hint?: string;
}

/**
 * MODEL KATSAYILARI — açılışta belgeye kopyalanır, sonra BELGENİN malıdır.
 *
 * Devralınan çalışma kitabında her iş için kopya alınıp katsayılar o işe göre
 * ayarlanıyordu ("V3: ayaklar -%10", "başkiriş katsayısı 2 katına"). Model
 * bunu olduğu gibi taşır: global bir defter yapılsaydı, bugün değiştirilen bir
 * katsayı geçmiş bir maliyet çalışmasının rakamını da değiştirirdi.
 */
export const COST_PARAM_DEFS: readonly CostParamDef[] = [
  // —— çelik ve imalat
  { key: "fireRate", label: "Fire Oranı (sac/profil)", unit: "×", group: "Çelik ve İmalat", value: 0.1, hint: "Çelik imalat işçiliği bu oranla artırılır" },
  { key: "steelDensityFactor", label: "Sac Metre Ağırlığı Çarpanı", unit: "kg/m per cm²", group: "Çelik ve İmalat", value: 0.785, hint: "7,85 kg/dm³ — kesit alanı [cm²] × bu sayı = kg/m" },
  { key: "girderExtraRatio", label: "Perde + Ray + Aşınma Levhası Eki", unit: "×", group: "Çelik ve İmalat", value: 0.18, hint: "Kiriş kg/m'ye diyafram, araba rayı ve koruma borusu payı" },
  { key: "girderCorrection", label: "Ana Kiriş Ağırlık Düzeltmesi", unit: "×", group: "Çelik ve İmalat", value: 0.9 },
  { key: "trolleyCorrection", label: "Araba Ağırlık Düzeltmesi", unit: "×", group: "Çelik ve İmalat", value: 0.8 },

  // —— kaldırma mekanizması
  { key: "rope2ThresholdT", label: "2 Halat Eşiği", unit: "ton", group: "Kaldırma", value: 2, hint: "Bu kapasiteye kadar 2 halat" },
  { key: "rope8ThresholdT", label: "8 Halat Eşiği", unit: "ton", group: "Kaldırma", value: 40, hint: "Bu kapasiteye kadar 4 halat, üstü 8" },
  { key: "hookBlockLoadAdd", label: "Kanca Bloğu Yük Eki", unit: "×", group: "Kaldırma", value: 0.05 },
  { key: "hoistMotorRpm", label: "Kaldırma Motor Devri", unit: "d/dk", group: "Kaldırma", value: 1500 },
  { key: "motorEfficiencyLoss", label: "Motor Verim Kaybı", unit: "×", group: "Kaldırma", value: 0.03 },
  { key: "hoistDriveSizeFactor", label: "Kaldırma Sürücü Boyut Katsayısı", unit: "×", group: "Kaldırma", value: 1.35, hint: "%180 akım 1dk/5dk → bir üst boy sürücü" },
  { key: "driveGroupFactor", label: "Tahrik Grubu Çarpanı", unit: "×", group: "Kaldırma", value: 1.5, hint: "Redüktör ağırlığı × çarpan (motor + fren + kaplin dahil)" },
  { key: "auxFrameRatio", label: "Yardımcı Kaldırma Şasi Eki", unit: "×", group: "Kaldırma", value: 0.3 },
  { key: "balanceBeamKgPerT", label: "Denge Traversi Katsayısı", unit: "kg/ton", group: "Kaldırma", value: 12 },
  { key: "topSheaveRatio", label: "Üst Makara Oranı", unit: "×", group: "Kaldırma", value: 0.6, hint: "Kanca bloğu ağırlığı × oran" },
  { key: "topSheaveThresholdT", label: "Üst Makara Eşiği", unit: "ton", group: "Kaldırma", value: 32 },
  { key: "trolleyPlatformRatio", label: "Araba Platformu Oranı", unit: "×", group: "Kaldırma", value: 0.12, hint: "Şasi ağırlığı × oran" },

  // —— yürütme
  { key: "travelResistance", label: "Yürütme Direnç Katsayısı", unit: "—", group: "Yürütme", value: 0.015, hint: "Sürtünme + ivme payı" },
  { key: "travelEfficiency", label: "Yürütme Verimi", unit: "—", group: "Yürütme", value: 0.9 },
  { key: "trolleyWheelLoadFactor", label: "Araba Teker Yükü Katsayısı", unit: "×", group: "Yürütme", value: 1.3, hint: "Kapasite × katsayı / 4 = teker yükü" },
  { key: "trolleyDynamicFactor", label: "Portal Teker Yükü Araba Katsayısı", unit: "×", group: "Yürütme", value: 1.8, hint: "Araba + yük köşeye bindiğinde uygulanan çarpan" },
  { key: "endCarriageKgPerT", label: "Alt Yürüme Başlığı / Boji", unit: "kg/ton", group: "Yürütme", value: 212.5, hint: "Köşe teker yükü [T] × katsayı" },

  // —— kiriş ve sehim
  { key: "elasticModulus", label: "Elastisite Modülü", unit: "kg/cm²", group: "Kiriş ve Sehim", value: 2100000 },
  { key: "trolleyWheelbaseFactor", label: "Araba Teker Mesafesi Katsayısı", unit: "cm/m", group: "Kiriş ve Sehim", value: 13, hint: "b = min(300; maks(120; L × katsayı)) cm" },
  { key: "camberSpanM", label: "Kamber Eşiği", unit: "m", group: "Kiriş ve Sehim", value: 15, hint: "Bu açıklığın üzerinde ters kavis verilir" },

  // —— köprü donanımı
  { key: "platformKgPerM", label: "Platform Birim Ağırlığı", unit: "kg/m", group: "Köprü Donanımı", value: 120, hint: "Çift taraflı yürüme yolu + korkuluk + ızgara" },
  { key: "festoonKgPerM", label: "Feston Hattı Birim Ağırlığı", unit: "kg/m", group: "Köprü Donanımı", value: 15 },
  { key: "bridgeElectricBaseKg", label: "Köprü Elektrik Sabiti", unit: "kg", group: "Köprü Donanımı", value: 400 },
  { key: "bridgeElectricKgPerT", label: "Köprü Elektrik Katsayısı", unit: "kg/ton", group: "Köprü Donanımı", value: 10 },
  { key: "electricRoomKg", label: "Elektrik Odası Ağırlığı", unit: "kg", group: "Köprü Donanımı", value: 6000 },
  { key: "cabinKg", label: "Kabin Ağırlığı", unit: "kg", group: "Köprü Donanımı", value: 1800 },
  { key: "cabinTravelKg", label: "Kabin Yürütme Mekanizması", unit: "kg", group: "Köprü Donanımı", value: 1200 },
  { key: "heatShieldBaseKg", label: "Isı Kalkanı Sabit Ağırlık", unit: "kg", group: "Köprü Donanımı", value: 125 },
  { key: "heatShieldKgPerT", label: "Isı Kalkanı Katsayısı", unit: "kg/ton", group: "Köprü Donanımı", value: 2 },

  // —— portal
  { key: "legBaseKgPerM", label: "Ayak Birim Ağırlık Tabanı", unit: "kg/m", group: "Portal", value: 54 },
  { key: "legLoadKgPerMPerT", label: "Ayak Yük Katsayısı", unit: "kg/m/ton", group: "Portal", value: 5.4 },
  { key: "topEndKgPerT", label: "Üst Uç Bağlantı", unit: "kg/ton", group: "Portal", value: 100, hint: "Köşe yükü [T] × katsayı" },
  { key: "gantryBracingRatio", label: "Portal Takviye Oranı", unit: "×", group: "Portal", value: 0.08, hint: "(ana kiriş + ayaklar) × oran" },
  { key: "legLadderKgPerM", label: "Ayak Merdiveni", unit: "kg/m", group: "Portal", value: 20, hint: "Ayak yüksekliği × katsayı × 2 ayak" },
  { key: "cornerSelfWeightFactor", label: "Köşe Yükü Öz-Ağırlık Payı", unit: "×", group: "Portal", value: 1.1 },

  // —— elektrik
  { key: "kwToAmp", label: "Kurulu kW → Besleme Akımı", unit: "A/kW", group: "Elektrik", value: 1.8, hint: "400 V 3 faz yaklaşımı" },
];

export const COST_PARAM_DEFAULTS: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(COST_PARAM_DEFS.map((p) => [p.key, p.value]))
);

/** Katsayının belgedeki değeri; yoksa koddaki varsayılan (YUMUŞAK DÜŞER). */
export function paramOf(params: Record<string, number> | undefined, key: string): number {
  const v = params?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : (COST_PARAM_DEFAULTS[key] ?? 0);
}

// ————————————————————————————————————————————————— arama yardımcıları

/**
 * Excel'in `ROUND`u — SIFIRDAN UZAĞA yuvarlar.
 *
 * JavaScript'in `Math.round`u yarımı YUKARI yuvarlar (`-0,5 → -0`), Excel ise
 * uzağa (`-0,5 → -1`). Model devralınan çalışma kitabının sayılarını birebir
 * üretmek zorundadır; aradaki fark hız artışı gibi negatif ara değerlerde
 * teker çapını bir boy kaydırırdı.
 */
export function excelRound(n: number, digits = 0): number {
  if (!Number.isFinite(n)) return 0;
  const c = 10 ** digits;
  const x = n * c;
  return (x < 0 ? -Math.round(-x) : Math.round(x)) / c;
}

/** Excel'in `CEILING`i — verilen katın üstüne yuvarlar. */
export function excelCeiling(n: number, significance: number): number {
  if (!Number.isFinite(n) || significance <= 0) return n;
  return Math.ceil(n / significance) * significance;
}

/**
 * KAPASİTE EKSENLİ tablolarda ARA DEĞER ALINIR (doğrusal enterpolasyon).
 *
 * Devralınan çalışma kitabında 32 tonluk vinç için ayrı bir "32T" parametre
 * bloğu vardı (tambur Ø 410, şasi 1700 kg, kanca bloğu 970 kg…). Bu sayıların
 * TAMAMI genel tabloların 30–40 ve 30–50 satırları arasındaki doğrusal ara
 * değerleridir — elle hesaplanıp yapıştırılmışlar. Model enterpolasyonu kendi
 * yapınca o blok bütünüyle gereksizleşir ve 32 değil 33 tonluk bir vinçte de
 * doğru sayı çıkar. "İlk ≥" kullanılsaydı 32 tonluk bir vinç 50 tonluk satıra
 * düşer ve kanca bloğu %78 fazla tartardı.
 */
export function interpolate<T>(
  table: readonly T[],
  x: number,
  keyOf: (row: T) => number,
  valueOf: (row: T) => number
): number | null {
  if (!table.length || !Number.isFinite(x)) return null;
  const first = table[0];
  const last = table[table.length - 1];
  if (x <= keyOf(first)) return valueOf(first);
  if (x >= keyOf(last)) return valueOf(last);
  for (let i = 1; i < table.length; i += 1) {
    const a = table[i - 1];
    const b = table[i];
    if (x <= keyOf(b)) {
      const span = keyOf(b) - keyOf(a);
      if (span <= 0) return valueOf(b);
      return valueOf(a) + ((valueOf(b) - valueOf(a)) * (x - keyOf(a))) / span;
    }
  }
  return valueOf(last);
}

/**
 * KATALOG BOYU seçimi — istenen değeri karşılayan İLK satır.
 *
 * Motor, sürücü, teker ve redüktör için enterpolasyon YAPILMAZ: ara boy diye
 * bir ürün yoktur, 23,4 kW'lık motor satın alınamaz.
 */
export function firstAtLeast<T>(
  table: readonly T[],
  need: number,
  keyOf: (row: T) => number
): T | null {
  if (!Number.isFinite(need)) return null;
  for (const row of table) if (keyOf(row) >= need) return row;
  return table.length ? table[table.length - 1] : null;
}

/** Teker çapını seride `steps` kadar büyütür (hız kaynaklı boy artışı). */
export function wheelDiaStep(diaMm: number, steps: number): number {
  const i = WHEEL_TABLE.findIndex((w) => w.diaMm === diaMm);
  if (i === -1) return diaMm;
  return WHEEL_TABLE[Math.min(i + Math.max(0, steps), WHEEL_TABLE.length - 1)].diaMm;
}

/** Kaldırma yüksekliğine göre tambur ağırlığı kolonu (≤10 · ≤15 · ≤20 · ≤25 · üstü). */
export function drumWeightAt(
  row: { kg10: number; kg15: number; kg20: number; kg25: number; kg30: number },
  liftHeightM: number
): number {
  if (liftHeightM <= 10) return row.kg10;
  if (liftHeightM <= 15) return row.kg15;
  if (liftHeightM <= 20) return row.kg20;
  if (liftHeightM <= 25) return row.kg25;
  return row.kg30;
}

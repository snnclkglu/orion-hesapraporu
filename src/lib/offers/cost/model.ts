// AĞIRLIK VE BOYUTLANDIRMA MODELİ — maliyetin MİKTAR tarafı.
//
// Maliyet satırı `miktar × birim fiyat`tır; bu modül MİKTARI üretir. Fiyata
// hiç dokunmaz (`params.ts`in başındaki gerekçe): ne bir €/kg okur ne bir
// katalog fiyatı arar.
//
// MODEL BİR TAHMİNDİR (MALIYET-3). Teklif aşamasında vincin tasarımı yoktur;
// buradaki sayılar "bu vinç kaç kilo gelir, hangi motor takılır" sorusuna
// TEKLİF VEREBİLMEK için verilen cevaplardır. Hiçbiri bir hesap raporuna
// girmez ve hiçbiri `lib/calc`in FEM/DIN doğrulamasının yerine geçmez.
//
// SIRA ÖNEMLİDİR ve keyfi değildir. Değerler birbirini besler; aşağıdaki
// düzen devralınan çalışma kitabının bağımlılık ağacının topolojik sırasıdır:
//
//   1. sınıf katsayıları           7. köşe yükü → portal ayakları
//   2. halat · tambur · moment     8. çelik ağırlığı
//   3. kaldırma motoru             9. portal teker yükü → teker çapı
//   4. araba teker yükü → çap     10. köprü yürütme grubu → köprü toplamı
//   5. araba ağırlıkları          11. toplam vinç ağırlığı
//   6. kiriş kesiti → ana kiriş   12. yürütme motorları · kurulu güç
//
// Sıra bozulursa bir değer kendisinden önce hesaplanmamış bir değere bakar ve
// model sessizce sıfırla çalışır — yanlış bir maliyet, eksik bir maliyetten
// daha tehlikelidir çünkü kendini belli etmez.

import { ropeSafetyFactor } from "@/lib/calc/coefficients";
import { RAILS, c1Factor } from "@/lib/calc/tables";
import {
  CLASS_DEFLECTION,
  CLASS_GIRDER_KGM,
  CLASS_SAFETY,
  CLASS_TRAVEL_POWER,
  CLASS_WEIGHT,
  DRIVE_KW,
  DRUM_TABLE,
  FRAME_TABLE,
  GEARBOX_TABLE,
  HOOK_BLOCK_TABLE,
  MOTOR_KW,
  ROPE_TABLE,
  SECTION_TABLE,
  TEMP_FACTORS,
  WHEEL_TABLE,
  drumWeightAt,
  excelCeiling,
  excelRound,
  firstAtLeast,
  interpolate,
  paramOf,
  sectionProps,
  wheelDiaStep,
  wheelLimitPressureOf,
  wheelMechanismFactor,
} from "./params";
import type { SectionProps } from "./params";
import type { CostInputs } from "./types";

/** Seçilen kesidin HAM ÖLÇÜLERİ ve türetilen özellikleri — kesit pop-up'ı bunu basar. */
export type CostSection = SectionProps & {
  topMm: number;
  webMm: number;
  botMm: number;
  tMm: number;
};

export interface CostModelResult {
  /** `w.*` ağırlık, `c.*` hesap. Üretilemeyen değer `null` — sıfır DEĞİL. */
  values: Record<string, number | null>;
  /** Sehim şartını sağlayan en küçük kesidin adı. */
  sectionName: string | null;
  /**
   * Seçilen kesidin KENDİSİ — ölçüler, alan, atalet, kg/m.
   *
   * `sectionName` yalnız bir etikettir; kullanıcı kesidin neye göre seçildiğini
   * sorduğunda ("⌀ ne, et kalınlığı ne") cevabı ekranda görebilmelidir
   * (kullanıcı isteği 18.08.2026, md. 6). Ekranda pop-up, belgede satır.
   */
  section: CostSection | null;
  /** Sehim şartı sağlanıyor mu; `null` = hesaplanamadı. */
  deflectionOk: boolean | null;
  /** Açıklık kamber eşiğini aşıyor mu. */
  camber: boolean | null;
  /** Hangi girdi eksik olduğu için hangi dal boş kaldı — ekran bunu söyler. */
  eksik: string[];
}

const bos = (): CostModelResult => ({
  values: {},
  sectionName: null,
  section: null,
  deflectionOk: null,
  camber: null,
  eksik: [],
});

function sayi(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * MODELİ ÇALIŞTIRIR.
 *
 * `overrides` bir SONUÇ YAMASI DEĞİLDİR, adım adım uygulanır: ana kiriş
 * ağırlığını elle düzelten kullanıcı köşe yükünün, portal ayaklarının ve
 * toplam ağırlığın da onunla değişmesini bekler. Yama olsaydı ekranda düzelen
 * sayı, maliyette düzelmezdi.
 */
export function hesapla(
  inputs: CostInputs,
  params: Record<string, number>,
  overrides: Record<string, number> = {}
): CostModelResult {
  const out = bos();
  const p = (k: string) => paramOf(params, k);

  /** Değeri yazar; elle ezilmişse EZİLENİ yazar ve aşağıya o akar. */
  const yaz = (key: string, v: number | null): number | null => {
    const ez = overrides[key];
    const deger = typeof ez === "number" && Number.isFinite(ez) ? ez : sayi(v);
    out.values[key] = deger;
    return deger;
  };
  /** Okunan değer; hiç hesaplanmamışsa `null`. */
  const oku = (key: string): number | null => out.values[key] ?? null;

  const Q = sayi(inputs.capacityT);
  const Q2 = sayi(inputs.auxCapacityT);
  const L = sayi(inputs.spanM);
  const H = sayi(inputs.liftHeightM);
  const vLift = sayi(inputs.liftSpeedMpm);
  const vTrolley = sayi(inputs.trolleySpeedMpm);
  const vBridge = sayi(inputs.bridgeSpeedMpm);

  if (Q === null) out.eksik.push("Kaldırma kapasitesi girilmedi — mekanizma ve ağırlıklar hesaplanamadı.");
  if (L === null) out.eksik.push("Açıklık girilmedi — kiriş, platform ve feston ağırlıkları hesaplanamadı.");
  if (H === null) out.eksik.push("Kaldırma yüksekliği girilmedi — tambur ve şasi ağırlıkları hesaplanamadı.");

  // ————————————————————————————————————————— 1. sınıf katsayıları
  const kSafety = CLASS_SAFETY[inputs.craneClass];
  const kWeight = CLASS_WEIGHT[inputs.craneClass];
  const kTravel = CLASS_TRAVEL_POWER[inputs.craneClass];
  const kGirder = CLASS_GIRDER_KGM[inputs.craneClass];
  const deflLimit = CLASS_DEFLECTION[inputs.craneClass];
  const tempFactor =
    TEMP_FACTORS.find((t) => inputs.ambientC <= t.maxC)?.factor ??
    TEMP_FACTORS[TEMP_FACTORS.length - 1].factor;

  yaz("c.classSafety", kSafety);
  yaz("c.classWeight", kWeight);
  yaz("c.tempFactor", tempFactor);
  yaz("c.deflectionLimit", deflLimit);

  // ————————————————————————————— 2-3. kaldırma mekanizması (K1 ve K2)
  /** Bir kaldırma grubunu baştan sona boyutlandırır (ana ve yardımcı aynı yol). */
  const kaldirma = (onek: string, kap: number | null) => {
    if (kap === null || kap <= 0) {
      for (const k of ["RopeCount", "RopeLoadKg", "RopeSafetyZp", "RopeRequiredKn", "RopeDiaMm",
        "RopeBreakingKn", "DrumDiaMm", "DrumMomentNm", "FinalMomentNm",
        "RopeSpeedMpm", "GearRatio", "MotorMomentNm", "CalcPowerKw", "ReqPowerKw", "MotorKw", "DriveKw"]) {
        yaz(`${onek}${k}`, null);
      }
      return;
    }
    const halat = kap <= p("rope2ThresholdT") ? 2 : kap <= p("rope8ThresholdT") ? 4 : 8;
    const ropeCount = yaz(`${onek}RopeCount`, halat) ?? halat;
    const ropeLoad = yaz(`${onek}RopeLoadKg`, (kap * 1000 * (1 + p("hookBlockLoadAdd"))) / ropeCount);

    // ————————————————————————————————————— halat çapı önerisi
    //
    // Kullanıcı isteği (22.08.2026, md. 6): *"Mekanizmaya göre emniyet
    // katsayısıyla çarpıp, halat çapı önerisi vermiyor. Örneğin m6 için katsayı
    // 5,6 … halat yükünü bununla çarpacak * 1,02 artıracak kN cinsine
    // çevirecek. Sonra 6x36 hasçelik halattan olanı seçecek."*
    //
    // Zp MOTORUN KENDİ TABLOSUNDAN GELİR, buraya kopyalanmaz: `lib/calc` FEM
    // 1.001 T.4.2.2.1.2'yi zaten taşıyor (`ropeSafetyFactor`) ve aynı standart
    // sayısının iki yerde yaşaması, birinin sessizce eskimesi demekti
    // (değişmez md. 8). İki çekirdek de SAFTIR, yani bağ meşrudur.
    //
    // BU BİR HESAP DEĞİL BİR ÖNERİDİR (MALIYET-3): teklif aşamasında vincin
    // tasarımı yoktur ve seçilen çap bir FEM doğrulamasının yerine geçmez —
    // hesap raporu halatı kendi modülünde yeniden seçer ve kontrol eder.
    //
    // HAREKETLİ HALAT ("moving") okunur: kaldırma halatı tambura sarılır,
    // sabit (bağlama) halatın daha düşük katsayısı burada geçerli değildir.
    const zp = yaz(`${onek}RopeSafetyZp`, ropeSafetyFactor(inputs.craneClass, "moving"));
    // kg → kN: yük × 9,81 ÷ 1000. Pay (varsayılan 1,02) kullanıcının kendi
    // tarifidir ve katsayı olarak durur, koda gömülmez.
    const gerekliKn =
      ropeLoad === null || zp === null
        ? yaz(`${onek}RopeRequiredKn`, null)
        : yaz(`${onek}RopeRequiredKn`, (ropeLoad * zp * p("ropeExtraFactor") * 9.81) / 1000);
    // KATALOGTAN İLK KARŞILAYAN BOY: ara çap diye bir halat yoktur. Tablo
    // yetmezse `firstAtLeast` son satırı verir ve bu YANILTICI olurdu —
    // karşılamayan bir çapı "önerilen" diye basmak, uydurma bir sayı yazmakla
    // aynı şeydir (değişmez md. 4). O yüzden sonuç ayrıca sınanır.
    const secilen =
      gerekliKn === null ? null : (firstAtLeast(ROPE_TABLE, gerekliKn, (r) => r.breakingKn) ?? null);
    const yeterli = secilen !== null && gerekliKn !== null && secilen.breakingKn >= gerekliKn;
    if (!yeterli && gerekliKn !== null) {
      out.eksik.push(
        `${onek === "c.hoist" ? "Ana" : "Yardımcı"} kaldırma için gereken kopma yükü ` +
          `katalogdaki en büyük halatı (Ø${ROPE_TABLE[ROPE_TABLE.length - 1].diaMm}) aşıyor — ` +
          "donanımı (kat sayısını) artırın."
      );
    }
    yaz(`${onek}RopeDiaMm`, yeterli ? secilen.diaMm : null);
    yaz(`${onek}RopeBreakingKn`, yeterli ? secilen.breakingKn : null);

    // Tambur çapı KAPASİTEYE göre ara değerlidir: 32 tonluk bir vinç 40 tonluk
    // satıra atlarsa tambur momenti ve tahvil birlikte kayar.
    const drumDia = yaz(`${onek}DrumDiaMm`, interpolate(DRUM_TABLE, kap, (r) => r.capT, (r) => r.diaMm));
    const drumMoment =
      ropeLoad !== null && drumDia !== null
        ? yaz(`${onek}DrumMomentNm`, (ropeLoad * 9.81 * drumDia) / 2 / 1000)
        : yaz(`${onek}DrumMomentNm`, null);
    const finalMoment = yaz(`${onek}FinalMomentNm`, drumMoment === null ? null : drumMoment * kSafety);

    const ropeSpeed = yaz(`${onek}RopeSpeedMpm`, vLift === null ? null : vLift * ropeCount);
    const rpm = p("hoistMotorRpm");
    const ratio =
      ropeSpeed !== null && ropeSpeed > 0 && drumDia !== null
        ? yaz(`${onek}GearRatio`, (rpm * Math.PI * (drumDia / 1000)) / ropeSpeed)
        : yaz(`${onek}GearRatio`, null);
    const motorMoment =
      drumMoment !== null && ratio !== null && ratio > 0
        ? yaz(`${onek}MotorMomentNm`, drumMoment / ratio)
        : yaz(`${onek}MotorMomentNm`, null);
    const calcPower =
      motorMoment === null
        ? yaz(`${onek}CalcPowerKw`, null)
        : yaz(`${onek}CalcPowerKw`, (motorMoment * rpm) / 9550 / (1 - p("motorEfficiencyLoss")));
    const reqPower = yaz(`${onek}ReqPowerKw`, calcPower === null ? null : calcPower * tempFactor);
    const motorKw = yaz(
      `${onek}MotorKw`,
      reqPower === null ? null : (firstAtLeast(MOTOR_KW, reqPower, (n) => n) ?? null)
    );
    // SÜRÜCÜ SEÇİLEN MOTORA GÖRE BÜYÜTÜLÜR, hesap gücüne göre değil.
    // Kaldırmada %180 akım 1 dk/5 dk istenir ve sürücü sahadaki MOTORU
    // sürmek zorundadır: 22,7 kW hesap gücü 30 kW motora yuvarlandığında
    // sürücü de 30'un üstünden boyutlanır (Ø 37 değil 45 kW çıkar).
    yaz(
      `${onek}DriveKw`,
      motorKw === null ? null : (firstAtLeast(DRIVE_KW, motorKw * p("hoistDriveSizeFactor"), (n) => n) ?? null)
    );
    // Redüktör ağırlığı KATALOG boyudur — ara değer alınmaz.
    yaz(
      `${onek}GearboxKg`,
      finalMoment === null ? null : (firstAtLeast(GEARBOX_TABLE, finalMoment, (r) => r.maxNm)?.kg ?? null)
    );
  };

  kaldirma("c.hoist", Q);
  kaldirma("c.auxHoist", Q2 !== null && Q2 > 0 ? Q2 : null);

  // ————————————————————————————— 4. araba teker yükü ve çapı
  const trolleyWheelLoad = yaz(
    "c.trolleyWheelLoadT",
    Q === null ? null : (Q * 1000 * p("trolleyWheelLoadFactor")) / 4 / 1000
  );
  const trolleyDia = yaz(
    "c.trolleyWheelDiaMm",
    trolleyWheelLoad === null ? null : (firstAtLeast(WHEEL_TABLE, trolleyWheelLoad, (w) => w.maxLoadT)?.diaMm ?? null)
  );
  // HIZ ÇAPI BÜYÜTÜR: 20 m/dk üzeri her kademe için bir boy. Araba yalnız
  // KENDİ hızına bakar; köprü ayrıca aşağıda hesaplanır.
  const trolleyStep = yaz(
    // KADEME BİR MODEL ÇIKTISIDIR, yerel bir değişken değil: köprünün karşılığı
    // (`c.wheelSpeedStep`) ekranda duruyordu, arabanınki durmuyordu. Sonuç,
    // "araba hızı kademesi kadar büyütülür" diyen bir formülün andığı ara
    // değerin hiçbir yerde basılamamasıydı (MALIYET-18).
    "c.trolleyWheelSpeedStep",
    vTrolley === null ? 0 : Math.max(0, excelRound(vTrolley / 20 - 1))
  ) ?? 0;
  const trolleyEffDia = yaz(
    "c.trolleyWheelEffDiaMm",
    trolleyDia === null ? null : wheelDiaStep(trolleyDia, trolleyStep)
  );

  // ————————————————————————————————————————— 5. araba ağırlıkları
  const trolleyGroupKg = WHEEL_TABLE.find((w) => w.diaMm === trolleyEffDia)?.groupKg ?? null;
  yaz("w.trolleyTravelGroup", trolleyGroupKg === null ? null : excelRound(trolleyGroupKg * kWeight));

  const frameBase = Q === null ? null : interpolate(FRAME_TABLE, Q, (r) => r.capT, (r) => r.kg10);
  const frameAdd = Q === null ? null : interpolate(FRAME_TABLE, Q, (r) => r.capT, (r) => r.addPer10m);
  yaz(
    "w.trolleyFrame",
    frameBase === null || frameAdd === null || H === null
      ? null
      : excelRound(
          (frameBase +
            (Math.max(0, H - 10) / 10) * frameAdd +
            (Q2 !== null && Q2 > 0 ? p("auxFrameRatio") * frameBase : 0)) *
            kWeight,
          -1
        )
  );

  const tamburAgirlik = (kap: number | null) =>
    kap === null || kap <= 0 || H === null
      ? null
      : excelRound((interpolate(DRUM_TABLE, kap, (r) => r.capT, (r) => drumWeightAt(r, H)) ?? 0) * kWeight);
  yaz("w.drum", tamburAgirlik(Q));
  yaz("w.auxDrum", tamburAgirlik(Q2 !== null && Q2 > 0 ? Q2 : null));

  // TAHRİK GRUBU = redüktör ağırlığı × çarpan (motor + fren + kaplin dahil).
  const tahrikGrubu = (onek: string) => {
    const kg = oku(`${onek}GearboxKg`);
    return kg === null ? null : excelRound(p("driveGroupFactor") * kg * kWeight);
  };
  yaz("w.hoistDriveGroup", tahrikGrubu("c.hoist"));
  yaz("w.auxHoistDriveGroup", tahrikGrubu("c.auxHoist"));

  const kancaBlogu = (kap: number | null) =>
    kap === null || kap <= 0
      ? null
      : excelRound((interpolate(HOOK_BLOCK_TABLE, kap, (r) => r.capT, (r) => r.kg) ?? 0) * kWeight);
  const hookBlock = yaz("w.hookBlock", kancaBlogu(Q));
  yaz("w.auxHookBlock", kancaBlogu(Q2 !== null && Q2 > 0 ? Q2 : null));

  yaz(
    "w.balanceBeams",
    Q === null ? null : Math.max(30, excelRound((Q + (Q2 ?? 0)) * p("balanceBeamKgPerT") * kWeight, -1))
  );
  // ÜST MAKARA yalnız büyük kapasitelerde vardır (eşik parametredir).
  yaz(
    "w.topSheave",
    Q === null || hookBlock === null
      ? null
      : Q >= p("topSheaveThresholdT")
        ? excelRound(hookBlock * p("topSheaveRatio"))
        : 0
  );
  const trolleyFrame = oku("w.trolleyFrame");
  yaz("w.trolleyPlatform", trolleyFrame === null ? null : excelRound(trolleyFrame * p("trolleyPlatformRatio")));

  const arabaParcalari = [
    "w.trolleyTravelGroup", "w.trolleyFrame", "w.drum", "w.hoistDriveGroup", "w.hookBlock",
    "w.auxDrum", "w.auxHoistDriveGroup", "w.auxHookBlock", "w.balanceBeams", "w.topSheave",
    "w.trolleyPlatform",
  ];
  const arabaHam = arabaParcalari.reduce((t, k) => t + (oku(k) ?? 0), 0);
  const trolleyTotal = yaz(
    "w.trolleyTotal",
    Q === null ? null : excelCeiling(arabaHam * p("trolleyCorrection"), 1000)
  );

  // —————————————————————————————— 6. kiriş kesiti ve ana kiriş ağırlığı
  const spanCm = yaz("c.spanCm", L === null ? null : L * 100);
  const wheelbase = yaz(
    "c.wheelbaseCm",
    L === null ? null : Math.min(300, Math.max(120, excelRound(L * p("trolleyWheelbaseFactor"), -1)))
  );
  const overhang = yaz(
    "c.overhangCm",
    spanCm === null || wheelbase === null ? null : (spanCm - wheelbase) / 2
  );
  const girderCount = Math.max(1, inputs.girderCount || 1);
  const wheelLoadP = yaz(
    "c.girderWheelLoadKg",
    Q === null || trolleyTotal === null ? null : (Q * 1000 + trolleyTotal) / (girderCount * 2)
  );

  const E = p("elasticModulus");
  // İki simetrik tekil yük altında açıklık ortası sehimi:
  //   δ = P·a·(3L² − 4a²) / (24·E·I)
  // Gerekli atalet, δ ≤ L/limit şartından çevrilir.
  const sehimPay =
    wheelLoadP !== null && overhang !== null && spanCm !== null
      ? wheelLoadP * overhang * (3 * spanCm ** 2 - 4 * overhang ** 2)
      : null;
  const requiredI = yaz(
    "c.requiredInertiaCm4",
    sehimPay === null || spanCm === null || spanCm <= 0 ? null : (sehimPay * deflLimit) / 24 / E / spanCm
  );

  const density = p("steelDensityFactor");
  const kesitler: CostSection[] = SECTION_TABLE.map((s) => ({ ...s, ...sectionProps(s, density) }));
  const onerilen = requiredI === null ? null : firstAtLeast(kesitler, requiredI, (s) => s.inertiaCm4);
  const sectionI = yaz("c.sectionInertiaCm4", onerilen?.inertiaCm4 ?? null);
  // EZİLEN ATALET KESİDİ DE DEĞİŞTİRİR — yarım akış bırakılmaz (MALIYET-7).
  //
  // Bu satır bir süre yoktu ve sonuç sinsiydi: ataleti elle büyüten mühendisin
  // SEHİMİ düzeliyor ama pop-up ile kg/m eski kesitte kalıyordu; yani ekran
  // aynı anda iki farklı kiriş anlatıyordu. Ezilen değer bir kesit SEÇİMİDİR:
  // ona en yakın gerçek katalog kesidi bulunur ve ağırlık ondan çıkar.
  const secilen =
    sectionI === null ? null : (firstAtLeast(kesitler, sectionI, (s) => s.inertiaCm4) ?? kesitler[kesitler.length - 1]);
  out.sectionName = secilen?.name ?? null;
  out.section = secilen ?? null;
  const girderKgPerM = yaz(
    "c.girderKgPerM",
    secilen === null ? null : secilen.kgPerM * (1 + p("girderExtraRatio")) * kGirder
  );
  const mainGirder = yaz(
    "w.mainGirder",
    girderKgPerM === null || L === null
      ? null
      : excelCeiling(girderKgPerM * L * girderCount * p("girderCorrection"), 50)
  );

  const deflection = yaz(
    "c.deflectionCm",
    sehimPay === null || sectionI === null || sectionI <= 0 ? null : sehimPay / 24 / E / sectionI
  );
  // SEHİM MİLİMETREDİR (kullanıcı isteği 18.08.2026, md. 7). Hesap cm ile
  // yürür (E kg/cm², atalet cm⁴, açıklık cm) ve öyle de kalır; ekrana basılan
  // birim ayrı bir anahtardır. Bir sayının iki birimde iki ayrı DEĞER olarak
  // saklanması yerine tek bir çevrim yazılır — cm'yi elle ezen kullanıcı
  // mm'yi de onunla birlikte değişmiş görür.
  yaz("c.deflectionMm", deflection === null ? null : deflection * 10);
  const deflectionRatio = yaz(
    "c.deflectionRatio",
    deflection === null || deflection <= 0 || spanCm === null ? null : spanCm / deflection
  );
  out.deflectionOk = deflectionRatio === null ? null : deflectionRatio >= deflLimit;
  out.camber = L === null ? null : L > p("camberSpanM");

  // ————————————————————————————————————————— 6b. köprü donanımı
  yaz("w.platform", L === null ? null : excelCeiling(L * p("platformKgPerM"), 50));
  yaz("w.festoon", L === null ? null : excelRound(L * p("festoonKgPerM"), -1));
  yaz(
    "w.bridgeElectric",
    Q === null ? null : excelRound(p("bridgeElectricBaseKg") + Q * p("bridgeElectricKgPerT"))
  );
  yaz("w.electricRoom", inputs.electricRoom ? p("electricRoomKg") : 0);
  yaz(
    "w.heatShield",
    !inputs.heatShield ? 0 : Q === null ? null : excelRound(p("heatShieldBaseKg") + Q * p("heatShieldKgPerT"))
  );
  yaz(
    "w.cabin",
    (inputs.cabin ? p("cabinKg") : 0) + (inputs.movingCabin ? p("cabinTravelKg") : 0)
  );

  // ————————————————————————————————— 7. köşe yükü ve portal ayakları
  // Köşe yükü, ana kiriş ve köprü donanımı BİLİNDİKTEN sonra hesaplanabilir;
  // ayakların birim ağırlığı da ona bağlıdır. Bu yüzden portal bloğu burada.
  const kosePaylari = ["w.mainGirder", "w.platform", "w.festoon", "w.bridgeElectric",
    "w.electricRoom", "w.heatShield", "w.cabin"];
  const koseToplam = kosePaylari.reduce((t, k) => t + (oku(k) ?? 0), 0);
  const cornerLoad = yaz(
    "c.cornerLoadT",
    Q === null || trolleyTotal === null || mainGirder === null
      ? null
      : excelRound(
          (p("cornerSelfWeightFactor") * (koseToplam + trolleyTotal + Q * 1000)) / 4 / 1000,
          1
        )
  );

  // ÜST UÇ BAĞLANTI portalde ayrı bir parçadır (köprü vincinde başkiriş onun
  // işini görür), o yüzden köşe yüküne bağlıdır ve yalnız portalde basılır.
  yaz(
    "w.topEndConnection",
    !inputs.gantry || cornerLoad === null ? 0 : excelCeiling(cornerLoad * p("topEndKgPerT"), 50)
  );

  const legHeight = sayi(inputs.legHeightM);
  const legUnit = yaz(
    "c.legUnitKgPerM",
    !inputs.gantry || cornerLoad === null ? null : p("legBaseKgPerM") + p("legLoadKgPerMPerT") * cornerLoad
  );
  yaz(
    "w.gantryLegs",
    !inputs.gantry || legUnit === null || legHeight === null ? 0 : excelRound(4 * legHeight * legUnit, -1)
  );
  yaz(
    "w.bogies",
    !inputs.gantry || cornerLoad === null ? 0 : excelRound(cornerLoad * p("endCarriageKgPerT"), -1)
  );
  yaz(
    "w.gantryBracing",
    !inputs.gantry || mainGirder === null
      ? 0
      : excelRound(p("gantryBracingRatio") * (mainGirder + (oku("w.gantryLegs") ?? 0)), -1)
  );
  yaz(
    "w.legLadders",
    !inputs.gantry || legHeight === null ? 0 : excelRound(p("legLadderKgPerM") * legHeight * 2, -1)
  );
  const gantrySteel = yaz(
    "w.gantrySteel",
    !inputs.gantry
      ? 0
      : excelCeiling(
          (oku("w.gantryLegs") ?? 0) + (oku("w.bogies") ?? 0) + (oku("w.gantryBracing") ?? 0) + (oku("w.legLadders") ?? 0),
          500
        )
  );

  // ————————————————————————————————————————— 8. çelik ağırlığı
  // HAMMADDE, İMALAT VE LAZER BU SAYIYA BAKAR; boya ise TOPLAM vinç
  // ağırlığına. Ayrım gerçektir: boya araba mekanizmasının da üstüne atılır,
  // sac ise yalnız kaynaklı yapı için kesilir.
  yaz(
    "w.steel",
    mainGirder === null
      ? null
      : excelCeiling(
          mainGirder +
            (oku("w.topEndConnection") ?? 0) +
            (oku("w.platform") ?? 0) +
            ((oku("w.trolleyFrame") ?? 0) + (oku("w.trolleyPlatform") ?? 0)) * p("trolleyCorrection") +
            (gantrySteel ?? 0),
          1000
        )
  );

  // —————————————————————————— 9. portal/köprü teker yükü ve çapı
  //
  // TEKER YÜKÜ ÜST UÇ BAĞLANTIYI DA TAŞIR ama KÖŞE YÜKÜ taşımaz — ikisi
  // aynı toplam değildir ve karıştırmak sessiz bir hatadır. Sebep sıradadır:
  // üst uç bağlantı KÖŞE YÜKÜNDEN türer, yani köşe yükü hesaplanırken henüz
  // yoktur; tekere binerken ise çoktan vardır ve gerçekten oraya biner.
  const tekerPaylari = [...kosePaylari, "w.topEndConnection"];
  const koprusuz = tekerPaylari.reduce((t, k) => t + (oku(k) ?? 0), 0) + (gantrySteel ?? 0);
  const wheelCount = Math.max(1, inputs.bridgeWheelCount || 4);
  const bridgeWheelLoad = yaz(
    "c.bridgeWheelLoadT",
    Q === null || trolleyTotal === null
      ? null
      : (koprusuz + p("trolleyDynamicFactor") * (trolleyTotal + Q * 1000)) / wheelCount / 1000
  );
  const bridgeDia = yaz(
    "c.bridgeWheelDiaMm",
    bridgeWheelLoad === null ? null : (firstAtLeast(WHEEL_TABLE, bridgeWheelLoad, (w) => w.maxLoadT)?.diaMm ?? null)
  );
  // KÖPRÜ ÇAPI İKİ HIZDAN BÜYÜK OLANINA bakar: aynı ray üzerinde koşan araba
  // da tekerleri yorar.
  const bridgeStep = Math.max(
    0,
    Math.max(
      vTrolley === null ? 0 : excelRound(vTrolley / 20 - 1),
      vBridge === null ? 0 : excelRound(vBridge / 30 - 1)
    )
  );
  yaz("c.wheelSpeedStep", bridgeStep);
  const bridgeEffDia = yaz(
    "c.bridgeWheelEffDiaMm",
    bridgeDia === null ? null : wheelDiaStep(bridgeDia, bridgeStep)
  );

  // ————————————————————— 9b. HIZLI TEKER SEÇİMİ (yüzey basıncı)
  //
  // Kullanıcı isteği (22.08.2026, md. 12): *"Maliyet hesaplar kısmına hızlı
  // teker seçimi yapabilmem lazım. Mühendislik kısmına bak, o kadar detaylı
  // olmayan bir teker seçimi yapmamız gerek … Birkaç ekleme ile hızlıca tekeri
  // otomatik hesaplayan ve öneren iyi bir sistem geliştirilebilir."*
  //
  // MÜHENDİSLİKTEKİNDEN NE EKSİK: orada teker mili, rulman, kaplin, fren
  // kasnağı, savrulma kuvvetleri ve yorulma da hesaplanır ve yirmiye yakın
  // girdi ister (`lib/calc/modules/travelGroup.ts`). Burada SORULAN TEK SORU
  // "hangi çap yeter"dir ve cevabı FEM'in TEK bağıntısıdır:
  //
  //     p = P_ort · 9,81 ÷ (b_ray · D)  ≤  PL · c1 · c2      (FEM 1.001 4.2.4.1)
  //
  // Girdilerin üçü modelde ZATEN VAR (teker yükü, hız, vinç sınıfı); dışarıdan
  // eklenen tek şey RAY KODUDUR ve o da teklifin kendi satırından okunur.
  //
  // BU BİR ÖNERİDİR, BİR ONAY DEĞİL (MALIYET-3): teklif aşamasında vincin
  // tasarımı yoktur ve hesap raporu tekeri kendi modülünde yeniden seçip
  // yorulmasıyla birlikte kontrol eder.
  //
  // ÖNERİ TABLODAN GELEN ÇAPI EZMEZ. `c.*WheelEffDiaMm` teker grubu ağırlığını
  // (`w.*TravelGroup`) besler ve o da toplam ağırlığa, oradan kâr marjına
  // gider; bir öneriyi oraya sessizce yazmak, yayımlanmış maliyetlerin
  // rakamını değiştirirdi. İki sayı YAN YANA durur ve fark ekranda görünür.
  const tekerSecimi = (
    onek: string,
    yukT: number | null,
    effDia: number | null,
    hizMpm: number | null,
    rayKodu: string
  ) => {
    // ORTALAMA TEKER YÜKÜ: FEM basınç kontrolü tepe yükü değil eşdeğer
    // ortalamayı ister (P_ort = (2·Pmaks + Pmin) ÷ 3). Maliyet modeli Pmin'i
    // ayrıca üretmez; yükün yarısı alt sınır kabul edilir, yani
    // P_ort = (2·P + P/2) ÷ 3 = 5P/6. Kaba ama YÖNÜ DOĞRU bir kabuldür ve
    // katsayı olarak durur, koda gömülmez.
    const ort = yukT === null ? null : yukT * 1000 * p("wheelMeanLoadRatio");
    yaz(`${onek}WheelMeanLoadKg`, ort);
    const bRay = RAILS[rayKodu]?.headWidth ?? null;
    yaz(`${onek}RailHeadMm`, bRay);
    // DEVİR, m/dk DEĞİL: FEM'in c1 tablosu tekerin DÖNME hızını (d/dk) ister.
    const devir =
      hizMpm === null || effDia === null || effDia <= 0
        ? null
        : hizMpm / ((effDia / 1000) * Math.PI);
    yaz(`${onek}WheelRpm`, devir);
    const c1 = devir === null || effDia === null ? null : (c1Factor(effDia, devir) ?? null);
    yaz(`${onek}WheelC1`, c1);
    const c2 = wheelMechanismFactor(inputs.craneClass);
    yaz(`${onek}WheelC2`, c2);
    const pl = wheelLimitPressureOf(p("wheelTensileNmm2"));
    yaz(`${onek}WheelLimitPressure`, pl);
    const izin = pl === null || c1 === null ? null : pl * c1 * c2;
    yaz(`${onek}WheelAllowedPressure`, izin);
    const basinc =
      ort === null || bRay === null || effDia === null || effDia <= 0
        ? null
        : (ort * 9.81) / bRay / effDia;
    yaz(`${onek}WheelPressure`, basinc);
    // GEREKEN EN KÜÇÜK ÇAP: basınç çapla ters orantılıdır, ama c1 de çapa
    // bağlıdır — bu yüzden formülle çözülmez, KATALOG SIRASI TARANIR.
    let gereken: number | null = null;
    if (ort !== null && bRay !== null && pl !== null) {
      for (const w of WHEEL_TABLE) {
        const d = w.diaMm;
        const n = hizMpm === null ? null : hizMpm / ((d / 1000) * Math.PI);
        const k1 = n === null ? null : (c1Factor(d, n) ?? null);
        if (k1 === null) continue;
        if ((ort * 9.81) / bRay / d <= pl * k1 * c2) {
          gereken = d;
          break;
        }
      }
    }
    yaz(`${onek}WheelMinDiaMm`, gereken);
  };

  tekerSecimi("c.bridge", bridgeWheelLoad, bridgeEffDia, vBridge, inputs.bridgeRailCode);
  tekerSecimi("c.trolley", trolleyWheelLoad, trolleyEffDia, vTrolley, inputs.trolleyRailCode);

  // ————————————————————— 10. köprü yürütme grubu ve köprü toplamı
  const bridgeGroupKg = WHEEL_TABLE.find((w) => w.diaMm === bridgeEffDia)?.groupKg ?? null;
  yaz(
    "w.bridgeTravelGroup",
    bridgeGroupKg === null ? null : excelRound((wheelCount / 4) * bridgeGroupKg * kWeight)
  );
  const koprüParcalari = ["w.bridgeTravelGroup", ...kosePaylari, "w.topEndConnection"];
  const bridgeTotal = yaz(
    "w.bridgeTotal",
    mainGirder === null ? null : excelCeiling(koprüParcalari.reduce((t, k) => t + (oku(k) ?? 0), 0), 1000)
  );

  // ————————————————————————————————— 11. toplam vinç ağırlığı
  const total = yaz(
    "w.total",
    bridgeTotal === null || trolleyTotal === null ? null : bridgeTotal + trolleyTotal + (gantrySteel ?? 0)
  );

  // ——————————————————— 12. yürütme motorları ve kurulu güç
  /** Yürütme gücü: hareket eden kütle × direnç × hız / verim. */
  const yurutme = (onek: string, kutleKg: number | null, hizMpm: number | null, adet: number) => {
    const n = Math.max(1, adet || 1);
    yaz(`${onek}DriveCount`, n);
    // SÜRÜCÜ ADEDİ MOTOR ADEDİNİN YARISIDIR: bir sürücü karşılıklı iki tahriki
    // birlikte sürer. Motor başına sürücü koymak, dört tahrikli bir portalde
    // iki fazla sürücü fiyatlamak demekti.
    yaz(`${onek}DriveUnits`, Math.max(1, Math.ceil(n / 2)));
    if (kutleKg === null || hizMpm === null || Q === null) {
      yaz(`${onek}CalcPowerKw`, null);
      yaz(`${onek}ReqPowerKw`, null);
      yaz(`${onek}MotorKw`, null);
      yaz(`${onek}DriveKw`, null);
      return;
    }
    const calc =
      ((kutleKg + Q * 1000) * 9.81 * p("travelResistance") * (hizMpm / 60)) /
      p("travelEfficiency") /
      1000 /
      n *
      kTravel;
    yaz(`${onek}CalcPowerKw`, calc);
    const req = yaz(`${onek}ReqPowerKw`, calc * tempFactor) ?? calc;
    const motorKw = yaz(`${onek}MotorKw`, firstAtLeast(MOTOR_KW, req, (x) => x) ?? null);
    // Sürücü İKİ MOTORUN toplam gücüne göre seçilir (yukarıdaki adet kuralının
    // aynı gerekçesi) ve tabanı SEÇİLEN motordur, hesap gücü değil.
    yaz(
      `${onek}DriveKw`,
      motorKw === null ? null : (firstAtLeast(DRIVE_KW, 2 * motorKw, (x) => x) ?? null)
    );
  };

  yurutme("c.bridge", total, vBridge, inputs.bridgeDriveCount);
  yurutme("c.trolley", trolleyTotal, vTrolley, inputs.trolleyDriveCount);

  const kurulu =
    (oku("c.hoistMotorKw") ?? 0) +
    (oku("c.auxHoistMotorKw") ?? 0) +
    (oku("c.bridgeDriveCount") ?? 0) * (oku("c.bridgeMotorKw") ?? 0) +
    (oku("c.trolleyDriveCount") ?? 0) * (oku("c.trolleyMotorKw") ?? 0);
  const installed = yaz("c.installedKw", kurulu > 0 ? kurulu : null);
  yaz("c.supplyCurrentA", installed === null ? null : excelRound(installed * p("kwToAmp")));

  // FİRE YALNIZ İŞÇİLİĞE BİNER, hammaddeye değil: sac zaten fireli ölçüde
  // satın alınır ve kesim artığı stoğa döner; kaynak/işleme saati ise yeniden
  // yapılan parça için ikinci kez harcanır. Ayrı bir anahtar olması, işçilik
  // satırının miktarında firenin GÖRÜNMESİ içindir — bir çarpanın satırın
  // arkasına saklanması, sonradan kimsenin bulamadığı türden bir farktır.
  const steel = oku("w.steel");
  yaz("w.steelWithFire", steel === null ? null : steel * (1 + p("fireRate")));

  // Adetler maliyet satırlarının miktarını besler; modelin kendi çıktısı
  // sayılırlar ki satırda "4 teker" gibi bir sayı elle yazılmasın.
  yaz("c.bridgeWheelCount", wheelCount);
  yaz("c.trolleyWheelCount", 4);
  yaz("c.girderCount", girderCount);
  yaz("c.capacityT", Q);
  yaz("c.one", 1);

  return out;
}

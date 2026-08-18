// MODEL DEĞERLERİNİN ADI, BİRİMİ, FORMÜLÜ VE EKRAN DÜZENİ — tek kaynak.
//
// Ekran (Ağırlıklar / Hesaplar sayfaları), miktar pop-up'ı ve iç PDF AYNI
// listeden okur. İki yerde yazılsaydı bir alan eklendiğinde biri onu gösterir
// öteki susardı — ve eksik bir satır, ekranda hiç fark edilmeyen türden bir
// eksikliktir.
//
// SIRA MODELİN HESAP SIRASIDIR (`model.ts`in başındaki 12 adım): halattan
// tambura, tamburdan momente, momentten motora. Ekrana böyle basıldığında bir
// sayının nereden geldiği yukarı bakılarak okunabilir; alfabetik ya da keyfi
// bir sıra o zinciri görünmez yapardı.
//
// FORMÜL DEFTERİ BURADADIR (kullanıcı isteği 18.08.2026: *"her hesabın
// satırına formülünü hesap adının yanına kısaca yaz"*). Formül METİNDİR, kod
// değildir: hesabı `model.ts` yapar, buradaki satır onu ANLATIR. İkisini tek
// yerden üretmek (formülü ayrıştırıp koşturmak) mümkündü ve reddedildi —
// okunur bir cümle ile çalıştırılabilir bir ifade aynı şey değildir, ve
// ikincisi uğruna birincisinden vazgeçmek ekranı okunmaz yapardı. Ayrışma
// riskine karşı `deps` ALANI VARDIR: formülün andığı ara değerler anahtarla
// yazılır, pop-up onları modelin o anki sayılarıyla basar. Yani metin yanlış
// kalsa bile ekrandaki SAYILAR modelin kendisinden gelir.

import { DRIVE_KW, DRUM_DIA_CHOICES, MOTOR_KW, ROPE_REEVING_CHOICES, WHEEL_DIA_CHOICES } from "./params";

export interface CostFieldDef {
  key: string;
  label: string;
  unit: string;
  /** Ekranda ve belgede kaç ondalık basılacak. */
  decimals: number;
  /** Bu satır bir TOPLAM ya da bir KARAR — kalın basılır. Yalnız görünüm. */
  sum?: boolean;
  /**
   * ELLE EZİLEMEZ.
   *
   * Yalnız BAŞKA BİR GİRDİNİN TEKRARI olan alanlar için açıktır: sınıf
   * katsayıları vinç sınıfından, teker adetleri girdi kutusundan gelir ve
   * onları burada ezmek iki yerde iki farklı sayı doğururdu. Toplamlar
   * ise EZİLEBİLİR — model bir TAHMİNDİR (MALIYET-3) ve gerçek ağırlığı
   * bilen mühendis onu yazabilmelidir; ezilen değer aşağıya akar, yani
   * yürütme gücü de yeni ağırlığa göre çıkar.
   */
  readOnly?: boolean;
  /** Kısa açıklama — nereden geldiğini söyler. */
  hint?: string;
  /**
   * SATIRIN FORMÜLÜ — adın yanında kısa metin.
   *
   * Kısa olması şart: satırın yanına sığmalı ve bakışta okunmalıdır. Uzun
   * gerekçe `hint`e yazılır.
   */
  formula?: string;
  /** Formülün andığı MODEL anahtarları — pop-up onları değerleriyle basar. */
  deps?: readonly string[];
  /** Formülün andığı KATSAYILAR (`COST_PARAM_DEFS` anahtarı). */
  paramKeys?: readonly string[];
  /**
   * KATALOG BOYLARI — alan serbest sayı değil, listeden seçilir.
   *
   * Motor, sürücü, teker ve tambur bir katalog boyudur; 23,4 kW'lık motor ya
   * da ⌀ 437 mm'lik teker satın alınamaz. Liste ayrıca sessiz bir bozulmayı
   * engeller: teker grubu ağırlığı çapı tabloda ARAYARAK bulur, listede
   * olmayan bir çap yazılırsa ağırlık `null` düşerdi.
   */
  choices?: readonly number[];
  /** Değerin önüne basılan işaret — çaplarda "⌀" (kullanıcı isteği, md. 4). */
  prefix?: string;
}

export interface CostFieldSection {
  key: string;
  title: string;
  fields: CostFieldDef[];
}

/**
 * AĞIRLIK ÖZETİNİN bölüm anahtarı — ekran onu girdilerin yanına alır.
 *
 * Anahtar burada SABİTTİR, ekranda dize olarak yazılmaz: bölüm anahtarı
 * değişirse özet sessizce iki kez çizilirdi (hem üstte hem sütunların içinde).
 */
export const AGIRLIK_OZET_KEY = "summary";

// ————————————————————————————————————————————————————— ağırlıklar

export const WEIGHT_SECTIONS: readonly CostFieldSection[] = [
  {
    key: "bridge",
    title: "KÖPRÜ / PORTAL ÜST YAPI",
    fields: [
      {
        key: "w.bridgeTravelGroup",
        label: "Yürütme Grubu (teker + yatak)",
        unit: "kg",
        decimals: 0,
        formula: "(teker adedi ÷ 4) × teker grubu × sınıf katsayısı",
        deps: ["c.bridgeWheelCount", "c.bridgeWheelEffDiaMm", "c.classWeight"],
      },
      {
        key: "w.mainGirder",
        label: "Ana Kiriş",
        unit: "kg",
        decimals: 0,
        hint: "Seçilen kesidin kg/m'si × açıklık × kiriş adedi",
        formula: "kg/m × açıklık × kiriş adedi × düzeltme",
        deps: ["c.girderKgPerM", "c.spanCm", "c.girderCount"],
        paramKeys: ["girderCorrection"],
      },
      {
        key: "w.topEndConnection",
        label: "Üst Uç Bağlantı",
        unit: "kg",
        decimals: 0,
        hint: "Yalnız portalde — köşe yükünden türer",
        formula: "köşe yükü × birim ağırlık",
        deps: ["c.cornerLoadT"],
        paramKeys: ["topEndKgPerT"],
      },
      {
        key: "w.platform",
        label: "Platform ve Korkuluk",
        unit: "kg",
        decimals: 0,
        formula: "açıklık × birim ağırlık",
        deps: ["c.spanCm"],
        paramKeys: ["platformKgPerM"],
      },
      {
        key: "w.festoon",
        label: "Feston Hattı",
        unit: "kg",
        decimals: 0,
        formula: "açıklık × birim ağırlık",
        deps: ["c.spanCm"],
        paramKeys: ["festoonKgPerM"],
      },
      {
        key: "w.bridgeElectric",
        label: "Köprü Elektrik Tesisatı",
        unit: "kg",
        decimals: 0,
        formula: "sabit + kapasite × katsayı",
        deps: ["c.capacityT"],
        paramKeys: ["bridgeElectricBaseKg", "bridgeElectricKgPerT"],
      },
      {
        key: "w.electricRoom",
        label: "Elektrik Odası",
        unit: "kg",
        decimals: 0,
        formula: "girdilerde işaretliyse sabit ağırlık",
        paramKeys: ["electricRoomKg"],
      },
      {
        key: "w.heatShield",
        label: "Isı Kalkanı",
        unit: "kg",
        decimals: 0,
        formula: "sabit + kapasite × katsayı",
        deps: ["c.capacityT"],
        paramKeys: ["heatShieldBaseKg", "heatShieldKgPerT"],
      },
      {
        key: "w.cabin",
        label: "Kabin (+ yürütme)",
        unit: "kg",
        decimals: 0,
        formula: "kabin + (hareketliyse yürütme mekanizması)",
        paramKeys: ["cabinKg", "cabinTravelKg"],
      },
      {
        key: "w.bridgeTotal",
        label: "KÖPRÜ TOPLAM",
        unit: "kg",
        decimals: 0,
        sum: true,
        formula: "yürütme grubu + üst yapı parçaları",
        deps: [
          "w.bridgeTravelGroup",
          "w.mainGirder",
          "w.topEndConnection",
          "w.platform",
          "w.festoon",
          "w.bridgeElectric",
          "w.electricRoom",
          "w.heatShield",
          "w.cabin",
        ],
      },
    ],
  },
  {
    key: "trolley",
    title: "ARABA",
    fields: [
      {
        key: "w.trolleyTravelGroup",
        label: "Yürütme Grubu",
        unit: "kg",
        decimals: 0,
        formula: "teker grubu × sınıf katsayısı",
        deps: ["c.trolleyWheelEffDiaMm", "c.classWeight"],
      },
      {
        key: "w.trolleyFrame",
        label: "Şasi",
        unit: "kg",
        decimals: 0,
        formula: "tablo tabanı + yükseklik payı + yardımcı payı, × sınıf",
        deps: ["c.capacityT", "c.classWeight"],
        paramKeys: ["auxFrameRatio"],
      },
      {
        key: "w.drum",
        label: "Tambur",
        unit: "kg",
        decimals: 0,
        formula: "tambur tablosu (kapasite × kaldırma yüksekliği) × sınıf",
        deps: ["c.capacityT", "c.classWeight"],
      },
      {
        key: "w.hoistDriveGroup",
        label: "Tahrik Grubu (motor + redüktör + fren)",
        unit: "kg",
        decimals: 0,
        formula: "redüktör ağırlığı × grup çarpanı × sınıf",
        deps: ["c.hoistGearboxKg", "c.classWeight"],
        paramKeys: ["driveGroupFactor"],
      },
      {
        key: "w.hookBlock",
        label: "Kanca Bloğu",
        unit: "kg",
        decimals: 0,
        formula: "kanca bloğu tablosu × sınıf",
        deps: ["c.capacityT", "c.classWeight"],
      },
      {
        key: "w.auxDrum",
        label: "Yardımcı Tambur",
        unit: "kg",
        decimals: 0,
        formula: "tambur tablosu (yardımcı kapasite) × sınıf",
        deps: ["c.classWeight"],
      },
      {
        key: "w.auxHoistDriveGroup",
        label: "Yardımcı Tahrik Grubu",
        unit: "kg",
        decimals: 0,
        formula: "yardımcı redüktör × grup çarpanı × sınıf",
        deps: ["c.auxHoistGearboxKg", "c.classWeight"],
        paramKeys: ["driveGroupFactor"],
      },
      {
        key: "w.auxHookBlock",
        label: "Yardımcı Kanca Bloğu",
        unit: "kg",
        decimals: 0,
        formula: "kanca bloğu tablosu (yardımcı) × sınıf",
        deps: ["c.classWeight"],
      },
      {
        key: "w.balanceBeams",
        label: "Denge Traversleri",
        unit: "kg",
        decimals: 0,
        formula: "(ana + yardımcı kapasite) × katsayı × sınıf, en az 30 kg",
        deps: ["c.capacityT", "c.classWeight"],
        paramKeys: ["balanceBeamKgPerT"],
      },
      {
        key: "w.topSheave",
        label: "Üst Makara Bloğu",
        unit: "kg",
        decimals: 0,
        formula: "kanca bloğu × oran (eşiğin üstündeki kapasitelerde)",
        deps: ["w.hookBlock", "c.capacityT"],
        paramKeys: ["topSheaveRatio", "topSheaveThresholdT"],
      },
      {
        key: "w.trolleyPlatform",
        label: "Araba Platformu",
        unit: "kg",
        decimals: 0,
        formula: "şasi × oran",
        deps: ["w.trolleyFrame"],
        paramKeys: ["trolleyPlatformRatio"],
      },
      {
        key: "w.trolleyTotal",
        label: "ARABA TOPLAM",
        unit: "kg",
        decimals: 0,
        sum: true,
        formula: "araba parçaları toplamı × düzeltme (1000 kg'a yuvarlanır)",
        deps: [
          "w.trolleyTravelGroup",
          "w.trolleyFrame",
          "w.drum",
          "w.hoistDriveGroup",
          "w.hookBlock",
          "w.auxDrum",
          "w.auxHoistDriveGroup",
          "w.auxHookBlock",
          "w.balanceBeams",
          "w.topSheave",
          "w.trolleyPlatform",
        ],
        paramKeys: ["trolleyCorrection"],
      },
    ],
  },
  {
    key: "gantry",
    title: "PORTAL ÇELİĞİ",
    fields: [
      {
        key: "w.gantryLegs",
        label: "Ayaklar",
        unit: "kg",
        decimals: 0,
        formula: "4 × ayak yüksekliği × ayak birim ağırlığı",
        deps: ["c.legUnitKgPerM"],
      },
      {
        key: "w.bogies",
        label: "Alt Yürüme Başlığı / Boji",
        unit: "kg",
        decimals: 0,
        formula: "köşe yükü × birim ağırlık",
        deps: ["c.cornerLoadT"],
        paramKeys: ["endCarriageKgPerT"],
      },
      {
        key: "w.gantryBracing",
        label: "Takviye",
        unit: "kg",
        decimals: 0,
        formula: "(ana kiriş + ayaklar) × oran",
        deps: ["w.mainGirder", "w.gantryLegs"],
        paramKeys: ["gantryBracingRatio"],
      },
      {
        key: "w.legLadders",
        label: "Ayak Merdivenleri",
        unit: "kg",
        decimals: 0,
        formula: "birim ağırlık × ayak yüksekliği × 2 ayak",
        paramKeys: ["legLadderKgPerM"],
      },
      {
        key: "w.gantrySteel",
        label: "PORTAL ÇELİK TOPLAM",
        unit: "kg",
        decimals: 0,
        sum: true,
        formula: "ayak + boji + takviye + merdiven (500 kg'a yuvarlanır)",
        deps: ["w.gantryLegs", "w.bogies", "w.gantryBracing", "w.legLadders"],
      },
    ],
  },
  {
    /**
     * BU BÖLÜM EKRANDA EN ÜSTTEDİR, listedeki yerinde değil.
     *
     * Kullanıcı isteği (18.08.2026): *"MALİYETE GİREN AĞIRLIKLAR bölümünü de
     * en üste alalım. Girdiler bölümünün sağına."* Listedeki sıra MODELİN
     * HESAP SIRASIDIR ve öyle kalır (dosya başındaki gerekçe): bu üç sayı
     * bütün ağırlıkların TOPLAMIDIR, yani en sonda hesaplanır. Ama okuyanın
     * sorusu ters yöndedir — "bu vinç kaç kilo" önce sorulur, kırılımı sonra.
     * Ekran bu yüzden `AGIRLIK_OZET_KEY` ile onu ayırıp girdilerin yanına
     * koyar; PDF ve model sırayı olduğu gibi kullanır.
     */
    key: "summary",
    title: "MALİYETE GİREN AĞIRLIKLAR",
    fields: [
      {
        key: "w.steel",
        label: "Vinç Çelik Ağırlığı",
        unit: "kg",
        decimals: 0,
        sum: true,
        hint: "Hammadde, lazer kesim ve imalat işçiliği bunu okur",
        formula: "ana kiriş + üst uç + platform + araba çeliği × düzeltme + portal çeliği",
        deps: [
          "w.mainGirder",
          "w.topEndConnection",
          "w.platform",
          "w.trolleyFrame",
          "w.trolleyPlatform",
          "w.gantrySteel",
        ],
        paramKeys: ["trolleyCorrection"],
      },
      {
        key: "w.steelWithFire",
        label: "Çelik + Fire",
        unit: "kg",
        decimals: 0,
        sum: true,
        hint: "İmalat işçiliği miktarı — fire oranı Katsayılar bölümündedir",
        formula: "çelik ağırlığı × (1 + fire oranı)",
        deps: ["w.steel"],
        paramKeys: ["fireRate"],
      },
      {
        key: "w.total",
        label: "TOPLAM VİNÇ AĞIRLIĞI",
        unit: "kg",
        decimals: 0,
        sum: true,
        hint: "Boya miktarı ve €/kg bunu okur",
        formula: "köprü toplam + araba toplam + portal çeliği",
        deps: ["w.bridgeTotal", "w.trolleyTotal", "w.gantrySteel"],
      },
    ],
  },
];

// —————————————————————————————————————————————————————— hesaplar

function kaldirmaAlanlari(onek: string, ad: string): CostFieldDef[] {
  return [
    {
      // HALAT ADEDİ DEĞİL HALAT DONANIMI (kullanıcı isteği 18.08.2026, md. 1):
      // sorulan şey kaç tel halat olduğu değil, yükün kaç kat halatla
      // taşındığıdır (reeving). Alan bir DROPDOWN'dır — model kapasiteye göre
      // önerir, mühendis değiştirir ve bütün mekanizma onunla yeniden çıkar.
      key: `${onek}RopeCount`,
      label: `${ad} — Halat Donanımı`,
      unit: "kat",
      decimals: 0,
      choices: ROPE_REEVING_CHOICES,
      formula: "kapasite eşiklerinden önerilir; listeden değiştirilir",
      paramKeys: ["rope2ThresholdT", "rope8ThresholdT"],
    },
    {
      key: `${onek}RopeLoadKg`,
      label: `${ad} — Halat Yükü`,
      unit: "kg",
      decimals: 0,
      formula: "kapasite × 1000 × (1 + kanca payı) ÷ donanım",
      deps: [`${onek}RopeCount`],
      paramKeys: ["hookBlockLoadAdd"],
    },
    {
      key: `${onek}DrumDiaMm`,
      label: `${ad} — Tambur Çapı`,
      unit: "mm",
      decimals: 0,
      prefix: "⌀",
      choices: DRUM_DIA_CHOICES,
      formula: "kapasite tablosundan (ara değerli); listeden değiştirilir",
    },
    {
      key: `${onek}DrumMomentNm`,
      label: `${ad} — Tambur Momenti`,
      unit: "Nm",
      decimals: 0,
      formula: "halat yükü × 9,81 × ⌀ ÷ 2",
      deps: [`${onek}RopeLoadKg`, `${onek}DrumDiaMm`],
    },
    {
      key: `${onek}FinalMomentNm`,
      label: `${ad} — Final Moment`,
      unit: "Nm",
      decimals: 0,
      hint: "Redüktör bu momente göre seçilir",
      formula: "tambur momenti × sınıf emniyet katsayısı",
      deps: [`${onek}DrumMomentNm`, "c.classSafety"],
    },
    {
      key: `${onek}RopeSpeedMpm`,
      label: `${ad} — Halat Hızı`,
      unit: "m/dk",
      decimals: 1,
      hint: "Teklifte istenen kaldırma hızından türer",
      formula: "kaldırma hızı × halat donanımı",
      deps: [`${onek}RopeCount`],
    },
    {
      key: `${onek}GearRatio`,
      label: `${ad} — Tahvil Oranı`,
      unit: "",
      decimals: 2,
      formula: "motor devri × π × ⌀ ÷ halat hızı",
      deps: [`${onek}DrumDiaMm`, `${onek}RopeSpeedMpm`],
      paramKeys: ["hoistMotorRpm"],
    },
    {
      key: `${onek}MotorMomentNm`,
      label: `${ad} — Motor Momenti`,
      unit: "Nm",
      decimals: 1,
      formula: "tambur momenti ÷ tahvil oranı",
      deps: [`${onek}DrumMomentNm`, `${onek}GearRatio`],
    },
    {
      key: `${onek}CalcPowerKw`,
      label: `${ad} — Hesap Gücü`,
      unit: "kW",
      decimals: 2,
      formula: "motor momenti × devir ÷ 9550 ÷ (1 − verim kaybı)",
      deps: [`${onek}MotorMomentNm`],
      paramKeys: ["hoistMotorRpm", "motorEfficiencyLoss"],
    },
    {
      key: `${onek}ReqPowerKw`,
      label: `${ad} — Sıcaklık Dahil Güç`,
      unit: "kW",
      decimals: 2,
      formula: "hesap gücü × sıcaklık katsayısı",
      deps: [`${onek}CalcPowerKw`, "c.tempFactor"],
    },
    {
      key: `${onek}MotorKw`,
      label: `${ad} — SEÇİLEN MOTOR`,
      unit: "kW",
      decimals: 2,
      sum: true,
      choices: MOTOR_KW,
      formula: "IEC serisinden gerekli gücü karşılayan ilk boy",
      deps: [`${onek}ReqPowerKw`],
    },
    {
      key: `${onek}DriveKw`,
      label: `${ad} — Sürücü`,
      unit: "kW",
      decimals: 2,
      choices: DRIVE_KW,
      hint: "Seçilen motorun katı (%180 akım şartı)",
      formula: "seçilen motor × boyut katsayısı → seriden ilk ≥",
      deps: [`${onek}MotorKw`],
      paramKeys: ["hoistDriveSizeFactor"],
    },
    {
      key: `${onek}GearboxKg`,
      label: `${ad} — Redüktör Ağırlığı`,
      unit: "kg",
      decimals: 0,
      formula: "final momente göre katalog boyu",
      deps: [`${onek}FinalMomentNm`],
    },
  ];
}

function yurutmeAlanlari(onek: string, ad: string): CostFieldDef[] {
  return [
    {
      key: `${onek}DriveCount`,
      label: `${ad} — Tahrik Adedi`,
      unit: "",
      decimals: 0,
      readOnly: true,
      hint: "Girdiler bölümünden değişir",
    },
    {
      key: `${onek}CalcPowerKw`,
      label: `${ad} — Hesap Gücü (motor başına)`,
      unit: "kW",
      decimals: 3,
      formula: "(ağırlık + yük) × 9,81 × direnç × hız ÷ verim ÷ tahrik adedi × sınıf",
      deps: [`${onek}DriveCount`],
      paramKeys: ["travelResistance", "travelEfficiency"],
    },
    {
      // MODEL BU DEĞERİ ÜRETİYORDU AMA EKRANDA YOKTU: motorun neden bir üst
      // boya çıktığı ("22,65 kW hesap → 24,9 kW sıcaklık dahil → 30 kW motor")
      // ancak arada duran bu satırla okunur.
      key: `${onek}ReqPowerKw`,
      label: `${ad} — Sıcaklık Dahil Güç`,
      unit: "kW",
      decimals: 3,
      formula: "hesap gücü × sıcaklık katsayısı",
      deps: [`${onek}CalcPowerKw`, "c.tempFactor"],
    },
    {
      key: `${onek}MotorKw`,
      label: `${ad} — SEÇİLEN MOTOR`,
      unit: "kW",
      decimals: 2,
      sum: true,
      choices: MOTOR_KW,
      formula: "IEC serisinden sıcaklık dahil gücü karşılayan ilk boy",
      deps: [`${onek}ReqPowerKw`],
    },
    {
      key: `${onek}DriveUnits`,
      label: `${ad} — Sürücü Adedi`,
      unit: "",
      decimals: 0,
      hint: "Bir sürücü karşılıklı iki tahriki sürer",
      formula: "yukarı yuvarla(tahrik adedi ÷ 2)",
      deps: [`${onek}DriveCount`],
    },
    {
      key: `${onek}DriveKw`,
      label: `${ad} — Sürücü`,
      unit: "kW",
      decimals: 2,
      choices: DRIVE_KW,
      formula: "2 × seçilen motor → sürücü serisinden ilk ≥",
      deps: [`${onek}MotorKw`],
    },
  ];
}

export const CALC_SECTIONS: readonly CostFieldSection[] = [
  { key: "hoist", title: "ANA KALDIRMA MEKANİZMASI", fields: kaldirmaAlanlari("c.hoist", "K1") },
  { key: "auxHoist", title: "YARDIMCI KALDIRMA MEKANİZMASI", fields: kaldirmaAlanlari("c.auxHoist", "K2") },
  {
    key: "wheels",
    title: "TEKERLEKLER",
    fields: [
      {
        key: "c.bridgeWheelLoadT",
        label: "Köprü / Portal Teker Yükü",
        unit: "ton",
        decimals: 2,
        formula: "(köprü ağırlığı + çarpan × (araba + yük)) ÷ teker adedi",
        deps: ["w.trolleyTotal", "c.bridgeWheelCount"],
        paramKeys: ["trolleyDynamicFactor"],
      },
      {
        key: "c.bridgeWheelDiaMm",
        label: "Köprü / Portal Teker Çapı",
        unit: "mm",
        decimals: 0,
        prefix: "⌀",
        choices: WHEEL_DIA_CHOICES,
        formula: "teker yükünü karşılayan ilk katalog çapı",
        deps: ["c.bridgeWheelLoadT"],
      },
      {
        key: "c.wheelSpeedStep",
        label: "Hız Kaynaklı Boy Artışı",
        unit: "kademe",
        decimals: 0,
        formula: "maks(araba hızı ÷ 20 − 1 ; köprü hızı ÷ 30 − 1)",
      },
      {
        key: "c.bridgeWheelEffDiaMm",
        label: "KÖPRÜ / PORTAL ETKİN ÇAP",
        unit: "mm",
        decimals: 0,
        sum: true,
        prefix: "⌀",
        choices: WHEEL_DIA_CHOICES,
        hint: "Teker grubu ağırlığı bu çapı okur",
        formula: "teker çapı, hız kademesi kadar büyütülür",
        deps: ["c.bridgeWheelDiaMm", "c.wheelSpeedStep"],
      },
      {
        key: "c.bridgeWheelCount",
        label: "Köprü / Portal Teker Adedi",
        unit: "",
        decimals: 0,
        readOnly: true,
        hint: "Girdiler bölümünden değişir",
      },
      {
        key: "c.trolleyWheelLoadT",
        label: "Araba Teker Yükü",
        unit: "ton",
        decimals: 2,
        formula: "kapasite × katsayı ÷ 4 teker",
        deps: ["c.capacityT"],
        paramKeys: ["trolleyWheelLoadFactor"],
      },
      {
        key: "c.trolleyWheelDiaMm",
        label: "Araba Teker Çapı",
        unit: "mm",
        decimals: 0,
        prefix: "⌀",
        choices: WHEEL_DIA_CHOICES,
        formula: "teker yükünü karşılayan ilk katalog çapı",
        deps: ["c.trolleyWheelLoadT"],
      },
      {
        key: "c.trolleyWheelEffDiaMm",
        label: "ARABA ETKİN ÇAP",
        unit: "mm",
        decimals: 0,
        sum: true,
        prefix: "⌀",
        choices: WHEEL_DIA_CHOICES,
        formula: "teker çapı, araba hızı kademesi kadar büyütülür",
        deps: ["c.trolleyWheelDiaMm", "c.trolleyWheelSpeedStep"],
      },
      {
        key: "c.trolleyWheelSpeedStep",
        label: "Araba Hız Kaynaklı Boy Artışı",
        unit: "kademe",
        decimals: 0,
        readOnly: true,
        hint: "20 m/dk üzeri her kademe teker çapını bir boy büyütür",
        formula: "yuvarla(araba hızı ÷ 20 − 1), en az 0",
      },
      {
        key: "c.trolleyWheelCount",
        label: "Araba Teker Adedi",
        unit: "",
        decimals: 0,
        readOnly: true,
      },
    ],
  },
  { key: "bridgeTravel", title: "KÖPRÜ / PORTAL YÜRÜTME", fields: yurutmeAlanlari("c.bridge", "Köprü") },
  { key: "trolleyTravel", title: "ARABA YÜRÜTME", fields: yurutmeAlanlari("c.trolley", "Araba") },
  {
    key: "girder",
    title: "KİRİŞ VE SEHİM",
    fields: [
      {
        key: "c.girderCount",
        label: "Kiriş Adedi",
        unit: "",
        decimals: 0,
        readOnly: true,
        hint: "Girdiler bölümünden değişir",
      },
      { key: "c.spanCm", label: "Açıklık", unit: "cm", decimals: 0, formula: "girdilerdeki açıklık × 100" },
      {
        key: "c.wheelbaseCm",
        label: "Araba Teker Mesafesi (b)",
        unit: "cm",
        decimals: 0,
        formula: "min(300 ; maks(120 ; açıklık × katsayı))",
        deps: ["c.spanCm"],
        paramKeys: ["trolleyWheelbaseFactor"],
      },
      {
        key: "c.overhangCm",
        label: "Mesnet–Yük Mesafesi (a)",
        unit: "cm",
        decimals: 0,
        formula: "(açıklık − teker mesafesi) ÷ 2",
        deps: ["c.spanCm", "c.wheelbaseCm"],
      },
      {
        key: "c.girderWheelLoadKg",
        label: "Kiriş Başına Teker Yükü (P)",
        unit: "kg",
        decimals: 0,
        formula: "(yük + araba) ÷ (kiriş adedi × 2)",
        deps: ["c.capacityT", "w.trolleyTotal", "c.girderCount"],
      },
      {
        // SEHİM LİMİTİ BURADA DURUR, SINIF KATSAYILARINDA DEĞİL: okuyanın
        // sorusu "kiriş yetiyor mu"dur ve cevabı hemen altındaki SEHİM ORANI
        // satırıdır. İkisi ayrı bölümlerde olsaydı karşılaştırma iki bölüm
        // arasında yapılırdı.
        //
        // ALAN DEFTERİNDE ANAHTAR TEKİLDİR (`ALAN_HARITASI` bir
        // `Object.fromEntries`tir): bu alan bir süre HEM burada HEM SINIF
        // KATSAYILARI bölümünde tanımlıydı ve ikisi çelişiyordu (biri
        // düzenlenebilir, öteki değil). Sonuç ekranda ve PDF'te İKİ KEZ çıkan
        // bir satırdı; defterden okunan tanım ise sessizce sonuncusuydu.
        key: "c.deflectionLimit",
        label: "Sehim Limiti (L/x)",
        unit: "",
        decimals: 0,
        readOnly: true,
        hint: "Vinç sınıfından gelir",
        formula: "sınıf tablosundan",
      },
      {
        key: "c.requiredInertiaCm4",
        label: "Gerekli Atalet",
        unit: "cm⁴",
        decimals: 0,
        formula: "P·a·(3L² − 4a²) × limit ÷ 24 ÷ E ÷ L",
        deps: ["c.girderWheelLoadKg", "c.overhangCm", "c.spanCm", "c.deflectionLimit"],
        paramKeys: ["elasticModulus"],
      },
      {
        key: "c.sectionInertiaCm4",
        label: "Seçilen Kesit Ataleti",
        unit: "cm⁴",
        decimals: 0,
        hint: "Bölümün sonundaki SEÇİLEN KESİT düğmesi ölçüleri ve özellikleri açar",
        formula: "gerekli ataleti karşılayan ilk kutu kesit",
        deps: ["c.requiredInertiaCm4"],
      },
      {
        key: "c.girderKgPerM",
        label: "Kiriş Metre Ağırlığı (perde + ray dahil)",
        unit: "kg/m",
        decimals: 1,
        formula: "kesit kg/m × (1 + perde-ray payı) × sınıf",
        deps: ["c.sectionInertiaCm4"],
        paramKeys: ["girderExtraRatio", "steelDensityFactor"],
      },
      {
        // SEHİM MİLİMETREDİR (kullanıcı isteği 18.08.2026, md. 7). Hesap cm
        // ile yürür — E kg/cm², atalet cm⁴, açıklık cm — ve öyle kalır; ekrana
        // basılan birim ayrıdır. Alan SALT OKUNURDUR çünkü santimetredeki
        // ikizinin (`c.deflectionCm`) çevrimidir: ikisini ayrı ayrı ezmek aynı
        // sehim için iki farklı sayı doğururdu.
        key: "c.deflectionMm",
        label: "Sehim",
        unit: "mm",
        decimals: 1,
        readOnly: true,
        formula: "P·a·(3L² − 4a²) ÷ 24 ÷ E ÷ atalet",
        deps: ["c.girderWheelLoadKg", "c.overhangCm", "c.spanCm", "c.sectionInertiaCm4"],
        paramKeys: ["elasticModulus"],
      },
      // SEHİM ORANI BİR SONUÇTUR, bir seçim değil: onu ezmek "kiriş yeterli"
      // demenin sayıyı değiştirmeden yoludur. Kesit yetmiyorsa düzeltilecek
      // yer kesit ya da açıklıktır.
      {
        key: "c.deflectionRatio",
        label: "SEHİM ORANI (L/x)",
        unit: "",
        decimals: 0,
        sum: true,
        readOnly: true,
        formula: "açıklık ÷ sehim (limitin üstünde olmalı)",
        // ARA DEĞERLER HESABIN BİRİMİNDEDİR: oran cm ÷ cm'dir. Burada
        // `c.deflectionMm` yazılıydı ve pop-up "3.000 cm ÷ 20,5 mm = 1.463"
        // diyordu — okuyan tutturamazdı.
        deps: ["c.spanCm", "c.deflectionCm", "c.deflectionLimit"],
      },
    ],
  },
  {
    // ANAHTAR `gantryLegs`TİR, `gantry` DEĞİL: `WEIGHT_SECTIONS`ta zaten
    // "PORTAL ÇELİĞİ" adlı bir `gantry` bölümü var. İkisi bugün ayrı
    // sayfalarda çiziliyor ve çakışma görünmüyor — ama bölüm anahtarına göre
    // davranan tek bir satır eklendiğinde (ekran özeti `AGIRLIK_OZET_KEY` ile
    // tam bunu yapıyor) yanlış bölüm seçilirdi. `labels.test.ts` tekilliği
    // ölçer.
    key: "gantryLegs",
    title: "PORTAL AYAK MODELİ",
    fields: [
      {
        key: "c.cornerLoadT",
        label: "Köşe Yükü",
        unit: "ton",
        decimals: 1,
        formula: "öz-ağırlık payı × (köprü + araba + yük) ÷ 4 köşe",
        deps: ["w.mainGirder", "w.trolleyTotal", "c.capacityT"],
        paramKeys: ["cornerSelfWeightFactor"],
      },
      {
        key: "c.legUnitKgPerM",
        label: "Ayak Birim Ağırlığı",
        unit: "kg/m",
        decimals: 2,
        formula: "taban + yük katsayısı × köşe yükü",
        deps: ["c.cornerLoadT"],
        paramKeys: ["legBaseKgPerM", "legLoadKgPerMPerT"],
      },
    ],
  },
  {
    key: "power",
    title: "ELEKTRİK",
    fields: [
      {
        key: "c.installedKw",
        label: "KURULU GÜÇ",
        unit: "kW",
        decimals: 2,
        sum: true,
        formula: "K1 + K2 + köprü adedi × kW + araba adedi × kW",
        deps: [
          "c.hoistMotorKw",
          "c.auxHoistMotorKw",
          "c.bridgeDriveCount",
          "c.bridgeMotorKw",
          "c.trolleyDriveCount",
          "c.trolleyMotorKw",
        ],
      },
      {
        key: "c.supplyCurrentA",
        label: "Besleme Akımı (≈, 400 V 3~)",
        unit: "A",
        decimals: 0,
        formula: "kurulu güç × A/kW katsayısı",
        deps: ["c.installedKw"],
        paramKeys: ["kwToAmp"],
      },
    ],
  },
  {
    key: "class",
    title: "SINIF KATSAYILARI",
    fields: [
      // Bunlar VİNÇ SINIFININ ve ORTAM SICAKLIĞININ tekrarıdır; burada
      // ezilseydi girdi kutusuyla çelişen ikinci bir sınıf doğardı.
      {
        key: "c.classSafety",
        label: "Mekanizma Emniyet Katsayısı",
        unit: "×",
        decimals: 2,
        readOnly: true,
        formula: "vinç sınıfından",
      },
      {
        key: "c.classWeight",
        label: "Ağırlık Katsayısı",
        unit: "×",
        decimals: 2,
        readOnly: true,
        formula: "vinç sınıfından",
      },
      {
        key: "c.tempFactor",
        label: "Sıcaklık Katsayısı",
        unit: "×",
        decimals: 2,
        readOnly: true,
        formula: "ortam sıcaklığından",
      },
    ],
  },
];

/**
 * BÖLÜMSÜZ ALANLAR — bir SATIR olarak çizilmez ama ADI VARDIR.
 *
 * Modelin ürettiği her değer ekranda kendi satırını hak etmez: kapasite zaten
 * GİRDİLER bölümündeki kutudur, `c.one` bir sayı değil "bu satır tektir"
 * demenin yoludur, sehimin santimetresi ise milimetresinin ikizidir.
 *
 * AMA HEPSİNİN BİR TANIMI OLMAK ZORUNDADIR. Bu üçü `qtySource` ve `deps`
 * listelerinde geçiyor; tanımsız kaldıklarında türetme pop-up'ı etiket yerine
 * HAM ANAHTARI basıyordu ("c.capacityT", on ayrı alanın ara değer listesinde).
 * `costFieldDef` bu yüzden bölümlerin BİRLEŞİMİNDEN okur, yalnız çizilenlerden
 * değil.
 */
const BOLUMSUZ_ALANLAR: readonly CostFieldDef[] = [
  {
    key: "c.capacityT",
    label: "Kaldırma Kapasitesi",
    unit: "ton",
    decimals: 1,
    readOnly: true,
    hint: "Girdiler bölümünden gelir",
    formula: "girdilerdeki ana kaldırma kapasitesi",
  },
  {
    key: "c.deflectionCm",
    label: "Sehim (santimetre)",
    unit: "cm",
    decimals: 3,
    readOnly: true,
    hint: "Milimetredeki ikizinin hesap birimi — sehim oranı bundan çıkar",
    formula: "P·a·(3L² − 4a²) ÷ 24 ÷ E ÷ atalet",
  },
  {
    key: "c.one",
    label: "Tek Kalem",
    unit: "adet",
    decimals: 0,
    readOnly: true,
    hint: "Bu satır bir bütün olarak fiyatlanır; miktarı her zaman 1'dir",
  },
];

/** Anahtardan alan tanımı — ekran ve PDF etiket ararken bunu çağırır. */
const ALAN_HARITASI: Record<string, CostFieldDef> = Object.fromEntries(
  [
    ...[...WEIGHT_SECTIONS, ...CALC_SECTIONS].flatMap((s) => s.fields),
    ...BOLUMSUZ_ALANLAR,
  ].map((f) => [f.key, f])
);

/**
 * Defterin BÜTÜN anahtarları — bütünlük testi bunu tarar.
 *
 * Çizilen alanlar ve bölümsüz olanlar birlikte. Bir `qtySource` ya da `deps`
 * anahtarının burada karşılığı yoksa ekranda ham anahtar görünür; test bunu
 * yakalar (`labels.test.ts`).
 */
export const COST_FIELD_KEYS: readonly string[] = Object.keys(ALAN_HARITASI);

export function costFieldDef(key: string): CostFieldDef | undefined {
  return ALAN_HARITASI[key];
}

/** Bir maliyet satırının miktar kaynağının okunur adı ("Ana Kiriş [kg]"). */
export function qtySourceLabel(key: string | undefined): string | null {
  if (!key) return null;
  if (key === "c.one") return null;
  const def = costFieldDef(key);
  if (!def) return null;
  return def.unit ? `${def.label} [${def.unit}]` : def.label;
}

/** Elle ezilebilir mi — gerekçe `CostFieldDef.readOnly`nin başındadır. */
export function costFieldEditable(def: CostFieldDef): boolean {
  return def.readOnly !== true;
}

/**
 * Model değerinin BASILAN hâli.
 *
 * BOŞ DEĞER "—" BASILIR, "0" DEĞİL (değişmez md. 4). Hesaplanamamış bir tambur
 * momenti sıfır değildir; sıfır yazmak, girdisi eksik bir kalemi hesaplanmış
 * göstermenin en kısa yoludur. Ekran ve PDF aynı fonksiyonu çağırır ki bir
 * sayı iki yerde iki türlü görünmesin.
 */
export function fmtCostField(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Alanın BASILAN hâli — önekiyle birlikte ("⌀ 400").
 *
 * ÖNEK BOŞ DEĞERE BASILMAZ: "⌀ —" hesaplanmış ama sıfır çıkmış bir çap gibi
 * okunur; oysa orada hiç çap yoktur. Ekran ve PDF bu fonksiyonu çağırır.
 */
export function costFieldText(def: CostFieldDef, value: number | null | undefined): string {
  const metin = fmtCostField(value, def.decimals);
  if (metin === "—" || !def.prefix) return metin;
  return `${def.prefix} ${metin}`;
}

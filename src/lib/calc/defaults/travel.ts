// Yürütme grubu referans değerleri — yeni revizyon şablonu ve tarihsel
// doğrulama fikstürü. Kaynak: İSDEMİR Amonyum Sülfat Vinci V5 hesap raporu.
//
// Bu değerler bir örnek iş emrinin girdi ve katalog seçimleridir; hesap
// yöntemini tanımlamazlar. Yöntem travelGroup.ts'tedir ve FEM 1.001 / CMAA 70'e
// dayanır.

import type {
  TravelDeps,
  TravelInputs,
  TravelSelections,
} from "../modules/travelGroup";

/** Modüller arası bağımlılıklar */
export const V5_TRAVEL_DEPS: TravelDeps = {
  hookEquipmentT: 3.5,  // kanca bloğu + halat ağırlığı (kaldırma grubundan)
  trolleyWeightT: 2.5,  // araba ağırlığı (araba modülünden)
};

export const V5_TROLLEY_INPUTS: TravelInputs = {
  minApproachM: 0,              // yalnız köprü varyantında kullanılır
  wheelCount: 4,                // tekerlek adedi
  driveCount: 1,                // referans arabada tek bağımsız tahrik
  wheelsPerMotor: 2,            // arabada tek motor iki tekeri tahrik eder
  shaftSpanAMm: 72.5,           // teker mili mesnet ölçüsü a [mm]
  shaftSpanBMm: 90,             // teker mili ölçüsü b [mm] (gösterim)
  shaftDiaMm: 110,              // teker mili çapı [mm]
  // Teker bandaj genişliği: 50×50 kare ray + iki yandan yanaşma payı.
  // Yük mile bu genişlik boyunca YAYILI aktarılır (bkz. travelGroup.ts).
  wheelWidthMm: 90,
  stressConcFactor: 1,          // gerilme yığılması katsayısı
  bearingCount: 2,              // teker başına rulman adedi
  bearingFactorY0: 2.8,         // eşdeğer statik yük katsayısı Y0
  bearingFactorY1: 2.8,         // eşdeğer dinamik yük katsayısı Y1
  // CMAA 70 servis (uygulama) sınıfı — FEM mekanizma sınıfından türetilir
  // (M6 → D); bkz. derive.ts `travelApplicationClass`.
  applicationClass: "D",
  travelApplicationClassAuto: true,
  // CMAA 70 Tablo 5.2.9.1.2.1-E: Ks sınıf × KUMANDA TİPİ ile seçilir.
  // Referans işte Ks ELLE 1,0 girilmişti (E sınıfı + AC manyetik kumanda için
  // tablo 1,2 verir); tarihsel fikstürü bozmamak için otomatik KAPALI gelir.
  // Yeni iş şablonunda anahtar AÇIKTIR (bkz. defaults.ts).
  driveControl: "acManyetik",
  serviceFactorKs: 1,           // CMAA 70 servis faktörü (elle girilmiş)
  serviceFactorKsAuto: false,
  // CMAA 70 Tablo 5.2.9.1.2.1-C: Kt motor + kumanda tipinden gelir; servis
  // sınıfına bağlı DEĞİLDİR. AC bilezikli rotor (Mill) + kontaktör-direnç
  // satırı 1,5–1,7 verir, alt uç 1,5'tir → referans değerle birebir örtüşür.
  motorControl: "acBilezikliMillKontaktor",
  accelTorqueFactorKt: 1.5,     // CMAA 70 ivmelenme tork faktörü
  accelTorqueFactorKtAuto: true,
  reducerStages: 3,             // redüktör kademe sayısı
  // Referans işte ivme ELLE 0,2 girilmişti; mekanizma sınıfından türetme
  // (M6 → 0,15) tarihsel sayıları değiştirirdi, o yüzden otomatik KAPALIDIR.
  // Yeni iş şablonunda anahtar AÇIKTIR (bkz. defaults.ts).
  accelerationMs2: 0.2,         // ivme [m/s²]
  accelerationAuto: false,
  motorCountAuto: false,        // tarihsel katalog seçimini korur
  tempFactor: 1,                // ortam sıcaklığından türetilir (bkz. tempFactorAuto)
  tempFactorAuto: true,
  motorCalcCount: 1,            // gücün bölüşüldüğü motor adedi
  gearboxServiceFactor: 2.1,    // redüktör emniyet katsayısı
  gearboxServiceFactorAuto: false,
  // Referans işte redüktör KATALOGDAN seçilmiştir (YILMAZ R DT283, i = 29);
  // oran bir seçimdir, gereken orana eşitlenmiş bir bekleme değeri değil.
  gearboxRatioAuto: false,
  brakeServiceFactor: 0,        // arabada yürütme freni hesaplanmaz
  motorCouplingServiceFactor: 1.8,
  wheelCouplingServiceFactor: 2,
  bufferApproachM: 0,           // yalnız köprü varyantında kullanılır
  // Araba iki kirişin ucundaki iki durdurucuya aynı anda çarpar.
  bufferCount: 2,
  // Kepçe halatla asılıdır → salınabilir yük, çarpışan kütleye girmez.
  bufferLoadRigidlyGuided: "Hayır",
  bufferFrequentEndApproach: "Hayır",
  // Feston — bölüm yalnız enerji beslemesi feston seçilince görünür; alanlar
  // sıfırdan başlar ki mühendis kendi kablo paketini girsin.
  festoonTrolleyCount: 1,
  festoonCablePackageWeightKg: 0,
  festoonLoopHeightM: 1.5,
};

export const V5_TROLLEY_SELECTIONS: TravelSelections = {
  railFamily: "bar",            // kare/dikdörtgen dolu çubuk ray
  railCode: "50x50",
  wheelMaterial: "AISI 4140+QT",
  wheelTensileNmm2: 800,        // teker malzemesi çekme dayanımı [N/mm²]
  wheelDiaMm: 250,
  shaftMaterial: "42CrMo4",
  bearingType: "Çift Sıra Makaralı Rulman",
  bearingCode: "22210",
  bearingBoreMm: 50,
  bearingOuterDiaMm: 90,
  bearingWidthMm: 23,
  bearingDynCKn: 159,
  bearingStatC0Kn: 166,
  motorBrand: "INNOMOTICS/SEW/ABB",
  // Tip kodu tarihsel V5 referansında yok; katalogdan seçilince dolar.
  motorModel: "",
  motorPowerKw: 3,
  motorRpm: 1480,
  motorCount: 1,
  motorShaftMm: 38,
  gearboxModel: "YILMAZ R DT283",
  gearboxRatio: 29,
  gearboxOutputTorqueKnm: 0.59,
  gearboxInputShaftText: "-",
  gearboxInputShaftMm: 0,
  gearboxOutputShaftMm: 60,
  brakeBrand: "",               // arabada yürütme freni hesaplanmaz
  brakeTorqueNm: 0,
  brakeWheelDiaMm: 0,
  couplingMotorShaftMm: 22,     // kapline bağlanan motor mili [mm]
  motorCouplingBrand: "SİBRE PİN KAPLİN",
  motorCouplingModel: "APC160A",
  motorCouplingTorqueNm: 270,
  motorCouplingDmaxMm: 48,
  wheelShaftDiaMm: 60,          // kapline bağlanan teker mili çapı [mm]
  wheelCouplingBrand: "SİBRE FLEXİBLE KAPLİN",
  wheelCouplingModel: "ALC A 90",
  wheelCouplingTorqueNm: 3600,
  wheelCouplingDmaxMm: 80,
  bufferModel: "GLHB 63 100 - TYPE RM",
  bufferCatalogType: "hidrolik",
  bufferStrokeMm: 100,
  bufferEnergyKj: 15,
  bufferLoadKn: 170,
  // Referans iş SIBRE SP tamponu kullanmıyor; kısma iğnesi ve sıkışma sınırı
  // verisi YOKTUR. Uydurulmamış, 0 bırakılmıştır → ilgili kontroller üretilmez.
  bufferMeteringPinCode: "",
  bufferDesignMassMaxT: 0,
  bufferMaxCompressionPct: 0,
};

export const V5_BRIDGE_INPUTS: TravelInputs = {
  minApproachM: 1,              // minimum araba yanaşması [m]
  wheelCount: 4,
  driveCount: 2,                // referans köprüde iki bağımsız tahrik
  wheelsPerMotor: 1,            // köprüde her motor tek tekeri tahrik eder
  shaftSpanAMm: 75,
  shaftSpanBMm: 140,
  shaftDiaMm: 140,
  // Köprü tekeri daha büyük çaplıdır; bandaj genişliği de daha fazladır.
  wheelWidthMm: 100,
  stressConcFactor: 1,
  bearingCount: 2,
  bearingFactorY0: 2.5,
  bearingFactorY1: 2.6,
  // CMAA 70 servis (uygulama) sınıfı — köprü mekanizma sınıfı M6 → D.
  applicationClass: "D",
  travelApplicationClassAuto: true,
  driveControl: "acManyetik",
  serviceFactorKs: 1,           // elle girilmiş — bkz. V5_TROLLEY_INPUTS notu
  serviceFactorKsAuto: false,
  motorControl: "acBilezikliMillKontaktor",
  accelTorqueFactorKt: 1.5,
  accelTorqueFactorKtAuto: true,
  reducerStages: 3,
  accelerationMs2: 0.2,         // elle girilmiş — bkz. V5_TROLLEY_INPUTS notu
  accelerationAuto: false,
  motorCountAuto: false,        // tarihsel katalog seçimini korur
  tempFactor: 1,                // ortam sıcaklığından türetilir (bkz. tempFactorAuto)
  tempFactorAuto: true,
  motorCalcCount: 2,
  gearboxServiceFactor: 2.1,
  gearboxServiceFactorAuto: false,
  gearboxRatioAuto: false,      // katalogdan seçilmiş (YILMAZ R. MT373, i = 24)
  brakeServiceFactor: 1.6,      // yürütme freni emniyet katsayısı
  motorCouplingServiceFactor: 1.8,
  wheelCouplingServiceFactor: 1.8,
  bufferApproachM: 2,           // tampon hesabında araba yanaşması [m]
  // Köprü iki rayın ucundaki iki durdurucuya aynı anda çarpar.
  bufferCount: 2,
  bufferLoadRigidlyGuided: "Hayır",
  bufferFrequentEndApproach: "Hayır",
  // Feston — bölüm yalnız enerji beslemesi feston seçilince görünür; alanlar
  // sıfırdan başlar ki mühendis kendi kablo paketini girsin.
  festoonTrolleyCount: 1,
  festoonCablePackageWeightKg: 0,
  festoonLoopHeightM: 1.5,
};

export const V5_BRIDGE_SELECTIONS: TravelSelections = {
  railFamily: "bar",
  railCode: "50x50",
  wheelMaterial: "AISI 4140+QT",
  wheelTensileNmm2: 800,
  wheelDiaMm: 315,
  shaftMaterial: "42CrMo4",
  bearingType: "Çift Sıra Makaralı Rulman",
  bearingCode: "22216",
  bearingBoreMm: 80,
  bearingOuterDiaMm: 140,
  bearingWidthMm: 33,
  bearingDynCKn: 243,
  bearingStatC0Kn: 270,
  motorBrand: "INNOMOTICS/SEW/ABB",
  // Tip kodu tarihsel V5 referansında yok; katalogdan seçilince dolar.
  motorModel: "",
  motorPowerKw: 3,
  motorRpm: 1480,
  motorCount: 2,
  motorShaftMm: 28,
  gearboxModel: "YILMAZ R. MT373",
  gearboxRatio: 24,
  gearboxOutputTorqueKnm: 0.82,
  gearboxInputShaftText: "-",
  gearboxInputShaftMm: 0,
  gearboxOutputShaftMm: 60,
  // Referans iş emrinde köprü yürütme freni SEÇİLMEMİŞTİR; fren kontrolü bu
  // yüzden uygun çıkmaz ve seçim yapılana kadar öyle kalır.
  brakeBrand: "",
  brakeTorqueNm: 0,
  brakeWheelDiaMm: 0,
  couplingMotorShaftMm: 28,     // köprüde motorun kendi mil çapı kullanılır
  motorCouplingBrand: "SİBRE PİN KAPLİN",
  motorCouplingModel: "APC160A",
  motorCouplingTorqueNm: 270,
  motorCouplingDmaxMm: 48,
  wheelShaftDiaMm: 70,
  wheelCouplingBrand: "SİBRE FLEXİBLE KAPLİN",
  wheelCouplingModel: "ALC A 90",
  wheelCouplingTorqueNm: 3600,
  wheelCouplingDmaxMm: 80,
  bufferModel: "GLHB 63 100 - TYPE RM",
  bufferCatalogType: "hidrolik",
  bufferStrokeMm: 100,
  bufferEnergyKj: 15,
  bufferLoadKn: 170,
  // Referans iş SIBRE SP tamponu kullanmıyor; kısma iğnesi ve sıkışma sınırı
  // verisi YOKTUR. Uydurulmamış, 0 bırakılmıştır → ilgili kontroller üretilmez.
  bufferMeteringPinCode: "",
  bufferDesignMassMaxT: 0,
  bufferMaxCompressionPct: 0,
};

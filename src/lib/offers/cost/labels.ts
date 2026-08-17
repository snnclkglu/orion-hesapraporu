// MODEL DEĞERLERİNİN ADI, BİRİMİ VE EKRAN DÜZENİ — tek kaynak.
//
// Ekran (Ağırlıklar / Hesaplar sayfaları) ve iç PDF AYNI listeden okur. İki
// yerde yazılsaydı bir alan eklendiğinde biri onu gösterir öteki susardı — ve
// eksik bir satır, ekranda hiç fark edilmeyen türden bir eksikliktir.
//
// SIRA MODELİN HESAP SIRASIDIR (`model.ts`in başındaki 12 adım): halattan
// tambura, tamburdan momente, momentten motora. Ekrana böyle basıldığında bir
// sayının nereden geldiği yukarı bakılarak okunabilir; alfabetik ya da keyfi
// bir sıra o zinciri görünmez yapardı.

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
}

export interface CostFieldSection {
  key: string;
  title: string;
  fields: CostFieldDef[];
}

// ————————————————————————————————————————————————————— ağırlıklar

export const WEIGHT_SECTIONS: readonly CostFieldSection[] = [
  {
    key: "bridge",
    title: "KÖPRÜ / PORTAL ÜST YAPI",
    fields: [
      { key: "w.bridgeTravelGroup", label: "Yürütme Grubu (teker + yatak)", unit: "kg", decimals: 0 },
      { key: "w.mainGirder", label: "Ana Kiriş", unit: "kg", decimals: 0, hint: "Seçilen kesidin kg/m'si × açıklık × kiriş adedi" },
      { key: "w.topEndConnection", label: "Üst Uç Bağlantı", unit: "kg", decimals: 0, hint: "Yalnız portalde — köşe yükünden türer" },
      { key: "w.platform", label: "Platform ve Korkuluk", unit: "kg", decimals: 0 },
      { key: "w.festoon", label: "Feston Hattı", unit: "kg", decimals: 0 },
      { key: "w.bridgeElectric", label: "Köprü Elektrik Tesisatı", unit: "kg", decimals: 0 },
      { key: "w.electricRoom", label: "Elektrik Odası", unit: "kg", decimals: 0 },
      { key: "w.heatShield", label: "Isı Kalkanı", unit: "kg", decimals: 0 },
      { key: "w.cabin", label: "Kabin (+ yürütme)", unit: "kg", decimals: 0 },
      { key: "w.bridgeTotal", label: "KÖPRÜ TOPLAM", unit: "kg", decimals: 0, sum: true },
    ],
  },
  {
    key: "trolley",
    title: "ARABA",
    fields: [
      { key: "w.trolleyTravelGroup", label: "Yürütme Grubu", unit: "kg", decimals: 0 },
      { key: "w.trolleyFrame", label: "Şasi", unit: "kg", decimals: 0 },
      { key: "w.drum", label: "Tambur", unit: "kg", decimals: 0 },
      { key: "w.hoistDriveGroup", label: "Tahrik Grubu (motor + redüktör + fren)", unit: "kg", decimals: 0 },
      { key: "w.hookBlock", label: "Kanca Bloğu", unit: "kg", decimals: 0 },
      { key: "w.auxDrum", label: "Yardımcı Tambur", unit: "kg", decimals: 0 },
      { key: "w.auxHoistDriveGroup", label: "Yardımcı Tahrik Grubu", unit: "kg", decimals: 0 },
      { key: "w.auxHookBlock", label: "Yardımcı Kanca Bloğu", unit: "kg", decimals: 0 },
      { key: "w.balanceBeams", label: "Denge Traversleri", unit: "kg", decimals: 0 },
      { key: "w.topSheave", label: "Üst Makara Bloğu", unit: "kg", decimals: 0 },
      { key: "w.trolleyPlatform", label: "Araba Platformu", unit: "kg", decimals: 0 },
      { key: "w.trolleyTotal", label: "ARABA TOPLAM", unit: "kg", decimals: 0, sum: true },
    ],
  },
  {
    key: "gantry",
    title: "PORTAL ÇELİĞİ",
    fields: [
      { key: "w.gantryLegs", label: "Ayaklar", unit: "kg", decimals: 0 },
      { key: "w.bogies", label: "Alt Yürüme Başlığı / Boji", unit: "kg", decimals: 0 },
      { key: "w.gantryBracing", label: "Takviye", unit: "kg", decimals: 0 },
      { key: "w.legLadders", label: "Ayak Merdivenleri", unit: "kg", decimals: 0 },
      { key: "w.gantrySteel", label: "PORTAL ÇELİK TOPLAM", unit: "kg", decimals: 0, sum: true },
    ],
  },
  {
    key: "summary",
    title: "MALİYETE GİREN AĞIRLIKLAR",
    fields: [
      { key: "w.steel", label: "Vinç Çelik Ağırlığı", unit: "kg", decimals: 0, sum: true, hint: "Hammadde, lazer kesim ve imalat işçiliği bunu okur" },
      { key: "w.steelWithFire", label: "Çelik + Fire", unit: "kg", decimals: 0, sum: true, hint: "İmalat işçiliği miktarı — fire oranı Katsayılar bölümündedir" },
      { key: "w.total", label: "TOPLAM VİNÇ AĞIRLIĞI", unit: "kg", decimals: 0, sum: true, hint: "Boya miktarı ve €/kg bunu okur" },
    ],
  },
];

// —————————————————————————————————————————————————————— hesaplar

function kaldirmaAlanlari(onek: string, ad: string): CostFieldDef[] {
  return [
    { key: `${onek}RopeCount`, label: `${ad} — Halat Adedi`, unit: "", decimals: 0 },
    { key: `${onek}RopeLoadKg`, label: `${ad} — Halat Yükü`, unit: "kg", decimals: 0 },
    { key: `${onek}DrumDiaMm`, label: `${ad} — Tambur Çapı`, unit: "mm", decimals: 0 },
    { key: `${onek}DrumMomentNm`, label: `${ad} — Tambur Momenti`, unit: "Nm", decimals: 0 },
    { key: `${onek}FinalMomentNm`, label: `${ad} — Final Moment`, unit: "Nm", decimals: 0, hint: "Tambur momenti × sınıf emniyet katsayısı" },
    { key: `${onek}RopeSpeedMpm`, label: `${ad} — Halat Hızı`, unit: "m/dk", decimals: 1 },
    { key: `${onek}GearRatio`, label: `${ad} — Tahvil Oranı`, unit: "", decimals: 2 },
    { key: `${onek}MotorMomentNm`, label: `${ad} — Motor Momenti`, unit: "Nm", decimals: 1 },
    { key: `${onek}CalcPowerKw`, label: `${ad} — Hesap Gücü`, unit: "kW", decimals: 2 },
    { key: `${onek}ReqPowerKw`, label: `${ad} — Sıcaklık Dahil Güç`, unit: "kW", decimals: 2 },
    { key: `${onek}MotorKw`, label: `${ad} — SEÇİLEN MOTOR`, unit: "kW", decimals: 2, sum: true },
    { key: `${onek}DriveKw`, label: `${ad} — Sürücü`, unit: "kW", decimals: 2, hint: "Seçilen motorun 1,35 katı (%180 akım şartı)" },
    { key: `${onek}GearboxKg`, label: `${ad} — Redüktör Ağırlığı`, unit: "kg", decimals: 0 },
  ];
}

function yurutmeAlanlari(onek: string, ad: string): CostFieldDef[] {
  return [
    { key: `${onek}DriveCount`, label: `${ad} — Tahrik Adedi`, unit: "", decimals: 0 },
    { key: `${onek}CalcPowerKw`, label: `${ad} — Hesap Gücü (motor başına)`, unit: "kW", decimals: 3 },
    { key: `${onek}MotorKw`, label: `${ad} — SEÇİLEN MOTOR`, unit: "kW", decimals: 2, sum: true },
    { key: `${onek}DriveUnits`, label: `${ad} — Sürücü Adedi`, unit: "", decimals: 0, hint: "Bir sürücü karşılıklı iki tahriki sürer" },
    { key: `${onek}DriveKw`, label: `${ad} — Sürücü`, unit: "kW", decimals: 2 },
  ];
}

export const CALC_SECTIONS: readonly CostFieldSection[] = [
  { key: "hoist", title: "ANA KALDIRMA MEKANİZMASI", fields: kaldirmaAlanlari("c.hoist", "K1") },
  { key: "auxHoist", title: "YARDIMCI KALDIRMA MEKANİZMASI", fields: kaldirmaAlanlari("c.auxHoist", "K2") },
  {
    key: "wheels",
    title: "TEKERLEKLER",
    fields: [
      { key: "c.bridgeWheelLoadT", label: "Köprü / Portal Teker Yükü", unit: "ton", decimals: 2 },
      { key: "c.bridgeWheelDiaMm", label: "Köprü / Portal Teker Çapı", unit: "mm", decimals: 0 },
      { key: "c.wheelSpeedStep", label: "Hız Kaynaklı Boy Artışı", unit: "kademe", decimals: 0 },
      { key: "c.bridgeWheelEffDiaMm", label: "KÖPRÜ / PORTAL ETKİN ÇAP", unit: "mm", decimals: 0, sum: true },
      { key: "c.bridgeWheelCount", label: "Köprü / Portal Teker Adedi", unit: "", decimals: 0, readOnly: true, hint: "Girdiler bölümünden değişir" },
      { key: "c.trolleyWheelLoadT", label: "Araba Teker Yükü", unit: "ton", decimals: 2 },
      { key: "c.trolleyWheelDiaMm", label: "Araba Teker Çapı", unit: "mm", decimals: 0 },
      { key: "c.trolleyWheelEffDiaMm", label: "ARABA ETKİN ÇAP", unit: "mm", decimals: 0, sum: true },
      { key: "c.trolleyWheelCount", label: "Araba Teker Adedi", unit: "", decimals: 0, readOnly: true },
    ],
  },
  { key: "bridgeTravel", title: "KÖPRÜ / PORTAL YÜRÜTME", fields: yurutmeAlanlari("c.bridge", "Köprü") },
  { key: "trolleyTravel", title: "ARABA YÜRÜTME", fields: yurutmeAlanlari("c.trolley", "Araba") },
  {
    key: "girder",
    title: "KİRİŞ VE SEHİM",
    fields: [
      { key: "c.girderCount", label: "Kiriş Adedi", unit: "", decimals: 0, readOnly: true, hint: "Girdiler bölümünden değişir" },
      { key: "c.spanCm", label: "Açıklık", unit: "cm", decimals: 0 },
      { key: "c.wheelbaseCm", label: "Araba Teker Mesafesi (b)", unit: "cm", decimals: 0 },
      { key: "c.overhangCm", label: "Mesnet–Yük Mesafesi (a)", unit: "cm", decimals: 0 },
      { key: "c.girderWheelLoadKg", label: "Kiriş Başına Teker Yükü (P)", unit: "kg", decimals: 0 },
      { key: "c.deflectionLimit", label: "Sehim Limiti (L/x)", unit: "", decimals: 0, hint: "Vinç sınıfından gelir" },
      { key: "c.requiredInertiaCm4", label: "Gerekli Atalet", unit: "cm⁴", decimals: 0 },
      { key: "c.sectionInertiaCm4", label: "Seçilen Kesit Ataleti", unit: "cm⁴", decimals: 0 },
      { key: "c.girderKgPerM", label: "Kiriş Metre Ağırlığı (perde + ray dahil)", unit: "kg/m", decimals: 1 },
      { key: "c.deflectionCm", label: "Sehim", unit: "cm", decimals: 3 },
      // SEHİM ORANI BİR SONUÇTUR, bir seçim değil: onu ezmek "kiriş yeterli"
      // demenin sayıyı değiştirmeden yoludur. Kesit yetmiyorsa düzeltilecek
      // yer kesit ya da açıklıktır.
      { key: "c.deflectionRatio", label: "SEHİM ORANI (L/x)", unit: "", decimals: 0, sum: true, readOnly: true },
    ],
  },
  {
    key: "gantry",
    title: "PORTAL AYAK MODELİ",
    fields: [
      { key: "c.cornerLoadT", label: "Köşe Yükü", unit: "ton", decimals: 1 },
      { key: "c.legUnitKgPerM", label: "Ayak Birim Ağırlığı", unit: "kg/m", decimals: 2 },
    ],
  },
  {
    key: "power",
    title: "ELEKTRİK",
    fields: [
      { key: "c.installedKw", label: "KURULU GÜÇ", unit: "kW", decimals: 2, sum: true },
      { key: "c.supplyCurrentA", label: "Besleme Akımı (≈, 400 V 3~)", unit: "A", decimals: 0 },
    ],
  },
  {
    key: "class",
    title: "SINIF KATSAYILARI",
    fields: [
      // Bunlar VİNÇ SINIFININ ve ORTAM SICAKLIĞININ tekrarıdır; burada
      // ezilseydi girdi kutusuyla çelişen ikinci bir sınıf doğardı.
      { key: "c.classSafety", label: "Mekanizma Emniyet Katsayısı", unit: "×", decimals: 2, readOnly: true },
      { key: "c.classWeight", label: "Ağırlık Katsayısı", unit: "×", decimals: 2, readOnly: true },
      { key: "c.tempFactor", label: "Sıcaklık Katsayısı", unit: "×", decimals: 2, readOnly: true },
      { key: "c.deflectionLimit", label: "Sehim Limiti", unit: "L/x", decimals: 0, readOnly: true },
    ],
  },
];

/** Anahtardan alan tanımı — ekran ve PDF etiket ararken bunu çağırır. */
const ALAN_HARITASI: Record<string, CostFieldDef> = Object.fromEntries(
  [...WEIGHT_SECTIONS, ...CALC_SECTIONS].flatMap((s) => s.fields.map((f) => [f.key, f]))
);

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

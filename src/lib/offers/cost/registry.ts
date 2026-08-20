// MALİYET DEFTERİ — hangi grupta hangi satırlar var, miktarını ne besliyor.
//
// Teklifin `registry.ts`inin ikizidir ve aynı işi yapar: bir belgenin
// İSKELETİNİ tanımlar. Aradaki tek fark, teklif satırının bir METİN, maliyet
// satırının bir SAYI taşımasıdır.
//
// DÖRT ANA BAŞLIK KULLANICININ KENDİ TARİFİDİR (17.08.2026): *"maliyet
// kalemlerini Proje Maliyet, Sabit Maliyetler, Sarf Maliyetler, Finansman
// Maliyetleri olarak 4 ana başlıkta giriş yapacağım."* Aşağıdaki gruplar
// PROJE MALİYETİNİN alt kırılımıdır; öteki üçü oranla hesaplanır ve kendi
// tipindedir (`CostRateGroup`).
//
// SIRA BELGENİN SIRASIDIR: çelikten başlar, mekanizmayla sürer, elektrikle
// biter ve atölye/saha en sonda durur — devralınan maliyet çalışmasının
// "MALİYET KIRILIMI" sayfasındaki düzenin aynısı. Kırılım ekranı ve iç PDF bu
// sırayı okur, kendi sırasını kurmaz.

// ŞABLON EŞLEŞMESİ KATLANMIŞ METİNLEDİR (`trKatla`): defterdeki "PORTAL VİNÇ"
// ile teklif kalemindeki "Portal Vinç" tek tiptir. Modül SAFTIR (değişmez
// md. 7) — `trKatla` de saftır, `payload.ts` zaten aynı yerden `trSayi` okur.
import { trKatla } from "@/lib/drawings/tr-text";
import type { OfferPayload } from "../types";
import type {
  CostGroupDef,
  CostLineDef,
  CostMaterialPriceDef,
  CostRateGroup,
  CostTemplate,
  CostTemplateSkeleton,
} from "./types";

/**
 * Fiyat satırının birimi — yalnız gösterim, hesaba girmez.
 *
 * LİSTEDİR ÇÜNKÜ EKRANDA BİR SEÇİCİDİR (kullanıcı isteği 18.08.2026, md. 11).
 * Serbest metin kutusu "adet", "Adet" ve "ad." üretiyordu; üçü de aynı şeydi
 * ama hiçbiri ötekiyle eşleşmiyordu. LİSTE KAPALI DEĞİLDİR: belgede yazılı
 * olup listede olmayan bir birim ekranda seçeneklere EKLENİR — eski bir
 * belgenin birimi, listeyi daralttık diye kaybolmamalıdır.
 */
export const COST_UNITS = ["kg", "adet", "takım", "ton", "m", "saat"] as const;

/**
 * HAMMADDE BİRİM FİYATLARI — Proje Maliyeti'nin en üstündeki şerit.
 *
 * Kullanıcı listesi ve sırası (18.08.2026): *"Sac Profil Ray Kesim Boya İş.
 * Boya Çelik İmalat İşçiliği fiyatlarını en üste yanyana sırala ben buraya
 * gireyim."* Sıra ekranın sırasıdır.
 *
 * KOD DEĞERLERİ VERİTABANI DEFTERİNİN TOHUMU ve göç uygulanmamış görsel
 * önizlemelerin yedeğidir. Canlı yeni maliyet çalışması bu listeyi doğrudan
 * kullanmaz; Hammadde Fiyatları defterindeki güncel değerlerin ANLIK KOPYASINI
 * alır. Belge içindeki kopya daha sonra bağımsız değiştirilebilir.
 *
 * BU BİR "ORTALAMA FİYAT TABLOSU" DEĞİLDİR (MALIYET-4 çiğnenmiyor). O kural
 * FİYAT ARAMALI TABLOLARA karşıdır: kapasiteye bakıp motorun kaç € olduğunu
 * söyleyen bir tablo, teklifi verirken doğru görünüp iş alındığında tutmayan
 * bir sayı üretir. Buradaki sekiz sayı ise aranmaz, GÖRÜNÜR: şeritte, kutunun
 * içinde, düzeltilmeyi bekleyerek durur. Kullanıcının kendi verdiği açılış
 * değerleridir ve belgeye kopyalandığı an o belgenin malı olurlar (MALIYET-6).
 *
 * RAY İKİYE AYRIDIR: kare ray ile A tipi ray aynı satın alma kalemi değildir.
 * Tek bir "Ray" fiyatı, kullanılan ray tipini görünmez kılar ve maliyetin
 * hangi güncel değerden oluştuğunu doğrulamayı engeller.
 */
export const MATERIAL_PRICE_DEFS: readonly CostMaterialPriceDef[] = [
  { key: "sac", label: "SAC", unit: "kg", value: 0.7, hint: "HAMMADDE — SAC satırını besler" },
  { key: "profil", label: "PROFİL", unit: "kg", value: 0.7 },
  { key: "rayKare", label: "KARE RAY", unit: "kg", value: 0.9 },
  { key: "rayA", label: "A TİPİ RAY", unit: "kg", value: 1.1 },
  { key: "kesim", label: "KESİM", unit: "kg", value: 0.1, hint: "Lazer / CNC kesim" },
  { key: "celikIsciligi", label: "ÇELİK İMALAT İŞÇİLİĞİ", unit: "kg", value: 0.74 },
  { key: "boya", label: "BOYA", unit: "kg", value: 0.08, hint: "Boya malzemesi" },
  { key: "boyaIsciligi", label: "BOYA İŞÇİLİĞİ", unit: "kg", value: 0.07 },
];

export const MATERIAL_PRICE_DEFAULTS: Readonly<Record<string, number | null>> = Object.freeze(
  Object.fromEntries(MATERIAL_PRICE_DEFS.map((d) => [d.key, d.value]))
);

export function materialPriceDef(key: string | undefined): CostMaterialPriceDef | undefined {
  return key ? MATERIAL_PRICE_DEFS.find((d) => d.key === key) : undefined;
}

/**
 * Bir maliyet satırının teklifteki KARŞILIĞI.
 *
 * Kullanıcı isteği (17.08.2026): *"bu detaylara da teklif'ten otomatik
 * satırların gelmesi."* Bağ bir METİN eşleşmesi değil, defterdeki satırın
 * ANAHTARIDIR (`mainHoist` + `motor`): teklifte "Motor : GAMAK 30 kW 1500
 * d/dak" yazan satır, maliyette "Kaldırma Motoru" satırının notuna düşer.
 * Böylece maliyeti girerken hangi motoru fiyatladığın ekranda yazar.
 */
export interface CostOfferRef {
  group: string;
  row: string;
}

interface Satir extends CostLineDef {
  offerRef?: CostOfferRef;
}

// ————————————————————————————————————————————————————— çelik yapı

/**
 * MODEL ÇELİĞİ TEK KALEMDE TARTAR.
 *
 * `w.steel` sacı, profili ve kiriş üstündeki rayı AYIRMAZ — ray ve diyafram
 * payı kiriş metre ağırlığına `girderExtraRatio` ile girer. Bu yüzden Profil
 * ve Ray satırlarının miktarı MODELDEN GELMEZ, elle yazılır: bir model
 * anahtarı uydurup çeliği ikiye bölmek, aynı kiloyu iki satırda birden
 * fiyatlamanın sessiz yoluydu. Miktar boş kaldığı sürece satır toplama da
 * girmez (MALIYET-13).
 */
const AYRI_TARTILMAZ = "Miktar modelden gelmez — model çeliği tek kalemde tartar; yazarsanız sac satırından düşün";

const CELIK: Satir[] = [
  // SAC MİKTARI FİRE DAHİL AĞIRLIKTIR (kullanıcı kararı 18.08.2026:
  // *"maliyetlerde Hammadde — Sac'ın ağırlığı Çelik + Fire ağırlığı
  // getir."*). Bu, MALIYET-14'ün ilk yazımını DÜZELTİR: orada "sac zaten
  // fireli ölçüde satın alınır ve kesim artığı stoğa döner" deniyordu, yani
  // fire sac satırına binmiyordu. Satın alan taraf başka türlü ölçüyor —
  // fatura edilen kilo kesilen kilo değil, GELEN kilodur.
  //
  // KESİM DE FİRE DAHİL AĞIRLIĞI OKUR (kullanıcı kararı 19.08.2026): *"Lazer /
  // CNC Kesim maliyeti çelik + fire ağırlığından beslensin."* Bir önceki yazım
  // tersini söylüyordu ("lazer yalnız parçanın konturunu keser") ve YANLIŞ ŞEYİ
  // ÖLÇÜYORDU: tezgâh, kesilen parçanın değil MAKİNEYE GİREN levhanın kilosu
  // üzerinden fiyatlanır ve fire yüzünden yeniden yapılan parça ikinci kez
  // kesilir. Aynı payı iki kez faturalandırmak da değildir — sac MALZEMENİN,
  // kesim TEZGÂHIN bedelidir; ikisi de aynı levha üzerinden ölçülür.
  //
  // KAYITLI BELGELER KENDİLİĞİNDEN DEĞİŞMEZ: satır kendi `qtySource`unu taşır
  // ve okuma yolu (`withCostDefaults`) ona dokunmaz; defterin yeni kaynağı
  // ancak "Tekliften Tazele" ya da yeni bir M revizyonu ile gelir
  // (`withDefterLines`). Yayımlanmış bir maliyetin tutarı bu yüzden kaymaz.
  { key: "rawMaterial", label: "HAMMADDE — SAC", unit: "kg", qtySource: "w.steelWithFire", priceSource: "sac", hint: "Çelik + fire ağırlığı × sac fiyatı", offerRef: { group: "steel", row: "girderMaterial" } },
  { key: "profile", label: "HAMMADDE — PROFİL", unit: "kg", priceSource: "profil", hint: AYRI_TARTILMAZ },
  // RAY İKİ SATIRDIR çünkü İKİ FİYATTIR (kullanıcı listesi 18.08.2026: kare
  // 0,90 · A tipi 1,20 €/kg). Bir vinçte ikisinden yalnız biri kullanılır ve
  // ötekinin miktarı BOŞ kalır — boş miktarlı satır toplama girmez
  // (MALIYET-13), o yüzden iki satırın birden durması bir şey bozmaz.
  // `rail` ANAHTARI KORUNDU: alan yokken kaydedilmiş belgelerdeki ray satırı
  // yetim kalmamalıdır (boya satırının `paint` anahtarıyla aynı gerekçe).
  { key: "rail", label: "RAY — KARE", unit: "kg", priceSource: "rayKare", hint: AYRI_TARTILMAZ },
  { key: "railA", label: "RAY — A TİPİ", unit: "kg", priceSource: "rayA", hint: AYRI_TARTILMAZ },
  { key: "laserCut", label: "LAZER / CNC KESİM", unit: "kg", qtySource: "w.steelWithFire", priceSource: "kesim" },
  // BOYA İKİYE AYRILDI (kullanıcı listesi 18.08.2026: "Boya İş." ve "Boya"
  // ayrı fiyatlardır). Anahtar `paint` KORUNDU — eski belgelerdeki girilmiş
  // boya fiyatı bir anahtar değişikliği yüzünden yetim kalmamalıdır.
  { key: "paint", label: "BOYA MALZEMESİ", unit: "kg", qtySource: "w.total", priceSource: "boya", hint: "TOPLAM vinç ağırlığı — boya mekanizmanın da üstüne atılır", offerRef: { group: "steel", row: "paint" } },
  { key: "paintLabour", label: "BOYA İŞÇİLİĞİ", unit: "kg", qtySource: "w.total", priceSource: "boyaIsciligi" },
];

// ————————————————————————————————————————————————— imalat maliyeti

/**
 * İMALAT MALİYETİ — BEŞİNCİ ANA BAŞLIK, en üstte.
 *
 * Kullanıcı isteği (18.08.2026, md. 4): *"Maliyet kısmını 4 ana başlık
 * demiştik. Bunu 5 Ana Başlığa çevirmek istiyorum. Ekleyeceğimiz madde İmalat
 * Maliyeti olacak. Çelik İmalat İşçiliği (fire dahil) olan kalemi, İmalat
 * Maliyet olarak en üste yeni grup aç."*
 *
 * SATIR ÇELİK YAPI'DAN TAŞINDI, KOPYALANMADI: aynı işçilik iki başlıkta
 * birden dursaydı toplam onu iki kez sayardı. Anahtar `fabrication` KORUNDU —
 * eski belgelerde girilmiş €/kg ve elle düzeltilmiş miktar, taşıma sırasında
 * satırla birlikte yeni gruba geçer (`withFabricationGroup`).
 *
 * MİKTAR VİNCİN ÇELİK AĞIRLIĞIDIR, FİRE DAHİL (`w.steelWithFire`) — kullanıcı
 * cümlesi *"standart olarak vincin ağırlığı ile çarpılacak"* zaten bugünkü
 * davranışı tarif ediyor.
 *
 * FİRE ARTIK YALNIZ İŞÇİLİĞE BİNMİYOR. MALIYET-14 "fire yalnız işçiliğe biner"
 * diye yazılmıştı (sac fireli ölçüde alınır, kesim artığı stoğa döner);
 * kullanıcı 18.08.2026'da SACI, 19.08.2026'da KESİMİ de fireli kiloya bağladı
 * ve gerekçe tek cümledir — üçü de fabrikaya GİREN levhayı ölçer, kesilen
 * parçayı değil. Anahtarın AYRI durmasının sebebi değişmedi: çarpan satırın
 * arkasına saklansaydı, işçilik miktarının neden çelik ağırlığından büyük
 * olduğu ekrandan okunamazdı.
 */
const IMALAT: Satir[] = [
  {
    key: "fabrication",
    label: "ÇELİK İMALAT İŞÇİLİĞİ (FİRE DAHİL)",
    unit: "kg",
    qtySource: "w.steelWithFire",
    priceSource: "celikIsciligi",
    hint: "Fire oranı miktara yansır; katsayı Katsayılar bölümündedir",
  },
];

// —————————————————————————————————————————————————— kaldırma grubu

/**
 * Ana ve yardımcı kaldırma AYNI satırları taşır.
 *
 * Ayıran tek şey teklifteki karşılığıdır: ana grup `mainHoist` satırlarını,
 * yardımcı grup `auxHoist` satırlarını okur. İki ayrı liste yazılsaydı bir
 * kaleme eklenen satır ötekinde unutulurdu — yardımcı kaldırma zaten seyrek
 * kullanılır ve eksikliği en geç fark edilen yerdir.
 *
 * ADET FREN SATIRINDA BOŞ BAŞLAR: kaldırmada çoğunlukla iki fren vardır ama
 * "çoğunlukla" bir sayı değildir; miktarı insan yazar (değişmez md. 4).
 */
function kaldirmaSatirlari(offerGroup: string): Satir[] {
  return [
    { key: "motor", label: "KALDIRMA MOTORU", unit: "adet", qtySource: "c.one", hint: "Seçilen güç Hesaplar sayfasındadır", offerRef: { group: offerGroup, row: "motor" } },
    { key: "gearbox", label: "KALDIRMA REDÜKTÖRÜ", unit: "adet", qtySource: "c.one", offerRef: { group: offerGroup, row: "gearbox" } },
    // KAPLİN HER İKİ MEKANİZMADA DA VARDIR (kullanıcı isteği 18.08.2026,
    // md. 5): motor–redüktör ve redüktör–tambur bağlantıları kaldırmada da
    // kaplinlidir; defterde yalnız yürütme tarafında durması bir eksiklikti.
    // ADET DEĞİL TAKIM: bir mekanizmada kaç kaplin olduğu tasarıma bağlıdır
    // ve "çoğunlukla iki" bir sayı değildir (değişmez md. 4).
    { key: "coupling", label: "KAPLİN SETLERİ", unit: "takım", qtySource: "c.one" },
    { key: "brake", label: "KALDIRMA FRENLERİ", unit: "adet", offerRef: { group: offerGroup, row: "brake" } },
    { key: "drum", label: "TAMBUR", unit: "adet", qtySource: "c.one", hint: "Çap ve ağırlık Hesaplar/Ağırlıklar sayfasındadır" },
    { key: "machining", label: "TALAŞLI İMALAT", unit: "takım", qtySource: "c.one", hint: "Mil, makara, burç, teker işleme" },
    // BORVERK KENDİ SATIRIDIR (kullanıcı isteği 19.08.2026): tambur ve kanca
    // bloğu gövdelerinin yatak delikleri büyük delik işleme tezgâhında açılır.
    // Bugüne kadar "Talaşlı İmalat"ın içinde saklıydı ve tezgâh saati torna
    // saatiyle tek fiyata sıkışıyordu; hangi işin pahalıya geldiği ekrandan
    // okunamıyordu — RAY satırının ikiye ayrılmasıyla aynı gerekçe.
    //
    // BİRİM TAKIM, MİKTAR BİR: kardeşi "Talaşlı İmalat" da öyledir. Saat
    // cinsinden bir miktarı model ÜRETMEZ ve "çoğunlukla şu kadar saat" bir
    // sayı değildir (değişmez md. 4); saatle fiyatlayan kullanıcı miktarı elle
    // devralır (`qtyManual`).
    { key: "borverk", label: "BORVERK İŞLEME", unit: "takım", qtySource: "c.one", hint: "Büyük delik işleme tezgâhı — tambur ve yatak gövdesi delikleri" },
    { key: "hookBlock", label: "KANCA BLOĞU / TRAVERS", unit: "takım", qtySource: "c.one", offerRef: { group: offerGroup, row: "hook" } },
    { key: "bearings", label: "RULMANLAR", unit: "takım", qtySource: "c.one" },
    { key: "rope", label: "HALAT VE SOKETLER", unit: "takım", qtySource: "c.one", offerRef: { group: offerGroup, row: "rope" } },
    { key: "encoder", label: "ENKODER", unit: "adet", qtySource: "c.one" },
    { key: "loadpin", label: "LOADPİN / TARTIM", unit: "adet", qtySource: "c.one" },
    { key: "drumLimit", label: "TAMBUR LİMİTİ", unit: "adet", qtySource: "c.one" },
    { key: "weightLimit", label: "AĞIRLIK LİMİT ŞALTERİ", unit: "adet", qtySource: "c.one" },
  ];
}

const KALDIRMA = kaldirmaSatirlari("mainHoist");
const YRD_KALDIRMA = kaldirmaSatirlari("auxHoist");

// —————————————————————————————————————————————— yürütme ve teker

const YURUTME: Satir[] = [
  // YÜRÜTME KAPLİNİ İKİYE AYRILDI (kullanıcı isteği 18.08.2026, md. 5:
  // "yürütme gruplarına" — çoğul). Köprü ve araba yürütmesi zaten ayrı motor,
  // ayrı redüktör ve ayrı teker satırları taşıyor; kaplinin tek satırda
  // kalması, iki ayrı tedarik kalemini tek fiyata sıkıştırıyordu.
  //
  // `coupling` ANAHTARI KÖPRÜDE KORUNDU: eski belgelerde girilmiş kaplin
  // fiyatı bir anahtar değişikliği yüzünden yetim kalmamalıdır (ray satırının
  // aynı gerekçesi).
  { key: "coupling", label: "KÖPRÜ / PORTAL KAPLİN SETLERİ", unit: "takım", qtySource: "c.one" },
  { key: "trolleyCoupling", label: "ARABA KAPLİN SETLERİ", unit: "takım", qtySource: "c.one" },
  { key: "bridgeMotor", label: "KÖPRÜ / PORTAL YÜRÜTME MOTORLARI", unit: "adet", qtySource: "c.bridgeDriveCount", offerRef: { group: "bridge", row: "motor" } },
  { key: "bridgeGearbox", label: "KÖPRÜ / PORTAL YÜRÜTME REDÜKTÖRLERİ", unit: "adet", qtySource: "c.bridgeDriveCount", offerRef: { group: "bridge", row: "gearbox" } },
  { key: "trolleyMotor", label: "ARABA YÜRÜTME MOTORLARI", unit: "adet", qtySource: "c.trolleyDriveCount", offerRef: { group: "trolley", row: "motor" } },
  { key: "trolleyGearbox", label: "ARABA YÜRÜTME REDÜKTÖRLERİ", unit: "adet", qtySource: "c.trolleyDriveCount", offerRef: { group: "trolley", row: "gearbox" } },
  { key: "bridgeWheels", label: "KÖPRÜ / PORTAL TEKERLEKLERİ", unit: "adet", qtySource: "c.bridgeWheelCount", hint: "Çap Hesaplar sayfasında", offerRef: { group: "bridge", row: "wheel" } },
  { key: "trolleyWheels", label: "ARABA TEKERLEKLERİ", unit: "adet", qtySource: "c.trolleyWheelCount", offerRef: { group: "trolley", row: "wheel" } },
  // TEKER GÖBEĞİ DE BORVERKTE İŞLENİR (kullanıcı isteği 19.08.2026: "hem
  // kaldırma hem yürütme teker grubuna"). Anahtar kaldırmadakiyle AYNIDIR ve
  // bu bir çakışma değildir: satır anahtarı GRUP İÇİNDE tekildir, belge
  // genelinde değil (`coupling` bugün üç grupta yaşıyor).
  { key: "borverk", label: "BORVERK İŞLEME", unit: "takım", qtySource: "c.one", hint: "Büyük delik işleme tezgâhı — teker göbeği ve yatak delikleri" },
  { key: "buffers", label: "TAMPONLAR", unit: "adet" },
];

// ——————————————————————————————————————————— elektrik ve otomasyon

const ELEKTRIK: Satir[] = [
  { key: "hoistDrive", label: "KALDIRMA SÜRÜCÜSÜ", unit: "adet", qtySource: "c.one", hint: "Boyu Hesaplar sayfasında (motorun bir üstü)" },
  { key: "bridgeDrive", label: "KÖPRÜ / PORTAL SÜRÜCÜLERİ", unit: "adet", qtySource: "c.bridgeDriveUnits" },
  { key: "trolleyDrive", label: "ARABA SÜRÜCÜSÜ", unit: "adet", qtySource: "c.trolleyDriveUnits" },
  { key: "panels", label: "ELEKTRİK PANOLARI", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "panel" } },
  { key: "brakeResistors", label: "FRENLEME DİRENÇLERİ", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "resistors" } },
  { key: "isolationTrafo", label: "İZOLASYON TRAFOSU", unit: "adet", qtySource: "c.one", offerRef: { group: "electrical", row: "isolationTrafo" } },
  { key: "powerSupply", label: "GÜÇ KAYNAĞI VE KLEMENSLER", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "powerSupply" } },
  { key: "electricalLabour", label: "ELEKTRİK / OTOMASYON İŞÇİLİĞİ", unit: "takım", qtySource: "c.one" },
  { key: "switchgear", label: "SARF VE ŞALT MALZEMESİ", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "switchgear" } },
  { key: "cables", label: "KABLOLAR VE FESTOON", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "cable" } },
  { key: "cableTray", label: "KABLO TAVA / KANAL", unit: "takım", qtySource: "c.one" },
  { key: "travelLimits", label: "YÜRÜTME LİMİT SETİ", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "crossLimit" } },
  { key: "remote", label: "UZAKTAN KUMANDA", unit: "adet", qtySource: "c.one", offerRef: { group: "electrical", row: "pendant" } },
];

// ————————————————————————————————————————————————— atölye ve saha

const ATOLYE: Satir[] = [
  { key: "mechanicalAssembly", label: "MEKANİK MONTAJ (ATÖLYE)", unit: "takım", qtySource: "c.one" },
  { key: "siteAssembly", label: "SAHA MONTAJI VE DEVREYE ALMA", unit: "takım", qtySource: "c.one" },
  { key: "shipping", label: "SEVKİYAT", unit: "takım", qtySource: "c.one" },
  { key: "mobileCrane", label: "MOBİL VİNÇ (SAHA MONTAJI)", unit: "takım", qtySource: "c.one" },
  { key: "fasteners", label: "BAĞLANTI ELEMANLARI", unit: "ton", qtySource: "c.capacityT", hint: "Kapasite × €/ton" },
];

// ————————————————————————————————————————————————— proje geneli

/**
 * PROJE GENELİ — tek bir vince atfedilemeyen götürü giderler.
 *
 * Kaleme değil BELGEYE aittir: üç vinçlik bir teklifte dokümantasyon bir kez
 * yapılır. Kalem kalem dağıtılsaydı iki vinçli bir teklifte aynı iş iki kez
 * fiyatlanırdı; kırılım ekranı payını yine de kalemlere DAĞITARAK gösterir
 * (yüklü maliyet), ama saklanan yer tektir.
 */
const PROJE_GENELI: Satir[] = [
  { key: "documentation", label: "DOKÜMANTASYON VE ONAYLAR", unit: "takım", qtySource: "c.one" },
  { key: "commissioning", label: "DEVREYE ALMA VE EĞİTİM", unit: "takım", qtySource: "c.one" },
  { key: "factoryTests", label: "FABRİKA TESTLERİ VE MUAYENE", unit: "takım", qtySource: "c.one" },
  { key: "siteOverhead", label: "İSG VE ŞANTİYE GENEL GİDERLERİ", unit: "takım", qtySource: "c.one" },
  { key: "packaging", label: "PAKETLEME VE AMBALAJ", unit: "takım", qtySource: "c.one" },
];

// ————————————————————————————————————————————————————— gruplar

export const GENERAL_GROUP_KEY = "general";
/**
 * İMALAT MALİYETİ grubunun anahtarı — ekran onu AYRI BİR ANA BAŞLIK olarak
 * çizer, toplam da onu proje maliyetinden ayrı gösterir (`costTotals`).
 * Sabittir ve çağrı yerinde dize yazılmaz.
 */
export const FABRICATION_GROUP_KEY = "fabrication";
export const CUSTOM_COST_GROUP_KEY = "custom";

export const COST_GROUP_DEFS: readonly CostGroupDef[] = [
  // İMALAT EN ÜSTTEDİR (kullanıcı isteği md. 4) — belgede ve ekranda.
  { key: FABRICATION_GROUP_KEY, title: "İMALAT MALİYETİ", lines: IMALAT },
  { key: "steel", title: "ÇELİK YAPI", lines: CELIK },
  { key: "hoist", title: "KALDIRMA GRUBU", lines: KALDIRMA },
  { key: "auxHoist", title: "YARDIMCI KALDIRMA GRUBU", lines: YRD_KALDIRMA },
  { key: "travel", title: "YÜRÜTME VE TEKER", lines: YURUTME },
  { key: "electrical", title: "ELEKTRİK VE OTOMASYON", lines: ELEKTRIK },
  { key: "assembly", title: "ATÖLYE VE SAHA", lines: ATOLYE },
  { key: GENERAL_GROUP_KEY, title: "PROJE GENELİ", lines: PROJE_GENELI },
];

export const COST_GROUP_DEF_BY_KEY: Record<string, CostGroupDef> = Object.fromEntries(
  COST_GROUP_DEFS.map((g) => [g.key, g])
);

/** Bir maliyet satırının defterdeki tanımı; bilinmiyorsa `undefined`. */
export function costLineDef(groupKey: string, lineKey: string): Satir | undefined {
  return COST_GROUP_DEF_BY_KEY[groupKey]?.lines.find((l) => l.key === lineKey) as Satir | undefined;
}

/**
 * KÖPRÜ ve PORTAL AYNI SATIRLARI taşır; hangisi varsa o okunur.
 *
 * Defter yürütme satırlarını `bridge` altında tarif eder ama bir portal
 * vinçte o grup `gantry`dir. İkisi için ayrı `offerRef` yazmak defteri iki
 * katına çıkarır ve yeni bir satır eklendiğinde birinde unutulurdu; eşleme
 * TEK yerde, burada durur.
 */
const ESDEGER_GRUPLAR: Record<string, readonly string[]> = {
  bridge: ["bridge", "gantry", "boom"],
  gantry: ["gantry", "bridge", "boom"],
  trolley: ["trolley", "auxTrolley"],
};

/**
 * MALİYET SATIRININ TEKLİFTEKİ KARŞILIĞI — basılan değer.
 *
 * Kullanıcı isteği (17.08.2026): *"bu detaylara da teklif'ten otomatik
 * satırların gelmesi."* Maliyette "Kaldırma Motoru" satırını fiyatlarken
 * teklifte ne yazdığı (`GAMAK 30 kW 1500 d/dak`) yanında görünür.
 *
 * DEĞER SAKLANMAZ, HER OKUMADA TEKLİFTEN ALINIR. Saklansaydı teklif
 * düzeltildiğinde maliyetteki not eskisini göstermeye devam ederdi ve iki
 * belge sessizce ayrışırdı (TEKLIF-20'nin tek okuma noktası kuralı). Bağ
 * SATIRIN ANAHTARIYLA kurulur, metin benzerliğiyle değil (TEKLIF-7).
 */
export function offerRefValue(
  offer: OfferPayload,
  offerItemId: string | null,
  groupKey: string,
  lineKey: string
): string | null {
  if (!offerItemId) return null;
  const ref = costLineDef(groupKey, lineKey)?.offerRef;
  if (!ref) return null;
  const item = offer.items.find((i) => i.id === offerItemId);
  if (!item) return null;
  for (const aday of ESDEGER_GRUPLAR[ref.group] ?? [ref.group]) {
    const g = item.groups.find((x) => x.key === aday);
    const v = g?.rows.find((r) => r.key === ref.row)?.value?.trim();
    if (v) return v;
  }
  return null;
}

/** Kaleme ait varsayılan gruplar — yardımcı kaldırma teklifte varsa eklenir. */
export const DEFAULT_ITEM_GROUP_KEYS = [
  FABRICATION_GROUP_KEY,
  "steel",
  "hoist",
  "travel",
  "electrical",
  "assembly",
] as const;

/**
 * VARSAYILAN İSKELET — vinç tipine şablon yazılmamışsa uygulanan küme.
 *
 * ŞABLON DEFTERİNİN TOHUMU DA BUDUR: `offer_cost_templates` seed'i elle
 * yazılmaz, bu listeden üretilir (migration başlığındaki komut). İki yerde iki
 * ayrı varsayılan yaşasaydı, defteri tohumlayan göç ile kodun düştüğü küme
 * sessizce ayrışır ve "şablonsuz tip" ile "şablonu varsayılan olan tip" farklı
 * maliyet iskeleti üretirdi.
 */
export function defaultCostSkeleton(): CostTemplateSkeleton {
  return { groupKeys: [...DEFAULT_ITEM_GROUP_KEYS] };
}

/**
 * VİNÇ TİPİNE KARŞILIK GELEN İSKELET; yoksa `undefined` (varsayılana düşülür).
 *
 * ÇEKİRDEK VERİTABANI OKUMAZ (değişmez md. 7): şablonlar dışarıdan, çağrı
 * yerinde okunup PARAMETRE olarak verilir. Eşleşme METİN BENZERLİĞİYLE değil
 * KATLANMIŞ EŞİTLİKLE kurulur — "Portal Vinç" ile "PORTAL VİNÇ" tek tiptir ama
 * "Yarı Portal Vinç" ayrı bir tiptir ve içerme araması onu yanlış şablona
 * bağlardı.
 */
export function costTemplateFor(
  templates: readonly CostTemplate[] | undefined,
  craneType: string | null | undefined
): CostTemplateSkeleton | undefined {
  if (!templates?.length || !craneType) return undefined;
  const aranan = trKatla(craneType);
  if (!aranan) return undefined;
  return templates.find((t) => trKatla(t.craneType) === aranan)?.skeleton;
}

/**
 * BİR GRUPTA AÇILACAK DEFTER SATIRLARI — şablonun kapattıkları düşülür.
 *
 * KAPATMA SİLME DEĞİLDİR: burada süzülen şey yalnız YENİ açılan bir belgeye
 * hangi satırların gireceğidir. Kayıtlı bir maliyet çalışmasındaki satır
 * (fiyatı girilmiş, tedarikçiyle konuşulmuş) bu listeden çıkarılsa bile
 * belgesinde kalır — `withDefterLines` hiçbir satırı silmez.
 */
export function costGroupLineDefs(
  groupKey: string,
  skeleton?: CostTemplateSkeleton
): readonly CostLineDef[] {
  const def = COST_GROUP_DEF_BY_KEY[groupKey];
  if (!def) return [];
  const kapali = skeleton?.closedLines?.[groupKey];
  const kume = new Set(kapali ?? []);
  const sabit = kapali?.length ? def.lines.filter((l) => !kume.has(l.key)) : def.lines;
  // ÖZEL KALEMLERİN miktar ve fiyatı ELLEDİR: iskelette yalnız kimlik, ad ve
  // birim bulunur; `CostLineDef`in kaynak alanları bilerek boş kalır.
  const ozel = skeleton?.customLines?.[groupKey] ?? [];
  return [...sabit, ...ozel.map((l) => ({ key: l.key, label: l.label, unit: l.unit }))];
}

/**
 * TEKLİF GRUBU → MALİYET GRUBU.
 *
 * Teklif kaleminde `auxHoist` bölümü varsa maliyette de yardımcı kaldırma
 * grubu açılır; `gantry` ya da `bridge` bölümü zaten tek bir "YÜRÜTME VE
 * TEKER" grubuna düşer, çünkü ikisi de aynı satırları fiyatlar (motor,
 * redüktör, teker) ve iki ayrı grup ekranı gereksiz yere ikiye bölerdi.
 *
 * ŞABLON VERİLİRSE TABAN KÜME ONDAN GELİR (kullanıcı isteği 19.08.2026,
 * md. 10). Verilmezse — ya da tipin şablonu yoksa — bugünkü varsayılan küme
 * uygulanır; MALIYET-9'un "iskelet teklif kaleminden türer" kuralı böylece
 * şablonsuz her tipte birebir korunur.
 *
 * YARDIMCI KALDIRMA KURALI ŞABLONUN ÜSTÜNDE KALIR ve bu bilinçlidir: o grup
 * bir TERCİH değil bir OLGUDUR — teklif kalemi yardımcı kaldırma bölümü
 * taşıyorsa o vinçte ikinci bir kaldırma mekanizması gerçekten vardır ve
 * maliyeti bir şablon ayarı yüzünden hiç sorulmadan geçilemez. Tersi de
 * mümkündür: şablona açıkça eklenirse teklif taşımasa da açılır.
 */
export function costGroupKeysForOfferItem(
  offerGroupKeys: readonly string[],
  skeleton?: CostTemplateSkeleton
): string[] {
  const taban = skeleton?.groupKeys?.length ? skeleton.groupKeys : DEFAULT_ITEM_GROUP_KEYS;
  const set = new Set<string>(taban);
  if (offerGroupKeys.includes("auxHoist")) set.add("auxHoist");
  // Defter sırası BELGENİN sırasıdır (teklifteki `grupSirasi` ile aynı kural).
  return COST_GROUP_DEFS.filter((g) => g.key !== GENERAL_GROUP_KEY && set.has(g.key)).map((g) => g.key);
}

// ————————————————————————————————————————————————— oranlı gruplar

/**
 * SABİT · SARF · FİNANSMAN — varsayılan oranlar kullanıcının kendi
 * beyanıdır (17.08.2026: *"Sarf %2, finansman %2, sabit giderler %15"*).
 * Uydurulmuş bir sayı yoktur (değişmez md. 4) ve oranlar belgede yaşar:
 * bir teklifte pazarlık gereği düşürülürse geçmiş teklifler etkilenmez.
 */
export const DEFAULT_RATE_GROUPS: readonly Omit<CostRateGroup, "lines">[] = [
  { key: "fixed", title: "SABİT MALİYETLER", mode: "oran", percent: 15 },
  { key: "consumable", title: "SARF MALİYETLER", mode: "oran", percent: 2 },
  { key: "finance", title: "FİNANSMAN MALİYETLERİ", mode: "oran", percent: 2 },
];

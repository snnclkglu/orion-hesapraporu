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

import type { OfferPayload } from "../types";
import type {
  CostGroupDef,
  CostLineDef,
  CostMaterialPriceDef,
  CostRateGroup,
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
 * SEKİZ FİYATIN DA ÖN TANIMI KULLANICININ KENDİ LİSTESİDİR (18.08.2026):
 * *"Sac : 0,7 Euro, Profil : 0,65 Euro, Kare Ray : 0,9 Euro, A Tipi Raylar :
 * 1,2 Euro, Kesim : 0,05 Euro, Çelik İmalat : 0,9 Euro, Boya : 0,08, Boya
 * İşçiliği 0,07 olarak gelsin."*
 *
 * BU BİR "ORTALAMA FİYAT TABLOSU" DEĞİLDİR (MALIYET-4 çiğnenmiyor). O kural
 * FİYAT ARAMALI TABLOLARA karşıdır: kapasiteye bakıp motorun kaç € olduğunu
 * söyleyen bir tablo, teklifi verirken doğru görünüp iş alındığında tutmayan
 * bir sayı üretir. Buradaki sekiz sayı ise aranmaz, GÖRÜNÜR: şeritte, kutunun
 * içinde, düzeltilmeyi bekleyerek durur. Kullanıcının kendi verdiği açılış
 * değerleridir ve belgeye kopyalandığı an o belgenin malı olurlar (MALIYET-6).
 *
 * RAY İKİYE AYRIDIR çünkü FİYATLARI İKİ KATI KADAR AYRIDIR (0,90 ↔ 1,20).
 * Tek bir "Ray" satırı, kare ray kullanan bir vinçte %33 fazla, A tipi ray
 * kullanan bir vinçte %25 eksik maliyet çıkarırdı — ve hangisi olduğu
 * ekrandan okunamazdı.
 */
export const MATERIAL_PRICE_DEFS: readonly CostMaterialPriceDef[] = [
  { key: "sac", label: "Sac", unit: "kg", value: 0.7, hint: "Hammadde — Sac satırını besler" },
  { key: "profil", label: "Profil", unit: "kg", value: 0.65 },
  { key: "rayKare", label: "Kare Ray", unit: "kg", value: 0.9 },
  { key: "rayA", label: "A Tipi Ray", unit: "kg", value: 1.2 },
  { key: "kesim", label: "Kesim", unit: "kg", value: 0.05, hint: "Lazer / CNC kesim" },
  { key: "celikIsciligi", label: "Çelik İmalat İşçiliği", unit: "kg", value: 0.9 },
  { key: "boya", label: "Boya", unit: "kg", value: 0.08, hint: "Boya malzemesi" },
  { key: "boyaIsciligi", label: "Boya İşçiliği", unit: "kg", value: 0.07 },
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
  { key: "rawMaterial", label: "Hammadde — Sac", unit: "kg", qtySource: "w.steel", priceSource: "sac", hint: "Vinç çelik ağırlığı × sac fiyatı", offerRef: { group: "steel", row: "girderMaterial" } },
  { key: "profile", label: "Hammadde — Profil", unit: "kg", priceSource: "profil", hint: AYRI_TARTILMAZ },
  // RAY İKİ SATIRDIR çünkü İKİ FİYATTIR (kullanıcı listesi 18.08.2026: kare
  // 0,90 · A tipi 1,20 €/kg). Bir vinçte ikisinden yalnız biri kullanılır ve
  // ötekinin miktarı BOŞ kalır — boş miktarlı satır toplama girmez
  // (MALIYET-13), o yüzden iki satırın birden durması bir şey bozmaz.
  // `rail` ANAHTARI KORUNDU: alan yokken kaydedilmiş belgelerdeki ray satırı
  // yetim kalmamalıdır (boya satırının `paint` anahtarıyla aynı gerekçe).
  { key: "rail", label: "Ray — Kare", unit: "kg", priceSource: "rayKare", hint: AYRI_TARTILMAZ },
  { key: "railA", label: "Ray — A Tipi", unit: "kg", priceSource: "rayA", hint: AYRI_TARTILMAZ },
  { key: "fabrication", label: "Çelik İmalat İşçiliği (fire dahil)", unit: "kg", qtySource: "w.steelWithFire", priceSource: "celikIsciligi", hint: "Fire oranı miktara yansır; katsayı Katsayılar bölümündedir" },
  { key: "laserCut", label: "Lazer / CNC Kesim", unit: "kg", qtySource: "w.steel", priceSource: "kesim" },
  // BOYA İKİYE AYRILDI (kullanıcı listesi 18.08.2026: "Boya İş." ve "Boya"
  // ayrı fiyatlardır). Anahtar `paint` KORUNDU — eski belgelerdeki girilmiş
  // boya fiyatı bir anahtar değişikliği yüzünden yetim kalmamalıdır.
  { key: "paint", label: "Boya Malzemesi", unit: "kg", qtySource: "w.total", priceSource: "boya", hint: "TOPLAM vinç ağırlığı — boya mekanizmanın da üstüne atılır", offerRef: { group: "steel", row: "paint" } },
  { key: "paintLabour", label: "Boya İşçiliği", unit: "kg", qtySource: "w.total", priceSource: "boyaIsciligi" },
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
    { key: "motor", label: "Kaldırma Motoru", unit: "adet", qtySource: "c.one", hint: "Seçilen güç Hesaplar sayfasındadır", offerRef: { group: offerGroup, row: "motor" } },
    { key: "gearbox", label: "Kaldırma Redüktörü", unit: "adet", qtySource: "c.one", offerRef: { group: offerGroup, row: "gearbox" } },
    { key: "brake", label: "Kaldırma Frenleri", unit: "adet", offerRef: { group: offerGroup, row: "brake" } },
    { key: "drum", label: "Tambur", unit: "adet", qtySource: "c.one", hint: "Çap ve ağırlık Hesaplar/Ağırlıklar sayfasındadır" },
    { key: "machining", label: "Talaşlı İmalat", unit: "takım", qtySource: "c.one", hint: "Mil, makara, burç, teker işleme" },
    { key: "hookBlock", label: "Kanca Bloğu / Travers", unit: "takım", qtySource: "c.one", offerRef: { group: offerGroup, row: "hook" } },
    { key: "bearings", label: "Rulmanlar", unit: "takım", qtySource: "c.one" },
    { key: "rope", label: "Halat ve Soketler", unit: "takım", qtySource: "c.one", offerRef: { group: offerGroup, row: "rope" } },
    { key: "encoder", label: "Enkoder", unit: "adet", qtySource: "c.one" },
    { key: "loadpin", label: "Loadpin / Tartım", unit: "adet", qtySource: "c.one" },
    { key: "drumLimit", label: "Tambur Limiti", unit: "adet", qtySource: "c.one" },
    { key: "weightLimit", label: "Ağırlık Limit Şalteri", unit: "adet", qtySource: "c.one" },
  ];
}

const KALDIRMA = kaldirmaSatirlari("mainHoist");
const YRD_KALDIRMA = kaldirmaSatirlari("auxHoist");

// —————————————————————————————————————————————— yürütme ve teker

const YURUTME: Satir[] = [
  { key: "coupling", label: "Kaplin Setleri", unit: "takım", qtySource: "c.one" },
  { key: "bridgeMotor", label: "Köprü / Portal Yürütme Motorları", unit: "adet", qtySource: "c.bridgeDriveCount", offerRef: { group: "bridge", row: "motor" } },
  { key: "bridgeGearbox", label: "Köprü / Portal Yürütme Redüktörleri", unit: "adet", qtySource: "c.bridgeDriveCount", offerRef: { group: "bridge", row: "gearbox" } },
  { key: "trolleyMotor", label: "Araba Yürütme Motorları", unit: "adet", qtySource: "c.trolleyDriveCount", offerRef: { group: "trolley", row: "motor" } },
  { key: "trolleyGearbox", label: "Araba Yürütme Redüktörleri", unit: "adet", qtySource: "c.trolleyDriveCount", offerRef: { group: "trolley", row: "gearbox" } },
  { key: "bridgeWheels", label: "Köprü / Portal Tekerlekleri", unit: "adet", qtySource: "c.bridgeWheelCount", hint: "Çap Hesaplar sayfasında", offerRef: { group: "bridge", row: "wheel" } },
  { key: "trolleyWheels", label: "Araba Tekerlekleri", unit: "adet", qtySource: "c.trolleyWheelCount", offerRef: { group: "trolley", row: "wheel" } },
  { key: "buffers", label: "Tamponlar", unit: "adet" },
];

// ——————————————————————————————————————————— elektrik ve otomasyon

const ELEKTRIK: Satir[] = [
  { key: "hoistDrive", label: "Kaldırma Sürücüsü", unit: "adet", qtySource: "c.one", hint: "Boyu Hesaplar sayfasında (motorun bir üstü)" },
  { key: "bridgeDrive", label: "Köprü / Portal Sürücüleri", unit: "adet", qtySource: "c.bridgeDriveUnits" },
  { key: "trolleyDrive", label: "Araba Sürücüsü", unit: "adet", qtySource: "c.trolleyDriveUnits" },
  { key: "panels", label: "Elektrik Panoları", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "panel" } },
  { key: "brakeResistors", label: "Frenleme Dirençleri", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "resistors" } },
  { key: "isolationTrafo", label: "İzolasyon Trafosu", unit: "adet", qtySource: "c.one", offerRef: { group: "electrical", row: "isolationTrafo" } },
  { key: "powerSupply", label: "Güç Kaynağı ve Klemensler", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "powerSupply" } },
  { key: "electricalLabour", label: "Elektrik / Otomasyon İşçiliği", unit: "takım", qtySource: "c.one" },
  { key: "switchgear", label: "Sarf ve Şalt Malzemesi", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "switchgear" } },
  { key: "cables", label: "Kablolar ve Festoon", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "cable" } },
  { key: "cableTray", label: "Kablo Tava / Kanal", unit: "takım", qtySource: "c.one" },
  { key: "travelLimits", label: "Yürütme Limit Seti", unit: "takım", qtySource: "c.one", offerRef: { group: "electrical", row: "crossLimit" } },
  { key: "remote", label: "Uzaktan Kumanda", unit: "adet", qtySource: "c.one", offerRef: { group: "electrical", row: "pendant" } },
];

// ————————————————————————————————————————————————— atölye ve saha

const ATOLYE: Satir[] = [
  { key: "mechanicalAssembly", label: "Mekanik Montaj (atölye)", unit: "takım", qtySource: "c.one" },
  { key: "siteAssembly", label: "Saha Montajı ve Devreye Alma", unit: "takım", qtySource: "c.one" },
  { key: "shipping", label: "Sevkiyat", unit: "takım", qtySource: "c.one" },
  { key: "mobileCrane", label: "Mobil Vinç (saha montajı)", unit: "takım", qtySource: "c.one" },
  { key: "fasteners", label: "Bağlantı Elemanları", unit: "ton", qtySource: "c.capacityT", hint: "Kapasite × €/ton" },
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
  { key: "documentation", label: "Dokümantasyon ve Onaylar", unit: "takım", qtySource: "c.one" },
  { key: "commissioning", label: "Devreye Alma ve Eğitim", unit: "takım", qtySource: "c.one" },
  { key: "factoryTests", label: "Fabrika Testleri ve Muayene", unit: "takım", qtySource: "c.one" },
  { key: "siteOverhead", label: "İSG ve Şantiye Genel Giderleri", unit: "takım", qtySource: "c.one" },
  { key: "packaging", label: "Paketleme ve Ambalaj", unit: "takım", qtySource: "c.one" },
];

// ————————————————————————————————————————————————————— gruplar

export const GENERAL_GROUP_KEY = "general";
export const CUSTOM_COST_GROUP_KEY = "custom";

export const COST_GROUP_DEFS: readonly CostGroupDef[] = [
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
export const DEFAULT_ITEM_GROUP_KEYS = ["steel", "hoist", "travel", "electrical", "assembly"] as const;

/**
 * TEKLİF GRUBU → MALİYET GRUBU.
 *
 * Teklif kaleminde `auxHoist` bölümü varsa maliyette de yardımcı kaldırma
 * grubu açılır; `gantry` ya da `bridge` bölümü zaten tek bir "YÜRÜTME VE
 * TEKER" grubuna düşer, çünkü ikisi de aynı satırları fiyatlar (motor,
 * redüktör, teker) ve iki ayrı grup ekranı gereksiz yere ikiye bölerdi.
 */
export function costGroupKeysForOfferItem(offerGroupKeys: readonly string[]): string[] {
  const set = new Set<string>(DEFAULT_ITEM_GROUP_KEYS);
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

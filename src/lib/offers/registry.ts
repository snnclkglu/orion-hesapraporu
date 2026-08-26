// TEKLİF DEFTERİ — hangi grupta hangi satır, hangi satırda hangi parça.
//
// Bu dosya BİR ŞABLON KAYNAĞIDIR, BİR KELEPÇE DEĞİL. Kullanıcı teklifte grup
// ekler, siler, yeniden adlandırır; satır ekler ve etiketini değiştirir.
// Defterin işi, on beş yıllık tekliflerde gerçekten geçen alanları HAZIR
// getirmektir — teklif hızlı olsun diye kurulan bölümün tamamı budur.
//
// Kaynak: firmanın 2026'da verdiği on dört teklifin tamamı okundu; buradaki
// etiketler ve parça ayrımı o belgelerden çıkarıldı. UYDURULMUŞ ALAN YOKTUR
// (değişmez md. 4) — bir alan burada varsa gerçek bir teklifte geçmiştir.
//
// MARKA ETİKETİN İÇİNE GÖMÜLMEZ. Devralınan belgelerde iki stil karışıyordu
// (`Motor (GAMAK) :` ve `Motor : GAMAK …`); ikincisi seçildi çünkü marka bir
// DEĞERDİR, bir başlık değil — süzülebilmesi, defterden seçilebilmesi ve
// ileride katalogdan gelebilmesi ancak alan olduğunda mümkündür.

import { parseNum } from "@/lib/currency";
import type {
  OfferGeneralTermDef,
  OfferGroupDef,
  OfferPartDef,
  OfferRowDef,
} from "./types";

// ——————————————————————————————————————————————— ortak parça kalıpları

/** Marka + tip/seri: seri seçenekleri seçilen markanın ÇOCUKLARIDIR. */
function markaSeri(bilesen: string, seriEtiket = "Tip / Seri"): OfferPartDef[] {
  return [
    { key: "brand", label: "Marka", list: `brand.${bilesen}` },
    { key: "series", label: seriEtiket, list: `series.${bilesen}`, childOf: "brand" },
  ];
}

/** Serbest ek notlar — değere virgülle eklenir ("…, Encoderli, IP55"). */
const SECENEKLER: OfferPartDef = { key: "options", label: "Ek Özellikler", comma: true };

const MOTOR_PARTS: OfferPartDef[] = [
  { key: "brand", label: "Marka", list: "brand.motor" },
  // "2 x 5.5 kW" — çift motorlu yürütme gruplarında adet ÖNCE yazılır. TEK
  // motorda hiç yazılmaz (`hideWhenOne`): belgelerin yazımı öyle.
  { key: "count", label: "Adet", numeric: true, suffix: " x", hideWhenOne: true },
  // GÜÇ VE DEVİR DEFTERDEN SEÇİLİR (kullanıcı isteği, 17.08.2026): standart
  // motor güçleri IEC serisidir ve elle yazılırsa aynı güç iki farklı yazımla
  // ("5,5" / "5.5") belgeye girer. Liste KAPALI DEĞİLDİR — seri dışı bir motor
  // yazılabilir ve tek tıkla deftere eklenir.
  { key: "power", label: "Güç", list: "val.motorPower", suffix: " kW" },
  { key: "rpm", label: "Devir", list: "val.motorRpm", suffix: " d/dak" },
  SECENEKLER,
];

const GEARBOX_PARTS: OfferPartDef[] = [
  ...markaSeri("gearbox"),
  { key: "mounting", label: "Bağlantı", list: "val.gearboxMounting", comma: true },
  { key: "safety", label: "Emniyet Katsayısı", numeric: true, prefix: "Emniyet: ", comma: true },
];

const BRAKE_PARTS: OfferPartDef[] = [
  { key: "brand", label: "Marka", list: "brand.brake" },
  { key: "type", label: "Fren Tipi", list: "val.brakeType" },
  { key: "count", label: "Adet", numeric: true, prefix: "x ", suffix: " Adet" },
];

/**
 * SÜRÜCÜ — marka, seri, GÜÇ ve ADET (kullanıcı isteği, 17.08.2026).
 *
 * Adet BİRDEN BÜYÜKSE toplam güç de basılır (`SCHNEIDER ATV-340 18,5 kW x 2
 * (37 kW)`); tek adette yazılmaz — "x 1" ve tekrar edilen aynı sayı, belgede
 * bilgi değil gürültüdür.
 *
 * TOPLAM TÜRETİLİR, ELLE YAZILMAZ (kullanıcı isteği, 17.08.2026: *"Sürücü
 * toplam güç, Güç x adet otomatik yazsın."*): kip `derived: "powerTotal"`dır,
 * hesap `derivedParts` içindedir ve kutu ekranda salt okunur çizilir. Elle
 * çarpılan bir toplam, belgenin kendi içinde tutarlı GÖRÜNÜP yalnız müşteri
 * hesapladığında yanlış çıkan türden bir hatadır.
 */
const DRIVE_PARTS: OfferPartDef[] = [
  { key: "brand", label: "Marka", list: "brand.drive" },
  { key: "series", label: "Seri", list: "series.drive", childOf: "brand" },
  { key: "power", label: "Güç", list: "val.drivePower", suffix: " kW" },
  // Tek sürücüde adet de toplam da yazılmaz: "ATV-340 22 kW - SCHNEIDER".
  { key: "count", label: "Adet", numeric: true, prefix: "x ", suffix: " Adet", hideWhenOne: true },
  {
    key: "total",
    label: "Toplam Güç",
    numeric: true,
    prefix: "(",
    suffix: " kW)",
    derived: "powerTotal",
  },
  SECENEKLER,
];

const WHEEL_PARTS: OfferPartDef[] = [
  { key: "count", label: "Adet", numeric: true, suffix: " x" },
  { key: "dia", label: "Çap", list: "val.wheelDia", prefix: "Ø" },
  { key: "standard", label: "Standart", list: "val.wheelStandard" },
  { key: "material", label: "Malzeme / Sertlik", list: "val.wheelMaterial" },
];

const ROPE_PARTS: OfferPartDef[] = [
  // Halat çapı TEKER çapından ayrı bir defterdir (Ø8…Ø36); ikisini tek listeye
  // bağlamak, halat seçicisine 1250 mm'lik teker çapları düşürürdü.
  { key: "dia", label: "Çap", list: "val.ropeDia", prefix: "Ø" },
  { key: "construction", label: "Yapı", list: "val.ropeConstruction", suffix: " Halat" },
  { key: "grade", label: "Tel Mukavemeti", list: "val.ropeGrade" },
  { key: "core", label: "Öz Tipi", list: "val.ropeCore" },
];

/** Hız satırları: "1-6 m/dk – Çift Hız Kontrolü (Frekans İnvertörlü)". */
function hizParts(listKey: string): OfferPartDef[] {
  return [
    { key: "range", label: "Hız", suffix: " m/dk" },
    { key: "control", label: "Hız Kontrolü", list: listKey, prefix: "– " },
  ];
}

// ——————————————————————————————————————————————————————— grup defterleri

const GENEL: OfferRowDef[] = [
  {
    // KAPASİTE BURADA SORULUR, kalem künyesinde DEĞİL (kullanıcı isteği,
    // 17.08.2026: *"aynı bilgiyi iki defa alıyoruz"*). Kalem künyesindeki
    // `capacityT` bu satırdan TÜRETİLİR (`itemFactsFromRows`) ve teklif
    // listesindeki tonaj süzgecini besler.
    //
    // YARDIMCI KALDIRMA AYRI PARÇADIR: "32 ton / 5 ton" biçimi devralınan
    // tekliflerin kendi yazımıdır ve iki sayı gerçekten iki ayrı vinç
    // özelliğidir.
    key: "capacity",
    label: "Kaldırma Kapasiteleri (Q)",
    parts: [
      { key: "main", label: "Ana Kaldırma", numeric: true, suffix: " ton" },
      { key: "aux", label: "Yardımcı Kaldırma", numeric: true, prefix: "/ ", suffix: " ton" },
    ],
  },
  {
    // SICAKLIK MİN VE MAKS AYRI SEÇİLİR (kullanıcı isteği, 17.08.2026): tek bir
    // "aralık" listesi, gerçekte iki bağımsız karar olan şeyi önceden
    // eşleştirilmiş çiftlere hapsediyordu (-10/+50 varken -5/+50 yoktu).
    // Basılan metin AYNEN korunur: "Kapalı Alan, -10 / +40 º C".
    key: "environment",
    label: "Çalışma Ortamı / Sıcaklığı",
    parts: [
      { key: "place", label: "Ortam", list: "val.environmentPlace" },
      { key: "tempMin", label: "Sıcaklık (Min)", list: "val.tempMin", comma: true },
      { key: "tempMax", label: "Sıcaklık (Maks)", list: "val.tempMax", prefix: "/ ", suffix: " º C" },
    ],
  },
  { key: "span", label: "Köprü Açıklığı", parts: [{ key: "value", label: "Açıklık", numeric: true, suffix: " m" }] },
  { key: "liftHeight", label: "Kaldırma Yüksekliği", parts: [{ key: "value", label: "Yükseklik", numeric: true, suffix: " m" }] },
  { key: "craneClass", label: "Vinç Sınıfı / Çelik Yapı", list: "val.craneClass" },
  // VİNÇ TİPİ BURADA SORULMAZ (kullanıcı isteği, 22.08.2026, md. 3: *"kalem
  // içerisinde vinç tipini iki kere alıyoruz. Genel özelliklerdeki vinç tipini
  // iptal edelim"*). Tek soru kalem künyesindeki `item.craneType` alanıdır;
  // kalem başlığı, maliyet şablonu ve teklif listesi süzgeci onu okur. Satır
  // EMEKLİYE AYRILDI, silinmedi — `RETIRED_ROW_KEYS`e bakın.
  {
    // ÖLÇÜ SORULUR, SERBEST METİN DEĞİL (kullanıcı isteği, 22.08.2026, md. 4:
    // *"genel özelliklerde yürüme yolu diye aldığımız bilgi Yürüme Yolu
    // Uzunluğu ve metre cinsinden olacak"*). Kardeşleriyle (açıklık, kaldırma
    // yüksekliği, ayak yüksekliği) aynı desendedir: sayı + " m".
    key: "runway",
    label: "Yürüme Yolu Uzunluğu",
    parts: [{ key: "value", label: "Uzunluk", numeric: true, suffix: " m" }],
  },
  { key: "gantryLegHeight", label: "Portal Ayak Yüksekliği", parts: [{ key: "value", label: "Yükseklik", numeric: true, suffix: " m" }] },
  { key: "boomSpan", label: "Bom Açıklığı", parts: [{ key: "value", label: "Açıklık", numeric: true, suffix: " m" }] },
  { key: "dimensions", label: "Ölçüleri" },
];

/** Kaldırma grubu — ana, yardımcı ve monoray aynı satır kümesini paylaşır. */
const KALDIRMA: OfferRowDef[] = [
  { key: "liftSpeed", label: "Kaldırma Hızı", parts: hizParts("val.speedControl") },
  { key: "reeving", label: "Halat Donanımı", list: "val.reeving" },
  { key: "motor", label: "Motor", parts: MOTOR_PARTS },
  { key: "gearbox", label: "Redüktör", parts: GEARBOX_PARTS },
  { key: "brake", label: "Fren", parts: BRAKE_PARTS },
  { key: "safetyBrake", label: "Emniyet Freni", parts: [{ key: "brand", label: "Marka", list: "brand.brake" }, { key: "type", label: "Tanım", list: "val.safetyBrake" }] },
  { key: "drive", label: "Sürücü", parts: DRIVE_PARTS },
  { key: "hook", label: "Kanca", list: "val.hook" },
  { key: "rope", label: "Halat", parts: ROPE_PARTS },
  { key: "controlType", label: "Kontrol Tipi", list: "val.controlType" },
];

const YURUTME: OfferRowDef[] = [
  { key: "travelSpeed", label: "Yürüme Hızı", parts: hizParts("val.speedControl") },
  { key: "motor", label: "Motor", parts: MOTOR_PARTS },
  { key: "gearbox", label: "Redüktör", parts: GEARBOX_PARTS },
  { key: "brake", label: "Fren", parts: BRAKE_PARTS },
  { key: "drive", label: "Sürücü", parts: DRIVE_PARTS },
  { key: "driveSystem", label: "Tahrik Sistemi", list: "val.driveSystem" },
  { key: "wheel", label: "Tekerlek", parts: WHEEL_PARTS },
  { key: "controlType", label: "Kontrol Tipi", list: "val.controlType" },
];

const KOPRU: OfferRowDef[] = [
  // YÜRÜME YOLU RAYI SORULMAZ (kullanıcı isteği, 22.08.2026, md. 5: *"Köprü
  // grubunda Yürüme Yolu Rayı'nı iptal edelim. Köprü rayı zaten yeterli."*)
  // Satır EMEKLİYE AYRILDI — `RETIRED_ROW_KEYS`.
  { key: "rail", label: "Köprü Rayı", list: "val.rail" },
  { key: "travelSpeed", label: "Yürüme Hızı", parts: hizParts("val.speedControl") },
  { key: "travelSystem", label: "Yürütme Sistemi", list: "val.travelSystem" },
  { key: "driveSystem", label: "Tahrik Sistemi", list: "val.driveSystem" },
  { key: "motor", label: "Motor", parts: MOTOR_PARTS },
  { key: "gearbox", label: "Redüktör", parts: GEARBOX_PARTS },
  { key: "brake", label: "Fren", parts: BRAKE_PARTS },
  { key: "drive", label: "Sürücü", parts: DRIVE_PARTS },
  { key: "wheel", label: "Tekerlek", parts: WHEEL_PARTS },
  { key: "controlType", label: "Kontrol Tipi", list: "val.controlType" },
  { key: "bearings", label: "Rulmanlar", parts: [{ key: "brand", label: "Marka", list: "brand.bearing" }, { key: "note", label: "Açıklama" }] },
];

const BOM: OfferRowDef[] = [
  { key: "slewAngle", label: "Dönme Açısı" },
  { key: "slewSpeed", label: "Döndürme Hızı", parts: [{ key: "value", label: "Hız", numeric: true, suffix: " d/dk" }] },
  { key: "motor", label: "Motor", parts: MOTOR_PARTS },
  { key: "gearbox", label: "Redüktör", parts: GEARBOX_PARTS },
  { key: "brake", label: "Fren", parts: BRAKE_PARTS },
  { key: "controlType", label: "Kontrol", list: "val.controlType" },
];

const CELIK: OfferRowDef[] = [
  { key: "girder", label: "Kiriş", list: "val.girder" },
  { key: "girderCalc", label: "Kiriş Hesabı", list: "val.girderCalc" },
  { key: "girderMaterial", label: "Kiriş Malzemesi", list: "val.steelGrade" },
  { key: "platform", label: "Platform", list: "val.platform" },
  { key: "paint", label: "Boya", list: "val.paint" },
  { key: "dimensions", label: "Ölçüleri" },
  { key: "form", label: "Yapı" },
];

const ELEKTRIK: OfferRowDef[] = [
  { key: "supplyVoltage", label: "Besleme Gerilimi", list: "val.supplyVoltage" },
  { key: "controlVoltage", label: "Kontrol Gerilimi", list: "val.controlVoltage" },
  { key: "runwayPower", label: "Hol Boyu Elektrik", list: "val.runwayPower" },
  { key: "plc", label: "PLC", list: "val.plc" },
  { key: "hmiPanel", label: "HMI Panel", list: "val.hmiPanel" },
  { key: "busbar", label: "Bara", list: "brand.busbar" },
  { key: "busbarBrush", label: "Bara Fırçası", list: "val.scope" },
  { key: "pendant", label: "Kumanda Şekli", parts: [{ key: "brand", label: "Marka", list: "brand.pendant" }, { key: "series", label: "Seri", list: "series.pendant", childOf: "brand" }, SECENEKLER] },
  { key: "drives", label: "Sürücüler", parts: DRIVE_PARTS },
  { key: "crossLimit", label: "Köprü ve Araba Limiti", parts: [{ key: "brand", label: "Marka", list: "brand.limit" }, { key: "note", label: "Açıklama" }] },
  { key: "drumLimit", label: "Tambur Limiti", parts: [{ key: "brand", label: "Marka", list: "brand.limit" }, { key: "model", label: "Model" }, { key: "note", label: "Açıklama" }] },
  { key: "isolationTrafo", label: "İzolasyon Trafosu", parts: [{ key: "brand", label: "Marka", list: "brand.trafo" }, { key: "spec", label: "Değer" }] },
  { key: "powerSupply", label: "Güç Kaynağı", list: "brand.powerSupply" },
  { key: "terminals", label: "Klemensler", list: "brand.terminal" },
  { key: "loadcell", label: "Loadcell", list: "brand.loadcell" },
  { key: "signalization", label: "Sinyalizasyon", parts: [{ key: "brand", label: "Marka", list: "brand.signalization" }, { key: "note", label: "Kapsam", comma: true }] },
  { key: "cable", label: "Kablo", list: "brand.cable" },
  { key: "resistors", label: "Dirençler", list: "brand.resistor" },
  { key: "switchgear", label: "Pano İçi Şalt Malzemeler", list: "brand.switchgear" },
  { key: "panel", label: "Pano", parts: [{ key: "brand", label: "Marka", list: "brand.panel" }, { key: "note", label: "Yerleşim", comma: true }] },
  { key: "emBrakes", label: "Elektromanyetik Frenler", list: "val.supplyVoltage" },
  { key: "kst", label: "KST" },
];

/**
 * GÜVENLİK ÖZELLİKLERİ — elektrik sisteminin hemen altındaki hızlı tikler.
 *
 * Satırlar `kind: "toggle"` olduğu için yeni kalemde BOŞ gelir; kullanıcı
 * yalnız teklif ettiği özelliği işaretler ve işaretli satır PDF'de `VAR`
 * değeriyle görünür. Bir varsayılan güvenlik kapsamı UYDURULMAZ.
 */
const GUVENLIK: OfferRowDef[] = [
  { key: "emergencyStop", label: "Kumanda Panelinde Acil Durdurma Butonu", kind: "toggle" },
  { key: "phaseThermalProtection", label: "Faz ve Termik Koruma Röleleri", kind: "toggle" },
  { key: "hoistLimit", label: "Kaldırma ve İndirme Sınırlaması", kind: "toggle" },
  { key: "trolleySlowStopSensors", label: "Araba Hareketlerini Yavaşlatma ve Durdurma Sensörleri", kind: "toggle" },
  { key: "trolleyStopSensors", label: "Araba Hareketlerini Durdurma Sensörleri", kind: "toggle" },
  { key: "audibleVisualAlarm", label: "Sesli ve Işıklı İkaz Sistemi", kind: "toggle" },
  { key: "overloadDetection", label: "Aşırı Yük Algılama", kind: "toggle" },
  { key: "antiCollision", label: "Çarpışma Önleme Sistemi", kind: "toggle" },
  { key: "slackRopeMonitoring", label: "Gevşek Halat Denetimi", kind: "toggle" },
  { key: "faultDisplay", label: "Ekran Üzerinden Hata Görüntüleme", kind: "toggle" },
  { key: "brakeLiningWear", label: "Fren Balatası Aşınma Denetimi", kind: "toggle" },
  { key: "brakeOpenSensors", label: "Fren Açık Sensörleri", kind: "toggle" },
  { key: "brakeOpenClosedSensors", label: "Fren Açık/Kapalı Sensörleri", kind: "toggle" },
  { key: "shockLoadPrevention", label: "Şok Yükleme Önleme Sistemi", kind: "toggle" },
];

// ————————————————————————————————————————————————————— grup anahtarları
//
// Anahtarlar KOD İÇİNDE DE GEÇER (araba sayısı seçicisi, yardımcı kaldırmanın
// kendiliğinden açılması, künye türetmesi) ve dizgi olarak dağıtılmaları
// sessiz bir yazım hatasına açık kapı bırakırdı: `"auxTroley"` hiçbir yerde
// patlamaz, yalnız özellik çalışmaz.

export const GENERAL_GROUP_KEY = "general";
export const MAIN_HOIST_GROUP_KEY = "mainHoist";
export const AUX_HOIST_GROUP_KEY = "auxHoist";
export const TROLLEY_GROUP_KEY = "trolley";
export const AUX_TROLLEY_GROUP_KEY = "auxTrolley";

/** Tek arabalı vinçte arabanın adı — numara TAKILMAZ. */
export const TROLLEY_TITLE = "VİNÇ ARABASI";
/** Çift arabalı vinçte iki bölümün adları. */
export const TROLLEY_1_TITLE = "VİNÇ ARABASI - 1";
export const TROLLEY_2_TITLE = "VİNÇ ARABASI - 2";

/**
 * GRUP DEFTERİ. Sıra BELGENİN SIRASIDIR: genel özelliklerden başlanır, tahrik
 * grupları yukarıdan aşağıya izler, çelik yapı ve elektrik sona kalır — on
 * dört teklifin on dördünde bu düzen var.
 */
/**
 * SAYFA BAŞLIĞINDA KULLANILAN KISA AD — "GENEL · KALDIRMA · ARABA".
 *
 * Kullanıcının paylaştığı ön çalışmada (18.08.2026, md. 8) teknik sayfanın
 * büyük başlığı o sayfadaki grupların KISA adlarını yan yana diziyor. Tam
 * başlıkları dizmek ("GENEL ÖZELLİKLER · KALDIRMA GRUBU · VİNÇ ARABASI ·
 * KÖPRÜ GRUBU · ÇELİK KONSTRÜKSİYON · ELEKTRİK SİSTEMİ") üç satır sürüyor ve
 * başlık olmaktan çıkıyordu.
 *
 * KISALTMA DEFTERDE YAZILI, KODDA TÜRETİLMEZ. "VİNÇ ARABASI" → "ARABA" bir
 * ek atma kuralıyla çıkarılamaz (ilk kelime "VİNÇ"tir, son kelimenin eki
 * atılınca "ARABAS" olur); Türkçe ek çözümlemesi burada kazanılacak bir şey
 * için fazla kırılgandır. Defter kendi kısa adını bilir.
 */
export const OFFER_GROUP_SHORT: Readonly<Record<string, string>> = Object.freeze({
  general: "GENEL",
  mainHoist: "KALDIRMA",
  auxHoist: "YRD. KALDIRMA",
  trolley: "ARABA",
  auxTrolley: "2. ARABA",
  bridge: "KÖPRÜ",
  gantry: "PORTAL",
  boom: "BOM",
  steel: "ÇELİK",
  electrical: "ELEKTRİK",
  safety: "GÜVENLİK",
});

/** Grubun sayfa başlığındaki adı; defterde yoksa tam başlık. */
export function offerGroupShort(key: string, title: string): string {
  return OFFER_GROUP_SHORT[key] ?? title;
}

export const OFFER_GROUP_DEFS: OfferGroupDef[] = [
  { key: "general", title: "GENEL ÖZELLİKLER", rows: GENEL },
  { key: "mainHoist", title: "KALDIRMA GRUBU", rows: KALDIRMA },
  { key: "auxHoist", title: "YARDIMCI KALDIRMA GRUBU", rows: KALDIRMA },
  { key: "trolley", title: TROLLEY_TITLE, rows: YURUTME },
  // İKİNCİ ARABA AYRI BİR BÖLÜMDÜR (kullanıcı bildirimi, 17.08.2026:
  // *"vinçte bir araba veya 2 araba olabilir"*). Mühendislik motorunda karşılığı
  // `auxTrolley`dir; teklifte de ayrı durur çünkü kendi motoru, redüktörü,
  // tekerleği ve hızı vardır — tek bölüme sıkıştırmak, iki farklı ürünü aynı
  // satırda anlatmak olurdu.
  //
  // BAŞLIK "YARDIMCI" DEĞİL "- 2"DİR (kullanıcı isteği, 17.08.2026: *"çift
  // arabalı olarak işaretlersem Vinç Arabası - 2 olarak yeni bölüm açılsın,
  // diğeri de bu durumda Vinç Arabası - 1 olsun"*). İki araba EŞİTTİR: çoğu
  // çift arabalı vinçte ikisi de aynı kapasiteyi taşır ve "yardımcı" demek
  // ikincisini küçük gösterirdi. Yardımcı KALDIRMA ise gerçekten yardımcıdır ve
  // adı öyle kalır.
  { key: "auxTrolley", title: TROLLEY_2_TITLE, rows: YURUTME },
  { key: "bridge", title: "KÖPRÜ GRUBU", rows: KOPRU },
  { key: "gantry", title: "PORTAL YÜRÜTME GRUBU", rows: KOPRU },
  { key: "boom", title: "BOM GRUBU", rows: BOM },
  { key: "steel", title: "ÇELİK KONSTRÜKSİYON", rows: CELIK },
  { key: "electrical", title: "ELEKTRİK SİSTEMİ", rows: ELEKTRIK },
  { key: "safety", title: "GÜVENLİK ÖZELLİKLERİ", rows: GUVENLIK },
];

export const OFFER_GROUP_DEF_BY_KEY: Record<string, OfferGroupDef> = Object.fromEntries(
  OFFER_GROUP_DEFS.map((g) => [g.key, g])
);

/** Serbest grup — defterde karşılığı olmayan bir öbek eklendiğinde kullanılır. */
export const CUSTOM_GROUP_KEY = "custom";

/**
 * SAHTE GRUP ANAHTARLARI — kaleme ait OLMAYAN satır kümeleri.
 *
 * Test yükü ve ticari şartlar bir vinç kaleminin içinde değil belgenin kendi
 * gövdesinde durur, yani bir `OfferGroup`ları yoktur; ama satırları yine de
 * defterden tanınmalıdır. Editör ve varsayılan doldurucu onlara bu anahtarlarla
 * sorar.
 *
 * BU EŞLEME BİR SÜRE YOKTU ve iki hatayı birden doğurdu (kullanıcı bildirimi,
 * 17.08.2026): `offerRowDef("__terms", …)` `undefined` döndüğü için ticari şart
 * satırlarının hiçbiri AÇILIR LİSTE çizmiyor, düz metin kutusuna düşüyordu; aynı
 * sebeple test yükü ve geçerlilik süresi defterdeki VARSAYILANLARLA da
 * dolmuyordu. İki belirti, tek kök.
 */
export const TERMS_GROUP_KEY = "__terms";
export const TEST_LOAD_GROUP_KEY = "__testLoad";

/**
 * EMEKLİYE AYRILAN SATIRLAR — defterden çıktı ama KAYITLARDA duruyor.
 *
 * Bir satırı defterden silmek YENİ kalemleri temizler, ESKİLERİ temizlemez:
 * `withDefaults` tanınmayan satırı KORUR (kendi gerekçesi orada yazılı — bir
 * taşıma fonksiyonu veri silmez) ve kullanıcı kaldırılmasını istediği satırı
 * açtığı her eski teklifte yeniden görür. Kullanıcının istediği ise ekranda
 * BİR DAHA GÖRMEMEK'ti (22.08.2026, md. 3 ve md. 5).
 *
 * ÇÖZÜM SİLMEK DEĞİL EMEKLİYE AYIRMAK: satır kayıtta olduğu gibi kalır,
 * OKUMA yolunda (`withDefaults`) süzülür. Fark önemlidir çünkü yayımlanmış bir
 * teklif KİLİTLİDİR ve müşteriye giden kâğıdın karşılığı `offer-pdf` kovasında
 * ARŞİVLİDİR (`issueOfferRevision`) — yani belgenin gerçeği zaten dosyadadır,
 * buradaki payload onun yeniden üretilebilir kopyasıdır. Süzgeç veriyi
 * bozmadan ekranı temizler; yarın satır geri gelirse eski değerler yerindedir.
 *
 * DEĞERİ OLAN SATIR SESSİZCE KAYBOLMAZ: `craneType` satırının değeri, kalem
 * künyesindeki alan boşsa oraya TAŞINIR (`withDefaults`).
 *
 * KÖPRÜ SATIRLARI İKİ GRUPTA YAŞAR (`bridge` ve `gantry` aynı `KOPRU`
 * kümesini paylaşır); ikisi de yazılır, yoksa portalde satır durmaya devam
 * ederdi.
 */
export const RETIRED_ROW_KEYS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  general: ["craneType"],
  bridge: ["runwayRail"],
  gantry: ["runwayRail"],
  // Eski değer yeni PLC alanına taşınmaz: "Kiriş Boyu Elektrik" bir besleme
  // tanımıdır, PLC modeli değildir. Satırı yeniden etiketlemek yanlış belge
  // üretirdi; eski kayıtların okuma yolunda emekliye ayrılır.
  electrical: ["girderPower"],
});

/** Satır defterden emekliye mi ayrıldı — okuma yolundaki süzgecin sorusu. */
export function isRetiredOfferRow(groupKey: string, rowKey: string): boolean {
  return (RETIRED_ROW_KEYS[groupKey] ?? []).includes(rowKey);
}

/**
 * Bir satırın defterdeki tanımı. Grup anahtarı bilinmiyorsa (serbest grup) ya
 * da satır elle eklenmişse `undefined` döner — o satır düz metin kutusu olur.
 *
 * Sahte gruplar TEMBEL çözülür (`switch`, modül düzeyinde bir eşleme nesnesi
 * DEĞİL): `TERM_ROW_DEFS` bu satırların ALTINDA tanımlıdır ve modül düzeyinde
 * bir sabitten ona bakmak, `const` zaman-ölü-bölgesine düşüp modül yüklenirken
 * çökerdi.
 */
export function offerRowDef(groupKey: string, rowKey: string): OfferRowDef | undefined {
  switch (groupKey) {
    case TERMS_GROUP_KEY:
      return TERM_ROW_DEFS.find((r) => r.key === rowKey);
    case TEST_LOAD_GROUP_KEY:
      return TEST_LOAD_ROW_DEFS.find((r) => r.key === rowKey);
    default:
      return OFFER_GROUP_DEF_BY_KEY[groupKey]?.rows.find((r) => r.key === rowKey);
  }
}

/**
 * TEST YÜKÜ satırları. Belgede TS 10116'ya atıfla basılır ve iki satırı
 * yıllardır aynıdır; yine de defterden gelir ki oran değişirse tek yerde
 * değişsin.
 */
export const TEST_LOAD_TITLE = "TEST YÜKÜ (TS 10116)";

export const TEST_LOAD_ROW_DEFS: OfferRowDef[] = [
  { key: "dynamic", label: "Dinamik Test", list: "val.testDynamic" },
  { key: "static", label: "Statik Test", list: "val.testStatic" },
];

// —————————————————————————————————————————————————————— ticari şartlar

/**
 * TİCARİ SAYFANIN BAŞLIĞI.
 *
 * "FİYAT" SÖZCÜĞÜ ÇIKTI (kullanıcı isteği 19.08.2026, md. 16): fiyat artık
 * sayfanın kendi bölümüdür ve "FİYATLAR" başlığını taşır. Eski metin sayfanın
 * tepesinde bir blok başlığı olarak duruyor, altındaki fiyat tablosunun ise
 * adı yoktu — okuyan tabloyu başlıksız görüyordu.
 *
 * SABİT YALNIZ YENİ TEKLİFLERE İŞLER: `emptyPayload` bu metni payload'a
 * KOPYALAR ve `withDefaults` kayıtlı değeri korur (TEKLIF-2: teslim edilmiş
 * belgenin metni değişmez). Kayıtlı TASLAKLAR migration ile eşitlenir;
 * yayımlanmış revizyonlara dokunulmaz.
 */
export const TERMS_TITLE = "TESLİM VE ÖDEME ŞEKLİ";

/**
 * KAPAKTAKİ FİRMA TANITIMI (kullanıcı isteği 19.08.2026, md. 22).
 *
 * DEFTERE (`offer_options`) GİRMEZ: defter kullanıcının teklif başına seçtiği
 * KISA değerleri taşır (bir marka, bir süre); bu ise firmanın kurumsal
 * BEYANIDIR — seçenek değil, sabit. Aynı gerekçe genel şartlar için de
 * verilmişti (TEKLIF-34).
 *
 * METİN KISA TUTULDU: kapakta imzaların altında ~300 pt boşluk var ve 22.
 * madde ile birlikte gelen ünvan satırı, konu başlığı ve logolar o boşluğu
 * yiyor. Kaynak metin (kullanıcının verdiği tanıtım) üç paragraftı ve ürün
 * listesi on bir kalemdi; kapakta bir SAYFA DEĞİL bir PARAGRAF yeri var.
 */
/**
 * FİRMANIN KENDİ BEYANI — teklif kapağının alt bölgesi (TEKLIF-46).
 *
 * Defter kullanıcının seçtiği KISA değerleri taşır; bu ise firmanın kendini
 * anlattığı metindir ve teklife göre değişmez, o yüzden sabittir.
 *
 * ÜRÜNLER TEK BİR CÜMLE DEĞİL, MADDE MADDE LİSTEDİR (kullanıcı tasarımı,
 * 22.08.2026): ` · ` ile bağlanmış üç satırlık gri bir dizide okur hiçbir iş
 * kolunu seçemiyordu. Kapakta iki sütunlu kare madde işaretli bir ızgara
 * olarak basılır — sıra SATIR YÖNÜNDEDİR (1|2 / 3|4 …), tasarımdaki ızgaranın
 * kendisi gibi.
 */
export const COMPANY_PROFILE = {
  body:
    "ORION CRANES, kaldırma ve iletme sistemleri alanındaki 25 yıllık mühendislik " +
    "birikimiyle Ankara Başkent Organize Sanayi Bölgesi'ndeki 6.000 m² tesisinde faaliyet " +
    "göstermektedir. Projelendirmeden imalata, devreye almadan satış sonrası hizmetlere " +
    "kadar tüm süreçlerde güvenilir, yüksek kaliteli ve ihtiyaca özel çözümler sunar.",
  linesTitle: "İŞ KOLLARIMIZ",
  lines: [
    "Gezer Köprülü Tavan Vinçleri",
    "Portal Ve Pergel Vinçler",
    "Monoray Sistemleri",
    "Proses Vinçler",
    "Şarj / Döküm Vinçleri",
    "Transfer Arabaları Ve Bobin Tongları",
    "Kaldırma Kirişleri",
    "Vinç Komponentleri",
    "Elektrik Panoları Ve Otomasyon",
    "Montaj, Periyodik Bakım Ve Yedek Parça",
  ],
} as const;

/**
 * TİCARİ ŞART SATIRLARI. `Ödeme` satırı ayrıdır ve ALTINDA plan satırları
 * durur: belgede de öyledir ("Ödeme : … aşağıda belirtilen şekildedir." +
 * yüzdelerin listesi).
 */
export const TERM_ROW_DEFS: OfferRowDef[] = [
  { key: "validity", label: "Teklif Geçerlilik Süresi", list: "term.validity" },
  {
    // TESLİM SÜRESİ PARÇALIDIR (kullanıcı isteği, 17.08.2026: *"6 ve 10'u ayrı
    // ayrı seçebileyim, 4'ten 30'a kadar"*). Hazır cümle listesi her yeni
    // aralık için deftere bir madde daha yazdırıyordu; iki sayı ve bir başlangıç
    // olayı seçmek hem daha hızlı hem sınırsızdır.
    // Basılan metin devralınan tekliflerin yazımını korur:
    // "Avans Ödemesi Sonrası 6-10 Hafta".
    key: "deliveryTime",
    label: "Teslim Süresi",
    parts: [
      { key: "trigger", label: "Başlangıç", list: "term.deliveryTrigger" },
      // BİRİM ETİKETTE YAZMAZ (kullanıcı bildirimi, 17.08.2026: *"parantez
      // içinde yazmasına gerek yok, zaten altta birimi seçiyoruz"*). "En Az
      // (hafta)" yazıp altta "Ay" seçtirmek iki ayrı şey söyleyen bir form
      // demekti; birim TEK yerde sorulur.
      { key: "from", label: "En Az", list: "val.deliveryWeeks" },
      { key: "to", label: "En Çok", list: "val.deliveryWeeks", prefix: "-" },
      { key: "unit", label: "Birim", list: "val.deliveryUnit" },
    ],
  },
  {
    // NAKLİYE YANINA YER YAZILABİLİR (kullanıcı isteği): "Dahil" tek başına
    // nereye dahil olduğunu söylemiyor ve teklifin en sık sorulan sorusu bu.
    key: "freight",
    label: "Nakliye",
    parts: [
      { key: "scope", label: "Durum", list: "term.freight" },
      { key: "place", label: "Teslim Yeri", prefix: "— " },
    ],
  },
  { key: "erection", label: "Montaj ve Devreye Alma", list: "term.erection" },
  { key: "deliveryPlace", label: "Teslim Yeri ve Şekli", list: "term.deliveryPlace" },
  { key: "warranty", label: "Garanti", list: "term.warranty" },
  { key: "payment", label: "Ödeme", list: "term.paymentHeader" },
];

// —————————————————————————————————————————————————————— genel şartlar

/** Belgenin son sayfasındaki bölümün başlığı. */
export const GENERAL_TERMS_TITLE = "GENEL ŞARTLAR";

/**
 * GENEL ŞARTLAR DEFTERİ — teklifin son sayfasına basılan on madde.
 *
 * Metin kullanıcının yazdığı hâliyle, KELİMESİ DEĞİŞTİRİLMEDEN durur: bu bir
 * HUKUKÎ BEYANdır ve özetlenmesi, kısaltılması ya da "daha akıcı" yazılması
 * söylediği şeyi değiştirir. Aynı ayrımı hesap raporunun gizlilik metni için
 * `docs/agent/belge.md` zaten kurmuştu.
 *
 * **DEFTER KODDADIR, `offer_options`A GİRMEZ.** Üç sebep:
 *
 * 1. `offer_options` satırı TEK bir `value` taşır ve tekillik yalnız onun
 *    üzerinden kurulur. Madde ise başlık VE gövdedir; gövde, tekillik kuralının
 *    göremediği bir alan olurdu — aynı başlıkla iki farklı paragraf yan yana
 *    yaşayabilirdi ve hangisinin belgeye gittiği rastgele kalırdı.
 * 2. Tanımlar ekranı KISA satırlar basar (marka, güç, teslim cümlesi). 667
 *    karakterlik bir paragraf o ekranı bozar; tek satırlık bir kutuda
 *    düzenlenmesi de mümkün değildir.
 * 3. Defterdeki değerler bir DEĞER ÖNERİSİdir ("hangi markayı yazayım");
 *    buradaki metin bir BEYANdır. İkisini aynı tabloya koymak, sorumluluk
 *    sınırını çizen bir cümleyi bir açılır listenin seçeneği yapardı.
 *
 * **KAÇIŞ KAPISI:** metnin deploy beklemeden düzeltilmesi gerekirse doğru yer
 * yine `offer_options` DEĞİL, ayrı bir `offer_general_terms` tablosudur
 * (anahtar · başlık · gövde · sıra). Sorun tablonun kendisi değil SATIRIN
 * ŞEKLİDİR; o tablo geldiğinde bu sabit onun seed'i olur ve `key` bağı durduğu
 * için belgeler taşınmadan çalışmaya devam eder.
 *
 * **NUMARA BURADA YOKTUR.** Kaynak metindeki "1." "2." başlıkları bilerek
 * atıldı: numara gizlemeden SONRA türetilir (`printedGeneralTerms`). Deftere
 * yazılsaydı üçüncü madde kapatıldığında belge "1, 2, 4, 5…" diye basardı.
 *
 * Anahtarlar maddenin KONUSUNDAN türer, sırasından değil: madde sırası
 * değişirse `order3` gibi bir anahtar yalan söylemeye başlardı.
 */
export const GENERAL_TERM_DEFS: readonly OfferGeneralTermDef[] = [
  {
    key: "scope",
    title: "Kapsam ve Öncelik",
    body:
      "Teklif, belirtilen teknik özellikler, miktarlar, fiyatlar ve kapsam için " +
      "geçerlidir. Teklifte veya eklerinde proje özelinde belirtilen hükümler " +
      "bu Genel Şartlara göre önceliklidir. Teklifte açıkça yer almayan iş, " +
      "malzeme, hizmet ve dokümanlar kapsam dışıdır.",
  },
  {
    key: "order",
    title: "Sipariş ve Değişiklikler",
    body:
      "Sipariş, ORION CRANES'in yazılı teyidi ile kesinleşir. Sipariş " +
      "sonrasında talep edilen teknik veya ticari değişikliklerin fiyat ve " +
      "teslim süresine etkisi tarafların yazılı mutabakatı ile belirlenir. " +
      "Müşteri sipariş belgelerinde yer alan farklı şartlar, ORION CRANES " +
      "tarafından yazılı olarak kabul edilmedikçe teklif kapsamını değiştirmez.",
  },
  {
    key: "price",
    title: "Fiyat ve Ödeme",
    body:
      "Fiyat ve ödeme koşulları teklifte belirtildiği şekildedir. Teklifte aksi " +
      "belirtilmedikçe KDV, vergi, harç, banka ve teminat masrafları fiyatlara " +
      "dahil değildir. Ödemelerde veya Müşteri kaynaklı süreçlerde oluşabilecek " +
      "gecikmeler teslim programına yansıtılabilir. Müşteri kaynaklı nedenlerle " +
      "teslim programının önemli ölçüde ötelenmesi halinde, bu gecikmeden doğan " +
      "malzeme, işçilik ve diğer maliyet artışları taraflarca ayrıca " +
      "değerlendirilir.",
  },
  {
    key: "delivery",
    title: "Teslim Süresi",
    body:
      "Teslim süresi; sipariş teyidi, teklifte öngörülen avansın alınması ve " +
      "imalat için gerekli teknik bilgi ve onayların tamamlanması sonrasında " +
      "başlar. Müşteri onayları, saha hazırlıkları veya Müşteri kapsamındaki " +
      "işlerden kaynaklanan gecikmeler teslim süresine ilave edilir.",
  },
  {
    key: "acceptance",
    title: "Teslim, Risk ve Kabul",
    body:
      "Teslim, nakliye, montaj, devreye alma ve test kapsamı teklifte " +
      "belirtilen şartlara göre yürütülür. Risk, teklifte belirtilen teslim " +
      "şekline uygun olarak Müşteri'ye geçer. Müşteri kaynaklı nedenlerle hazır " +
      "ürünün sevk veya teslim edilememesi halinde, teslimata bağlı ödeme " +
      "vadeleri etkilenmez ve ürün uygun koşullarda Müşteri hesabına " +
      "depolanabilir. Müşteri kapsamındaki saha, altyapı, enerji ve erişim " +
      "şartlarının zamanında hazır olması esastır. Vincin kullanılmaya " +
      "başlanmasından itibaren 1 hafta veya işlerin tamamlandığının " +
      "bildirilmesinden itibaren 2 hafta içinde yazılı itiraz bulunmaması " +
      "halinde kabul gerçekleşmiş sayılır; garanti kapsamındaki haklar " +
      "saklıdır.",
  },
  {
    key: "warranty",
    title: "Garanti",
    body:
      "Teklifte aksi belirtilmedikçe garanti süresi devreye alma tarihinden " +
      "itibaren 24 ay olup fatura tarihinden itibaren 30 ayı aşmaz. Garanti, " +
      "ORION CRANES'ten kaynaklanan malzeme ve imalat hatalarını kapsar. " +
      "Garanti, vincin teklifte belirtilen sınıflandırma, kullanım amacı ve " +
      "çalışma koşulları içerisinde kullanılması halinde geçerlidir. Normal " +
      "aşınma, bakım eksikliği, hatalı veya amaç dışı kullanım, yetkisiz " +
      "müdahale ile belirtilen çalışma koşullarının aşılmasından kaynaklanan " +
      "arızalar garanti kapsamında değerlendirilmez.",
  },
  {
    key: "compliance",
    title: "Mevzuat, Standartlar ve Dokümantasyon",
    body:
      "Ürün, teklifte belirtilen teknik şartlar ve uygulanması zorunlu mevzuat " +
      "doğrultusunda tasarlanır ve teslim edilir. Teklif kapsamında bulunmayan " +
      "ilave standart, üçüncü taraf muayene, sertifikasyon veya dokümantasyon " +
      "taleplerinin fiyat ve teslim süresine etkisi ayrıca değerlendirilir.",
  },
  {
    key: "liability",
    title: "Sorumluluk ve Mücbir Sebep",
    body:
      "Uygulanabilir hukukun izin verdiği ölçüde ORION CRANES'in sözleşmeden " +
      "doğan toplam sorumluluğu sözleşme bedeli ile sınırlıdır; emredici " +
      "mevzuattan doğan sorumluluklar saklıdır. Üretim, kullanım ve kâr kaybı " +
      "gibi dolaylı zararlar kapsam dışındadır. Gecikme cezasının ayrıca " +
      "kararlaştırıldığı hallerde toplam gecikme cezası sözleşme bedelinin " +
      "%5'ini aşamaz. Tarafların kontrolü dışında gelişen ve makul olarak " +
      "önlenemeyen mücbir sebep hallerinde ilgili yükümlülük ve süreler olayın " +
      "etkisi ölçüsünde yeniden değerlendirilir.",
  },
  {
    key: "cancellation",
    title: "Siparişin İptali",
    body:
      "Siparişin ORION CRANES'ten kaynaklanmayan bir nedenle Müşteri tarafından " +
      "iptal edilmesi halinde, iptal tarihine kadar gerçekleştirilen " +
      "mühendislik, temin edilen malzeme ve alt tedarikçilere verilmiş " +
      "bağlayıcı siparişlerden doğan maliyetler Müşteri tarafından karşılanır.",
  },
  {
    key: "ip",
    title: "Fikri Haklar ve Uygulanacak Hukuk",
    body:
      "ORION CRANES tarafından hazırlanan tasarım, çizim, hesap ve teknik " +
      "dokümanlara ilişkin fikri haklar ORION CRANES'e aittir ve yalnızca " +
      "ilgili proje amacıyla kullanılabilir. Taraflar olası uyuşmazlıkları " +
      "öncelikle karşılıklı görüşme yoluyla çözmeye çalışır. Aksi yazılı olarak " +
      "kararlaştırılmadıkça Türk hukuku uygulanır ve Ankara Mahkemeleri ve İcra " +
      "Daireleri yetkilidir.",
  },
];

/** Fiyat satırının birimi — "1 Takım" en sık, "Kişi" süpervizörlük içindir. */
export const PRICE_UNIT_LIST = "val.priceUnit";

/**
 * Defterdeki BÜTÜN liste anahtarları — Tanımlar sayfası bunları gruplayarak
 * basar ve seed'in eksik bıraktığı liste burada görünür. Tek tek yazılmaz,
 * defterin kendisinden TÜRETİLİR: yeni bir alan eklendiğinde listesi de
 * kendiliğinden düzenlenebilir olur.
 */
export function allOfferListKeys(): string[] {
  const keys = new Set<string>();
  const yut = (defs: OfferRowDef[]) => {
    for (const row of defs) {
      if (row.list) keys.add(row.list);
      for (const part of row.parts ?? []) if (part.list) keys.add(part.list);
    }
  };
  for (const group of OFFER_GROUP_DEFS) yut(group.rows);
  yut(TEST_LOAD_ROW_DEFS);
  yut(TERM_ROW_DEFS);
  keys.add(PRICE_UNIT_LIST);
  for (const k of STANDALONE_LIST_KEYS) keys.add(k);
  return [...keys].sort();
}

/**
 * Bir satıra bağlı OLMAYAN listeler — ödeme planı satırları, notlar, kapsam
 * dışı maddeleri ve kapak metinleri. Defterden türetilemezler çünkü karşılık
 * geldikleri şey bir `OfferRow` değil, bir metin listesidir.
 */
export const STANDALONE_LIST_KEYS = [
  "term.paymentLine",
  "term.note",
  "term.exclusion",
  "cover.honorific",
  "cover.intro",
  // VİNÇ TİPİ ARTIK BİR SATIRA BAĞLI DEĞİLDİR ve bu yüzden BURADA durur.
  //
  // Liste anahtarları defterin satır tanımlarından TÜRETİLİR; `val.craneType`ı
  // kullanan tek satır (`GENEL > Vinç Tipi`) emekliye ayrılınca (md. 3) anahtar
  // türetmeden düştü ve sonuç sessizdi: dropdown'lar veritabanından
  // `list_key` ile süzdüğü için çalışmaya devam ediyor, kaybolan yalnız
  // TANIMLAR → DEFTERLER ekranındaki "Vinç Tipleri" KARTIYDI — yani listeyi
  // düzenlemenin tek yolu. Liste hâlâ gerçektir (kalem künyesindeki seçici ve
  // maliyet şablonu onu okur), yalnız artık bir `OfferRow`a değil kalemin
  // kendi alanına bağlıdır.
  "val.craneType",
] as const;

/**
 * Liste anahtarının insan okunur adı — Tanımlar sayfası bunu başlık olarak
 * basar. Anahtarın kendisi (`brand.motor`) bir iç addır ve ekranda geçmez
 * (yetki ekranının kuralıyla aynı: kod adı kullanıcıya bir şey anlatmaz).
 */
export const OFFER_LIST_LABELS: Record<string, string> = {
  "brand.motor": "Motor Markaları",
  "brand.gearbox": "Redüktör Markaları",
  "series.gearbox": "Redüktör Tip / Serileri",
  "brand.brake": "Fren Markaları",
  "brand.drive": "Sürücü Markaları",
  "series.drive": "Sürücü Serileri",
  "brand.bearing": "Rulman Markaları",
  "brand.pendant": "Kumanda Markaları",
  "series.pendant": "Kumanda Serileri",
  "brand.limit": "Limit Şalteri Markaları",
  "brand.trafo": "İzolasyon Trafosu Markaları",
  "brand.powerSupply": "Güç Kaynağı Markaları",
  "brand.terminal": "Klemens Markaları",
  "brand.loadcell": "Loadcell Markaları",
  "brand.signalization": "Sinyalizasyon Markaları",
  "brand.cable": "Kablo Markaları",
  "brand.resistor": "Direnç Markaları",
  "brand.switchgear": "Şalt Malzemesi Markaları",
  "brand.panel": "Pano Markaları",
  "brand.busbar": "Bara Markaları",
  "val.reeving": "Halat Donanımı",
  "val.speedControl": "Hız Kontrolü",
  "val.controlType": "Kontrol Tipi",
  "val.hook": "Kanca Tanımı",
  "val.ropeConstruction": "Halat Yapısı",
  "val.ropeGrade": "Halat Tel Mukavemeti",
  "val.ropeCore": "Halat Öz Tipi",
  "val.brakeType": "Fren Tipi",
  "val.safetyBrake": "Emniyet Freni Tanımı",
  "val.gearboxMounting": "Redüktör Bağlantısı",
  "val.wheelStandard": "Tekerlek Standardı",
  "val.wheelMaterial": "Tekerlek Malzemesi",
  "val.driveSystem": "Tahrik Sistemi",
  "val.travelSystem": "Yürütme Sistemi",
  "val.rail": "Ray Tipleri",
  "val.craneClass": "Vinç Sınıfı",
  "val.craneType": "Vinç Tipleri",
  "val.environmentPlace": "Çalışma Ortamı",
  "val.tempMin": "Sıcaklık — En Düşük",
  "val.tempMax": "Sıcaklık — En Yüksek",
  "val.motorPower": "Motor Güçleri",
  "val.motorRpm": "Motor Devirleri",
  "val.drivePower": "Sürücü Güçleri",
  "val.wheelDia": "Tekerlek Çapları",
  "val.ropeDia": "Halat Çapları",
  // Birim ayrı seçildiği için liste SAYILARI taşır, haftaları değil.
  "val.deliveryWeeks": "Teslim Süresi Sayıları",
  "val.deliveryUnit": "Teslim Süresi Birimi",
  "term.deliveryTrigger": "Teslim Süresi Başlangıcı",
  "val.girder": "Kiriş Yapısı",
  "val.girderCalc": "Kiriş Hesabı",
  "val.steelGrade": "Çelik Kalitesi",
  "val.platform": "Platform",
  "val.paint": "Boya",
  "val.supplyVoltage": "Besleme Gerilimi",
  "val.controlVoltage": "Kontrol Gerilimi",
  "val.runwayPower": "Hol Boyu Elektrik",
  "val.plc": "PLC Modelleri",
  "val.hmiPanel": "HMI Panel Modelleri",
  "val.scope": "Kapsam İfadeleri",
  "val.testDynamic": "Dinamik Test",
  "val.testStatic": "Statik Test",
  "val.priceUnit": "Fiyat Birimleri",
  "term.validity": "Teklif Geçerlilik Süresi",
  "term.deliveryTime": "Teslim Süresi",
  "term.freight": "Nakliye",
  "term.erection": "Montaj ve Devreye Alma",
  "term.deliveryPlace": "Teslim Yeri ve Şekli",
  "term.warranty": "Garanti",
  "term.paymentHeader": "Ödeme Başlığı",
  "term.paymentLine": "Ödeme Planı Satırları",
  "term.note": "Notlar",
  "term.exclusion": "Kapsam Dışı İşler",
  "cover.honorific": "Hitap Eki",
  "cover.intro": "Giriş Paragrafı",
};

export function offerListLabel(key: string): string {
  return OFFER_LIST_LABELS[key] ?? key;
}

/**
 * Tanımlar sayfasının ÖBEKLERİ — anahtarın önekinden çıkar, elle liste
 * yazılmaz. Yeni bir alan eklendiğinde listesi kendiliğinden doğru öbeğe düşer.
 */
export function offerListGroup(key: string): "marka" | "teknik" | "ticari" | "kapak" {
  if (key.startsWith("brand.") || key.startsWith("series.")) return "marka";
  if (key.startsWith("term.")) return "ticari";
  if (key.startsWith("cover.")) return "kapak";
  return "teknik";
}


// ————————————————————————————————————————————— genel özellikler okuma

/**
 * GENEL ÖZELLİKLER grubunun bir satırının/parçasının HAM metni.
 *
 * Kalem künyesi, kalem başlığı ve yardımcı kaldırmanın kendiliğinden açılması
 * üçü de aynı satırları okur. Okumanın tek yerde olması, "kapasite hangi
 * satırın hangi parçasındadır" sorusunun tek cevabı olması demektir — üç yerde
 * yazılsaydı defterde bir anahtar değiştiğinde ikisi susardı.
 */
interface GenelGruplar {
  readonly key: string;
  readonly rows: readonly { key: string; value?: string; parts?: Record<string, string> }[];
}

export function generalRowPart(
  groups: readonly GenelGruplar[],
  rowKey: string,
  partKey: string
): string {
  const genel = groups.find((g) => g.key === GENERAL_GROUP_KEY);
  return (genel?.rows.find((r) => r.key === rowKey)?.parts?.[partKey] ?? "").trim();
}

/** Yardımcı kaldırma tonajı — girildiği anda yardımcı kaldırma bölümü açılır. */
export function auxCapacity(groups: readonly GenelGruplar[]): string {
  return generalRowPart(groups, "capacity", "aux");
}

// ————————————————————————————————————————————— kalem künyesi türetme

/**
 * KALEM KÜNYESİ TEKNİK SATIRLARDAN TÜRETİLİR.
 *
 * Kullanıcı isteği (17.08.2026): *"Kapasite ve açıklığı genel özelliklerde
 * sorsun. Üstte sormasına gerek yok. Aynı bilgiyi iki defa alıyoruz."*
 *
 * Künyedeki sayılar teklif listesindeki tonaj/vinç tipi süzgeçlerini besler
 * (`offer_list` görünümü onları payload'dan okur). Artık ayrı sorulmuyorlar;
 * kaydetme yolunda GENEL ÖZELLİKLER satırlarından çıkarılıyorlar. Böylece iki
 * yerde yaşayan bir sayının ayrışma ihtimali de ortadan kalkıyor.
 *
 * Değer OKUNAMIYORSA `null` döner — süzgeçte görünmez ama uydurma bir sayı da
 * üretilmez (değişmez md. 4).
 */
export function itemFactsFromRows(
  groups: readonly {
    key: string;
    rows: readonly { key: string; value?: string; parts?: Record<string, string> }[];
  }[]
): { capacityT: number | null; spanM: number | null } {
  const genel = groups.find((g) => g.key === "general");
  const oku = (rowKey: string, partKey: string): string =>
    genel?.rows.find((r) => r.key === rowKey)?.parts?.[partKey] ?? "";
  // NOKTA HER ZAMAN BİNLİK DEĞİLDİR (kullanıcı bildirimi 18.08.2026): köprü
  // açıklığına "12.44" yazan kullanıcı 12,44 m demek istiyor, bin iki yüz
  // kırk dört değil. Eski çözümleyici bütün noktaları siliyordu ve künyeye
  // 1244 m yazıyordu — sessizce, çünkü belgeye BASILAN metin ("12.44 m")
  // doğru kalıyor, bozulan yalnız türetilen sayı oluyordu. Sonuç: teklif
  // listesindeki süzgeç ve maliyetin açıklık girdisi yüz kat şişiyordu.
  //
  // `parseNum` ayrımı yazımdan okur: virgül varsa nokta BİNLİKTİR
  // ("1.500,25"), yoksa nokta ancak ARDINDA TAM ÜÇ HANE varsa binliktir
  // ("1.500" → 1500) — "12.44" ondalık kalır.
  const sayi = (ham: string): number | null => parseNum(ham);
  // VİNÇ TİPİ ARTIK BURADAN TÜRETİLMEZ (md. 3): tek soruluşu kalem
  // künyesindeki `item.craneType` alanıdır ve türetilecek bir satır yoktur.
  return {
    capacityT: sayi(oku("capacity", "main")),
    spanM: sayi(oku("span", "value")),
  };
}

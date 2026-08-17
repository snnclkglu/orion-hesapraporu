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

import type { OfferGroupDef, OfferPartDef, OfferRowDef } from "./types";

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
  // "2 x 5.5 kW" — çift motorlu yürütme gruplarında adet ÖNCE yazılır.
  { key: "count", label: "Adet", numeric: true, suffix: " x" },
  { key: "power", label: "Güç", numeric: true, suffix: " kW" },
  { key: "rpm", label: "Devir", numeric: true, suffix: " d/dak" },
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

const DRIVE_PARTS: OfferPartDef[] = [
  { key: "brand", label: "Marka", list: "brand.drive" },
  { key: "series", label: "Seri", list: "series.drive", childOf: "brand" },
  SECENEKLER,
];

const WHEEL_PARTS: OfferPartDef[] = [
  { key: "count", label: "Adet", numeric: true, suffix: " x" },
  { key: "dia", label: "Çap", numeric: true, prefix: "Ø" },
  { key: "standard", label: "Standart", list: "val.wheelStandard" },
  { key: "material", label: "Malzeme / Sertlik", list: "val.wheelMaterial" },
];

const ROPE_PARTS: OfferPartDef[] = [
  { key: "dia", label: "Çap", numeric: true, prefix: "Ø" },
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
  { key: "capacity", label: "Kaldırma Kapasiteleri (Q)", hint: "Ana / yardımcı: «30.000 kg / 5.000 kg»" },
  {
    key: "environment",
    label: "Çalışma Ortamı / Sıcaklığı",
    parts: [
      { key: "place", label: "Ortam", list: "val.environmentPlace" },
      { key: "temp", label: "Sıcaklık Aralığı", list: "val.temperatureRange", comma: true },
    ],
  },
  { key: "span", label: "Köprü Açıklığı", parts: [{ key: "value", label: "Açıklık", numeric: true, suffix: " m" }] },
  { key: "liftHeight", label: "Kaldırma Yüksekliği", parts: [{ key: "value", label: "Yükseklik", numeric: true, suffix: " m" }] },
  { key: "craneClass", label: "Vinç Sınıfı / Çelik Yapı", list: "val.craneClass" },
  { key: "craneType", label: "Vinç Tipi", list: "val.craneType" },
  { key: "runway", label: "Yürüme Yolu" },
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
  { key: "rail", label: "Köprü Rayı", list: "val.rail" },
  { key: "runwayRail", label: "Yürüme Yolu Rayı", list: "val.rail" },
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
  { key: "girderPower", label: "Kiriş Boyu Elektrik" },
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
 * GRUP DEFTERİ. Sıra BELGENİN SIRASIDIR: genel özelliklerden başlanır, tahrik
 * grupları yukarıdan aşağıya izler, çelik yapı ve elektrik sona kalır — on
 * dört teklifin on dördünde bu düzen var.
 */
export const OFFER_GROUP_DEFS: OfferGroupDef[] = [
  { key: "general", title: "GENEL ÖZELLİKLER", rows: GENEL },
  { key: "mainHoist", title: "KALDIRMA GRUBU", rows: KALDIRMA },
  { key: "auxHoist", title: "YARDIMCI KALDIRMA GRUBU", rows: KALDIRMA },
  { key: "trolley", title: "VİNÇ ARABASI", rows: YURUTME },
  { key: "bridge", title: "KÖPRÜ GRUBU", rows: KOPRU },
  { key: "gantry", title: "PORTAL YÜRÜTME GRUBU", rows: KOPRU },
  { key: "boom", title: "BOM GRUBU", rows: BOM },
  { key: "steel", title: "ÇELİK KONSTRÜKSİYON", rows: CELIK },
  { key: "electrical", title: "ELEKTRİK SİSTEMİ", rows: ELEKTRIK },
];

export const OFFER_GROUP_DEF_BY_KEY: Record<string, OfferGroupDef> = Object.fromEntries(
  OFFER_GROUP_DEFS.map((g) => [g.key, g])
);

/** Serbest grup — defterde karşılığı olmayan bir öbek eklendiğinde kullanılır. */
export const CUSTOM_GROUP_KEY = "custom";

/**
 * Bir satırın defterdeki tanımı. Grup anahtarı bilinmiyorsa (serbest grup) ya
 * da satır elle eklenmişse `undefined` döner — o satır düz metin kutusu olur.
 */
export function offerRowDef(groupKey: string, rowKey: string): OfferRowDef | undefined {
  return OFFER_GROUP_DEF_BY_KEY[groupKey]?.rows.find((r) => r.key === rowKey);
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

export const TERMS_TITLE = "FİYAT, TESLİM VE ÖDEME ŞEKLİ";

/**
 * TİCARİ ŞART SATIRLARI. `Ödeme` satırı ayrıdır ve ALTINDA plan satırları
 * durur: belgede de öyledir ("Ödeme : … aşağıda belirtilen şekildedir." +
 * yüzdelerin listesi).
 */
export const TERM_ROW_DEFS: OfferRowDef[] = [
  { key: "validity", label: "Teklif Geçerlilik Süresi", list: "term.validity" },
  { key: "deliveryTime", label: "Teslim Süresi", list: "term.deliveryTime" },
  { key: "freight", label: "Nakliye", list: "term.freight" },
  { key: "erection", label: "Montaj ve Devreye Alma", list: "term.erection" },
  { key: "deliveryPlace", label: "Teslim Yeri ve Şekli", list: "term.deliveryPlace" },
  { key: "warranty", label: "Garanti", list: "term.warranty" },
  { key: "payment", label: "Ödeme", list: "term.paymentHeader" },
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
  "val.temperatureRange": "Sıcaklık Aralıkları",
  "val.girder": "Kiriş Yapısı",
  "val.girderCalc": "Kiriş Hesabı",
  "val.steelGrade": "Çelik Kalitesi",
  "val.platform": "Platform",
  "val.paint": "Boya",
  "val.supplyVoltage": "Besleme Gerilimi",
  "val.controlVoltage": "Kontrol Gerilimi",
  "val.runwayPower": "Hol Boyu Elektrik",
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

// MALİYET BELGESİNİN KURULMASI, TAŞINMASI VE TEKLİFTEN TÜRETİLMESİ.
//
// Teklifin `payload.ts`i ile aynı üç işi yapar (kurma · taşıma · süzme) ve bir
// dördüncüsünü ekler: TEKLİFTEN TÜRETME. Kullanıcı isteği (17.08.2026): *"her
// vinç grubu için nasıl teklif şablonum var ise benzer bir maliyet şablonumu
// oluşturacağım … bu detaylara da teklif'ten otomatik satırların gelmesi."*
//
// TÜRETME BİR EYLEMDİR, bir yan etki değil. Kaydetmede kendiliğinden koşsaydı
// kullanıcının bilerek sildiği bir satır her kaydetmede geri gelir, elle
// düzelttiği bir girdi teklifin değeriyle sessizce ezilirdi (TEKLIF-14'ün
// "yalnız açılışta" kuralının aynı gerekçesi). Bu yüzden `withOfferSync`
// yalnız "Tekliften Tazele" düğmesinden ve maliyet açılırken çağrılır.

import { RAILS } from "@/lib/calc/tables";
import { trSayi } from "@/lib/drawings/tr-text";
// AD ALANLARI BÜYÜK HARF SAKLANIR (değişmez md. 3) ve dönüşüm `adBuyuk`la
// yapılır: düz `toUpperCase()` "Çelik İmalat İşçiliği"ni "CELIK IMALAT
// ISCILIGI" yapardı. `pdf/brand.tsx`teki `trUpper` aynı işi görür ama
// buraya ithal EDİLMEZ — @react-pdf'i sürükler ve bu çekirdek saftır.
import { adBuyuk } from "@/lib/tr-text";
import type { OfferItem, OfferPayload } from "../types";
import { hesapla, type CostModelResult } from "./model";
// HALAT DONANIMI TEKLİFTEN OKUNMAZ, KATSAYIDAN GELİR — kullanıcının kendi
// cümlesi (18.08.2026, md. 1): *"Halat donanımını otomatik katsayılardan
// seçilsin ancak müşteri dropdown da değiştirebilsin."* Teklifteki "4/1"
// yazımını girdiye seed etmek, modelin kapasite eşiklerinden çıkardığı öneriyi
// belgedeki bir metinle ezmek olurdu; şerit ikisini zaten yan yana gösterir.
import { costUpperBound } from "./oku";
import { COST_PARAM_DEFAULTS, DEFAULT_CRANE_CLASS, craneClassFrom, type CraneClass } from "./params";
import {
  COST_GROUP_DEF_BY_KEY,
  CUSTOM_COST_GROUP_KEY,
  DEFAULT_RATE_GROUPS,
  FABRICATION_GROUP_KEY,
  GENERAL_GROUP_KEY,
  MATERIAL_PRICE_DEFAULTS,
  costGroupKeysForOfferItem,
  costGroupLineDefs,
  costTemplateFor,
} from "./registry";
import { withCostTotals } from "./totals";
import { costGroupLines, isLumpLine, lumpLineKey } from "./types";
import type {
  CostGroup,
  CostInputs,
  CostItem,
  CostLine,
  CostLineDef,
  CostPayload,
  CostRateGroup,
  CostTemplate,
  CostTemplateSkeleton,
} from "./types";

export const COST_PAYLOAD_VERSION = 1;

export function newCostId(): string {
  return crypto.randomUUID();
}

// ————————————————————————————————————————————————————————— kurma

/**
 * BOŞ GİRDİ KÜMESİ.
 *
 * Ölçüler `null` başlar ve UYDURULMAZ (değişmez md. 4): kapasitesi
 * bilinmeyen bir vinç "0 ton" değildir, model o dalı hiç çalıştırmaz ve
 * ekranda eksik girdiyi yazıyla söyler. Sayılabilir olanlar (kiriş adedi,
 * teker adedi) ise gerçek bir varsayılan taşır — çift kirişli bir vinçte
 * iki kiriş vardır ve bunu her seferinde yazdırmak bilgi değil angarya olur.
 */
export function emptyCostInputs(gantry = false): CostInputs {
  return {
    capacityT: null,
    auxCapacityT: null,
    spanM: null,
    liftHeightM: null,
    liftSpeedMpm: null,
    trolleySpeedMpm: null,
    bridgeSpeedMpm: null,
    craneClass: DEFAULT_CRANE_CLASS,
    ambientC: 40,
    girderCount: 2,
    legHeightM: null,
    // PORTALDE DÖRT AYAK, HER AYAKTA İKİ TEKER. Köprü vincinde iki başkiriş,
    // her birinde iki teker. İkisi de sayılabilir gerçeklerdir, tahmin değil.
    bridgeWheelCount: gantry ? 8 : 4,
    bridgeDriveCount: gantry ? 4 : 2,
    trolleyDriveCount: 2,
    gantry,
    cabin: false,
    movingCabin: false,
    electricRoom: false,
    heatShield: false,
    bridgeRailCode: "",
    trolleyRailCode: "",
  };
}

export function costLineFromDef(def: CostLineDef): CostLine {
  return {
    id: newCostId(),
    key: def.key,
    label: def.label,
    qtySource: def.qtySource,
    priceSource: def.priceSource,
    qty: null,
    unit: def.unit,
    unitPrice: null,
  };
}

/** Bir grubun götürü satırı — anahtarı grup anahtarından türer, sabittir. */
export function lumpCostLine(groupKey: string, title: string): CostLine {
  return {
    id: newCostId(),
    key: lumpLineKey(groupKey),
    // AD BÜYÜK HARFTİR (kullanıcı isteği 19.08.2026): götürü satır da bir
    // maliyet kalemidir ve listede kardeşleriyle aynı yazımda durmalıdır.
    label: adBuyuk(`${title} (götürü)`),
    // ADET BİRDİR ÇÜNKÜ GÖTÜRÜ SATIRIN MİKTARI YOKTUR: girilen sayı grubun
    // toplam bedelidir. Miktarı boş bırakmak satırı toplamdan düşürürdü.
    qty: 1,
    unit: "takım",
    unitPrice: null,
  };
}

/**
 * GRUBU GÖTÜRÜ KİPE ALIR ya da kalem kipine döndürür.
 *
 * KİP BİR BAYRAKTIR, BİR TAŞIMA DEĞİL: satırlar ne silinir ne de `hidden`
 * işaretlenir; hangi satırların sayılacağını `costGroupLines` kipe bakarak
 * söyler. Kalem satırlarını gizleyerek geçmek daha kolaydı ve bir şeyi
 * bozardı — kullanıcının KENDİ gizlediği satırlar geri dönüşte açılır,
 * yani bir düğmeye basmak başka bir kararı sessizce silerdi.
 */
export function withLumpMode(group: CostGroup, lump: boolean): CostGroup {
  // SATIR YALNIZ GÖTÜRÜYE GEÇERKEN AÇILIR. Kip argümanına bakmayan bir sürüm,
  // hiç götürüye geçmemiş bir grupta "Kalem" düğmesine basıldığında belgeye
  // boş bir `gotur-…` satırı yazıyordu: ekranda görünmüyor (kip süzüyor),
  // toplama girmiyor, ama kayıtta duruyor ve bir gün "bu satır ne" diye
  // sorulacak.
  const varMi = group.lines.some(isLumpLine);
  return {
    ...group,
    lump,
    lines: lump && !varMi ? [...group.lines, lumpCostLine(group.key, group.title)] : group.lines,
  };
}

/** Serbest satırın anahtarı benzersizdir ki iki satır birbirine karışmasın. */
export function freeCostLine(): CostLine {
  return {
    id: newCostId(),
    key: `serbest-${newCostId().slice(0, 8)}`,
    label: "",
    qty: null,
    unit: "takım",
    unitPrice: null,
  };
}

/**
 * Defterdeki bir grubu belgeye kurar.
 *
 * İSKELET SATIRLARI SÜZER, GRUBU DEĞİL: buraya gelen anahtar zaten
 * `costGroupKeysForOfferItem`ten geçmiştir. Şablonun bu grupta kapattığı
 * satırlar hiç açılmaz (`costGroupLineDefs`).
 */
export function costGroupFromKey(
  key: string,
  id = newCostId(),
  skeleton?: CostTemplateSkeleton
): CostGroup {
  const def = COST_GROUP_DEF_BY_KEY[key];
  return {
    id,
    key,
    title: def?.title ?? "YENİ BÖLÜM",
    lines: costGroupLineDefs(key, skeleton).map(costLineFromDef),
  };
}

function defaultRateGroups(): CostRateGroup[] {
  return DEFAULT_RATE_GROUPS.map((r) => ({ ...r, lines: [] }));
}

export function emptyCostPayload(
  currency = "EUR",
  materialPrices: Record<string, number | null> = { ...MATERIAL_PRICE_DEFAULTS }
): CostPayload {
  return {
    version: COST_PAYLOAD_VERSION,
    sourceRevNo: null,
    currency,
    params: { ...COST_PARAM_DEFAULTS },
    // YENİ BELGE global Hammadde Fiyatları defterinin ANLIK KOPYASINI taşır.
    // Çağrı parametresi verilmezse yalnız test/önizleme için kod tohumu
    // kullanılır. Taşıma yolu (`withCostDefaults`) bunu YAPMAZ: kullanıcının
    // belge içinde bilerek boşalttığı ya da değiştirdiği fiyat geri gelmez.
    materialPrices: { ...materialPrices },
    items: [],
    removedOfferItemIds: [],
    manualLineWeights: {},
    overviewMargins: {},
    general: costGroupFromKey(GENERAL_GROUP_KEY),
    rates: defaultRateGroups(),
    notes: "",
    direct: null,
    total: null,
  };
}

// ————————————————————————————————————————————— tekliften okuma

/** Teklif kaleminin bir satırının parçası — okunamayan alan boş metindir. */
function part(item: OfferItem, groupKey: string, rowKey: string, partKey: string): string {
  const g = item.groups.find((x) => x.key === groupKey);
  return (g?.rows.find((r) => r.key === rowKey)?.parts?.[partKey] ?? "").trim();
}

function value(item: OfferItem, groupKey: string, rowKey: string): string {
  const g = item.groups.find((x) => x.key === groupKey);
  return (g?.rows.find((r) => r.key === rowKey)?.value ?? "").trim();
}

/** Köprü mü portal mı — kalemde hangisi varsa yürütme okuması ondan yapılır. */
export function travelGroupKey(item: OfferItem): "gantry" | "bridge" {
  return item.groups.some((g) => g.key === "gantry") ? "gantry" : "bridge";
}

/**
 * TEKLİF KALEMİNİN TEKNİK SATIRLARINDAN MÜHENDİSLİK GİRDİSİ ÇIKARIR.
 *
 * Kullanıcı bu sayıları teklifi yazarken ZATEN girdi: kapasite, açıklık,
 * kaldırma yüksekliği, hızlar, vinç sınıfı, motor ve teker adetleri hepsi
 * belgede duruyor. Maliyet sayfasında bir daha sormak, aynı bilgiyi ikinci kez
 * istemek olurdu — ve iki kopya er geç ayrışırdı (TEKLIF-20'nin gerekçesi).
 *
 * OKUNAMAYAN DEĞER `null` KALIR. Teklifte "19,5" yazan bir açıklık okunur,
 * "yaklaşık 20 m" yazan okunmaz ve uydurulmaz; ekran hangi girdinin eksik
 * olduğunu söyler ve kullanıcı elle yazar.
 *
 * HIZLAR `trSayi` İLE OKUNAMAZ, `costUpperBound` İLE OKUNUR (kullanıcı isteği
 * 18.08.2026, md. 1: *"teklifte istenen kaldırma hızına göre otomatik hızı
 * ayarlasın"*). Teklif defteri hız satırını ARALIK olarak tarif eder ("1-6",
 * "20 - 30") ve `trSayi` bir aralığı `null` sayar. Sonuç sessizdi ve ağırdı:
 * kaldırma hızı boş kalınca halat hızı, tahvil oranı, motor momenti, hesap
 * gücü, SEÇİLEN MOTOR ve sürücünün hepsi hiç hesaplanmıyordu. Üst uç alınır —
 * gerekçesi `oku.ts`te.
 */
export function inputsFromOfferItem(item: OfferItem, onceki?: CostInputs): CostInputs {
  const tip = `${item.craneType} ${item.title}`.toLocaleUpperCase("tr-TR");
  const gantry = tip.includes("PORTAL");
  const taban = onceki ?? emptyCostInputs(gantry);
  const yur = travelGroupKey(item);

  const adet = (g: string, r: string, p: string, yedek: number): number => {
    const n = trSayi(part(item, g, r, p));
    return n !== null && n > 0 ? Math.round(n) : yedek;
  };
  /** Elle girilmiş bir değeri EZMEZ; yalnız boş alanı doldurur. */
  const doldur = (mevcut: number | null, yeni: number | null): number | null =>
    mevcut !== null ? mevcut : yeni;

  const sinif = craneClassFrom(value(item, "general", "craneClass"));

  return {
    ...taban,
    capacityT: doldur(taban.capacityT, item.capacityT ?? trSayi(part(item, "general", "capacity", "main"))),
    auxCapacityT: doldur(taban.auxCapacityT, trSayi(part(item, "general", "capacity", "aux"))),
    spanM: doldur(
      taban.spanM,
      item.spanM ??
        trSayi(part(item, "general", "span", "value")) ??
        // PERGELDE AÇIKLIK "BOM AÇIKLIĞI"NDA yazar; bir kalemde yalnız biri
        // doludur (kalem başlığı türetmesiyle aynı kural, TEKLIF-28).
        trSayi(part(item, "general", "boomSpan", "value"))
    ),
    liftHeightM: doldur(taban.liftHeightM, trSayi(part(item, "general", "liftHeight", "value"))),
    liftSpeedMpm: doldur(taban.liftSpeedMpm, costUpperBound(part(item, "mainHoist", "liftSpeed", "range"))),
    trolleySpeedMpm: doldur(taban.trolleySpeedMpm, costUpperBound(part(item, "trolley", "travelSpeed", "range"))),
    bridgeSpeedMpm: doldur(taban.bridgeSpeedMpm, costUpperBound(part(item, yur, "travelSpeed", "range"))),
    legHeightM: doldur(taban.legHeightM, trSayi(part(item, "general", "gantryLegHeight", "value"))),
    craneClass: (sinif ?? taban.craneClass) as CraneClass,
    gantry: gantry || taban.gantry,
    bridgeWheelCount: adet(yur, "wheel", "count", taban.bridgeWheelCount),
    bridgeDriveCount: adet(yur, "motor", "count", taban.bridgeDriveCount),
    trolleyDriveCount: adet("trolley", "motor", "count", taban.trolleyDriveCount),
    // RAY KODU TEKLİFTEN OKUNUR ama ELLE EZİLEBİLİR (md. 12): satır serbest
    // metindir ve tanınmayan bir yazımda okuma boş döner — kullanıcının
    // seçtiği kod o zaman yerinde kalır.
    bridgeRailCode: taban.bridgeRailCode || railCodeFrom(value(item, yur, "rail")),
    // ARABA RAYI AÇILIŞTA KÖPRÜNÜNKİYLE AYNIDIR: teklifte araba rayı diye bir
    // satır yoktur ve çoğu vinçte iki teker aynı profilde koşar.
    trolleyRailCode: taban.trolleyRailCode || railCodeFrom(value(item, yur, "rail")),
  };
}

/**
 * SERBEST RAY METNİNDEN KATALOG KODU — tanınmazsa BOŞ.
 *
 * Teklif satırı defterden seçilir ama yazımı serbesttir: "A55", "A 55",
 * "A55 DIN 536", "40x30 Ray". Ayıklama iki biçimi tanır — A serisi (A65) ve
 * kare/dikdörtgen çubuk (50x50, 70x40) — ve sonucu `RAILS` defterinde
 * DOĞRULAR. Doğrulamak şarttır: tanınmayan bir kod ray başı genişliğini `NaN`
 * yapar ve basınç hesabı sessizce çalışmaz hâle gelirdi.
 */
export function railCodeFrom(text: string | null | undefined): string {
  const t = (text ?? "").toLocaleUpperCase("tr-TR");
  const a = t.match(/\bA\s*(\d{2,3})\b/);
  if (a && RAILS[`A${a[1]}`]) return `A${a[1]}`;
  const kare = t.match(/\b(\d{2,3})\s*[X*]\s*(\d{2,3})\b/);
  if (kare && RAILS[`${kare[1]}x${kare[2]}`]) return `${kare[1]}x${kare[2]}`;
  return "";
}

/**
 * TEKLİF KALEMİNE KARŞILIK GELEN MALİYET KALEMİ kurar.
 *
 * Gruplar kalemin KENDİ bölümlerinden çıkar (`costGroupKeysForOfferItem`):
 * yardımcı kaldırması olan bir vinçte maliyette de yardımcı kaldırma grubu
 * açılır. Vinç tipini maliyet tarafında ikinci kez SORMAK yoktur (TEKLIF-32'nin
 * tersi olurdu) — tip teklif kaleminin kendisinden okunur.
 *
 * ŞABLON VERİLİRSE tipin defterdeki iskeleti uygulanır (kullanıcı isteği
 * 19.08.2026, md. 10); verilmezse bugünkü varsayılan küme kurulur. Şablonlar
 * PARAMETREDİR, burada okunmaz: bu çekirdek veritabanı görmez (değişmez md. 7)
 * ve bir maliyet çalışmasının iskeleti kurulurken hangi defterin geçerli
 * olduğu çağrı yerinin bilgisidir.
 */
export function costItemFromOfferItem(
  item: OfferItem,
  sira: number,
  templates?: readonly CostTemplate[]
): CostItem {
  const inputs = inputsFromOfferItem(item);
  const skeleton = costTemplateFor(templates, item.craneType);
  return {
    id: newCostId(),
    offerItemId: item.id,
    title: item.title || `KALEM - ${sira}`,
    craneType: item.craneType ?? "",
    // ADET BİRDİR ve bu bir varsayım değil: teklif kalemi TEK bir ürünü
    // tarif eder; aynı üründen iki adet isteniyorsa fiyat satırında adet
    // yazar ve kullanıcı burada da yazar.
    qty: 1,
    inputs,
    overrides: {},
    groups: costGroupKeysForOfferItem(item.groups.map((g) => g.key), skeleton).map((k) =>
      costGroupFromKey(k, undefined, skeleton)
    ),
  };
}

/** Serbest maliyet kalemi — teklifte karşılığı olmayan bir iş. */
export function freeCostItem(title = ""): CostItem {
  return {
    id: newCostId(),
    offerItemId: null,
    title,
    craneType: "",
    qty: 1,
    inputs: emptyCostInputs(),
    overrides: {},
    groups: [costGroupFromKey("steel"), costGroupFromKey("assembly")],
  };
}

export interface OfferSyncSonuc {
  payload: CostPayload;
  /** Yeni açılan kalem sayısı. */
  eklenen: number;
  /** Teklifte artık bulunmayan, bağı kopmuş kalem sayısı. */
  yetim: number;
}

/**
 * MALİYETİ TEKLİFLE EŞİTLER — açılışta ve "Tekliften Tazele" düğmesinde.
 *
 * Üç iş yapar ve üçü de EKLEYİCİDİR, silici değil:
 *   · Teklifte olup maliyette olmayan kalem AÇILIR.
 *   · Bağlı kalemin başlığı ve vinç tipi TAZELENİR (teklif başlığı türetilir,
 *     maliyetinki onu izlemelidir; ikisi ayrışırsa kırılım ekranında hangi
 *     vincin maliyeti olduğu okunamaz).
 *   · BOŞ girdiler teklifin satırlarından DOLDURULUR; dolu olana dokunulmaz.
 *
 * TEKLİFTEN SİLİNEN KALEMİN MALİYETİ SİLİNMEZ, bağı KOPAR (`offerItemId`
 * null olur). Silmek, girilmiş bütün birim fiyatları sessizce götürürdü —
 * teklif kalemini yanlışlıkla silip geri ekleyen bir kullanıcı maliyeti
 * baştan yazmak zorunda kalırdı. Ekran yetim kalemi işaretler.
 */
/**
 * DEFTERDE OLUP BELGEDE OLMAYAN SATIRLARI EKLER — yalnız TAZELEMEDE.
 *
 * Deftere yeni bir satır girdiğinde (Profil, Ray, Boya İşçiliği…) o satır
 * ancak yeni açılan maliyet çalışmalarında görünürdü; süren bir teklifin
 * maliyeti onu hiç göremezdi. Kalemler için zaten geçerli olan kural
 * (MALIYET-9: "teklifte olup maliyette olmayan kalem AÇILIR") satırlara da
 * uygulanır ve aynı iki şartı taşır:
 *
 *   · EKLEYİCİDİR — hiçbir satır silinmez, sırası değişmez; yeni satırlar
 *     grubun SONUNA eklenir.
 *   · YALNIZ AÇIK BİR EYLEMDE koşar ("Tekliften Tazele"), kaydetmede değil.
 *     Kaydetmenin yan etkisi olsaydı kullanıcının bilerek sildiği satır her
 *     kaydetmede geri gelirdi (TEKLIF-14'ün gerekçesi).
 *
 * FİYAT BAĞI GEÇMİŞE DÖNÜK KURULUR AMA DEĞER EZİLMEZ: deftere sonradan
 * eklenen `priceSource`, fiyatı ZATEN GİRİLMİŞ bir satıra `priceManual` ile
 * bağlanır. Bağ kaydedilir (kullanıcı asa düğmesiyle şeride geçebilir) ama
 * girilmiş sayı olduğu gibi kalır — bir alan eklemek, tedarikçiyle
 * konuşulmuş bir fiyatı silmenin gerekçesi olamaz.
 *
 * DEFTERDE DEĞİŞEN KAYNAK DA TAZELENİR — ama YALNIZ İNSAN DEVRALMAMIŞSA.
 * Kesim satırı 19.08.2026'da `w.steel`den `w.steelWithFire`a çevrildi ve
 * eksik-olanı-doldur kuralı onu belgeye hiç taşımıyordu: defteri değiştirmek
 * hiçbir çalışmayı etkilemiyor, kullanıcı "değiştirdim ama maliyetim aynı"
 * diyordu. `qtySource`/`priceSource` BİR İNSAN KARARI DEĞİLDİR (ekranda
 * düzenlenmez, defterden kopyalanır); insanın kararı `qtyManual`/`priceManual`
 * bayraklarıdır ve tazeleme onlara DOKUNMAZ.
 *
 * AD (`label`) BU KURALIN DIŞINDADIR: satırın adı ekranda düzenlenebilir bir
 * kutudur (kullanıcı "Kaldırma Motoru"nu "Kaldırma Motoru — GAMAK" yapar) ve
 * defterden tazelemek o düzeltmeyi sessizce silerdi.
 *
 * KİLİTLİ BELGE BU YOLDAN GEÇMEZ: tazeleme AÇIK BİR EYLEMDİR (`withOfferSync`
 * yalnız "Tekliften Tazele"de ve yeni bir M revizyonu kurulurken koşar), okuma
 * yolu `withCostDefaults`tır. Yayımlanmış bir maliyetin tutarı bu yüzden
 * ekranda büyüyüp veritabanında eski kalamaz.
 */
function withDefterLines(group: CostGroup, skeleton?: CostTemplateSkeleton): CostGroup {
  const def = COST_GROUP_DEF_BY_KEY[group.key];
  if (!def) return group;

  const mevcut = group.lines.map((line) => {
    const d = def.lines.find((x) => x.key === line.key);
    if (!d) return line;
    let next = line;
    // FİYAT BAĞI
    if (d.priceSource && !line.priceSource) {
      next = { ...next, priceSource: d.priceSource, priceManual: line.unitPrice !== null };
    } else if (d.priceSource && d.priceSource !== line.priceSource && !line.priceManual) {
      next = { ...next, priceSource: d.priceSource };
    }
    // MİKTAR BAĞI — fiyatınkiyle SİMETRİK olmak zorundadır. Bir süre yalnız
    // fiyat tarafı kuruluyordu: deftere sonradan `qtySource` eklenen bir satır
    // fiyatını şeritten alıyor ama miktarı sonsuza dek elle kalıyordu.
    if (d.qtySource && !line.qtySource) {
      next = { ...next, qtySource: d.qtySource, qtyManual: line.qty !== null };
    } else if (d.qtySource && d.qtySource !== line.qtySource && !line.qtyManual) {
      next = { ...next, qtySource: d.qtySource };
    }
    return next;
  });

  // ŞABLONUN KAPATTIĞI SATIR TAZELEMEDE GERİ GELMEZ. Süzgeç yalnız burada,
  // EKLEME adımındadır: yukarıdaki tazeleme döngüsü defterin TAMAMINI okur,
  // çünkü belgede zaten duran bir satırın fiyat/miktar bağı, o satır bu tipte
  // artık açılmıyor diye kopmamalıdır. Kapatma bir SİLME değildir.
  const acilabilir = costGroupLineDefs(group.key, skeleton);
  const varOlan = new Set(mevcut.map((l) => l.key));
  const eksik = acilabilir.filter((d) => !varOlan.has(d.key));
  return eksik.length ? { ...group, lines: [...mevcut, ...eksik.map(costLineFromDef)] } : { ...group, lines: mevcut };
}

export function withOfferSync(
  payload: CostPayload,
  offer: OfferPayload,
  offerRevNo: number | null,
  templates?: readonly CostTemplate[]
): OfferSyncSonuc {
  const teklifKalemleri = new Map(offer.items.map((it) => [it.id, it]));
  let yetim = 0;

  const guncel: CostItem[] = payload.items.map((ham) => {
    const teklif = ham.offerItemId ? teklifKalemleri.get(ham.offerItemId) : undefined;
    // ŞABLON TİPİ TEKLİFTEN OKUNUR, BELGEDEN DEĞİL — aynı kural başlık ve
    // girdilerde de geçerli (aşağıdaki tazeleme). Belgedeki tip teklifin bir
    // KOPYASIDIR; teklifte düzeltilmiş bir vinç tipi maliyette eski şablonu
    // uygulamaya devam etseydi iki belge sessizce ayrışırdı.
    const skeleton = costTemplateFor(templates, teklif?.craneType ?? ham.craneType);
    const maliyet = { ...ham, groups: ham.groups.map((g) => withDefterLines(g, skeleton)) };
    if (!maliyet.offerItemId) return maliyet;
    if (!teklif) {
      yetim += 1;
      return { ...maliyet, offerItemId: null };
    }
    return {
      ...maliyet,
      title: teklif.title || maliyet.title,
      craneType: teklif.craneType ?? maliyet.craneType,
      inputs: inputsFromOfferItem(teklif, maliyet.inputs),
    };
  });

  const bagli = new Set(guncel.map((i) => i.offerItemId).filter(Boolean) as string[]);
  // ÇIKARILMIŞ KALEM GERİ GELMEZ. Tazeleme ekleyicidir (MALIYET-9) ama bir
  // EKLEME kararı, daha önce verilmiş bir ÇIKARMA kararını sessizce bozamaz;
  // kullanıcı sildiğini geri gelmiş görürse silme düğmesine bir daha güvenmez.
  const cikarilan = new Set(payload.removedOfferItemIds);
  const yeniler = offer.items
    .filter((it) => !bagli.has(it.id) && !cikarilan.has(it.id))
    .map((it, i) => costItemFromOfferItem(it, guncel.length + i + 1, templates));

  return {
    payload: {
      ...payload,
      sourceRevNo: offerRevNo,
      currency: offer.pricing.currency || payload.currency,
      // PROJE GENELİ ŞABLONSUZDUR: kaleme değil BELGEYE aittir, yani bir vinç
      // tipine bağlanamaz — üç vinçlik bir teklifte dokümantasyon bir kez
      // yapılır ve hangi tipin şablonunun geçerli olacağı sorusunun cevabı yok.
      general: withDefterLines(payload.general),
      items: [...guncel, ...yeniler],
    },
    eklenen: yeniler.length,
    yetim,
  };
}

// ————————————————————————————————————————————————————————— taşıma

function metin(v: unknown, yedek = ""): string {
  return typeof v === "string" ? v : yedek;
}

function sayiVeyaNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function sayi(v: unknown, yedek: number): number {
  const n = sayiVeyaNull(v);
  return n === null ? yedek : n;
}

function dizi<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function sayilar(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const n = sayiVeyaNull(x);
    if (n !== null) out[k] = n;
  }
  return out;
}

/**
 * BOŞ DEĞERİ KORUYAN sayı sözlüğü — hammadde fiyatları için.
 *
 * `sayilar` boş girdiyi DÜŞÜRÜR ve katsayılar için doğrudur (eksik katsayı
 * koddaki varsayılana düşer). Fiyatta ise "girilmemiş" bir DURUMDUR ve
 * saklanması gerekir: sac fiyatını bilerek boşaltan kullanıcı, bir sonraki
 * açılışta 0,70'i geri bulmamalıdır.
 */
function sayilarBoslu(v: unknown): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!v || typeof v !== "object") return out;
  for (const k of Object.keys(v as Record<string, unknown>)) {
    out[k] = sayiVeyaNull((v as Record<string, unknown>)[k]);
  }
  return out;
}

function lineFromRaw(raw: unknown): CostLine {
  const l = (raw ?? {}) as Partial<CostLine>;
  return {
    id: metin(l.id) || newCostId(),
    key: metin(l.key),
    // KAYITLI BELGEDEKİ KÜÇÜK HARFLİ AD BURADA BÜYÜR (kullanıcı isteği
    // 19.08.2026: *"maliyet kalemi adlarının tamamı büyük harf olsun"*).
    // Geçit her okumada VE her kaydetmede koşar, o yüzden ayrı bir SQL
    // taşımasına gerek yoktur; yayımlanmış bir M revizyonunun satırı
    // yeniden YAZILMAZ, yalnız görüntüsü büyür — ad bir tutar değildir ve
    // belgenin değişmezliği (MALIYET-2) tutarlar hakkındadır.
    label: adBuyuk(metin(l.label)),
    qtySource: l.qtySource ? metin(l.qtySource) : undefined,
    priceSource: l.priceSource ? metin(l.priceSource) : undefined,
    qty: sayiVeyaNull(l.qty),
    qtyManual: l.qtyManual === true,
    unit: metin(l.unit, "takım"),
    unitPrice: sayiVeyaNull(l.unitPrice),
    priceManual: l.priceManual === true,
    note: metin(l.note),
    hidden: l.hidden === true,
  };
}

function groupFromRaw(raw: unknown): CostGroup {
  const g = (raw ?? {}) as Record<string, unknown>;
  const key = metin(g.key, CUSTOM_COST_GROUP_KEY);
  return {
    id: metin(g.id) || newCostId(),
    key,
    title: adBuyuk(metin(g.title, COST_GROUP_DEF_BY_KEY[key]?.title ?? "")),
    lump: g.lump === true,
    lines: dizi(g.lines).map(lineFromRaw),
  };
}

function inputsFromRaw(raw: unknown): CostInputs {
  const i = (raw ?? {}) as Record<string, unknown>;
  const gantry = i.gantry === true;
  const bos = emptyCostInputs(gantry);
  const sinif = metin(i.craneClass);
  return {
    capacityT: sayiVeyaNull(i.capacityT),
    auxCapacityT: sayiVeyaNull(i.auxCapacityT),
    spanM: sayiVeyaNull(i.spanM),
    liftHeightM: sayiVeyaNull(i.liftHeightM),
    liftSpeedMpm: sayiVeyaNull(i.liftSpeedMpm),
    trolleySpeedMpm: sayiVeyaNull(i.trolleySpeedMpm),
    bridgeSpeedMpm: sayiVeyaNull(i.bridgeSpeedMpm),
    craneClass: (craneClassFrom(sinif) ?? bos.craneClass) as CraneClass,
    ambientC: sayi(i.ambientC, bos.ambientC),
    girderCount: sayi(i.girderCount, bos.girderCount),
    legHeightM: sayiVeyaNull(i.legHeightM),
    bridgeWheelCount: sayi(i.bridgeWheelCount, bos.bridgeWheelCount),
    bridgeDriveCount: sayi(i.bridgeDriveCount, bos.bridgeDriveCount),
    trolleyDriveCount: sayi(i.trolleyDriveCount, bos.trolleyDriveCount),
    gantry,
    cabin: i.cabin === true,
    movingCabin: i.movingCabin === true,
    electricRoom: i.electricRoom === true,
    heatShield: i.heatShield === true,
    // RAY KODU eski belgelerde YOKTUR ve boş gelir; teklif eşitlemesi ya da
    // kullanıcı doldurur.
    bridgeRailCode: metin(i.bridgeRailCode),
    trolleyRailCode: metin(i.trolleyRailCode),
  };
}

/**
 * Eski bir maliyet `payload`ını bugünkü şekle getirir.
 *
 * Teklifteki `withDefaults`in ikizidir ve aynı sözü verir: modele yeni bir
 * katsayı ya da alan eklendiğinde ESKİ maliyet çalışmaları bozulmaz. Eksik
 * katsayı koddaki varsayılanla dolar; bu, yayımlanmış bir maliyetin sayısını
 * DEĞİŞTİREBİLİR ve tam olarak bu yüzden `params` açılışta belgeye kopyalanır
 * — bir katsayı orada yazılıysa varsayılan onu ezmez.
 */
/**
 * İMALAT SATIRINI ÇELİK YAPI'DAN KENDİ GRUBUNA TAŞIR — eski belgeler için.
 *
 * Kullanıcı isteği (18.08.2026, md. 4) yapıyı değiştirdi: "Çelik İmalat
 * İşçiliği (fire dahil)" artık kendi ANA BAŞLIĞINDA. Bugüne kadar kaydedilmiş
 * her maliyet belgesinde o satır `steel` grubunun içinde duruyor.
 *
 * SATIR TAŞINIR, YENİDEN KURULMAZ: girilmiş €/kg, elle düzeltilmiş miktar ve
 * `hidden`/`priceManual` bayrakları satırın KENDİSİNDE yaşıyor. Yeni grupta
 * boş bir satır açıp eskisini silmek, tedarikçiyle konuşulmuş bir fiyatı
 * sessizce sıfırlamak olurdu (MALIYET-9'un "dolu olana DOKUNULMAZ" kuralı).
 *
 * ÇİFT KOŞMAYA KARŞI BAĞIŞIKTIR: imalat grubu zaten varsa satır oradadır ve
 * çelikte bir kalıntı kalmışsa yalnız o temizlenir — taşıma yolu her açılışta
 * koşar (`withCostDefaults`).
 */
function withFabricationGroup(item: CostItem): CostItem {
  const imalatVar = item.groups.some((g) => g.key === FABRICATION_GROUP_KEY);
  const celik = item.groups.find((g) => g.key === "steel");
  const tasinan = celik?.lines.find((l) => l.key === "fabrication");
  if (imalatVar && !tasinan) return item;
  if (!imalatVar && !tasinan) return item;

  const temizGruplar = item.groups.map((g) =>
    g.key === "steel" ? { ...g, lines: g.lines.filter((l) => l.key !== "fabrication") } : g
  );

  if (imalatVar) {
    // Grup zaten açık: çelikteki kalıntıyı at, oradaki satıra DOKUNMA.
    return { ...item, groups: temizGruplar };
  }

  const imalat: CostGroup = {
    ...costGroupFromKey(FABRICATION_GROUP_KEY),
    lines: tasinan ? [tasinan] : costGroupFromKey(FABRICATION_GROUP_KEY).lines,
  };
  // EN ÜSTE: başlık sırası belgenin sırasıdır (`COST_GROUP_DEFS`).
  return { ...item, groups: [imalat, ...temizGruplar] };
}

/**
 * `{ steelKg, totalKg }` sözlüğünü ham veriden okur.
 *
 * `sayilarBoslu`nun kardeşidir ve aynı kuralı taşır: okunamayan sayı `null`
 * olur, sıfır DEĞİL. Anahtarlar SÜZÜLMEZ — yetim kalan bir kayıt silinmez.
 */
function agirliklarBoslu(
  raw: unknown
): Record<string, { steelKg: number | null; totalKg: number | null }> {
  const out: Record<string, { steelKg: number | null; totalKg: number | null }> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const o = (v ?? {}) as Record<string, unknown>;
    out[k] = { steelKg: sayiVeyaNull(o.steelKg), totalKg: sayiVeyaNull(o.totalKg) };
  }
  return out;
}

export function withCostDefaults(raw: unknown, currency = "EUR"): CostPayload {
  const p = (raw ?? {}) as Record<string, unknown>;
  const bos = emptyCostPayload(currency);

  const rates = dizi<Record<string, unknown>>(p.rates);
  return {
    version: COST_PAYLOAD_VERSION,
    sourceRevNo: sayiVeyaNull(p.sourceRevNo),
    currency: metin(p.currency, currency),
    params: { ...COST_PARAM_DEFAULTS, ...sayilar(p.params) },
    // FİYAT ŞERİDİNDE VARSAYILAN UYGULANMAZ (katsayıların tersi): eksik bir
    // katsayı koddaki değere düşer çünkü model onsuz çalışamaz; eksik bir
    // fiyat ise BİLİNMEYEN bir sayıdır ve "—" kalmalıdır.
    materialPrices: sayilarBoslu(p.materialPrices),
    items: dizi<Record<string, unknown>>(p.items).map((it) => ({
      id: metin(it.id) || newCostId(),
      offerItemId: typeof it.offerItemId === "string" && it.offerItemId ? it.offerItemId : null,
      title: metin(it.title),
      craneType: metin(it.craneType),
      qty: sayiVeyaNull(it.qty),
      inputs: inputsFromRaw(it.inputs),
      overrides: sayilar(it.overrides),
      groups: dizi(it.groups).map(groupFromRaw),
    })).map(withFabricationGroup),
    // ÇIKARILAN KALEM LİSTESİ TAŞINIR: eski belgede yoksa boştur.
    removedOfferItemIds: dizi<unknown>(p.removedOfferItemIds)
      .map((x) => metin(x))
      .filter((x) => x !== ""),
    // ÖZET SAYFASININ ELLE GİRİLEN VERİSİ (md. 7). BURAYA EKLENMESİ ŞARTTIR:
    // `withCostDefaults` yalnız TANIDIĞI alanları yeniden kurar ve kaydetme
    // yolu her seferinde ondan geçer (`saveOfferCostRevision`) — alan burada
    // olmasaydı kullanıcının girdiği ağırlık ve kâr yüzdesi ekranda görünür,
    // Kaydet'e basınca sessizce yok olurdu.
    manualLineWeights: agirliklarBoslu(p.manualLineWeights),
    overviewMargins: sayilarBoslu(p.overviewMargins),
    general: p.general ? groupFromRaw(p.general) : bos.general,
    // ORANLI GRUPLAR DEFTERDEN TAMAMLANIR: yeni bir oran grubu eklenirse
    // (ör. "risk payı") eski belgelerde de görünür ve yüzdesi BOŞ gelir —
    // sıfır değil. Sıfır yazmak, hiç düşünülmemiş bir kalemi "yok" ilan
    // etmenin sessiz yoluydu.
    rates: DEFAULT_RATE_GROUPS.map((def) => {
      const eski = rates.find((r) => metin(r.key) === def.key);
      if (!eski) return { ...def, percent: null, lines: [] };
      return {
        key: def.key,
        title: metin(eski.title, def.title),
        mode: eski.mode === "kalem" ? "kalem" : "oran",
        percent: sayiVeyaNull(eski.percent),
        lines: dizi(eski.lines).map(lineFromRaw),
      };
    }),
    notes: metin(p.notes),
    direct: sayiVeyaNull(p.direct),
    total: sayiVeyaNull(p.total),
  };
}

/**
 * YENİ AÇILAN maliyet çalışmasının oranları defterdeki varsayılanları taşır.
 *
 * `withCostDefaults` bunu YAPMAZ ve bu ayrım TEKLIF-14'ün aynısıdır: taşıma
 * yolu eski bir belgeyi okur, varsayılan uygulamak orada kullanıcının bilerek
 * boşalttığı bir oranı geri getirmek olurdu.
 */
export function withDefaultRates(payload: CostPayload): CostPayload {
  return {
    ...payload,
    rates: payload.rates.map((r) => {
      const def = DEFAULT_RATE_GROUPS.find((d) => d.key === r.key);
      return r.percent === null && def ? { ...r, percent: def.percent } : r;
    }),
  };
}

// ————————————————————————————————————————————————————————— model

/** Kalem kimliği → model sonucu. Ekran, kırılım ve PDF aynı sonucu okur. */
export function costModels(payload: CostPayload): Record<string, CostModelResult> {
  const out: Record<string, CostModelResult> = {};
  for (const item of payload.items) {
    out[item.id] = hesapla(item.inputs, payload.params, item.overrides);
  }
  return out;
}

function agirlikSozlugu(
  models: Record<string, CostModelResult>,
  key: string
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [id, model] of Object.entries(models)) out[id] = model.values[key] ?? null;
  return out;
}

/** Kalem kimliği → toplam vinç ağırlığı [kg] — €/kg hesabı bunu okur. */
export function costWeights(models: Record<string, CostModelResult>): Record<string, number | null> {
  return agirlikSozlugu(models, "w.total");
}

/**
 * Kalem kimliği → VİNÇ ÇELİK AĞIRLIĞI [kg] — özet tablosu bunu okur.
 *
 * `costWeights`in ikizidir ve AYRI DURUR çünkü ikisi ayrı sorulardır: boya ve
 * €/kg TOPLAM ağırlığı okur (`w.total`), kaynaklı yapının kilosu ise ayrı bir
 * sayıdır (`w.steel`, MALIYET-14). Tek bir sözlükte birleştirilseydi özet
 * tablosunda hangi kilonun basıldığı çağrı yerine bakmadan anlaşılmazdı.
 */
export function costSteelWeights(
  models: Record<string, CostModelResult>
): Record<string, number | null> {
  return agirlikSozlugu(models, "w.steel");
}

/**
 * Satırın MİKTARI — modelden mi elden mi.
 *
 * İKİ KAYNAK ASLA TOPLANMAZ ve hangisinin geçerli olduğu tek bir soruyla
 * belli olur: `qtyManual` açıksa insanın yazdığı, değilse modelin ürettiği.
 * Model o anahtarı üretemiyorsa miktar `null` kalır ve satır toplama girmez.
 */
export function lineQty(line: CostLine, model: CostModelResult | undefined): number | null {
  if (line.qtyManual || !line.qtySource) return line.qty;
  return model?.values[line.qtySource] ?? null;
}

/**
 * Satırın BİRİM FİYATI — hammadde şeridinden mi elden mi.
 *
 * `lineQty`nin ikizidir ve aynı cümleyi kurar: İKİ KAYNAK ASLA TOPLANMAZ.
 * `priceManual` açıksa insanın yazdığı, değilse şeritteki fiyat geçerlidir;
 * şeritte fiyat yoksa `null` döner ve satır toplama GİRMEZ (MALIYET-13).
 * Girilmemiş bir sac fiyatını sıfır saymak, hammaddeyi bedava göstermenin en
 * kısa yoluydu.
 */
export function linePrice(
  line: CostLine,
  prices: Record<string, number | null> | undefined
): number | null {
  if (line.priceManual || !line.priceSource) return line.unitPrice;
  return prices?.[line.priceSource] ?? null;
}

/**
 * Şerit fiyatlarını satırlara YAZAR — `withModelQuantities`in fiyat tarafı.
 *
 * Aynı gerekçe: toplam (`costTotals`) saf aritmetiktir ve şeridi okumaz,
 * veritabanındaki `total_amount` üretilmiş sütunu payload'ı okur, PDF de
 * satırın kendi `unitPrice`ını basar. Yazılmasaydı ekran ile belge iki farklı
 * fiyat gösterirdi.
 */
export function withMaterialPrices(payload: CostPayload): CostPayload {
  const satir = (line: CostLine): CostLine => {
    if (line.priceManual || !line.priceSource) return line;
    const f = payload.materialPrices?.[line.priceSource] ?? null;
    return f === line.unitPrice ? line : { ...line, unitPrice: f };
  };
  const grup = (g: CostGroup): CostGroup => ({ ...g, lines: g.lines.map(satir) });
  return {
    ...payload,
    items: payload.items.map((i) => ({ ...i, groups: i.groups.map(grup) })),
    general: grup(payload.general),
    rates: payload.rates.map((r) => ({ ...r, lines: r.lines.map(satir) })),
  };
}

/**
 * KAYDETME YOLUNUN SON ADIMI — miktar, fiyat ve toplamlar payload'a yazılır.
 *
 * ÜÇÜ TEK ÇAĞRIDA durur çünkü sıraları bağlayıcıdır (miktar ve fiyat önce,
 * toplam sonra) ve dört ayrı çağrı yerinde (yeni revizyon · kaydet · tazele ·
 * önizleme fikstürü) birinin unutulması, ekranda doğru görünüp belgede yanlış
 * çıkan bir toplam demekti.
 */
export function withCostDerived(payload: CostPayload): CostPayload {
  const dolu = withMaterialPrices(withModelQuantities(payload));
  return withCostTotals(dolu, costWeights(costModels(dolu)));
}

/**
 * Model miktarlarını satırlara YAZAR — kaydetme yolunun son adımı.
 *
 * Miktar payload'a yazılır çünkü toplam (`costTotals`) saf aritmetiktir ve
 * modeli çağırmaz; ayrıca veritabanındaki `total_amount` üretilmiş sütunu
 * payload'ı okur. Yazılmasaydı liste ekranı maliyeti görmek için modeli
 * koşturmak zorunda kalırdı — ve iki farklı yerde koşan bir model, iki farklı
 * sayı üretmenin en kısa yoludur.
 */
export function withModelQuantities(payload: CostPayload): CostPayload {
  const models = costModels(payload);
  const satir = (line: CostLine, model: CostModelResult | undefined): CostLine => {
    if (line.qtyManual || !line.qtySource) return line;
    const q = model?.values[line.qtySource] ?? null;
    return q === line.qty ? line : { ...line, qty: q };
  };
  return {
    ...payload,
    items: payload.items.map((item) => {
      const model = models[item.id];
      return { ...item, groups: item.groups.map((g) => ({ ...g, lines: g.lines.map((l) => satir(l, model)) })) };
    }),
    // PROJE GENELİ ve oranlı grupların satırları bir kaleme bağlı değildir;
    // model miktarı okuyacakları bir kalem yoktur, miktarları elledir.
  };
}

// ————————————————————————————————————————————————————————— süzme

/** Belgeye BASILACAK hâl — iç PDF ve özet bunu okur. */
export function printedCostPayload(payload: CostPayload): CostPayload {
  // KİP SÜZGECİ ÖNCE KOŞAR (`costGroupLines`): götürü kipteki bir grubun
  // kalem satırları belgeye BASILMAZ, çünkü toplama da girmezler. Basılsalardı
  // belgede toplamayan satırlar görünür, okuyan da toplamı elle tutturamazdı.
  const suz = (g: CostGroup): CostGroup => ({
    ...g,
    lines: costGroupLines(g).filter((l) => !l.hidden && (l.qty !== null || l.unitPrice !== null)),
  });
  return {
    ...payload,
    items: payload.items.map((i) => ({
      ...i,
      groups: i.groups.map(suz).filter((g) => g.lines.length > 0),
    })),
    general: suz(payload.general),
    rates: payload.rates.map((r) => ({ ...r, lines: r.lines.filter((l) => !l.hidden) })),
  };
}

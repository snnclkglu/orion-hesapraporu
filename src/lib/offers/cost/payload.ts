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

import { trSayi } from "@/lib/drawings/tr-text";
import type { OfferItem, OfferPayload } from "../types";
import { hesapla, type CostModelResult } from "./model";
import { COST_PARAM_DEFAULTS, DEFAULT_CRANE_CLASS, craneClassFrom, type CraneClass } from "./params";
import {
  COST_GROUP_DEF_BY_KEY,
  CUSTOM_COST_GROUP_KEY,
  DEFAULT_RATE_GROUPS,
  GENERAL_GROUP_KEY,
  costGroupKeysForOfferItem,
} from "./registry";
import type {
  CostGroup,
  CostInputs,
  CostItem,
  CostLine,
  CostLineDef,
  CostPayload,
  CostRateGroup,
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
  };
}

export function costLineFromDef(def: CostLineDef): CostLine {
  return {
    id: newCostId(),
    key: def.key,
    label: def.label,
    qtySource: def.qtySource,
    qty: null,
    unit: def.unit,
    unitPrice: null,
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

export function costGroupFromKey(key: string, id = newCostId()): CostGroup {
  const def = COST_GROUP_DEF_BY_KEY[key];
  return {
    id,
    key,
    title: def?.title ?? "YENİ BÖLÜM",
    lines: (def?.lines ?? []).map(costLineFromDef),
  };
}

function defaultRateGroups(): CostRateGroup[] {
  return DEFAULT_RATE_GROUPS.map((r) => ({ ...r, lines: [] }));
}

export function emptyCostPayload(currency = "EUR"): CostPayload {
  return {
    version: COST_PAYLOAD_VERSION,
    sourceRevNo: null,
    currency,
    params: { ...COST_PARAM_DEFAULTS },
    items: [],
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
function travelGroupKey(item: OfferItem): "gantry" | "bridge" {
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
    liftSpeedMpm: doldur(taban.liftSpeedMpm, trSayi(part(item, "mainHoist", "liftSpeed", "range"))),
    trolleySpeedMpm: doldur(taban.trolleySpeedMpm, trSayi(part(item, "trolley", "travelSpeed", "range"))),
    bridgeSpeedMpm: doldur(taban.bridgeSpeedMpm, trSayi(part(item, yur, "travelSpeed", "range"))),
    legHeightM: doldur(taban.legHeightM, trSayi(part(item, "general", "gantryLegHeight", "value"))),
    craneClass: (sinif ?? taban.craneClass) as CraneClass,
    gantry: gantry || taban.gantry,
    bridgeWheelCount: adet(yur, "wheel", "count", taban.bridgeWheelCount),
    bridgeDriveCount: adet(yur, "motor", "count", taban.bridgeDriveCount),
    trolleyDriveCount: adet("trolley", "motor", "count", taban.trolleyDriveCount),
  };
}

/**
 * TEKLİF KALEMİNE KARŞILIK GELEN MALİYET KALEMİ kurar.
 *
 * Gruplar kalemin KENDİ bölümlerinden çıkar (`costGroupKeysForOfferItem`):
 * yardımcı kaldırması olan bir vinçte maliyette de yardımcı kaldırma grubu
 * açılır. Şablonu maliyet tarafında ikinci kez sormak, kullanıcının teklifte
 * verdiği kararı bir daha vermesini istemek olurdu (TEKLIF-32'nin tersi).
 */
export function costItemFromOfferItem(item: OfferItem, sira: number): CostItem {
  const inputs = inputsFromOfferItem(item);
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
    groups: costGroupKeysForOfferItem(item.groups.map((g) => g.key)).map((k) => costGroupFromKey(k)),
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
export function withOfferSync(
  payload: CostPayload,
  offer: OfferPayload,
  offerRevNo: number | null
): OfferSyncSonuc {
  const teklifKalemleri = new Map(offer.items.map((it) => [it.id, it]));
  let yetim = 0;

  const guncel: CostItem[] = payload.items.map((maliyet) => {
    if (!maliyet.offerItemId) return maliyet;
    const teklif = teklifKalemleri.get(maliyet.offerItemId);
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
  const yeniler = offer.items
    .filter((it) => !bagli.has(it.id))
    .map((it, i) => costItemFromOfferItem(it, guncel.length + i + 1));

  return {
    payload: {
      ...payload,
      sourceRevNo: offerRevNo,
      currency: offer.pricing.currency || payload.currency,
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

function lineFromRaw(raw: unknown): CostLine {
  const l = (raw ?? {}) as Partial<CostLine>;
  return {
    id: metin(l.id) || newCostId(),
    key: metin(l.key),
    label: metin(l.label),
    qtySource: l.qtySource ? metin(l.qtySource) : undefined,
    qty: sayiVeyaNull(l.qty),
    qtyManual: l.qtyManual === true,
    unit: metin(l.unit, "takım"),
    unitPrice: sayiVeyaNull(l.unitPrice),
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
    title: metin(g.title, COST_GROUP_DEF_BY_KEY[key]?.title ?? ""),
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
export function withCostDefaults(raw: unknown, currency = "EUR"): CostPayload {
  const p = (raw ?? {}) as Record<string, unknown>;
  const bos = emptyCostPayload(currency);

  const rates = dizi<Record<string, unknown>>(p.rates);
  return {
    version: COST_PAYLOAD_VERSION,
    sourceRevNo: sayiVeyaNull(p.sourceRevNo),
    currency: metin(p.currency, currency),
    params: { ...COST_PARAM_DEFAULTS, ...sayilar(p.params) },
    items: dizi<Record<string, unknown>>(p.items).map((it) => ({
      id: metin(it.id) || newCostId(),
      offerItemId: typeof it.offerItemId === "string" && it.offerItemId ? it.offerItemId : null,
      title: metin(it.title),
      craneType: metin(it.craneType),
      qty: sayiVeyaNull(it.qty),
      inputs: inputsFromRaw(it.inputs),
      overrides: sayilar(it.overrides),
      groups: dizi(it.groups).map(groupFromRaw),
    })),
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

/** Kalem kimliği → toplam vinç ağırlığı [kg] — €/kg hesabı bunu okur. */
export function costWeights(models: Record<string, CostModelResult>): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [id, model] of Object.entries(models)) out[id] = model.values["w.total"] ?? null;
  return out;
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
  const suz = (g: CostGroup): CostGroup => ({
    ...g,
    lines: g.lines.filter((l) => !l.hidden && (l.qty !== null || l.unitPrice !== null)),
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

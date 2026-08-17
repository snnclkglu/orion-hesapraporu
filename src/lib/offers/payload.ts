// TEKLİF BELGESİNİN KURULMASI, TAŞINMASI VE SÜZÜLMESİ.
//
// Üç iş bir arada durur çünkü üçü de aynı soruyu farklı yönlerden sorar:
// belge neye benzer (`emptyPayload`), eski bir kayıt bugünkü şekle nasıl
// getirilir (`withDefaults`), ve müşteriye giden belgede ne BASILIR
// (`printedPayload`).

import { rowHasValue, withComposedValue } from "./compose";
import {
  AUX_TROLLEY_GROUP_KEY,
  OFFER_GROUP_DEFS,
  OFFER_GROUP_DEF_BY_KEY,
  TROLLEY_1_TITLE,
  TROLLEY_2_TITLE,
  TROLLEY_GROUP_KEY,
  TROLLEY_TITLE,
  TERMS_GROUP_KEY,
  TERMS_TITLE,
  TERM_ROW_DEFS,
  TEST_LOAD_GROUP_KEY,
  TEST_LOAD_ROW_DEFS,
  TEST_LOAD_TITLE,
  offerRowDef,
} from "./registry";
import type {
  OfferGroup,
  OfferItem,
  OfferPayload,
  OfferPaymentLine,
  OfferPriceLine,
  OfferRow,
  OfferRowDef,
  OfferTextLine,
} from "./types";

export const OFFER_PAYLOAD_VERSION = 1;

/** Yeni satır/kalem/grup kimliği. */
export function newOfferId(): string {
  return crypto.randomUUID();
}

// ————————————————————————————————————————————————————————— kurma

export function rowFromDef(def: OfferRowDef): OfferRow {
  return { key: def.key, label: def.label, value: "", parts: {} };
}

export function groupFromKey(key: string, id = newOfferId()): OfferGroup {
  const def = OFFER_GROUP_DEF_BY_KEY[key];
  return {
    id,
    key,
    title: def?.title ?? "YENİ BÖLÜM",
    rows: (def?.rows ?? []).map(rowFromDef),
  };
}

export function emptyItem(title = "", groupKeys: readonly string[] = []): OfferItem {
  const item: OfferItem = {
    id: newOfferId(),
    title,
    capacityT: null,
    spanM: null,
    groups: groupKeys.map((k) => groupFromKey(k)),
  };
  // ŞABLON İKİ ARABALIYSA ADLAR 1/2 OLUR. "Çift Kirişli Vinç — İki Arabalı"
  // şablonunu seçen kullanıcı araba seçicisine hiç dokunmaz; adlandırma yine de
  // tutarlı olmalıdır, yoksa belgede "VİNÇ ARABASI" ile "VİNÇ ARABASI - 2"
  // yan yana basılır ve birincisi numarasız kalır.
  return trolleyCount(item) === 2 ? setTrolleyCount(item, 2).item : item;
}

/**
 * Vinç tipini kaleme VE `GENEL ÖZELLİKLER > Vinç Tipi` satırına yazar.
 *
 * İki yer aynı bilgiyi taşımıyor, ikisi iki ayrı işi yapıyor: satır BELGEYE
 * basılır, künye teklif listesinde SÜZGEÇ olur (`itemFactsFromRows` künyeyi
 * zaten satırdan tazeler, yani ayrışamazlar). Şablon seçen kullanıcıya vinç
 * tipini bir daha sormak, uygulamanın bildiği bir şeyi ona yazdırmak olurdu.
 */
export function withCraneType(item: OfferItem, craneType: string): OfferItem {
  const tip = (craneType ?? "").trim();
  if (!tip) return item;
  return {
    ...item,
    craneType: tip,
    groups: item.groups.map((g) =>
      g.key !== "general"
        ? g
        : {
            ...g,
            rows: g.rows.map((r) => (r.key === "craneType" && !r.value ? { ...r, value: tip } : r)),
          }
    ),
  };
}

/**
 * BOŞ TEKLİF. Hiçbir alan uydurma değerle doldurulmaz (değişmez md. 4);
 * yalnız BELGENİN İSKELETİ kurulur — hangi bölümlerin var olduğu bir veri
 * değil bir yapıdır.
 */
export function emptyPayload(currency = "EUR"): OfferPayload {
  return {
    version: OFFER_PAYLOAD_VERSION,
    cover: {
      fromName: "",
      fromTitle: "",
      fromEmail: "",
      toName: "",
      toDept: "",
      toPhone: "",
      customerRef: "",
      greeting: "",
      intro: "",
      signatories: [],
    },
    items: [],
    testLoad: {
      enabled: true,
      title: TEST_LOAD_TITLE,
      position: "ticari",
      rows: TEST_LOAD_ROW_DEFS.map(rowFromDef),
    },
    terms: {
      title: TERMS_TITLE,
      rows: TERM_ROW_DEFS.map(rowFromDef),
      paymentLines: [],
    },
    pricing: { currency, vatIncluded: false, lines: [], total: null },
    notes: [],
    exclusions: [],
  };
}

// ————————————————————————————————————————————— bölüm ekleme / çıkarma

/**
 * Defterdeki sırası — bilinmeyen (serbest) grup EN SONA sayılır.
 *
 * Yeni bir bölüm listenin sonuna eklenirse belge sırası bozulur: yardımcı
 * kaldırma, elektrik sisteminin ardında basılırdı. Defterin sırası BELGENİN
 * sırasıdır (bkz. `OFFER_GROUP_DEFS`), o yüzden ekleme yeri ondan okunur.
 */
function grupSirasi(key: string): number {
  const i = OFFER_GROUP_DEFS.findIndex((g) => g.key === key);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * Bölümü kaleme EKLER — zaten varsa hiçbir şey yapmaz.
 *
 * Yerleştirme defter sırasınadır: `auxHoist` kaldırma grubunun ardına,
 * `auxTrolley` arabanın ardına düşer. Kullanıcının elle taşıdığı bir düzen
 * BOZULMAZ çünkü mevcut grupların sırasına dokunulmaz — yeni grup yalnız
 * kendisinden sonra gelmesi gereken ilk grubun ÖNÜNE girer.
 */
export function withGroup(item: OfferItem, key: string): OfferItem {
  if (item.groups.some((g) => g.key === key)) return item;
  const sira = grupSirasi(key);
  const konum = item.groups.findIndex((g) => grupSirasi(g.key) > sira);
  const gruplar = [...item.groups];
  gruplar.splice(konum === -1 ? gruplar.length : konum, 0, groupFromKey(key));
  return { ...item, groups: gruplar };
}

/** Bölümde gerçekten girilmiş bir değer var mı — boş bölüm silinebilir. */
export function groupHasData(group: OfferGroup | undefined): boolean {
  return (group?.rows ?? []).some((r) => rowHasValue(r));
}

/**
 * Devralınan ve defterden gelen araba başlıkları — üstüne yazılabilir olanlar.
 *
 * Kullanıcı bölüm başlığını KENDİ yazdıysa ("VİNÇ ARABASI (MEVCUT)") araba
 * sayısını değiştirmek onu ezmemelidir: başlık belgeye aittir (`OfferRow.label`
 * ile aynı kural). "YARDIMCI VİNÇ ARABASI" listede çünkü ikinci arabanın
 * defterdeki eski adı odur ve o adla açılmış teklifler var.
 */
const ARABA_VARSAYILAN_BASLIKLARI = new Set([
  TROLLEY_TITLE,
  TROLLEY_1_TITLE,
  TROLLEY_2_TITLE,
  "YARDIMCI VİNÇ ARABASI",
]);

function arabaBasligi(group: OfferGroup, yeni: string): OfferGroup {
  if (group.title === yeni) return group;
  return ARABA_VARSAYILAN_BASLIKLARI.has(group.title) ? { ...group, title: yeni } : group;
}

/**
 * ARABA SAYISINI KURAR — tek ya da çift.
 *
 * Kullanıcı isteği (17.08.2026): *"Tek arabalı veya çift arabalı olarak seçenek
 * olsun; çift arabalı olarak işaretlersem Vinç Arabası - 2 olarak yeni bölüm
 * açılsın, diğeri de bu durumda Vinç Arabası - 1 olsun."*
 *
 * SAYI AYRI BİR ALANDA SAKLANMAZ, bölümün VARLIĞINDAN okunur (`trolleyCount`).
 * Ayrı bir alan iki yazıcı doğururdu — biri "çift" derken ötekinde ikinci araba
 * bölümü olmayabilirdi ve ekran belgeyle çelişirdi (TEKLIF-20'nin kalem
 * künyesindeki gerekçe).
 *
 * TEKE DÖNÜŞ VERİ SİLMEZ: ikinci arabanın satırlarına bir şey girilmişse bölüm
 * KORUNUR ve çağırana bildirilir. Yanlış tıklanan bir seçicinin doldurulmuş bir
 * bölümü sessizce götürmesi, bu editörde olabilecek en pahalı davranıştır
 * (gizlemek silmek değildir kuralının aynı ailesi). Boş bölüm ise kaldırılır —
 * onu tutmak belgede boş bir başlık bırakmak olurdu.
 */
export function trolleyCount(item: OfferItem): 1 | 2 {
  return item.groups.some((g) => g.key === AUX_TROLLEY_GROUP_KEY) ? 2 : 1;
}

export function setTrolleyCount(
  item: OfferItem,
  adet: 1 | 2
): { item: OfferItem; korunanVeri: boolean } {
  if (adet === 2) {
    // İKİ BÖLÜM DE KURULUR. Kaldırma kirişi gibi arabası hiç olmayan bir kalemde
    // "çift arabalı" seçilirse yalnız ikincisi açılsaydı belgede tek başına bir
    // "VİNÇ ARABASI - 2" kalırdı — numarası olan ama birincisi olmayan bir bölüm.
    const eklenmis = withGroup(withGroup(item, TROLLEY_GROUP_KEY), AUX_TROLLEY_GROUP_KEY);
    return {
      item: {
        ...eklenmis,
        groups: eklenmis.groups.map((g) =>
          g.key === TROLLEY_GROUP_KEY
            ? arabaBasligi(g, TROLLEY_1_TITLE)
            : g.key === AUX_TROLLEY_GROUP_KEY
              ? arabaBasligi(g, TROLLEY_2_TITLE)
              : g
        ),
      },
      korunanVeri: false,
    };
  }

  const ikinci = item.groups.find((g) => g.key === AUX_TROLLEY_GROUP_KEY);
  const korunanVeri = groupHasData(ikinci);
  return {
    item: {
      ...item,
      groups: item.groups
        .filter((g) => g.key !== AUX_TROLLEY_GROUP_KEY || korunanVeri)
        .map((g) => (g.key === TROLLEY_GROUP_KEY ? arabaBasligi(g, TROLLEY_TITLE) : g)),
    },
    korunanVeri,
  };
}

export function newPaymentLine(text = ""): OfferPaymentLine {
  return { id: newOfferId(), text };
}

export function newTextLine(text = ""): OfferTextLine {
  return { id: newOfferId(), text };
}

export function newPriceLine(itemId: string | null = null): OfferPriceLine {
  // MİKTAR GERÇEK BİR DEĞERDİR, yer tutucu değil (SATIS-16): vinç kalemlerinin
  // ezici çoğunluğu tek takımdır ve boş miktar toplamı sessizce sıfırlardı.
  return { id: newOfferId(), itemId, description: "", qty: 1, unit: "Takım", unitPrice: null, inTotal: true };
}

// ——————————————————————————————————————————————————————— varsayılanlar

/**
 * `list_key` → defterde VARSAYILAN işaretli değer.
 *
 * Defterden okunur, koda gömülmez: "geçerlilik 14 iş günü" bir firma kararıdır
 * ve Tanımlar sayfasından değiştirilebilmelidir.
 */
export type OfferDefaults = Record<string, string>;

function rowsWithDefaults(rows: OfferRow[], defaults: OfferDefaults, groupKey: string): OfferRow[] {
  return rows.map((row) => {
    // ELLE YAZILMIŞ ya da ZATEN DOLU satıra dokunulmaz: varsayılan bir
    // BAŞLANGIÇ değeridir, sonradan gelen bir düzeltme değil.
    if (row.value.trim() !== "") return row;
    const def = offerRowDef(groupKey, row.key);
    const liste = def?.list;
    const deger = liste ? defaults[liste] : undefined;
    return deger ? { ...row, value: deger } : row;
  });
}

/**
 * YENİ TEKLİFİ DEFTERDEKİ VARSAYILANLARLA DOLDURUR.
 *
 * Kullanıcı isteği (17.08.2026): *"Test yükleri standart dolu gelsin"*,
 * *"Hitap ve giriş paragrafı otomatik gelsin. İsterse düzeltebileyim."*
 *
 * Doldurma YALNIZ BOŞ ALANA yapılır ve yalnız teklif AÇILIRKEN çalışır: her
 * kaydetmede yeniden uygulansaydı kullanıcının bilerek sildiği bir satır geri
 * gelirdi. Uydurma değer yoktur — defterde varsayılanı olmayan alan BOŞ kalır
 * (değişmez md. 4).
 */
export function applyDefaults(payload: OfferPayload, defaults: OfferDefaults): OfferPayload {
  return {
    ...payload,
    cover: {
      ...payload.cover,
      intro: payload.cover.intro || defaults["cover.intro"] || "",
    },
    testLoad: {
      ...payload.testLoad,
      rows: rowsWithDefaults(payload.testLoad.rows, defaults, TEST_LOAD_GROUP_KEY),
    },
    terms: {
      ...payload.terms,
      rows: rowsWithDefaults(payload.terms.rows, defaults, TERMS_GROUP_KEY),
    },
  };
}

/**
 * HİTAP CÜMLESİ — "Sn. ALİCAN ERASLAN Bey,".
 *
 * ADDAN CİNSİYET ÇIKARILMAZ: hitap eki defterden SEÇİLİR (`cover.honorific`).
 * Tahmin etmek, kapağın en görünür satırında yanlış bir hitap üretir; boş
 * bırakmak ise kullanıcıyı her teklifte aynı cümleyi yazmaya zorlardı. Orta
 * yol: cümleyi uygulama kurar, eki insan seçer.
 */
export function greetingFor(name: string, honorific: string): string {
  const ad = (name ?? "").trim();
  if (!ad) return "";
  const ek = (honorific ?? "").trim();
  return `Sn. ${ad}${ek ? ` ${ek}` : ","}`.replace(/\s+/g, " ").trim();
}

/**
 * ÖNCEKİ KALEMİN SEÇİMLERİNİ yeni kaleme taşır.
 *
 * Kullanıcı isteği (17.08.2026): *"O işte ilk yapılan vincin özellikleri ön
 * tanımlı seçili olarak gelsin. Oradan değiştireyim. Çünkü aynı teklif içinde
 * çoğunlukla müşteri marka vb. tercihleri aynı olacaktır."*
 *
 * SEÇİM TAŞINIR, ÖLÇÜ TAŞINMAZ. Marka, tip/seri, malzeme, standart ve kontrol
 * tercihleri bir teklifin tamamında aynıdır; kapasite, açıklık, güç, devir,
 * çap ve adet ise HER VİNCE ÖZELDİR. İkincisini kopyalamak, ikinci vincin
 * ölçülerini birincininkiyle doldurup kullanıcıya sessizce yanlış bir belge
 * hazırlatırdı — düzeltilmesi unutulan bir sayı, uydurma bir sayıdan farksızdır
 * (değişmez md. 4).
 *
 * GENEL ÖZELLİKLER grubu bütünüyle dışarıdadır: içindeki her satır o vince
 * özgü bir ölçü ya da tanımdır.
 */
const OLCU_PARCALARI = new Set([
  "count", "power", "rpm", "dia", "safety", "range", "total", "main", "aux", "value",
  "spec", "model", "place",
]);

export function copySelections(kaynak: OfferItem, hedef: OfferItem): OfferItem {
  return {
    ...hedef,
    groups: hedef.groups.map((grup) => {
      if (grup.key === "general") return grup;
      const kaynakGrup = kaynak.groups.find((g) => g.key === grup.key);
      if (!kaynakGrup) return grup;
      return {
        ...grup,
        rows: grup.rows.map((row) => {
          const kaynakRow = kaynakGrup.rows.find((r) => r.key === row.key);
          if (!kaynakRow) return row;
          const def = offerRowDef(grup.key, row.key);
          // LİSTELİ satırda değerin tamamı bir seçimdir; parçalıda yalnız
          // ölçü OLMAYAN parçalar taşınır.
          if (!def?.parts?.length) {
            return { ...row, value: kaynakRow.value, scope: kaynakRow.scope };
          }
          const parts: Record<string, string> = {};
          for (const [k, v] of Object.entries(kaynakRow.parts ?? {})) {
            if (!OLCU_PARCALARI.has(k) && v) parts[k] = v;
          }
          return withComposedValue({ ...row, parts, scope: kaynakRow.scope }, def);
        }),
      };
    }),
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

function dizi<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function rowFromRaw(raw: unknown, groupKey: string): OfferRow {
  const r = (raw ?? {}) as Partial<OfferRow>;
  const key = metin(r.key);
  const def = offerRowDef(groupKey, key);
  return withComposedValue(
    {
      key,
      label: metin(r.label, def?.label ?? key),
      value: metin(r.value),
      parts: (r.parts && typeof r.parts === "object" ? r.parts : {}) as Record<string, string>,
      manual: r.manual === true,
      hidden: r.hidden === true,
      // KAPSAM taşınır: varsayılan `orion`dur ve eski kayıtlarda alan hiç yoktu.
      scope: r.scope === "customer" ? "customer" : "orion",
      source: r.source,
    },
    def
  );
}

/**
 * Eski bir `payload`ı bugünkü şekle getirir.
 *
 * Motora yeni bir alan eklendiğinde eski revizyonlar BOZULMAZ (mühendislikteki
 * `revision-load.ts` `withDefaults` deseninin aynısı). Eksik alan varsayılanla
 * dolar, tanınmayan alan KORUNUR — ileride geri gelebilir ve bir taşıma
 * fonksiyonunun veri silmesi kabul edilebilir bir davranış değildir.
 */
export function withDefaults(raw: unknown, currency = "EUR"): OfferPayload {
  const p = (raw ?? {}) as Record<string, unknown>;
  const bos = emptyPayload(currency);
  const cover = (p.cover ?? {}) as Record<string, unknown>;
  const testLoad = (p.testLoad ?? {}) as Record<string, unknown>;
  const terms = (p.terms ?? {}) as Record<string, unknown>;
  const pricing = (p.pricing ?? {}) as Record<string, unknown>;

  return {
    version: OFFER_PAYLOAD_VERSION,
    cover: {
      fromName: metin(cover.fromName),
      fromTitle: metin(cover.fromTitle),
      fromEmail: metin(cover.fromEmail),
      toName: metin(cover.toName),
      toDept: metin(cover.toDept),
      toPhone: metin(cover.toPhone),
      customerRef: metin(cover.customerRef),
      greeting: metin(cover.greeting),
      intro: metin(cover.intro),
      signatories: dizi<{ name?: unknown; title?: unknown }>(cover.signatories).map((s) => ({
        name: metin(s?.name),
        title: metin(s?.title),
      })),
      hidden: cover.hidden === true,
    },
    items: dizi<Record<string, unknown>>(p.items).map((it) => ({
      id: metin(it.id) || newOfferId(),
      title: metin(it.title),
      craneType: metin(it.craneType),
      capacityT: sayiVeyaNull(it.capacityT),
      spanM: sayiVeyaNull(it.spanM),
      hidden: it.hidden === true,
      // BAŞLIK KİPİ TAŞINIR. Eski kayıtlarda alan hiç yoktu ve `false` gelir;
      // yani başlıkları teknik satırlardan TÜRETİLEBİLİR sayılır. Bu doğru
      // varsayımdır: o başlıklar zaten aynı kuralla (kapasite x açıklık + tip)
      // elle yazılmıştı ve türetme onları değiştirmez. Değiştirdiği yerde de
      // düzeltir — kullanıcı yine üstüne yazabilir.
      titleManual: it.titleManual === true,
      groups: dizi<Record<string, unknown>>(it.groups).map((g) => {
        const key = metin(g.key);
        return {
          id: metin(g.id) || newOfferId(),
          key,
          title: metin(g.title, OFFER_GROUP_DEF_BY_KEY[key]?.title ?? ""),
          hidden: g.hidden === true,
          rows: dizi(g.rows).map((r) => rowFromRaw(r, key)),
        };
      }),
    })),
    testLoad: {
      enabled: testLoad.enabled !== false,
      title: metin(testLoad.title, TEST_LOAD_TITLE),
      position: testLoad.position === "teknik" ? "teknik" : "ticari",
      rows: testLoad.rows
        ? dizi(testLoad.rows).map((r) => rowFromRaw(r, TEST_LOAD_GROUP_KEY))
        : bos.testLoad.rows,
    },
    terms: {
      title: metin(terms.title, TERMS_TITLE),
      rows: terms.rows ? dizi(terms.rows).map((r) => rowFromRaw(r, TERMS_GROUP_KEY)) : bos.terms.rows,
      paymentLines: dizi<Record<string, unknown>>(terms.paymentLines).map((l) => ({
        id: metin(l.id) || newOfferId(),
        text: metin(l.text),
        percent: sayiVeyaNull(l.percent),
        desc: metin(l.desc),
        hidden: l.hidden === true,
      })),
    },
    pricing: {
      currency: metin(pricing.currency, currency),
      vatIncluded: pricing.vatIncluded === true,
      lines: dizi<Record<string, unknown>>(pricing.lines).map((l) => ({
        id: metin(l.id) || newOfferId(),
        itemId: typeof l.itemId === "string" && l.itemId ? l.itemId : null,
        description: metin(l.description),
        qty: sayiVeyaNull(l.qty),
        unit: metin(l.unit, "Takım"),
        unitPrice: sayiVeyaNull(l.unitPrice),
        inTotal: l.inTotal !== false,
        optional: l.optional === true,
        hidden: l.hidden === true,
      })),
      total: sayiVeyaNull(pricing.total),
    },
    notes: dizi<Record<string, unknown>>(p.notes).map((n) => ({
      id: metin(n.id) || newOfferId(),
      text: metin(n.text),
      hidden: n.hidden === true,
    })),
    exclusions: dizi<Record<string, unknown>>(p.exclusions).map((n) => ({
      id: metin(n.id) || newOfferId(),
      text: metin(n.text),
      hidden: n.hidden === true,
    })),
  };
}

// ————————————————————————————————————————————————————————— süzme

/**
 * GİZLEME BELGEDE İZ BIRAKMAZ (kullanıcı kararı, 17.08.2026).
 *
 * Gizlenen satır, grup ya da kalem müşteriye giden PDF'e HİÇ GİRMEZ — boşluk,
 * tire ya da "gizlendi" işareti kalmaz. Bütün satırları gizlenmiş bir grup
 * BAŞLIĞIYLA BİRLİKTE düşer; aksi hâlde belgede boş bir "ELEKTRİK SİSTEMİ :"
 * başlığı kalır ve müşteri orada bir şeyin eksildiğini okur. Editör aynı
 * satırı SOLGUN ama düzenlenebilir gösterir ve verisini korur.
 *
 * DEĞERSİZ SATIR DA BASILMAZ: "Motor : " diye biten bir satır belgede bir
 * bilgi değil bir kusurdur. Editörde satır durur, kullanıcı doldurabilir.
 *
 * SÜZGEÇ TEKTİR ve PDF ile ekran özeti onu birlikte çağırır. İki yerde
 * yazılsaydı gizlenen satır ekrandan düşer ama belgeye girmeye devam ederdi —
 * bu bölümde olabilecek en pahalı hata budur.
 */
export function printedRows(rows: readonly OfferRow[]): OfferRow[] {
  return rows.filter((r) => !r.hidden && rowHasValue(r));
}

export function printedGroups(groups: readonly OfferGroup[]): OfferGroup[] {
  return groups
    .filter((g) => !g.hidden)
    .map((g) => ({ ...g, rows: printedRows(g.rows) }))
    .filter((g) => g.rows.length > 0);
}

export function printedItems(items: readonly OfferItem[]): OfferItem[] {
  return items
    .filter((i) => !i.hidden)
    .map((i) => ({ ...i, groups: printedGroups(i.groups) }))
    .filter((i) => i.groups.length > 0 || i.title.trim() !== "");
}

export function printedTextLines(lines: readonly OfferTextLine[]): OfferTextLine[] {
  return lines.filter((l) => !l.hidden && l.text.trim() !== "");
}

/** Belgeye BASILACAK hâl — PDF ve ekran özeti bunu okur. */
export function printedPayload(payload: OfferPayload): OfferPayload {
  return {
    ...payload,
    items: printedItems(payload.items),
    testLoad: { ...payload.testLoad, rows: printedRows(payload.testLoad.rows) },
    terms: {
      ...payload.terms,
      rows: printedRows(payload.terms.rows),
      paymentLines: payload.terms.paymentLines.filter((l) => !l.hidden && l.text.trim() !== ""),
    },
    pricing: { ...payload.pricing, lines: payload.pricing.lines.filter((l) => !l.hidden) },
    notes: printedTextLines(payload.notes),
    exclusions: printedTextLines(payload.exclusions),
  };
}

/** Editörde "kaç satır gizli" sayacı — gizlemenin sessiz kalmaması için. */
export function hiddenCount(payload: OfferPayload): number {
  let n = 0;
  for (const item of payload.items) {
    if (item.hidden) n += 1;
    for (const group of item.groups) {
      if (group.hidden) n += 1;
      n += group.rows.filter((r) => r.hidden).length;
    }
  }
  n += payload.testLoad.rows.filter((r) => r.hidden).length;
  n += payload.terms.rows.filter((r) => r.hidden).length;
  n += payload.terms.paymentLines.filter((l) => l.hidden).length;
  n += payload.pricing.lines.filter((l) => l.hidden).length;
  n += payload.notes.filter((l) => l.hidden).length;
  n += payload.exclusions.filter((l) => l.hidden).length;
  return n;
}

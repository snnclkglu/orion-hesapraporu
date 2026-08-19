// TEKLİF KOPYALAMA — belge, revizyon ve KALEM düzeyinde; saf dönüşüm.
//
// Üç kopyalama tek dosyada durur çünkü üçü de AYNI soruyu farklı ölçekte
// sorar: hangi kimlikler yenilenir, hangi bağ taşınır, ne BOŞALIR.
//
// Kullanıcı isteği (17.08.2026): *"Teklifi yeni bir müşteriye kopyalama
// özelliği de olsun. Benzer bir işi başka müşteri isterse hemen ona kopyalayıp
// değiştirebileyim."*
//
// KURAL, İŞ EMRİ KOPYALAMANIN AYNISIDIR (IS-25): TEKNİK içerik kopyalanır,
// MUHATABA ait olan her şey BOŞ kalır. Eski müşterinin adına yazılmış bir
// hitap ya da onun kendi talep numarası, yeni teklifte yalnızca yanlış değil
// UTANDIRICIDIR — ve fark edilmesi en zor hata tam olarak budur, çünkü belge
// geri kalan her yerinde doğru görünür.
//
// FİYAT KOPYALANIR ve bu bilinçlidir: kopyalamanın sebebi zaten "benzer bir
// iş"tir ve fiyat, düzeltilecek ilk şeydir. Silinseydi kullanıcı her seferinde
// eski teklifi ayrıca açıp bakmak zorunda kalırdı.

import { newOfferId } from "./payload";
import { GENERAL_GROUP_KEY } from "./registry";
import { defaultFreeItemTitle, defaultItemTitle } from "./title";
import type { OfferItem, OfferPayload, OfferPriceLine, OfferRow } from "./types";

export interface OfferCopyOptions {
  /** Yeni müşterinin adı — hitap ve künye ondan kurulur. */
  customerName: string;
  /** Teklifi hazırlayan (kopyalayan) kişinin künyesi; verilmezse korunur. */
  from?: { name: string; title: string; email: string };
}

/**
 * Belgeyi yeni bir müşteriye hazır hâle getirir.
 *
 * KİMLİKLER YENİLENİR (kalem, grup, satır, fiyat satırı): iki teklif aynı
 * kimlikleri taşısaydı, birinde yapılan bir düzeltmenin ötekine sızmadığından
 * emin olmanın yolu kalmazdı ve fiyat satırının kaleme bağı iki belgeye birden
 * işaret ederdi.
 */
export function copyPayloadForCustomer(
  payload: OfferPayload,
  options: OfferCopyOptions
): OfferPayload {
  // Eski kalem kimliği → yeni kimlik. Fiyat satırının `itemId` bağı bu haritayla
  // taşınır; taşınmasaydı kopyada bütün fiyatlar "serbest satır"a düşerdi.
  const itemIdMap = new Map<string, string>();

  const items = payload.items.map((item) => {
    const id = newOfferId();
    itemIdMap.set(item.id, id);
    return {
      ...item,
      id,
      groups: item.groups.map((g) => ({ ...g, id: newOfferId(), rows: g.rows.map((r) => ({ ...r })) })),
    };
  });

  return {
    ...payload,
    cover: {
      ...payload.cover,
      ...(options.from
        ? { fromName: options.from.name, fromTitle: options.from.title, fromEmail: options.from.email }
        : {}),
      // MUHATAP BİLGİLERİ BOŞALIR — eski firmanın satın alma müdürü yeni
      // teklifte görünmemelidir.
      toName: "",
      toDept: "",
      toPhone: "",
      customerRef: "",
      greeting: "",
    },
    items,
    terms: {
      ...payload.terms,
      paymentLines: payload.terms.paymentLines.map((l) => ({ ...l, id: newOfferId() })),
    },
    pricing: {
      ...payload.pricing,
      lines: payload.pricing.lines.map((l) => ({
        ...l,
        id: newOfferId(),
        itemId: l.itemId ? itemIdMap.get(l.itemId) ?? null : null,
      })),
    },
    notes: payload.notes.map((n) => ({ ...n, id: newOfferId() })),
    exclusions: payload.exclusions.map((n) => ({ ...n, id: newOfferId() })),
    // GENEL ŞARTLAR da kimlik yeniler: dosyanın kendi kuralı budur ve bir
    // bölümün atlanması, iki belgenin aynı madde kimliğini taşıması demekti.
    generalTerms: payload.generalTerms.map((t) => ({ ...t, id: newOfferId() })),
  };
}

/**
 * Yeni revizyon için belgeyi kopyalar — AYNI teklifin bir sonraki sürümü.
 *
 * Kimlikler burada KORUNUR (kopyalamanın tersine): revizyonlar arası
 * karşılaştırma satırları kimlikleriyle eşleştirir ve yenilenselerdi her
 * revizyon "her şey değişti" derdi.
 */
export function copyPayloadForRevision(payload: OfferPayload): OfferPayload {
  return payload;
}

// ————————————————————————————————————————————————————————— kalem kopyası

/**
 * Satırın kopyası.
 *
 * `parts` BİR NESNEDİR ve `{...row}` onu PAYLAŞTIRIR: kopyada motorun gücünü
 * değiştirmek kaynaktaki motoru da değiştirirdi ve fark ancak belge basıldığında
 * görülürdü. Satırın kendi kimliği yoktur (`rowFromDef` yalnız `key` verir),
 * yani yenilenecek bir id de yok — kopyalanacak tek şey içeriktir.
 */
function copyOfferRow(row: OfferRow): OfferRow {
  return row.parts ? { ...row, parts: { ...row.parts } } : { ...row };
}

/** Kalem defterden kurulmuş bir VİNÇ mi, yoksa SERBEST bir kalem mi (TEKLIF-33). */
function isFreeItem(item: OfferItem): boolean {
  return !item.groups.some((g) => g.key === GENERAL_GROUP_KEY);
}

/**
 * KOPYANIN ADI — yeni kalemin adıyla AYNI KURALDAN gelir ("VİNÇ - 4").
 *
 * Kullanıcı isteği (19.08.2026): *"Buna çok benzer aynı teklif içerisinde başka
 * bir vinç var … tamamen kopyalamak isterim. Hızlıca birkaç özelliğini
 * değiştirip düzenlerim."*
 *
 * KAYNAĞIN ADI TAŞINMAZ: belgede iki bölüm aynı başlıkla dururdu ve fiyat
 * tablosunda da iki satır aynı metni taşırdı — devralınan tekliflerde tonajın
 * yanlış yazıldığı ve ancak müşteri sorunca anlaşıldığı hata tam olarak budur
 * (TEKLIF-7). Bölüm rayında da hangisinin kopya olduğu okunamazdı.
 *
 * " - 2" GİBİ BİR EK DE UYDURULMAZ (değişmez md. 5): "32T VİNÇ - 2" ne bir ölçü
 * ne bir tiptir, belgeye girse müşteri onu ikinci vincin ADI sanardı.
 * `defaultItemTitle` ise depoda ZATEN bir addır ve yer tutucu OLMADIĞI oradaki
 * gerekçede yazılıdır: kaydedilir, kullanıcı üstüne yazar ya da teknik satırlar
 * doldukça başlık kendiliğinden gerçek adına kavuşur.
 *
 * NUMARA ÇAKIŞMAYI ATLAR: kopya kaynağın hemen ARDINA girer, yani sırası
 * kendisinden sonraki kalemlerin numaralarıyla çakışabilirdi ("VİNÇ - 2" iki
 * kez). Kullanılmayan ilk numara aranır.
 */
function copyItemTitle(items: readonly OfferItem[], serbest: boolean): string {
  const kullanilan = new Set(items.map((x) => (x.title ?? "").trim()));
  const ad = serbest ? defaultFreeItemTitle : defaultItemTitle;
  let sira = items.length + 1;
  while (kullanilan.has(ad(sira))) sira += 1;
  return ad(sira);
}

/**
 * Kalemin İKİZİ — bütün teknik satırları, gizleme ve kapsam işaretleriyle.
 *
 * KİMLİKLER YENİLENİR (kalem ve HER grup): kopyada eski kimliğin kalması, fiyat
 * satırının `itemId` bağını iki kaleme birden bağlar ve `loadedCostByOfferItem`
 * gibi kalem kimliğiyle anahtarlanan her harita sessizce tek satır gösterirdi.
 *
 * `titleManual` KALEMİN TÜRÜNE göre kurulur — yeni kalem sihirbazının kuralının
 * aynısı: serbest kalemde türetilecek bir kapasite yoktur, adı insan yazar;
 * vinçte ise kapak açık kalır ve kullanıcı kapasiteyi düzeltir düzeltmez başlık
 * kendiliğinden "10T x 19,5m …" olur (`withAutoTitle`).
 */
export function copyOfferItem(item: OfferItem, title: string): OfferItem {
  const serbest = isFreeItem(item);
  return {
    ...item,
    id: newOfferId(),
    title,
    titleManual: serbest,
    groups: item.groups.map((g) => ({
      ...g,
      id: newOfferId(),
      rows: g.rows.map(copyOfferRow),
    })),
  };
}

export interface OfferItemCopyResult {
  payload: OfferPayload;
  kopya: OfferItem;
  /** Kaç fiyat satırı taşındı — ekran bunu kullanıcıya SÖYLER, toplam değişir. */
  priceLineCount: number;
}

/**
 * Kalemi AYNI TEKLİFE ikinci bir kalem olarak kopyalar.
 *
 * KOPYA KAYNAĞIN HEMEN ARDINA GİRER, sona değil. Belge kalem sırasıyla basılır
 * ve editörde kalemleri yeniden sıralamanın bir yolu YOKTUR (yalnız bölümler
 * taşınabilir); yani yerleştirme kararı bir kolaylık değil, tek şanstır. Kopya
 * kaynağın kardeşidir, belgenin sonuna düşen bir eklenti değil.
 *
 * FİYAT SATIRLARI DA KOPYALANIR ve kopyanın kimliğine bağlanır.
 * Gerekçe bu dosyanın kendi kararının (yukarıdaki "FİYAT KOPYALANIR") kalem
 * ölçeğidir ve bir de asimetrisi vardır: YANLIŞ bir fiyat görünür ve düzeltilir,
 * EKSİK bir satır ise belgede hiç görünmez — teklif olduğundan ucuza gider ve
 * hata ancak sipariş alındıktan sonra anlaşılır. Kullanıcının kelimesi de
 * "tamamen kopyalamak"tır. Toplamın anında artması bu yüzden bir yan etki
 * değil, kopyalamanın SÖYLENMESİ gereken sonucudur.
 *
 * `pricing.total` BURADA YAZILMAZ: toplamın tek yazıcısı kaydetme yolundaki
 * `withTotal`dır (ekran onu `effectiveTotal` ile canlı hesaplar). İkinci bir
 * yazıcı, iki sayının ayrışması demekti.
 *
 * Kalem bulunamazsa `null` döner — çağıran ekranda bir şey değiştirmez.
 */
export function copyItemInPayload(
  payload: OfferPayload,
  itemId: string
): OfferItemCopyResult | null {
  const index = payload.items.findIndex((x) => x.id === itemId);
  if (index < 0) return null;

  const kaynak = payload.items[index];
  const kopya = copyOfferItem(kaynak, copyItemTitle(payload.items, isFreeItem(kaynak)));
  const items = [...payload.items.slice(0, index + 1), kopya, ...payload.items.slice(index + 1)];

  // Kopyalanan satırlar kaynağın SON fiyat satırının ardına girer: iki vincin
  // satırları belgede yan yana okunur, araya başka bir kalemin fiyatı girmez.
  const kopyaLines: OfferPriceLine[] = [];
  let sonIndex = -1;
  payload.pricing.lines.forEach((line, i) => {
    if (line.itemId !== kaynak.id) return;
    sonIndex = i;
    kopyaLines.push({ ...line, id: newOfferId(), itemId: kopya.id });
  });

  const lines =
    sonIndex < 0
      ? payload.pricing.lines
      : [
          ...payload.pricing.lines.slice(0, sonIndex + 1),
          ...kopyaLines,
          ...payload.pricing.lines.slice(sonIndex + 1),
        ];

  return {
    payload: { ...payload, items, pricing: { ...payload.pricing, lines } },
    kopya,
    priceLineCount: kopyaLines.length,
  };
}

// TEKLİFİ BAŞKA BİR MÜŞTERİYE KOPYALAMA — saf dönüşüm.
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
import type { OfferPayload } from "./types";

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

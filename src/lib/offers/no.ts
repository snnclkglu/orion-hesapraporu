// TEKLİF NUMARASI — `TETR-20260817-1`.
//
// Kullanıcının on beş yıldır kullandığı biçim aynen korunur:
//     TE + BELGE DİLİ (TR|EN) + YIL AY GÜN + o günün kaçıncı teklifi
// Numara MÜŞTERİYLE YAZIŞMADA geçen referanstır; `docCode` (ORC-HR-0055-R01)
// ile karıştırılmaz — o bir iç belge kodudur ve revizyonu içinde taşır.
//
// REVİZYON NUMARANIN İÇİNE İLİŞTİRİLMEZ. Devralınan dosyalarda üç ayrı yazım
// dolaşıyordu: referansa eklenmiş (`20260127-1 Rev2`), küçük harfle
// (`20260702-1-r1`) ve yalnız dosya adında kalıp belgede hiç görünmeyen.
// Sonuncusu gerçek bir kayıp: müşterinin elindeki iki kâğıttan hangisinin
// güncel olduğu belgeden okunamıyordu. Revizyon artık AYRI bir alandır ve
// kapakta da altbilgide de basılır.

import type { OfferLang } from "./lang";

/** `2026-08-17` → `20260817`. Tarih ISO metninden okunur, `Date` kurulmaz. */
export function offerDateKey(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/** `TETR-20260817-1` */
export function offerNo(lang: OfferLang, isoDate: string, seq: number): string {
  return `TE${lang.toUpperCase()}-${offerDateKey(isoDate)}-${seq}`;
}

export interface ParsedOfferNo {
  lang: OfferLang;
  isoDate: string;
  seq: number;
}

/** Numarayı geri okur; biçim tutmuyorsa `null` (eski/elle yazılmış kayıt). */
export function parseOfferNo(no: string): ParsedOfferNo | null {
  const m = /^TE(TR|EN)-(\d{4})(\d{2})(\d{2})-(\d+)$/.exec(no.trim().toUpperCase());
  if (!m) return null;
  return {
    lang: m[1].toLowerCase() as OfferLang,
    isoDate: `${m[2]}-${m[3]}-${m[4]}`,
    seq: Number(m[5]),
  };
}

/**
 * Belgede ve dosya adında görünen REVİZYON etiketi.
 *
 * R0 için etiket YOKTUR: ilk teklif bir revizyon değildir ve kapakta
 * "REV 00" yazması, müşteriye hiç var olmamış bir düzeltme geçmişi anlatırdı.
 */
export function offerRevLabel(revNo: number): string | null {
  return revNo > 0 ? `REV ${String(revNo).padStart(2, "0")}` : null;
}

/** Altbilgi künyesi: `TETR-20260817-1 · REV 02`. */
export function offerDocLine(no: string, revNo: number): string {
  const rev = offerRevLabel(revNo);
  return rev ? `${no} · ${rev}` : no;
}

/**
 * Bir sonraki sıra numarası.
 *
 * ÖNERİDİR, KİLİT DEĞİLDİR (`order-no.ts` ile aynı ruh): asıl tekillik
 * `offers_seq_uidx` benzersiz indeksindedir. İki kişi aynı anda teklif açarsa
 * ikincinin insert'i düşer ve çağıran bir artırıp yeniden dener.
 */
export function nextSeq(kullanilanlar: readonly number[]): number {
  return kullanilanlar.reduce((enBuyuk, n) => Math.max(enBuyuk, n), 0) + 1;
}

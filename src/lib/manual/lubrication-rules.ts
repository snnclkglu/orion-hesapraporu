// YAĞLAMA NOKTALARI DEFTERİ — saf; React, DB ve HTTP yok.
//
// TABLONUN İSKELETİ TÜRETİLİR, MARKA SÜTUNLARI BOŞ DOĞAR.
//
// Kaynak belgedeki yağlama tablosunun sütunları `No · Yağlanacak Yer · Shell ·
// Mobil · B.P.`dir. Bunlardan İKİSİ ayrı sorulardır:
//
//   HANGİ NOKTALAR VAR — ekipman listesinde YAZILIDIR (redüktör, tambur
//   yatağı, teker yatağı, kaplin, makara). Elle yazılan asıl yük budur ve
//   türetilebilir.
//
//   HANGİ ÜRÜN KULLANILIR — uygulamada YAĞLAYICI KATALOĞU YOKTUR. "Shell
//   Omala S2 G 220" yazmak uydurma veri olurdu (değişmez md. 4) ve otuz
//   kılavuz sonra kimsenin doğrulamayacağı bir yalana dönerdi. Hücre BOŞ
//   kalır; ekranda `—` görünür ve mühendis redüktör üreticisinin
//   kataloğundan doldurur.
//
// KÖPRÜ: tablonun üstüne türetilmiş bir NOT düşer ve hangi yağ SINIFININ
// aranacağını söyler (ISO VG kademesi, NLGI kıvamı). Sınıf bir mühendislik
// kararıdır ve marka değildir; boş sütunları neyle dolduracağını bilmeyen
// mühendis, tabloyu hiç doldurmayan mühendistir.
//
// YAĞ KEÇESİ LİSTESİ TÜRETİLMEZ (KITAP-5): keçe hesap motorunda bir seçim
// alanı değildir ve uydurma bir liste ÜRETİLMEZ. O tablo boş kalmaya devam
// eder ve rehber notu bunu söyler.

import type { ManualEquipmentRow } from "./sources";
import type { ManualTable } from "./types";

/** Yağlama tablosunun beş sütunu — şablondaki başlıkların AYNISI. */
export const YAGLAMA_BASLIKLARI = ["No", "Yağlanacak Yer", "Shell", "Mobil", "B.P."] as const;

export interface LubricationPoint {
  /** Kararlı kimlik; panel defteri bu kimlikle üzerine biner. */
  id: string;
  /** Ekipman ADINA uyan desen (RegExp kaynağı); boşsa her vinçte basılır. */
  match?: string;
  /** "Yağlanacak Yer" hücresinin öneki; parça adı kaynaktan eklenir. */
  place: string;
  /**
   * YAĞ SINIFI — ürün adı DEĞİL. Tabloya basılmaz; köprü notunu kurar.
   * "Dişli yağı ISO VG 220", "Gres NLGI 2" gibi.
   */
  klass: string;
  basis: string;
  disabled?: boolean;
}

/**
 * KOD DEFTERİ.
 *
 * Sıra korunur: tablo bu sırayla üretilir ve iki revizyon arasındaki fark
 * okunabilir kalır.
 */
export const LUBRICATION_POINT_BOOK: readonly LubricationPoint[] = [
  {
    id: "reduktor",
    match: "^Redüktör$",
    place: "Dişli kutusu",
    klass: "Dişli yağı — ISO VG kademesi redüktör üreticisinin kataloğundadır",
    basis: "Redüktör üreticisinin kataloğu",
  },
  {
    id: "tamburYatak",
    match: "tambur.*(rulman|yatak)",
    place: "Tambur yatağı",
    klass: "Gres — NLGI 2",
    basis: "Rulman üreticisinin kataloğu",
  },
  {
    id: "tekerYatak",
    match: "teker.*(rulman|yatak)",
    place: "Tekerlek yatağı",
    klass: "Gres — NLGI 2",
    basis: "Rulman üreticisinin kataloğu",
  },
  {
    id: "makaraRulman",
    match: "makara.*rulman|rulman.*makara",
    place: "Makara rulmanı",
    klass: "Gres — NLGI 2",
    basis: "Rulman üreticisinin kataloğu",
  },
  {
    id: "kancaRulman",
    match: "kanca.*rulman",
    place: "Kanca rulmanı",
    klass: "Gres — NLGI 2",
    basis: "Rulman üreticisinin kataloğu",
  },
  {
    id: "dengeRulman",
    match: "denge.*rulman",
    place: "Denge makarası rulmanı",
    klass: "Gres — NLGI 2",
    basis: "Rulman üreticisinin kataloğu",
  },
  {
    id: "kaplin",
    match: "kaplin",
    place: "Dişli kaplin",
    klass: "Kaplin gresi — NLGI 1/2",
    basis: "Kaplin üreticisinin kataloğu",
  },
  {
    id: "motorYatak",
    match: "^Motor$",
    place: "Motor yatağı",
    klass: "Gres — NLGI 2 (kapalı yataklarda yağlama gerekmez)",
    basis: "Motor üreticisinin kataloğu",
  },
  {
    id: "halat",
    match: "^Çelik halat$",
    place: "Çelik halat",
    klass: "Halat yağı",
    basis: "DIN 15020 — halat bakımı",
  },
];

function desenUyar(match: string, ad: string): boolean {
  try {
    return new RegExp(match, "i").test(ad);
  } catch {
    return ad.toLocaleLowerCase("tr").includes(match.toLocaleLowerCase("tr"));
  }
}

/** Kod defteri + panel defteri; `mergeMaintenanceRules`in ikizi. */
export function mergeLubricationPoints(
  book: readonly LubricationPoint[],
  overlay: readonly LubricationPoint[]
): LubricationPoint[] {
  const harita = new Map<string, LubricationPoint>();
  for (const r of book) harita.set(r.id, r);
  const ekler: LubricationPoint[] = [];
  for (const o of overlay) {
    if (harita.has(o.id)) harita.set(o.id, { ...harita.get(o.id)!, ...o });
    else ekler.push(o);
  }
  return [...harita.values(), ...ekler].filter((r) => !r.disabled);
}

export interface LubricationOptions {
  points?: readonly LubricationPoint[];
}

/**
 * YAĞLAMA TABLOSUNU ÜRETİR.
 *
 * Bir nokta ancak o vinçte KARŞILIĞI OLAN ekipman varsa açılır. "Yağlanacak
 * Yer" hücresi grubu da taşır — aynı vinçte üç redüktör olabilir ve bakımcı
 * hangisini yağlayacağını bilmelidir.
 *
 * MARKA SÜTUNLARI BOŞ DÖNER ve bu bir eksiklik değil bir KARARDIR (dosya
 * başlığı).
 */
export function lubricationTable(
  equipment: readonly ManualEquipmentRow[],
  opts: LubricationOptions = {}
): ManualTable {
  const noktalar = opts.points ?? LUBRICATION_POINT_BOOK;
  const takili = equipment.filter((r) => !r.alternative);

  const rows: string[][] = [];
  const gorulen = new Set<string>();
  for (const n of noktalar) {
    const uyan = n.match
      ? takili.filter((e) => desenUyar(n.match!, e.component))
      : takili;
    for (const e of uyan) {
      const yer = `${e.group} · ${n.place}`;
      if (gorulen.has(yer)) continue;
      gorulen.add(yer);
      rows.push([String(rows.length + 1), yer, "", "", ""]);
    }
  }

  return {
    head: [...YAGLAMA_BASLIKLARI],
    rows,
    caption:
      "Noktalar ekipman listesinden üretilir; ürün adları kullanılan ekipmanın kataloğuna göre doldurulur.",
  };
}

/**
 * KÖPRÜ NOTU — boş marka sütunlarının neyle doldurulacağını söyler.
 *
 * Vincte karşılığı olan yağ SINIFLARINI döndürür. Hiç nokta yoksa BOŞ dizi
 * döner ve çağıran blok üretmez: olmayan bir tablo için açıklama yazmak,
 * okuyana var olmayan bir şeyi vaat etmekti.
 */
export function lubricationClassNote(
  equipment: readonly ManualEquipmentRow[],
  opts: LubricationOptions = {}
): string[] {
  const noktalar = opts.points ?? LUBRICATION_POINT_BOOK;
  const takili = equipment.filter((r) => !r.alternative);

  const items: string[] = [];
  for (const n of noktalar) {
    const varMi = n.match
      ? takili.some((e) => desenUyar(n.match!, e.component))
      : takili.length > 0;
    if (!varMi) continue;
    const satir = `${n.place}: ${n.klass}`;
    if (!items.includes(satir)) items.push(satir);
  }
  return items;
}

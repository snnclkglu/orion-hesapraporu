// ELEKTRİK LİSTESİNİN SÜZGECİ VE SIRALAMASI — saf, TEK TANIM.
//
// NEDEN AYRI DOSYA: aynı süzgeç İKİ yerde uygulanıyor — ekrandaki tablo ve
// Excel çıktısı. İki kez yazılsaydı kullanıcının süzüp indirdiği dosya
// ekranda gördüğünden BAŞKA satırlar taşırdı; bu, bir malzeme listesinde
// yapılabilecek en sinsi hatadır (`offers/filter.ts`teki "SÜZGEÇ TEKTİR"
// kuralının aynısı, İş Takibi'nde bir kez yaşandı).
//
// SIRALAMA DA BURADADIR ve bu bilinçlidir: süzgeçle aynı soruyu cevaplar
// ("kullanıcı şu an neye bakıyor") ve indirilen dosyanın satır sırası da
// ekrandakiyle aynı olmalıdır.

import { trKatla } from "@/lib/drawings/tr-text";
import { electricalCategory } from "./category";
import type { ElectricalMaterialRow, ElectricalPart } from "./types";

/** Ekranda ve indirmede aynı olan süzgeç durumu. */
export interface ElectricalFilter {
  /** Pano kodu (`+` OLMADAN, ör. `LVD10`); boş = bütün panolar. */
  location: string;
  /** Tedarikçi adı, tam eşleşme; boş = bütün tedarikçiler. */
  supplier: string;
  /** Türetilmiş işlev ailesi, tam eşleşme; boş = bütün kategoriler. */
  category: string;
  /** Serbest arama — kategori dâhil ekranda görülen metin alanlarında. */
  q: string;
}

export const BOS_SUZGEC: ElectricalFilter = { location: "", supplier: "", category: "", q: "" };

export function suzgecTemizMi(f: ElectricalFilter): boolean {
  return !f.location && !f.supplier && !f.category && !f.q.trim();
}

/**
 * Arama karşılaştırması `trKatla` iledir, düz `toLowerCase()` DEĞİL.
 *
 * "SİGORTA" araması "sigorta"yı bulmalı; Türkçe'de `toLowerCase()` "I"yı "i"
 * yapmaz ve "İ" ile "i" ayrışır. Defterin geri kalanı da (arama, tekillik,
 * eşleştirme) bu katlamayı kullanıyor — ikinci bir kural aramayı bölümden
 * bölüme farklı davrandırırdı.
 */
function icerir(alan: string, katlanmisQ: string): boolean {
  return trKatla(alan).includes(katlanmisQ);
}

// ————————————————————————————————————————————————————————— aygıt listesi

export const PART_SORT_KEYS = [
  "sort",
  "deviceTag",
  "qty",
  "designation",
  "typeNo",
  "supplier",
  "partNo",
  "page",
] as const;

export type PartSortKey = (typeof PART_SORT_KEYS)[number];

/**
 * Metin karşılaştırıcı — Türkçe harf sırası (`ç ğ ı İ ö ş ü`).
 *
 * `localeCompare(…, "tr")` şart: öntanımlı sıra "İ"yi "Z"den sonraya atar ve
 * tedarikçi listesi alfabetik görünmezdi.
 */
const metinKarsilastir = (a: string, b: string): number => a.localeCompare(b, "tr");

/**
 * Sayı karşılaştırıcı — `null` HER ZAMAN SONDA.
 *
 * Okunamayan bir adet ne büyüktür ne küçük; bilinmiyordur (değişmez md. 4).
 * Onu `0` sayıp başa almak, listeyi "adete göre" sıralayan kullanıcıya
 * sıfır adetli bir malzeme varmış gibi gösterirdi. Yön ne olursa olsun sonda
 * kalır — `desc` bilinmeyeni bilinene çeviremez.
 */
const sayiKarsilastir = (a: number | null, b: number | null, desc: boolean): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return desc ? b - a : a - b;
};

export function filterParts(
  parts: readonly ElectricalPart[],
  f: ElectricalFilter
): ElectricalPart[] {
  const q = trKatla(f.q.trim());
  return parts.filter((p) => {
    const category = electricalCategory(p);
    if (f.location && p.location !== f.location) return false;
    if (f.supplier && p.supplier !== f.supplier) return false;
    if (f.category && category !== f.category) return false;
    if (!q) return true;
    return (
      icerir(p.deviceTag, q) ||
      icerir(p.designation, q) ||
      icerir(p.typeNo, q) ||
      icerir(p.supplier, q) ||
      icerir(p.partNo, q) ||
      icerir(category, q)
    );
  });
}

/**
 * BELGEDEKİ SIRA ÖNTANIMDIR (`sort` anahtarı).
 *
 * Elektrikçi listeyi projenin kendi düzeninde okur; alfabetik bir öntanım onu
 * belgeden koparırdı. Sıralama kullanıcının AÇIK bir isteğidir ve `sort`
 * anahtarı ona geri dönüş yolunu bırakır.
 */
export function sortParts(
  parts: readonly ElectricalPart[],
  key: PartSortKey,
  desc: boolean
): ElectricalPart[] {
  const kopya = [...parts];
  if (key === "sort") return desc ? kopya.reverse() : kopya;
  kopya.sort((a, b) => {
    if (key === "qty") return sayiKarsilastir(a.qty, b.qty, desc);
    if (key === "page") return desc ? b.page - a.page : a.page - b.page;
    const s = metinKarsilastir(a[key], b[key]);
    return desc ? -s : s;
  });
  return kopya;
}

// ——————————————————————————————————————————————————————— malzeme listesi

export const MATERIAL_SORT_KEYS = [
  "sort",
  "qty",
  "designation",
  "category",
  "typeNo",
  "supplier",
  "partNo",
  "locations",
] as const;

export type MaterialSortKey = (typeof MATERIAL_SORT_KEYS)[number];

export function filterMaterials(
  rows: readonly ElectricalMaterialRow[],
  f: ElectricalFilter
): ElectricalMaterialRow[] {
  const q = trKatla(f.q.trim());
  return rows.filter((m) => {
    // MALZEME SATIRI ÇOK PANOLUDUR: aynı şalter beş panoda geçebilir ve pano
    // süzgeci onu ELEMEZ — "bu panoda hangi malzemeler var" sorusunun cevabı
    // o satırı içerir.
    if (f.location && !m.locations.includes(f.location)) return false;
    if (f.supplier && m.supplier !== f.supplier) return false;
    if (f.category && m.category !== f.category) return false;
    if (!q) return true;
    return (
      icerir(m.designation, q) ||
      icerir(m.typeNo, q) ||
      icerir(m.supplier, q) ||
      icerir(m.partNo, q) ||
      icerir(m.category, q)
    );
  });
}

export function sortMaterials(
  rows: readonly ElectricalMaterialRow[],
  key: MaterialSortKey,
  desc: boolean
): ElectricalMaterialRow[] {
  const kopya = [...rows];
  if (key === "sort") return desc ? kopya.reverse() : kopya;
  kopya.sort((a, b) => {
    if (key === "qty") return sayiKarsilastir(a.qty, b.qty, desc);
    const s =
      key === "locations"
        ? metinKarsilastir(a.locations.join(" "), b.locations.join(" "))
        : metinKarsilastir(a[key], b[key]);
    return desc ? -s : s;
  });
  return kopya;
}

// ————————————————————————————————————————————————————————— çözümleyiciler

/** URL sorgusundan süzgeç — indirme ucu ekranla AYNI durumu okur. */
export function filterFromParams(sp: URLSearchParams): ElectricalFilter {
  return {
    location: (sp.get("pano") ?? "").trim(),
    supplier: (sp.get("tedarikci") ?? "").trim(),
    category: (sp.get("kategori") ?? "").trim(),
    q: (sp.get("ara") ?? "").trim(),
  };
}

/** Süzgeci URL sorgusuna çevirir; BOŞ alan parametre AÇMAZ. */
export function filterToQuery(f: ElectricalFilter): string {
  const sp = new URLSearchParams();
  if (f.location) sp.set("pano", f.location);
  if (f.supplier) sp.set("tedarikci", f.supplier);
  if (f.category) sp.set("kategori", f.category);
  if (f.q.trim()) sp.set("ara", f.q.trim());
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Sıralama anahtarını sorgudan güvenle okur; tanınmayan `sort`a düşer. */
export function partSortFromParams(sp: URLSearchParams): { key: PartSortKey; desc: boolean } {
  const ham = sp.get("sirala") ?? "";
  const key = (PART_SORT_KEYS as readonly string[]).includes(ham)
    ? (ham as PartSortKey)
    : "sort";
  return { key, desc: sp.get("yon") === "desc" };
}

export function materialSortFromParams(
  sp: URLSearchParams
): { key: MaterialSortKey; desc: boolean } {
  const ham = sp.get("sirala") ?? "";
  const key = (MATERIAL_SORT_KEYS as readonly string[]).includes(ham)
    ? (ham as MaterialSortKey)
    : "sort";
  return { key, desc: sp.get("yon") === "desc" };
}

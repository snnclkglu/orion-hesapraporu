// TEKLİF LİSTESİ SÜZGECİ — saf çekirdek, TEK tanım yeri.
//
// İş Takibi'nin dersi (worklog/filters.ts) ve İşler'in kuralı (IS-25) burada da
// geçerlidir: tablo, özet şeridi ve ileride eklenecek her çıktı ucu AYNI
// fonksiyonlardan süzer. İki süzgeç yazılsaydı ekrandaki sayı ile listedeki
// satırlar sessizce ayrışırdı.
//
// EŞLEŞME `trKatla` İLEDİR, `toLowerCase` DEĞİL: adlar BÜYÜK saklanır ve düz
// küçültme Türkçe'nin noktalı/noktasız i ayrımını çözemez — "eti bakir" yazan
// "ETİ BAKIR"ı bulmalıdır.

import { trKatla } from "@/lib/drawings/tr-text";
import { offerStatusOf } from "./status";
import { gunFarki, takipBaslangici, takipGorunur } from "./takip";

/** Liste satırının süzgeç ve sıralama için gereken çekirdeği. */
export interface OfferListRow {
  id: string;
  offer_no: string;
  subject: string;
  /** Teklifteki resmî unvan (basıldığı andaki fotoğraf). */
  customer_name: string;
  /** Müşteri defterindeki kısaltma — listede bu görünür. */
  customerShort?: string | null;
  /** Defterdeki OKLCH ton açısı; her müşteri kendi rengiyle görünür. */
  customerHue?: number | null;
  status: string;
  /** Numaranın günü — teklifin AÇILDIĞI tarih, kimliğinin parçası. */
  issue_date: string;
  /** Müşteriye GÖNDERİLDİĞİ tarih; hiç yayımlanmamışsa null (bkz. `takip.ts`). */
  issuedOn: string | null;
  /** Kazanılma günü — yalnız `won` durumunda doludur. */
  wonOn?: string | null;
  currency: string;
  latestTotal: number | null;
  latestRevNo: number | null;
  /** Belgedeki kalemlerin vinç tipleri (güncel revizyondan türetilir). */
  craneTypes: string[];
  /** Belgedeki kalemlerin kapasiteleri [ton]. */
  capacities: number[];
  itemCount: number;
}

/**
 * TEKLİFİN GEÇERLİ TARİHİ — gönderildiyse gönderim günü, yoksa açılış günü.
 *
 * Kullanıcı kararı: *"teklif yayınlandığında teklifin tarihi o tarih olur yani
 * teklif verdiğim tarih."* Ekranda, süzgeçte ve sıralamada okunan tarih budur;
 * numaranın içindeki tarih ise kimliğin parçasıdır ve DEĞİŞMEZ.
 */
export function effectiveOfferDate(row: Pick<OfferListRow, "issue_date" | "issuedOn">): string {
  return row.issuedOn || row.issue_date;
}

/** Teklifin yılı — geçerli tarihinden. */
export function offerYear(row: Pick<OfferListRow, "issue_date" | "issuedOn">): string {
  return /^(\d{4})/.exec(effectiveOfferDate(row) ?? "")?.[1] ?? "";
}

/** ISO tarih → "gg.aa.yyyy"; boş değer "—". */
export function fmtOfferDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/**
 * TONAJ BANTLARI — süzgeç için.
 *
 * Serbest bir "min–maks" kutusu yerine bant seçilmesinin sebebi kullanımdır:
 * kullanıcı "5 tonluk vinç tekliflerim" der, "4,8 ile 5,2 arası" demez.
 * Sınırlar firmanın gerçek teklif dağılımından çıkarıldı (1–200 t).
 */
export const CAPACITY_BANDS = [
  { key: "0-5", label: "0 – 5 t", min: 0, max: 5 },
  { key: "5-10", label: "5 – 10 t", min: 5, max: 10 },
  { key: "10-25", label: "10 – 25 t", min: 10, max: 25 },
  { key: "25-50", label: "25 – 50 t", min: 25, max: 50 },
  { key: "50+", label: "50 t ve üzeri", min: 50, max: Number.POSITIVE_INFINITY },
] as const;

export type CapacityBandKey = (typeof CAPACITY_BANDS)[number]["key"];

function bandMatches(capacities: readonly number[], keys: readonly string[]): boolean {
  if (keys.length === 0) return true;
  return CAPACITY_BANDS.filter((b) => keys.includes(b.key)).some((b) =>
    // ÜST SINIR DÂHİL DEĞİLDİR (5 t "0–5" bandındadır, "5–10" değil): sınır
    // iki bantta birden sayılsaydı toplam, satır sayısını aşardı.
    capacities.some((c) => c > b.min - (b.min === 0 ? 1 : 0) && c <= b.max)
  );
}

/**
 * TAKİP SÜZGECİ — "kimi aramam gerekiyor".
 *
 * Sayfanın bir TEKLİF TAKİBİ ekranı olmasının süzgeç karşılığıdır (kullanıcı
 * isteği, 17.08.2026). Bandın ölçtüğü şey durum değil SÜREdir: gönderilmiş ve
 * hâlâ sonuçlanmamış bir teklifin üstünden kaç gün geçti.
 */
export const TAKIP_BANDS = [
  { key: "bekleyen", label: "Bekleyen", minGun: 0 },
  { key: "2hafta", label: "2 haftadan eski", minGun: 14 },
  { key: "1ay", label: "1 aydan eski", minGun: 28 },
] as const;

export interface OfferFilterInput {
  /** ÇÖZÜLMÜŞ yıl: "tumu" ya da "2026". */
  yil: string;
  musteri: readonly string[];
  durum: readonly string[];
  /** Vinç tipi — kalemlerden herhangi biri eşleşirse satır girer. */
  vincTipi: readonly string[];
  /** Tonaj bandı anahtarları. */
  tonaj: readonly string[];
  /** Takip bandı anahtarları (bkz. `TAKIP_BANDS`). */
  takip: readonly string[];
  /**
   * BUGÜNÜN TARİHİ DIŞARIDAN GELİR. Süzgeç saf kalmalıdır: içeride `new Date()`
   * çağırmak, testi saate bağımlı ve sunucu/istemci boyamasını ayrışmaya açık
   * hâle getirirdi.
   */
  bugun: string;
  q: string;
}

export const EMPTY_OFFER_FILTER: OfferFilterInput = {
  yil: "tumu",
  musteri: [],
  durum: [],
  vincTipi: [],
  tonaj: [],
  takip: [],
  bugun: "",
  q: "",
};

export function matchesOfferFilters(row: OfferListRow, f: OfferFilterInput): boolean {
  if (f.yil !== "tumu" && offerYear(row) !== f.yil) return false;
  if (f.musteri.length > 0 && !f.musteri.includes(row.customer_name.trim())) return false;
  if (f.durum.length > 0 && !f.durum.includes(offerStatusOf(row.status))) return false;
  if (f.vincTipi.length > 0 && !row.craneTypes.some((t) => f.vincTipi.includes(t))) return false;
  if (!bandMatches(row.capacities, f.tonaj)) return false;

  if (f.takip.length > 0) {
    // Takip bandı YALNIZ sayacın göründüğü satırlarda anlamlıdır: sonuçlanmış
    // ya da hiç gönderilmemiş bir teklifte takip edilecek bir şey yoktur.
    const takipTarihi = takipBaslangici(row.status, row.issuedOn, row.issue_date);
    if (!takipGorunur(row.status, takipTarihi)) return false;
    const gun = f.bugun && takipTarihi ? gunFarki(takipTarihi, f.bugun) : 0;
    const esik = Math.min(
      ...TAKIP_BANDS.filter((b) => f.takip.includes(b.key)).map((b) => b.minGun)
    );
    if (!Number.isFinite(esik) || gun < esik) return false;
  }

  const query = f.q.trim();
  if (query) {
    // Arama teklif numarasını, konuyu, müşteriyi (hem kısaltma hem unvan) ve
    // vinç tiplerini birlikte tarar: "astor portal" iki alandan birleşerek
    // bulunur.
    const hay = trKatla(
      [
        row.offer_no,
        row.subject,
        row.customer_name,
        row.customerShort ?? "",
        row.craneTypes.join(" "),
      ].join(" ")
    );
    for (const token of trKatla(query).split(/\s+/)) {
      if (!hay.includes(token)) return false;
    }
  }
  return true;
}

// ————————————————————————————————————————————————————————— özet şeridi

export interface OfferListSummary {
  total: number;
  awaiting: number;
  delayed: number;
  won: number;
  eurAmount: number;
  eurCount: number;
}

/**
 * Liste üstündeki dört kartın TEK hesap noktası.
 *
 * İptal kayıt arşivde ve teklif adedinde kalır; parasal toplamdan çıkar. Bir
 * iptal, firmanın beklenen cirosu değildir. Kaybedilen teklif ise kullanıcı
 * yalnız iptali dışarıda istediği için mevcut toplam davranışını korur.
 */
export function offerListSummary(
  rows: readonly OfferListRow[],
  bugun: string
): OfferListSummary {
  const bekleyen = rows.filter((r) => {
    const tarih = takipBaslangici(r.status, r.issuedOn, r.issue_date);
    return takipGorunur(r.status, tarih);
  });
  const delayed = bekleyen.filter((r) => {
    const tarih = takipBaslangici(r.status, r.issuedOn, r.issue_date);
    return tarih ? gunFarki(tarih, bugun) >= 14 : false;
  });
  const won = rows.filter((r) => offerStatusOf(r.status) === "won");
  const eur = rows.filter(
    (r) =>
      offerStatusOf(r.status) !== "cancelled" &&
      r.currency === "EUR" &&
      r.latestTotal !== null
  );
  return {
    total: rows.length,
    awaiting: bekleyen.length,
    delayed: delayed.length,
    won: won.length,
    eurAmount: eur.reduce((n, r) => n + (r.latestTotal ?? 0), 0),
    eurCount: eur.length,
  };
}

// ————————————————————————————————————————————————————————— sıralama

export const OFFER_SORT_KEYS = ["tarih", "no", "musteri", "tutar", "durum"] as const;

export type OfferSortKey = (typeof OFFER_SORT_KEYS)[number];

export interface OfferSort {
  key: OfferSortKey;
  /** `true` = büyükten küçüğe / yeniden eskiye. */
  desc: boolean;
}

export const DEFAULT_OFFER_SORT: OfferSort = { key: "tarih", desc: true };

function kiyasla(a: OfferListRow, b: OfferListRow, key: OfferSortKey): number {
  switch (key) {
    case "tarih":
      // SIRA GÖNDERİM TARİHİNDENDİR (kullanıcı isteği: *"listede en son
      // yayınlanan teklif en üstte olsun"*). Hiç yayımlanmamış taslak kendi
      // açılış gününden sayılır — listeden düşmemesi için; bu bilinçli bir
      // seçimdir, bugün açılmış bir taslak dün gönderilmiş bir teklifin
      // üstünde durur ve ikisi de kullanıcının bugün ilgilendiği şeydir.
      return effectiveOfferDate(a).localeCompare(effectiveOfferDate(b));
    case "no":
      return a.offer_no.localeCompare(b.offer_no, "tr");
    case "musteri":
      // GÖRÜNEN ada göre sıralanır: sütun kısaltmayı gösterirken tam unvana
      // göre sıralamak listeyi rastgele dizilmiş gibi gösterirdi.
      return (a.customerShort || a.customer_name).localeCompare(
        b.customerShort || b.customer_name,
        "tr"
      );
    case "tutar":
      // TUTARSIZ SATIR SONA DÜŞER, sıfır sayılmaz: fiyatı girilmemiş bir
      // teklif "0 €"lik bir teklif değildir.
      return (a.latestTotal ?? -Infinity) - (b.latestTotal ?? -Infinity);
    case "durum":
      return offerStatusOf(a.status).localeCompare(offerStatusOf(b.status));
  }
}

/**
 * SIRALAMA JENERİKTİR: çağıran kendi satır tipini (ek alanlarıyla) geri alır.
 *
 * `OfferListRow[]` döndürülseydi ekran satırın yalnız süzgeç çekirdeğini
 * görürdü ve tablo, kimliği ya da revizyon numarası gibi alanları ikinci bir
 * eşleştirmeyle bulmak zorunda kalırdı.
 */
export function sortOffers<T extends OfferListRow>(rows: readonly T[], sort: OfferSort): T[] {
  const out = [...rows];
  out.sort((a, b) => {
    const n = kiyasla(a, b, sort.key);
    // EŞİTLİK TEKLİF NUMARASIYLA ÇÖZÜLÜR: aynı gün açılmış iki teklif her
    // yenilemede yer değiştirmemelidir (kararsız sıralama, listeyi okuyan
    // gözün en çok yorulduğu şeydir).
    const t = n !== 0 ? n : a.offer_no.localeCompare(b.offer_no, "tr");
    return sort.desc ? -t : t;
  });
  return out;
}

/** Süzgeç kutularının seçeneklerini SATIRLARDAN türetir — elle liste yazılmaz. */
export function offerFacets(rows: readonly OfferListRow[]) {
  const yillar = new Set<string>();
  const musteriler = new Set<string>();
  const tipler = new Set<string>();
  for (const row of rows) {
    const y = offerYear(row);
    if (y) yillar.add(y);
    if (row.customer_name.trim()) musteriler.add(row.customer_name.trim());
    for (const t of row.craneTypes) if (t.trim()) tipler.add(t.trim());
  }
  return {
    yillar: [...yillar].sort().reverse(),
    musteriler: [...musteriler].sort((a, b) => a.localeCompare(b, "tr")),
    vincTipleri: [...tipler].sort((a, b) => a.localeCompare(b, "tr")),
  };
}

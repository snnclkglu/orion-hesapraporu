// MALİYET TOPLAMLARI — tek yerde.
//
// Teklifin `pricing.ts`i ile aynı ruhtadır: toplam ELLE GİRİLMEZ, satırlardan
// türer. Fark şu ki burada iki katman vardır — doğrudan maliyet kalem kalem
// toplanır, oranlı gruplar ise o toplamın üstüne biner.
//
// ORANIN TABANI PROJE MALİYETİDİR (kullanıcı kararı, 17.08.2026).
// Alternatifi — oranların KENDİLERİ DAHİL toplamın yüzdesi olması — açıkça
// soruldu ve reddedildi. Fark küçük değildir: ASTOR örneğinde 194.258 €'luk
// proje maliyeti ilk yöntemle 231.167 €, ikincisiyle 239.825 € toplam verir.
// Bu yüzden taban bir varsayım olarak koda gömülmedi, kullanıcıya soruldu.
//
// EKSİK VERİ SIFIR SAYILMAZ (değişmez md. 4). Fiyatı girilmemiş bir satır
// toplamı düşürmez, toplamdan DÜŞER; hiç tutarı olmayan bir grup `null`
// döner ve ekranda "—" görünür. Sıfır yazmak, maliyeti henüz girilmemiş bir
// vinci bedava göstermenin en kısa yoluydu.

import { paramOf } from "./params";
import { costGroupLines } from "./types";
import { FABRICATION_GROUP_KEY } from "./registry";
import type { CostGroup, CostItem, CostLine, CostPayload, CostRateGroup } from "./types";

/** Satırın tutarı; miktar ya da birim fiyat eksikse `null` (sıfır DEĞİL). */
export function costLineAmount(line: CostLine): number | null {
  if (line.hidden) return null;
  if (line.qty === null || line.unitPrice === null) return null;
  const n = line.qty * line.unitPrice;
  return Number.isFinite(n) ? n : null;
}

function topla(lines: readonly CostLine[]): number | null {
  let toplam = 0;
  let varMi = false;
  for (const line of lines) {
    const tutar = costLineAmount(line);
    if (tutar === null) continue;
    toplam += tutar;
    varMi = true;
  }
  return varMi ? toplam : null;
}

/**
 * Grubun toplamı — KİPİNE GÖRE.
 *
 * Götürü kipteki grup yalnız götürü satırını sayar, kalem kipindeki yalnız
 * kalem satırlarını (`costGroupLines`). İkisini toplamak, elektriği hem kalem
 * kalem hem götürü olarak faturalamak demekti (oranlı grubun kip kuralının
 * aynısı, MALIYET-5).
 */
export function costGroupTotal(group: CostGroup | undefined): number | null {
  return group ? topla(costGroupLines(group)) : null;
}

/** Kalemin BİRİM maliyeti — bir adet ürünün doğrudan maliyeti. */
export function costItemUnitTotal(item: CostItem): number | null {
  let toplam = 0;
  let varMi = false;
  for (const group of item.groups) {
    const t = costGroupTotal(group);
    if (t === null) continue;
    toplam += t;
    varMi = true;
  }
  return varMi ? toplam : null;
}

/** Kalemin PAKET maliyeti — birim × adet (adet yoksa birim). */
export function costItemPackageTotal(item: CostItem): number | null {
  const birim = costItemUnitTotal(item);
  if (birim === null) return null;
  const adet = item.qty === null || !Number.isFinite(item.qty) ? 1 : item.qty;
  return birim * adet;
}

// ————————————————————————————————————————————————————— oranlı grup

/**
 * Oranlı grubun tutarı.
 *
 * İKİ KAYNAK ASLA TOPLANMAZ (Ücret Planı'nın kuralı): `oran` kipinde satırlar
 * hiç okunmaz, `kalem` kipinde yüzde hiç okunmaz. Kip bir görünüm tercihi
 * değil, "bu grubun tutarı NEREDEN geliyor" sorusunun tek cevabıdır.
 */
export function costRateAmount(rate: CostRateGroup, base: number | null): number | null {
  if (rate.mode === "kalem") return topla(rate.lines);
  if (base === null || rate.percent === null || !Number.isFinite(rate.percent)) return null;
  return (base * rate.percent) / 100;
}

// ————————————————————————————————————————————————————— toplamlar

export interface CostItemTotal {
  id: string;
  offerItemId: string | null;
  title: string;
  qty: number | null;
  /** Bir adedin doğrudan maliyeti. */
  unit: number | null;
  /** Birim × adet. */
  package: number | null;
  /** Toplam vinç ağırlığı [kg] — €/kg için. */
  weightKg: number | null;
}

export interface CostRateTotal {
  key: string;
  title: string;
  mode: CostRateGroup["mode"];
  percent: number | null;
  amount: number | null;
}

export interface CostTotals {
  items: CostItemTotal[];
  /** Proje geneli grubunun toplamı. */
  general: number | null;
  /**
   * DOĞRUDAN MALİYET = Σ paket maliyet + proje geneli. Oranların TABANI.
   *
   * İMALAT DA BUNUN İÇİNDEDİR ve bu bilinçlidir. Kullanıcı isteği (md. 4)
   * imalatı ayrı bir BAŞLIK yaptı; bir satırı bir başlıktan ötekine taşımak
   * TOPLAMI DEĞİŞTİRMEMELİDİR. İmalat tabandan çıkarılsaydı ASTOR örneğinde
   * oranlı grupların tabanı 194.258 → 124.133 €'ya iner, toplam maliyet
   * 231.167 → 217.876 €'ya düşerdi: yalnız ekran düzenini değiştiren bir
   * istek, her teklifin kâr marjını 13.291 € kaydırırdı (MALIYET-5'in
   * "8.658 €'luk fark bir varsayıma bırakılamaz" kararının aynı ailesi).
   */
  direct: number | null;
  /** İMALAT MALİYETİ — beşinci ana başlık; `direct`in İÇİNDEDİR. */
  fabrication: number | null;
  /** PROJE MALİYETİ — ekranda basılan; `direct` eksi imalat. */
  project: number | null;
  rates: CostRateTotal[];
  rateTotal: number | null;
  /** TOPLAM MALİYET = proje maliyeti + oranlı gruplar. */
  total: number | null;
}

/**
 * Belgenin bütün toplamları — ekran, PDF ve teklif sütunu bunu okur.
 *
 * `weights` kalem kimliği → toplam vinç ağırlığı eşlemesidir ve DIŞARIDAN
 * verilir: model `lib/offers/cost/model.ts`te çalışır ve bu modül saf
 * aritmetik kalır. Modeli buraya çağırmak, toplam almak isteyen her yerin
 * ağırlık modelini de koşturması demekti.
 */
export function costTotals(
  payload: CostPayload,
  weights: Record<string, number | null> = {}
): CostTotals {
  const items: CostItemTotal[] = payload.items.map((item) => ({
    id: item.id,
    offerItemId: item.offerItemId,
    title: item.title,
    qty: item.qty,
    unit: costItemUnitTotal(item),
    package: costItemPackageTotal(item),
    weightKg: weights[item.id] ?? null,
  }));

  const general = costGroupTotal(payload.general);
  const paketler = items.map((i) => i.package).filter((n): n is number => n !== null);
  const direct =
    paketler.length === 0 && general === null
      ? null
      : paketler.reduce((t, n) => t + n, 0) + (general ?? 0);

  const rates: CostRateTotal[] = payload.rates.map((r) => ({
    key: r.key,
    title: r.title,
    mode: r.mode,
    percent: r.percent,
    amount: costRateAmount(r, direct),
  }));
  const oranlar = rates.map((r) => r.amount).filter((n): n is number => n !== null);
  const rateTotal = oranlar.length ? oranlar.reduce((t, n) => t + n, 0) : null;

  const total = direct === null ? null : direct + (rateTotal ?? 0);

  // İMALAT ayrı bir başlık olarak GÖSTERİLİR ama tabandan düşülmez (yukarıdaki
  // gerekçe). Kalem adedi çarpanı burada da geçerlidir: paket maliyet birim ×
  // adet ise imalat payı da öyledir.
  const imalatlar = payload.items
    .map((item) => {
      const grup = item.groups.find((g) => g.key === FABRICATION_GROUP_KEY);
      const birim = costGroupTotal(grup);
      if (birim === null) return null;
      const adet = item.qty === null || !Number.isFinite(item.qty) ? 1 : item.qty;
      return birim * adet;
    })
    .filter((n): n is number => n !== null);
  const fabrication = imalatlar.length ? imalatlar.reduce((t, n) => t + n, 0) : null;
  const project =
    direct === null ? null : direct - (fabrication ?? 0);

  return { items, general, direct, fabrication, project, rates, rateTotal, total };
}

/**
 * Toplamları payload'a YAZAR — kaydetme yolunun son adımı.
 *
 * Teklifteki `withTotal`in ikizidir: veritabanındaki üretilmiş sütunlar
 * payload'ı okur ve teklif paneli maliyet belgesini açmadan kâr marjını
 * gösterir. Yazılmasaydı liste ekranı her satır için modeli koşturmak zorunda
 * kalırdı — ve iki farklı yerde koşan bir model, iki farklı sayı üretmenin en
 * kısa yoludur.
 */
export function withCostTotals(
  payload: CostPayload,
  weights: Record<string, number | null> = {}
): CostPayload {
  const t = costTotals(payload, weights);
  if (t.direct === payload.direct && t.total === payload.total) return payload;
  return { ...payload, direct: t.direct, total: t.total };
}

// ————————————————————————————————————————————————————— kırılım

export interface CostBreakdownRow {
  key: string;
  title: string;
  amount: number;
  /** Proje maliyetine oranı (0–1). */
  share: number | null;
}

/**
 * ANA KALEM KIRILIMI — hangi grup toplamın yüzde kaçı.
 *
 * Devralınan çalışma kitabının "MALİYET KIRILIMI" sayfasının karşılığıdır ve
 * aynı soruyu sorar: paranın büyük kısmı nereye gidiyor. Gruplar bütün
 * kalemler boyunca TOPLANIR — üç vinçlik bir teklifte "elektrik" tek bir
 * satırdır, çünkü soru vinç bazında değil iş bazındadır. Kalem bazındaki
 * dağılımı `costTotals().items` verir.
 */
export function costBreakdown(payload: CostPayload, totals: CostTotals): CostBreakdownRow[] {
  const toplamlar = new Map<string, { title: string; amount: number }>();

  for (const item of payload.items) {
    const adet = item.qty === null || !Number.isFinite(item.qty) ? 1 : item.qty;
    for (const group of item.groups) {
      const t = costGroupTotal(group);
      if (t === null) continue;
      const onceki = toplamlar.get(group.key);
      toplamlar.set(group.key, {
        title: onceki?.title ?? group.title,
        amount: (onceki?.amount ?? 0) + t * adet,
      });
    }
  }
  if (totals.general !== null) {
    toplamlar.set(payload.general.key, { title: payload.general.title, amount: totals.general });
  }

  const taban = totals.direct;
  return [...toplamlar.entries()].map(([key, v]) => ({
    key,
    title: v.title,
    amount: v.amount,
    share: taban === null || taban === 0 ? null : v.amount / taban,
  }));
}

// ————————————————————————————————————————————————————— dağıtım

/**
 * TEKLİF KALEMİNE DÜŞEN YÜKLÜ MALİYET.
 *
 * Teklifin fiyat tablosundaki "Maliyet" sütunu bunu gösterir. Doğrudan
 * maliyet o kalemin kendisidir; proje geneli ve oranlı gruplar ise DOĞRUDAN
 * MALİYET PAYINA göre dağıtılır. Dağıtım bir TAHMİNDİR ve ekranda öyle
 * söylenir — ama dağıtmamak daha kötüdür: üç vinçlik bir teklifte her vincin
 * kârı, sabit giderleri hiç taşımadan hesaplanmış görünürdü.
 *
 * Kalemi olmayan (serbest) fiyat satırına maliyet DÜŞMEZ ve sıfır da
 * yazılmaz; ekranda "—" görünür.
 */
export function loadedCostByOfferItem(totals: CostTotals): Record<string, number> {
  const paketToplam = totals.items.reduce((t, i) => t + (i.package ?? 0), 0);
  const yuk = (totals.general ?? 0) + (totals.rateTotal ?? 0);
  const out: Record<string, number> = {};
  for (const item of totals.items) {
    if (!item.offerItemId || item.package === null) continue;
    const pay = paketToplam > 0 ? item.package / paketToplam : 0;
    out[item.offerItemId] = item.package + yuk * pay;
  }
  return out;
}

// —————————————————————————————————————————————————————————— kâr

export interface CostMargin {
  /** Teklifin müşteriye giden tutarı (iskonto uygulanmış). */
  price: number | null;
  /** Toplam maliyet. */
  cost: number | null;
  profit: number | null;
  /** Kâr / FİYAT — satış üzerinden marj. */
  marginPercent: number | null;
  /** Kâr / MALİYET — maliyet üzerinden kârlılık. */
  markupPercent: number | null;
}

/**
 * KÂR — iki oran birden verilir ve bu bilinçlidir.
 *
 * "%25 kâr" cümlesi iki farklı sayı anlatabilir: satışın %25'i mi, maliyetin
 * %25'i mi. 194.258 € maliyet ve 259.011 € fiyatta biri %25, öteki %33'tür.
 * Ekranda ikisini de göstermek, hangisinin konuşulduğunu bir daha sordurmaz.
 */
export function costMargin(price: number | null, cost: number | null): CostMargin {
  if (price === null || cost === null) {
    return { price, cost, profit: null, marginPercent: null, markupPercent: null };
  }
  const profit = price - cost;
  return {
    price,
    cost,
    profit,
    marginPercent: price === 0 ? null : (profit / price) * 100,
    markupPercent: cost === 0 ? null : (profit / cost) * 100,
  };
}

/** Birim maliyetin kilo başına düşen kısmı — devralınan çalışmanın "€/kg"si. */
export function costPerKg(amount: number | null, weightKg: number | null): number | null {
  if (amount === null || weightKg === null || weightKg <= 0) return null;
  return amount / weightKg;
}

/** Fire oranı gibi katsayıları ekranda göstermek için — tek okuma noktası. */
export function costParam(payload: CostPayload, key: string): number {
  return paramOf(payload.params, key);
}

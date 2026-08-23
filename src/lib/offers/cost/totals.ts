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

import { effectiveTotal, totalledLines } from "../pricing";
import type { OfferPayload } from "../types";
import { paramOf } from "./params";
import { costGroupLines, manualLineCost } from "./types";
import { FABRICATION_GROUP_KEY } from "./registry";
import type {
  CostGroup,
  CostItem,
  CostLine,
  CostPayload,
  CostRateGroup,
  ManualLineCostSource,
} from "./types";

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
  return toplaGruplar(item.groups);
}

/**
 * KALEM ADEDİ — girilmemişse BİR.
 *
 * Bir varsayım değil, kaydın kendisidir: teklif kalemi TEK bir ürünü tarif
 * eder ve adet ancak insan yazarsa birden büyüktür. Kural üç yerde (paket
 * maliyet · imalat payı · kırılım) elle tekrarlanıyordu; dördüncüsü özet
 * olacaktı ve bir yerde unutulan çarpan iki vinçlik bir teklifte toplamı
 * yarı gösterirdi.
 */
function kalemAdedi(item: { qty: number | null }): number {
  return item.qty === null || !Number.isFinite(item.qty) ? 1 : item.qty;
}

/** Kalemin PAKET maliyeti — birim × adet (adet yoksa birim). */
export function costItemPackageTotal(item: CostItem): number | null {
  const birim = costItemUnitTotal(item);
  if (birim === null) return null;
  return birim * kalemAdedi(item);
}

/**
 * KALEMİN İKİ YARISI — imalat ve imalat dışı, birim ve paket.
 *
 * Kullanıcı isteği (22.08.2026, md. 10): *"Bir vinci maliyetlendirirken ana
 * başlıkta örneğin İmalat Maliyeti kısmında diğer kalemin de maliyetini
 * toplamasın karışıyor. Her vinci tek tek o sayfada inceleyeceğiz."*
 *
 * ÇEKİRDEKTE DURUR, EKRANDA DEĞİL. Bölme `costTotals`taki `direct − fabrication`
 * tanımının kalem düzeyindeki ikizidir ve ekranda elle kurulmuştu
 * (`lines-view`in `kalemProjeBirimi`si). O kopya yalnız ikinci bir tanım
 * değildi, YANLIŞTI da: `null`ları atlayıp sıfır tabanlı bir `reduce`a giriyor,
 * yani hiç maliyeti girilmemiş bir vinci `null` yerine **0 €** gösteriyordu —
 * `costItemUnitTotal`ın "hiç yoksa null" kuralının tam tersi (değişmez md. 4).
 *
 * `costTotals` da imalat toplamını BUNDAN üretir: iki yerde iki toplama, iki
 * vinçli bir teklifte sessizce ayrışmanın en kısa yoluydu (değişmez md. 8).
 */
export interface CostItemSplit {
  /** BİR ADET: İMALAT MALİYETİ grubu. */
  fabricationUnit: number | null;
  /** BİR ADET: imalat DIŞI bütün gruplar. Proje geneli BURADA DEĞİLDİR. */
  projectUnit: number | null;
  /** BİR ADET: hepsi — `costItemUnitTotal` ile aynı sayı. */
  unit: number | null;
  /** Adet — girilmemişse BİR (`kalemAdedi`). */
  qty: number;
  fabricationPackage: number | null;
  projectPackage: number | null;
  package: number | null;
}

export function costItemSplit(item: CostItem): CostItemSplit {
  const adet = kalemAdedi(item);
  const imalat = costGroupTotal(item.groups.find((g) => g.key === FABRICATION_GROUP_KEY));
  const proje = toplaGruplar(item.groups.filter((g) => g.key !== FABRICATION_GROUP_KEY));
  const birim =
    imalat === null && proje === null ? null : (imalat ?? 0) + (proje ?? 0);
  const paket = (n: number | null) => (n === null ? null : n * adet);
  return {
    fabricationUnit: imalat,
    projectUnit: proje,
    unit: birim,
    qty: adet,
    fabricationPackage: paket(imalat),
    projectPackage: paket(proje),
    package: paket(birim),
  };
}

/**
 * Grup toplamlarının toplamı — HİÇ TUTARI YOKSA `null`.
 *
 * `costItemUnitTotal`ın gövdesinin ta kendisidir ve ayrı bir fonksiyon olması
 * bilinçlidir: aynı `null` anlamı hem kalemin tamamında hem yarılarında
 * geçerli olmalıdır. `(a ?? 0) + (b ?? 0)` yazımı hiç maliyeti girilmemiş bir
 * vinci bedava gösterirdi.
 */
function toplaGruplar(groups: readonly CostGroup[]): number | null {
  let toplam = 0;
  let varMi = false;
  for (const group of groups) {
    const t = costGroupTotal(group);
    if (t === null) continue;
    toplam += t;
    varMi = true;
  }
  return varMi ? toplam : null;
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
  // gerekçe). Kalem adedi çarpanı `costItemSplit`in içindedir; buradaki toplam
  // ekrandaki bölüm başlıklarıyla AYNI fonksiyondan geçer, yoksa iki vinçli bir
  // teklifte belge ile ekran sessizce ayrışırdı.
  const imalatlar = payload.items
    .map((item) => costItemSplit(item).fabricationPackage)
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
    const adet = kalemAdedi(item);
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
 * TEKLİF KALEMİNE DÜŞEN GENEL GİDER DAHİL MALİYET (`LOADED_COST_LABEL`).
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

/**
 * SERBEST FİYAT SATIRLARININ ÖZET SAYFASINDAN GİRİLEN MALİYETİ — satır kimliği
 * → tutar.
 *
 * Kullanıcı isteği (23.08.2026, md. 1): *"Eğer özet sayfasından girersem
 * öncelik o olsun. Fiyat kısmına da oradan gelsin."* Teklif editörünün maliyet
 * sütunu bunu okur; bulamadığı satırda eskisi gibi kendi `manualCost` kutusuna
 * düşer.
 *
 * `loadedCostByOfferItem`İN KARDEŞİDİR ve aynı yönde çalışır: maliyet belgesi
 * teklif ekranına bir sayı verir, teklif belgesine DEĞİL (MALIYET-1). Fiyat
 * satırının kendi kutusu yerinde kalır — kullanıcının kendi cümlesi: *"o
 * kalsın"*.
 *
 * TEKLİF SÜZGECİ BURADA YOKTUR ve olmamalıdır: sözlük yalnız YAZILANI taşır,
 * hangi satırın toplama girdiğine teklif tarafı karar verir. Süzmek, maliyet
 * belgesinin teklifin gizleme kararlarını ikinci kez yorumlaması olurdu.
 */
export function manualCostByPriceLine(payload: CostPayload): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, c] of Object.entries(payload.manualLineCosts ?? {})) {
    const { amount, source } = manualLineCost(c, null);
    if (amount === null || source === "price") continue;
    out[id] = amount;
  }
  return out;
}

/**
 * BEŞ ANA BAŞLIĞIN KALEM BAZINDA DAĞILIMI.
 *
 * Kullanıcı isteği (22.08.2026, md. 7): *"VİNÇLER için de özet bilgileri
 * eksik her vincin. BEŞ ANA BAŞLIK bilgisini bir satırda görmek istiyorum."*
 *
 * Beş başlık: **İMALAT** · **PROJE** · **SABİT** · **SARF** · **FİNANSMAN**.
 * İlk ikisi kalemin KENDİ verisidir; oranlı üçü ve proje geneli ise belgeye
 * aittir ve kaleme DAĞITILIR.
 *
 * DAĞITIM TABANI `loadedCostByOfferItem` İLE AYNIDIR ve olmak zorundadır:
 * teklifin fiyat tablosundaki "Maliyet" sütunu (MALIYET-11) onu okur, özetin
 * TOPLAM sütunu bunu okur. İki taban ayrışsaydı aynı vinç iki ekranda iki
 * farklı maliyetle görünürdü — MALIYET-24'ün anlattığı ayrışmanın birebir
 * tekrarı. Bir test ikisini karşılaştırarak kilitler.
 *
 * `loadedCostByOfferItem` OLDUĞU GİBİ KULLANILAMADI, üç sebeple:
 *
 * 1. O fonksiyon `offerItemId` olmayan SERBEST maliyet kalemini atlar
 *    (teklifin fiyat tablosunda karşılığı yoktur). Özette o kalem de bir
 *    satırdır ve payını taşımalıdır, yoksa sütun toplamı belge toplamını
 *    tutturamaz.
 * 2. Yükü tek sayıya indirir (`general + rateTotal`); beş sütun için proje
 *    geneli ile üç oranın AYRI AYRI dağıtılması gerekir.
 * 3. Anahtarı teklif kalemidir; özet satırının kimliği maliyet kalemidir.
 *
 * DAĞITILAMAYAN YÜK SESSİZ KALMAZ. Fiyatı hiç girilmemiş bir kalemin payı
 * sıfırdır; bütün kalemler boşsa taban da sıfırdır ve proje geneli ile
 * oranların TAMAMI hiçbir satıra düşmez. Sıfır yazmak ya da sessizce yutmak
 * yerine `CostOverview.unallocated` onu adıyla söyler (değişmez md. 4).
 */
export interface CostItemHeadings {
  /** Kalemin KENDİ imalat grubu × adet — dağıtım değil, kesin sayı. */
  fabrication: number | null;
  /** Kalemin imalat dışı grupları × adet + proje genelinden düşen pay. */
  project: number | null;
  /** Oranlı grupların kaleme düşen payları — defterdeki sırayla. */
  rates: { key: string; title: string; amount: number | null }[];
  /** Beşinin toplamı — `LOADED_COST_LABEL`in kalem bazındaki karşılığı. */
  loaded: number | null;
}

export interface CostHeadingsResult {
  /** Maliyet kalemi kimliği → beş başlık. */
  byItem: Record<string, CostItemHeadings>;
  /**
   * HİÇBİR KALEME DÜŞEMEYEN yük — proje geneli + oranlardan artan.
   *
   * `null` değil `0` olması normaldir (her şey dağıtıldı); sıfırdan büyük
   * olması bir UYARIDIR ve ekran onu satır olarak yazar.
   */
  unallocated: number;
}

export function costHeadingsByItem(
  payload: CostPayload,
  totals: CostTotals
): CostHeadingsResult {
  const paketToplam = totals.items.reduce((t, i) => t + (i.package ?? 0), 0);
  const general = totals.general ?? 0;
  const byItem: Record<string, CostItemHeadings> = {};
  let dagitilan = 0;

  for (const item of payload.items) {
    const bolme = costItemSplit(item);
    const pay = paketToplam > 0 && bolme.package !== null ? bolme.package / paketToplam : 0;
    const genelPay = general * pay;
    const rates = totals.rates.map((r) => ({
      key: r.key,
      title: r.title,
      amount: r.amount === null ? null : r.amount * pay,
    }));
    // PROJE GENELİ PAYI PROJE BAŞLIĞINA GİRER: kullanıcının beş başlığı
    // "Proje Maliyeti"ni tek bir sütun sayar ve proje geneli de bir proje
    // maliyetidir — altıncı bir sütun açmak, kullanıcının saydığı beşi bozardı.
    const project =
      bolme.projectPackage === null && genelPay === 0 ? null : (bolme.projectPackage ?? 0) + genelPay;
    const oranToplam = rates.reduce((t, r) => t + (r.amount ?? 0), 0);
    const loaded =
      bolme.package === null && project === null && oranToplam === 0
        ? null
        : (bolme.fabricationPackage ?? 0) + (project ?? 0) + oranToplam;
    byItem[item.id] = { fabrication: bolme.fabricationPackage, project, rates, loaded };
    dagitilan += genelPay + oranToplam;
  }

  const yuk = general + (totals.rateTotal ?? 0);
  // Kayan noktalı artıkları uyarıya çevirmemek için bir kuruşun altı sıfır sayılır.
  const artan = yuk - dagitilan;
  return { byItem, unallocated: Math.abs(artan) < 0.005 ? 0 : artan };
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

// ————————————————————————————————————————————————————————— özet

/**
 * BOŞ DEĞERİ SIFIR SAYMAYAN toplam — hiç sayı yoksa `null` (değişmez md. 4).
 *
 * `topla`nın kardeşidir ama satır değil SAYI toplar: ağırlık sütunlarının ve
 * elle girilmiş maliyetlerin toplamı da "hiç veri yok" ile "sıfır" arasındaki
 * farkı korumak zorundadır. Ağırlığı hesaplanmamış bir vinç 0 kg değildir.
 */
function toplaSayilar(list: readonly (number | null)[]): number | null {
  const dolu = list.filter((n): n is number => n !== null);
  return dolu.length ? dolu.reduce((t, n) => t + n, 0) : null;
}

/** Özetin bir satırı — maliyetin bir kalemi (bir vinç). */
export interface CostOverviewItem {
  id: string;
  offerItemId: string | null;
  title: string;
  qty: number | null;
  /** BEŞ ANA BAŞLIK — kalem bazında (md. 7). */
  headings: CostItemHeadings;
  /** BİR adedin çelik ağırlığı [kg] — `w.steel`. */
  steelKg: number | null;
  /** BİR adedin toplam vinç ağırlığı [kg] — `w.total`. */
  weightKg: number | null;
  /** Çelik ağırlığı × adet. */
  steelPackageKg: number | null;
  /** Toplam vinç ağırlığı × adet. */
  weightPackageKg: number | null;
  /** Bir adedin doğrudan maliyeti. */
  unit: number | null;
  /** Birim × adet. */
  package: number | null;
}

/** Teklifin SERBEST fiyat satırına elle yazılmış maliyet. */
export interface CostOverviewManualLine {
  id: string;
  description: string;
  /**
   * SATIRIN GEÇERLİ MALİYETİ — üç kaynağın sırasından çıkar (`manualLineCost`):
   * özet kırılımı → özetin tek kutusu → teklifin fiyat satırındaki kutu.
   *
   * `null` OLABİLİR ve bu yeni bir durumdur (23.08.2026, md. 1): liste artık
   * maliyeti HİÇ girilmemiş serbest satırları da taşır, çünkü kullanıcı onları
   * özet tablosunda görmeden oraya bir sayı yazamaz. Sıfır DEĞİL "—" görünür.
   */
  amount: number | null;
  /** Maliyetin nereden geldiği — ekran ve teklif editörü bunu YAZIYLA söyler. */
  source: ManualLineCostSource;
  /**
   * BEŞ BAŞLIK — vinçte HESAPLANIR, burada YAZILIR (23.08.2026, md. 1).
   *
   * Uydurulmaz: dokunulmamış hücre `null` kalır ve "—" görünür (değişmez
   * md. 4). `loaded` satırın geçerli maliyetidir (`amount` ile aynı sayı) —
   * tablo vinç satırıyla serbest satırı AYNI şekilde çizebilsin diye.
   */
  headings: CostItemHeadings;
  /**
   * ELLE GİRİLEN AĞIRLIKLAR (md. 7) — maliyet payload'ında yaşar.
   */
  steelKg: number | null;
  totalKg: number | null;
}

/**
 * MALİYET ÖZETİ — ekranın ve Excel'in okuduğu TEK yapı.
 *
 * `margin` teklif tutarını, maliyeti, kârı ve iki oranı birlikte taşır
 * (`costMargin`): fiyat ve maliyet ayrıca ROOT'ta tekrarlansaydı aynı sayı iki
 * yerde yaşar ve biri güncellenmeyi unuturdu.
 */
export interface CostOverview {
  items: CostOverviewItem[];
  /**
   * MALİYETİ HİÇ AÇILMAMIŞ teklif kalemleri.
   *
   * Teklifte duran ama maliyet çalışmasından çıkarılmış (ya da hiç
   * eşleşmemiş) bir vinç, fiyat toplamına GİRER ve maliyet toplamına
   * GİRMEZ — kâr olduğundan yüksek görünür. Özet bunu saymaz ama SÖYLER;
   * sessizce atlamak, bir vinci bedava üretmiş gibi göstermenin en kısa
   * yoluydu (değişmez md. 4).
   */
  uncostedItems: { id: string; title: string }[];
  /** Kaleme bağlı OLMAYAN fiyat satırlarının elle maliyetleri. */
  manualLines: CostOverviewManualLine[];
  manualTotal: number | null;
  /** Yalnız kalem paketlerinin toplamı — proje geneli ve oranlar HARİÇ. */
  packageTotal: number | null;
  /** Maliyet belgesinin kendi toplamı (`CostTotals.total`). */
  documentTotal: number | null;
  /** Belge toplamı + elle maliyetler, teklif tutarı, kâr ve iki oran. */
  margin: CostMargin;
  /** Bütün kalemlerin çelik ağırlığı toplamı (adetle çarpılmış) [kg]. */
  steelKg: number | null;
  /** Bütün kalemlerin toplam vinç ağırlığı toplamı (adetle çarpılmış) [kg]. */
  weightKg: number | null;
  /**
   * VİNÇLER + SERBEST SATIRLAR — tek listenin dip toplamı.
   *
   * `steelKg`/`weightKg`TEN AYRI DURUR ve bu bilinçlidir: o ikisi VİNÇLERİN
   * ağırlığıdır ve `€/kg` metriği ile Excel'in "KALEM TOPLAMI" satırı onları
   * okur. Nakliyenin ya da bir traversin kilosunu oraya katmak, €/kg'yi
   * anlamsız bir sayıya çevirirdi (bir vincin kilo maliyeti, nakliyenin
   * kilosuyla bölünmüş olurdu).
   */
  steelKgAll: number | null;
  weightKgAll: number | null;
  /** Kaleme düşemeyen proje geneli + oran yükü (`costHeadingsByItem`). */
  unallocated: number;
}

/**
 * TEKLİFİN VE MALİYETİN TEK TABLODA ÖZETİ.
 *
 * Kullanıcı isteği (19.08.2026): teklifin bütün kalemleri, fiyat satırlarına
 * elle yazılan maliyetler, çelik ve toplam ağırlıklar, birim/paket maliyet ve
 * kâr TEK bir yerde görünsün. Fonksiyon SAFTIR ve iki belgeyi birden okur —
 * maliyet toplamlarını ve teklif payload'ını; ekran ve Excel yalnız çizer.
 *
 * ELLE MALİYET YALNIZ SERBEST SATIRDAN ALINIR (MALIYET-11): kaleme bağlı bir
 * fiyat satırının maliyeti maliyet belgesinde ZATEN vardır ve ikinci kez
 * eklemek onu çift sayardı. Süzgeç teklifin kendi toplam süzgecidir
 * (`totalledLines`) — toplama girmeyen bir satırın maliyeti de girmemelidir,
 * yoksa kâr olduğundan düşük görünürdü.
 *
 * KOPYA TOPLAM YAZILMAZ: bu birleştirme bugüne kadar teklif editörünün içinde
 * satır arasında yapılıyordu (`toplamMaliyet`). İki yerde iki toplam dolaşırsa
 * MALIYET-24'ün anlattığı ayrışma birebir tekrarlanır — ekran bir sayı, belge
 * başka bir sayı gösterir.
 *
 * AĞIRLIK ADETLE ÇARPILIR: `CostTotals.items[].weightKg` BİR adedin
 * ağırlığıdır; çarpmayı unutmak iki vinçlik bir teklifte toplam ağırlığı yarı
 * gösterirdi (`costItemPackageTotal` ile aynı kural).
 */
export function costOverview(
  totals: CostTotals,
  offer: OfferPayload,
  steelWeights: Record<string, number | null> = {},
  /**
   * MALİYET BELGESİ — beş başlık dağıtımı ve elle girilen ağırlıklar ondan
   * okunur (md. 7).
   *
   * İSTEĞE BAĞLIDIR ve bu bilinçlidir: `totals` zaten payload'dan türemiştir,
   * yani belgeyi ikinci kez vermek bir ÇİFT KAYNAK riskidir. Verilmediğinde
   * özet eskisi gibi çalışır — yalnız beş başlık ve elle ağırlıklar boş kalır.
   * Böylece bu imzayı okuyan üç çağrı yeri (ekran, Excel, testler) tek tek
   * geçirilebildi ve hiçbiri sessizce yarım kalmadı.
   */
  payload?: CostPayload
): CostOverview {
  const headings = payload ? costHeadingsByItem(payload, totals) : null;
  const bosBaslik: CostItemHeadings = {
    fabrication: null,
    project: null,
    rates: totals.rates.map((r) => ({ key: r.key, title: r.title, amount: null })),
    loaded: null,
  };

  const items: CostOverviewItem[] = totals.items.map((i) => {
    const adet = kalemAdedi(i);
    const steelKg = steelWeights[i.id] ?? null;
    return {
      id: i.id,
      offerItemId: i.offerItemId,
      title: i.title,
      qty: i.qty,
      headings: headings?.byItem[i.id] ?? bosBaslik,
      steelKg,
      weightKg: i.weightKg,
      steelPackageKg: steelKg === null ? null : steelKg * adet,
      weightPackageKg: i.weightKg === null ? null : i.weightKg * adet,
      unit: i.unit,
      package: i.package,
    };
  });

  const agirliklar = payload?.manualLineWeights ?? {};
  const serbestMaliyet = payload?.manualLineCosts ?? {};
  // MALİYETİ GİRİLMEMİŞ SERBEST SATIR DA LİSTEDEDİR (23.08.2026, md. 1).
  //
  // Süzgeç bir zamanlar `manualCost === null` olanı atıyordu ve bu, kullanıcının
  // istediği akışı imkânsız kılıyordu: satır görünmeden özet tablosuna maliyet
  // YAZILAMAZ. Atlamak ayrıca sessizdi — teklif tutarına giren bir nakliye,
  // maliyet özetinde hiç görünmeden kârı olduğundan yüksek gösteriyordu.
  // Toplama girmesi değişmedi: tutarı `null` olan satır `toplaSayilar`da atlanır.
  const manualLines: CostOverviewManualLine[] = totalledLines(offer.pricing.lines).flatMap((l) => {
    if (l.itemId) return [];
    const a = agirliklar[l.id];
    const c = serbestMaliyet[l.id];
    const { amount, source } = manualLineCost(c, l.manualCost);
    return [
      {
        id: l.id,
        description: l.description,
        amount,
        source,
        headings: {
          fabrication: c?.fabrication ?? null,
          project: c?.project ?? null,
          rates: totals.rates.map((r) => ({
            key: r.key,
            title: r.title,
            amount: c?.rates?.[r.key] ?? null,
          })),
          loaded: amount,
        },
        steelKg: a?.steelKg ?? null,
        totalKg: a?.totalKg ?? null,
      },
    ];
  });
  const manualTotal = toplaSayilar(manualLines.map((l) => l.amount));

  const documentTotal = totals.total;
  const cost =
    documentTotal === null && manualTotal === null ? null : (documentTotal ?? 0) + (manualTotal ?? 0);

  const maliyetlenen = new Set(items.map((i) => i.offerItemId).filter(Boolean));
  const uncostedItems = offer.items
    .filter((i) => !maliyetlenen.has(i.id))
    .map((i) => ({ id: i.id, title: i.title }));

  const steelKg = toplaSayilar(items.map((i) => i.steelPackageKg));
  const weightKg = toplaSayilar(items.map((i) => i.weightPackageKg));

  return {
    items,
    uncostedItems,
    manualLines,
    manualTotal,
    packageTotal: toplaSayilar(items.map((i) => i.package)),
    documentTotal,
    margin: costMargin(effectiveTotal(offer.pricing), cost),
    steelKg,
    weightKg,
    steelKgAll: toplaSayilar([steelKg, ...manualLines.map((l) => l.steelKg)]),
    weightKgAll: toplaSayilar([weightKg, ...manualLines.map((l) => l.totalKg)]),
    unallocated: headings?.unallocated ?? 0,
  };
}

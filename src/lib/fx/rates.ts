// Döviz kuru çekirdeği — SAF. Ağ ve DB burada YOKTUR (çekme `fx-source.ts`te).
//
// ————————————————————————————————————————————————————————————————————————
// ORTALAMA BİR ÖLÇÜMDÜR, BİR SEÇİM DEĞİL.
//
// Firma bugüne kadar aylık maaşları avroya çevirirken AY SONU / ÖDEME GÜNÜ
// spot kurunu kullanıyordu. 2024-05 … 2026-07 arasındaki 27 ayın tamamı TCMB
// aylık ortalamasıyla karşılaştırıldı: sapma −%1,3 ile +%7,8 arasında geziyor
// (en uç örnek 2025 Mart — Excel 43,1181; TCMB ay ortalaması 40,0145; ay sonu
// ≈ 43,2). Yani eski sayılar ortalama DEĞİLDİ.
//
// Bu bölüm ORTALAMA üretir (kullanıcı isteği) ama geçmişi YENİDEN YAZMAZ:
// ödenmiş bir ayın avro karşılığı `hr_periods.eur_try_rate` ile kendi
// kaydında donar (Satış Takibi'ndeki "kur satırın kendindedir" kuralının
// aynısı — AGENTS SATIS-16). Ortalama yeni aylarda ÖNERİLEN değerdir.
// ————————————————————————————————————————————————————————————————————————
//
// PARİTE ORTALAMASI, ORTALAMALARIN PARİTESİ DEĞİLDİR.
// avg(EUR/USD) ≠ avg(EUR/TRY) / avg(USD/TRY). Fark küçüktür ama gerçektir ve
// yanlış olan ikincisidir: paritenin kendisi her gün ölçülür, o günlük
// değerlerin ortalaması alınır. `aylikOrtalama` bu yüzden çaprazı GÜN GÜN
// hesaplar.

/** Kur kaynağı. Satır başına saklanır: bir ay iki kaynaktan beslenebilir. */
export const FX_SOURCES = ["TCMB", "ECB"] as const;
export type FxSource = (typeof FX_SOURCES)[number];

export const FX_SOURCE_LABELS: Record<FxSource, string> = {
  TCMB: "TCMB",
  ECB: "ECB",
};

export const FX_SOURCE_HINTS: Record<FxSource, string> = {
  TCMB: "T.C. Merkez Bankası günlük döviz kuru bülteni (döviz alış)",
  ECB: "Avrupa Merkez Bankası referans kuru (Frankfurter API)",
};

/** Bir günün kuru. TL karşılıkları; parite bunlardan TÜRETİLİR. */
export interface FxDaily {
  /** ISO gün — `2026-08-11`. */
  date: string;
  source: FxSource;
  /** 1 USD kaç TL (TCMB'de döviz ALIŞ). */
  usdTry: number;
  /** 1 EUR kaç TL (TCMB'de döviz ALIŞ). */
  eurTry: number;
  /** TCMB döviz SATIŞ; ECB'de karşılığı yoktur (referans kuru tektir). */
  usdTrySelling?: number | null;
  eurTrySelling?: number | null;
}

/** Bir ayın ortalaması. `dayCount` kaç günden çıktığını söyler — beyan değil. */
export interface FxMonthly {
  /** `2026-08` */
  period: string;
  usdTry: number;
  eurTry: number;
  /** 1 EUR kaç USD — piyasada "parite" denen sayı. */
  eurUsd: number;
  /** 1 USD kaç EUR — paritenin tersi. */
  usdEur: number;
  /** Ortalamaya giren yayın günü sayısı (resmî tatiller yoktur). */
  dayCount: number;
  firstDay: string;
  lastDay: string;
  /** Günlerin geldiği kaynaklar; tek kaynaklıysa tek elemanlı. */
  sources: FxSource[];
}

/**
 * Günlük gözlemlerden aylık ortalama.
 *
 * Ay içinde gün SAYISI değişkendir (tatiller, yarım kalan ay) ve bu bir
 * eksiklik değildir: TCMB tatilde kur yayımlamaz, o gün diye bir kur yoktur.
 * `dayCount` ekranda gösterilir ki "yarım ayın ortalaması" tam ay sanılmasın.
 */
export function aylikOrtalama(rows: readonly FxDaily[]): FxMonthly[] {
  const gruplar = new Map<string, FxDaily[]>();
  for (const r of rows) {
    if (!(r.usdTry > 0) || !(r.eurTry > 0)) continue;
    const k = r.date.slice(0, 7);
    const liste = gruplar.get(k);
    if (liste) liste.push(r);
    else gruplar.set(k, [r]);
  }
  const out: FxMonthly[] = [];
  for (const [period, liste] of gruplar) {
    liste.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const n = liste.length;
    let usd = 0;
    let eur = 0;
    let parite = 0;
    const kaynaklar = new Set<FxSource>();
    for (const r of liste) {
      usd += r.usdTry;
      eur += r.eurTry;
      parite += r.eurTry / r.usdTry;
      kaynaklar.add(r.source);
    }
    const eurUsd = parite / n;
    out.push({
      period,
      usdTry: usd / n,
      eurTry: eur / n,
      eurUsd,
      usdEur: 1 / eurUsd,
      dayCount: n,
      firstDay: liste[0].date,
      lastDay: liste[n - 1].date,
      sources: FX_SOURCES.filter((s) => kaynaklar.has(s)),
    });
  }
  out.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
  return out;
}

/**
 * Çekilmesi gereken gün aralığı.
 *
 * "Her ay otomatik yenilensin" isteğinin çekirdeği: son kayıtlı günün
 * ERTESİNDEN bugüne kadar. Hiç kayıt yoksa `taban`dan başlar (2024-01-01).
 *
 * PENCERE KELEPÇELİDİR (`enFazlaGun`): uygulama aylarca açılmazsa tek bir
 * istekle yüzlerce gün çekmeye kalkmak zaman aşımına düşerdi; eksik kalan
 * kısım bir sonraki çalıştırmada tamamlanır ve ekran ne kadar kaldığını
 * söyler. Tarihsel doldurma zaten migration'da yapılmıştır (seed), bu yol
 * yalnız "bugüne kadar getir" içindir.
 */
export function eksikGunAraligi(
  sonKayitliGun: string | null | undefined,
  bugun: string,
  taban = "2024-01-01",
  enFazlaGun = 62
): { from: string; to: string } | null {
  const bas = sonKayitliGun ? gunEkle(sonKayitliGun, 1) : taban;
  if (bas > bugun) return null;
  const tavan = gunEkle(bas, enFazlaGun - 1);
  return { from: bas, to: tavan < bugun ? tavan : bugun };
}

/** ISO güne gün ekler (UTC; yerel saat dilimi kaymasın). */
export function gunEkle(iso: string, gun: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return new Date(t + gun * 86_400_000).toISOString().slice(0, 10);
}

/** İki ISO gün arasındaki (dahil) bütün günler. */
export function gunAraligi(from: string, to: string, tavan = 400): string[] {
  const out: string[] = [];
  let g = from;
  for (let i = 0; i < tavan && g <= to; i++) {
    out.push(g);
    g = gunEkle(g, 1);
  }
  return out;
}

/** Hafta sonu mu? TCMB cumartesi/pazar kur yayımlamaz — istek bile atılmaz. */
export function haftaSonu(iso: string): boolean {
  const g = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return g === 0 || g === 6;
}

/**
 * Bir dönemin ortalaması ne kadar "tam"?
 *
 * Ayın iş günü sayısına oranıdır ve YALNIZ SUNUM içindir: kullanıcı
 * "Ağustos ortalaması" dediğimizde ayın 7 gününü gördüğünü bilmelidir.
 */
export function donemTamlik(m: FxMonthly, bugun: string): number {
  const [y, ay] = m.period.split("-").map(Number);
  const sonGun = new Date(Date.UTC(y, ay, 0)).getUTCDate();
  const bugunAy = bugun.slice(0, 7) === m.period;
  const hedefSon = bugunAy ? Number(bugun.slice(8, 10)) : sonGun;
  let isGunu = 0;
  for (let g = 1; g <= hedefSon; g++) {
    const gun = new Date(Date.UTC(y, ay - 1, g)).getUTCDay();
    if (gun !== 0 && gun !== 6) isGunu++;
  }
  return isGunu > 0 ? Math.min(1, m.dayCount / isGunu) : 0;
}

/** Bir önceki döneme göre yüzde değişim; önceki yoksa `null`. */
export function degisimYuzde(simdi: number, onceki: number | null | undefined): number | null {
  if (!onceki || !Number.isFinite(onceki) || onceki === 0) return null;
  return ((simdi - onceki) / onceki) * 100;
}

/** Ekranda gösterilen üç kur çifti — tek yerde tanımlı. */
export const FX_PAIRS = [
  { key: "eurTry", label: "EUR/TRY", hint: "1 avro kaç Türk lirası", digits: 4, hue: 25 },
  { key: "usdTry", label: "USD/TRY", hint: "1 dolar kaç Türk lirası", digits: 4, hue: 155 },
  { key: "eurUsd", label: "EUR/USD", hint: "Parite — 1 avro kaç dolar", digits: 4, hue: 235 },
  { key: "usdEur", label: "USD/EUR", hint: "1 dolar kaç avro (paritenin tersi)", digits: 4, hue: 290 },
] as const;

export type FxPairKey = (typeof FX_PAIRS)[number]["key"];

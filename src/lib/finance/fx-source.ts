// Döviz kuru KAYNAKLARI — dış servise giden tek yer.
//
// TARAYICIDAN ÇAĞRILAMAZ. `next.config.ts`teki CSP `connect-src` yalnız
// `'self'` + Supabase kökenidir; bir istemci bileşeninden TCMB'ye atılan
// `fetch` tarayıcı tarafından SESSİZCE engellenir. Bu modül yalnız server
// action ve route handler'dan çağrılır.
//
// ——————————————————————————————————————————————————————— NEDEN TCMB
// Kullanıcı Frankfurter'ı (ECB) önerdi ve karar bana bırakıldı. İkisi de
// ölçüldü: 2024-01 … 2026-08 arasında 32 ayın TAMAMINDA ECB ile TCMB aylık
// ortalaması arasındaki fark %0,1–0,2 bandındadır, yani sayı olarak ikisi de
// doğrudur. Seçim başka bir gerekçeyle yapıldı:
//
//   · Firma Türkiye'de muhasebe tutuyor; kur değerlemesinde yasal referans
//     TCMB bülteni. Finans müdürü ekrandaki sayıyı kendi defteriyle
//     karşılaştıracak.
//   · TCMB USD/TRY'yi DOĞRUDAN yayımlar. ECB yalnız avro tabanlıdır ve
//     USD/TRY oradan ÇAPRAZ hesaplanır — bir bölme daha, bir yuvarlama daha.
//   · TCMB döviz ALIŞ ve SATIŞ'ı ayrı verir; ECB'de tek referans kuru vardır.
//
// TCMB'nin bedeli GÜN BAŞINA BİR İSTEK olmasıdır (tek bir aralık ucu yoktur).
// Bu yüzden 2024-01 → bugün arası geçmiş bir SEED MIGRATION'la dolduruldu
// (645 gün); çalışma zamanında yalnız "son kayıttan bugüne" farkı çekilir ve
// o da normalde 20-25 istektir.
//
// ECB YEDEKTİR, alternatif değil: TCMB'ye ulaşılamayan gün(ler) için
// Frankfurter TEK istekle aralığı verir, satır `source = 'ECB'` ile yazılır ve
// ekranda ay hangi kaynaklardan beslendiğini söyler. Kaynak satır başına
// saklandığı için karışık bir ay hesabı bozmaz, yalnız künyesi çift olur.

import { gunAraligi, haftaSonu, type FxDaily } from "./fx";

const ZAMAN_ASIMI_MS = 12_000;
const DENEME = 3;

/** Bir isteğin sonucu: ya veri ya SEBEP — sessiz yutma yok. */
type Cekim<T> = { veri: T } | { hata: string } | { yok: true };

/**
 * Üstel beklemeli yeniden deneme (`folder-picker.tsx`teki `yukleTekrarli`
 * idiomu). 404 YENİDEN DENENMEZ: TCMB resmî tatilde bülten yayımlamaz ve o
 * gün için "yok" doğru cevaptır — üç kez sormak yalnız zaman kaybıdır.
 */
async function cekTekrarli(url: string, kabulEt: "xml" | "json"): Promise<Cekim<string>> {
  let son = "bilinmeyen hata";
  for (let deneme = 0; deneme < DENEME; deneme++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
        headers: { accept: kabulEt === "xml" ? "application/xml,text/xml" : "application/json" },
        cache: "no-store",
      });
      if (res.status === 404) return { yok: true };
      if (res.ok) return { veri: await res.text() };
      son = `${res.status} ${res.statusText}`;
    } catch (e) {
      son = e instanceof Error ? e.message : "ağ hatası";
    }
    if (deneme < DENEME - 1) await new Promise((r) => setTimeout(r, 400 * 2 ** deneme));
  }
  return { hata: son };
}

// ————————————————————————————————————————————————————————————————— TCMB

/** `2026-08-11` → `https://www.tcmb.gov.tr/kurlar/202608/11082026.xml` */
export function tcmbUrl(iso: string): string {
  const [y, a, g] = iso.split("-");
  return `https://www.tcmb.gov.tr/kurlar/${y}${a}/${g}${a}${y}.xml`;
}

/**
 * TCMB bülteninden bir para biriminin alış/satışı.
 *
 * XML tam bir ayrıştırıcı gerektirmeyecek kadar sabit biçimlidir ve Node'da
 * yerleşik bir DOM ayrıştırıcı YOKTUR; bir bağımlılık eklemek yerine
 * `Kod="…"` bloğu kesilip iki alan okunur. Biçim değişirse sonuç `null` olur
 * ve çağıran bunu "o gün yok" değil HATA olarak görür — sessizce sıfır
 * yazılmaz.
 */
export function tcmbAyristir(xml: string, kod: "USD" | "EUR"): { alis: number; satis: number } | null {
  const blok = new RegExp(`<Currency[^>]*Kod="${kod}"[^>]*>([\\s\\S]*?)</Currency>`).exec(xml);
  if (!blok) return null;
  const sayi = (etiket: string): number => {
    const m = new RegExp(`<${etiket}>([^<]*)</${etiket}>`).exec(blok[1]);
    const v = m ? Number(m[1].trim()) : NaN;
    return Number.isFinite(v) && v > 0 ? v : NaN;
  };
  const alis = sayi("ForexBuying");
  const satis = sayi("ForexSelling");
  if (!Number.isFinite(alis)) return null;
  return { alis, satis: Number.isFinite(satis) ? satis : alis };
}

async function tcmbGun(iso: string): Promise<Cekim<FxDaily>> {
  const r = await cekTekrarli(tcmbUrl(iso), "xml");
  if ("hata" in r) return r;
  if ("yok" in r) return r;
  const usd = tcmbAyristir(r.veri, "USD");
  const eur = tcmbAyristir(r.veri, "EUR");
  // Bülten var ama iki kurdan biri okunamadıysa bu bir TATİL DEĞİL, biçim
  // değişikliğidir: "yok" demek eksikliği kalıcı olarak gizlerdi.
  if (!usd || !eur) return { hata: `${iso}: bülten okunamadı (biçim değişmiş olabilir)` };
  return {
    veri: {
      date: iso,
      source: "TCMB",
      usdTry: usd.alis,
      eurTry: eur.alis,
      usdTrySelling: usd.satis,
      eurTrySelling: eur.satis,
    },
  };
}

// —————————————————————————————————————————————————————— ECB (Frankfurter)

export function frankfurterUrl(from: string, to: string): string {
  return `https://api.frankfurter.dev/v1/${from}..${to}?base=EUR&symbols=TRY,USD`;
}

/**
 * ECB referans kurları — TEK istekte bütün aralık.
 *
 * DİKKAT: Frankfurter aralığın BAŞINDAN ÖNCEKİ son yayın gününü de döndürür
 * (2024-05-01 istendiğinde 2024-04-30 da gelir). Aralık dışına düşen günler
 * BURADA elenir; elenmezse bir önceki ayın son günü bu ayın ortalamasına
 * karışır.
 */
export async function ecbAralik(from: string, to: string): Promise<Cekim<FxDaily[]>> {
  const r = await cekTekrarli(frankfurterUrl(from, to), "json");
  if ("hata" in r) return r;
  if ("yok" in r) return { veri: [] };
  let govde: { rates?: Record<string, { TRY?: number; USD?: number }> };
  try {
    govde = JSON.parse(r.veri);
  } catch {
    return { hata: "ECB yanıtı JSON olarak okunamadı" };
  }
  const out: FxDaily[] = [];
  for (const [gun, v] of Object.entries(govde.rates ?? {})) {
    if (gun < from || gun > to) continue;
    const eurTry = Number(v?.TRY);
    const eurUsd = Number(v?.USD);
    if (!(eurTry > 0) || !(eurUsd > 0)) continue;
    out.push({
      date: gun,
      source: "ECB",
      usdTry: eurTry / eurUsd,
      eurTry,
      usdTrySelling: null,
      eurTrySelling: null,
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { veri: out };
}

// ———————————————————————————————————————————————————————————— birleşik

export interface FxCekimSonucu {
  rows: FxDaily[];
  /** Bülten yayımlanmayan günler (resmî tatil) — EKSİK DEĞİLDİR. */
  yayinYokGunler: string[];
  /** Gerçekten başarısız olan günler ve sebepleri. */
  hatalar: string[];
  /** TCMB düşüp ECB'ye düşülen gün sayısı. */
  yedekKullanildi: number;
}

/**
 * Aralıktaki bütün iş günlerini çeker.
 *
 * Sıra: hafta sonu ELENİR (TCMB zaten yayımlamaz, ECB de) → TCMB gün gün →
 * TCMB'nin AĞ HATASI verdiği günler kalırsa ECB'den TEK istekle tamamlanır.
 *
 * "Yayın yok" (404) ile "çekilemedi" AYRI TUTULUR ve ikisi de çağırana
 * döner: `verifyStorage`taki "atlanan ≠ eksik" ayrımının aynısı. Tatili eksik
 * saymak her ay kalıcı bir uyarı üretirdi.
 */
export async function cekGunlukKurlar(
  from: string,
  to: string,
  opts: { esZamanli?: number } = {}
): Promise<FxCekimSonucu> {
  const gunler = gunAraligi(from, to).filter((g) => !haftaSonu(g));
  const rows: FxDaily[] = [];
  const yayinYokGunler: string[] = [];
  const hatalar: string[] = [];
  const basarisiz: string[] = [];

  // Kuyruk deseni (folder-picker'daki `ESZAMANLI` işçileri): TCMB'yi paralel
  // istekle boğmamak için varsayılan 4'tür.
  const esZamanli = Math.max(1, Math.min(6, opts.esZamanli ?? 4));
  let sonraki = 0;
  async function isci() {
    for (;;) {
      const i = sonraki++;
      if (i >= gunler.length) return;
      const gun = gunler[i];
      const r = await tcmbGun(gun);
      if ("veri" in r) rows.push(r.veri);
      else if ("yok" in r) yayinYokGunler.push(gun);
      else basarisiz.push(gun);
    }
  }
  await Promise.all(Array.from({ length: esZamanli }, isci));

  let yedekKullanildi = 0;
  if (basarisiz.length > 0) {
    basarisiz.sort();
    const yedek = await ecbAralik(basarisiz[0], basarisiz[basarisiz.length - 1]);
    if ("veri" in yedek) {
      const istenen = new Set(basarisiz);
      for (const r of yedek.veri) {
        if (!istenen.has(r.date)) continue;
        rows.push(r);
        istenen.delete(r.date);
        yedekKullanildi++;
      }
      for (const g of istenen) hatalar.push(`${g}: TCMB ulaşılamadı, ECB'de de yok`);
    } else {
      const sebep = "hata" in yedek ? yedek.hata : "bilinmeyen";
      hatalar.push(`${basarisiz.length} gün çekilemedi (TCMB + ECB): ${sebep}`);
    }
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  yayinYokGunler.sort();
  return { rows, yayinYokGunler, hatalar, yedekKullanildi };
}

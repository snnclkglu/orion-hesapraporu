// Satın Alma panolarının SAF çekirdeği: gruplama, sıralı çubuk verisi, dönem
// serisi.
//
// NEDEN AYRI DOSYA: aynı üç soru üç ekranda birden soruluyor — "hangi
// tedarikçide ne kadar var", "aylara nasıl dağılıyor", "kategori kırılımı ne".
// Üç yerde ayrı yazılsaydı biri er geç iptal edilmiş siparişi sayar, öbürü
// saymazdı. Sunum katmanı (renk, biçim) burada YOKTUR; bu dosya yalnız sayı
// üretir ve test edilebilir.

import { hueFromText } from "@/lib/tags";
import { ayDonemi, haftaDonemi, type Donem } from "./terms";

/** `RankBars`ın beklediği satır — renk TON AÇISI olarak taşınır (md. 17). */
export interface SiraliKalem {
  key: string;
  label: string;
  hue: number;
  value: number;
  share: number;
  records: number;
  hint?: string;
}

/**
 * Bir anahtara göre topla ve paya göre sırala.
 *
 * TON METİNDEN TÜRETİLİR (`hueFromText`): tedarikçi sayısı önceden bilinemez ve
 * elle renk atamak listenin sırası değiştiğinde renkleri de değiştirirdi —
 * kullanıcı "YILMAZ hep mavi" diye hatırlar.
 *
 * SIFIR DEĞERLİ GRUP DÜŞER: grafikte görünmeyen bir çubuk efsaneyi şişirir.
 */
export function sirala<T>(
  kayitlar: readonly T[],
  anahtar: (x: T) => string,
  deger: (x: T) => number,
  secenekler: { ipucu?: (key: string, kayitlar: T[]) => string } = {}
): SiraliKalem[] {
  const gruplar = new Map<string, { toplam: number; kayitlar: T[] }>();
  for (const k of kayitlar) {
    const ad = anahtar(k).trim() || "—";
    const g = gruplar.get(ad) ?? { toplam: 0, kayitlar: [] };
    g.toplam += deger(k);
    g.kayitlar.push(k);
    gruplar.set(ad, g);
  }
  const toplam = [...gruplar.values()].reduce((t, g) => t + g.toplam, 0);
  return [...gruplar.entries()]
    .filter(([, g]) => g.toplam > 0)
    .map(([ad, g]) => ({
      key: ad,
      label: ad,
      hue: hueFromText(ad),
      value: g.toplam,
      share: toplam > 0 ? g.toplam / toplam : 0,
      records: g.kayitlar.length,
      hint: secenekler.ipucu?.(ad, g.kayitlar),
    }))
    .sort((a, b) => b.value - a.value);
}

export type Kip = "ay" | "hafta";

export interface DonemKutusu<T> {
  donem: Donem;
  kayitlar: T[];
  toplam: number;
}

/**
 * Kayıtları aya ya da haftaya böler.
 *
 * TARİHSİZ KAYIT DÖNEMLERE GİRMEZ ve ÇAĞIRANA AYRI DÖNER: takvimden düşürmek
 * onu unutturur, bugüne yazmak ise yalan söylemektir. Üç ekran da onları
 * kendi bandında gösterir.
 */
export function donemlere<T>(
  kayitlar: readonly T[],
  gun: (x: T) => string | null,
  deger: (x: T) => number,
  kip: Kip
): { kutular: DonemKutusu<T>[]; tarihsiz: T[] } {
  const harita = new Map<string, DonemKutusu<T>>();
  const tarihsiz: T[] = [];

  for (const k of kayitlar) {
    const g = gun(k);
    if (!g) {
      tarihsiz.push(k);
      continue;
    }
    const d = kip === "ay" ? ayDonemi(g) : haftaDonemi(g);
    const kutu = harita.get(d.key) ?? { donem: d, kayitlar: [], toplam: 0 };
    kutu.kayitlar.push(k);
    kutu.toplam += deger(k);
    harita.set(d.key, kutu);
  }

  const kutular = [...harita.values()].sort((a, b) => a.donem.start.localeCompare(b.donem.start));
  for (const k of kutular) {
    k.kayitlar.sort((a, b) => (gun(a) ?? "").localeCompare(gun(b) ?? ""));
  }
  return { kutular, tarihsiz };
}

/** Zaman serisi noktası — `TimeBarChart`ın beklediği biçim. */
export interface SeriNoktasi {
  key: string;
  label: string;
  values: number[];
}

/**
 * Dönem kutularını zaman serisine çevirir.
 *
 * BOŞ DÖNEM ATLANMAZ, SIFIRLA DOLDURULUR: eylülde sipariş yoksa ve grafik onu
 * hiç çizmezse ağustos ile ekim yan yana düşer ve okur "aralıksız akıyor"
 * sanır. Boşluk bir bilgidir.
 */
export function seriye<T>(
  kutular: readonly DonemKutusu<T>[],
  seriler: readonly { key: string; deger: (kayitlar: T[]) => number }[]
): SeriNoktasi[] {
  return kutular.map((k) => ({
    key: k.donem.key,
    label: k.donem.label,
    values: seriler.map((s) => s.deger(k.kayitlar)),
  }));
}

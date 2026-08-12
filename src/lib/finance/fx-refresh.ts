// Kur tazeleme ÇEKİRDEĞİ — iki çağıranın ORTAK yolu.
//
// İki yerden çalışır ve İKİSİ DE AYNI KODU ÇAĞIRIR:
//   1. Kullanıcı "Şimdi Güncelle" düğmesine bastığında (server action, çerez
//      tabanlı istemci, RLS `can_edit_finance()`ten geçer).
//   2. Vercel Cron ayda bir tetiklediğinde (`/api/cron/fx`, service-role
//      istemci — çerez yoktur, oturum yoktur).
//
// İki yerde ayrı yazılsaydı biri "atlanan gün"ü eksik sayar, öbürü saymazdı ve
// iki ekran farklı şey söylerdi — `worklog/filters.ts`in başında anlatılan
// hatanın aynısı.
//
// KULLANICI YOLU HİÇBİR AYAR GEREKTİRMEZ. Cron hiç kurulmasa bile bölüm
// açıldıkça veri kendini toparlar; cron yalnız "kimse girmese de dursun"
// güvencesidir.

import type { SupabaseClient } from "@supabase/supabase-js";
import { eksikGunAraligi } from "./fx";
import { cekGunlukKurlar } from "./fx-source";

export interface FxRefreshOutcome {
  error?: string;
  /** Depoya YENİ yazılan gün sayısı. */
  eklenen: number;
  /** Bülten yayımlanmayan gün (resmî tatil). ATLANAN ≠ EKSİK. */
  yayinYok: number;
  /** TCMB'ye ulaşılamayıp ECB'den tamamlanan gün. */
  yedek: number;
  /** Gerçekten çekilemeyen günler ve sebepleri. */
  hatalar: string[];
  /** Pencere kelepçesi (62 gün) yüzünden bu turda bitmedi mi? */
  kalanVar: boolean;
  /** İşlem sonundaki en son gün. */
  sonGun: string | null;
  /** Taranan aralık — denetim izine yazılır. */
  aralik: { from: string; to: string } | null;
}

export async function tazeleKurlar(
  supabase: SupabaseClient,
  bugun: string
): Promise<FxRefreshOutcome> {
  const bos: FxRefreshOutcome = {
    eklenen: 0,
    yayinYok: 0,
    yedek: 0,
    hatalar: [],
    kalanVar: false,
    sonGun: null,
    aralik: null,
  };

  const { data: sonSatir, error: okumaHatasi } = await supabase
    .from("fin_fx_daily")
    .select("rate_date")
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (okumaHatasi) return { ...bos, error: okumaHatasi.message };

  const sonGun = (sonSatir as { rate_date: string } | null)?.rate_date ?? null;
  const aralik = eksikGunAraligi(sonGun, bugun);
  if (!aralik) return { ...bos, sonGun };

  const sonuc = await cekGunlukKurlar(aralik.from, aralik.to);

  let eklenen = 0;
  if (sonuc.rows.length > 0) {
    // `ignoreDuplicates`: aynı güne İKİNCİ bir kur yazılmaz. Bir gün iki
    // kaynaktan iki kez yazılsaydı — anahtar yalnız tarih olduğu için
    // yazılamaz zaten, ama ilkinin üstüne yazmak da yanlış olurdu: depodaki
    // gün ölçülmüş bir gözlemdir, tazeleme onu düzeltmez.
    const { error, count } = await supabase.from("fin_fx_daily").upsert(
      sonuc.rows.map((r) => ({
        rate_date: r.date,
        source: r.source,
        usd_try: r.usdTry,
        eur_try: r.eurTry,
        usd_try_selling: r.usdTrySelling ?? null,
        eur_try_selling: r.eurTrySelling ?? null,
      })),
      { onConflict: "rate_date", ignoreDuplicates: true, count: "exact" }
    );
    if (error) return { ...bos, aralik, sonGun, error: error.message };
    eklenen = count ?? sonuc.rows.length;
  }

  return {
    eklenen,
    yayinYok: sonuc.yayinYokGunler.length,
    yedek: sonuc.yedekKullanildi,
    hatalar: sonuc.hatalar,
    // Pencere bugüne yetişmediyse daha eski günler kaldı demektir.
    kalanVar: aralik.to < bugun,
    sonGun: sonuc.rows.length > 0 ? sonuc.rows[sonuc.rows.length - 1].date : sonGun,
    aralik,
  };
}

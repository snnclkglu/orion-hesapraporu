// Kurlar — TCMB günlük bülteninden üretilen AYLIK ORTALAMALAR.
//
// Sayfa yalnız veri çeker ve tek bir istemci bileşenine geçer; başlık bölüm
// kabuğundadır (`finance/layout.tsx`), burada İKİNCİ bir `PageHeader` yoktur.
//
// Ortalamanın neden bir SEÇİM değil bir ÖLÇÜM olduğu ve paritenin neden gün gün
// hesaplandığı `lib/finance/fx.ts` başlığındadır; ekran o gerekçeyi kullanıcıya
// da anlatır (bilgi kutusu).

import { createClient } from "@/lib/supabase/server";
import { canEditFinance } from "@/lib/roles";
import { gunEkle } from "@/lib/finance/fx";
import { loadFxDaily, loadFxLastDay, loadFxMonthly, loadPeriods } from "../data";
import { FxRefreshButton, FxView } from "./fx-view";

/**
 * Günlük seyir penceresi — son ~120 takvim günü (yaklaşık 80 yayın günü).
 * Aylık ortalamanın arkasındaki günlük dalgalanmayı göstermeye yeter; daha
 * uzun bir pencere ekranda okunmaz bir çizgi üretirdi.
 */
const GUNLUK_PENCERE = 120;

/**
 * Bugünün YEREL takvim günü.
 *
 * `new Date().toISOString()` UTC'dir ve Türkiye saatiyle gece yarısı ile 03:00
 * arasında bir GÜN GERİ gösterir; "N gün geride" sayacı o saatlerde kendiliğinden
 * bir gün şişerdi.
 */
function bugunIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const a = String(now.getMonth() + 1).padStart(2, "0");
  const g = String(now.getDate()).padStart(2, "0");
  return `${y}-${a}-${g}`;
}

export default async function FinanceFxPage({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const sp = await searchParams;
  const ayHam = sp.ay ?? "";
  // Adres çubuğuna elle yazılan bozuk bir dönem sayfayı ÇÖKERTMEZ: süzgeç
  // düşer ve ekran en yeni dönemi gösterir.
  const secilenAy = /^\d{4}-(0[1-9]|1[0-2])$/.test(ayHam) ? ayHam : null;

  const bugun = bugunIso();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const canWrite = canEditFinance((profile as { role?: string } | null)?.role);

  const [monthly, lastDay, daily, periods] = await Promise.all([
    loadFxMonthly(supabase),
    loadFxLastDay(supabase),
    loadFxDaily(supabase, gunEkle(bugun, -GUNLUK_PENCERE)),
    loadPeriods(supabase),
  ]);

  // BOŞ DURUMDA DA BİR ÇIKIŞ YOLU KALIR: tarihsel doldurma migration seed'iyle
  // yapılır ama depo hiç dolmamışsa kullanıcının elinde tazeleme düğmesinden
  // başka bir şey olmaz — düğme bu yüzden boş ekranın içindedir.
  if (monthly.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ HENÜZ KUR KAYDI YOK ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Aylık ortalamalar TCMB günlük döviz kuru bülteninden hesaplanır. Depoda
          hiç gün yok; &ldquo;Şimdi Güncelle&rdquo; her basışta en fazla 62 günü
          getirir, 2024 başına kadar geri gitmek birkaç basış sürer.
        </p>
        <FxRefreshButton canWrite={canWrite} />
      </div>
    );
  }

  return (
    <FxView
      monthly={monthly}
      daily={daily}
      periods={periods}
      lastDay={lastDay}
      bugun={bugun}
      secilenAy={secilenAy}
      canWrite={canWrite}
    />
  );
}

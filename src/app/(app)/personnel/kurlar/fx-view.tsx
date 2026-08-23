"use client";

// Kurlar ekranı — güncellik, aylık ortalamalar, seyir ve ay ay defter.
//
// SORU SIRASI ekranın sırasını belirler:
//   1. "Veri güncel mi, değilse ne kadar geride?"          → güncellik şeridi
//   2. "Bu ay ortalama kur ne, geçen aya göre ne oldu?"    → dört özet kartı
//   3. "Aylar nasıl gidiyor?"                              → zaman serisi
//   4. "Parite ne yaptı?"                                  → parite çizgisi
//   5. "Ortalamanın arkasında hangi günler var?"           → günlük seyir
//   6. "Ortalama kaç yayın gününden çıktı?"                → ay ay tablo
//   7. "Bu sayıyı kendi defterimle karşılaştırırken neyi bilmeliyim?" → bilgi
//
// ORTALAMA BİR ÖLÇÜMDÜR, BİR SEÇİM DEĞİL; parite de gün gün hesaplanıp
// ortalanır (ortalamaların oranı DEĞİL). Gerekçesinin tamamı
// `lib/personnel/fx.ts` başlığındadır — ekran o gerekçeyi kullanıcıya da anlatır.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarRange,
  CircleAlert,
  Coins,
  Info,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimeBarChart } from "@/components/charts";
import { tagStyle } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { CURRENCY_SYMBOLS, currencyOf } from "@/lib/currency";
import { periodLabel } from "@/lib/personnel/payroll";
import {
  degisimYuzde,
  donemTamlik,
  FX_PAIRS,
  FX_SOURCES,
  FX_SOURCE_HINTS,
  FX_SOURCE_LABELS,
  gunAraligi,
  gunEkle,
  haftaSonu,
  type FxMonthly,
  type FxSource,
} from "@/lib/fx/rates";
import { refreshFxRates, type FxRefreshResult } from "../actions";
import type { FxMonthlyRow, PeriodRow } from "../schema";

/** Günlük gözlem satırı — `loadFxDaily`nin döndürdüğü biçim. */
interface FxDailyRow {
  date: string;
  source: string;
  usdTry: number;
  eurTry: number;
}

/**
 * SÜTUN ÖNCELİKLENDİRME (AGENTS dokunmatik MOBIL-7). Yedi sütun 375px'lik ekranda
 * tabloyu ikiye katlıyor; telefonda Dönem · EUR/TRY · USD/TRY kalır. Düşen
 * bilgiden KRİTİK olan (ortalamanın kaç günden çıktığı) dönem hücresinin ikinci
 * satırına iner — ikinci bir kart markup'ı yazılmaz.
 */
const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";

/** Kaynak rozetinin ton açısı — hex yazılmaz (AGENTS md. 11). */
const KAYNAK_TONU: Record<FxSource, number> = { TCMB: 210, ECB: 320 };

const YUZDE_FMT = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Kur DÖRT HANEYLE yazılır.
 *
 * `fmtNum` iki haneye yuvarlar ve bu paritede gerçek bir bilgi kaybıdır:
 * 1,0823 ile 1,0849 arasındaki fark bir milyon avroluk bir siparişte 2.600
 * dolar eder. Tablo defterle karşılaştırılan yerdir, orada yuvarlama olmaz.
 */
function fmtKur(v: number | null | undefined, digits = 4): string {
  if (v === null || v === undefined || !Number.isFinite(v) || v <= 0) return "—";
  return v.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** ISO gün → "11.08.2026" (Satış listesindeki tek satırın aynısı). */
function fmtGun(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/**
 * `2026-08` → "Ağu 26" — grafik ekseninde tam ad sığmaz.
 * Ay adları TEK YERDE (`payroll.periodLabel`) durur; burada yalnız kırpılır.
 */
function donemKisa(period: string): string {
  const [ad, yil] = periodLabel(period).split(" ");
  return ad && yil ? `${ad.slice(0, 3)} ${yil.slice(2)}` : period;
}

/** Yükseliş/düşüş oku. Renk VERİLMEZ — gerekçesi kartın yanındadır. */
function yon(v: number): string {
  return v > 0 ? "▲" : v < 0 ? "▼" : "=";
}

/** Bir ayın gerçekten geçerli kaynakları (`sources` DB'de serbest metindir). */
function kaynaklar(m: FxMonthlyRow): FxSource[] {
  return FX_SOURCES.filter((s) => m.sources.includes(s));
}

/** DB satırı → çekirdek tipi; tek fark `sources`un tipidir. */
function cekirdek(m: FxMonthlyRow): FxMonthly {
  return { ...m, sources: kaynaklar(m) };
}

/**
 * Tazeleme sonucunu DÜRÜSTÇE anlatan cümleler.
 *
 * "ATLANAN ≠ EKSİK": TCMB resmî tatilde bülten yayımlamaz, o gün diye bir kur
 * YOKTUR. Bunu ayrıca söylemezsek kullanıcı 5 gün getirip 3 gün atlayan bir turu
 * "yarım kaldı" diye okur ve düğmeye boşuna basmaya devam eder.
 */
function sonucCumleleri(r: FxRefreshResult): string[] {
  const out: string[] = [];
  out.push(r.eklenen ? `${r.eklenen} gün eklendi` : "yeni gün yok");
  if (r.yayinYok) {
    out.push(`${r.yayinYok} gün bülten yayımlanmamış (resmî tatil) — bu bir eksik değildir`);
  }
  if (r.yedek) out.push(`${r.yedek} gün TCMB'ye ulaşılamadı, ECB'den tamamlandı`);
  if (r.kalanVar) out.push("daha eski günler kaldı, düğmeye tekrar basın");
  if (r.sonGun) out.push(`son gün ${fmtGun(r.sonGun)}`);
  return out;
}

/** Bölüm başlığı — kicker + ipucu (İş Takibi analiz panosuyla aynı dil). */
function SectionHead({
  title,
  hint,
  icon: Icon,
  action,
}: {
  title: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="oc-kicker text-foreground/80">{title}</span>
        {hint && <span className="truncate text-[11px] text-muted-foreground">· {hint}</span>}
      </div>
      {action}
    </div>
  );
}

/**
 * Küçük çizgi grafiği — parite ve günlük seyir için.
 *
 * ÇUBUK DEĞİL ÇİZGİ: paritenin bilgisi sıfırdan uzaklığı değil DEĞİŞİMİdir,
 * 1,0823 ile 1,1650 arasındaki fark sıfır tabanlı bir çubukta göze görünmez.
 * Eksen bu yüzden sıfırdan başlamaz ve bu SAKLANMAZ — en düşük ve en yüksek
 * değer çizginin altında yazar.
 *
 * Yazı SVG'nin İÇİNDE DEĞİLDİR (`charts.tsx` başlığındaki gerekçe):
 * `preserveAspectRatio="none"` ile esneyen bir tuvalde yazı da esnerdi. Çizgi
 * kalınlığı `vector-effect` ile ölçeklemeden korunur.
 */
function MiniLine({
  points,
  hue,
  label,
  digits = 4,
  height = 76,
}: {
  points: readonly { label: string; value: number }[];
  hue: number;
  label: string;
  digits?: number;
  height?: number;
}) {
  const gecerli = points.filter((p) => Number.isFinite(p.value) && p.value > 0);
  if (gecerli.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Çizgi için yeterli gözlem yok.
      </p>
    );
  }

  const degerler = gecerli.map((p) => p.value);
  const min = Math.min(...degerler);
  const max = Math.max(...degerler);
  // Düz bir seri (min = max) sıfıra bölerdi; o durumda çizgi ortadan geçer.
  const aralik = max - min || 1;
  const koordinat = gecerli
    .map((p, i) => {
      const x = (i / (gecerli.length - 1)) * 100;
      const y = 100 - ((p.value - min) / aralik) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const ilk = gecerli[0];
  const son = gecerli[gecerli.length - 1];

  return (
    <div className="grid gap-1.5">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={`${label}: ${ilk.label} ${fmtKur(ilk.value, digits)} → ${son.label} ${fmtKur(
          son.value,
          digits
        )}`}
      >
        <polyline
          className="oc-series-stroke"
          style={tagStyle(hue)}
          points={koordinat}
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
        <span>
          {ilk.label} · {fmtKur(ilk.value, digits)}
        </span>
        <span>
          en düşük {fmtKur(min, digits)} · en yüksek {fmtKur(max, digits)}
        </span>
        <span className="text-foreground">
          {son.label} · {fmtKur(son.value, digits)}
        </span>
      </div>
    </div>
  );
}

/**
 * "Şimdi Güncelle" — son kayıtlı günden bugüne kadarki bülteni getirir.
 *
 * BOŞ EKRANDA DA GEREKİR (`page.tsx`), o yüzden ayrı bir bileşendir. Pencere
 * 62 günle kelepçelidir (`eksikGunAraligi`); kalan varsa sonuç bunu söyler ve
 * kullanıcı tekrar basar.
 */
export function FxRefreshButton({
  canWrite,
  onSonuc,
}: {
  canWrite: boolean;
  onSonuc?: (r: FxRefreshResult) => void;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();

  function guncelle() {
    basla(async () => {
      const r = await refreshFxRates();
      onSonuc?.(r);
      if (r.error) {
        toast.error(r.error, { duration: Infinity, closeButton: true });
        return;
      }
      // Çekilemeyen gün SESSİZ GEÇMEZ ve kendiliğinden KAYBOLMAZ: kullanıcı
      // hangi günün neden gelmediğini görmeden veriyi "güncel" sanmamalıdır.
      if (r.hatalar && r.hatalar.length > 0) {
        const ornek = r.hatalar.slice(0, 3).join(" · ");
        toast.error(
          `${r.hatalar.length} gün çekilemedi — ${ornek}${r.hatalar.length > 3 ? " …" : ""}`,
          { duration: Infinity, closeButton: true }
        );
      }
      toast.success(sonucCumleleri(r).join(" · "));
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      onClick={guncelle}
      disabled={!canWrite || calisiyor}
      title={
        canWrite
          ? "Son kayıtlı günden bugüne kadar TCMB bültenini getirir (bir turda en fazla 62 gün)."
          : "Kur tazelemek için Yönetici ya da Müdür yetkisi gerekir."
      }
    >
      {calisiyor ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Şimdi Güncelle
    </Button>
  );
}

export function FxView({
  monthly,
  daily,
  periods,
  lastDay,
  bugun,
  secilenAy,
  canWrite,
}: {
  /** Aylık ortalamalar — EN YENİ ÜSTTE (`loadFxMonthly` sıralaması). */
  monthly: FxMonthlyRow[];
  daily: FxDailyRow[];
  periods: PeriodRow[];
  lastDay: string | null;
  bugun: string;
  secilenAy: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [sonSonuc, setSonSonuc] = useState<FxRefreshResult | null>(null);

  const buAy = bugun.slice(0, 7);
  const secili = monthly.find((m) => m.period === secilenAy) ?? monthly[0];
  const sira = monthly.indexOf(secili);
  const onceki = monthly[sira + 1] ?? null;
  const sonKapanan = monthly.find((m) => m.period < buAy) ?? null;

  /**
   * Dönemin tamlığı — ortalamanın kaç iş gününü kapsadığı.
   *
   * "KISMİ" İŞARETİ YALNIZ BUGÜNÜN AYINA KONUR ve bu bilinçlidir: kapanmış bir
   * ayın yayın günü, resmî tatil yüzünden iş gününden az olabilir (uzun bayram)
   * ve o ay "yarım" değildir — ortalaması tamdır. Yarım olan, HENÜZ BİTMEMİŞ
   * aydır; onun ortalaması her yayın günüyle değişmeye devam eder.
   */
  const tamlik = donemTamlik(cekirdek(secili), bugun);
  const kismi = secili.period === buAy && tamlik < 1;

  // Adres çubuğundaki `?ay=` paylaşılabilir seçimdir; istemci state'i değil
  // (AGENTS: süzgeç adreste durur).
  function secDonem(period: string) {
    router.replace(`/personnel/kurlar?ay=${period}`, { scroll: false });
  }

  // ————————————————————————————————————————————————————————— güncellik
  //
  // "N gün geride" HAFTA SONUNU SAYMAZ: TCMB cumartesi/pazar bülten yayımlamaz,
  // o günler eksik değildir. Cuma günü çekilmiş bir veri pazartesi sabahı
  // "3 gün geride" görünseydi kullanıcı olmayan bir arızayı kovalardı.
  const beklenenGunler = useMemo(() => {
    if (!lastDay) return [] as string[];
    return gunAraligi(gunEkle(lastDay, 1), bugun).filter((g) => !haftaSonu(g));
  }, [lastDay, bugun]);
  const yalnizBugun = beklenenGunler.length === 1 && beklenenGunler[0] === bugun;

  const sonGunKaynagi = useMemo(() => {
    const satir = daily.find((d) => d.date === lastDay);
    const s = FX_SOURCES.find((k) => k === satir?.source);
    return s ?? "TCMB";
  }, [daily, lastDay]);

  // ————————————————————————————————————————————————————————— grafikler
  const artan = useMemo(() => [...monthly].reverse(), [monthly]);

  /** Tek serili zaman serisi sütunları (yığın yok — iki kuru toplamak anlamsız). */
  function sutunlar(key: "eurTry" | "usdTry") {
    return artan.map((m) => ({
      key: m.period,
      label: donemKisa(m.period),
      total: m[key],
      parts: { [key]: m[key] },
    }));
  }

  const pariteNoktalari = artan.map((m) => ({ label: donemKisa(m.period), value: m.eurUsd }));

  const gunlukEur = daily.map((d) => ({ label: fmtGun(d.date), value: d.eurTry }));
  const gunlukUsd = daily.map((d) => ({ label: fmtGun(d.date), value: d.usdTry }));
  const gunlukYedek = daily.filter((d) => d.source !== "TCMB").length;

  // ————————————————————————————————————————————————————————— dönem kaydı
  //
  // `hr_periods` maaş dönemine DONMUŞ kuru taşır (AGENTS SATIS-16: kur satırın
  // kendindedir). Ortalamadan sapması bir hata değildir — ödenmiş bir ayın avro
  // karşılığı sonradan değişmemelidir — ama sayıyı defteriyle karşılaştıran
  // müdür ikisini yan yana görmelidir.
  const donemKuru = useMemo(
    () => new Map(periods.map((p) => [p.period, p])),
    [periods]
  );

  return (
    <div className="grid gap-4">
      {/* 1 — Güncellik */}
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="oc-kicker text-muted-foreground">Güncellik</div>
            <p className="mt-1.5 text-sm">
              Son gün:{" "}
              <span className="font-mono font-medium tabular-nums">{fmtGun(lastDay)}</span>
              <span className="text-muted-foreground">
                {" · "}kaynak{" "}
                <span title={FX_SOURCE_HINTS[sonGunKaynagi]}>
                  {FX_SOURCE_LABELS[sonGunKaynagi]}
                </span>
              </span>
            </p>
            <p className="mt-1 text-[11px] text-foreground/70">
              {beklenenGunler.length === 0 ? (
                "Veri bugüne kadar tam; hafta sonu bülten yayımlanmaz."
              ) : yalnizBugun ? (
                "Bugünün bülteni henüz görünmüyor — TCMB kurları iş günü öğleden sonra yayımlar."
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {beklenenGunler.length} iş günü geride
                  </span>
                  {" — hafta sonları sayılmadı; resmî tatiller de bülten yayımlanmayan günlerdir."}
                </>
              )}
            </p>
          </div>
          <FxRefreshButton canWrite={canWrite} onSonuc={setSonSonuc} />
        </div>

        {/* Tazeleme sonucu ŞERİTTE DE KALIR: toast birkaç saniyede söner ve
            "kaç gün geldi, kaç gün tatildi" sorusunun cevabı kaybolurdu. */}
        {sonSonuc && !sonSonuc.error && (
          <p className="border-t bg-muted/30 px-4 py-2 text-[11px] text-foreground/80">
            Son tazeleme: {sonucCumleleri(sonSonuc).join(" · ")}
            {sonSonuc.hatalar && sonSonuc.hatalar.length > 0 && (
              <span className="text-destructive">
                {" · "}
                {sonSonuc.hatalar.length} gün çekilemedi
              </span>
            )}
          </p>
        )}
      </div>

      {/* 2 — Dört özet kartı */}
      <div className="rounded-lg border bg-card">
        <SectionHead
          title="Aylık Ortalama"
          hint={periodLabel(secili.period)}
          icon={Coins}
          action={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant={secili.period === buAy ? "secondary" : "ghost"}
                size="sm"
                className="text-xs"
                onClick={() => secDonem(buAy)}
                aria-pressed={secili.period === buAy}
                disabled={!monthly.some((m) => m.period === buAy)}
              >
                Bu ay
              </Button>
              {sonKapanan && (
                <Button
                  type="button"
                  variant={secili.period === sonKapanan.period ? "secondary" : "ghost"}
                  size="sm"
                  className="text-xs"
                  onClick={() => secDonem(sonKapanan.period)}
                  aria-pressed={secili.period === sonKapanan.period}
                >
                  Son kapanan ay
                </Button>
              )}
              <Select value={secili.period} onValueChange={secDonem}>
                <SelectTrigger size="sm" className="w-full sm:w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthly.map((m) => (
                    <SelectItem key={m.period} value={m.period}>
                      {periodLabel(m.period)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />

        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
          {FX_PAIRS.map((p) => {
            const deger = secili[p.key];
            const fark = degisimYuzde(deger, onceki ? onceki[p.key] : null);
            // Simge çiftin KARŞI birimidir: "EUR/TRY" = 1 avro kaç ₺ eder.
            const simge = CURRENCY_SYMBOLS[currencyOf(p.label.split("/")[1])];
            return (
              <div key={p.key} className="rounded-lg border bg-background p-3">
                <div className="flex items-center gap-1.5">
                  <span className="oc-tag-dot" style={tagStyle(p.hue)} aria-hidden />
                  <span className="oc-kicker text-muted-foreground">{p.label}</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-xl font-semibold tracking-tight tabular-nums">
                    {fmtKur(deger, p.digits)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{simge}</span>
                </div>
                {/* DEĞİŞİM RENKSİZDİR: yükselen bir EUR/TRY ne iyi ne kötü
                    haberdir — alıcıya zarar, satıcıya kâr yazar. Yeşil/kırmızı,
                    ekranın veremeyeceği bir hüküm olurdu; ok yönü yeter. */}
                <div className="mt-1 font-mono text-[11px] tabular-nums text-foreground/80">
                  {fark === null ? (
                    <span className="text-muted-foreground">önceki ay yok</span>
                  ) : (
                    <>
                      {yon(fark)} %{YUZDE_FMT.format(Math.abs(fark))}
                      <span className="text-muted-foreground">
                        {" · "}
                        {onceki ? `${donemKisa(onceki.period)} ${fmtKur(onceki[p.key], p.digits)}` : ""}
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground" title={p.hint}>
                  {p.hint}
                </p>
              </div>
            );
          })}
        </div>

        <p className="border-t px-4 py-2 text-[11px] text-foreground/70">
          {kismi ? (
            <>
              <span className="font-medium text-foreground">
                {periodLabel(secili.period)} henüz bitmedi
              </span>
              {`: ortalama ${secili.dayCount} yayın gününden çıktı (${fmtGun(
                secili.firstDay
              )} – ${fmtGun(secili.lastDay)}) ve ay boyunca değişmeye devam edecek.`}
              {sonKapanan &&
                ` Kapanmış son ay ${periodLabel(sonKapanan.period)}: EUR/TRY ${fmtKur(
                  sonKapanan.eurTry
                )}.`}
            </>
          ) : (
            `Ortalama ${secili.dayCount} yayın gününden çıktı (${fmtGun(
              secili.firstDay
            )} – ${fmtGun(secili.lastDay)}).`
          )}
        </p>
      </div>

      {/* 3 — Zaman serisi. İKİ AYRI GRAFİK: `TimeBarChart` yığılmış çizer ve
          EUR/TRY ile USD/TRY'yi üst üste toplamak anlamsız bir sayı üretirdi.
          Grafik ŞEKLİ gösterir, ondalık kesinlik aşağıdaki tablodadır. */}
      <div className="grid gap-4 xl:grid-cols-2">
        {[FX_PAIRS[0], FX_PAIRS[1]].map((p) => (
          <div key={p.key} className="rounded-lg border bg-card">
            <SectionHead
              title={p.label}
              hint={`aylık ortalama · ${artan.length} ay`}
              icon={TrendingUp}
            />
            <div className="px-4 py-4">
              <TimeBarChart
                columns={sutunlar(p.key === "usdTry" ? "usdTry" : "eurTry")}
                series={[{ key: p.key, label: p.label, hue: p.hue }]}
                height={200}
                valueLabel={CURRENCY_SYMBOLS.TRY}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 4 — Parite */}
      <div className="rounded-lg border bg-card">
        <SectionHead
          title="Parite (EUR/USD)"
          hint="gün gün hesaplanıp aylık ortalanır"
          icon={Activity}
        />
        <div className="px-4 py-4">
          <MiniLine
            points={pariteNoktalari}
            hue={FX_PAIRS[2].hue}
            label="EUR/USD aylık ortalama"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Eksen sıfırdan başlamaz; aralık çizginin altında yazar. USD/EUR bu
            eğrinin tersidir ({fmtKur(secili.usdEur)} — {periodLabel(secili.period)}),
            ayrıca çizilmez.
          </p>
        </div>
      </div>

      {/* 5 — Günlük seyir */}
      <div className="rounded-lg border bg-card">
        <SectionHead
          title="Günlük Seyir"
          hint={`son ${daily.length} yayın günü`}
          icon={CalendarRange}
        />
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="oc-kicker text-muted-foreground">EUR/TRY</span>
            <MiniLine points={gunlukEur} hue={FX_PAIRS[0].hue} label="EUR/TRY günlük" height={64} />
          </div>
          <div className="grid gap-1.5">
            <span className="oc-kicker text-muted-foreground">USD/TRY</span>
            <MiniLine points={gunlukUsd} hue={FX_PAIRS[1].hue} label="USD/TRY günlük" height={64} />
          </div>
        </div>
        <p className="border-t px-4 py-2 text-[11px] text-foreground/70">
          Aylık ortalamanın arkasındaki günlük gözlemler. Hafta sonu ve resmî
          tatil günleri çizgide YOKTUR — o günler bülten yayımlanmadığı için
          eksik değil, olmayan günlerdir.
          {gunlukYedek > 0 && ` Bu pencerede ${gunlukYedek} gün ECB'den tamamlandı.`}
        </p>
      </div>

      {/* 6 — Ay ay tablo */}
      <div className="rounded-lg border bg-card">
        <SectionHead
          title="Ay Ay Ortalamalar"
          hint={`${monthly.length} dönem · en yeni üstte`}
          icon={Coins}
        />
        <Table className="oc-mobile-table" containerClassName="oc-mobile-table-wrap">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Dönem</TableHead>
              <TableHead className="text-right">EUR/TRY</TableHead>
              <TableHead className="text-right">USD/TRY</TableHead>
              <TableHead className={cn("text-right", AT_MD)}>EUR/USD</TableHead>
              <TableHead className={cn("text-right", AT_LG)}>USD/EUR</TableHead>
              <TableHead className={cn("text-right", AT_MD)} title="Ortalamaya giren yayın günü">
                Gün
              </TableHead>
              <TableHead className={AT_LG}>Kaynak</TableHead>
              <TableHead
                className={cn("text-right", AT_LG)}
                title="Maaş döneminde donmuş kur (hr_periods) — ortalamadan bağımsızdır"
              >
                Dönem Kaydı
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthly.map((m) => {
              const ks = kaynaklar(m);
              const bitmedi = m.period === buAy;
              const kayit = donemKuru.get(m.period);
              return (
                <TableRow
                  key={m.period}
                  data-state={m.period === secili.period ? "selected" : undefined}
                >
                  <TableCell data-label="Dönem" data-mobile-span="full">
                    <button
                      type="button"
                      onClick={() => secDonem(m.period)}
                      aria-pressed={m.period === secili.period}
                      className="oc-tap flex min-h-8 w-full flex-col justify-center text-left transition-colors hover:text-primary"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium">{periodLabel(m.period)}</span>
                        {bitmedi && (
                          <span
                            className="oc-tag px-1.5 py-0.5 font-mono text-[11px]"
                            style={tagStyle(35)}
                            title="Ay henüz bitmedi; ortalama yeni yayın günleriyle değişecek."
                          >
                            kısmi
                          </span>
                        )}
                      </span>
                      {/* Telefonda düşen KRİTİK bilgi buraya iner: ortalama kaç
                          günden çıktı ve hangi kaynaktan geldi. */}
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground md:hidden">
                        {m.dayCount} gün · {ks.map((s) => FX_SOURCE_LABELS[s]).join(" + ") || "—"}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell data-label="EUR/TRY" className="text-right font-mono text-xs tabular-nums">
                    {fmtKur(m.eurTry)}
                  </TableCell>
                  <TableCell data-label="USD/TRY" className="text-right font-mono text-xs tabular-nums">
                    {fmtKur(m.usdTry)}
                  </TableCell>
                  <TableCell data-label="EUR/USD" className={cn("text-right font-mono text-xs tabular-nums", AT_MD)}>
                    {fmtKur(m.eurUsd)}
                  </TableCell>
                  <TableCell data-label="USD/EUR" className={cn("text-right font-mono text-xs tabular-nums", AT_LG)}>
                    {fmtKur(m.usdEur)}
                  </TableCell>
                  <TableCell
                    data-label="Gün"
                    className={cn("text-right font-mono text-xs tabular-nums", AT_MD)}
                    title={`${fmtGun(m.firstDay)} – ${fmtGun(m.lastDay)} arasındaki yayın günleri`}
                  >
                    {m.dayCount}
                  </TableCell>
                  <TableCell data-label="Kaynak" className={AT_LG}>
                    <span className="flex items-center gap-1">
                      {ks.map((s) => (
                        <span
                          key={s}
                          className="oc-tag px-1.5 py-0.5 font-mono text-[11px]"
                          style={tagStyle(KAYNAK_TONU[s])}
                          title={FX_SOURCE_HINTS[s]}
                        >
                          {FX_SOURCE_LABELS[s]}
                        </span>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell
                    data-label="Dönem Kaydı"
                    className={cn("text-right font-mono text-xs tabular-nums", AT_LG)}
                    title={
                      kayit?.eurTryRate
                        ? "Maaş döneminde donmuş EUR/TRY — ödenmiş ayın avro karşılığı sonradan değişmez."
                        : "Bu döneme kayıtlı bir maaş kuru yok."
                    }
                  >
                    {kayit?.eurTryRate ? (
                      fmtKur(kayit.eurTryRate)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <p className="border-t px-4 py-2.5 text-[11px] text-foreground/70">
          <span className="font-medium text-foreground">&laquo;Gün&raquo; sütunu</span>{" "}
          ortalamanın kaç YAYIN gününden çıktığını söyler. TCMB hafta sonu ve
          resmî tatilde bülten yayımlamaz; o günler eksik değil, olmayan
          günlerdir. Ay sayısı düşük görünen dönemler uzun bayram tatili taşıyan
          aylardır. &laquo;Kısmi&raquo; işareti yalnız HENÜZ BİTMEMİŞ aya konur —
          7 günlük bir ortalamayı tam ay sanmak yanlış karar verdirir.
        </p>
      </div>

      {/* 7 — Bilgi kutusu */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Info className="size-4 shrink-0 text-primary" />
          <span className="oc-kicker text-foreground/80">Bu SayILAR Nereden Geliyor</span>
        </div>
        <ul className="mt-2 grid gap-1.5 text-sm text-foreground/80">
          <li>
            <span className="font-medium text-foreground">Kaynak TCMB döviz ALIŞ kurudur.</span>{" "}
            Günlük bülten iş günü öğleden sonra yayımlanır; satış kuru
            saklanır ama ortalamalarda kullanılmaz.
          </li>
          <li>
            <span className="font-medium text-foreground">ECB yalnız yedektir.</span> Bir güne
            TCMB&apos;den ulaşılamazsa Avrupa Merkez Bankası referans kuru yazılır ve
            o satır tabloda kaynağıyla birlikte görünür — iki kaynak
            karıştırılmaz, hangi günün nereden geldiği kayıtlıdır.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Parite GÜN GÜN hesaplanıp ortalanır.
            </span>{" "}
            Ortalamaların oranı DEĞİLDİR: avg(EUR/USD) ≠ avg(EUR/TRY) ÷
            avg(USD/TRY). Fark küçüktür ama gerçektir; kendi defterinizde ikinci
            yolu kullanıyorsanız sayılar son hanede ayrışır.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Maaş dönemindeki kur bu ortalamadan bağımsızdır.
            </span>{" "}
            Ödenmiş bir ayın avro karşılığı kendi kaydında donar; bu ekran
            tazelendiğinde geçmiş bordrolar değişmez. Tablodaki
            &laquo;Dönem Kaydı&raquo; sütunu ikisini yan yana gösterir.
          </li>
        </ul>
        {!canWrite && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CircleAlert className="size-3.5 shrink-0" />
            Kur tazeleme yetkiniz yok; veriyi Yönetici ya da Müdür günceller.
          </p>
        )}
      </div>
    </div>
  );
}

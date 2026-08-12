"use client";

// Özet — devralınan Excel'in "Maaş Özet Tablo" + "Aylık Çalışma Saatleri"
// sayfalarının karşılığı.
//
// BU EKRAN HİÇBİR ŞEY SAKLAMAZ. Her sayı maaş satırlarından ve dönem
// ayarlarından TÜRETİLİR (`donemOzeti`, `netCalismaSaati`). Excel'de bu iki
// sayfa elle yapıştırılmış değerler taşıyordu ve BİRBİRLERİYLE ÇELİŞİYORDU
// (yedi ayda kişi sayısı tutmuyordu); ikinci bir özet tablosu tutmanın bedeli
// tam olarak budur.
//
// AVRO KARŞILIĞI DÖNEMİN KENDİ KURUYLA hesaplanır (`fin_periods.eur_try_rate`),
// bugünkü kurla değil: ödenmiş bir ayın avro karşılığı sonradan değişmemelidir
// (AGENTS md. 16). Kuru girilmemiş ay sıfır SAYILMAZ — hücre "—" olur ve satır
// bunu ayrıca söyler.

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Banknote, CalendarClock, Timer, Users } from "lucide-react";
import {
  AYLIK_CALISMA_SAATI,
  donemOzeti,
  netCalismaSaati,
  periodLabel,
  type PayrollRowLike,
} from "@/lib/finance/payroll";
import { categoryHue, categoryLabel, yonetimMi } from "@/lib/finance/personnel";
import { fmtNum } from "@/lib/currency";
import { hueFromText } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartLegend, RankBars, StatCard, TimeBarChart,
  type ChartColumn, type ChartSeries, type RankItem,
} from "@/components/charts";
import type { EmployeeRow, FxMonthlyRow, PayrollRow, PeriodRow } from "../schema";

const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";
const AT_XL = "hidden xl:table-cell";

/** Kapsam ekseni — özet PERSONEL ve YÖNETİM olarak ayrılır (Excel'deki gibi). */
const SERI: ChartSeries[] = [
  { key: "personel", label: "Personel", hue: 210 },
  { key: "yonetim", label: "Yönetim", hue: 25 },
];

interface AySatiri {
  period: string;
  personel: ReturnType<typeof donemOzeti>;
  yonetim: ReturnType<typeof donemOzeti>;
  toplam: ReturnType<typeof donemOzeti>;
  leaveHours: number;
  reportHours: number;
  /** Dönemin KENDİ kuru; girilmemişse null (sıfır DEĞİL). */
  rate: number | null;
}

export function SummaryView({
  employees,
  payroll,
  periods,
  year,
  scope,
  canWrite,
}: {
  employees: EmployeeRow[];
  payroll: PayrollRow[];
  periods: PeriodRow[];
  /**
   * AYLIK ORTALAMA KURLAR — sayfa yükler ama ÖZET KULLANMAZ.
   *
   * Bilerek: buradaki avro karşılığı DÖNEMİN KENDİ kuruyla
   * (`fin_periods.eur_try_rate`) hesaplanır, ortalamayla değil. Ortalamaya
   * düşmek "kuru girilmemiş ay"ı sessizce doldurur ve ödenmiş bir ayın avro
   * karşılığı kur tablosu her tazelendiğinde değişirdi (AGENTS md. 16).
   * Eksik kur GİZLENMEZ, satırda "kur yok" diye görünür.
   */
  fx?: FxMonthlyRow[];
  year: string | null;
  scope: "personel" | "yonetim" | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function suzgecYaz(anahtar: string, deger: string) {
    const q = new URLSearchParams(params?.toString() ?? "");
    if (deger) q.set(anahtar, deger);
    else q.delete(anahtar);
    router.replace(q.toString() ? `/finance/ozet?${q}` : "/finance/ozet", { scroll: false });
  }

  const kategoriHarita = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.category);
    return m;
  }, [employees]);

  const donemHarita = useMemo(() => {
    const m = new Map<string, PeriodRow>();
    for (const p of periods) m.set(p.period, p);
    return m;
  }, [periods]);

  /** Verideki yıllar — süzgeç listesi veriden çıkar, sabit yazılmaz. */
  const yillar = useMemo(
    () => [...new Set(payroll.map((p) => p.period.slice(0, 4)))].sort().reverse(),
    [payroll]
  );

  const aylar = useMemo<AySatiri[]>(() => {
    const gruplar = new Map<string, PayrollRow[]>();
    for (const p of payroll) {
      if (year && p.period.slice(0, 4) !== year) continue;
      const liste = gruplar.get(p.period) ?? [];
      liste.push(p);
      gruplar.set(p.period, liste);
    }
    const out: AySatiri[] = [];
    for (const [period, liste] of gruplar) {
      const ile = (f: (r: PayrollRow) => boolean): PayrollRowLike[] =>
        liste.filter(f).map((r) => ({ ...r, category: kategoriHarita.get(r.employeeId) ?? "" }));
      const yonetimSatirlari = ile((r) => yonetimMi(kategoriHarita.get(r.employeeId)));
      const personelSatirlari = ile((r) => !yonetimMi(kategoriHarita.get(r.employeeId)));
      const d = donemHarita.get(period);
      out.push({
        period,
        personel: donemOzeti(personelSatirlari),
        yonetim: donemOzeti(yonetimSatirlari),
        toplam: donemOzeti(ile(() => true)),
        leaveHours: d?.leaveHours ?? 0,
        reportHours: d?.reportHours ?? 0,
        rate: d?.eurTryRate ?? null,
      });
    }
    out.sort((a, b) => (a.period < b.period ? 1 : -1));
    return out;
  }, [payroll, year, kategoriHarita, donemHarita]);

  /** Kapsam süzgeci UYGULANMIŞ satır — tablo ve kartlar bunu okur. */
  function kapsamli(a: AySatiri) {
    if (scope === "personel") return a.personel;
    if (scope === "yonetim") return a.yonetim;
    return a.toplam;
  }

  // ————————————————————————————————————————————————————————————— grafikler

  const sutunlar = useMemo<ChartColumn[]>(
    () =>
      [...aylar]
        .reverse()
        .map((a) => ({
          key: a.period,
          label: periodLabel(a.period).replace(/ (\d{4})$/, " $1").slice(0, 12),
          total: a.toplam.grandTotal,
          parts: { personel: a.personel.grandTotal, yonetim: a.yonetim.grandTotal },
        })),
    [aylar]
  );

  const mesaiSutunlari = useMemo<ChartColumn[]>(
    () =>
      [...aylar]
        .reverse()
        .map((a) => ({
          key: a.period,
          label: periodLabel(a.period).slice(0, 12),
          total: a.toplam.overtimeHours,
          parts: { personel: a.personel.overtimeHours, yonetim: a.yonetim.overtimeHours },
        })),
    [aylar]
  );

  const kisiSutunlari = useMemo<ChartColumn[]>(
    () =>
      [...aylar]
        .reverse()
        .map((a) => ({
          key: a.period,
          label: periodLabel(a.period).slice(0, 12),
          total: a.toplam.count,
          parts: { personel: a.personel.count, yonetim: a.yonetim.count },
        })),
    [aylar]
  );

  /** Görev dağılımı — bugün AKTİF çalışanlar üzerinden. */
  const gorevDagilimi = useMemo<RankItem[]>(() => {
    const say = new Map<string, number>();
    for (const e of employees) {
      if (!e.active) continue;
      const ad = e.title || "—";
      say.set(ad, (say.get(ad) ?? 0) + 1);
    }
    const toplam = [...say.values()].reduce((a, b) => a + b, 0) || 1;
    return [...say.entries()]
      .map(([label, value]) => ({
        key: label,
        label,
        hue: hueFromText(label),
        value,
        share: value / toplam,
      }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  const kategoriDagilimi = useMemo<RankItem[]>(() => {
    const say = new Map<string, number>();
    for (const e of employees) {
      if (!e.active) continue;
      say.set(e.category, (say.get(e.category) ?? 0) + 1);
    }
    const toplam = [...say.values()].reduce((a, b) => a + b, 0) || 1;
    return [...say.entries()]
      .map(([k, value]) => ({
        key: k,
        label: categoryLabel(k),
        hue: categoryHue(k),
        value,
        share: value / toplam,
      }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  // ————————————————————————————————————————————————————————————— kartlar

  const sonAy = aylar[0];
  const oncekiAy = aylar[1];
  const aktifSayisi = employees.filter((e) => e.active).length;

  /** Son 12 ayın toplamı — kuru girilmiş aylar AYRICA sayılır. */
  const son12 = useMemo(() => {
    const dilim = aylar.slice(0, 12);
    let tl = 0;
    let eur = 0;
    let kursuz = 0;
    for (const a of dilim) {
      const o = kapsamli(a);
      tl += o.grandTotal;
      if (a.rate && a.rate > 0) eur += o.grandTotal / a.rate;
      else if (o.grandTotal > 0) kursuz++;
    }
    return { tl, eur, kursuz, ay: dilim.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aylar, scope]);

  const eksikKur = aylar.filter((a) => !a.rate && kapsamli(a).grandTotal > 0).length;

  return (
    <div className="grid gap-3">
      {/* ÖZET KARTLARI */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatCard
          label="Aktif Çalışan"
          value={String(aktifSayisi)}
          hint="bugün açık çalışma dönemi olan"
          icon={Users}
        />
        <StatCard
          label={sonAy ? `${periodLabel(sonAy.period)} Ödeme` : "Son Ay"}
          value={sonAy ? `${fmtNum(kapsamli(sonAy).grandTotal)} ₺` : "—"}
          hint={
            sonAy?.rate
              ? `${fmtNum(kapsamli(sonAy).grandTotal / sonAy.rate)} € · kur ${fmtNum(sonAy.rate, true)}`
              : "dönem kuru girilmemiş"
          }
          icon={Banknote}
          delta={
            sonAy && oncekiAy && kapsamli(oncekiAy).grandTotal > 0
              ? kapsamli(sonAy).grandTotal / kapsamli(oncekiAy).grandTotal - 1
              : null
          }
        />
        <StatCard
          label={`Son ${son12.ay} Ay`}
          value={`${fmtNum(son12.tl)} ₺`}
          hint={
            son12.kursuz > 0
              ? `${fmtNum(son12.eur)} € · ${son12.kursuz} ayın kuru yok`
              : `${fmtNum(son12.eur)} €`
          }
          icon={CalendarClock}
          tone={son12.kursuz > 0 ? "warn" : undefined}
        />
        <StatCard
          label={sonAy ? "Son Ay Fazla Mesai" : "Fazla Mesai"}
          value={sonAy ? `${fmtNum(kapsamli(sonAy).overtimeHours)} saat` : "—"}
          hint={sonAy ? `${fmtNum(kapsamli(sonAy).overtimeTotal)} ₺` : undefined}
          icon={Timer}
        />
      </div>

      {/* SÜZGEÇLER */}
      <div className="oc-scrollx flex flex-wrap items-center gap-2 overflow-x-auto border bg-card p-2 [--oc-scroll-bg:var(--card)]">
        <span className="oc-kicker shrink-0 text-muted-foreground">Yıl</span>
        <Button
          size="sm"
          variant={year ? "outline" : "secondary"}
          className="oc-tap"
          onClick={() => suzgecYaz("yil", "")}
        >
          Tümü
        </Button>
        {yillar.map((y) => (
          <Button
            key={y}
            size="sm"
            variant={year === y ? "secondary" : "outline"}
            className="oc-tap"
            onClick={() => suzgecYaz("yil", year === y ? "" : y)}
          >
            {y}
          </Button>
        ))}

        <span className="oc-kicker ml-2 shrink-0 text-muted-foreground">Kapsam</span>
        {(
          [
            ["", "Tümü"],
            ["personel", "Personel"],
            ["yonetim", "Yönetim"],
          ] as const
        ).map(([deger, etiket]) => (
          <Button
            key={etiket}
            size="sm"
            variant={(scope ?? "") === deger ? "secondary" : "outline"}
            className="oc-tap"
            onClick={() => suzgecYaz("kapsam", deger)}
          >
            {etiket}
          </Button>
        ))}
      </div>

      {/* GRAFİKLER */}
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="border bg-card p-3">
          <div className="oc-kicker mb-2 text-muted-foreground">Aylık Toplam Ödeme (₺)</div>
          <ChartLegend series={SERI} className="mb-2" />
          <TimeBarChart columns={sutunlar} series={SERI} valueLabel="₺" height={190} />
        </div>
        <div className="border bg-card p-3">
          <div className="oc-kicker mb-2 text-muted-foreground">Aylık Fazla Mesai (saat)</div>
          <TimeBarChart columns={mesaiSutunlari} series={SERI} valueLabel="saat" height={190} />
        </div>
        <div className="border bg-card p-3">
          <div className="oc-kicker mb-2 text-muted-foreground">Kişi Sayısı Seyri</div>
          <TimeBarChart columns={kisiSutunlari} series={SERI} valueLabel="kişi" height={190} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:gap-3">
          <div className="border bg-card p-3">
            <div className="oc-kicker mb-2 text-muted-foreground">Kategori Dağılımı (aktif)</div>
            <RankBars items={kategoriDagilimi} valueLabel="kişi" emptyText="Aktif çalışan yok" />
          </div>
          <div className="border bg-card p-3">
            <div className="oc-kicker mb-2 text-muted-foreground">Görev Dağılımı (aktif)</div>
            <RankBars items={gorevDagilimi} limit={8} valueLabel="kişi" emptyText="Aktif çalışan yok" />
          </div>
        </div>
      </div>

      {/* AY AY TABLO */}
      <div className="oc-scrollx overflow-x-auto border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dönem</TableHead>
              <TableHead className="text-right">Kişi</TableHead>
              <TableHead className={cn(AT_MD, "text-right")}>Çalışma Saati</TableHead>
              <TableHead className="text-right">Ödenen Net (₺)</TableHead>
              <TableHead className={cn(AT_LG, "text-right")}>Ödenen Net (€)</TableHead>
              <TableHead className={cn(AT_MD, "text-right")}>Kişi Başı Ort.</TableHead>
              <TableHead className="text-right">FM Saati</TableHead>
              <TableHead className={cn(AT_MD, "text-right")}>FM Ödemesi</TableHead>
              <TableHead className={cn(AT_XL, "text-right")}>FM Saat Maliyeti</TableHead>
              <TableHead className={cn(AT_XL, "text-right")}>İzin</TableHead>
              <TableHead className={cn(AT_XL, "text-right")}>Rapor</TableHead>
              <TableHead className={cn(AT_LG, "text-right")}>Net Çalışma Saati</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aylar.map((a) => {
              const o = kapsamli(a);
              // Net çalışma saati BÜTÜN kadro üzerinden hesaplanır: izin ve
              // rapor saatleri ay düzeyindedir ve kapsama bölünemez.
              const net = netCalismaSaati(
                a.toplam.normalHours,
                a.toplam.overtimeHours,
                a.leaveHours,
                a.reportHours
              );
              return (
                <TableRow key={a.period} className="hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <Link href={`/finance/maas?ay=${a.period}`} className="hover:underline">
                      {periodLabel(a.period)}
                    </Link>
                    {!a.rate && o.grandTotal > 0 && (
                      <span
                        className="ml-1.5 text-[11px] text-amber-600 dark:text-amber-400"
                        title="Bu ayın avro kuru girilmemiş; avro sütunu boş kalır"
                      >
                        kur yok
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{o.count}</TableCell>
                  <TableCell className={cn(AT_MD, "text-right font-mono tabular-nums")}>
                    {fmtNum(o.normalHours)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtNum(o.netTotal)}
                  </TableCell>
                  <TableCell className={cn(AT_LG, "text-right font-mono tabular-nums")}>
                    {a.rate ? fmtNum(o.netTotal / a.rate) : "—"}
                  </TableCell>
                  <TableCell className={cn(AT_MD, "text-right font-mono tabular-nums")}>
                    {fmtNum(o.netAverage)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtNum(o.overtimeHours)}
                  </TableCell>
                  <TableCell className={cn(AT_MD, "text-right font-mono tabular-nums")}>
                    {fmtNum(o.overtimeTotal)}
                  </TableCell>
                  <TableCell className={cn(AT_XL, "text-right font-mono tabular-nums")}>
                    {o.overtimeHours > 0 ? fmtNum(o.overtimeHourCost, true) : "—"}
                  </TableCell>
                  <TableCell className={cn(AT_XL, "text-right font-mono tabular-nums text-muted-foreground")}>
                    {a.leaveHours ? fmtNum(a.leaveHours) : "—"}
                  </TableCell>
                  <TableCell className={cn(AT_XL, "text-right font-mono tabular-nums text-muted-foreground")}>
                    {a.reportHours ? fmtNum(a.reportHours) : "—"}
                  </TableCell>
                  <TableCell className={cn(AT_LG, "text-right font-mono tabular-nums")}>
                    {fmtNum(net)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* KAPSAM NOTU — eksikliği gizlemek yerine söylemek. */}
      <div className="grid gap-1 text-xs text-muted-foreground">
        <p>
          Çalışma saati kişi başına {AYLIK_CALISMA_SAATI} saat/ay kabulüyle hesaplanır
          (30 gün × 7,5 saat). Net çalışma saati = normal + fazla mesai − izin − rapor;
          izin ve rapor saatleri <strong>ay düzeyinde</strong> tutulur, kişi başına değil.
        </p>
        <p>
          Devralınan kayıt <strong>Mayıs 2024</strong>&apos;te başlar. Şubat–Nisan 2024
          Excel&apos;in özet sayfasında bir toplam olarak vardı ama kişi kırılımı kaynakta
          yoktu; uydurulmuş bir dağıtım yazmak yerine aktarılmadı.
        </p>
        {eksikKur > 0 && (
          <p className="text-amber-600 dark:text-amber-400">
            {eksikKur} ayın avro kuru girilmemiş — o ayların avro sütunu boştur.{" "}
            {canWrite && (
              <Link href="/finance/maas" className="underline">
                Maaş ekranından ortalama kuru tek tuşla yazabilirsiniz.
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

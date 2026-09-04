"use client";

// KAZANILAN İŞLER — teklif projeksiyonunun geçmişe bakan gerçekleşme yüzü.
//
// Kaynak yalnız `offers.status = won` satırlarıdır. Zaman ekseni teklifin
// açıldığı/gönderildiği gün değil `won_on`dur: sonradan yapılan bir künye
// düzeltmesi aylık kazanım grafiğini başka aya taşıyamaz. Para birimleri kur
// uydurularak birleştirilmez; toplam ve grafik Avro, diğerleri çizelgededir.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  Euro,
  ExternalLink,
  Link2,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { CokluSuzgec } from "@/app/(app)/purchasing/filters";
import { PanoKabugu } from "@/app/(app)/purchasing/board-ui";
import {
  RankBars,
  TimeLineChart,
  type ChartColumn,
  type ChartSeries,
  type RankItem,
} from "@/components/charts";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { CustomerTag } from "@/components/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtCompactEur, fmtCompactEur1, fmtMoney, fmtNum } from "@/lib/currency";
import { trKatla } from "@/lib/drawings/tr-text";
import { monthLabel } from "@/lib/jobs/calendar";
import {
  DEFAULT_KAZANIM_DONEMI,
  KAZANIM_DONEMLERI,
  aylikKazanimSerisi,
  kararSuresiGun,
  kazanimDonemAraligi,
  kazanimOzeti,
  kazanilanDonemeGirer,
  kazanilanMusteriKirilimi,
  siralaKazanilanIsler,
  type KazanilanIsSatiri,
  type KazanimDonemi,
} from "@/lib/offers/analiz";
import { fmtOfferDate } from "@/lib/offers/filter";
import { offerStatusHue } from "@/lib/offers/status";
import { customerTag, tagStyle } from "@/lib/tags";

function ayEtiketi(ay: string): string {
  return `${monthLabel(ay).slice(0, 3)} ${ay.slice(2, 4)}`;
}

function kararSuresiEtiketi(gun: number | null): string {
  if (gun === null) return "—";
  if (gun === 0) return "Aynı gün";
  return `${fmtNum(gun)} gün`;
}

export function KazanilanIslerView({
  satirlar,
  bugun,
}: {
  satirlar: readonly KazanilanIsSatiri[];
  bugun: string;
}) {
  const [donem, setDonem] = useState<KazanimDonemi>(DEFAULT_KAZANIM_DONEMI);
  const [musteri, setMusteri] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const suzulmus = useMemo(() => {
    const anahtarlar = trKatla(q).split(/\s+/).filter(Boolean);
    const gecen = satirlar.filter((s) => {
      if (!kazanilanDonemeGirer(s, donem, bugun)) return false;
      if (musteri.length > 0 && !musteri.includes(s.customerName.trim())) return false;
      if (anahtarlar.length > 0) {
        const hay = trKatla(
          [s.offerNo, s.customerName, s.customerShort ?? "", s.subject, s.jobNo ?? "", s.jobTitle ?? ""].join(" ")
        );
        if (!anahtarlar.every((anahtar) => hay.includes(anahtar))) return false;
      }
      return true;
    });
    return siralaKazanilanIsler(gecen);
  }, [satirlar, donem, bugun, musteri, q]);

  const ozet = useMemo(() => kazanimOzeti(suzulmus), [suzulmus]);
  const avro = useMemo(
    () => suzulmus.filter((s) => s.currency === "EUR"),
    [suzulmus]
  );
  const aralik = useMemo(
    () => kazanimDonemAraligi(donem, bugun, suzulmus),
    [donem, bugun, suzulmus]
  );
  const aylik = useMemo(
    () => aylikKazanimSerisi(avro, aralik.bas, aralik.bitis),
    [avro, aralik]
  );

  const kolonlar: ChartColumn[] = aylik.map((n) => ({
    key: n.ay,
    label: ayEtiketi(n.ay),
    total: n.tutar,
    parts: { kazanilan: n.tutar },
  }));
  const seriler: ChartSeries[] = [
    { key: "kazanilan", label: "Alınan İş Tutarı", hue: offerStatusHue("won") },
  ];

  const musteriKalemleri: RankItem[] = useMemo(() => {
    const kirilim = kazanilanMusteriKirilimi(avro);
    const toplam = kirilim.reduce((n, k) => n + k.tutar, 0);
    return kirilim.map((k) => {
      const tag = customerTag({ name: k.musteri, hue: k.hue });
      return {
        key: k.musteri,
        label: tag.short,
        hue: tag.hue,
        hint: `${k.adet} iş`,
        value: k.tutar,
        share: toplam === 0 ? 0 : k.tutar / toplam,
      };
    });
  }, [avro]);

  const buyukIsler: RankItem[] = useMemo(() => {
    const tutarli = avro
      .filter((s) => s.amount !== null)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
    const toplam = tutarli.reduce((n, s) => n + (s.amount ?? 0), 0);
    return tutarli.map((s) => ({
      key: s.id,
      label: s.offerNo,
      hue: customerTag({ name: s.customerName, hue: s.customerHue }).hue,
      hint: `${s.customerShort || s.customerName} · ${s.subject || "—"}`,
      value: s.amount ?? 0,
      share: toplam === 0 ? 0 : (s.amount ?? 0) / toplam,
    }));
  }, [avro]);

  const musteriSecenekleri = useMemo(() => {
    const kume = new Set(satirlar.map((s) => s.customerName.trim()).filter(Boolean));
    return [...kume].sort((a, b) => a.localeCompare(b, "tr"));
  }, [satirlar]);

  const suzgecVar = q.trim() !== "" || musteri.length > 0;
  const donemMetni =
    donem === "tumu"
      ? "Bilinen ilk kazanımdan bugüne · tarihi bilinmeyen işler dâhil"
      : `${fmtOfferDate(aralik.bas)} – ${fmtOfferDate(aralik.bitis)}`;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="oc-kicker text-muted-foreground">Kazanım Dönemi</span>
        <div className="flex flex-wrap items-center gap-1">
          {KAZANIM_DONEMLERI.map((secenek) => (
            <Button
              key={secenek.key}
              type="button"
              size="sm"
              variant={donem === secenek.key ? "default" : "outline"}
              className="oc-tap h-9"
              onClick={() => setDonem(secenek.key)}
            >
              {secenek.label}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{donemMetni}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Kazanılan İş"
          value={fmtNum(ozet.adet)}
          hint={ozet.tarihiEksik ? `${ozet.tarihiEksik} işin kazanılma tarihi eksik` : "Seçili dönemde"}
          icon={Trophy}
          dense
        />
        <StatCard
          label="Alınan İş Tutarı"
          value={ozet.eurAdet ? fmtMoney(ozet.eurToplam, "EUR") : "—"}
          hint={
            ozet.digerPara || ozet.tutariEksik
              ? `${ozet.digerPara} Avro dışı iş · ${ozet.tutariEksik} tutarı eksik iş toplama girmedi`
              : `${ozet.eurAdet} Avro işi`
          }
          icon={Euro}
          dense
        />
        <StatCard
          label="Ortalama İş Tutarı"
          value={ozet.eurOrtalama === null ? "—" : fmtMoney(ozet.eurOrtalama, "EUR")}
          hint="Yalnız tutarı bulunan Avro işleri"
          icon={CalendarDays}
          dense
        />
        <StatCard
          label="İş Emrine Dönüşen"
          value={fmtNum(ozet.isEmirli)}
          hint={`${fmtNum(ozet.adet - ozet.isEmirli)} iş henüz bağlanmadı`}
          icon={Link2}
          dense
        />
      </div>

      <PanoKabugu
        baslik="Aylık Kazanılan İşler"
        alt={ozet.eurAdet ? `${fmtCompactEur(ozet.eurToplam)} alınan iş` : "Tutar girilmiş Avro işi yok"}
      >
        <TimeLineChart
          columns={kolonlar}
          series={seriler}
          valueLabel="EUR"
          format={fmtCompactEur}
          valueLabels
          valueFormat={fmtCompactEur1}
        />
      </PanoKabugu>

      <div className="grid gap-3 xl:grid-cols-2">
        <PanoKabugu baslik="Müşteri Dağılımı" alt={`${musteriKalemleri.length} müşteri`}>
          <RankBars
            items={musteriKalemleri}
            limit={10}
            valueLabel="EUR"
            format={fmtCompactEur}
            emptyText="Bu dönemde tutarı bulunan Avro işi yok"
          />
        </PanoKabugu>
        <PanoKabugu baslik="En Büyük İşler" alt="Alınan iş tutarına göre">
          <RankBars
            items={buyukIsler}
            limit={10}
            valueLabel="EUR"
            format={fmtCompactEur}
            emptyText="Bu dönemde tutarı bulunan Avro işi yok"
          />
        </PanoKabugu>
      </div>

      <div className="grid grid-cols-3 items-center gap-2 max-sm:[&>*]:min-w-0 max-sm:[&>*]:w-full sm:flex sm:flex-wrap">
        <div className="relative col-span-3 min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Kazanılan iş ara"
            className="h-9 pl-8 text-base pointer-fine:text-sm"
          />
        </div>
        <CokluSuzgec
          baslik="Müşteri"
          secenekler={musteriSecenekleri.map((ad) => {
            const kayit = satirlar.find((s) => s.customerName.trim() === ad);
            return {
              value: ad,
              label: customerTag({ name: ad, shortName: kayit?.customerShort }).short,
            };
          })}
          secili={musteri}
          onChange={setMusteri}
        />
        {suzgecVar ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="oc-tap h-9 min-w-0 truncate px-2"
            onClick={() => {
              setQ("");
              setMusteri([]);
            }}
          >
            <X className="size-3.5" /> Temizle
          </Button>
        ) : null}
      </div>

      {suzulmus.length === 0 ? (
        <EmptyState
          title={satirlar.length === 0 ? "HENÜZ KAZANILAN İŞ YOK" : "BU DÖNEMDE KAZANILAN İŞ YOK"}
          description={
            satirlar.length === 0
              ? "Bir teklifin durumu Kazanıldı yapıldığında burada kendiliğinden görünür."
              : "Dönemi genişletin ya da müşteri ve arama süzgeçlerini temizleyin. Tarihi bilinmeyen eski kayıtlar Tümü görünümündedir."
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table className="table-fixed" containerClassName="!overflow-x-hidden">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[11%]">Kazanılma</TableHead>
                  <TableHead className="w-[14%]">Teklif No</TableHead>
                  <TableHead className="w-[8%]">Müşteri</TableHead>
                  <TableHead className="w-[30%]">Konu</TableHead>
                  <TableHead className="w-[13%] text-right">Alınan Tutar</TableHead>
                  <TableHead className="w-[10%]">Karar Süresi</TableHead>
                  <TableHead className="w-[10%]">İş Emri</TableHead>
                  <TableHead className="w-[4%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suzulmus.map((s) => {
                  const tag = customerTag({ name: s.customerName, hue: s.customerHue });
                  return (
                    <TableRow key={s.id} className="oc-row-hue" style={tagStyle(tag.hue)}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {fmtOfferDate(s.wonOn)}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        <Link href={`/offers/${s.id}`} className="hover:underline">
                          {s.offerNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <CustomerTag name={s.customerName} shortName={s.customerShort} hue={s.customerHue} />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/offers/${s.id}`}
                          className="block truncate hover:underline"
                          title={s.subject || undefined}
                        >
                          {s.subject || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {s.amount === null ? "—" : fmtMoney(s.amount, s.currency)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {kararSuresiEtiketi(kararSuresiGun(s))}
                      </TableCell>
                      <TableCell>
                        {s.jobId ? (
                          <Link
                            href={`/jobs/${s.jobId}`}
                            title={s.jobTitle || undefined}
                            className="block truncate font-mono text-xs hover:underline"
                          >
                            {s.jobNo || "İş emri"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon-sm">
                          <Link href={`/offers/${s.id}`} title="Teklifi aç" aria-label="Teklifi aç">
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-2 md:hidden">
            {suzulmus.map((s) => {
              const tag = customerTag({ name: s.customerName, hue: s.customerHue });
              return (
                <li key={s.id} className="oc-row-hue rounded-md border p-3" style={tagStyle(tag.hue)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs">{s.offerNo}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Trophy className="size-3.5" /> {fmtOfferDate(s.wonOn)}
                        </span>
                      </div>
                      <Link
                        href={`/offers/${s.id}`}
                        className="mt-1 block font-medium [overflow-wrap:anywhere] hover:underline"
                      >
                        {s.subject || "—"}
                      </Link>
                    </div>
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link href={`/offers/${s.id}`} title="Teklifi aç" aria-label="Teklifi aç">
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <CustomerTag name={s.customerName} shortName={s.customerShort} hue={s.customerHue} />
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock3 className="size-3.5" /> {kararSuresiEtiketi(kararSuresiGun(s))}
                    </span>
                    <span className="ml-auto font-mono">
                      {s.amount === null ? "—" : fmtMoney(s.amount, s.currency)}
                    </span>
                  </div>
                  {s.jobId ? (
                    <Link
                      href={`/jobs/${s.jobId}`}
                      className="mt-2 inline-flex items-center gap-1 font-mono text-xs hover:underline"
                      title={s.jobTitle || undefined}
                    >
                      <Link2 className="size-3.5" /> {s.jobNo || "İş emri"}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

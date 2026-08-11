"use client";

// Ödeme takvimi panosu — finansa verilecek nakit çıkış planı.
//
// SATIR BİR ÖDEMEDİR, BİR SİPARİŞ DEĞİL: avans sipariş gününde, bakiye teslim +
// vade gününde çıkar ve ikisi farklı aylara düşer. Tek satırda göstermek, ayın
// toplamını yanlış yapardı — bu ekranın tek işi o toplamı doğru vermektir.
//
// TOPLAMLAR AVRODADIR ve kuru olmayan satır toplama GİRMEZ; ayrıca sayılır.
// Satış Takibi'nde öğrenilen kural (md. 16): kuru eksik satır sessizce
// kaybolmamalı.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/currency";
import { formatNum } from "@/lib/drawings/labels";
import {
  ayDonemi,
  bugunISO,
  gunFarki,
  haftaDonemi,
  tarihGoster,
  type Donem,
} from "@/lib/purchasing/terms";
import { updateOrder } from "../actions";

export interface OdemeSatiri {
  id: string;
  orderId: string;
  tur: "avans" | "bakiye" | "tamami";
  supplier: string;
  orderNo: string;
  /** Ödeme günü; hesaplanamıyorsa `null` (termin de teslim de yok). */
  gun: string | null;
  tutar: number;
  currency: string;
  tutarEur: number | null;
  odendi: boolean;
  odendiGun: string | null;
  kalemSayisi: number;
  isler: string[];
}

const TUR_ETIKET: Record<OdemeSatiri["tur"], string> = {
  avans: "Avans",
  bakiye: "Bakiye",
  tamami: "Tamamı",
};

type Kip = "ay" | "hafta";

export function PaymentBoard({
  satirlar,
  canWrite,
}: {
  satirlar: OdemeSatiri[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [kip, setKip] = useState<Kip>("ay");
  const [odenenler, setOdenenler] = useState(false);

  const bugun = bugunISO();

  const { tarihsiz, gecikmis, kutular, toplamEur, kursuz } = useMemo(() => {
    const kapsam = satirlar.filter((s) => odenenler || !s.odendi);
    const tarihsiz = kapsam.filter((s) => !s.gun);
    const gecikmis = kapsam
      .filter((s) => s.gun && !s.odendi && (gunFarki(s.gun, bugun) ?? 0) < 0)
      .sort((a, b) => (a.gun ?? "").localeCompare(b.gun ?? ""));
    const gelecek = kapsam.filter(
      (s) => s.gun && (s.odendi || (gunFarki(s.gun, bugun) ?? 0) >= 0)
    );

    const harita = new Map<string, { donem: Donem; satirlar: OdemeSatiri[]; toplam: number }>();
    for (const s of gelecek) {
      const d = kip === "ay" ? ayDonemi(s.gun!) : haftaDonemi(s.gun!);
      const kutu = harita.get(d.key) ?? { donem: d, satirlar: [], toplam: 0 };
      kutu.satirlar.push(s);
      kutu.toplam += s.tutarEur ?? 0;
      harita.set(d.key, kutu);
    }
    const kutular = [...harita.values()].sort((a, b) => a.donem.start.localeCompare(b.donem.start));
    for (const k of kutular) k.satirlar.sort((a, b) => (a.gun ?? "").localeCompare(b.gun ?? ""));

    return {
      tarihsiz,
      gecikmis,
      kutular,
      toplamEur: kapsam.filter((s) => !s.odendi).reduce((t, s) => t + (s.tutarEur ?? 0), 0),
      kursuz: kapsam.filter((s) => s.tutarEur == null).length,
    };
  }, [satirlar, kip, odenenler, bugun]);

  function odendiIsaretle(s: OdemeSatiri) {
    if (!canWrite) return;
    const alan = s.tur === "avans" ? { advancePaidAt: bugun } : { balancePaidAt: bugun };
    updateOrder({ id: s.orderId, ...alan }).then((sonuc) => {
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(`${s.supplier} · ${TUR_ETIKET[s.tur]} ödendi.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3">
      <section className="flex flex-wrap items-center gap-4 border bg-card p-3">
        <div>
          <span className="oc-kicker block text-muted-foreground">Ödenecek Toplam</span>
          <span className="block font-mono text-lg tabular-nums">{fmtMoney(toplamEur, "EUR")}</span>
        </div>
        {gecikmis.length > 0 && (
          <div>
            <span className="oc-kicker block text-muted-foreground">Vadesi Geçmiş</span>
            <span className="block font-mono text-lg text-destructive tabular-nums">
              {fmtMoney(
                gecikmis.reduce((t, s) => t + (s.tutarEur ?? 0), 0),
                "EUR"
              )}
            </span>
          </div>
        )}
        {kursuz > 0 && (
          <div title="Kuru girilmemiş ödeme avro toplamına giremez">
            <span className="oc-kicker block text-muted-foreground">Kuru Eksik</span>
            <span className="block font-mono text-lg text-amber-700 tabular-nums dark:text-amber-400">
              {formatNum(kursuz)}
            </span>
          </div>
        )}
        <span className="ml-auto flex items-center gap-1">
          <KipDugmesi etkin={kip === "ay"} onClick={() => setKip("ay")}>
            Aylık
          </KipDugmesi>
          <KipDugmesi etkin={kip === "hafta"} onClick={() => setKip("hafta")}>
            Haftalık
          </KipDugmesi>
          <KipDugmesi etkin={odenenler} onClick={() => setOdenenler((o) => !o)}>
            Ödenenler
          </KipDugmesi>
        </span>
      </section>

      {gecikmis.length > 0 && (
        <Bant
          baslik="Vadesi Geçmiş"
          renk="kirmizi"
          alt={`${formatNum(gecikmis.length)} ödeme · ${fmtMoney(
            gecikmis.reduce((t, s) => t + (s.tutarEur ?? 0), 0),
            "EUR"
          )}`}
        >
          {gecikmis.map((s) => (
            <Satir key={s.id} s={s} bugun={bugun} canWrite={canWrite} onOde={odendiIsaretle} />
          ))}
        </Bant>
      )}

      {tarihsiz.length > 0 && (
        <Bant
          baslik="Ödeme Günü Belirsiz"
          renk="sari"
          alt={`${formatNum(tarihsiz.length)} ödeme — termin ya da teslim tarihi girilmemiş`}
        >
          {tarihsiz.map((s) => (
            <Satir key={s.id} s={s} bugun={bugun} canWrite={canWrite} onOde={odendiIsaretle} />
          ))}
        </Bant>
      )}

      {kutular.length === 0 && gecikmis.length === 0 && tarihsiz.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Planlanmış ödeme yok. Sipariş açıldığında avans ve bakiye ödemeleri buraya düşer.
          </p>
        </div>
      ) : (
        kutular.map((k) => (
          <Bant
            key={k.donem.key}
            baslik={k.donem.label}
            renk="normal"
            alt={`${formatNum(k.satirlar.length)} ödeme · ${fmtMoney(k.toplam, "EUR")}`}
          >
            {k.satirlar.map((s) => (
              <Satir key={s.id} s={s} bugun={bugun} canWrite={canWrite} onOde={odendiIsaretle} />
            ))}
          </Bant>
        ))
      )}
    </div>
  );
}

function Satir({
  s,
  bugun,
  canWrite,
  onOde,
}: {
  s: OdemeSatiri;
  bugun: string;
  canWrite: boolean;
  onOde: (s: OdemeSatiri) => void;
}) {
  const kalan = gunFarki(s.gun, bugun);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 first:border-t-0">
      <span className="min-w-[8rem] font-mono text-[12px] whitespace-nowrap">
        {s.gun ? tarihGoster(s.gun) : <span className="text-muted-foreground">tarih yok</span>}
        {kalan != null && !s.odendi && (
          <span
            className={
              "ml-1.5 " +
              (kalan < 0
                ? "text-destructive"
                : kalan <= 7
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground")
            }
          >
            {kalan < 0 ? `${Math.abs(kalan)} gün geçti` : `${kalan} gün`}
          </span>
        )}
      </span>

      <span className="inline-flex min-h-6 items-center border border-dashed px-1.5 text-[11px] text-muted-foreground">
        {TUR_ETIKET[s.tur]}
      </span>

      <span className="min-w-0 flex-1 text-[13px]">
        <span className="font-medium">{s.supplier}</span>
        {s.orderNo && (
          <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{s.orderNo}</span>
        )}
        <span className="block font-mono text-[11px] text-muted-foreground">
          {formatNum(s.kalemSayisi)} kalem
          {s.isler.length > 0 && ` · ${s.isler.slice(0, 4).join(", ")}${s.isler.length > 4 ? "…" : ""}`}
        </span>
      </span>

      <span className="text-right font-mono text-[12px] tabular-nums">
        {fmtMoney(s.tutar, s.currency)}
        {s.tutarEur == null ? (
          <span className="block text-[11px] text-amber-700 dark:text-amber-400">kur yok</span>
        ) : (
          s.currency !== "EUR" && (
            <span className="block text-[11px] text-muted-foreground">
              {fmtMoney(s.tutarEur, "EUR")}
            </span>
          )
        )}
      </span>

      {s.odendi ? (
        <span className="inline-flex min-h-7 items-center border border-emerald-600/40 bg-emerald-600/10 px-1.5 text-[11px] whitespace-nowrap text-emerald-700 dark:text-emerald-400">
          Ödendi {s.odendiGun ? `· ${tarihGoster(s.odendiGun)}` : ""}
        </span>
      ) : (
        canWrite && (
          <Button type="button" size="xs" variant="outline" onClick={() => onOde(s)}>
            Ödendi
          </Button>
        )
      )}
    </li>
  );
}

function Bant({
  baslik,
  alt,
  renk,
  children,
}: {
  baslik: string;
  alt: string;
  renk: "normal" | "kirmizi" | "sari";
  children: React.ReactNode;
}) {
  const kenar =
    renk === "kirmizi"
      ? "border-destructive/40"
      : renk === "sari"
        ? "border-amber-500/40"
        : "border-border";
  const zemin =
    renk === "kirmizi"
      ? "bg-destructive/[0.06]"
      : renk === "sari"
        ? "bg-amber-500/[0.08]"
        : "bg-muted/50";
  return (
    <section className={`border bg-card ${kenar}`}>
      <div className={`flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 ${zemin}`}>
        <h2 className="text-sm font-medium">{baslik}</h2>
        <p className="font-mono text-[11px] text-muted-foreground">{alt}</p>
      </div>
      <ul>{children}</ul>
    </section>
  );
}

function KipDugmesi({
  etkin,
  onClick,
  children,
}: {
  etkin: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={etkin}
      className={
        "min-h-8 border px-2 text-[12px] transition-colors pointer-coarse:min-h-10 " +
        (etkin
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-border text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

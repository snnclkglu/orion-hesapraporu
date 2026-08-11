"use client";

// Teslim takvimi panosu — aya ya da haftaya göre gruplanmış bekleyen sevkiyat.
//
// ÜÇ KARAR:
//
// 1. TERMİNİ OLMAYAN SİPARİŞ GİZLENMEZ, EN ÜSTE KONUR. Takvimden düşürmek onu
//    unutturur; oysa "ne zaman geleceği belli olmayan sipariş" satınalmacının
//    ilk çözmesi gereken şeydir. Kendi başlığı vardır ve sayılır.
//
// 2. GECİKMİŞLER AYRI BİR BANTTIR, geçmiş ayın içinde değil. Geçen ayın
//    kutusuna bakmak için kimse sayfayı yukarı kaydırmaz; gecikme bugünün
//    sorunudur ve bugünün üstünde durmalıdır.
//
// 3. TESLİM ALINANLAR LİSTEDEN DÜŞER. Ekranın sorusu "ne bekliyorum"dur;
//    gelmiş malı göstermek listeyi zamanla okunmaz yapardı. Geçmiş kayıt
//    Siparişler ekranındadır.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/currency";
import { formatNum } from "@/lib/drawings/labels";
import {
  ayDonemi,
  bugunISO,
  eurKarsiligi,
  gunFarki,
  haftaDonemi,
  tarihGoster,
  type Donem,
} from "@/lib/purchasing/terms";
import type { Siparis } from "../data";
import { updateOrder } from "../actions";

type Kip = "ay" | "hafta";

interface Kutu {
  donem: Donem;
  siparisler: Siparis[];
  toplamEur: number;
}

function tutar(s: Siparis): number {
  return s.satirlar.reduce((t, l) => t + l.qty * (l.unitPrice ?? 0), 0);
}

function eur(s: Siparis): number {
  return eurKarsiligi(tutar(s), s.currency, s.fxRate) ?? 0;
}

export function DeliveryBoard({
  siparisler,
  canWrite,
}: {
  siparisler: Siparis[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [kip, setKip] = useState<Kip>("ay");

  const bugun = bugunISO();

  const { terminsiz, gecikmis, kutular } = useMemo(() => {
    const bekleyen = siparisler.filter((s) => !s.receivedAt);
    const terminsiz = bekleyen.filter((s) => !s.dueAt);
    const gecikmis = bekleyen
      .filter((s) => s.dueAt && (gunFarki(s.dueAt, bugun) ?? 0) < 0)
      .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

    const gelecek = bekleyen.filter((s) => s.dueAt && (gunFarki(s.dueAt, bugun) ?? 0) >= 0);
    const harita = new Map<string, Kutu>();
    for (const s of gelecek) {
      const d = kip === "ay" ? ayDonemi(s.dueAt!) : haftaDonemi(s.dueAt!);
      const kutu = harita.get(d.key) ?? { donem: d, siparisler: [], toplamEur: 0 };
      kutu.siparisler.push(s);
      kutu.toplamEur += eur(s);
      harita.set(d.key, kutu);
    }
    const kutular = [...harita.values()].sort((a, b) => a.donem.start.localeCompare(b.donem.start));
    for (const k of kutular) k.siparisler.sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
    return { terminsiz, gecikmis, kutular };
  }, [siparisler, kip, bugun]);

  function teslimAl(s: Siparis) {
    if (!canWrite) return;
    updateOrder({ id: s.id, receivedAt: bugun }).then((sonuc) => {
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(`${s.supplier} siparişi teslim alındı.`);
        router.refresh();
      }
    });
  }

  const bekleyenEur = siparisler.filter((s) => !s.receivedAt).reduce((t, s) => t + eur(s), 0);

  return (
    <div className="grid gap-3">
      <section className="flex flex-wrap items-center gap-3 border bg-card p-3">
        <div>
          <span className="oc-kicker block text-muted-foreground">Teslim Bekleyen</span>
          <span className="block font-mono text-lg tabular-nums">
            {formatNum(siparisler.filter((s) => !s.receivedAt).length)} sipariş ·{" "}
            {fmtMoney(bekleyenEur, "EUR")}
          </span>
        </div>
        {gecikmis.length > 0 && (
          <div>
            <span className="oc-kicker block text-muted-foreground">Gecikmiş</span>
            <span className="block font-mono text-lg text-destructive tabular-nums">
              {formatNum(gecikmis.length)}
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
        </span>
      </section>

      {gecikmis.length > 0 && (
        <Bant
          baslik="Gecikmiş"
          renk="kirmizi"
          alt={`${formatNum(gecikmis.length)} sipariş · ${fmtMoney(
            gecikmis.reduce((t, s) => t + eur(s), 0),
            "EUR"
          )}`}
        >
          {gecikmis.map((s) => (
            <SiparisSatiri key={s.id} s={s} bugun={bugun} canWrite={canWrite} onTeslim={teslimAl} />
          ))}
        </Bant>
      )}

      {terminsiz.length > 0 && (
        <Bant
          baslik="Termini Girilmemiş"
          renk="sari"
          alt={`${formatNum(terminsiz.length)} sipariş — ne zaman geleceği bilinmiyor`}
        >
          {terminsiz.map((s) => (
            <SiparisSatiri key={s.id} s={s} bugun={bugun} canWrite={canWrite} onTeslim={teslimAl} />
          ))}
        </Bant>
      )}

      {kutular.length === 0 && gecikmis.length === 0 && terminsiz.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Teslim bekleyen sipariş yok. Sipariş açıldığında ve termin girildiğinde burada görünür.
          </p>
        </div>
      ) : (
        kutular.map((k) => (
          <Bant
            key={k.donem.key}
            baslik={k.donem.label}
            renk="normal"
            alt={`${formatNum(k.siparisler.length)} sipariş · ${fmtMoney(k.toplamEur, "EUR")}`}
          >
            {k.siparisler.map((s) => (
              <SiparisSatiri key={s.id} s={s} bugun={bugun} canWrite={canWrite} onTeslim={teslimAl} />
            ))}
          </Bant>
        ))
      )}
    </div>
  );
}

function SiparisSatiri({
  s,
  bugun,
  canWrite,
  onTeslim,
}: {
  s: Siparis;
  bugun: string;
  canWrite: boolean;
  onTeslim: (s: Siparis) => void;
}) {
  const kalan = gunFarki(s.dueAt, bugun);
  const isler = [...new Set(s.satirlar.map((l) => l.itemNo).filter(Boolean))];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 first:border-t-0">
      <span className="min-w-[8rem] font-mono text-[12px] whitespace-nowrap">
        {s.dueAt ? tarihGoster(s.dueAt) : <span className="text-muted-foreground">termin yok</span>}
        {kalan != null && (
          <span
            className={
              "ml-1.5 " +
              (kalan < 0
                ? "text-destructive"
                : kalan <= 14
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground")
            }
          >
            {kalan < 0 ? `${Math.abs(kalan)} gün geçti` : `${kalan} gün`}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 text-[13px]">
        <span className="font-medium">{s.supplier}</span>
        {s.orderNo && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{s.orderNo}</span>}
        <span className="block font-mono text-[11px] text-muted-foreground">
          {formatNum(s.satirlar.length)} kalem
          {isler.length > 0 && ` · ${isler.slice(0, 4).join(", ")}${isler.length > 4 ? "…" : ""}`}
        </span>
      </span>
      <span className="font-mono text-[12px] tabular-nums">
        {fmtMoney(tutar(s), s.currency)}
      </span>
      {canWrite && (
        <Button type="button" size="xs" variant="outline" onClick={() => onTeslim(s)}>
          Teslim Alındı
        </Button>
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

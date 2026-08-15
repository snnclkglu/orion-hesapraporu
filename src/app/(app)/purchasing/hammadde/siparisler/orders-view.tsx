"use client";

// HAMMADDE SİPARİŞLERİ — görünüm.
//
// Teklif listesinin kardeşidir: her satır BİR sipariş, satıra basınca KALEMLER
// açılır. Kullanıcının cümlesi buydu: *"önceden sadece sipariş toplamını
// kontrol ediyordum. Yeni siparişlerde siparişe bastığımda içi de açılabilir."*
//
// ═══════════════════════════════════════════════ ÜÇ KURAL
//
// 1. **BİRİM KİLODUR ama HER SATIR KİLO DEĞİLDİR.** Sacda ticari miktar
//    kilodur (md. 24), profilde BOY olabilir. Kilo toplamı yalnız kilo birimli
//    satırlardan çıkar ve ötekiler AYRICA sayılır — bir boyu kilo saymak
//    tonajı sessizce şişirirdi.
// 2. **İPTAL EDİLMİŞ SİPARİŞ LİSTEDEN DÜŞMEZ, SOLUK BASILIR.** Silinmediği
//    için defterde durur; toplamlara girmez.
// 3. **TESLİM ORANI SATIRLARDAN OKUNUR** (`received_qty`), sipariş başlığından
//    değil: kısmi teslim en sık görülen hâldir ve "geldi/gelmedi" onu
//    anlatamaz.

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Search } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { CokluSuzgec } from "../../filters";
import { formatNum } from "@/lib/drawings/labels";
import { fmtMoney } from "@/lib/currency";
import { tarihGoster } from "@/lib/purchasing/terms";
import { trKatla } from "@/lib/drawings/tr-text";
import { HAMMADDE_ADLARI } from "@/lib/purchasing/hammadde/siniflar";
import { cn } from "@/lib/utils";
import type { HammaddeSiparisi } from "../alim-data";

/** Kategori adı — analiz çekirdeği ASCII konuşur, ekran Türkçe. */
function kategoriAdi(k: string): string {
  return (HAMMADDE_ADLARI as Record<string, string>)[k] ?? k;
}

type Durum = "acik" | "kismi" | "teslim" | "iptal";

const DURUM_ETIKET: Record<Durum, string> = {
  acik: "Bekliyor",
  kismi: "Kısmi teslim",
  teslim: "Teslim alındı",
  iptal: "İptal",
};

function durumu(s: HammaddeSiparisi): Durum {
  if (s.cancelledAt) return "iptal";
  const istenen = s.satirlar.reduce((t, l) => t + l.miktar, 0);
  const gelen = s.satirlar.reduce((t, l) => t + l.teslimAlinan, 0);
  if (istenen > 0 && gelen >= istenen) return "teslim";
  if (gelen > 0) return "kismi";
  return "acik";
}

export function OrdersView({
  siparisler,
  canWrite,
}: {
  siparisler: HammaddeSiparisi[];
  canWrite: boolean;
}) {
  const [q, setQ] = useState("");
  const [yillar, setYillar] = useState<string[]>([]);
  const [firmalar, setFirmalar] = useState<string[]>([]);
  const [durumlar, setDurumlar] = useState<string[]>([]);
  const [acik, setAcik] = useState<Set<string>>(new Set());

  const secenekler = useMemo(() => {
    const say = (f: (s: HammaddeSiparisi) => string) => {
      const m = new Map<string, number>();
      for (const s of siparisler) {
        const v = f(s);
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      }
      return m;
    };
    const yil = say((s) => s.orderedAt.slice(0, 4));
    const firma = say((s) => s.supplier);
    const durum = say((s) => durumu(s));
    return {
      yillar: [...yil.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([value, count]) => ({ value, label: value, count })),
      firmalar: [...firma.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "tr"))
        .map(([value, count]) => ({ value, label: value, count })),
      durumlar: (["acik", "kismi", "teslim", "iptal"] as Durum[])
        .filter((d) => durum.has(d))
        .map((d) => ({ value: d, label: DURUM_ETIKET[d], count: durum.get(d) ?? 0 })),
    };
  }, [siparisler]);

  const gorunen = useMemo(() => {
    const arama = trKatla(q.trim());
    const yilKume = new Set(yillar);
    const firmaKume = new Set(firmalar);
    const durumKume = new Set(durumlar);
    return siparisler.filter((s) => {
      if (yilKume.size > 0 && !yilKume.has(s.orderedAt.slice(0, 4))) return false;
      if (firmaKume.size > 0 && !firmaKume.has(s.supplier)) return false;
      if (durumKume.size > 0 && !durumKume.has(durumu(s))) return false;
      if (!arama) return true;
      const metin = trKatla(
        [s.orderNo, s.supplier, s.note, ...s.satirlar.map((l) => `${l.tanim} ${l.itemNo}`)].join(" ")
      );
      return metin.includes(arama);
    });
  }, [siparisler, q, yillar, firmalar, durumlar]);

  // TOPLAMLAR İPTALLERİ SAYMAZ: verilmemiş bir sipariş bir alım değildir.
  const canliOlanlar = gorunen.filter((s) => !s.cancelledAt);
  const toplamEur = canliOlanlar.reduce((t, s) => t + (s.toplamEur ?? 0), 0);
  const toplamKg = canliOlanlar.reduce((t, s) => t + s.toplamKg, 0);
  const kiloDisi = canliOlanlar.reduce((t, s) => t + s.kiloDisiSatir, 0);
  const bekleyen = canliOlanlar.filter((s) => durumu(s) !== "teslim").length;

  return (
    <div className="grid gap-3">
      {/* ————————————————————————————————————— özet şeridi */}
      <section className="flex flex-wrap gap-y-2 border bg-card p-3">
        <Kutu
          baslik="Sipariş"
          deger={formatNum(canliOlanlar.length)}
          alt={`${formatNum(bekleyen)} bekliyor`}
        />
        <Kutu baslik="Toplam" deger={`${formatNum(Math.round(toplamEur))} €`} alt="KDV hariç" />
        <Kutu
          baslik="Toplam Miktar"
          deger={`${formatNum(Math.round(toplamKg))} kg`}
          alt={kiloDisi > 0 ? `${formatNum(kiloDisi)} satır kilo dışı birimde` : "kilo birimli satırlar"}
        />
        <Kutu
          baslik="Tedarikçi"
          deger={formatNum(new Set(canliOlanlar.map((s) => s.supplier)).size)}
          alt="firma"
        />
      </section>

      {/* ————————————————————————————————————— süzgeçler */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sipariş No, Firma, Kalem Ara…"
            className="h-8 w-[min(18rem,calc(100vw-4rem))] pl-7 text-base pointer-fine:text-sm"
          />
        </span>
        <CokluSuzgec baslik="Yıl" secenekler={secenekler.yillar} secili={yillar} onChange={setYillar} />
        <CokluSuzgec
          baslik="Tedarikçi"
          secenekler={secenekler.firmalar}
          secili={firmalar}
          onChange={setFirmalar}
        />
        <CokluSuzgec
          baslik="Durum"
          secenekler={secenekler.durumlar}
          secili={durumlar}
          onChange={setDurumlar}
        />
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {formatNum(gorunen.length)} / {formatNum(siparisler.length)} sipariş
        </span>
      </div>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {siparisler.length === 0
              ? "Henüz hammadde siparişi yok. Havuzdan ya da teklif karşılaştırmasından sipariş açtığınızda burada listelenir."
              : "Bu süzgeçle eşleşen sipariş yok."}
          </p>
        </div>
      ) : (
        <div className="oc-scrollx overflow-x-auto border bg-card [--oc-scroll-bg:var(--card)]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-muted/50 text-left text-muted-foreground">
                <th className="w-8 px-2 py-1.5" />
                <th className="px-2 py-1.5 font-normal">Sipariş No</th>
                <th className="px-2 py-1.5 font-normal">Tedarikçi</th>
                <th className="px-2 py-1.5 font-normal">Tarih</th>
                <th className="px-2 py-1.5 font-normal">Termin</th>
                <th className="px-2 py-1.5 text-right font-normal">Kalem</th>
                <th className="px-2 py-1.5 text-right font-normal">Miktar</th>
                <th className="px-2 py-1.5 text-right font-normal">Tutar</th>
                <th className="px-2 py-1.5 text-right font-normal">Tutar €</th>
                <th className="px-2 py-1.5 font-normal">Durum</th>
                <th className="w-10 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {gorunen.map((s) => {
                const d = durumu(s);
                const secili = acik.has(s.id);
                return (
                  <React.Fragment key={s.id}>
                    <tr
                      className={cn(
                        "cursor-pointer border-t hover:bg-muted/30",
                        s.cancelledAt && "text-muted-foreground"
                      )}
                      onClick={() =>
                        setAcik((o) => {
                          const y = new Set(o);
                          if (y.has(s.id)) y.delete(s.id);
                          else y.add(s.id);
                          return y;
                        })
                      }
                    >
                      <td className="px-2 py-1.5">
                        <span className="grid size-5 place-items-center text-muted-foreground">
                          {secili ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1.5 font-mono font-medium whitespace-nowrap",
                          s.cancelledAt && "line-through"
                        )}
                      >
                        {s.orderNo || "—"}
                      </td>
                      <td className="px-2 py-1.5">{s.supplier}</td>
                      <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                        {tarihGoster(s.orderedAt)}
                      </td>
                      <td className="px-2 py-1.5 font-mono whitespace-nowrap text-muted-foreground">
                        {s.dueAt ? tarihGoster(s.dueAt) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {formatNum(s.satirlar.length)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                        {s.toplamKg > 0 ? `${formatNum(Math.round(s.toplamKg))} kg` : "—"}
                        {s.kiloDisiSatir > 0 && (
                          <span
                            className="ml-1 text-[10px] text-muted-foreground"
                            title={`${s.kiloDisiSatir} satır kilo dışı birimde (boy/adet)`}
                          >
                            +{formatNum(s.kiloDisiSatir)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                        {fmtMoney(s.toplam, s.currency)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-medium tabular-nums">
                        {s.toplamEur == null ? "—" : formatNum(Math.round(s.toplamEur))}
                      </td>
                      <td className="px-2 py-1.5">
                        <DurumCipi durum={d} />
                      </td>
                      <td className="px-2 py-1.5">
                        {/* SİPARİŞ ONAYI PDF'i — satırdan iner (md. 21). */}
                        <Link
                          href={`/purchasing/siparisler/${s.id}/pdf`}
                          onClick={(e) => e.stopPropagation()}
                          title="Sipariş onayı PDF"
                          aria-label="Sipariş onayı PDF"
                          className="oc-tap-square grid size-7 place-items-center text-muted-foreground hover:text-foreground"
                        >
                          <FileText className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                    {secili && (
                      <tr className="hover:bg-transparent">
                        <td colSpan={11} className="bg-muted/30 p-0">
                          <div className="oc-scrollx overflow-x-auto p-3 [--oc-scroll-bg:var(--muted)]">
                            <table className="w-full text-[12px]">
                              <thead>
                                <tr className="text-left text-muted-foreground">
                                  <th className="pr-3 pb-1 font-normal">Kalem</th>
                                  <th className="pr-3 pb-1 font-normal">Tür</th>
                                  <th className="pr-3 pb-1 font-normal">İş No</th>
                                  <th className="pr-3 pb-1 font-normal">Kalite</th>
                                  <th className="pr-3 pb-1 text-right font-normal">Miktar</th>
                                  <th className="pr-3 pb-1 text-right font-normal">Birim Fiyat</th>
                                  <th className="pr-3 pb-1 text-right font-normal">Tutar</th>
                                  <th className="pr-3 pb-1 text-right font-normal">Tutar €</th>
                                  <th className="pr-3 pb-1 text-right font-normal">Teslim</th>
                                </tr>
                              </thead>
                              <tbody className="font-mono tabular-nums">
                                {s.satirlar.map((l) => (
                                  <tr key={l.id} className="border-t border-border/50">
                                    <td className="py-1 pr-3 font-sans">{l.tanim}</td>
                                    <td className="py-1 pr-3 font-sans text-muted-foreground">
                                      {kategoriAdi(l.kategori)}
                                    </td>
                                    <td className="py-1 pr-3">{l.itemNo || "—"}</td>
                                    <td className="py-1 pr-3 font-sans">{l.kalite || "—"}</td>
                                    <td className="py-1 pr-3 text-right whitespace-nowrap">
                                      {formatNum(l.miktar)}{" "}
                                      <span className="text-[10px] text-muted-foreground">
                                        {l.birim}
                                      </span>
                                    </td>
                                    <td className="py-1 pr-3 text-right">
                                      {l.birimFiyat == null
                                        ? "—"
                                        : fmtMoney(l.birimFiyat, s.currency)}
                                    </td>
                                    <td className="py-1 pr-3 text-right">
                                      {l.tutar == null ? "—" : fmtMoney(l.tutar, s.currency)}
                                    </td>
                                    <td className="py-1 pr-3 text-right font-medium">
                                      {l.tutarEur == null ? "—" : formatNum(Math.round(l.tutarEur))}
                                    </td>
                                    <td
                                      className={cn(
                                        "py-1 pr-3 text-right",
                                        l.teslimAlinan >= l.miktar
                                          ? "text-emerald-700 dark:text-emerald-400"
                                          : l.teslimAlinan > 0
                                            ? "text-amber-700 dark:text-amber-400"
                                            : "text-muted-foreground"
                                      )}
                                    >
                                      {formatNum(l.teslimAlinan)} / {formatNum(l.miktar)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {s.note && (
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                Not: {s.note}
                              </p>
                            )}
                            {canWrite && (
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                Siparişi düzenlemek, iptal etmek ya da teslim almak için{" "}
                                <Link
                                  href="/purchasing/siparisler"
                                  className="underline underline-offset-2 hover:text-foreground"
                                >
                                  Siparişler
                                </Link>{" "}
                                ekranını kullanın — ticari kaydın tek yazma yeri orasıdır.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DurumCipi({ durum }: { durum: Durum }) {
  const sinif =
    durum === "teslim"
      ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      : durum === "kismi"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : durum === "iptal"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-dashed border-border text-muted-foreground";
  return (
    <span className={cn("inline-flex border px-1.5 py-0.5 text-[11px] whitespace-nowrap", sinif)}>
      {DURUM_ETIKET[durum]}
    </span>
  );
}

function Kutu({ baslik, deger, alt }: { baslik: string; deger: string; alt?: string }) {
  return (
    <div className="min-w-0 flex-1 border-l border-border/60 px-3 first:border-l-0 first:pl-0">
      <p className="oc-kicker text-[10px] text-muted-foreground">{baslik}</p>
      <p className="font-mono text-base font-medium tabular-nums">{deger}</p>
      {alt && <p className="text-[11px] text-muted-foreground">{alt}</p>}
    </div>
  );
}

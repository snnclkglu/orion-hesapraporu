"use client";

// Siparişler listesi — hâl değiştirme, süzgeç ve pano.
//
// DÖRT HÂL, DÖRDÜ DE BİR TARİHTİR ve hiçbiri bir boolean değildir:
//   sipariş verildi (ordered_at) · teslim alındı (received_at)
//   avans ödendi (advance_paid_at) · bakiye ödendi (balance_paid_at)
//
// Boolean tutulsalardı takvim sayfaları "ne zaman" sorusuna cevap veremezdi ve
// ödeme günü ile ödeme GERÇEĞİ ayrışamazdı. Tarih hem hâli hem zamanı taşır.
//
// SİPARİŞ SATIRLARI BURADA DÜZENLENMEZ (bkz. `updateOrderSchema`): verilmiş bir
// siparişin kalemlerini değiştirmek, ona bağlı teslim ve ödeme kayıtlarını
// sessizce geçersizleştirirdi. Yanlış sipariş İPTAL edilir, yenisi açılır.
//
// PANO GRAFİKLERİ `lib/diagrams` KULLANMAZ (İş Takibi'nin kuralı): o katman
// PDF'e de basılan şematik teknik resimler içindir. Burada kategorik eksen ve
// etkileşim var; `components/charts.tsx` kullanılır ve renk veriden yalnız TON
// AÇISI olarak gelir.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
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
import { DonutChart, RankBars, TimeBarChart } from "@/components/charts";
import { fmtMoney } from "@/lib/currency";
import { formatNum } from "@/lib/drawings/labels";
import {
  advanceAmount,
  eurKarsiligi,
  gunFarki,
  odemeGunu,
  paymentTermLabel,
  tarihGoster,
} from "@/lib/purchasing/terms";
import { donemlere, sirala, type Kip } from "@/lib/purchasing/summary";
import { hueFromText } from "@/lib/tags";
import { FilterBar, SearchBox } from "../../drawings/sortable-head";
import { CokluSuzgec } from "../filters";
import { KipSecici, PanoKabugu } from "../board-ui";
import type { Siparis } from "../data";
import { updateOrder } from "../actions";

function toplamOf(s: Siparis): number {
  return s.satirlar.reduce((t, l) => t + l.qty * (l.unitPrice ?? 0), 0);
}

function eurOf(s: Siparis): number {
  return eurKarsiligi(toplamOf(s), s.currency, s.fxRate) ?? 0;
}

/**
 * Siparişin değişebilen alanları — `id` HARİÇ.
 *
 * `Parameters<typeof updateOrder>[0]` kullanılamaz: o tip `id`yi ZORUNLU taşır
 * ve çağrı yerleri onu vermez (kimliği `yaz` ekler).
 */
type OrderPatch = {
  dueAt?: string;
  receivedAt?: string;
  advancePaidAt?: string;
  balancePaidAt?: string;
  cancelledAt?: string;
  note?: string;
};

type SiparisDurum = "acik" | "teslim" | "odendi" | "iptal";

const DURUM_ETIKET: Record<SiparisDurum, string> = {
  acik: "Teslim bekliyor",
  teslim: "Teslim alındı",
  odendi: "Ödendi",
  iptal: "İptal",
};

function durumu(s: Siparis): SiparisDurum {
  if (s.cancelledAt) return "iptal";
  if (s.balancePaidAt) return "odendi";
  if (s.receivedAt) return "teslim";
  return "acik";
}

interface Filtreler {
  query: string;
  tedarikciler: string[];
  durumlar: string[];
  isler: string[];
}

const BOS: Filtreler = { query: "", tedarikciler: [], durumlar: [], isler: [] };

export function OrdersView({
  siparisler,
  canWrite,
}: {
  siparisler: Siparis[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();
  const [f, setF] = useState<Filtreler>(BOS);
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [pano, setPano] = useState(true);
  const [kip, setKip] = useState<Kip>("ay");

  const isNolari = useMemo(
    () => (s: Siparis) => [...new Set(s.satirlar.map((l) => l.itemNo).filter(Boolean))],
    []
  );

  const secenekler = useMemo(() => {
    const say = (fn: (s: Siparis) => string[]) => {
      const m = new Map<string, number>();
      for (const s of siparisler) for (const v of fn(s)) m.set(v, (m.get(v) ?? 0) + 1);
      return m;
    };
    const ted = say((s) => [s.supplier]);
    const dur = say((s) => [durumu(s)]);
    const is = say(isNolari);
    return {
      tedarikciler: [...ted.keys()]
        .sort((a, b) => a.localeCompare(b, "tr"))
        .map((v) => ({ value: v, label: v, count: ted.get(v) })),
      durumlar: (["acik", "teslim", "odendi", "iptal"] as SiparisDurum[])
        .filter((d) => dur.has(d))
        .map((d) => ({ value: d, label: DURUM_ETIKET[d], count: dur.get(d) })),
      isler: [...is.keys()]
        .sort((a, b) => a.localeCompare(b, "tr"))
        .map((v) => ({ value: v, label: v, count: is.get(v) })),
    };
  }, [siparisler, isNolari]);

  const gorunen = useMemo(() => {
    const q = f.query.trim().toLocaleLowerCase("tr-TR");
    const ted = new Set(f.tedarikciler);
    const dur = new Set(f.durumlar);
    const is = new Set(f.isler);
    return siparisler.filter((s) => {
      if (ted.size > 0 && !ted.has(s.supplier)) return false;
      if (dur.size > 0 && !dur.has(durumu(s))) return false;
      if (is.size > 0 && !isNolari(s).some((n) => is.has(n))) return false;
      if (!q) return true;
      return [s.supplier, s.orderNo, s.note, ...s.satirlar.map((l) => `${l.sample} ${l.itemNo}`)]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(q);
    });
  }, [siparisler, f, isNolari]);

  function yaz(id: string, alanlar: OrderPatch, mesaj: string) {
    basla(async () => {
      const sonuc = await updateOrder({ ...alanlar, id });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(mesaj);
        router.refresh();
      }
    });
  }

  // MEMOLANIR ÇÜNKÜ ALTINDAKİ ÜÇ `useMemo` BUNA BAĞLI. Satır içi `.filter()`
  // her boyamada yeni bir dizi üretir; React Compiler o diziyi "sonradan
  // değişebilir" sayıp bütün bileşenin optimizasyonunu atlıyordu (lint hatası).
  const acikSiparis = useMemo(() => gorunen.filter((s) => !s.cancelledAt), [gorunen]);
  const bekleyenTutar = acikSiparis
    .filter((s) => !s.balancePaidAt)
    .reduce((t, s) => t + eurOf(s), 0);

  // ————————————————————————————————————————————————————————————— pano
  const tedarikciCubuklari = useMemo(
    () =>
      sirala(acikSiparis, (s) => s.supplier, eurOf, {
        ipucu: (_ad, liste) => `${liste.length} sipariş`,
      }),
    [acikSiparis]
  );

  const durumHalkasi = useMemo(() => {
    const toplam = gorunen.reduce((t, s) => t + eurOf(s), 0);
    return (["acik", "teslim", "odendi", "iptal"] as SiparisDurum[])
      .map((d) => {
        const grup = gorunen.filter((s) => durumu(s) === d);
        const value = grup.reduce((t, s) => t + eurOf(s), 0);
        return {
          key: d,
          label: DURUM_ETIKET[d],
          hue: hueFromText(d),
          value,
          share: toplam > 0 ? value / toplam : 0,
          records: grup.length,
        };
      })
      .filter((x) => x.value > 0);
  }, [gorunen]);

  const zamanSerisi = useMemo(() => {
    const { kutular } = donemlere(acikSiparis, (s) => s.orderedAt || null, eurOf, kip);
    return kutular.map((k) => ({
      key: k.donem.key,
      label: k.donem.label,
      total: k.toplam,
      parts: { siparis: k.toplam },
    }));
  }, [acikSiparis, kip]);

  const eurFmt = (v: number) => fmtMoney(v, "EUR");

  return (
    <div className="grid gap-3">
      <section className="grid gap-2 border bg-card p-3 sm:grid-cols-4">
        <Ozet baslik="Açık Sipariş" deger={formatNum(acikSiparis.length)} />
        <Ozet
          baslik="Teslim Bekleyen"
          deger={formatNum(acikSiparis.filter((s) => !s.receivedAt).length)}
        />
        <Ozet baslik="Ödenmemiş (avro)" deger={fmtMoney(bekleyenTutar, "EUR")} />
        <div className="flex items-end justify-end">
          <Button
            type="button"
            size="xs"
            variant={pano ? "default" : "outline"}
            onClick={() => setPano((p) => !p)}
          >
            <BarChart3 className="size-3" />
            Pano
          </Button>
        </div>
      </section>

      {pano && gorunen.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <PanoKabugu
            baslik="Sipariş Akışı"
            alt={`${zamanSerisi.length} dönem · ${fmtMoney(
              acikSiparis.reduce((t, s) => t + eurOf(s), 0),
              "EUR"
            )}`}
            eylem={<KipSecici kip={kip} onChange={setKip} />}
          >
            <TimeBarChart
              columns={zamanSerisi}
              series={[{ key: "siparis", label: "Sipariş tutarı", hue: 210 }]}
              valueLabel="€"
              format={eurFmt}
              height={180}
            />
          </PanoKabugu>

          <PanoKabugu
            baslik="Tedarikçi Dağılımı"
            alt={`${tedarikciCubuklari.length} tedarikçi`}
          >
            <RankBars
              items={tedarikciCubuklari}
              limit={8}
              valueLabel="€"
              format={eurFmt}
              emptyText="Açık sipariş yok"
              onSelect={(k) =>
                setF((s) => ({
                  ...s,
                  tedarikciler: s.tedarikciler.includes(k)
                    ? s.tedarikciler.filter((x) => x !== k)
                    : [...s.tedarikciler, k],
                }))
              }
              selected={f.tedarikciler.length === 1 ? f.tedarikciler[0] : null}
            />
          </PanoKabugu>

          <PanoKabugu baslik="Durum Kırılımı" alt={`${gorunen.length} sipariş`} className="lg:col-span-2">
            <DonutChart
              items={durumHalkasi}
              centerValue={fmtMoney(
                gorunen.reduce((t, s) => t + eurOf(s), 0),
                "EUR"
              )}
              centerLabel="Toplam"
              format={eurFmt}
            />
          </PanoKabugu>
        </div>
      )}

      <FilterBar
        gorunen={gorunen.length}
        toplam={siparisler.length}
        temiz={JSON.stringify(f) === JSON.stringify(BOS)}
        onTemizle={() => setF(BOS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Tedarikçi, Sipariş No, Kalem Ara…"
          className="w-[min(18rem,calc(100vw-4rem))]"
        />
        <CokluSuzgec
          baslik="Tedarikçi"
          secenekler={secenekler.tedarikciler}
          secili={f.tedarikciler}
          onChange={(v) => setF((s) => ({ ...s, tedarikciler: v }))}
        />
        <CokluSuzgec
          baslik="İş"
          secenekler={secenekler.isler}
          secili={f.isler}
          onChange={(v) => setF((s) => ({ ...s, isler: v }))}
        />
        <CokluSuzgec
          baslik="Durum"
          secenekler={secenekler.durumlar}
          secili={f.durumlar}
          onChange={(v) => setF((s) => ({ ...s, durumlar: v }))}
        />
        {calisiyor && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </FilterBar>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {siparisler.length === 0
              ? "Henüz sipariş açılmamış. Talep Havuzu'ndan kalem seçip “Sipariş Aç” ile başlayın."
              : "Bu süzgeçle eşleşen sipariş yok."}
          </p>
        </div>
      ) : (
        <div className="oc-scrollx border bg-card [--oc-scroll-bg:var(--card)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-8 p-0" />
                <TableHead>Tedarikçi</TableHead>
                <TableHead className="hidden md:table-cell">Sipariş No</TableHead>
                <TableHead>Sipariş</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead className="hidden lg:table-cell">Ödeme</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((s) => {
                const genis = acik.has(s.id);
                const toplam = toplamOf(s);
                const eur = eurKarsiligi(toplam, s.currency, s.fxRate);
                const odeme = odemeGunu(s);
                const kalanGun = gunFarki(s.dueAt);
                const avans = advanceAmount(toplam, s.advancePct, s.advanceAmount);
                return (
                  <>
                    <TableRow key={s.id} className={s.cancelledAt ? "opacity-50" : undefined}>
                      <TableCell className="p-0 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            setAcik((o) => {
                              const y = new Set(o);
                              if (y.has(s.id)) y.delete(s.id);
                              else y.add(s.id);
                              return y;
                            })
                          }
                          aria-expanded={genis}
                          aria-label={genis ? "Kalemleri gizle" : "Kalemleri göster"}
                          className="flex min-h-10 w-8 items-center justify-center text-muted-foreground pointer-coarse:min-h-11 hover:text-foreground"
                        >
                          {genis ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <span className="block text-[13px] font-medium">{s.supplier}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {formatNum(s.satirlar.length)} kalem
                          {isNolari(s).length > 0 && ` · ${isNolari(s).join(", ")}`}
                        </span>
                      </TableCell>
                      <TableCell className="hidden align-top font-mono text-[12px] md:table-cell">
                        {s.orderNo || "—"}
                      </TableCell>
                      <TableCell className="align-top font-mono text-[12px] whitespace-nowrap">
                        {tarihGoster(s.orderedAt)}
                      </TableCell>
                      <TableCell className="align-top font-mono text-[12px] whitespace-nowrap">
                        {s.receivedAt ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {tarihGoster(s.receivedAt)} ✓
                          </span>
                        ) : s.dueAt ? (
                          <span
                            className={
                              kalanGun != null && kalanGun < 0
                                ? "text-destructive"
                                : kalanGun != null && kalanGun <= 14
                                  ? "text-amber-700 dark:text-amber-400"
                                  : ""
                            }
                            title={
                              kalanGun == null
                                ? undefined
                                : kalanGun < 0
                                  ? `${Math.abs(kalanGun)} gün gecikti`
                                  : `${kalanGun} gün kaldı`
                            }
                          >
                            {tarihGoster(s.dueAt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden align-top text-[12px] lg:table-cell">
                        <span className="block">
                          {paymentTermLabel(s.paymentMethod, s.paymentTermDays)}
                        </span>
                        {odeme && (
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {tarihGoster(odeme)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-right font-mono text-[13px] tabular-nums">
                        {fmtMoney(toplam, s.currency)}
                        {eur != null && s.currency !== "EUR" && (
                          <span className="block text-[11px] text-muted-foreground">
                            {fmtMoney(eur, "EUR")}
                          </span>
                        )}
                        {avans > 0 && (
                          <span className="block text-[11px] text-muted-foreground">
                            avans {fmtMoney(avans, s.currency)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <HalCipleri s={s} canWrite={canWrite} onYaz={yaz} avans={avans} />
                      </TableCell>
                    </TableRow>

                    {genis && (
                      <TableRow key={`${s.id}-detay`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={8} className="whitespace-normal p-0">
                          <div className="oc-scrollx px-3 py-2 [--oc-scroll-bg:var(--muted)]">
                            <table className="w-full text-[12px]">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="py-1 pr-3 text-left font-normal">Kalem</th>
                                  <th className="py-1 pr-3 text-left font-normal">İş</th>
                                  <th className="py-1 pr-3 text-right font-normal">Adet</th>
                                  <th className="py-1 pr-3 text-right font-normal">Birim</th>
                                  <th className="py-1 text-right font-normal">Tutar</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.satirlar.map((l) => (
                                  <tr key={l.id} className="border-t border-border/50">
                                    <td className="py-1 pr-3">{l.sample}</td>
                                    <td className="py-1 pr-3 font-mono">{l.itemNo || "—"}</td>
                                    <td className="py-1 pr-3 text-right font-mono tabular-nums">
                                      {formatNum(l.qty)}
                                    </td>
                                    <td className="py-1 pr-3 text-right font-mono tabular-nums">
                                      {l.unitPrice == null ? "—" : fmtMoney(l.unitPrice, s.currency)}
                                    </td>
                                    <td className="py-1 text-right font-mono tabular-nums">
                                      {fmtMoney(l.qty * (l.unitPrice ?? 0), s.currency)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {s.note && (
                              <p className="mt-2 text-[12px] text-muted-foreground">{s.note}</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/**
 * Hâl çipleri — her biri bir TARİH yazar.
 *
 * Tarih alanı çipin yanında durur ve boş bırakılabilir: satınalmacı çoğu zaman
 * "geldi" der ama günü sonra hatırlar.
 */
function HalCipleri({
  s,
  canWrite,
  avans,
  onYaz,
}: {
  s: Siparis;
  canWrite: boolean;
  avans: number;
  onYaz: (id: string, alanlar: OrderPatch, mesaj: string) => void;
}) {
  const [teslimGunu, setTeslimGunu] = useState("");
  const bugun = new Date().toISOString().slice(0, 10);

  if (s.cancelledAt) {
    return (
      <span className="inline-flex min-h-7 items-center border border-dashed px-1.5 text-[11px] text-muted-foreground">
        İptal · {tarihGoster(s.cancelledAt)}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-start gap-1">
      {s.receivedAt ? (
        <Cip
          renk="yesil"
          etiket="Teslim alındı"
          onClick={canWrite ? () => onYaz(s.id, { receivedAt: "" }, "Teslim işareti kaldırıldı.") : undefined}
          baslik="Dokunmak teslim işaretini kaldırır"
        />
      ) : (
        canWrite && (
          <span className="flex items-center gap-1">
            <Input
              type="date"
              value={teslimGunu}
              onChange={(e) => setTeslimGunu(e.target.value)}
              className="h-7 w-[8.5rem] font-mono text-base pointer-fine:text-xs"
              aria-label="Teslim günü"
            />
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => onYaz(s.id, { receivedAt: teslimGunu || bugun }, "Teslim alındı.")}
            >
              Teslim
            </Button>
          </span>
        )
      )}

      {avans > 0 &&
        (s.advancePaidAt ? (
          <Cip
            renk="yesil"
            etiket={`Avans ödendi · ${tarihGoster(s.advancePaidAt)}`}
            onClick={canWrite ? () => onYaz(s.id, { advancePaidAt: "" }, "Avans işareti kaldırıldı.") : undefined}
          />
        ) : (
          canWrite && (
            <Cip
              renk="bos"
              etiket="Avans ödendi"
              onClick={() => onYaz(s.id, { advancePaidAt: bugun }, "Avans ödendi.")}
            />
          )
        ))}

      {s.balancePaidAt ? (
        <Cip
          renk="yesil"
          etiket={`Ödendi · ${tarihGoster(s.balancePaidAt)}`}
          onClick={canWrite ? () => onYaz(s.id, { balancePaidAt: "" }, "Ödeme işareti kaldırıldı.") : undefined}
        />
      ) : (
        canWrite && (
          <Cip
            renk="bos"
            etiket="Bakiye ödendi"
            onClick={() => onYaz(s.id, { balancePaidAt: bugun }, "Ödeme kaydedildi.")}
          />
        )
      )}

      {canWrite && !s.receivedAt && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Sipariş iptal edilsin mi? Kayıt silinmez, takvimlerden düşer."))
              onYaz(s.id, { cancelledAt: bugun }, "Sipariş iptal edildi.");
          }}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
        >
          İptal et
        </button>
      )}
    </span>
  );
}

function Cip({
  renk,
  etiket,
  onClick,
  baslik,
}: {
  renk: "yesil" | "bos";
  etiket: string;
  onClick?: () => void;
  baslik?: string;
}) {
  const sinif =
    renk === "yesil"
      ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      : "border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={baslik}
      className={`inline-flex min-h-7 items-center border px-1.5 text-[11px] whitespace-nowrap transition-colors pointer-coarse:min-h-9 disabled:cursor-default ${sinif}`}
    >
      {etiket}
    </button>
  );
}

function Ozet({ baslik, deger }: { baslik: string; deger: string }) {
  return (
    <div>
      <span className="oc-kicker block text-muted-foreground">{baslik}</span>
      <span className="block font-mono text-lg tabular-nums">{deger}</span>
    </div>
  );
}

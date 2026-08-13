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
// SİPARİŞ ARTIK DÜZENLENEBİLİR (kullanıcı kararı, 13.08.2026). Bir süre
// düzenlenemiyordu ve gerekçesi "yanlış sipariş İPTAL edilir, yenisi açılır"
// idi; iptal + yeniden açmak yanlış yazılmış tek bir birim fiyat için çok
// pahalı bir yoldu (numara yanıyor, teslim ve ödeme işaretleri baştan
// giriliyor). Riskin nasıl kapatıldığı `editOrderSchema`da yazılı.
//
// EKRAN İKİ AYRI YAZMA YOLU TAŞIR ve ikisi karıştırılmaz: ÇİPLER tek bir
// OLGUYU işaretler (teslim alındı, ödendi, termin girildi) ve tek alan yazar;
// DÜZENLE penceresi kaydın tamamını yeniden yazar.
//
// PANO GRAFİKLERİ `lib/diagrams` KULLANMAZ (İş Takibi'nin kuralı): o katman
// PDF'e de basılan şematik teknik resimler içindir. Burada kategorik eksen ve
// etkileşim var; `components/charts.tsx` kullanılır ve renk veriden yalnız TON
// AÇISI olarak gelir.

import { forwardRef, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, ChevronDown, ChevronRight, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OdemeTarihi } from "@/components/odeme-tarihi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RankBars, SplitBar, TimeBarChart } from "@/components/charts";
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
import type { Siparis, TedarikciKaydi } from "../data";
import type { GunlukKur } from "@/lib/purchasing/kur";
import { updateOrder } from "../actions";
import { OrderEditDialog } from "./order-edit-dialog";

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
  tedarikciler,
  defter,
  siparisNolari,
  sonKur,
  canWrite,
}: {
  siparisler: Siparis[];
  /** Düzenleme penceresinin tedarikçi önerileri. */
  tedarikciler: string[];
  /** Firma defteri (ad + kod). */
  defter: TedarikciKaydi[];
  /** Kullanılmış bütün sipariş numaraları — çakışma denetimi için. */
  siparisNolari: string[];
  sonKur?: GunlukKur | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();
  const [f, setF] = useState<Filtreler>(BOS);
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [duzenlenen, setDuzenlenen] = useState<Siparis | null>(null);
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

  const durumSeridi = useMemo(() => {
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

          {/* DURUM BİR AŞAMA SIRASIDIR, bir pasta dilimi değil (kullanıcı
              bildirimi, 13.08.2026): bekleyen → teslim alınan → ödenen. Şerit
              soldan sağa okunur ve iki yakın payı uzunlukla karşılaştırır;
              halkada bu ancak yandaki sayıdan anlaşılıyordu. */}
          <PanoKabugu baslik="Durum Kırılımı" alt={`${gorunen.length} sipariş`} className="lg:col-span-2">
            <SplitBar
              items={durumSeridi}
              format={eurFmt}
              valueLabel="€"
              emptyText="Sipariş yok"
              toplamEtiketi="Toplam"
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

      {duzenlenen && (
        <OrderEditDialog
          key={duzenlenen.id}
          siparis={duzenlenen}
          tedarikciler={tedarikciler}
          defter={defter}
          siparisNolari={siparisNolari}
          sonKur={sonKur}
          onClose={() => setDuzenlenen(null)}
          onSaved={() => {
            setDuzenlenen(null);
            router.refresh();
          }}
        />
      )}

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
                        ) : (
                          <TerminAlani
                            // DEĞER PROP'TAN TAZELENİR ve bunun yolu KİMLİKtir,
                            // bir `useEffect` değil: kutunun kendi durumu
                            // kaydetme tamamlanana kadar kullanıcının seçtiği
                            // günü göstermeli, sunucudan yeni bir tarih
                            // geldiğinde ise sıfırlanmalıdır. `key` değişince
                            // React bileşeni yeniden kurar — efektle yapılan
                            // senkronizasyon basamaklı boyama üretirdi.
                            key={s.dueAt ?? "bos"}
                            s={s}
                            canWrite={canWrite && !s.cancelledAt}
                            kalanGun={kalanGun}
                            onYaz={yaz}
                          />
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
                        <HalCipleri
                          s={s}
                          canWrite={canWrite}
                          onYaz={yaz}
                          avans={avans}
                          onDuzenle={() => setDuzenlenen(s)}
                        />
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
 * TERMİN HÜCRESİ — okunur ve YAZILIR.
 *
 * Kullanıcı kararı (13.08.2026): *"Termin tarihi girilmeden sipariş
 * açılabilsin ancak daha sonra siparişler bölümünden termin tarihi
 * girilebilsin. Termin tarihi girilmiş bir siparişin termin tarihi
 * değiştirilebilsin."*
 *
 * TERMİN BİR TAHMİNDİR ve tahmin değişir: tedarikçi "iki hafta gecikecek"
 * dediğinde bunu yazacak bir yer olmalıydı. Alanın kendisi bir kutudur, ayrı
 * bir düzenleme penceresi değil — satınalmacının en sık yaptığı düzeltme budur
 * ve pencere açtırmak onu üç tıka çıkarırdı (durum çipinin kuralının aynısı).
 *
 * DEĞER PROP'TAN TAZELENİR ama bunu bir `useEffect` YAPMAZ: çağrı yerindeki
 * `key` tarihin kendisidir, yani sunucudan yeni bir termin geldiğinde bileşen
 * yeniden kurulur. Efektle senkronize etmek basamaklı boyama üretir (projenin
 * `react-hooks/set-state-in-effect` kuralı) ve gerekmiyor.
 */
function TerminAlani({
  s,
  canWrite,
  kalanGun,
  onYaz,
}: {
  s: Siparis;
  canWrite: boolean;
  kalanGun: number | null;
  onYaz: (id: string, alanlar: OrderPatch, mesaj: string) => void;
}) {
  const [gun, setGun] = useState(s.dueAt ?? "");

  const renk =
    kalanGun != null && kalanGun < 0
      ? "text-destructive"
      : kalanGun != null && kalanGun <= 14
        ? "text-amber-700 dark:text-amber-400"
        : "";
  const ipucu =
    kalanGun == null
      ? undefined
      : kalanGun < 0
        ? `${Math.abs(kalanGun)} gün gecikti`
        : `${kalanGun} gün kaldı`;

  if (!canWrite) {
    return s.dueAt ? (
      <span className={renk} title={ipucu}>
        {tarihGoster(s.dueAt)}
      </span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Input
        type="date"
        value={gun}
        onChange={(e) => {
          const yeni = e.target.value;
          setGun(yeni);
          onYaz(
            s.id,
            { dueAt: yeni },
            yeni ? `Termin ${tarihGoster(yeni)} olarak kaydedildi.` : "Termin temizlendi."
          );
        }}
        title={ipucu}
        aria-label={`${s.supplier} siparişinin termini`}
        className={`h-7 w-[8.5rem] font-mono text-base pointer-fine:text-xs ${renk}`}
      />
      {kalanGun != null && kalanGun < 0 && (
        <span className="text-[10px] text-destructive">{Math.abs(kalanGun)}g</span>
      )}
    </span>
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
  onDuzenle,
}: {
  s: Siparis;
  canWrite: boolean;
  avans: number;
  onYaz: (id: string, alanlar: OrderPatch, mesaj: string) => void;
  onDuzenle: () => void;
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

  // DÖRT DENETİM YAN YANA (kullanıcı bildirimi, 13.08.2026: *"Siparişler
  // sayfasında satır çok yer kaplıyor … Bakiye ödendi ve İptal et tuşu
  // Teslim'in yanına alınsın"*). Alt alta dizildiklerinde tek bir sipariş
  // satırı dört satır boyu yer kaplıyordu ve on siparişlik bir liste ekrana
  // sığmıyordu. `flex-wrap` dar ekranda yine alt alta iner — md. 12'nin
  // "eylemler küçülemeyen bir kutu olmaz" kuralı.
  return (
    <span className="flex flex-wrap items-center gap-1">
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

      {/* ÖDEME GÜNÜ SORULUR (kullanıcı kararı, 13.08.2026). İşaretli çipe
          dokunmak da aynı pencereyi açar: yanlış girilmiş bir günü düzeltmenin
          yolu "kaldır + yeniden işaretle" olmamalı — o iki adım, ve arada
          kaydın ödeme takviminden düşmesi demek. */}
      {avans > 0 &&
        (canWrite ? (
          <OdemeTarihi
            baslik="Avans ödendi"
            varsayilan={s.advancePaidAt ?? undefined}
            onSec={(t) => onYaz(s.id, { advancePaidAt: t }, "Avans ödendi.")}
            onKaldir={
              s.advancePaidAt
                ? () => onYaz(s.id, { advancePaidAt: "" }, "Avans işareti kaldırıldı.")
                : undefined
            }
          >
            <Cip
              renk={s.advancePaidAt ? "yesil" : "bos"}
              etiket={
                s.advancePaidAt ? `Avans ödendi · ${tarihGoster(s.advancePaidAt)}` : "Avans ödendi"
              }
              tetikleyici
              baslik="Ödeme gününü seç"
            />
          </OdemeTarihi>
        ) : (
          s.advancePaidAt && (
            <Cip renk="yesil" etiket={`Avans ödendi · ${tarihGoster(s.advancePaidAt)}`} />
          )
        ))}

      {canWrite ? (
        <OdemeTarihi
          baslik="Bakiye ödendi"
          varsayilan={s.balancePaidAt ?? undefined}
          onSec={(t) => onYaz(s.id, { balancePaidAt: t }, "Ödeme kaydedildi.")}
          onKaldir={
            s.balancePaidAt
              ? () => onYaz(s.id, { balancePaidAt: "" }, "Ödeme işareti kaldırıldı.")
              : undefined
          }
        >
          <Cip
            renk={s.balancePaidAt ? "yesil" : "bos"}
            etiket={s.balancePaidAt ? `Ödendi · ${tarihGoster(s.balancePaidAt)}` : "Bakiye ödendi"}
            tetikleyici
            baslik="Ödeme gününü seç"
          />
        </OdemeTarihi>
      ) : (
        s.balancePaidAt && <Cip renk="yesil" etiket={`Ödendi · ${tarihGoster(s.balancePaidAt)}`} />
      )}

      {/* DÜZENLE İPTALİN SOLUNDADIR: sık olan hareket odur ve yıkıcı olanla
          yan yana durduğunda parmakla yanlış düğmeye basmak kolaylaşır. */}
      {canWrite && (
        <button
          type="button"
          onClick={onDuzenle}
          title="Siparişi düzenle — tedarikçi, numara, tarih, ödeme koşulu ve kalemler"
          className="oc-tap inline-flex min-h-7 items-center gap-1 border border-dashed px-1.5 text-[11px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <Pencil className="size-3" />
          Düzenle
        </button>
      )}

      {canWrite && !s.receivedAt && (
        <IptalOnayi s={s} onIptal={() => onYaz(s.id, { cancelledAt: bugun }, "Sipariş iptal edildi.")} />
      )}
    </span>
  );
}

/**
 * REF İLETİR — `PopoverTrigger asChild` bunu şart koşar.
 *
 * Radix tetikleyiciyi çocuğun KENDİSİ yapar (fazladan bir sarmalayıcı düğüm
 * eklemez) ve bunun için ref'e ihtiyacı vardır; düz bir fonksiyon bileşeni
 * verilseydi popover konumlanamaz ve konsola uyarı basardı.
 *
 * `onClick` VERİLMEDİĞİNDE ÇİP PASİFTİR ama popover tetikleyicisi olarak
 * kullanıldığında tıklamayı Radix'in kendisi bağlar; o yüzden `tetikleyici`
 * ayrı bir bayraktır — no-op bir `onClick` geçmek "bu düğme bir şey yapıyor"
 * yalanını koda yazmak olurdu.
 */
const Cip = forwardRef<
  HTMLButtonElement,
  {
    renk: "yesil" | "bos";
    etiket: string;
    onClick?: () => void;
    baslik?: string;
    tetikleyici?: boolean;
  } & React.ComponentPropsWithoutRef<"button">
>(function Cip({ renk, etiket, onClick, baslik, tetikleyici, ...rest }, ref) {
  const sinif =
    renk === "yesil"
      ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      : "border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={!onClick && !tetikleyici}
      title={baslik}
      className={`inline-flex min-h-7 items-center border px-1.5 text-[11px] whitespace-nowrap transition-colors pointer-coarse:min-h-9 disabled:cursor-default ${sinif}`}
      {...rest}
    >
      {etiket}
    </button>
  );
});

function Ozet({ baslik, deger }: { baslik: string; deger: string }) {
  return (
    <div>
      <span className="oc-kicker block text-muted-foreground">{baslik}</span>
      <span className="block font-mono text-lg tabular-nums">{deger}</span>
    </div>
  );
}

/**
 * İPTAL ONAYI — `window.confirm` DEĞİL.
 *
 * Kullanıcı kararı (13.08.2026): *"İptal Et tuşuna basıldığında pop-up açılsın,
 * oradan soru sorulsun 'emin misin' gibi."* Tarayıcının kendi kutusu üç şeyi
 * birden yapamıyordu: uygulamanın dilinde konuşmak, NEYİN iptal edildiğini
 * (firma, tutar, kalem sayısı) göstermek ve ne olacağını yazmak.
 *
 * PENCERE KARARI YAVAŞLATIR ama ZORLAŞTIRMAZ: silme onayındaki gibi bir
 * sözcük yazdırmaz (md. 18) — iptal GERİ ALINABİLİR bir işarettir, kayıt
 * silinmez ve yanlışlıkla basılırsa aynı yerden geri alınır.
 */
function IptalOnayi({ s, onIptal }: { s: Siparis; onIptal: () => void }) {
  const [acik, setAcik] = useState(false);
  const toplam = toplamOf(s);

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="oc-tap min-h-7 px-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
      >
        İptal et
      </button>

      <Dialog open={acik} onOpenChange={setAcik}>
        <DialogContent className="sm:max-w-[min(28rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle className="text-base">Sipariş iptal edilsin mi?</DialogTitle>
            <DialogDescription className="text-[12px]">
              Kayıt SİLİNMEZ; sipariş iptal işareti alır, teslim ve ödeme
              takvimlerinden düşer ve kalemleri talep havuzuna geri döner.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid gap-1 border bg-muted/30 p-3 text-[12px]">
            <span className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Tedarikçi</dt>
              <dd className="font-medium">{s.supplier}</dd>
            </span>
            {s.orderNo && (
              <span className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Sipariş no</dt>
                <dd className="font-mono">{s.orderNo}</dd>
              </span>
            )}
            <span className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Kalem</dt>
              <dd className="font-mono tabular-nums">{formatNum(s.satirlar.length)}</dd>
            </span>
            <span className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Tutar</dt>
              <dd className="font-mono tabular-nums">{fmtMoney(toplam, s.currency)}</dd>
            </span>
          </dl>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onIptal();
                setAcik(false);
              }}
            >
              Siparişi iptal et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

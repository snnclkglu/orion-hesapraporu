"use client";

// BİR TEKLİFİN PENCERESİ — "hangi firma ne teklif verdi".
//
// Kullanıcı isteği (15.08.2026), gösterdiği çalışma dosyasıyla birlikte:
//
//   Tanımı | Miktar-Ağırlık (Kg) | EAG DEMİR (90 Gün) | Teslim | RZK (90 Gün) | …
//   HEA 120 |               360  | 38,00 |  13.680 | 20 Gün | 37,50 | 13.500 | Hazır
//   ─────────────────────────────────────────────────────────────────────────────
//   Toplam  |             6.530  |       | 266.240 |        |       | 261.165
//
// *"Teklifin üstüne tıkladığımda bir pop up açılsın ve hangi firma ne teklif
// verdi görebileyim. örneğin ekli ekran görüntüsü gibi."*
//
// ═══════════════════════════════════════════ PENCEREDE ÜÇ KATMAN VAR
//
//   1. KARAR ŞERİDİ — satır satır en ucuz (bölünmüş siparişin tabanı), tek
//      firmadan en ucuz, seçili dağılımın bedeli ve "Sipariş Aç".
//   2. MATRİS — yukarıdaki tablo. Bir tutara basmak o teklifi SEÇER; farklı
//      satırlarda farklı firma seçilirse sipariş firmaya göre BÖLÜNÜR.
//   3. FİRMALAR — teklifi düzenle · ayır · iptal et · geri al · sil.
//
// SÜTUN PARTİDİR, TEDARİKÇİ DEĞİL: aynı firmadan iki hafta arayla alınmış iki
// teklif AYRI sütunlardır; tek sütunda eritmek hangisinin geçerli olduğunu
// ekranda cevapsız bırakırdı.

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Split,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderDialog, type SiparisKalemi } from "../../order-dialog";
import type { TedarikciKaydi } from "../../data";
import type { GunlukKur } from "@/lib/purchasing/kur";
import { formatNum } from "@/lib/drawings/labels";
import { fmtMoney } from "@/lib/currency";
import { tarihGoster } from "@/lib/purchasing/terms";
import { teslimYazisi, vadeYazisi } from "@/lib/purchasing/hammadde/karsilastirma";
import { cn } from "@/lib/utils";
import {
  cancelQuoteBatch,
  deleteQuoteBatch,
  mergeQuoteBatches,
  renameQuoteRequest,
  reopenQuoteBatch,
  splitQuoteBatch,
} from "../../actions";
import { QuoteBatchDialog } from "./batch-dialog";
import type { Pay, PartiOzeti, TalepGorunumu } from "./types";

export function RequestDialog({
  talep,
  siparisAdetleri,
  paylar,
  tedarikciler,
  defter,
  siparisNolari,
  sonKur,
  qualities,
  canWrite,
  isAdmin,
  onClose,
}: {
  talep: TalepGorunumu;
  siparisAdetleri: [string, number][];
  paylar: Record<string, Pay[]>;
  tedarikciler: string[];
  defter: TedarikciKaydi[];
  siparisNolari: string[];
  sonKur?: GunlukKur | null;
  qualities: string[];
  canWrite: boolean;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();
  const [siparisKalemleri, setSiparisKalemleri] = useState<SiparisKalemi[] | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<PartiOzeti | null>(null);
  const [gorunum, setGorunum] = useState<"birlesik" | "ayri">("birlesik");
  const [adDuzenle, setAdDuzenle] = useState<string | null>(null);

  const { tablo } = talep;

  /** Satır anahtarı → seçilen SÜTUN (parti). Varsayılan EN UCUZudur. */
  const [secim, setSecim] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tablo.satirlar.filter((s) => s.enUcuzTedarikci).map((s) => [s.kalem.key, s.enUcuzTedarikci])
    )
  );

  const siparisHaritasi = useMemo(() => new Map(siparisAdetleri), [siparisAdetleri]);
  const birimler = useMemo(
    () => new Map(tablo.satirlar.map((s) => [s.kalem.key, s.kalem.birim])),
    [tablo]
  );

  function eylem(is: () => Promise<{ error?: string; ok?: number; no?: string }>, basarili: string) {
    basla(async () => {
      const sonuc = await is();
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(sonuc.no ? `${basarili} (${sonuc.no})` : basarili);
      router.refresh();
    });
  }

  /**
   * SİPARİŞ FİRMAYA GÖRE BÖLÜNÜR.
   *
   * `OrderDialog` TEK tedarikçiye yazar (sipariş numarası onun kodundan
   * türüyor). İki firmadan alınacaksa iki ayrı sipariş açılır — kullanıcının
   * *"ya da bölüp de sipariş de verebiliriz"* dediği şey budur.
   */
  function siparisAc(sutunKey: string) {
    const sutun = tablo.sutunlar.find((c) => c.key === sutunKey);
    if (!sutun) return;
    const kalemler: SiparisKalemi[] = tablo.satirlar
      .filter((s) => secim[s.kalem.key] === sutunKey)
      .map((s) => {
        const h = s.hucreler.get(sutunKey);
        const alinan = siparisHaritasi.get(s.kalem.key) ?? 0;
        const kalan = Math.max(0, (s.kalem.miktar ?? 0) - alinan);
        return {
          matchKey: s.kalem.key,
          tanim: s.kalem.tanim,
          kalan: kalan || s.kalem.miktar || 1,
          birimFiyat: h?.birimFiyatEur ?? null,
          paraBirimi: "EUR",
          tedarikci: sutun.tedarikci,
          birim: birimler.get(s.kalem.key) ?? "Adet",
          not: h?.teslimGun != null ? `Teslim: ${teslimYazisi(h.teslimGun)}` : "",
          paylar: paylar[s.kalem.key] ?? [],
        };
      });
    if (kalemler.length > 0) setSiparisKalemleri(kalemler);
  }

  /** Seçim toplamı — bölünmüş siparişin gerçek bedeli. */
  const secimToplami = tablo.satirlar.reduce((t, s) => {
    const sutun = secim[s.kalem.key];
    const h = sutun ? s.hucreler.get(sutun) : undefined;
    return t + (h?.tutarEur ?? 0);
  }, 0);
  const secilenSutunlar = [...new Set(Object.values(secim).filter(Boolean))];

  /**
   * PAYI OLMAYAN KALEM SESSİZ GEÇİLMEZ.
   *
   * Buradan verilen sipariş paket ekranındaki "satın alındı" işaretini pay
   * listesinden yazar; plakanın payı YOKTUR (bir plaka onlarca parçanın
   * kaynağıdır ve o bağ ancak kesim planı yapılırken bilinir). İşaretin
   * yazılmayacağını söylemek, kullanıcının atölye ekranında boşuna işaret
   * aramasından ucuzdur (md. 18/3'ün tersi: sessizlik burada güvence değil).
   */
  const paysizKalem = tablo.satirlar.filter(
    (s) => (paylar[s.kalem.key] ?? []).length === 0
  ).length;

  const acikPartiler = talep.partiler.filter((p) => p.status !== "iptal");

  return (
    // SİPARİŞ VE DÜZENLEME PENCERELERİ BU PENCERENİN İÇİNDE DEĞİL YANINDADIR.
    // İkisi de kendi `Dialog` kökünü açar; birini ötekinin `DialogContent`i
    // içine koymak iki iç içe odak tuzağı ve iki kaydırma kilidi demekti
    // (`react-remove-scroll` dersinin komşusu). Kardeş olarak durduklarında
    // üstteki pencere kapanınca alttaki kaldığı gibi devam eder.
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[min(94rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-x-2 text-base">
            {talep.code && <span className="font-mono">{talep.code}</span>}
            {adDuzenle == null ? (
              <>
                <span>{talep.baslik}</span>
                {canWrite && talep.gercek && (
                  <button
                    type="button"
                    onClick={() => setAdDuzenle(talep.baslik)}
                    title="Teklifin adını değiştir"
                    aria-label="Teklifin adını değiştir"
                    className="oc-tap-square grid size-7 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </>
            ) : (
              // AD DEĞİŞTİRME AYRI BİR PENCERE DEĞİL: bir ad için ikinci bir
              // pencere açtırmak, satınalmacının en sık yaptığı küçük
              // düzeltmeyi üç tıka çıkarırdı (termin kutusunun kuralı).
              <span className="flex items-center gap-1">
                <Input
                  value={adDuzenle}
                  onChange={(e) => setAdDuzenle(e.target.value)}
                  maxLength={160}
                  aria-label="Teklifin adı"
                  className="h-8 w-[min(28rem,60vw)] text-base pointer-fine:text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    eylem(() => renameQuoteRequest(talep.id, adDuzenle), "Teklif adı değişti")
                  }
                  disabled={calisiyor || adDuzenle.trim().length === 0}
                  title="Kaydet"
                  aria-label="Adı kaydet"
                  className="oc-tap-square grid size-7 place-items-center text-emerald-700 disabled:opacity-40 dark:text-emerald-400"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAdDuzenle(null)}
                  title="Vazgeç"
                  aria-label="Vazgeç"
                  className="oc-tap-square grid size-7 place-items-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </span>
            )}
            {calisiyor && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {formatNum(talep.kalemSayisi)} kalem · {formatNum(talep.firmaSayisi)} firma ·{" "}
            {talep.ilkTarih === talep.sonTarih
              ? tarihGoster(talep.sonTarih)
              : `${tarihGoster(talep.ilkTarih)} – ${tarihGoster(talep.sonTarih)}`}
            . Tutarlar avroya çevrilerek karşılaştırılır; kuru girilmemiş teklif yarışa girmez.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {acikPartiler.length === 0 ? (
            <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
              Bu teklifin bütün firmaları iptal edilmiş. Aşağıdan bir tanesini geri alabilirsiniz.
            </p>
          ) : (
            <>
              {/* ————————————————————————————— 1. KARAR ŞERİDİ */}
              <section className="flex flex-wrap items-center gap-x-6 gap-y-2 border-2 border-primary/40 bg-primary/[0.04] p-3">
                <div>
                  <p className="oc-kicker text-[10px] text-muted-foreground">Seçili Dağılım</p>
                  <p className="font-mono text-base font-medium tabular-nums">
                    {formatNum(secimToplami, 2)} €
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatNum(secilenSutunlar.length)} firma ·{" "}
                    {formatNum(Object.keys(secim).length)} kalem
                  </p>
                </div>
                <div>
                  <p className="oc-kicker text-[10px] text-muted-foreground">Satır Satır En Ucuz</p>
                  <p className="font-mono text-base tabular-nums">
                    {formatNum(tablo.enIyiBolunmusToplamEur, 2)} €
                  </p>
                  <p className="text-[11px] text-muted-foreground">bölünmüş siparişin tabanı</p>
                </div>
                <div>
                  <p className="oc-kicker text-[10px] text-muted-foreground">
                    Tek Firmadan En Ucuz
                  </p>
                  {tablo.enIyiTekFirma ? (
                    <>
                      <p className="font-mono text-base tabular-nums">
                        {formatNum(tablo.enIyiTekFirma.toplamEur, 2)} €
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {tablo.enIyiTekFirma.tedarikci}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Bütün kalemlere fiyat veren firma yok
                    </p>
                  )}
                </div>
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                  {/* GÖRÜNÜM BİR KARARDIR, VERİYİ DEĞİŞTİRMEZ: veri düzeyinde
                      birleştirme aşağıdaki firma listesindedir. */}
                  <span className="flex items-center border">
                    <button
                      type="button"
                      onClick={() => setGorunum("birlesik")}
                      className={kipCipi(gorunum === "birlesik")}
                      title="Firmaları tek matriste yan yana göster"
                    >
                      <Layers className="size-3" />
                      Birleşik
                    </button>
                    <button
                      type="button"
                      onClick={() => setGorunum("ayri")}
                      className={kipCipi(gorunum === "ayri")}
                      title="Her firmayı kendi tablosunda ayrı ayrı göster"
                    >
                      <Split className="size-3" />
                      Ayrı
                    </button>
                  </span>
                  {canWrite &&
                    secilenSutunlar.map((k) => {
                      const c = tablo.sutunlar.find((x) => x.key === k);
                      if (!c) return null;
                      return (
                        <Button key={k} type="button" size="xs" onClick={() => siparisAc(k)}>
                          <Plus className="size-3" />
                          {c.tedarikci} — Sipariş Aç
                        </Button>
                      );
                    })}
                </span>
              </section>

              {/* ————————————————————————————— 2. MATRİS */}
              {gorunum === "ayri" ? (
                <div className="grid gap-3">
                  {acikPartiler.map((p) => (
                    <PartiTablosu key={p.id} p={p} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="oc-scrollx max-h-[52dvh] overflow-x-auto overflow-y-auto border [--oc-scroll-bg:var(--card)]">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-muted">
                          <th
                            rowSpan={2}
                            className="sticky left-0 z-10 bg-muted px-2 py-1.5 text-left align-bottom font-medium"
                          >
                            Tanımı
                          </th>
                          <th
                            rowSpan={2}
                            className="bg-muted px-2 py-1.5 text-right align-bottom font-medium"
                          >
                            Miktar
                          </th>
                          {tablo.sutunlar.map((c, i) => (
                            <th
                              key={c.key}
                              colSpan={3}
                              className={cn(
                                "border-l px-2 py-1.5 text-center font-medium",
                                // SÜTUN GRUBU ZEMİNLE AYRILIR: kullanıcının
                                // çalışma dosyasında her firma ayrı renkteydi ve
                                // sebebi okunurluk — altı sütunlu bir şeritte
                                // gözün hangi üçlünün kime ait olduğunu takip
                                // etmesi gerekiyor. Renk UYDURULMAZ (tema
                                // değişkeni yok): ayrım zemin YOĞUNLUĞUYLA
                                // yapılır, iki temada da aynı çalışır.
                                i % 2 === 1 && "bg-foreground/[0.04]"
                              )}
                            >
                              <span className="block truncate" title={c.etiket}>
                                {c.etiket}
                              </span>
                              <span className="font-mono text-[10px] font-normal text-muted-foreground">
                                {vadeYazisi(c.vadeGun)}
                                {c.eksikKalem > 0 && ` · ${formatNum(c.eksikKalem)} kalem eksik`}
                              </span>
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-muted/80 text-[10px] text-muted-foreground">
                          {tablo.sutunlar.map((c, i) => (
                            <React.Fragment key={c.key}>
                              <th
                                className={cn(
                                  "border-l px-2 py-1 text-right font-normal",
                                  i % 2 === 1 && "bg-foreground/[0.04]"
                                )}
                              >
                                Birim €
                              </th>
                              <th
                                className={cn(
                                  "px-2 py-1 text-right font-normal",
                                  i % 2 === 1 && "bg-foreground/[0.04]"
                                )}
                              >
                                Tutar €
                              </th>
                              <th
                                className={cn(
                                  "px-2 py-1 text-left font-normal",
                                  i % 2 === 1 && "bg-foreground/[0.04]"
                                )}
                              >
                                Teslim
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tablo.satirlar.map((s) => (
                          <tr key={s.kalem.key} className="border-t">
                            <td className="sticky left-0 z-10 max-w-[18rem] truncate bg-card px-2 py-1.5 font-medium">
                              {s.kalem.tanim}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                              {s.kalem.miktar == null ? (
                                <span
                                  className="text-muted-foreground"
                                  title="Miktar bilinmiyor — tutar hesaplanamaz, karşılaştırma birim fiyattan yapılır"
                                >
                                  —
                                </span>
                              ) : (
                                formatNum(s.kalem.miktar)
                              )}{" "}
                              <span className="text-[10px] text-muted-foreground">
                                {s.kalem.birim}
                              </span>
                            </td>
                            {tablo.sutunlar.map((c, i) => {
                              const h = s.hucreler.get(c.key);
                              const secili = secim[s.kalem.key] === c.key;
                              const grup = i % 2 === 1 && "bg-foreground/[0.04]";
                              return (
                                <React.Fragment key={c.key}>
                                  <td
                                    className={cn(
                                      "border-l px-2 py-1.5 text-right font-mono tabular-nums",
                                      grup,
                                      secili && "bg-primary/[0.10]"
                                    )}
                                  >
                                    {h?.birimFiyatEur == null ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : (
                                      formatNum(h.birimFiyatEur, 3)
                                    )}
                                  </td>
                                  <td
                                    className={cn(
                                      "px-2 py-1.5 text-right font-mono tabular-nums",
                                      grup,
                                      secili && "bg-primary/[0.10]",
                                      h?.enUcuz &&
                                        "font-semibold text-emerald-700 dark:text-emerald-400"
                                    )}
                                  >
                                    {/* HÜCREYE BASMAK O TEKLİFİ SEÇER:
                                        satınalmacının en sık hareketi budur ve
                                        ayrı bir radyo sütunu tabloyu üç sütun
                                        daha genişletirdi. */}
                                    {h?.tutarEur == null ? (
                                      h?.birimFiyatEur == null ? (
                                        <span className="text-muted-foreground">—</span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSecim((o) => ({ ...o, [s.kalem.key]: c.key }))
                                          }
                                          className="oc-tap text-muted-foreground underline-offset-2 hover:underline"
                                          title="Miktar bilinmiyor — yine de bu firmayı seçebilirsiniz"
                                        >
                                          seç
                                        </button>
                                      )
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSecim((o) => ({ ...o, [s.kalem.key]: c.key }))
                                        }
                                        className="oc-tap underline-offset-2 hover:underline"
                                        title={`${c.etiket} seçilsin`}
                                      >
                                        {formatNum(Math.round(h.tutarEur))}
                                      </button>
                                    )}
                                  </td>
                                  <td
                                    className={cn(
                                      "px-2 py-1.5 whitespace-nowrap",
                                      grup,
                                      secili && "bg-primary/[0.10]",
                                      h?.teslimGun === 0 &&
                                        "text-emerald-700 dark:text-emerald-400"
                                    )}
                                  >
                                    {h ? teslimYazisi(h.teslimGun) : ""}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-foreground/20 bg-muted/40 font-mono font-semibold tabular-nums">
                          <td className="sticky left-0 z-10 bg-muted/40 px-2 py-2">Toplam</td>
                          <td className="px-2 py-2" />
                          {tablo.sutunlar.map((c, i) => (
                            <React.Fragment key={c.key}>
                              <td
                                className={cn("border-l px-2 py-2", i % 2 === 1 && "bg-foreground/[0.04]")}
                              />
                              <td
                                className={cn(
                                  "px-2 py-2 text-right",
                                  i % 2 === 1 && "bg-foreground/[0.04]",
                                  // EKSİK TEKLİFLİ SÜTUNUN TOPLAMI SOLUK
                                  // BASILIR: ötekilerle aynı ağırlıkta
                                  // göstermek sahte bir "en ucuz" üretirdi.
                                  !c.tamKapsam && "text-muted-foreground/70"
                                )}
                                title={
                                  c.tamKapsam
                                    ? undefined
                                    : `${formatNum(c.eksikKalem)} kaleme fiyat verilmedi — toplam karşılaştırılamaz`
                                }
                              >
                                {formatNum(Math.round(c.toplamEur))}
                              </td>
                              <td
                                className={cn(
                                  "px-2 py-2 text-[10px] font-normal whitespace-nowrap",
                                  i % 2 === 1 && "bg-foreground/[0.04]"
                                )}
                              >
                                {c.enGecTeslimGun == null
                                  ? "—"
                                  : `en geç ${teslimYazisi(c.enGecTeslimGun)}`}
                              </td>
                            </React.Fragment>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Bir satırdaki tutara basmak o firmayı seçer — farklı satırlarda farklı firma
                    seçerseniz sipariş firma başına bölünür.
                    {paysizKalem > 0 && (
                      <>
                        {" "}
                        <span className="text-amber-700 dark:text-amber-400">
                          {formatNum(paysizKalem)} kalemin paket bağı yok (plaka gibi): buradan
                          verilen sipariş atölye ekranına “satın alındı” işareti YAZMAZ; plaka
                          siparişini Plaka Yerleşimi ekranından açın.
                        </span>
                      </>
                    )}
                  </p>
                </>
              )}
            </>
          )}

          {/* ————————————————————————————— 3. FİRMALAR */}
          <section className="border">
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
              <p className="oc-kicker text-[10px] text-muted-foreground">Bu Teklifi Verenler</p>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatNum(talep.partiler.length)} kayıt
              </span>
            </div>
            <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="px-2 py-1.5 font-normal">Kod</th>
                    <th className="px-2 py-1.5 font-normal">Tedarikçi</th>
                    <th className="px-2 py-1.5 font-normal">Tarih</th>
                    <th className="px-2 py-1.5 text-right font-normal">Kalem</th>
                    <th className="px-2 py-1.5 text-right font-normal">Toplam €</th>
                    <th className="px-2 py-1.5 font-normal">Vade</th>
                    <th className="px-2 py-1.5 font-normal">Durum</th>
                    <th className="w-36 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {talep.partiler.map((p) => {
                    const iptal = p.status === "iptal";
                    // KODSUZ PARTİ SANALDIR: defterde karşılığı yok, yalnız
                    // (tedarikçi, tarih) ikilisinden türetildi. Karşılaştırmaya
                    // girer ama düzenlenemez — düzenleme, kimliği olmayan bir
                    // kayda yazmaya çalışırdı.
                    const sanal = p.id.startsWith("kodsuz:");
                    return (
                      <tr
                        key={p.id}
                        className={cn("border-t", iptal && "text-muted-foreground")}
                      >
                        <td className="px-2 py-1.5 font-mono font-medium whitespace-nowrap">
                          {p.code || (
                            <span
                              className="text-muted-foreground"
                              title="Bu teklif parti kodu verilmeden önce girilmiş; tedarikçi ve tarihe göre gruplandı."
                            >
                              kodsuz
                            </span>
                          )}
                        </td>
                        <td className={cn("px-2 py-1.5", iptal && "line-through")}>
                          {p.supplier}
                          {p.note && (
                            <span className="block text-[11px] text-muted-foreground">
                              {p.note}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                          {tarihGoster(p.quotedAt)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                          {formatNum(p.kalemSayisi)}
                          {p.miktarsizKalem > 0 && (
                            <span
                              className="ml-1 text-[10px] text-muted-foreground"
                              title={`${p.miktarsizKalem} kalemin miktarı bilinmiyor, toplama girmedi`}
                            >
                              ({formatNum(p.miktarsizKalem)}?)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-medium tabular-nums">
                          {formatNum(Math.round(p.toplamEur))}
                        </td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                          {vadeYazisi(p.vadeGun)}
                        </td>
                        <td className="px-2 py-1.5">
                          {iptal ? (
                            <span
                              className="border border-destructive/40 px-1.5 py-0.5 text-[11px] text-destructive"
                              title={p.cancelReason || undefined}
                            >
                              İptal
                            </span>
                          ) : (
                            <span className="border border-emerald-600/40 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                              Açık
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {canWrite && !sanal && (
                            <span className="flex items-center justify-end gap-0.5">
                              {!iptal && (
                                <>
                                  <IkonDugme
                                    baslik="Teklifi düzenle"
                                    onClick={() => setDuzenlenen(p)}
                                  >
                                    <Pencil className="size-3.5" />
                                  </IkonDugme>
                                  {/* AYIR — bu firmanın cevabını bu teklifin
                                      dışına çıkarır. Otomatik eşleşme kalem
                                      kümesine bakar ve bazen fazla cömerttir:
                                      aynı kalemler için iki hafta arayla
                                      alınmış fiyatlar tek teklife düşer, oysa
                                      onlar iki ayrı pazarlıktır. */}
                                  {talep.partiler.length > 1 && (
                                    <IkonDugme
                                      baslik="Teklifi ayır — kendi teklifine taşı"
                                      onClick={() =>
                                        eylem(() => splitQuoteBatch(p.id), "Teklif ayrıldı")
                                      }
                                    >
                                      <Split className="size-3.5" />
                                    </IkonDugme>
                                  )}
                                  {/* AYNI FİRMANIN İKİ LİSTESİNİ TEK KODDA
                                      TOPLA — talep birleştirmesinden AYRI bir
                                      sorudur ve şartı da ayrıdır (aynı firma).
                                      Hedef EN ESKİ olandır: kod bir kimliktir. */}
                                  {(() => {
                                    const kardes = talep.partiler.find(
                                      (x) =>
                                        x.id !== p.id &&
                                        x.status !== "iptal" &&
                                        !x.id.startsWith("kodsuz:") &&
                                        x.supplier === p.supplier
                                    );
                                    if (!kardes) return null;
                                    const [hedef, kaynak] =
                                      kardes.quotedAt.localeCompare(p.quotedAt) <= 0
                                        ? [kardes, p]
                                        : [p, kardes];
                                    return (
                                      <IkonDugme
                                        baslik={`${p.supplier} tekliflerini tek kodda topla`}
                                        onClick={() =>
                                          eylem(
                                            () => mergeQuoteBatches(hedef.id, [kaynak.id]),
                                            "Teklifler birleştirildi"
                                          )
                                        }
                                      >
                                        <Layers className="size-3.5" />
                                      </IkonDugme>
                                    );
                                  })()}
                                  <IkonDugme
                                    baslik="Teklifi iptal et"
                                    onClick={() =>
                                      eylem(() => cancelQuoteBatch(p.id), "Teklif iptal edildi")
                                    }
                                  >
                                    <Ban className="size-3.5" />
                                  </IkonDugme>
                                </>
                              )}
                              {iptal && (
                                <IkonDugme
                                  baslik="İptali geri al"
                                  onClick={() =>
                                    eylem(() => reopenQuoteBatch(p.id), "Teklif yeniden açıldı")
                                  }
                                >
                                  <RotateCcw className="size-3.5" />
                                </IkonDugme>
                              )}
                              {iptal && isAdmin && p.code && (
                                <IkonDugme
                                  baslik="Teklifi kalıcı olarak sil"
                                  yikici
                                  onClick={() =>
                                    eylem(() => deleteQuoteBatch(p.id), "Teklif silindi")
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </IkonDugme>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          </div>
        </DialogContent>
      </Dialog>

      {siparisKalemleri && (
        <OrderDialog
          kalemler={siparisKalemleri}
          tedarikciler={tedarikciler}
          defter={defter}
          siparisNolari={siparisNolari}
          sonKur={sonKur}
          qualities={qualities}
          onClose={() => setSiparisKalemleri(null)}
          onSaved={() => {
            setSiparisKalemleri(null);
            router.refresh();
          }}
        />
      )}
      {duzenlenen && (
        <QuoteBatchDialog
          key={duzenlenen.id}
          parti={duzenlenen}
          tedarikciler={tedarikciler}
          sonKur={sonKur}
          onClose={() => setDuzenlenen(null)}
          onSaved={() => {
            setDuzenlenen(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/**
 * TEK BİR FİRMANIN KENDİ TABLOSU — "Ayrı" görünümü.
 *
 * Kullanıcı isteği: *"Her açtığım teklifi ayrı ayrı değerlendirebileyim."*
 * Matris karşılaştırma için doğru araçtır ama tek bir teklifi OKUMAK için
 * fazla geniştir: burada sütunlar sabittir ve göz yalnız o firmanın verdiği
 * fiyatları tarar.
 */
function PartiTablosu({ p }: { p: PartiOzeti }) {
  return (
    <section className="border">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b bg-muted/30 px-3 py-2">
        <h3 className="font-mono text-[13px] font-medium">
          {p.code ? `${p.code} · ` : ""}
          {p.supplier}
        </h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {tarihGoster(p.quotedAt)} · {vadeYazisi(p.vadeGun)} · {formatNum(p.kalemSayisi)} kalem
        </span>
        <span className="ml-auto font-mono text-[13px] font-semibold tabular-nums">
          {formatNum(Math.round(p.toplamEur))} €
        </span>
      </div>
      <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-normal">Tanımı</th>
              <th className="px-3 py-1.5 text-right font-normal">Miktar</th>
              <th className="px-3 py-1.5 text-right font-normal">Birim Fiyat</th>
              <th className="px-3 py-1.5 text-right font-normal">Birim €</th>
              <th className="px-3 py-1.5 text-right font-normal">Tutar €</th>
              <th className="px-3 py-1.5 font-normal">Teslim</th>
            </tr>
          </thead>
          <tbody>
            {p.satirlar.map((s) => (
              <tr key={s.quoteId} className="border-t">
                <td className="px-3 py-1.5 font-medium">{s.tanim}</td>
                <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                  {s.miktar == null ? "—" : formatNum(s.miktar)}{" "}
                  <span className="text-[10px] text-muted-foreground">{s.birim}</span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {fmtMoney(s.birimFiyat, s.paraBirimi)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {s.birimFiyatEur == null ? (
                    <span className="text-amber-600 dark:text-amber-400" title="Kur girilmemiş">
                      kur yok
                    </span>
                  ) : (
                    formatNum(s.birimFiyatEur, 3)
                  )}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-medium tabular-nums">
                  {s.tutarEur == null ? "—" : formatNum(Math.round(s.tutarEur))}
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 whitespace-nowrap",
                    s.teslimGun === 0 && "text-emerald-700 dark:text-emerald-400"
                  )}
                >
                  {teslimYazisi(s.teslimGun)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IkonDugme({
  onClick,
  baslik,
  yikici,
  children,
}: {
  onClick: () => void;
  baslik: string;
  yikici?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={baslik}
      aria-label={baslik}
      className={cn(
        "oc-tap-square grid size-7 place-items-center transition-colors pointer-coarse:size-9",
        yikici
          ? "text-muted-foreground hover:text-destructive"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function kipCipi(aktif: boolean): string {
  return cn(
    "inline-flex items-center gap-1 px-2 py-1 text-[11px] transition-colors",
    aktif
      ? "bg-primary/[0.12] font-medium text-foreground"
      : "text-muted-foreground hover:text-foreground"
  );
}

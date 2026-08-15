"use client";

// TEKLİF KARŞILAŞTIRMA — görünüm.
//
// ═══════════════════════════════════════════ SAYFA ÜÇ KATMANDIR
//
// Kullanıcı bildirimi (15.08.2026): *"Teklif karşılaştırma sayfası şu anda
// karmaşık geliyor. Teklif Aç Koduna göre satır satır gelsin. Her açtığım
// teklifi ayrı ayrı değerlendirebileyim. İstersem bu sayfada teklifleri
// birleştir ayrı diyebileyim. Teklifi değiştir iptal et düzenle vb özellikler
// de olsun."*
//
//   1. TEKLİFLER — her satır BİR teklif (`TK0007 · EAG DEMİR · 12 kalem ·
//      38.400 €`). Seçim kutusu, düzenle/iptal/sil eylemleri buradadır.
//   2. GÖRÜNÜM — seçilenler ya TEK MATRİSTE yan yana konur ("Birleştir") ya da
//      her teklif KENDİ TABLOSUNDA ayrı ayrı okunur ("Ayrı").
//   3. KARAR — satır satır en ucuz, tek firmadan en ucuz, seçili dağılımın
//      bedeli ve "Sipariş Aç".
//
// Eskiden sayfa doğrudan matrisle açılıyordu ve sütun TEDARİKÇİYDİ: aynı
// firmadan alınmış iki teklif tek sütunda eriyordu. Sütun artık PARTİDİR.
//
// SEÇİM SATIR BAŞINADIR (matriste): her kalemde bir teklif seçilir (varsayılan
// en ucuz) ve "Sipariş Aç" seçimleri FİRMAYA GÖRE GRUPLAR — bölünmüş sipariş
// budur, iki firma iki ayrı sipariş kaydı olur.

import React, { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Ban, Layers, Loader2, Pencil, Plus, RotateCcw, Split, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderDialog, type SiparisKalemi } from "../../order-dialog";
import type { TedarikciKaydi } from "../../data";
import type { GunlukKur } from "@/lib/purchasing/kur";
import { formatNum } from "@/lib/drawings/labels";
import { fmtMoney } from "@/lib/currency";
import { tarihGoster } from "@/lib/purchasing/terms";
import {
  teslimYazisi,
  vadeYazisi,
  type KarsilastirmaTablosu,
} from "@/lib/purchasing/hammadde/karsilastirma";
import { HAMMADDE_ADLARI, type HammaddeSinifi } from "@/lib/purchasing/hammadde/siniflar";
import { cn } from "@/lib/utils";
import {
  cancelQuoteBatch,
  deleteQuoteBatch,
  mergeQuoteBatches,
  reopenQuoteBatch,
} from "../../actions";
import { QuoteBatchDialog } from "./batch-dialog";

type Pay = { itemNo: string; packageId: string; partKey: string; adet: number };

/** Bir teklif partisinin ekrana giden yüzü — sunucuda kurulur. */
export interface PartiOzeti {
  id: string;
  code: string;
  supplier: string;
  quotedAt: string;
  status: string;
  note: string;
  cancelReason: string;
  vadeGun: number;
  paraBirimi: string;
  kur: number | null;
  toplamEur: number;
  kalemSayisi: number;
  satirlar: {
    quoteId: string;
    key: string;
    tanim: string;
    miktar: number | null;
    birim: string;
    birimFiyat: number;
    paraBirimi: string;
    kur: number | null;
    birimFiyatEur: number | null;
    tutarEur: number | null;
    teslimGun: number | null;
  }[];
}

export function CompareView({
  tablo,
  partiler,
  seciliIdler,
  gorunum,
  tur,
  turSayaclari,
  siparisAdetleri,
  paylar,
  birimler,
  tedarikciler,
  defter,
  siparisNolari,
  sonKur,
  qualities,
  canWrite,
  isAdmin,
}: {
  tablo: KarsilastirmaTablosu;
  partiler: PartiOzeti[];
  seciliIdler: string[];
  gorunum: "birlesik" | "ayri";
  tur: HammaddeSinifi | null;
  turSayaclari: { tur: HammaddeSinifi; adet: number }[];
  siparisAdetleri: [string, number][];
  paylar: Record<string, Pay[]>;
  birimler: Record<string, string>;
  tedarikciler: string[];
  defter: TedarikciKaydi[];
  siparisNolari: string[];
  sonKur?: GunlukKur | null;
  qualities: string[];
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [calisiyor, basla] = useTransition();
  const [siparisKalemleri, setSiparisKalemleri] = useState<SiparisKalemi[] | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<PartiOzeti | null>(null);

  /** Satır anahtarı → seçilen SÜTUN (parti) anahtarı. Varsayılan en ucuzudur. */
  const [secim, setSecim] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tablo.satirlar.filter((s) => s.enUcuzTedarikci).map((s) => [s.kalem.key, s.enUcuzTedarikci])
    )
  );

  const siparisHaritasi = useMemo(() => new Map(siparisAdetleri), [siparisAdetleri]);
  const seciliKumesi = useMemo(() => new Set(seciliIdler), [seciliIdler]);
  const secilenPartiler = partiler.filter((p) => seciliKumesi.has(p.id));

  /** Adres parametresini yazar — seçim ve görünüm PAYLAŞILABİLİR olmalı. */
  function adresYaz(degis: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(params?.toString() ?? "");
    degis(p);
    basla(() => router.replace(`/purchasing/hammadde/teklifler?${p.toString()}`));
  }

  function turSec(v: HammaddeSinifi | null) {
    adresYaz((p) => {
      if (v) p.set("tur", v);
      else p.delete("tur");
    });
  }

  function partiSec(id: string, ac: boolean) {
    adresYaz((p) => {
      const kume = new Set(seciliIdler);
      if (ac) kume.add(id);
      else kume.delete(id);
      p.delete("p");
      for (const k of kume) p.append("p", k);
      // HİÇBİRİ SEÇİLİ DEĞİLSE ADRESTE BİR İZ KALMALI: parametre tamamen
      // silinseydi sayfa "varsayılan" kipe düşer ve hepsini yeniden seçerdi.
      if (kume.size === 0) p.append("p", "yok");
    });
  }

  function gorunumSec(v: "birlesik" | "ayri") {
    adresYaz((p) => {
      if (v === "ayri") p.set("gorunum", "ayri");
      else p.delete("gorunum");
    });
  }

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
   * BİRLEŞTİR — aynı firmanın ayrı ayrı girilmiş teklifleri tek kodda toplanır.
   *
   * Hedef EN ESKİ partidir: kod bir kimliktir ve birleştirmenin sonucunda
   * kullanıcının elinde ilk verilen numara kalmalı.
   */
  function birlestir() {
    const secilenler = secilenPartiler.filter(
      (p) => p.status !== "iptal" && !p.id.startsWith("kodsuz:")
    );
    if (secilenler.length < 2) {
      toast.error("Birleştirmek için en az iki teklif seçin.");
      return;
    }
    const sirali = [...secilenler].sort((a, b) => a.quotedAt.localeCompare(b.quotedAt));
    const hedef = sirali[0];
    eylem(
      () => mergeQuoteBatches(hedef.id, sirali.slice(1).map((p) => p.id)),
      "Teklifler birleştirildi"
    );
  }

  /**
   * SİPARİŞ FİRMAYA GÖRE BÖLÜNÜR.
   *
   * `OrderDialog` TEK tedarikçiye yazar (sipariş numarası onun kodundan
   * türüyor). İki firmadan alınacaksa iki ayrı sipariş açılır.
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
          birim: birimler[s.kalem.key] ?? "Adet",
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

  return (
    <div className="grid gap-3">
      {/* ————————————————————————————————————— tür şeridi */}
      <div className="oc-scrollx flex items-center gap-1.5 overflow-x-auto overscroll-x-contain [--oc-scroll-bg:var(--background)]">
        <button type="button" onClick={() => turSec(null)} className={cip(tur === null)}>
          Tümü{" "}
          <span className="ml-1 opacity-60">
            {formatNum(turSayaclari.reduce((t, x) => t + x.adet, 0))}
          </span>
        </button>
        {turSayaclari
          .filter((x) => x.adet > 0)
          .map((x) => (
            <button
              key={x.tur}
              type="button"
              onClick={() => turSec(x.tur)}
              className={cip(tur === x.tur)}
            >
              {HAMMADDE_ADLARI[x.tur]} <span className="ml-1 opacity-60">{formatNum(x.adet)}</span>
            </button>
          ))}
        {calisiyor && (
          <span className="ml-2 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Yükleniyor
          </span>
        )}
      </div>

      {partiler.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Henüz teklif yok. Hammadde Havuzu&apos;ndan kalem seçip “Teklif Aç” ile firmaların
            fiyatlarını girin; her teklif kendi koduyla burada listelenir.
          </p>
        </div>
      ) : (
        <>
          {/* ————————————————————————————————— 1. TEKLİF LİSTESİ */}
          <section className="border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <p className="oc-kicker text-[10px] text-muted-foreground">Teklifler</p>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatNum(secilenPartiler.length)} / {formatNum(partiler.length)} seçili
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                {/* BİRLEŞTİR / AYRI — kullanıcının istediği iki kip. Bu bir
                    GÖRÜNÜM kararıdır ve veriyi değiştirmez; veri düzeyinde
                    birleştirme ayrı bir düğmedir ve iptal damgası bırakır. */}
                <span className="flex items-center border">
                  <button
                    type="button"
                    onClick={() => gorunumSec("birlesik")}
                    className={kipCipi(gorunum === "birlesik")}
                    title="Seçili teklifleri tek matriste yan yana göster"
                  >
                    <Layers className="size-3" />
                    Birleşik
                  </button>
                  <button
                    type="button"
                    onClick={() => gorunumSec("ayri")}
                    className={kipCipi(gorunum === "ayri")}
                    title="Her teklifi kendi tablosunda ayrı ayrı göster"
                  >
                    <Split className="size-3" />
                    Ayrı
                  </button>
                </span>
                {canWrite && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={birlestir}
                    disabled={calisiyor || secilenPartiler.length < 2}
                    title="Aynı firmanın seçili tekliflerini tek kodda topla"
                  >
                    Teklifleri Birleştir
                  </Button>
                )}
              </span>
            </div>

            <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-muted/50 text-left text-muted-foreground">
                    <th className="w-10 px-2 py-1.5 font-normal" />
                    <th className="px-2 py-1.5 font-normal">Kod</th>
                    <th className="px-2 py-1.5 font-normal">Tedarikçi</th>
                    <th className="px-2 py-1.5 font-normal">Tarih</th>
                    <th className="px-2 py-1.5 text-right font-normal">Kalem</th>
                    <th className="px-2 py-1.5 text-right font-normal">Toplam €</th>
                    <th className="px-2 py-1.5 font-normal">Vade</th>
                    <th className="px-2 py-1.5 font-normal">Durum</th>
                    <th className="w-32 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {partiler.map((p) => {
                    const secili = seciliKumesi.has(p.id);
                    const iptal = p.status === "iptal";
                    // KODSUZ PARTİ SANALDIR: defterde karşılığı yok, yalnız
                    // (tedarikçi, tarih) ikilisinden türetildi. Karşılaştırmaya
                    // girer ama düzenlenemez — düzenleme kimliği olmayan bir
                    // kayda yazmaya çalışırdı.
                    const sanal = p.id.startsWith("kodsuz:");
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "border-t",
                          secili && "bg-primary/[0.05]",
                          iptal && "text-muted-foreground"
                        )}
                      >
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={secili}
                            onChange={(e) => partiSec(p.id, e.target.checked)}
                            aria-label={`${p.code || p.supplier} teklifini karşılaştırmaya al`}
                            className="size-4 accent-[var(--primary)]"
                          />
                        </td>
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

          {secilenPartiler.length === 0 ? (
            <div className="border bg-card px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Karşılaştırmak için yukarıdan en az bir teklif seçin.
              </p>
            </div>
          ) : gorunum === "ayri" ? (
            /* ————————————————————————————— 2a. AYRI: her teklif kendi tablosu */
            <div className="grid gap-3">
              {secilenPartiler.map((p) => (
                <PartiTablosu key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <>
              {/* ————————————————————————————— 2b. BİRLEŞİK: karar şeridi */}
              <section className="flex flex-wrap items-center gap-x-6 gap-y-2 border-2 border-primary/40 bg-primary/[0.04] p-3">
                <div>
                  <p className="oc-kicker text-[10px] text-muted-foreground">Seçili Dağılım</p>
                  <p className="font-mono text-base font-medium tabular-nums">
                    {formatNum(secimToplami, 2)} €
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatNum(secilenSutunlar.length)} teklif ·{" "}
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
                    Tek Teklifle En Ucuz
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
                      Bütün kalemlere fiyat veren teklif yok
                    </p>
                  )}
                </div>
                {canWrite && (
                  <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    {secilenSutunlar.map((k) => {
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
                )}
              </section>

              {/* ————————————————————————————— matris */}
              <div className="oc-scrollx overflow-x-auto border bg-card [--oc-scroll-bg:var(--card)]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-10 bg-muted/50 px-2 py-1.5 text-left align-bottom font-medium"
                      >
                        Tanımı
                      </th>
                      <th rowSpan={2} className="px-2 py-1.5 text-right align-bottom font-medium">
                        Miktar
                      </th>
                      {tablo.sutunlar.map((c) => (
                        <th
                          key={c.key}
                          colSpan={3}
                          className="border-l px-2 py-1.5 text-center font-medium"
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
                    <tr className="bg-muted/40 text-[10px] text-muted-foreground">
                      {tablo.sutunlar.map((c) => (
                        <React.Fragment key={c.key}>
                          <th className="border-l px-2 py-1 text-right font-normal">Birim €</th>
                          <th className="px-2 py-1 text-right font-normal">Tutar €</th>
                          <th className="px-2 py-1 text-left font-normal">Teslim</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tablo.satirlar.map((s) => (
                      <tr key={s.kalem.key} className="border-t">
                        <td className="sticky left-0 z-10 max-w-[16rem] truncate bg-card px-2 py-1.5 font-medium">
                          {s.kalem.tanim}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                          {s.kalem.miktar == null ? "—" : formatNum(s.kalem.miktar)}{" "}
                          <span className="text-[10px] text-muted-foreground">
                            {s.kalem.birim}
                          </span>
                        </td>
                        {tablo.sutunlar.map((c) => {
                          const h = s.hucreler.get(c.key);
                          const secili = secim[s.kalem.key] === c.key;
                          return (
                            <React.Fragment key={c.key}>
                              <td
                                className={cn(
                                  "border-l px-2 py-1.5 text-right font-mono tabular-nums",
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
                                  secili && "bg-primary/[0.10]",
                                  h?.enUcuz && "font-semibold text-emerald-700 dark:text-emerald-400"
                                )}
                              >
                                {/* HÜCREYE BASMAK O TEKLİFİ SEÇER: satınalmacının
                                    en sık hareketi budur ve ayrı bir radyo sütunu
                                    tabloyu üç sütun daha genişletirdi. */}
                                {h?.tutarEur == null ? (
                                  <span className="text-muted-foreground">—</span>
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
                                  secili && "bg-primary/[0.10]",
                                  h?.teslimGun === 0 && "text-emerald-700 dark:text-emerald-400"
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
                      {tablo.sutunlar.map((c) => (
                        <React.Fragment key={c.key}>
                          <td className="border-l px-2 py-2" />
                          <td
                            className={cn(
                              "px-2 py-2 text-right",
                              // EKSİK TEKLİFLİ SÜTUNUN TOPLAMI SOLUK BASILIR:
                              // ötekilerle aynı ağırlıkta göstermek sahte bir
                              // "en ucuz" üretirdi.
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
                          <td className="px-2 py-2 text-[10px] font-normal whitespace-nowrap">
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
                Tutarlar avroya çevrilerek karşılaştırılır; kuru girilmemiş teklif yarışa girmez.
                Bir satırdaki tutara basmak o teklifi seçer — farklı satırlarda farklı teklif
                seçerseniz sipariş firma başına bölünür.
              </p>
            </>
          )}
        </>
      )}

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
    </div>
  );
}

/**
 * TEK BİR TEKLİFİN KENDİ TABLOSU — "Ayrı" görünümü.
 *
 * Kullanıcı isteği: *"Her açtığım teklifi ayrı ayrı değerlendirebileyim."*
 * Matris karşılaştırma için doğru araçtır ama tek bir teklifi OKUMAK için
 * fazla geniştir: burada sütunlar sabittir ve göz yalnız o firmanın verdiği
 * fiyatları tarar.
 */
function PartiTablosu({ p }: { p: PartiOzeti }) {
  return (
    <section className="border bg-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-3 py-2">
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

function cip(aktif: boolean): string {
  return cn(
    "shrink-0 border px-2.5 py-1.5 font-mono text-[12px] whitespace-nowrap transition-colors pointer-coarse:py-2.5",
    aktif
      ? "border-primary/60 bg-primary/[0.10] font-medium text-foreground"
      : "border-border text-muted-foreground hover:text-foreground"
  );
}

function kipCipi(aktif: boolean): string {
  return cn(
    "inline-flex items-center gap-1 px-2 py-1 text-[11px] transition-colors",
    aktif ? "bg-primary/[0.12] font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
  );
}

"use client";

// TEKLİF KARŞILAŞTIRMA TABLOSU.
//
// Kullanıcının gösterdiği çalışma dosyasının birebir karşılığı: satır kalem,
// SÜTUN GRUBU TEDARİKÇİ (birim fiyat · tutar · teslim), başlıkta vade, altta
// firma toplamları.
//
// ═══════════════════════════════════════════ ÜÇ ŞEY EKLENDİ
//
// 1. **EN UCUZ HÜCRE İŞARETLENİR.** Excel'de göz üç sütunu tarayıp en küçüğü
//    kendi buluyor; on beş kalemde bu her satırda tekrarlanan bir iştir.
// 2. **BÖLÜNMÜŞ SİPARİŞİN BEDELİ HESAPLANIR.** Kullanıcı *"ya da bölüp de
//    sipariş verebiliriz"* dedi — o seçeneğin ne kazandırdığı sayıyla durur.
// 3. **EKSİK TEKLİF SAYILIR.** Üç kalemin ikisine fiyat vermiş bir firmanın
//    toplamı, hepsine vermiş bir firmayla karşılaştırılamaz; sütun künyesi
//    bunu söyler ve toplam soluk basılır.
//
// SEÇİM SATIR BAŞINADIR: her satırda bir firma seçilir (varsayılan en ucuz) ve
// "Sipariş Aç" seçimleri FİRMAYA GÖRE GRUPLAR — bölünmüş sipariş budur, iki
// firma iki ayrı sipariş kaydı olur.

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderDialog, type SiparisKalemi } from "../../order-dialog";
import type { TedarikciKaydi } from "../../data";
import type { GunlukKur } from "@/lib/purchasing/kur";
import { formatNum } from "@/lib/drawings/labels";
import {
  teslimYazisi,
  vadeYazisi,
  type KarsilastirmaTablosu,
} from "@/lib/purchasing/hammadde/karsilastirma";
import { HAMMADDE_ADLARI, type HammaddeSinifi } from "@/lib/purchasing/hammadde/siniflar";
import { cn } from "@/lib/utils";

type Pay = { itemNo: string; packageId: string; partKey: string; adet: number };

export function CompareView({
  tablo,
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
}: {
  tablo: KarsilastirmaTablosu;
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
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [siparisKalemleri, setSiparisKalemleri] = useState<SiparisKalemi[] | null>(null);

  /** Satır anahtarı → seçilen tedarikçi. Varsayılan satırın en ucuzudur. */
  const [secim, setSecim] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tablo.satirlar.filter((s) => s.enUcuzTedarikci).map((s) => [s.kalem.key, s.enUcuzTedarikci])
    )
  );

  const siparisHaritasi = useMemo(() => new Map(siparisAdetleri), [siparisAdetleri]);

  function turSec(v: HammaddeSinifi | null) {
    const p = new URLSearchParams(params?.toString() ?? "");
    if (v) p.set("tur", v);
    else p.delete("tur");
    router.replace(`/purchasing/hammadde/teklifler?${p.toString()}`);
  }

  /** Seçim toplamı — bölünmüş siparişin gerçek bedeli. */
  const secimToplami = tablo.satirlar.reduce((t, s) => {
    const ted = secim[s.kalem.key];
    const h = ted ? s.hucreler.get(ted) : undefined;
    return t + (h?.tutarEur ?? 0);
  }, 0);

  /** Kaç firmaya bölünüyor? */
  const secilenFirmalar = [...new Set(Object.values(secim).filter(Boolean))];

  /**
   * SİPARİŞ FİRMAYA GÖRE BÖLÜNÜR.
   *
   * `OrderDialog` TEK tedarikçiye yazar (sipariş numarası onun kodundan
   * türüyor). İki firmadan alınacaksa iki ayrı sipariş açılır ve pencere
   * sırayla açılır — tek pencerede iki firma, sipariş kaydının tanımını
   * bozardı.
   */
  function siparisAc(tedarikci: string) {
    const kalemler: SiparisKalemi[] = tablo.satirlar
      .filter((s) => secim[s.kalem.key] === tedarikci)
      .map((s) => {
        const h = s.hucreler.get(tedarikci);
        const alinan = siparisHaritasi.get(s.kalem.key) ?? 0;
        const kalan = Math.max(0, (s.kalem.miktar ?? 0) - alinan);
        return {
          matchKey: s.kalem.key,
          tanim: s.kalem.tanim,
          kalan: kalan || s.kalem.miktar || 1,
          birimFiyat: h?.birimFiyatEur ?? null,
          paraBirimi: "EUR",
          tedarikci,
          birim: birimler[s.kalem.key] ?? "Adet",
          not: h?.teslimGun != null ? `Teslim: ${teslimYazisi(h.teslimGun)}` : "",
          paylar: paylar[s.kalem.key] ?? [],
        };
      });
    if (kalemler.length > 0) setSiparisKalemleri(kalemler);
  }

  const bosluk = tablo.satirlar.length === 0;

  return (
    <div className="grid gap-3">
      {/* ————————————————————————————————————— tür şeridi */}
      <div className="oc-scrollx flex items-center gap-1.5 overflow-x-auto overscroll-x-contain [--oc-scroll-bg:var(--background)]">
        <button
          type="button"
          onClick={() => turSec(null)}
          className={cip(tur === null)}
        >
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
      </div>

      {bosluk ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Karşılaştırılacak teklif yok. Hammadde Havuzu&apos;ndan kalem seçip “Teklif Aç” ile
            firmaların fiyatlarını girin; burada yan yana görürsünüz.
          </p>
        </div>
      ) : (
        <>
          {/* ————————————————————————————————— karar şeridi */}
          <section className="flex flex-wrap items-center gap-x-6 gap-y-2 border-2 border-primary/40 bg-primary/[0.04] p-3">
            <div>
              <p className="oc-kicker text-[10px] text-muted-foreground">Seçili Dağılım</p>
              <p className="font-mono text-base font-medium tabular-nums">
                {formatNum(secimToplami, 2)} €
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatNum(secilenFirmalar.length)} firma ·{" "}
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
              <p className="oc-kicker text-[10px] text-muted-foreground">Tek Firmadan En Ucuz</p>
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
            {canWrite && (
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                {secilenFirmalar.map((ted) => (
                  <Button key={ted} type="button" size="xs" onClick={() => siparisAc(ted)}>
                    <Plus className="size-3" />
                    {ted} — Sipariş Aç
                  </Button>
                ))}
              </span>
            )}
          </section>

          {/* ————————————————————————————————— matris */}
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
                      key={c.tedarikci}
                      colSpan={3}
                      className="border-l px-2 py-1.5 text-center font-medium"
                    >
                      <span className="block truncate" title={c.tedarikci}>
                        {c.tedarikci}
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
                    <React.Fragment key={c.tedarikci}>
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
                      <span className="text-[10px] text-muted-foreground">{s.kalem.birim}</span>
                    </td>
                    {tablo.sutunlar.map((c) => {
                      const h = s.hucreler.get(c.tedarikci);
                      const secili = secim[s.kalem.key] === c.tedarikci;
                      return (
                        <React.Fragment key={c.tedarikci}>
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
                            {/* HÜCREYE BASMAK O FİRMAYI SEÇER: satınalmacının
                                en sık hareketi budur ve ayrı bir radyo sütunu
                                tabloyu üç sütun daha genişletirdi. */}
                            {h?.tutarEur == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setSecim((o) => ({ ...o, [s.kalem.key]: c.tedarikci }))
                                }
                                className="oc-tap underline-offset-2 hover:underline"
                                title={`${c.tedarikci} seçilsin`}
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
                    <React.Fragment key={c.tedarikci}>
                      <td className="border-l px-2 py-2" />
                      <td
                        className={cn(
                          "px-2 py-2 text-right",
                          // EKSİK TEKLİFLİ FİRMANIN TOPLAMI SOLUK BASILIR:
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
                        {c.enGecTeslimGun == null ? "—" : `en geç ${teslimYazisi(c.enGecTeslimGun)}`}
                      </td>
                    </React.Fragment>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Tutarlar avroya çevrilerek karşılaştırılır; kuru girilmemiş teklif yarışa girmez.
            Bir satırdaki tutara basmak o firmayı seçer — farklı satırlarda farklı firma
            seçerseniz sipariş firma başına bölünür.
          </p>
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
    </div>
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

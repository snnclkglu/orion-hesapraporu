"use client";

// PLAKA YERLEŞİMİ — görünüm.
//
// Sunucu planı hesaplar, bu bileşen yalnız ONU GÖSTERİR ve parametreleri
// ADRESE yazar. Durum istemcide tutulmaz: kesim planı foreman'a bağlantı
// olarak gönderilebilmelidir ve tarayıcı yenilendiğinde aynı plan çıkmalıdır.

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, FileText, Loader2, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CokluSuzgec } from "../../filters";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import { parcaNumaralari, yerlesimDiyagrami } from "@/lib/diagrams/nesting";
import { formatNum } from "@/lib/drawings/labels";
import type { DenetimSonucu, YerlesimSonucu } from "@/lib/purchasing/hammadde/nesting";
import {
  KESIM_PAYLARI,
  PLAKA_BOYLARI,
  PLAKA_ENLERI,
  plakaAgirligiKg,
  plakaStokAdi,
} from "@/lib/purchasing/hammadde/siniflar";
import { trKatla } from "@/lib/drawings/tr-text";
import { OrderDialog, type SiparisKalemi } from "../../order-dialog";
import type { TedarikciKaydi } from "../../data";
import type { GunlukKur } from "@/lib/purchasing/kur";
import { cn } from "@/lib/utils";

export interface YerlesimGrubu {
  key: string;
  tanim: string;
  /** Çelik kalitesi — plaka sipariş özeti bunu ayrı bir satır yapar. */
  kalite: string;
  kalinlikMm: number | null;
  /** Ölçüsü okunamadığı için yerleşime giremeyen parça sayısı. */
  olcusuzParca: number;
  hata: string;
  sonuc: YerlesimSonucu | null;
  /** Sunucuda koşturulmuş denetim — ekranda özet olarak basılır. */
  denetim: DenetimSonucu[];
  /**
   * Kaynak parçaların paket izi.
   *
   * Plaka siparişi verilince paket ekranındaki "satın alındı" işareti bu
   * anahtarlara yazılır — sac plakası bir ürün olarak sipariş edilse de
   * atölye o resimlere bakıyor (md. 21'in kuralı).
   */
  paylar: { itemNo: string; packageId: string; partKey: string; adet: number }[];
}

export function NestingView({
  tumSaclar,
  isSecenekleri = [],
  isSecili = [],
  secili,
  pay,
  en,
  boy,
  dondur,
  gruplar,
  tedarikciler = [],
  defter = [],
  siparisNolari = [],
  sonKur = null,
  qualities = [],
  canWrite = false,
}: {
  tumSaclar: {
    key: string;
    tanim: string;
    parcaAdedi: number;
    agirlikKg: number | null;
    isler: string[];
  }[];
  isSecenekleri?: { value: string; label: string; count: number }[];
  isSecili?: string[];
  secili: string[];
  pay: number;
  en: number | null;
  boy: number | null;
  dondur: boolean;
  gruplar: YerlesimGrubu[];
  /** Sipariş penceresinin gerektirdikleri — ekipman tarafıyla ORTAK. */
  tedarikciler?: string[];
  defter?: TedarikciKaydi[];
  siparisNolari?: string[];
  sonKur?: GunlukKur | null;
  qualities?: string[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [gidiyor, basla] = useTransition();
  const [siparisKalemleri, setSiparisKalemleri] = useState<SiparisKalemi[] | null>(null);

  /**
   * Adres parametresini günceller — durum TEK yerde, ADRESTE yaşar.
   *
   * `cokluDeger` verilirse aynı ad birden çok kez yazılır (`?is=0053&is=0057`);
   * çoklu süzgeç tek bir dizgeye sıkıştırılsaydı iş numarasındaki tire
   * ayraçla karışırdı.
   */
  function ayarla(degisiklikler: Record<string, string | null>, cokluDeger?: string[]) {
    const p = new URLSearchParams(params?.toString() ?? "");
    for (const [k, v] of Object.entries(degisiklikler)) {
      p.delete(k);
      if (cokluDeger && Object.keys(degisiklikler).length === 1) {
        for (const x of cokluDeger) p.append(k, x);
      } else if (v != null) {
        p.set(k, v);
      }
    }
    basla(() => router.replace(`/purchasing/hammadde/yerlesim?${p.toString()}`));
  }

  /** Görünen (süzülmüş) kalemlerin tamamını seçer ya da seçimi bırakır. */
  function topluSec(ac: boolean) {
    const p = new URLSearchParams(params?.toString() ?? "");
    p.delete("k");
    if (ac) for (const s of tumSaclar) p.append("k", s.key);
    basla(() => router.replace(`/purchasing/hammadde/yerlesim?${p.toString()}`));
  }

  function sacSec(key: string, acik: boolean) {
    const p = new URLSearchParams(params?.toString() ?? "");
    const mevcut = new Set(p.getAll("k"));
    if (acik) mevcut.add(key);
    else mevcut.delete(key);
    p.delete("k");
    for (const k of mevcut) p.append("k", k);
    basla(() => router.replace(`/purchasing/hammadde/yerlesim?${p.toString()}`));
  }

  const secimKumesi = new Set(secili);
  const toplamPlaka = gruplar.reduce((t, g) => t + (g.sonuc?.plakalar.length ?? 0), 0);
  const toplamPlakaKg = gruplar.reduce((t, g) => t + (g.sonuc?.plakaAgirlikKg ?? 0), 0);
  const toplamParcaKg = gruplar.reduce((t, g) => t + (g.sonuc?.parcaAgirlikKg ?? 0), 0);
  const fire = toplamPlakaKg > 0 ? 100 - (toplamParcaKg / toplamPlakaKg) * 100 : 0;

  return (
    <div className="grid gap-3">
      {/* ————————————————————————————————————— ayarlar */}
      <section className="grid gap-3 border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="y-pay">Kesim Payı</Label>
            <Select value={String(pay)} onValueChange={(v) => ayarla({ pay: v })}>
              <SelectTrigger id="y-pay" className="w-[7.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KESIM_PAYLARI.map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {p} mm
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="y-en">Plaka Eni</Label>
            <Select
              value={en == null ? "oto" : String(en)}
              onValueChange={(v) => ayarla({ en: v === "oto" ? null : v })}
            >
              <SelectTrigger id="y-en" className="w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oto">Otomatik</SelectItem>
                {PLAKA_ENLERI.map((e) => (
                  <SelectItem key={e} value={String(e)}>
                    {formatNum(e)} mm
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="y-boy">Plaka Boyu</Label>
            <Select
              value={boy == null ? "oto" : String(boy)}
              onValueChange={(v) => ayarla({ boy: v === "oto" ? null : v })}
            >
              <SelectTrigger id="y-boy" className="w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oto">Otomatik</SelectItem>
                {PLAKA_BOYLARI.map((b) => (
                  <SelectItem key={b} value={String(b)}>
                    {formatNum(b)} mm
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="y-don">Parça Döndürme</Label>
            <Select
              value={dondur ? "1" : "0"}
              onValueChange={(v) => ayarla({ dondur: v === "1" ? null : "0" })}
            >
              <SelectTrigger id="y-don" className="w-[9.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Serbest (90°)</SelectItem>
                <SelectItem value="0">Yön sabit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {gidiyor && (
            <span className="inline-flex items-center gap-1 pb-2 font-mono text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Yerleşim hesaplanıyor
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Otomatik plaka seçimi en az plakayla biten, eşitlikte en küçük alanlı ölçüyü kullanır.
          Parça döndürme serbest bırakıldığında fire düşer; haddeleme yönü önemliyse yön sabitlenir.
        </p>
      </section>

      {/* ————————————————————————————————————— sac seçimi */}
      <section className="border bg-card p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="oc-kicker text-[10px] text-muted-foreground">
            Yerleştirilecek Sac Kalemleri
          </p>
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatNum(secili.length)} seçili
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <CokluSuzgec
              baslik="İş"
              secenekler={isSecenekleri}
              secili={isSecili}
              onChange={(v) => ayarla({ is: null }, v)}
            />
            <button
              type="button"
              onClick={() => topluSec(true)}
              className="oc-tap border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Görünenleri seç
            </button>
            <button
              type="button"
              onClick={() => topluSec(false)}
              className="oc-tap border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              disabled={secili.length === 0}
            >
              Seçimi bırak
            </button>
          </span>
        </div>
        {tumSaclar.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Havuzda sac kalemi yok. Teknik resim paketi yüklenip eşleştirildiğinde buraya düşer.
          </p>
        ) : (
          // `.oc-scrollx` YOK: bu şerit YATAY değil DİKEY kayar (sarmalı liste).
          // Yatay gölge yardımcısını dikey kayan bir kaba vermek, olmayan bir
          // yönde gölge vaat etmektir.
          <div className="flex max-h-[14rem] flex-wrap gap-1.5 overflow-y-auto">
            {tumSaclar.map((s) => {
              const acik = secimKumesi.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => sacSec(s.key, !acik)}
                  className={cn(
                    "oc-tap border px-2 py-1 text-left font-mono text-[11px] transition-colors",
                    acik
                      ? "border-primary/60 bg-primary/[0.10] text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.tanim}
                  <span className="ml-1.5 opacity-60">
                    {formatNum(s.parcaAdedi)} parça
                    {s.agirlikKg != null && ` · ${formatNum(Math.round(s.agirlikKg))} kg`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ————————————————————————————————————— PLAKA SİPARİŞ ÖZETİ */}
      <PlakaOzeti
        gruplar={gruplar}
        canWrite={canWrite}
        onSiparis={(kalemler) => setSiparisKalemleri(kalemler)}
      />

      {/* ————————————————————————————————————— özet */}
      {gruplar.length > 0 && (
        <section className="flex flex-wrap gap-y-2 border bg-card p-3">
          <Kutu baslik="Plaka" deger={formatNum(toplamPlaka)} alt={`${gruplar.length} kalınlık`} />
          <Kutu baslik="Plaka Ağırlığı" deger={`${formatNum(Math.round(toplamPlakaKg))} kg`} />
          <Kutu baslik="Parça Ağırlığı" deger={`${formatNum(Math.round(toplamParcaKg))} kg`} />
          <Kutu
            baslik="Fire"
            deger={`%${formatNum(fire, 1)}`}
            alt={`${formatNum(Math.round(toplamPlakaKg - toplamParcaKg))} kg`}
          />
          {/* PDF EKRANDAKİ PLANIN AYNISIDIR: parametreler adreste taşındığı
              için uç aynı hesabı yeniden koşturur ve iki çıktı ayrışamaz. */}
          <form method="GET" action="/purchasing/hammadde/yerlesim/pdf" className="self-center">
            {secili.map((k) => (
              <input key={k} type="hidden" name="k" value={k} />
            ))}
            <input type="hidden" name="pay" value={String(pay)} />
            {en != null && <input type="hidden" name="en" value={String(en)} />}
            {boy != null && <input type="hidden" name="boy" value={String(boy)} />}
            {!dondur && <input type="hidden" name="dondur" value="0" />}
            <Button type="submit" size="xs" variant="outline">
              <FileText className="size-3" />
              Kesim Planı PDF
            </Button>
          </form>
        </section>
      )}

      {/* ————————————————————————————————————— plakalar */}
      {gruplar.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Yerleştirilecek kalem seçilmedi. Yukarıdan bir ya da birden çok sac kalemi seçin ya da
            Hammadde Havuzu&apos;ndan “Plakaya Yerleştir” ile gelin.
          </p>
        </div>
      ) : (
        gruplar.map((g) => <Grup key={g.key} g={g} />)
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

function Grup({ g }: { g: YerlesimGrubu }) {
  if (g.hata) {
    return (
      <section className="border border-amber-500/40 bg-amber-500/10 p-3">
        <p className="font-mono text-[13px] font-medium">{g.tanim}</p>
        <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-400">{g.hata}</p>
      </section>
    );
  }
  const s = g.sonuc;
  if (!s || s.plakalar.length === 0) {
    return (
      <section className="border bg-card p-3">
        <p className="font-mono text-[13px] font-medium">{g.tanim}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {s && s.sigmayanlar.length > 0
            ? "Hiçbir parça seçili plakaya sığmadı."
            : "Ölçüsü okunabilen parça yok; yerleşim yapılamadı."}
        </p>
        {s && <Sigmayanlar sonuc={s} />}
      </section>
    );
  }

  const numaralar = parcaNumaralari(s.plakalar);
  // Liste ile çizim AYNI numarayı kullanır — kaynak tektir.
  const liste = [...numaralar.entries()]
    .map(([id, no]) => {
      const ornek = s.plakalar.flatMap((p) => p.parcalar).find((p) => p.id === id);
      const adet = s.plakalar.reduce(
        (t, p) => t + p.parcalar.filter((x) => x.id === id).length,
        0
      );
      const dondu = s.plakalar
        .flatMap((p) => p.parcalar)
        .filter((p) => p.id === id)
        .filter((p) => p.dondu).length;
      return {
        no,
        id,
        ad: ornek?.ad ?? id,
        // PARÇANIN KENDİ ölçüsü — plakadaki döndürülmüş hâli değil.
        en: ornek?.kaynakEnMm ?? 0,
        boy: ornek?.kaynakBoyMm ?? 0,
        adet,
        dondu,
      };
    })
    .sort((a, b) => a.no - b.no);

  return (
    <section className="grid gap-3 border bg-card p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-mono text-[14px] font-medium">{g.tanim}</h3>
        <span className="font-mono text-[12px] text-muted-foreground">
          {formatNum(s.plakalar.length)} × {formatNum(s.plaka.enMm)}×{formatNum(s.plaka.boyMm)} mm ·
          pay {s.payMm} mm · doluluk %{formatNum(s.dolulukYuzde, 1)}
          {s.plakaAgirlikKg != null && ` · ${formatNum(Math.round(s.plakaAgirlikKg))} kg plaka`}
        </span>
      </div>

      <DenetimSeridi denetim={g.denetim} />

      {g.olcusuzParca > 0 && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          {formatNum(g.olcusuzParca)} parçanın en/boy ölçüsü tanımdan okunamadığı için yerleşime
          girmedi. Hammadde Havuzu&apos;ndan düzeltebilirsiniz.
        </p>
      )}

      <Sigmayanlar sonuc={s} />

      <div className="grid gap-3">
        {s.plakalar.map((p) => (
          <div
            key={p.sira}
            className="oc-scrollx overflow-x-auto overscroll-x-contain border bg-white p-2 [--oc-scroll-bg:#fff]"
          >
            <DiagramSvg
              diagram={yerlesimDiyagrami({
                plaka: p,
                numaralar,
                baslik: `${g.tanim} · Plaka ${p.sira}/${s.plakalar.length}`,
                altNot:
                  `${formatNum(p.parcalar.length)} parça · doluluk %${formatNum(p.dolulukYuzde, 1)}` +
                  (g.kalinlikMm
                    ? ` · ${formatNum(
                        Math.round(p.enMm * p.boyMm * g.kalinlikMm * 7.85e-6)
                      )} kg plaka`
                    : ""),
              })}
              className="mx-auto"
            />
          </div>
        ))}
      </div>

      <div className="oc-scrollx overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-3 font-normal">No</th>
              <th className="py-1 pr-3 font-normal">Parça</th>
              <th className="py-1 pr-3 text-right font-normal">En</th>
              <th className="py-1 pr-3 text-right font-normal">Boy</th>
              <th className="py-1 pr-3 text-right font-normal">Adet</th>
              <th className="py-1 pr-3 text-right font-normal">Döndü</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {liste.map((r) => (
              <tr key={r.id} className="border-b border-border/40">
                <td className="py-1 pr-3 font-medium">{r.no}</td>
                <td className="py-1 pr-3 font-sans">{r.ad}</td>
                <td className="py-1 pr-3 text-right">{formatNum(r.en)}</td>
                <td className="py-1 pr-3 text-right">{formatNum(r.boy)}</td>
                <td className="py-1 pr-3 text-right">{formatNum(r.adet)}</td>
                <td className="py-1 pr-3 text-right text-muted-foreground">
                  {r.dondu > 0 ? `${formatNum(r.dondu)} × 90°` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * PLAKA SİPARİŞ ÖZETİ — ekranın en üstündeki cevap.
 *
 * Kullanıcı isteği (15.08.2026): *"Bir veya birkaç projeyi seçtiğimde nesting
 * yapıp bana üste hangi plakadan kaç adet alınması gerektiğini özet olarak
 * versin. Ben plaka enini seçerim, ona göre özet değişir."*
 *
 * Satır SİPARİŞ SATIRIDIR, kalem satırı değil: aynı ölçü ve aynı kalitedeki
 * plakalar TEK satırda toplanır — tedarikçiye "2000×6000, 15 mm S355JR, 3
 * adet" denir, üç ayrı kalem sayılmaz. Kalınlık ve kalite anahtarın
 * parçasıdır; 15 mm S235 ile 15 mm S355 aynı plaka değildir.
 *
 * ÖZET SEÇİMİ VE PLAKA AYARINI İZLER: yukarıdaki "Plaka Eni" değiştiğinde
 * yerleşim yeniden koşar ve bu tablo onunla birlikte değişir — ikinci bir
 * hesap değil, aynı planın okunuşudur.
 */
function PlakaOzeti({
  gruplar,
  canWrite,
  onSiparis,
}: {
  gruplar: YerlesimGrubu[];
  canWrite: boolean;
  onSiparis: (kalemler: SiparisKalemi[]) => void;
}) {
  const satirlar = new Map<
    string,
    {
      enMm: number;
      boyMm: number;
      kalinlikMm: number | null;
      kalite: string;
      adet: number;
      kg: number;
      paylar: { itemNo: string; packageId: string; partKey: string; adet: number }[];
    }
  >();

  for (const g of gruplar) {
    if (!g.sonuc || g.sonuc.plakalar.length === 0) continue;
    const { enMm, boyMm } = g.sonuc.plaka;
    const anahtar = `${enMm}x${boyMm}|${g.kalinlikMm ?? "?"}|${g.kalite}`;
    const mevcut = satirlar.get(anahtar);
    const kg = g.sonuc.plakaAgirlikKg ?? 0;
    if (mevcut) {
      mevcut.adet += g.sonuc.plakalar.length;
      mevcut.kg += kg;
      mevcut.paylar.push(...g.paylar);
    } else {
      satirlar.set(anahtar, {
        enMm,
        boyMm,
        kalinlikMm: g.kalinlikMm,
        kalite: g.kalite,
        adet: g.sonuc.plakalar.length,
        kg,
        paylar: [...g.paylar],
      });
    }
  }

  if (satirlar.size === 0) return null;

  const liste = [...satirlar.values()].sort(
    (a, b) => (a.kalinlikMm ?? 0) - (b.kalinlikMm ?? 0) || a.enMm - b.enMm || a.boyMm - b.boyMm
  );
  const toplamAdet = liste.reduce((t, r) => t + r.adet, 0);
  const toplamKg = liste.reduce((t, r) => t + r.kg, 0);

  /**
   * SİPARİŞ KALEMİ PLAKADIR, PARÇA DEĞİL.
   *
   * Kullanıcının verdiği DESSAN proforması bunu birebir gösteriyor: satır
   * `10 X 1500 X 6000 · ST37 · 5 plaka · 707 kg/plaka · 3.537 KG` biçiminde ve
   * parçaların adı hiç geçmiyor. TİCARİ MİKTAR KİLODUR (birim fiyat USD/kg,
   * tutar miktar × fiyat); plaka adedi bir NİTELİKTİR ve nota yazılır.
   *
   * Paket işaretleri yine PARÇA anahtarlarına yazılır — atölye o resimlere
   * bakıyor ve "sac geldi mi" sorusu orada sorulur.
   */
  function siparisKalemleri(): SiparisKalemi[] {
    return liste.map((r) => {
      const ad = plakaStokAdi(r.kalinlikMm, r.enMm, r.boyMm, r.kalite);
      const birim = plakaAgirligiKg(r.kalinlikMm, r.enMm, r.boyMm);
      return {
        matchKey: trKatla(ad),
        tanim: ad,
        kalan: Math.round(r.kg),
        birimFiyat: null,
        paraBirimi: null,
        tedarikci: "",
        // TİCARİ MİKTAR KİLODUR (proforma: `3.537 KG × 0,690 USD`); plaka
        // adedi bir niteliktir ve nota yazılır.
        birim: "Kg",
        not:
          `${formatNum(r.adet)} plaka` +
          (birim ? ` × ${formatNum(Math.round(birim))} kg` : ""),
        paylar: r.paylar,
      };
    });
  }

  return (
    <section className="border-2 border-primary/40 bg-primary/[0.04] p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
        <p className="oc-kicker text-[10px] text-primary">Alınacak Plakalar</p>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatNum(toplamAdet)} plaka · {formatNum(Math.round(toplamKg))} kg
        </span>
        {canWrite && (
          <span className="ml-auto">
            <Button type="button" size="xs" onClick={() => onSiparis(siparisKalemleri())}>
              <Plus className="size-3" />
              Plaka Siparişi Aç
            </Button>
          </span>
        )}
      </div>
      <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b text-left text-[11px] text-muted-foreground">
              <th className="py-1 pr-4 font-normal">Plaka Ölçüsü</th>
              <th className="py-1 pr-4 font-normal">Kalınlık</th>
              <th className="py-1 pr-4 font-normal">Kalite</th>
              <th className="py-1 pr-4 text-right font-normal">Plaka Adet</th>
              <th className="py-1 pr-4 text-right font-normal">kg / Plaka</th>
              <th className="py-1 pr-4 text-right font-normal">Toplam kg</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {liste.map((r) => (
              <tr
                key={`${r.enMm}-${r.boyMm}-${r.kalinlikMm}-${r.kalite}`}
                className="border-b border-border/40"
              >
                <td className="py-1.5 pr-4 font-medium">
                  {formatNum(r.enMm)} × {formatNum(r.boyMm)} mm
                </td>
                <td className="py-1.5 pr-4">
                  {r.kalinlikMm == null ? "—" : `${formatNum(r.kalinlikMm, 1)} mm`}
                </td>
                <td className="py-1.5 pr-4">{r.kalite || "—"}</td>
                <td className="py-1.5 pr-4 text-right text-[15px] font-semibold">
                  {formatNum(r.adet)}
                </td>
                <td className="py-1.5 pr-4 text-right text-muted-foreground">
                  {(() => {
                    const b = plakaAgirligiKg(r.kalinlikMm, r.enMm, r.boyMm);
                    return b == null ? "—" : formatNum(Math.round(b));
                  })()}
                </td>
                <td className="py-1.5 pr-4 text-right">{formatNum(Math.round(r.kg))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/20 font-mono font-semibold tabular-nums">
              <td className="py-1.5 pr-4" colSpan={3}>
                Toplam
              </td>
              <td className="py-1.5 pr-4 text-right">{formatNum(toplamAdet)}</td>
              <td className="py-1.5 pr-4" />
              <td className="py-1.5 pr-4 text-right">{formatNum(Math.round(toplamKg))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/**
 * DENETİM ÖZETİ — planın kendi kendine sorduğu sorular.
 *
 * Kullanıcı kararı: *"Nesting çok önemli … kontrollerin kısa özetleri ekrana
 * verilmeli."* GEÇEN KONTROLLER DE GÖSTERİLİR ve bu bilinçli: yalnız hatayı
 * basmak, "kontrol edildi mi" sorusunu cevapsız bırakır ve sessizlik bir
 * güvence sanılır.
 */
function DenetimSeridi({ denetim }: { denetim: DenetimSonucu[] }) {
  if (denetim.length === 0) return null;
  const kalan = denetim.filter((d) => !d.gecti);
  return (
    <div
      className={cn(
        "grid gap-1 border px-2 py-1.5",
        kalan.length > 0 ? "border-destructive/50 bg-destructive/[0.06]" : "border-border bg-muted/30"
      )}
    >
      <p className="oc-kicker text-[10px] text-muted-foreground">
        Yerleşim Denetimi — {denetim.length - kalan.length}/{denetim.length} geçti
      </p>
      <ul className="grid gap-0.5 text-[11px] sm:grid-cols-2 xl:grid-cols-3">
        {denetim.map((d) => (
          <li key={d.ad} className="flex items-start gap-1.5">
            {d.gecti ? (
              <Check className="mt-[2px] size-3 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <TriangleAlert className="mt-[2px] size-3 shrink-0 text-destructive" aria-hidden />
            )}
            <span className={cn("min-w-0", !d.gecti && "font-medium text-destructive")}>
              <span className="font-medium">{d.ad}:</span> {d.ozet}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** SIĞMAYAN PARÇA SESSİZCE DÜŞÜRÜLMEZ — nedeni yazılır (evin kuralı). */
function Sigmayanlar({ sonuc }: { sonuc: YerlesimSonucu }) {
  if (sonuc.sigmayanlar.length === 0) return null;
  return (
    <div className="border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
      <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
        {formatNum(sonuc.sigmayanlar.reduce((t, s) => t + s.adet, 0))} parça hiçbir plakaya sığmadı
      </p>
      <ul className="mt-1 grid gap-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
        {sonuc.sigmayanlar.map((s) => (
          <li key={s.id}>
            {s.adet} × {s.ad} — {s.neden}
          </li>
        ))}
      </ul>
    </div>
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

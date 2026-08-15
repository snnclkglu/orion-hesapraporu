"use client";

// PLAKA YERLEŞİMİ — görünüm.
//
// Sunucu planı hesaplar, bu bileşen yalnız ONU GÖSTERİR ve parametreleri
// ADRESE yazar. Durum istemcide tutulmaz: kesim planı foreman'a bağlantı
// olarak gönderilebilmelidir ve tarayıcı yenilendiğinde aynı plan çıkmalıdır.

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import type { YerlesimSonucu } from "@/lib/purchasing/hammadde/nesting";
import {
  KESIM_PAYLARI,
  PLAKA_BOYLARI,
  PLAKA_ENLERI,
} from "@/lib/purchasing/hammadde/siniflar";
import { cn } from "@/lib/utils";

export interface YerlesimGrubu {
  key: string;
  tanim: string;
  kalinlikMm: number | null;
  /** Ölçüsü okunamadığı için yerleşime giremeyen parça sayısı. */
  olcusuzParca: number;
  hata: string;
  sonuc: YerlesimSonucu | null;
}

export function NestingView({
  tumSaclar,
  secili,
  pay,
  en,
  boy,
  dondur,
  gruplar,
}: {
  tumSaclar: { key: string; tanim: string; parcaAdedi: number; agirlikKg: number | null }[];
  secili: string[];
  pay: number;
  en: number | null;
  boy: number | null;
  dondur: boolean;
  gruplar: YerlesimGrubu[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [gidiyor, basla] = useTransition();

  /** Adres parametresini günceller — durum TEK yerde, adreste yaşar. */
  function ayarla(degisiklikler: Record<string, string | null>) {
    const p = new URLSearchParams(params?.toString() ?? "");
    for (const [k, v] of Object.entries(degisiklikler)) {
      if (v == null) p.delete(k);
      else p.set(k, v);
    }
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
        <p className="oc-kicker mb-2 text-[10px] text-muted-foreground">
          Yerleştirilecek Sac Kalemleri
        </p>
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

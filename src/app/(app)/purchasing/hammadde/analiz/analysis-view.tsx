"use client";

// HAMMADDE ALIM ANALİZİ — görünüm.
//
// Kullanıcının çalışma dosyasının ("Sac-Profil-Ray Satınalma Fiyatları ve
// İstatistik") ekrandaki karşılığı ve ondan FAZLASI:
//
//   · Özet sayfasının YIL × KATEGORİ matrisi birebir (kilo, ağırlıklı ortalama,
//     toplam) — üç para biriminde birden okunabilir.
//   · Dosyada OLMAYAN şey: GİDİŞAT. Ortalama birim fiyatın ay ay eğrisi,
//     kullanıcının "kontrol ediyorum" dediği şeyin ta kendisidir ve Excel'de
//     yalnız yıl toplamı olarak vardı.
//   · Kalem ve tedarikçi kırılımı: "bu sacın kilosu nereden nereye geldi",
//     "hangi firmadan kaç ton aldık".
//
// ═══════════════════════════════════════════ İKİ GRAFİK, İKİ AYRI KURAL
//
// FİYAT EĞRİSİ yalnız ALIM YAPILAN AYLARI çizer: alım olmayan bir ayın ortalama
// fiyatı YOKTUR ve sıfır yazmak eğriyi tabana çakardı ("null ≠ 0", md. 22'nin
// kur kuralı). MİKTAR EĞRİSİ ise bütün ayları çizer, çünkü orada sıfır gerçek
// bir cevaptır: o ay alım yapılmadı.
//
// ORTALAMA HER YERDE AĞIRLIKLIDIR (`alim-analizi.ts`): toplam ÷ kilo.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CokluSuzgec } from "../../filters";
import { TimeLineChart, type ChartColumn, type ChartSeries } from "@/components/charts";
import { PanoKabugu } from "../../board-ui";
import { formatNum } from "@/lib/drawings/labels";
import { trKatla } from "@/lib/drawings/tr-text";
import { tarihGoster } from "@/lib/purchasing/terms";
import {
  alimToplami,
  aylikOrtalamaKg,
  aylikSeri,
  kalemOzetleri,
  kategoriSirasi,
  tedarikciOzetleri,
  tutarAl,
  type AlimBirimi,
  type AlimSatiri,
} from "@/lib/purchasing/hammadde/alim-analizi";
import { HAMMADDE_ADLARI, HAMMADDE_TONLARI } from "@/lib/purchasing/hammadde/siniflar";
import { cn } from "@/lib/utils";

const BIRIM_SIMGE: Record<AlimBirimi, string> = { EUR: "€", USD: "$", TRY: "₺" };

/** Kategori adı — çekirdek ASCII konuşur, ekran Türkçe. */
function kategoriAdi(k: string): string {
  return (HAMMADDE_ADLARI as Record<string, string>)[k] ?? k;
}
function kategoriTonu(k: string): number {
  return (HAMMADDE_TONLARI as Record<string, number>)[k] ?? 0;
}

/** Birim fiyat KURUŞLU okunur: 0,66 ile 0,74 arasında %12 var. */
function fiyat(v: number | null | undefined, birim: AlimBirimi): string {
  if (v == null) return "—";
  return `${formatNum(v, 3)} ${BIRIM_SIMGE[birim]}`;
}
function tutar(v: number | null | undefined, birim: AlimBirimi): string {
  if (v == null) return "—";
  return `${formatNum(Math.round(v))} ${BIRIM_SIMGE[birim]}`;
}
function kilo(v: number): string {
  return `${formatNum(Math.round(v))} kg`;
}

export function AnalysisView({
  satirlar,
  kiloDisiSatir,
  siparisSayisi,
}: {
  satirlar: AlimSatiri[];
  kiloDisiSatir: number;
  siparisSayisi: number;
}) {
  const [birim, setBirim] = useState<AlimBirimi>("EUR");
  const [q, setQ] = useState("");
  const [yillar, setYillar] = useState<string[]>([]);
  const [kategoriler, setKategoriler] = useState<string[]>([]);
  const [firmalar, setFirmalar] = useState<string[]>([]);
  const [kaynaklar, setKaynaklar] = useState<string[]>([]);
  const [seciliKalem, setSeciliKalem] = useState<string | null>(null);

  const secenekler = useMemo(() => {
    const say = (f: (s: AlimSatiri) => string) => {
      const m = new Map<string, number>();
      for (const s of satirlar) {
        const v = f(s);
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      }
      return m;
    };
    const yil = say((s) => s.gun.slice(0, 4));
    const kat = say((s) => s.kategori);
    const firma = say((s) => s.tedarikci);
    const kaynak = say((s) => s.kaynak);
    return {
      yillar: [...yil.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([value, count]) => ({ value, label: value, count })),
      kategoriler: [...kat.entries()]
        .sort((a, b) => kategoriSirasi(a[0]) - kategoriSirasi(b[0]))
        .map(([value, count]) => ({ value, label: kategoriAdi(value), count })),
      firmalar: [...firma.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, label: value, count })),
      kaynaklar: [...kaynak.entries()].map(([value, count]) => ({
        value,
        label: value === "devralinan" ? "Devralınan" : "Sipariş",
        count,
      })),
    };
  }, [satirlar]);

  const gorunen = useMemo(() => {
    const arama = trKatla(q.trim());
    const yilKume = new Set(yillar);
    const katKume = new Set(kategoriler);
    const firmaKume = new Set(firmalar);
    const kaynakKume = new Set(kaynaklar);
    return satirlar.filter((s) => {
      if (yilKume.size > 0 && !yilKume.has(s.gun.slice(0, 4))) return false;
      if (katKume.size > 0 && !katKume.has(s.kategori)) return false;
      if (firmaKume.size > 0 && !firmaKume.has(s.tedarikci)) return false;
      if (kaynakKume.size > 0 && !kaynakKume.has(s.kaynak)) return false;
      if (!arama) return true;
      return trKatla(`${s.tanim} ${s.kalite} ${s.tedarikci}`).includes(arama);
    });
  }, [satirlar, q, yillar, kategoriler, firmalar, kaynaklar]);

  const toplam = useMemo(() => alimToplami(gorunen, birim), [gorunen, birim]);
  const aylik = useMemo(() => aylikOrtalamaKg(gorunen), [gorunen]);

  // ————————————————————————————————— yıl × kategori matrisi
  const matris = useMemo(() => {
    const yillarSirali = [...new Set(gorunen.map((s) => s.gun.slice(0, 4)))].sort();
    const katSirali = [...new Set(gorunen.map((s) => s.kategori))].sort(
      (a, b) => kategoriSirasi(a) - kategoriSirasi(b)
    );
    const hucre = (yil: string, kat: string) =>
      alimToplami(
        gorunen.filter((s) => s.gun.slice(0, 4) === yil && s.kategori === kat),
        birim
      );
    return {
      yillar: yillarSirali,
      kategoriler: katSirali,
      hucreler: new Map(
        yillarSirali.flatMap((y) => katSirali.map((k) => [`${y}|${k}`, hucre(y, k)] as const))
      ),
      yilToplam: new Map(
        yillarSirali.map(
          (y) =>
            [y, alimToplami(gorunen.filter((s) => s.gun.slice(0, 4) === y), birim)] as const
        )
      ),
      katToplam: new Map(
        katSirali.map(
          (k) => [k, alimToplami(gorunen.filter((s) => s.kategori === k), birim)] as const
        )
      ),
    };
  }, [gorunen, birim]);

  // ————————————————————————————————— grafikler
  const seriler: ChartSeries[] = useMemo(
    () =>
      matris.kategoriler.map((k) => ({
        key: k,
        label: kategoriAdi(k),
        hue: kategoriTonu(k),
      })),
    [matris.kategoriler]
  );

  const fiyatSutunlari: ChartColumn[] = useMemo(() => {
    const aylar = new Map<string, ChartColumn>();
    for (const k of matris.kategoriler) {
      for (const n of aylikSeri(gorunen.filter((s) => s.kategori === k), birim)) {
        if (n.ortalama == null) continue; // alım yoksa nokta YOK (sıfır değil)
        const mevcut = aylar.get(n.ay);
        if (mevcut) mevcut.parts[k] = n.ortalama;
        else aylar.set(n.ay, { key: n.ay, label: ayEtiketi(n.ay), total: 0, parts: { [k]: n.ortalama } });
      }
    }
    return [...aylar.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [gorunen, matris.kategoriler, birim]);

  const miktarSutunlari: ChartColumn[] = useMemo(() => {
    const tumSeri = aylikSeri(gorunen, birim);
    return tumSeri.map((n) => {
      const parts: Record<string, number> = {};
      for (const k of matris.kategoriler) {
        parts[k] = gorunen
          .filter((s) => s.kategori === k && s.gun.slice(0, 7) === n.ay)
          .reduce((t, s) => t + s.kg, 0);
      }
      return { key: n.ay, label: ayEtiketi(n.ay), total: n.kg, parts };
    });
  }, [gorunen, matris.kategoriler, birim]);

  // ————————————————————————————————— kırılımlar
  const kalemler = useMemo(() => kalemOzetleri(gorunen, birim), [gorunen, birim]);
  const firmaOzetleri = useMemo(() => tedarikciOzetleri(gorunen, birim), [gorunen, birim]);

  const kalemSatirlari = useMemo(
    () => (seciliKalem ? gorunen.filter((s) => s.key === seciliKalem) : []),
    [gorunen, seciliKalem]
  );
  const kalemSutunlari: ChartColumn[] = useMemo(() => {
    if (kalemSatirlari.length === 0) return [];
    return aylikSeri(kalemSatirlari, birim)
      .filter((n) => n.ortalama != null)
      .map((n) => ({
        key: n.ay,
        label: ayEtiketi(n.ay),
        total: n.ortalama ?? 0,
        parts: { fiyat: n.ortalama ?? 0 },
      }));
  }, [kalemSatirlari, birim]);

  const temiz =
    !q && yillar.length === 0 && kategoriler.length === 0 && firmalar.length === 0 && kaynaklar.length === 0;

  return (
    <div className="grid gap-3">
      {/* ————————————————————————————————————— süzgeç şeridi */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center border">
          {(["EUR", "USD", "TRY"] as AlimBirimi[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBirim(b)}
              className={cn(
                "px-2.5 py-1.5 font-mono text-[12px] transition-colors pointer-coarse:py-2.5",
                birim === b
                  ? "bg-primary/[0.12] font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {BIRIM_SIMGE[b]}
            </button>
          ))}
        </span>
        <span className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tanım, Kalite, Firma Ara…"
            className="h-8 w-[min(16rem,calc(100vw-4rem))] pl-7 text-base pointer-fine:text-sm"
          />
        </span>
        <CokluSuzgec baslik="Yıl" secenekler={secenekler.yillar} secili={yillar} onChange={setYillar} />
        <CokluSuzgec
          baslik="Kategori"
          secenekler={secenekler.kategoriler}
          secili={kategoriler}
          onChange={setKategoriler}
        />
        <CokluSuzgec
          baslik="Tedarikçi"
          secenekler={secenekler.firmalar}
          secili={firmalar}
          onChange={setFirmalar}
        />
        <CokluSuzgec
          baslik="Kaynak"
          secenekler={secenekler.kaynaklar}
          secili={kaynaklar}
          onChange={setKaynaklar}
        />
        {!temiz && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setYillar([]);
              setKategoriler([]);
              setFirmalar([]);
              setKaynaklar([]);
            }}
            className="oc-tap border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Süzgeci temizle
          </button>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {formatNum(gorunen.length)} / {formatNum(satirlar.length)} alım satırı
        </span>
      </div>

      {/* ————————————————————————————————————— künye */}
      <section className="flex flex-wrap gap-y-2 border bg-card p-3">
        <Kutu baslik="Toplam Miktar" deger={kilo(toplam.kg)} alt={`${formatNum(toplam.satir)} alım`} />
        <Kutu baslik="Toplam Tutar" deger={tutar(toplam.tutar, birim)} alt="KDV hariç" />
        <Kutu
          baslik="Ortalama Birim Fiyat"
          deger={fiyat(toplam.ortalama, birim)}
          alt="ağırlıklı (toplam ÷ kilo)"
        />
        {aylik ? (
          <Kutu
            baslik="Aylık Ortalama Alım"
            deger={kilo(aylik.kgAylik)}
            alt={`${tarihGoster(aylik.ilkGun)} → ${tarihGoster(aylik.sonGun)} · ${formatNum(aylik.ay, 1)} ay`}
          />
        ) : (
          <Kutu baslik="Aylık Ortalama Alım" deger="—" />
        )}
        <Kutu
          baslik="Canlı Sipariş"
          deger={formatNum(siparisSayisi)}
          alt={
            kiloDisiSatir > 0
              ? `${formatNum(kiloDisiSatir)} satır kilo dışı — analize girmedi`
              : "hepsi kilo birimli"
          }
        />
      </section>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Bu süzgeçle eşleşen alım yok. Süzgeci temizleyip yeniden deneyin.
          </p>
        </div>
      ) : (
        <>
          {/* ————————————————————————————————— yıl × kategori */}
          <section className="border bg-card">
            <div className="flex flex-wrap items-baseline gap-x-3 border-b px-3 py-2">
              <p className="oc-kicker text-[10px] text-muted-foreground">Yıl × Kategori</p>
              <span className="text-[11px] text-muted-foreground">
                Ortalama birim fiyat AĞIRLIKLIDIR: toplam ÷ kilo.
              </span>
            </div>
            <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-1.5 font-normal">Yıl</th>
                    {matris.kategoriler.map((k) => (
                      <th key={k} colSpan={3} className="border-l px-3 py-1.5 text-center font-medium">
                        {kategoriAdi(k)}
                      </th>
                    ))}
                    <th colSpan={3} className="border-l px-3 py-1.5 text-center font-medium">
                      Toplam
                    </th>
                  </tr>
                  <tr className="text-[10px] text-muted-foreground">
                    <th className="px-3 py-1 font-normal" />
                    {[...matris.kategoriler, "TOPLAM"].map((k) => (
                      <ÜçBaslik key={k} birim={birim} />
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {matris.yillar.map((y) => (
                    <tr key={y} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{y}</td>
                      {matris.kategoriler.map((k) => (
                        <ÜçHucre key={k} t={matris.hucreler.get(`${y}|${k}`)} />
                      ))}
                      <ÜçHucre t={matris.yilToplam.get(y)} vurgu />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/20 bg-muted/40 font-mono font-semibold tabular-nums">
                    <td className="px-3 py-2">Toplam</td>
                    {matris.kategoriler.map((k) => (
                      <ÜçHucre key={k} t={matris.katToplam.get(k)} />
                    ))}
                    <ÜçHucre t={toplam} vurgu />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ————————————————————————————————— gidişat */}
          <div className="grid gap-3 xl:grid-cols-2">
            <PanoKabugu
              baslik="Ortalama Birim Fiyat Gidişatı"
              alt={`${BIRIM_SIMGE[birim]}/kg · alım yapılan aylar`}
            >
              <TimeLineChart
                columns={fiyatSutunlari}
                series={seriler}
                valueLabel={`${BIRIM_SIMGE[birim]}/kg`}
                format={(v) => formatNum(v, 3)}
                valueLabels
                valueFormat={(v) => formatNum(v, 2)}
              />
            </PanoKabugu>
            <PanoKabugu baslik="Aylık Alım Miktarı" alt="kg">
              <TimeLineChart
                columns={miktarSutunlari}
                series={seriler}
                valueLabel="kg"
                format={(v) => formatNum(Math.round(v))}
                valueLabels
                valueFormat={(v) => formatNum(Math.round(v))}
              />
            </PanoKabugu>
          </div>

          {/* ————————————————————————————————— kalem kırılımı */}
          <section className="border bg-card">
            <div className="flex flex-wrap items-baseline gap-x-3 border-b px-3 py-2">
              <p className="oc-kicker text-[10px] text-muted-foreground">Kalemler</p>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatNum(kalemler.length)} farklı tanım · satıra basınca fiyat seyri açılır
              </span>
            </div>
            <div className="oc-scrollx max-h-[28rem] overflow-x-auto overflow-y-auto [--oc-scroll-bg:var(--card)]">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-1.5 font-normal">Tanım</th>
                    <th className="px-3 py-1.5 font-normal">Kategori</th>
                    <th className="px-3 py-1.5 text-right font-normal">Miktar</th>
                    <th className="px-3 py-1.5 text-right font-normal">Tutar</th>
                    <th className="px-3 py-1.5 text-right font-normal">Ortalama</th>
                    <th className="px-3 py-1.5 text-right font-normal">İlk</th>
                    <th className="px-3 py-1.5 text-right font-normal">Son</th>
                    <th className="px-3 py-1.5 text-right font-normal">Değişim</th>
                    <th className="px-3 py-1.5 text-right font-normal">En Ucuz / Pahalı</th>
                    <th className="px-3 py-1.5 text-right font-normal">Firma</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {kalemler.map((k) => (
                    <tr
                      key={k.key}
                      onClick={() => setSeciliKalem(seciliKalem === k.key ? null : k.key)}
                      className={cn(
                        "cursor-pointer border-b border-border/40 hover:bg-muted/30",
                        seciliKalem === k.key && "bg-primary/[0.07]"
                      )}
                    >
                      <td className="px-3 py-1.5 font-sans font-medium">{k.tanim}</td>
                      <td className="px-3 py-1.5 font-sans text-muted-foreground">
                        {kategoriAdi(k.kategori)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{kilo(k.toplam.kg)}</td>
                      <td className="px-3 py-1.5 text-right">{tutar(k.toplam.tutar, birim)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {fiyat(k.toplam.ortalama, birim)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">
                        {fiyat(k.ilkBirim, birim)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{fiyat(k.sonBirim, birim)}</td>
                      <td
                        className={cn(
                          "px-3 py-1.5 text-right font-medium",
                          k.degisimOran == null
                            ? "text-muted-foreground"
                            : k.degisimOran > 0.02
                              ? "text-destructive"
                              : k.degisimOran < -0.02
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-muted-foreground"
                        )}
                        title={
                          k.degisimOran == null
                            ? "Tek alım — değişim ölçülemez"
                            : `${tarihGoster(k.ilkGun)} → ${tarihGoster(k.sonGun)}`
                        }
                      >
                        {k.degisimOran == null
                          ? "—"
                          : `${k.degisimOran > 0 ? "+" : ""}%${formatNum(k.degisimOran * 100, 1)}`}
                      </td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">
                        {fiyat(k.enUcuzBirim, birim)} / {fiyat(k.enPahaliBirim, birim)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{formatNum(k.tedarikciSayisi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {seciliKalem && kalemSatirlari.length > 0 && (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <PanoKabugu
                baslik={`${kalemSatirlari[0].tanim} — Fiyat Seyri`}
                alt={`${BIRIM_SIMGE[birim]}/kg · ${formatNum(kalemSatirlari.length)} alım`}
              >
                <TimeLineChart
                  columns={kalemSutunlari}
                  series={[
                    {
                      key: "fiyat",
                      label: kalemSatirlari[0].tanim,
                      hue: kategoriTonu(kalemSatirlari[0].kategori),
                    },
                  ]}
                  valueLabel={`${BIRIM_SIMGE[birim]}/kg`}
                  format={(v) => formatNum(v, 3)}
                  valueLabels
                  valueFormat={(v) => formatNum(v, 2)}
                />
              </PanoKabugu>
              <section className="border bg-card">
                <div className="border-b px-3 py-2">
                  <p className="oc-kicker text-[10px] text-muted-foreground">Alım Satırları</p>
                </div>
                <div className="oc-scrollx max-h-[18rem] overflow-x-auto overflow-y-auto [--oc-scroll-bg:var(--card)]">
                  <table className="w-full text-[12px]">
                    <thead className="sticky top-0 z-10 bg-card">
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-1.5 font-normal">Tarih</th>
                        <th className="px-3 py-1.5 font-normal">Tedarikçi</th>
                        <th className="px-3 py-1.5 text-right font-normal">Miktar</th>
                        <th className="px-3 py-1.5 text-right font-normal">Birim Fiyat</th>
                        <th className="px-3 py-1.5 text-right font-normal">Tutar</th>
                        <th className="px-3 py-1.5 font-normal">Kaynak</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {[...kalemSatirlari]
                        .sort((a, b) => b.gun.localeCompare(a.gun))
                        .map((s) => {
                          const t = tutarAl(s, birim);
                          return (
                            <tr key={s.id} className="border-b border-border/40">
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                {tarihGoster(s.gun)}
                              </td>
                              <td className="px-3 py-1.5 font-sans">{s.tedarikci}</td>
                              <td className="px-3 py-1.5 text-right">{kilo(s.kg)}</td>
                              <td className="px-3 py-1.5 text-right font-medium">
                                {fiyat(t != null && s.kg > 0 ? t / s.kg : null, birim)}
                              </td>
                              <td className="px-3 py-1.5 text-right">{tutar(t, birim)}</td>
                              <td className="px-3 py-1.5 font-sans text-[11px] text-muted-foreground">
                                {s.kaynak === "devralinan" ? "Devralınan" : `Sipariş ${s.siparisNo ?? ""}`}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ————————————————————————————————— tedarikçi kırılımı */}
          <section className="border bg-card">
            <div className="border-b px-3 py-2">
              <p className="oc-kicker text-[10px] text-muted-foreground">Tedarikçiler</p>
            </div>
            <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-1.5 font-normal">Tedarikçi</th>
                    <th className="px-3 py-1.5 text-right font-normal">Miktar</th>
                    <th className="px-3 py-1.5 text-right font-normal">Pay</th>
                    <th className="px-3 py-1.5 text-right font-normal">Tutar</th>
                    <th className="px-3 py-1.5 text-right font-normal">Ortalama</th>
                    <th className="px-3 py-1.5 text-right font-normal">Kalem</th>
                    <th className="px-3 py-1.5 font-normal">Aralık</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {firmaOzetleri.map((f) => (
                    <tr key={f.tedarikci} className="border-b border-border/40">
                      <td className="px-3 py-1.5 font-sans font-medium">{f.tedarikci}</td>
                      <td className="px-3 py-1.5 text-right">{kilo(f.toplam.kg)}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">
                        {toplam.kg > 0 ? `%${formatNum((f.toplam.kg / toplam.kg) * 100, 1)}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right">{tutar(f.toplam.tutar, birim)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {fiyat(f.toplam.ortalama, birim)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{formatNum(f.kalemSayisi)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                        {tarihGoster(f.ilkGun)} → {tarihGoster(f.sonGun)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-[11px] text-muted-foreground">
            Devralınan satırlar 2024–2026 çalışma dosyasından gelir; sipariş satırları uygulamanın
            kendi kaydıdır ve yalnız KİLO birimli olanlar analize girer. Tutarlar KDV hariçtir.
          </p>
        </>
      )}
    </div>
  );
}

/** `2025-03` → `Mar 25` — on iki ay yan yana okunabilsin. */
const AY_ADLARI = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function ayEtiketi(ay: string): string {
  const [y, a] = ay.split("-");
  return `${AY_ADLARI[Number(a) - 1] ?? a} ${y.slice(2)}`;
}

function ÜçBaslik({ birim }: { birim: AlimBirimi }) {
  return (
    <>
      <th className="border-l px-3 py-1 text-right font-normal">kg</th>
      <th className="px-3 py-1 text-right font-normal">{BIRIM_SIMGE[birim]}/kg</th>
      <th className="px-3 py-1 text-right font-normal">Toplam {BIRIM_SIMGE[birim]}</th>
    </>
  );
}

/**
 * Üçlü hücre — kg · birim fiyat · toplam.
 *
 * PARA SİMGESİ HÜCREDE YAZMAZ, sütun başlığında yazar: on beş hücrenin her
 * birine "€" koymak matrisi okunmaz eder ve bilgi eklemez.
 */
function ÜçHucre({
  t,
  vurgu,
}: {
  t?: { kg: number; tutar: number; ortalama: number | null };
  vurgu?: boolean;
}) {
  if (!t || t.kg === 0) {
    return (
      <>
        <td className="border-l px-3 py-1.5 text-right text-muted-foreground">—</td>
        <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
        <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
      </>
    );
  }
  return (
    <>
      <td className={cn("border-l px-3 py-1.5 text-right", vurgu && "font-medium")}>
        {formatNum(Math.round(t.kg))}
      </td>
      <td className={cn("px-3 py-1.5 text-right", vurgu && "font-medium")}>
        {t.ortalama == null ? "—" : formatNum(t.ortalama, 3)}
      </td>
      <td className={cn("px-3 py-1.5 text-right", vurgu ? "font-semibold" : "font-medium")}>
        {formatNum(Math.round(t.tutar))}
      </td>
    </>
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

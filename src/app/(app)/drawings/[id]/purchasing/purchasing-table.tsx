"use client";

// Satın Alma tablosu — arama, kategori süzgeci ve "satın alındı" işareti.
//
// ASIL KULLANICI SATINALMACIDIR ve sorusu tek: "neyi sipariş etmem gerekiyor,
// neyi ettim?" Ekran bu yüzden Üretim tahtasından iki noktada ayrılır:
//
// · TEK AŞAMA VAR. Yedi çipli bir satır burada gürültüdür; satın almanın
//   defterdeki tek aşaması "satın alındı"dır ve o da bir onay kutusu gibi
//   davranır. Aşama listesi yine de DİZİdir (`purchaseStages`) — yarın
//   "sipariş verildi" eklenirse döngü değişmeden büyür.
// · KATEGORİ BİRİNCİL SÜTUNDUR. Sipariş tedarikçi başına verilir; aynı ailenin
//   kalemleri yan yana durmazsa liste kullanılamaz. Varsayılan sıra bu yüzden
//   kategoridir, kod ya da defter sırası değil.
//
// SÜZGEÇ TANIMI BURADA DEĞİL `../../filters.ts`TE — parça defterindeki kuralın
// aynısı; iki yerde yazılan bir süzgeç zamanla ayrışır.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, FileSpreadsheet, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tagStyle } from "@/lib/tags";
import { formatNum } from "@/lib/drawings/labels";
import { SATIN_ALMA_SINIFLARI, type SatinAlmaSonucu } from "@/lib/drawings/derive";
import type { ProgressMark, StageDef } from "@/lib/drawings/progress";
import {
  ALL,
  EMPTY_PURCHASE_FILTERS,
  matchesPurchase,
  purchaseOptions,
  sortPurchases,
  type PurchaseFilters,
  type PurchaseSortKey,
} from "../../filters";
import { FilterBar, SearchBox, SortableHead } from "../../sortable-head";
import { markStage, setPartStage } from "../progress/actions";

/** Süzgece giren satır — defter satırı + ilerleme kaydının birleşimi. */
interface Satir {
  key: string;
  tanim: string;
  sinif: string;
  malzeme: string;
  malzemeler: string[];
  parcaKodu: string;
  adet: number | null;
  toplamAgirlikKg: number | null;
  sourceRows: number;
  kaynak: string;
  alindi: boolean;
  tarih: string;
  not: string;
}

export function PurchasingTable({
  packageId,
  liste,
  stages,
  marks,
  canWrite,
  ledgerMissing,
}: {
  packageId: string;
  liste: SatinAlmaSonucu;
  /** Satın alma aşamaları — bugün tek eleman; defterde yoksa boş. */
  stages: StageDef[];
  marks: ProgressMark[];
  canWrite: boolean;
  ledgerMissing: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();

  const asama = stages[0] ?? null;

  // İYİMSER DURUM: sunucu yanıtı beklenmeden satır boyanır. Sunucudan gelen
  // yeni imza durumu yeniden kurar — imza karşılaştırması olmadan her yeniden
  // çizim uçuştaki değişikliği geri alırdı (Üretim tahtasındaki kalıbın aynısı).
  const sunucuImza = useMemo(
    () => marks.map((m) => `${m.key}|${m.qtyDone}`).sort().join(";"),
    [marks]
  );
  const [alinanlar, setAlinanlar] = useState<Set<string>>(
    () => new Set(marks.map((m) => m.key))
  );
  const [sonImza, setSonImza] = useState(sunucuImza);
  if (sonImza !== sunucuImza) {
    setSonImza(sunucuImza);
    setAlinanlar(new Set(marks.map((m) => m.key)));
  }

  const ayrintilar = useMemo(() => {
    const h = new Map<string, { doneAt: string; note: string }>();
    for (const m of marks) h.set(m.key, { doneAt: m.doneAt ?? "", note: m.note ?? "" });
    return h;
  }, [marks]);

  const satirlar: Satir[] = useMemo(
    () =>
      liste.satirlar.map((s) => {
        const ek = ayrintilar.get(s.key);
        return {
          key: s.key,
          tanim: s.tanim,
          sinif: s.sinif,
          malzeme: s.malzeme,
          malzemeler: s.malzemeler,
          parcaKodu: s.parcaKodu,
          adet: s.adet,
          toplamAgirlikKg: s.toplamAgirlikKg,
          sourceRows: s.sourceRows,
          kaynak: s.kaynak,
          alindi: alinanlar.has(s.key),
          tarih: ek?.doneAt ?? "",
          not: ek?.note ?? "",
        };
      }),
    [liste.satirlar, alinanlar, ayrintilar]
  );

  const [f, setF] = useState<PurchaseFilters>(EMPTY_PURCHASE_FILTERS);
  const [sortKey, setSortKey] = useState<PurchaseSortKey>("kategori");
  const [desc, setDesc] = useState(false);
  const [secili, setSecili] = useState<Set<string>>(new Set());

  const secenekler = useMemo(
    () => purchaseOptions(satirlar, SATIN_ALMA_SINIFLARI),
    [satirlar]
  );

  const gorunen = useMemo(
    () => sortPurchases(satirlar.filter((s) => matchesPurchase(s, f)), sortKey, desc, SATIN_ALMA_SINIFLARI),
    [satirlar, f, sortKey, desc]
  );

  function sirala(key: PurchaseSortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(false);
    }
  }

  const temiz = JSON.stringify(f) === JSON.stringify(EMPTY_PURCHASE_FILTERS);
  const alinan = satirlar.filter((s) => s.alindi).length;
  const gorunenAgirlik = gorunen.reduce((t, s) => t + (s.toplamAgirlikKg ?? 0), 0);

  // ————————————————————————————————————————————————————————— yazma
  function yaz(anahtarlar: string[], mode: "isaretle" | "kaldir") {
    if (!canWrite || !asama || anahtarlar.length === 0) return;

    setAlinanlar((o) => {
      const y = new Set(o);
      for (const k of anahtarlar) {
        if (mode === "kaldir") y.delete(k);
        else y.add(k);
      }
      return y;
    });

    basla(async () => {
      const sonuc = await markStage({
        packageId,
        stage: asama.slug,
        keys: anahtarlar,
        mode,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        setAlinanlar(new Set(marks.map((m) => m.key)));
        return;
      }
      if (mode === "kaldir") toast.success(`${anahtarlar.length} kalemin işareti kaldırıldı.`);
      else if ((sonuc.ok ?? 0) === 0) toast.info("Hepsi zaten işaretliydi.");
      else toast.success(`${sonuc.ok} kalem “${asama.name}” işaretlendi.`);
      router.refresh();
    });
  }

  const [pencere, setPencere] = useState<Satir | null>(null);
  const seciliListe = [...secili];

  return (
    <div className="grid gap-3">
      {ledgerMissing && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          Aşama defteri henüz kurulmamış — ekran yedek sözlükle çalışıyor.
          İşaretler kaydedilir; migration uygulandığında defterdeki ad ve renk
          devreye girer.
        </p>
      )}

      <SummaryStrip liste={liste} alinan={alinan} />

      <FilterBar
        gorunen={gorunen.length}
        toplam={satirlar.length}
        temiz={temiz}
        onTemizle={() => setF(EMPTY_PURCHASE_FILTERS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Tanım, kod, malzeme ara…"
          className="w-[min(20rem,calc(100vw-4rem))]"
        />
        <Suzgec
          value={f.sinif}
          onChange={(v) => setF((s) => ({ ...s, sinif: v }))}
          bos="Kategori"
          secenekler={secenekler.siniflar.map((s) => ({ value: s, label: s }))}
        />
        <Suzgec
          value={f.malzeme}
          onChange={(v) => setF((s) => ({ ...s, malzeme: v }))}
          bos="Malzeme"
          secenekler={secenekler.materials.map((m) => ({ value: m, label: m }))}
        />
        <Suzgec
          value={f.durum}
          onChange={(v) => setF((s) => ({ ...s, durum: v }))}
          bos="Durum"
          secenekler={[
            { value: "bekliyor", label: "Bekliyor" },
            { value: "alindi", label: "Satın alındı" },
          ]}
        />

        <span className="hidden h-5 w-px bg-border sm:block" />

        {/* SÜZGEÇ BU BAĞLANTIYA GEÇMEZ ve bu açıkça yazılır: uç bütün paketi
            basar (satın alma + sac ihtiyacı + testere kesim). Süzgeci sessizce
            yok saymak, indirilen dosyayı ekrandakiyle aynı sanmaya yol açardı. */}
        <Button asChild variant="outline" size="xs">
          <a
            href={`/drawings/${packageId}/export/purchasing`}
            title="Paketin tam satın alma kitabı — ekrandaki süzgeç uygulanmaz."
          >
            <FileSpreadsheet className="size-3" />
            Excel (tüm liste)
          </a>
        </Button>
      </FilterBar>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Bu süzgeçle eşleşen kalem yok. Süzgeci temizleyip yeniden deneyin.
          </p>
        </div>
      ) : (
        <div className="border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {canWrite && asama && (
                  <TableHead className="w-10 p-0">
                    <SecimKutusu
                      checked={gorunen.every((s) => secili.has(s.key))}
                      onChange={(v) =>
                        setSecili((o) => {
                          const y = new Set(o);
                          for (const s of gorunen) {
                            if (v) y.add(s.key);
                            else y.delete(s.key);
                          }
                          return y;
                        })
                      }
                      label="Görünen kalemlerin tamamını seç"
                    />
                  </TableHead>
                )}
                <SortableHead sortKey="kategori" current={sortKey} desc={desc} onSort={sirala}>
                  Kategori
                </SortableHead>
                <SortableHead sortKey="tanim" current={sortKey} desc={desc} onSort={sirala}>
                  Tanım
                </SortableHead>
                <SortableHead
                  sortKey="adet"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                >
                  Adet
                </SortableHead>
                <SortableHead
                  sortKey="kod"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  className="hidden lg:table-cell"
                >
                  Parça Kodu
                </SortableHead>
                <TableHead className="hidden md:table-cell">Malzeme</TableHead>
                <SortableHead
                  sortKey="agirlik"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                  className="hidden xl:table-cell"
                >
                  Toplam kg
                </SortableHead>
                <SortableHead sortKey="durum" current={sortKey} desc={desc} onSort={sirala}>
                  Durum
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((s) => (
                <TableRow key={s.key} className={secili.has(s.key) ? "bg-primary/[0.05]" : undefined}>
                  {canWrite && asama && (
                    <TableCell className="p-0 align-top">
                      <SecimKutusu
                        checked={secili.has(s.key)}
                        onChange={() =>
                          setSecili((o) => {
                            const y = new Set(o);
                            if (y.has(s.key)) y.delete(s.key);
                            else y.add(s.key);
                            return y;
                          })
                        }
                        label={`${s.tanim} kalemini seç`}
                      />
                    </TableCell>
                  )}

                  <TableCell className="align-top text-[12px] whitespace-normal">
                    {s.sinif}
                  </TableCell>

                  {/* TANIM SARAR, kırpılmaz: "YILMAZ REDUKTOR DR373-3E90L-4D -
                      i57.79 - MOTOR 1,5kW 1500d-d" satırın kimliğidir ve üç
                      nokta ile bitince sipariş edilemez. */}
                  <TableCell className="min-w-0 align-top whitespace-normal">
                    <span className="block text-[13px]">{s.tanim || "—"}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground md:hidden">
                      {[s.malzeme, s.parcaKodu].filter(Boolean).join(" · ") || "—"}
                    </span>
                    {s.sourceRows > 1 && (
                      <span
                        className="mt-0.5 block font-mono text-[11px] text-muted-foreground"
                        title={s.kaynak}
                      >
                        {formatNum(s.sourceRows)} defter satırından birleşti
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="align-top text-right font-mono text-sm">
                    {s.adet ?? "—"}
                  </TableCell>

                  <TableCell className="hidden align-top font-mono text-[12px] whitespace-normal lg:table-cell">
                    {s.parcaKodu || <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  <TableCell className="hidden align-top font-mono text-[12px] whitespace-normal md:table-cell">
                    {/* ÇELİŞKİ GİZLENMEZ: aynı kalem iki malzemeyle geçtiyse
                        ikisi de yazılır — Excel'deki kuralın aynısı. */}
                    {s.malzemeler.length > 1 ? (
                      <span className="font-semibold text-destructive" title="Kaynak satırlar farklı malzeme söylüyor">
                        {s.malzemeler.join(" / ")}
                      </span>
                    ) : (
                      s.malzeme || <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="hidden align-top text-right font-mono text-[12px] xl:table-cell">
                    {s.toplamAgirlikKg == null ? "—" : formatNum(s.toplamAgirlikKg, 3)}
                  </TableCell>

                  <TableCell className="align-top">
                    {asama ? (
                      <span className="inline-flex">
                        <button
                          type="button"
                          disabled={!canWrite || calisiyor}
                          onClick={() => yaz([s.key], s.alindi ? "kaldir" : "isaretle")}
                          aria-pressed={s.alindi}
                          title={
                            s.alindi
                              ? `${asama.name}${[s.tarih, s.not].filter(Boolean).length ? ` — ${[s.tarih, s.not].filter(Boolean).join(" · ")}` : ""} — dokunmak işareti kaldırır`
                              : `${asama.name} olarak işaretle`
                          }
                          style={s.alindi ? tagStyle(asama.colorHue) : undefined}
                          className={
                            "inline-flex min-h-8 items-center gap-1 px-1.5 text-[11px] whitespace-nowrap transition-colors pointer-coarse:min-h-10 pointer-coarse:px-2 disabled:cursor-default " +
                            (s.alindi
                              ? "oc-tag"
                              : "border border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground")
                          }
                        >
                          {s.alindi ? (
                            <Check className="size-3" aria-hidden />
                          ) : (
                            <span
                              className="oc-tag-dot opacity-40"
                              style={tagStyle(asama.colorHue)}
                              aria-hidden
                            />
                          )}
                          {s.alindi ? asama.name : "Bekliyor"}
                        </button>
                        {canWrite && s.alindi && (
                          <button
                            type="button"
                            onClick={() => setPencere(s)}
                            aria-label="Sipariş ayrıntısı"
                            title={
                              [s.tarih, s.not].filter(Boolean).join(" · ") ||
                              "Adet, tarih ve not"
                            }
                            className={
                              "inline-flex min-h-8 items-center border border-l-0 px-1 text-[11px] transition-colors pointer-coarse:min-h-10 hover:text-foreground " +
                              (s.tarih || s.not ? "text-foreground" : "text-muted-foreground")
                            }
                          >
                            {s.tarih || s.not ? "•" : "…"}
                          </button>
                        )}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-muted-foreground">—</span>
                    )}
                    {s.tarih && (
                      <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                        {s.tarih}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="font-mono text-[11px] text-muted-foreground">
        {formatNum(gorunen.length)} Kalem Görünüyor ·{" "}
        {formatNum(gorunen.filter((s) => s.alindi).length)} Alındı
        {gorunenAgirlik > 0 && ` · ${formatNum(gorunenAgirlik, 1)} kg`}
      </p>

      {/* Yapışkan toplu şerit — 72 kalemlik bir listede seçim yapıp düğmeye
          ulaşmak için sayfanın dibine inmek gerekmemeli. */}
      {canWrite && asama && secili.size > 0 && (
        <div className="sticky bottom-2 z-20 flex flex-wrap items-center gap-2 border bg-card p-2 shadow-lg">
          <span className="font-mono text-[12px] font-medium">
            {formatNum(secili.size)} Kalem Seçili
          </span>
          <Button type="button" size="xs" variant="ghost" onClick={() => setSecili(new Set())}>
            Seçimi bırak
          </Button>
          {calisiyor && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={calisiyor}
              onClick={() => yaz(seciliListe, "isaretle")}
              style={tagStyle(asama.colorHue)}
              className="oc-tag min-h-9 px-2 py-1 text-[12px] transition-opacity pointer-coarse:min-h-11 disabled:opacity-50"
            >
              {asama.name} İşaretle
            </button>
            <button
              type="button"
              disabled={calisiyor}
              onClick={() => yaz(seciliListe, "kaldir")}
              className="inline-flex min-h-9 items-center border border-dashed px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors pointer-coarse:min-h-11 hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
            >
              −{asama.name}
            </button>
          </span>
        </div>
      )}

      {pencere && asama && (
        <DetailDialog
          key={pencere.key}
          packageId={packageId}
          satir={pencere}
          stage={asama}
          onClose={() => setPencere(null)}
          onSaved={() => {
            setPencere(null);
            router.refresh();
          }}
          onCleared={() => {
            yaz([pencere.key], "kaldir");
            setPencere(null);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ özet

function SummaryStrip({ liste, alinan }: { liste: SatinAlmaSonucu; alinan: number }) {
  const toplam = liste.satirlar.length;
  const oran = toplam > 0 ? Math.round((alinan / toplam) * 100) : 0;
  return (
    <section className="border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Sipariş Durumu</h2>
        <p className="font-mono text-[11px] text-muted-foreground">
          {formatNum(alinan)}/{formatNum(toplam)} Kalem Alındı · %{oran}
        </p>
      </div>

      <span className="mt-2 block h-1.5 w-full bg-muted" aria-hidden>
        <span className="block h-full bg-primary" style={{ width: `${oran}%` }} />
      </span>

      <ul className="oc-scrollx mt-2 flex flex-wrap items-center gap-1.5 [--oc-scroll-bg:var(--card)]">
        {liste.siniflar.map((s) => (
          <li
            key={s.sinif}
            className="inline-flex items-center gap-1 border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
            title={`${s.sinif}: ${formatNum(s.satirSayisi)} kalem · ${formatNum(s.adet)} adet`}
          >
            {s.sinif}
            <span className="font-semibold text-foreground">{formatNum(s.satirSayisi)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[12px] text-muted-foreground">
        {formatNum(liste.kaynakSatiri)} defter satırı {formatNum(toplam)} kaleme indi
        {liste.birlesenKalem > 0 && ` (${formatNum(liste.birlesenKalem)} kalem birleşti)`} ·{" "}
        {formatNum(liste.toplamAdet)} adet
        {liste.toplamAgirlikKg != null && ` · ${formatNum(liste.toplamAgirlikKg, 1)} kg`}.
        {liste.malzemeCeliskisi > 0 &&
          ` ${formatNum(liste.malzemeCeliskisi)} kalemde kaynak satırlar farklı malzeme söylüyor.`}
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ pencere

function DetailDialog({
  packageId,
  satir,
  stage,
  onClose,
  onSaved,
  onCleared,
}: {
  packageId: string;
  satir: Satir;
  stage: StageDef;
  onClose: () => void;
  onSaved: () => void;
  onCleared: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  // TABAN 1'DİR: sıfır "alındı ama hiç alınmadı" gibi belirsiz bir hâl
  // üretirdi. 1'in altına inmek işareti KALDIRIR (Üretim tahtasıyla aynı kural).
  const [adet, setAdet] = useState(String(satir.adet ?? 1));
  const [gun, setGun] = useState(satir.tarih);
  const [not, setNot] = useState(satir.not);

  const sayi = Number(adet.replace(/[^\d]/g, "")) || 0;

  function kaydet() {
    if (sayi < 1) {
      onCleared();
      return;
    }
    basla(async () => {
      const sonuc = await setPartStage({
        packageId,
        stage: stage.slug,
        key: satir.key,
        qtyDone: sayi,
        doneAt: gun,
        note: not,
      });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Kaydedildi.");
        onSaved();
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(28rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">{stage.name}</DialogTitle>
          <DialogDescription className="text-[12px]">{satir.tanim}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <span className="oc-kicker block text-muted-foreground">
              Alınan adet {satir.adet != null && `(gereken ${formatNum(satir.adet)})`}
            </span>
            <Input
              value={adet}
              onChange={(e) => setAdet(e.target.value)}
              inputMode="numeric"
              className="mt-1 h-10 w-full text-center font-mono text-base tabular-nums"
              aria-label="Alınan adet"
            />
            {sayi < 1 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sıfıra inmek işareti kaldırır.
              </p>
            )}
          </div>

          <div>
            <span className="oc-kicker block text-muted-foreground">
              Sipariş / teslim tarihi (isteğe bağlı)
            </span>
            <Input
              type="date"
              value={gun}
              onChange={(e) => setGun(e.target.value)}
              className="mt-1 h-10 w-full font-mono text-base pointer-fine:text-sm"
            />
          </div>

          <div>
            <span className="oc-kicker block text-muted-foreground">Not (isteğe bağlı)</span>
            <Input
              value={not}
              onChange={(e) => setNot(e.target.value)}
              maxLength={500}
              placeholder="Örn. tedarikçi, sipariş no"
              className="mt-1 h-10 w-full text-base pointer-fine:text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={calisiyor}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            {sayi < 1 ? "İşareti kaldır" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ ufaklar

/** Süzgeç açılırı — "Tümü" seçeneği ALL sabitiyle taşınır (boş string yasak). */
function Suzgec({
  value,
  onChange,
  bos,
  secenekler,
}: {
  value: string;
  onChange: (v: string) => void;
  bos: string;
  secenekler: { value: string; label: string }[];
}) {
  if (secenekler.length === 0) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-auto min-w-[7.5rem] text-base pointer-fine:text-sm">
        <SelectValue placeholder={bos} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{bos}: tümü</SelectItem>
        {secenekler.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Seçim kutusu — `components/ui`da Checkbox yok (paylaşılan dizin, bu faz onu
 * eklemez). Ham `<input type="checkbox">` 13px'lik bir hedeftir; 44px'lik bir
 * `label` içine sarmak dokunma hedefi kuralını karşılamanın en ucuz yoludur.
 */
function SecimKutusu({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      className="flex min-h-10 w-10 shrink-0 cursor-pointer items-center justify-center pointer-coarse:min-h-11 pointer-coarse:w-11"
      title={label}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--primary)]"
        aria-label={label}
      />
    </label>
  );
}

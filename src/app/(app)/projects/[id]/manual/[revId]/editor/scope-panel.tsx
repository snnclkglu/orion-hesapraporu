"use client";

// KAPSAM — bu belge hangi müşteriye, hangi genişlikte gidiyor.
//
// Kullanıcı isteği (30.08.2026): *"bir müşteriye projeleri vermeyebilirim
// diğerine verebilirim; birine ekipman listesini detaylı kataloglu veririm
// diğerine standart; birine hesap raporunu detaylı veririm diğerine özet."*
//
// PAKET BİR İŞLEMDİR, BİR DURUM DEĞİL (KITAP-20): düğmeye basmak ağaca yazar.
// Bu yüzden ekran "hangi paket seçili" demez, "en son hangi paket UYGULANDI"
// der ve o zamandan beri elle verilen kararları AYRICA listeler.

import { useMemo } from "react";
import { Check, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MANUAL_PACKAGE_BOOK,
  manualPackageDef,
  manualScopeDrift,
  packageWantsHidden,
} from "@/lib/manual/packages";
import { usedAppendices } from "@/lib/manual/payload";
import { flattenManual, numberManual, printedManual } from "@/lib/manual/payload";
import type { ManualSection } from "@/lib/manual/types";
import {
  MANUAL_APPENDIX_LABELS,
  MANUAL_PACKAGE_LABELS,
  type ManualAppendixKind,
  type ManualPackageKey,
  type ManualPayload,
} from "@/lib/manual/types";
import { cn } from "@/lib/utils";

/** Hesap raporu eki için seçenekler — rapor seviyeleriyle AYNI dilbilgisi. */
const RAPOR_SEVIYELERI: { value: string; label: string }[] = [
  { value: "ozet", label: "Özet" },
  { value: "standart", label: "Standart" },
  { value: "detayli", label: "Detaylı" },
];

/** Mekanik proje eki — bütün imalat paftaları mı, yalnız genel montaj mı. */
const PROJE_KAPSAMI: { value: string; label: string }[] = [
  { value: "genelMontaj", label: "Yalnız genel montaj resimleri" },
  { value: "tumu", label: "Paketteki bütün paftalar" },
];

const FOY_SAYILARI: { value: string; label: string }[] = [
  { value: "1", label: "Ürün başına 1 föy" },
  { value: "2", label: "Ürün başına 2 föy" },
  { value: "4", label: "Ürün başına 4 föy" },
];

export function ScopePanel({
  payload,
  yazilabilir,
  onPaket,
  onEkSecenegi,
  onBolumGizle,
}: {
  payload: ManualPayload;
  yazilabilir: boolean;
  onPaket: (key: ManualPackageKey, bastan: boolean) => void;
  onEkSecenegi: (kind: ManualAppendixKind, option: string) => void;
  /**
   * Bölüm görünürlüğünü çevirir. TEK GİRİŞ NOKTASI `manualToggleSection`tır
   * (`use-manual-doc.ts` → `doc.bolumGizle`): sapmayı (`scope.keptSections`)
   * o fonksiyon yazar; ağacı çeviren ikinci bir yol, sapmanın bir yerde
   * kaydedilip bir yerde kaydedilmemesi demekti.
   */
  onBolumGizle: (sectionId: string) => void;
}) {
  const uygulanan = payload.scope.packageKey;
  const sapma = useMemo(() => manualScopeDrift(payload), [payload]);
  const basilanEkler = useMemo(
    () => usedAppendices(printedManual(payload).sections),
    [payload]
  );
  const secenek = (kind: ManualAppendixKind) =>
    payload.scope.appendixOptions.find((o) => o.kind === kind);

  /*
   * BÖLÜM LİSTESİ — "paketi seçtikten sonra elle aç/kapa" (kullanıcı isteği,
   * 01.09.2026). Çekirdek bunu zaten destekliyordu (`manualToggleSection`
   * sapmayı kendi yazar); eksik olan tek şey ARAYÜZDÜ: kullanıcı bir bölümü
   * kapatmak için Harita sekmesine gidip ağaçta aramak zorundaydı.
   *
   * İKİ DÜZEY basılır. Üçüncü düzeyde 85 satırlık bir liste çıkar ve kapsam
   * kararı bölüm bölüm değil BAŞLIK başlık verilir; ince ayar zaten
   * Harita'dadır.
   */
  const bolumler = useMemo(() => {
    const numarali = numberManual(payload.sections);
    const ekKapsayici = numarali.find((b) => b.children.some((c) => c.appendix)) ?? null;
    const govde = numarali.filter((b) => b !== ekKapsayici);
    const satirlar: { id: string; number: string; title: string; hidden: boolean; depth: number }[] =
      [];
    const gez = (liste: typeof govde, depth: number) => {
      for (const bolum of liste) {
        satirlar.push({
          id: bolum.id,
          number: bolum.number,
          title: bolum.title,
          hidden: Boolean(bolum.hidden),
          depth,
        });
        if (depth < 2) gez(bolum.children, depth + 1);
      }
    };
    gez(govde, 1);
    // EK BÖLÜMLERİ AYRI LİSTEDE: kimlikleri ek türüne göre bulunur.
    const ekBolumleri = new Map<ManualAppendixKind, ManualSection>();
    for (const bolum of flattenManual(numarali)) {
      if (bolum.appendix) ekBolumleri.set(bolum.appendix, bolum);
    }
    return { satirlar, ekBolumleri };
  }, [payload.sections]);

  /** Paketin bu bölüm hakkındaki sözü — "paket ne diyordu" rozeti için. */
  const duzBolumler = useMemo(
    () => flattenManual(numberManual(payload.sections)),
    [payload.sections]
  );
  const paketSozu = (sectionId: string): boolean | null => {
    if (!uygulanan) return null;
    const bolum = duzBolumler.find((b) => b.id === sectionId);
    return bolum ? packageWantsHidden(manualPackageDef(uygulanan), bolum) : null;
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* —————————————————————————————————————————————— paketler */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Teslim paketi</p>
          {uygulanan ? (
            <Badge variant="secondary">{MANUAL_PACKAGE_LABELS[uygulanan]}</Badge>
          ) : (
            <Badge variant="outline">Serbest kapsam</Badge>
          )}
        </div>

        {!uygulanan ? (
          <p className="text-xs text-muted-foreground">
            Bu belgeye hiç paket uygulanmadı. Bir paket uygulamak bölümleri ve ekleri
            topluca ayarlar; blok SİLMEZ, yalnız gizler — her zaman geri alınabilir.
          </p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {MANUAL_PACKAGE_BOOK.map((p) => (
            <li
              key={p.key}
              className={cn(
                "border p-2",
                uygulanan === p.key && "border-primary bg-muted/50"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {uygulanan === p.key ? (
                  <Check className="size-4 shrink-0 text-primary" />
                ) : null}
                <span className="min-w-0 font-medium">{p.title}</span>
                <span className="ml-auto flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant={uygulanan === p.key ? "outline" : "default"}
                    className="oc-tap"
                    disabled={!yazilabilir}
                    onClick={() => onPaket(p.key, false)}
                  >
                    {uygulanan === p.key ? "Yeniden uygula" : "Uygula"}
                  </Button>
                  {uygulanan === p.key && sapma.sections.length > 0 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="oc-tap"
                      disabled={!yazilabilir}
                      title="Elle verdiğiniz kararları yok sayar"
                      onClick={() => onPaket(p.key, true)}
                    >
                      <RotateCcw className="size-3.5" /> Baştan
                    </Button>
                  ) : null}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.summary}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* ——————————————————————————————————————————— sapma listesi */}
      {sapma.sections.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Sizin kararınız ({sapma.sections.length})
          </p>
          <p className="text-xs text-muted-foreground">
            Bu bölümlere paket uygulandıktan SONRA elle dokundunuz; paketi yeniden
            uygulamak onları EZMEZ.
          </p>
          <ul className="flex flex-col gap-1">
            {sapma.sections.map((s) => (
              <li key={s.key} className="flex items-center gap-2 border px-2 py-1 text-xs">
                <Badge variant={s.belge ? "default" : "outline"} className="h-5 text-[11px]">
                  {s.belge ? "Belgede" : "Gizli"}
                </Badge>
                <span className="truncate">{s.title}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  paket: {s.paket ? "belgede" : "gizli"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ——————————————————————————————————————————— bölüm listesi */}
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Bölümler ({bolumler.satirlar.length})
        </p>
        <p className="text-xs text-muted-foreground">
          Paketi uyguladıktan sonra buradan tek tek açıp kapatabilirsiniz. Gizlemek
          SİLMEK DEĞİLDİR: bölüm ağaçta kalır, yalnız belgeye basılmaz — ve paketi
          yeniden uygulamak elle verdiğiniz kararı EZMEZ.
        </p>
        <ul className="flex flex-col">
          {bolumler.satirlar.map((bolum) => {
            const soz = paketSozu(bolum.id);
            const sapmaVar = soz !== null && soz !== bolum.hidden;
            return (
              <li
                key={bolum.id}
                className={cn(
                  "flex items-center gap-2 border-b py-1 text-xs last:border-b-0",
                  bolum.hidden && "opacity-55"
                )}
                style={{ paddingLeft: (bolum.depth - 1) * 14 }}
              >
                <span className="w-10 shrink-0 font-mono text-primary">{bolum.number}</span>
                <span className={cn("min-w-0 truncate", bolum.depth === 1 && "font-medium")}>
                  {bolum.title}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  {sapmaVar ? (
                    <Badge variant="secondary" className="h-5 text-[10px]">
                      Sizin kararınız
                    </Badge>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="oc-tap size-8 p-0"
                    disabled={!yazilabilir}
                    aria-label={bolum.hidden ? "Belgeye geri al" : "Belgeden gizle"}
                    title={
                      soz === null
                        ? bolum.hidden
                          ? "Belgeye geri al"
                          : "Belgeden gizle"
                        : `Paket: ${soz ? "gizli" : "belgede"}`
                    }
                    onClick={() => onBolumGizle(bolum.id)}
                  >
                    {bolum.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ————————————————————————————————————————————— ek ayarları */}
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Ekler</p>
        <p className="text-xs text-muted-foreground">
          Bir ekin belgeye girip girmemesi o EK BÖLÜMÜNÜN görünürlüğüdür; göz düğmesi
          onu çevirir. Alttaki ayar, ek GİRECEKSE hangi biçimde gireceğidir.
        </p>

        <ul className="flex flex-col gap-2">
          {(Object.keys(MANUAL_APPENDIX_LABELS) as ManualAppendixKind[]).map((kind) => {
            const basiliyor = basilanEkler.includes(kind);
            const ekBolumu = bolumler.ekBolumleri.get(kind) ?? null;
            const o = secenek(kind);
            const seceneklisi =
              kind === "mekanikHesap"
                ? RAPOR_SEVIYELERI
                : kind === "elektrikKatalog"
                  ? FOY_SAYILARI
                  : kind === "mekanikProje"
                    ? PROJE_KAPSAMI
                    : null;
            return (
              <li key={kind} className={cn("border p-2", !basiliyor && "opacity-55")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={basiliyor ? "default" : "outline"}
                    className="h-5 shrink-0 text-[11px]"
                  >
                    {basiliyor ? "Belgede" : "Gizli"}
                  </Badge>
                  <span className="min-w-0 text-sm">{MANUAL_APPENDIX_LABELS[kind]}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    {o?.edited ? (
                      <Badge variant="secondary" className="h-5 text-[11px]">
                        Elle
                      </Badge>
                    ) : null}
                    {/* EK DE GİZLENEBİLİR (kullanıcı isteği, 01.09.2026:
                        *"tam teknikten projeleri çıkarabileyim"*). Çekirdek
                        buna hazırdı — `manualAppendixOrder` zaten
                        `printedManual`ı okur, yani ek bölümünü gizlemek eki
                        PDF'ten de düşürür (KITAP-6 · KITAP-8). Tıkanan tek
                        yer arayüzdeki `!appendix` kapısıydı. */}
                    {ekBolumu ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="oc-tap size-8 p-0"
                        disabled={!yazilabilir}
                        aria-label={basiliyor ? "Belgeden çıkar" : "Belgeye geri al"}
                        title={basiliyor ? "Belgeden çıkar" : "Belgeye geri al"}
                        onClick={() => onBolumGizle(ekBolumu.id)}
                      >
                        {basiliyor ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </Button>
                    ) : null}
                  </span>
                </div>
                {seceneklisi ? (
                  <div className="mt-2 flex flex-col gap-1">
                    <Label className="text-xs">
                      {kind === "mekanikHesap"
                        ? "Rapor seviyesi"
                        : kind === "mekanikProje"
                          ? "Pafta kapsamı"
                          : "Teknik föy sayısı"}
                    </Label>
                    <Select
                      value={
                        o?.option ??
                        (kind === "mekanikHesap"
                          ? "detayli"
                          : kind === "mekanikProje"
                            ? "genelMontaj"
                            : "2")
                      }
                      disabled={!yazilabilir}
                      onValueChange={(v) => onEkSecenegi(kind, v)}
                    >
                      <SelectTrigger className="oc-tap">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seceneklisi.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

"use client";

// TEKLİFİ DÜZENLE — bir partinin başlığı ve satırları birlikte.
//
// Kullanıcı isteği (15.08.2026): *"Teklifi değiştir iptal et düzenle vb
// özellikler de olsun."*
//
// ══════════════════════════════════════════ NEDEN AYRI BİR PENCERE
//
// `QuoteDialog` TEK BİR KALEMİN bütün tekliflerini gösterir ("bu sacı kim kaça
// veriyor"); burada soru terstir: BİR TEKLİFİN bütün kalemleri ("EAG DEMİR'in
// verdiği liste"). Aynı pencereyi iki soruya birden koşmak, sütun düzeni
// birinde doğru öbüründe yanlış olan bir tablo doğururdu.
//
// SATIR SİLİNEBİLİR ama EKLENEMEZ: yeni bir kalem eklemek o kalemin havuzdaki
// anahtarını, miktarını ve payını bilmeyi gerektirir ve o bilgi yalnız
// havuzdadır (`editOrder`in "yeni kalem eklenmez" kuralının aynısı). Ek kalem
// için havuzdan yeni bir teklif açılır.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Combobox, type ComboOption } from "@/components/combobox";
import { CURRENCIES, CURRENCY_LABELS, currencyOf, parseNum } from "@/lib/currency";
import {
  kurGerekli,
  leadTimeOptions,
  paymentTermFrom,
  paymentTermOptions,
  paymentTermValue,
  tarihGoster,
} from "@/lib/purchasing/terms";
import { formatNum } from "@/lib/drawings/labels";
import { kurMetni, kurOnerisi, type GunlukKur } from "@/lib/purchasing/kur";
import { trKatla } from "@/lib/drawings/tr-text";
import { cn } from "@/lib/utils";
import { editQuoteBatch } from "../../actions";
import type { PartiOzeti } from "./compare-view";

/** Formdaki teslim seçiminin gün karşılığı; `null` = sorulmadı. */
function teslimGunu(v: string): number | null {
  if (v === "yok" || v.trim() === "") return null;
  const g = Number.parseInt(v, 10);
  return Number.isFinite(g) ? g : null;
}

export function QuoteBatchDialog({
  parti,
  tedarikciler,
  sonKur,
  onClose,
  onSaved,
}: {
  parti: PartiOzeti;
  tedarikciler: string[];
  sonKur?: GunlukKur | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [firma, setFirma] = useState(parti.supplier);
  const [tarih, setTarih] = useState(parti.quotedAt);
  const [paraBirimi, setParaBirimi] = useState(currencyOf(parti.paraBirimi));
  const [kur, setKur] = useState(parti.kur == null ? "" : String(parti.kur));
  const [vade, setVade] = useState(paymentTermValue("vadeli", parti.vadeGun));
  const [not, setNot] = useState(parti.note);
  const [fiyatlar, setFiyatlar] = useState<Record<string, string>>(() =>
    Object.fromEntries(parti.satirlar.map((s) => [s.quoteId, String(s.birimFiyat)]))
  );
  const [teslimler, setTeslimler] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      parti.satirlar.map((s) => [s.quoteId, s.teslimGun == null ? "yok" : String(s.teslimGun)])
    )
  );
  /** SİLİNMEK ÜZERE İŞARETLENENLER — kaydedene kadar geri alınabilir. */
  const [silinecek, setSilinecek] = useState<Set<string>>(new Set());

  const kurLazim = kurGerekli(paraBirimi);
  const kurSayi = parseNum(kur);
  const oneri = kurLazim ? kurOnerisi(paraBirimi, sonKur) : null;

  const firmaSecenekleri: ComboOption[] = (() => {
    const harita = new Map<string, ComboOption>();
    for (const ad of tedarikciler) harita.set(trKatla(ad), { value: ad, label: ad });
    if (firma && !harita.has(trKatla(firma))) harita.set(trKatla(firma), { value: firma, label: firma });
    return [...harita.values()].sort((a, b) => a.label.localeCompare(b.label, "tr"));
  })();

  const vadeSecenekleri = paymentTermOptions(
    vade === "pesin" || vade === "kredi_karti" ? vade : "vadeli",
    Number.parseInt(vade, 10) || 0
  );

  const kalanlar = parti.satirlar.filter((s) => !silinecek.has(s.quoteId));
  const gecerli =
    firma.trim().length > 0 &&
    kalanlar.length > 0 &&
    kalanlar.every((s) => (parseNum(fiyatlar[s.quoteId] ?? "") ?? -1) >= 0) &&
    (!kurLazim || (kurSayi != null && kurSayi > 0));

  function paraBirimiSec(v: string) {
    const yeni = currencyOf(v);
    setParaBirimi(yeni);
    const o = kurOnerisi(yeni, sonKur);
    setKur(o ? kurMetni(o.kur) : "");
  }

  function kaydet() {
    if (!gecerli) return;
    const kosul = paymentTermFrom(vade);
    basla(async () => {
      const sonuc = await editQuoteBatch({
        id: parti.id,
        supplier: firma,
        quotedAt: tarih,
        currency: paraBirimi,
        fxRate: kurLazim ? kurSayi : 1,
        paymentMethod: kosul.method,
        paymentTermDays: kosul.days,
        note: not,
        satirlar: kalanlar.map((s) => ({
          id: s.quoteId,
          unitPrice: parseNum(fiyatlar[s.quoteId] ?? "") ?? 0,
          leadTimeDays: teslimGunu(teslimler[s.quoteId] ?? "yok"),
        })),
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(`${parti.code || "Teklif"} güncellendi.`);
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(72rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">
            Teklifi Düzenle {parti.code && <span className="font-mono">· {parti.code}</span>}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {parti.supplier} · {tarihGoster(parti.quotedAt)} ·{" "}
            {formatNum(parti.satirlar.length)} kalem. Listeden çıkardığınız kalemin teklifi
            SİLİNİR.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid items-start gap-3 border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.4fr)_8rem_9rem_10rem_11rem]">
            <div className="grid content-start gap-1.5">
              <Label>Tedarikçi</Label>
              <Combobox
                options={firmaSecenekleri}
                value={firma || null}
                onChange={setFirma}
                placeholder="Tedarikçi"
                searchPlaceholder="Firma adı…"
                className="h-9 text-base pointer-fine:text-sm"
              />
            </div>
            <div className="grid content-start gap-1.5">
              <Label>Para Birimi</Label>
              <Select value={paraBirimi} onValueChange={paraBirimiSec}>
                <SelectTrigger className="h-9! w-full text-base pointer-fine:text-sm">
                  <SelectValue>{paraBirimi}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} · {CURRENCY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="pd-kur">1 € = ?</Label>
              <Input
                id="pd-kur"
                value={kurLazim ? kur : "1"}
                onChange={(e) => setKur(e.target.value)}
                disabled={!kurLazim}
                inputMode="decimal"
                className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
              {oneri && (
                <button
                  type="button"
                  onClick={() => setKur(kurMetni(oneri.kur))}
                  className="text-left text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {tarihGoster(oneri.gun)} · {kurMetni(oneri.kur)}
                </button>
              )}
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="pd-tarih">Teklif Tarihi</Label>
              <Input
                id="pd-tarih"
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="h-9 font-mono text-base pointer-fine:text-sm"
              />
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="pd-vade">Vade</Label>
              <Select value={vade} onValueChange={setVade}>
                <SelectTrigger id="pd-vade" className="h-9! w-full text-base pointer-fine:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vadeSecenekleri.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="oc-scrollx max-h-[46dvh] overflow-x-auto overflow-y-auto border [--oc-scroll-bg:var(--card)]">
            <table className="w-full min-w-[42rem] text-[12px]">
              <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-normal">Kalem</th>
                  <th className="w-24 px-2 py-1.5 text-right font-normal">Miktar</th>
                  <th className="w-36 px-2 py-1.5 text-right font-normal">
                    Birim Fiyat ({paraBirimi})
                  </th>
                  <th className="w-36 px-2 py-1.5 text-left font-normal">Teslim</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">Tutar €</th>
                  <th className="w-10 px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {parti.satirlar.map((s) => {
                  const silindi = silinecek.has(s.quoteId);
                  const fiyat = parseNum(fiyatlar[s.quoteId] ?? "");
                  const eur =
                    fiyat != null && (kurLazim ? (kurSayi ?? 0) > 0 : true)
                      ? fiyat / (kurLazim ? (kurSayi ?? 1) : 1)
                      : null;
                  const tutar = eur != null && s.miktar != null ? eur * s.miktar : null;
                  return (
                    <tr
                      key={s.quoteId}
                      className={cn("border-t", silindi && "bg-destructive/[0.06] opacity-60")}
                    >
                      <td className={cn("px-2 py-1.5", silindi && "line-through")}>{s.tanim}</td>
                      <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                        {s.miktar == null ? "—" : formatNum(s.miktar)}{" "}
                        <span className="text-[10px] text-muted-foreground">{s.birim}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={fiyatlar[s.quoteId] ?? ""}
                          onChange={(e) =>
                            setFiyatlar((o) => ({ ...o, [s.quoteId]: e.target.value }))
                          }
                          disabled={silindi}
                          inputMode="decimal"
                          aria-label={`${s.tanim} birim fiyatı`}
                          className="h-8 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select
                          value={teslimler[s.quoteId] ?? "yok"}
                          onValueChange={(v) =>
                            setTeslimler((o) => ({ ...o, [s.quoteId]: v }))
                          }
                          disabled={silindi}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-full text-base pointer-fine:text-sm"
                            aria-label={`${s.tanim} teslim süresi`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {leadTimeOptions(teslimGunu(teslimler[s.quoteId] ?? "yok")).map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                        {tutar == null ? "—" : formatNum(Math.round(tutar))}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSilinecek((o) => {
                              const y = new Set(o);
                              if (y.has(s.quoteId)) y.delete(s.quoteId);
                              else y.add(s.quoteId);
                              return y;
                            })
                          }
                          title={silindi ? "Silmeyi geri al" : "Bu kalemi tekliften çıkar"}
                          aria-label={silindi ? "Silmeyi geri al" : "Bu kalemi tekliften çıkar"}
                          className="oc-tap-square grid size-7 place-items-center text-muted-foreground transition-colors hover:text-destructive"
                        >
                          {silindi ? <Undo2 className="size-3.5" /> : <X className="size-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">Not (İsteğe Bağlı)</span>
            <Input
              value={not}
              onChange={(e) => setNot(e.target.value)}
              maxLength={500}
              className="h-9 text-base pointer-fine:text-sm"
            />
          </label>

          {silinecek.size > 0 && (
            <p className="border border-destructive/40 bg-destructive/[0.06] px-3 py-2 text-[12px] text-destructive">
              {formatNum(silinecek.size)} kalem tekliften ÇIKARILACAK ve kaydı silinecek.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={!gecerli || calisiyor}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

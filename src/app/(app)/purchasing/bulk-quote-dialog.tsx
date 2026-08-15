"use client";

// TOPLU TEKLİF PENCERESİ — kullanıcı kararı (14.08.2026):
// *"Aynı sipariş açmada olduğu gibi teklif açmada da çoklu seçim sonrası toplu
// teklif girişi yapılabilsin."*
//
// Sipariş penceresinin (OrderDialog) TEKLİF karşılığıdır: havuzdan seçilen
// bütün kalemler tek bir tedarikçi + para birimi + kur altında, satır satır
// BİRİM FİYATLA girilir ve her satır için ayrı bir teklif kaydı yazılır.
//
// ADET SORULMAZ (teklif penceresinin kuralı, md. 3): teklif birim fiyattır ve
// adet havuzda yazar. Fiyatı boş bırakılan satır ATLANIR — bir firma her kaleme
// birden teklif vermek zorunda değildir.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { CURRENCIES, CURRENCY_LABELS, currencyOf, fmtMoney, parseNum } from "@/lib/currency";
import { bugunISO, kurGerekli, tarihGoster } from "@/lib/purchasing/terms";
import { formatNum } from "@/lib/drawings/labels";
import { kurMetni, kurOnerisi, type GunlukKur } from "@/lib/purchasing/kur";
import { trKatla } from "@/lib/drawings/tr-text";
import { ensureSupplier, saveQuote } from "./actions";

/** Toplu teklife giren tek kalem. */
export interface TopluTeklifKalemi {
  matchKey: string;
  tanim: string;
}

export function BulkQuoteDialog({
  kalemler,
  tedarikciler,
  sonKur,
  onClose,
  onSaved,
}: {
  kalemler: TopluTeklifKalemi[];
  tedarikciler: string[];
  sonKur?: GunlukKur | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [firma, setFirma] = useState("");
  const [firmaYaziliyor, setFirmaYaziliyor] = useState(false);
  const [paraBirimi, setParaBirimi] = useState(currencyOf("EUR"));
  const [kur, setKur] = useState("");
  const [tarih, setTarih] = useState(bugunISO());
  // VADE VE TESLİM TEDARİKÇİ BAŞINA TEKTİR: bir firma bütün kalemlere aynı
  // vadeyi ve aynı termini verir; satır satır sormak yirmi kalemde kırk
  // fazladan kutu ederdi.
  const [vade, setVade] = useState("");
  const [teslim, setTeslim] = useState("");
  const [not, setNot] = useState("");
  const [fiyatlar, setFiyatlar] = useState<Record<string, string>>({});

  const firmaSecenekleri: ComboOption[] = useMemo(() => {
    const harita = new Map<string, ComboOption>();
    for (const ad of tedarikciler) harita.set(trKatla(ad), { value: ad, label: ad });
    if (firma && !harita.has(trKatla(firma))) harita.set(trKatla(firma), { value: firma, label: firma });
    return [...harita.values()].sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [tedarikciler, firma]);

  const kurLazim = kurGerekli(paraBirimi);
  const kurSayi = parseNum(kur);
  const kurOneri = kurLazim ? kurOnerisi(paraBirimi, sonKur) : null;

  const girilen = kalemler.filter((k) => (parseNum(fiyatlar[k.matchKey] ?? "") ?? -1) >= 0);
  const gecerli =
    firma.trim().length > 0 &&
    girilen.length > 0 &&
    (!kurLazim || (kurSayi != null && kurSayi > 0));

  function paraBirimiSec(v: string) {
    const yeni = currencyOf(v);
    setParaBirimi(yeni);
    const o = kurOnerisi(yeni, sonKur);
    setKur(o ? kurMetni(o.kur) : "");
  }

  function firmaOlustur(ad: string) {
    const temiz = ad.trim();
    if (temiz.length < 2 || firmaYaziliyor) return;
    setFirmaYaziliyor(true);
    ensureSupplier({ name: temiz })
      .then((sonuc) => {
        if (sonuc.error || !sonuc.name) {
          toast.error(sonuc.error ?? "Tedarikçi oluşturulamadı.");
          return;
        }
        setFirma(sonuc.name);
        if (sonuc.ok) toast.success(`${sonuc.name} tedarikçi defterine eklendi.`);
      })
      .finally(() => setFirmaYaziliyor(false));
  }

  function kaydet() {
    if (!gecerli) return;
    const kurDeger = kurLazim ? kurSayi : 1;
    basla(async () => {
      let yazilan = 0;
      for (const k of girilen) {
        const fiyat = parseNum(fiyatlar[k.matchKey] ?? "");
        if (fiyat == null || fiyat < 0) continue;
        const sonuc = await saveQuote({
          matchKey: k.matchKey,
          sample: k.tanim,
          supplier: firma,
          unitPrice: fiyat,
          currency: paraBirimi,
          fxRate: kurDeger,
          quotedAt: tarih,
          validUntil: "",
          paymentMethod: (parseNum(vade) ?? 0) > 0 ? "vadeli" : "pesin",
          paymentTermDays: Math.round(parseNum(vade) ?? 0),
          leadTimeDays: teslim.trim() === "" ? null : Math.round(parseNum(teslim) ?? 0),
          note: not,
          itemNo: "",
          packageId: null,
        });
        if (sonuc.error) {
          toast.error(`${k.tanim}: ${sonuc.error}`);
          return;
        }
        yazilan += 1;
      }
      toast.success(`${formatNum(yazilan)} kaleme ${firma} teklifi girildi.`);
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(52rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">Toplu Teklif Gir</DialogTitle>
          <DialogDescription className="text-[12px]">
            Seçili {formatNum(kalemler.length)} kalem için tek tedarikçinin birim fiyatlarını girin.
            Boş bıraktığınız satıra teklif yazılmaz.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 border bg-muted/30 p-3 sm:grid-cols-[minmax(12rem,1fr)_9rem_9rem_9rem]">
            <div className="grid content-start gap-1.5">
              <Label>Tedarikçi</Label>
              <span className="relative flex items-center">
                <Combobox
                  options={firmaSecenekleri}
                  value={firma || null}
                  onChange={setFirma}
                  onCreate={firmaOlustur}
                  createLabel="Yeni tedarikçi"
                  placeholder="Tedarikçi seçin veya yazın"
                  searchPlaceholder="Firma adı…"
                  className="h-9 text-base pointer-fine:text-sm"
                />
                {firmaYaziliyor && (
                  <Loader2 className="pointer-events-none absolute right-7 size-4 animate-spin text-muted-foreground" />
                )}
              </span>
            </div>
            <div className="grid content-start gap-1.5">
              <Label>Para Birimi</Label>
              <Select value={paraBirimi} onValueChange={paraBirimiSec}>
                <SelectTrigger className="w-full text-base pointer-fine:text-sm">
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
              <Label htmlFor="toplu-kur">1 € = ?</Label>
              <Input
                id="toplu-kur"
                value={kurLazim ? kur : "1"}
                onChange={(e) => setKur(e.target.value)}
                disabled={!kurLazim}
                inputMode="decimal"
                className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
              {kurOneri && (
                <button
                  type="button"
                  onClick={() => setKur(kurMetni(kurOneri.kur))}
                  className="text-left text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {tarihGoster(kurOneri.gun)} · {kurMetni(kurOneri.kur)}
                </button>
              )}
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="toplu-tarih">Teklif Tarihi</Label>
              <Input
                id="toplu-tarih"
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="h-9 font-mono text-base pointer-fine:text-sm"
              />
            </div>
            {/* VADE VE TESLİM SÜRESİ — karşılaştırma tablosunun iki sütunu
                (kullanıcı kararı, 15.08.2026). Firma başına tektir. */}
            <div className="grid content-start gap-1.5">
              <Label htmlFor="toplu-vade">Vade (Gün)</Label>
              <Input
                id="toplu-vade"
                value={vade}
                onChange={(e) => setVade(e.target.value)}
                inputMode="numeric"
                placeholder="Peşin"
                className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="toplu-teslim">Teslim (Gün)</Label>
              <Input
                id="toplu-teslim"
                value={teslim}
                onChange={(e) => setTeslim(e.target.value)}
                inputMode="numeric"
                placeholder="Sorulmadı"
                title="0 yazarsanız “Hazır” görünür; boş bırakılırsa tedarikçi söylemedi demektir."
                className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
            </div>
          </div>

          <div className="oc-scrollx overflow-x-auto border [--oc-scroll-bg:var(--card)]">
            <table className="w-full min-w-[36rem] text-[12px]">
              <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-normal">Kalem</th>
                  <th className="w-40 px-2 py-1.5 text-right font-normal">
                    Birim Fiyat ({paraBirimi})
                  </th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">Avro</th>
                </tr>
              </thead>
              <tbody>
                {kalemler.map((k) => {
                  const fiyat = parseNum(fiyatlar[k.matchKey] ?? "");
                  const eur =
                    fiyat != null && (kurLazim ? (kurSayi ?? 0) > 0 : true)
                      ? fiyat / (kurLazim ? (kurSayi ?? 1) : 1)
                      : null;
                  return (
                    <tr key={k.matchKey} className="border-t">
                      <td className="px-2 py-1.5">{k.tanim}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={fiyatlar[k.matchKey] ?? ""}
                          onChange={(e) =>
                            setFiyatlar((o) => ({ ...o, [k.matchKey]: e.target.value }))
                          }
                          inputMode="decimal"
                          placeholder="—"
                          aria-label={`${k.tanim} birim fiyatı`}
                          className="h-8 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                        {eur == null ? "—" : fmtMoney(eur, "EUR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-[12rem] flex-1 gap-1">
              <span className="text-[11px] text-muted-foreground">Not (İsteğe Bağlı)</span>
              <Input
                value={not}
                onChange={(e) => setNot(e.target.value)}
                maxLength={500}
                className="h-9 text-base pointer-fine:text-sm"
              />
            </label>
            <p className="ml-auto text-right text-[12px] text-muted-foreground">
              {formatNum(girilen.length)} / {formatNum(kalemler.length)} kaleme fiyat girildi
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={!gecerli || calisiyor}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            Teklifleri Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

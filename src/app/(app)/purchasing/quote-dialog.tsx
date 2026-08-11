"use client";

// TEKLİF PENCERESİ — kullanıcı kararı (md. 10):
//
//   "Satın alma bölümünde teklif alındı şeklinde bir yerin de olması gerekiyor.
//    Firma 1, Firma 2, Firma 3 gibi alınan teklif fiyatları BASİTÇE sisteme
//    girilebilecek. Açılan butonda Firma ismi ve fiyatı girilecek."
//
// BASİTLİK BİR TASARIM KISITIDIR, bir temenni değil. Pencere iki alanla açılır
// (firma + fiyat) ve kaydeder; para birimi avrodur ve sorulmaz — TL yazmak
// isteyen açılırdan seçer, o zaman kur alanı BELİRİR. Alan sırası kullanımın
// sıklığına göredir, veri modeline göre değil.
//
// "TEKLİF ALINDI" AYRI BİR KUTU DEĞİLDİR: bir teklif girildiği anda kalem
// tekliflidir. İşaret ile veri ayrı tutulsaydı ikisi ayrışabilir ve ekran
// "alındı" derken listede fiyat görünmeyebilirdi.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Trash2 } from "lucide-react";
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
import { CURRENCIES, CURRENCY_LABELS, currencyOf, fmtMoney, parseNum } from "@/lib/currency";
import { bugunISO, kurGerekli, tarihGoster } from "@/lib/purchasing/terms";
import { formatNum } from "@/lib/drawings/labels";
import type { TeklifSatiri } from "./data";
import { chooseQuote, deleteQuote, saveQuote } from "./actions";

export function QuoteDialog({
  matchKey,
  tanim,
  teklifler,
  tedarikciler,
  canWrite,
  onClose,
}: {
  matchKey: string;
  tanim: string;
  teklifler: TeklifSatiri[];
  tedarikciler: string[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [firma, setFirma] = useState("");
  const [fiyat, setFiyat] = useState("");
  const [paraBirimi, setParaBirimi] = useState("EUR");
  const [kur, setKur] = useState("");
  const [adet, setAdet] = useState("");
  const [tarih, setTarih] = useState(bugunISO());
  const [not, setNot] = useState("");
  const [liste, setListe] = useState(teklifler);

  const fiyatSayi = parseNum(fiyat);
  const kurSayi = parseNum(kur);
  const kurLazim = kurGerekli(paraBirimi);
  const gecerli = firma.trim().length > 0 && fiyatSayi != null && fiyatSayi >= 0 && (!kurLazim || (kurSayi != null && kurSayi > 0));

  function ekle() {
    if (!gecerli || fiyatSayi == null) return;
    basla(async () => {
      const sonuc = await saveQuote({
        matchKey,
        sample: tanim,
        supplier: firma,
        unitPrice: fiyatSayi,
        currency: currencyOf(paraBirimi),
        fxRate: kurLazim ? kurSayi : 1,
        qty: parseNum(adet),
        unit: "Adet",
        quotedAt: tarih,
        validUntil: "",
        note: not,
        itemNo: "",
        packageId: null,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Teklif kaydedildi.");
      // İyimser ekleme: pencere kapanmadan liste büyür, satınalmacı üç firmayı
      // arka arkaya girer. Sunucudan yeniden okumak her firmada bir bekleme
      // olurdu ve "basitçe girilebilecek" kuralını bitirirdi.
      setListe((o) => [
        {
          id: sonuc.id ?? `yeni-${o.length}`,
          matchKey,
          sample: tanim,
          supplier: firma.toLocaleUpperCase("tr-TR"),
          unitPrice: fiyatSayi,
          currency: currencyOf(paraBirimi),
          fxRate: kurLazim ? kurSayi : 1,
          unitPriceEur: kurLazim && kurSayi ? fiyatSayi / kurSayi : fiyatSayi,
          qty: parseNum(adet),
          unit: "Adet",
          quotedAt: tarih,
          validUntil: null,
          chosen: false,
          note: not,
          itemNo: "",
        },
        ...o,
      ]);
      setFirma("");
      setFiyat("");
      setAdet("");
      setNot("");
    });
  }

  function sec(id: string) {
    basla(async () => {
      const sonuc = await chooseQuote(id);
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      setListe((o) =>
        o.map((t) => ({ ...t, chosen: t.id === id ? sonuc.ok === 1 : false }))
      );
    });
  }

  function sil(id: string) {
    basla(async () => {
      const sonuc = await deleteQuote(id);
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      setListe((o) => o.filter((t) => t.id !== id));
    });
  }

  // En ucuz AVRO fiyatı — kuru olmayan teklif yarışa girmez (karşılaştırılamaz).
  const yarisanlar = liste.filter((t) => t.unitPriceEur != null);
  const enUcuz = yarisanlar.length
    ? Math.min(...yarisanlar.map((t) => t.unitPriceEur ?? Infinity))
    : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(42rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">Teklifler</DialogTitle>
          <DialogDescription className="text-[12px]">{tanim}</DialogDescription>
        </DialogHeader>

        {liste.length > 0 && (
          <div className="oc-scrollx border [--oc-scroll-bg:var(--card)]">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-normal">Firma</th>
                  <th className="px-2 py-1.5 text-right font-normal">Birim Fiyat</th>
                  <th className="px-2 py-1.5 text-right font-normal">Avro</th>
                  <th className="px-2 py-1.5 text-left font-normal">Tarih</th>
                  <th className="w-20 px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {liste.map((t) => {
                  const kazanan = t.unitPriceEur != null && t.unitPriceEur === enUcuz;
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="px-2 py-1.5">
                        <span className="flex items-center gap-1">
                          {t.chosen && (
                            <Check className="size-3 text-emerald-600 dark:text-emerald-400" aria-label="Seçildi" />
                          )}
                          {t.supplier}
                        </span>
                        {t.note && (
                          <span className="block text-[11px] text-muted-foreground">{t.note}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {fmtMoney(t.unitPrice, t.currency)}
                        {t.qty != null && (
                          <span className="block text-[11px] text-muted-foreground">
                            {formatNum(t.qty)} adet için
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          "px-2 py-1.5 text-right font-mono tabular-nums " +
                          (kazanan ? "font-semibold text-emerald-700 dark:text-emerald-400" : "")
                        }
                      >
                        {/* KURU OLMAYAN TEKLİF karşılaştırılamaz ve öyle görünür:
                            sıfır yazmak onu en ucuz teklif yapardı. */}
                        {t.unitPriceEur == null ? (
                          <span className="text-amber-600 dark:text-amber-400" title="Kur girilmemiş">
                            kur yok
                          </span>
                        ) : (
                          fmtMoney(t.unitPriceEur, "EUR")
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {tarihGoster(t.quotedAt)}
                      </td>
                      <td className="px-2 py-1.5">
                        {canWrite && (
                          <span className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => sec(t.id)}
                              title={t.chosen ? "Seçimi kaldır" : "Bu teklifi seç"}
                              className="grid size-7 place-items-center text-muted-foreground transition-colors pointer-coarse:size-9 hover:text-foreground"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => sil(t.id)}
                              title="Teklifi sil"
                              className="grid size-7 place-items-center text-muted-foreground transition-colors pointer-coarse:size-9 hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canWrite && (
          <div className="grid gap-2 border bg-muted/30 p-2">
            <span className="oc-kicker text-muted-foreground">Yeni Teklif</span>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid min-w-[10rem] flex-1 gap-1">
                <span className="text-[11px] text-muted-foreground">Firma</span>
                <Input
                  value={firma}
                  onChange={(e) => setFirma(e.target.value)}
                  list="tedarikci-listesi"
                  placeholder="Firma"
                  maxLength={120}
                  className="h-9 text-base pointer-fine:text-sm"
                />
              </label>
              <label className="grid w-28 gap-1">
                <span className="text-[11px] text-muted-foreground">Birim fiyat</span>
                <Input
                  value={fiyat}
                  onChange={(e) => setFiyat(e.target.value)}
                  inputMode="decimal"
                  className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                />
              </label>
              <label className="grid w-28 gap-1">
                <span className="text-[11px] text-muted-foreground">Para birimi</span>
                <Select value={paraBirimi} onValueChange={setParaBirimi}>
                  <SelectTrigger size="sm" className="text-base pointer-fine:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CURRENCY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {/* KUR ALANI YALNIZ GEREKİNCE BELİRİR — avroda sorulmaz (hep 1).
                  Kullanıcı kararı: "TL fiyat girilirse eğer kur bilgisi
                  istenecek ve sistemimizde hep euro görünecek." */}
              {kurLazim && (
                <label className="grid w-28 gap-1">
                  <span className="text-[11px] text-muted-foreground">1 € = ?</span>
                  <Input
                    value={kur}
                    onChange={(e) => setKur(e.target.value)}
                    inputMode="decimal"
                    placeholder="35,50"
                    className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                  />
                </label>
              )}
              <label className="grid w-24 gap-1">
                <span className="text-[11px] text-muted-foreground">Adet</span>
                <Input
                  value={adet}
                  onChange={(e) => setAdet(e.target.value)}
                  inputMode="numeric"
                  className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                />
              </label>
              <label className="grid w-36 gap-1">
                <span className="text-[11px] text-muted-foreground">Teklif tarihi</span>
                <Input
                  type="date"
                  value={tarih}
                  onChange={(e) => setTarih(e.target.value)}
                  className="h-9 font-mono text-base pointer-fine:text-sm"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid min-w-[12rem] flex-1 gap-1">
                <span className="text-[11px] text-muted-foreground">Not (isteğe bağlı)</span>
                <Input
                  value={not}
                  onChange={(e) => setNot(e.target.value)}
                  maxLength={500}
                  className="h-9 text-base pointer-fine:text-sm"
                />
              </label>
              <Button type="button" onClick={ekle} disabled={!gecerli || calisiyor}>
                {calisiyor && <Loader2 className="size-4 animate-spin" />}
                Teklifi Ekle
              </Button>
            </div>
            {kurLazim && (kurSayi == null || kurSayi <= 0) && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Avro dışı fiyatta kur zorunludur — sistemde bütün fiyatlar avroda karşılaştırılır.
              </p>
            )}
            <datalist id="tedarikci-listesi">
              {tedarikciler.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

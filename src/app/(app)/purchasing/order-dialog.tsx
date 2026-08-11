"use client";

// SİPARİŞ PENCERESİ — kullanıcı kararı (md. 11):
//
//   "Durum kısmında üzerine basıldığında 'Satın Alındı' olması yerine pop-up
//    açılsa, termini ve sipariş tarihini girse daha iyi olur. Ayrıca pop-up
//    içerisine ödeme vadesi de dropdown seçilsin: Peşin, Kredi Kartı, 15 gün
//    30 gün 45 gün 60 gün 90 gün gibi. Ayrıca Avans miktarı da zorunlu
//    olmasada girilebilsin — dropdown %5 10 15 20 25 30 gibi, ayrıca elle
//    fiyat da yazılabilsin. Ödeme vadesi var ise ürün teslimi + vade süresi
//    şeklinde öderiz. Sipariş tarihi + Vade DEĞİL."
//
// Son cümle penceredeki en önemli bilgidir ve ekranda CANLI olarak gösterilir:
// kullanıcı vadeyi seçtiği anda "ödeme günü şu olur" yazısını görür. Kural bir
// dipnot değil, pencerenin ürettiği asıl çıktıdır.
//
// PENCERE ÇOK KALEMLİDİR (md. 7): havuzdan seçilen bütün kalemler tek siparişe
// girer ve her satır kendi işine bağlı kalır. Tek kalemlik bir pencere,
// satınalmacının gerçekte yaptığı işi modelleyemezdi.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
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
import {
  ADVANCE_PERCENTS,
  PAYMENT_TERMS,
  advanceAmount,
  bugunISO,
  eurKarsiligi,
  gunFarki,
  kurGerekli,
  odemeGunu,
  tarihGoster,
} from "@/lib/purchasing/terms";
import { formatNum } from "@/lib/drawings/labels";
import { createOrder } from "./actions";
import type { OrderLineInput } from "./schema";

/** Havuzdan gelen bir kalemin sipariş penceresindeki hâli. */
export interface SiparisKalemi {
  matchKey: string;
  tanim: string;
  kalan: number;
  birimFiyat: number | null;
  paraBirimi: string | null;
  tedarikci: string;
  /** Kalemin işlere dağılımı — satırın hangi pakete işaret yazacağını belirler. */
  paylar: { itemNo: string; packageId: string; partKey: string; adet: number }[];
}

/** Kullanıcının pencerede düzenlediği satır. */
interface Satir {
  matchKey: string;
  tanim: string;
  adet: string;
  fiyat: string;
  paylar: SiparisKalemi["paylar"];
}

/** Serbest gün girişi için açılırdaki özel değer. */
const OZEL = "ozel";

export function OrderDialog({
  kalemler,
  tedarikciler,
  onClose,
  onSaved,
}: {
  kalemler: SiparisKalemi[];
  tedarikciler: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();

  // TEDARİKÇİ SEÇİLİ TEKLİFTEN ÖNERİLİR. Satınalmacı çoğu zaman en ucuz
  // teklifi verene sipariş açar; boş bir alan sunmak o bilgiyi çöpe atardı.
  const [firma, setFirma] = useState(kalemler.find((k) => k.tedarikci)?.tedarikci ?? "");
  const [siparisNo, setSiparisNo] = useState("");
  const [siparisTarihi, setSiparisTarihi] = useState(bugunISO());
  const [termin, setTermin] = useState("");
  const [vade, setVade] = useState("pesin");
  const [ozelGun, setOzelGun] = useState("");
  const [avansYuzde, setAvansYuzde] = useState("");
  const [avansTutar, setAvansTutar] = useState("");
  const [paraBirimi, setParaBirimi] = useState(
    currencyOf(kalemler.find((k) => k.paraBirimi)?.paraBirimi ?? "EUR")
  );
  const [kur, setKur] = useState("");
  const [not, setNot] = useState("");

  const [satirlar, setSatirlar] = useState<Satir[]>(() =>
    kalemler.map((k) => ({
      matchKey: k.matchKey,
      tanim: k.tanim,
      adet: String(k.kalan || 1),
      // Fiyat SEÇİLİ TEKLİFTEN gelir ama yalnız para birimi tutuyorsa: farklı
      // para biriminden bir fiyatı sessizce taşımak yanlış tutar üretirdi.
      fiyat:
        k.birimFiyat != null && currencyOf(k.paraBirimi) === currencyOf(paraBirimi)
          ? String(k.birimFiyat)
          : "",
      paylar: k.paylar,
    }))
  );

  const secenek = PAYMENT_TERMS.find((t) => t.value === vade);
  const vadeGunu =
    vade === OZEL ? Math.max(0, Math.round(parseNum(ozelGun) ?? 0)) : (secenek?.days ?? 0);
  const vadeBicimi = vade === OZEL ? "vadeli" : (secenek?.method ?? "pesin");

  const kurLazim = kurGerekli(paraBirimi);
  const kurSayi = parseNum(kur);

  const toplam = useMemo(
    () =>
      satirlar.reduce((t, s) => {
        const a = parseNum(s.adet) ?? 0;
        const f = parseNum(s.fiyat) ?? 0;
        return t + a * f;
      }, 0),
    [satirlar]
  );
  const toplamEur = eurKarsiligi(toplam, paraBirimi, kurLazim ? kurSayi : 1);

  const avans = advanceAmount(toplam, parseNum(avansYuzde), parseNum(avansTutar));
  const odeme = odemeGunu({
    dueAt: termin || null,
    receivedAt: null,
    paymentTermDays: vadeBicimi === "vadeli" ? vadeGunu : 0,
  });

  const gecerli =
    firma.trim().length > 0 &&
    siparisTarihi.length > 0 &&
    satirlar.length > 0 &&
    satirlar.every((s) => (parseNum(s.adet) ?? 0) > 0) &&
    (!kurLazim || (kurSayi != null && kurSayi > 0)) &&
    (vadeBicimi !== "vadeli" || vadeGunu > 0);

  function guncelle(i: number, alan: "adet" | "fiyat", deger: string) {
    setSatirlar((o) => o.map((s, j) => (j === i ? { ...s, [alan]: deger } : s)));
  }

  function kaydet() {
    if (!gecerli) return;
    basla(async () => {
      // BİR KALEM BİRDEN ÇOK İŞE GİDİYORSA SATIR BÖLÜNÜR. Sipariş tek olsa da
      // satırlar iş kalemine bağlı kalmalıdır: hangi projeye ne kadar
      // düştüğü sonradan hesaplanamaz, o an bilinir. Adet paylara ORANLA
      // dağıtılır ve yuvarlama farkı SON satıra eklenir — toplam hiçbir zaman
      // kaymaz.
      const lines: OrderLineInput[] = [];
      for (const s of satirlar) {
        const adet = parseNum(s.adet) ?? 0;
        const fiyat = parseNum(s.fiyat);
        const paylar = s.paylar.filter((p) => p.packageId);
        const payToplami = paylar.reduce((t, p) => t + p.adet, 0);

        if (paylar.length === 0 || payToplami <= 0) {
          lines.push({
            matchKey: s.matchKey,
            sample: s.tanim,
            itemNo: "",
            packageId: null,
            partKey: "",
            qty: adet,
            unit: "Adet",
            unitPrice: fiyat,
            note: "",
          });
          continue;
        }

        let dagitilan = 0;
        paylar.forEach((p, i) => {
          const son = i === paylar.length - 1;
          const pay = son
            ? Math.max(0, adet - dagitilan)
            : Math.round((adet * p.adet) / payToplami);
          dagitilan += pay;
          if (pay <= 0) return;
          lines.push({
            matchKey: s.matchKey,
            sample: s.tanim,
            itemNo: p.itemNo,
            packageId: p.packageId,
            partKey: p.partKey,
            qty: pay,
            unit: "Adet",
            unitPrice: fiyat,
            note: "",
          });
        });
      }

      const sonuc = await createOrder({
        orderNo: siparisNo,
        supplier: firma,
        orderedAt: siparisTarihi,
        dueAt: termin,
        paymentMethod: vadeBicimi,
        paymentTermDays: vadeBicimi === "vadeli" ? vadeGunu : 0,
        advancePct: parseNum(avansYuzde),
        advanceAmount: parseNum(avansTutar),
        currency: paraBirimi,
        fxRate: kurLazim ? kurSayi : 1,
        note: not,
        lines,
      });

      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(
        sonuc.ok
          ? `Sipariş açıldı; ${formatNum(sonuc.ok)} kalem paket ekranında “satın alındı” işaretlendi.`
          : "Sipariş açıldı."
      );
      onSaved();
    });
  }

  const terminGun = gunFarki(termin);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(52rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">Sipariş Aç</DialogTitle>
          <DialogDescription className="text-[12px]">
            {formatNum(satirlar.length)} kalem · tek tedarikçi.{" "}
            {new Set(satirlar.flatMap((s) => s.paylar.map((p) => p.itemNo)).filter(Boolean)).size >
              1 && "Kalemler birden çok işe gidiyor; satırlar iş kalemine göre bölünür."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {/* ————————————————————————————————— başlık */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-[12rem] flex-1 gap-1">
              <span className="text-[11px] text-muted-foreground">Tedarikçi</span>
              <Input
                value={firma}
                onChange={(e) => setFirma(e.target.value)}
                list="siparis-tedarikci"
                maxLength={120}
                className="h-9 text-base pointer-fine:text-sm"
              />
            </label>
            <label className="grid w-36 gap-1">
              <span className="text-[11px] text-muted-foreground">Sipariş no</span>
              <Input
                value={siparisNo}
                onChange={(e) => setSiparisNo(e.target.value)}
                maxLength={60}
                className="h-9 font-mono text-base pointer-fine:text-sm"
              />
            </label>
            <label className="grid w-36 gap-1">
              <span className="text-[11px] text-muted-foreground">Sipariş tarihi</span>
              <Input
                type="date"
                value={siparisTarihi}
                onChange={(e) => setSiparisTarihi(e.target.value)}
                className="h-9 font-mono text-base pointer-fine:text-sm"
              />
            </label>
            <label className="grid w-36 gap-1">
              <span className="text-[11px] text-muted-foreground">Termin (teslim)</span>
              <Input
                type="date"
                value={termin}
                onChange={(e) => setTermin(e.target.value)}
                className="h-9 font-mono text-base pointer-fine:text-sm"
              />
            </label>
          </div>

          {/* ————————————————————————————————— ödeme koşulu */}
          <div className="flex flex-wrap items-end gap-2 border bg-muted/30 p-2">
            <label className="grid w-40 gap-1">
              <span className="text-[11px] text-muted-foreground">Ödeme vadesi</span>
              <Select value={vade} onValueChange={setVade}>
                <SelectTrigger size="sm" className="text-base pointer-fine:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                  {/* Liste KAPALI DEĞİLDİR: 120 gün için migration yazmak
                      gerekmemeli (SALE_SCOPES kuralının aynısı). */}
                  <SelectItem value={OZEL}>Diğer (gün gir)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {vade === OZEL && (
              <label className="grid w-24 gap-1">
                <span className="text-[11px] text-muted-foreground">Gün</span>
                <Input
                  value={ozelGun}
                  onChange={(e) => setOzelGun(e.target.value)}
                  inputMode="numeric"
                  className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                />
              </label>
            )}
            <label className="grid w-28 gap-1">
              <span className="text-[11px] text-muted-foreground">Avans %</span>
              <Select value={avansYuzde || "yok"} onValueChange={(v) => setAvansYuzde(v === "yok" ? "" : v)}>
                <SelectTrigger size="sm" className="text-base pointer-fine:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yok">Yok</SelectItem>
                  {ADVANCE_PERCENTS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      %{p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid w-32 gap-1">
              <span className="text-[11px] text-muted-foreground">veya avans tutarı</span>
              <Input
                value={avansTutar}
                onChange={(e) => setAvansTutar(e.target.value)}
                inputMode="decimal"
                className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
            </label>
            <label className="grid w-28 gap-1">
              <span className="text-[11px] text-muted-foreground">Para birimi</span>
              <Select value={paraBirimi} onValueChange={(v) => setParaBirimi(currencyOf(v))}>
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
          </div>

          {/* ÖDEME GÜNÜ CANLI HESAPLANIR — kuralın kendisi ekranda görünür. */}
          <p className="border-l-2 border-primary/40 bg-primary/[0.04] px-2 py-1.5 text-[12px]">
            {vadeBicimi === "vadeli" ? (
              termin ? (
                <>
                  Ödeme <strong>teslimden {vadeGunu} gün sonra</strong>:{" "}
                  <strong>{tarihGoster(odeme)}</strong>. Termin{" "}
                  {terminGun == null ? "girilmedi" : `${terminGun} gün sonra`}.
                </>
              ) : (
                <>
                  Vade <strong>{vadeGunu} gün</strong> — ödeme günü TERMİNDEN sayılır, sipariş
                  tarihinden değil. Termin girilmeden ödeme günü hesaplanamaz.
                </>
              )
            ) : (
              <>
                Peşin/kredi kartı: ödeme <strong>{termin ? tarihGoster(termin) : "teslim günü"}</strong>{" "}
                yapılır.
              </>
            )}
            {avans > 0 && (
              <>
                {" "}
                Avans <strong>{fmtMoney(avans, paraBirimi)}</strong> sipariş günü (
                {tarihGoster(siparisTarihi)}) ödenir.
              </>
            )}
          </p>

          {/* ————————————————————————————————— kalemler */}
          <div className="oc-scrollx max-h-[38dvh] overflow-y-auto border [--oc-scroll-bg:var(--card)]">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-muted/80 text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-2 py-1.5 text-left font-normal">Kalem</th>
                  <th className="w-24 px-2 py-1.5 text-right font-normal">Adet</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">Birim fiyat</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">Tutar</th>
                  <th className="w-8 px-1 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s, i) => {
                  const a = parseNum(s.adet) ?? 0;
                  const fi = parseNum(s.fiyat) ?? 0;
                  return (
                    <tr key={s.matchKey} className="border-t">
                      <td className="px-2 py-1.5">
                        <span className="block">{s.tanim}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {[...new Set(s.paylar.map((p) => p.itemNo).filter(Boolean))].join(" · ") ||
                            "iş kalemi yok"}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={s.adet}
                          onChange={(e) => guncelle(i, "adet", e.target.value)}
                          inputMode="numeric"
                          className="h-8 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                          aria-label={`${s.tanim} adedi`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={s.fiyat}
                          onChange={(e) => guncelle(i, "fiyat", e.target.value)}
                          inputMode="decimal"
                          className="h-8 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                          aria-label={`${s.tanim} birim fiyatı`}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {fmtMoney(a * fi, paraBirimi)}
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => setSatirlar((o) => o.filter((_, j) => j !== i))}
                          aria-label={`${s.tanim} kalemini çıkar`}
                          className="grid size-7 place-items-center text-muted-foreground transition-colors pointer-coarse:size-9 hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-[12rem] flex-1 gap-1">
              <span className="text-[11px] text-muted-foreground">Not (isteğe bağlı)</span>
              <Input
                value={not}
                onChange={(e) => setNot(e.target.value)}
                maxLength={1000}
                className="h-9 text-base pointer-fine:text-sm"
              />
            </label>
            <p className="ml-auto text-right font-mono text-sm tabular-nums">
              <span className="block text-[11px] text-muted-foreground">Sipariş toplamı</span>
              {fmtMoney(toplam, paraBirimi)}
              {toplamEur != null && paraBirimi !== "EUR" && (
                <span className="block text-[11px] text-muted-foreground">
                  {fmtMoney(toplamEur, "EUR")}
                </span>
              )}
            </p>
          </div>
        </div>

        <datalist id="siparis-tedarikci">
          {tedarikciler.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={!gecerli || calisiyor}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            Siparişi Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

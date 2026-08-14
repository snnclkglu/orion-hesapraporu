"use client";

// SİPARİŞ DÜZENLEME — kullanıcı kararı (13.08.2026):
// *"Siparişler sayfasında önceden girilen sipariş düzenlenebilsin."*
//
// PENCERE "SİPARİŞ AÇ"IN İKİZİ DEĞİLDİR ve ayrı bir dosyada durmasının sebebi
// budur. İkisi yüzeyde benziyor ama farkları kuraldır:
//
//   · Burada KALEM EKLENMEZ. Bir kalemin havuzdaki karşılığı (paket, iş
//     kalemi, pay dağılımı) yalnız Talep Havuzu'nda bilinir; buradan
//     eklenen bir satır o bağların hiçbirini taşıyamaz ve paket ekranında
//     görünmeyen bir sipariş satırı üretirdi.
//   · Satır ÇIKARILABİLİR ve çıkarıldığında paketteki "satın alındı" işareti
//     de geri alınır (`editOrder`) — yoksa atölye sipariş edilmemiş bir kalemi
//     beklemeye devam ederdi.
//   · Numara çakışması SİPARİŞİN KENDİSİ HARİÇ sorulur: pencereyi açıp hiçbir
//     şey değiştirmeden kaydetmek hata vermemelidir.
//
// TESLİM VE ÖDEME İŞARETLERİ BURADA DEĞİLDİR: onlar satırdaki çiplerin işidir
// ve günü ayrıca sorarlar (`OdemeTarihi`). Aynı gerçeği iki pencereden yazmak,
// hangisinin son sözü söylediğini belirsizleştirirdi.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboOption } from "@/components/combobox";
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
  eurKarsiligi,
  kurGerekli,
  odemeGunu,
  paymentTermValue,
  tarihGoster,
} from "@/lib/purchasing/terms";
import { VAT_RATES, vatRateOf, vatTotals, type VatRate } from "@/lib/purchasing/vat";
import { formatNum } from "@/lib/drawings/labels";
import { kurMetni, kurOnerisi, type GunlukKur } from "@/lib/purchasing/kur";
import { trKatla } from "@/lib/drawings/tr-text";
import { siparisNoCakisiyorMu } from "@/lib/purchasing/order-no";
import { editOrder, ensureQuality, ensureSupplier } from "../actions";
import type { Siparis, TedarikciKaydi } from "../data";

/** Serbest gün girişi için açılırdaki özel değer (sipariş penceresiyle aynı). */
const OZEL = "ozel";

interface Satir {
  id: string;
  matchKey: string;
  tanim: string;
  itemNo: string;
  packageId: string | null;
  partKey: string;
  unit: string;
  adet: string;
  /** KDV HARİÇ birim fiyat — deftere yazılan ve arşive giren sayı budur. */
  fiyat: string;
  kdv: VatRate;
  /** MARKA/KALİTE snapshotu (md. 16) — düzenlemede korunur. */
  kalite: string;
  /** Teslim alınmış adet — satırı çıkarmak bu sayıyı da düşürür. */
  teslimAlinan: number;
}

export function OrderEditDialog({
  siparis,
  tedarikciler,
  defter,
  siparisNolari,
  sonKur,
  qualities = [],
  onClose,
  onSaved,
}: {
  siparis: Siparis;
  tedarikciler: string[];
  defter: TedarikciKaydi[];
  siparisNolari: string[];
  sonKur?: GunlukKur | null;
  qualities?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [kaliteler, setKaliteler] = useState<string[]>(qualities);
  const kaliteSecenekleri: ComboOption[] = useMemo(
    () => kaliteler.map((k) => ({ value: k, label: k })),
    [kaliteler]
  );

  const [kodlar, setKodlar] = useState<Map<string, string>>(
    () => new Map(defter.filter((t) => t.code).map((t) => [trKatla(t.name), t.code]))
  );
  const [firma, setFirma] = useState(siparis.supplier);
  const [firmaYaziliyor, setFirmaYaziliyor] = useState(false);
  const [siparisNo, setSiparisNo] = useState(siparis.orderNo);
  const [siparisTarihi, setSiparisTarihi] = useState(siparis.orderedAt);
  const [termin, setTermin] = useState(siparis.dueAt ?? "");
  const [vade, setVade] = useState(
    paymentTermValue(siparis.paymentMethod, siparis.paymentTermDays)
  );
  const [ozelGun, setOzelGun] = useState(
    paymentTermValue(siparis.paymentMethod, siparis.paymentTermDays) === OZEL
      ? String(siparis.paymentTermDays)
      : ""
  );
  const [avansYuzde, setAvansYuzde] = useState(
    siparis.advancePct ? String(siparis.advancePct) : ""
  );
  const [avansTutar, setAvansTutar] = useState(
    siparis.advanceAmount ? String(siparis.advanceAmount) : ""
  );
  const [paraBirimi, setParaBirimi] = useState(currencyOf(siparis.currency));
  const [kur, setKur] = useState(siparis.fxRate ? kurMetni(siparis.fxRate) : "");
  const [not, setNot] = useState(siparis.note);

  const [satirlar, setSatirlar] = useState<Satir[]>(() =>
    siparis.satirlar.map((l) => ({
      id: l.id,
      matchKey: l.matchKey,
      tanim: l.sample,
      itemNo: l.itemNo,
      packageId: l.packageId,
      partKey: l.partKey,
      unit: l.unit,
      adet: String(l.qty),
      fiyat: l.unitPrice == null ? "" : String(l.unitPrice),
      kdv: vatRateOf(l.vatRate),
      kalite: l.quality,
      teslimAlinan: l.receivedQty,
    }))
  );

  const secenek = PAYMENT_TERMS.find((t) => t.value === vade);
  const vadeGunu =
    vade === OZEL ? Math.max(0, Math.round(parseNum(ozelGun) ?? 0)) : (secenek?.days ?? 0);
  const vadeBicimi = vade === OZEL ? "vadeli" : (secenek?.method ?? "pesin");

  const kurLazim = kurGerekli(paraBirimi);
  const kurOneri = kurLazim ? kurOnerisi(paraBirimi, sonKur) : null;
  const kurSayi = parseNum(kur);

  // ÜÇ TOPLAM (sipariş penceresinin aynısı): net deftere yazılan, brüt kasadan
  // çıkan tutardır. Avans KDV DAHİL tutardan hesaplanır — tedarikçi peşinatı
  // faturanın tamamı üzerinden ister.
  const toplamlar = vatTotals(
    satirlar.map((s) => ({
      net: (parseNum(s.adet) ?? 0) * (parseNum(s.fiyat) ?? 0),
      vatRate: s.kdv,
    }))
  );
  const toplam = toplamlar.net;
  const kurBolen = kurLazim ? kurSayi : 1;
  const toplamEur = eurKarsiligi(toplam, paraBirimi, kurBolen);
  const brutEur = eurKarsiligi(toplamlar.gross, paraBirimi, kurBolen);
  const avans = advanceAmount(toplamlar.gross, parseNum(avansYuzde), parseNum(avansTutar));
  const odeme = odemeGunu({
    dueAt: termin || null,
    receivedAt: siparis.receivedAt,
    paymentTermDays: vadeBicimi === "vadeli" ? vadeGunu : 0,
  });

  const noCakisiyor = siparisNoCakisiyorMu(siparisNo, siparisNolari, siparis.orderNo);

  const gecerli =
    firma.trim().length > 0 &&
    siparisTarihi.length > 0 &&
    satirlar.length > 0 &&
    satirlar.every((s) => (parseNum(s.adet) ?? 0) > 0) &&
    (!kurLazim || (kurSayi != null && kurSayi > 0)) &&
    (vadeBicimi !== "vadeli" || vadeGunu > 0) &&
    !noCakisiyor;

  function guncelle(id: string, yama: Partial<Satir>) {
    setSatirlar((o) => o.map((s) => (s.id === id ? { ...s, ...yama } : s)));
  }

  function kaliteEkle(id: string, ad: string) {
    const temiz = ad.trim();
    if (!temiz) return;
    guncelle(id, { kalite: temiz.toLocaleUpperCase("tr-TR") });
    ensureQuality({ name: temiz }).then((sonuc) => {
      if (sonuc.error || !sonuc.name) return;
      setKaliteler((o) =>
        o.includes(sonuc.name!) ? o : [...o, sonuc.name!].sort((a, b) => a.localeCompare(b, "tr"))
      );
      guncelle(id, { kalite: sonuc.name! });
    });
  }

  /** Yeni firma adı yazıldıysa deftere girer (sipariş penceresiyle aynı kural). */
  function firmaKesinlestir() {
    const ad = firma.trim();
    if (ad.length < 2 || firmaYaziliyor || kodlar.has(trKatla(ad))) return;
    setFirmaYaziliyor(true);
    ensureSupplier({ name: ad })
      .then((sonuc) => {
        if (sonuc.error || !sonuc.name) return;
        setKodlar((o) => new Map(o).set(trKatla(sonuc.name as string), sonuc.code ?? ""));
        setFirma(sonuc.name as string);
        if (sonuc.ok) toast.success(`${sonuc.name} tedarikçi defterine eklendi.`);
      })
      .finally(() => setFirmaYaziliyor(false));
  }

  function kaydet() {
    if (!gecerli) return;
    basla(async () => {
      const sonuc = await editOrder({
        id: siparis.id,
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
        lines: satirlar.map((s) => ({
          id: s.id,
          matchKey: s.matchKey,
          sample: s.tanim,
          itemNo: s.itemNo,
          packageId: s.packageId,
          partKey: s.partKey,
          qty: parseNum(s.adet) ?? 0,
          unit: s.unit,
          unitPrice: parseNum(s.fiyat),
          vatRate: s.kdv,
          quality: s.kalite,
          note: "",
        })),
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Sipariş güncellendi.");
      onSaved();
    });
  }

  const cikarilan = siparis.satirlar.length - satirlar.length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(72rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">Siparişi Düzenle</DialogTitle>
          <DialogDescription className="text-[12px]">
            Kalem eklemek için Talep Havuzu&apos;ndan yeni sipariş açın; burada var
            olan satırlar düzeltilir ya da çıkarılır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {/* ————————————————————————————————— başlık */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-[12rem] flex-1 gap-1">
              <span className="text-[11px] text-muted-foreground">Tedarikçi</span>
              <span className="relative flex items-center">
                <Input
                  value={firma}
                  onChange={(e) => setFirma(e.target.value)}
                  onBlur={firmaKesinlestir}
                  list="siparis-duzenle-tedarikci"
                  maxLength={120}
                  className="h-9 flex-1 text-base pointer-fine:text-sm"
                />
                {firmaYaziliyor && (
                  <Loader2 className="absolute right-2 size-4 animate-spin text-muted-foreground" />
                )}
              </span>
            </label>
            <label className="grid w-40 gap-1">
              <span className="text-[11px] text-muted-foreground">Sipariş No</span>
              <Input
                value={siparisNo}
                onChange={(e) => setSiparisNo(e.target.value)}
                maxLength={60}
                aria-invalid={noCakisiyor}
                className="h-9 font-mono text-base pointer-fine:text-sm"
              />
              {noCakisiyor && (
                <span className="text-[10px] text-destructive">Bu numara zaten kullanılmış.</span>
              )}
            </label>
            <label className="grid w-36 gap-1">
              <span className="text-[11px] text-muted-foreground">Sipariş Tarihi</span>
              <Input
                type="date"
                value={siparisTarihi}
                onChange={(e) => setSiparisTarihi(e.target.value)}
                className="h-9 font-mono text-base pointer-fine:text-sm"
              />
            </label>
            <label className="grid w-36 gap-1">
              <span className="text-[11px] text-muted-foreground">Termin (İsteğe Bağlı)</span>
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
              <span className="text-[11px] text-muted-foreground">Ödeme Vadesi</span>
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
                  <SelectItem value={OZEL}>Diğer (Gün Gir)</SelectItem>
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
              <Select
                value={avansYuzde || "yok"}
                onValueChange={(v) => setAvansYuzde(v === "yok" ? "" : v)}
              >
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
              <span className="text-[11px] text-muted-foreground">Veya Avans Tutarı</span>
              <Input
                value={avansTutar}
                onChange={(e) => setAvansTutar(e.target.value)}
                inputMode="decimal"
                className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
            </label>
            <label className="grid w-28 gap-1">
              <span className="text-[11px] text-muted-foreground">Para Birimi</span>
              <Select
                value={paraBirimi}
                onValueChange={(v) => {
                  // PARA BİRİMİ VE KUR BİRLİKTE DEĞİŞİR (sipariş penceresinin
                  // kuralı): dolardan liraya geçilip kur 1,08'de kalsaydı
                  // sipariş otuz kat ucuz kaydedilirdi.
                  const yeni = currencyOf(v);
                  setParaBirimi(yeni);
                  const o = kurOnerisi(yeni, sonKur);
                  setKur(o ? kurMetni(o.kur) : "");
                }}
              >
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
              <label className="grid w-32 gap-1">
                <span className="text-[11px] text-muted-foreground">1 € = ?</span>
                <Input
                  value={kur}
                  onChange={(e) => setKur(e.target.value)}
                  inputMode="decimal"
                  className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                />
                {kurOneri && (
                  <button
                    type="button"
                    onClick={() => setKur(kurMetni(kurOneri.kur))}
                    title={`TCMB ${tarihGoster(kurOneri.gun)} — dokunmak kutuyu bu kurla doldurur`}
                    className="text-left text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {tarihGoster(kurOneri.gun)} · {kurMetni(kurOneri.kur)}
                  </button>
                )}
              </label>
            )}
          </div>

          <p className="border-l-2 border-primary/40 bg-primary/[0.04] px-2 py-1.5 text-[12px]">
            {odeme ? (
              <>
                Ödeme günü <strong>{tarihGoster(odeme)}</strong>
                {vadeBicimi === "vadeli" ? ` (teslimden ${vadeGunu} gün sonra)` : ""}.
              </>
            ) : (
              <>Termin ya da teslim tarihi girilmeden ödeme günü hesaplanamaz.</>
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
          <div className="oc-scrollx overflow-x-auto border [--oc-scroll-bg:var(--card)]">
            <table className="w-full min-w-[58rem] text-[12px]">
              <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-normal">Kalem</th>
                  <th className="w-40 px-2 py-1.5 text-left font-normal">Marka/Kalite</th>
                  <th className="w-20 px-2 py-1.5 text-right font-normal">Adet</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">
                    Birim Fiyat <span className="block text-[10px]">(KDV hariç)</span>
                  </th>
                  <th className="w-20 px-2 py-1.5 text-left font-normal">KDV</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">Tutar</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">KDV Dahil</th>
                  <th className="w-8 px-1 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => {
                  const a = parseNum(s.adet) ?? 0;
                  const fi = parseNum(s.fiyat) ?? 0;
                  const net = a * fi;
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="px-2 py-1.5">
                        <span className="block">{s.tanim}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {s.itemNo || "iş kalemi yok"}
                          {s.teslimAlinan > 0 && ` · ${formatNum(s.teslimAlinan)} teslim alındı`}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <Combobox
                          options={kaliteSecenekleri}
                          value={s.kalite || null}
                          onChange={(v) => guncelle(s.id, { kalite: v })}
                          onCreate={(name) => kaliteEkle(s.id, name)}
                          createLabel="Yeni marka/kalite"
                          placeholder="—"
                          searchPlaceholder="Marka/Kalite ara veya yaz…"
                          className="h-8 text-base pointer-fine:text-sm"
                          contentClassName="w-[min(24rem,calc(100vw-1.5rem))]"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={s.adet}
                          onChange={(e) => guncelle(s.id, { adet: e.target.value })}
                          inputMode="numeric"
                          className="h-8 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                          aria-label={`${s.tanim} adedi`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={s.fiyat}
                          onChange={(e) => guncelle(s.id, { fiyat: e.target.value })}
                          inputMode="decimal"
                          className="h-8 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                          aria-label={`${s.tanim} birim fiyatı (KDV hariç)`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select
                          value={String(s.kdv)}
                          onValueChange={(v) => guncelle(s.id, { kdv: Number(v) as VatRate })}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-full px-2 font-mono text-base pointer-fine:text-sm"
                            aria-label={`${s.tanim} KDV oranı`}
                          >
                            <SelectValue>%{s.kdv}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_RATES.map((oran) => (
                              <SelectItem key={oran} value={String(oran)}>
                                %{oran}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {fmtMoney(net, paraBirimi)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-medium tabular-nums">
                        {fmtMoney(net * (1 + s.kdv / 100), paraBirimi)}
                      </td>
                      <td className="px-1 py-1.5">
                        {/* SON SATIR ÇIKARILAMAZ: kalemsiz bir sipariş bir
                            kayıt değil bir boşluktur; onun yolu İPTALdir. */}
                        <button
                          type="button"
                          disabled={satirlar.length <= 1}
                          onClick={() => setSatirlar((o) => o.filter((x) => x.id !== s.id))}
                          aria-label={`${s.tanim} kalemini çıkar`}
                          title={
                            satirlar.length <= 1
                              ? "Tek kalem çıkarılamaz — siparişi iptal edin"
                              : "Kalemi siparişten çıkar"
                          }
                          className="grid size-7 place-items-center text-muted-foreground transition-colors pointer-coarse:size-9 hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground"
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

          {cikarilan > 0 && (
            <p className="border-l-2 border-destructive/50 bg-destructive/[0.05] px-2 py-1.5 text-[12px]">
              {formatNum(cikarilan)} kalem siparişten çıkarılacak. Paket ekranındaki
              &quot;satın alındı&quot; işaretleri de geri alınır.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-[12rem] flex-1 gap-1">
              <span className="text-[11px] text-muted-foreground">Not (İsteğe Bağlı)</span>
              <Input
                value={not}
                onChange={(e) => setNot(e.target.value)}
                maxLength={1000}
                className="h-9 text-base pointer-fine:text-sm"
              />
            </label>
            <div className="ml-auto grid grid-cols-[auto_auto_auto] gap-x-3 gap-y-1 text-right text-sm">
              <span className="text-muted-foreground">KDV Hariç Tutar</span>
              <span className="font-mono tabular-nums">{fmtMoney(toplam, paraBirimi)}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {toplamEur == null ? "—" : fmtMoney(toplamEur, "EUR")}
              </span>
              <span className="text-muted-foreground">KDV</span>
              <span className="font-mono tabular-nums">{fmtMoney(toplamlar.vat, paraBirimi)}</span>
              <span />
              <span className="font-semibold">KDV Dahil Tutar</span>
              <span className="font-mono font-semibold tabular-nums">
                {fmtMoney(toplamlar.gross, paraBirimi)}
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {brutEur == null ? "—" : fmtMoney(brutEur, "EUR")}
              </span>
            </div>
          </div>
        </div>

        <datalist id="siparis-duzenle-tedarikci">
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
            Değişiklikleri Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

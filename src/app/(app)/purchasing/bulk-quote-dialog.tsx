"use client";

// TOPLU TEKLİF PENCERESİ — kullanıcı kararı (14.08.2026):
// *"Aynı sipariş açmada olduğu gibi teklif açmada da çoklu seçim sonrası toplu
// teklif girişi yapılabilsin."*
//
// Sipariş penceresinin (OrderDialog) TEKLİF karşılığıdır: havuzdan seçilen
// bütün kalemler tek bir tedarikçi + para birimi + kur altında, satır satır
// BİRİM FİYATLA girilir.
//
// ADET SORULMAZ (teklif penceresinin kuralı, md. 3): teklif birim fiyattır ve
// adet havuzda yazar. Fiyatı boş bırakılan satır ATLANIR — bir firma her kaleme
// birden teklif vermek zorunda değildir.
//
// ═══════════════════════════════════════ 15.08.2026 TURU — DÖRT DEĞİŞİKLİK
//
// 1. **PENCERE %50 GENİŞLEDİ** (52 → 78rem). Kalem adları uzun (`DOLU Ø294
//    S355JR`), yanına fiyat, teslim ve avro sütunları geldi; dar pencerede
//    başlık şeridi ikinci satıra kırılıp alanlar birbirinden kayıyordu.
// 2. **VADE AÇILIR LİSTEDİR** (`PAYMENT_TERMS` — Peşin · Kredi Kartı · 15/30/
//    45/60/90 gün). Serbest sayı kutusu vadeyi bir metin gibi girdiriyordu ve
//    "peşin" ile "0" aynı şeyi iki kez söylüyordu.
// 3. **TESLİM AÇILIR LİSTEDİR** (Hemen · 1…6 · 8 hafta) VE İKİ KATMANLIDIR:
//    üstteki seçim BÜTÜN satırlara uygulanır, satırın kendi kutusu onu ezer —
//    kullanıcı kararı: *"Teslim günü toplu da seçilebilsin. Hepsi o seçilen
//    olarak düzenlensin. ama kalem bazında da değişim yapabileyim."*
// 4. **TEK KAYIT, TEK KOD**: satırlar tek bir `saveBulkQuote` ile yazılır ve
//    hepsi aynı TEKLİF PARTİSİNE (`TK0007`) bağlanır. Eskiden pencere satır
//    satır `saveQuote` çağırıyordu; on beş kalemde on beş gidiş-dönüş ve —
//    daha kötüsü — ortada kesilirse yarım bir teklif.

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
import { CURRENCIES, CURRENCY_LABELS, currencyOf, parseNum } from "@/lib/currency";
import {
  PAYMENT_TERMS,
  QUOTE_LEAD_TIMES,
  bugunISO,
  kurGerekli,
  paymentTermFrom,
  tarihGoster,
} from "@/lib/purchasing/terms";
import { formatNum } from "@/lib/drawings/labels";
import { kurMetni, kurOnerisi, type GunlukKur } from "@/lib/purchasing/kur";
import { trKatla } from "@/lib/drawings/tr-text";
import { ensureSupplier, saveBulkQuote } from "./actions";
import { TAM_BOY_PENCERE } from "./pencere";

/**
 * Toplu teklife giren tek kalem.
 *
 * ═══════════════════════════ MİKTAR PENCEREYE GELİR — KULLANICIYA SORULMAZ
 *
 * Kullanıcı bildirimi (15.08.2026): *"Plaka teklifi aç dediğimde açılan
 * pop-up'ta teklif detayları düzgün gelmiyor."* Doğruydu: pencere yalnız kalem
 * ADINI basıyordu. Plakada fiyat KİLO fiyatıdır (proforma: `3.537 KG × 0,690
 * USD`) ve miktar ekranda yokken kullanıcı ne kadarlık bir teklif girdiğini
 * göremiyor, verilen fiyatı kendi listesindeki toplamla karşılaştıramıyordu.
 *
 * "Teklifte adet SORULMAZ" kuralı (md. 24) çiğnenmedi: miktar bir GİRDİ ALANI
 * değil, kalemin geldiği ekrandan (havuz satırı ya da kesim planı) taşınan bir
 * KÜNYEdir. Kullanıcı ona dokunamaz; yalnız neyin fiyatını verdiğini görür.
 */
export interface TopluTeklifKalemi {
  matchKey: string;
  tanim: string;
  /** Sipariş edilecek miktar — tutar bununla çarpılır; bilinmiyorsa `null`. */
  miktar?: number | null;
  /** "Kg" · "Boy" · "Adet" — birim fiyatın paydası. */
  birim?: string;
  /** Kalemin altına düşen künye: "5 plaka × 707 kg". */
  not?: string;
}

/**
 * SATIRIN TESLİM SEÇENEĞİ — üç hâl, üçü de ayrı.
 *
 * `"toplu"` → üstteki toplu seçim geçerli (satıra dokunulmadı)
 * `"yok"`   → bu kalemde tedarikçi söylemedi (`null` yazılır)
 * sayı      → kalemin kendi süresi [gün]
 *
 * Üçüncü hâl olmasaydı "toplu 4 hafta ama bu kalem sorulmadı" durumu
 * anlatılamazdı; `null`u hem "dokunulmadı" hem "sorulmadı" saymak, kullanıcının
 * bilerek boşalttığı bir kalemi sessizce partinin süresine döndürürdü.
 */
const TOPLU_MIRAS = "toplu";
const SATIR_TESLIM_SECENEKLERI = [
  { value: TOPLU_MIRAS, label: "Toplu" },
  ...QUOTE_LEAD_TIMES.map((o) => ({
    value: o.value,
    label: o.days == null ? "Sorulmadı" : o.days === 0 ? "Hemen" : `${o.days / 7} hafta`,
  })),
];

export function BulkQuoteDialog({
  kalemler,
  tedarikciler,
  sonKur,
  scope = "hammadde",
  onClose,
  onSaved,
}: {
  kalemler: TopluTeklifKalemi[];
  tedarikciler: string[];
  sonKur?: GunlukKur | null;
  /** Partinin kapsamı — hangi havuzdan açıldı. */
  scope?: "hammadde" | "ekipman";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [firma, setFirma] = useState("");
  const [firmaYaziliyor, setFirmaYaziliyor] = useState(false);
  const [paraBirimi, setParaBirimi] = useState(currencyOf("EUR"));
  const [kur, setKur] = useState("");
  const [tarih, setTarih] = useState(bugunISO());
  // VADE TEDARİKÇİ BAŞINA TEKTİR: bir firma bütün kalemlere aynı vadeyi verir;
  // satır satır sormak yirmi kalemde kırk fazladan kutu ederdi.
  const [vade, setVade] = useState("pesin");
  /** Toplu teslim — satır dokunulmadıkça hepsine uygulanır. */
  const [teslim, setTeslim] = useState("yok");
  const [not, setNot] = useState("");
  const [fiyatlar, setFiyatlar] = useState<Record<string, string>>({});
  const [satirTeslim, setSatirTeslim] = useState<Record<string, string>>({});

  const firmaSecenekleri: ComboOption[] = useMemo(() => {
    const harita = new Map<string, ComboOption>();
    for (const ad of tedarikciler) harita.set(trKatla(ad), { value: ad, label: ad });
    if (firma && !harita.has(trKatla(firma))) harita.set(trKatla(firma), { value: firma, label: firma });
    return [...harita.values()].sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [tedarikciler, firma]);

  const kurLazim = kurGerekli(paraBirimi);
  const kurSayi = parseNum(kur);
  const kurOneri = kurLazim ? kurOnerisi(paraBirimi, sonKur) : null;

  const topluTeslim = QUOTE_LEAD_TIMES.find((o) => o.value === teslim)?.days ?? null;
  const topluTeslimEtiketi =
    topluTeslim == null ? "Sorulmadı" : topluTeslim === 0 ? "Hemen" : `${topluTeslim / 7} hafta`;

  /** Satırın nihai teslim süresi [gün] — toplu seçim ile satır kararı burada birleşir. */
  function satirinTeslimi(key: string): number | null {
    const v = satirTeslim[key] ?? TOPLU_MIRAS;
    if (v === TOPLU_MIRAS) return topluTeslim;
    if (v === "yok") return null;
    const g = Number.parseInt(v, 10);
    return Number.isFinite(g) ? g : null;
  }

  const girilen = kalemler.filter((k) => (parseNum(fiyatlar[k.matchKey] ?? "") ?? -1) >= 0);
  const gecerli =
    firma.trim().length > 0 &&
    girilen.length > 0 &&
    (!kurLazim || (kurSayi != null && kurSayi > 0));

  /**
   * TOPLAM — yalnız MİKTARI BİLİNEN ve fiyatı girilmiş kalemlerden.
   *
   * Miktarı bilinmeyen kalemi sıfır saymak toplamı olduğundan küçük gösterir;
   * bir sayıyla göstermek de "hepsi bu" der. Sayı yazılır, dışarıda kalan
   * kalem sayısı da yanında yazar (`tfoot`).
   */
  const toplamlar = girilen.reduce(
    (t, k) => {
      const fiyat = parseNum(fiyatlar[k.matchKey] ?? "");
      const miktar = k.miktar != null && k.miktar > 0 ? k.miktar : null;
      if (fiyat == null || miktar == null) return { ...t, eksik: t.eksik + 1 };
      return { tutar: t.tutar + fiyat * miktar, sayi: t.sayi + 1, eksik: t.eksik };
    },
    { tutar: 0, sayi: 0, eksik: 0 }
  );
  const toplam = toplamlar.sayi > 0 ? toplamlar.tutar : null;
  const toplamEur =
    toplam != null && (kurLazim ? (kurSayi ?? 0) > 0 : true)
      ? toplam / (kurLazim ? (kurSayi ?? 1) : 1)
      : null;
  const miktarsizKalem = toplamlar.eksik;

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
    const kosul = paymentTermFrom(vade);
    basla(async () => {
      const sonuc = await saveBulkQuote({
        supplier: firma,
        currency: paraBirimi,
        fxRate: kurLazim ? kurSayi : 1,
        quotedAt: tarih,
        paymentMethod: kosul.method,
        paymentTermDays: kosul.days,
        note: not,
        scope,
        satirlar: girilen.map((k) => ({
          matchKey: k.matchKey,
          sample: k.tanim,
          unitPrice: parseNum(fiyatlar[k.matchKey] ?? "") ?? 0,
          leadTimeDays: satirinTeslimi(k.matchKey),
          // MİKTAR YEDEK OLARAK YAZILIR: havuzda karşılığı olan kalemde
          // okunmaz (havuz otoriterdir), plakada ise tek kaynaktır.
          qty: k.miktar != null && k.miktar > 0 ? k.miktar : null,
          unit: k.birim ?? "Adet",
        })),
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(
        `${sonuc.no ? `${sonuc.no} · ` : ""}${formatNum(sonuc.ok ?? 0)} kaleme ${firma} teklifi girildi.`
      );
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* GENİŞLİK %50 ARTTI (52 → 78rem): başlık şeridi altı alanı tek satırda
          taşıyor ve tablo dört sütuna çıktı. */}
      <DialogContent className={`sm:max-w-[min(78rem,calc(100%-2rem))] ${TAM_BOY_PENCERE}`}>
        <DialogHeader>
          <DialogTitle className="text-base">Toplu Teklif Gir</DialogTitle>
          <DialogDescription className="text-[12px]">
            Seçili {formatNum(kalemler.length)} kalem için tek tedarikçinin birim fiyatlarını girin.
            Boş bıraktığınız satıra teklif yazılmaz. Kayıt tek bir teklif kodu altında toplanır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {/* ALANLAR TEK IZGARADADIR ve hepsi `h-9`dur: Combobox bir düğme,
              Input bir alan ve ikisinin taban yüksekliği farklıdır — hizayı
              ızgara değil, ORTAK YÜKSEKLİK kurar. */}
          <div className="grid items-start gap-3 border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1.4fr)_8rem_9rem_10rem_11rem_11rem]">
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
            {/* VADE — açılır liste (kullanıcı kararı, 15.08.2026). Sözlük
                siparişle ORTAKTIR (`PAYMENT_TERMS`): iki ayrı liste, aynı
                modülde aynı soruya iki cevap demekti. */}
            <div className="grid content-start gap-1.5">
              <Label htmlFor="toplu-vade">Vade</Label>
              <Select value={vade} onValueChange={setVade}>
                <SelectTrigger id="toplu-vade" className="h-9! w-full text-base pointer-fine:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* TESLİM — toplu seçim. Satırın kendi kutusu bunu ezer. */}
            <div className="grid content-start gap-1.5">
              <Label htmlFor="toplu-teslim">Teslim (Tümü)</Label>
              <Select value={teslim} onValueChange={setTeslim}>
                <SelectTrigger
                  id="toplu-teslim"
                  className="h-9! w-full text-base pointer-fine:text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_LEAD_TIMES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Satırda değiştirmediğiniz kalemlere uygulanır.
              </p>
            </div>
          </div>

          {/* TABLO KULLANICININ KENDİ ÇALIŞMA DOSYASININ SÜTUN DÜZENİNDEDİR:
              Tanımı · Miktar-Ağırlık · Birim Fiyat · Tutar. Sütunlar bir zevk
              değil bir ALIŞKANLIKtır; teklifi telefonla alan satınalmacı
              rakamları o sırayla duyuyor. */}
          <div className="oc-scrollx max-h-[46dvh] overflow-y-auto overflow-x-auto border [--oc-scroll-bg:var(--card)]">
            <table className="w-full min-w-[48rem] text-[12px]">
              <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-normal">Kalem</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">Miktar</th>
                  <th className="w-36 px-2 py-1.5 text-right font-normal">
                    Birim Fiyat ({paraBirimi})
                  </th>
                  <th className="w-32 px-2 py-1.5 text-right font-normal">Tutar ({paraBirimi})</th>
                  {kurLazim && <th className="w-28 px-2 py-1.5 text-right font-normal">Tutar €</th>}
                  <th className="w-32 px-2 py-1.5 text-left font-normal">Teslim</th>
                </tr>
              </thead>
              <tbody>
                {kalemler.map((k) => {
                  const fiyat = parseNum(fiyatlar[k.matchKey] ?? "");
                  const miktar = k.miktar != null && k.miktar > 0 ? k.miktar : null;
                  // TUTAR MİKTARLA ÇARPILIR (karşılaştırma çekirdeğinin kuralı):
                  // en ucuz birim fiyat en ucuz teklif değildir.
                  const tutar = fiyat != null && miktar != null ? fiyat * miktar : null;
                  const tutarEur =
                    tutar != null && (kurLazim ? (kurSayi ?? 0) > 0 : true)
                      ? tutar / (kurLazim ? (kurSayi ?? 1) : 1)
                      : null;
                  const secim = satirTeslim[k.matchKey] ?? TOPLU_MIRAS;
                  return (
                    <tr key={k.matchKey} className="border-t">
                      <td className="px-2 py-1.5">
                        {k.tanim}
                        {k.not && (
                          <span className="block text-[11px] text-muted-foreground">{k.not}</span>
                        )}
                      </td>
                      {/* MİKTAR BİR KUTU DEĞİL: teklifte adet sorulmaz, yalnız
                          neyin fiyatı verildiği gösterilir. */}
                      <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                        {miktar == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <>
                            {formatNum(miktar)}{" "}
                            <span className="text-[10px] text-muted-foreground">
                              {k.birim ?? "Adet"}
                            </span>
                          </>
                        )}
                      </td>
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
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {tutar == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatNum(Math.round(tutar))
                        )}
                      </td>
                      {kurLazim && (
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                          {tutarEur == null ? "—" : formatNum(Math.round(tutarEur))}
                        </td>
                      )}
                      <td className="px-2 py-1.5">
                        <Select
                          value={secim}
                          onValueChange={(v) =>
                            setSatirTeslim((o) => ({ ...o, [k.matchKey]: v }))
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-full text-base pointer-fine:text-sm"
                            aria-label={`${k.tanim} teslim süresi`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SATIR_TESLIM_SECENEKLERI.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.value === TOPLU_MIRAS
                                  ? `Toplu · ${topluTeslimEtiketi}`
                                  : o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* TOPLAM SATIRI: teklif kâğıdının altında yazan sayı budur ve
                  satınalmacı önce ona bakar. Miktarı bilinmeyen kalem toplama
                  GİRMEZ ve bu SÖYLENİR — eksik bir toplamı tam gibi göstermek,
                  yanlış firmayı kazandırırdı. */}
              <tfoot>
                <tr className="border-t-2 border-foreground/20 bg-muted/40 font-mono font-semibold tabular-nums">
                  <td className="px-2 py-2 font-sans" colSpan={2}>
                    Toplam
                    {miktarsizKalem > 0 && (
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                        {formatNum(miktarsizKalem)} kalemin miktarı bilinmiyor, toplama girmedi
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2 text-right">
                    {toplam == null ? "—" : formatNum(Math.round(toplam))}
                  </td>
                  {kurLazim && (
                    <td className="px-2 py-2 text-right">
                      {toplamEur == null ? "—" : formatNum(Math.round(toplamEur))}
                    </td>
                  )}
                  <td className="px-2 py-2" />
                </tr>
              </tfoot>
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

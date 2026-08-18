"use client";

// Bir iş kaleminin ticari kaydını düzenleme penceresi.
//
// Toplamlar BURADA GİRİLMEZ, anında hesaplanıp gösterilir (veritabanında da
// türetilmiş sütunlardır): elle yazılan bir toplam birim değerlerle çelişebilir
// ve hangisinin doğru olduğu belirsizleşirdi.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { clearSale, saveSale } from "./actions";
import type { SaleRow } from "./schema";
import {
  CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS, fmtNum, parseNum, type Currency,
} from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TAM_BOY_PENCERE } from "@/components/pencere";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CustomerTag, ScopeTag } from "@/components/tags";
import { fmtJobDate } from "@/lib/jobs/filter";
import { SALE_SCOPES } from "@/lib/tags";

/** "Diğer" — listede olmayan kapsam serbest metin olarak yazılır. */
const SCOPE_OTHER = "__other__";

/** Sayısal alanlar METİN olarak tutulur: kullanıcı "1.575.000,5" yazarken
 *  her tuş vuruşunda sayıya çevrilseydi imleç ve ondalık virgül kaybolurdu. */
function numText(v: number | null): string {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SaleDialog({
  row,
  open,
  onOpenChange,
}: {
  row: SaleRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [scope, setScope] = useState(row.sale.scope);
  /**
   * Kapsam artık açılır listedir ama liste KAPALI DEĞİLDİR: devralınan
   * kayıtlarda ayrıntılı kapsam metinleri var ("Köprü İmalatı. Elektrik,
   * Devreye Alma ve Araba Hariç"). Kayıttaki değer listede yoksa listeye kendi
   * seçeneği olarak eklenir; aksi hâlde ilk kaydetmede sessizce silinirdi.
   */
  const [scopeFree, setScopeFree] = useState(false);
  const scopeOptions = useMemo(() => {
    const current = row.sale.scope.trim();
    return current && !SALE_SCOPES.includes(current) ? [current, ...SALE_SCOPES] : SALE_SCOPES;
  }, [row.sale.scope]);
  /**
   * TERMİN VE SEVK YERİ İŞ EMRİNDEN GELİR (kullanıcı isteği, 18.08.2026).
   * Kaydedilmiş bir değer varsa o kazanır; yoksa iş emrindeki teslim tarihi ve
   * sevk adresi kutuya DÜŞER — aynı bilgiyi ikinci kez yazdırmanın anlamı yok.
   * Değer kaydedilene kadar `job_item_sales`e yazılmaz; listede ve müşteriye
   * giden İş Listesi'nde yalnız kaydedilmiş satır görünür.
   */
  const [dueDate, setDueDate] = useState(row.sale.due_date ?? row.jobDeliveryDate ?? "");
  const dueDateIsEmrinden = !row.sale.due_date && Boolean(row.jobDeliveryDate);
  /**
   * SEVK TARİHİ KENDİLİĞİNDEN DOLMAZ ve bu bilinçlidir. Alan "sevk edildi"
   * demektir: girildiği anda işin bütün kalemleri sevk edilmişse iş durumu
   * kendiliğinden "Tamamlandı" olur (SATIS-16 / `lib/job-status.ts`). İş
   * emrindeki atölye çıkış tarihi ise bir PLANDIR — kutuya sessizce düşseydi
   * fiyat girmek için açılan bir pencere, henüz imalattaki bir işi tamamlanmış
   * gösterirdi. Plan tarihi tek tıkla alınabilen bir ÖNERİ olarak durur.
   */
  const [shipmentDate, setShipmentDate] = useState(row.sale.shipment_date ?? "");
  const [quantity, setQuantity] = useState(numText(row.sale.quantity));
  const [unit, setUnit] = useState(row.sale.unit);
  const [unitWeight, setUnitWeight] = useState(numText(row.sale.unit_weight_kg));
  const [unitPrice, setUnitPrice] = useState(numText(row.sale.unit_price));
  const [currency, setCurrency] = useState<Currency>(row.sale.currency);
  const [fxRate, setFxRate] = useState(numText(row.sale.fx_rate));
  const [shipmentPlace, setShipmentPlace] = useState(
    row.sale.shipment_place || row.jobShippingAddress
  );
  const shipmentPlaceIsEmrinden = !row.sale.shipment_place && Boolean(row.jobShippingAddress);
  const [notes, setNotes] = useState(row.sale.notes);

  // Alanlar yalnız `useState` başlangıç değerinden dolar; senkronize eden bir
  // efekt YOKTUR. Gerek de yoktur: pencere satır seçildiğinde monte edilir
  // (`{editing && <SaleDialog …/>}`), kapanınca sökülür — her açılış zaten
  // taze bir bileşendir.

  /**
   * BOŞ MİKTAR SIFIR DEĞİLDİR.
   *
   * Miktar bir süre `?? 0` ile okunuyordu ve kutunun yer tutucusu "1" yazıyordu:
   * kullanıcı birim fiyatı giriyor, toplam "0 €" kalıyordu (kullanıcı
   * bildirimi, 11.08.2026). Grileşmiş "1" girilmiş bir değer sanılıyordu —
   * yer tutucu kalktı, boş miktar artık toplamı SIFIR yapmıyor `null` yapıyor
   * ve kutu "—" gösteriyor. Sıfır bir cevaptır; burada cevap yoktu.
   */
  const totals = useMemo(() => {
    const q = parseNum(quantity);
    const w = parseNum(unitWeight);
    const p = parseNum(unitPrice);
    const fx = currency === "EUR" ? 1 : parseNum(fxRate);
    const total = q !== null && p !== null ? q * p : null;
    return {
      weight: q !== null && w !== null ? q * w : null,
      total,
      eur: total !== null && fx !== null && fx > 0 ? total / fx : null,
    };
  }, [quantity, unitWeight, unitPrice, fxRate, currency]);

  /**
   * KUR EKSİKKEN KAYIT YAPILMAZ (kullanıcı kararı, 11.08.2026).
   *
   * Eskiden kuru boş bırakılan satır kaydediliyor, ciroya girmiyor ve sayfanın
   * üstündeki "Kuru Eksik" kartında sayılıyordu. Kart, olmaması gereken bir
   * durumun sayacıydı; doğrusu o durumu hiç doğurmamaktır. Kart kalktı, kural
   * buraya taşındı — fiyat girilmişse kur da girilmiş olmalıdır.
   *
   * Kontrol yalnız FİYAT GİRİLMİŞSE çalışır: kapsam ya da termin tarihi yazıp
   * fiyatı sonraya bırakmak meşru bir kullanımdır ve engellenmemelidir.
   */
  function handleSave() {
    const q = parseNum(quantity);
    const p = parseNum(unitPrice);
    const fx = currency === "EUR" ? 1 : parseNum(fxRate);
    if (p !== null && q === null) {
      toast.error("Miktar girilmeden birim fiyat kaydedilemez.");
      return;
    }
    if (p !== null && (fx === null || fx <= 0)) {
      toast.error(
        `Kur girilmeden ${CURRENCY_LABELS[currency]} fiyatı kaydedilemez — ciro avroda toplanır.`
      );
      return;
    }
    startTransition(async () => {
      const res = await saveSale(row.itemId, {
        scope: scope.trim(),
        due_date: dueDate,
        shipment_date: shipmentDate,
        quantity: parseNum(quantity),
        unit: unit.trim() || "Adet",
        unit_weight_kg: parseNum(unitWeight),
        unit_price: parseNum(unitPrice),
        currency,
        fx_rate: currency === "EUR" ? 1 : parseNum(fxRate),
        shipment_place: shipmentPlace.trim(),
        notes: notes.trim(),
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${row.itemNo} satış bilgisi kaydedildi.`);
      // OTOMATİK DURUM DEĞİŞİKLİĞİ AYRI BİR BİLDİRİMDİR. Başka bir sayfadaki
      // bir kaydın sessizce değişmesi, kullanıcının onu bir arıza olarak
      // bildirmesinin en kısa yoludur; üstelik burada geri alınabilir bir
      // karar var (İşler sayfasındaki durum rozeti) ve kullanıcı ancak
      // değişikliği bilirse ona dokunmayı düşünebilir.
      if (res?.jobCompleted !== undefined) {
        toast.info(
          `${res.jobCompleted || row.jobNo} işinin bütün kalemleri sevk edildi — durum "Tamamlandı" yapıldı.`,
          { description: "İşler sayfasından değiştirebilirsiniz." }
        );
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  function handleClear() {
    if (!window.confirm(`${row.itemNo} kaleminin tüm satış bilgisi silinecek. Devam edilsin mi?`)) {
      return;
    }
    startTransition(async () => {
      const res = await clearSale(row.itemId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Satış bilgisi temizlendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Yükseklik sınırı ve iç kaydırma artık `DialogContent` tabanındadır.
          `sm:max-w-3xl` 768px tablette pencereyi ekranın tamamı yapıyordu;
          genişlik görünür alandan pay bırakacak biçimde kelepçelenir.
          Çok alanlı form telefonda TAM BOYDUR (pencere.ts kararı). */}
      <DialogContent className={`${TAM_BOY_PENCERE} sm:max-w-[min(48rem,calc(100%-2rem))]`}>
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-primary">{row.itemNo}</span> — Satış Bilgisi
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>{row.productName}</span>
            {row.customer && (
              <CustomerTag
                name={row.customer}
                shortName={row.customerShort}
                hue={row.customerHue}
              />
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field
            label="Kapsam"
            hint={
              scopeFree
                ? "Listede olmayan kapsam — kendi rengini metninden alır"
                : "Etiket rengi kapsama özgüdür; listede yoksa \"Diğer\" ile yazabilirsiniz"
            }
          >
            {scopeFree ? (
              <Input
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Kapsamı Yazın"
                autoFocus
              />
            ) : (
              <Select
                // Boş kapsamda hiçbir seçenekle eşleşmez → yer tutucu görünür.
                value={scope.trim()}
                onValueChange={(v) => {
                  if (v === SCOPE_OTHER) {
                    setScopeFree(true);
                    setScope("");
                    return;
                  }
                  setScope(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kapsam Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((sc) => (
                    <SelectItem key={sc} value={sc}>
                      <ScopeTag scope={sc} />
                    </SelectItem>
                  ))}
                  <SelectItem value={SCOPE_OTHER}>Diğer (Elle Yaz)…</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Termin Tarihi"
              hint={dueDateIsEmrinden ? "İş emrindeki teslim tarihi" : undefined}
            >
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Sevk Tarihi">
              <Input type="date" value={shipmentDate} onChange={(e) => setShipmentDate(e.target.value)} />
              {/* Öneri yalnız kutu BOŞKEN ve plan tarihi varken görünür. Tıklama
                  gerekli: bu alan işi "Tamamlandı" yapan alandır (yukarıdaki
                  gerekçe), kendiliğinden dolmamalıdır. */}
              {!shipmentDate && row.jobWorkshopExitDate && (
                <button
                  type="button"
                  onClick={() => setShipmentDate(row.jobWorkshopExitDate!)}
                  className="mt-1 text-[11px] text-primary underline-offset-2 hover:underline"
                >
                  İş emri planı: {fmtJobDate(row.jobWorkshopExitDate)} — uygula
                </button>
              )}
            </Field>
            <Field
              label="Sevk Yeri"
              hint={shipmentPlaceIsEmrinden ? "İş emrindeki sevk adresi" : undefined}
            >
              <Input
                value={shipmentPlace}
                onChange={(e) => setShipmentPlace(e.target.value)}
              />
            </Field>
          </div>

          {/* Dört sütun 640–767px'te ~145px'e iniyor ve uzun etiketler ("Birim
              Ağırlık (kg)") üç satıra kırılıyordu. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Miktar">
              {/* YER TUTUCU YOK — grileşmiş "1" girilmiş bir değer sanılıyordu
                  ve toplam fiyat sessizce 0 kalıyordu (bkz. `totals`). */}
              <Input
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field label="Birim">
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
            <Field label="Birim Ağırlık (kg)">
              <Input
                inputMode="decimal"
                value={unitWeight}
                onChange={(e) => setUnitWeight(e.target.value)}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field label="Toplam Ağırlık (kg)">
              {/* Hesaplanan kutular komşu `Input`larla aynı boyda olmalı (40px),
                  yoksa ızgara satırında hiza kayıyordu. */}
              <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm tabular-nums">
                {totals.weight === null ? (
                  <span className="text-muted-foreground/60">—</span>
                ) : (
                  fmtNum(totals.weight)
                )}
              </div>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Birim Fiyat (KDV hariç)">
              <Input
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field label="Para Birimi">
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_SYMBOLS[c]} {CURRENCY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Kur"
              hint={currency === "EUR" ? "Avro satırında kur 1'dir" : `1 € = ? ${CURRENCY_SYMBOLS[currency]}`}
            >
              <Input
                inputMode="decimal"
                value={currency === "EUR" ? "1" : fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                disabled={currency === "EUR"}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field label="Toplam Fiyat">
              <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm tabular-nums">
                {totals.total === null ? (
                  <span className="text-muted-foreground/60">—</span>
                ) : (
                  <>
                    {fmtNum(totals.total)} {CURRENCY_SYMBOLS[currency]}
                  </>
                )}
              </div>
            </Field>
          </div>

          {/* Avro karşılığı ayrı ve vurgulu: firmanın ciroyu topladığı büyüklük */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
            {/* AÇIKLAMA KALDIRILDI (kullanıcı kararı, 11.08.2026): kutunun
                başlığı zaten "Avro Karşılığı" ve firma ciroyu avroda topluyor —
                cümle her açılışta aynı şeyi ikinci kez söylüyordu. */}
            <div className="min-w-0">
              <div className="oc-kicker text-muted-foreground">Avro Karşılığı</div>
            </div>
            <div className="font-mono text-xl font-semibold tabular-nums">
              {totals.eur === null ? (
                <span className="text-sm font-normal text-muted-foreground/60">—</span>
              ) : (
                `${fmtNum(totals.eur)} €`
              )}
            </div>
          </div>

          <Field label="Açıklama">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {row.hasSale && (
              <Button type="button" variant="ghost" onClick={handleClear} disabled={pending}>
                <Trash2 className="size-3.5" /> Temizle
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={handleSave} disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

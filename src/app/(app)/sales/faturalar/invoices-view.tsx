"use client";

// SATIŞ FATURALARI — grafik + manuel giriş + liste (kullanıcı kararı, 14.08.2026).
//
// Müşteri DROPDOWN'dır (customers defteri); listede yoksa "+ Yeni müşteri" ile
// açılır ve Yönetim → Müşteriler'e girer. İŞ NO da İşler'den dropdown gelir.
// KUR OTOMATİK ÖNERİLİR (en son TCMB yayını) ama kilit değildir. Fatura
// YERİNDE DÜZENLENİR (kalem satırındaki kalem düğmesi). Ciro yalnız AVRO
// karşılığından toplanır; kuru olmayan satır toplama girmez (SATIS-16).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Combobox, type ComboOption } from "@/components/combobox";
import { CustomerTag } from "@/components/tags";
import { TAM_BOY_PENCERE } from "@/components/pencere";
import {
  CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS, currencyOf, fmtNum, parseNum, type Currency,
} from "@/lib/currency";
import type { InvoiceCustomerOption, LatestFx, SalesInvoiceRow } from "./data";
import {
  createInvoiceCustomer, createSalesInvoice, deleteSalesInvoice, editSalesInvoice,
} from "./actions";
import { InvoiceChart } from "./invoice-chart";

function isoToday(): string {
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Para birimine göre önerilen kur (1 avro kaç birim eder). */
function fxOner(cur: Currency, fx: LatestFx | null): string {
  if (cur === "EUR") return "1";
  if (!fx) return "";
  if (cur === "TRY") return String(Number(fx.eurTry.toFixed(4)));
  if (cur === "USD" && fx.usdTry > 0) return String(Number((fx.eurTry / fx.usdTry).toFixed(4)));
  return "";
}

interface FormState {
  itemNo: string;
  invoiceDate: string;
  invoiceNo: string;
  customerId: string | null;
  currency: Currency;
  fxRate: string;
  qty: string;
  unitPrice: string;
  note: string;
}

function bosForm(fx: LatestFx | null): FormState {
  return {
    itemNo: "", invoiceDate: isoToday(), invoiceNo: "", customerId: null,
    currency: "TRY", fxRate: fxOner("TRY", fx), qty: "1", unitPrice: "", note: "",
  };
}

/** Ortak alan ızgarası — hem giriş hem düzenleme aynı bileşeni kullanır. */
function InvoiceFields({
  form, set, customerOptions, isSecenekleri, fx, onYeniMusteri, firmaYaziliyor,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  customerOptions: ComboOption[];
  isSecenekleri: { value: string; label: string }[];
  fx: LatestFx | null;
  onYeniMusteri: (name: string) => void;
  firmaYaziliyor: boolean;
}) {
  const kurLazim = form.currency !== "EUR";
  function paraBirimiSec(v: string) {
    const yeni = currencyOf(v);
    set({ currency: yeni, fxRate: fxOner(yeni, fx) });
  }
  return (
    <div className="grid gap-3">
      <div className="grid items-start gap-3 lg:grid-cols-[8rem_minmax(14rem,1fr)_10rem_1fr]">
        <div className="grid content-start gap-1.5">
          <Label>Fatura Tarihi</Label>
          <Input type="date" value={form.invoiceDate} onChange={(e) => set({ invoiceDate: e.target.value })}
            className="text-base pointer-fine:text-sm" />
        </div>
        <div className="grid content-start gap-1.5">
          <Label>Müşteri</Label>
          <span className="relative flex items-center">
            <Combobox
              options={customerOptions}
              value={form.customerId}
              onChange={(v) => set({ customerId: v })}
              onCreate={onYeniMusteri}
              createLabel="Yeni müşteri"
              placeholder="Müşteri seçin veya yazın"
              searchPlaceholder="Müşteri ara…"
              className="text-base pointer-fine:text-sm"
            />
            {firmaYaziliyor && (
              <Loader2 className="pointer-events-none absolute right-7 size-4 animate-spin text-muted-foreground" />
            )}
          </span>
        </div>
        <div className="grid content-start gap-1.5">
          <Label>İş No (İsteğe Bağlı)</Label>
          <Combobox
            options={isSecenekleri}
            value={form.itemNo || null}
            onChange={(v) => set({ itemNo: v })}
            onCreate={(name) => set({ itemNo: name.trim() })}
            createLabel="Elle iş no"
            placeholder="Seçin veya boş bırakın"
            searchPlaceholder="İş / kalem no ara…"
            className="text-base pointer-fine:text-sm"
            contentClassName="w-[min(30rem,calc(100vw-1.5rem))]"
          />
        </div>
        <div className="grid content-start gap-1.5">
          <Label>Fatura No</Label>
          <Input value={form.invoiceNo} onChange={(e) => set({ invoiceNo: e.target.value })} maxLength={100}
            placeholder="GIB…" className="text-base pointer-fine:text-sm" />
        </div>
      </div>

      <div className="grid items-start gap-3 border bg-muted/30 p-3 sm:grid-cols-[7rem_10rem_9rem_9rem_1fr]">
        <div className="grid content-start gap-1.5">
          <Label>Adet</Label>
          <Input value={form.qty} onChange={(e) => set({ qty: e.target.value })} inputMode="decimal"
            className="text-right font-mono text-base tabular-nums pointer-fine:text-sm" />
        </div>
        <div className="grid content-start gap-1.5">
          <Label>Birim Fiyat</Label>
          <Input value={form.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} inputMode="decimal"
            className="text-right font-mono text-base tabular-nums pointer-fine:text-sm" />
        </div>
        <div className="grid content-start gap-1.5">
          <Label>Para Birimi</Label>
          <Select value={form.currency} onValueChange={paraBirimiSec}>
            <SelectTrigger className="w-full text-base pointer-fine:text-sm">
              <SelectValue>{form.currency}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c} · {CURRENCY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid content-start gap-1.5">
          <Label>1 € = ?</Label>
          <Input value={kurLazim ? form.fxRate : "1"} onChange={(e) => set({ fxRate: e.target.value })}
            disabled={!kurLazim} inputMode="decimal"
            className="text-right font-mono text-base tabular-nums pointer-fine:text-sm" />
          {fx && kurLazim && (
            <span className="text-[10px] text-muted-foreground">{fx.rateDate} tarihli yayın</span>
          )}
        </div>
        <div className="grid content-start gap-1.5">
          <Label>Not</Label>
          <Input value={form.note} onChange={(e) => set({ note: e.target.value })} maxLength={500}
            className="text-base pointer-fine:text-sm" />
        </div>
      </div>
    </div>
  );
}

export function InvoicesView({
  invoices,
  customers,
  isSecenekleri = [],
  fx,
}: {
  invoices: SalesInvoiceRow[];
  customers: InvoiceCustomerOption[];
  isSecenekleri?: { value: string; label: string }[];
  fx: LatestFx | null;
}) {
  const router = useRouter();
  const [pending, basla] = useTransition();
  const [musteriler, setMusteriler] = useState(customers);
  const [firmaYaziliyor, setFirmaYaziliyor] = useState(false);
  const [form, setForm] = useState<FormState>(() => bosForm(fx));
  const [duzenlenen, setDuzenlenen] = useState<SalesInvoiceRow | null>(null);

  const customerOptions: ComboOption[] = useMemo(
    () => musteriler.map((c) => ({ value: c.id, label: c.name, badge: c.short ?? undefined, hue: c.hue ?? undefined })),
    [musteriler]
  );
  const musteriAdi = (id: string | null) => musteriler.find((c) => c.id === id)?.name ?? "";

  const kurLazim = form.currency !== "EUR";
  const kurSayi = parseNum(form.fxRate);
  const adet = parseNum(form.qty);
  const birim = parseNum(form.unitPrice);
  const tutar = (adet ?? 0) * (birim ?? 0);
  const tutarEur = form.currency === "EUR" ? tutar : kurSayi && kurSayi > 0 ? tutar / kurSayi : null;
  const toplamEur = useMemo(() => invoices.reduce((t, r) => t + (r.amountEur ?? 0), 0), [invoices]);

  function set(patch: Partial<FormState>) {
    setForm((o) => ({ ...o, ...patch }));
  }

  function yeniMusteri(name: string, sonra?: (id: string) => void) {
    const temiz = name.trim();
    if (!temiz) return;
    setFirmaYaziliyor(true);
    createInvoiceCustomer({ name: temiz })
      .then((sonuc) => {
        if (sonuc.error || !sonuc.customer) {
          toast.error(sonuc.error ?? "Müşteri oluşturulamadı.");
          return;
        }
        const c: InvoiceCustomerOption = {
          id: sonuc.customer.id, name: sonuc.customer.name,
          short: sonuc.customer.short, hue: sonuc.customer.hue,
        };
        setMusteriler((o) => [c, ...o.filter((x) => x.id !== c.id)].sort((a, b) => a.name.localeCompare(b.name, "tr")));
        (sonra ?? ((id) => set({ customerId: id })))(c.id);
        toast.success(`${c.name} müşteri defterine eklendi.`);
      })
      .finally(() => setFirmaYaziliyor(false));
  }

  function kaydet() {
    if (!form.customerId) return toast.error("Müşteri seçin.");
    if (adet == null || adet <= 0 || birim == null) return toast.error("Adet ve birim fiyat gerekli.");
    if (kurLazim && (kurSayi == null || kurSayi <= 0)) return toast.error("Avro dışı faturada kur gerekli.");
    basla(async () => {
      const sonuc = await createSalesInvoice({
        itemNo: form.itemNo, invoiceDate: form.invoiceDate, invoiceNo: form.invoiceNo,
        customerId: form.customerId, customer: musteriAdi(form.customerId),
        qty: adet, unitPrice: birim, currency: form.currency,
        fxRate: kurLazim ? kurSayi : 1, note: form.note,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Fatura kaydedildi.");
      set({ invoiceNo: "", itemNo: "", unitPrice: "", note: "" });
      router.refresh();
    });
  }

  function sil(id: string) {
    basla(async () => {
      const sonuc = await deleteSalesInvoice(id);
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Fatura silindi.");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      {/* ————————————————————————— giriş formu */}
      <div className="grid gap-3 border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Fatura Gir</h2>
            <p className="text-sm text-muted-foreground">
              Kesilen faturayı kaydedin; ciro avro karşılığıyla toplanır.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-semibold tabular-nums">
              {tutarEur == null ? "—" : `${fmtNum(tutarEur)} €`}
            </div>
            <div className="text-[11px] text-muted-foreground">Bu faturanın Avro karşılığı</div>
          </div>
        </div>

        <InvoiceFields
          form={form}
          set={set}
          customerOptions={customerOptions}
          isSecenekleri={isSecenekleri}
          fx={fx}
          onYeniMusteri={(name) => yeniMusteri(name)}
          firmaYaziliyor={firmaYaziliyor}
        />

        <div className="flex justify-end">
          <Button type="button" onClick={kaydet} disabled={pending} className="min-w-40">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Faturayı Kaydet
          </Button>
        </div>
      </div>

      {/* ————————————————————————— grafik */}
      {invoices.length > 0 && <InvoiceChart invoices={invoices} />}

      {/* ————————————————————————— liste */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{fmtNum(invoices.length)} fatura</h2>
        <span className="font-mono text-sm font-semibold tabular-nums">
          Toplam ciro {fmtNum(toplamEur)} €
        </span>
      </div>

      {/* TELEFONDA TABLO LİSTEYE KATLANIR (kabuk kuralı 15): `sm` altında
          yalnız Müşteri · Avro · düğmeler kalır; tarih, fatura/iş no ve orijinal
          tutar Müşteri hücresinin alt satırına iner — kart markup'ı ÇOĞALTILMAZ.
          Fatura defteri BÜYÜR: kap `md` üstünde 70dvh'ye kelepçelenir, başlık
          yapışır (`oc-table-clamp` + `oc-sticky-head`). */}
      <div className="oc-scrollx oc-table-clamp overflow-x-auto rounded-lg border bg-card [--oc-scroll-bg:var(--card)]">
        <Table>
          <TableHeader className="oc-sticky-head">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="hidden w-[6.5rem] sm:table-cell">Tarih</TableHead>
              <TableHead className="hidden w-[9rem] md:table-cell">Fatura No</TableHead>
              <TableHead className="hidden w-[6rem] md:table-cell">İş No</TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead className="hidden w-[5rem] text-right lg:table-cell">Adet</TableHead>
              <TableHead className="hidden w-[9rem] text-right sm:table-cell">Tutar</TableHead>
              <TableHead className="w-[9rem] text-right">Avro</TableHead>
              <TableHead className="w-[5.5rem]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Henüz fatura yok. Yukarıdan girin.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="hidden font-mono text-xs tabular-nums whitespace-nowrap sm:table-cell">
                    {fmtDate(r.invoiceDate)}
                  </TableCell>
                  {/* `break-words`: fatura no serbest metindir ("GIB…" uzun tek
                      jeton olabilir) ve dar sütunu taşırmamalı. */}
                  <TableCell className="hidden max-w-[9rem] font-mono text-xs break-words whitespace-normal md:table-cell">
                    {r.invoiceNo || "—"}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{r.itemNo || "—"}</TableCell>
                  <TableCell className="break-words whitespace-normal">
                    <CustomerTag name={r.customer || "—"} shortName={null} />
                    {/* Telefon katmanı: gizlenen sütunların kritik olanları.
                        Orijinal tutar yalnız avro dışıysa yazılır — avro
                        sütunu zaten görünür, aynı sayıyı iki kez basmayalım. */}
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground md:hidden">
                      <span className="sm:hidden">{fmtDate(r.invoiceDate)} · </span>
                      {r.invoiceNo || "—"}
                      {r.itemNo && ` · ${r.itemNo}`}
                      {r.amount != null && r.currency !== "EUR" && (
                        <span className="sm:hidden">
                          {" · "}
                          {fmtNum(r.amount)} {CURRENCY_SYMBOLS[r.currency]}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground lg:table-cell">
                    {r.qty == null ? "—" : fmtNum(r.qty)}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-sm tabular-nums sm:table-cell">
                    {r.amount == null ? "—" : (
                      <>{fmtNum(r.amount)}{" "}<span className="text-muted-foreground">{CURRENCY_SYMBOLS[r.currency]}</span></>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                    {r.amountEur == null ? <span className="text-destructive">Kur Yok</span> : `${fmtNum(r.amountEur)} €`}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => setDuzenlenen(r)}
                        aria-label="Faturayı düzenle" title="Düzenle" disabled={pending}>
                        <Pencil />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => sil(r.id)} aria-label="Faturayı sil" disabled={pending}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {duzenlenen && (
        <InvoiceEditDialog
          key={duzenlenen.id}
          row={duzenlenen}
          customerOptions={customerOptions}
          isSecenekleri={isSecenekleri}
          fx={fx}
          onYeniMusteri={yeniMusteri}
          firmaYaziliyor={firmaYaziliyor}
          onClose={() => setDuzenlenen(null)}
          onSaved={() => {
            setDuzenlenen(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function InvoiceEditDialog({
  row, customerOptions, isSecenekleri, fx, onYeniMusteri, firmaYaziliyor, onClose, onSaved,
}: {
  row: SalesInvoiceRow;
  customerOptions: ComboOption[];
  isSecenekleri: { value: string; label: string }[];
  fx: LatestFx | null;
  onYeniMusteri: (name: string, sonra?: (id: string) => void) => void;
  firmaYaziliyor: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [form, setForm] = useState<FormState>({
    itemNo: row.itemNo,
    invoiceDate: row.invoiceDate ?? isoToday(),
    invoiceNo: row.invoiceNo,
    customerId: row.customerId,
    currency: row.currency,
    fxRate: row.fxRate == null ? "" : String(row.fxRate),
    qty: row.qty == null ? "" : String(row.qty),
    unitPrice: row.unitPrice == null ? "" : String(row.unitPrice),
    note: row.note,
  });
  function set(patch: Partial<FormState>) {
    setForm((o) => ({ ...o, ...patch }));
  }
  const kurLazim = form.currency !== "EUR";
  const kurSayi = parseNum(form.fxRate);
  const adet = parseNum(form.qty);
  const birim = parseNum(form.unitPrice);
  // Müşteri seçilmemiş olamaz: dropdown'da yoksa satırdaki ad snapshot'ı kalır.
  const musteriAd =
    customerOptions.find((c) => c.value === form.customerId)?.label ?? row.customer;

  function kaydet() {
    if (adet == null || adet <= 0 || birim == null) return toast.error("Adet ve birim fiyat gerekli.");
    if (kurLazim && (kurSayi == null || kurSayi <= 0)) return toast.error("Avro dışı faturada kur gerekli.");
    if (!musteriAd) return toast.error("Müşteri seçin.");
    basla(async () => {
      const sonuc = await editSalesInvoice({
        id: row.id, itemNo: form.itemNo, invoiceDate: form.invoiceDate, invoiceNo: form.invoiceNo,
        customerId: form.customerId, customer: musteriAd,
        qty: adet, unitPrice: birim, currency: form.currency,
        fxRate: kurLazim ? kurSayi : 1, note: form.note,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Fatura güncellendi.");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* Çok alanlı inceleme penceresi telefonda TAM BOYDUR (pencere.ts kararı). */}
      <DialogContent className={`${TAM_BOY_PENCERE} sm:max-w-[min(56rem,calc(100%-2rem))]`}>
        <DialogHeader>
          <DialogTitle className="text-base">Faturayı Düzenle</DialogTitle>
          <DialogDescription className="text-[12px]">
            {row.invoiceNo || "Fatura"} · {row.customer}
          </DialogDescription>
        </DialogHeader>
        <InvoiceFields
          form={form}
          set={set}
          customerOptions={customerOptions}
          isSecenekleri={isSecenekleri}
          fx={fx}
          onYeniMusteri={(name) => onYeniMusteri(name, (id) => set({ customerId: id }))}
          firmaYaziliyor={firmaYaziliyor}
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>Vazgeç</Button>
          <Button type="button" onClick={kaydet} disabled={calisiyor}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

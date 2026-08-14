"use client";

// SATIŞ FATURALARI — manuel giriş + liste (kullanıcı kararı, 14.08.2026).
//
// Müşteri DROPDOWN'dır (customers defteri); listede yoksa "+ Yeni müşteri" ile
// açılır ve Yönetim → Müşteriler'e girer. KUR OTOMATİK ÖNERİLİR (en son TCMB
// yayını) ama kilit değildir — kullanıcı düzeltebilir. Ciro yalnız AVRO
// karşılığından toplanır; kuru olmayan satır toplama girmez (md. 16 sözleşmesi).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Combobox, type ComboOption } from "@/components/combobox";
import { CustomerTag } from "@/components/tags";
import {
  CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS, currencyOf, fmtNum, parseNum, type Currency,
} from "@/lib/currency";
import type { InvoiceCustomerOption, LatestFx, SalesInvoiceRow } from "./data";
import { createInvoiceCustomer, createSalesInvoice, deleteSalesInvoice } from "./actions";

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

export function InvoicesView({
  invoices,
  customers,
  fx,
}: {
  invoices: SalesInvoiceRow[];
  customers: InvoiceCustomerOption[];
  fx: LatestFx | null;
}) {
  const router = useRouter();
  const [pending, basla] = useTransition();
  const [musteriler, setMusteriler] = useState(customers);

  const [itemNo, setItemNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(isoToday);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [fxRate, setFxRate] = useState(() => fxOner("TRY", fx));
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");

  const customerOptions: ComboOption[] = useMemo(
    () => musteriler.map((c) => ({ value: c.id, label: c.name, badge: c.short ?? undefined, hue: c.hue ?? undefined })),
    [musteriler]
  );
  const seciliMusteri = musteriler.find((c) => c.id === customerId) ?? null;

  const kurLazim = currency !== "EUR";
  const kurSayi = parseNum(fxRate);
  const adet = parseNum(qty);
  const birim = parseNum(unitPrice);
  const tutar = (adet ?? 0) * (birim ?? 0);
  const tutarEur = currency === "EUR" ? tutar : kurSayi && kurSayi > 0 ? tutar / kurSayi : null;

  const toplamEur = useMemo(
    () => invoices.reduce((t, r) => t + (r.amountEur ?? 0), 0),
    [invoices]
  );

  function paraBirimiSec(v: string) {
    const yeni = currencyOf(v);
    setCurrency(yeni);
    setFxRate(fxOner(yeni, fx));
  }

  function yeniMusteri(name: string) {
    const temiz = name.trim();
    if (!temiz) return;
    basla(async () => {
      const sonuc = await createInvoiceCustomer({ name: temiz });
      if (sonuc.error || !sonuc.customer) {
        toast.error(sonuc.error ?? "Müşteri oluşturulamadı.");
        return;
      }
      const c: InvoiceCustomerOption = {
        id: sonuc.customer.id,
        name: sonuc.customer.name,
        short: sonuc.customer.short,
        hue: sonuc.customer.hue,
      };
      setMusteriler((o) => [c, ...o.filter((x) => x.id !== c.id)].sort((a, b) => a.name.localeCompare(b.name, "tr")));
      setCustomerId(c.id);
      toast.success(`${c.name} müşteri defterine eklendi.`);
    });
  }

  function kaydet() {
    if (!seciliMusteri) {
      toast.error("Müşteri seçin.");
      return;
    }
    if (adet == null || adet <= 0 || birim == null) {
      toast.error("Adet ve birim fiyat gerekli.");
      return;
    }
    if (kurLazim && (kurSayi == null || kurSayi <= 0)) {
      toast.error("Avro dışı faturada kur gerekli.");
      return;
    }
    basla(async () => {
      const sonuc = await createSalesInvoice({
        itemNo,
        invoiceDate,
        invoiceNo,
        customerId: seciliMusteri.id,
        customer: seciliMusteri.name,
        qty: adet,
        unitPrice: birim,
        currency,
        fxRate: kurLazim ? kurSayi : 1,
        note,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Fatura kaydedildi.");
      setInvoiceNo("");
      setItemNo("");
      setUnitPrice("");
      setNote("");
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

        <div className="grid gap-3 lg:grid-cols-[8rem_minmax(14rem,1fr)_10rem_1fr]">
          <div className="grid gap-1.5">
            <Label htmlFor="fi-tarih">Fatura Tarihi</Label>
            <Input id="fi-tarih" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
              className="text-base pointer-fine:text-sm" />
          </div>
          <div className="grid gap-1.5">
            <Label>Müşteri</Label>
            <Combobox
              options={customerOptions}
              value={customerId}
              onChange={setCustomerId}
              onCreate={yeniMusteri}
              createLabel="Yeni müşteri"
              placeholder="Müşteri seçin veya yazın"
              searchPlaceholder="Müşteri ara…"
              className="text-base pointer-fine:text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fi-is">İş No (İsteğe Bağlı)</Label>
            <Input id="fi-is" value={itemNo} onChange={(e) => setItemNo(e.target.value)} maxLength={40}
              className="font-mono text-base pointer-fine:text-sm" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fi-no">Fatura No</Label>
            <Input id="fi-no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} maxLength={100}
              placeholder="GIB…" className="text-base pointer-fine:text-sm" />
          </div>
        </div>

        <div className="grid gap-3 border bg-muted/30 p-3 sm:grid-cols-[7rem_10rem_9rem_9rem_1fr]">
          <div className="grid gap-1.5">
            <Label htmlFor="fi-adet">Adet</Label>
            <Input id="fi-adet" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal"
              className="text-right font-mono text-base tabular-nums pointer-fine:text-sm" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fi-birim">Birim Fiyat</Label>
            <Input id="fi-birim" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal"
              className="text-right font-mono text-base tabular-nums pointer-fine:text-sm" />
          </div>
          <div className="grid gap-1.5">
            <Label>Para Birimi</Label>
            <Select value={currency} onValueChange={paraBirimiSec}>
              <SelectTrigger className="w-full text-base pointer-fine:text-sm">
                <SelectValue>{currency}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c} · {CURRENCY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fi-kur">1 € = ?</Label>
            <Input id="fi-kur" value={kurLazim ? fxRate : "1"} onChange={(e) => setFxRate(e.target.value)}
              disabled={!kurLazim} inputMode="decimal"
              className="text-right font-mono text-base tabular-nums pointer-fine:text-sm" />
            {fx && kurLazim && (
              <span className="text-[10px] text-muted-foreground">{fx.rateDate} tarihli yayın</span>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fi-not">Not</Label>
            <Input id="fi-not" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
              className="text-base pointer-fine:text-sm" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={kaydet} disabled={pending} className="min-w-40">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Faturayı Kaydet
          </Button>
        </div>
      </div>

      {/* ————————————————————————— liste */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">
          {fmtNum(invoices.length)} fatura
        </h2>
        <span className="font-mono text-sm font-semibold tabular-nums">
          Toplam ciro {fmtNum(toplamEur)} €
        </span>
      </div>

      <div className="oc-scrollx overflow-x-auto rounded-lg border bg-card [--oc-scroll-bg:var(--card)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[6.5rem]">Tarih</TableHead>
              <TableHead className="w-[9rem]">Fatura No</TableHead>
              <TableHead className="w-[6rem]">İş No</TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead className="w-[5rem] text-right">Adet</TableHead>
              <TableHead className="w-[9rem] text-right">Tutar</TableHead>
              <TableHead className="w-[9rem] text-right">Avro</TableHead>
              <TableHead className="w-[3rem]" />
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
                  <TableCell className="font-mono text-xs tabular-nums whitespace-nowrap">
                    {fmtDate(r.invoiceDate)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.invoiceNo || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.itemNo || "—"}</TableCell>
                  <TableCell className="whitespace-normal">
                    <CustomerTag name={r.customer || "—"} shortName={null} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {r.qty == null ? "—" : fmtNum(r.qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {r.amount == null ? "—" : (
                      <>{fmtNum(r.amount)}{" "}<span className="text-muted-foreground">{CURRENCY_SYMBOLS[r.currency]}</span></>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                    {r.amountEur == null ? <span className="text-destructive">Kur Yok</span> : `${fmtNum(r.amountEur)} €`}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => sil(r.id)}
                      aria-label="Faturayı sil"
                      disabled={pending}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

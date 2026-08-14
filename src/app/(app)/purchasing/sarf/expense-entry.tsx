"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox, type ComboOption } from "@/components/combobox";
import { adBuyuk } from "@/lib/tr-text";
import { CONSUMABLE_UNITS } from "@/lib/purchasing/units";
import { CURRENCIES, CURRENCY_LABELS, fmtMoney, parseNum, type Currency } from "@/lib/currency";
import {
  DELIVERY_WEEKS,
  gunEkle,
  odemeGunu,
  PAYMENT_TERMS,
  tarihGoster,
  type PaymentMethod,
} from "@/lib/purchasing/terms";
import {
  DEFAULT_VAT_RATE,
  VAT_RATES,
  vatTotals,
  type VatRate,
} from "@/lib/purchasing/vat";
import { ensureSupplier } from "../actions";
import {
  createConsumableExpenses,
  ensureConsumableItem,
  getConsumableExpenseRate,
} from "./actions";
import type { ConsumableItemOption, ConsumableSupplierOption } from "./data";

interface EntryLine {
  key: number;
  itemId: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: VatRate;
  note: string;
}

function blankLine(key: number): EntryLine {
  return {
    key,
    itemId: null,
    quantity: "1",
    unit: "ADET",
    unitPrice: "",
    vatRate: DEFAULT_VAT_RATE,
    note: "",
  };
}

function isoToday(): string {
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function ExpenseEntry({
  initialItems,
  initialSuppliers,
  groups,
  initialDepartments,
}: {
  initialItems: ConsumableItemOption[];
  initialSuppliers: ConsumableSupplierOption[];
  groups: string[];
  initialDepartments: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [departments, setDepartments] = useState(initialDepartments);
  const [expenseDate, setExpenseDate] = useState(isoToday);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [documentNo, setDocumentNo] = useState("");
  const [department, setDepartment] = useState("");
  const [deliveryPreset, setDeliveryPreset] = useState("0");
  const [dueAt, setDueAt] = useState(isoToday);
  const [paymentTerm, setPaymentTerm] = useState("pesin");
  const [customPaymentDays, setCustomPaymentDays] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [fxRate, setFxRate] = useState("");
  const [fxRateDate, setFxRateDate] = useState<string | null>(null);
  const [fxSource, setFxSource] = useState<"daily" | "manual">("daily");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<EntryLine[]>([blankLine(1)]);
  const nextLine = useRef(2);
  const rateRequest = useRef(0);

  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemGroup, setNewItemGroup] = useState(groups[0] ?? "Atölye");
  const [newItemUnit, setNewItemUnit] = useState("Adet");
  const [newItemTarget, setNewItemTarget] = useState<number | null>(null);

  const activeItems = useMemo(() => items.filter((item) => item.active), [items]);
  const itemOptions: ComboOption[] = useMemo(
    () =>
      activeItems.map((item) => ({
        value: item.id,
        label: item.name,
        hint: `${item.groupName} · ${item.defaultUnit}`,
        badge: item.code,
        keywords: [item.groupName, item.defaultUnit],
      })),
    [activeItems]
  );
  const supplierOptions: ComboOption[] = useMemo(
    () =>
      suppliers
        .filter((supplier) => supplier.active)
        .map((supplier) => ({
          value: supplier.id,
          label: supplier.name,
          badge: supplier.code,
          keywords: [supplier.code],
        })),
    [suppliers]
  );
  // BÖLÜM ADLARI BÜYÜK HARF (kullanıcı kararı, 14.08.2026). Büyük harfe
  // katlanmış ada göre tekilleştirilir: "Ofis" ile "OFİS" tek seçenek olur.
  const departmentOptions: ComboOption[] = useMemo(() => {
    const harita = new Map<string, ComboOption>();
    for (const name of departments) {
      const buyuk = adBuyuk(name);
      if (buyuk) harita.set(buyuk, { value: buyuk, label: buyuk });
    }
    return [...harita.values()].sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [departments]);

  useEffect(() => {
    const request = ++rateRequest.current;
    if (currency === "EUR") return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return;
    getConsumableExpenseRate({ expenseDate, currency }).then((result) => {
      if (request !== rateRequest.current || result.error || result.rate == null) return;
      setFxRate(String(Number(result.rate.toFixed(4))));
      setFxRateDate(result.rateDate ?? null);
      setFxSource("daily");
    });
  }, [currency, expenseDate]);

  const nativeTotals = vatTotals(
    lines.map((line) => ({
      net: (parseNum(line.quantity) ?? 0) * (parseNum(line.unitPrice) ?? 0),
      vatRate: line.vatRate,
    }))
  );
  const parsedRate = currency === "EUR" ? 1 : (parseNum(fxRate) ?? 0);
  const eurNet = parsedRate > 0 ? nativeTotals.net / parsedRate : 0;
  const eurVat = parsedRate > 0 ? nativeTotals.vat / parsedRate : 0;
  const eurGross = parsedRate > 0 ? nativeTotals.gross / parsedRate : 0;
  const paymentOption = PAYMENT_TERMS.find((option) => option.value === paymentTerm);
  const paymentMethod: PaymentMethod = paymentTerm === "custom" ? "vadeli" : (paymentOption?.method ?? "pesin");
  const paymentTermDays = paymentTerm === "custom"
    ? Math.max(0, Math.round(parseNum(customPaymentDays) ?? 0))
    : (paymentOption?.days ?? 0);
  const paymentDueAt = odemeGunu({ dueAt, receivedAt: null, paymentTermDays });

  function patchLine(key: number, patch: Partial<EntryLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function createSupplierFromQuery(name: string) {
    const result = await ensureSupplier({ name });
    if (result.error || !result.id || !result.name) {
      toast.error(result.error ?? "Tedarikçi oluşturulamadı.");
      return;
    }
    const next: ConsumableSupplierOption = {
      id: result.id,
      name: result.name,
      code: result.code ?? "",
      active: true,
    };
    setSuppliers((current) => [next, ...current.filter((item) => item.id !== next.id)]);
    setSupplierId(next.id);
    toast.success(result.ok ? `${next.code} tedarikçi defterine eklendi.` : "Tedarikçi seçildi.");
  }

  function openNewItem(lineKey: number, name: string) {
    setNewItemTarget(lineKey);
    setNewItemName(name);
    setNewItemGroup(groups[0] ?? "Atölye");
    setNewItemUnit("Adet");
    setNewItemOpen(true);
  }

  function saveNewItem() {
    startTransition(async () => {
      const result = await ensureConsumableItem({
        name: newItemName,
        groupName: newItemGroup,
        defaultUnit: newItemUnit,
      });
      if (result.error || !result.id || !result.name) {
        toast.error(result.error ?? "Malzeme oluşturulamadı.");
        return;
      }
      const item: ConsumableItemOption = {
        id: result.id,
        code: result.code ?? "",
        name: result.name,
        groupName: result.groupName ?? newItemGroup,
        defaultUnit: result.defaultUnit ?? newItemUnit,
        active: true,
      };
      setItems((current) => [item, ...current.filter((row) => row.id !== item.id)]);
      if (newItemTarget != null) {
        patchLine(newItemTarget, { itemId: item.id, unit: adBuyuk(item.defaultUnit) });
      }
      setNewItemOpen(false);
      toast.success(result.ok ? `${item.code} sarf malzemesi eklendi.` : "Malzeme seçildi.");
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rate = currency === "EUR" ? 1 : parseNum(fxRate);
    if (!supplierId) {
      toast.error("Tedarikçi seçin.");
      return;
    }
    if (rate == null || rate <= 0) {
      toast.error("Geçerli bir kur girin.");
      return;
    }
    const parsedLines = lines.map((line) => ({
      itemId: line.itemId,
      quantity: parseNum(line.quantity),
      unit: line.unit,
      unitPrice: parseNum(line.unitPrice),
      note: line.note,
      vatRate: line.vatRate,
    }));
    if (parsedLines.some((line) => !line.itemId || line.quantity == null || line.unitPrice == null)) {
      toast.error("Bütün satırlarda malzeme, miktar ve birim fiyat bulunmalı.");
      return;
    }
    if (!dueAt) {
      toast.error("Termin tarihini seçin.");
      return;
    }
    if (paymentMethod === "vadeli" && paymentTermDays <= 0) {
      toast.error("Özel vade için gün sayısını girin.");
      return;
    }

    startTransition(async () => {
      const result = await createConsumableExpenses({
        expenseDate,
        supplierId,
        documentNo,
        department,
        dueAt,
        paymentMethod,
        paymentTermDays,
        currency,
        fxRate: rate,
        fxRateDate: currency === "EUR" ? null : fxRateDate,
        fxSource,
        note,
        lines: parsedLines.map((line) => ({
          itemId: line.itemId!,
          quantity: line.quantity!,
          unit: line.unit,
          unitPrice: line.unitPrice!,
          note: line.note,
          vatRate: line.vatRate,
        })),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.ok ?? lines.length} sarf gideri kaydedildi.`);
      setDocumentNo("");
      setNote("");
      setLines([blankLine(nextLine.current++)]);
      router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={submit} className="grid gap-4 border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Sarf Gideri Gir</h2>
            <p className="text-sm text-muted-foreground">
              Ortak bilgileri bir kez seçin; aynı faturadaki malzemeleri satır satır ekleyin.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-semibold tabular-nums">{fmtMoney(eurNet, "EUR")}</div>
            <div className="text-[11px] text-muted-foreground">KDV hariç Avro karşılığı</div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[10rem_minmax(16rem,1fr)_13rem_13rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="sarf-date">Alım Tarihi</Label>
            <Input
              id="sarf-date"
              type="date"
              value={expenseDate}
              onChange={(event) => {
                const next = event.target.value;
                setExpenseDate(next);
                if (deliveryPreset !== "custom" && next) setDueAt(gunEkle(next, Number(deliveryPreset)));
              }}
              required
              className="text-base pointer-fine:text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Tedarikçi</Label>
            <Combobox
              options={supplierOptions}
              value={supplierId}
              onChange={setSupplierId}
              onCreate={createSupplierFromQuery}
              createLabel="Yeni tedarikçi"
              placeholder="Tedarikçi seçin veya yazın"
              searchPlaceholder="Firma adı veya TD kodu…"
              className="h-10 text-base pointer-fine:text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sarf-document">Belge / Fatura No</Label>
            <Input
              id="sarf-document"
              value={documentNo}
              onChange={(event) => setDocumentNo(event.target.value)}
              maxLength={100}
              placeholder="İsteğe bağlı"
              className="text-base pointer-fine:text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Bölüm</Label>
            <Combobox
              options={departmentOptions}
              value={department}
              onChange={setDepartment}
              onCreate={(name) => {
                const next = adBuyuk(name.trim());
                if (!next) return;
                setDepartments((current) =>
                  current.some((value) => adBuyuk(value) === next)
                    ? current
                    : [...current, next].sort((left, right) => left.localeCompare(right, "tr"))
                );
                setDepartment(next);
              }}
              createLabel="Yeni bölüm"
              placeholder="Bölüm seçin veya yazın"
              searchPlaceholder="Bölüm ara veya yeni bölüm yaz…"
              className="text-base pointer-fine:text-sm"
            />
          </div>
        </div>

        <div className="grid gap-3 border bg-muted/30 p-3 sm:grid-cols-[12rem_12rem_1fr]">
          <div className="grid gap-1.5">
            <Label>Para Birimi</Label>
            <Select
              value={currency}
              onValueChange={(value) => {
                const nextCurrency = value as Currency;
                setCurrency(nextCurrency);
                if (nextCurrency === "EUR") {
                  setFxRate("1");
                  setFxRateDate(null);
                  setFxSource("daily");
                }
              }}
            >
              <SelectTrigger className="w-full text-base pointer-fine:text-sm">
                <SelectValue>{currency} · {CURRENCY_LABELS[currency]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value} · {CURRENCY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sarf-rate">Kur</Label>
            <Input
              id="sarf-rate"
              inputMode="decimal"
              value={fxRate}
              onChange={(event) => {
                setFxRate(event.target.value);
                setFxSource("manual");
              }}
              disabled={currency === "EUR"}
              required
              className="font-mono text-base tabular-nums pointer-fine:text-sm"
            />
          </div>
          <div className="self-end text-[12px] text-muted-foreground">
            1 EUR = {fxRate || "—"} {currency}
            {fxRateDate ? ` · ${fxRateDate} tarihli yayın` : ""}
            {fxSource === "manual" && currency !== "EUR" ? " · elle değiştirildi" : ""}
          </div>
        </div>

        <div className="grid gap-3 border bg-muted/30 p-3 lg:grid-cols-[minmax(18rem,1fr)_minmax(16rem,1fr)_minmax(16rem,1fr)]">
          <div className="grid gap-1.5">
            <Label>Hızlı Termin</Label>
            <Select
              value={deliveryPreset}
              onValueChange={(value) => {
                setDeliveryPreset(value);
                if (value !== "custom") setDueAt(gunEkle(expenseDate, Number(value)));
              }}
            >
              <SelectTrigger className="w-full text-base pointer-fine:text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Hemen</SelectItem>
                {DELIVERY_WEEKS.map((week) => (
                  <SelectItem key={week} value={String(week * 7)}>{week} hafta</SelectItem>
                ))}
                <SelectItem value="custom">Tarih Seç</SelectItem>
              </SelectContent>
            </Select>
            <Input
              aria-label="Termin tarihi"
              type="date"
              value={dueAt}
              onChange={(event) => { setDueAt(event.target.value); setDeliveryPreset("custom"); }}
              required
              className="font-mono text-base pointer-fine:text-sm"
            />
          </div>
          <div className="grid content-start gap-1.5">
            <Label>Ödeme Vadesi</Label>
            <Select value={paymentTerm} onValueChange={setPaymentTerm}>
              <SelectTrigger className="w-full text-base pointer-fine:text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
                <SelectItem value="custom">Diğer (Gün Gir)</SelectItem>
              </SelectContent>
            </Select>
            {paymentTerm === "custom" && (
              <Input
                aria-label="Özel vade gün sayısı"
                inputMode="numeric"
                value={customPaymentDays}
                onChange={(event) => setCustomPaymentDays(event.target.value)}
                placeholder="Örn. 120"
                className="font-mono text-base pointer-fine:text-sm"
              />
            )}
          </div>
          <div className="grid content-start gap-1.5">
            <Label>Planlanan Ödeme</Label>
            <div className="min-h-10 border-l-2 border-primary/40 bg-primary/[0.04] px-3 py-2 text-sm">
              <strong>{paymentDueAt ? tarihGoster(paymentDueAt) : "—"}</strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                Termin {dueAt ? tarihGoster(dueAt) : "seçilmedi"}
                {paymentTermDays > 0 ? ` + ${paymentTermDays} gün vade` : " · vade yok"}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">Ödeme Takvimine KDV dahil fiş toplamıyla eklenir.</span>
          </div>
        </div>

        <div className="oc-scrollx overflow-x-auto border [--oc-scroll-bg:var(--card)]">
          <div className="min-w-[64rem]">
            <div className="grid grid-cols-[minmax(15rem,1fr)_6rem_6rem_9rem_5rem_8rem_9rem_2.75rem] gap-2 border-b bg-muted/50 px-2 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <span>Sarf Malzeme</span>
              <span>Miktar</span>
              <span>Birim</span>
              <span>Birim Fiyat <span className="normal-case">(KDV hariç)</span></span>
              <span>KDV</span>
              <span className="text-right">Tutar</span>
              <span className="text-right">KDV Dahil Tutar</span>
              <span />
            </div>
            {lines.map((line, index) => {
              const selected = items.find((item) => item.id === line.itemId);
              const lineTotal = (parseNum(line.quantity) ?? 0) * (parseNum(line.unitPrice) ?? 0);
              const lineGross = lineTotal * (1 + line.vatRate / 100);
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-[minmax(15rem,1fr)_6rem_6rem_9rem_5rem_8rem_9rem_2.75rem] gap-2 border-b px-2 py-2 last:border-b-0"
                >
                  <Combobox
                    options={itemOptions}
                    value={line.itemId}
                    onChange={(id) => {
                      const item = items.find((row) => row.id === id);
                      patchLine(line.key, {
                        itemId: id,
                        unit: item ? adBuyuk(item.defaultUnit) : line.unit,
                      });
                    }}
                    onCreate={(name) => openNewItem(line.key, name)}
                    createLabel="Yeni sarf malzeme"
                    placeholder={`${index + 1}. malzemeyi seçin`}
                    searchPlaceholder="Malzeme adı veya SM kodu…"
                    className="h-9 text-base pointer-fine:text-sm"
                    // DROPDOWN GENİŞLETİLDİ (kullanıcı kararı, 14.08.2026): sarf
                    // adları uzun ("ŞERİT TESTERE BIÇAĞI 34X1,10MM…") ve dar
                    // hücre genişliğindeki liste okunmuyordu. Popover tetikleyici
                    // genişliğinden bağımsız 34rem'e açılır (dar ekranda görünür
                    // alanla kelepçeli).
                    contentClassName="w-[min(34rem,calc(100vw-1.5rem))]"
                    renderTrigger={() =>
                      selected ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{selected.name}</span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {selected.code}
                          </span>
                        </span>
                      ) : null
                    }
                  />
                  <Input
                    aria-label={`${index + 1}. satır miktar`}
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(event) => patchLine(line.key, { quantity: event.target.value })}
                    className="h-9 font-mono text-base tabular-nums pointer-fine:text-sm"
                  />
                  {/* BİRİM DROPDOWN (kullanıcı kararı, 14.08.2026): SARF
                      GİDERLER excelindeki on birim listelenir; liste kapalı
                      değildir — kullanıcı yeni birim yazabilir, hepsi büyük
                      harfe katlanır. */}
                  <Combobox
                    options={[
                      ...new Set([...CONSUMABLE_UNITS, adBuyuk(line.unit)].filter(Boolean)),
                    ].map((u) => ({ value: u, label: u }))}
                    value={adBuyuk(line.unit) || null}
                    onChange={(value) => patchLine(line.key, { unit: value })}
                    onCreate={(name) => {
                      const buyuk = adBuyuk(name.trim());
                      if (buyuk) patchLine(line.key, { unit: buyuk });
                    }}
                    createLabel="Yeni birim"
                    placeholder="Birim"
                    searchPlaceholder="Birim ara veya yaz…"
                    className="h-9 text-base pointer-fine:text-sm"
                  />
                  <Input
                    aria-label={`${index + 1}. satır birim fiyat`}
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(event) => patchLine(line.key, { unitPrice: event.target.value })}
                    className="h-9 font-mono text-base tabular-nums pointer-fine:text-sm"
                  />
                  <Select
                    value={String(line.vatRate)}
                    onValueChange={(value) =>
                      patchLine(line.key, { vatRate: Number(value) as VatRate })
                    }
                  >
                    <SelectTrigger className="h-9 w-full px-2 font-mono text-base pointer-fine:text-sm">
                      <SelectValue>{line.vatRate}%</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map((rate) => (
                        <SelectItem key={rate} value={String(rate)}>
                          %{rate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex h-9 items-center justify-end font-mono text-sm tabular-nums">
                    {fmtMoney(lineTotal, currency)}
                  </div>
                  <div className="flex h-9 items-center justify-end font-mono text-sm font-medium tabular-nums">
                    {fmtMoney(lineGross, currency)}
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={lines.length === 1}
                    onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
                    aria-label={`${index + 1}. satırı kaldır`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((current) => [...current, blankLine(nextLine.current++)])}
          >
            <Plus /> Satır Ekle
          </Button>
          <div className="grid w-full grid-cols-[auto_auto_auto] gap-x-3 gap-y-1 text-right text-sm sm:w-auto sm:min-w-[22rem]">
            <span className="text-muted-foreground">KDV Hariç Tutar</span>
            <span className="font-mono tabular-nums">{fmtMoney(nativeTotals.net, currency)}</span>
            <span className="font-mono tabular-nums text-muted-foreground">{fmtMoney(eurNet, "EUR")}</span>
            <span className="text-muted-foreground">KDV</span>
            <span className="font-mono tabular-nums">{fmtMoney(nativeTotals.vat, currency)}</span>
            <span className="font-mono tabular-nums text-muted-foreground">{fmtMoney(eurVat, "EUR")}</span>
            <span className="font-semibold">KDV Dahil Tutar</span>
            <span className="font-mono font-semibold tabular-nums">{fmtMoney(nativeTotals.gross, currency)}</span>
            <span className="font-mono font-semibold tabular-nums">{fmtMoney(eurGross, "EUR")}</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="sarf-note">Not</Label>
            <Textarea
              id="sarf-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Faturanın tamamına ait isteğe bağlı açıklama"
            />
          </div>
          <Button type="submit" disabled={pending} className="md:min-w-44">
            <Save /> {pending ? "Kaydediliyor…" : `${lines.length} Satırı Kaydet`}
          </Button>
        </div>
      </form>

      <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
        <DialogContent className="sm:max-w-[min(34rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>Yeni Sarf Malzeme</DialogTitle>
            <DialogDescription>
              Malzeme SM koduyla Yönetim → Sarf Malzemeleri defterine eklenir ve bu satırda seçilir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="new-consumable-name">Malzeme Adı</Label>
              <Input
                id="new-consumable-name"
                value={newItemName}
                onChange={(event) => setNewItemName(event.target.value)}
                maxLength={200}
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="new-consumable-group">Sarf Grubu</Label>
                <Input
                  id="new-consumable-group"
                  value={newItemGroup}
                  onChange={(event) => setNewItemGroup(event.target.value)}
                  list="consumable-groups"
                  maxLength={120}
                />
                <datalist id="consumable-groups">
                  {groups.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new-consumable-unit">Varsayılan Birim</Label>
                <Input
                  id="new-consumable-unit"
                  value={newItemUnit}
                  onChange={(event) => setNewItemUnit(event.target.value)}
                  maxLength={30}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setNewItemOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" disabled={pending} onClick={saveNewItem}>
              Kaydet ve Seç
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

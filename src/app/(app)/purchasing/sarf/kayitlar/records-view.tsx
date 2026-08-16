"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox, type ComboOption } from "@/components/combobox";
import { FilterBar, SearchBox, SortableHead } from "@/app/(app)/drawings/sortable-head";
import { CURRENCIES, fmtMoney, fmtNum, parseNum, type Currency } from "@/lib/currency";
import { tarihGoster } from "@/lib/purchasing/terms";
import { deleteConsumableExpense, getConsumableExpenseRate, updateConsumableExpense } from "../actions";
import { TAM_BOY_PENCERE } from "@/components/pencere";
import type {
  ConsumableExpenseRow,
  ConsumableItemOption,
  ConsumableRecordFilters,
  ConsumableRecordResult,
  ConsumableRecordSort,
  ConsumableSupplierOption,
} from "../data";

function FilterSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || "__all__"} onValueChange={(next) => onChange(next === "__all__" ? "" : next)}>
      <SelectTrigger size="sm" className="min-w-[7.5rem] max-w-[15rem]">
        <SelectValue>{options.find((option) => option.value === value)?.label ?? placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EditExpenseDialog({
  row,
  items,
  suppliers,
  onClose,
}: {
  row: ConsumableExpenseRow;
  items: ConsumableItemOption[];
  suppliers: ConsumableSupplierOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expenseDate, setExpenseDate] = useState(row.expenseDate);
  const [supplierId, setSupplierId] = useState<string | null>(row.supplierId);
  const [itemId, setItemId] = useState<string | null>(row.itemId);
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [unit, setUnit] = useState(row.unit);
  const [unitPrice, setUnitPrice] = useState(String(row.unitPrice));
  const [currency, setCurrency] = useState<Currency>(row.currency);
  const [fxRate, setFxRate] = useState(String(row.fxRate));
  const [fxRateDate, setFxRateDate] = useState<string | null>(row.fxRateDate);
  const [fxSource, setFxSource] = useState<"daily" | "manual">(
    row.fxSource === "daily" ? "daily" : "manual"
  );
  const [documentNo, setDocumentNo] = useState(row.documentNo);
  const [department, setDepartment] = useState(row.department);
  const [note, setNote] = useState(row.note);

  const itemOptions: ComboOption[] = items.map((item) => ({
    value: item.id,
    label: item.name,
    hint: `${item.groupName} · ${item.defaultUnit}`,
    badge: item.code,
  }));
  const supplierOptions: ComboOption[] = suppliers.map((supplier) => ({
    value: supplier.id,
    label: supplier.name,
    badge: supplier.code,
  }));

  function suggestRate() {
    if (currency === "EUR") {
      setFxRate("1");
      setFxRateDate(null);
      setFxSource("daily");
      return;
    }
    startTransition(async () => {
      const result = await getConsumableExpenseRate({ expenseDate, currency });
      if (result.error || result.rate == null) {
        toast.error(result.error ?? "Kur bulunamadı.");
        return;
      }
      setFxRate(String(Number(result.rate.toFixed(4))));
      setFxRateDate(result.rateDate ?? null);
      setFxSource("daily");
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const qty = parseNum(quantity);
    const price = parseNum(unitPrice);
    const rate = currency === "EUR" ? 1 : parseNum(fxRate);
    if (!supplierId || !itemId || qty == null || price == null || rate == null) {
      toast.error("Malzeme, tedarikçi, miktar, fiyat ve kur alanlarını tamamlayın.");
      return;
    }
    startTransition(async () => {
      const result = await updateConsumableExpense({
        id: row.id,
        expenseDate,
        supplierId,
        documentNo,
        department,
        currency,
        fxRate: rate,
        fxRateDate: currency === "EUR" ? null : fxRateDate,
        fxSource,
        note,
        line: { itemId, quantity: qty, unit, unitPrice: price, note: "" },
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarf gideri güncellendi.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`sm:max-w-[min(48rem,calc(100%-2rem))] ${TAM_BOY_PENCERE}`}>
        <DialogHeader>
          <DialogTitle>Sarf Giderini Düzenle</DialogTitle>
          <DialogDescription>
            Devralınan kaydın kaynak satırı değişmez; düzeltilen canonical alanlar denetim günlüğüne yazılır.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Tedarikçi</Label>
              <Combobox options={supplierOptions} value={supplierId} onChange={setSupplierId} />
            </div>
            <div className="grid gap-1.5">
              <Label>Sarf Malzeme</Label>
              <Combobox
                options={itemOptions}
                value={itemId}
                onChange={(id) => {
                  setItemId(id);
                  const item = items.find((value) => value.id === id);
                  if (item) setUnit(item.defaultUnit);
                }}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-date-${row.id}`}>Tarih</Label>
              <Input id={`edit-date-${row.id}`} type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-qty-${row.id}`}>Miktar</Label>
              <Input id={`edit-qty-${row.id}`} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-unit-${row.id}`}>Birim</Label>
              <Input id={`edit-unit-${row.id}`} value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-price-${row.id}`}>Birim Fiyat</Label>
              <Input id={`edit-price-${row.id}`} inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 border bg-muted/30 p-3 sm:grid-cols-[10rem_10rem_auto_1fr] sm:items-end">
            <div className="grid gap-1.5">
              <Label>Para Birimi</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                <SelectTrigger className="w-full"><SelectValue>{currency}</SelectValue></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-rate-${row.id}`}>Kur</Label>
              <Input
                id={`edit-rate-${row.id}`}
                inputMode="decimal"
                value={fxRate}
                disabled={currency === "EUR"}
                onChange={(e) => { setFxRate(e.target.value); setFxSource("manual"); }}
              />
            </div>
            <Button type="button" variant="outline" onClick={suggestRate} disabled={pending}>Tarihin Kurunu Getir</Button>
            <p className="text-[11px] text-muted-foreground">{fxRateDate ? `${fxRateDate} yayını` : "Kur günü yok"} · {fxSource === "manual" ? "Elle" : "Günlük kur"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-document-${row.id}`}>Belge / Fatura No</Label>
              <Input id={`edit-document-${row.id}`} value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-department-${row.id}`}>Bölüm</Label>
              <Input id={`edit-department-${row.id}`} value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-note-${row.id}`}>Açıklama</Label>
            <Textarea id={`edit-note-${row.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConsumableRecordsView({
  result,
  filters,
  years,
  groups,
  items,
  suppliers,
  canEdit,
}: {
  result: ConsumableRecordResult;
  filters: ConsumableRecordFilters;
  years: number[];
  groups: string[];
  items: ConsumableItemOption[];
  suppliers: ConsumableSupplierOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transitioning, startTransition] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [editing, setEditing] = useState<ConsumableExpenseRow | null>(null);
  const [removing, setRemoving] = useState<ConsumableExpenseRow | null>(null);
  const first = useRef(true);

  function write(changes: Record<string, string | undefined>, preservePage = false) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!preservePage) params.delete("sayfa");
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (q === filters.q) return;
    const timer = setTimeout(() => write({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function sort(key: ConsumableRecordSort) {
    const desc = filters.sort === key ? !filters.desc : key === "date" || key === "eur" || key === "native";
    write({ sirala: key, yon: desc ? "desc" : "asc" });
  }

  // ONAY PENCEREYLE SORULUR, `window.confirm` İLE DEĞİL (Siparişler'deki iptal
  // onayının kuralı): kalıcı bir silmede pencere NEYİN silindiğini (malzeme,
  // tarih, tutar) göstermelidir — tarayıcının kutusu bunu yapamıyordu.
  function remove(row: ConsumableExpenseRow) {
    startDeleting(async () => {
      const result = await deleteConsumableExpense({ id: row.id });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarf gideri silindi.");
      setRemoving(null);
      router.refresh();
    });
  }

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const clean = !filters.q && !filters.year && !filters.group && !filters.supplierId && !filters.currency && !filters.source;

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Sarf Kayıtları</h2>
        <p className="text-sm text-muted-foreground">
          Arama ve sıralama bütün eski ve yeni kayıtlarda sunucuda çalışır; en yeni alım varsayılan olarak üsttedir.
        </p>
      </div>
      <FilterBar
        gorunen={result.total}
        toplam={result.total}
        temiz={clean}
        onTemizle={() => { setQ(""); startTransition(() => router.replace("?", { scroll: false })); }}
      >
        <SearchBox value={q} onChange={setQ} placeholder="Malzeme, SM/TD kodu, firma, belge…" className="w-[min(24rem,calc(100vw-4rem))]" />
        <FilterSelect value={filters.year} placeholder="Tüm yıllar" options={years.map((year) => ({ value: String(year), label: String(year) }))} onChange={(value) => write({ yil: value || undefined })} />
        <FilterSelect value={filters.group} placeholder="Tüm gruplar" options={groups.map((group) => ({ value: group, label: group }))} onChange={(value) => write({ grup: value || undefined })} />
        <FilterSelect value={filters.supplierId} placeholder="Tüm tedarikçiler" options={suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.code} · ${supplier.name}` }))} onChange={(value) => write({ tedarikci: value || undefined })} />
        <FilterSelect value={filters.currency} placeholder="Tüm paralar" options={CURRENCIES.map((value) => ({ value, label: value }))} onChange={(value) => write({ para: value || undefined })} />
        <FilterSelect value={filters.source} placeholder="Tüm kaynaklar" options={[{ value: "app", label: "Manuel" }, { value: "legacy", label: "Devralınan" }]} onChange={(value) => write({ kaynak: value || undefined })} />
        {transitioning && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </FilterBar>

      {/* YATAY KAYDIRMA GÖRÜNÜR OLMALI (kabuk kuralı 8): tablo telefonda taşar
          ve `.oc-scrollx` kenar gölgesiyle bunu söyler. */}
      <div
        className={
          "oc-scrollx oc-table-clamp border bg-card [--oc-scroll-bg:var(--card)]" +
          (transitioning ? " opacity-60 transition-opacity" : "")
        }
      >
        <Table>
          <TableHeader className="oc-sticky-head">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {/* Telefonda tarih Malzeme alt satırına iner (yatay kaydırma
                  yasağı, 16.08.2026). */}
              <SortableHead sortKey="date" current={filters.sort} desc={filters.desc} onSort={sort} className="hidden sm:table-cell">Tarih</SortableHead>
              <SortableHead sortKey="item" current={filters.sort} desc={filters.desc} onSort={sort}>Malzeme</SortableHead>
              <SortableHead sortKey="group" current={filters.sort} desc={filters.desc} onSort={sort} className="hidden lg:table-cell">Grup</SortableHead>
              <SortableHead sortKey="supplier" current={filters.sort} desc={filters.desc} onSort={sort} className="hidden md:table-cell">Tedarikçi</SortableHead>
              <SortableHead sortKey="native" current={filters.sort} desc={filters.desc} onSort={sort} align="right" className="hidden xl:table-cell">Özgün Tutar</SortableHead>
              <SortableHead sortKey="eur" current={filters.sort} desc={filters.desc} onSort={sort} align="right">Tutar (€)</SortableHead>
              <TableHead className="hidden 2xl:table-cell">Belge</TableHead>
              {canEdit && <TableHead className="w-[5.5rem]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="hidden font-mono text-xs whitespace-nowrap sm:table-cell">{tarihGoster(row.expenseDate)}</TableCell>
                <TableCell className="max-w-[25rem] whitespace-normal">
                  <div className="flex items-start gap-1.5">
                    {row.qualityFlags.length > 0 && <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label={`İnceleme: ${row.qualityFlags.join(", ")}`} />}
                    <div className="min-w-0">
                      <div className="line-clamp-3 font-medium md:line-clamp-none">
                        {row.itemName || "Malzeme belirtilmemiş"}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">{[row.itemCode, `${fmtNum(row.quantity)} ${row.unit}`, row.source === "app" ? "Manuel" : "Devralınan"].filter(Boolean).join(" · ")}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground sm:hidden">
                        {tarihGoster(row.expenseDate)}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground md:hidden">
                        {row.supplierName || "Tedarikçi belirtilmemiş"} · {row.groupName}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden whitespace-normal lg:table-cell">{row.groupName || "—"}</TableCell>
                <TableCell className="hidden max-w-[18rem] whitespace-normal md:table-cell">{row.supplierName || "—"}</TableCell>
                <TableCell className="hidden text-right font-mono text-xs whitespace-nowrap tabular-nums xl:table-cell">{fmtMoney(row.amount, row.currency)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-medium whitespace-nowrap tabular-nums">{fmtMoney(row.amountEur, "EUR")}</TableCell>
                <TableCell className="hidden font-mono text-xs 2xl:table-cell">{row.documentNo || "—"}</TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" onClick={() => setEditing(row)} aria-label="Düzenle"><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" className="text-destructive" disabled={deleting} onClick={() => setRemoving(row)} aria-label="Sil"><Trash2 /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {result.rows.length === 0 && (
              <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="h-28 text-center text-muted-foreground">Bu süzgeçlerle eşleşen sarf kaydı yok.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-muted-foreground">{result.total.toLocaleString("tr-TR")} kayıt · Sayfa {result.page}/{pageCount}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={result.page <= 1 || transitioning} onClick={() => write({ sayfa: String(result.page - 1) }, true)}>Önceki</Button>
          <Button variant="outline" size="sm" disabled={result.page >= pageCount || transitioning} onClick={() => write({ sayfa: String(result.page + 1) }, true)}>Sonraki</Button>
        </div>
      </div>
      {editing && <EditExpenseDialog row={editing} items={items} suppliers={suppliers} onClose={() => setEditing(null)} />}

      <Dialog open={removing != null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-[min(28rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle className="text-base">Sarf gideri silinsin mi?</DialogTitle>
            <DialogDescription className="text-[12px]">
              Kayıt KALICI olarak silinir; geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          {removing && (
            <dl className="grid gap-1 border bg-muted/30 p-3 text-[12px]">
              <span className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Malzeme</dt>
                <dd className="font-medium">{removing.itemName || "Malzeme belirtilmemiş"}</dd>
              </span>
              <span className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tarih</dt>
                <dd className="font-mono">{tarihGoster(removing.expenseDate)}</dd>
              </span>
              <span className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tutar</dt>
                <dd className="font-mono tabular-nums">{fmtMoney(removing.amountEur, "EUR")}</dd>
              </span>
            </dl>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRemoving(null)} disabled={deleting}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => removing && remove(removing)}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Kalıcı Olarak Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

// Satış listesi: süzgeçler + sıralanabilir tablo + müşteri kırılımı.
//
// Süzme ve toplama SUNUCUDA DEĞİL burada yapılır (iş emri listesiyle aynı
// gerekçe): satır sayısı yüzlerle ölçülür, tamamı tek istekte gelir ve
// süzgeç değiştikçe sayfa yeniden yüklenmez.
//
// TEK ORTAK BÜYÜKLÜK AVRODUR. Tablo satırı kendi para biriminde okunur ama
// toplamlar yalnız avro karşılığından çıkar; kuru girilmemiş satır toplama
// GİRMEZ ve bu durum sessiz kalmasın diye ayrıca sayılır.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronUp, ChevronsUpDown, CircleAlert, Coins, Package, Scale, X,
} from "lucide-react";
import { SaleDialog } from "./sale-dialog";
import { saleYear, type SaleRow } from "./schema";
import {
  CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS, fmtCompactEur, fmtNum,
} from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ALL = "__all__";
/** Fiyat durumu süzgeci — "hangi kalemin fiyatı girilmedi" en sık sorulan soru. */
const PRICED = "__priced__";
const UNPRICED = "__unpriced__";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

type SortKey =
  | "itemNo" | "productName" | "customer" | "scope"
  | "dueDate" | "shipmentDate" | "totalPrice" | "eurAmount" | "totalWeightKg";

const SORT_VALUE: Record<SortKey, (r: SaleRow) => string | number> = {
  itemNo: (r) => r.itemNo,
  productName: (r) => r.productName,
  customer: (r) => r.customer,
  scope: (r) => r.sale.scope,
  dueDate: (r) => r.sale.due_date ?? "",
  shipmentDate: (r) => r.sale.shipment_date ?? "",
  totalPrice: (r) => r.totalPrice ?? -1,
  eurAmount: (r) => r.eurAmount ?? -1,
  totalWeightKg: (r) => r.totalWeightKg ?? -1,
};

function StatCard({
  label, value, hint, icon: Icon, tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "warn";
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          tone === "warn" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="oc-kicker text-muted-foreground">{label}</div>
        <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        {hint && <div className="mt-0.5 truncate text-[11px] text-foreground/70">{hint}</div>}
      </div>
    </div>
  );
}

function SortHead({
  label, sortKey, active, dir, onSort, className, align = "left",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "-mx-1 flex w-full items-center gap-1 rounded px-1 py-0.5 hover:text-foreground",
          align === "right" && "justify-end",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className={cn("size-3 shrink-0", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

export function SalesTable({ rows }: { rows: SaleRow[] }) {
  const [year, setYear] = useState(ALL);
  const [customer, setCustomer] = useState(ALL);
  const [currency, setCurrency] = useState(ALL);
  const [priceState, setPriceState] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "itemNo",
    dir: "desc",
  });
  const [editing, setEditing] = useState<SaleRow | null>(null);

  const years = useMemo(() => {
    const set = new Set(rows.map(saleYear).filter(Boolean));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const customers = useMemo(() => {
    const set = new Set(rows.map((r) => r.customer.trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [rows]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : {
            key,
            dir:
              key === "productName" || key === "customer" || key === "scope" ? "asc" : "desc",
          }
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const out = rows.filter((r) => {
      if (year !== ALL && saleYear(r) !== year) return false;
      if (customer !== ALL && r.customer.trim() !== customer) return false;
      if (currency !== ALL && r.sale.currency !== currency) return false;
      if (priceState === PRICED && r.sale.unit_price === null) return false;
      if (priceState === UNPRICED && r.sale.unit_price !== null) return false;
      if (q && ![r.itemNo, r.productName, r.customer, r.sale.scope].join(" ")
        .toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const va = SORT_VALUE[sort.key](a);
      const vb = SORT_VALUE[sort.key](b);
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "tr", { numeric: true });
      return sign * c;
    });
  }, [rows, year, customer, currency, priceState, query, sort]);

  // Özetler süzgeçten GEÇEN satırlardan çıkar: "2025 · ASTOR" seçildiğinde
  // kartlar o kesitin cirosunu gösterir.
  const summary = useMemo(() => {
    let eur = 0;
    let weight = 0;
    let priced = 0;
    let missingFx = 0;
    const byCustomer = new Map<string, { eur: number; count: number }>();
    for (const r of filtered) {
      if (r.sale.unit_price !== null) priced += 1;
      if (r.sale.unit_price !== null && r.eurAmount === null) missingFx += 1;
      weight += r.totalWeightKg ?? 0;
      if (r.eurAmount !== null) {
        eur += r.eurAmount;
        const key = r.customer.trim() || "—";
        const cur = byCustomer.get(key) ?? { eur: 0, count: 0 };
        byCustomer.set(key, { eur: cur.eur + r.eurAmount, count: cur.count + 1 });
      }
    }
    return {
      eur,
      weight,
      priced,
      missingFx,
      byCustomer: [...byCustomer.entries()].sort((a, b) => b[1].eur - a[1].eur),
    };
  }, [filtered]);

  const activeFilters =
    (year !== ALL ? 1 : 0) + (customer !== ALL ? 1 : 0) + (currency !== ALL ? 1 : 0) +
    (priceState !== ALL ? 1 : 0) + (query.trim() ? 1 : 0);

  function clearFilters() {
    setYear(ALL);
    setCustomer(ALL);
    setCurrency(ALL);
    setPriceState(ALL);
    setQuery("");
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ciro (Avro)"
          value={fmtCompactEur(summary.eur)}
          hint={`${summary.byCustomer.length} müşteri`}
          icon={Coins}
        />
        <StatCard
          label="Fiyatlanan Kalem"
          value={`${summary.priced} / ${filtered.length}`}
          hint={
            filtered.length - summary.priced > 0
              ? `${filtered.length - summary.priced} kalemin fiyatı girilmedi`
              : "tamamı fiyatlandı"
          }
          icon={Package}
        />
        <StatCard
          label="Toplam Ağırlık"
          value={`${fmtNum(Math.round(summary.weight))} kg`}
          hint="süzgeçten geçen kalemler"
          icon={Scale}
        />
        <StatCard
          label="Kuru Eksik"
          value={String(summary.missingFx)}
          hint={summary.missingFx > 0 ? "ciroya girmiyor — kur girin" : "tüm satırlar ciroda"}
          icon={CircleAlert}
          tone={summary.missingFx > 0 ? "warn" : undefined}
        />
      </div>

      {/* Süzgeçler */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="oc-kicker mr-1 text-muted-foreground">Filtre</span>

        <Select value={year} onValueChange={setYear}>
          <SelectTrigger size="sm" className="w-[120px]">
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm yıllar</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger size="sm" className="w-[220px]">
            <SelectValue placeholder="Müşteri" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm müşteriler</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Para birimi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm para birimleri</SelectItem>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priceState} onValueChange={setPriceState}>
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue placeholder="Fiyat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Fiyat farketmez</SelectItem>
            <SelectItem value={PRICED}>Fiyatı girilmiş</SelectItem>
            <SelectItem value={UNPRICED}>Fiyatı girilmemiş</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kalem no, ürün, müşteri veya kapsam ara…"
          className="h-8 w-full flex-1 sm:w-auto sm:min-w-[200px]"
        />

        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {filtered.length} / {rows.length}
        </span>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="size-3.5" /> Temizle
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <SortHead label="Kalem No" sortKey="itemNo" className="w-[7rem]"
                active={sort.key === "itemNo"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Ürün" sortKey="productName"
                active={sort.key === "productName"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Müşteri" sortKey="customer" className="w-[18%]"
                active={sort.key === "customer"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Kapsam" sortKey="scope" className="w-[12%]"
                active={sort.key === "scope"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Termin" sortKey="dueDate" className="w-[6.5rem]"
                active={sort.key === "dueDate"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Sevk" sortKey="shipmentDate" className="w-[6.5rem]"
                active={sort.key === "shipmentDate"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Ağırlık" sortKey="totalWeightKg" className="w-[7rem]" align="right"
                active={sort.key === "totalWeightKg"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Tutar" sortKey="totalPrice" className="w-[9rem]" align="right"
                active={sort.key === "totalPrice"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Avro Karşılığı" sortKey="eurAmount" className="w-[9.5rem]" align="right"
                active={sort.key === "eurAmount"} dir={sort.dir} onSort={toggleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Süzgeçlere uyan kalem yok — bir filtreyi temizleyip tekrar deneyin.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.itemId}
                  className="cursor-pointer"
                  onClick={() => setEditing(r)}
                >
                  <TableCell className="font-mono text-sm font-medium text-primary">
                    {r.itemNo || "—"}
                  </TableCell>
                  <TableCell className="font-medium">{r.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.customer}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.sale.scope || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                    {fmtDate(r.sale.due_date)}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                    {fmtDate(r.sale.shipment_date)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {r.totalWeightKg ? fmtNum(r.totalWeightKg) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {r.sale.unit_price === null ? (
                      <span className="text-muted-foreground/60">fiyat yok</span>
                    ) : (
                      <>
                        {fmtNum(r.totalPrice)}{" "}
                        <span className="text-muted-foreground">
                          {CURRENCY_SYMBOLS[r.sale.currency]}
                        </span>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                    {r.eurAmount === null ? (
                      r.sale.unit_price === null ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        <span className="text-destructive">kur yok</span>
                      )
                    ) : (
                      `${fmtNum(r.eurAmount)} €`
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Müşteri kırılımı — Excel'deki "Satış Toplamları" sayfasının karşılığı */}
      {summary.byCustomer.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
            <span className="oc-kicker text-muted-foreground">Müşteri Bazında Ciro</span>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {fmtNum(summary.eur)} €
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 text-right">#</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead className="w-[6rem] text-right">Kalem</TableHead>
                <TableHead className="w-[10rem] text-right">Ciro (Avro)</TableHead>
                <TableHead className="w-[24%]">Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byCustomer.map(([name, v], i) => {
                const share = summary.eur > 0 ? v.eur / summary.eur : 0;
                return (
                  <TableRow key={name} className="hover:bg-transparent">
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {v.count}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {fmtNum(v.eur)} €
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(share * 100, 0.5)}%` }}
                          />
                        </div>
                        <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                          %{fmtNum(share * 100)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Satırlar iş emirlerinden gelir; yeni bir iş açtığınızda kalemleri burada
        kendiliğinden listelenir. Bir satıra tıklayarak fiyat bilgisini
        girebilirsiniz. İş emrini düzenlemek için{" "}
        <Link href="/jobs" className="underline underline-offset-2">İşler</Link> bölümüne gidin.
      </p>

      {editing && (
        <SaleDialog
          row={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}

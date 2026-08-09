"use client";

// Kayıt listesi: süzgeçler + sıralanabilir tablo + satır düzenleme.
//
// Süzme ve sıralama SUNUCUDA DEĞİL burada yapılır (liste ekranlarının
// gerekçesi): satırların tamamı tek istekte gelir ve süzgeç değiştikçe sayfa
// yeniden yüklenmez. Tablo uzun olabildiği için görünür satır sayısı
// KADEMELİ artar — 1.700 satırı tek seferde çizmek kaydırmayı takar.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerTag } from "@/components/tags";
import { tagStyle } from "@/lib/tags";
import {
  fmtDate,
  fmtManHours,
  type WorkCategory,
  type WorkJobOption,
  type WorkLogRow,
  type WorkPart,
} from "@/lib/work-log";
import { cn } from "@/lib/utils";
import { FilterBar, useFilterOptions } from "../filter-bar";
import { EMPTY_FILTERS, filtersToQuery, matchesFilters, type WorkFilters } from "../filters";
import { ItemRemapCard } from "./item-remap-card";
import { RecordDialog } from "./record-dialog";

type SortKey = "date" | "itemNo" | "customer" | "part" | "category" | "people" | "hours" | "manHours";

const SORT_VALUE: Record<SortKey, (r: WorkLogRow) => string | number> = {
  date: (r) => r.date,
  itemNo: (r) => r.itemNo,
  // Sıralama GÖRÜNEN ada göredir (liste ekranlarındaki aynı gerekçe).
  customer: (r) => r.customerShort || r.customer,
  part: (r) => r.partName,
  category: (r) => r.categoryName,
  people: (r) => r.people,
  hours: (r) => r.hours,
  manHours: (r) => r.manHours,
};

function SortHead({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
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
          "-mx-1 flex w-full items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground",
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

const PAGE_STEP = 200;

export function RecordsTable({
  rows,
  parts,
  categories,
  jobs,
}: {
  rows: WorkLogRow[];
  parts: WorkPart[];
  categories: WorkCategory[];
  jobs: WorkJobOption[];
}) {
  const [filters, setFilters] = useState<WorkFilters>({ ...EMPTY_FILTERS });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });
  const [limit, setLimit] = useState(PAGE_STEP);
  const [editing, setEditing] = useState<WorkLogRow | null>(null);

  const options = useFilterOptions(rows);

  const filtered = useMemo(() => {
    const out = rows.filter((r) => matchesFilters(r, filters));
    const sign = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const va = SORT_VALUE[sort.key](a);
      const vb = SORT_VALUE[sort.key](b);
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "tr", { numeric: true });
      // Eşitlikte tarih ikinci ölçüt: aynı kalemin satırları takvim sırasında kalır.
      return sign * c || b.date.localeCompare(a.date);
    });
  }, [rows, filters, sort]);

  const totals = useMemo(() => {
    let manHours = 0;
    for (const r of filtered) manHours += r.manHours;
    return { manHours, records: filtered.length };
  }, [filtered]);

  function toggleSort(key: SortKey) {
    setLimit(PAGE_STEP);
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : {
            key,
            dir: key === "itemNo" || key === "customer" || key === "part" || key === "category"
              ? "asc"
              : "desc",
          }
    );
  }

  const visible = filtered.slice(0, limit);
  const exportHref = `/worklog/export?${filtersToQuery(filters)}`;

  return (
    <div className="grid gap-4">
      <FilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setLimit(PAGE_STEP);
        }}
        options={options}
        shown={filtered.length}
        total={rows.length}
        extra={
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <a href={exportHref}>
              <Download className="size-3.5" /> Excel indir
            </a>
          </Button>
        }
      />

      <ItemRemapCard rows={rows} jobs={jobs} />

      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5">
        <span className="oc-kicker text-muted-foreground">Süzgeçten Geçen</span>
        <span className="flex items-baseline gap-4 font-mono text-sm tabular-nums">
          <span className="text-muted-foreground">{totals.records} kayıt</span>
          <span className="font-semibold">{fmtManHours(totals.manHours)} adam·saat</span>
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <SortHead
                label="Tarih"
                sortKey="date"
                className="w-[6.5rem]"
                active={sort.key === "date"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortHead
                label="Kalem"
                sortKey="itemNo"
                className="w-[7rem]"
                active={sort.key === "itemNo"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortHead
                label="Müşteri"
                sortKey="customer"
                className="w-[9rem]"
                active={sort.key === "customer"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <TableHead>Ürün</TableHead>
              <SortHead
                label="Parça"
                sortKey="part"
                className="w-[11rem]"
                active={sort.key === "part"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortHead
                label="İmalat Türü"
                sortKey="category"
                className="w-[10rem]"
                active={sort.key === "category"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <TableHead className="w-[4.5rem]">Grup</TableHead>
              <SortHead
                label="Adam"
                sortKey="people"
                className="w-[5rem]"
                align="right"
                active={sort.key === "people"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortHead
                label="Saat"
                sortKey="hours"
                className="w-[5rem]"
                align="right"
                active={sort.key === "hours"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortHead
                label="Adam·Saat"
                sortKey="manHours"
                className="w-[7rem]"
                align="right"
                active={sort.key === "manHours"}
                dir={sort.dir}
                onSort={toggleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  Süzgeçlere uyan kayıt yok — bir filtreyi temizleyip tekrar deneyin.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setEditing(r)}>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {fmtDate(r.date)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-mono text-sm font-medium",
                      r.jobItemId ? "text-primary" : "text-destructive"
                    )}
                    title={r.jobItemId ? undefined : "Sistemde iş kalemi karşılığı yok"}
                  >
                    {r.itemNo || "—"}
                  </TableCell>
                  <TableCell>
                    {r.customer ? (
                      <CustomerTag
                        name={r.customer}
                        shortName={r.customerShort}
                        hue={r.customerHue}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate text-xs" title={r.productName}>
                    {r.productName || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="font-medium">{r.partName}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="oc-tag-dot" style={tagStyle(r.categoryHue)} aria-hidden />
                      {r.categoryName}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.partCode || "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {r.people}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {fmtManHours(r.hours)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                    {fmtManHours(r.manHours)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > visible.length && (
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {visible.length} / {filtered.length}
          </span>
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_STEP)}>
            Daha fazla göster
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLimit(filtered.length)}>
            Tümünü göster
          </Button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Bir satıra tıklayarak tarihini, kalemini, parçasını ve saatini düzeltebilir ya da kaydı
        silebilirsiniz. Bir günün tamamını düzenlemek için Günlük Giriş ekranını kullanın.
      </p>

      {editing && (
        <RecordDialog
          row={editing}
          parts={parts}
          categories={categories}
          jobs={jobs}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}

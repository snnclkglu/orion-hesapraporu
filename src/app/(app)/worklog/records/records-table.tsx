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
          // Düğme başlık hücresinin TAMAMINI kaplar (eskiden ~21px'ti):
          // sıralama, dar ekranda tabloyu kullanılabilir kılan tek araçtır ve
          // hücrenin yarısına basmak hiçbir şey yapmıyordu.
          "-mx-2 -my-2 flex h-10 w-full items-center gap-1 rounded px-2 py-2 transition-colors hover:text-foreground",
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

/**
 * Yapışkan kimlik sütunları — tablo on sütunla 1.136px ister ve tablet
 * genişliğinde sağa kaydırıldığında hangi satıra bakıldığı kayboluyordu.
 * Tarih ve Kalem sola yapışır. Zemin opaktır (altından satır geçmesin);
 * satır vurgusunun `bg-muted/50 üzeri kart` bileşimi `color-mix` ile birebir
 * tekrarlanır, yoksa yapışkan hücreler vurguda ayrık görünürdü.
 */
const STICKY_DATE =
  "lg:sticky lg:left-0 lg:z-10 bg-card group-hover/row:bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))]";
const STICKY_ITEM =
  "lg:sticky lg:left-[6.5rem] lg:z-10 bg-card group-hover/row:bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))]";
/** Başlık şeridinin yapışkan hücreleri — satır zemini yarı saydam olduğu için opak eş değeri.
 *  `z-20!` önemlidir: `.oc-sticky-head th` seçicisi (0-1-1) düz `md:z-20`yi (0-1-0)
 *  ezip köşe hücresini öteki başlıklarla aynı kata indiriyordu — yatayda kaydırınca
 *  komşu başlıklar köşenin üstüne biniyordu. */
const STICKY_HEAD_DATE = "lg:sticky lg:left-0 lg:z-20! bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))]";
const STICKY_HEAD_ITEM =
  "lg:sticky lg:left-[6.5rem] lg:z-20! bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))]";
/** Telefonda düşen sütunlar — kritik olanları birincil hücrenin ikinci satırı taşır. */
const SECONDARY = "hidden lg:table-cell";

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
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <a href={exportHref}>
              <Download className="size-3.5" /> Excel indir
            </a>
          </Button>
        }
      />

      <ItemRemapCard rows={rows} jobs={jobs} />

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border bg-card px-4 py-2.5">
        <span className="oc-kicker text-muted-foreground">Süzgeçten Geçen</span>
        <span className="flex flex-wrap items-baseline gap-x-4 font-mono text-sm tabular-nums">
          <span className="text-muted-foreground">{totals.records} kayıt</span>
          <span className="font-semibold">{fmtManHours(totals.manHours)} adam·saat</span>
        </span>
      </div>

      {/* İpucundaki "yana kaydırın" ifadesi kalktı: telefonda tablo listeye
          katlanır ve yatay kaymaz (kabuk MOBIL-15). */}
      <p className="text-[11px] text-muted-foreground lg:hidden">
        → Ayrıntı için satıra dokunun.
      </p>

      {/* Defter BÜYÜR (bugün ~1.700 satır): `.oc-table-clamp` kabı `md` üstünde
          görünür alana kelepçeler, `.oc-sticky-head` başlığı tepesine yapıştırır —
          aşağıda "bu sayı hangi sütundu" sorusu kalmasın. `overflow-hidden`
          kalktı: kırpan kap dikey kaydırmayı, dolayısıyla yapışmayı öldürüyordu. */}
      <Table
        className="oc-tablet-table"
        containerClassName="oc-tablet-table-wrap oc-table-clamp rounded-lg border bg-card [--oc-scroll-bg:var(--card)]"
      >
          <TableHeader className="oc-sticky-head">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <SortHead
                label="Tarih"
                sortKey="date"
                className={cn("w-[6.5rem]", STICKY_HEAD_DATE)}
                active={sort.key === "date"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortHead
                label="Kalem"
                sortKey="itemNo"
                className={cn("md:w-[7rem]", STICKY_HEAD_ITEM)}
                active={sort.key === "itemNo"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortHead
                label="Müşteri"
                sortKey="customer"
                className={cn("w-[9rem]", SECONDARY)}
                active={sort.key === "customer"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <TableHead className={SECONDARY}>Ürün</TableHead>
              <SortHead
                label="Parça"
                sortKey="part"
                className={cn("w-[11rem]", SECONDARY)}
                active={sort.key === "part"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortHead
                label="İmalat Türü"
                sortKey="category"
                className={cn("w-[10rem]", SECONDARY)}
                active={sort.key === "category"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <TableHead className={cn("w-[4.5rem]", SECONDARY)}>Grup</TableHead>
              <SortHead
                label="Adam"
                sortKey="people"
                className={cn("w-[5rem]", SECONDARY)}
                align="right"
                active={sort.key === "people"}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortHead
                label="Saat"
                sortKey="hours"
                className={cn("w-[5rem]", SECONDARY)}
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
                <TableCell
                  colSpan={10}
                  data-mobile-span="full"
                  data-mobile-hide-label
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Süzgeçlere uyan kayıt yok — bir filtreyi temizleyip tekrar deneyin.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow
                  key={r.id}
                  className="group/row cursor-pointer"
                  onClick={() => setEditing(r)}
                >
                  <TableCell
                    data-label="Tarih"
                    className={cn(
                      "align-top font-mono text-xs tabular-nums text-muted-foreground md:align-middle",
                      STICKY_DATE
                    )}
                  >
                    {fmtDate(r.date)}
                  </TableCell>
                  <TableCell
                    data-label="Kayıt"
                    data-mobile-span="full"
                    className={cn(
                      "font-mono text-sm font-medium",
                      r.jobItemId ? "text-primary" : "text-destructive",
                      STICKY_ITEM
                    )}
                    title={r.jobItemId ? undefined : "Sistemde iş kalemi karşılığı yok"}
                  >
                    {r.itemNo || "—"}
                    {/* Telefonda düşen sütunların kritik olanları burada ikinci
                        satır olur — kart markup'ı çoğaltılmaz. */}
                    <span className="mt-0.5 block font-sans text-[11px] font-normal break-words whitespace-normal text-muted-foreground lg:hidden">
                      {[
                        r.customerShort || r.customer,
                        r.partName,
                        r.categoryName,
                        `${r.people}×${fmtManHours(r.hours)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </TableCell>
                  <TableCell className={SECONDARY}>
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
                  <TableCell
                    className={cn("max-w-[18rem] truncate text-xs", SECONDARY)}
                    title={r.productName}
                  >
                    {r.productName || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className={cn("font-medium", SECONDARY)}>{r.partName}</TableCell>
                  <TableCell className={SECONDARY}>
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="oc-tag-dot" style={tagStyle(r.categoryHue)} aria-hidden />
                      {r.categoryName}
                    </span>
                  </TableCell>
                  <TableCell className={cn("font-mono text-xs text-muted-foreground", SECONDARY)}>
                    {r.partCode || "—"}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono text-sm tabular-nums", SECONDARY)}>
                    {r.people}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-sm tabular-nums text-muted-foreground",
                      SECONDARY
                    )}
                  >
                    {fmtManHours(r.hours)}
                  </TableCell>
                  <TableCell data-label="Adam·Saat" className="text-right align-top font-mono text-sm font-medium tabular-nums lg:align-middle">
                    {fmtManHours(r.manHours)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
      </Table>

      {filtered.length > visible.length && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
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

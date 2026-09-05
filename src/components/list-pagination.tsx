"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Uzun listelerde ilk/son ve mevcut sayfanın komşularını görünür tutar. */
function pageNumbers(current: number, count: number): Array<number | "gap"> {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  const chosen = new Set([1, count, current - 1, current, current + 1]);
  const numbers = [...chosen]
    .filter((page) => page >= 1 && page <= count)
    .sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  for (const page of numbers) {
    const previous = out[out.length - 1];
    if (typeof previous === "number" && page - previous > 1) out.push("gap");
    out.push(page);
  }
  return out;
}

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const first = (safePage - 1) * pageSize + 1;
  const last = Math.min(safePage * pageSize, total);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
      aria-label="Liste sayfaları"
    >
      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {first.toLocaleString("tr-TR")}–{last.toLocaleString("tr-TR")} /{" "}
        {total.toLocaleString("tr-TR")} kayıt
      </p>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={safePage === 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Önceki sayfa"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pageNumbers(safePage, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={entry}
              type="button"
              variant={entry === safePage ? "default" : "outline"}
              size="icon-sm"
              aria-current={entry === safePage ? "page" : undefined}
              aria-label={`${entry}. sayfa`}
              onClick={() => onPageChange(entry)}
            >
              {entry}
            </Button>
          )
        )}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={safePage === pageCount}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Sonraki sayfa"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}

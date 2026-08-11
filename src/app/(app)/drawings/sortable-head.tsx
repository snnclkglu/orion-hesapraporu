"use client";

// Sıralanabilir sütun başlığı ve süzgeç şeridi — iki tablonun paylaştığı kabuk.
//
// Marka dili: gösterge RENK değil OK'tur ve yalnız etkin sütunda görünür;
// sıralama bir durum bildirimidir, bir vurgu değil. Başlığın kendisi bir
// düğmedir (`aria-sort` ile) — tıklanabilir alanı hücrenin tamamıdır.

import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SortableHead<K extends string>({
  sortKey,
  current,
  desc,
  onSort,
  className,
  align = "left",
  children,
}: {
  sortKey: K;
  current: K;
  desc: boolean;
  onSort: (key: K) => void;
  className?: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const etkin = current === sortKey;
  return (
    <TableHead
      className={cn("p-0", className)}
      aria-sort={etkin ? (desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          // Dokunma payı `pointer-coarse:` ile gelir, kırılımla değil.
          "flex w-full items-center gap-1 px-2 py-2 text-left transition-colors hover:text-foreground pointer-coarse:py-2.5",
          align === "right" && "justify-end",
          etkin ? "font-medium text-foreground" : "text-muted-foreground"
        )}
      >
        {children}
        {etkin ? (
          desc ? (
            <ArrowDown className="size-3 shrink-0" />
          ) : (
            <ArrowUp className="size-3 shrink-0" />
          )
        ) : (
          <ChevronsUpDown className="size-3 shrink-0 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

/** Arama kutusu — 16px yazı (iOS 16px altında sayfayı kendiliğinden yakınlaştırır). */
export function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-8 text-base pointer-fine:text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Aramayı temizle"
          className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground pointer-coarse:size-9"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Süzgeç şeridi kabuğu — sayaç ve "temizle" tek yerde. */
export function FilterBar({
  gorunen,
  toplam,
  temiz,
  onTemizle,
  children,
}: {
  gorunen: number;
  toplam: number;
  temiz: boolean;
  onTemizle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="oc-scrollx flex flex-wrap items-center gap-2 border bg-card px-3 py-2 [--oc-scroll-bg:var(--card)]">
      {children}
      <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
        {gorunen === toplam
          ? `${toplam.toLocaleString("tr-TR")} Satır`
          : `${gorunen.toLocaleString("tr-TR")} / ${toplam.toLocaleString("tr-TR")} Satır`}
      </span>
      {!temiz && (
        <Button type="button" variant="ghost" size="xs" onClick={onTemizle}>
          Süzgeci temizle
        </Button>
      )}
    </div>
  );
}

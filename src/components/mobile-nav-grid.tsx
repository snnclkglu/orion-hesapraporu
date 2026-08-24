"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface MobileRouteOption {
  href: string;
  label: string;
  badge?: ReactNode;
}

export interface MobileSectionOption<Value extends string = string> {
  value: Value;
  label: string;
}

/**
 * Mobil bölüm gezintisinin ortak sütun düzeni.
 *
 * Beş-altı seçenek 360px üstünde üç sütun × iki satıra yerleşir. Daha küçük
 * telefonlarda kutuların okunabilirliğini korumak için iki sütuna iner; çok
 * kalabalık Yönetim/teklif gezintileri gerektiği kadar doğal satır açar.
 */
function columnsFor(count: number): string {
  if (count <= 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-2 min-[360px]:grid-cols-3";
  if (count === 4) return "grid-cols-2";
  if (count <= 6) return "grid-cols-2 min-[360px]:grid-cols-3";
  return "grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-4";
}

const itemClass =
  "flex min-h-11 min-w-0 items-center justify-center gap-1.5 border bg-card px-2 py-2 text-center text-[13px] leading-tight transition-colors [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function stateClass(active: boolean): string {
  return active
    ? "border-primary bg-primary/[0.08] font-semibold text-foreground shadow-[inset_0_-3px_0_var(--primary)]"
    : "border-border text-muted-foreground hover:border-foreground/25 hover:bg-muted hover:text-foreground";
}

/** Ayrı adreslere giden mobil bölüm kutuları. */
export function MobileRouteGrid({
  value,
  options,
  label,
  className,
}: {
  value: string;
  options: readonly MobileRouteOption[];
  label: string;
  className?: string;
}) {
  return (
    <nav
      className={cn("grid min-w-0 gap-2", columnsFor(options.length), className)}
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.href === value;
        return (
          <Link
            key={option.href}
            href={option.href}
            aria-current={active ? "page" : undefined}
            className={cn(itemClass, stateClass(active))}
          >
            <span className="min-w-0">{option.label}</span>
            {option.badge}
          </Link>
        );
      })}
    </nav>
  );
}

/** Aynı editör içinde görünür paneli değiştiren mobil bölüm kutuları. */
export function MobileSectionGrid<Value extends string>({
  value,
  options,
  label,
  onValueChange,
  className,
}: {
  value: Value;
  options: readonly MobileSectionOption<Value>[];
  label: string;
  onValueChange: (value: Value) => void;
  className?: string;
}) {
  return (
    <nav
      className={cn("grid min-w-0 gap-2", columnsFor(options.length), className)}
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onValueChange(option.value)}
            aria-current={active ? "page" : undefined}
            className={cn(itemClass, stateClass(active))}
          >
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}

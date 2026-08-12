"use client";

// ÇOKLU SEÇİMLİ SÜZGEÇ — Satın Alma'nın beş ekranının ORTAK bileşeni.
//
// Kullanıcı kararı (12.08.2026, md. 6): "Bir veya daha fazla işi
// seçebilmeliyim. Kategori ve Durum filtresinde birden fazla seçebilmeliyim."
//
// ═══════════════════════════════════════════════ NEDEN `Select` DEĞİL
//
// Radix `Select` TEK değerlidir; çoklu seçim için `DropdownMenu` + onay kutusu
// kalıbı kullanılır. Fark yalnız teknik değil: tek seçimde açılır liste
// seçimden sonra KAPANIR, çokluda KAPANMAMALIDIR — kullanıcı üç kategoriyi
// arka arkaya işaretler ve her seferinde listeyi yeniden açmak zorunda
// kalmamalıdır (`onSelect` içinde `preventDefault`).
//
// SEÇİM SAYISI TETİKTE GÖRÜNÜR: kapalı bir açılır listenin arkasında üç seçili
// madde varsa ve tetik yalnız "Kategori" yazıyorsa, kullanıcı listenin neden
// kısa olduğunu anlamaz — bu, süzgeçlerde en sık yapılan hatadır.

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface CokluSecenek {
  value: string;
  label: string;
  /** Sağda gri sayı — o seçenekte kaç satır olduğunu söyler. */
  count?: number;
}

/**
 * Çoklu seçimli süzgeç düğmesi.
 *
 * BOŞ SEÇİM = TÜMÜ. Bu, "hiçbiri" ile karıştırılmaz ve kasıtlıdır: süzgeç
 * temizlendiğinde liste dolu kalmalıdır. "Hiçbiri"ni ifade etmenin bir yolu
 * yoktur ve gerek de yoktur — kullanıcı hiçbir şey görmek istemez.
 */
export function CokluSuzgec({
  baslik,
  secenekler,
  secili,
  onChange,
  className,
}: {
  baslik: string;
  secenekler: CokluSecenek[];
  secili: readonly string[];
  onChange: (v: string[]) => void;
  className?: string;
}) {
  if (secenekler.length === 0) return null;
  const küme = new Set(secili);

  function degistir(v: string) {
    const y = new Set(küme);
    if (y.has(v)) y.delete(v);
    else y.add(v);
    onChange([...y]);
  }

  const etiket =
    küme.size === 0
      ? baslik
      : küme.size === 1
        ? (secenekler.find((s) => s.value === [...küme][0])?.label ?? baslik)
        : `${baslik}: ${küme.size}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 min-w-[7.5rem] justify-between gap-1 text-base font-normal pointer-fine:text-sm",
            küme.size > 0 && "border-primary/50 bg-primary/[0.06]",
            className
          )}
        >
          <span className="truncate">{etiket}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(24rem,60dvh)] min-w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto"
      >
        <DropdownMenuLabel className="oc-kicker flex items-center justify-between text-muted-foreground">
          {baslik}
          {küme.size > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] normal-case tracking-normal underline-offset-2 hover:underline"
            >
              temizle
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {secenekler.map((s) => {
          const acik = küme.has(s.value);
          return (
            <DropdownMenuItem
              key={s.value}
              // LİSTE KAPANMAZ: çoklu seçimde her tıklamada yeniden açmak
              // kullanılamaz bir süzgeç üretir.
              onSelect={(e) => {
                e.preventDefault();
                degistir(s.value);
              }}
              className="gap-2"
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center border",
                  acik ? "border-primary bg-primary text-primary-foreground" : "border-border"
                )}
                aria-hidden
              >
                {acik && <Check className="size-3" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {s.count != null && (
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                  {s.count}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

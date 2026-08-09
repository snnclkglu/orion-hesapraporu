"use client";

// Aranabilir tek seçimli açılır liste.
//
// NEDEN `Select` DEĞİL: Select kısa ve sabit listeler içindir (para birimi,
// durum). İş Takibi'nde seçilecek şeyler yetmiş iş kalemi ve kırk beş parçadır;
// aramasız bir listede doğru satırı bulmak günlük girişi yavaşlatan asıl
// şeydir. Burada kutu açıldığı anda imleç arama alanındadır: kullanıcı üç harf
// yazıp Enter'a basar.
//
// SÜZME KENDİMİZDE (`shouldFilter={false}`): cmdk'nin varsayılan eşleyicisi
// Türkçe'yi bilmez — "İŞ" yazan biri "iş"i bulamaz, "ı/i" ve "İ/I" çiftleri
// karışır. Süzgeç `toLocaleLowerCase("tr")` ile normalize edilmiş metin
// üzerinde çalışır ve etiketin yanında ANAHTAR SÖZCÜKLERE de bakar (müşteri
// kısaltması, ürün adı, grup kodu).

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  /** İkinci satırda gösterilen açıklama (ürün adı, müşteri…) */
  hint?: string;
  /** Aramaya dâhil edilecek ek metinler */
  keywords?: string[];
  /** Satırın solunda renk noktası */
  hue?: number;
  /** Sağda gri bir rozet (kayıt sayısı, kod…) */
  badge?: string;
}

function norm(text: string): string {
  return (text ?? "").toLocaleLowerCase("tr").trim();
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seçin",
  searchPlaceholder = "Ara…",
  emptyText = "Kayıt bulunamadı",
  /** Aramada yazılan metinle yeni kayıt açma; verilmezse seçenek gösterilmez */
  onCreate,
  createLabel = "Ekle",
  disabled,
  className,
  contentClassName,
  /** Tetikleyicideki metnin yanında gösterilecek ek bilgi */
  renderTrigger,
}: {
  options: readonly ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onCreate?: (name: string) => void | Promise<void>;
  createLabel?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  renderTrigger?: (selected: ComboOption | null) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    // Boşlukla ayrılmış her parça ayrı aranır: "asto kiriş" hem müşteriyi
    // hem parçayı taşıyan satırı bulur, sırası önemli olmaz.
    const terms = q.split(/\s+/).filter(Boolean);
    return options.filter((o) => {
      const hay = norm([o.label, o.hint ?? "", o.badge ?? "", ...(o.keywords ?? [])].join(" "));
      return terms.every((t) => hay.includes(t));
    });
  }, [options, query]);

  const trimmed = query.trim();
  const canCreate =
    Boolean(onCreate) &&
    trimmed.length > 1 &&
    !options.some((o) => norm(o.label) === norm(trimmed));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between px-2 font-normal", className)}
        >
          <span className={cn("min-w-0 truncate text-left", !selected && "text-muted-foreground")}>
            {renderTrigger ? renderTrigger(selected) : (selected?.label ?? placeholder)}
          </span>
          <span
            aria-hidden
            className="ml-1 shrink-0 font-mono text-xs leading-none text-muted-foreground"
          >
            ▾
          </span>
        </Button>
      </PopoverTrigger>
      {/* PopoverContent varsayılanı w-72 + p-4 + gap-4'tür; liste için
          tetikleyici genişliğine oturtulur ve iç boşluk sıfırlanır. */}
      <PopoverContent
        align="start"
        className={cn(
          "w-(--radix-popover-trigger-width) min-w-[16rem] gap-0 p-0",
          contentClassName
        )}
      >
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {canCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={() => {
                    void onCreate?.(trimmed);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="truncate">
                    <span className="font-mono text-xs text-primary">+</span> {createLabel}:{" "}
                    <span className="font-medium">{trimmed}</span>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  // CommandItem kendi ✓ ikonunu basar; yalnız bu bayrakla görünür.
                  data-checked={o.value === value ? "true" : undefined}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {o.hue !== undefined && (
                    <span
                      className="oc-tag-dot"
                      style={{ "--oc-hue": String(o.hue) } as React.CSSProperties}
                      aria-hidden
                    />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{o.label}</span>
                    {o.hint && (
                      <span className="truncate text-[11px] text-muted-foreground">{o.hint}</span>
                    )}
                  </span>
                  {o.badge && (
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                      {o.badge}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

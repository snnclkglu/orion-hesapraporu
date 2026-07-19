"use client";

// "Katalogdan Seç" combobox'u — cat_equipment'tan ilgili kind'e göre
// arama/filtre yapar (marka + model + ana özellik). Bölüm başına lazy:
// veri ilk açılışta çekilir, arama sunucu tarafında (ilike) daraltılır.
// Seçim, catalog-mapping.ts eşlemesiyle bölümün selection alanlarını doldurur.

import { useEffect, useState } from "react";
import { BookOpen, ChevronsUpDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  catalogRowSummary,
  type CatalogRow,
  type SectionCatalogMapping,
} from "@/lib/catalog-mapping";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const PAGE_SIZE = 50;

export function CatalogPicker({
  mapping,
  onPick,
}: {
  mapping: SectionCatalogMapping;
  onPick: (row: CatalogRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const supabase = createClient();
      let q = supabase
        .from("cat_equipment")
        .select("id, brand, model, attrs")
        .eq("kind", mapping.kind)
        .eq("active", true);
      // PostgREST or() sözdizimini bozan karakterler temizlenir
      const s = query.trim().replace(/[,()%\\]/g, "");
      if (s !== "") q = q.or(`brand.ilike.*${s}*,model.ilike.*${s}*`);
      const { data, error } = await q
        .order("sort")
        .order("brand")
        .order("model")
        .limit(PAGE_SIZE);
      if (!cancelled) {
        setRows(error ? [] : ((data ?? []) as CatalogRow[]));
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, mapping.kind]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <BookOpen className="size-3.5" />
          Katalogdan Seç
          <ChevronsUpDown className="size-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        {/* Sunucu tarafı arama kullanıldığından cmdk'nin kendi filtresi kapalı */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Marka / model ara..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Yükleniyor...
              </div>
            )}
            {!loading && (rows?.length ?? 0) === 0 && (
              <CommandEmpty>
                {query.trim() === "" ? "Katalog boş" : "Sonuç bulunamadı"}
              </CommandEmpty>
            )}
            {!loading &&
              rows?.map((row) => (
                <CommandItem
                  key={row.id}
                  value={row.id}
                  onSelect={() => {
                    onPick(row);
                    setOpen(false);
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium">
                    {row.brand} · {row.model}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {catalogRowSummary(mapping.kind, row)}
                  </span>
                </CommandItem>
              ))}
            {!loading && rows?.length === PAGE_SIZE && (
              <div className="border-t px-3 py-1.5 text-center text-[11px] text-muted-foreground">
                İlk {PAGE_SIZE} sonuç gösteriliyor — daraltmak için arayın
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

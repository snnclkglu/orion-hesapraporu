"use client";

// "Katalogdan Seç" — iki adımlı modal. Önce MARKA seçilir (ilgili kind'in
// markaları kart olarak listelenir), sonra o markanın kataloğu (modeller +
// ana özellik) açılır; arama yalnızca seçilen marka içinde daraltır. Bu,
// tüm ürünlerin tek karışık listede açılması sorununu giderir.
// Seçim, catalog-mapping.ts eşlemesiyle bölümün selection alanlarını doldurur.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  catalogRowSummary,
  type CatalogRow,
  type SectionCatalogMapping,
} from "@/lib/catalog-mapping";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface BrandInfo {
  brand: string;
  count: number;
}

export function CatalogPicker({
  mapping,
  onPick,
}: {
  mapping: SectionCatalogMapping;
  onPick: (row: CatalogRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"brand" | "model">("brand");
  const [brand, setBrand] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandInfo[] | null>(null);
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal açıldığında sıfırla
  useEffect(() => {
    if (open) {
      setStep("brand");
      setBrand(null);
      setQuery("");
      setRows(null);
    }
  }, [open]);

  // Marka listesini çek (kind'in tüm ürünlerinden markaları türet)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cat_equipment")
        .select("brand")
        .eq("kind", mapping.kind)
        .eq("active", true)
        .limit(10000);
      if (cancelled) return;
      if (error || !data) {
        setBrands([]);
      } else {
        const counts = new Map<string, number>();
        for (const r of data as { brand: string }[]) {
          counts.set(r.brand, (counts.get(r.brand) ?? 0) + 1);
        }
        setBrands(
          [...counts.entries()]
            .map(([b, count]) => ({ brand: b, count }))
            .sort((a, b) => a.brand.localeCompare(b.brand, "tr"))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mapping.kind]);

  // Seçilen markanın kataloğunu çek
  useEffect(() => {
    if (!open || step !== "model" || !brand) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cat_equipment")
        .select("id, brand, model, attrs")
        .eq("kind", mapping.kind)
        .eq("brand", brand)
        .eq("active", true)
        .order("sort")
        .order("model")
        .limit(2000);
      if (cancelled) return;
      setRows(error ? [] : ((data ?? []) as CatalogRow[]));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, brand, mapping.kind]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = query.trim().toLocaleLowerCase("tr");
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.model.toLocaleLowerCase("tr").includes(s) ||
        catalogRowSummary(mapping.kind, r).toLocaleLowerCase("tr").includes(s)
    );
  }, [rows, query, mapping.kind]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <BookOpen className="size-3.5" />
          Katalogdan Seç
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2 text-base">
            {step === "model" && (
              <button
                type="button"
                onClick={() => setStep("brand")}
                className="grid size-6 place-items-center rounded hover:bg-muted"
                aria-label="Markalara dön"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <BookOpen className="size-4 text-primary" />
            {step === "brand" ? "Marka Seçin" : brand}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "brand"
              ? "Önce üretici markayı seçin, ardından o markanın kataloğu açılır."
              : `${mapping.kind} kataloğu — model ve özellik seçin`}
          </DialogDescription>
        </DialogHeader>

        {step === "brand" ? (
          <div className="max-h-[60vh] overflow-y-auto p-4">
            {loading && !brands && (
              <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
            )}
            {brands && brands.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Katalog boş</p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {brands?.map((b) => (
                <button
                  key={b.brand}
                  type="button"
                  onClick={() => {
                    setBrand(b.brand);
                    setQuery("");
                    setStep("model");
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{b.brand}</span>
                    <span className="text-[11px] text-muted-foreground">{b.count} ürün</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="relative border-b px-4 py-2.5">
              <Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Model / özellik ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {loading && (
                <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
              )}
              {!loading && filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Sonuç bulunamadı</p>
              )}
              {!loading &&
                filtered.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      onPick(row);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="text-sm font-medium">{row.model}</span>
                    <span className="text-xs text-muted-foreground">
                      {catalogRowSummary(mapping.kind, row)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

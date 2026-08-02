"use client";

// "Katalogdan Seç" — kademeli filtreli seçim penceresi.
//
// Akış: MARKA → türe özgü filtre adımları (ör. halatta yapı → tel mukavemeti →
// öz tipi) → filtrelenmiş ÜRÜN TABLOSU. Her adımda yalnız o ana kadarki
// seçimlerle uyumlu değerler, ürün adedi rozetiyle listelenir; böylece binlerce
// satırlık bir katalogda birkaç tıkla doğru satıra inilir.
//
// Filtre adımları ve tablo sütunları `catalog-mapping.ts` içindeki
// CATALOG_KINDS yapılandırmasından gelir. Ayrıca kapasite değeri için "en az"
// süzgeci ve serbest metin araması vardır.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandIcon } from "@/components/brand-icon";
import {
  attrValueLabel,
  catalogCellValue,
  catalogKindConfig,
  catalogKindLabel,
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
import { cn } from "@/lib/utils";

interface BrandInfo {
  brand: string;
  count: number;
}

/** Seçili facet değerleriyle satırları süzer (ilk `upTo` adım uygulanır). */
function filterRows(
  all: CatalogRow[],
  facets: readonly { attr: string }[],
  picks: Record<string, string>,
  upTo: number
): CatalogRow[] {
  let out = all;
  for (let i = 0; i < upTo; i++) {
    const pick = picks[facets[i].attr];
    if (pick === undefined) continue;
    out = out.filter(
      (r) => String(catalogCellValue(r, facets[i].attr) ?? "") === pick
    );
  }
  return out;
}

/** Facet değerlerini sayısal/alfabetik olarak sıralar. */
function sortValues(values: unknown[]): unknown[] {
  const allNumeric = values.every((v) => typeof v === "number");
  if (allNumeric) return [...values].sort((a, b) => (a as number) - (b as number));
  return [...values].sort((a, b) =>
    String(a).localeCompare(String(b), "tr", { numeric: true })
  );
}

export function CatalogPicker({
  mapping,
  onPick,
}: {
  mapping: SectionCatalogMapping;
  onPick: (row: CatalogRow) => void;
}) {
  const config = useMemo(() => catalogKindConfig(mapping.kind), [mapping.kind]);
  const kindLabel = catalogKindLabel(mapping.kind);

  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandInfo[] | null>(null);
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  /** Seçilen facet değerleri: attr → değer (string'e çevrilmiş) */
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [minValue, setMinValue] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Pencere açıldığında sıfırla
  useEffect(() => {
    if (open) {
      setBrand(null);
      setRows(null);
      setPicks({});
      setMinValue("");
      setQuery("");
    }
  }, [open]);

  // Marka listesi
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

  // Seçilen markanın kataloğu
  useEffect(() => {
    if (!open || !brand) return;
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
        .limit(5000);
      if (cancelled) return;
      setRows(error ? [] : ((data ?? []) as CatalogRow[]));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, brand, mapping.kind]);

  /** Tüm facet seçimleri + "en az" + arama uygulanmış sonuç. */
  const results = useMemo(() => {
    if (!rows) return [];
    let out = filterRows(rows, config.facets, picks, config.facets.length);
    if (config.minFilter && minValue.trim() !== "") {
      const min = parseFloat(minValue.replace(",", "."));
      if (Number.isFinite(min)) {
        out = out.filter((r) => {
          const v = catalogCellValue(r, config.minFilter!.attr);
          return typeof v === "number" && v >= min;
        });
      }
    }
    const s = query.trim().toLocaleLowerCase("tr");
    if (s) {
      out = out.filter((r) => {
        const hay = [
          r.model,
          ...config.columns.map((c) =>
            String(catalogCellValue(r, c.attr) ?? "")
          ),
        ]
          .join(" ")
          .toLocaleLowerCase("tr");
        return hay.includes(s);
      });
    }
    if (config.sortBy) {
      const key = config.sortBy;
      out = [...out].sort((a, b) => {
        const av = catalogCellValue(a, key);
        const bv = catalogCellValue(b, key);
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av ?? "").localeCompare(String(bv ?? ""), "tr", { numeric: true });
      });
    }
    return out;
  }, [rows, picks, minValue, query, config]);

  /** Adım adım facet seçenekleri (her adım kendinden öncekilerle süzülür). */
  const facetSteps = useMemo(() => {
    if (!rows) return [];
    return config.facets.map((f, i) => {
      const scope = filterRows(rows, config.facets, picks, i);
      const counts = new Map<string, { value: unknown; count: number }>();
      for (const r of scope) {
        const raw = catalogCellValue(r, f.attr);
        if (raw === null || raw === undefined || raw === "") continue;
        const k = String(raw);
        const cur = counts.get(k);
        if (cur) cur.count += 1;
        else counts.set(k, { value: raw, count: 1 });
      }
      const values = sortValues([...counts.values()].map((c) => c.value));
      return {
        facet: f,
        options: values.map((v) => ({
          key: String(v),
          value: v,
          count: counts.get(String(v))!.count,
        })),
        /** Önceki adım seçilmediyse bu adım henüz açılmaz */
        unlocked: i === 0 || picks[config.facets[i - 1].attr] !== undefined,
      };
    });
  }, [rows, picks, config]);

  const activeFilterCount =
    Object.keys(picks).length + (minValue.trim() !== "" ? 1 : 0);

  function setPick(attr: string, key: string | null) {
    setPicks((prev) => {
      const next = { ...prev };
      if (key === null) delete next[attr];
      else next[attr] = key;
      // Sonraki adımların seçimleri geçersizleşir → temizle
      const idx = config.facets.findIndex((f) => f.attr === attr);
      if (idx >= 0) {
        for (let i = idx + 1; i < config.facets.length; i++) {
          delete next[config.facets[i].attr];
        }
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <BrandIcon name="panel" className="size-3.5" />
          Katalogdan Seç
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2 text-base">
            {brand && (
              <button
                type="button"
                onClick={() => {
                  setBrand(null);
                  setRows(null);
                  setPicks({});
                  setMinValue("");
                  setQuery("");
                }}
                className="grid size-7 place-items-center border hover:bg-muted"
                aria-label="Markalara dön"
              >
                <span aria-hidden="true" className="font-mono">←</span>
              </button>
            )}
            <BrandIcon name="panel" className="size-4 text-primary" />
            {brand ? `${kindLabel} · ${brand}` : `${kindLabel} — Marka Seçin`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {brand
              ? "Özellikleri sırayla daraltın; alttaki tablodan ürünü seçin."
              : "Önce üretici markayı seçin, ardından özellik süzgeçleri açılır."}
          </DialogDescription>
        </DialogHeader>

        {!brand ? (
          // ------------------------------------------------------ 1) Marka
          <div className="max-h-[65vh] overflow-y-auto p-4">
            {loading && !brands && (
              <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
            )}
            {brands && brands.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Bu tür için katalogda kayıt yok.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {brands?.map((b) => (
                <button
                  key={b.brand}
                  type="button"
                  onClick={() => setBrand(b.brand)}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{b.brand}</span>
                    <span className="text-[11px] text-muted-foreground">{b.count} ürün</span>
                  </span>
                  <span aria-hidden className="shrink-0 font-mono text-sm text-muted-foreground">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex max-h-[72vh] flex-col">
            {/* ------------------------------------------- 2) Filtre adımları */}
            {(config.facets.length > 0 || config.minFilter) && (
              <div className="grid gap-2.5 border-b bg-muted/30 px-4 py-3">
                {facetSteps.map((step, i) => (
                  <div
                    key={step.facet.attr}
                    className={cn(
                      "grid gap-1.5",
                      !step.unlocked && "pointer-events-none opacity-40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-4 shrink-0 items-center justify-center bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="oc-kicker text-muted-foreground">
                        {step.facet.label}
                        {step.facet.unit ? ` [${step.facet.unit}]` : ""}
                      </span>
                      {picks[step.facet.attr] !== undefined && (
                        <button
                          type="button"
                          onClick={() => setPick(step.facet.attr, null)}
                          className="font-mono text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          temizle
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {step.options.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          Uygun değer yok
                        </span>
                      )}
                      {step.options.map((o) => {
                        const active = picks[step.facet.attr] === o.key;
                        return (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => setPick(step.facet.attr, active ? null : o.key)}
                            className={cn(
                              "inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors",
                              active
                                ? "border-primary bg-primary/10 font-medium text-primary"
                                : "bg-background hover:bg-muted"
                            )}
                          >
                            {attrValueLabel(step.facet.attr, o.value)}
                            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                              {o.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {config.minFilter && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="inline-flex size-4 shrink-0 items-center justify-center bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                      {config.facets.length + 1}
                    </span>
                    <span className="oc-kicker text-muted-foreground">
                      {config.minFilter.label}
                      {config.minFilter.unit ? ` [${config.minFilter.unit}]` : ""}
                    </span>
                    <Input
                      value={minValue}
                      onChange={(e) => setMinValue(e.target.value)}
                      inputMode="decimal"
                      placeholder="—"
                      className="h-7 w-28 bg-background font-mono text-xs tabular-nums"
                      aria-label={config.minFilter.label}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------- 3) Sonuç tablosu */}
            <div className="flex items-center gap-2 border-b px-4 py-2">
              <Input
                placeholder="Tabloda ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 flex-1"
              />
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {results.length} ürün
                {activeFilterCount > 0 ? ` · ${activeFilterCount} süzgeç` : ""}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {loading && (
                <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
              )}
              {!loading && results.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Süzgeçlere uyan ürün yok — bir adımı temizleyip tekrar deneyin.
                </p>
              )}
              {!loading && results.length > 0 && (
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {config.columns.map((c) => (
                        <th
                          key={String(c.attr)}
                          className="border-b bg-muted px-3 py-1.5 text-left text-[11px] font-semibold whitespace-nowrap text-muted-foreground"
                        >
                          {c.label}
                          {c.unit ? (
                            <span className="ml-1 font-mono font-normal">[{c.unit}]</span>
                          ) : null}
                        </th>
                      ))}
                      <th className="border-b bg-muted px-3 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => {
                          onPick(row);
                          setOpen(false);
                        }}
                        className="cursor-pointer border-b transition-colors last:border-0 hover:bg-primary/5"
                      >
                        {config.columns.map((c) => {
                          const v = catalogCellValue(row, c.attr);
                          return (
                            <td
                              key={String(c.attr)}
                              className={cn(
                                "px-3 py-1.5 whitespace-nowrap",
                                typeof v === "number"
                                  ? "font-mono tabular-nums"
                                  : c.attr === "model"
                                    ? "font-medium"
                                    : ""
                              )}
                            >
                              {attrValueLabel(String(c.attr), v)}
                            </td>
                          );
                        })}
                        <td className="px-3 py-1.5 text-right">
                          <span className="font-mono text-[11px] text-primary">Seç →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

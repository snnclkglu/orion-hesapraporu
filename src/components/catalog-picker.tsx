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

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandIcon } from "@/components/brand-icon";
import {
  attrValueLabel,
  catalogCellValue,
  catalogKindConfig,
  catalogKindLabel,
  isUnverifiedRow,
  lockedFacetValues,
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

/**
 * PostgREST tek yanıtta en çok `max_rows` satır döndürür (bu projede **1000**)
 * ve istemcinin `.limit()` değeri bunu AŞAMAZ. Katalogda bir markanın satır
 * sayısı bunun katı olduğundan (Yılmaz kaldırma redüktörleri 5.407) tek istek
 * listeyi SESSİZCE ilk 1000 satıra kırpar. Bu yüzden sayfa sayfa çekilir.
 */
const PAGE_SIZE = 1000;

/** Sayfalamanın üst sınırı — kaçak bir döngüye karşı emniyet. */
const ROW_LIMIT = 20000;

/** Ardışık sayfaları, kısa bir sayfa gelene kadar toplar. */
async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ rows: T[]; truncated: boolean }> {
  const out: T[] = [];
  for (let from = 0; from < ROW_LIMIT; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { rows: out, truncated: false };
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows: out, truncated: false };
  }
  return { rows: out, truncated: true };
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
  const locked = useMemo(
    () => Object.entries(mapping.lockedFacets ?? {}),
    [mapping.lockedFacets]
  );
  // Kilitli filtreler sunucuda uygulandığı için adım olarak gösterilmez.
  const config = useMemo(() => {
    const base = catalogKindConfig(mapping.kind);
    if (locked.length === 0) return base;
    const lockedAttrs = new Set(locked.map(([a]) => a));
    return { ...base, facets: base.facets.filter((f) => !lockedAttrs.has(f.attr)) };
  }, [mapping.kind, locked]);
  const kindLabel = catalogKindLabel(mapping.kind);
  // Kilitli süzgeç birden çok katalog kodunu kapsayabilir (ör. tambur kaplini
  // = "drum" + "barrel"); rozet hepsini "/" ile birleştirerek gösterir.
  const lockedLabel = locked
    .map(([attr, value]) =>
      lockedFacetValues(value)
        .map((v) => attrValueLabel(attr, v))
        .join(" / ")
    )
    .join(" · ");

  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandInfo[] | null>(null);
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  const [truncated, setTruncated] = useState(false);
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
      setTruncated(false);
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
      // Marka kartındaki ürün adedi doğru olmalı: tek istek 1000'de kesileceği
      // için markalar da sayfa sayfa toplanır (yalnız `brand` sütunu çekilir).
      const { rows: brandRows } = await fetchAllPages<{ brand: string }>(
        (from, to) => {
          let q = supabase
            .from("cat_equipment")
            .select("brand")
            .eq("kind", mapping.kind)
            .eq("active", true);
          // Tek değerde eşitlik, çok değerde "in" — ikisi de sunucu tarafında.
          for (const [attr, value] of locked) {
            const values = lockedFacetValues(value);
            q = values.length === 1
              ? q.eq(`attrs->>${attr}`, values[0])
              : q.in(`attrs->>${attr}`, values);
          }
          return q.order("id").range(from, to);
        }
      );
      if (cancelled) return;
      const counts = new Map<string, number>();
      for (const r of brandRows) counts.set(r.brand, (counts.get(r.brand) ?? 0) + 1);
      setBrands(
        [...counts.entries()]
          .map(([b, count]) => ({ brand: b, count }))
          .sort((a, b) => a.brand.localeCompare(b.brand, "tr"))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mapping.kind, locked]);

  // Seçilen markanın kataloğu
  useEffect(() => {
    if (!open || !brand) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { rows: list, truncated: cut } = await fetchAllPages<CatalogRow>(
        (from, to) => {
          let q = supabase
            .from("cat_equipment")
            .select("id, brand, model, attrs")
            .eq("kind", mapping.kind)
            .eq("brand", brand)
            .eq("active", true);
          // Tek değerde eşitlik, çok değerde "in" — ikisi de sunucu tarafında.
          for (const [attr, value] of locked) {
            const values = lockedFacetValues(value);
            q = values.length === 1
              ? q.eq(`attrs->>${attr}`, values[0])
              : q.in(`attrs->>${attr}`, values);
          }
          // Sayfalama kararlı bir toplam sıra ister; `id` eşitlik bozucudur.
          return q.order("sort").order("model").order("id").range(from, to);
        }
      );
      if (cancelled) return;
      setRows(list);
      setTruncated(cut);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, brand, mapping.kind, locked]);

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

  /**
   * Listede üretici teyidi olmayan satır var mı? Bu satırlar (firma Excel'inden
   * gelen tamponlar) katalogda dururlar ama hiçbir üretici belgesiyle
   * karşılaştırılamamıştır; seçilmeden önce mühendisin bunu görmesi gerekir.
   */
  const hasUnverified = results.some(isUnverifiedRow);

  /**
   * Satır tıklamasının başladığı nokta. Ürün tablosu yatay kaydırılabilir bir
   * kapta durur; parmakla yana kaydırınca tarayıcı kaydırmanın sonunda satıra
   * bir `click` üretiyor ve pencere YANLIŞ ürünle kapanıyordu. Vinç hesabında
   * yanlış redüktör sessiz bir hatadır — hareket eşiği bunu keser.
   */
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  function pickRow(row: CatalogRow) {
    onPick(row);
    setOpen(false);
  }

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
      {/*
        Yükseklik TEK kaynaktan gelir. Eskiden üç ayrı `vh` sınırı vardı
        (88/65/72) ve `vh` mobilde adres çubuğu gizliyken ölçüldüğü için
        pencerenin altı ekranın dışında kalıyordu. Artık dış kap `dvh` ile
        kelepçelenir, iç bölgeler `flex-1 min-h-0` ile pay alır.
        `sm:gap-0 sm:p-0`: taban `sm:p-6`/`sm:gap-6` taşıyor ve `p-0`/`gap-0`
        yalnız ön ek taşımayan sınıfı eziyor — tam kenarlı düzen bozuluyordu.
      */}
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(64rem,calc(100%-2rem))] sm:gap-0 sm:p-0">
        {/* `px-*` tabanın `pr-8`ini siler (tailwind-merge); kapatma X'inin
            payı burada yeniden verilir, yoksa başlık X'in altına girer. */}
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 sm:px-5 sm:py-3.5 sm:pr-14">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
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
                // Pencerenin tek geri yolu — 28px'lik hedef parmakla ıskalanıyordu.
                className="grid size-9 shrink-0 place-items-center border hover:bg-muted pointer-coarse:size-10"
                aria-label="Markalara dön"
              >
                <span aria-hidden="true" className="font-mono">←</span>
              </button>
            )}
            <BrandIcon name="panel" className="size-4 text-primary" />
            {brand ? `${kindLabel} · ${brand}` : `${kindLabel} — Marka Seçin`}
            {lockedLabel && (
              <span className="border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                {lockedLabel}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {brand
              ? "Özellikleri sırayla daraltın; alttaki tablodan ürünü seçin."
              : "Önce üretici markayı seçin, ardından özellik süzgeçleri açılır."}
            {lockedLabel && ` Yalnız ${lockedLabel.toLocaleLowerCase("tr")} grubuna uygun ürünler listelenir.`}
          </DialogDescription>
          {truncated && (
            <p className="text-xs text-destructive">
              Katalog {ROW_LIMIT.toLocaleString("tr-TR")} satır sınırına ulaştı; liste
              eksik olabilir. Süzgeçleri daraltın.
            </p>
          )}
        </DialogHeader>

        {!brand ? (
          // ------------------------------------------------------ 1) Marka
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {loading && !brands && (
              <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
            )}
            {brands && brands.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Bu tür için katalogda kayıt yok.
              </p>
            )}
            {/* 375px'te iki sütun kart başına ~151px bırakıyor ve
                "CONDUCTIX-WAMPFLER" gibi marka adları kırpılıyordu. */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {brands?.map((b) => (
                <button
                  key={b.brand}
                  type="button"
                  onClick={() => setBrand(b.brand)}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium" title={b.brand}>
                      {b.brand}
                    </span>
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
          <div className="flex min-h-0 flex-1 flex-col">
            {/* ------------------------------------------- 2) Filtre adımları */}
            {/* Blok eskiden ne yükseklikle sınırlıydı ne de kayıyordu: telefonda
                çip bulutu 600px'i aştığında ürün tablosu pencerenin dışında
                kalıyor ve ÜRÜN HİÇ SEÇİLEMİYORDU. Artık süzgeç kendi içinde
                kayar, tablo her zaman görünür pay alır. */}
            {(config.facets.length > 0 || config.minFilter) && (
              <div className="grid max-h-[34dvh] shrink-0 gap-2.5 overflow-y-auto overscroll-contain border-b bg-muted/30 px-4 py-3 sm:max-h-[45dvh]">
                {facetSteps.map((step, i) => (
                  <div
                    key={step.facet.attr}
                    className={cn(
                      "grid gap-1.5",
                      !step.unlocked && "pointer-events-none opacity-40"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex size-5 shrink-0 items-center justify-center bg-primary/10 font-mono text-[11px] font-semibold text-primary">
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
                          // Süzgeci geri almanın tek yolu; eski hâli ~42×13px'lik
                          // bir hedefti. Negatif kenar boşluğu satırı büyütmeden
                          // dokunma alanını 36/40px'e çıkarır.
                          className="-my-1.5 inline-flex min-h-9 items-center px-2 font-mono text-[11px] text-muted-foreground hover:text-destructive pointer-coarse:min-h-10"
                        >
                          temizle
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                            // Seçicinin ANA etkileşimi: 26px'lik çipler
                            // parmakla komşu değere basılmasına yol açıyordu.
                            className={cn(
                              "inline-flex min-h-9 items-center gap-1.5 border px-3 py-1.5 text-xs transition-colors pointer-coarse:min-h-10",
                              active
                                ? "border-primary bg-primary/10 font-medium text-primary"
                                : "bg-background hover:bg-muted"
                            )}
                          >
                            {attrValueLabel(step.facet.attr, o.value)}
                            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
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
                    <span className="inline-flex size-5 shrink-0 items-center justify-center bg-primary/10 font-mono text-[11px] font-semibold text-primary">
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
                      // 28px yükseklik + 12px yazı iOS'ta odaklanma zumunu
                      // tetikliyordu; dokunmatikte 16px yazı korunur.
                      className="h-9 w-28 bg-background font-mono text-base tabular-nums pointer-coarse:h-10 pointer-fine:text-xs"
                      aria-label={config.minFilter.label}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------- 3) Sonuç tablosu */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
              <Input
                placeholder="Tabloda ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 min-w-40 flex-1 pointer-coarse:h-10"
              />
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {results.length} ürün
                {activeFilterCount > 0 ? ` · ${activeFilterCount} süzgeç` : ""}
              </span>
            </div>

            {hasUnverified && (
              <p className="shrink-0 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
                ⚠ Bu listedeki bazı satırlar firma Excel&apos;inden gelmektedir ve
                ÜRETİCİ KATALOĞUYLA DOĞRULANMAMIŞTIR. Kullanmadan önce değerleri
                üreticiye teyit ettirin.
              </p>
            )}

            {/* Mobil tarayıcı kaydırma çubuğu çizmez: yanda sütun kaldığının
                tek ipucu kenar gölgesidir. Zemin pencere yüzeyidir. */}
            <div className="oc-scrollx min-h-0 flex-1 overflow-auto overscroll-x-contain [--oc-scroll-bg:var(--popover)]">
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
                        onPointerDown={(e) => {
                          pressStart.current = { x: e.clientX, y: e.clientY };
                        }}
                        onClick={(e) => {
                          const start = pressStart.current;
                          pressStart.current = null;
                          // Yatay kaydırma sonunda üretilen `click` yanlış ürünü
                          // seçiyordu; 10px'ten fazla hareket seçim sayılmaz.
                          if (
                            start &&
                            Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10
                          ) {
                            return;
                          }
                          pickRow(row);
                        }}
                        className="cursor-pointer border-b transition-colors last:border-0 hover:bg-primary/5"
                      >
                        {config.columns.map((c) => {
                          const v = catalogCellValue(row, c.attr);
                          return (
                            <td
                              key={String(c.attr)}
                              className={cn(
                                "px-3 py-2.5 whitespace-nowrap",
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
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {isUnverifiedRow(row) && (
                            <span
                              title="Üretici kataloğuyla doğrulanmamış veri"
                              className="mr-2 border border-destructive/40 px-1 py-0.5 font-mono text-[11px] text-destructive"
                            >
                              teyitsiz
                            </span>
                          )}
                          {/* Seçimin GERÇEK denetimi: `<tr onClick>` klavyeyle
                              odaklanamıyordu, yani ürün yalnız fareyle
                              seçilebiliyordu. */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              pickRow(row);
                            }}
                            className="-my-1 inline-flex min-h-9 items-center gap-1 border border-primary/40 bg-primary/5 px-2.5 font-mono text-[11px] text-primary transition-colors hover:bg-primary/15 pointer-coarse:min-h-10"
                          >
                            Seç
                            <span aria-hidden>→</span>
                          </button>
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

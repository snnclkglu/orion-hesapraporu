"use client";

// Ortak süzgeç şeridi — Analiz ve Kayıtlar ekranları aynı şeridi kullanır.
//
// SEÇENEKLER VERİDEN ÇIKAR, sabit listeden değil: yalnız kayıtlarda geçen
// müşteri, iş, parça ve tür listelenir. Böylece "hiçbir sonuç vermeyen
// süzgeç" seçilemez ve liste kendiliğinden güncel kalır.

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerTag } from "@/components/tags";
import { tagStyle } from "@/lib/tags";
import {
  PERIOD_LABELS,
  PERIOD_PRESETS,
  periodRange,
  todayIso,
  type PeriodPreset,
  type WorkLogRow,
} from "@/lib/work-log";
import { ALL, activeFilterCount, EMPTY_FILTERS, type WorkFilters } from "./filters";

/** "2026-06-01" → "01.06.26" — şeritte yer kaplamayan tarih. */
function shortDate(iso: string): string {
  return iso ? `${iso.slice(8)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : "…";
}

/** Süzgeç seçeneklerini kayıtlardan türetir. */
export function useFilterOptions(rows: readonly WorkLogRow[]) {
  return useMemo(() => {
    const customers = new Map<string, { short: string | null; hue: number | null }>();
    const jobs = new Map<string, string>();
    const items = new Map<string, string>();
    const parts = new Set<string>();
    const categories = new Map<string, number>();
    for (const r of rows) {
      if (r.customer) customers.set(r.customer, { short: r.customerShort, hue: r.customerHue });
      if (r.jobNo) jobs.set(r.jobNo, r.jobTitle);
      if (r.itemNo) items.set(r.itemNo, r.productName);
      if (r.partName) parts.add(r.partName);
      if (r.categoryName) categories.set(r.categoryName, r.categoryHue);
    }
    return {
      customers: [...customers.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr")),
      jobs: [...jobs.entries()].sort((a, b) => b[0].localeCompare(a[0], "tr", { numeric: true })),
      items: [...items.entries()].sort((a, b) => b[0].localeCompare(a[0], "tr", { numeric: true })),
      parts: [...parts].sort((a, b) => a.localeCompare(b, "tr")),
      categories: [...categories.entries()],
    };
  }, [rows]);
}

export function FilterBar({
  filters,
  onChange,
  options,
  shown,
  total,
  extra,
}: {
  filters: WorkFilters;
  onChange: (next: WorkFilters) => void;
  options: ReturnType<typeof useFilterOptions>;
  shown: number;
  total: number;
  /** Şeridin sonuna eklenen eylemler (ör. "Excel indir") */
  extra?: React.ReactNode;
}) {
  const today = todayIso();
  const set = (patch: Partial<WorkFilters>) => onChange({ ...filters, ...patch });

  /**
   * "Özel aralık" seçildi mi — tarih kutularını AÇIK tutan bayrak.
   *
   * Yalnız tarihlere bakmak yetmez: özel kipe geçerken verilen başlangıç
   * değeri (ay başı … bugün) ayın son gününde "Bu ay" ön tanımıyla birebir
   * çakışır ve kutular kullanıcının gözü önünde kapanırdı.
   */
  const [customOpen, setCustomOpen] = useState(false);

  // Seçili dönem hangi ön tanıma denk geliyor? (Adres çubuğundan gelen ham
  // tarihler de doğru düğmeyi vurgulasın diye tarihten geriye çözülür.)
  const preset: PeriodPreset = useMemo(() => {
    if (!filters.from && !filters.to) return "all";
    for (const p of PERIOD_PRESETS) {
      if (p === "all" || p === "custom") continue;
      const r = periodRange(p, today);
      if (r.from === filters.from && r.to === filters.to) return p;
    }
    return "custom";
  }, [filters.from, filters.to, today]);

  const active = activeFilterCount(filters);
  const presetValue = customOpen ? "custom" : preset;

  return (
    // Beş sabit genişlikli süzgeç 735px istiyordu; 360px'te şerit altı satıra
    // dağılıp ekranın dörtte birini yiyordu. Telefonda süzgeçler üçlü bir
    // ızgaradır, `sm` üstünde eski sarmalı şerit geri gelir.
    <div className="grid grid-cols-3 items-center gap-2 rounded-lg border bg-card px-2 py-2 sm:flex sm:flex-wrap sm:px-3">
      <span className="oc-kicker col-span-3 text-muted-foreground sm:mr-1">Filtre</span>

      <Select
        value={presetValue}
        onValueChange={(v) => {
          const p = v as PeriodPreset;
          if (p === "custom") {
            setCustomOpen(true);
            // "Özel" seçildiğinde tarihler KORUNUR; kullanıcı ince ayar yapar.
            set({ from: filters.from || periodRange("thisMonth", today).from, to: filters.to || today });
            return;
          }
          setCustomOpen(false);
          const r = periodRange(p, today);
          set({ from: r.from, to: r.to });
        }}
      >
        <SelectTrigger size="sm" className="w-full sm:w-[135px]">
          <SelectValue placeholder="Dönem" />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {PERIOD_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tarih kutuları YALNIZ "Özel aralık" seçilince görünür.
          Her zaman durduklarında iki tarih alanı + ayraç şeridin üçte birini
          yiyor ve süzgeç ikinci satıra taşıyordu; oysa dönem çoğu zaman hazır
          bir ön tanımdan seçilir. Seçili aralık, ön tanım kipinde de dönem
          kutusunun etiketinden okunur. */}
      {!customOpen && preset !== "custom" && preset !== "all" && (
        <span
          className="font-mono text-[11px] tabular-nums text-muted-foreground"
          title={`${filters.from} … ${filters.to}`}
        >
          {shortDate(filters.from)} – {shortDate(filters.to)}
        </span>
      )}
      {/* İki tarih kutusu + ayraç 334px istiyordu; ayrı ayrı sarınca "–" ilk
          satırın sonunda askıda kalıyordu. İkili kendi sarmalayıcısında durur
          ve kutular kalan yeri paylaşır. */}
      {(customOpen || preset === "custom") && (
        <div className="col-span-3 flex min-w-0 items-center gap-2 sm:col-span-1">
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => set({ from: e.target.value })}
            className="h-8 min-w-0 flex-1 pointer-coarse:h-10 sm:w-[9.5rem] sm:flex-none"
            aria-label="Başlangıç tarihi"
          />
          <span className="shrink-0 text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => set({ to: e.target.value })}
            className="h-8 min-w-0 flex-1 pointer-coarse:h-10 sm:w-[9.5rem] sm:flex-none"
            aria-label="Bitiş tarihi"
          />
        </div>
      )}

      <Select value={filters.customer} onValueChange={(v) => set({ customer: v })}>
        <SelectTrigger size="sm" className="w-full sm:w-[165px]">
          <SelectValue placeholder="Müşteri" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tüm Müşteriler</SelectItem>
          {options.customers.map(([name, meta]) => (
            <SelectItem key={name} value={name}>
              <CustomerTag name={name} shortName={meta.short} hue={meta.hue} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.item} onValueChange={(v) => set({ item: v })}>
        <SelectTrigger size="sm" className="w-full sm:w-[145px]">
          <SelectValue placeholder="İş Kalemi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tüm Kalemler</SelectItem>
          {options.items.map(([no, product]) => (
            <SelectItem key={no} value={no}>
              <span className="font-mono text-xs">{no}</span>
              {product && (
                <span className="ml-2 truncate text-[11px] text-muted-foreground">{product}</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.part} onValueChange={(v) => set({ part: v })}>
        <SelectTrigger size="sm" className="w-full sm:w-[150px]">
          <SelectValue placeholder="Parça" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tüm Parçalar</SelectItem>
          {options.parts.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.category} onValueChange={(v) => set({ category: v })}>
        <SelectTrigger size="sm" className="w-full sm:w-[140px]">
          <SelectValue placeholder="İmalat Türü" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tüm Türler</SelectItem>
          {options.categories.map(([name, hue]) => (
            <SelectItem key={name} value={name}>
              <span className="flex items-center gap-1.5">
                <span className="oc-tag-dot" style={tagStyle(hue)} aria-hidden />
                {name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={filters.query}
        onChange={(e) => set({ query: e.target.value })}
        placeholder="Kalem, Ürün, Parça veya Not Ara…"
        className="col-span-3 h-8 w-full flex-1 pointer-coarse:h-10 sm:col-span-1 sm:w-auto sm:min-w-[160px]"
      />

      {/* Sayaç + Temizle + dış eylemler telefonda tek satırda toplanır;
          `sm:contents` ile şerit kipinde sarmalayıcı yok olur. */}
      <div className="col-span-3 flex flex-wrap items-center gap-2 sm:contents">
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {shown} / {total}
        </span>
        {active > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => {
              setCustomOpen(false);
              onChange({ ...EMPTY_FILTERS });
            }}
          >
            <X className="size-3.5" /> Temizle
          </Button>
        )}
        {extra}
      </div>
    </div>
  );
}

"use client";

// Paket listesi — arama, süzgeç, sıralama.
//
// Süzgeç tanımı `filters.ts`te; bu dosya yalnız durumu tutar ve basar.
// Sütun önceliklendirme (AGENTS dokunmatik md. 7): düşük öncelikli sütunlar
// HEM `th` HEM `td` üzerinde gizlenir, gizlenenin kritik olanı birincil
// hücrenin içinde `md:hidden` ikinci satıra iner. İkinci bir kart markup'ı
// YAZILMAZ — sıralama ve süzme mantığını ikiye böler.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PACKAGE_STATUSES } from "@/lib/drawings/types";
import { PACKAGE_STATUS_LABELS, formatNum, recognitionClass } from "@/lib/drawings/labels";
import { RECONCILER_VERSION } from "@/lib/drawings/reconcile";
import type { PackageRow } from "./data";
import {
  ALL,
  EMPTY_PACKAGE_FILTERS,
  matchesPackage,
  sortPackages,
  type PackageFilters,
  type PackageSortKey,
} from "./filters";
import { FilterBar, SearchBox, SortableHead } from "./sortable-head";

export function PackagesTable({ packages }: { packages: PackageRow[] }) {
  const [f, setF] = useState<PackageFilters>(EMPTY_PACKAGE_FILTERS);
  const [sortKey, setSortKey] = useState<PackageSortKey>("tarih");
  const [desc, setDesc] = useState(true);

  const gorunen = useMemo(
    () => sortPackages(packages.filter((p) => matchesPackage(p, f)), sortKey, desc),
    [packages, f, sortKey, desc]
  );

  function sirala(key: PackageSortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(key === "tarih" || key === "dosya" || key === "parca");
    }
  }

  const temiz = JSON.stringify(f) === JSON.stringify(EMPTY_PACKAGE_FILTERS);

  return (
    <div className="grid gap-3">
      <FilterBar
        gorunen={gorunen.length}
        toplam={packages.length}
        temiz={temiz}
        onTemizle={() => setF(EMPTY_PACKAGE_FILTERS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Kalem no, paket adı, grup ara…"
          className="w-[min(22rem,calc(100vw-4rem))]"
        />
        <Select value={f.status} onValueChange={(v) => setF((s) => ({ ...s, status: v }))}>
          <SelectTrigger size="sm" className="w-auto min-w-[8rem] text-base pointer-fine:text-sm">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Durum: tümü</SelectItem>
            {PACKAGE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PACKAGE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={f.eslesme} onValueChange={(v) => setF((s) => ({ ...s, eslesme: v }))}>
          <SelectTrigger size="sm" className="w-auto min-w-[9rem] text-base pointer-fine:text-sm">
            <SelectValue placeholder="Eşleşme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Eşleşme: tümü</SelectItem>
            <SelectItem value="eslesmis">İş kalemine bağlı</SelectItem>
            <SelectItem value="eslesmemis">Eşleşmemiş</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Bu süzgeçle eşleşen paket yok. Süzgeci temizleyip yeniden deneyin.
          </p>
        </div>
      ) : (
        <div className="oc-scrollx overflow-x-auto border bg-card [--oc-scroll-bg:var(--card)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <SortableHead sortKey="kalem" current={sortKey} desc={desc} onSort={sirala}>
                  Kalem No
                </SortableHead>
                <SortableHead sortKey="paket" current={sortKey} desc={desc} onSort={sirala}>
                  Paket
                </SortableHead>
                <TableHead className="hidden lg:table-cell">Grup</TableHead>
                <SortableHead
                  sortKey="dosya"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                  className="hidden md:table-cell"
                >
                  Dosya
                </SortableHead>
                <SortableHead
                  sortKey="parca"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                  className="hidden md:table-cell"
                >
                  Parça
                </SortableHead>
                <SortableHead
                  sortKey="tanima"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                >
                  Tanıma
                </SortableHead>
                <TableHead>Bulgu</TableHead>
                <SortableHead sortKey="tarih" current={sortKey} desc={desc} onSort={sirala}>
                  Durum
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((p) => {
                const eksik = p.finding_counts?.eksik ?? 0;
                const celiski = p.finding_counts?.celiski ?? 0;
                const eskiKural =
                  p.reconciler_version > 0 && p.reconciler_version < RECONCILER_VERSION;
                return (
                  <TableRow key={p.id} className="relative">
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/drawings/${p.id}`}
                        className="absolute inset-0"
                        aria-label={p.folder_name}
                      />
                      {p.item_no || <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell className="min-w-0">
                      <span className="block truncate font-medium" title={p.folder_name}>
                        {p.description || p.folder_name}
                        {p.capacity && (
                          <span className="ml-1 text-muted-foreground">({p.capacity})</span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground md:hidden">
                        {[
                          p.group_code && `grup ${p.group_code}`,
                          `${formatNum(p.file_count)} dosya`,
                          `${formatNum(p.part_count)} parça`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </TableCell>

                    <TableCell className="hidden font-mono text-sm text-muted-foreground lg:table-cell">
                      {p.group_code || "—"}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-sm md:table-cell">
                      {formatNum(p.file_count)}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-sm md:table-cell">
                      {formatNum(p.part_count)}
                    </TableCell>

                    <TableCell className="text-right">
                      <span
                        className={`font-mono text-sm font-medium ${recognitionClass(p.recognition_pct)}`}
                      >
                        {p.recognition_pct == null ? "—" : `%${p.recognition_pct}`}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {eksik > 0 && (
                          <span className="border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px] text-destructive">
                            {eksik} eksik
                          </span>
                        )}
                        {celiski > 0 && (
                          <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                            {celiski} çelişki
                          </span>
                        )}
                        {eksik === 0 && celiski === 0 && (
                          <span className="font-mono text-[11px] text-muted-foreground">—</span>
                        )}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {PACKAGE_STATUS_LABELS[p.status]}
                        </span>
                        {eskiKural && (
                          <span
                            className="relative z-10 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400"
                            title="Tanıma kuralları güncellendi; yeniden eşleştirilebilir."
                          >
                            kural eski
                          </span>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

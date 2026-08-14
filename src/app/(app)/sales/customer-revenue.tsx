"use client";

// MÜŞTERİ BAZINDA CİRO — Excel'deki "Satış Toplamları" sayfasının karşılığı,
// artık kendi adresinde (/sales/ciro, kullanıcı kararı 14.08.2026). Ciro
// yalnız AVRO karşılığından çıkar; kuru girilmemiş satır toplama girmez.

import { useMemo, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CustomerTag } from "@/components/tags";
import { fmtNum } from "@/lib/currency";
import { saleYear, type SaleRow } from "./schema";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const AT_SM = "hidden sm:table-cell";
const AT_MD = "hidden md:table-cell";

export function CustomerRevenue({ rows }: { rows: SaleRow[] }) {
  const [year, setYear] = useState(ALL);

  const years = useMemo(
    () => [...new Set(rows.map(saleYear).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [rows]
  );

  const { byCustomer, eur, kalem } = useMemo(() => {
    let eur = 0;
    let kalem = 0;
    const map = new Map<
      string,
      { eur: number; count: number; short: string | null; hue: number | null }
    >();
    for (const r of rows) {
      if (year !== ALL && saleYear(r) !== year) continue;
      if (r.eurAmount === null) continue;
      eur += r.eurAmount;
      kalem += 1;
      const key = r.customer.trim() || "—";
      const cur = map.get(key) ?? {
        eur: 0, count: 0, short: r.customerShort ?? null, hue: r.customerHue ?? null,
      };
      map.set(key, { ...cur, eur: cur.eur + r.eurAmount, count: cur.count + 1 });
    }
    return {
      byCustomer: [...map.entries()].sort((a, b) => b[1].eur - a[1].eur),
      eur,
      kalem,
    };
  }, [rows, year]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2">
        <span className="oc-kicker text-muted-foreground">Yıl</span>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm Yıllar</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto font-mono text-sm font-semibold tabular-nums">
          {fmtNum(eur)} € · {byCustomer.length} müşteri · {kalem} kalem
        </span>
      </div>

      {byCustomer.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Bu yılda avro karşılığı olan satış kalemi yok.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn("w-10 text-right", AT_SM)}>#</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead className={cn("w-[6rem] text-right", AT_SM)}>Kalem</TableHead>
                <TableHead className="w-[10rem] text-right">Ciro (Avro)</TableHead>
                <TableHead className={cn("w-[24%]", AT_MD)}>Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCustomer.map(([name, v], i) => {
                const share = eur > 0 ? v.eur / eur : 0;
                return (
                  <TableRow key={name} className="hover:bg-transparent">
                    <TableCell
                      className={cn("text-right font-mono text-xs tabular-nums text-muted-foreground", AT_SM)}
                    >
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <CustomerTag name={name} shortName={v.short} hue={v.hue} />
                      <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-muted-foreground sm:hidden">
                        {v.count} kalem · %{fmtNum(share * 100)}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn("text-right font-mono text-sm tabular-nums text-muted-foreground", AT_SM)}
                    >
                      {v.count}
                    </TableCell>
                    <TableCell className="text-right align-top font-mono text-sm tabular-nums sm:align-middle">
                      {fmtNum(v.eur)} €
                    </TableCell>
                    <TableCell className={AT_MD}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(share * 100, 0.5)}%` }}
                          />
                        </div>
                        <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                          %{fmtNum(share * 100)}
                        </span>
                      </div>
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

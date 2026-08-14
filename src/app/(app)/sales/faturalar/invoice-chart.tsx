"use client";

// SATIŞ FATURALARI GRAFİĞİ — aylık/yıllık ciro, AVRO (kullanıcı isteği,
// 14.08.2026). Çizgi grafik; her nokta değerinde tutar yazar. Yıl süzgeci +
// "Tümü": bir yıl seçilince 12 ay, "Tümü"de yıl yıl.

import { useMemo, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TimeLineChart, type ChartColumn } from "@/components/charts";
import { fmtCompactEur, fmtCompactEur1 } from "@/lib/currency";
import type { SalesInvoiceRow } from "./data";

const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const TUMU = "__all__";

function yilOf(r: SalesInvoiceRow): string {
  if (r.invoiceYear != null) return String(r.invoiceYear);
  return r.invoiceDate ? r.invoiceDate.slice(0, 4) : "";
}

export function InvoiceChart({ invoices }: { invoices: SalesInvoiceRow[] }) {
  const years = useMemo(
    () => [...new Set(invoices.map(yilOf).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [invoices]
  );
  // Varsayılan: en yeni yıl (aylık kırılım en çok işe yarayan görünüm).
  const [year, setYear] = useState<string>(() => years[0] ?? TUMU);

  const columns: ChartColumn[] = useMemo(() => {
    if (year === TUMU) {
      const tum = [...years].sort((a, b) => a.localeCompare(b));
      const map = new Map<string, number>(tum.map((y) => [y, 0]));
      for (const r of invoices) {
        const y = yilOf(r);
        if (r.amountEur != null && map.has(y)) map.set(y, (map.get(y) ?? 0) + r.amountEur);
      }
      return tum.map((y) => ({ key: y, label: y, total: map.get(y) ?? 0, parts: { eur: map.get(y) ?? 0 } }));
    }
    const aylik = Array<number>(12).fill(0);
    for (const r of invoices) {
      if (yilOf(r) !== year || r.amountEur == null || !r.invoiceDate) continue;
      const ay = Number(r.invoiceDate.slice(5, 7)) - 1;
      if (ay >= 0 && ay < 12) aylik[ay] += r.amountEur;
    }
    const yy = year.slice(2);
    return aylik.map((v, i) => ({ key: `${year}-${i}`, label: `${AY[i]} ${yy}`, total: v, parts: { eur: v } }));
  }, [invoices, year, years]);

  const toplam = columns.reduce((t, c) => t + c.total, 0);

  return (
    <section className="min-w-0 border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <h2 className="text-sm font-medium">
          {year === TUMU ? "Yıllık Fatura Cirosu" : "Aylık Fatura Cirosu"} (€)
        </h2>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{fmtCompactEur(toplam)}</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger size="sm" className="w-[110px]">
              <SelectValue>{year === TUMU ? "Tümü" : year}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
              <SelectItem value={TUMU}>Tümü</SelectItem>
            </SelectContent>
          </Select>
        </span>
      </div>
      <div className="p-3">
        <TimeLineChart
          columns={columns}
          series={[{ key: "eur", label: "Ciro (€)", hue: 210 }]}
          valueLabel="EUR"
          format={fmtCompactEur}
          valueLabels
          valueFormat={fmtCompactEur1}
          height={200}
        />
      </div>
    </section>
  );
}

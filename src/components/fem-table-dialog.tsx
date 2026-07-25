"use client";

// FEM referans tablosu pop-up'ı — bir katsayı alanının yanındaki küçük "FEM"
// düğmesiyle açılır; FEM 1.001 tablosunu gösterir ve girilen değere karşılık
// gelen sütunu vurgular.

import { useState } from "react";
import { BookMarked } from "lucide-react";
import { activeFemColumn, femColumnByHeader, type FemTable } from "@/lib/calc/fem-tables";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function FemTableButton({
  table,
  value,
  activeHeader,
}: {
  table: FemTable;
  value?: number | undefined;
  /** Sınıf-bazlı alanlar için sütun başlığıyla eşleştir (ör. "M6") */
  activeHeader?: string;
}) {
  const [open, setOpen] = useState(false);
  const active = activeHeader !== undefined
    ? femColumnByHeader(table, activeHeader)
    : activeFemColumn(table, value);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={`${table.code} — tabloyu göster`}
          className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary/90 hover:bg-primary/10"
        >
          <BookMarked className="size-3" />
          FEM
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {table.title}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">
              {table.code}
            </span>
          </DialogTitle>
          <DialogDescription>{table.columnHeader} → {table.rowLabel}</DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-muted/60 px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">
                  {table.columnHeader}
                </th>
                {table.columns.map((c, i) => (
                  <th
                    key={c.header}
                    className={cn(
                      "border px-2 py-1.5 text-center text-xs font-semibold",
                      i === active ? "bg-primary text-primary-foreground" : "bg-muted/40"
                    )}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border bg-muted/40 px-2 py-1.5 font-mono text-xs font-semibold">
                  {table.rowLabel}
                </td>
                {table.columns.map((c, i) => (
                  <td
                    key={c.header}
                    className={cn(
                      "border px-2 py-1.5 text-center tabular-nums",
                      i === active
                        ? "bg-primary/15 font-bold text-primary ring-1 ring-inset ring-primary"
                        : ""
                    )}
                  >
                    {c.value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {active >= 0 && (
          <p className="text-sm">
            Seçili: <span className="font-semibold text-primary">{table.columns[active].header}</span>{" "}
            → {table.rowLabel} = <span className="font-semibold">{table.columns[active].value}</span>
          </p>
        )}
        {table.note && <p className="text-xs leading-relaxed text-muted-foreground">{table.note}</p>}
      </DialogContent>
    </Dialog>
  );
}

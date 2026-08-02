"use client";

// Standart referans rozeti — hesap satırlarındaki "FEM 1.001 T.4.2.2.1.2" gibi
// referanslara tıklandığında standardın tablosunu / formülünü / açıklamasını
// pop-up olarak gösterir. Defterde karşılığı olmayan referanslar tıklanamaz
// düz rozet olarak kalır.

import { useState } from "react";
import { BookMarked } from "lucide-react";
import { MathFormula } from "@/components/math/math-formula";
import {
  resolveStandardRef,
  type StandardContext,
  type StandardRef,
  type StandardTableDef,
} from "@/lib/standards/registry";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Satır vurgusu: tablonun ilk hücresi bağlamdaki değerle eşleşiyor mu. */
function isHighlighted(
  table: StandardTableDef,
  row: (string | number)[],
  context: StandardContext | undefined
): boolean {
  if (!table.highlightBy || !context) return false;
  const want = context[table.highlightBy];
  if (!want) return false;
  return String(row[0]).trim() === String(want).trim();
}

function RefTable({
  table,
  context,
}: {
  table: StandardTableDef;
  context?: StandardContext;
}) {
  return (
    <div className="grid gap-1.5">
      {table.caption && (
        <div className="oc-kicker text-muted-foreground">{table.caption}</div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "border-b bg-muted/60 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-muted-foreground",
                    i === 0 ? "text-left" : "text-center"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => {
              const active = isHighlighted(table, row, context);
              return (
                <tr
                  key={ri}
                  className={cn(
                    "border-b last:border-0",
                    active && "bg-primary/10"
                  )}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "px-2.5 py-1.5",
                        ci === 0
                          ? "text-left font-medium"
                          : "text-center font-mono tabular-nums",
                        active && "font-semibold text-primary"
                      )}
                    >
                      {cell === "" ? "" : cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {table.footnote && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {table.footnote}
        </p>
      )}
    </div>
  );
}

export function StandardRefBody({
  refDef,
  context,
}: {
  refDef: StandardRef;
  context?: StandardContext;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed text-foreground/90">{refDef.summary}</p>

      {refDef.formulas && refDef.formulas.length > 0 && (
        <div className="grid gap-2">
          <div className="oc-kicker text-muted-foreground">Bağıntılar</div>
          <div className="grid gap-2">
            {refDef.formulas.map((f, i) => (
              <div key={i} className="grid gap-0.5">
                {f.label && (
                  <span className="text-[11px] text-muted-foreground">{f.label}</span>
                )}
                <div className="overflow-x-auto rounded-md bg-muted/50 px-3 py-2 text-[15px] leading-relaxed">
                  <MathFormula formula={f.expr} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {refDef.tables?.map((t, i) => (
        <RefTable key={i} table={t} context={context} />
      ))}

      {refDef.notes && refDef.notes.length > 0 && (
        <div className="grid gap-1.5">
          <div className="oc-kicker text-muted-foreground">Notlar</div>
          <ul className="grid gap-1.5">
            {refDef.notes.map((n, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground"
              >
                <span aria-hidden className="shrink-0 text-primary/60">—</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-t pt-3 text-[11px] text-muted-foreground">
        Kaynak: {refDef.source}
        {refDef.clause ? ` · ${refDef.clause}` : ""}
      </p>
    </div>
  );
}

/**
 * Hesap satırındaki standart rozeti. Defterde karşılığı varsa tıklanabilir
 * ve pop-up açar; yoksa düz rozet olarak görünür.
 */
export function StandardRefBadge({
  code,
  context,
  className,
}: {
  code: string;
  context?: StandardContext;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const refDef = resolveStandardRef(code);

  if (!refDef) {
    return (
      <span
        className={cn(
          "border border-primary/25 bg-primary/5 px-1.5 py-px font-mono text-[10px] text-primary/90",
          className
        )}
      >
        {code}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${refDef.title} — standardı göster`}
        className={cn(
          "inline-flex items-center gap-1 border border-primary/30 bg-primary/5 px-1.5 py-px font-mono text-[10px] text-primary/90 transition-colors hover:border-primary/60 hover:bg-primary/15",
          className
        )}
      >
        <BookMarked className="size-2.5" aria-hidden />
        {code}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 text-base">
              <span>{refDef.title}</span>
              <span className="bg-muted px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">
                {refDef.code}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {refDef.source}
              {refDef.clause ? ` · ${refDef.clause}` : ""}
            </DialogDescription>
          </DialogHeader>
          <StandardRefBody refDef={refDef} context={context} />
        </DialogContent>
      </Dialog>
    </>
  );
}

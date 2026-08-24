import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtMoney, fmtNum } from "@/lib/currency";
import { tarihGoster } from "@/lib/purchasing/terms";
import type { ConsumableExpenseRow } from "./data";

export function RecentExpenses({ rows }: { rows: ConsumableExpenseRow[] }) {
  return (
    <section className="grid gap-3" aria-labelledby="recent-consumable-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="recent-consumable-heading" className="text-base font-semibold tracking-tight">
            Son Kayıtlar
          </h2>
          <p className="text-sm text-muted-foreground">En yeni alım tarihi üstte.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/purchasing/sarf/kayitlar">
            Bütün kayıtlar <ArrowRight />
          </Link>
        </Button>
      </div>

      <div className="oc-mobile-table-wrap oc-tablet-table-wrap border bg-card">
        <Table className="oc-mobile-table oc-tablet-table oc-compact-mobile-table oc-purchasing-table">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {/* Telefonda tarih Malzeme alt satırına iner (yatay kaydırma
                  yasağı, 16.08.2026). */}
              <TableHead className="hidden sm:table-cell">Tarih</TableHead>
              <TableHead>Malzeme</TableHead>
              <TableHead className="hidden md:table-cell">Tedarikçi</TableHead>
              <TableHead className="hidden lg:table-cell">Miktar</TableHead>
              <TableHead className="text-right">Tutar (€)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="hidden font-mono text-xs whitespace-nowrap sm:table-cell">
                  {tarihGoster(row.expenseDate)}
                </TableCell>
                <TableCell data-label="Malzeme" data-mobile-span="full" className="min-w-0 whitespace-normal">
                  <div className="flex items-start gap-1.5">
                    {row.qualityFlags.length > 0 && (
                      <AlertTriangle
                        className="mt-0.5 size-3.5 shrink-0 text-destructive"
                        aria-label="İnceleme işareti var"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium">{row.itemName || "Malzeme belirtilmemiş"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {[row.itemCode, row.groupName, row.source === "app" ? "Manuel" : "Devralınan"]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground md:hidden">
                        <span className="font-mono sm:hidden">{tarihGoster(row.expenseDate)} · </span>
                        {row.supplierName || "Tedarikçi belirtilmemiş"}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden max-w-[20rem] whitespace-normal md:table-cell">
                  {row.supplierName || "—"}
                </TableCell>
                <TableCell className="hidden font-mono text-xs whitespace-nowrap lg:table-cell">
                  {fmtNum(row.quantity)} {row.unit}
                </TableCell>
                <TableCell data-label="Tutar (€)" data-mobile-span="full" className="text-right font-mono text-sm font-medium whitespace-nowrap tabular-nums">
                  {fmtMoney(row.amountEur, "EUR")}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} data-mobile-span="full" data-mobile-hide-label className="h-24 text-center text-muted-foreground">
                  Henüz sarf gideri yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

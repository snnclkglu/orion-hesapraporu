// Kaplin katalogu (cat_couplings) CRUD — tambur/fren/dişli kaplinleri.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { COUPLING_TYPES, COUPLING_TYPE_LABELS } from "../labels";
import { CouplingDialog, DeleteCouplingButton, type CouplingRow } from "./coupling-dialog";

export default async function AdminCouplingsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const activeType = COUPLING_TYPES.some((t) => t.value === type) ? type! : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("cat_couplings")
    .select("id, coupling_type, brand, series, model, dmax, t_nominal, radial_load, sort")
    .order("coupling_type")
    .order("sort");
  if (activeType) query = query.eq("coupling_type", activeType);
  const { data: items } = await query;

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Kaplin Katalogu</h2>
          <p className="text-sm text-muted-foreground">
            Tambur, fren ve dişli kaplinleri; hesapta tork/delik çapı kontrollerinde kullanılır.
          </p>
        </div>
        <CouplingDialog defaultType={activeType} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/admin/couplings"
          className={cn(
            "rounded-md border px-2.5 py-1 text-sm",
            !activeType ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
          )}
        >
          Tümü
        </Link>
        {COUPLING_TYPES.map((t) => (
          <Link
            key={t.value}
            href={`/admin/couplings?type=${t.value}`}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm",
              activeType === t.value
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tip</TableHead>
              <TableHead>Marka</TableHead>
              <TableHead>Seri</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">dmax [mm]</TableHead>
              <TableHead className="text-right">T nominal [Nm]</TableHead>
              <TableHead className="text-right">Radyal yük [N]</TableHead>
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-sm">
                  {COUPLING_TYPE_LABELS[item.coupling_type] ?? item.coupling_type}
                </TableCell>
                <TableCell className="font-medium">{item.brand}</TableCell>
                <TableCell>{item.series}</TableCell>
                <TableCell>{item.model}</TableCell>
                <TableCell className="text-right font-mono text-sm">{item.dmax}</TableCell>
                <TableCell className="text-right font-mono text-sm">{item.t_nominal}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {item.radial_load ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <CouplingDialog item={item as CouplingRow} />
                    <DeleteCouplingButton id={item.id} name={`${item.brand} ${item.model}`} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Kayıt yok. &quot;Yeni Kaplin&quot; ile ekleyin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Ekipman katalogu (cat_equipment) CRUD — tip filtresi + ekle/düzenle/sil.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EQUIPMENT_KINDS, KIND_LABELS } from "../labels";
import { EquipmentDialog, DeleteEquipmentButton, type EquipmentRow } from "./equipment-dialog";

export default async function AdminEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const activeKind = EQUIPMENT_KINDS.some((k) => k.value === kind) ? kind! : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("cat_equipment")
    .select("id, kind, brand, model, attrs, notes, active, sort")
    .order("kind")
    .order("sort")
    .order("brand");
  if (activeKind) query = query.eq("kind", activeKind);
  const { data: items } = await query;

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Ekipman Katalogu</h2>
          <p className="text-sm text-muted-foreground">
            Motor, redüktör, halat vb. satın alma/seçim katalogu. Özellikler (attrs) serbest
            anahtar-değer alanlarıdır.
          </p>
        </div>
        <EquipmentDialog defaultKind={activeKind} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/admin/equipment"
          className={cn(
            "rounded-md border px-2.5 py-1 text-sm",
            !activeKind ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
          )}
        >
          Tümü
        </Link>
        {EQUIPMENT_KINDS.map((k) => (
          <Link
            key={k.value}
            href={`/admin/equipment?kind=${k.value}`}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm",
              activeKind === k.value
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {k.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tip</TableHead>
              <TableHead>Marka</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Özellikler</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-sm">{KIND_LABELS[item.kind] ?? item.kind}</TableCell>
                <TableCell className="font-medium">{item.brand}</TableCell>
                <TableCell>{item.model}</TableCell>
                <TableCell className="max-w-64 text-xs text-muted-foreground">
                  {Object.entries((item.attrs ?? {}) as Record<string, unknown>)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ") || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={item.active ? "outline" : "secondary"}>
                    {item.active ? "aktif" : "pasif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <EquipmentDialog item={item as EquipmentRow} />
                    <DeleteEquipmentButton id={item.id} name={`${item.brand} ${item.model}`} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {activeKind
                    ? `${KIND_LABELS[activeKind]} kaydı yok. "Yeni Ekipman" ile ekleyin.`
                    : 'Katalog boş. "Yeni Ekipman" ile ekleyin.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Ray katalogu (cat_rails) — ekle/düzenle/sil.

import { createClient } from "@/lib/supabase/server";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RailDialog, DeleteRailButton, type RailRow } from "./rail-dialog";

export default async function AdminRailsPage() {
  const supabase = await createClient();
  const { data: rails } = await supabase
    .from("cat_rails")
    .select("code, radius, head_width, sort")
    .order("sort");

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Raylar</h2>
          <p className="text-sm text-muted-foreground">
            Teker basıncı hesabında kullanılan ray kesitleri. Baş yarıçapı kare raylarda boş bırakılır.
          </p>
        </div>
        <RailDialog />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              <TableHead className="text-right">Baş yarıçapı [mm]</TableHead>
              <TableHead className="text-right">Temas genişliği [mm]</TableHead>
              <TableHead className="text-right">Sıra</TableHead>
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rails ?? []).map((rail) => (
              <TableRow key={rail.code}>
                <TableCell className="font-mono font-medium">{rail.code}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {rail.radius ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{rail.head_width}</TableCell>
                <TableCell className="text-right font-mono text-sm">{rail.sort}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <RailDialog item={rail as RailRow} />
                    <DeleteRailButton code={rail.code} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(rails ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Kayıt yok. &quot;Yeni Ray&quot; ile ekleyin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

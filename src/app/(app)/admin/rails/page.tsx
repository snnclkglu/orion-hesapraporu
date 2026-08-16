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
      {/* `flex-wrap` yoksa açıklama ~200px'e sıkışıp 4-5 satıra iniyordu. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Raylar</h2>
          <p className="text-sm text-muted-foreground">
            Teker basıncı hesabında kullanılan ray kesitleri. Baş yarıçapı kare raylarda boş bırakılır.
          </p>
        </div>
        <RailDialog />
      </div>

      {/* "Tabloyu yana kaydırın" ipucu kalktı: telefonda tablo artık listeye
          katlanıyor, kaydıracak bir şey kalmadı (md. 15). */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              {/* Telefonda tablo listeye katlanır (md. 15): iki uzun başlıklı
                  sayı sütunu + eylemler 375px'i taşırıyordu; opsiyonel olan
                  baş yarıçapı kodun altına iner. */}
              <TableHead className="hidden text-right sm:table-cell">Baş yarıçapı [mm]</TableHead>
              <TableHead className="text-right">Temas genişliği [mm]</TableHead>
              {/* Sıra yalnız listeleme düzenidir; dar ekranda kodun altına iner. */}
              <TableHead className="hidden text-right md:table-cell">Sıra</TableHead>
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rails ?? []).map((rail) => (
              <TableRow key={rail.code}>
                <TableCell className="font-mono font-medium">
                  {rail.code}
                  {/* Telefon katmanı: gizlenen baş yarıçapı buraya iner (md. 15). */}
                  <div className="mt-0.5 font-sans text-[11px] font-normal text-muted-foreground sm:hidden">
                    baş yarıçapı {rail.radius ?? "—"} mm
                  </div>
                  <div className="mt-0.5 font-sans text-[11px] font-normal text-muted-foreground md:hidden">
                    sıra {rail.sort}
                  </div>
                </TableCell>
                <TableCell className="hidden text-right font-mono text-sm sm:table-cell">
                  {rail.radius ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{rail.head_width}</TableCell>
                <TableCell className="hidden text-right font-mono text-sm md:table-cell">
                  {rail.sort}
                </TableCell>
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

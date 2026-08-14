// Marka/Kalite defteri — sipariş satırı ve sarf giderinin ORTAK öneri listesi
// (md. 16/18). Değer kayıtta metin olarak dondurulur; bu ekran yalnız ÖNERİ
// listesini yönetir (ad düzeltme, pasife çekme, silme, yeni ekleme).

import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QualityRow, type QualityAdminRow } from "./quality-row";
import { NewQualityButton } from "./new-quality-button";

export default async function AdminQualitiesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_qualities")
    .select("id, name, active")
    .order("name", { ascending: true });

  const rows: QualityAdminRow[] = ((data ?? []) as {
    id: string;
    name: string;
    active: boolean;
  }[]).map((row) => ({ id: row.id, name: row.name ?? "", active: row.active !== false }));
  const passiveCount = rows.filter((row) => !row.active).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Marka/Kalite</h2>
          <p className="text-sm text-muted-foreground">
            Sipariş ve sarf gideri girişinde önerilen marka/kalite listesi. Yeni değer, giriş
            pencerelerinden de yazılınca buraya eklenir. Kayıttaki değer metin olarak
            dondurulur; buradaki düzeltme yayınlanmış kaydı değiştirmez.
          </p>
        </div>
        <NewQualityButton />
      </div>

      {error && (
        <p className="border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-sm">
          Marka/Kalite defteri okunamadı. Veritabanı göçü uygulanmamış olabilir (
          <span className="font-mono">purchase_qualities</span>).
        </p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marka/Kalite</TableHead>
              <TableHead className="w-[6rem]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <QualityRow key={row.id} row={row} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                  Defterde marka/kalite yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {rows.length} marka/kalite
        {passiveCount > 0 ? ` · ${passiveCount} pasif` : ""}.
      </p>
    </div>
  );
}

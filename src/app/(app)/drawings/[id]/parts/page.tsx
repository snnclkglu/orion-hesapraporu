// Parça defteri — paketin bütün satırları tek tabloda.
//
// KODSUZ SATIRLAR DA BURADADIR. Bir BOM'un satırlarının yarısında parça
// numarası yoktur (civata, segman, rulman, satın alınan üniteler); satın alma
// listesi tam olarak onlardan çıkacağı için düşürülmeleri modülün
// sebeplerinden birini yok ederdi.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PART_KIND_LABELS } from "@/lib/drawings/types";
import { formatNum } from "@/lib/drawings/labels";
import { loadFiles, loadPackage, loadParts } from "../../data";
import { FileOpenButton } from "../file-open-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PackagePartsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const paket = await loadPackage(supabase, id);
  if (!paket) notFound();

  const [parcalar, dosyalar] = await Promise.all([
    loadParts(supabase, id),
    loadFiles(supabase, id),
  ]);
  const dosyaKimlik = new Map(dosyalar.map((d) => [d.id, d]));

  if (parcalar.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ DEFTER BOŞ ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Bu pakette okunabilen bir ürün ağacı bulunamadı. Dosyalar arşivde
          duruyor; Excel eklenip “Yeniden Eşleştir” çalıştırıldığında defter
          kurulur.
        </p>
      </div>
    );
  }

  const agirlikToplam = parcalar
    .filter((p) => p.weight_kg != null && !p.parent_code)
    .reduce((t, p) => t + Number(p.weight_kg ?? 0), 0);

  return (
    <div className="grid gap-3">
      <p className="font-mono text-[11px] text-muted-foreground">
        {formatNum(parcalar.length)} satır ·{" "}
        {formatNum(parcalar.filter((p) => p.kind === "imalat").length)} imalat ·{" "}
        {formatNum(parcalar.filter((p) => p.kind === "satinalma").length)} satın alma ·{" "}
        {formatNum(parcalar.filter((p) => p.kind === "montaj").length)} montaj
        {agirlikToplam > 0 && ` · kök ağırlık ${formatNum(agirlikToplam, 1)} kg`}
      </p>

      <div className="oc-scrollx overflow-x-auto border bg-card [--oc-scroll-bg:var(--card)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Kod</TableHead>
              <TableHead>Tanım</TableHead>
              <TableHead className="text-right">Adet</TableHead>
              <TableHead className="hidden md:table-cell">Malzeme</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Kalınlık</TableHead>
              <TableHead className="hidden lg:table-cell">Kategori</TableHead>
              <TableHead className="hidden xl:table-cell text-right">Ağırlık</TableHead>
              <TableHead className="hidden xl:table-cell">Tür</TableHead>
              <TableHead>Dosyalar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parcalar.map((p) => {
              const resim = p.sheet_file_id ? dosyaKimlik.get(p.sheet_file_id) : null;
              const kesim = p.cut_file_id ? dosyaKimlik.get(p.cut_file_id) : null;
              return (
                <TableRow key={p.register_key}>
                  <TableCell className="font-mono text-[12px]">
                    {p.part_code || (
                      <span className="text-muted-foreground" title="Parça numarası olmayan satın alma satırı">
                        —
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="min-w-0 max-w-[22rem]">
                    <span className="block truncate" title={p.description}>
                      {p.description || p.name || "—"}
                    </span>
                    {/* Dar ekranda gizlenen sütunların kritik olanı buraya iner */}
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground md:hidden">
                      {[
                        p.material,
                        p.thickness_mm != null && `${formatNum(p.thickness_mm, 1)}mm`,
                        p.category,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm">
                    {p.qty ?? "—"}
                    {p.cut_length_mm != null && (
                      <span
                        className="ml-1 text-[11px] text-muted-foreground"
                        title="Kirli QTY sütunundan çözülen kesim boyu"
                      >
                        {formatNum(p.cut_length_mm, 1)}mm
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="hidden md:table-cell font-mono text-[12px]">
                    {p.material || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right font-mono text-[12px]">
                    {p.thickness_mm == null ? "—" : formatNum(p.thickness_mm, 1)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-[12px]">
                    {p.category || "—"}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-right font-mono text-[12px]">
                    {p.weight_kg == null ? "—" : formatNum(p.weight_kg, 3)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-[12px] text-muted-foreground">
                    {PART_KIND_LABELS[p.kind]}
                  </TableCell>

                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1">
                      {resim && (
                        <FileOpenButton storagePath={resim.storage_path} label="RES" title={resim.file_name} />
                      )}
                      {kesim && (
                        <FileOpenButton storagePath={kesim.storage_path} label="DXF" title={kesim.file_name} />
                      )}
                      {p.has_model && !resim && (
                        <span className="border px-1.5 font-mono text-[11px] text-muted-foreground">MOD</span>
                      )}
                      {!p.has_model && !p.has_sheet && !p.has_cut && !p.has_3d && (
                        <span className="font-mono text-[11px] text-muted-foreground">—</span>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

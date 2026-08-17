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
      {/* `flex-wrap` yoksa açıklama ~200px'e sıkışıp 4-5 satıra iniyordu. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Kaplin Katalogu</h2>
          <p className="text-sm text-muted-foreground">
            Tambur, fren ve dişli kaplinleri; hesapta tork/delik çapı kontrollerinde kullanılır.
          </p>
        </div>
        <CouplingDialog defaultType={activeType} />
      </div>

      {/* ŞERİT KAYMAZ, SARAR (kullanıcı kararı, 16.08.2026 — kabuk kuralı 15,
          purchasing-nav deseni; ekipman kataloguyla aynı dil): çipler telefonda
          satırlara sarar, hepsi her an görünür. Dokunma payları korunur. */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/admin/couplings"
          className={cn(
            // Ham `<a>`: dokunma payı elle verilir (sözleşme §2).
            "flex min-h-9 shrink-0 items-center rounded-md border px-2.5 text-sm pointer-coarse:min-h-10",
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
              "flex min-h-9 shrink-0 items-center rounded-md border px-2.5 text-sm pointer-coarse:min-h-10",
              activeType === t.value
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* "Tabloyu yana kaydırın" ipucu kalktı: telefonda tablo artık listeye
          katlanıyor, kaydıracak bir şey kalmadı (ROL-15). Ara genişliklerde
          olası taşmayı `Table`ın kendi `.oc-scrollx` gölgesi gösterir. */}
      <div className="rounded-lg border">
        {/* Uzun katalog defteri: kap `md` üstünde 70dvh'ye kelepçeli, başlık
            yapışkan (oc-table-clamp + oc-sticky-head sözleşmesi). */}
        <Table containerClassName="oc-table-clamp">
          <TableHeader className="oc-sticky-head">
            <TableRow>
              {/* Sekiz sütun ~900px istiyordu. Dar ekranda kimliğin ikincil
                  parçaları (tip, seri) ve ikincil sayılar (dmax, radyal yük)
                  markanın altındaki satıra iner; en ayırt edici sayı olan
                  nominal tork sütun olarak kalır. */}
              <TableHead className="hidden md:table-cell">Tip</TableHead>
              <TableHead>Marka</TableHead>
              <TableHead className="hidden md:table-cell">Seri</TableHead>
              {/* Telefonda tablo listeye katlanır (MOBIL-15): model markanın
                  altına iner — marka + model + tork + eylemler 375px'i
                  taşırıyordu. */}
              <TableHead className="hidden sm:table-cell">Model</TableHead>
              <TableHead className="hidden text-right md:table-cell">dmax [mm]</TableHead>
              <TableHead className="text-right">T nominal [Nm]</TableHead>
              <TableHead className="hidden text-right md:table-cell">Radyal yük [N]</TableHead>
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="hidden text-sm md:table-cell">
                  {COUPLING_TYPE_LABELS[item.coupling_type] ?? item.coupling_type}
                </TableCell>
                <TableCell className="font-medium break-words whitespace-normal">
                  {item.brand}
                  {/* Telefon katmanı: gizlenen Model buraya iner (md. 15). */}
                  <div className="mt-0.5 font-mono text-[12px] font-normal sm:hidden">
                    {item.model}
                  </div>
                  <div className="mt-0.5 text-[11px] font-normal text-muted-foreground md:hidden">
                    {[
                      COUPLING_TYPE_LABELS[item.coupling_type] ?? item.coupling_type,
                      item.series || null,
                      `dmax ${item.dmax} mm`,
                      item.radial_load != null ? `radyal ${item.radial_load} N` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{item.series}</TableCell>
                <TableCell className="hidden sm:table-cell">{item.model}</TableCell>
                <TableCell className="hidden text-right font-mono text-sm md:table-cell">
                  {item.dmax}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{item.t_nominal}</TableCell>
                <TableCell className="hidden text-right font-mono text-sm md:table-cell">
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

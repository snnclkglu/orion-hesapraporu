// Paket listesi.
//
// Sütun önceliklendirme (AGENTS, dokunmatik md. 7): dokuz sütunluk satır
// telefonda kabın birkaç katı olur. Düşük öncelikli sütunlar HEM `th` HEM `td`
// üzerinde gizlenir; gizlenenin kritik olanı birincil hücrenin içinde
// `md:hidden` ikinci satıra iner. İkinci bir kart markup'ı YAZILMAZ — sıralama
// ve seçim mantığını ikiye böler ve zamanla ayrışır.

import Link from "next/link";
import { FolderTree, Layers, PackageSearch, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PACKAGE_STATUS_LABELS,
  formatBytes,
  formatNum,
  recognitionClass,
} from "@/lib/drawings/labels";
import { RECONCILER_VERSION } from "@/lib/drawings/reconcile";
import { loadItemOptions, loadPackages } from "./data";
import { UnmatchedCard } from "./unmatched-card";

export default async function DrawingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditDrawings(profile?.role);

  const [paketler, kalemler] = await Promise.all([
    loadPackages(supabase),
    loadItemOptions(supabase),
  ]);

  const eslesmemis = paketler.filter((p) => !p.job_item_id);
  const toplamDosya = paketler.reduce((t, p) => t + p.file_count, 0);
  const toplamBayt = paketler.reduce((t, p) => t + Number(p.bytes_total ?? 0), 0);
  const toplamEksik = paketler.reduce((t, p) => t + (p.finding_counts?.eksik ?? 0), 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Paket"
          value={String(paketler.length)}
          hint={`${paketler.filter((p) => p.status === "aktif").length} aktif`}
          icon={Layers}
        />
        <StatCard
          label="Dosya"
          value={formatNum(toplamDosya)}
          hint={formatBytes(toplamBayt)}
          icon={FolderTree}
        />
        <StatCard
          label="Eksik Bulgu"
          value={formatNum(toplamEksik)}
          hint="insanın bakması gereken"
          icon={TriangleAlert}
        />
        <StatCard
          label="Eşleşmemiş"
          value={String(eslesmemis.length)}
          hint="iş kalemine bağlanmamış paket"
          icon={PackageSearch}
        />
      </div>

      {yazabilir && (
        <div className="flex justify-end">
          <Button asChild size="sm">
            <Link href="/drawings/new">Klasör Yükle</Link>
          </Button>
        </div>
      )}

      {eslesmemis.length > 0 && yazabilir && (
        <UnmatchedCard packages={eslesmemis.map((p) => ({
          id: p.id,
          folderName: p.folder_name,
          itemNo: p.item_no,
        }))} items={kalemler} />
      )}

      {paketler.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4 border bg-card px-6 py-16 text-center"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, var(--muted) 0 10px, transparent 10px 20px)",
          }}
        >
          <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
            [ HENÜZ PAKET YOK ]
          </h2>
          <p className="max-w-md bg-card px-3 py-1 text-sm text-foreground/70">
            Teknik ressamın klasörünü olduğu gibi yükleyin. Sistem klasöre biçim
            dayatmaz: adını çözemese de dosyaları saklar, çözebildiğini deftere
            yazar ve anlayamadığını raporda söyler.
          </p>
          {yazabilir && (
            <Button asChild size="sm">
              <Link href="/drawings/new">Klasör Yükle</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="oc-scrollx overflow-x-auto border bg-card [--oc-scroll-bg:var(--card)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Kalem No</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead className="hidden lg:table-cell">Grup</TableHead>
                <TableHead className="hidden md:table-cell text-right">Dosya</TableHead>
                <TableHead className="hidden md:table-cell text-right">Parça</TableHead>
                <TableHead className="text-right">Tanıma</TableHead>
                <TableHead>Bulgu</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paketler.map((p) => {
                const eksik = p.finding_counts?.eksik ?? 0;
                const celiski = p.finding_counts?.celiski ?? 0;
                const eskiKural = p.reconciler_version > 0 && p.reconciler_version < RECONCILER_VERSION;
                return (
                  <TableRow key={p.id} className="relative">
                    <TableCell className="font-mono text-sm">
                      <Link href={`/drawings/${p.id}`} className="absolute inset-0" aria-label={p.folder_name} />
                      {p.item_no || <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell className="min-w-0">
                      <span className="block truncate font-medium" title={p.folder_name}>
                        {p.description || p.folder_name}
                        {p.capacity && (
                          <span className="ml-1 text-muted-foreground">({p.capacity})</span>
                        )}
                      </span>
                      {/* Dar ekranda gizlenen sütunların kritik olanı buraya iner */}
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground md:hidden">
                        {[
                          p.group_code && `grup ${p.group_code}`,
                          `${formatNum(p.file_count)} dosya`,
                          `${formatNum(p.part_count)} parça`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell font-mono text-sm text-muted-foreground">
                      {p.group_code || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right font-mono text-sm">
                      {formatNum(p.file_count)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right font-mono text-sm">
                      {formatNum(p.part_count)}
                    </TableCell>

                    <TableCell className="text-right">
                      <span className={`font-mono text-sm font-medium ${recognitionClass(p.recognition_pct)}`}>
                        {p.recognition_pct == null ? "—" : `%${p.recognition_pct}`}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {eksik > 0 && (
                          <span className="border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px] text-destructive">
                            {eksik} eksik
                          </span>
                        )}
                        {celiski > 0 && (
                          <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                            {celiski} çelişki
                          </span>
                        )}
                        {eksik === 0 && celiski === 0 && (
                          <span className="font-mono text-[11px] text-muted-foreground">—</span>
                        )}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {PACKAGE_STATUS_LABELS[p.status]}
                        </span>
                        {eskiKural && (
                          <span
                            className="relative z-10 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400"
                            title="Tanıma kuralları güncellendi; yeniden eşleştirilebilir."
                          >
                            kural eski
                          </span>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

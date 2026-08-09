// Paket kabuğu: kırıntı yolu + künye + bölüm rayı.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { PACKAGE_STATUS_LABELS, formatBytes, formatNum, recognitionClass } from "@/lib/drawings/labels";
import { RECONCILER_VERSION } from "@/lib/drawings/reconcile";
import { loadPackage } from "../data";
import { PackageNav } from "./package-nav";
import { PackageActions } from "./package-actions";
import { PackageOutputs } from "./package-outputs";

export default async function PackageLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const supabase = await createClient();
  const paket = await loadPackage(supabase, id);
  if (!paket) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditDrawings(profile?.role);

  const eskiKural = paket.reconciler_version > 0 && paket.reconciler_version < RECONCILER_VERSION;

  return (
    <div className="grid gap-3">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/drawings" className="inline-flex items-center hover:underline">
          <ChevronLeft className="size-4" />
          Teknik Resimler
        </Link>
        <span aria-hidden>/</span>
        <span className="min-w-0 truncate text-foreground" title={paket.folder_name}>
          {paket.description || paket.folder_name}
        </span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3 border bg-card p-4">
        <div className="min-w-0">
          <h1 className="truncate text-base font-medium" title={paket.folder_name}>
            {paket.description || paket.folder_name}
            {paket.capacity && <span className="ml-1 text-muted-foreground">({paket.capacity})</span>}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {[
              paket.item_no ? `kalem ${paket.item_no}` : "kalem eşleşmemiş",
              paket.group_code && `grup ${paket.group_code}`,
              `${formatNum(paket.file_count)} dosya`,
              formatBytes(Number(paket.bytes_total ?? 0)),
              `${formatNum(paket.part_count)} parça`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/70" title={paket.folder_name}>
            {paket.folder_name}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="text-right">
            <span className="oc-kicker block text-muted-foreground">Tanıma</span>
            <span className={`font-mono text-lg font-semibold ${recognitionClass(paket.recognition_pct)}`}>
              {paket.recognition_pct == null ? "—" : `%${paket.recognition_pct}`}
            </span>
          </span>
          <span className="border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {PACKAGE_STATUS_LABELS[paket.status]}
          </span>
          {eskiKural && (
            <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
              kural eski
            </span>
          )}
          {/* ÇIKTILAR yetki kapısının DIŞINDA: indirmek okumadır, paketi
              değiştirmez. Müdürün satın alma listesine erişememesi anlamsız
              olurdu. Değiştiren eylemler (Yeniden Eşleştir · Sil) içeride. */}
          <PackageOutputs packageId={paket.id} />
          {yazabilir && <PackageActions packageId={paket.id} />}
        </div>
      </header>

      <PackageNav packageId={paket.id} />

      {children}
    </div>
  );
}

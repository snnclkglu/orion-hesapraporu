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
import { formatBytes, formatNum } from "@/lib/drawings/labels";
import { loadItemOptions, loadPackages, storageState } from "./data";
import { PackagesTable } from "./packages-table";
import { ResumeCard } from "./resume-card";
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
  // ÖZET KARTLARI DA GERÇEK BAYTI SAYAR. `bytes_total` istemcinin beyanıdır ve
  // paket açılırken bir kez yazılır; depoya hiçbir şey ulaşmasa bile aynı
  // rakamı gösterirdi.
  const depolar = paketler.map((p) => storageState(p));
  const toplamDosya = depolar.reduce((t, d) => t + d.stored, 0);
  const beklenenDosya = depolar.reduce((t, d) => t + d.expected, 0);
  const toplamBayt = depolar.reduce((t, d) => t + d.storedBytes, 0);
  const toplamUlasmayan = depolar.reduce((t, d) => t + d.missing, 0);
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
          label="Depodaki Dosya"
          value={formatNum(toplamDosya)}
          hint={
            toplamUlasmayan > 0
              ? `${formatBytes(toplamBayt)} · ${formatNum(toplamUlasmayan)} dosya ulaşmamış`
              : `${formatBytes(toplamBayt)} · ${formatNum(beklenenDosya)} bekleniyor`
          }
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

      {/* Yarım kalmış yüklemeler EN ÜSTTE: yükleme kesildiyse kullanıcının
          ilk sorusu "dosyalarım ne oldu"dur, listeyi taramaya bırakılmamalı. */}
      <ResumeCard />

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
        <PackagesTable packages={paketler} />
      )}
    </div>
  );
}

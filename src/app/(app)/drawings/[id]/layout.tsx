// Paket kabuğu: kırıntı yolu + künye + bölüm rayı.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { PACKAGE_STATUS_LABELS, formatBytes, formatNum, recognitionClass } from "@/lib/drawings/labels";
import { RECONCILER_VERSION } from "@/lib/drawings/reconcile";
import { loadPackage, storageState } from "../data";
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
  const depo = storageState(paket);

  // ÜRETİME GİRMİŞ PAKET SİLİNEMEZ. Kural veritabanı tetikleyicisindedir; bu
  // sayı yalnız düğmenin daha tıklanmadan bunu SÖYLEYEBİLMESİ için okunur
  // (projeyi silmedeki `hasIssuedRevision` kalıbının aynısı). Anlamlı ilerleme
  // aranır: pano bir aşamayı geri alırken sıfır satır bırakabilir ve o satır
  // yüzünden silmeyi kilitlemek yanlış alarm olurdu.
  const { count: uretimKaydi } = await supabase
    .from("drawing_part_progress")
    .select("id", { count: "exact", head: true })
    .eq("package_id", paket.id)
    .gt("qty_done", 0);

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
          {/* KÜNYE ARTIK BEYANI DEĞİL ÖLÇÜMÜ BASAR.
              Eski satır `file_count` ve `bytes_total` yazıyordu; ikisi de paket
              AÇILIRKEN bir kez yazılıp bir daha güncellenmiyordu. Yani 107 MB'ın
              hiçbiri depoya ulaşmasa bile başlık "174 dosya · 107 MB" diyordu.
              Artık depodaki gerçek sayı yazılır; eksik varsa kırmızı görünür. */}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {[
              paket.item_no ? `kalem ${paket.item_no}` : "kalem eşleşmemiş",
              paket.group_code && `grup ${paket.group_code}`,
              paket.rev_no > 1 && `R${String(paket.rev_no).padStart(2, "0")}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            {" · "}
            <span className={depo.missing > 0 ? "font-semibold text-destructive" : undefined}>
              {formatNum(depo.stored)}/{formatNum(depo.expected)} dosya depoda
            </span>
            {" · "}
            {formatBytes(depo.storedBytes)}
            {/* PAYDA ATLANANLARI DÜŞER. `bytes_total` ile karşılaştırmak,
                hiçbir bayt kaybetmemiş bir pakette bile kalıcı olarak
                "91,6 MB / 107 MB" gösterirdi — atlanan 15,4 MB'ın nesnesi hiç
                yoktur. İki sayı ancak aynı şeyi sayarken karşılaştırılabilir. */}
            {depo.storedBytes < depo.expectedBytes && (
              <span className="text-muted-foreground/70">
                {" / "}
                {formatBytes(depo.expectedBytes)}
              </span>
            )}
            {" · "}
            {formatNum(paket.part_count)} parça
            {depo.skipped > 0 && ` · ${formatNum(depo.skipped)} dosya atlandı`}
            {!depo.verifiedAt && " · henüz doğrulanmadı"}
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/70" title={paket.folder_name}>
            {paket.folder_name}
          </p>
        </div>

        {/* `shrink-0` DEĞİL `min-w-0`: `shrink-0` verilen bir flex öğesinin
            kullanılan genişliği max-content'tir ve içindeki `flex-wrap` hiç
            devreye girmez — satır kırmak için daralması gerekir, daralamaz.
            Bu faz düğme sayısını ikiden beşe çıkardı; blok ~1150px'e ulaşıp
            375px'lik telefonda bütün sayfayı yana kaydırıyordu (AGENTS
            dokunmatik md. 8: görünmeyen yatay kaydırma). */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
          {yazabilir && (
            <PackageActions
              packageId={paket.id}
              folderName={paket.folder_name}
              storedCount={depo.stored}
              bytes={depo.storedBytes || depo.expectedBytes}
              partCount={paket.part_count}
              progressCount={uretimKaydi ?? 0}
              missing={depo.missing}
            />
          )}
        </div>
      </header>

      <PackageNav packageId={paket.id} />

      {children}
    </div>
  );
}

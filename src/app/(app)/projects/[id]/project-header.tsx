// Proje detayının başlık bloğu: künye · eylem şeridi · birincil eylemler.
//
// Kendi dosyasındadır ki `/dev/project-preview` GERÇEK bloğu bassın. Sayfanın
// markup'ı önizlemeye kopyalansaydı iki düzen zamanla ayrışır, önizleme yanlış
// güven verirdi (önizleme sayfasının kendi notu).

import Link from "next/link";
import { GitCompare, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewRevisionButton } from "./new-revision-button";
import { ArchiveButton } from "./archive-button";
import { ProjectDetailActions, type ProjectSummary } from "../project-actions";
import type { JobOption } from "../new-project-dialog";

export interface HeaderJob {
  id: string;
  job_no: string;
}

export interface HeaderRevision {
  id: string;
  rev_no: number;
  status: string;
}

export function ProjectDetailHeader({
  project,
  job,
  summary,
  jobs,
  canDelete,
  latestRev,
  isFirstRevision,
  itemNo,
}: {
  project: { id: string; doc_no: string; name: string; customer: string; crane_type: string; archived: boolean };
  job: HeaderJob | null;
  summary: ProjectSummary;
  jobs: JobOption[];
  canDelete: boolean;
  latestRev: HeaderRevision | null;
  isFirstRevision: boolean;
  /**
   * İŞ KALEMİ NUMARASI — kırıntı yolunun son durağı.
   *
   * Eskiden burada `projects.doc_no` duruyordu ve yol "İşler / 0055 / 0055"
   * gibi kendini tekrar ediyordu: iş kökü ile belge kodu aynı görünüyor,
   * raporun HANGİ KALEME ait olduğu okunmuyordu. Doğrusu "İşler / 0055 /
   * 0055-00"dır. Alan `doc_no`dan DEĞİL `job_items.item_no`dan gelir
   * (`resolveProjectItemNo`): eski raporların `doc_no`su bilinçli olarak
   * kalemsiz bırakıldı — yayınlanmış PDF'lerin belge kodu değişmemeli
   * (AGENTS md. 14) — ama ekranda gezinme yolu sistemin kendi numarasını
   * göstermelidir. Kaleme bağlanmamış raporda `doc_no`ya düşer.
   */
  itemNo?: string;
}) {
  const hasDraft = latestRev?.status === "draft";

  return (
    /* ÜST SATIR künye + birincil eylemler, ALT SATIR eylem şerididir.
       Daha önce künye VE şerit tek bir sol sütundaydı, birincil düğmeler de o
       sütunun sağındaki ikinci sütunda: `justify-between` ikisini yan yana
       koyacaktı ama sağ sütunun taban genişliğini DÜĞMELER değil altındaki
       açıklama metni belirliyordu (~380px, tek satır). 787px'lik şeritle
       toplam 1088px'lik içerik genişliğini aşıyor, sağ sütun alt satıra
       düşüyor ve orada `items-end` yüzünden metnin sağ ucuna hizalanıp ~38px
       içeriden — ne sola ne sağa dayalı — asılı kalıyordu. */
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
          <div className="text-sm text-muted-foreground">
            {job ? (
              <>
                <Link href="/jobs" className="hover:underline">İşler</Link>
                {" / "}
                <Link href={`/jobs/${job.id}`} className="font-mono hover:underline">
                  {job.job_no}
                </Link>
              </>
            ) : (
              <Link href="/projects" className="hover:underline">Mühendislik</Link>
            )}
            {" / "}
            <span className="font-mono">{itemNo?.trim() || project.doc_no}</span>
          </div>
          {/* `h2`: sayfanın `h1`i kabuğun üst şeridindedir (PageHeader). */}
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h2>
          <p className="text-sm text-muted-foreground">
            {project.customer} · {project.crane_type}
          </p>
        </div>

        {/* Birincil eylemler ÜST SATIRIN sağ ucundadır — künyenin yanı, eylem
            şeridinin değil: şerit tek başına 787px tutuyor, düğmeler 313px, ve
            1088px'lik içerik genişliği ikisini bir satırda taşımıyor. Künye
            satırında ise başlığın sağında ~700px boş yer var.
            `sm:basis-0`: künye esneme tabanı sıfır olduğu için düğmeleri ALT
            SATIRA İTEMEZ; uzun proje adı sarar, düğmeler yerinde kalır.
            "Düzenlemeye Devam" elle yazılmış bir bağlantıyken h-9, yanındaki
            "Yeni Revizyon" Button'u h-10 idi — bitişik iki düğme 4px kaçıktı;
            `asChild` ikisini de aynı boy/varyant belirtecinden geçirir. */}
        <div className="flex w-full flex-col gap-1 sm:w-auto sm:shrink-0 sm:items-end">
          <div className="flex flex-wrap gap-2">
            {hasDraft && latestRev && (
              <Button asChild>
                <Link href={`/projects/${project.id}/revisions/${latestRev.id}`}>
                  Düzenlemeye Devam (V{latestRev.rev_no})
                </Link>
              </Button>
            )}
            <NewRevisionButton
              projectId={project.id}
              isFirst={isFirstRevision}
              variant={hasDraft ? "outline" : "default"}
            />
          </div>
          {/* Açıklama düğmelere BAĞLI ama sütunun taban genişliğini
              belirlememeli: eski düzende tam da bu metin (~380px tek satır)
              sağ sütunu şişirip alt satıra düşürüyordu. Kelepçe sarmasına izin
              verir, ölçüyü düğmelere bırakır. */}
          <p className="max-w-[26rem] text-xs text-muted-foreground sm:text-right">
            {isFirstRevision
              ? "İlk hesap raporu şablondan kopyalanarak açılır — boş sayfayla başlamazsınız."
              : "Yeni revizyon, son revizyonun kopyasıyla açılır — sıfırdan başlamaz."}
          </p>
        </div>
      </div>

      {/* İlk iki bağlantı elle yazılmış düğmelerdir; yanlarındaki `size="sm"`
          Button'lar dokunmatik payını tabandan alıyor, bunlar almıyordu. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <Link
          href={`/projects/${project.id}/compare`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm hover:bg-muted pointer-coarse:h-10"
        >
          <GitCompare className="size-3.5 text-muted-foreground" />
          Revizyonları Karşılaştır
        </Link>
        <Link
          href={`/projects/${project.id}/audit`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm hover:bg-muted pointer-coarse:h-10"
        >
          <ScrollText className="size-3.5 text-muted-foreground" />
          İşlem Kaydı
        </Link>
        <ArchiveButton projectId={project.id} archived={project.archived} />
        <ProjectDetailActions project={summary} jobs={jobs} canDelete={canDelete} />
      </div>
    </div>
  );
}

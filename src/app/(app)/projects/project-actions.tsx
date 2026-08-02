"use client";

// Hesap raporu satır/sayfa eylemleri: Kopyala · İşe Bağla · Sil.
// Hem Projeler listesinde (satır menüsü) hem proje detayında (satır içi
// butonlar) kullanılır; dialoglar kontrollüdür, tetikleyiciyi çağıran kurar.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Link2, MoreHorizontal, Trash2 } from "lucide-react";
import {
  assignProjectToJob,
  deleteProject,
  duplicateProject,
  type DuplicateProjectInput,
} from "./actions";
import {
  NO_ITEM, NO_JOB, type JobItemOption, type JobOption,
} from "./new-project-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface ProjectSummary {
  id: string;
  doc_no: string;
  name: string;
  customer: string;
  job_id: string | null;
  /** Bağlı işin numarası — iş arşivlenmişse seçenek listesinde görünmesi için */
  job_no?: string | null;
  /** Yayınlanmış revizyonu var mı — varsa rapor silinemez, arşivlenir */
  hasIssuedRevision: boolean;
}

/**
 * Seçenek listesi yalnız AKTİF işleri taşır; rapor arşivlenmiş bir işe bağlıysa
 * mevcut bağlantı listede görünmez olurdu. Bu yüzden bağlı iş listede yoksa
 * başa eklenir (yeni hedef olarak seçilebilir kalması amaçlı değil, mevcut
 * durumun doğru gösterilmesi içindir).
 */
function withCurrentJob(jobs: JobOption[], project: ProjectSummary): JobOption[] {
  if (!project.job_id || jobs.some((j) => j.id === project.job_id)) return jobs;
  return [
    {
      id: project.job_id,
      job_no: project.job_no || "—",
      title: "Arşivlenmiş İş",
      customer: project.customer,
      items: [],
    },
    ...jobs,
  ];
}

/**
 * Kaynak doküman nodan kopya için öneri üretir: sondaki sayı bir artırılır
 * (sıfır dolgusu korunur), sayı yoksa "-K1" eklenir. Doküman no benzersizdir;
 * çakışırsa sunucu Türkçe hata döner ve kullanıcı elle düzeltir.
 */
export function suggestDocNo(source: string): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(source.trim());
  if (!m) return `${source.trim()}-K1`;
  const [, head, digits, tail] = m;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return `${head}${next}${tail}`;
}

/** Seçili işin kalemleri arasından bu rapora bağlı olanı bulur */
function linkedItem(job: JobOption | undefined, projectId: string): JobItemOption | undefined {
  return job?.items?.find((it) => it.project_id === projectId);
}

// ------------------------------------------------------------- Kopyala

export function DuplicateProjectDialog({
  project,
  jobs,
  open,
  onOpenChange,
}: {
  project: ProjectSummary;
  jobs: JobOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [docNo, setDocNo] = useState(() => suggestDocNo(project.doc_no));
  const [name, setName] = useState(project.name);
  const [customer, setCustomer] = useState(project.customer);
  const [jobId, setJobId] = useState<string>(project.job_id ?? NO_JOB);
  const [itemId, setItemId] = useState<string>(NO_ITEM);

  const jobOptions = useMemo(() => withCurrentJob(jobs, project), [jobs, project]);
  const selectedJob = useMemo(
    () => jobOptions.find((j) => j.id === jobId),
    [jobOptions, jobId]
  );
  const items = selectedJob?.items ?? [];

  function onPickJob(id: string) {
    setJobId(id);
    setItemId(NO_ITEM);
    const job = jobOptions.find((j) => j.id === id);
    if (job) setCustomer(job.customer);
  }

  function onPickItem(id: string) {
    setItemId(id);
    const item = items.find((it) => it.id === id);
    if (item) {
      if (item.item_no) setDocNo(item.item_no);
      if (item.product_name) setName(item.product_name);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: DuplicateProjectInput = {
      doc_no: docNo,
      name,
      customer,
      job_id: jobId === NO_JOB ? null : jobId,
      job_item_id: jobId === NO_JOB || itemId === NO_ITEM ? null : itemId,
    };
    startTransition(async () => {
      const result = await duplicateProject(project.id, input);
      if (result?.error) toast.error(result.error);
      // Başarıda action yeni rapora yönlendirir.
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hesap Raporunu Kopyala</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{project.doc_no}</span> raporunun son
            revizyonu yeni raporda V0 taslağı olarak açılır. İsterseniz kopyayı
            doğrudan başka bir işe atayın.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Hedef İş</Label>
            <Select value={jobId} onValueChange={onPickJob}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_JOB}>Bağımsız (İşe Atanmamış)</SelectItem>
                {jobOptions.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.job_no} · {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {items.length > 0 && (
            <div className="grid gap-2">
              <Label>İş Kalemi</Label>
              <Select value={itemId} onValueChange={onPickItem}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ITEM}>Kalem Seçilmedi (Elle Gir)</SelectItem>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.item_no ? `${it.item_no} · ` : ""}
                      {it.product_name}
                      {it.quantity ? ` (${it.quantity})` : ""}
                      {it.project_id ? " — Raporu Var" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="dup_doc_no">Yeni Doküman No</Label>
            <Input
              id="dup_doc_no"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dup_name">Rapor / Vinç Adı</Label>
            <Input
              id="dup_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dup_customer">Müşteri</Label>
            <Input
              id="dup_customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Kopyalanıyor..." : "Kopyala"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------ İşe Bağla

export function AssignJobDialog({
  project,
  jobs,
  open,
  onOpenChange,
}: {
  project: ProjectSummary;
  jobs: JobOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const jobOptions = useMemo(() => withCurrentJob(jobs, project), [jobs, project]);
  const currentJob = jobOptions.find((j) => j.id === project.job_id);
  const [jobId, setJobId] = useState<string>(project.job_id ?? NO_JOB);
  const [itemId, setItemId] = useState<string>(
    () => linkedItem(currentJob, project.id)?.id ?? NO_ITEM
  );

  const selectedJob = useMemo(
    () => jobOptions.find((j) => j.id === jobId),
    [jobOptions, jobId]
  );
  const items = selectedJob?.items ?? [];

  function onPickJob(id: string) {
    setJobId(id);
    setItemId(linkedItem(jobOptions.find((j) => j.id === id), project.id)?.id ?? NO_ITEM);
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await assignProjectToJob(
        project.id,
        jobId === NO_JOB ? null : jobId,
        jobId === NO_JOB || itemId === NO_ITEM ? null : itemId
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        jobId === NO_JOB ? "Hesap raporu işten çıkarıldı." : "Hesap raporu işe bağlandı."
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hesap Raporunu İşe Bağla</DialogTitle>
          <DialogDescription>
            {currentJob
              ? `Bu rapor şu an ${currentJob.job_no} işine bağlı. Başka bir iş seçebilir ya da "Bağımsız" seçerek işten çıkarabilirsiniz.`
              : "Bu rapor bağımsız. Bir iş emri seçerek rapora ait işi belirleyin."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>İş Emri</Label>
            <Select value={jobId} onValueChange={onPickJob}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_JOB}>Bağımsız (İşten Çıkar)</SelectItem>
                {jobOptions.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.job_no} · {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {items.length > 0 && (
            <div className="grid gap-2">
              <Label>İş Kalemi (İsteğe Bağlı)</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ITEM}>Kalem Seçilmedi</SelectItem>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.item_no ? `${it.item_no} · ` : ""}
                      {it.product_name}
                      {it.quantity ? ` (${it.quantity})` : ""}
                      {it.project_id && it.project_id !== project.id ? " — Raporu Var" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Kalem seçilirse bu rapor o kaleme bağlanır; raporun eski kalem
                bağlantısı temizlenir.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Sil

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const blocked = project.hasIssuedRevision;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (result?.error) toast.error(result.error);
      // Başarıda action Projeler listesine yönlendirir.
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hesap Raporunu Sil</DialogTitle>
          <DialogDescription>
            {blocked ? (
              "Yayınlanmış revizyonu olan hesap raporu silinemez; önce arşivleyin."
            ) : (
              <>
                <span className="font-mono">{project.doc_no}</span> — {project.name}{" "}
                raporu ve tüm taslak revizyonları kalıcı olarak silinecek. Bu
                işlem geri alınamaz.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={pending || blocked}
          >
            {pending ? "Siliniyor..." : "Kalıcı Olarak Sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------- Birleşik tetikleyiciler

type ActiveDialog = "duplicate" | "assign" | "delete" | null;

/** Projeler listesi satır menüsü — satırı kaplayan link ile çakışmaz (z-10) */
export function ProjectRowActions({
  project,
  jobs,
  canDelete,
}: {
  project: ProjectSummary;
  jobs: JobOption[];
  /** Yalnızca yönetici siler (projects DELETE politikası is_admin() ister) */
  canDelete: boolean;
}) {
  const [active, setActive] = useState<ActiveDialog>(null);

  return (
    <div className="relative z-10 flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-8 p-0">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Satır Eylemleri</span>
          </Button>
        </DropdownMenuTrigger>
        {/* Menü kapanırken odak tetikleyiciye dönmesin — hemen açılan dialogla
            odak çekişmesi yaşanmasın diye. */}
        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem onSelect={() => setActive("duplicate")}>
            <Copy className="size-3.5" /> Kopyala
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActive("assign")}>
            <Link2 className="size-3.5" /> İşe Bağla
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setActive("delete")}>
                <Trash2 className="size-3.5" /> Sil
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialoglar menünün dışında durur; menü kapansa da açık kalırlar. */}
      {active === "duplicate" && (
        <DuplicateProjectDialog
          project={project}
          jobs={jobs}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
      {active === "assign" && (
        <AssignJobDialog
          project={project}
          jobs={jobs}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
      {active === "delete" && canDelete && (
        <DeleteProjectDialog
          project={project}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
    </div>
  );
}

/** Proje detay sayfası eylem şeridi (Kopyala · İşe Bağla · Sil) */
export function ProjectDetailActions({
  project,
  jobs,
  canDelete,
}: {
  project: ProjectSummary;
  jobs: JobOption[];
  canDelete: boolean;
}) {
  const [active, setActive] = useState<ActiveDialog>(null);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setActive("duplicate")}>
        <Copy className="size-3.5 text-muted-foreground" /> Kopyala
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setActive("assign")}>
        <Link2 className="size-3.5 text-muted-foreground" />
        {project.job_id ? "İşi Değiştir" : "İşe Bağla"}
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setActive("delete")}
        >
          <Trash2 className="size-3.5" /> Sil
        </Button>
      )}

      {active === "duplicate" && (
        <DuplicateProjectDialog
          project={project}
          jobs={jobs}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
      {active === "assign" && (
        <AssignJobDialog
          project={project}
          jobs={jobs}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
      {active === "delete" && canDelete && (
        <DeleteProjectDialog
          project={project}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
    </>
  );
}

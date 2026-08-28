"use client";

// Hesap raporu satır/sayfa eylemleri: Kopyala · İşe Bağla · Sil.
// Hem Mühendislik listesinde (satır menüsü) hem proje detayında (satır içi
// butonlar) kullanılır; dialoglar kontrollüdür, tetikleyiciyi çağıran kurar.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  assignProjectToJob,
  deleteProject,
  duplicateProject,
  updateProjectDetails,
  type DuplicateProjectInput,
  type ProjectDetailsInput,
} from "./actions";
import {
  NO_CUSTOMER,
  NO_ITEM,
  NO_JOB,
  type CustomerOption,
  type JobItemOption,
  type JobOption,
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
// Saf yardımcı — kod önizlemesi ile basılan belge AYNI fonksiyondan çıkar.
import { docCode } from "@/lib/pdf/doc-naming";
import {
  DEFAULT_CRANE_TYPE,
  craneTypeOptions,
  offerCraneTypeOptions,
} from "@/lib/crane-types";
import { adBuyuk } from "@/lib/tr-text";
import {
  ENGINEERING_REPORT_CONTEXT,
  OFFER_REPORT_CONTEXT,
  type ReportContext,
} from "@/lib/report-context";

export interface ProjectSummary {
  id: string;
  doc_no: string;
  name: string;
  customer: string;
  /**
   * Vinç tipi — proje bilgisi penceresinden DEĞİŞTİRİLEBİLİR (kullanıcı kararı,
   * 15.08.2026). Alan bir süre yalnız açılışta soruluyordu; yanlış tiple açılmış
   * bir raporu düzeltmenin yolu raporu kopyalamaktı.
   */
  crane_type?: string | null;
  crane_location?: string | null;
  report_brand_customer_id?: string | null;
  end_customer_id?: string | null;
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
 *
 * Doküman no İŞ KALEMİ NUMARASI olduğu için artış kuralı zaten kalem
 * numaralandırmasıyla örtüşür: `0055-01` → `0055-02`. Öneri O NUMARANIN gerçek
 * kalemine ait raporla çakışabilir; bu yüzden öneridir, dayatma değil.
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
  reportContext = ENGINEERING_REPORT_CONTEXT,
}: {
  project: ProjectSummary;
  jobs: JobOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportContext?: ReportContext;
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
  const allowJobAssignment = reportContext !== OFFER_REPORT_CONTEXT;

  function onPickJob(id: string) {
    setJobId(id);
    setItemId(NO_ITEM);
    const job = jobOptions.find((j) => j.id === id);
    // Ön-doldurulan ad da BÜYÜK HARF kuralından geçer (bkz. `adBuyuk`).
    if (job) setCustomer(adBuyuk(job.customer));
  }

  function onPickItem(id: string) {
    setItemId(id);
    const item = items.find((it) => it.id === id);
    if (item) {
      if (item.item_no) setDocNo(item.item_no);
      if (item.product_name) setName(adBuyuk(item.product_name));
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
          {allowJobAssignment && (
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
          )}

          {allowJobAssignment && items.length > 0 && (
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
            <p className="text-[11px] text-muted-foreground">
              {allowJobAssignment ? (
                <>
                  Doküman no <span className="font-medium">iş kalemi numarasıdır</span>; rapor
                  kodu bundan türer →{" "}
                </>
              ) : (
                <>Teklif çalışmasına ait benzersiz doküman no; rapor kodu bundan türer → </>
              )}
              <span className="font-mono">{docCode("HR", docNo || "0055-02", 1)}</span>
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dup_name">Rapor / Vinç Adı</Label>
            <Input
              id="dup_name"
              value={name}
              onChange={(e) => setName(adBuyuk(e.target.value))}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dup_customer">Müşteri</Label>
            <Input
              id="dup_customer"
              value={customer}
              onChange={(e) => setCustomer(adBuyuk(e.target.value))}
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

// --------------------------------------------------------- Proje bilgileri

export function EditProjectDetailsDialog({
  project,
  customers,
  open,
  onOpenChange,
  reportContext = ENGINEERING_REPORT_CONTEXT,
}: {
  project: ProjectSummary;
  customers: CustomerOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportContext?: ReportContext;
}) {
  const [pending, startTransition] = useTransition();
  const [docNo, setDocNo] = useState(project.doc_no);
  const [name, setName] = useState(project.name);
  const [customer, setCustomer] = useState(project.customer);
  const [craneLocation, setCraneLocation] = useState(project.crane_location ?? "");
  const [endCustomerId, setEndCustomerId] = useState(
    project.end_customer_id ?? NO_CUSTOMER
  );
  const [reportBrandCustomerId, setReportBrandCustomerId] = useState(
    project.report_brand_customer_id ?? NO_CUSTOMER
  );
  const [craneType, setCraneType] = useState(project.crane_type || DEFAULT_CRANE_TYPE);
  const craneTypes = useMemo(
    () =>
      reportContext === OFFER_REPORT_CONTEXT
        ? offerCraneTypeOptions(project.crane_type)
        : craneTypeOptions(project.crane_type),
    [project.crane_type, reportContext]
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: ProjectDetailsInput = {
      doc_no: docNo,
      name,
      customer,
      crane_type: craneType,
      crane_location: craneLocation,
      report_brand_customer_id:
        reportBrandCustomerId === NO_CUSTOMER ? null : reportBrandCustomerId,
      end_customer_id: endCustomerId === NO_CUSTOMER ? null : endCustomerId,
    };
    startTransition(async () => {
      const result = await updateProjectDetails(project.id, input);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Proje bilgileri güncellendi.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Proje Bilgilerini Düzenle</DialogTitle>
          <DialogDescription>
            Doküman kimliği, kapak firmaları, vinç yeri ve temel proje bilgileri güncellenir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project_doc_no">Doküman No</Label>
            <Input
              id="project_doc_no"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Rapor kodu → <span className="font-mono">{docCode("HR", docNo || "0055-01", 1)}</span>
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project_name">Proje / İş Adı</Label>
            <Input
              id="project_name"
              value={name}
              onChange={(e) => setName(adBuyuk(e.target.value))}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project_customer">Müşteri</Label>
            <Input
              id="project_customer"
              value={customer}
              onChange={(e) => setCustomer(adBuyuk(e.target.value))}
              required
            />
          </div>
          {customers.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label>Son Kullanıcı (Logo)</Label>
                <Select
                  value={endCustomerId}
                  onValueChange={(id) => {
                    setEndCustomerId(id);
                    const selected = customers.find((entry) => entry.id === id);
                    if (selected) setCustomer(adBuyuk(selected.name));
                  }}
                >
                  <SelectTrigger className="w-full min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CUSTOMER}>Logo Gösterme</SelectItem>
                    {customers.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.short_name || entry.name}{entry.has_logo ? "" : " · Logo Yok"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label>Raporu Hazırlayan Firma</Label>
                <Select value={reportBrandCustomerId} onValueChange={setReportBrandCustomerId}>
                  <SelectTrigger className="w-full min-w-0 [&>span]:truncate"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CUSTOMER}>ORION CRANES</SelectItem>
                    {customers.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.short_name || entry.name}{entry.has_logo ? "" : " · Logo Yok"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="project_crane_location">Vinç Yeri (Opsiyonel)</Label>
            <Input
              id="project_crane_location"
              value={craneLocation}
              onChange={(e) => setCraneLocation(adBuyuk(e.target.value))}
              maxLength={240}
            />
          </div>
          {/* Vinç tipi: hesap bölümlerini doğrudan açmaz (topoloji kararı
              Teknik Özellikler'dedir) ama rapor kapağına ve listeye basılır.
              "Vinç Arabası" ve tekliflerdeki "Yer Vinci" yalnız YENİ bir
              raporun İLK revizyonu doğarken revizyon topolojisini ÖNERİR
              (`applyCraneTypeRevisionPreset`). Buradan tipi
              değiştirmek mevcut revizyonların kapalı bölüm listesine
              dokunmaz — o karar artık revizyonun kendi verisidir. */}
          <div className="grid gap-2">
            <Label htmlFor="project_crane_type">Vinç Tipi</Label>
            <Select value={craneType} onValueChange={setCraneType}>
              <SelectTrigger id="project_crane_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {craneTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Kaydediliyor..." : "Kaydet"}
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
      else {
        toast.success("Silme talebi Yönetici onayına gönderildi.");
        onOpenChange(false);
      }
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
                raporu ve tüm taslak revizyonları için kalıcı silme talebi
                oluşturulacak. Kayıt, Yönetici onaylayana kadar değişmeden kalır.
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
            {pending ? "Gönderiliyor..." : "Silme Talebi Gönder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------- Birleşik tetikleyiciler

type ActiveDialog = "edit" | "duplicate" | "assign" | "delete" | null;

/** Mühendislik listesi satır menüsü — satırı kaplayan link ile çakışmaz (z-10) */
export function ProjectRowActions({
  project,
  jobs,
  customers,
  canDelete,
  reportContext = ENGINEERING_REPORT_CONTEXT,
}: {
  project: ProjectSummary;
  jobs: JobOption[];
  customers: CustomerOption[];
  /** Yalnızca yönetici siler (projects DELETE politikası is_admin() ister) */
  canDelete: boolean;
  reportContext?: ReportContext;
}) {
  const [active, setActive] = useState<ActiveDialog>(null);

  return (
    <div className="relative z-10 flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* `icon-sm`: masaüstünde aynı 32px, dokunmatikte 40px. Elle yazılan
              `size-8` dokunma payını almıyordu ve tetikleyici satırı kaplayan
              bağlantının üstünde durduğu için ıskalanan her dokunuş
              kullanıcıyı proje detayına götürüyordu. */}
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Satır Eylemleri</span>
          </Button>
        </DropdownMenuTrigger>
        {/* Menü kapanırken odak tetikleyiciye dönmesin — hemen açılan dialogla
            odak çekişmesi yaşanmasın diye. */}
        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem onSelect={() => setActive("edit")}>
            <Pencil className="size-3.5" /> Düzenle
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActive("duplicate")}>
            <Copy className="size-3.5" /> Kopyala
          </DropdownMenuItem>
          {reportContext !== OFFER_REPORT_CONTEXT && (
            <DropdownMenuItem onSelect={() => setActive("assign")}>
              <Link2 className="size-3.5" /> İşe Bağla
            </DropdownMenuItem>
          )}
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
      {active === "edit" && (
        <EditProjectDetailsDialog
          project={project}
          customers={customers}
          reportContext={reportContext}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
      {active === "duplicate" && (
        <DuplicateProjectDialog
          project={project}
          jobs={jobs}
          reportContext={reportContext}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
      {active === "assign" && reportContext !== OFFER_REPORT_CONTEXT && (
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
  customers,
  canDelete,
  reportContext = ENGINEERING_REPORT_CONTEXT,
}: {
  project: ProjectSummary;
  jobs: JobOption[];
  customers: CustomerOption[];
  canDelete: boolean;
  reportContext?: ReportContext;
}) {
  const [active, setActive] = useState<ActiveDialog>(null);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setActive("edit")}>
        <Pencil className="size-3.5 text-muted-foreground" /> Düzenle
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setActive("duplicate")}>
        <Copy className="size-3.5 text-muted-foreground" /> Kopyala
      </Button>
      {reportContext !== OFFER_REPORT_CONTEXT && (
        <Button variant="ghost" size="sm" onClick={() => setActive("assign")}>
          <Link2 className="size-3.5 text-muted-foreground" />
          {project.job_id ? "İşi Değiştir" : "İşe Bağla"}
        </Button>
      )}
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

      {active === "edit" && (
        <EditProjectDetailsDialog
          project={project}
          customers={customers}
          reportContext={reportContext}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
      {active === "duplicate" && (
        <DuplicateProjectDialog
          project={project}
          jobs={jobs}
          reportContext={reportContext}
          open
          onOpenChange={(o) => !o && setActive(null)}
        />
      )}
      {active === "assign" && reportContext !== OFFER_REPORT_CONTEXT && (
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

"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createProject } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** Vinç tipi seçenekleri (ileride hesap varyantları bu tiplere bağlanacak) */
const CRANE_TYPES = [
  "Çift Kirişli Gezer Köprülü Vinç",
  "Tek Kirişli Gezer Köprülü Vinç",
  "Portal Vinç",
  "Yarı Portal Vinç",
  "Pergel Vinç",
  "Alttan Askılı Vinç",
  "Konsol Vinç",
] as const;

export interface JobOption {
  id: string;
  job_no: string;
  title: string;
  customer: string;
}

const NONE = "__none__";

export function NewProjectDialog({
  defaultCraneType = "Çift Kirişli Gezer Köprü Vinci",
  jobId,
  jobNo,
  defaultCustomer,
  jobs,
}: {
  defaultCraneType?: string;
  /** İş panelinden "Vinç Ekle" ile açıldığında yeni vinç bu işe sabit bağlanır. */
  jobId?: string;
  jobNo?: string;
  defaultCustomer?: string;
  /** Bağımsız akış (/projects): opsiyonel iş seçimi için iş listesi. */
  jobs?: JobOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const craneTypes: string[] = CRANE_TYPES.includes(
    defaultCraneType as (typeof CRANE_TYPES)[number]
  )
    ? [...CRANE_TYPES]
    : [defaultCraneType, ...CRANE_TYPES];
  const [craneType, setCraneType] = useState(defaultCraneType);

  // İş panelinden gelmiyorsa (jobId yok) opsiyonel iş seçimi gösterilir
  const showJobSelect = !jobId && (jobs?.length ?? 0) > 0;
  const [selectedJobId, setSelectedJobId] = useState<string>(NONE);
  const selectedJob = useMemo(
    () => jobs?.find((j) => j.id === selectedJobId),
    [jobs, selectedJobId]
  );

  // Doküman no / müşteri: iş seçilince ön-doldurulur (kullanıcı değiştirebilir)
  const [docNo, setDocNo] = useState("");
  const [customer, setCustomer] = useState(defaultCustomer ?? "");

  function onPickJob(id: string) {
    setSelectedJobId(id);
    const job = jobs?.find((j) => j.id === id);
    if (job) {
      setCustomer(job.customer);
      const base = job.job_no.split("-")[0];
      if (!docNo && base) setDocNo(`${base}-01`);
    }
  }

  const effectiveJobId = jobId ?? (selectedJobId !== NONE ? selectedJobId : "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createProject(formData);
      if (result?.error) toast.error(result.error);
      // Başarıda action redirect eder.
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{jobId ? "Vinç Ekle" : "Yeni Hesap Raporu"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{jobId ? "Vinç Ekle" : "Yeni Hesap Raporu"}</DialogTitle>
          <DialogDescription>
            {jobId
              ? `${jobNo ?? ""} işine bağlı yeni bir vinç oluşturun.`.trim()
              : "Yeni bir hesap raporu oluşturun. İsterseniz mevcut bir işe bağlayın, ya da bağımsız (deneme) bırakın."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* İş bağlantısı */}
          <input type="hidden" name="job_id" value={effectiveJobId} />
          {showJobSelect && (
            <div className="grid gap-2">
              <Label>İş Emri (opsiyonel)</Label>
              <Select value={selectedJobId} onValueChange={onPickJob}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Bağımsız (işe atanmamış)</SelectItem>
                  {jobs!.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.job_no} · {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedJob && (
                <p className="text-xs text-muted-foreground">
                  Bu rapor <span className="font-medium">{selectedJob.job_no}</span> işine bağlanacak.
                </p>
              )}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="doc_no">Doküman No</Label>
            <Input
              id="doc_no"
              name="doc_no"
              value={docNo}
              onChange={(e) => setDocNo(e.target.value)}
              placeholder={jobNo ? `${jobNo.split("-")[0]}-01` : "0055-HR-001"}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">{jobId ? "Vinç Adı" : "Rapor / Vinç Adı"}</Label>
            <Input id="name" name="name" placeholder="AMONYUM SÜLFAT VİNCİ" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer">Müşteri</Label>
            <Input
              id="customer"
              name="customer"
              placeholder="İSDEMİR"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="crane_type">Vinç Tipi</Label>
            <Select value={craneType} onValueChange={setCraneType}>
              <SelectTrigger id="crane_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {craneTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="crane_type" value={craneType} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

// "Yeni Hesap Raporu" — hesap raporları YALNIZCA Projeler bölümünden açılır.
// Açılışta istenirse doğrudan bir iş emri kalemine bağlanır; bağlanmazsa rapor
// bağımsız kalır ve sonradan "İşe Bağla" ile bir işe bağlanabilir.
// Akış: İş seçilir → o işin kalemleri (ürün + iş no) listelenir → kalem
// seçilince doküman no ve rapor adı otomatik dolar.

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

export interface JobItemOption {
  /** job_items.id — kalem bağlantısı bu kimlikle güncellenir */
  id: string;
  item_no: string;
  product_name: string;
  quantity: string | null;
  /** Kaleme bağlı hesap raporu zaten varsa (tekrar bağlanmasın diye uyarı) */
  project_id: string | null;
}

export interface JobOption {
  id: string;
  job_no: string;
  title: string;
  customer: string;
  items?: JobItemOption[];
}

/** Seçim kutularında "seçilmedi" anlamına gelen sabitler (boş değer kabul edilmez) */
export const NO_JOB = "__none__";
export const NO_ITEM = "__no_item__";

export function NewProjectDialog({
  defaultCraneType = "Çift Kirişli Gezer Köprülü Vinç",
  jobs,
}: {
  defaultCraneType?: string;
  /** Opsiyonel iş seçimi için aktif iş listesi (kalemleriyle birlikte). */
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

  const showJobSelect = (jobs?.length ?? 0) > 0;
  const [selectedJobId, setSelectedJobId] = useState<string>(NO_JOB);
  const selectedJob = useMemo(
    () => jobs?.find((j) => j.id === selectedJobId),
    [jobs, selectedJobId]
  );

  const items = selectedJob?.items ?? [];
  const [selectedItemId, setSelectedItemId] = useState<string>(NO_ITEM);
  const selectedItem = items.find((i) => i.id === selectedItemId);

  // Doküman no / rapor adı / müşteri: iş ve kalem seçilince ön-doldurulur
  const [docNo, setDocNo] = useState("");
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");

  function onPickJob(id: string) {
    setSelectedJobId(id);
    setSelectedItemId(NO_ITEM);
    const job = jobs?.find((j) => j.id === id);
    if (job) {
      setCustomer(job.customer);
      const base = job.job_no.split("-")[0];
      if (!docNo && base) setDocNo(`${base}-01`);
    }
  }

  function onPickItem(itemId: string) {
    setSelectedItemId(itemId);
    const item = items.find((i) => i.id === itemId);
    if (item) {
      if (item.item_no) setDocNo(item.item_no);
      if (item.product_name) setName(item.product_name);
    }
  }

  const effectiveJobId = selectedJobId !== NO_JOB ? selectedJobId : "";

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
        <Button>Yeni Hesap Raporu</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Hesap Raporu</DialogTitle>
          <DialogDescription>
            Raporu bir iş emri kalemine bağlayın ya da bağımsız bırakın; bağımsız
            raporlar sonradan &quot;İşe Bağla&quot; ile bir işe bağlanabilir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* İş bağlantısı */}
          <input type="hidden" name="job_id" value={effectiveJobId} />
          {showJobSelect && (
            <div className="grid gap-2">
              <Label>İş Emri</Label>
              <Select value={selectedJobId} onValueChange={onPickJob}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_JOB}>Bağımsız (İşe Atanmamış)</SelectItem>
                  {jobs!.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.job_no} · {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* İş kalemi — doküman no + rapor adını doldurur */}
          {items.length > 0 && (
            <div className="grid gap-2">
              <Label>İş Kalemi</Label>
              <Select value={selectedItemId} onValueChange={onPickItem}>
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
              {selectedItem?.project_id && (
                <p className="text-xs text-destructive">
                  Bu kalemin zaten bir hesap raporu var; yine de yeni bir rapor
                  oluşturabilirsiniz (ör. farklı revizyon hattı).
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
              placeholder="0055-HR-001"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Rapor / Vinç Adı</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="AMONYUM SÜLFAT VİNCİ"
              required
            />
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

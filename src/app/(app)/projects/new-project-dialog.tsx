"use client";

import { useState, useTransition } from "react";
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
  "Çift Kirişli Gezer Köprü Vinci",
  "Tek Kirişli Gezer Köprü Vinci",
  "Portal Vinç",
  "Yarı Portal Vinç",
  "Pergel Vinç",
  "Alttan Askılı Vinç",
  "Konsol Vinç",
] as const;

export function NewProjectDialog({
  defaultCraneType = "Çift Kirişli Gezer Köprü Vinci",
  jobId,
  jobNo,
  defaultCustomer,
}: {
  defaultCraneType?: string;
  /** İş panelinden "Vinç Ekle" ile açıldığında yeni vinç bu işe bağlanır. */
  jobId?: string;
  jobNo?: string;
  defaultCustomer?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Panelde tanımlı varsayılan listede yoksa listeye eklenir (özel tipler korunur).
  const craneTypes: string[] = CRANE_TYPES.includes(
    defaultCraneType as (typeof CRANE_TYPES)[number]
  )
    ? [...CRANE_TYPES]
    : [defaultCraneType, ...CRANE_TYPES];
  const [craneType, setCraneType] = useState(defaultCraneType);

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
        <Button>{jobId ? "Vinç Ekle" : "Yeni Proje"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{jobId ? "Vinç Ekle" : "Yeni Proje"}</DialogTitle>
          <DialogDescription>
            {jobId
              ? `${jobNo ?? ""} işine bağlı yeni bir vinç oluşturun.`.trim()
              : "Yeni bir hesap raporu projesi oluşturun."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* İş bağlantısı (iş panelinden açıldığında) */}
          {jobId && <input type="hidden" name="job_id" value={jobId} />}
          <div className="grid gap-2">
            <Label htmlFor="doc_no">Doküman No</Label>
            <Input
              id="doc_no"
              name="doc_no"
              placeholder={jobNo ? `${jobNo.split("-")[0]}-01` : "0055-HR-001"}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">{jobId ? "Vinç Adı" : "Proje Adı"}</Label>
            <Input id="name" name="name" placeholder="AMONYUM SÜLFAT VİNCİ" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer">Müşteri</Label>
            <Input
              id="customer"
              name="customer"
              placeholder="İSDEMİR"
              defaultValue={defaultCustomer}
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
            {/* Form gönderiminde seçilen tip bu gizli alanla taşınır */}
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

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

export function NewProjectDialog({
  defaultCraneType = "Çift Kirişli Gezer Köprülü Vinç",
}: {
  defaultCraneType?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

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
        <Button>Yeni Proje</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Proje</DialogTitle>
          <DialogDescription>Yeni bir hesap raporu projesi oluşturun.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="doc_no">Doküman No</Label>
            <Input id="doc_no" name="doc_no" placeholder="0055-HR-001" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Proje Adı</Label>
            <Input id="name" name="name" placeholder="AMONYUM SÜLFAT VİNCİ" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer">Müşteri</Label>
            <Input id="customer" name="customer" placeholder="İSDEMİR" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="crane_type">Vinç Tipi</Label>
            <Input id="crane_type" name="crane_type" defaultValue={defaultCraneType} required />
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

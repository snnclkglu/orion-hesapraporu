"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createJob } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewJobDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createJob(formData);
      if (result?.error) toast.error(result.error);
      // Başarıda action iş paneline redirect eder.
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Yeni İş</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni İş Emri</DialogTitle>
          <DialogDescription>
            Bir iş emri birden çok vinç içerebilir; vinçler iş panelinden eklenir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="job_no">İş No</Label>
            <Input id="job_no" name="job_no" placeholder="0057-00" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">İşin Adı</Label>
            <Input
              id="title"
              name="title"
              placeholder="Muhtelif Vinçler"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer">Müşteri</Label>
            <Input id="customer" name="customer" placeholder="ASTOR A.Ş." required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Sözleşme tarihi, kapsam, adetler..."
              rows={3}
            />
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

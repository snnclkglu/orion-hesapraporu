"use client";

// Revizyon yayınlama butonu: onay dialogu + başarısız kontrol uyarısı.
// Yayınlanan revizyon kilitlenir; değişiklik yeni revizyon gerektirir.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { issueRevision } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function IssueRevisionButton({
  projectId, revisionId, revNo, defaultLabel, failingChecks,
}: {
  projectId: string;
  revisionId: string;
  revNo: number;
  defaultLabel: string;
  failingChecks: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const label = String(new FormData(e.currentTarget).get("label") ?? "");
    startTransition(async () => {
      const res = await issueRevision(projectId, revisionId, label);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`V${revNo} yayınlandı ve kilitlendi.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">Yayınla</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revizyonu Yayınla — V{revNo}</DialogTitle>
          <DialogDescription>
            Yayınlanan revizyon <strong>kilitlenir</strong> ve arşive girer; sonraki
            değişiklikler yeni revizyon açar. Son kaydedilmiş hesap snapshot&apos;ı
            yayınlanır — kaydetmediğiniz değişiklik varsa önce Kaydet&apos;e basın.
          </DialogDescription>
        </DialogHeader>
        {failingChecks > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            ⚠ Bu revizyonda <strong>{failingChecks} kontrol uygun değil</strong>. Yine de
            yayınlayabilirsiniz; rapor bu haliyle arşivlenecek.
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Revizyon etiketi</Label>
            <Input id="label" name="label" defaultValue={defaultLabel} placeholder="ör. Müşteri onayına sunuldu" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Yayınlanıyor..." : `V${revNo}'ı Yayınla ve Kilitle`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

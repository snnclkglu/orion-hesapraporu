"use client";

import { LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { withdrawRevision } from "./actions";

export function WithdrawRevisionButton({
  projectId,
  revisionId,
  revNo,
  isTemplate,
  className,
}: {
  projectId: string;
  revisionId: string;
  revNo: number;
  isTemplate: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function withdraw() {
    startTransition(async () => {
      const result = await withdrawRevision(projectId, revisionId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`V${revNo} taslağa geri çekildi; yeniden düzenleyebilirsiniz.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isTemplate}
          title={isTemplate ? "Önce şablon işaretini kaldırın" : "Yayımdan geri çekip taslağa al"}
          className={cn("border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive", className)}
        >
          <LockOpen className="size-3.5" />
          <span className="truncate">Geri Çek</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>V{revNo} yayımdan geri çekilsin mi?</DialogTitle>
          <DialogDescription>
            Revizyon yeniden <strong>taslak</strong> olur ve düzenlemeye açılır.
            Arşivdeki yayımlanmış PDF silinmez; işlem denetim kaydına yazılır.
            Yeniden yayımladığınızda aynı V numarasının arşiv PDF&apos;i güncellenir.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={withdraw}>
            {pending ? "Geri çekiliyor..." : "Yayımdan Geri Çek"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

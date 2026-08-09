"use client";

// İş durumu rozeti — tıklanınca Aktif · Pasif · Tamamlandı · Arşiv arasında
// tek tıkla geçiş yapar. Hem işler listesindeki satırlarda hem iş detay
// sayfasında AYNI bileşen kullanılır; durum tanımı `lib/job-status.ts`tedir.

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronDown } from "lucide-react";
import { setJobStatus } from "./actions";
import {
  JOB_STATUSES, JOB_STATUS_DOT, JOB_STATUS_LABELS, jobStatusOf, type JobStatus,
} from "@/lib/job-status";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function JobStatusMenu({
  jobId,
  status,
  size = "sm",
}: {
  jobId: string;
  status: string;
  /** `sm` liste satırı, `md` detay sayfası başlığı */
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const current = jobStatusOf(status);

  function pick(next: JobStatus) {
    if (next === current) return;
    startTransition(async () => {
      const res = await setJobStatus(jobId, next);
      if (res?.error) toast.error(res.error);
      else toast.success(`İş durumu: ${JOB_STATUS_LABELS[next]}`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          // Liste satırını kaplayan bağlantının ÜSTÜNDE kalmalı, yoksa tıklama
          // satır linkine gider ve menü hiç açılmaz.
          //
          // Yükseklik de bu yüzden asgari 36px (dokunmatikte 40px): rozet
          // 24px iken ıskalanan her dokunuş altındaki satır bağlantısına
          // düşüyor, yani kullanıcıyı istemediği sayfaya götürüyordu.
          className={cn(
            "relative z-10 inline-flex min-h-9 items-center gap-1.5 border px-2 py-1 transition-colors hover:bg-muted disabled:opacity-50 pointer-coarse:min-h-10",
            size === "md" ? "text-sm" : "text-xs"
          )}
        >
          <span className={cn("size-2 shrink-0", JOB_STATUS_DOT[current])} />
          {JOB_STATUS_LABELS[current]}
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
        {JOB_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => pick(s)}>
            <span className={cn("size-2 shrink-0", JOB_STATUS_DOT[s])} />
            {JOB_STATUS_LABELS[s]}
            {s === current && <Check className="ml-auto size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

// Panel görev onay kutusu — görev sekmesindeki kare işaret diliyle aynı
// (task-list.tsx). YAZMA YOLU TEKİLDİR: mevcut `toggleTask` action'ı çağrılır,
// olay + bildirim yazımı onun gövdesinden geçer; panel ikinci bir yazma yolu
// AÇMAZ (md. 25).

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleTask } from "@/app/(app)/jobs/[id]/hub-actions";
import { cn } from "@/lib/utils";

export function TaskToggle({
  jobId,
  taskId,
  taskTitle,
}: {
  jobId: string;
  taskId: string;
  taskTitle: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function tamamla() {
    startTransition(async () => {
      const res = await toggleTask(jobId, taskId, true);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Görev tamamlandı.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={tamamla}
      disabled={pending}
      aria-label={`Görevi tamamla: ${taskTitle}`}
      className={cn(
        "oc-tap-square mt-0.5 grid size-5 shrink-0 place-items-center border transition-colors",
        pending ? "border-primary bg-muted" : "border-border hover:border-primary"
      )}
    />
  );
}

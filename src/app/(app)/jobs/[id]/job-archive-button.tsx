"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setJobArchived } from "../actions";
import { Button } from "@/components/ui/button";

export function JobArchiveButton({
  jobId,
  archived,
}: {
  jobId: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await setJobArchived(jobId, !archived);
      if (res?.error) toast.error(res.error);
      else toast.success(archived ? "İş arşivden çıkarıldı." : "İş arşivlendi.");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? "..." : archived ? "Arşivden Çıkar" : "Arşivle"}
    </Button>
  );
}

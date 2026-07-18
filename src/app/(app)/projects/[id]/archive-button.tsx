"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setProjectArchived } from "../actions";
import { Button } from "@/components/ui/button";

export function ArchiveButton({
  projectId,
  archived,
}: {
  projectId: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await setProjectArchived(projectId, !archived);
      if (res?.error) toast.error(res.error);
      else toast.success(archived ? "Proje arşivden çıkarıldı." : "Proje arşivlendi.");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? "..." : archived ? "Arşivden Çıkar" : "Arşivle"}
    </Button>
  );
}

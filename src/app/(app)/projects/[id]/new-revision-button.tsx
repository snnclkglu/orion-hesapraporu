"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createRevision } from "../actions";
import { Button } from "@/components/ui/button";

export function NewRevisionButton({
  projectId,
  variant = "default",
  isFirst = false,
}: {
  projectId: string;
  variant?: "default" | "outline";
  /** Projede hiç revizyon yoksa buton "Hesap Raporu Oluştur" der. */
  isFirst?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const label = isFirst ? "Hesap Raporu Oluştur" : "Yeni Revizyon";

  function handleClick() {
    startTransition(async () => {
      const result = await createRevision(projectId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant={variant}>
      {pending ? "Oluşturuluyor..." : label}
    </Button>
  );
}

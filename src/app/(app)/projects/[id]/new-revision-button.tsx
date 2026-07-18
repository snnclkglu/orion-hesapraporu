"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createRevision } from "../actions";
import { Button } from "@/components/ui/button";

export function NewRevisionButton({
  projectId,
  variant = "default",
}: {
  projectId: string;
  variant?: "default" | "outline";
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await createRevision(projectId);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant={variant}>
      {pending ? "Oluşturuluyor..." : "Yeni Revizyon"}
    </Button>
  );
}

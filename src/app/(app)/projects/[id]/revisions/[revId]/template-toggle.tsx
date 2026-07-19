"use client";

// Şablon işareti toggle'ı (sadece admin görür; sunucu tarafı da rol kontrolü yapar).
// Şablon revizyon: yeni projelerin ilk revizyonu bu snapshot'tan kopyalanır.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setRevisionTemplate } from "./actions";

export function TemplateToggle({
  projectId,
  revisionId,
  isTemplate,
}: {
  projectId: string;
  revisionId: string;
  isTemplate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await setRevisionTemplate(projectId, revisionId, !isTemplate);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        isTemplate
          ? "Şablon işareti kaldırıldı"
          : "Bu revizyon artık yeni projelerin başlangıç şablonu"
      );
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={handleToggle}>
      {pending ? "Kaydediliyor..." : isTemplate ? "Şablonu Kaldır" : "Şablon Yap"}
    </Button>
  );
}

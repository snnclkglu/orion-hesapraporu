"use client";

// "Yeni Müşteri" düğmesi — iş emri formundaki pop-up'ın aynısını açar.
// Pencere orada tanımlıdır ve TEK kaynaktır: kısaltmanın otomatik dolması,
// zorunlu tek alan kuralı ve renk ataması iki ekranda ayrışmasın.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { NewCustomerDialog } from "@/app/(app)/jobs/customer-picker";
import { Button } from "@/components/ui/button";

export function NewCustomerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Yeni Müşteri
      </Button>
      {open && (
        <NewCustomerDialog
          open
          onOpenChange={setOpen}
          onCreated={() => startTransition(() => router.refresh())}
        />
      )}
    </>
  );
}

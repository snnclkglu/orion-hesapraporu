"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleLogout}
      className={cn("shrink-0", className)}
      title="Çıkış yap"
      aria-label="Çıkış yap"
    >
      <LogOut className="size-4" />
    </Button>
  );
}

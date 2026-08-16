"use client";

// Tema anahtarı — Açık · Koyu · Sistem (kullanıcı onayı, 16.08.2026).
//
// Koyu palet globals.css'te ilk günden tanımlıydı; bu düğme yalnız `.dark`
// sınıfının anahtarıdır (next-themes). İkon MEVCUT temayı değil geçilecek
// hâli değil, mevcut hâli gösterir; ad menüde yazıyla durur — ikon tek
// taşıyıcı olmaz.
//
// HİDRASYON: tema istemcide çözülür; ilk boyamada ikon nötr kalsın diye
// `mounted` bekletmesi yerine `resolvedTheme` yalnız menü işaretinde
// kullanılır ve tetik ikonu iki ikonun CSS ile değişen çiftidir (shadcn
// kalıbı — sunucu ve istemci aynı DOM'u basar).

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const SECENEKLER = [
  { value: "light", label: "Açık" },
  { value: "dark", label: "Koyu" },
  { value: "system", label: "Sistem" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Tema seç"
          className="oc-tap-square relative shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {/* İki ikon üst üste; hangisinin görüneceğini .dark sınıfı seçer —
              JS beklenmez, hidrasyon uyuşmazlığı doğmaz. */}
          <Sun className="size-4.5 dark:hidden" />
          <Moon className="hidden size-4.5 dark:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SECENEKLER.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onSelect={() => setTheme(s.value)}
            className={cn(theme === s.value && "font-medium text-primary")}
          >
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

// PDF rapor indirme menüsü — rapor seviyesi seçimi (Detaylı / Standart / Özet).
// Seçilen seviye report route'una ?level= query paramıyla iletilir.

import { ChevronDown, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Seviye açıklamaları BELGENİN GERÇEK KAPSAMINI anlatır.
 *
 * Tek doğru kaynak `pdf/report.tsx`teki `ReportLevel` yorumudur (ve kuralı
 * `report.smoke.test.tsx` PDF metninden ölçer); burası onun insan okunur
 * özetidir. **Kapsam değişirse bu satırlar da değişir** — 12.08.2026'da
 * kontrol özeti standart ve özet raporlardan kaldırıldı ama açıklama
 * "Kapak + özet + kontroller" demeye devam ediyordu; kullanıcı, indirdiği
 * belgede olmayan bir bölüm için o seçeneği seçiyordu.
 */
const LEVELS = [
  {
    level: "detayli",
    label: "Detaylı",
    hint: "Tüm formüller, diyagramlar ve kontrol özeti",
  },
  {
    level: "standart",
    label: "Standart",
    hint: "Hesap sonuçları ve diyagramlar (formülsüz)",
  },
  {
    level: "ozet",
    label: "Özet",
    hint: "Yalnız kapak, teknik özellikler ve ekipman seçimi",
  },
] as const;

export function ReportMenu({ projectId, revisionId }: { projectId: string; revisionId: string }) {
  const base = `/projects/${projectId}/revisions/${revisionId}/report`;
  return (
    <DropdownMenu>
      {/* Dokunmatikte 32px'lik tetikleyici parmakla tutulmuyordu (sözleşme §2) */}
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm hover:bg-muted pointer-coarse:h-10">
        <FileText className="size-3.5 text-muted-foreground" />
        PDF Rapor
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      {/* w-56 dardı: açıklamalar üç satıra sarıyor ve seviyeler birbirine
          giriyordu. Genişlik dokunmatik sözleşmesi §5'e uyar — 18rem, 375px'lik
          ekranda bile kenar boşluğu bırakır. */}
      <DropdownMenuContent align="end" className="w-72">
        {LEVELS.map((l) => (
          <DropdownMenuItem key={l.level} asChild>
            <a href={`${base}?level=${l.level}`} className="flex flex-col items-start gap-0.5">
              <span className="font-medium">{l.label}</span>
              <span className="text-xs text-muted-foreground">{l.hint}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

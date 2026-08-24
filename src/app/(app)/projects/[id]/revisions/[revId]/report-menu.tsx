"use client";

// PDF rapor indirme menüsü — rapor seviyesi seçimi (Detaylı / Standart / Özet).
// Seçilen seviye report route'una ?level= query paramıyla iletilir.

import { ChevronDown, FileText } from "lucide-react";
import { PdfDownloadLink } from "@/components/pdf-download-link";
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

export function ReportMenu({
  projectId,
  revisionId,
  basePath = "/projects",
}: {
  projectId: string;
  revisionId: string;
  basePath?: string;
}) {
  const base = `${basePath}/${projectId}/revisions/${revisionId}/report`;
  return (
    <DropdownMenu>
      {/* Dokunmatikte 32px'lik tetikleyici parmakla tutulmuyordu (sözleşme §2) */}
      <DropdownMenuTrigger className="oc-tap inline-flex h-8 w-full min-w-0 items-center justify-center gap-1 rounded-md border bg-card px-1.5 text-xs hover:bg-muted lg:w-auto lg:gap-1.5 lg:px-3 lg:text-sm">
        <FileText className="size-3.5 text-muted-foreground" />
        <span className="truncate">PDF Rapor</span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      {/* w-56 dardı: açıklamalar üç satıra sarıyor ve seviyeler birbirine
          giriyordu. Genişlik dokunmatik sözleşmesi §5'e uyar — 18rem, 375px'lik
          ekranda bile kenar boşluğu bırakır. */}
      <DropdownMenuContent align="end" className="w-72">
        {LEVELS.map((l) => (
          <DropdownMenuItem key={l.level} asChild>
            <PdfDownloadLink
              href={`${base}?level=${l.level}`}
              shareTitle={`Hesap Raporu · ${l.label}`}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="font-medium">{l.label}</span>
              <span className="text-xs text-muted-foreground">{l.hint}</span>
            </PdfDownloadLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

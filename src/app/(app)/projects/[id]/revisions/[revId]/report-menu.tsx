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

const LEVELS = [
  {
    level: "detayli",
    label: "Detaylı",
    hint: "Tüm formüller + diyagramlar",
  },
  {
    level: "standart",
    label: "Standart",
    hint: "Hesap sonuçları + diyagramlar",
  },
  {
    level: "ozet",
    label: "Özet",
    hint: "Kapak + özet + kontroller",
  },
] as const;

export function ReportMenu({ projectId, revisionId }: { projectId: string; revisionId: string }) {
  const base = `/projects/${projectId}/revisions/${revisionId}/report`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm shadow-xs hover:bg-muted">
        <FileText className="size-3.5 text-muted-foreground" />
        PDF Rapor
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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

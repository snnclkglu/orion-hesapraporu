"use client";

// Satış bölümü rayı — Satış Takibi · Müşteri Bazında Ciro · Satış Faturaları
// (kullanıcı kararı, 14.08.2026). Üçü AYRI ADREStir (Satın Alma rayının deseni);
// her biri kendi verisini sunucudan çeker.
//
// RAY KAYMAZ, SARAR (kabuk kuralı 15; gerekçenin tamamı purchasing-nav'da):
// üç sekme telefonda gerekirse ikinci satıra iner, gizli sekme kalmaz.

import Link from "next/link";
import { SectionBottomBar } from "@/components/section-bottom-bar";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import { Input } from "@/components/ui/input";
import { usePathname } from "next/navigation";
import { MobileRouteGrid } from "@/components/mobile-nav-grid";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/sales", label: "Satış Takibi", exact: true },
  { href: "/sales/ciro", label: "Müşteri Bazında Ciro", exact: false },
  { href: "/sales/faturalar", label: "Satış Faturaları", exact: false },
];

export function SalesNav() {
  const [documentYear, setDocumentYear] = useState("");
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const activeHref =
    TABS.find((t) => (t.exact ? pathname === t.href : pathname.startsWith(t.href)))
      ?.href ?? TABS[0].href;

  return (
    <>
      <SectionBottomBar label="Satış Takibi" items={[...[TABS[0],TABS[2],TABS[1]].map((t,i) => ({id:t.href,href:t.href,label:["Satış","Faturalar","Ciro"][i],active:t.href===activeHref})),{id:"documents",label:"İş Listesi",icon:"file",action:true,onSelect:()=>setDocumentsOpen(true)}]} />
      <Dialog open={documentsOpen} onOpenChange={setDocumentsOpen}><DialogContent mobileKeyboardSafe><DialogHeader><DialogTitle>Güncel İş Listesi</DialogTitle><DialogDescription>Fiyat içermeyen müşteri referans belgesi.</DialogDescription></DialogHeader><label className="grid gap-2 text-sm">Yıl (boş bırakılırsa tüm işler)<Input type="number" min="1900" max="2100" placeholder="Tüm yıllar" value={documentYear} onChange={event=>setDocumentYear(event.target.value)} /></label>{(!documentYear || /^\d{4}$/.test(documentYear) && Number(documentYear)>=1900 && Number(documentYear)<=2100) && <PdfDownloadLink className="oc-tap inline-flex min-h-11 items-center justify-center rounded-md border p-3" href={`/sales/is-listesi${documentYear?`?yil=${documentYear}`:""}`} shareTitle="Güncel İş Listesi">İş listesini PDF olarak aç</PdfDownloadLink>}</DialogContent></Dialog>
      <div className="oc-section-desktop">
      <MobileRouteGrid
        className="md:hidden"
        value={activeHref}
        options={TABS}
        label="Satış bölümü"
      />
      <nav
        className="hidden items-center gap-x-3 border-b md:flex"
        aria-label="Satış bölümleri"
      >
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
                active
                  ? "font-medium text-foreground shadow-[inset_0_-2px_0_var(--primary)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      </div>
    </>
  );
}

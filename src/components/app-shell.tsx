"use client";

// Uygulama kabuğu: kalıcı sol sidebar (koyu lacivert) + ince üst şerit.
// Mobilde sidebar hamburger ile açılır-kapanır. Sadece sunum katmanı —
// veri (kullanıcı adı/rolü) server layout'tan prop olarak gelir.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  FolderKanban,
  Menu,
  Settings2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

interface AppShellProps {
  isAdmin: boolean;
  displayName: string;
  email: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/jobs", label: "İşler", icon: Briefcase },
  { href: "/projects", label: "Projeler", icon: FolderKanban },
  { href: "/admin", label: "Yönetim", icon: Settings2, adminOnly: true },
];

function sectionLabel(pathname: string | null): string {
  if (!pathname) return "";
  if (pathname.startsWith("/admin")) return "Yönetim";
  if (pathname.startsWith("/jobs")) return "İşler";
  if (pathname.startsWith("/projects")) return "Projeler";
  return "";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function SidebarContent({
  isAdmin,
  displayName,
  email,
  pathname,
  onNavigate,
}: {
  isAdmin: boolean;
  displayName: string;
  email: string;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Marka — koyu zeminde beyaz logo (Orion Cranes marka kılavuzu) */}
      <Link
        href="/projects"
        onClick={onNavigate}
        className="block px-4 pt-5 pb-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/orion-logo-white.svg"
          alt="Orion Cranes"
          className="h-[18px] w-auto"
        />
        <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/60">
          Hesap Raporu Sistemi
        </span>
      </Link>

      <div className="mx-4 border-t border-sidebar-border" />

      {/* Navigasyon */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Çalışma Alanı
        </div>
        <ul className="grid gap-0.5">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Standart künyesi */}
      <div className="px-4 pb-3">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-[10px] leading-relaxed text-sidebar-foreground/60">
          FEM 1.001 · DIN 15018 · CMAA 70
          <br />
          Çift kirişli gezer köprülü vinç
        </div>
      </div>

      {/* Kullanıcı kartı */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/30 text-xs font-semibold text-sidebar-accent-foreground">
            {initials(displayName) || "?"}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-sidebar-accent-foreground">
              {displayName}
            </div>
            <div className="truncate text-[11px] text-sidebar-foreground/60">
              {isAdmin ? "Yönetici" : "Mühendis"} · {email}
            </div>
          </div>
          <LogoutButton className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ isAdmin, displayName, email, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Revizyon sihirbazı geniş ekranda tam genişlik kullanır; diğer sayfalar
  // okunabilirlik için sınırlı kalır.
  const fullWidth = /\/revisions\//.test(pathname ?? "");

  return (
    <div className="flex min-h-screen">
      {/* Masaüstü sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent
          isAdmin={isAdmin}
          displayName={displayName}
          email={email}
          pathname={pathname}
        />
      </aside>

      {/* Mobil çekmece */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent"
              aria-label="Menüyü kapat"
            >
              <X className="size-4" />
            </button>
            <SidebarContent
              isAdmin={isAdmin}
              displayName={displayName}
              email={email}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* İçerik */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Menüyü aç"
          >
            <Menu className="size-4" />
          </button>
          <div className="min-w-0 text-sm font-medium">{sectionLabel(pathname)}</div>
          <div className="ml-auto hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
            <span className="font-mono">FEM 1.001</span>
            <span aria-hidden>·</span>
            <span className="font-mono">DIN 15018</span>
            <span aria-hidden>·</span>
            <span className="font-mono">CMAA 70</span>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className={cn("mx-auto w-full", fullWidth ? "max-w-none" : "max-w-6xl")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

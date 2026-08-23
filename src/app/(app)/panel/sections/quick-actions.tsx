// HIZLI EYLEMLER — aramanın hemen altında rol süzgeçli kısayol şeridi.
//
// Çipler YALNIZ BAĞLANTIDIR (saf tanım: `lib/panel-actions.ts`); panelden
// pencere açılmaz. Telefonda iki sütunlu ızgaraya, geniş ekranda saran şeride
// dönüşür; hiçbir eylem yatay kaydırmanın arkasında kalmaz.

import Link from "next/link";
import { BrandIcon } from "@/components/brand-icon";
import { visiblePanelActions } from "@/lib/panel-actions";

export function QuickActionsSection({ role }: { role: string }) {
  const eylemler = visiblePanelActions(role);
  if (eylemler.length === 0) return null;

  return (
    <nav
      aria-label="Hızlı eylemler"
      className="-my-1 grid min-w-0 grid-cols-2 gap-2 py-1 sm:flex sm:flex-wrap"
    >
      {eylemler.map((a) => (
        <Link
          key={`${a.href}-${a.label}`}
          href={a.href}
          className="oc-tap flex min-w-0 items-center gap-2 border bg-card px-3 py-1.5 text-foreground/90 transition-colors hover:border-primary hover:text-primary"
        >
          <BrandIcon name={a.icon} size={16} />
          <span className="min-w-0 font-mono text-[12px] leading-tight sm:whitespace-nowrap">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}

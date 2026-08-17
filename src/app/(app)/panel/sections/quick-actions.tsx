// HIZLI EYLEMLER — aramanın hemen altında rol süzgeçli kısayol şeridi.
//
// Çipler YALNIZ BAĞLANTIDIR (saf tanım: `lib/panel-actions.ts`); panelden
// pencere açılmaz. Tek satırda durur ve dar ekranda `.oc-scrollx` ile kayar —
// panelin tek meşru yatay kaydırması budur (gövde asla kaymaz).

import Link from "next/link";
import { BrandIcon } from "@/components/brand-icon";
import { visiblePanelActions } from "@/lib/panel-actions";

export function QuickActionsSection({ role }: { role: string }) {
  const eylemler = visiblePanelActions(role);
  if (eylemler.length === 0) return null;

  return (
    <nav
      aria-label="Hızlı eylemler"
      className="oc-scrollx -my-1 flex items-center gap-2 overflow-x-auto overscroll-x-contain py-1"
    >
      {eylemler.map((a) => (
        <Link
          key={`${a.href}-${a.label}`}
          href={a.href}
          className="oc-tap flex shrink-0 items-center gap-2 border bg-card px-3 py-1.5 text-foreground/90 transition-colors hover:border-primary hover:text-primary"
        >
          <BrandIcon name={a.icon} size={16} />
          <span className="font-mono text-[12px] whitespace-nowrap">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// SANA AİT TEKNİK RESİMLER — bölüm YALNIZ DOLUYKEN çizilir. Herkese "size
// atanmış çizim yok" demek, çizim atanması hiç beklenmeyen bir satınalmacıya
// olmayan bir eksiklik göstermek olurdu.

import Link from "next/link";
import {
  DRAWING_PLAN_STATUS_LABELS,
  type DrawingPlanStatus,
} from "@/lib/drawing-plan";
import { Baslik } from "./section-frame";
import type { MineRow } from "../data";

export function MineDrawingsSection({ mine }: { mine: MineRow[] }) {
  if (mine.length === 0) return null;

  return (
    <section>
      <Baslik>Sana Ait Teknik Resimler</Baslik>
      <ul className="grid gap-px border bg-border sm:grid-cols-2">
        {mine.map((m) => (
          <li key={`${m.href}-${m.code}`} className="bg-card">
            <Link
              href={m.href}
              className="flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="shrink-0 font-mono text-[13px] font-medium text-primary">
                {m.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" title={m.name}>
                  {m.name || "—"}
                </span>
                {m.project && (
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {m.project}
                  </span>
                )}
              </span>
              <span className="shrink-0 border px-1.5 py-0.5 text-[11px] whitespace-nowrap text-muted-foreground">
                {DRAWING_PLAN_STATUS_LABELS[m.status as DrawingPlanStatus] ?? m.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

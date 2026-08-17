// DİKKAT İSTEYENLER — veriden TÜRETİLMİŞ sinyaller (bildirim değildir:
// okunmaz, kapatılmaz; sebebi kalkınca kendiliğinden kaybolur).

import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { formatNum } from "@/lib/drawings/labels";
import type { PanelSignal } from "@/lib/panel";
import { Baslik, PanelEmpty } from "./section-frame";

export function SignalsSection({ signals }: { signals: PanelSignal[] }) {
  return (
    <section>
      <Baslik>Dikkat İsteyenler</Baslik>
      {signals.length === 0 ? (
        <PanelEmpty>
          Bekleyen bir şey yok — geciken sipariş, eksik fiyat ya da kontrol
          bekleyen üretim kaydı bulunmuyor.
        </PanelEmpty>
      ) : (
        <ul className="grid gap-2">
          {signals.map((s) => (
            <li key={s.key}>
              <Link
                href={s.href}
                className="flex items-start gap-3 border px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <TriangleAlert
                  className={
                    s.tone === "uyari"
                      ? "mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                      : "mt-0.5 size-4 shrink-0 text-muted-foreground"
                  }
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-mono font-semibold tabular-nums">
                    {formatNum(s.count)}
                  </span>{" "}
                  {s.label}
                </span>
                <ArrowRight
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground/50"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

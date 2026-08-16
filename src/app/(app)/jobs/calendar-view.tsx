"use client";

// TAKVİM — işin tarihleri ay tablosunda.
//
// Girdi türleri: Atölye Çıkış · Teslim (işten), Görev termini (görevlerden),
// Termin · Sevk (YALNIZ canSeeSales — sunucu göndermediyse hiç yoktur).
// Süzgeçler takvime de işler: görünmeyen işin tarihi çizilmez.
//
// Masaüstünde ay tablosu, telefonda AJANDA (md. 15: ızgara küçültülmez,
// katlanır). Renkte KIRMIZI YOK (tehlikeye ayrılı); tür rengi noktayla ve
// YAZIYLA birlikte taşınır — renk tek taşıyıcı değildir.

import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  agendaDays,
  CALENDAR_KIND_LABELS,
  entriesByDay,
  monthGrid,
  monthLabel,
  monthOf,
  monthShift,
  type CalendarEntry,
} from "@/lib/jobs/calendar";
import { fmtJobDate } from "@/lib/jobs/filter";
import { adreseYaz } from "@/app/(app)/purchasing/adres-suzgec";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobRow } from "./jobs-table";
import type { JobExtras } from "./board-view";

const KIND_DOT: Record<CalendarEntry["kind"], string> = {
  atolye: "bg-sky-500",
  teslim: "bg-emerald-600",
  gorev: "bg-amber-500",
  termin: "bg-violet-500",
  sevk: "bg-foreground",
};

const HAFTA_GUNLERI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function bugunISO(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function CalendarView({
  rows,
  extras,
  ay,
}: {
  rows: JobRow[];
  extras: JobExtras;
  /** undefined = içinde bulunulan ay. */
  ay: string | undefined;
}) {
  const bugun = bugunISO();
  const etkinAy = ay ?? monthOf(bugun);

  const entries = useMemo<CalendarEntry[]>(() => {
    const gorunur = new Map(rows.map((r) => [r.id, r]));
    const out: CalendarEntry[] = [];
    for (const r of rows) {
      if (r.workshopExitDate)
        out.push({
          date: r.workshopExitDate,
          kind: "atolye",
          label: r.job_no,
          href: `/jobs/${r.id}`,
        });
      if (r.deliveryDate)
        out.push({
          date: r.deliveryDate,
          kind: "teslim",
          label: r.job_no,
          href: `/jobs/${r.id}`,
        });
    }
    for (const t of extras.taskDates) {
      const is = gorunur.get(t.jobId);
      if (!is) continue; // süzgeç takvime de işler
      out.push({
        date: t.dueDate,
        kind: "gorev",
        label: `${is.job_no} · ${t.title}`,
        href: `/jobs/${t.jobId}/gorevler`,
      });
    }
    for (const s of extras.salesDates ?? []) {
      const is = gorunur.get(s.jobId);
      if (!is) continue;
      if (s.dueDate)
        out.push({
          date: s.dueDate,
          kind: "termin",
          label: is.job_no,
          href: `/jobs/${s.jobId}`,
        });
      if (s.shipmentDate)
        out.push({
          date: s.shipmentDate,
          kind: "sevk",
          label: is.job_no,
          href: `/jobs/${s.jobId}`,
        });
    }
    return out;
  }, [rows, extras]);

  const haftalar = useMemo(() => monthGrid(etkinAy), [etkinAy]);
  const gunler = useMemo(() => entriesByDay(entries, etkinAy), [entries, etkinAy]);
  const ajanda = useMemo(() => agendaDays(entries, etkinAy), [entries, etkinAy]);

  function ayaGit(hedef: string) {
    adreseYaz({ ay: hedef === monthOf(bugun) ? undefined : hedef });
  }

  return (
    <div className="grid gap-3">
      {/* Ay gezintisi */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => ayaGit(monthShift(etkinAy, -1))}
          aria-label="Önceki ay"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-[9rem] text-center text-sm font-semibold">
          {monthLabel(etkinAy)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => ayaGit(monthShift(etkinAy, 1))}
          aria-label="Sonraki ay"
        >
          <ChevronRight className="size-4" />
        </Button>
        {etkinAy !== monthOf(bugun) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => ayaGit(monthOf(bugun))}>
            Bugün
          </Button>
        )}
        {/* Tür lejantı — renk tek taşıyıcı olmaz, ad yanında yazar. */}
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {(Object.keys(KIND_DOT) as CalendarEntry["kind"][]).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            >
              <span className={cn("size-2 shrink-0", KIND_DOT[k])} />
              {CALENDAR_KIND_LABELS[k]}
            </span>
          ))}
        </span>
      </div>

      {/* MASAÜSTÜ: ay tablosu */}
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {HAFTA_GUNLERI.map((g) => (
            <span key={g} className="px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
              {g}
            </span>
          ))}
        </div>
        {haftalar.map((hafta, i) => (
          <div key={i} className="grid grid-cols-7 border-b last:border-b-0">
            {hafta.map((gun) => {
              const ayIci = monthOf(gun) === etkinAy;
              const bugunMu = gun === bugun;
              const liste = gunler.get(gun) ?? [];
              return (
                <div
                  key={gun}
                  className={cn(
                    "min-h-20 border-r p-1 last:border-r-0",
                    !ayIci && "bg-muted/20"
                  )}
                >
                  <span
                    className={cn(
                      "inline-grid size-5 place-items-center font-mono text-[11px] tabular-nums",
                      bugunMu && "bg-primary font-semibold text-primary-foreground",
                      !ayIci && "text-muted-foreground/50"
                    )}
                  >
                    {Number(gun.slice(8, 10))}
                  </span>
                  <div className="mt-0.5 grid gap-0.5">
                    {liste.slice(0, 3).map((e, j) => (
                      <Link
                        key={j}
                        href={e.href}
                        title={`${CALENDAR_KIND_LABELS[e.kind]} · ${e.label}`}
                        className="flex min-w-0 items-center gap-1 px-0.5 text-[11px] hover:bg-muted/60"
                      >
                        <span className={cn("size-1.5 shrink-0", KIND_DOT[e.kind])} />
                        <span className="truncate font-mono">{e.label}</span>
                      </Link>
                    ))}
                    {liste.length > 3 && (
                      <span className="px-0.5 font-mono text-[10px] text-muted-foreground">
                        +{liste.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* TELEFON: ajanda — yalnız dolu günler */}
      <div className="grid gap-2 md:hidden">
        {ajanda.length === 0 ? (
          <p className="border bg-card px-3 py-6 text-sm text-muted-foreground">
            {monthLabel(etkinAy)} için kayıtlı tarih yok.
          </p>
        ) : (
          ajanda.map((g) => (
            <div key={g.date} className="border bg-card">
              <p
                className={cn(
                  "border-b bg-muted/40 px-3 py-1.5 font-mono text-xs font-medium tabular-nums",
                  g.date === bugun && "text-primary"
                )}
              >
                {fmtJobDate(g.date)}
                {g.date === bugun && " · Bugün"}
              </p>
              <ul className="divide-y">
                {g.entries.map((e, j) => (
                  <li key={j}>
                    <Link
                      href={e.href}
                      className="flex items-center gap-2 px-3 py-2 text-sm"
                    >
                      <span className={cn("size-2 shrink-0", KIND_DOT[e.kind])} />
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {CALENDAR_KIND_LABELS[e.kind]}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">
                        {e.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {entries.length === 0 && (
        <p className="hidden text-xs text-muted-foreground md:block">
          Süzgeçlere uyan işlerde kayıtlı tarih yok — atölye çıkış ve teslim
          tarihleri iş emrinde, görev terminleri Görevler sekmesinde girilir.
        </p>
      )}
    </div>
  );
}

"use client";

// ZAMAN — işlerin başlangıç-bitiş aralıkları orantısal çubuklarla.
//
// EKSEN KAYDIRMAZ (md. 15): pencere süzülmüş işlerin min-maks aralığıdır ve
// çubuklar kap genişliğine ORANLANIR — telefonda da masaüstünde de aynı
// düzen. Okunacak şey ÖRTÜŞMEdir; tarih satırın kendisinde yazar.
//
// Başlangıç = iş emri tarihi (yoksa kayıt); bitiş = teslim tarihi. Teslim
// tarihi girilmemiş iş "bugüne kadar" sürer ve AÇIK UÇLU işaretlenir —
// biten bir şey uydurulmaz. Başlangıcı da olmayan işler çizilmez, altta
// sayılır (sessiz düşürme yok).

import { useMemo } from "react";
import Link from "next/link";
import { buildGantt, todayMarker } from "@/lib/jobs/gantt";
import { fmtJobDate, jobYear } from "@/lib/jobs/filter";
import { jobStatusOf } from "@/lib/job-status";
import { customerTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import type { JobRow } from "./jobs-table";

/** Durum → çubuk rengi (durum noktalarıyla aynı dil; kırmızı yok). */
const BAR_RENGI: Record<string, string> = {
  active: "bg-success/70",
  passive: "bg-amber-500/60",
  completed: "bg-foreground/50",
  archived: "bg-muted-foreground/30",
};

function bugunISO(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function TimelineView({ rows }: { rows: JobRow[] }) {
  const bugun = bugunISO();

  const model = useMemo(
    () =>
      buildGantt(
        rows.map((r) => ({
          id: r.id,
          start: (r.work_order_date || r.created_at || "").slice(0, 10) || null,
          end: r.deliveryDate ?? null,
        })),
        bugun
      ),
    [rows, bugun]
  );

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const cizilmeyen = useMemo(
    () => rows.filter((r) => !model?.bars.some((b) => b.id === r.id)),
    [rows, model]
  );

  if (!model) {
    return (
      <p className="border bg-card px-3 py-6 text-sm text-muted-foreground">
        Süzgeçlere uyan işlerde çizilecek tarih aralığı yok.
      </p>
    );
  }

  const isaret = todayMarker(model, bugun);
  // Yıl sınırı değişen satırda ince bir ayraç başlığı basılır (iş no azalan =
  // kronolojik ters sıra; en yeni üstte).
  const sirali = [...model.bars].sort((a, b) => b.start.localeCompare(a.start));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono tabular-nums">{fmtJobDate(model.min)}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-primary" /> Bugün
          <span className="ml-3 inline-block h-2 w-6 border border-dashed border-muted-foreground/60" />{" "}
          teslim tarihi girilmemiş
        </span>
        <span className="font-mono tabular-nums">{fmtJobDate(model.max)}</span>
      </div>

      <div className="grid gap-1 rounded-lg border bg-card p-3">
        {sirali.map((b, i) => {
          const r = rowById.get(b.id);
          if (!r) return null;
          const oncekiYil = i > 0 ? jobYear(rowById.get(sirali[i - 1].id)!) : null;
          const yil = jobYear(r);
          return (
            <div key={b.id}>
              {yil !== oncekiYil && (
                <p className="oc-kicker mt-2 mb-1 text-muted-foreground first:mt-0">
                  {yil || "Tarihsiz"}
                </p>
              )}
              <div className="grid grid-cols-[minmax(7rem,12rem)_1fr] items-center gap-2 sm:grid-cols-[minmax(9rem,16rem)_1fr]">
                <Link
                  href={`/jobs/${r.id}`}
                  className="min-w-0 py-0.5 hover:underline"
                  title={r.title}
                >
                  <span className="block truncate font-mono text-xs font-medium text-primary">
                    {r.job_no}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {customerTag({ name: r.customer, shortName: r.customerShort }).short}
                    {" · "}
                    {r.title}
                  </span>
                </Link>
                <div className="relative h-5 min-w-0 bg-muted/30">
                  {isaret != null && (
                    <span
                      aria-hidden
                      className="absolute top-0 bottom-0 w-0.5 bg-primary/70"
                      style={{ left: `${isaret}%` }}
                    />
                  )}
                  <span
                    title={`${fmtJobDate(b.start)} → ${
                      b.openEnded ? "teslim tarihi yok" : fmtJobDate(b.end)
                    }`}
                    className={cn(
                      "absolute top-0.5 bottom-0.5",
                      BAR_RENGI[jobStatusOf(r.status)] ?? "bg-muted-foreground/40",
                      b.openEnded && "border border-dashed border-muted-foreground/60"
                    )}
                    style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {cizilmeyen.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {cizilmeyen.length} işin başlangıç tarihi yok — çizelgeye giremedi:
          {" "}
          {cizilmeyen.slice(0, 5).map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <Link href={`/jobs/${r.id}`} className="font-mono text-primary hover:underline">
                {r.job_no}
              </Link>
            </span>
          ))}
          {cizilmeyen.length > 5 && "…"}
        </p>
      )}
    </div>
  );
}

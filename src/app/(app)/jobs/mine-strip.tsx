"use client";

// "BENİM İŞLERİM" şeridi — listenin üstünde kişiye özel bant.
//
// İki bölüm: bana atanan AÇIK görevler (sunucudan) ve son bakılan işler
// (cihazdan, `useRecentJobs`). BOŞ BÖLÜM ÇİZİLMEZ (panonun sıfır kuralı);
// ikisi de boşsa şerit hiç yoktur. Katlama tercihi kalıcıdır
// (`useStoredFlag` — sidebar katlamasıyla aynı mekanizma).

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fmtJobDate } from "@/lib/jobs/filter";
import { useRecentJobs } from "@/lib/jobs/recent";
import { useStoredFlag } from "@/lib/use-stored-flag";
import { cn } from "@/lib/utils";

export interface MyTaskRow {
  taskId: string;
  title: string;
  dueDate: string | null;
  jobId: string;
  jobNo: string;
  jobTitle: string;
}

function bugunISO(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export interface FavoriteJobRef {
  id: string;
  jobNo: string;
  title: string;
}

export function MineStrip({
  myTasks,
  favorites,
}: {
  myTasks: MyTaskRow[];
  favorites: FavoriteJobRef[];
}) {
  // useStoredFlag ikinci eleman olarak DEĞİŞTİRİCİ döner (setter değil).
  const [kapali, kapaliDegistir] = useStoredFlag("orion.jobs.mine.collapsed");
  const recents = useRecentJobs();
  const bugun = bugunISO();

  if (myTasks.length === 0 && favorites.length === 0 && recents.length === 0)
    return null;

  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={kapaliDegistir}
        className="oc-tap flex w-full items-center justify-between px-3 py-2 text-left"
        aria-expanded={!kapali}
      >
        <span className="oc-kicker text-muted-foreground">Benim İşlerim</span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          {myTasks.length > 0 && `${myTasks.length} görev`}
          {kapali ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </span>
      </button>

      {!kapali && (
        <div className="grid gap-4 border-t px-3 py-3 md:grid-cols-2 xl:grid-cols-3">
          {myTasks.length > 0 && (
            <div className="min-w-0">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Bana Atanan Açık Görevler
              </p>
              <ul className="grid gap-1">
                {myTasks.map((t) => {
                  const gec = !!t.dueDate && t.dueDate < bugun;
                  return (
                    <li key={t.taskId}>
                      <Link
                        href={`/jobs/${t.jobId}/gorevler`}
                        className="group flex items-baseline gap-2 py-0.5 text-sm"
                      >
                        <span className="shrink-0 font-mono text-xs text-primary">
                          {t.jobNo}
                        </span>
                        <span className="min-w-0 flex-1 truncate group-hover:underline">
                          {t.title}
                        </span>
                        {t.dueDate && (
                          <span
                            className={cn(
                              "shrink-0 font-mono text-[11px] tabular-nums",
                              gec
                                ? "font-semibold text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {fmtJobDate(t.dueDate)}
                            {gec && " · gecikti"}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {favorites.length > 0 && (
            <div className="min-w-0">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Favoriler
              </p>
              <ul className="grid gap-1">
                {favorites.slice(0, 6).map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/jobs/${f.id}`}
                      className="group flex items-baseline gap-2 py-0.5 text-sm"
                    >
                      <span className="shrink-0 font-mono text-xs text-primary">
                        {f.jobNo}
                      </span>
                      <span className="min-w-0 flex-1 truncate group-hover:underline">
                        {f.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recents.length > 0 && (
            <div className="min-w-0">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Son Bakılanlar
              </p>
              <ul className="grid gap-1">
                {recents.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/jobs/${r.id}`}
                      className="group flex items-baseline gap-2 py-0.5 text-sm"
                    >
                      <span className="shrink-0 font-mono text-xs text-primary">
                        {r.jobNo}
                      </span>
                      <span className="min-w-0 flex-1 truncate group-hover:underline">
                        {r.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

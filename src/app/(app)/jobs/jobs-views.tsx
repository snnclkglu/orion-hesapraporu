"use client";

// İşler GÖRÜNÜM KABUĞU — süzgeç şeridi + görünüm anahtarı, bütün
// görünümlerin ORTAK üstü.
//
// Görünüm değişimi de İSTEMCİDEDİR (adreseYaz): dört görünüm aynı veri
// setini paylaşır, sunucu turu gerektirmez ve süzgeçler görünümler arasında
// AYNEN taşınır — kayıtlı görünüm (view + süzgeç + sıralama + grup) tam bu
// adresin fotoğrafıdır.
//
// Süzme kuralı `lib/jobs/filter.ts`tedir (ekran + Excel ortak); bu bileşen
// yalnız süzer ve dağıtır — sıralama tablonun, gruplama panonun işidir.

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Columns3,
  FileDown,
  StretchHorizontal,
  TableProperties,
} from "lucide-react";
import {
  jobYear,
  matchesJobFilters,
} from "@/lib/jobs/filter";
import {
  readJobsViewState,
  resolveYear,
  writeJobsViewState,
  type JobView,
} from "@/lib/jobs/view-state";
import { JOB_STATUSES, JOB_STATUS_LABELS, jobStatusOf } from "@/lib/job-status";
import { adreseYaz } from "@/app/(app)/purchasing/adres-suzgec";
import { CokluSuzgec } from "@/app/(app)/purchasing/filters";
import { FilterBar, SearchBox } from "@/app/(app)/drawings/sortable-head";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { customerTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { JobsTable, type JobRow } from "./jobs-table";
import { BoardView, type JobExtras } from "./board-view";
import { CalendarView } from "./calendar-view";
import { TimelineView } from "./timeline-view";
import { ViewsMenu, type SavedViewRow } from "./views-menu";

const GORUNUMLER: { key: JobView; label: string; icon: typeof Columns3 }[] = [
  { key: "tablo", label: "Tablo", icon: TableProperties },
  { key: "pano", label: "Pano", icon: Columns3 },
  { key: "takvim", label: "Takvim", icon: CalendarDays },
  { key: "zaman", label: "Zaman", icon: StretchHorizontal },
];

export function JobsViews({
  jobs,
  canDelete,
  extras,
  savedViews,
}: {
  jobs: JobRow[];
  canDelete: boolean;
  extras: JobExtras;
  savedViews: SavedViewRow[];
}) {
  const params = useSearchParams();
  const state = useMemo(() => readJobsViewState(params), [params]);
  const view: JobView = GORUNUMLER.some((g) => g.key === state.view)
    ? state.view
    : "tablo";

  // Arama: süzme ANINDA, adres yazımı 350 ms gecikmeyle (jobs-table'ın eski
  // kuralı buraya taşındı — şerit artık bütün görünümlerin üstünde).
  const [q, setQ] = useState(() => state.q);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (qTimer.current) clearTimeout(qTimer.current);
    },
    []
  );
  function onSearch(v: string) {
    setQ(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => {
      adreseYaz({ q: v.trim() ? v : undefined });
    }, 350);
  }

  const years = useMemo(() => {
    const set = new Set(jobs.map(jobYear).filter(Boolean));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [jobs]);

  const thisYear = String(new Date().getFullYear());
  const resolvedYil = resolveYear(state.yil, years, thisYear);

  const customerOptions = useMemo(() => {
    const byName = new Map<string, { short: string; count: number }>();
    for (const j of jobs) {
      const name = j.customer.trim();
      if (!name) continue;
      const cur = byName.get(name);
      if (cur) cur.count += 1;
      else
        byName.set(name, {
          short: customerTag({ name, shortName: j.customerShort }).short,
          count: 1,
        });
    }
    return [...byName.entries()]
      .map(([value, v]) => ({ value, label: v.short, count: v.count }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [jobs]);

  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobs) {
      const s = jobStatusOf(j.status);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return JOB_STATUSES.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
      value: s,
      label: JOB_STATUS_LABELS[s],
      count: counts.get(s) ?? 0,
    }));
  }, [jobs]);

  const filtered = useMemo(
    () =>
      jobs.filter((j) =>
        matchesJobFilters(j, {
          yil: resolvedYil,
          musteri: state.musteri,
          durum: state.durum,
          q,
        })
      ),
    [jobs, resolvedYil, state, q]
  );

  const temiz =
    resolvedYil === "tumu" &&
    state.musteri.length === 0 &&
    state.durum.length === 0 &&
    !q.trim();

  function clearFilters() {
    setQ("");
    if (qTimer.current) clearTimeout(qTimer.current);
    // "Temizle" HEPSİNİ gösterir; yıl varsayılanı bir öneridir, hapis değil.
    adreseYaz({ yil: "tumu", musteri: undefined, durum: undefined, q: undefined });
  }

  const excelHref = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(writeJobsViewState({ ...state, q }))) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/jobs/export?${qs}` : "/jobs/export";
  }, [state, q]);

  return (
    <div className="grid gap-3">
      {/* Kayıtlı görünümler — adresin adlandırılmış fotoğrafları. */}
      <ViewsMenu views={savedViews} currentState={{ ...state, q }} />

      {/* Görünüm anahtarı — çip şeridi. Pano durum süzgecini KENDİ sütunlarına
          çevirdiği için durum süzgeci orada da çalışır (süzülen kart görünmez). */}
      <div className="flex flex-wrap items-center gap-1">
        {GORUNUMLER.map((g) => {
          const aktif = view === g.key;
          const Icon = g.icon;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() =>
                adreseYaz({ view: g.key === "tablo" ? undefined : g.key })
              }
              aria-pressed={aktif}
              className={cn(
                "oc-tap inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors",
                aktif
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {g.label}
            </button>
          );
        })}
      </div>

      <FilterBar
        gorunen={filtered.length}
        toplam={jobs.length}
        temiz={temiz}
        onTemizle={clearFilters}
      >
        {/* Şeritteki bütün denetimler AYNI boydan (h-9) okur (IS-14). */}
        <Select value={resolvedYil} onValueChange={(v) => adreseYaz({ yil: v })}>
          <SelectTrigger size="sm" className="h-9 w-[7.5rem]">
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tumu">Tüm Yıllar</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <CokluSuzgec
          baslik="Müşteri"
          secenekler={customerOptions}
          secili={state.musteri}
          onChange={(v) => adreseYaz({ musteri: v.length ? v.join(",") : undefined })}
        />

        <CokluSuzgec
          baslik="Durum"
          secenekler={statusOptions}
          secili={state.durum}
          onChange={(v) => adreseYaz({ durum: v.length ? v.join(",") : undefined })}
        />

        <SearchBox
          value={q}
          onChange={onSearch}
          placeholder="İş No, Ad veya Müşteri Ara…"
          className="min-w-[12rem] flex-1"
        />

        <Button asChild variant="outline" size="sm" className="h-9 shrink-0">
          <a href={excelHref}>
            <FileDown className="size-3.5" /> Excel
          </a>
        </Button>
      </FilterBar>

      {view === "pano" ? (
        <BoardView rows={filtered} grup={state.grup} extras={extras} />
      ) : view === "takvim" ? (
        <CalendarView rows={filtered} extras={extras} ay={state.ay} />
      ) : view === "zaman" ? (
        <TimelineView rows={filtered} />
      ) : (
        <JobsTable rows={filtered} canDelete={canDelete} />
      )}
    </div>
  );
}

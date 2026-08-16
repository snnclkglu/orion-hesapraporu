"use client";

// PANO — işler durum/müşteri/lider/yıl sütunlarında kart olarak.
//
// SÜRÜKLEME YALNIZ DURUM GRUPLAMASINDA (kullanıcı kararı, 16.08.2026):
// kart bir sütuna bırakılınca `setJobStatus` çağrılır — var olan eylem, yeni
// bir yazma yolu değil. Öteki boyutlarda sütun bir OLGUNUN sonucudur ve
// sürüklenemez; kartta durum çipi (JobStatusMenu) her boyutta durur.
//
// İKİ YERLEŞİM, TEK KART: masaüstünde (`md`+) gerçek sütunlar `.oc-scrollx`
// kabında yatay dizilir (kap içi kaydırma md. 8 ile meşru; SAYFA kaymaz);
// telefonda sütunlar DİKEY açılır-kapanır gruplara katlanır (progress-board
// deseni, md. 15). Kart markup'ı `BoardCard`ta TEKTİR — iki yerleşim aynı
// bileşeni basar, ayrışamaz.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Star } from "lucide-react";
import { boardGroups, isDragEnabled } from "@/lib/jobs/board";
import { fmtJobDate } from "@/lib/jobs/filter";
import {
  JOB_STATUSES,
  jobStatusOf,
  type JobStatus,
} from "@/lib/job-status";
import { JOB_GROUPS, type JobGroup } from "@/lib/jobs/view-state";
import { adreseYaz } from "@/app/(app)/purchasing/adres-suzgec";
import { setJobStatus } from "./actions";
import { JobStatusMenu } from "./job-status-menu";
import { CustomerTag } from "@/components/tags";
import { cn } from "@/lib/utils";
import type { JobRow } from "./jobs-table";

/** Sunucudan gelen kart/takvim zenginleştirmeleri — hepsi TÜREV, saklanmaz. */
export interface JobExtras {
  /** İş başına açık görev sayıları (migration yoksa boş nesne). */
  tasks: Record<string, { open: number; overdue: number }>;
  /** İş başına en yakın termin — YALNIZ canSeeSales rollerine gelir, yoksa null. */
  termin: Record<string, string> | null;
  /** Takvim: açık görev terminleri (başlıklı). */
  taskDates: { jobId: string; title: string; dueDate: string }[];
  /** Takvim: kalem termin/sevk tarihleri — canSeeSales değilse null. */
  salesDates:
    | { jobId: string; dueDate: string | null; shipmentDate: string | null }[]
    | null;
}

const GRUP_ETIKETLERI: Record<JobGroup, string> = {
  durum: "Durum",
  musteri: "Müşteri",
  lider: "İş Lideri",
  yil: "Yıl",
};

function BoardCard({
  job,
  extras,
  surukleniyor = false,
}: {
  job: JobRow;
  extras: JobExtras;
  surukleniyor?: boolean;
}) {
  const gorev = extras.tasks[job.id];
  const termin = extras.termin?.[job.id];
  return (
    <div
      className={cn(
        "grid gap-1.5 border bg-background p-2.5",
        surukleniyor && "opacity-50"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Link
          href={`/jobs/${job.id}`}
          className="relative z-10 font-mono text-sm font-medium text-primary hover:underline"
        >
          {job.job_no}
        </Link>
        {job.favori && (
          <Star className="size-3 shrink-0 fill-amber-400 text-amber-500" aria-label="Favori" />
        )}
      </div>
      <p className="line-clamp-2 text-sm font-medium break-words">{job.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <CustomerTag
          name={job.customer}
          shortName={job.customerShort}
          hue={job.customerHue}
        />
      </div>
      <p className="flex flex-wrap gap-x-2 font-mono text-[11px] text-muted-foreground tabular-nums">
        <span>{job.itemCount} kalem</span>
        <span>{job.craneCount} rapor</span>
        {gorev && gorev.open > 0 && (
          <span
            className={cn(
              gorev.overdue > 0 && "font-semibold text-amber-600 dark:text-amber-400"
            )}
          >
            {gorev.open} görev
            {gorev.overdue > 0 && ` · ${gorev.overdue} gecikti`}
          </span>
        )}
        {termin && <span>termin {fmtJobDate(termin)}</span>}
      </p>
      <div className="relative z-10">
        <JobStatusMenu jobId={job.id} status={job.status} />
      </div>
    </div>
  );
}

function DraggableCard({
  job,
  extras,
}: {
  job: JobRow;
  extras: JobExtras;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="touch-manipulation"
    >
      <BoardCard job={job} extras={extras} surukleniyor={isDragging} />
    </div>
  );
}

function DroppableColumn({
  id,
  label,
  count,
  children,
}: {
  id: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-2 border bg-card p-2 transition-colors",
        isOver && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-baseline justify-between px-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

export function BoardView({
  rows,
  grup,
  extras,
}: {
  rows: JobRow[];
  grup: JobGroup;
  extras: JobExtras;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // İyimser durum: bırakılan kartın durumu sunucu dönmeden sütununa işlenir;
  // router.refresh gerçek veriyi getirince geçici katman sıfırlanır.
  const [override, setOverride] = useState<Record<string, JobStatus>>({});
  const [acikGruplar, setAcikGruplar] = useState<Record<string, boolean>>({});

  const etkinRows = useMemo(
    () =>
      rows.map((r) =>
        override[r.id] ? { ...r, status: override[r.id] } : r
      ),
    [rows, override]
  );
  const cols = useMemo(() => boardGroups(etkinRows, grup), [etkinRows, grup]);
  const dragOn = isDragEnabled(grup);

  // 8px hareket eşiği: kartın içindeki bağlantı ve durum çipi TIKLANABİLİR
  // kalır — sürükleme ancak gerçek bir çekişte başlar.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function onDragEnd(e: DragEndEvent) {
    const jobId = String(e.active.id);
    const hedef = e.over?.id as JobStatus | undefined;
    if (!hedef || !JOB_STATUSES.includes(hedef)) return;
    const satir = rows.find((r) => r.id === jobId);
    if (!satir || jobStatusOf(satir.status) === hedef) return;

    setOverride((o) => ({ ...o, [jobId]: hedef }));
    startTransition(async () => {
      const res = await setJobStatus(jobId, hedef);
      if (res?.error) {
        setOverride((o) => {
          const { [jobId]: _dusen, ...kalan } = o;
          void _dusen;
          return kalan;
        });
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  const govde = (
    <>
      {/* Gruplama çipleri */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="oc-kicker mr-1 text-muted-foreground">Grupla</span>
        {JOB_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => adreseYaz({ grup: g === "durum" ? undefined : g })}
            aria-pressed={grup === g}
            className={cn(
              "oc-tap border px-2.5 py-1 text-sm transition-colors",
              grup === g
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {GRUP_ETIKETLERI[g]}
          </button>
        ))}
        {dragOn && (
          <span className="ml-auto hidden font-mono text-[11px] text-muted-foreground md:inline">
            kartı sürükleyip sütuna bırakın
          </span>
        )}
      </div>

      {/* MASAÜSTÜ: yatay sütunlar (kap içi kaydırma — sayfa kaymaz). */}
      <div className="oc-scrollx hidden items-start gap-3 overflow-x-auto pb-2 md:flex">
        {cols.map((c) => (
          <DroppableColumn key={c.key} id={c.key} label={c.label} count={c.rows.length}>
            {c.rows.length === 0 ? (
              <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                Kart yok
              </p>
            ) : (
              c.rows.map((j) =>
                dragOn ? (
                  <DraggableCard key={j.id} job={j} extras={extras} />
                ) : (
                  <BoardCard key={j.id} job={j} extras={extras} />
                )
              )
            )}
          </DroppableColumn>
        ))}
      </div>

      {/* TELEFON: dikey açılır gruplar — sürükleme yok, durum çipi kartta. */}
      <div className="grid gap-2 md:hidden">
        {cols.map((c) => {
          const acik = acikGruplar[c.key] ?? c.rows.length > 0;
          return (
            <div key={c.key} className="border bg-card">
              <button
                type="button"
                onClick={() =>
                  setAcikGruplar((s) => ({ ...s, [c.key]: !acik }))
                }
                aria-expanded={acik}
                className="oc-tap flex w-full items-center justify-between px-3 py-2 text-left"
              >
                <span className="text-sm font-semibold">{c.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {c.rows.length} {acik ? "−" : "+"}
                </span>
              </button>
              {acik && c.rows.length > 0 && (
                <div className="grid gap-2 border-t p-2">
                  {c.rows.map((j) => (
                    <BoardCard key={j.id} job={j} extras={extras} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="grid gap-3">
      {dragOn ? (
        // Sabit `id`: dnd-kit sunucuda ve istemcide ayrı sayaçtan kimlik
        // üretir ve `aria-describedby` hidrasyonda uyuşmaz; sabit ad ikisini
        // aynı yere bağlar.
        <DndContext id="jobs-pano" sensors={sensors} onDragEnd={onDragEnd}>
          {govde}
        </DndContext>
      ) : (
        govde
      )}
    </div>
  );
}

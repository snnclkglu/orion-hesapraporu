// GÖREVLERİM — bütün işlerdeki bana atanmış AÇIK görevler tek listede.
//
// `/jobs` sayfasındaki "Benim İşlerim" şeridinin panele taşınmış hâli; satır
// başındaki kare işaret görevi PANELDEN kapatır (yazma yolu tekil:
// `toggleTask`). Panelden görev AÇILMAZ — görev işe bağlıdır
// (`job_tasks.job_id NOT NULL`), bağlam iş sayfasındadır; satır oraya götürür.

import Link from "next/link";
import { fmtJobDate } from "@/lib/jobs/filter";
import { cn } from "@/lib/utils";
import { Baslik } from "./section-frame";
import { TaskToggle } from "../task-toggle";

export interface MyTaskRow {
  taskId: string;
  title: string;
  dueDate: string | null;
  jobId: string;
  jobNo: string;
  jobTitle: string;
}

export function MyTasksSection({
  rows,
  total,
  today,
}: {
  rows: MyTaskRow[];
  total: number;
  today: string;
}) {
  // Görevi olmayana boş bir "Görevlerim" kutusu gösterilmez (sıfır kuralı).
  if (rows.length === 0) return null;

  return (
    <section>
      <Baslik>
        Görevlerim
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          {total} açık
        </span>
      </Baslik>
      <ul className="divide-y border">
        {rows.map((t) => {
          const gec = !!t.dueDate && t.dueDate < today;
          return (
            <li
              key={t.taskId}
              className="flex items-start gap-3 px-3 py-2 pointer-coarse:py-2.5"
            >
              <TaskToggle jobId={t.jobId} taskId={t.taskId} taskTitle={t.title} />
              {/* BAĞLANTI BÜTÜN GÖVDEDİR: iş satırı tek başına 17px ölçüldü
                  (telefonda dokunulamıyordu); başlık + iş satırı tek bağlantı,
                  hedef satır boyunda. Onay kutusu ayrı (kendi .oc-tap'ı var). */}
              <Link
                href={`/jobs/${t.jobId}/gorevler`}
                className="group min-w-0 flex-1"
              >
                <span
                  className="block truncate text-sm group-hover:underline"
                  title={t.title}
                >
                  {t.title}
                </span>
                <span className="mt-0.5 flex items-baseline gap-1.5 text-[11px] text-muted-foreground">
                  <span className="shrink-0 font-mono text-primary">{t.jobNo}</span>
                  <span className="min-w-0 truncate">{t.jobTitle}</span>
                </span>
              </Link>
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
            </li>
          );
        })}
      </ul>
      {total > rows.length && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          {total} açık görevden ilk {rows.length} gösteriliyor — kalanlar ilgili
          işin Görevler sekmesinde.
        </p>
      )}
    </section>
  );
}

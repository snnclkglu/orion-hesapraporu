// SON HAREKETLER — şirket nabzı: iş defterindeki son olaylar.
//
// Kaynak yalnız `job_events` (kullanıcı kararı: tüm şirket görür — işler
// zaten herkese açık; teknik resim/satın alma olayları ikinci tura
// bırakıldı). Olay dili ORTAK sözlükten (`lib/jobs/event-labels.ts`) —
// akış sekmesiyle birebir aynı cümleler.

import Link from "next/link";
import { tarihSaatIstanbul } from "@/lib/format-time";
import {
  olayAdi,
  olayOzeti,
  olaySinifi,
  type JobEventLike,
} from "@/lib/jobs/event-labels";
import { Baslik, PanelEmpty } from "./section-frame";

export interface ActivityRow extends JobEventLike {
  id: string;
  /** null = iş silinmiş (satır okunur kalır, bağlantı verilmez). */
  jobId: string | null;
  jobNo: string;
  actorName: string;
  at: string;
}

function SatirGovdesi({ r }: { r: ActivityRow }) {
  const ozet = olayOzeti(r);
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span
        className={`border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap ${olaySinifi(r.event)}`}
      >
        {olayAdi(r.event)}
      </span>
      {r.jobNo && (
        <span className="shrink-0 font-mono text-[12px] font-medium text-primary">
          {r.jobNo}
        </span>
      )}
      {ozet && (
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground" title={ozet}>
          {ozet}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-baseline gap-2">
        {r.actorName && (
          <span className="text-[11px] text-muted-foreground/80">{r.actorName}</span>
        )}
        <span className="font-mono text-[11px] text-muted-foreground/70">
          {tarihSaatIstanbul(r.at)}
        </span>
      </span>
    </span>
  );
}

export function ActivitySection({ rows }: { rows: ActivityRow[] }) {
  return (
    <section>
      <Baslik>Son Hareketler</Baslik>
      {rows.length === 0 ? (
        <PanelEmpty>
          Henüz olay yok — işlerde yapılan değişiklikler (durum, görev, yorum)
          burada akar.
        </PanelEmpty>
      ) : (
        <ul className="divide-y border">
          {rows.map((r) => (
            <li key={r.id}>
              {r.jobId ? (
                <Link
                  href={`/jobs/${r.jobId}/akis`}
                  className="flex px-3 py-2 transition-colors hover:bg-muted/40 pointer-coarse:py-2.5"
                >
                  <SatirGovdesi r={r} />
                </Link>
              ) : (
                // Silinmiş işin olayı okunur kalır ama yolu yoktur.
                <span className="flex px-3 py-2 pointer-coarse:py-2.5">
                  <SatirGovdesi r={r} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

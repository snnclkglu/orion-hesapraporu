import type { ReactNode } from "react";
import { CircleAlert, Inbox, Loader2, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

type StatePanelKind = "empty" | "filtered" | "loading" | "error";

const ICONS = {
  empty: Inbox,
  filtered: SearchX,
  loading: Loader2,
  error: CircleAlert,
} satisfies Record<StatePanelKind, typeof Inbox>;

/**
 * Liste ve geçici yüzeylerde ortak durum dili.
 *
 * `EmptyState` ilk kullanımın geniş, markalı yüzeyidir. Bu bileşen ise bir
 * listenin yerinde görülen boş süzgeç, yükleme ve geri alınabilir hata
 * hâllerini birbirinden ayırır. Hata hiçbir zaman "0 kayıt" gibi çizilmez.
 */
export function StatePanel({
  kind,
  title,
  description,
  children,
  compact = false,
  className,
}: {
  kind: StatePanelKind;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const Icon = ICONS[kind];
  const loading = kind === "loading";
  const error = kind === "error";

  return (
    <div
      role={error ? "alert" : loading ? "status" : undefined}
      aria-live={error ? "assertive" : loading ? "polite" : undefined}
      aria-busy={loading || undefined}
      className={cn(
        "flex flex-col items-center justify-center border bg-card text-center",
        compact ? "gap-2 px-4 py-5" : "gap-3 px-6 py-10",
        error && "border-destructive/40",
        className
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          compact ? "size-4" : "size-5",
          loading && "animate-spin text-muted-foreground",
          error && "text-destructive",
          !loading && !error && "text-muted-foreground"
        )}
      />
      <div className="grid max-w-md gap-1">
        <p className={cn("font-medium", compact ? "text-sm" : "text-[15px]")}>{title}</p>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DELETION_ENTITY_TYPES,
  type DeletionCleanupStatus,
  type DeletionEntityType,
  type DeletionRequestStatus,
} from "@/lib/deletion-requests";
import { DeletionRequestsView, type DeletionRequestRow } from "./requests-view";

type View = "pending" | "history";

export default async function DeletionRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ gorunum?: string }>;
}) {
  const { gorunum } = await searchParams;
  const view: View = gorunum === "history" ? "history" : "pending";
  const supabase = await createClient();

  const [{ data: requests }, { data: profiles }] = await Promise.all([
    supabase
      .from("deletion_requests")
      .select(
        "id, entity_type, target_label, target_path, target_snapshot, request_note, requested_by, requested_at, status, reviewed_by, reviewed_at, review_note, cleanup_status, cleanup_error"
      )
      .in("status", view === "pending" ? ["pending", "processing"] : ["approved", "rejected"])
      .order(view === "pending" ? "requested_at" : "reviewed_at", { ascending: false })
      .limit(view === "pending" ? 200 : 500),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.full_name || profile.email || "Kullanıcı",
    ])
  );
  const rows: DeletionRequestRow[] = (requests ?? []).flatMap((request) => {
    if (!DELETION_ENTITY_TYPES.includes(request.entity_type as DeletionEntityType)) return [];
    return [{
      id: request.id,
      entityType: request.entity_type as DeletionEntityType,
      targetLabel: request.target_label,
      targetPath: request.target_path,
      snapshot: (request.target_snapshot ?? {}) as Record<string, unknown>,
      requestNote: request.request_note,
      requesterName: profileMap.get(request.requested_by) ?? "Kullanıcı",
      requestedAt: request.requested_at,
      status: request.status as DeletionRequestStatus,
      reviewerName: request.reviewed_by ? profileMap.get(request.reviewed_by) ?? "Yönetici" : "",
      reviewedAt: request.reviewed_at,
      reviewNote: request.review_note,
      cleanupStatus: request.cleanup_status as DeletionCleanupStatus,
      cleanupError: request.cleanup_error,
    }];
  });
  const pendingCount = view === "pending" ? rows.length : 0;

  return (
    <div className="grid gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Silme Onayları</h2>
          {pendingCount > 0 && <Badge variant="destructive">{pendingCount} bekleyen</Badge>}
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Kalıcı silme taleplerini hedefin silme öncesi künyesiyle inceleyin. Onaylanan ve
          reddedilen talepler değiştirilemeyen karar izi olarak geçmişte kalır.
        </p>
      </div>

      <nav className="flex gap-1 border-b" aria-label="Silme talepleri görünümleri">
        {([
          { key: "pending", label: "Onay Bekleyenler", href: "/admin/deletion-requests" },
          { key: "history", label: "Karar Geçmişi", href: "/admin/deletion-requests?gorunum=history" },
        ] as const).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={view === item.key ? "page" : undefined}
            className={cn(
              "oc-tap border-b-2 px-3 py-2 text-sm transition-colors",
              view === item.key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <DeletionRequestsView rows={rows} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UsageMetricRow } from "@/lib/usage";
import { profileScoringSettingsOf } from "@/lib/profile-scoring";
import { UserProfileView, type UserAuditEvent } from "./user-profile-view";

const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default async function AdminUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, title, role, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [usageResult, auditResult, actionCountResult, settingsResult] = await Promise.all([
    supabase
      .from("user_usage_metrics")
      .select(
        "session_id, usage_date, section, device_class, started_at, last_seen_at, active_seconds, page_views"
      )
      .eq("user_id", id)
      .order("last_seen_at", { ascending: false })
      .limit(5000),
    supabase
      .from("audit_log")
      .select("id, action, created_at")
      .eq("actor", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("actor", id)
      .gte("created_at", thirtyDaysAgo),
    supabase.from("app_settings").select("value").eq("key", "profile_scoring").maybeSingle(),
  ]);

  return (
    <UserProfileView
      profile={{
        id: profile.id,
        fullName: profile.full_name ?? "",
        email: profile.email ?? "",
        title: profile.title ?? "",
        role: profile.role ?? "engineer",
        createdAt: profile.created_at,
      }}
      usageRows={(usageResult.data ?? []) as UsageMetricRow[]}
      usageAvailable={!usageResult.error}
      auditEvents={((auditResult.data ?? []) as Array<{
        id: number;
        action: string;
        created_at: string;
      }>).map(
        (event): UserAuditEvent => ({
          id: event.id,
          action: event.action,
          createdAt: event.created_at,
        })
      )}
      actionCount30={actionCountResult.count ?? 0}
      nowIso={now.toISOString()}
      scoring={profileScoringSettingsOf(settingsResult.data?.value).user}
      pdfHref={`/admin/users/${id}/pdf`}
    />
  );
}

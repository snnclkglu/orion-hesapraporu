import { createClient } from "@/lib/supabase/server";
import { getReportSettings } from "@/lib/settings";
import { profileScoringSettingsOf } from "@/lib/profile-scoring";
import { renderUserProfilePdf } from "@/lib/pdf/profile-report";
import { downloadFileName } from "@/lib/pdf/doc-naming";
import type { UsageMetricRow } from "@/lib/usage";
import type { UserAuditEvent } from "../user-profile-view";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });
  const { data: actor } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") return new Response("Yönetici yetkisi gerekli", { status: 403 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, title, role, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!profile) return new Response("Kullanıcı bulunamadı", { status: 404 });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [usageResult, auditResult, countResult, scoringResult, reportSettings] = await Promise.all([
    supabase.from("user_usage_metrics").select("session_id, usage_date, section, device_class, started_at, last_seen_at, active_seconds, page_views").eq("user_id", id).order("last_seen_at", { ascending: false }).limit(5000),
    supabase.from("audit_log").select("id, action, created_at").eq("actor", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("audit_log").select("id", { count: "exact", head: true }).eq("actor", id).gte("created_at", thirtyDaysAgo),
    supabase.from("app_settings").select("value").eq("key", "profile_scoring").maybeSingle(),
    getReportSettings(supabase),
  ]);
  const auditEvents: UserAuditEvent[] = (auditResult.data ?? []).map((event) => ({ id: event.id, action: event.action, createdAt: event.created_at }));
  const buffer = await renderUserProfilePdf({
    profile: {
      id: profile.id,
      fullName: profile.full_name ?? "",
      email: profile.email ?? "",
      title: profile.title ?? "",
      role: profile.role ?? "engineer",
      createdAt: profile.created_at,
    },
    usageRows: (usageResult.data ?? []) as UsageMetricRow[],
    auditEvents,
    actionCount30: countResult.count ?? 0,
    nowIso: now.toISOString(),
    scoring: profileScoringSettingsOf(scoringResult.data?.value).user,
    company: {
      company: reportSettings.company,
      address: reportSettings.address ?? "",
      phone: reportSettings.phone,
      email: reportSettings.email,
      web: reportSettings.web,
    },
  });
  const filename = downloadFileName([profile.full_name || profile.email, "Kullanıcı Profil Raporu"]);
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditOffers, canEditReports } from "@/lib/roles";
import { ENGINEERING_REPORT_CONTEXT, reportContextOf } from "@/lib/report-context";
import { catalogFilterSchema } from "@/lib/auto-selection/catalog-scope";

export const dynamic = "force-dynamic";
/** Sayfa bazlı aktarım; bir sayfa başarısızsa istemci hiçbir sonucu kullanmaz. */
export async function GET(request: NextRequest) {
  if (process.env.AUTO_SELECTION_ENABLED === "false") return NextResponse.json({ error: "Hızlı seçim geçici olarak kapalı." }, { status: 503 });
  const revisionId = request.nextUrl.searchParams.get("revisionId");
  const page = Number(request.nextUrl.searchParams.get("page") ?? "0");
  if (!revisionId || !Number.isSafeInteger(page) || page < 0 || page > 1000) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  const [{ data: profile }, { data: revision }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("revisions").select("project_id,status").eq("id", revisionId).maybeSingle(),
  ]);
  if (!profile || !revision || revision.status !== "draft") return NextResponse.json({ error: "Düzenlenebilir revizyon bulunamadı." }, { status: 403 });
  const { data: project } = await supabase.from("projects").select("report_context").eq("id", revision.project_id).maybeSingle();
  const allowed = project && (reportContextOf(project.report_context) === ENGINEERING_REPORT_CONTEXT ? canEditReports(profile.role) : canEditOffers(profile.role));
  if (!allowed) return NextResponse.json({ error: "Bu rapor için düzenleme yetkiniz yok." }, { status: 403 });
  const { data: catalogState } = await supabase.from("auto_selection_catalog_state").select("version").eq("id", true).single();
  if (!catalogState) return NextResponse.json({ error: "Katalog sürümü okunamadı." }, { status: 502 });
  if (request.nextUrl.searchParams.get("metadata") === "1") return NextResponse.json({ version: catalogState.version }, { headers: { "Cache-Control": "private, no-store" } });
  const manifest = request.nextUrl.searchParams.get("manifest") === "1";
  let filter;
  if (!manifest) {
    try { filter = catalogFilterSchema.parse(JSON.parse(request.nextUrl.searchParams.get("filter") ?? "null")); }
    catch { return NextResponse.json({ error: "Geçersiz katalog filtresi." }, { status: 400 }); }
  }
  const { data, error } = manifest ? await supabase.rpc("auto_selection_catalog_manifest")
    : await supabase.rpc("auto_selection_catalog_page", { p_filter: filter, p_page: page });
  if (error || data == null) return NextResponse.json({ error: "Katalog sayfası okunamadı; seçim başlatılmadı." }, { status: 502 });
  if (manifest ? !Array.isArray(data) : !Array.isArray(data.rows) || !Number.isSafeInteger(data.total) || data.total < 0 || data.page !== page) return NextResponse.json({ error: "Katalog yanıtı eksik." }, { status: 502 });
  const { data: after } = await supabase.from("auto_selection_catalog_state").select("version").eq("id", true).single();
  if (after?.version !== catalogState.version) return NextResponse.json({ error: "Katalog aktarım sırasında değişti. Yeniden deneyin." }, { status: 409 });
  return NextResponse.json({ ...(manifest ? { families: data } : data), version: catalogState.version }, { headers: { "Cache-Control": "private, no-store" } });
}

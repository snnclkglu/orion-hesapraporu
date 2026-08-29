import { createClient } from "@/lib/supabase/server";
import { getReportSettings } from "@/lib/settings";
import { profileScoringSettingsOf } from "@/lib/profile-scoring";
import { loadCustomerLogo } from "@/lib/customers/logo-server";
import { renderCustomerProfilePdf } from "@/lib/pdf/profile-report";
import { downloadFileName } from "@/lib/pdf/doc-naming";
import { loadCustomerProfile } from "../data";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });
  const { data: actor } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin") return new Response("Yönetici yetkisi gerekli", { status: 403 });

  const [loaded, scoringResult, reportSettings, logo] = await Promise.all([
    loadCustomerProfile(supabase, id),
    supabase.from("app_settings").select("value").eq("key", "profile_scoring").maybeSingle(),
    getReportSettings(supabase),
    loadCustomerLogo(supabase, id),
  ]);
  if (!loaded) return new Response("Müşteri bulunamadı", { status: 404 });
  const buffer = await renderCustomerProfilePdf({
    data: loaded.data,
    nowIso: new Date().toISOString(),
    scoring: profileScoringSettingsOf(scoringResult.data?.value).customer,
    customerLogo: logo,
    company: {
      company: reportSettings.company,
      address: reportSettings.address ?? "",
      phone: reportSettings.phone,
      email: reportSettings.email,
      web: reportSettings.web,
    },
  });
  const filename = downloadFileName([loaded.data.customer.shortName || loaded.data.customer.name, "Müşteri Profil Raporu"]);
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileScoringSettingsOf } from "@/lib/profile-scoring";
import { loadCustomerProfile } from "./data";
import { CustomerProfileView } from "./customer-profile-view";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default async function AdminCustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const [loaded, settingsResult] = await Promise.all([
    loadCustomerProfile(supabase, id),
    supabase.from("app_settings").select("value").eq("key", "profile_scoring").maybeSingle(),
  ]);
  if (!loaded) notFound();
  return (
    <CustomerProfileView
      data={loaded.data}
      logoUrl={loaded.logoUrl}
      scoring={profileScoringSettingsOf(settingsResult.data?.value).customer}
      nowIso={new Date().toISOString()}
      pdfHref={`/admin/customers/${id}/pdf`}
    />
  );
}

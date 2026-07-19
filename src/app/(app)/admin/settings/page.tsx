// Rapor ayarları — app_settings 'report' anahtarı (PDF kapak bilgileri).

import { createClient } from "@/lib/supabase/server";
import { getReportSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const settings = await getReportSettings(supabase);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Rapor Ayarları</h2>
        <p className="text-sm text-muted-foreground">
          Bu bilgiler PDF rapor kapağında kullanılır.
        </p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}

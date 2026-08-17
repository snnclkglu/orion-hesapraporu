"use server";

// Panel tercihi yazma yolu — oku-değiştir-yaz + upsert. Doğrulama saf
// çekirdekte (`prefsToConfig` bilinmeyen kimliği ve katlanamaz bölümü atar);
// action yalnız kelepçeyi (user_id) ve tazelemeyi bilir.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LANDING_PATH } from "@/lib/roles";
import {
  configToPrefs,
  prefsToConfig,
  type PanelSectionId,
} from "@/lib/panel-prefs";

export type PrefsActionResult = { error?: string };

export async function setPanelSectionState(
  id: PanelSectionId,
  degisiklik: { hidden?: boolean; collapsed?: boolean }
): Promise<PrefsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data } = await supabase
    .from("user_panel_prefs")
    .select("config")
    .eq("user_id", user.id)
    .maybeSingle();
  const mevcut = configToPrefs((data as { config?: unknown } | null)?.config);

  const hidden = new Set(mevcut.hidden);
  const collapsed = new Set(mevcut.collapsed);
  if (degisiklik.hidden !== undefined) {
    if (degisiklik.hidden) hidden.add(id);
    else hidden.delete(id);
  }
  if (degisiklik.collapsed !== undefined) {
    if (degisiklik.collapsed) collapsed.add(id);
    else collapsed.delete(id);
  }

  const { error } = await supabase.from("user_panel_prefs").upsert({
    user_id: user.id,
    config: prefsToConfig({
      hidden: [...hidden],
      collapsed: [...collapsed],
    }),
  });
  if (error) return { error: error.message };

  revalidatePath(LANDING_PATH);
  return {};
}

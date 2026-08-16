"use server";

// İş favorisi — kişiye özel yıldız. RLS satırı sahibine kelepçeler; action
// yalnız kendi satırını yazar. Olay defterine GİRMEZ: favori işin değil
// KİŞİNİN kaydıdır ve akışta "X işi favoriledi" satırı gürültü olurdu.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FavoriteActionResult = { error?: string };

export async function toggleJobFavorite(
  jobId: string,
  on: boolean
): Promise<FavoriteActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  if (on) {
    const { error } = await supabase
      .from("job_favorites")
      .upsert({ user_id: user.id, job_id: jobId });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("job_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("job_id", jobId);
    if (error) return { error: error.message };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return {};
}

/** TOPLU favori: seçili işleri tek seferde ekler/çıkarır (çoklu seçim). */
export async function bulkSetFavorite(
  jobIds: string[],
  on: boolean
): Promise<FavoriteActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };
  if (jobIds.length === 0) return { error: "Seçili iş yok" };

  if (on) {
    const { error } = await supabase
      .from("job_favorites")
      .upsert(jobIds.map((job_id) => ({ user_id: user.id, job_id })));
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("job_favorites")
      .delete()
      .eq("user_id", user.id)
      .in("job_id", jobIds);
    if (error) return { error: error.message };
  }

  revalidatePath("/jobs");
  return {};
}

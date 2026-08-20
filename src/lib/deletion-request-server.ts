import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DeletionEntityType } from "@/lib/deletion-requests";

export interface DeletionRequestResult {
  error?: string;
  queued?: true;
  requestId?: string;
}

/**
 * Kalıcı silme niyetini güvenilen DB fonksiyonuna iletir. İstemci hedefin
 * yalnız kimliğini verir; görünen ad ve denetim fotoğrafı DB'de yeniden okunur.
 */
export async function requestPermanentDeletion(input: {
  entityType: DeletionEntityType;
  targetId: string;
  context?: Record<string, string>;
  note?: string;
}): Promise<DeletionRequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data, error } = await supabase.rpc("request_deletion", {
    p_entity_type: input.entityType,
    p_target_id: input.targetId,
    p_context: input.context ?? {},
    p_request_note: input.note ?? "",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/deletion-requests");
  return { queued: true, requestId: String(data) };
}

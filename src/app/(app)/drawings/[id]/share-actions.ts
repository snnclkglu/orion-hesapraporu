"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  drawingShareTokenHash,
  newDrawingShareToken,
} from "@/lib/drawing-public-share";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DrawingShareActionResult {
  error?: string;
  /** Aynı kökenli yol; istemci canlı alan adını kendisi ekler. */
  path?: string;
}

async function sharingContext(packageId: string, fileId: string) {
  if (!UUID.test(packageId) || !UUID.test(fileId)) {
    return { error: "Geçersiz dosya kimliği." } as const;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum gerekli." } as const;

  const { data: allowed } = await supabase.rpc("can_edit_drawings");
  if (!allowed) return { error: "Teknik resim paylaşma yetkiniz yok." } as const;

  const { data: file } = await supabase
    .from("drawing_files")
    .select("id, file_name, storage_path, stored")
    .eq("id", fileId)
    .eq("package_id", packageId)
    .maybeSingle();
  if (!file || !file.stored || !file.storage_path) {
    return { error: "Dosya depoda bulunamadı." } as const;
  }
  if (!/\.pdf$/i.test(file.file_name)) {
    return { error: "Müşteri bağlantısı yalnız PDF için oluşturulur." } as const;
  }

  return { supabase, user } as const;
}

/**
 * Seçilen TEK PDF için yeni müşteri bağlantısı oluşturur.
 *
 * Dosyanın önceki aktif bağlantısı kapatılır. Böylece kullanıcı "yenile"e
 * bastığında eski linkin dolaşımda kalmadığı kesin olur.
 */
export async function createDrawingShare(
  packageId: string,
  fileId: string
): Promise<DrawingShareActionResult> {
  const context = await sharingContext(packageId, fileId);
  if ("error" in context) return { error: context.error };
  const { supabase, user } = context;

  const { error: revokeError } = await supabase
    .from("drawing_public_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("file_id", fileId)
    .is("revoked_at", null);
  if (revokeError) return { error: "Önceki paylaşım kapatılamadı." };

  const token = newDrawingShareToken();
  const { error } = await supabase.from("drawing_public_shares").insert({
    file_id: fileId,
    token_hash: drawingShareTokenHash(token),
    created_by: user.id,
  });
  if (error) return { error: "Müşteri bağlantısı oluşturulamadı." };

  revalidatePath(`/drawings/${packageId}/files`);
  return { path: `/paylas/resim/${token}` };
}

/** Bu dosyanın dolaşımdaki müşteri bağlantısını anında geçersiz kılar. */
export async function revokeDrawingShare(
  packageId: string,
  fileId: string
): Promise<DrawingShareActionResult> {
  const context = await sharingContext(packageId, fileId);
  if ("error" in context) return { error: context.error };

  const { error } = await context.supabase
    .from("drawing_public_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("file_id", fileId)
    .is("revoked_at", null);
  if (error) return { error: "Paylaşım kapatılamadı." };

  revalidatePath(`/drawings/${packageId}/files`);
  return {};
}

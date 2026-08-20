"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deletionStorageItems, type DeletionStorageItem } from "@/lib/deletion-requests";

export type DeletionReviewResult = { ok?: true; error?: string; warning?: string };

const reviewSchema = z.object({
  requestId: z.uuid("Geçersiz silme talebi"),
  note: z.string().trim().max(500, "Not en çok 500 karakter olabilir"),
});

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { error: "Bu işlem yalnız Yönetici içindir" } as const;
  return { supabase, user } as const;
}

function refreshDeletionViews(targetPath?: string) {
  revalidatePath("/admin/deletion-requests");
  revalidatePath("/jobs");
  revalidatePath("/projects");
  revalidatePath("/drawings");
  revalidatePath("/offers");
  revalidatePath("/personnel");
  if (targetPath) revalidatePath(targetPath);
}

async function removeStorageItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: DeletionStorageItem[]
): Promise<string | undefined> {
  const byBucket = new Map<string, string[]>();
  for (const item of items) {
    const paths = byBucket.get(item.bucket) ?? [];
    paths.push(item.path);
    byBucket.set(item.bucket, paths);
  }

  const errors: string[] = [];
  for (const [bucket, paths] of byBucket) {
    // Storage toplu silme çağrısı küçük tutulur; binlerce çizim yolu tek gövdeye
    // konursa ağ geçidi sınırına çarpıp hiçbirini temizlemeyebilir.
    for (let start = 0; start < paths.length; start += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(start, start + 100));
      if (error) errors.push(`${bucket}: ${error.message}`);
    }
  }
  return errors.length ? errors.join(" · ") : undefined;
}

async function markCleanup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  error?: string
) {
  return supabase.rpc("mark_deletion_cleanup", {
    p_request_id: requestId,
    p_status: error ? "failed" : "completed",
    p_error: error ?? "",
  });
}

export async function approveDeletionRequest(input: {
  requestId: string;
  note: string;
}): Promise<DeletionReviewResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const { data, error } = await ctx.supabase.rpc("approve_deletion_request", {
    p_request_id: parsed.data.requestId,
    p_review_note: parsed.data.note,
  });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  const targetPath = row && typeof row === "object" && "target_path" in row
    ? String(row.target_path ?? "")
    : "";
  const items = deletionStorageItems(
    row && typeof row === "object" && "cleanup_items" in row ? row.cleanup_items : []
  );

  let cleanupError: string | undefined;
  if (items.length) {
    cleanupError = await removeStorageItems(ctx.supabase, items);
    const { error: markError } = await markCleanup(ctx.supabase, parsed.data.requestId, cleanupError);
    if (markError && !cleanupError) cleanupError = markError.message;
  }

  refreshDeletionViews(targetPath);
  return cleanupError
    ? { ok: true, warning: `Kayıt silindi; bazı dosyalar temizlenemedi: ${cleanupError}` }
    : { ok: true };
}

export async function rejectDeletionRequest(input: {
  requestId: string;
  note: string;
}): Promise<DeletionReviewResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!parsed.data.note) return { error: "Ret gerekçesi gerekli" };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const { error } = await ctx.supabase.rpc("reject_deletion_request", {
    p_request_id: parsed.data.requestId,
    p_review_note: parsed.data.note,
  });
  if (error) return { error: error.message };
  refreshDeletionViews();
  return { ok: true };
}

export async function retryDeletionCleanup(requestId: string): Promise<DeletionReviewResult> {
  const id = z.uuid("Geçersiz silme talebi").safeParse(requestId);
  if (!id.success) return { error: id.error.issues[0].message };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;

  const { data: request } = await ctx.supabase
    .from("deletion_requests")
    .select("cleanup_items, cleanup_status")
    .eq("id", id.data)
    .eq("status", "approved")
    .maybeSingle();
  if (!request) return { error: "Onaylı silme talebi bulunamadı" };

  const items = deletionStorageItems(request.cleanup_items);
  if (!items.length) return { error: "Temizlenecek dosya yok" };
  const cleanupError = await removeStorageItems(ctx.supabase, items);
  const { error: markError } = await markCleanup(ctx.supabase, id.data, cleanupError);
  if (markError) return { error: markError.message };

  refreshDeletionViews();
  return cleanupError ? { warning: cleanupError } : { ok: true };
}

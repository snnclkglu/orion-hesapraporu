import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManualPayload } from "./types";
import { renderManualResponse } from "./export-server";
import { buildManualSourceData } from "@/app/(app)/projects/[id]/manual/sources-data";

const hash = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
/** İki dosya hazır olmadan yayın durumuna geçilmez; eski teslim yeniden üretilmez. */
export async function publishManualDelivery(db: SupabaseClient, projectId: string, revisionId: string, expected: unknown, frozen: ManualPayload): Promise<string | null> {
  const before = hash(JSON.stringify(await buildManualSourceData(db, projectId)));
  const folder = `${projectId}/${revisionId}/${randomUUID()}`;
  const files: Record<string, { path: string; sha256: string; bytes: number }> = {};
  const uploaded: string[] = [];
  let manifest: Record<string, unknown> = {};
  try {
    for (const full of [false, true]) {
      const response = await renderManualResponse(db, projectId, revisionId, full, { payloadOverride: frozen, strict: true, onManifest: m => { manifest = m; } });
      if (!response.ok) throw new Error(await response.text());
      const bytes = new Uint8Array(await response.arrayBuffer());
      const kind = full ? "full" : "body", path = `${folder}/${kind}.pdf`;
      const { error } = await db.storage.from("manual-deliveries").upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (error) throw error;
      uploaded.push(path);files[kind] = { path, sha256: hash(bytes), bytes: bytes.length };
    }
    if (before !== hash(JSON.stringify(await buildManualSourceData(db, projectId)))) throw new Error("Üretim sırasında kaynaklar değişti. Taslak korundu; yeniden yayımlayın.");
    const { error } = await db.rpc("complete_manual_delivery", { p_project_id: projectId, p_revision_id: revisionId, p_expected: expected, p_frozen: frozen, p_archive: { ...files, manifest, sourceHash: before, createdAt: new Date().toISOString() } });
    if (error) throw error;
    return null;
  } catch (error) {
    if (uploaded.length) await db.storage.from("manual-deliveries").remove(uploaded);
    return error instanceof Error ? error.message : String((error as { message?: string })?.message || error);
  }
}

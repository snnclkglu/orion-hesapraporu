import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface PublicDrawingShare {
  shareId: string;
  fileId: string;
  packageId: string;
  fileName: string;
  storagePath: string;
}

/** 256 bitlik, URL'de kaçış gerektirmeyen paylaşım anahtarı. */
export function newDrawingShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Ham anahtar paylaşım defterine yazılmaz; yalnız SHA-256 özeti tutulur. */
export function drawingShareTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Opak anahtarı tek bir, hâlâ geçerli PDF satırına çözer.
 *
 * İki sorgu bilinçlidir: ilişki gömmesinin ürettiği gevşek PostgREST tipleri
 * yerine paylaşım ve dosya kapıları ayrı ayrı doğrulanır. Dışarıya hangi
 * kapının tutmadığı söylenmez; çağıran her durumda 404 verir.
 */
export async function resolvePublicDrawingShare(
  token: string
): Promise<PublicDrawingShare | null> {
  if (!TOKEN_PATTERN.test(token)) return null;

  const admin = createAdminClient();
  const { data: share } = await admin
    .from("drawing_public_shares")
    .select("id, file_id")
    .eq("token_hash", drawingShareTokenHash(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!share) return null;

  const { data: file } = await admin
    .from("drawing_files")
    .select("id, package_id, file_name, storage_path, stored")
    .eq("id", share.file_id)
    .maybeSingle();
  if (
    !file ||
    !file.stored ||
    !file.storage_path ||
    !/\.pdf$/i.test(file.file_name)
  ) {
    return null;
  }

  return {
    shareId: share.id,
    fileId: file.id,
    packageId: file.package_id,
    fileName: file.file_name,
    storagePath: file.storage_path,
  };
}

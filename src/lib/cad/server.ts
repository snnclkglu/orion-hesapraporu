import "server-only";
import { createClient } from "@/lib/supabase/server";
import { canProcessCad } from "@/lib/roles";
import { CadError } from "./service";
import type { CadArtifact, CadDevice, CadJob } from "./contracts";
import type { CadHistoryFilter } from "./history";
export { CadError } from "./service";

// Sunucu anahtarı Supabase fonksiyon ortamındadır. Vercel yalnız oturum/cihaz kimliğini iletir.
async function remote(kind: "web" | "worker", action: string, data: unknown, bearer?: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new CadError("Supabase bağlantısı tanımlı değil.", 503);
  let token = bearer;
  if (kind === "web") {
    const db = await createClient();
    const { data: session } = await db.auth.getSession();
    token = session.session?.access_token;
    if (!token) throw new CadError("Oturumunuzu yeniden açın.", 401);
  }
  const response = await fetch(`${url}/functions/v1/cad-api`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: anon, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ kind, action, data }), cache: "no-store", signal: AbortSignal.timeout(55000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new CadError(payload.error ?? "Çizim İşleme hizmetine ulaşılamıyor.", response.status);
  return payload;
}
export async function browserContext(write = false) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new CadError("Oturumunuzu yeniden açın.", 401);
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  const canWrite = canProcessCad(profile?.role);
  if (write && !canWrite) throw new CadError("Çizim işleme yetkiniz yok.", 403);
  return { actor: user.id, db, canWrite };
}
export async function snapshot(jobId?: string, history?: CadHistoryFilter): Promise<{ canWrite: boolean; devices: CadDevice[]; jobs: CadJob[]; total: number; selected: CadJob | null; artifacts: CadArtifact[] }> { return remote("web", "snapshot", { jobId, history }); }
export async function webCommand(action: string, payload: unknown) { return remote("web", action, payload); }
export async function fileUrl(jobId: string, artifactId?: string, combined = false): Promise<string> { return (await remote("web", "file", { jobId, artifactId, combined })).url; }
export async function helperUrl(): Promise<string> { return (await remote("web", "helper", {})).url; }
export async function workerCommand(bearer: string | null, payload: unknown) {
  const { z } = await import("zod");
  const input = z.object({ action: z.string().max(30), data: z.record(z.string(), z.unknown()).default({}) }).parse(payload);
  return remote("worker", input.action, input.data, bearer);
}

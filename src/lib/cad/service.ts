import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canProcessCad } from "@/lib/roles";
import { historySchema, HISTORY_PAGE_SIZE, escapeHistorySearch } from "./history";
import { CAD_BUCKET, CAD_PROTOCOL, MAX_RESULT_BYTES, artifactSchema, sourceSchema, validateCadResult, type CadArtifact, type CadDevice, type CadJob } from "./contracts";

type Admin = SupabaseClient;
export class CadError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const sha256 = (v: string | Uint8Array) => createHash("sha256").update(v).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export interface CadActorContext { actor: string; db: SupabaseClient; canWrite: boolean }

// Her istek kendi bağlamına sahiptir; aktör/anahtar global değişkende tutulmaz.
export function createCadService(admin: SupabaseClient, browserContext: (write?: boolean) => Promise<CadActorContext>, supabaseUrl: string) {
  const createAdminClient = () => admin;
async function mutate(admin: Admin, actor: string, action: string, data: unknown, device: string | null = null) {
  const { data: result, error } = await admin.rpc("cad_mutate", { p_actor: actor, p_action: action, p_data: data, p_device: device });
  if (error) throw new CadError(error.message, 409);
  return result;
}
async function ownedJob(admin: Admin, actor: string, id: string): Promise<CadJob & { owner_id: string; source_path: string }> {
  const { data, error } = await admin.from("cad_jobs").select("*").eq("id", z.uuid().parse(id)).eq("owner_id", actor).single();
  if (error || !data) throw new CadError("İş bulunamadı.", 404);
  return data;
}
async function objectExists(admin: Admin, path: string, size: number) {
  const { data, error } = await admin.storage.from(CAD_BUCKET).info(path);
  if (error || !data) return false;
  return Number(data.size ?? data.metadata?.size) === size;
}
async function uploadTarget(admin: Admin, path: string, size: number) {
  if (await objectExists(admin, path, size)) return { exists: true, path };
  // Üzerine yazma izni verilmez; eski imzalı URL tamamlanmış dosyayı değiştiremez.
  const { data, error } = await admin.storage.from(CAD_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new CadError("Dosya yükleme izni hazırlanamadı.", 503);
  return { exists: false, ...data };
}
async function listArtifacts(admin: Admin, job: CadJob): Promise<CadArtifact[]> {
  if (!job.attempt_id) return [];
  const rows: CadArtifact[] = [];
  for (let offset = 0; offset < 1250; offset += 500) {
    const { data, error } = await admin.from("cad_artifacts").select("*").eq("job_id", job.id).eq("attempt_id", job.attempt_id).order("id").range(offset, offset + 499);
    if (error) throw new CadError("Çıktılar okunamadı.", 503);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  return rows;
}

async function snapshot(jobId?: string, history: unknown = {}) {
  const { actor, db, canWrite } = await browserContext();
  const filter = historySchema.parse(history);
  let query = db.from("cad_jobs").select("id,device_id,source_name,source_size,source_sha256,status,progress,error,created_at,attempt_id,lease_until,attempts,package_id,options", { count: "exact" }).eq("owner_id", actor);
  if (filter.search) query = query.ilike("source_name", `%${escapeHistorySearch(filter.search)}%`);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.device) query = query.eq("device_id", filter.device);
  if (filter.from) query = query.gte("created_at", `${filter.from}T00:00:00+03:00`);
  if (filter.to) query = query.lt("created_at", new Date(Date.parse(`${filter.to}T00:00:00+03:00`) + 86400000).toISOString());
  const [devices, jobs] = await Promise.all([
    db.from("cad_devices").select("id,name,state,autocad_version,helper_version,protocol,last_seen_at,revoked_at,message").eq("owner_id", actor).is("revoked_at", null).order("created_at", { ascending: false }),
    query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(filter.page * HISTORY_PAGE_SIZE, (filter.page + 1) * HISTORY_PAGE_SIZE - 1),
  ]);
  if (devices.error || jobs.error) throw new CadError("Çizim İşleme altyapısına ulaşılamıyor. Kurulum veya bağlantı kontrol edilmeli.", 503);
  let selected: CadJob | null = null;
  let artifacts: CadArtifact[] = [];
  if (jobId) {
    const admin = createAdminClient();
    selected = await ownedJob(admin, actor, jobId);
    artifacts = await listArtifacts(admin, selected);
  }
  return { canWrite, devices: devices.data as CadDevice[], jobs: jobs.data as CadJob[], total: jobs.count ?? 0, selected, artifacts };
}

async function webCommand(action: string, payload: unknown) {
  const { actor } = await browserContext(true);
  const admin = createAdminClient();
  if (action === "pair") {
    const input = z.object({ name: z.string().trim().min(1).max(80) }).parse(payload);
    const { count, error: countError } = await admin.from("cad_devices").select("id", { count: "exact", head: true }).eq("owner_id", actor).is("revoked_at", null);
    if (countError) throw new CadError("Cihaz listesi okunamadı.", 503);
    if ((count ?? 0) >= 10) throw new CadError("En fazla 10 bilgisayar bağlanabilir. Kullanmadığınız bağlantıyı kaldırın.");
    const code = newToken();
    const { data: device, error } = await admin.from("cad_devices").insert({ owner_id: actor, name: input.name }).select("id").single();
    if (error || !device) throw new CadError("Bilgisayar kaydı oluşturulamadı.", 503);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const secret = await admin.from("cad_device_secrets").insert({ device_id: device.id, pairing_hash: sha256(code), pairing_expires_at: expiresAt });
    if (secret.error) {
      await admin.from("cad_devices").update({ revoked_at: new Date().toISOString() }).eq("id", device.id);
      throw new CadError("Bağlantı kodu üretilemedi. Yeniden deneyin.", 503);
    }
    return { code, deviceId: device.id, expiresAt };
  }
  if (action === "create") {
    const input = sourceSchema.parse(payload);
    const job = await mutate(admin, actor, "create", input);
    if (job.status !== "uploading") return { jobId: job.id, alreadyQueued: true };
    return { jobId: job.id, upload: await uploadTarget(admin, job.source_path, job.source_size) };
  }
  if (action === "revoke") {
    const input = z.object({ deviceId: z.uuid() }).parse(payload);
    return mutate(admin, actor, action, input);
  }
  const input = z.object({ jobId: z.uuid() }).parse(payload);
  const job = await ownedJob(admin, actor, input.jobId);
  if (action === "queue") {
    if (!(await objectExists(admin, job.source_path, job.source_size))) throw new CadError("DWG henüz depoya tam ulaşmadı. Dosyayı yeniden yükleyin.");
  }
  if (!["queue", "cancel", "retry", "approve"].includes(action)) throw new CadError("Bilinmeyen işlem.");
  return mutate(admin, actor, action, input);
}

async function fileUrl(jobId: string, artifactId?: string, combined = false) {
  const { actor } = await browserContext();
  const admin = createAdminClient();
  const job = await ownedJob(admin, actor, jobId);
  let path = job.source_path;
  let name = job.source_name;
  if (artifactId || combined) {
    const artifacts = await listArtifacts(admin, job);
    const file = combined ? artifacts.find(a => a.kind === "pdf" && a.name === "source_BIRLESIK.pdf") : artifacts.find(a => a.id === z.uuid().parse(artifactId));
    if (combined && !file) throw new CadError("Bu işlemin birleşik PDF’si bulunamadı. İşlem ayrıntısından pafta PDF’lerini açabilirsiniz.", 404);
    if (!file || !["review", "approved"].includes(job.status)) throw new CadError("Çıktı henüz hazır değil.", 404);
    path = file.storage_path; name = file.name;
  }
  const { data, error } = await admin.storage.from(CAD_BUCKET).createSignedUrl(path, 60, combined ? undefined : { download: name });
  if (error || !data) throw new CadError("Dosya açılamadı.", 503);
  return data.signedUrl;
}

async function workerCommand(bearer: string | null, payload: unknown) {
  const envelope = z.object({ action: z.string().max(30), data: z.record(z.string(), z.unknown()).default({}) }).parse(payload);
  const admin = createAdminClient();
  if (envelope.action === "pair") {
    const input = z.object({ code: z.string().regex(/^[a-f0-9]{64}$/), token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(envelope.data);
    const { data, error } = await admin.rpc("cad_pair", { p_hash: sha256(input.code), p_token_hash: sha256(input.token) });
    if (error || !data) throw new CadError("Bağlantı kodu geçersiz, kullanılmış veya süresi dolmuş.", 401);
    return { deviceId: data, protocol: CAD_PROTOCOL, storageOrigin: new URL(supabaseUrl).origin };
  }
  if (!bearer || !/^[a-f0-9]{64}$/.test(bearer)) throw new CadError("Cihaz anahtarı gerekli.", 401);
  const { data: secret } = await admin.from("cad_device_secrets").select("device_id").eq("token_hash", sha256(bearer)).single();
  if (!secret) throw new CadError("Cihaz anahtarı geçersiz.", 401);
  const { data: device } = await admin.from("cad_devices").select("*").eq("id", secret.device_id).is("revoked_at", null).single();
  if (!device) throw new CadError("Bilgisayar bağlantısı kaldırıldı.", 403);
  const actor = device.owner_id as string;
  const deviceId = device.id as string;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", actor).single();
  if (!canProcessCad(profile?.role)) throw new CadError("Çizim işleme yetkisi kaldırıldı.", 403);
  if (envelope.action === "heartbeat") {
    const input = z.object({ state: z.enum(["ready", "busy", "autocad_missing", "attention"]), autocadVersion: z.string().max(80), helperVersion: z.string().max(40), protocol: z.number().int(), message: z.string().max(500).default(""), jobId: z.uuid().optional(), attemptId: z.uuid().optional(), progress: z.string().max(300).optional() }).parse(envelope.data);
    if (!!input.jobId !== !!input.attemptId) throw new CadError("İş ve deneme kimliği birlikte gerekli.");
    return mutate(admin, actor, "heartbeat", input, deviceId);
  }
  if (envelope.action === "claim") {
    const job = await mutate(admin, actor, "claim", {}, deviceId);
    if (!job) return { job: null };
    const { data, error } = await admin.storage.from(CAD_BUCKET).createSignedUrl(job.source_path, 600);
    if (error || !data) throw new CadError("Çizim indirme izni hazırlanamadı.", 503);
    return { job: { ...job, downloadUrl: data.signedUrl } };
  }
  const base = z.object({ jobId: z.uuid(), attemptId: z.uuid() }).parse(envelope.data);
  const job = await ownedJob(admin, actor, base.jobId);
  if (job.device_id !== deviceId || job.attempt_id !== base.attemptId) throw new CadError("İş bu cihaza veya denemeye ait değil.", 409);
  if (envelope.action === "artifact") {
    const input = artifactSchema.parse(envelope.data);
    const artifact = await mutate(admin, actor, "artifact", { ...base, ...input }, deviceId);
    return { artifactId: artifact.id, upload: await uploadTarget(admin, artifact.storage_path, artifact.size) };
  }
  if (envelope.action === "fail") {
    return mutate(admin, actor, "fail", { ...base, message: z.string().max(1500).parse(envelope.data.message) }, deviceId);
  }
  if (envelope.action === "complete") {
    if (["review", "approved"].includes(job.status)) return { completed: true };
    const artifacts = await listArtifacts(admin, job);
    const resultFile = artifacts.find(a => a.kind === "result");
    if (!resultFile || resultFile.size > MAX_RESULT_BYTES) throw new CadError("Sonuç raporu eksik veya çok büyük.");
    // Dosya baytları depoda doğrulanmadan iş başarılı sayılmaz.
    for (let i = 0; i < artifacts.length; i += 20) {
      const exists = await Promise.all(artifacts.slice(i, i + 20).map(a => objectExists(admin, a.storage_path, a.size)));
      if (exists.some(v => !v)) throw new CadError("Bazı çıktılar depoya ulaşmadı. Yükleme yeniden denenmeli.", 409);
    }
    const { data, error } = await admin.storage.from(CAD_BUCKET).download(resultFile.storage_path);
    if (error || !data || data.size > MAX_RESULT_BYTES) throw new CadError("Sonuç raporu okunamadı.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (sha256(bytes) !== resultFile.sha256) throw new CadError("Sonuç raporu bütünlük kontrolünden geçemedi.");
    const result = validateCadResult(JSON.parse(new TextDecoder().decode(bytes)), artifacts);
    await mutate(admin, actor, "complete", { ...base, result }, deviceId);
    return { completed: true };
  }
  throw new CadError("Bilinmeyen cihaz işlemi.");
}

return { snapshot, webCommand, fileUrl, workerCommand, listArtifacts, ownedJob, uploadTarget, objectExists };
}

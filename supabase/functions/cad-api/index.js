// Yönetici anahtarı yalnız Supabase çalışma ortamından okunur; istemciye dönmez.
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { z } from "npm:zod@4.4.3";
import { createCadService, CadError } from "./service.js";
import { canProcessCad } from "./roles.js";
import { CAD_BUCKET, exportableCadArtifacts } from "./contracts.js";

const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
Deno.serve(async request => {
  try {
    if (request.method !== "POST") return reply({ error: "Yalnız POST desteklenir." }, 405);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "İstek boş." }, 400);
    const chunks = []; let size = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length;
      if (size > 32768) { await reader.cancel(); return reply({ error: "İstek çok büyük." }, 413); }
      chunks.push(part.value);
    }
    const raw = new Uint8Array(size); let offset = 0;
    for (const part of chunks) { raw.set(part, offset); offset += part.length; }
    const input = z.object({ kind: z.enum(["web", "worker"]), action: z.string().max(30), data: z.record(z.string(), z.unknown()).default({}) }).parse(JSON.parse(new TextDecoder().decode(raw)));
    const url = Deno.env.get("SUPABASE_URL");
    const header = request.headers.get("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY"), { global: { headers: header ? { Authorization: header } : {} }, auth: { persistSession: false } });
    let context = null;
    const authenticate = async (write = false) => {
      if (input.kind !== "web" || !bearer) throw new CadError("Oturum gerekli.", 401);
      if (!context) {
        const { data: { user }, error } = await userDb.auth.getUser(bearer);
        if (error || !user) throw new CadError("Oturum geçersiz.", 401);
        const { data: profile } = await userDb.from("profiles").select("role").eq("id", user.id).single();
        context = { actor: user.id, db: userDb, canWrite: canProcessCad(profile?.role) };
      }
      if (write && !context.canWrite) throw new CadError("Çizim işleme yetkiniz yok.", 403);
      return context;
    };
    const service = createCadService(admin, authenticate, url);
    if (input.kind === "worker") return reply(await service.workerCommand(bearer, { action: input.action, data: input.data }));
    if (input.action === "snapshot") return reply(await service.snapshot(input.data.jobId));
    if (input.action === "file") return reply({ url: await service.fileUrl(input.data.jobId, input.data.artifactId) });
    if (input.action === "helper") {
      await authenticate(true);
      const path = "releases/1.0.2/OrionCadYardimcisi.exe";
      const info = await admin.storage.from(CAD_BUCKET).info(path);
      if (info.error) throw new CadError("Yardımcı dağıtım dosyası henüz yüklenmedi.", 503);
      const signed = await admin.storage.from(CAD_BUCKET).createSignedUrl(path, 60, { download: "OrionCadYardimcisi.exe" });
      if (signed.error) throw new CadError("İndirme bağlantısı hazırlanamadı.", 503);
      return reply({ url: signed.data.signedUrl });
    }
    if (input.action.startsWith("export_")) {
      const { actor } = await authenticate(true);
      const job = await service.ownedJob(admin, actor, input.data.jobId);
      if (job.status !== "approved") throw new CadError("Önce sonuçları onaylayın.");
      const artifacts = exportableCadArtifacts(job.result, await service.listArtifacts(admin, job));
      if (job.result?.malzeme?.length && !artifacts.some(a => a.name === "CAD_MALZEME.xlsx")) throw new CadError("Malzeme aktarım dosyası eksik. Yardımcıyı 1.0.1 veya üstüne güncelleyip çizimi yeniden işleyin.", 409);
      if (input.action === "export_start") {
        const args = z.object({ folderName: z.string().trim().min(1).max(180), itemId: z.uuid().nullable() }).parse(input.data);
        const { data, error } = await admin.rpc("cad_export_start", { p_actor: actor, p_job: job.id, p_folder: args.folderName, p_item: args.itemId });
        if (error) throw new CadError(error.message, 409);
        return reply({ packageId: data, artifacts: artifacts.map(a => ({ id: a.id, name: a.name })), exportedAt: job.exported_at });
      }
      if (!job.package_id) throw new CadError("Paket aktarımı başlatılmadı.");
      if (input.action === "export_info") return reply({ job, artifacts });
      if (input.action === "export_copy") {
        if (job.exported_at) throw new CadError("Tamamlanmış aktarım yeniden yazılmaz.");
        const artifact = artifacts.find(a => a.id === input.data.artifactId);
        if (!artifact) throw new CadError("Çıktı bulunamadı.");
        const { data: file } = await admin.from("drawing_files").select("id,storage_path,size_bytes,checksum,rel_path").eq("id", z.uuid().parse(input.data.fileId)).eq("package_id", job.package_id).single();
        if (!file || file.rel_path !== artifact.name || file.checksum !== artifact.sha256 || Number(file.size_bytes) !== artifact.size) throw new CadError("Paket dosyası kaynak çıktı ile uyuşmuyor.");
        const exists = await admin.storage.from("drawings").info(file.storage_path);
        if (exists.error || Number(exists.data?.size ?? exists.data?.metadata?.size) !== artifact.size) {
          const copied = await admin.storage.from(CAD_BUCKET).copy(artifact.storage_path, file.storage_path, { destinationBucket: "drawings" });
          if (copied.error) throw new CadError("Dosya kopyalanamadı; aktarımı yeniden deneyebilirsiniz.", 503);
        }
        return reply({ copied: true });
      }
      if (input.action === "export_validate" || input.action === "export_done") {
        const all = [];
        for (let n = 0; n < 1500; n += 500) {
          const { data, error } = await admin.from("drawing_files").select("rel_path,size_bytes,checksum,stored,upload_skipped").eq("package_id", job.package_id).order("id").range(n, n + 499);
          if (error) throw new CadError("Paket dosyaları doğrulanamadı.");
          all.push(...data); if (data.length < 500) break;
        }
        for (const a of artifacts) if (!all.some(f => f.rel_path === a.name && Number(f.size_bytes) === a.size && f.checksum === a.sha256 && (f.stored || f.upload_skipped))) throw new CadError("Bazı çıktılar pakete aktarılmadı.");
        if (input.action === "export_done") {
          const { data: pack } = await admin.from("drawing_packages").select("reconciled_at").eq("id", job.package_id).single();
          if (!pack?.reconciled_at) throw new CadError("Paket eşleştirmesi tamamlanmadı.");
          const updated = await admin.from("cad_jobs").update({ exported_at: job.exported_at ?? new Date().toISOString() }).eq("id", job.id).eq("owner_id", actor);
          if (updated.error) throw new CadError("Aktarım bitişi kaydedilemedi.");
        }
        return reply({ valid: true, packageId: job.package_id });
      }
      throw new CadError("Bilinmeyen aktarım aşaması.");
    }
    return reply(await service.webCommand(input.action, input.data));
  } catch (error) {
    const status = error instanceof CadError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503;
    return reply({ error: error instanceof CadError ? error.message : status === 400 ? "İstek biçimi geçersiz." : "Çizim İşleme hizmetine ulaşılamıyor." }, status);
  }
});

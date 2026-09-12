"use server";
import { z } from "zod";
import { browserContext, webCommand } from "@/lib/cad/server";
import type { CadArtifact, CadJob } from "@/lib/cad/contracts";
import { addPackageFiles, finalizeUpload, sealPackageFiles, verifyStorage, reconcilePackage } from "../drawings/actions";

function failure(error: unknown) { return { ok: false as const, error: error instanceof Error ? error.message : "Aktarım tamamlanamadı." }; }
async function info(jobId: string): Promise<{job: CadJob; artifacts: CadArtifact[]}> { return webCommand("export_info", {jobId: z.uuid().parse(jobId)}); }
export async function cadExportStart(input: { jobId: string; folderName: string; itemId: string | null }) {
  try {
    const result: {packageId: string; artifacts: {id: string; name: string}[]; exportedAt: string | null} = await webCommand("export_start", input);
    return { ok: true as const, ...result };
  } catch (error) { return failure(error); }
}
export async function cadExportFile(input: { jobId: string; artifactId: string }) {
  try {
    const {job, artifacts} = await info(input.jobId);
    if (!job.package_id || job.exported_at) throw new Error("Aktarım tamamlanmış veya başlatılmamış.");
    const artifact = artifacts.find(a => a.id === z.uuid().parse(input.artifactId));
    if (!artifact) throw new Error("Aktarılacak dosya bulunamadı.");
    const added = await addPackageFiles({ packageId: job.package_id, files: [{ relPath: artifact.name, size: artifact.size, checksum: artifact.sha256 }] });
    if (added.error || !added.uploads?.[0]) throw new Error(added.error ?? "Dosya kaydı oluşturulamadı.");
    const target = added.uploads[0];
    if (!target.skip) {
      await webCommand("export_copy", {jobId: job.id, artifactId: artifact.id, fileId: target.fileId});
      const done = await finalizeUpload({ packageId: job.package_id, storedFileIds: [target.fileId], failed: [] });
      if (done.error) throw new Error(done.error);
    }
    return { ok: true as const };
  } catch (error) { return failure(error); }
}
export async function cadExportFinish(jobId: string, phase: "verify" | "reconcile") {
  try {
    const {job} = await info(jobId);
    if (!job.package_id) throw new Error("Aktarım başlatılmadı.");
    if (job.exported_at) return {ok: true as const, packageId: job.package_id};
    await webCommand("export_validate", {jobId});
    if (phase === "verify") {
      const sealed = await sealPackageFiles({packageId: job.package_id});
      if (sealed.error) throw new Error(sealed.error);
      const checked = await verifyStorage({packageId: job.package_id});
      if (checked.error || checked.missing) throw new Error(checked.error ?? "Pakette eksik dosyalar var.");
    } else if (phase === "reconcile") {
      const done = await reconcilePackage({packageId: job.package_id});
      if (done.error) throw new Error(done.error);
      await webCommand("export_done", {jobId});
    } else throw new Error("Bilinmeyen aktarım aşaması.");
    return {ok: true as const, packageId: job.package_id};
  } catch(error) { return failure(error); }
}
export async function cadItemOptions() {
  try {
    const { db } = await browserContext(true);
    const { data, error } = await db.from("job_items").select("id,item_no,product_name").order("item_no", { ascending: false }).limit(500);
    if (error) throw new Error("İş kalemleri okunamadı.");
    return { ok: true as const, items: data ?? [] };
  } catch (error) { return failure(error); }
}

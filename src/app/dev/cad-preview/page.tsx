import { notFound } from "next/navigation";
import { CadWorkspace } from "@/app/(app)/cad/workspace";
import { resultSchema, type CadJob, type CadDevice, type CadArtifact } from "@/lib/cad/contracts";
import verified from "@/lib/cad/fixtures/verified-drawing.json";

export default function CadPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const device: CadDevice = { id: "cad-preview", name: "TEKNİK OFİS", state: "ready", autocad_version: "", helper_version: "1.0.0", protocol: 1, last_seen_at: new Date().toISOString(), revoked_at: null, message: "İşlem sırasında AutoCAD'i kullanmayın." };
  const result = resultSchema.parse(verified);
  const job: CadJob = { id: "preview-job", device_id: device.id, source_name: "0026-01-0300 - BAŞKİRİŞ.dwg", source_size: 1, source_sha256: "", status: "review", progress: "Gerçek doğrulama çıktısından seçilmiş iki pafta", error: "", created_at: "2026-09-11T10:00:00Z", attempt_id: "preview-attempt", attempts: 1, lease_until: null, package_id: null, options: { paper: "A3", duplicates: "hepsi" }, result };
  const artifacts: CadArtifact[] = result.paftalar.map((s, i) => ({ id: `preview-${i}`, job_id: job.id, attempt_id: job.attempt_id!, name: String(s.pdf), size: 1, sha256: "", storage_path: "", kind: "pdf" }));
  return <main className="mx-auto max-w-7xl p-4 sm:p-8"><CadWorkspace initial={{ canWrite: true, devices: [device], jobs: [job, { ...job, id: "preview-offline", status: "failed", source_name: "BAĞLANTISI KESİLEN İŞLEM.dwg", result: null }], selected: job, artifacts }} preview /></main>;
}

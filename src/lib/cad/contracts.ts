import { z } from "zod";

// CAD-1: bu sözleşme web ile yerel yardımcı arasında sürümlenir.
export const CAD_PROTOCOL = 1;
export const CAD_BUCKET = "cad-private";
export const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
export const MAX_RESULT_BYTES = 2 * 1024 * 1024;
export const CAD_JOB_STATES = ["uploading", "queued", "processing", "review", "approved", "failed", "cancelled"] as const;
export type CadJobState = typeof CAD_JOB_STATES[number];
export const stateLabels: Record<CadJobState, string> = {
  uploading: "Dosya bekleniyor", queued: "Sırada", processing: "İşleniyor",
  review: "İnceleme bekliyor", approved: "Onaylandı", failed: "Kontrol gerekiyor", cancelled: "İptal edildi",
};
export const deviceStates = ["unpaired", "ready", "busy", "autocad_missing", "attention"] as const;
export type DeviceState = typeof deviceStates[number];
export interface CadDevice {
  id: string; name: string; state: DeviceState; autocad_version: string;
  helper_version: string; protocol: number; last_seen_at: string | null;
  revoked_at: string | null; message: string;
}
export interface CadJob {
  id: string; device_id: string; source_name: string; source_size: number; source_sha256: string;
  status: CadJobState; progress: string; error: string; created_at: string;
  attempt_id: string | null; lease_until: string | null; attempts: number;
  result?: CadResult | null; package_id: string | null; exported_at?: string | null; options: CadOptions;
}
export interface CadArtifact {
  id: string; job_id: string; attempt_id: string; name: string; size: number;
  sha256: string; storage_path: string; kind: "pdf" | "report" | "diagnostic" | "result";
}
export const cadOptionsSchema = z.object({
  paper: z.enum(["A3", "AUTO"]).default("A3"),
  duplicates: z.enum(["hepsi", "alt", "ust", "dur"]).default("hepsi"),
});
export type CadOptions = z.infer<typeof cadOptionsSchema>;

export function safeCadName(name: string): boolean {
  return name.length > 0 && name.length <= 180 && name === name.trim()
    && !/[<>:"/\\|?*\x00-\x1f]/.test(name) && !name.endsWith(".")
    && name !== "." && name !== ".."
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name);
}
const fileName = z.string().refine(safeCadName, "Dosya adı desteklenmiyor.");
export const sourceSchema = z.object({
  id: z.uuid(), deviceId: z.uuid(), name: fileName.refine(v => /\.dwg$/i.test(v), "DWG dosyası seçin."),
  size: z.number().int().positive().max(MAX_SOURCE_BYTES), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  options: cadOptionsSchema, acknowledged: z.literal(true),
});
export const artifactSchema = z.object({
  name: fileName, size: z.number().int().positive().max(MAX_SOURCE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), kind: z.enum(["pdf", "report", "diagnostic", "result"]),
}).superRefine((v, ctx) => {
  const allowed = v.kind === "pdf" ? /\.pdf$/i : v.kind === "result" ? /^result\.json$/ : v.kind === "report" ? /\.(xlsx|csv|json)$/i : /\.(txt|json)$/i;
  if (!allowed.test(v.name)) ctx.addIssue({ code: "custom", message: "Çıktı türü ile uzantı uyuşmuyor." });
  if (v.kind === "result" && v.size > MAX_RESULT_BYTES) ctx.addIssue({ code: "custom", message: "Sonuç raporu çok büyük." });
});
const rawRow = z.record(z.string(), z.unknown());
export const resultSchema = z.object({
  arac_surum: z.string().max(80),
  ozet: z.object({ cizim: z.literal(1), pafta: z.number().int().positive().max(1000),
    malzeme_satiri: z.number().int().min(0).max(20000), pdf_basarili: z.number().int().positive(), hata: z.literal(0) }),
  paftalar: z.array(rawRow).min(1).max(1000), malzeme: z.array(rawRow).max(20000), tanilar: z.array(rawRow).max(100),
});
export type CadResult = z.infer<typeof resultSchema>;

// Birleşik PDF bir pafta değildir; Teknik Resimler'e ikinci kez parça olarak girmez.
export function exportableCadArtifacts(result: CadResult | null | undefined, artifacts: CadArtifact[]): CadArtifact[] {
  const names = new Set((result?.paftalar ?? []).map(sheet => sheet.pdf));
  return artifacts.filter(a => a.kind === "pdf" && names.has(a.name) || a.kind === "report" && a.name === "CAD_MALZEME.xlsx");
}

export function validateCadResult(value: unknown, artifacts: Pick<CadArtifact, "name" | "kind">[]): CadResult {
  const r = resultSchema.parse(value);
  if (r.ozet.pafta !== r.paftalar.length || r.ozet.malzeme_satiri !== r.malzeme.length || r.ozet.pdf_basarili !== r.paftalar.length) {
    throw new Error("Sonuç sayıları birbiriyle uyuşmuyor.");
  }
  const names = new Set(artifacts.filter(a => a.kind === "pdf").map(a => a.name));
  const used = new Set<string>();
  for (const sheet of r.paftalar) {
    const name = typeof sheet.pdf === "string" ? sheet.pdf : "";
    if (!safeCadName(name) || !names.has(name) || used.has(name)) throw new Error("Her pafta için ayrı ve yüklenmiş PDF gerekli.");
    used.add(name);
  }
  return r;
}

export function deviceAvailability(device: CadDevice | undefined, now = Date.now()): { ready: boolean; label: string } {
  if (!device) return { ready: false, label: "Önce bilgisayarınızı bağlayın." };
  if (device.revoked_at) return { ready: false, label: "Bilgisayar bağlantısı kaldırıldı." };
  if (device.state === "unpaired") return { ready: false, label: "Yardımcı ile eşleştirme bekleniyor." };
  const seen = device.last_seen_at ? Date.parse(device.last_seen_at) : NaN;
  if (!Number.isFinite(seen) || now - seen > 90000 || seen > now + 30000) return { ready: false, label: "Yardımcıya ulaşılamıyor." };
  if (device.protocol !== CAD_PROTOCOL) return { ready: false, label: "Yardımcıyı güncelleyin." };
  const labels: Record<DeviceState, string> = { unpaired: "Eşleştirme bekleniyor", ready: "İşleme hazır", busy: "AutoCAD işleniyor; sıraya alınabilir", autocad_missing: "Desteklenen AutoCAD bulunamadı", attention: "AutoCAD veya yardımcı kontrol edilmeli" };
  return { ready: device.state === "ready" || device.state === "busy", label: labels[device.state] };
}

export function displayCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" || typeof value === "number" ? String(value) : "—";
}

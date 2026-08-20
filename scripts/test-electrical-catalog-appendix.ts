/**
 * Canlı 0019 verisiyle yeni EK-F üreticisini doğrular.
 *
 *   npx tsx scripts/test-electrical-catalog-appendix.ts [çıktı.pdf]
 *
 * Gizli anahtar yazdırılmaz; `.env.local`/`.env.admin` yalnız bu süreçte okunur.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildElectricalCatalogAppendix } from "@/lib/electrical/catalog-appendix";

async function loadEnv(): Promise<void> {
  for (const name of [".env.local", ".env.frankfurt", ".env.admin"]) {
    try {
      const content = await readFile(path.join(process.cwd(), name), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!match || process.env[match[1]]) continue;
        process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Seçimlik çevre dosyası yoksa sıradakine geçilir.
    }
  }
}

async function elevatedKey(): Promise<string> {
  const explicit = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (explicit) return explicit;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!token || !projectRef) throw new Error("Supabase yönetim anahtarı bulunamadı.");
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Supabase API anahtarı alınamadı (${response.status}).`);
  const keys = (await response.json()) as { name?: string; api_key?: string }[];
  const key = keys.find((item) => item.name === "service_role" || item.name === "secret")?.api_key;
  if (!key) throw new Error("Yükseltilmiş Supabase anahtarı bulunamadı.");
  return key;
}

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL bulunamadı.");
  const supabase = createClient(url, await elevatedKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: project, error } = await supabase
    .from("projects")
    .select("id")
    .eq("doc_no", "0019-00")
    .maybeSingle();
  if (error || !project) throw new Error("0019-00 projesi bulunamadı.");

  const appendix = await buildElectricalCatalogAppendix(supabase, String(project.id));
  const output = path.resolve(
    process.argv[2] ?? "output/pdf/0019-EK-F-ELEKTRIK-EKIPMAN-KATALOG-SAYFALARI.pdf"
  );
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, appendix.bytes);
  console.log(
    `EK-F: ${appendix.documentCount} belge · ${appendix.pageCount} sayfa · ` +
      `${(appendix.bytes.byteLength / 1024 / 1024).toFixed(1)} MB · atlanan ${appendix.skipped.length}`
  );
  console.log(output);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

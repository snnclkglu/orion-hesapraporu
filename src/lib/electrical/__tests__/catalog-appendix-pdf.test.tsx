import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";
import { PDFArray, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  ElectricalCatalogAppendixPdf,
  catalogAppendixIndexPageCount,
} from "../catalog-appendix-pdf";
import { buildElectricalCatalogAppendix } from "../catalog-appendix";

async function loadQaEnv(): Promise<void> {
  for (const name of [".env.local", ".env.frankfurt", ".env.admin"]) {
    try {
      const content = await readFile(path.join(process.cwd(), name), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!match || process.env[match[1]]) continue;
        process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Seçimlik QA çevre dosyası.
    }
  }
}

async function qaServiceKey(): Promise<string> {
  const explicit = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (explicit) return explicit;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!token || !projectRef) throw new Error("Supabase QA anahtarı bulunamadı.");
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Supabase QA anahtarı alınamadı (${response.status}).`);
  const keys = (await response.json()) as { name?: string; api_key?: string }[];
  const key = keys.find((item) => item.name === "service_role" || item.name === "secret")?.api_key;
  if (!key) throw new Error("Supabase QA servis anahtarı bulunamadı.");
  return key;
}

describe("EK-F katalog dizini", () => {
  it("çok sayfalı dizini ve tıklanabilir ürün hedeflerini üretir", async () => {
    const entries = Array.from({ length: 50 }, (_, index) => ({
      anchor: `ekf-entry-${index + 1}`,
      label: `SIEMENS · 6SL-${String(index + 1).padStart(4, "0")} · Teknik sayfa`,
      pageCount: 1,
    }));
    const bytes = await renderToBuffer(ElectricalCatalogAppendixPdf({ entries }));
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const linkCount = pdf.getPages().reduce((total, page) => {
      const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      return total + (annots?.size() ?? 0);
    }, 0);

    expect(catalogAppendixIndexPageCount(entries.length)).toBe(2);
    expect(pdf.getPageCount()).toBe(52);
    expect(linkCount).toBeGreaterThanOrEqual(entries.length);
  }, 30_000);

  it("iki yapraklı föyün bütün kabuk sayfalarını gerçek A4 boyunda tutar", async () => {
    const bytes = await renderToBuffer(
      ElectricalCatalogAppendixPdf({
        entries: [{ anchor: "ekf-entry-1", label: "Örnek teknik föy", pageCount: 2 }],
      })
    );
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(pdf.getPageCount()).toBe(3);
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    }
    if (process.env.CATALOG_SHELL_QA_OUT) {
      await writeFile(path.resolve(process.env.CATALOG_SHELL_QA_OUT), bytes);
    }
  });

  it.runIf(Boolean(process.env.EKF_LIVE_QA_OUT))(
    "0019 canlı verisiyle görsel QA PDF'i üretir",
    async () => {
      await loadQaEnv();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL bulunamadı.");
      const supabase = createClient(url, await qaServiceKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("doc_no", "0019-00")
        .maybeSingle();
      if (!project) throw new Error("0019-00 projesi bulunamadı.");
      const appendix = await buildElectricalCatalogAppendix(supabase, String(project.id));
      const output = path.resolve(process.env.EKF_LIVE_QA_OUT!);
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, appendix.bytes);
      expect(appendix.documentCount).toBeGreaterThan(100);
      expect(appendix.pageCount).toBeLessThan(250);
      expect(appendix.skipped).toHaveLength(0);
    },
    300_000
  );
});

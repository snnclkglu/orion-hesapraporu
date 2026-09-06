import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_SPECS } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { diagramsForSection } from "@/lib/diagrams/select";
import { loadRevision } from "@/lib/revision-load";
import { renderReportPdf, type ReportProps } from "@/lib/pdf/report";

describe("elektrik hesap raporu PDF", () => {
  it("sürücü, kablo ve renkli feston şemasıyla standart rapor üretir", async () => {
    const loaded = loadRevision({
      specs: { ...NEW_WORK_SPECS, hasElectricalCalculation: "yes" },
      disabledModules: [...NEW_WORK_DISABLED_MODULES],
    }, null);
    const input = loaded.input;
    const result = runCalc(input);
    const props: ReportProps = {
      project: {
        doc_no: "DEV-ELEKTRIK",
        name: "Elektrik Hesap Raporu Önizlemesi",
        customer: "ORION",
        crane_type: "Çift kirişli gezer köprülü vinç",
        crane_location: "Geliştirme Önizlemesi",
      },
      revision: { rev_no: 0, label: "V0", issued_at: "2026-09-06T00:00:00.000Z" },
      preparedBy: "ORION Mühendislik",
      reportBrand: {
        name: "ORION CRANES",
        logo: fs.readFileSync(path.join(process.cwd(), "public", "brand", "orion-logo-ink.png")),
      },
      input,
      result,
      level: "standart",
    };

    const buffer = await renderReportPdf(props);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(20 * 1024);

    const outDir = path.join(process.cwd(), ".smoke", "electrical-report");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "electrical-report-preview.pdf"), buffer);

    // Renkler sıkıştırılmış PDF akışında aranmaz; rapora verilen şema modelinde
    // doğrulanır. Böylece renderer ayarından bağımsız, kararlı bir test kalır.
    const diagram = diagramsForSection("electrical", "12.3", input, result)[0];
    const fills = diagram?.els.flatMap((el) =>
      "fill" in el && typeof el.fill === "string" ? [el.fill] : []
    ) ?? [];
    expect(fills).toContain("#D94A3A"); // güç
    expect(fills).toContain("#2F6FEB"); // kumanda
    expect(fills).toContain("#0F9D8A"); // sinyal
    expect(new Set(result.electrical?.values.festoon.placements.map((p) => p.color))).toEqual(
      new Set(["#D94A3A", "#2F6FEB", "#0F9D8A"])
    );

    const { extractText, getDocumentProxy } = await import("unpdf");
    const document = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(document);
    const all = (Array.isArray(text) ? text : [text]).join(" ").replace(/\s+/g, " ");
    expect(all).toContain("SÜRÜCÜ ÖN SEÇİMİ");
    expect(all).toContain("MOTOR VE ANA BESLEME KABLOLARI");
    expect(all).toContain("FESTON KABLO YERLEŞİMİ");
    expect(all).toContain("ATV340");
    expect(all).toContain("kg/m");
    expect(all).toContain("0026 tamamlanmış elektrik projesi");
    expect(all).toContain("0019 tamamlanmış elektrik projesi");
    expect(all).toContain("HELUKABEL Türkiye ürün kataloğu");
    expect(all).toContain("Conductix-Wampfler");

  }, 180_000);
});

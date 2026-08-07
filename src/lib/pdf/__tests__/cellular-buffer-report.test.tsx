import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { renderReportPdf, type ReportProps } from "@/lib/pdf/report";

describe("hücresel tamponlu hesap raporu", () => {
  it("kauçuk ailesi altında hücresel tampon eğrisiyle PDF üretir", async () => {
    const input = {
      ...V5_TEMPLATE,
      specs: { ...V5_TEMPLATE.specs, trolleyBufferType: "kaucuk" as const },
      trolley: {
        ...V5_TEMPLATE.trolley!,
        selections: {
          ...V5_TEMPLATE.trolley!.selections,
          bufferCatalogType: "hücresel",
          bufferEnergyCurve: undefined,
          bufferForceCurve: undefined,
          bufferMaxCompressionPct: 80,
        },
      },
    };
    const result = runCalc(input);
    expect(result.trolley?.values.bufferType).toBe("hucresel");
    expect(result.trolley?.values.bufferComputed).toBe(true);

    const props: ReportProps = {
      project: {
        doc_no: "CELLULAR-BUFFER-SMOKE",
        name: "Hücresel Tampon Denemesi",
        customer: "ORION",
        crane_type: "Çift Kirişli Gezer Köprülü Vinç",
      },
      revision: { rev_no: 1, label: "V1", updated_at: "2026-08-07T00:00:00.000Z" },
      preparedBy: "Test Mühendisi",
      input,
      result,
      level: "standart",
    };
    const pdf = await renderReportPdf(props);

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(20 * 1024);

    const output = process.env.CELLULAR_BUFFER_PDF_OUTPUT;
    if (output) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, pdf);
    }
  }, 240_000);
});

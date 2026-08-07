import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { renderReportPdf, type ReportProps } from "@/lib/pdf/report";

describe("festoonlu hesap raporu", () => {
  it("festoon ayrıntısı ve bölüm notuyla PDF üretir", async () => {
    const input = {
      ...V5_TEMPLATE,
      specs: {
        ...V5_TEMPLATE.specs,
        trolleyPowerSupply: "festoon" as const,
        trolleyFestoon: {
          brand: "vasel" as const,
          series: "auto" as const,
          cableForm: "flat" as const,
          trolleyCount: 2,
          cablePackageWeightKg: 120,
        },
        bridgePowerSupply: "festoon" as const,
        runwayLengthM: 80,
        bridgeFestoon: {
          series: "auto" as const,
          cableForm: "round" as const,
          trolleyCount: 2,
          cablePackageWeightKg: 200,
        },
        showFestoonDetailsInReport: true,
      },
    };
    const props: ReportProps = {
      project: {
        doc_no: "FESTOON-SMOKE",
        name: "Feston Seçim Denemesi",
        customer: "ORION",
        crane_type: "Çift Kirişli Gezer Köprülü Vinç",
      },
      revision: { rev_no: 1, label: "V1", updated_at: "2026-08-07T00:00:00.000Z" },
      preparedBy: "Test Mühendisi",
      input,
      result: runCalc(input),
      level: "standart",
      sectionNotes: { "bridge-5.2": "Teker mili imalat resmi yayımlanmadan önce müşteri onayı alınacaktır." },
    };
    const pdf = await renderReportPdf(props);

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(20 * 1024);

    const output = process.env.FESTOON_PDF_OUTPUT;
    if (output) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, pdf);
    }
  }, 240_000);
});

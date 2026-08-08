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
        bridgePowerSupply: "festoon" as const,
        runwayLengthM: 80,
      },
      trolley: {
        inputs: {
          ...V5_TEMPLATE.trolley!.inputs,
          festoonTrolleyCount: 2,
          festoonCablePackageWeightKg: 120,
          festoonLoopHeightM: 1.5,
        },
        selections: {
          ...V5_TEMPLATE.trolley!.selections,
          festoonBrand: "Vasel",
          festoonSeries: "VS2070",
          festoonLine: "Ağır Hizmet",
          festoonCableForm: "Yassı",
          festoonTrolleyLoadKg: 125,
          festoonMaxSpeedMpm: 150,
          festoonTrolleyCode: "VS2070A-FB63A…",
        },
      },
      bridge: {
        inputs: {
          ...V5_TEMPLATE.bridge!.inputs,
          festoonTrolleyCount: 2,
          festoonCablePackageWeightKg: 200,
          festoonLoopHeightM: 2,
        },
        selections: {
          ...V5_TEMPLATE.bridge!.selections,
          festoonBrand: "Conductix-Wampfler",
          festoonSeries: "0330",
          festoonLine: "M-Line",
          festoonCableForm: "Yuvarlak",
          festoonTrolleyLoadKg: 200,
          festoonMaxSpeedMpm: 150,
        },
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

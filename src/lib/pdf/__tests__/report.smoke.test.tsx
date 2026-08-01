// Duman testi: golden V5 şablonu ile tam (detaylı) rapor PDF'i gerçekten
// üretilebiliyor mu? Motor koşturulur, ReportDocument buffer'a render edilir;
// boyut kontrolü + göz kontrolü için .smoke/report-sample.pdf yazılır.

import fs from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { ReportDocument, type ReportProps } from "@/lib/pdf/report";

describe("hesap raporu PDF duman testi", () => {
  it("V5 şablonundan detaylı rapor üretir (>20KB) ve örneği .smoke/ altına yazar", async () => {
    const input = V5_TEMPLATE;
    const result = runCalc(input);
    const props: ReportProps = {
      project: {
        doc_no: "412",
        name: "İsdemir Amonyum Sülfat Vinci",
        customer: "İsdemir",
        crane_type: "Çift kirişli gezer köprülü vinç",
      },
      revision: { rev_no: 3, label: "V3", issued_at: "2026-07-01T00:00:00.000Z" },
      preparedBy: "Sinan Çolakoğlu",
      input,
      result,
    };

    const buf = await renderToBuffer(<ReportDocument {...props} />);

    expect(buf.length).toBeGreaterThan(20 * 1024);

    const outDir = path.join(process.cwd(), ".smoke");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "report-sample.pdf"), buf);
  }, 120_000);
});

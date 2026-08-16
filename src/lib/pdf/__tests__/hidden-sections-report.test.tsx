// Alt bölüm gizleme — PDF raporu (yapısal ölçüm).
//
// Gizlenen alt bölüm rapora hiç girmez. PDF metni gömülü font alt kümeleriyle
// yazıldığı için başlık metni aranmaz; bölümlerin varlığı SectionProbe
// çapalarından ölçülür — her basılan bölüm `sec-<modül>-<rawId>` çapasını
// toplar, basılmayan bölümün çapası hiç oluşmaz.

import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { ReportDocument, type ReportProps } from "@/lib/pdf/report";

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
  // Ana arabanın teker kaplini ve ana kaldırmanın tambur kaplini gizli.
  hiddenSections: ["trolley-5.7", "main-2.7"],
};

describe("alt bölüm gizleme — PDF raporu", () => {
  it("gizlenen bölümler basılmaz, komşuları ve köprüdeki eşleri basılır", async () => {
    const collected = new Set<string>();
    await renderToBuffer(
      <ReportDocument {...props} collect={(anchor) => collected.add(anchor)} />
    );

    // Gizlenen bölümlerin çapası hiç oluşmadı.
    expect(collected.has("sec-trolley-5.7")).toBe(false);
    expect(collected.has("sec-main-2.7")).toBe(false);
    // Komşu bölümler ve aynı ham bölümün KÖPRÜdeki karşılığı yerinde.
    expect(collected.has("sec-trolley-5.6")).toBe(true);
    expect(collected.has("sec-bridge-5.7")).toBe(true);
    expect(collected.has("sec-main-2.6")).toBe(true);
  }, 240_000);
});

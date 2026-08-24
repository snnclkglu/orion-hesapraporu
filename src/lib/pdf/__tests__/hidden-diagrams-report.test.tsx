// Şema gizleme — PDF raporu (yapısal ölçüm).
//
// Alt bölüm GİZLEMEKTEN farkı: şeması gizlenen bölüm rapora AYNEN girer
// (başlık, girdiler, katalog seçimi, kontroller) — yalnız parametrik çizimi
// basılmaz. İki bağ ölçülür:
//   1. Bölümün çapası hâlâ oluşur (bölüm gizlenmedi, yalnız çizimi düştü).
//   2. Çizim gerçekten düştü: aynı belge diyagram gizliyken DAHA KÜÇÜKtür
//      (bir parametrik şema onlarca SVG öğesidir; kayda değer bir farktır).

import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { ReportDocument, type ReportProps } from "@/lib/pdf/report";

const input = V5_TEMPLATE;
const result = runCalc(input);
const base: ReportProps = {
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

describe("şema gizleme — PDF raporu", () => {
  it("bölüm basılmaya devam eder ama şeması düşer", async () => {
    const collected = new Set<string>();
    const withHidden = await renderToBuffer(
      <ReportDocument
        {...base}
        // Ana kirişin kutu kesiti şeması gizli — bölümün kendisi kalmalı.
        hiddenDiagrams={["girder-7.1"]}
        collect={(anchor) => collected.add(anchor)}
      />
    );
    // Bölüm rapora girmeye devam etti (gizleme değil, yalnız şema düştü).
    expect(collected.has("sec-girder-7.1")).toBe(true);

    const baseline = await renderToBuffer(<ReportDocument {...base} />);
    // Şema onlarca SVG öğesidir: gizli sürüm ölçülebilir biçimde küçüktür.
    expect(withHidden.length).toBeLessThan(baseline.length);
  }, 240_000);
});

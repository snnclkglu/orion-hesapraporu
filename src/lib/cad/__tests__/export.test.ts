import { expect, it } from "vitest";
import { exportableCadArtifacts, type CadArtifact, type CadResult } from "../contracts";
it("birleşik PDF indirmelerde kalır, Teknik Resimler'e yalnız pafta PDF ve Excel gider", () => {
  const result: CadResult = { arac_surum: "test", ozet: { cizim: 1, pafta: 1, malzeme_satiri: 0, pdf_basarili: 1, hata: 0 }, paftalar: [{ pdf: "A.pdf" }], malzeme: [], tanilar: [] };
  const files = [
    { name: "A.pdf", kind: "pdf" }, { name: "source_BIRLESIK.pdf", kind: "pdf" },
    { name: "CAD_MALZEME.xlsx", kind: "report" }, { name: "malzeme_listesi.xlsx", kind: "report" }, { name: "result.json", kind: "result" },
  ] as CadArtifact[];
  expect(exportableCadArtifacts(result, files).map(f => f.name)).toEqual(["A.pdf", "CAD_MALZEME.xlsx"]);
  expect(files).toHaveLength(5);
});

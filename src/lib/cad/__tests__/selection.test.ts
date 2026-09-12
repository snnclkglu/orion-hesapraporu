import { expect, it } from "vitest";
import { selectCadFiles } from "../selection";
import { MAX_SOURCE_BYTES } from "../contracts";
it("alt klasör DWG'lerini tutar, destek dosyalarını ayırır ve eş adları kaybetmez", () => {
  const a = { name: "A.dwg", size: 10, webkitRelativePath: "Klasör/Bir/A.dwg" };
  const b = { name: "A.dwg", size: 11, webkitRelativePath: "Klasör/İki/A.dwg" };
  expect(selectCadFiles([a, b, { name: "A.pdf", size: 12 }])).toEqual({ files: [a, b], ignored: 1 });
});
it("büyük harf uzantısını kabul eder", () => {
  expect(selectCadFiles([{ name: "ÇİZİM.DWG", size: 10 }]).files).toHaveLength(1);
});
it("DWG içermeyen klasörde anlaşılır hata verir", () => {
  expect(() => selectCadFiles([{ name: "A.pdf", size: 10 }])).toThrow("DWG bulunamadı");
});
it("sınır aşıldığında dosyaları sessizce kesmez", () => {
  expect(() => selectCadFiles(Array.from({ length: 31 }, (_, n) => ({ name: `${n}.dwg`, size: 10 })))).toThrow("30 DWG");
});
it("boş, aşırı büyük ve güvensiz DWG adlarını yüklemeden reddeder", () => {
  for (const file of [{ name: "a.dwg", size: 0 }, { name: "a.dwg", size: MAX_SOURCE_BYTES + 1 }, { name: "NUL.dwg", size: 10 }]) expect(() => selectCadFiles([file])).toThrow();
});

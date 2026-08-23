import { describe, expect, it } from "vitest";
import { fileNameFromDisposition, safeDownloadName } from "@/lib/file-download";

describe("PDF indirme dosya adı", () => {
  it("RFC 5987 UTF-8 adını ASCII geri düşüşe tercih eder", () => {
    expect(
      fileNameFromDisposition(
        "attachment; filename=TEKLIF.pdf; filename*=UTF-8''%C4%B0%C5%9E%20EMR%C4%B0.pdf"
      )
    ).toBe("İŞ EMRİ.pdf");
  });

  it("tırnaklı klasik filename değerini okur", () => {
    expect(fileNameFromDisposition('attachment; filename="ORION RAPOR.pdf"')).toBe(
      "ORION RAPOR.pdf"
    );
  });

  it("yol ve denetim karakterlerini dosya adına taşımaz", () => {
    expect(safeDownloadName("../rapor\\son\n.pdf")).toBe("..-rapor-son.pdf");
  });

  it("başlık yoksa güvenli geri düşüşü kullanır", () => {
    expect(fileNameFromDisposition(null, "teklif.pdf")).toBe("teklif.pdf");
  });
});

// İndirme dosya adı kuralı — İŞ ADI - DOKÜMAN KODU - VERSİYON, BÜYÜK HARF.

import { describe, expect, it } from "vitest";
import { REPORT_LEVEL_LABELS, docCode, downloadFileName } from "../doc-naming";

describe("docCode", () => {
  it("belge türü + doküman no + revizyon", () => {
    expect(docCode("HR", "0055", 1)).toBe("ORC-HR-0055-R01");
    expect(docCode("EQ", "0055", 12)).toBe("ORC-EQ-0055-R12");
  });
});

describe("downloadFileName", () => {
  it("firma düzeni: İŞ ADI - DOKÜMAN KODU - VERSİYON", () => {
    expect(
      downloadFileName(["Amonyum Sülfat Tesisi Vinci", docCode("HR", "0055", 1), "V1"])
    ).toBe("AMONYUM SÜLFAT TESİSİ VİNCİ - ORC-HR-0055-R01 - V1.pdf");
  });

  it("Türkçe büyük harf: \"i\" → \"İ\" (toUpperCase \"I\" yapardı)", () => {
    expect(downloadFileName(["İsdemir vinci"])).toBe("İSDEMİR VİNCİ.pdf");
    expect(downloadFileName(["Işıl Makina"])).toBe("IŞIL MAKİNA.pdf");
  });

  it("rapor seviyesi sonda görünür", () => {
    const ad = downloadFileName(["Vinç", docCode("HR", "0055", 1), "V1", REPORT_LEVEL_LABELS.detayli]);
    expect(ad).toBe("VİNÇ - ORC-HR-0055-R01 - V1 - DETAYLI.pdf");
    expect(
      downloadFileName(["Vinç", docCode("HR", "0055", 1), "V1", REPORT_LEVEL_LABELS.ozet])
    ).toMatch(/ - ÖZET\.pdf$/);
  });

  it("boş parçalar ada çift ayraç sokmaz", () => {
    expect(downloadFileName(["Vinç", null, "V1", undefined, ""])).toBe("VİNÇ - V1.pdf");
  });

  it("dosya adında kullanılamayan karakterler temizlenir", () => {
    // Kalem numarasındaki "/" ve tırnak dosya adını bozardı; nokta ve tire
    // doküman kodunun parçası olduğu için KALIR.
    expect(downloadFileName(['30 t / 5 t "Ana" Vinç', "ORC-EQ-0055-R01"])).toBe(
      "30 T 5 T ANA VİNÇ - ORC-EQ-0055-R01.pdf"
    );
  });

  it("uzantı seçilebilir — ekipman listesi Excel de aynı adı taşır", () => {
    expect(downloadFileName(["Vinç", "V1"], "xlsx")).toBe("VİNÇ - V1.xlsx");
  });

  it("hiç parça yoksa ad boş kalmaz", () => {
    expect(downloadFileName([null, ""])).toBe("ORION.pdf");
  });
});

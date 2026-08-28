import { describe, expect, it } from "vitest";
import {
  OFFER_REPORT_TRANSFER_MAX_BYTES,
  OfferReportTransferError,
  buildOfferReportTransferFile,
  parseOfferReportTransferText,
  stringifyOfferReportTransferFile,
} from "@/lib/offer-report-transfer";

function exampleFile() {
  return buildOfferReportTransferFile({
    project: {
      documentNo: "6300001264",
      name: "VİNÇ, GEZER KÖPRÜLÜ, ÇİFT KİRİŞ, 20 TON",
      customer: "KARDEMİR",
      craneType: "Çift Kirişli Gezer Köprülü Vinç",
      craneLocation: "KARABÜK",
    },
    revision: {
      revNo: 0,
      engineVersion: "test-engine",
      inputs: null,
      selections: null,
    },
    exportedAt: new Date("2026-08-28T08:00:00.000Z"),
  });
}

describe("teklif hesap raporu AI aktarım dosyası", () => {
  it("girdileri, seçimleri ve Türkçe alan rehberini dışa aktarır", () => {
    const file = exampleFile();

    expect(file.source).toEqual({
      documentNo: "6300001264",
      revisionNo: 0,
      engineVersion: "test-engine",
      exportedAt: "2026-08-28T08:00:00.000Z",
    });
    expect(file.revision.inputs.specs).toBeTypeOf("object");
    expect(file.revision.inputs.mainHoist).toBeTypeOf("object");
    expect(file.revision.selections.mainHoist).toBeTypeOf("object");
    expect(file).not.toHaveProperty("revision.results");
    expect(file.fieldGuide).toContainEqual(
      expect.objectContaining({
        path: "revision.inputs.specs.mainCapacityT",
        label: "Kaldırma Kapasitesi",
        valueType: "number",
        unit: "ton",
      })
    );
    expect(file.instructions.join(" ")).toContain("uydurma");
  });

  it("AI'ın değiştirdiği değerleri alır, yabancı anahtarı atar ve sonucu yeniden hesaplar", () => {
    const raw = exampleFile() as unknown as Record<string, unknown>;
    const project = raw.project as Record<string, unknown>;
    project.documentNo = "6300001265";
    project.name = "YENİ 20 TON VİNÇ";

    const revision = raw.revision as Record<string, Record<string, unknown>>;
    const inputs = revision.inputs;
    const specs = inputs.specs as Record<string, unknown>;
    specs.mainCapacityT = 20;
    specs.spanM = 24.5;
    inputs.aiTarafindanEklenenBilinmeyenAlan = { calistir: true };
    raw.reviewNotes = ["revision.inputs.specs.runwayLengthM şartnamede bulunamadı."];

    const parsed = parseOfferReportTransferText(JSON.stringify(raw));

    expect(parsed.project.documentNo).toBe("6300001265");
    expect(parsed.inputs.specs?.mainCapacityT).toBe(20);
    expect(parsed.inputs.specs?.spanM).toBe(24.5);
    expect(parsed.inputs).not.toHaveProperty("aiTarafindanEklenenBilinmeyenAlan");
    expect(parsed.results.engineVersion).not.toBe("");
    expect(parsed.reviewNotes).toEqual([
      "revision.inputs.specs.runwayLengthM şartnamede bulunamadı.",
    ]);
  });

  it("sayı alanına birimli metin yazılırsa yolu gösteren hata verir", () => {
    const raw = exampleFile() as unknown as Record<string, unknown>;
    const revision = raw.revision as Record<string, Record<string, unknown>>;
    const specs = revision.inputs.specs as Record<string, unknown>;
    specs.mainCapacityT = "20 ton";

    expect(() => parseOfferReportTransferText(JSON.stringify(raw))).toThrowError(
      /revision\.inputs\.specs\.mainCapacityT alanı sayı olmalı/
    );
  });

  it("yanlış formatı ve tehlikeli JSON anahtarlarını reddeder", () => {
    const wrong = exampleFile() as unknown as Record<string, unknown>;
    wrong.format = "baska-format";
    expect(() => parseOfferReportTransferText(JSON.stringify(wrong))).toThrow(
      OfferReportTransferError
    );

    const unsafe = stringifyOfferReportTransferFile(exampleFile()).replace(
      '"reviewNotes": []',
      '"reviewNotes": [], "__proto__": { "admin": true }'
    );
    expect(() => parseOfferReportTransferText(unsafe)).toThrow(/kullanılamayan anahtar/);
  });

  it("dosyadan hesap sonucu kabul etmez", () => {
    const raw = exampleFile() as unknown as Record<string, unknown>;
    const revision = raw.revision as Record<string, unknown>;
    revision.results = { allPass: true };

    expect(() => parseOfferReportTransferText(JSON.stringify(raw))).toThrow(
      /revision:[\s\S]*Unrecognized key/
    );
  });

  it("dışa aktarılan gerçek şablon Server Action sınırına sığar", () => {
    const text = stringifyOfferReportTransferFile(exampleFile());
    expect(new TextEncoder().encode(text).byteLength).toBeLessThan(
      OFFER_REPORT_TRANSFER_MAX_BYTES
    );
  });
});

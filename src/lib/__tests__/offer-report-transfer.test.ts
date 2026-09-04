import { describe, expect, it } from "vitest";
import {
  LEGACY_SPEC_KEYS,
  OFFER_REPORT_TRANSFER_MAX_BYTES,
  OFFER_REPORT_TRANSFER_VERSION,
  OfferReportTransferError,
  buildOfferReportTransferFile,
  countJsonNodes,
  parseOfferReportTransferText,
  stringifyOfferReportTransferFile,
  type OfferReportTransferFieldGuide,
} from "@/lib/offer-report-transfer";
import {
  GROUND_CRANE_DISABLED_MODULES,
  GROUND_CRANE_TYPE,
  SINGLE_GIRDER_CRANE_TYPE,
} from "@/lib/crane-types";

const END_CUSTOMER_ID = "0f1b6a4e-2c3d-4e5f-8a9b-0c1d2e3f4a5b";

function exampleFile() {
  return buildOfferReportTransferFile({
    project: {
      documentNo: "6300001264",
      name: "VİNÇ, GEZER KÖPRÜLÜ, ÇİFT KİRİŞ, 20 TON",
      customer: "KARDEMİR",
      craneType: "Çift Kirişli Gezer Köprülü Vinç",
      craneLocation: "KARABÜK",
      endCustomer: {
        id: END_CUSTOMER_ID,
        name: "KARDEMİR A.Ş.",
        shortName: "KARDEMİR",
        address: "Karabük",
        taxOffice: "Karabük",
        taxNo: "1234567890",
        phone: "",
        fax: "",
        email: "",
        web: "kardemir.com",
      },
      reportBrand: null,
      issuer: { name: "ORION VİNÇ", shortName: "ORION", address: "Ankara" },
      signatories: { preparedBy: "Sinan Çolakoğlu", checkedBy: "Dış Kontrolör" },
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

type Raw = Record<string, unknown>;
function rawFile(): Raw {
  return exampleFile() as unknown as Raw;
}
function inputsOf(raw: Raw): Raw {
  return (raw.revision as Record<string, Raw>).inputs;
}
function selectionsOf(raw: Raw): Raw {
  return (raw.revision as Record<string, Raw>).selections;
}
function guideRow(path: string): OfferReportTransferFieldGuide | undefined {
  return exampleFile().fieldGuide.find((row) => row.path === path);
}

describe("teklif hesap raporu AI aktarım dosyası", () => {
  it("girdileri, seçimleri, proje künyesini ve Türkçe alan rehberini dışa aktarır", () => {
    const file = exampleFile();

    expect(file.formatVersion).toBe(OFFER_REPORT_TRANSFER_VERSION);
    expect(file.source).toEqual({
      documentNo: "6300001264",
      revisionNo: 0,
      engineVersion: "test-engine",
      exportedAt: "2026-08-28T08:00:00.000Z",
    });
    expect(file.project.endCustomer).toMatchObject({
      id: END_CUSTOMER_ID,
      name: "KARDEMİR A.Ş.",
      shortName: "KARDEMİR",
      web: "kardemir.com",
      fax: "",
    });
    expect(file.project.reportBrand).toBeNull();
    expect(file.project.issuer?.shortName).toBe("ORION");
    expect(file.project.signatories).toEqual({
      preparedBy: "Sinan Çolakoğlu",
      checkedBy: "Dış Kontrolör",
    });
    expect(file.revision.inputs.specs).toBeTypeOf("object");
    expect(file.revision.inputs.mainHoist).toBeTypeOf("object");
    expect(file.revision.inputs.weightBreakdown).toEqual({});
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
    expect(file.instructions.join(" ")).toContain("Auto");
  });

  it("eski teknik özellik göç anahtarlarını dosyaya yazmaz", () => {
    const specs = exampleFile().revision.inputs.specs as Record<string, unknown>;
    for (const key of LEGACY_SPEC_KEYS) expect(specs, key).not.toHaveProperty(key);
    expect(specs).toHaveProperty("mainCapacityT");
  });

  it("rehber snapshot'ta değeri olmayan alanları, otomatik anahtarları, katalog ve künye alanlarını anlatır", () => {
    // Feston serisi yeni iş şablonunda yoktur; AI yine de yazabilmelidir.
    expect(guideRow("revision.selections.trolley.festoonSeries")?.label).toBeTruthy();
    expect(guideRow("revision.inputs.specs.mono1CapacityT")).toBeDefined();
    expect(guideRow("revision.inputs.mainHoist.ropeWeightAuto")).toMatchObject({
      valueType: "boolean",
      source: "otomatik",
    });
    expect(guideRow("revision.inputs.mainHoist.ropeWeightKg")?.hint).toContain("ropeWeightAuto");
    expect(guideRow("revision.selections.trolley.motorWeightKg")).toMatchObject({
      valueType: "number",
      source: "katalog",
    });
    expect(guideRow("revision.selections.mainHoist.bearingBrand")?.hint).toContain("virgülle");
    expect(guideRow("revision.inputs.girder.psiHAOverride")).toBeDefined();
    expect(guideRow("project.endCustomer.name")?.hint).toContain("YENİ müşteri");
    expect(guideRow("project.reportBrand.name")?.hint).toContain("MEVCUT");
    expect(guideRow("project.issuer.name")).toMatchObject({ source: "bilgi" });
    expect(guideRow("project.craneType")?.options).toContain(GROUND_CRANE_TYPE);
    expect(guideRow("revision.inputs.weightBreakdown.ayakYuksekligiM")).toMatchObject({
      valueType: "number",
      unit: "m",
    });
    expect(guideRow("revision.inputs.disabledModules")?.options).not.toContain("main");
    // Snapshot'ta anlatılmamış anahtar kalmaz.
    const file = exampleFile();
    const paths = new Set(file.fieldGuide.map((row) => row.path));
    for (const [field, state] of Object.entries(file.revision.inputs)) {
      if (!state || typeof state !== "object" || Array.isArray(state)) continue;
      if (field === "weightBreakdown") continue;
      for (const key of Object.keys(state)) {
        if (field === "buckling" && (key === "side" || key === "top")) continue;
        expect(paths.has(`revision.inputs.${field}.${key}`), `revision.inputs.${field}.${key}`).toBe(true);
      }
    }
  });

  it("AI'ın değiştirdiği değerleri alır, yabancı anahtarı atar ve sonucu yeniden hesaplar", () => {
    const raw = rawFile();
    const project = raw.project as Raw;
    project.documentNo = "6300001265";
    project.name = "YENİ 20 TON VİNÇ";

    const inputs = inputsOf(raw);
    const specs = inputs.specs as Raw;
    specs.mainCapacityT = 20;
    specs.spanM = 24.5;
    inputs.aiTarafindanEklenenBilinmeyenAlan = { calistir: true };
    raw.reviewNotes = ["revision.inputs.specs.runwayLengthM şartnamede bulunamadı."];

    const parsed = parseOfferReportTransferText(JSON.stringify(raw));

    expect(parsed.project.documentNo).toBe("6300001265");
    expect(parsed.project.endCustomer?.id).toBe(END_CUSTOMER_ID);
    expect(parsed.project.signatories.checkedBy).toBe("Dış Kontrolör");
    expect(parsed.inputs.specs?.mainCapacityT).toBe(20);
    expect(parsed.inputs.specs?.spanM).toBe(24.5);
    expect(parsed.inputs).not.toHaveProperty("aiTarafindanEklenenBilinmeyenAlan");
    expect(parsed.results.engineVersion).not.toBe("");
    expect(parsed.reviewNotes).toEqual([
      "revision.inputs.specs.runwayLengthM şartnamede bulunamadı.",
    ]);
  });

  it("şablonda olmayan bilinen alanları (özellik, seçim, katalog, ezme, anahtar) düşürmez", () => {
    const raw = rawFile();
    const inputs = inputsOf(raw);
    const selections = selectionsOf(raw);
    (inputs.specs as Raw).mono1CapacityT = 5;
    (inputs.specs as Raw).auxTrolleyPowerSupply = "Feston";
    (inputs.girder as Raw).psiHAOverride = 1.12;
    (inputs.girder as Raw).psiHAAuto = false;
    (inputs.mainHoist as Raw).ropeWeightAuto = false;
    (inputs.hookBlock as Raw).shaftEdgeGapMm = 25;
    (selections.mainHoist as Raw).motorEfficiencyClass = "IE3";
    (selections.mainHoist as Raw).bearingBrand = "SKF, FAG";
    (selections.trolley as Raw).festoonSeries = "0320";
    (selections.trolley as Raw).festoonTrolleyLoadKg = 40;
    (selections.trolley as Raw).motorWeightKg = 125;
    (selections.trolley as Raw).bufferEnergyCurve = [
      [0, 0],
      [50, 1.2],
    ];
    (selections.endCarriage as Raw).hoistClassOverride = "H2";

    const parsed = parseOfferReportTransferText(JSON.stringify(raw));
    const p = parsed as unknown as { inputs: Record<string, Raw>; selections: Record<string, Raw> };

    expect(p.inputs.specs.mono1CapacityT).toBe(5);
    expect(p.inputs.specs.auxTrolleyPowerSupply).toBe("Feston");
    expect(p.inputs.girder.psiHAOverride).toBe(1.12);
    expect(p.inputs.girder.psiHAAuto).toBe(false);
    expect(p.inputs.mainHoist.ropeWeightAuto).toBe(false);
    expect(p.inputs.hookBlock.shaftEdgeGapMm).toBe(25);
    expect(p.selections.mainHoist.motorEfficiencyClass).toBe("IE3");
    expect(p.selections.mainHoist.bearingBrand).toBe("SKF, FAG");
    expect(p.selections.trolley.festoonSeries).toBe("0320");
    expect(p.selections.trolley.festoonTrolleyLoadKg).toBe(40);
    expect(p.selections.trolley.motorWeightKg).toBe(125);
    expect(p.selections.trolley.bufferEnergyCurve).toEqual([
      [0, 0],
      [50, 1.2],
    ]);
    expect(p.selections.endCarriage.hoistClassOverride).toBe("H2");
  });

  it("isteğe bağlı alan yokken uydurma bir varsayılan yazmaz", () => {
    const parsed = parseOfferReportTransferText(JSON.stringify(rawFile()));
    const p = parsed as unknown as { inputs: Record<string, Raw>; selections: Record<string, Raw> };
    expect(p.inputs.girder).not.toHaveProperty("psiHAOverride");
    expect(p.selections.trolley).not.toHaveProperty("festoonSeries");
    expect(p.selections.mainHoist).not.toHaveProperty("motorEfficiencyClass");
    expect(p.inputs).not.toHaveProperty("weightBreakdown");
  });

  it("isteğe bağlı alanda yanlış tipi yoluyla bildirir", () => {
    const raw = rawFile();
    (selectionsOf(raw).mainHoist as Raw).motorEfficiencyClass = 3;
    expect(() => parseOfferReportTransferText(JSON.stringify(raw))).toThrowError(
      /revision\.selections\.mainHoist\.motorEfficiencyClass alanı metin olmalı/
    );

    const flagged = rawFile();
    (inputsOf(flagged).mainHoist as Raw).ropeWeightAuto = "hayır";
    expect(() => parseOfferReportTransferText(JSON.stringify(flagged))).toThrowError(
      /ropeWeightAuto alanı doğru\/yanlış olmalı/
    );
  });

  it("ağırlık dökümü kararlarını taşır, izini taşımaz, bozuk satırı atlar", () => {
    const raw = rawFile();
    inputsOf(raw).weightBreakdown = {
      overrides: { "bridge.bridge.girder": 4200, bozuk: -5 },
      notes: { "bridge.bridge.girder": "İmalat ölçüsünden" },
      serbest: [
        { id: "serbest-1", bant: "bridge", grup: "bridge", ad: "Yürüyüş yolu", adet: 2, kg: 150 },
        { id: "kacak", bant: "bridge", grup: "bridge", ad: "Ön eksiz", adet: 1, kg: 1 },
      ],
      ayakYuksekligiM: 6.5,
      applied: { bridgeWeightT: { at: "2026-09-01T00:00:00.000Z", kg: 9000 } },
    };

    const parsed = parseOfferReportTransferText(JSON.stringify(raw));
    expect(parsed.inputs.weightBreakdown).toEqual({
      overrides: { "bridge.bridge.girder": 4200 },
      notes: { "bridge.bridge.girder": "İmalat ölçüsünden" },
      serbest: [
        { id: "serbest-1", bant: "bridge", grup: "bridge", ad: "Yürüyüş yolu", adet: 2, kg: 150 },
      ],
      ayakYuksekligiM: 6.5,
    });
  });

  it("dışa aktarım ağırlık dökümü izini (applied) yazmaz", () => {
    const file = buildOfferReportTransferFile({
      project: {
        documentNo: "X",
        name: "Y",
        customer: "Z",
        craneType: "Çift Kirişli Gezer Köprülü Vinç",
        craneLocation: "",
      },
      revision: {
        revNo: 1,
        engineVersion: "e",
        inputs: {
          weightBreakdown: {
            overrides: { a: 10 },
            applied: { bridgeWeightT: { at: "2026-09-01T00:00:00.000Z", kg: 9000 } },
          },
        },
        selections: null,
      },
    });
    expect(file.revision.inputs.weightBreakdown).toEqual({ overrides: { a: 10 } });
    expect(file.project.endCustomer).toBeNull();
    expect(file.project.signatories).toEqual({ preparedBy: "", checkedBy: "" });
  });

  it("proje künyesinde geçersiz kimliği atar ve boş müşteri adını son kullanıcıdan alır", () => {
    const raw = rawFile();
    const project = raw.project as Raw;
    project.customer = "";
    project.endCustomer = { id: "defter-123", name: "Yeni Sanayi A.Ş.", address: "Bursa" };
    project.reportBrand = { name: "VİGO" };

    const parsed = parseOfferReportTransferText(JSON.stringify(raw));
    expect(parsed.project.customer).toBe("Yeni Sanayi A.Ş.");
    expect(parsed.project.endCustomer).toMatchObject({ name: "Yeni Sanayi A.Ş.", address: "Bursa" });
    expect(parsed.project.endCustomer).not.toHaveProperty("id");
    expect(parsed.project.reportBrand).toMatchObject({ name: "VİGO", shortName: "" });

    const empty = rawFile();
    (empty.project as Raw).customer = "";
    (empty.project as Raw).endCustomer = null;
    expect(() => parseOfferReportTransferText(JSON.stringify(empty))).toThrowError(/Müşteri gerekli/);
  });

  it("sürüm 1 dosyasını (künyesiz) okumaya devam eder", () => {
    const raw = rawFile();
    raw.formatVersion = 1;
    const project = raw.project as Raw;
    delete project.endCustomer;
    delete project.reportBrand;
    delete project.issuer;
    delete project.signatories;
    delete inputsOf(raw).weightBreakdown;

    const parsed = parseOfferReportTransferText(JSON.stringify(raw));
    expect(parsed.project.endCustomer).toBeNull();
    expect(parsed.project.signatories).toEqual({ preparedBy: "", checkedBy: "" });
    expect(parsed.inputs.specs?.mainCapacityT).toBeTypeOf("number");
  });

  it("Yer Vinci dosyasında örnek raporun yürütme girdilerini hesaba sokmaz", () => {
    const raw = rawFile();
    (raw.project as Raw).craneType = GROUND_CRANE_TYPE;

    // AI yalnız tipi değiştirmiş, örnek gezer köprülü vincin diğer snapshot'ını
    // olduğu gibi bırakmış olsun. İçe aktarım V0 topolojisini sonuçtan önce
    // zorunlu olarak sabit düzene çevirir.
    const parsed = parseOfferReportTransferText(JSON.stringify(raw));
    expect(parsed.inputs.specs?.travelArrangement).toBe("fixed");
    expect(parsed.results.trolley).toBeUndefined();
    expect(parsed.results.bridge).toBeUndefined();
    for (const key of GROUND_CRANE_DISABLED_MODULES) {
      expect(parsed.inputs.disabledModules, key).toContain(key);
    }
  });

  it("tek kirişli dosyada V0 yük paylaşımı sonucunu yeniden hesaplar", () => {
    const raw = rawFile();
    (raw.project as Raw).craneType = SINGLE_GIRDER_CRANE_TYPE;

    // Örnek snapshot çift kirişlidir; tip V0 doğarken teknik kararı tek
    // kirişliye çevirir ve DB'ye girecek sonuç güncel motorla yeniden kurulur.
    const parsed = parseOfferReportTransferText(JSON.stringify(raw));
    expect(parsed.inputs.specs?.girderArrangement).toBe("tek");
    expect(parsed.results.girder?.cells["load.liveLoadGirderCount"]).toBe(1);
    expect(parsed.results.girder?.cells["load.hoistLoadOnGirder"]).toBe(
      parsed.results.girder?.cells["load.hoistLoad"]
    );
  });

  it("sayı alanına birimli metin yazılırsa yolu gösteren hata verir", () => {
    const raw = rawFile();
    (inputsOf(raw).specs as Raw).mainCapacityT = "20 ton";

    expect(() => parseOfferReportTransferText(JSON.stringify(raw))).toThrowError(
      /revision\.inputs\.specs\.mainCapacityT alanı sayı olmalı/
    );
  });

  it("yanlış formatı ve tehlikeli JSON anahtarlarını reddeder", () => {
    const wrong = rawFile();
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
    const raw = rawFile();
    (raw.revision as Raw).results = { allPass: true };

    expect(() => parseOfferReportTransferText(JSON.stringify(raw))).toThrow(
      /revision:[\s\S]*Unrecognized key/
    );
  });

  it("dışa aktarılan gerçek şablon boyut ve düğüm sınırlarına payla sığar", () => {
    const file = exampleFile();
    const text = stringifyOfferReportTransferFile(file);
    expect(new TextEncoder().encode(text).byteLength).toBeLessThan(
      OFFER_REPORT_TRANSFER_MAX_BYTES * 0.8
    );
    // İçe aktarımın düğüm sınırı 250 000; dosya yarısını geçmemeli.
    expect(countJsonNodes(file)).toBeLessThan(125_000);
  });
});

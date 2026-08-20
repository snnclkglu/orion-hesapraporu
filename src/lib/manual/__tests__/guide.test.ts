import { describe, expect, it } from "vitest";
import { manualPublishReadiness } from "../guide";
import { manualFromTemplate } from "../payload";
import type { ManualSection } from "../types";

function payloadWith(sections: ManualSection[]) {
  const payload = manualFromTemplate({
    manufacturer: "ORION CRANES",
    product: "Şarj Vinci",
    craneType: "Gezer Köprü Vinci",
    customer: "Örnek Müşteri",
  });
  payload.docTitle = "Mühendislik İşletme ve Bakım El Kitabı";
  payload.coverTitle = "Şarj Vinci";
  payload.sections = sections;
  return payload;
}

describe("manualPublishReadiness", () => {
  it("görünür vince özel boş bloğu bildirir", () => {
    const payload = payloadWith([
      {
        id: "kabin",
        title: "Operatör Kabini",
        blocks: [{ id: "b1", kind: "text", text: "", fromTemplate: true }],
        children: [],
      },
    ]);

    expect(manualPublishReadiness(payload)).toEqual({
      missingIdentity: [],
      missingSections: [{ id: "kabin", title: "Operatör Kabini" }],
    });
  });

  it("gizlenen üst bölümün alt ağacını eksik saymaz", () => {
    const payload = payloadWith([
      {
        id: "kullanim",
        title: "Kullanım",
        hidden: true,
        blocks: [],
        children: [
          {
            id: "kabin",
            title: "Operatör Kabini",
            blocks: [{ id: "b1", kind: "text", text: "", fromTemplate: true }],
            children: [],
          },
        ],
      },
    ]);

    expect(manualPublishReadiness(payload).missingSections).toEqual([]);
  });

  it("zorunlu kapak künyesini ortak kuralla doğrular", () => {
    const payload = payloadWith([]);
    payload.identity.customer = "";
    payload.coverTitle = "";

    expect(manualPublishReadiness(payload).missingIdentity).toEqual([
      "Kapak başlığı",
      "Müşteri",
    ]);
  });
});

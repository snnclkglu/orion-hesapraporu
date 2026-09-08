import { describe, expect, it } from "vitest";
import { emptyPayload } from "../payload";
import { offerPayloadForAgent, preserveAgentProtectedOfferFields } from "../agent";

describe("agent teklif payload güvenlik sınırı", () => {
  it("özel imza yolu ve profil kimliğini okuma yanıtından çıkarır", () => {
    const payload = emptyPayload();
    payload.cover.signatories = [
      {
        userId: "11111111-1111-4111-8111-111111111111",
        name: "AYŞE YILMAZ",
        title: "MÜDÜR",
        signaturePath: "private/signatures/ayse.png",
        signatureName: "imza.png",
      },
    ];

    expect(offerPayloadForAgent(payload).cover.signatories).toEqual([
      { name: "AYŞE YILMAZ", title: "MÜDÜR" },
    ]);
  });

  it("PUT gövdesindeki imza müdahalesini yok sayıp sunucu değerini korur", () => {
    const current = emptyPayload();
    current.cover.signatories = [
      {
        userId: "11111111-1111-4111-8111-111111111111",
        name: "AYŞE YILMAZ",
        title: "MÜDÜR",
        signaturePath: "private/signatures/ayse.png",
        signatureName: "imza.png",
      },
    ];
    const submitted = emptyPayload();
    submitted.cover.signatories = [
      { name: "SALDIRGAN", title: "", signaturePath: "private/other.png" },
    ];

    expect(preserveAgentProtectedOfferFields(submitted, current).cover.signatories).toEqual(
      current.cover.signatories
    );
  });
});

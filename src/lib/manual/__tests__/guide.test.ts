import { describe, expect, it } from "vitest";
import { MANUAL_SECTION_GUIDE, manualPublishReadiness } from "../guide";
import { MANUAL_TEMPLATE, type TemplateSection } from "../template";
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

// KARŞILIKSIZ ANAHTAR HATA VERMEZ, SESSİZCE HİÇ GÖRÜNMEZ. Rehber notu
// `section.key` ile aranır; anahtar yanlış yazıldığında ya da şablonda bölüm
// yeniden adlandırıldığında not okunmaz ve kimse fark etmez. Üç not tam
// olarak bu yüzden aylarca görünmedi (`guvenlik.guvenlikEkipmanlari`,
// `kullanim.sematik`, `kullanim.halatlar.telHalat.hasar`). Bir kural iki
// yerde yaşıyorsa ayrışmayı bir test KAYNAK DOSYAYI okuyarak engeller
// (değişmez md. 8).
describe("MANUAL_SECTION_GUIDE", () => {
  it("her elle yazılan not şablonda VAR OLAN bir bölüme bağlıdır", () => {
    const anahtarlar = new Set<string>();
    const gez = (liste: readonly TemplateSection[]) => {
      for (const s of liste) {
        anahtarlar.add(s.key);
        if (s.children) gez(s.children);
      }
    };
    gez(MANUAL_TEMPLATE);

    const kopuk = Object.keys(MANUAL_SECTION_GUIDE).filter(
      (k) => !anahtarlar.has(k)
    );
    expect(kopuk).toEqual([]);
  });
});

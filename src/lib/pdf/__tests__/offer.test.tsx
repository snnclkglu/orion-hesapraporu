// TEKLİF PDF'İNİN KORUMA TESTLERİ.
//
// Belgenin METNİ okunur, bileşen ağacı DEĞİL (`job-list.test.tsx` deseni):
// bir satırın React ağacından düşmüş olması, basılan kâğıtta da olmadığını
// göstermez — arada `printedPayload`, sayfa bölme ve font yerleştirme vardır.
// Ham baytları taramak da yanıltıcıdır (içerik akışları sıkıştırılmıştır);
// metin `unpdf` ile çözülür — kullanıcının belgede göreceği neyse o.
//
// EN ÖNEMLİ MADDE GİZLEMEDİR: gizlenen satır müşteriye giden belgede boşluk,
// tire ya da iz BIRAKMAZ. İkinci madde TOPLAMDIR: `inTotal: false` satırın
// tutarı belgede yazar ama toplama girmez.

import { describe, expect, it } from "vitest";
import { OfferDocument, renderOfferPdf, type OfferDocumentProps } from "../offer";
import { offerFileName } from "../doc-naming";
import { emptyPayload, groupFromKey, newOfferId } from "@/lib/offers/payload";
import { offerTotal } from "@/lib/offers/pricing";
import { fmtMoney } from "@/lib/currency";
import type { OfferPayload, OfferPriceLine } from "@/lib/offers/types";

const COMPANY = {
  company: "ORION CRANES",
  address: "Başkent OSB 1. Cadde No:20, Ankara",
  web: "orioncranes.com",
};

/** Gizlenen her şeye konan damga — belgede hiç geçmemesi gerekir. */
const GIZLI = "GIZLIDAMGA";

function fiyat(p: Partial<OfferPriceLine> & { description: string }): OfferPriceLine {
  return {
    id: newOfferId(),
    itemId: null,
    qty: 1,
    unit: "Takım",
    unitPrice: null,
    inTotal: true,
    ...p,
  };
}

/**
 * Tek vinçli gerçek ölçekli bir teklif: 4 takım × 55.900 € = 223.600 €.
 * Sayılar bilerek büyüktür — küçük tutarlarda sütun taşması hiç görülmez.
 */
function fikstur(over: { vatIncluded?: boolean } = {}): OfferDocumentProps {
  const p: OfferPayload = emptyPayload("EUR");
  p.cover = {
    fromName: "SİNAN ÇOLAKOĞLU",
    fromTitle: "Satış Müdürü",
    fromEmail: "sinan@orioncranes.com",
    toName: "ALİCAN ERASLAN",
    toDept: "",
    toPhone: "+90 216 453 67 51",
    customerRef: "6000294866",
    greeting: "Sn. Alican ERASLAN Bey,",
    intro: "Talep etmiş olduğunuz iş için teknik ve ticari teklifimizi dikkatinize sunarız.",
    signatories: [{ name: "SİNAN ÇOLAKOĞLU", title: "Satış Müdürü" }],
  };

  const kaldirma = groupFromKey("mainHoist");
  for (const row of kaldirma.rows) {
    if (row.key === "motor") row.value = "GAMAK 22 kW 1500 d/dak, Encoderli";
    if (row.key === "reeving") row.value = "4/1";
    // GİZLENEN SATIR: değeri dolu ama `hidden` — belgeye girmemeli.
    if (row.key === "hook") {
      row.value = `${GIZLI} DIN 15401/P Kanca`;
      row.hidden = true;
    }
  }
  // GİZLENEN GRUP: başlığıyla birlikte düşmeli.
  const arabaGrubu = groupFromKey("trolley");
  arabaGrubu.title = `${GIZLI} VİNÇ ARABASI`;
  arabaGrubu.hidden = true;
  for (const row of arabaGrubu.rows) row.value = "Frekans İnvertörlü";

  p.items = [
    {
      id: newOfferId(),
      title: "20T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ",
      capacityT: 20,
      spanM: 22.5,
      groups: [kaldirma, arabaGrubu],
    },
  ];

  for (const row of p.testLoad.rows) {
    if (row.key === "dynamic") row.value = "Q x 1,1";
    if (row.key === "static") row.value = "Q x 1,25";
  }
  for (const row of p.terms.rows) {
    if (row.key === "validity") row.value = "14 iş günü";
    if (row.key === "deliveryTime") row.value = "Avans Ödemesi Sonrası 10-12 Hafta";
    if (row.key === "payment") row.value = "Ödeme şekli aşağıda belirtilen şekildedir.";
  }
  p.terms.paymentLines = [
    { id: newOfferId(), text: "%40 Avans Sipariş ile Nakit" },
    { id: newOfferId(), text: `${GIZLI} %10 Gizli Kalem`, hidden: true },
  ];

  p.pricing.vatIncluded = over.vatIncluded ?? false;
  p.pricing.lines = [
    fiyat({
      description: "20 Ton x 22,5 m Çift Kirişli Gezer Köprülü Vinç",
      qty: 4,
      unit: "Takım",
      unitPrice: 55900,
    }),
    // TOPLAMA GİRMEYEN satır: tutarı belgede yazar, TOPLAM'a eklenmez.
    fiyat({ description: "Montaj Süpervizör Hizmeti", qty: 1, unit: "Kişi", unitPrice: 400, inTotal: false }),
    // GİZLENEN fiyat satırı.
    fiyat({ description: `${GIZLI} Yedek Parça`, qty: 1, unit: "Takım", unitPrice: 999999, hidden: true }),
  ];

  p.notes = [
    { id: newOfferId(), text: "Teslim sonrası imalat projeleri dwg. formatında paylaşılacaktır." },
    { id: newOfferId(), text: `${GIZLI} gizli not`, hidden: true },
  ];
  p.exclusions = [{ id: newOfferId(), text: "Vincin montaj sahasında gerekli olan tüm inşaat işleri" }];

  return {
    offer: {
      offerNo: "TETR-20260127-1",
      revNo: 2,
      issueDate: "2026-01-27",
      subject: "HABAŞ DÖRTYOL 20T VİNÇ",
      customerName: "HABAŞ SINAİ VE TIBBİ GAZLAR A.Ş.",
      currency: "EUR",
    },
    payload: p,
    company: COMPANY,
    meta: { generatedAt: "17.08.2026" },
  };
}

/**
 * Belgenin GERÇEKTEN OKUNAN metni. `duz` boşlukları siler: PDF metin katmanı
 * sözcük aralarını konumla verir ve "223.600 €" çözüldüğünde araya fazladan
 * boşluk girebilir — aranan şey rakamın kendisidir, dizgi değil.
 */
async function pdfMetni(props: OfferDocumentProps): Promise<string> {
  const buf = await renderOfferPdf(props);
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(doc, { mergePages: true });
  return Array.isArray(text) ? text.join(" ") : text;
}

const duz = (s: string) => s.replace(/\s+/g, "");

describe("gizleme", () => {
  it("gizlenen satır, grup, ödeme kalemi, fiyat satırı ve not belgede HİÇ geçmez", async () => {
    const metin = await pdfMetni(fikstur());
    expect(metin.includes(GIZLI)).toBe(false);
  });

  it("bütünüyle gizlenen grup BAŞLIĞIYLA birlikte düşer", async () => {
    // Başlık kalsaydı müşteri boş bir "VİNÇ ARABASI :" görür ve orada bir
    // şeyin eksildiğini okurdu — gizleme iz bırakmamalıdır.
    const metin = await pdfMetni(fikstur());
    expect(metin.includes("VİNÇ ARABASI")).toBe(false);
    expect(duz(metin).includes(duz("999.999"))).toBe(false);
  });

  it("değeri girilmemiş ticari satır (Garanti) çizilmez — yer tutucu bir değer değildir", async () => {
    const metin = await pdfMetni(fikstur());
    expect(metin.includes("Garanti")).toBe(false);
  });
});

describe("toplam", () => {
  it("toplama girmeyen satırın tutarı TOPLAM'a girmez", async () => {
    const props = fikstur();
    const toplam = offerTotal(props.payload.pricing.lines);
    // 4 × 55.900 = 223.600; süpervizörlük (400) ve gizli satır (999.999) yok.
    expect(toplam).toBe(223600);

    const metin = duz(await pdfMetni(props));
    expect(metin.includes(duz(fmtMoney(223600, "EUR")))).toBe(true);
    // Satırın kendisi belgede DURUR (bilgi silinmez), yalnız toplama girmez.
    expect(metin.includes(duz("Montaj Süpervizör Hizmeti"))).toBe(true);
    expect(metin.includes(duz("* Toplam fiyata dahil değildir."))).toBe(true);
    // Toplam, süpervizörlük eklenmiş hâli (224.000) OLAMAZ.
    expect(metin.includes(duz(fmtMoney(224000, "EUR")))).toBe(false);
  });
});

describe("belge kimliği", () => {
  it("teklif numarası ve revizyon etiketi belgede geçer", async () => {
    const metin = await pdfMetni(fikstur());
    expect(metin.includes("TETR-20260127-1")).toBe(true);
    expect(metin.includes("REV 02")).toBe(true);
  });

  it("dosya adı: İŞ ADI - TEKLİF NO - REV; R0'da revizyon parçası düşer", () => {
    expect(offerFileName("Habaş Dörtyol 20t Vinç", "TETR-20260127-1", 2)).toBe(
      "HABAŞ DÖRTYOL 20T VİNÇ - TETR-20260127-1 - REV 02.pdf"
    );
    expect(offerFileName("Habaş Dörtyol 20t Vinç", "TETR-20260127-1", 0)).toBe(
      "HABAŞ DÖRTYOL 20T VİNÇ - TETR-20260127-1.pdf"
    );
  });
});

describe("KDV cümlesi", () => {
  it("tek bayraktan türer — iki çelişen cümle aynı belgede duramaz", async () => {
    const haric = await pdfMetni(fikstur({ vatIncluded: false }));
    expect(haric.includes("KDV dahil değildir")).toBe(true);
    expect(haric.includes("KDV dahildir")).toBe(false);

    const dahil = await pdfMetni(fikstur({ vatIncluded: true }));
    expect(dahil.includes("KDV dahildir")).toBe(true);
    expect(dahil.includes("KDV dahil değildir")).toBe(false);
  });
});

describe("belge", () => {
  it("bileşen doğrudan çağrılabilir — şablon saf kalır", () => {
    expect(OfferDocument(fikstur())).toBeTruthy();
  });

  it("boş teklifte de belge üretilir (çöküş yok)", async () => {
    const props = fikstur();
    props.payload = emptyPayload("EUR");
    const buf = await renderOfferPdf(props);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

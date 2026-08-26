// TEKLİF ÇEKİRDEĞİNİN KORUMA TESTLERİ.
//
// Sınanan şey biçim değil KURALDIR: gizlenen satırın belgeye girmemesi, elle
// yazılan değerin ezilmemesi, toplamın satırlarla tutması ve kopyalanan
// teklifte muhatap bilgilerinin kalmaması. Dördü de sessizce bozulabilecek
// ve ancak müşteri fark ettiğinde anlaşılabilecek hatalardır.

import { describe, expect, it } from "vitest";
import { composeValue, derivedParts, rowValue, withComposedValue } from "../compose";
import { copyItemInPayload, copyPayloadForCustomer } from "../copy";
import { firstMulti, isMultiValueList, joinMulti, splitMulti } from "../multi";
import { parentOption } from "../options";
import { offerIssuerName } from "../issuer";
import {
  composeItemTitle,
  defaultFreeItemTitle,
  defaultItemTitle,
  isDefaultItemTitle,
  kalemBasligiBuyuk,
  withAutoTitle,
} from "../title";
import {
  CAPACITY_BANDS,
  EMPTY_OFFER_FILTER,
  matchesOfferFilters,
  offerFacets,
  sortOffers,
  type OfferListRow,
} from "../filter";
import { nextSeq, offerDocLine, offerNo, offerRevLabel, parseOfferNo } from "../no";
import {
  applyDefaults,
  copySelections,
  emptyItem,
  emptyPayload,
  FREE_GROUP_TITLE,
  freeItem,
  greetingFor,
  groupFromKey,
  hiddenCount,
  newPriceLine,
  printedPayload,
  setTrolleyCount,
  trolleyCount,
  withCraneType,
  withDefaults,
  withGroup,
  withOfferSectionHidden,
} from "../payload";
import {
  applyDiscountToLines,
  discountAmount,
  discountedLines,
  discountPercent,
  discountTotalFromPercent,
  effectiveTotal,
  lineAmount,
  offerTotal,
  paymentLineText,
  paymentPercentTotal,
  priceLineNumbers,
  vatNote,
  withValidPriceLineParents,
  withTotal,
} from "../pricing";
import {
  AUX_HOIST_GROUP_KEY,
  OFFER_GROUP_DEFS,
  TERMS_GROUP_KEY,
  TERM_ROW_DEFS,
  TEST_LOAD_GROUP_KEY,
  TEST_LOAD_ROW_DEFS,
  TROLLEY_1_TITLE,
  TROLLEY_2_TITLE,
  TROLLEY_TITLE,
  allOfferListKeys,
  itemFactsFromRows,
  offerRowDef,
} from "../registry";
import {
  offerScopeSuffix,
  type OfferPartDef,
  type OfferPayload,
  type OfferPriceLine,
  type OfferPricing,
} from "../types";

// ————————————————————————————————————————————————————————— derleme

describe("composeValue", () => {
  const motor: OfferPartDef[] = [
    { key: "brand", label: "Marka" },
    { key: "count", label: "Adet", suffix: " x" },
    { key: "power", label: "Güç", suffix: " kW" },
    { key: "rpm", label: "Devir", suffix: " d/dak" },
    { key: "options", label: "Ek", comma: true },
  ];

  it("devralınan teklifteki motor satırını birebir üretir", () => {
    expect(
      composeValue(motor, {
        brand: "GAMAK",
        power: "22",
        rpm: "1500",
        options: "Encoderli, F/S3, IP55, IE3",
      })
    ).toBe("GAMAK 22 kW 1500 d/dak, Encoderli, F/S3, IP55, IE3");
  });

  it("çift motorlu yürütmede adet öne geçer", () => {
    expect(composeValue(motor, { brand: "GAMAK", count: "2", power: "5.5", rpm: "1500" })).toBe(
      "GAMAK 2 x 5.5 kW 1500 d/dak"
    );
  });

  it("boş parça ayıracıyla birlikte düşer — baştaki boşluk oluşmaz", () => {
    expect(composeValue(motor, { power: "22", rpm: "1500" })).toBe("22 kW 1500 d/dak");
  });

  it("yalnız kuyruk doluysa değer virgülle BAŞLAMAZ", () => {
    expect(composeValue(motor, { options: "Encoderli" })).toBe("Encoderli");
  });

  it("redüktörde emniyet katsayısı virgülle eklenir", () => {
    const def = offerRowDef("mainHoist", "gearbox");
    expect(def).toBeDefined();
    expect(
      composeValue(def!.parts!, { brand: "YILMAZ R.", series: "HT Sandık Tipi", safety: "1.4" })
    ).toBe("YILMAZ R. HT Sandık Tipi, Emniyet: 1.4");
  });

  it("tekerlek ve halat satırları belgedeki yazımı verir", () => {
    const teker = offerRowDef("bridge", "wheel")!;
    expect(
      composeValue(teker.parts!, {
        count: "4",
        dia: "400",
        standard: "DIN15090",
        material: "C4140 35-42 HRC",
      })
    ).toBe("4 x Ø400 DIN15090 C4140 35-42 HRC");

    const halat = offerRowDef("mainHoist", "rope")!;
    expect(
      composeValue(halat.parts!, {
        dia: "20",
        construction: "6x36",
        grade: "1960 N/mm2",
        core: "Kendir Özlü",
      })
    ).toBe("Ø20 6x36 Halat 1960 N/mm2 Kendir Özlü");
  });
});

describe("elle yazılan değer", () => {
  const def = offerRowDef("mainHoist", "motor")!;

  it("parçalar dolu olsa da ezilmez", () => {
    const row = withComposedValue(
      { key: "motor", label: "Motor", value: "MEVCUT MOTOR KULLANILACAK", manual: true, parts: { brand: "GAMAK" } },
      def
    );
    expect(row.value).toBe("MEVCUT MOTOR KULLANILACAK");
  });

  it("elle kipi kapalıyken parçalardan yeniden derlenir", () => {
    expect(rowValue({ key: "motor", label: "Motor", value: "eski", parts: { brand: "ABB" } }, def)).toBe("ABB");
  });
});

// ————————————————————————————————————————————————————————— gizleme

describe("gizleme belgede iz bırakmaz", () => {
  function ornek() {
    const p = emptyPayload();
    const item = emptyItem("20T VİNÇ", ["mainHoist", "electrical"]);
    const [kaldirma, elektrik] = item.groups;
    kaldirma.rows.find((r) => r.key === "motor")!.value = "GAMAK 22 kW";
    kaldirma.rows.find((r) => r.key === "drive")!.value = "SCHNEIDER";
    elektrik.rows.find((r) => r.key === "panel")!.value = "EAE / TEMPA";
    p.items = [item];
    return { p, item, kaldirma, elektrik };
  }

  it("gizlenen satır basılmaz", () => {
    const { p, kaldirma } = ornek();
    kaldirma.rows.find((r) => r.key === "drive")!.hidden = true;
    const basilan = printedPayload(p);
    const keys = basilan.items[0].groups[0].rows.map((r) => r.key);
    expect(keys).toContain("motor");
    expect(keys).not.toContain("drive");
  });

  it("bütün satırları gizlenen grup BAŞLIĞIYLA birlikte düşer", () => {
    const { p, elektrik } = ornek();
    elektrik.rows.find((r) => r.key === "panel")!.hidden = true;
    const basilan = printedPayload(p);
    expect(basilan.items[0].groups.map((g) => g.key)).toEqual(["mainHoist"]);
  });

  it("değeri olmayan satır basılmaz — boş bir «Motor :» satırı çıkmaz", () => {
    const { p } = ornek();
    const basilan = printedPayload(p);
    for (const g of basilan.items[0].groups) {
      for (const r of g.rows) expect(r.value.trim()).not.toBe("");
    }
  });

  it("gizlenen kalem belgeden tamamen düşer", () => {
    const { p, item } = ornek();
    item.hidden = true;
    expect(printedPayload(p).items).toHaveLength(0);
  });

  it("gizleme SESSİZ DEĞİLDİR — sayaç editöre kaç satırın gizlendiğini söyler", () => {
    const { p, kaldirma } = ornek();
    kaldirma.rows.find((r) => r.key === "drive")!.hidden = true;
    kaldirma.hidden = true;
    expect(hiddenCount(p)).toBe(2);
  });

  it("gizlenen satırın VERİSİ korunur — belgeden düşmek silinmek değildir", () => {
    const { p, kaldirma } = ornek();
    const drive = kaldirma.rows.find((r) => r.key === "drive")!;
    drive.hidden = true;
    printedPayload(p);
    expect(drive.value).toBe("SCHNEIDER");
  });

  it("gizlenen teklif bölümü PDF payload'ından bütünüyle düşer, verisi korunur", () => {
    let p = emptyPayload();
    p.terms.rows[0].value = "14 iş günü";
    p.terms.paymentLines = [{ id: "pay", text: "%40 avans" }];
    p.pricing.lines = [{ ...newPriceLine(), description: "Vinç", unitPrice: 100 }];
    p.notes = [{ id: "note", text: "Not" }];
    p.exclusions = [{ id: "out", text: "Hariç" }];
    for (const key of ["terms", "pricing", "notes", "exclusions", "generalTerms"] as const) {
      p = withOfferSectionHidden(p, key, true);
    }

    const basilan = printedPayload(p);
    expect(basilan.terms.rows).toEqual([]);
    expect(basilan.terms.paymentLines).toEqual([]);
    expect(basilan.pricing.lines).toEqual([]);
    expect(basilan.notes).toEqual([]);
    expect(basilan.exclusions).toEqual([]);
    expect(basilan.generalTerms).toEqual([]);
    expect(p.pricing.lines[0].description).toBe("Vinç");
    expect(hiddenCount(p)).toBe(5);
  });
});

// ————————————————————————————————————————————————————————— fiyat

describe("fiyat toplamı", () => {
  it("satırlarla tutar", () => {
    const a = { ...newPriceLine(), qty: 4, unitPrice: 55_900 };
    expect(lineAmount(a)).toBe(223_600);
    expect(offerTotal([a])).toBe(223_600);
  });

  it("TOPLAMA GİRMEYEN satır toplamı bozmaz", () => {
    const vinc = { ...newPriceLine(), qty: 1, unitPrice: 100_000 };
    const supervizor = { ...newPriceLine(), qty: 1, unitPrice: 400, inTotal: false };
    expect(offerTotal([vinc, supervizor])).toBe(100_000);
  });

  it("gizlenen fiyat satırı toplama girmez", () => {
    const a = { ...newPriceLine(), qty: 1, unitPrice: 1000 };
    const b = { ...newPriceLine(), qty: 1, unitPrice: 500, hidden: true };
    expect(offerTotal([a, b])).toBe(1000);
  });

  it("fiyatı girilmemiş teklif SIFIR değil BOŞtur", () => {
    expect(offerTotal([newPriceLine()])).toBeNull();
    expect(withTotal({ currency: "EUR", vatIncluded: false, lines: [], total: null }).total).toBeNull();
  });

  it("KDV cümlesi TEK bayraktan türer — çelişki imkânsızdır", () => {
    expect(vatNote(false)).toBe("Belirtilen fiyatlara KDV dahil değildir.");
    expect(vatNote(true)).toBe("Belirtilen fiyatlara KDV dahildir.");
  });
});

describe("fiyat satırı hiyerarşisi", () => {
  it("ana satırları ve seçilmiş alt satırları 1 / 1.1 / 1.2 / 2 numaralar", () => {
    const vinc = { ...newPriceLine(), description: "VİNÇ" };
    const yol = { ...newPriceLine(), description: "YÜRÜME YOLU", parentLineId: vinc.id };
    const bara = { ...newPriceLine(), description: "BARA", parentLineId: vinc.id };
    const ikinci = { ...newPriceLine(), description: "İKİNCİ VİNÇ" };
    expect(priceLineNumbers([vinc, yol, bara, ikinci]).map((n) => n.label)).toEqual([
      "1",
      "1.1",
      "1.2",
      "2",
    ]);
  });

  it("alt satır olan ebeveyne bağı ana satıra yükseltir", () => {
    const a = newPriceLine();
    const alt = { ...newPriceLine(), parentLineId: a.id };
    const bozuk = { ...newPriceLine(), parentLineId: alt.id };
    const normalize = withValidPriceLineParents([a, alt, bozuk]);
    expect(priceLineNumbers(normalize).map((n) => n.label)).toEqual(["1", "1.1", "2"]);
    expect(normalize[2].parentLineId).toBeNull();
  });
});

// ————————————————————————————————————————————————————————— iskonto

describe("iskontolu toplam", () => {
  function fiyat(lines: OfferPriceLine[], discountTotal: number | null = null): OfferPricing {
    return { currency: "EUR", vatIncluded: false, lines, discountTotal, total: null };
  }

  it("TAKİP EDİLEN TUTAR müşterinin ödeyeceğidir", () => {
    const p = fiyat([{ ...newPriceLine(), qty: 1, unitPrice: 100_000 }], 92_000);
    expect(offerTotal(p.lines)).toBe(100_000);
    expect(effectiveTotal(p)).toBe(92_000);
    // `total_amount` üretilmiş sütunu bunu okur: liste ekranındaki rakam da
    // müşterinin ödeyeceği rakam olur.
    expect(withTotal(p).total).toBe(92_000);
  });

  it("iskonto YOKSA toplam satırların toplamıdır", () => {
    const p = fiyat([{ ...newPriceLine(), qty: 2, unitPrice: 1_000 }]);
    expect(effectiveTotal(p)).toBe(2_000);
    expect(discountAmount(p)).toBeNull();
    expect(discountPercent(p)).toBeNull();
  });

  it("oran TUTARDAN türetilir, ayrıca saklanmaz", () => {
    const p = fiyat([{ ...newPriceLine(), qty: 1, unitPrice: 200_000 }], 180_000);
    expect(discountAmount(p)).toBe(20_000);
    expect(discountPercent(p)).toBeCloseTo(10, 6);
  });

  it("BİRİM FİYATLARA YANSITMA toplamı BİREBİR tutar ve fiyatları yuvarlar", () => {
    const lines = [
      { ...newPriceLine(), qty: 2, unitPrice: 55_900 },
      { ...newPriceLine(), qty: 1, unitPrice: 12_345 },
      { ...newPriceLine(), qty: 3, unitPrice: 777 },
    ];
    const hedef = 115_000;
    const yeni = applyDiscountToLines(lines, hedef);
    expect(offerTotal(yeni)).toBeCloseTo(hedef, 2);
    // Artık EN BÜYÜK satıra bindirilir; küçük satırlar TAM SAYI kalır.
    expect(Number.isInteger(yeni[1].unitPrice)).toBe(true);
    expect(Number.isInteger(yeni[2].unitPrice)).toBe(true);
  });

  it("TOPLAMA GİRMEYEN ve GİZLİ satır ölçeklenmez", () => {
    const vinc = { ...newPriceLine(), qty: 1, unitPrice: 100_000 };
    const supervizor = { ...newPriceLine(), qty: 1, unitPrice: 400, inTotal: false };
    const gizli = { ...newPriceLine(), qty: 1, unitPrice: 5_000, hidden: true };
    const yeni = applyDiscountToLines([vinc, supervizor, gizli], 90_000);
    expect(yeni[0].unitPrice).toBe(90_000);
    expect(yeni[1].unitPrice).toBe(400);
    expect(yeni[2].unitPrice).toBe(5_000);
  });

  it("fiyatı girilmemiş satıra DOKUNULMAZ ve hesap çökmez", () => {
    const bos = newPriceLine();
    expect(applyDiscountToLines([bos], 1_000)[0].unitPrice).toBeNull();
  });

  it("eski kayıtlarda iskonto alanı YOKTUR — null gelir", () => {
    const p = withDefaults({ pricing: { lines: [], total: null } });
    expect(p.pricing.discountTotal).toBeNull();
  });

  it("SATIR BAZLI İSKONTO toplamı ve basılan birim fiyatı kendi oranıyla düşürür", () => {
    const line = { ...newPriceLine(), id: "satir", qty: 1, unitPrice: 101, discountPercent: 10 };
    const p = fiyat([line]);
    // 90,9 firma lehine yukarı yuvarlanır; oran yine açıkça %10 olarak kalır.
    expect(offerTotal(p.lines)).toBe(91);
    expect(effectiveTotal(p)).toBe(91);
    expect(discountedLines(p).get("satir")).toEqual({
      unitPrice: 91,
      amount: 91,
      discountPercent: 10,
    });
  });

  it("TOPLAM İSKONTO satır indirimlerinden SONRA uygulanır ve toplamı tutar", () => {
    const lines = [
      { ...newPriceLine(), id: "a", qty: 1, unitPrice: 100, discountPercent: 10 },
      { ...newPriceLine(), id: "b", qty: 1, unitPrice: 100 },
    ];
    const p = fiyat(lines, 171); // satırlar 190, üstüne %10 toplam iskonto
    expect(offerTotal(lines)).toBe(190);
    expect(discountPercent(p)).toBeCloseTo(10, 6);
    const map = discountedLines(p);
    expect([...map.values()].reduce((n, v) => n + v.amount, 0)).toBe(171);
    expect(map.get("a")?.discountPercent).toBe(10);
    expect(map.get("b")?.discountPercent).toBeNull();
  });

  it("taşımada satır iskonto oranı korunur, geçersiz oran temizlenir", () => {
    const valid = withDefaults({ pricing: { lines: [{ ...newPriceLine(), discountPercent: 12.5 }] } });
    const invalid = withDefaults({ pricing: { lines: [{ ...newPriceLine(), discountPercent: 100 }] } });
    expect(valid.pricing.lines[0].discountPercent).toBe(12.5);
    expect(invalid.pricing.lines[0].discountPercent).toBeNull();
  });

  // ————————————————————————————— kalem bazında iskonto (TEKLIF-65)

  it("KALEM FİYATLARININ TOPLAMI belgenin iskontolu toplamını TUTAR", () => {
    // Kullanıcının ekran görüntüsündeki teklif: 306.000 € → %15 → 260.100 €.
    // Fatura satır satır kesileceği için sütunun toplamı hedefi TUTMALIDIR;
    // tutmazsa müşteri belgedeki iki sayıdan hangisinin geçerli olduğunu
    // sormak zorunda kalır.
    const lines = [
      { ...newPriceLine(), id: "a", qty: 1, unitPrice: 262_500 },
      { ...newPriceLine(), id: "b", qty: 80, unitPrice: 225 },
      { ...newPriceLine(), id: "c", qty: 1, unitPrice: 3_000 },
      { ...newPriceLine(), id: "d", qty: 1, unitPrice: 22_500 },
    ];
    const p = fiyat(lines, 260_100);
    const harita = discountedLines(p);
    expect(harita.size).toBe(4);
    const toplam = [...harita.values()].reduce((n, v) => n + v.amount, 0);
    expect(toplam).toBeCloseTo(260_100, 2);
    // Küçük satırlar TAM SAYI birim fiyat taşır; artık en büyüğe biner.
    expect(harita.get("b")!.unitPrice).toBe(191);
    expect(harita.get("b")!.amount).toBe(15_280);
  });

  it("gösterilen kalem fiyatları BİRİM FİYATLARA YANSIT'ın yazdığı sayılardır", () => {
    // İki yol ayrışsaydı, düğmeye basmak belgedeki rakamları değiştirirdi.
    const lines = [
      { ...newPriceLine(), id: "a", qty: 2, unitPrice: 55_900 },
      { ...newPriceLine(), id: "b", qty: 1, unitPrice: 12_345 },
      { ...newPriceLine(), id: "c", qty: 3, unitPrice: 777 },
    ];
    const harita = discountedLines(fiyat(lines, 115_000));
    const yansitilan = applyDiscountToLines(lines, 115_000);
    for (const [i, l] of lines.entries()) {
      expect(harita.get(l.id)!.unitPrice).toBe(yansitilan[i].unitPrice);
    }
  });

  it("TOPLAMA GİRMEYEN, GİZLİ ve FİYATSIZ satırda üstü çizili rakam YOKTUR", () => {
    const vinc = { ...newPriceLine(), id: "a", qty: 1, unitPrice: 100_000 };
    const supervizor = { ...newPriceLine(), id: "b", qty: 1, unitPrice: 400, inTotal: false };
    const gizli = { ...newPriceLine(), id: "c", qty: 1, unitPrice: 5_000, hidden: true };
    const bos = { ...newPriceLine(), id: "d" };
    const harita = discountedLines(fiyat([vinc, supervizor, gizli, bos], 90_000));
    expect([...harita.keys()]).toEqual(["a"]);
  });

  it("İSKONTO YOKSA harita BOŞTUR — üstü çizilecek bir rakam da yoktur", () => {
    const lines = [{ ...newPriceLine(), id: "a", qty: 1, unitPrice: 100_000 }];
    expect(discountedLines(fiyat(lines)).size).toBe(0);
    // Birim fiyatlara YANSITILMIŞ teklif: satırlar zaten iskontolu, ikinci kez
    // üstlerini çizmek aynı indirimi bir daha vaat etmek olurdu.
    expect(discountedLines(fiyat(lines, 100_000)).size).toBe(0);
  });
});

// ————————————————————————————————————————————————————————— numara

describe("teklif numarası", () => {
  it("kullanıcının biçimini birebir üretir", () => {
    expect(offerNo("tr", "2026-08-17", 1)).toBe("TETR-20260817-1");
    expect(offerNo("en", "2026-08-17", 3)).toBe("TEEN-20260817-3");
  });

  it("geri okunur", () => {
    expect(parseOfferNo("TETR-20260127-1")).toEqual({ lang: "tr", isoDate: "2026-01-27", seq: 1 });
    expect(parseOfferNo("20260127-1")).toBeNull();
  });

  it("R0'ın revizyon etiketi YOKTUR", () => {
    expect(offerRevLabel(0)).toBeNull();
    expect(offerRevLabel(2)).toBe("REV 02");
    expect(offerDocLine("TETR-20260127-1", 0)).toBe("TETR-20260127-1");
    expect(offerDocLine("TETR-20260127-1", 2)).toBe("TETR-20260127-1 · REV 02");
  });

  it("sıra numarası en büyüğün bir fazlasıdır", () => {
    expect(nextSeq([])).toBe(1);
    expect(nextSeq([1, 3, 2])).toBe(4);
  });
});

// ————————————————————————————————————————————————————————— kopyalama

describe("başka müşteriye kopyalama", () => {
  function kaynak() {
    const p = emptyPayload();
    const item = emptyItem("20T VİNÇ", ["mainHoist"]);
    p.items = [item];
    p.pricing.lines = [{ ...newPriceLine(item.id), qty: 1, unitPrice: 55_900, description: "20T Vinç" }];
    p.cover.toName = "ALİCAN ERASLAN";
    p.cover.toDept = "Satın Alma Departmanı";
    p.cover.toPhone = "+90 216 453 67 51";
    p.cover.customerRef = "6000294866";
    p.cover.greeting = "Sn. Alican ERASLAN Bey,";
    return p;
  }

  it("MUHATABA ait her şey boşalır", () => {
    const yeni = copyPayloadForCustomer(kaynak(), { customerName: "ETİ BAKIR A.Ş." });
    expect(yeni.cover.toName).toBe("");
    expect(yeni.cover.toDept).toBe("");
    expect(yeni.cover.toPhone).toBe("");
    expect(yeni.cover.customerRef).toBe("");
    expect(yeni.cover.greeting).toBe("");
  });

  it("teknik içerik ve fiyat KORUNUR", () => {
    const yeni = copyPayloadForCustomer(kaynak(), { customerName: "ETİ BAKIR A.Ş." });
    expect(yeni.items).toHaveLength(1);
    expect(yeni.items[0].groups[0].rows.length).toBeGreaterThan(0);
    expect(yeni.pricing.lines[0].unitPrice).toBe(55_900);
  });

  it("kimlikler yenilenir ama fiyat–kalem BAĞI taşınır", () => {
    const kaynakP = kaynak();
    const yeni = copyPayloadForCustomer(kaynakP, { customerName: "X" });
    expect(yeni.items[0].id).not.toBe(kaynakP.items[0].id);
    expect(yeni.pricing.lines[0].id).not.toBe(kaynakP.pricing.lines[0].id);
    expect(yeni.pricing.lines[0].itemId).toBe(yeni.items[0].id);
  });

  it("fiyat alt satır bağı yeni fiyat kimliğine taşınır", () => {
    const p = kaynak();
    p.pricing.lines.push({
      ...newPriceLine(p.items[0].id),
      description: "BARA",
      parentLineId: p.pricing.lines[0].id,
    });
    const yeni = copyPayloadForCustomer(p, { customerName: "X" });
    expect(yeni.pricing.lines[1].parentLineId).toBe(yeni.pricing.lines[0].id);
    expect(yeni.pricing.lines[1].parentLineId).not.toBe(p.pricing.lines[0].id);
  });
});

describe("kalemi aynı teklife kopyalama", () => {
  function teklif() {
    const p = emptyPayload();
    const vinc = emptyItem("32T VİNÇ", ["general", "mainHoist"]);
    const kaldirma = vinc.groups[1];
    const motor = kaldirma.rows.find((r) => r.key === "motor")!;
    motor.parts = { brand: "GAMAK", power: "22" };
    motor.scope = "customer";
    kaldirma.rows.find((r) => r.key === "hook")!.hidden = true;
    p.items = [vinc, emptyItem("VİNÇ - 2", ["general"])];
    p.pricing.lines = [
      { ...newPriceLine(vinc.id), unitPrice: 55_900, description: "32T VİNÇ" },
      { ...newPriceLine(null), unitPrice: 1_500, description: "NAKLİYE" },
    ];
    return p;
  }

  function kopyala(p: OfferPayload) {
    const sonuc = copyItemInPayload(p, p.items[0].id);
    expect(sonuc).not.toBeNull();
    return sonuc!;
  }

  it("kopya KAYNAĞIN ARDINA girer, sona değil", () => {
    const p = teklif();
    const { payload, kopya } = kopyala(p);
    expect(payload.items.map((x) => x.id)).toEqual([p.items[0].id, kopya.id, p.items[1].id]);
  });

  it("HİÇBİR KİMLİK paylaşılmaz — kalem de grup da yenilenir", () => {
    const p = teklif();
    const { kopya } = kopyala(p);
    const kaynak = p.items[0];
    expect(kopya.id).not.toBe(kaynak.id);
    const kimlikler = [kopya.id, ...kopya.groups.map((g) => g.id)];
    const kaynakKimlikleri = new Set([kaynak.id, ...kaynak.groups.map((g) => g.id)]);
    expect(kimlikler.some((id) => kaynakKimlikleri.has(id))).toBe(false);
    expect(new Set(kimlikler).size).toBe(kimlikler.length);
  });

  it("satır SAYISI ve SIRASI birebir taşınır", () => {
    const p = teklif();
    const { kopya } = kopyala(p);
    expect(kopya.groups.map((g) => g.key)).toEqual(p.items[0].groups.map((g) => g.key));
    expect(kopya.groups.map((g) => g.rows.map((r) => r.key))).toEqual(
      p.items[0].groups.map((g) => g.rows.map((r) => r.key))
    );
  });

  it("GİZLİ satır gizli kalır, KAPSAM işareti taşınır", () => {
    const p = teklif();
    const { kopya } = kopyala(p);
    const kaldirma = kopya.groups[1];
    expect(kaldirma.rows.find((r) => r.key === "hook")?.hidden).toBe(true);
    expect(kaldirma.rows.find((r) => r.key === "motor")?.scope).toBe("customer");
    expect(kaldirma.rows.find((r) => r.key === "motor")?.parts?.brand).toBe("GAMAK");
  });

  it("PARÇA NESNESİ paylaşılmaz — kopyadaki düzeltme kaynağa sızmaz", () => {
    const p = teklif();
    const { kopya } = kopyala(p);
    kopya.groups[1].rows.find((r) => r.key === "motor")!.parts!.power = "30";
    expect(p.items[0].groups[1].rows.find((r) => r.key === "motor")?.parts?.power).toBe("22");
  });

  it("FİYAT SATIRI da kopyalanır ve KOPYAYA bağlanır", () => {
    const p = teklif();
    const { payload, kopya, priceLineCount } = kopyala(p);
    expect(priceLineCount).toBe(1);
    expect(payload.pricing.lines).toHaveLength(3);
    // Kaynağın satırı kaynakta kalır, kopyanınki ONUN ARDINA girer, serbest
    // satır ("NAKLİYE") sonda durmaya devam eder.
    expect(payload.pricing.lines.map((l) => l.itemId)).toEqual([p.items[0].id, kopya.id, null]);
    expect(payload.pricing.lines[1].unitPrice).toBe(55_900);
    expect(payload.pricing.lines[1].id).not.toBe(payload.pricing.lines[0].id);
  });

  it("kopyalanan fiyat satırlarının ana/alt bağı kendi kopya kimliklerine döner", () => {
    const p = teklif();
    p.pricing.lines.splice(1, 0, {
      ...newPriceLine(p.items[0].id),
      description: "BARA",
      parentLineId: p.pricing.lines[0].id,
    });
    const { payload, kopya } = kopyala(p);
    const kopyaSatirlari = payload.pricing.lines.filter((line) => line.itemId === kopya.id);
    expect(kopyaSatirlari).toHaveLength(2);
    expect(kopyaSatirlari[1].parentLineId).toBe(kopyaSatirlari[0].id);
  });

  it("kalemin fiyat satırı YOKSA fiyat tablosu hiç değişmez", () => {
    const p = teklif();
    p.pricing.lines = [];
    const { payload, priceLineCount } = kopyala(p);
    expect(priceLineCount).toBe(0);
    expect(payload.pricing.lines).toHaveLength(0);
  });

  it("kopyanın ADI kaynağınki DEĞİLDİR; kullanılmayan numarayı alır", () => {
    const p = teklif();
    expect(kopyala(p).kopya.title).toBe("VİNÇ - 3");
    const dolu = teklif();
    dolu.items.push(emptyItem("VİNÇ - 3", ["general"]));
    expect(kopyala(dolu).kopya.title).toBe("VİNÇ - 4");
  });

  it("vinç kopyasının başlığı OTOMATİĞE açıktır — ölçü düzeltilince yazılır", () => {
    const p = teklif();
    const { kopya } = kopyala(p);
    expect(kopya.titleManual).toBe(false);
    const genel = kopya.groups[0];
    genel.rows.find((r) => r.key === "capacity")!.parts = { main: "10" };
    // VİNÇ TİPİ KÜNYEDEDİR, satırda değil (md. 3) — kopya onu da taşır.
    expect(withAutoTitle({ ...kopya, craneType: "Monoray Vinç" }).title).toBe("10T MONORAY VİNÇ");
  });

  it("SERBEST kalemin kopyası KALEM - n olur ve başlığı ELLE sayılır", () => {
    const p = emptyPayload();
    p.items = [freeItem("KABİN DEĞİŞİMİ")];
    const { kopya } = kopyala(p);
    expect(kopya.title).toBe("KALEM - 2");
    expect(kopya.titleManual).toBe(true);
  });

  it("GİZLİ kalem gizli kopyalanır", () => {
    const p = teklif();
    p.items[0].hidden = true;
    expect(kopyala(p).kopya.hidden).toBe(true);
  });

  it("bulunmayan kalem için null döner — ekran hiçbir şey değiştirmez", () => {
    expect(copyItemInPayload(teklif(), "yok")).toBeNull();
  });
});

// ————————————————————————————————————————————————————————— süzgeç

describe("liste süzgeci", () => {
  const satir = (over: Partial<OfferListRow>): OfferListRow => ({
    id: "1",
    offer_no: "TETR-20260127-1",
    subject: "20T VİNÇ",
    customer_name: "HABAŞ A.Ş.",
    customerShort: "HABAŞ",
    customerHue: 40,
    status: "sent",
    issue_date: "2026-01-27",
    issuedOn: "2026-01-27",
    currency: "EUR",
    latestTotal: 223_600,
    latestRevNo: 2,
    craneTypes: ["Çift Kirişli Gezer Köprülü Vinç"],
    capacities: [20],
    itemCount: 1,
    ...over,
  });

  it("arama Türkçe katlar — «habas» yazan «HABAŞ»ı bulur", () => {
    expect(matchesOfferFilters(satir({}), { ...EMPTY_OFFER_FILTER, q: "habas" })).toBe(true);
    expect(matchesOfferFilters(satir({}), { ...EMPTY_OFFER_FILTER, q: "eti" })).toBe(false);
  });

  it("arama parçalıdır — iki alandan birleşerek bulunur", () => {
    expect(matchesOfferFilters(satir({}), { ...EMPTY_OFFER_FILTER, q: "habas cift" })).toBe(true);
  });

  it("tonaj bandı kalemlerden herhangi biri tutarsa geçer", () => {
    const f = { ...EMPTY_OFFER_FILTER, tonaj: ["10-25"] };
    expect(matchesOfferFilters(satir({ capacities: [20] }), f)).toBe(true);
    expect(matchesOfferFilters(satir({ capacities: [5, 32] }), f)).toBe(false);
    expect(matchesOfferFilters(satir({ capacities: [5, 20] }), f)).toBe(true);
  });

  it("bant sınırı İKİ banda birden düşmez", () => {
    const bes = satir({ capacities: [5] });
    expect(matchesOfferFilters(bes, { ...EMPTY_OFFER_FILTER, tonaj: ["0-5"] })).toBe(true);
    expect(matchesOfferFilters(bes, { ...EMPTY_OFFER_FILTER, tonaj: ["5-10"] })).toBe(false);
  });

  it("vinç tipi süzgeci kalem tiplerinden okur", () => {
    const f = { ...EMPTY_OFFER_FILTER, vincTipi: ["Portal Vinç"] };
    expect(matchesOfferFilters(satir({}), f)).toBe(false);
    expect(matchesOfferFilters(satir({ craneTypes: ["Portal Vinç"] }), f)).toBe(true);
  });

  it("yıl teklif tarihinden okunur", () => {
    expect(matchesOfferFilters(satir({}), { ...EMPTY_OFFER_FILTER, yil: "2026" })).toBe(true);
    expect(matchesOfferFilters(satir({}), { ...EMPTY_OFFER_FILTER, yil: "2025" })).toBe(false);
  });

  it("yıl GÖNDERİM tarihinden okunur, açılış tarihinden değil", () => {
    // Teklif 2025'te açılıp 2026'da gönderilmişse listede 2026'nın teklifidir:
    // kullanıcı onu ne zaman verdiğine göre arar, ne zaman taslak açtığına
    // göre değil.
    const gec = satir({ issue_date: "2025-12-30", issuedOn: "2026-01-05" });
    expect(matchesOfferFilters(gec, { ...EMPTY_OFFER_FILTER, yil: "2026" })).toBe(true);
    expect(matchesOfferFilters(gec, { ...EMPTY_OFFER_FILTER, yil: "2025" })).toBe(false);
    // Hiç gönderilmemiş taslak kendi açılış yılından sayılır.
    const taslak = satir({ issue_date: "2025-12-30", issuedOn: null, status: "draft" });
    expect(matchesOfferFilters(taslak, { ...EMPTY_OFFER_FILTER, yil: "2025" })).toBe(true);
  });

  it("seçenekler elle yazılmaz, satırlardan türetilir", () => {
    const f = offerFacets([
      satir({}),
      satir({
        id: "2",
        customer_name: "ETİ BAKIR A.Ş.",
        issue_date: "2025-03-01",
        issuedOn: "2025-03-01",
      }),
    ]);
    expect(f.yillar).toEqual(["2026", "2025"]);
    expect(f.musteriler).toEqual(["ETİ BAKIR A.Ş.", "HABAŞ A.Ş."]);
  });

  it("takip süzgeci yalnız gönderilmiş ve sonuçlanmamış teklifleri verir", () => {
    const bugun = "2026-02-20";
    const eski = satir({ issuedOn: "2026-01-27", status: "sent" });
    const kazanilmis = satir({ id: "k", issuedOn: "2026-01-27", status: "won" });
    const gonderilmemis = satir({ id: "g", issuedOn: null, status: "draft" });
    const f = { ...EMPTY_OFFER_FILTER, takip: ["2hafta"], bugun };
    expect(matchesOfferFilters(eski, f)).toBe(true);
    expect(matchesOfferFilters(kazanilmis, f)).toBe(false);
    expect(matchesOfferFilters(gonderilmemis, f)).toBe(false);
  });

  it("tutarsız satır sona düşer, sıfır sayılmaz", () => {
    const dolu = satir({ id: "a", latestTotal: 1000 });
    const bos = satir({ id: "b", offer_no: "TETR-20260127-2", latestTotal: null });
    expect(sortOffers([bos, dolu], { key: "tutar", desc: true }).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("bantlar boşluksuz ve örtüşmesizdir", () => {
    for (let i = 1; i < CAPACITY_BANDS.length; i += 1) {
      expect(CAPACITY_BANDS[i].min).toBe(CAPACITY_BANDS[i - 1].max);
    }
  });
});

// ————————————————————————————————————————————————————————— defter

describe("defter", () => {
  it("grup anahtarları benzersizdir", () => {
    const keys = OFFER_GROUP_DEFS.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("her grubun satır anahtarları kendi içinde benzersizdir", () => {
    for (const g of OFFER_GROUP_DEFS) {
      const keys = g.rows.map((r) => r.key);
      expect(new Set(keys).size, `grup: ${g.key}`).toBe(keys.length);
    }
  });

  it("parça anahtarları satır içinde benzersizdir", () => {
    for (const g of OFFER_GROUP_DEFS) {
      for (const r of g.rows) {
        const keys = (r.parts ?? []).map((p) => p.key);
        expect(new Set(keys).size, `${g.key}.${r.key}`).toBe(keys.length);
      }
    }
  });

  it("kademeli parçanın ebeveyni AYNI satırda vardır", () => {
    for (const g of OFFER_GROUP_DEFS) {
      for (const r of g.rows) {
        for (const p of r.parts ?? []) {
          if (!p.childOf) continue;
          expect((r.parts ?? []).some((x) => x.key === p.childOf), `${g.key}.${r.key}.${p.key}`).toBe(true);
        }
      }
    }
  });

  it("liste anahtarları defterin kendisinden türetilir", () => {
    const keys = allOfferListKeys();
    expect(keys).toContain("brand.motor");
    expect(keys).toContain("series.gearbox");
    expect(keys).toContain("term.deliveryTrigger");
    // SATIRA BAĞLI OLMAYAN LİSTE DE DEFTERDE GÖRÜNMEK ZORUNDADIR. `val.craneType`
    // bir satırdan değil kalem künyesinden okunur (md. 3); türetme onu bulamaz
    // ve `STANDALONE_LIST_KEYS`e yazılmasaydı Tanımlar → Defterler ekranındaki
    // "Vinç Tipleri" kartı SESSİZCE kaybolurdu (dropdown'lar çalışmaya devam
    // ettiği için hata ancak liste düzenlenmek istendiğinde fark edilirdi).
    expect(keys).toContain("val.craneType");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gruptan kurulan satırlar defterdeki etiketi taşır", () => {
    const g = groupFromKey("mainHoist");
    expect(g.title).toBe("KALDIRMA GRUBU");
    expect(g.rows.find((r) => r.key === "hook")?.label).toBe("Kanca");
  });
});

// ————————————————————————————————————————————————————————— taşıma

describe("withDefaults", () => {
  it("boş/bozuk kayıttan çalışır bir belge üretir", () => {
    const p = withDefaults(null);
    expect(p.items).toEqual([]);
    expect(p.pricing.currency).toBe("EUR");
    expect(p.terms.rows.length).toBeGreaterThan(0);
  });

  it("eski kayıttaki değerleri korur ve derlenmiş değeri tazeler", () => {
    const p = withDefaults({
      items: [
        {
          id: "i1",
          title: "20T",
          capacityT: 20,
          groups: [{ id: "g1", key: "mainHoist", rows: [{ key: "motor", parts: { brand: "GAMAK", power: "22" } }] }],
        },
      ],
    });
    expect(p.items[0].capacityT).toBe(20);
    expect(p.items[0].groups[0].rows[0].value).toBe("GAMAK 22 kW");
    expect(p.items[0].groups[0].rows[0].label).toBe("Motor");
  });

  it("kalem kimliği yoksa üretilir — fiyat bağı kimliksiz kalmaz", () => {
    const p = withDefaults({ items: [{ title: "X", groups: [] }] });
    expect(p.items[0].id).toBeTruthy();
  });

  it("eski teklif yeni partner veya gizli bölüm kararı edinmez", () => {
    const p = withDefaults({ version: 1, items: [] });
    expect(p.issuer.customerId).toBeNull();
    expect(p.hiddenSections).toEqual([]);
    expect(
      offerIssuerName(p, {
        company: "ORION CRANES",
        city: "ANKARA",
        title_tr: "",
        title_en: "",
        default_crane_type: "",
      })
    ).toBe("ORİON VİNÇ");
  });

  it("emekli Kiriş Boyu Elektrik satırını PLC diye yeniden etiketlemez", () => {
    const p = withDefaults({
      items: [{
        id: "i",
        title: "Vinç",
        groups: [{ id: "g", key: "electrical", rows: [{ key: "girderPower", value: "Eski değer" }] }],
      }],
    });
    expect(p.items[0].groups[0].rows.some((row) => row.key === "girderPower")).toBe(false);
    expect(p.items[0].groups[0].rows.map((row) => row.key)).toEqual(["plc", "hmiPanel"]);
    expect(p.items[0].groups.map((group) => group.key)).toEqual(["electrical", "safety"]);
  });
});

describe("elektrik ve güvenlik alanları", () => {
  it("elektrik şablonu PLC/HMI ile ve güvenlik bölümü boş seçimlerle açılır", () => {
    const item = emptyItem("Vinç", ["electrical"]);
    expect(item.groups.map((group) => group.key)).toEqual(["electrical", "safety"]);
    const elektrik = item.groups[0];
    expect(elektrik.rows.some((row) => row.key === "girderPower")).toBe(false);
    expect(elektrik.rows.find((row) => row.key === "plc")?.value).toBe("");
    expect(elektrik.rows.find((row) => row.key === "hmiPanel")?.value).toBe("");
    const guvenlik = item.groups[1];
    expect(guvenlik.rows).toHaveLength(14);
    expect(guvenlik.rows.every((row) => row.value === "")).toBe(true);
    expect(guvenlik.rows.every((row) => offerRowDef("safety", row.key)?.kind === "toggle")).toBe(true);
  });
});

// ————————————————————————————————————— sahte gruplar ve varsayılanlar

describe("sahte grup anahtarları", () => {
  it("ticari şart ve test yükü satırları defterden ÇÖZÜLÜR", () => {
    // Bu bağ bir süre yoktu ve iki belirtiyi birden doğurdu (17.08.2026):
    // ticari şartlar açılır liste çizmiyordu ve varsayılanlar dolmuyordu.
    for (const r of TERM_ROW_DEFS) {
      expect(offerRowDef(TERMS_GROUP_KEY, r.key), `ticari: ${r.key}`).toBeDefined();
    }
    for (const r of TEST_LOAD_ROW_DEFS) {
      expect(offerRowDef(TEST_LOAD_GROUP_KEY, r.key), `test: ${r.key}`).toBeDefined();
    }
  });

  it("ticari şart satırlarının HEPSİ bir listeye bağlıdır — düz kutu kalmaz", () => {
    for (const r of TERM_ROW_DEFS) {
      expect(Boolean(r.list || r.parts?.length), `liste yok: ${r.key}`).toBe(true);
    }
  });
});

describe("applyDefaults", () => {
  const DEFTER = {
    "term.validity": "14 iş günü",
    "val.testDynamic": "Q x 1,1",
    "val.testStatic": "Q x 1,25",
    "cover.intro": "Giriş cümlesi.",
  };

  it("test yükü ve geçerlilik defterden DOLU gelir", () => {
    const p = applyDefaults(emptyPayload(), DEFTER);
    expect(p.testLoad.rows.find((r) => r.key === "dynamic")?.value).toBe("Q x 1,1");
    expect(p.testLoad.rows.find((r) => r.key === "static")?.value).toBe("Q x 1,25");
    expect(p.terms.rows.find((r) => r.key === "validity")?.value).toBe("14 iş günü");
    expect(p.cover.intro).toBe("Giriş cümlesi.");
  });

  it("DOLU alan EZİLMEZ — varsayılan bir başlangıçtır, düzeltme değil", () => {
    const p = emptyPayload();
    p.terms.rows.find((r) => r.key === "validity")!.value = "30 gün";
    p.cover.intro = "Kendi cümlem.";
    const sonra = applyDefaults(p, DEFTER);
    expect(sonra.terms.rows.find((r) => r.key === "validity")?.value).toBe("30 gün");
    expect(sonra.cover.intro).toBe("Kendi cümlem.");
  });

  it("defterde karşılığı olmayan alan BOŞ kalır — uydurma değer yok", () => {
    const p = applyDefaults(emptyPayload(), DEFTER);
    expect(p.terms.rows.find((r) => r.key === "warranty")?.value).toBe("");
  });
});

describe("greetingFor", () => {
  it("hitap cümlesini kurar; ek defterden gelir, addan CİNSİYET çıkarılmaz", () => {
    expect(greetingFor("ALİCAN ERASLAN", "Bey,")).toBe("Sn. ALİCAN ERASLAN Bey,");
    expect(greetingFor("AYŞE DEMİR", "Hanım,")).toBe("Sn. AYŞE DEMİR Hanım,");
  });

  it("ek yoksa cümle yine kapanır; ad yoksa hitap OLUŞMAZ", () => {
    expect(greetingFor("MEHMET EROL", "")).toBe("Sn. MEHMET EROL,");
    expect(greetingFor("", "Bey,")).toBe("");
  });
});

// ————————————————————————————————— 17.08.2026 turu: yeni kurallar

describe("ayıraç parça başına kararlıdır", () => {
  it("virgülden SONRA gelen işaretsiz parça BOŞLUKLA eklenir", () => {
    // Çalışma ortamı satırı bu kuralı gerektirdi: "Kapalı Alan, -10 / +40 º C".
    // Yapışkan virgül kipi burada ", / +40 º C" üretiyordu.
    const def = offerRowDef("general", "environment")!;
    expect(
      composeValue(def.parts!, { place: "Kapalı Alan", tempMin: "-10", tempMax: "+40" })
    ).toBe("Kapalı Alan, -10 / +40 º C");
  });

  it("motorun ek özellik kuyruğu AYNEN korunur", () => {
    const def = offerRowDef("mainHoist", "motor")!;
    expect(
      composeValue(def.parts!, {
        brand: "GAMAK",
        power: "22",
        rpm: "1500",
        options: "Encoderli, IP55",
      })
    ).toBe("GAMAK 22 kW 1500 d/dak, Encoderli, IP55");
  });
});

describe("kalem künyesi satırlardan türetilir", () => {
  it("kapasite ve açıklık GENEL ÖZELLİKLER satırlarından okunur", () => {
    const item = emptyItem("32T VİNÇ", ["general"]);
    const genel = item.groups[0];
    genel.rows.find((r) => r.key === "capacity")!.parts = { main: "32", aux: "5" };
    genel.rows.find((r) => r.key === "span")!.parts = { value: "26" };
    // KÜNYE YALNIZ ÖLÇÜ TÜRETİR: vinç tipi bir satır değil, kalemin kendi
    // alanıdır (md. 3) ve türetilecek bir yerden okunmaz.
    const kunye = itemFactsFromRows(item.groups);
    expect(kunye).toEqual({ capacityT: 32, spanM: 26 });
  });

  it("okunamayan değer UYDURULMAZ — null döner", () => {
    const item = emptyItem("X", ["general"]);
    expect(itemFactsFromRows(item.groups)).toEqual({
      capacityT: null,
      spanM: null,
    });
  });
});

describe("copySelections", () => {
  function kaynakKalem() {
    const it = emptyItem("1. VİNÇ", ["general", "mainHoist"]);
    const genel = it.groups[0];
    genel.rows.find((r) => r.key === "capacity")!.parts = { main: "32" };
    const kaldirma = it.groups[1];
    const motor = kaldirma.rows.find((r) => r.key === "motor")!;
    motor.parts = { brand: "GAMAK", power: "22", rpm: "1500" };
    motor.scope = "customer";
    kaldirma.rows.find((r) => r.key === "hook")!.value = "DIN 15401/P Tek Ağızlı Kanca";
    return it;
  }

  it("MARKA taşınır, ÖLÇÜ taşınmaz", () => {
    const yeni = copySelections(kaynakKalem(), emptyItem("2. VİNÇ", ["general", "mainHoist"]));
    const motor = yeni.groups[1].rows.find((r) => r.key === "motor")!;
    expect(motor.parts?.brand).toBe("GAMAK");
    expect(motor.parts?.power).toBeUndefined();
    expect(motor.parts?.rpm).toBeUndefined();
  });

  it("listeli satırın değeri ve satırın KAPSAMI taşınır", () => {
    const yeni = copySelections(kaynakKalem(), emptyItem("2. VİNÇ", ["general", "mainHoist"]));
    expect(yeni.groups[1].rows.find((r) => r.key === "hook")?.value).toBe(
      "DIN 15401/P Tek Ağızlı Kanca"
    );
    expect(yeni.groups[1].rows.find((r) => r.key === "motor")?.scope).toBe("customer");
  });

  it("GENEL ÖZELLİKLER hiç taşınmaz — her vincin kendi ölçüsüdür", () => {
    const yeni = copySelections(kaynakKalem(), emptyItem("2. VİNÇ", ["general", "mainHoist"]));
    expect(yeni.groups[0].rows.find((r) => r.key === "capacity")?.parts?.main).toBeFalsy();
  });

  // KAYNAK ARTIK "İLK KALEM" DEĞİL, SEÇİLEN KALEMDİR (md. 2). Fonksiyonun
  // imzası zaten kaynağı parametre alıyordu; çivilenmesi gereken şey, ekranın
  // artık BAŞKA bir kalemi verebildiğinde doğru kalemin taşınmasıdır.
  it("KAYNAK SEÇİLİR: ikinci kalemden kopyalanınca birincininki gelmez", () => {
    const ikinci = emptyItem("2. VİNÇ", ["general", "mainHoist"]);
    ikinci.groups[1].rows.find((r) => r.key === "motor")!.parts = { brand: "SIEMENS" };
    const yeni = copySelections(ikinci, emptyItem("3. VİNÇ", ["general", "mainHoist"]));
    expect(yeni.groups[1].rows.find((r) => r.key === "motor")?.parts?.brand).toBe("SIEMENS");
  });

  // KAYNAĞI SERBEST OLAN KİP SESSİZDİR ve ekran bu yüzden onu KAPATIR: serbest
  // kalemin defterde karşılığı olan satırı yoktur, eşleşme hiç kurulmaz.
  it("KAYNAK SERBEST KALEMSE hiçbir şey taşınmaz", () => {
    const yeni = copySelections(freeItem("KABİN DEĞİŞİMİ"), emptyItem("2. VİNÇ", ["general", "mainHoist"]));
    const motor = yeni.groups[1].rows.find((r) => r.key === "motor")!;
    expect(motor.parts?.brand).toBeUndefined();
    expect(motor.value).toBe("");
  });

  // İKİ KİP KARIŞMAZ: aynı kaynaktan "seçim" ÖLÇÜ getirmez, "tam" getirir.
  // Bu, md. 2'nin üç kipli penceresinin tek kaynaklı kanıtıdır — ekran hangi
  // fonksiyonu çağırdığını karıştırırsa burada görünür.
  it("SEÇİM ölçüyü getirmez, TAM getirir", () => {
    const kaynak = kaynakKalem();
    const secim = copySelections(kaynak, emptyItem("2. VİNÇ", ["general", "mainHoist"]));
    expect(secim.groups[1].rows.find((r) => r.key === "motor")?.parts?.power).toBeUndefined();

    const p = emptyPayload();
    p.items = [kaynak];
    const sonuc = copyItemInPayload(p, kaynak.id);
    const tam = sonuc!.kopya;
    expect(tam.groups[1].rows.find((r) => r.key === "motor")?.parts?.power).toBe("22");
    expect(tam.groups[0].rows.find((r) => r.key === "capacity")?.parts?.main).toBe("32");
  });
});

describe("ORANLI İSKONTO — küsurat yukarı yuvarlanır", () => {
  function fiyatli(...tutarlar: number[]) {
    const p = emptyPayload();
    p.pricing.lines = tutarlar.map((t) => ({
      id: `satir-${t}`,
      itemId: null,
      parentLineId: null,
      description: "X",
      qty: 1,
      unit: "Takım",
      unitPrice: t,
      inTotal: true,
    }));
    return p.pricing.lines;
  }

  it("tam bölünen oranda küsurat doğmaz", () => {
    expect(discountTotalFromPercent(fiyatli(100_000), 5)).toBe(95_000);
  });

  it("KÜSURAT YUKARI yuvarlanır — aşağı yuvarlamak fazla indirim olurdu", () => {
    // 675.807 × 0,95 = 642.016,65 → 642.017
    expect(discountTotalFromPercent(fiyatli(675_807), 5)).toBe(642_017);
    // 1.000 × 0,933 = 933,0 (tam) ama 1.001 × 0,933 = 933,933 → 934
    expect(discountTotalFromPercent(fiyatli(1_001), 6.7)).toBe(934);
  });

  it("ORAN ARALIK DIŞINDAYSA hesap YAPILMAZ — sıfır ya da tam indirim uydurulmaz", () => {
    expect(discountTotalFromPercent(fiyatli(100_000), 0)).toBeNull();
    expect(discountTotalFromPercent(fiyatli(100_000), 100)).toBeNull();
    expect(discountTotalFromPercent(fiyatli(100_000), null)).toBeNull();
    expect(discountTotalFromPercent([], 5)).toBeNull();
  });

  it("türetilen ORAN, uygulanan oranla aynı büyüklüktedir", () => {
    const lines = fiyatli(675_807);
    const hedef = discountTotalFromPercent(lines, 5)!;
    const oran = discountPercent({ ...emptyPayload().pricing, lines, discountTotal: hedef });
    expect(oran).toBeCloseTo(5, 3);
  });
});

describe("ödeme planı", () => {
  it("satır metni yüzde ve açıklamadan derlenir", () => {
    expect(paymentLineText({ percent: 40, desc: "Avans Sipariş ile Nakit", text: "" })).toBe(
      "%40 Avans Sipariş ile Nakit"
    );
  });

  it("YÜZDESİZ satır meşrudur — açıklama tek başına basılır", () => {
    expect(
      paymentLineText({ percent: null, desc: "Montaj Sonrası Kalan Nakit", text: "" })
    ).toBe("Montaj Sonrası Kalan Nakit");
  });

  it("toplam gösterilir, ZORLANMAZ; yüzdesiz satır toplama girmez", () => {
    const y = paymentPercentTotal([
      { id: "1", text: "", percent: 30 },
      { id: "2", text: "", percent: 70 },
      { id: "3", text: "", percent: null },
    ]);
    expect(y).toEqual({ toplam: 100, yuzdeli: 2, yuzdesiz: 1, tam: true });
    expect(paymentPercentTotal([{ id: "1", text: "", percent: 30 }]).tam).toBe(false);
  });

  it("gizlenen satır toplama girmez", () => {
    const y = paymentPercentTotal([
      { id: "1", text: "", percent: 100 },
      { id: "2", text: "", percent: 50, hidden: true },
    ]);
    expect(y.toplam).toBe(100);
  });
});

describe("satır kapsamı", () => {
  it("varsayılan Orion'dur ve belgede EK BIRAKMAZ", () => {
    expect(offerScopeSuffix(undefined)).toBe("");
    expect(offerScopeSuffix("orion")).toBe("");
  });

  it("müşteri kapsamı belgede görünür", () => {
    expect(offerScopeSuffix("customer")).toBe(" (Müşteri Kapsamında)");
  });

  it("eski kayıtlar taşınırken kapsam Orion'a düşer", () => {
    const p = withDefaults({
      items: [{ id: "i", title: "X", groups: [{ id: "g", key: "mainHoist", rows: [{ key: "motor" }] }] }],
    });
    expect(p.items[0].groups[0].rows[0].scope).toBe("orion");
  });
});

// ————————————————————————————————————————————————————— kalem başlığı

/** GENEL ÖZELLİKLER'i verilen değerlerle kurulmuş bir kalem. */
function genelKalem(
  deger: { ana?: string; yardimci?: string; aks?: string; tip?: string },
  baslik = "VİNÇ - 1"
) {
  const item = emptyItem(baslik, ["general", "mainHoist", "trolley"]);
  const genel = item.groups[0];
  genel.rows.find((r) => r.key === "capacity")!.parts = {
    ...(deger.ana ? { main: deger.ana } : {}),
    ...(deger.yardimci ? { aux: deger.yardimci } : {}),
  };
  if (deger.aks) genel.rows.find((r) => r.key === "span")!.parts = { value: deger.aks };
  // VİNÇ TİPİ KÜNYE ALANIDIR (md. 3); `composeItemTitle` onu ayrıca alır.
  if (deger.tip) item.craneType = deger.tip;
  return item;
}

describe("kalem başlığı satırlardan türetilir", () => {
  it("devralınan tekliflerdeki başlığı birebir üretir", () => {
    expect(
      (() => {
        const k = genelKalem({ ana: "32", yardimci: "5", aks: "19,5", tip: "Çift Kirişli Gezer Köprülü Vinç" });
        return composeItemTitle(k.groups, k.craneType);
      })()
    ).toBe("32/5T x 19,5m ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ");
  });

  it("YARDIMCI KALDIRMA YOKSA eğik çizgi de yoktur", () => {
    const k = genelKalem({ ana: "32", aks: "30", tip: "Portal Vinç" });
    expect(composeItemTitle(k.groups, k.craneType)).toBe(
      "32T x 30m PORTAL VİNÇ"
    );
  });

  it("açıklık girilmemişse 'x m' gibi yarım bir ölçü OLUŞMAZ", () => {
    const k = genelKalem({ ana: "20", tip: "Monoray Vinç" });
    expect(composeItemTitle(k.groups, k.craneType)).toBe(
      "20T MONORAY VİNÇ"
    );
  });

  it("ölçü sözcükleri BÜYÜTÜLMEZ — 'x' ve '19,5m' olduğu gibi kalır", () => {
    expect(kalemBasligiBuyuk("32/5T x 19,5m çift kirişli vinç")).toBe(
      "32/5T x 19,5m ÇİFT KİRİŞLİ VİNÇ"
    );
  });

  it("okunacak bir şey yoksa BOŞ döner ve mevcut başlığa dokunulmaz", () => {
    const item = genelKalem({});
    expect(composeItemTitle(item.groups, item.craneType)).toBe("");
    expect(withAutoTitle(item).title).toBe("VİNÇ - 1");
  });

  it("ELLE YAZILMIŞ başlığı türetme EZMEZ", () => {
    const item = { ...genelKalem({ ana: "32", tip: "Portal Vinç" }), titleManual: true };
    expect(withAutoTitle(item).title).toBe("VİNÇ - 1");
    expect(withAutoTitle({ ...item, titleManual: false }).title).toBe("32T PORTAL VİNÇ");
  });

  it("varsayılan ad sırayı taşır", () => {
    expect(defaultItemTitle(3)).toBe("VİNÇ - 3");
    expect(isDefaultItemTitle("VİNÇ - 12")).toBe(true);
    expect(isDefaultItemTitle("32T PORTAL VİNÇ")).toBe(false);
  });

  it("başlık kipi eski kayıtlarda TÜRETİLEBİLİR sayılır", () => {
    const p = withDefaults({ items: [{ id: "i", title: "20T VİNÇ", groups: [] }] });
    expect(p.items[0].titleManual).toBe(false);
  });
});

// ————————————————————————————————————————————— türetilen parça (sürücü)

describe("sürücünün toplam gücü türetilir", () => {
  const drive = offerRowDef("mainHoist", "drive")!.parts!;

  it("güç × adet olarak yazılır ve değere girer", () => {
    const parts = derivedParts(drive, { brand: "SCHNEIDER", power: "18,5", count: "2" });
    expect(parts.total).toBe("37");
    expect(composeValue(drive, parts)).toBe("SCHNEIDER 18,5 kW x 2 Adet (37 kW)");
  });

  it("ADET 1 İSE toplam yazılmaz — aynı sayı iki kez geçmez", () => {
    expect(derivedParts(drive, { power: "18,5", count: "1" }).total ?? "").toBe("");
  });

  it("güç ya da adet okunamıyorsa toplam BOŞALIR (uydurma sayı yok)", () => {
    // Girilmiş bir toplam GERÇEKTEN silinir; hiç girilmemişse alan hiç doğmaz.
    expect(derivedParts(drive, { power: "", count: "4", total: "74" }).total).toBe("");
    expect(derivedParts(drive, { power: "abc", count: "4" }).total ?? "").toBe("");
  });

  it("ondalık nokta da virgül de okunur, çıktı VİRGÜLLÜdür", () => {
    expect(derivedParts(drive, { power: "18.5", count: "3" }).total).toBe("55,5");
  });

  it("türetilmeyen satırın parçalarına DOKUNULMAZ", () => {
    const motor = offerRowDef("mainHoist", "motor")!.parts!;
    const parts = { brand: "GAMAK", power: "22", count: "2" };
    expect(derivedParts(motor, parts)).toBe(parts);
  });
});

// ————————————————————————————————————————————————————— çok markalı alan

describe("çok markalı değer", () => {
  it("markalar eğik çizgiyle birleşir (belgelerin kendi yazımı)", () => {
    expect(joinMulti(["SEW", "FLENDER"])).toBe("SEW/FLENDER");
    expect(splitMulti("SIEMENS/ABB")).toEqual(["SIEMENS", "ABB"]);
  });

  it("boş kutu değere GİRMEZ ama en az bir kutu her zaman çizilir", () => {
    expect(joinMulti(["SEW", "", "  "])).toBe("SEW");
    expect(splitMulti("")).toEqual([""]);
    expect(splitMulti("SEW//FLENDER")).toEqual(["SEW", "FLENDER"]);
  });

  it("kademeli listenin ebeveyni İLK markadır", () => {
    expect(firstMulti("SEW/FLENDER")).toBe("SEW");
    expect(firstMulti("")).toBe("");
  });

  it("çokluk YALNIZ marka listelerindedir — ölçü listeleri tektir", () => {
    expect(isMultiValueList("brand.gearbox")).toBe(true);
    expect(isMultiValueList("brand.powerSupply")).toBe(true);
    expect(isMultiValueList("series.gearbox")).toBe(false);
    expect(isMultiValueList("val.wheelDia")).toBe(false);
    expect(isMultiValueList("term.validity")).toBe(false);
    expect(isMultiValueList(undefined)).toBe(false);
  });

  it("KADEMELİ LİSTE çift markada da ebeveyni bulur", () => {
    const markalar = [
      { id: "b1", value: "YILMAZ R." },
      { id: "b2", value: "SEW" },
    ];
    // Seri listesi ebeveynin kimliğiyle çekilir; kimlik bulunamazsa liste BOŞ
    // kalır ve kullanıcı hiçbir seri göremez — bu, çok markalı alanın en kolay
    // gözden kaçan yan etkisidir.
    expect(parentOption(markalar, "SEW/FLENDER")?.id).toBe("b2");
    expect(parentOption(markalar, "sew ")?.id).toBe("b2");
    expect(parentOption(markalar, "YILMAZ R./FLENDER")?.id).toBe("b1");
    expect(parentOption(markalar, "")).toBeUndefined();
    expect(parentOption(markalar, "BİLİNMEYEN")).toBeUndefined();
  });

  it("TEK MOTORDA adet yazılmaz, çift markada da öyle", () => {
    const motor = offerRowDef("mainHoist", "motor")!.parts!;
    expect(composeValue(motor, { brand: "GAMAK/ELK", count: "1", power: "30" })).toBe(
      "GAMAK/ELK 30 kW"
    );
    expect(composeValue(motor, { brand: "GAMAK", count: "2", power: "1,5" })).toBe(
      "GAMAK 2 x 1,5 kW"
    );
    // FREN İSTİSNADIR: belgelerde "SIBRE Kasnak Fren x 1 Adet" yazımı geçiyor.
    const fren = offerRowDef("mainHoist", "brake")!.parts!;
    expect(composeValue(fren, { brand: "SIBRE", type: "Kasnak Fren", count: "1" })).toBe(
      "SIBRE Kasnak Fren x 1 Adet"
    );
  });

  it("çift marka satırın yazımını bozmaz", () => {
    const motor = offerRowDef("mainHoist", "motor")!.parts!;
    expect(composeValue(motor, { brand: "SIEMENS/ABB", power: "110", rpm: "1500" })).toBe(
      "SIEMENS/ABB 110 kW 1500 d/dak"
    );
  });
});

// ————————————————————————————————————————————— bölüm ekleme / araba sayısı

describe("bölüm ekleme defter sırasına uyar", () => {
  it("yardımcı kaldırma KALDIRMA GRUBUNUN ardına düşer, sona değil", () => {
    const item = emptyItem("X", ["general", "mainHoist", "trolley", "electrical"]);
    const next = withGroup(item, AUX_HOIST_GROUP_KEY);
    expect(next.groups.map((g) => g.key)).toEqual([
      "general",
      "mainHoist",
      "auxHoist",
      "trolley",
      "electrical",
      "safety",
    ]);
  });

  it("zaten varsa hiçbir şey yapmaz — satırlar kaybolmaz", () => {
    const item = emptyItem("X", ["general", "auxHoist"]);
    expect(withGroup(item, AUX_HOIST_GROUP_KEY)).toBe(item);
  });
});

describe("araba sayısı", () => {
  it("çift arabalıda ikinci bölüm kurulur ve ikisi 1/2 diye adlanır", () => {
    const { item } = setTrolleyCount(emptyItem("X", ["general", "trolley", "bridge"]), 2);
    expect(trolleyCount(item)).toBe(2);
    expect(item.groups.map((g) => g.key)).toEqual(["general", "trolley", "auxTrolley", "bridge"]);
    expect(item.groups.find((g) => g.key === "trolley")?.title).toBe(TROLLEY_1_TITLE);
    expect(item.groups.find((g) => g.key === "auxTrolley")?.title).toBe(TROLLEY_2_TITLE);
  });

  it("arabası hiç olmayan kalemde çift seçilirse İKİ bölüm de kurulur", () => {
    const { item } = setTrolleyCount(emptyItem("X", ["general", "steel"]), 2);
    expect(item.groups.map((g) => g.key)).toEqual(["general", "trolley", "auxTrolley", "steel"]);
    expect(item.groups.find((g) => g.key === "trolley")?.title).toBe(TROLLEY_1_TITLE);
  });

  it("BOŞ ikinci araba teke dönüşte kaldırılır ve ad numarasız olur", () => {
    const { item: cift } = setTrolleyCount(emptyItem("X", ["general", "trolley"]), 2);
    const { item, korunanVeri } = setTrolleyCount(cift, 1);
    expect(korunanVeri).toBe(false);
    expect(trolleyCount(item)).toBe(1);
    expect(item.groups.find((g) => g.key === "trolley")?.title).toBe(TROLLEY_TITLE);
  });

  it("VERİ GİRİLMİŞ ikinci araba teke dönüşte SİLİNMEZ", () => {
    const { item: cift } = setTrolleyCount(emptyItem("X", ["general", "trolley"]), 2);
    const ikinci = cift.groups.find((g) => g.key === "auxTrolley")!;
    ikinci.rows.find((r) => r.key === "motor")!.value = "GAMAK 2 x 1,5 kW";
    const { item, korunanVeri } = setTrolleyCount(cift, 1);
    expect(korunanVeri).toBe(true);
    expect(item.groups.some((g) => g.key === "auxTrolley")).toBe(true);
  });

  it("KULLANICININ YAZDIĞI bölüm başlığı ezilmez", () => {
    const item = emptyItem("X", ["general", "trolley"]);
    item.groups.find((g) => g.key === "trolley")!.title = "VİNÇ ARABASI (MEVCUT)";
    const { item: cift } = setTrolleyCount(item, 2);
    expect(cift.groups.find((g) => g.key === "trolley")?.title).toBe("VİNÇ ARABASI (MEVCUT)");
  });
});

describe("serbest (yedek parça) kalemi", () => {
  it("TEK serbest bölüm ve boş satırlarla açılır", () => {
    const item = freeItem("YEDEK PARÇA LİSTESİ");
    expect(item.groups).toHaveLength(1);
    expect(item.groups[0].key).toBe("custom");
    expect(item.groups[0].title).toBe(FREE_GROUP_TITLE);
    expect(item.groups[0].rows.length).toBeGreaterThan(0);
    // Satır anahtarları BENZERSİZ: iki serbest satır birbirine karışmaz.
    const anahtarlar = new Set(item.groups[0].rows.map((r) => r.key));
    expect(anahtarlar.size).toBe(item.groups[0].rows.length);
  });

  it("başlığı ELLE yazılmış sayılır — türetme onu ezmez", () => {
    const item = freeItem("KABİN DEĞİŞİMİ");
    expect(item.titleManual).toBe(true);
    expect(withAutoTitle(item).title).toBe("KABİN DEĞİŞİMİ");
  });

  it("boş satırları belgeye GİRMEZ", () => {
    const p = emptyPayload();
    p.items = [freeItem("YEDEK PARÇA")];
    expect(printedPayload(p).items[0].groups).toHaveLength(0);
  });

  it("serbest kalemin adı VİNÇ demez", () => {
    expect(defaultFreeItemTitle(2)).toBe("KALEM - 2");
  });
});

describe("vinç tipi şablondan gelir", () => {
  it("YALNIZ kalem künyesine yazılır — GENEL ÖZELLİKLER'de satırı yoktur (md. 3)", () => {
    const item = withCraneType(emptyItem("VİNÇ - 1", ["general"]), "Portal Vinç");
    expect(item.craneType).toBe("Portal Vinç");
    expect(item.groups[0].rows.some((r) => r.key === "craneType")).toBe(false);
  });

  it("BOŞ TİP künyeyi silmez", () => {
    const item = { ...emptyItem("VİNÇ - 1", ["general"]), craneType: "Monoray Vinç" };
    expect(withCraneType(item, "  ").craneType).toBe("Monoray Vinç");
  });
});

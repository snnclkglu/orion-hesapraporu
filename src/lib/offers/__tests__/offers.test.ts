// TEKLİF ÇEKİRDEĞİNİN KORUMA TESTLERİ.
//
// Sınanan şey biçim değil KURALDIR: gizlenen satırın belgeye girmemesi, elle
// yazılan değerin ezilmemesi, toplamın satırlarla tutması ve kopyalanan
// teklifte muhatap bilgilerinin kalmaması. Dördü de sessizce bozulabilecek
// ve ancak müşteri fark ettiğinde anlaşılabilecek hatalardır.

import { describe, expect, it } from "vitest";
import { composeValue, rowValue, withComposedValue } from "../compose";
import { copyPayloadForCustomer } from "../copy";
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
  greetingFor,
  groupFromKey,
  hiddenCount,
  newPriceLine,
  printedPayload,
  withDefaults,
} from "../payload";
import {
  lineAmount,
  offerTotal,
  paymentLineText,
  paymentPercentTotal,
  vatNote,
  withTotal,
} from "../pricing";
import {
  OFFER_GROUP_DEFS,
  TERMS_GROUP_KEY,
  TERM_ROW_DEFS,
  TEST_LOAD_GROUP_KEY,
  TEST_LOAD_ROW_DEFS,
  allOfferListKeys,
  itemFactsFromRows,
  offerRowDef,
} from "../registry";
import { offerScopeSuffix, type OfferPartDef } from "../types";

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
    genel.rows.find((r) => r.key === "craneType")!.value = "Portal Vinç";
    const kunye = itemFactsFromRows(item.groups);
    expect(kunye).toEqual({ capacityT: 32, spanM: 26, craneType: "Portal Vinç" });
  });

  it("okunamayan değer UYDURULMAZ — null döner", () => {
    const item = emptyItem("X", ["general"]);
    expect(itemFactsFromRows(item.groups)).toEqual({
      capacityT: null,
      spanM: null,
      craneType: "",
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

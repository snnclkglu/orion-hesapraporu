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
//
// KAPSAM aynı ilkenin öteki yüzüdür: `orion` de iz bırakmaz (olağan olan
// yazılmaz), `customer` ise değerin devamında görünür. Künye kontrolü ise
// YERLEŞİM ölçer: dört iletişim alanının aynı satırda kaldığı, çözülen metinde
// aralarında satır sonu OLMAMASIYLA kanıtlanır — ve bu, satır A4 genişliğini
// aştığında da düşer, yani aynı zamanda taşma bekçisidir.

import { describe, expect, it } from "vitest";
import {
  FIYAT_SATIR_ESIGI,
  OFFER_SECTIONS,
  OfferDocument,
  renderOfferPdf,
  type OfferDocumentProps,
} from "../offer";
import { offerFileName } from "../doc-naming";
import { trUpper } from "../palette";
import { emptyPayload, groupFromKey, newOfferId } from "@/lib/offers/payload";
import { COMPANY_PROFILE, GENERAL_TERMS_TITLE } from "@/lib/offers/registry";
import { offerTotal, vatBadge, vatNote } from "@/lib/offers/pricing";
import { fmtMoney } from "@/lib/currency";
import type { OfferPayload, OfferPriceLine, OfferRowScope } from "@/lib/offers/types";

// KÜNYE GERÇEK UZUNLUKTADIR: altbilgi dört alanı TEK satıra basar ve satırın
// A4 içerik genişliğine sığdığı ancak firmanın kendi (uzun) adresiyle
// ölçülebilir — kısaltılmış bir adresle taşma hiç görülmezdi.
const COMPANY = {
  company: "ORION CRANES",
  address: "Malıköy, 1. Cd. No:20, 06909 Başkent Organize Sanayi Bölgesi/Sincan/Ankara",
  phone: "(0312) 511 48 06",
  email: "info@orioncranes.com",
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
function fikstur(over: { vatIncluded?: boolean; kapsam?: OfferRowScope } = {}): OfferDocumentProps {
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
    if (row.key === "reeving") {
      row.value = "4/1";
      // KAPSAM: `over.kapsam` verilmezse alan HİÇ yazılmaz — varsayılan yolun
      // (alan yok) ile açıkça "orion" yazılmış yolun aynı sonucu verdiği
      // ancak ikisi de sınanınca görülür.
      row.scope = over.kapsam;
    }
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
    if (row.key === "dynamic") {
      row.value = "Q x 1,1";
      row.scope = over.kapsam;
    }
    if (row.key === "static") row.value = "Q x 1,25";
  }
  for (const row of p.terms.rows) {
    if (row.key === "validity") row.value = "14 iş günü";
    if (row.key === "deliveryTime") {
      row.value = "Avans Ödemesi Sonrası 10-12 Hafta";
      row.scope = over.kapsam;
    }
    if (row.key === "payment") row.value = "Ödeme şekli aşağıda belirtilen şekildedir.";
  }
  p.terms.paymentLines = [
    { id: newOfferId(), text: "%40 Avans Sipariş ile Nakit" },
    { id: newOfferId(), text: `${GIZLI} %10 Gizli Kalem`, hidden: true },
  ];

  p.pricing.vatIncluded = over.vatIncluded ?? false;
  const anaFiyat = fiyat({
    description: "20 Ton x 22,5 m Çift Kirişli Gezer Köprülü Vinç",
    qty: 4,
    unit: "Takım",
    unitPrice: 55900,
  });
  p.pricing.lines = [
    anaFiyat,
    // TOPLAMA GİRMEYEN satır: tutarı belgede yazar, TOPLAM'a eklenmez.
    fiyat({
      description: "Montaj Süpervizör Hizmeti",
      qty: 1,
      unit: "Kişi",
      unitPrice: 400,
      inTotal: false,
      parentLineId: anaFiyat.id,
    }),
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
  return (await pdfSayfalari(props)).join(" ");
}

/**
 * SAYFA SAYFA metin — satır sonları KORUNARAK.
 *
 * Altbilgi künyesinin "tek satır" olduğu ancak burada ölçülebilir: sayfalar
 * birleştirilirse ve boşluklar silinirse satır sonu bilgisi kaybolur, iki
 * satıra bölünmüş bir künye de sınavı geçerdi.
 */
async function pdfSayfalari(props: OfferDocumentProps): Promise<string[]> {
  const buf = await renderOfferPdf(props);
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(doc, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

const duz = (s: string) => s.replace(/\s+/g, "");

/**
 * Belgenin GENEL ŞARTLAR'DAN ÖNCEKİ kısmı — teklifin KENDİ satırları.
 *
 * Genel şartlar bölümü (18.08.2026) belgenin sonuna hukukî bir beyan ekledi ve
 * o metin "Garanti", "Kapsam", "ORION CRANES" gibi sözcükleri KENDİ anlamıyla
 * taşır: bir madde başlığı "Garanti"dir, bir başkası "Kapsam ve Öncelik".
 *
 * Gövdeye dair savları belgenin TAMAMINDA aramak bu yüzden yanlış cevap verir
 * — ve verdiği yanlış cevap tehlikelidir: "değersiz satır çizilmedi" savı,
 * sözcük başka bir bölümde geçtiği için düşer; kural bozulmamışken test
 * kırmızı yanar, sonra da savı gevşetmek cazip hâle gelir. Sorulan şey
 * TEKLİFİN GÖVDESİNDE ne yazdığıdır, son sayfadaki beyanda değil.
 *
 * Başlık `registry.ts`ten okunur: iki yere yazılsaydı bölüm adı değiştiğinde
 * bu süzgeç sessizce bütün belgeye dönerdi.
 */
function govde(metin: string): string {
  const i = metin.indexOf(GENERAL_TERMS_TITLE);
  // Bölüm bulunamazsa metin OLDUĞU GİBİ döner: süzgeç kendi kendini kapatıp
  // savı sessizce zayıflatmaz, kaybolan başlığı testin düşmesiyle bildirir.
  return i < 0 ? metin : metin.slice(0, i);
}

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
    // GÖVDEDE aranır: genel şartların "Garanti" başlıklı maddesi ayrı bir
    // sözdür ve o maddenin belgede DURMASI gerekir.
    const metin = await pdfMetni(fikstur());
    expect(govde(metin).includes("Garanti")).toBe(false);
    expect(metin.includes(GENERAL_TERMS_TITLE)).toBe(true);
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
    expect(metin.includes(duz("MONTAJ SÜPERVİZÖR HİZMETİ"))).toBe(true);
    expect(metin.includes(duz("* Toplam fiyata dahil değildir."))).toBe(true);
    // Toplam, süpervizörlük eklenmiş hâli (224.000) OLAMAZ.
    expect(metin.includes(duz(fmtMoney(224000, "EUR")))).toBe(false);
  });

  it("seçilen aksesuar satırını ana vincin altında 1.1 numaralar", async () => {
    const sayfalar = await pdfSayfalari(fikstur());
    const fiyatSayfasi = sayfalar.find((page) => page.includes("MONTAJ SÜPERVİZÖR HİZMETİ")) ?? "";
    const satir = fiyatSayfasi
      .split("\n")
      .find((line) => line.includes("MONTAJ SÜPERVİZÖR HİZMETİ")) ?? "";
    expect(satir).toContain("1.1");
  });
});

describe("ticari şart yazımı", () => {
  it("teslim, test yükü ve ödeme kalemlerini büyük harfle basar", async () => {
    const metin = await pdfMetni(fikstur());
    expect(metin).toContain("14 İŞ GÜNÜ");
    expect(metin).toContain("AVANS ÖDEMESİ SONRASI 10-12 HAFTA");
    expect(metin).toContain("%40 AVANS SİPARİŞ İLE NAKİT");
    expect(metin).toContain("Q x 1,25");
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

describe("satır kapsamı", () => {
  it("müşteri kapsamı EKİ değerin devamında basılır — teknik, test yükü ve ticari satırda", async () => {
    const metin = duz(await pdfMetni(fikstur({ kapsam: "customer" })));
    // Ek DEĞERE BİTİŞİKTİR: ayrı bir sütuna ya da alt satıra düşseydi burada
    // aradaki metin yüzünden eşleşme kurulamazdı.
    // TEKNİK satır BÜYÜK HARF basılır (md. 18); ek de değerin devamındadır.
    //
    // BU SAV BİR FONT HATASINI DA YAKALADI: ek, mono dizilen değerin içindeki
    // bir `Text`ti ve aile verilmediği için mono'yu miras alıyordu; @react-pdf'in
    // ürettiği alt kümede mono'nun ToUnicode eşlemesi büyük "I"yı "F"ye
    // bağlıyor ve belgeden kopyalanan metin "KAPSAMFNDA" çıkıyordu. Çizim
    // doğruydu, METİN KATMANI yanlıştı — yani müşteri belgede arama yapsa
    // bulamazdı. Ek artık sans dizilir (`S.kapsamEki`).
    expect(metin.includes(duz("4/1 (MÜŞTERİ KAPSAMINDA)"))).toBe(true);
    expect(metin.includes(duz("Q x 1,1 (MÜŞTERİ KAPSAMINDA)"))).toBe(true);
    expect(metin.includes(duz("AVANS ÖDEMESİ SONRASI 10-12 HAFTA (MÜŞTERİ KAPSAMINDA)"))).toBe(true);
  });

  it("Orion kapsamı belgede İZ BIRAKMAZ — alan yazılmasa da 'orion' yazılsa da", async () => {
    // Bir teklifte satırların neredeyse tamamı bizim kapsamımızdadır; her
    // satıra kapsam yazmak belgeyi okunmaz yapardı. Görünür olan İSTİSNADIR.
    // GÖVDEDE aranır: genel şartların ilk maddesi "Kapsam ve Öncelik"tir ve
    // sözcük orada teklifin satır kapsamını değil, sözleşmenin kapsamını
    // anlatır — iki ayrı şeydir, aynı süzgeçten geçirilemez.
    const varsayilan = await pdfMetni(fikstur());
    expect(govde(varsayilan).includes("Kapsam")).toBe(false);

    const acikca = await pdfMetni(fikstur({ kapsam: "orion" }));
    expect(govde(acikca).includes("Kapsam")).toBe(false);
  });
});

describe("altbilgi künyesi", () => {
  it("adres · telefon · e-posta · web TEK SATIRDA — arada satır sonu yok", async () => {
    // Telefon eskiden adresten ayrı, bir üst satırda duruyordu (kullanıcı
    // bildirimi, 17.08.2026: dengesiz görünüyor). Kontrol aynı zamanda TAŞMA
    // BEKÇİSİDİR: satır A4 genişliğine sığmasaydı sarılır ve dört alan iki
    // satıra bölünürdü.
    //
    // ÖLÇÜM SATIRIN KENDİSİNDEN alınır, sayfanın tamamından değil: firmanın
    // telefonu 22.08.2026 tasarımıyla KİMDEN kartında da geçiyor ve sayfa
    // metninde aranan ilk telefon artık künyenin değil kartın telefonudur.
    const kapak = (await pdfSayfalari(fikstur()))[0];
    const kunye = kapak.split(/\r?\n/).find((satir) => satir.includes(COMPANY.address)) ?? "";
    expect(kunye).toContain(COMPANY.phone);
    expect(kunye).toContain(COMPANY.email);
    expect(kunye).toContain(COMPANY.web);
  });

  it("doküman satırı MARKAYLA açılır ve her yaprakta durur", async () => {
    // Müşteri belgenin bir yaprağını tek başına fotoğraflasa bile kimin, hangi
    // teklifinin, hangi revizyonunun olduğu okunabilmelidir.
    const sayfalar = await pdfSayfalari(fikstur());
    for (const sayfa of sayfalar) {
      expect(duz(sayfa)).toContain(duz("ORION CRANES · TETR-20260127-1 · REV 02"));
    }
    // KAPAKTA KONU DÜŞER (o zaten sayfanın 33 pt'lik başlığıdır); iç
    // sayfalarda satırın kuyruğunda durur.
    expect(duz(sayfalar[0])).not.toContain(duz("27.01.2026 · HABAŞ DÖRTYOL"));
    expect(duz(sayfalar[1])).toContain(duz("27.01.2026 · HABAŞ DÖRTYOL 20T VİNÇ"));
  });
});

describe("kapak", () => {
  it("içindekiler bölümleri GERÇEK sayfa numaralarıyla listeler", async () => {
    // Numara İKİ GEÇİŞLE öğrenilir: bir bölümün kaç yaprak tuttuğu ancak
    // yerleştirildikten sonra bilinir. Tek geçişte "S. —" basılırdı.
    const sayfalar = await pdfSayfalari(fikstur());
    const kapak = duz(sayfalar[0]);
    expect(kapak).toContain(duz("İÇİNDEKİLER"));
    expect(kapak).toContain(duz("S. 02"));
    expect(kapak).toContain(duz("Teknik Özellikler"));
    // Fikstür dört sayfadır: kapak · teknik · ticari · genel şartlar.
    expect(sayfalar.length).toBe(4);
    expect(kapak).toContain(duz("S. 04"));
    expect(kapak).toContain(duz("Genel Şartlar"));
    expect(duz(sayfalar[3])).toContain(duz(GENERAL_TERMS_TITLE));
  });

  it("içindekiler adı ile bölümün kendi başlığı AYRIŞAMAZ", () => {
    // Aynı bölüm iki metinle adlandırılıyor: kartta başlık yazımı, sayfada
    // defterin BÜYÜK HARF başlığı. Biri değişip öteki kalırsa içindekiler var
    // olmayan bir bölümü işaret eder (değişmez md. 8).
    expect(trUpper(OFFER_SECTIONS.sartlar)).toBe(GENERAL_TERMS_TITLE);
  });

  it("kicker belgenin KAPSAMINI söyler — teknik yaprak yoksa 'TİCARİ TEKLİF'", async () => {
    const varsayilan = duz((await pdfSayfalari(fikstur()))[0]);
    expect(varsayilan).toContain(duz("TEKNİK VE TİCARİ TEKLİF"));

    // Kalemsiz bir teklifte teknik yaprak hiç basılmaz; kapakta vaat edilmez.
    const props = fikstur();
    props.payload.items = [];
    const kalemsiz = duz((await pdfSayfalari(props))[0]);
    expect(kalemsiz).toContain(duz("TİCARİ TEKLİF"));
    expect(kalemsiz).not.toContain(duz("TEKNİK VE TİCARİ TEKLİF"));
    // Basılmayan bölüm içindekilerde de listelenmez.
    expect(kalemsiz).not.toContain(duz("Teknik Özellikler"));
  });

  it("künye kartı muhatabı, ünvanını ve müşteri referansını taşır", async () => {
    const kapak = duz((await pdfSayfalari(fikstur()))[0]);
    expect(kapak).toContain(duz("SİNAN ÇOLAKOĞLU · Satış Müdürü"));
    expect(kapak).toContain(duz("ALİCAN ERASLAN"));
    // TEKLIF-36: varsa basılır. Numara MUHATABIN kartındadır, bizimkinde değil.
    expect(kapak).toContain(duz("MÜŞTERİ REF · 6000294866"));
  });

  it("boş alan künyeye HİÇ girmez — yer tutucu bir değer değildir", async () => {
    const props = fikstur();
    props.payload.cover.customerRef = "";
    props.payload.cover.toPhone = "";
    const kapak = duz((await pdfSayfalari(props))[0]);
    expect(kapak).not.toContain(duz("MÜŞTERİ REF"));
  });

  it("iş kolları listesi kapakta, onuncu maddesine kadar", async () => {
    const kapak = duz((await pdfSayfalari(fikstur()))[0]);
    expect(kapak).toContain(duz(COMPANY_PROFILE.linesTitle));
    for (const satir of COMPANY_PROFILE.lines) expect(kapak).toContain(duz(satir));
  });

  it("EN UZUN içerikte bile TEK SAYFADA kalır — kapak sıkışır, taşmaz", async () => {
    // Aynı anda: dört satırlık konu, künyede saran müşteri unvanı, uzun
    // ünvan/bölüm satırları ve iki imzacı. Tasarımın nefes payları bu yığında
    // taşıyordu ve @react-pdf taşan bloğu SESSİZCE ikinci bir yaprağa
    // atıyordu — müşteriye altbilgiden ibaret boş bir sayfa gidiyordu.
    // `renderOfferPdf` yerleşimi ÖLÇER ve kapağın payını kısar.
    const props = fikstur();
    props.offer.subject =
      "İSDEMİR AMONYUM SÜLFAT TESİSİ VİNÇLERİ VE TRANSFER ARABALARI İÇİN TEKNİK VE TİCARİ TEKLİF ÇALIŞMASI";
    props.offer.customerName = "HABAŞ SINAİ VE TIBBİ GAZLAR İSTİHSAL ENDÜSTRİSİ A.Ş.";
    props.payload.cover.fromTitle = "Satış ve Pazarlama Müdür Yardımcısı";
    props.payload.cover.toDept = "Satın Alma ve Tedarik Zinciri Müdürlüğü";
    props.payload.cover.signatories = [
      { name: "SİNAN ÇOLAKOĞLU", title: "Satış Müdürü" },
      { name: "SALİH ERGÜVEN", title: "Genel Müdür" },
    ];

    const sayfalar = await pdfSayfalari(props);
    // İkinci yaprak TEKNİK sayfadır — kapağın devamı değil.
    expect(duz(sayfalar[1])).toContain(duz("TEKNİK ÖZELLİKLER"));
    // Sıkışan şey BOŞLUKTUR, içerik değil: konu, künye ve firma beyanı yerinde.
    const kapak = duz(sayfalar[0]);
    expect(kapak).toContain(duz("İSDEMİR AMONYUM SÜLFAT TESİSİ"));
    expect(kapak).toContain(duz("MÜŞTERİ REF · 6000294866"));
    expect(kapak).toContain(duz("ORION CRANES, kaldırma ve iletme"));
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

  it("toplam şeridindeki rozet cümleyle AYNI bayraktan türer", () => {
    // Rozet ile cümlenin ayrışması, aynı sayfada birbirini yalanlayan iki
    // KDV ifadesi demekti — devralınan tekliflerin gerçek hatası buydu.
    expect(vatBadge(false)).toBe("KDV HARİÇ");
    expect(vatBadge(true)).toBe("KDV DAHİL");
    expect(vatNote(false).includes("dahil değildir")).toBe(true);
    expect(vatNote(true).includes("dahildir")).toBe(true);
  });
});

describe("kalem bazında teslim süresi", () => {
  it("sütun KAPALIYKEN belgede iz bırakmaz — değerler korunsa bile", async () => {
    // Kullanıcı sütunu kapatıp yeniden açtığında yazdıkları yerinde durmalıdır;
    // ama kapalıyken müşteriye giden belgede ne başlık ne hücre görünür.
    const props = fikstur();
    props.payload.pricing.leadTimeUnit = null;
    props.payload.pricing.lines[0].leadTime = "12-14";
    const metin = duz(await pdfMetni(props));
    expect(metin).not.toContain(duz("12-14"));
    expect(metin).not.toContain(duz("(HAFTA)"));
  });

  it("açıkken başlık BİRİMİ taşır ve hücre aralık yazabilir", async () => {
    const props = fikstur();
    props.payload.pricing.leadTimeUnit = "hafta";
    props.payload.pricing.lines[0].leadTime = "12-14";
    const metin = duz(await pdfMetni(props));
    expect(metin).toContain(duz("TESLİM"));
    expect(metin).toContain(duz("(HAFTA)"));
    expect(metin).toContain(duz("12-14"));

    // BİRİM SÜTUN BAŞLIĞINDADIR, satırda değil: "ay" seçilince başlık değişir.
    props.payload.pricing.leadTimeUnit = "ay";
    const ay = duz(await pdfMetni(props));
    expect(ay).toContain(duz("(AY)"));
    expect(ay).not.toContain(duz("(HAFTA)"));
  });

  it("değeri girilmemiş satırın hücresi BOŞ kalır — sıfır ya da tire değil", async () => {
    const props = fikstur();
    props.payload.pricing.leadTimeUnit = "hafta";
    // Hiçbir satıra süre yazılmadı; sütun açık ama hücreler boş.
    const sayfalar = await pdfSayfalari(props);
    const ticari = sayfalar.find((s) => duz(s).includes(duz("(HAFTA)"))) ?? "";
    const satir = ticari.split(/\r?\n/).find((l) => l.includes("GEZER KÖPRÜLÜ VİNÇ")) ?? "";
    expect(satir).not.toContain("0");
    expect(satir).not.toContain("—");
  });
});

describe("fiyat tablosu yaprağı", () => {
  it("eşiğin altında ticari sayfada durur", async () => {
    const sayfalar = await pdfSayfalari(fikstur());
    // Fikstürde üç fiyat satırı var (biri gizli): eşiğin çok altında.
    const ticari = sayfalar.find((s) => duz(s).includes(duz("TESLİM ŞARTLARI"))) ?? "";
    expect(duz(ticari)).toContain(duz("TOPLAM"));
    expect(duz(ticari)).toContain(duz("Notlar".toLocaleUpperCase("tr-TR")));
  });

  it("eşiğin üstünde KENDİ yaprağına geçer ve İKİYE BÖLÜNMEZ", async () => {
    // Kullanıcı kararı (22.08.2026): 12 satırın üstünde tablo ayrı sayfaya
    // geçer. Ölçülen şey satırların TEK yaprakta olmasıdır — bir tablonun
    // yarısı bir sayfada yarısı ötekinde okunduğunda toplam yanlış anlaşılır.
    const props = fikstur();
    const ilk = props.payload.pricing.lines[0];
    props.payload.pricing.lines = Array.from({ length: FIYAT_SATIR_ESIGI + 3 }, (_, i) => ({
      ...ilk,
      id: `satir-${i}`,
      parentLineId: null,
      description: `KALEM ${i + 1}`,
      qty: 1,
      unitPrice: 1000 * (i + 1),
      hidden: false,
    }));

    const sayfalar = await pdfSayfalari(props);
    const fiyatSayfalari = sayfalar.filter((s) => duz(s).includes(duz("KALEM 1 ")));
    expect(fiyatSayfalari.length).toBeGreaterThan(0);
    const fiyat = sayfalar.find((s) => duz(s).includes(duz("BİRİM FİYAT"))) ?? "";
    // Bütün satırlar AYNI yaprakta.
    for (let i = 1; i <= FIYAT_SATIR_ESIGI + 3; i++) {
      expect(duz(fiyat)).toContain(duz(`KALEM ${i}`));
    }
    // Ve o yaprak TİCARİ ŞARTLAR yaprağı DEĞİLDİR.
    expect(duz(fiyat)).not.toContain(duz("TESLİM ŞARTLARI"));
    // İçindekiler de yeni yaprağı listeler.
    expect(duz(sayfalar[0])).toContain(duz(OFFER_SECTIONS.fiyat));
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

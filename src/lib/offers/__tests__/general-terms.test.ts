// GENEL ŞARTLARIN KORUMA TESTLERİ.
//
// Sınanan şey metnin kendisi değil ONA DAİR KURALLARDIR: numaranın veri
// olmaması, taşımanın metni sessizce eklememesi ve gizlenen bir maddenin
// numarasını da götürmesi. Üçü de belgeye bakmadan fark edilemeyecek,
// müşteriye giden bir sayfada yaşayacak hatalardır.

import { describe, expect, it } from "vitest";
import { paymentDescText, paymentLineText } from "../pricing";
import { GENERAL_TERMS_TITLE, GENERAL_TERM_DEFS } from "../registry";
import {
  emptyPayload,
  hiddenCount,
  newGeneralTerm,
  printedGeneralTerms,
  printedPayload,
  withDefaultGeneralTerms,
  withDefaults,
} from "../payload";

describe("genel şartlar defteri", () => {
  it("on madde taşır ve başlığı vardır", () => {
    expect(GENERAL_TERM_DEFS).toHaveLength(10);
    expect(GENERAL_TERMS_TITLE).toBe("GENEL ŞARTLAR");
  });

  it("anahtarlar TEKİLDİR", () => {
    const anahtarlar = GENERAL_TERM_DEFS.map((d) => d.key);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it("hiçbir maddenin başlığı ya da gövdesi boş değildir", () => {
    for (const def of GENERAL_TERM_DEFS) {
      expect(def.key.trim(), `anahtar: ${def.key}`).not.toBe("");
      expect(def.title.trim(), `başlık: ${def.key}`).not.toBe("");
      expect(def.body.trim(), `gövde: ${def.key}`).not.toBe("");
    }
  });

  // NUMARA METNE GÖMÜLMEZ. Gömülseydi üçüncü madde kapatıldığında belge
  // "1, 2, 4, 5…" diye basar ve düzeltmek on maddenin metnini elden geçirmek
  // olurdu — kaynak metindeki "1." "2." başlıkları bu yüzden atıldı.
  it("başlıklar madde numarası taşımaz", () => {
    for (const def of GENERAL_TERM_DEFS) {
      expect(def.title, `başlık: ${def.key}`).not.toMatch(/^\s*\d+\s*[.)]/);
    }
  });
});

// ————————————————————————————————————————————————————————— metin donar

/**
 * METİN DONDURULUR — defterin kendi kuralı sınanır.
 *
 * `registry.ts` metin için *"kelimesi değiştirilmeden durur: bu bir HUKUKÎ
 * BEYANdır"* diyor, ama o cümleyi hiçbir şey KORUMUYORDU: bir maddeyi "daha
 * akıcı" yazmak, bir cümleyi düşürmek ya da bir rakamı değiştirmek testlerin
 * hiçbirini düşürmezdi ve fark tek yerde görünürdü — müşteriye giden belgede.
 *
 * Ölçü GÖVDENİN KARAKTER SAYISIDIR. Sözcüğü sınamak metnin tamamını teste
 * kopyalamak (iki kaynak, ikisi de "asıl") demekti; uzunluk tek bir harfin
 * eklenmesini de düşürür ve satır birleştirmede yutulan boşluğu da yakalar —
 * `"…kapsam için " + "geçerlidir"`in son boşluğu düşerse metin bir karakter
 * kısalır ve belge "kapsam içingeçerlidir" basar.
 *
 * BU TEST DEĞİŞTİRİLEBİLİR ama KENDİLİĞİNDEN DEĞİL: düştüğünde doğru tepki
 * sayıyı güncellemek değil, metnin neden değiştiğini SORMAKTIR. Kullanıcı
 * metni yenilediyse tablo onunla birlikte elle güncellenir.
 */
const DONMUS_METIN = [
  { key: "scope", title: "Kapsam ve Öncelik", uzunluk: 258 },
  { key: "order", title: "Sipariş ve Değişiklikler", uzunluk: 338 },
  { key: "price", title: "Fiyat ve Ödeme", uzunluk: 442 },
  { key: "delivery", title: "Teslim Süresi", uzunluk: 271 },
  { key: "acceptance", title: "Teslim, Risk ve Kabul", uzunluk: 667 },
  { key: "warranty", title: "Garanti", uzunluk: 524 },
  { key: "compliance", title: "Mevzuat, Standartlar ve Dokümantasyon", uzunluk: 283 },
  { key: "liability", title: "Sorumluluk ve Mücbir Sebep", uzunluk: 521 },
  { key: "cancellation", title: "Siparişin İptali", uzunluk: 270 },
  { key: "ip", title: "Fikri Haklar ve Uygulanacak Hukuk", uzunluk: 369 },
] as const;

describe("metin HUKUKÎ BEYANdır ve donar", () => {
  it("maddelerin sırası, başlıkları ve gövde uzunlukları birebir korunur", () => {
    expect(GENERAL_TERM_DEFS.map((d) => d.key)).toEqual(DONMUS_METIN.map((d) => d.key));
    for (const [i, beklenen] of DONMUS_METIN.entries()) {
      const def = GENERAL_TERM_DEFS[i];
      expect(def.title, `başlık: ${beklenen.key}`).toBe(beklenen.title);
      expect(def.body.length, `gövde uzunluğu: ${beklenen.key}`).toBe(beklenen.uzunluk);
    }
  });

  /**
   * SAYISAL TAAHHÜTLER metinden okunur.
   *
   * Uzunluk testi "24 ay"ın "36 ay" olmasını yakalamaz (aynı karakter sayısı).
   * Bu rakamlar maddelerin söylediği ŞEYDİR: garanti süresi, kabul için
   * verilen süre, gecikme cezasının tavanı ve yetkili mahkeme. Bir teklifin
   * hukukî içeriği bu dört satırda yaşar.
   */
  it("garanti, kabul, ceza tavanı ve yetkili mahkeme rakamları değişmez", () => {
    const madde = (key: string) => {
      const d = GENERAL_TERM_DEFS.find((x) => x.key === key);
      if (!d) throw new Error(`defterde ${key} maddesi yok`);
      return d.body;
    };
    expect(madde("warranty")).toContain("devreye alma tarihinden itibaren 24 ay");
    expect(madde("warranty")).toContain("fatura tarihinden itibaren 30 ayı aşmaz");
    expect(madde("acceptance")).toContain("başlanmasından itibaren 1 hafta");
    expect(madde("acceptance")).toContain("bildirilmesinden itibaren 2 hafta");
    expect(madde("liability")).toContain("toplam gecikme cezası sözleşme bedelinin %5'ini aşamaz");
    expect(madde("liability")).toContain("sözleşme bedeli ile sınırlıdır");
    expect(madde("ip")).toContain("Türk hukuku uygulanır");
    expect(madde("ip")).toContain("Ankara Mahkemeleri ve İcra Daireleri yetkilidir");
  });

  /**
   * Gövdeler kaynak dosyada satır satır BİRLEŞTİRİLİR (`"…" + "…"`). O yazımın
   * tek sessiz hatası boşluktur: fazlası çift boşluk, eksiği yapışık kelime
   * yapar ve ikisi de yalnız basılmış belgede görülür.
   */
  it("birleştirilen satırlarda boşluk kusuru yoktur", () => {
    for (const def of GENERAL_TERM_DEFS) {
      expect(def.body, `çift boşluk: ${def.key}`).not.toMatch(/ {2}/);
      expect(def.body, `baş/son boşluk: ${def.key}`).toBe(def.body.trim());
      expect(def.body, `cümle sonu: ${def.key}`).toMatch(/\.$/);
    }
  });
});

describe("yeni belge · taşıma · defterden getirme", () => {
  it("yeni teklif on maddeyi de AÇIK taşır", () => {
    const p = emptyPayload();
    expect(p.generalTerms).toHaveLength(10);
    expect(p.generalTerms.every((t) => t.hidden !== true)).toBe(true);
    expect(p.generalTerms.map((t) => t.key)).toEqual(GENERAL_TERM_DEFS.map((d) => d.key));
    // Kimlik her maddede ayrıdır; gizleme/silme tek maddeyi hedefleyebilsin.
    expect(new Set(p.generalTerms.map((t) => t.id)).size).toBe(10);
  });

  // TAŞIMA VARSAYILAN UYGULAMAZ (TEKLIF-14 / MALIYET-22 ayrımı): eski
  // tekliflerde bu bölüm hiç yoktu ve taşıma onları eklerse YAYIMLANMIŞ bir
  // belgenin metni sonradan değişmiş olur.
  it("eski belgede alan yoksa bölüm BOŞ gelir", () => {
    expect(withDefaults({}).generalTerms).toEqual([]);
  });

  it("belgedeki maddeler taşınır; gizleme kararı korunur", () => {
    const p = withDefaults({
      generalTerms: [
        { id: "a", key: "scope", title: "Kapsam", body: "Metin.", hidden: true },
        { key: "", title: "Kendi Maddem", body: "Gövde." },
      ],
    });
    expect(p.generalTerms).toHaveLength(2);
    expect(p.generalTerms[0]).toMatchObject({ id: "a", key: "scope", hidden: true });
    // Kimliksiz maddeye kimlik verilir, verisi korunur.
    expect(p.generalTerms[1].id).not.toBe("");
    expect(p.generalTerms[1].title).toBe("Kendi Maddem");
  });

  it("defterden getirme BOŞ bölümü doldurur", () => {
    const p = withDefaultGeneralTerms(withDefaults({}));
    expect(p.generalTerms.map((t) => t.key)).toEqual(GENERAL_TERM_DEFS.map((d) => d.key));
  });

  it("defterden getirme DOLU bölüme DOKUNMAZ", () => {
    const once = withDefaults({
      generalTerms: [{ key: "scope", title: "Kapsam", body: "Sadece bu kaldı." }],
    });
    const sonra = withDefaultGeneralTerms(once);
    expect(sonra.generalTerms).toHaveLength(1);
    expect(sonra).toBe(once);
  });
});

describe("numara SÜZGEÇTEN SONRA türetilir", () => {
  it("gizlenen madde numarasını da götürür, kalanlar kesintisiz sayılır", () => {
    const p = emptyPayload();
    const ucuncu = p.generalTerms[2];
    p.generalTerms = p.generalTerms.map((t) => (t.id === ucuncu.id ? { ...t, hidden: true } : t));

    const basilan = printedGeneralTerms(p);
    expect(basilan).toHaveLength(9);
    expect(basilan.map((t) => t.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(basilan.some((t) => t.title === ucuncu.title)).toBe(false);
    // Üçüncü sıradaki numara artık DÖRDÜNCÜ maddenindir.
    expect(basilan[2].title).toBe(p.generalTerms[3].title);
  });

  it("hepsi açıkken numaralar defterin sırasını izler", () => {
    const basilan = printedGeneralTerms(emptyPayload());
    expect(basilan.map((t) => t.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(basilan[0].title).toBe(GENERAL_TERM_DEFS[0].title);
    expect(basilan[9].title).toBe(GENERAL_TERM_DEFS[9].title);
  });

  /**
   * NUMARA BELGENİN SIRASINDAN GELİR, DEFTERİN SIRASINDAN DEĞİL.
   *
   * Kullanıcı maddeleri editörde yeniden sıralayabilir; numara defterdeki
   * yerine bakarak üretilseydi belge "3, 1, 2" diye basar ya da taşıma
   * sırasında sessizce yeniden dizilirdi. Sıra bir VERİDİR ve korunur.
   */
  it("madde sırası belgenindir; taşıma da numara da onu izler", () => {
    const p = emptyPayload();
    const tersi = [...p.generalTerms].reverse();
    const tasinan = withDefaults({ generalTerms: tersi });
    expect(tasinan.generalTerms.map((t) => t.key)).toEqual(
      [...GENERAL_TERM_DEFS].reverse().map((d) => d.key)
    );
    const basilan = printedGeneralTerms(tasinan);
    expect(basilan[0].title).toBe(GENERAL_TERM_DEFS[9].title);
    expect(basilan[9].title).toBe(GENERAL_TERM_DEFS[0].title);
    expect(basilan.map((t) => t.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("sözsüz madde basılmaz ve numara almaz", () => {
    const p = emptyPayload();
    p.generalTerms = [newGeneralTerm("", ""), newGeneralTerm("Ek Şart", "Gövde.")];
    const basilan = printedGeneralTerms(p);
    expect(basilan).toHaveLength(1);
    expect(basilan[0]).toEqual({ no: 1, title: "Ek Şart", body: "Gövde." });
  });
});

describe("kullanıcının maddesi defterle karışmaz", () => {
  it("elle eklenen maddenin anahtarı BOŞTUR", () => {
    const madde = newGeneralTerm("Ek Şart", "Gövde.");
    expect(madde.key).toBe("");
    expect(GENERAL_TERM_DEFS.some((d) => d.key === madde.key)).toBe(false);
  });

  it("iki elle eklenen madde birbirine karışmaz", () => {
    const p = emptyPayload();
    const a = newGeneralTerm("Birinci", "A gövdesi.");
    const b = newGeneralTerm("İkinci", "B gövdesi.");
    p.generalTerms = [...p.generalTerms, a, b];

    // Anahtarları aynı (boş) olduğu için ayrım KİMLİKLEDİR.
    expect(a.id).not.toBe(b.id);
    p.generalTerms = p.generalTerms.map((t) => (t.id === a.id ? { ...t, hidden: true } : t));
    const basilan = printedGeneralTerms(p);
    expect(basilan.some((t) => t.title === "Birinci")).toBe(false);
    expect(basilan.some((t) => t.title === "İkinci")).toBe(true);
  });

  it("defter maddesinin başlığını değiştirmek onu defterden koparmaz", () => {
    const p = emptyPayload();
    p.generalTerms = p.generalTerms.map((t) =>
      t.key === "warranty" ? { ...t, title: "Garanti Koşulları" } : t
    );
    const garanti = p.generalTerms.find((t) => t.key === "warranty");
    expect(garanti?.title).toBe("Garanti Koşulları");
    expect(garanti?.key).toBe("warranty");
  });
});

describe("basılan belge", () => {
  it("gizlenen madde PDF'e HİÇ girmez", () => {
    const p = emptyPayload();
    p.generalTerms = p.generalTerms.map((t) => (t.key === "price" ? { ...t, hidden: true } : t));
    const basilan = printedPayload(p);
    expect(basilan.generalTerms).toHaveLength(9);
    expect(basilan.generalTerms.some((t) => t.key === "price")).toBe(false);
  });

  it("bölüm bütünüyle kapatılırsa belgede madde kalmaz", () => {
    const p = emptyPayload();
    p.generalTerms = p.generalTerms.map((t) => ({ ...t, hidden: true }));
    expect(printedPayload(p).generalTerms).toEqual([]);
    expect(printedGeneralTerms(p)).toEqual([]);
  });

  /**
   * KAPATILAN ŞART MADDESİ EDİTÖRDEKİ GİZLİ SAYACINA GİRER — bilinçli bir
   * DAVRANIŞ DEĞİŞİKLİĞİdir, bu yüzden donduruluyor.
   *
   * Sayaç "gizlemek sessiz kalmasın" diye vardır ve bir şartı kapatmak
   * belgenin teknik değil HUKUKÎ içeriğini değiştirir: gizlemenin en pahalı
   * hâli tam olarak budur ve sayaçtan düşen tek şey o olmamalıdır.
   */
  it("kapatılan şart maddesi 'N gizli' sayacına girer", () => {
    const p = emptyPayload();
    expect(hiddenCount(p)).toBe(0);
    p.generalTerms = p.generalTerms.map((t, i) => (i === 0 ? { ...t, hidden: true } : t));
    expect(hiddenCount(p)).toBe(1);
    p.generalTerms = p.generalTerms.map((t) => ({ ...t, hidden: true }));
    expect(hiddenCount(p)).toBe(10);
  });
});

// ————————————————————————————————————————————————— ödeme planı

describe("ödeme satırında yüzde İKİ KEZ yazılmaz", () => {
  it("açıklamanın başındaki yüzde sökülür", () => {
    // Kullanıcı bildirimi (18.08.2026): belge "%40 %40 Avans Sipariş ile
    // Nakit" basıyordu. Yüzde SOLDAKİ kutunun alanıdır; açıklama yalnız
    // yazıdır.
    expect(paymentDescText("%40 Avans Sipariş ile Nakit")).toBe("Avans Sipariş ile Nakit");
    expect(paymentDescText("%40  Teslimat Sonrası Nakit")).toBe("Teslimat Sonrası Nakit");
    expect(paymentDescText("% 12,5 Kalan")).toBe("Kalan");
    // Yüzde taşımayan açıklama olduğu gibi kalır.
    expect(paymentDescText("Avans Sipariş ile Nakit")).toBe("Avans Sipariş ile Nakit");
    // İÇERİDEKİ yüzde SÖKÜLMEZ — yalnız baştaki.
    expect(paymentDescText("Kalan %10 gecikme faizi")).toBe("Kalan %10 gecikme faizi");
    expect(paymentDescText(null)).toBe("");
  });

  it("basılan satır yüzdeyi BİR KEZ taşır", () => {
    expect(paymentLineText({ percent: 40, desc: "%40 Avans Sipariş ile Nakit", text: "" })).toBe(
      "%40 Avans Sipariş ile Nakit"
    );
    expect(paymentLineText({ percent: 60, desc: "Teslimat Sonrası Nakit", text: "" })).toBe(
      "%60 Teslimat Sonrası Nakit"
    );
  });

  it("taşıma eski kaydı TEMİZLER", () => {
    const p = withDefaults({
      terms: { paymentLines: [{ id: "a", percent: 40, desc: "%40 Avans Sipariş ile Nakit" }] },
    });
    expect(p.terms.paymentLines[0].desc).toBe("Avans Sipariş ile Nakit");
    expect(paymentLineText(p.terms.paymentLines[0])).toBe("%40 Avans Sipariş ile Nakit");
  });
});

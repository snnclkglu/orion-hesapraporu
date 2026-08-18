// TEKLİFTE İSTENEN ↔ HESAPLANAN ŞERİDİ, EZİLEN DEĞERİN AKIŞI VE SEÇİLEN KESİT.
//
// Bu dosya ÜÇ AYRI SESSİZ BOZULMAYA karşıdır; üçü de ekrana bakarak fark
// edilemeyen türdendir.
//
// 1. AYRIŞTIRMA. Şerit sayıyı `trSayi` ile değil kendi ayıklayıcısıyla okur
//    (`compare.ts`in başındaki gerekçe): teklifte hızlar ARALIKLA ("1-6"),
//    halat donanımı ise BÖLÜ ile ("4/1") yazılır ve `trSayi` ikisini de
//    bozar — birincisini `NaN` sayar, ikincisinden 41 üretir. Aralıkta istenen
//    sayı ÜST UÇTUR; alt ucu almak, kapasitesi yetmeyen bir motoru "uygun"
//    göstermenin en kısa yoluydu.
//
// 2. EZİLEN DEĞERİN AKIŞI (kullanıcı md. 1/3/5). Halat donanımını 8'e çeken
//    mühendis halat yükünün, tambur momentinin, tahvil oranının, redüktörün ve
//    TOPLAM VİNÇ AĞIRLIĞININ da onunla değişmesini bekler. Ezme bir SONUÇ
//    YAMASI olsaydı ekranda düzelen sayı maliyette düzelmezdi: ASTOR'da
//    donanım 8'e çekilince vinç 59.500 kg'dan 58.500 kg'a iner ve o 1.000 kg
//    doğrudan hammadde, işçilik ve boya satırlarının miktarıdır.
//
// 3. SEÇİLEN KESİT (kullanıcı md. 6). `sectionName` yalnız bir etikettir;
//    kullanıcı "bu kesit neye göre seçildi" diye sorduğunda cevabı — ham
//    ölçüler, alan, atalet, kg/m — ekranda görebilmelidir.
//
// Fikstür `/dev/offer-cost-preview` sayfasındaki ASTOR teklif kaleminin
// AYNISIDIR (devralınan "ÖRNEK ASTOR 32T × 30 m Portal Vinç Teklif Maliyet
// Çalışması V3"): uydurma yuvarlak sayılarla ("10 ton, 5 m") ne aralık yazımı
// ne de bir teker boyu kaymasının %25'lik sapması görünürdü.

import { describe, expect, it } from "vitest";
import { emptyPayload, groupFromKey, newOfferId } from "../../payload";
import type { OfferItem, OfferPayload } from "../../types";
import {
  COST_DEVIATION_LIMIT,
  costCompareRows,
  costDeviationLevel,
  costNumbersIn,
} from "../compare";
import type { CostCompareRow } from "../compare";
import { costFieldDef, costFieldEditable } from "../labels";
import { hesapla } from "../model";
import type { CostModelResult } from "../model";
import { costFirstNumber, costUpperBound } from "../oku";
import { COST_PARAM_DEFAULTS, SECTION_TABLE, sectionProps } from "../params";
import { inputsFromOfferItem } from "../payload";
import type { CostInputs } from "../types";

/**
 * ASTOR 32 T × 30 m TAM PORTAL — teklif kaleminin kendisi.
 *
 * `/dev/offer-cost-preview` fikstürünün birebir ikizidir; tek fark HALAT
 * DONANIMI satırının doldurulmasıdır ("4/1"). Önizleme onu boş bırakıyor,
 * şerit ise o satırı okumak zorunda: teklifte söz verilen kat sayısı ile
 * hesabın seçtiği kat sayısı ayrışırsa tambur da motor da yanlış boydadır.
 */
function astorKalemi(): OfferItem {
  const item: OfferItem = {
    id: newOfferId(),
    title: "32T x 30m ÇİFT KİRİŞ TAM PORTAL VİNÇ",
    craneType: "Portal Vinç",
    capacityT: 32,
    spanM: 30,
    groups: ["general", "mainHoist", "trolley", "gantry", "steel", "electrical"].map((k) =>
      groupFromKey(k)
    ),
  };
  const parca = (g: string, r: string, parts: Record<string, string>) => {
    const row = item.groups.find((x) => x.key === g)?.rows.find((x) => x.key === r);
    if (row) row.parts = { ...row.parts, ...parts };
  };
  const deger = (g: string, r: string, v: string) => {
    const row = item.groups.find((x) => x.key === g)?.rows.find((x) => x.key === r);
    if (row) row.value = v;
  };
  parca("general", "capacity", { main: "32" });
  parca("general", "span", { value: "30" });
  parca("general", "liftHeight", { value: "12" });
  parca("general", "gantryLegHeight", { value: "12" });
  deger("general", "craneClass", "FEM 3m / M6");
  deger("general", "craneType", "Portal Vinç");
  parca("mainHoist", "liftSpeed", { range: "4" });
  deger("mainHoist", "reeving", "4/1");
  parca("mainHoist", "motor", { brand: "GAMAK", power: "30", rpm: "1500" });
  parca("trolley", "travelSpeed", { range: "20" });
  parca("trolley", "motor", { count: "2", brand: "GAMAK", power: "1,5" });
  parca("gantry", "travelSpeed", { range: "20" });
  parca("gantry", "motor", { count: "4", brand: "GAMAK", power: "1,5" });
  parca("gantry", "wheel", { count: "8", dia: "400" });
  return item;
}

function teklif(items: OfferItem[]): OfferPayload {
  return { ...emptyPayload("EUR"), items };
}

/** Girdiler TEKLİFTEN okunur — elle kurulmaz ki şerit gerçek yolu sınasın. */
const ASTOR: CostInputs = inputsFromOfferItem(astorKalemi());

const model = (overrides: Record<string, number> = {}): CostModelResult =>
  hesapla(ASTOR, { ...COST_PARAM_DEFAULTS }, overrides);

const bul = (rows: CostCompareRow[], key: string): CostCompareRow | undefined =>
  rows.find((r) => r.key === key);

// ————————————————————————————————————————————————————— A. ayrıştırma

describe("sayı ayıklama TÜRKÇE yazımdır", () => {
  it("nokta BİNLİK, virgül ONDALIK ayracıdır — '1.500' bin beş yüzdür, bir buçuk değil", () => {
    expect(costNumbersIn("1.500")).toEqual([1500]);
    expect(costNumbersIn("5,5")).toEqual([5.5]);
    expect(costNumbersIn("1.887.408,48 cm⁴")).toEqual([1887408.48]);
  });

  it("ARALIK iki sayı verir — boşluklu yazılsa da", () => {
    expect(costNumbersIn("1-6")).toEqual([1, 6]);
    expect(costNumbersIn("20 - 30")).toEqual([20, 30]);
  });

  it("halat donanımı yazımı '4/1' iki sayı verir — bölü silinip 41 ÜRETİLMEZ", () => {
    expect(costNumbersIn("4/1")).toEqual([4, 1]);
  });

  it("boş metinden sayı UYDURULMAZ — sıfır değil, boş dizi", () => {
    expect(costNumbersIn(null)).toEqual([]);
    expect(costNumbersIn(undefined)).toEqual([]);
    expect(costNumbersIn("")).toEqual([]);
    expect(costNumbersIn("Müşteri Kapsamında")).toEqual([]);
  });
});

// —————————————————————————————————————————————————————— B. şerit

describe("teklif kalemi yoksa şerit BOŞ döner — sıfırlarla dolu bir şerit değil", () => {
  const item = astorKalemi();
  const t = teklif([item]);

  it("serbest maliyet kaleminin (offerItemId null) karşılaştıracağı belge yoktur", () => {
    expect(costCompareRows(t, null, ASTOR, model())).toEqual([]);
  });

  it("teklifte artık bulunmayan kimlik de boş şerit verir", () => {
    expect(costCompareRows(t, newOfferId(), ASTOR, model())).toEqual([]);
    expect(costCompareRows(teklif([]), item.id, ASTOR, model())).toEqual([]);
  });
});

describe("ASTOR şeridi — teklifte yazan ile hesaptan çıkan", () => {
  const item = astorKalemi();
  const rows = costCompareRows(teklif([item]), item.id, ASTOR, model());

  it("künye satırları teklifin künyesinden okunur", () => {
    expect(bul(rows, "capacity")?.requested).toBe(32);
    expect(bul(rows, "capacity")?.calculated).toBe(32);
    expect(bul(rows, "span")?.requested).toBe(30);
    expect(bul(rows, "liftHeight")?.requested).toBe(12);
  });

  it("İSTENEN her zaman TEKLİFTEN taze okunur — maliyetin GİRDİSİNDEN değil", () => {
    // Girdiler teklifin bir KOPYASIDIR ve elle düzeltilebilir. Burada kapasite
    // 25 tona çekilmiş, teklifte hâlâ 32 ton yazıyor. Şerit girdiyi okusaydı
    // belgeyi KENDİSİYLE karşılaştırır ve sapmayı her zaman sıfır gösterirdi —
    // yani tam olarak sorduğumuz soruyu cevaplayamazdı.
    const elle: CostInputs = { ...ASTOR, capacityT: 25 };
    const r = bul(costCompareRows(teklif([item]), item.id, elle, hesapla(elle, { ...COST_PARAM_DEFAULTS })), "capacity");
    expect(r?.requested).toBe(32);
    expect(r?.calculated).toBe(25);
    expect(r?.deviation).toBeCloseTo(-7 / 32, 6);
    expect(costDeviationLevel(r?.deviation ?? null)).toBe("sapma");
  });

  it("teker çapı satırları ⌀ işareti taşır", () => {
    expect(bul(rows, "bridgeWheel")?.prefix).toBe("⌀");
    expect(bul(rows, "trolleyWheel")?.prefix).toBe("⌀");
    expect(bul(rows, "capacity")?.prefix).toBeUndefined();
  });

  it("teker çapının hesaptaki karşılığı ETKİN çaptır — portal ⌀400, araba ⌀315", () => {
    expect(bul(rows, "bridgeWheel")?.requested).toBe(400);
    expect(bul(rows, "bridgeWheel")?.calculated).toBe(400);
    // Teklifte araba tekeri yazılmamış: istenen yok, hesaplanan var.
    expect(bul(rows, "trolleyWheel")?.requestedText).toBeNull();
    expect(bul(rows, "trolleyWheel")?.calculated).toBe(315);
  });

  it("halat donanımında '4/1' yazımından İLK sayı alınır — 4 kat", () => {
    const r = bul(rows, "reeving");
    expect(r?.requestedText).toBe("4/1");
    expect(r?.requested).toBe(4);
    expect(r?.calculated).toBe(4);
    expect(r?.deviation).toBe(0);
  });
});

describe("hızlarda ARALIĞIN ÜST UCU istenen sayıdır", () => {
  /** Teklifte "1-6 m/dk" yazan bir kaldırma — firmanın olağan yazımı. */
  const item = astorKalemi();
  const row = item.groups.find((g) => g.key === "mainHoist")?.rows.find((r) => r.key === "liftSpeed");
  if (row) row.parts = { ...row.parts, range: "1-6" };
  // İKİ TARAF DA AYNI OKUYUCUDAN geçer: girdiyi `inputsFromOfferItem`, şeridi
  // `costCompareRows` okur. Farklı okusalardı sapma satırı vincin değil kendi
  // ayrıştırma farkının ölçüsü olurdu.
  const inputs = inputsFromOfferItem(item);
  const rows = costCompareRows(teklif([item]), item.id, inputs, hesapla(inputs, { ...COST_PARAM_DEFAULTS }));
  const hiz = bul(rows, "liftSpeed");

  it("girdi de şerit de 6 m/dk okur — aralık `null` DÜŞMEZ", () => {
    expect(inputs.liftSpeedMpm).toBe(6);
    expect(hiz?.requested).toBe(6);
    expect(hiz?.calculated).toBe(6);
    expect(costDeviationLevel(hiz?.deviation ?? null)).toBe("uygun");
  });

  it("ekranda teklifin YAZDIĞI metin durur — '1-6', '6' değil", () => {
    expect(hiz?.requestedText).toBe("1-6");
  });

  it("ÜST UÇ okunur, İLK sayı DEĞİL — ikisi aynı metinden iki farklı vinç çıkarır", () => {
    // Şerit hızı `costUpperBound`la, halat donanımını `costFirstNumber`la
    // okur; ikisi AYNI metne bakıp farklı cevap verir ve karar hangisinin
    // nerede çağrıldığıdır.
    expect(costUpperBound("1-6")).toBe(6);
    expect(costFirstNumber("1-6")).toBe(1);
    expect(hiz?.requested).toBe(costUpperBound("1-6"));
    // Alt uç seçilseydi hesabın 6 m/dk'sı %500 sapma görünürdü.
    expect(costDeviationLevel((6 - 1) / 1)).toBe("sapma");
  });

  it("aralıklı hız KALDIRMA MEKANİZMASINI de çalıştırır — motor artık boş kalmaz", () => {
    const r = hesapla(inputs, { ...COST_PARAM_DEFAULTS });
    expect(r.values["c.hoistRopeSpeedMpm"]).toBe(24);
    expect(r.values["c.hoistMotorKw"]).not.toBeNull();
  });
});

describe("iki tarafı da boş olan satır HİÇ döndürülmez", () => {
  // Model henüz koşmamış (serbest kalem, girdi eksik): araba tekeri ne
  // teklifte yazıyor ne de hesaptan çıkıyor. "—  —" basmak şeridi okunmaz
  // yapardı.
  const item = astorKalemi();
  const rows = costCompareRows(teklif([item]), item.id, ASTOR, undefined);

  it("araba teker satırı listeye girmez", () => {
    expect(bul(rows, "trolleyWheel")).toBeUndefined();
  });

  it("teklifte yazan taraf tek başına satırı AYAKTA TUTAR", () => {
    expect(bul(rows, "bridgeWheel")?.requested).toBe(400);
    expect(bul(rows, "bridgeWheel")?.calculated).toBeNull();
    expect(bul(rows, "hoistMotor")?.requested).toBe(30);
    expect(bul(rows, "hoistMotor")?.calculated).toBeNull();
  });
});

describe("sapma = (hesaplanan − istenen) ÷ istenen", () => {
  const item = astorKalemi();
  const t = teklif([item]);

  it("teklifte 30 kW yazan motor hesapta 30 kW çıkarsa UYGUN", () => {
    const r = bul(costCompareRows(t, item.id, ASTOR, model()), "hoistMotor");
    expect(r?.requested).toBe(30);
    expect(r?.calculated).toBe(30);
    expect(r?.deviation).toBe(0);
    expect(costDeviationLevel(r?.deviation ?? null)).toBe("uygun");
  });

  it("aynı motor hesapta 37 kW çıkarsa SAPMA — bir kademe eşiğin üstündedir", () => {
    const r = bul(costCompareRows(t, item.id, ASTOR, model({ "c.hoistMotorKw": 37 })), "hoistMotor");
    expect(r?.calculated).toBe(37);
    expect(r?.deviation).toBeCloseTo(7 / 30, 6);
    expect(costDeviationLevel(r?.deviation ?? null)).toBe("sapma");
  });

  it("bir teker boyu (⌀400 → ⌀500) da sapmadır", () => {
    const r = bul(
      costCompareRows(t, item.id, ASTOR, model({ "c.bridgeWheelEffDiaMm": 500 })),
      "bridgeWheel"
    );
    expect(r?.deviation).toBeCloseTo(0.25, 6);
    expect(costDeviationLevel(r?.deviation ?? null)).toBe("sapma");
  });

  it("taraflardan biri yoksa sapma hesaplanmaz — sıfır sayılmaz", () => {
    const rows = costCompareRows(t, item.id, ASTOR, model());
    expect(bul(rows, "trolleyWheel")?.requested).toBeNull();
    expect(bul(rows, "trolleyWheel")?.deviation).toBeNull();
    expect(bul(costCompareRows(t, item.id, ASTOR, undefined), "hoistMotor")?.deviation).toBeNull();
  });

  it("istenen 0 ise sapma YOKTUR — sonsuz bir yüzde basılmaz", () => {
    const sifirli = astorKalemi();
    const row = sifirli.groups
      .find((g) => g.key === "general")
      ?.rows.find((r) => r.key === "liftHeight");
    if (row) row.parts = { ...row.parts, value: "0" };
    const r = bul(costCompareRows(teklif([sifirli]), sifirli.id, ASTOR, model()), "liftHeight");
    expect(r?.requested).toBe(0);
    expect(r?.calculated).toBe(12);
    expect(r?.deviation).toBeNull();
    expect(costDeviationLevel(r?.deviation ?? null)).toBeNull();
  });
});

describe("sapma seviyesinin eşiği %5'tir", () => {
  it("eşiğin KENDİSİ uygundur, üstü sapmadır", () => {
    expect(COST_DEVIATION_LIMIT).toBe(0.05);
    expect(costDeviationLevel(0)).toBe("uygun");
    expect(costDeviationLevel(0.05)).toBe("uygun");
    expect(costDeviationLevel(-0.05)).toBe("uygun");
    expect(costDeviationLevel(0.0501)).toBe("sapma");
    expect(costDeviationLevel(-0.2)).toBe("sapma");
  });

  it("sapma yoksa SEVİYE de yoktur — 'uygun' varsayılmaz", () => {
    expect(costDeviationLevel(null)).toBeNull();
    expect(costDeviationLevel(Number.POSITIVE_INFINITY)).toBeNull();
    expect(costDeviationLevel(Number.NaN)).toBeNull();
  });
});

// ————————————————————————————————— C. ezilen değer aşağıya akar

// HALAT / MOTOR / SÜRÜCÜ SEÇİMLERİ `model.test.ts`TE DONDURULDU; burada yalnız
// aşağıdaki ezme testlerinin "önce"si olan ve orada geçmeyen iki sayı durur.
describe("ASTOR otomatik seçimleri — ezmenin ölçütü budur", () => {
  const r = model();

  it("tambur ⌀410 seçilir ve redüktör 630 kg'a düşer", () => {
    expect(r.values["c.hoistDrumDiaMm"]).toBe(410);
    expect(r.values["c.hoistGearboxKg"]).toBe(630);
  });
});

describe("HALAT DONANIMI 8'e ezilince bütün kaldırma zinciri yeniden çıkar", () => {
  const temiz = model();
  const ezik = model({ "c.hoistRopeCount": 8 });
  const t = (k: string) => temiz.values[k];
  const e = (k: string) => ezik.values[k];

  it("halat yükü YARIYA iner — 8.400 kg → 4.200 kg", () => {
    expect(t("c.hoistRopeLoadKg")).toBeCloseTo(8400, 6);
    expect(e("c.hoistRopeLoadKg")).toBeCloseTo(4200, 6);
  });

  it("tambur momenti de yarıya iner — 16.892,82 Nm → 8.446,41 Nm", () => {
    expect(t("c.hoistDrumMomentNm")).toBeCloseTo(16892.82, 2);
    expect(e("c.hoistDrumMomentNm")).toBeCloseTo(8446.41, 2);
  });

  it("halat hızı İKİ KATINA çıkar — kaldırma hızı × donanım = 4 × 8 = 32 m/dk", () => {
    expect(t("c.hoistRopeSpeedMpm")).toBe(16);
    expect(e("c.hoistRopeSpeedMpm")).toBe(32);
  });

  it("tahvil oranı yarıya iner — 120,75 → 60,38", () => {
    expect(t("c.hoistGearRatio")).toBeCloseTo(120.755, 3);
    expect(e("c.hoistGearRatio")).toBeCloseTo(60.377, 3);
  });

  it("redüktör bir boy küçülür — 630 kg → 530 kg", () => {
    expect(e("c.hoistFinalMomentNm")).toBeCloseTo(10980.333, 3);
    expect(e("c.hoistGearboxKg")).toBe(530);
    expect(e("w.hoistDriveGroup")).toBe(914);
  });

  it("TOPLAM VİNÇ AĞIRLIĞI değişir — 59.500 kg → 58.500 kg (ezme SONUÇ YAMASI DEĞİLDİR)", () => {
    expect(t("w.total")).toBe(59500);
    expect(e("w.trolleyTotal")).toBe(6000);
    expect(e("w.total")).toBe(58500);
  });
});

describe("TAMBUR ÇAPI 500'e ezilince moment ve redüktör BÜYÜR", () => {
  const ezik = model({ "c.hoistDrumDiaMm": 500 });

  it("tambur momenti 16.892,82 Nm'den 20.601 Nm'ye çıkar", () => {
    expect(ezik.values["c.hoistDrumMomentNm"]).toBeCloseTo(20601, 2);
  });

  it("redüktör bir boy büyür — 630 kg → 820 kg", () => {
    expect(ezik.values["c.hoistFinalMomentNm"]).toBeCloseTo(26781.3, 3);
    expect(ezik.values["c.hoistGearboxKg"]).toBe(820);
  });
});

describe("MOTOR 45 kW'a ezilince SÜRÜCÜ de yeniden seçilir", () => {
  it("sürücü seçilen MOTORA göre boyutlanır — 45 kW → 75 kW (hesap gücü 22,65 kW'a göre değil)", () => {
    const ezik = model({ "c.hoistMotorKw": 45 });
    expect(ezik.values["c.hoistCalcPowerKw"]).toBeCloseTo(22.6524, 3);
    expect(ezik.values["c.hoistMotorKw"]).toBe(45);
    expect(ezik.values["c.hoistDriveKw"]).toBe(75);
  });
});

describe("KÖPRÜ ETKİN TEKER ÇAPI ezilince toplam ağırlık değişir", () => {
  const ezik = model({ "c.bridgeWheelEffDiaMm": 500 });

  it("teker grubu ağırlığı yeni çaptan okunur — 1.955 kg → 2.875 kg", () => {
    expect(ezik.values["w.bridgeTravelGroup"]).toBe(2875);
  });

  it("vinç 59.500 kg'dan 60.500 kg'a çıkar", () => {
    expect(ezik.values["w.total"]).toBe(60500);
  });
});

describe("EZİLEMEZ ALAN gerçekten ezilemez", () => {
  it("sehim ve sehim oranı salt okunurdur — bir SONUÇTUR, bir seçim değil", () => {
    const mm = costFieldDef("c.deflectionMm");
    const oran = costFieldDef("c.deflectionRatio");
    expect(mm).toBeDefined();
    expect(oran).toBeDefined();
    expect(costFieldEditable(mm!)).toBe(false);
    expect(costFieldEditable(oran!)).toBe(false);
  });

  it("ana kiriş ise EZİLEBİLİR — model bir tahmindir, gerçek ağırlığı bilen yazar", () => {
    expect(costFieldEditable(costFieldDef("w.mainGirder")!)).toBe(true);
    expect(costFieldEditable(costFieldDef("c.hoistRopeCount")!)).toBe(true);
    expect(costFieldEditable(costFieldDef("c.hoistDrumDiaMm")!)).toBe(true);
  });

  it("sınıf katsayıları ve teker adedi de ezilmez — girdinin TEKRARIDIR", () => {
    expect(costFieldEditable(costFieldDef("c.classWeight")!)).toBe(false);
    expect(costFieldEditable(costFieldDef("c.bridgeWheelCount")!)).toBe(false);
    expect(costFieldEditable(costFieldDef("c.girderCount")!)).toBe(false);
  });
});

describe("SEHİM EKRANDA MİLİMETREDİR (kullanıcı md. 7)", () => {
  const r = model();

  it("c.deflectionMm santimetrenin ON KATIDIR — iki ayrı değer saklanmaz", () => {
    expect(r.values["c.deflectionCm"]).toBeCloseTo(2.0498, 4);
    expect(r.values["c.deflectionMm"]).toBeCloseTo(20.498, 3);
    expect(r.values["c.deflectionMm"]).toBe((r.values["c.deflectionCm"] as number) * 10);
  });

  it("alanın birimi de mm yazar", () => {
    expect(costFieldDef("c.deflectionMm")?.unit).toBe("mm");
  });

  it("SEHİM ORANININ ara değeri yine CM'DİR — pop-up 'cm ÷ mm' okutmaz", () => {
    // Ekran mm'ye geçti diye oranın ara değerini de mm yapmak, pop-up'ta
    // "3.000 cm ÷ 20,5 mm = 1.463" yazdırırdı; okuyan tutturamazdı.
    const oran = costFieldDef("c.deflectionRatio");
    expect(oran?.deps).toContain("c.deflectionCm");
    expect(oran?.deps).not.toContain("c.deflectionMm");
    expect(r.values["c.deflectionRatio"]).toBeCloseTo(
      (r.values["c.spanCm"] as number) / (r.values["c.deflectionCm"] as number),
      6
    );
  });
});

// —————————————————————————————————————————————————— D. seçilen kesit

describe("SEÇİLEN KESİT ekranda görünür (kullanıcı md. 6)", () => {
  const r = model();

  it("kesit bir ETİKET değil, bir NESNEDİR — `section` adıyla birlikte döner", () => {
    // `sectionName`i `model.test.ts` donduruyor; buradaki karar onun yanında
    // kesidin KENDİSİNİN de dönmesidir (md. 6) — ekran "neye göre seçildi"
    // sorusunu ancak nesneye bakarak cevaplayabilir.
    expect(r.section).not.toBeNull();
    expect(r.section?.name).toBe(r.sectionName);
    expect(r.section?.name).toBe("750x1900x750 t10");
  });

  it("SEÇİM ŞARTI: kesidin ataleti gerekli ataleti KARŞILAR", () => {
    const gerekli = r.values["c.requiredInertiaCm4"] as number;
    expect(gerekli).toBeCloseTo(1887408.48, 1);
    expect(r.section!.inertiaCm4).toBeGreaterThanOrEqual(gerekli);
  });

  it("seçim tablodaki İLK YETERLİ kesittir — BİR ÖNCEKİ (700x1800x700 t8) yetmez", () => {
    // Atalet burada elle KURULMAZ, kesit listesinden okunur: testin kendi
    // formülünü yazması modelin formülünü iki yerde tutmak olurdu ve biri
    // düzeltilirken öteki sessizce eskiyebilirdi.
    const yogunluk = COST_PARAM_DEFAULTS.steelDensityFactor;
    const sira = SECTION_TABLE.findIndex((s) => sectionProps(s, yogunluk).name === r.sectionName);
    expect(sira).toBeGreaterThan(0);

    const onceki = sectionProps(SECTION_TABLE[sira - 1], yogunluk);
    expect(onceki.name).toBe("700x1800x700 t8");
    expect(onceki.inertiaCm4).toBeCloseTo(1692887.89, 2);
    expect(onceki.inertiaCm4).toBeLessThan(r.values["c.requiredInertiaCm4"] as number);
  });

  it("kesit HAM ÖLÇÜLERİ taşır — 'ne kadar sac, hangi et kalınlığı' sorusunun cevabı", () => {
    expect(r.section?.topMm).toBe(750);
    expect(r.section?.webMm).toBe(1900);
    expect(r.section?.botMm).toBe(750);
    expect(r.section?.tMm).toBe(10);
  });

  it("türetilenleri de taşır — 530 cm² alan, 2.511.216,67 cm⁴ atalet, 416,05 kg/m", () => {
    expect(r.section?.areaCm2).toBeCloseTo(530, 6);
    expect(r.section?.inertiaCm4).toBeCloseTo(2511216.6667, 3);
    expect(r.section?.kgPerM).toBeCloseTo(416.05, 6);
    expect(r.values["c.sectionInertiaCm4"]).toBeCloseTo(r.section!.inertiaCm4, 6);
  });

  it("kapasitesiz kalemde kesit SEÇİLMEZ ve gerekçe yazıyla söylenir", () => {
    const bos = hesapla({ ...ASTOR, capacityT: null }, { ...COST_PARAM_DEFAULTS });
    expect(bos.section).toBeNull();
    expect(bos.sectionName).toBeNull();
    expect(bos.values["c.requiredInertiaCm4"]).toBeNull();
    expect(bos.eksik.join(" ")).toContain("Kaldırma kapasitesi");
  });
});

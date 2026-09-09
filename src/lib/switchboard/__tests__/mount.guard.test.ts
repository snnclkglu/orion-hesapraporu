// MONTAJ SÖZLÜĞÜ TAKSONOMİYLE EŞİTTİR — ayrışmayı bu test engeller.
//
// `ELECTRICAL_CATEGORIES` büyüdüğünde (yeni bir işlev ailesi doğduğunda) yeni
// sınıf montaj sözlüğüne eklenmezse o ailedeki her ürün sessizce
// "sınıflanmamış" olur ve panoya hiç girmez. Sessiz kayıp, yanlış yerleşimden
// daha tehlikelidir: kimse eksik bir cihazı aramaz.

import { describe, expect, it } from "vitest";
import { ELECTRICAL_CATEGORIES } from "@/lib/electrical/category";
import { ZONE_ORDER, isMainSwitch, mappedCategories, mountRuleFor } from "../mount";

describe("kategori sözlüğü", () => {
  it("her kategori eşlenmiştir", () => {
    const eslenen = new Set(mappedCategories());
    const eksik = ELECTRICAL_CATEGORIES.filter((k) => !eslenen.has(k));
    expect(eksik).toEqual([]);
  });

  it("sözlükte taksonomide olmayan bir sınıf yoktur", () => {
    const taksonomi = new Set<string>(ELECTRICAL_CATEGORIES);
    const fazla = mappedCategories().filter((k) => !taksonomi.has(k));
    expect(fazla).toEqual([]);
  });

  it("'Diğer' montaj tipi ÜRETMEZ", () => {
    // Bilinmeyeni tahmin edilmiş bir doğrulukla bir yere koymak ELEKTRIK-13'ün
    // açıkça yasakladığı şeydir.
    const kural = mountRuleFor({ category: "Diğer", designation: "", typeNo: "" });
    expect(kural.mountType).toBeNull();
    expect(kural.zone).toBeNull();
  });

  it("panoya yerleşen her sınıfın bölgesi vardır", () => {
    for (const kategori of ELECTRICAL_CATEGORIES) {
      const k = mountRuleFor({ category: kategori, designation: "", typeNo: "" });
      if (k.mountType === "din" || k.mountType === "plaka" || k.mountType === "kapak") {
        expect(k.zone, kategori).not.toBeNull();
        expect(ZONE_ORDER).toContain(k.zone!);
      }
    }
  });
});

describe("özgül kural genelden önce gelir", () => {
  it("reaktör raya değil PLAKAYA, TRAFO ise ZEMİNE gider", () => {
    // TRAFO PANONUN ZEMİNİNE OTURUR (kullanıcı kararı, 09.09.2026) ve montaj
    // plakasında yer kaplamaz; bölgesi de yoktur çünkü bir ray bandına ait
    // değildir. Panonun İÇİNDEDİR ve cihaz listesinde durur.
    const trafo = mountRuleFor({
      category: "Güç Kaynakları ve Trafolar",
      designation: "CONTROL TRANSFORMER 400/230V 1000VA",
      typeNo: "4AM5742",
    });
    expect(trafo.mountType).toBe("zemin");
    expect(trafo.zone).toBeNull();

    // Reaktör aynı ailededir ama PLAKADA kalır — zemine konan yalnız trafodur.
    const reaktor = mountRuleFor({
      category: "Güç Kaynakları ve Trafolar",
      designation: "LINE REACTOR 3PH 400V 0.5MH",
      typeNo: "DX-LN3-034",
    });
    expect(reaktor.mountType).toBe("plaka");
    expect(reaktor.zone).toBe("guc");
  });

  it("anahtarlamalı güç kaynağı raya kalır", () => {
    const psu = mountRuleFor({
      category: "Güç Kaynakları ve Trafolar",
      designation: "POWER SUPPLY 24VDC 10A",
      typeNo: "6EP1334-3BA10",
    });
    expect(psu.mountType).toBe("din");
    expect(psu.zone).toBe("kumanda");
  });
});

describe("ölçüm ailesi ikiye ayrılır", () => {
  // Ölçüldü (0019 + 0026): 52 PT100 probu + 20 rezistans termometresi + 5 yük
  // hücresi pano göstergesi sayılınca 7,4 METRE hayalet ray yiyordu.
  const sahaOrnekleri = [
    { designation: "PT100 Prob", typeNo: "E-RT21-1K06-5-Ü-E4-1/2NPT-V-IN" },
    { designation: "Precision resistance thermometer PT100", typeNo: "ELC.PT100 Series" },
    { designation: "Load cell pin type", typeNo: "LPW1-65MM" },
    { designation: "Pressure transmitter 0-10 bar", typeNo: "PTX-1000" },
    // YÜK PİMİ HALATIN/KANCANIN ÜSTÜNDEDİR. Ölçüldü (09.09.2026): 0026'nın
    // `TBM` panosundaki `LPW1` "Crane Loadpin" 96 x 96 mm'lik bir PANO
    // GÖSTERGESİ sayılıp panoya giriyordu — `LOAD CELL` biliniyordu ama aynı
    // ailenin pim biçimi bilinmiyordu.
    { designation: "Crane Loadpin", typeNo: "LPW1" },
    { designation: "Load Pin with amplifier", typeNo: "KOB.LPW1" },
    { designation: "Yuk pimi 5 ton", typeNo: "YP-5T" },
  ];

  for (const ornek of sahaOrnekleri) {
    it(`saha elemanı panoya girmez: ${ornek.typeNo}`, () => {
      const k = mountRuleFor({ category: "Ölçüm ve Enstrümantasyon", ...ornek });
      expect(k.mountType).toBe("saha");
      expect(k.zone).toBeNull();
    });
  }

  it("pano göstergesi panoda KALIR", () => {
    // Tarayıcı alarm cihazı 96 x 96 kesitli bir PANO cihazıdır; süreç
    // bağlantısı (NPT/BSP) yoktur.
    const k = mountRuleFor({
      category: "Ölçüm ve Enstrümantasyon",
      designation: "E690 Advanced Temperature Scanner",
      typeNo: "E690-1-1-1-1-1-1-0",
    });
    expect(k.mountType).toBe("din");
    expect(k.zone).toBe("kumanda");
  });
});

describe("ana şalter bandının başındadır", () => {
  it("yük ayırıcı tanınır", () => {
    expect(
      isMainSwitch({ category: "Şalterler ve Devre Kesiciler", designation: "SIRCO Extended rotary handle", typeNo: "14443111" })
    ).toBe(true);
  });

  it("sıradan bir otomat tanınmaz", () => {
    expect(
      isMainSwitch({
        category: "Şalterler ve Devre Kesiciler",
        designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 10A",
        typeNo: "5SL6310-7",
      })
    ).toBe(false);
  });
});

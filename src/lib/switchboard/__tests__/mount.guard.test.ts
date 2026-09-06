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
  it("trafo ve reaktör raya değil PLAKAYA gider", () => {
    const trafo = mountRuleFor({
      category: "Güç Kaynakları ve Trafolar",
      designation: "CONTROL TRANSFORMER 400/230V 1000VA",
      typeNo: "4AM5742",
    });
    expect(trafo.mountType).toBe("plaka");
    expect(trafo.zone).toBe("guc");
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

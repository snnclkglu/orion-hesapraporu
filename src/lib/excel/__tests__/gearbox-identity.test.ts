// Redüktör markası ve "standart olan yazılmaz" kuralı.
//
// İkisi de EKİPMAN LİSTESİNİN sütunlarına dokunur ve ikisi de sessizce
// bozulabilir: marka ayrıştırması yanlış bir öneki markaya sayarsa satın alma
// olmayan bir firmaya sipariş açar; "standart" değerler satıra yazılırsa liste
// hiçbir şey söylemeyen tekrarlarla dolar.

import { describe, expect, it } from "vitest";
import { gearboxIdentity } from "../equipment";
import {
  COUPLING_SEAL_TYPES,
  COUPLING_SEAL_TYPE_STANDARD,
  COUPLING_WEAR_DETECTIONS,
  COUPLING_WEAR_DETECTION_STANDARD,
  GEARBOX_OPTIONS,
} from "@/lib/calc/fields";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { TRAVEL_SELECTION_FIELDS } from "@/lib/calc/presentation/travelFields";

describe("redüktör markası model alanından ayrıştırılır", () => {
  it("marka adında BOŞLUK olsa da doğru ayrılır", () => {
    // "Yılmaz Redüktör" boşluk taşır; kısa "Yılmaz" önce denenirse model
    // "Redüktör HT0923" olurdu.
    expect(gearboxIdentity("Yılmaz Redüktör HT0923")).toEqual({
      brand: "Yılmaz Redüktör", model: "HT0923",
    });
    expect(gearboxIdentity("POLAT (PGR) PCS 1")).toEqual({
      brand: "POLAT (PGR)", model: "PCS 1",
    });
  });

  it("kullanıcının verdiği iki örnek birebir çözülür", () => {
    expect(gearboxIdentity("FLENDER H3-05").brand).toBe("FLENDER");
    expect(gearboxIdentity("FLENDER H3-05").model).toBe("H3-05");
  });

  it("eski kısa yazım kataloğun marka adına çevrilir", () => {
    // Marka sütunu satın almaya ve katalog sayfası defterine gider; orada
    // `cat_equipment.brand` ile birebir eşleşmelidir.
    expect(gearboxIdentity("YILMAZ HT0823").brand).toBe("Yılmaz Redüktör");
  });

  it("TANINMAYAN önek markaya SAYILMAZ — metin modelde kalır", () => {
    // Uydurma marka basmaktansa boş bırakmak doğrudur (md. 4).
    expect(gearboxIdentity("Bilinmeyen XYZ-9")).toEqual({
      brand: "", model: "Bilinmeyen XYZ-9",
    });
    expect(gearboxIdentity("")).toEqual({ brand: "", model: "" });
    expect(gearboxIdentity(undefined)).toEqual({ brand: "", model: "" });
  });

  it("yalnız markadan ibaret metinde model boş kalır", () => {
    expect(gearboxIdentity("FLENDER")).toEqual({ brand: "FLENDER", model: "" });
  });
});

describe("sipariş standartları", () => {
  it("standart değerler seçenek listesinin İÇİNDEDİR", () => {
    // Sabit listeden düşerse kutu kayıtlı değeri gösterir ama "standart"
    // karşılaştırması sessizce hep yanlış olur ve satıra yazılmaya başlar.
    expect(COUPLING_SEAL_TYPES).toContain(COUPLING_SEAL_TYPE_STANDARD);
    expect(COUPLING_WEAR_DETECTIONS).toContain(COUPLING_WEAR_DETECTION_STANDARD);
    expect(GEARBOX_OPTIONS).toContain("Yok");
  });

  it("yeni iş şablonu kaplinleri standart değerle açar", () => {
    const t = NEW_WORK_TEMPLATE as unknown as Record<
      string, { selections?: Record<string, unknown> } | undefined
    >;
    for (const field of ["mainHoist", "auxHoist"]) {
      const sel = t[field]?.selections ?? {};
      expect(sel.motorCouplingSealType, field).toBe(COUPLING_SEAL_TYPE_STANDARD);
      expect(sel.drumCouplingSealType, field).toBe(COUPLING_SEAL_TYPE_STANDARD);
      expect(sel.drumCouplingWearDetection, field).toBe(COUPLING_WEAR_DETECTION_STANDARD);
    }
    for (const field of ["trolley", "bridge"]) {
      const sel = t[field]?.selections ?? {};
      expect(sel.motorCouplingSealType, field).toBe(COUPLING_SEAL_TYPE_STANDARD);
      expect(sel.wheelCouplingSealType, field).toBe(COUPLING_SEAL_TYPE_STANDARD);
    }
  });
});

describe("yürütme redüktörü", () => {
  it("MİL YÖNLERİ kutusu YÜRÜTMEDE YOKTUR", () => {
    // Kullanıcı kararı (24.08.2026): yürütme redüktörü teker miline sabit bir
    // düzende oturur, yön bir sipariş sorusu değildir. Kutu kaldırıldı.
    const keys = TRAVEL_SELECTION_FIELDS.map((f) => f.key);
    expect(keys).not.toContain("gearboxShaftDirection");
  });

  it("redüktör opsiyonları kutusu YÜRÜTMEDE VARDIR", () => {
    const def = TRAVEL_SELECTION_FIELDS.find((f) => f.key === "gearboxOptions");
    expect(def?.type).toBe("multiselect");
    expect(def?.options).toEqual([...GEARBOX_OPTIONS]);
  });
});

// KİMLİK KORUMASI — ölçü defterinin anahtarı ile çalışma anında aranan anahtar
// AYNI olmalıdır.
//
// Defter satırı `electricalCatalogLookupKey` ile yazılır ve `buildBook` aynı
// anahtarla arar. Araya giren tek şey EPLAN antet bulaşmasıdır: ham satır
// temizlenmeden kimliğe çevrilirse ortaya çalışma anında HİÇ ARANMAYAN bir
// anahtar çıkar ve deftere yazılan ölçü sessizce ölü kalır.
//
// Buradaki iki dizge UYDURMA DEĞİL: 0026-01 projesinin veritabanındaki gerçek
// `electrical_parts` satırlarıdır (06.09.2026'da ölçüldü).

import { describe, expect, it } from "vitest";
import { cleanElectricalPart } from "@/lib/electrical/parts-list";
import { materialCatalogIdentity } from "@/lib/electrical/catalogs";
import type { ElectricalPart } from "@/lib/electrical/types";
import { buildBook } from "../book";

function ham(over: Partial<ElectricalPart>): ElectricalPart {
  return {
    deviceTag: "=100T+LVD0-K123",
    installation: "100T",
    location: "LVD0",
    device: "K123",
    qty: 1,
    designation: "Interface plug-in relay, 5 A, 2 CO, LED, 24 V DC",
    typeNo: "",
    supplier: "",
    partNo: "",
    page: 10,
    ...over,
  };
}

describe("antet bulaşmış satırın kimliği", () => {
  it("röle satırı doğru ürüne çözülür", () => {
    const temiz = cleanElectricalPart(
      ham({
        typeNo:
          "RXG22BD İMZA 100T TAVAN VİNCİ İNFEED OTOMASYON Parts list : NIKI.N1000-P-2/160W.5000K - SE.RXG22BD",
        supplier: "SE ASTOR",
        partNo: "SE.RXG22BD 1.a KAĞIT FORMU TARİH İSİM İMZA A3 KONTROL1 ÖLÇEK",
      })
    );
    expect(temiz).not.toBeNull();
    expect(temiz!.typeNo).toBe("RXG22BD");
    // ASTOR çizim antedindeki FİRMA adıdır, tedarikçi değil.
    expect(temiz!.supplier).toBe("SE");
    // `SE` takma adı kanonik üreticiye açılır (ELEKTRIK-12).
    expect(materialCatalogIdentity(temiz!).lookupKey).toBe("SCHNEIDERELECTRIC|RXG22BD");
  });

  it("fren direnci satırı doğru ürüne çözülür", () => {
    const temiz = cleanElectricalPart(
      ham({
        device: "R24",
        deviceTag: "=100T+LVD0-R24",
        designation: "Braking resistor",
        typeNo:
          "BRSD-836SW-7503 İMZA 100T TAVAN VİNCİ İNFEED OTOMASYON Parts list : SE.RGZE1S48M - RSSA.BRSD-836SW-7503",
        supplier: "RESSA ASTOR",
        partNo: "RSSA.BRSD-836SW-7503 1.b KAĞIT FORMU TARİH İSİM İMZA A3 KONT",
      })
    );
    expect(temiz).not.toBeNull();
    expect(temiz!.typeNo).toBe("BRSD-836SW-7503");
    expect(temiz!.supplier).toBe("RESSA");
  });

  it("temizlenmemiş satır defteri BÖLER — betikler bu yüzden ham okumaz", () => {
    const kirli = ham({
      typeNo: "RXG22BD İMZA 100T TAVAN VİNCİ İNFEED OTOMASYON Parts list : SE.RXG22BD",
      supplier: "SE ASTOR",
      partNo: "SE.RXG22BD",
    });
    const temiz = cleanElectricalPart(kirli)!;

    const kirliAnahtar = materialCatalogIdentity(kirli).lookupKey;
    const temizAnahtar = materialCatalogIdentity(temiz).lookupKey;
    expect(kirliAnahtar).not.toBe(temizAnahtar);

    // Defter TEMİZ anahtarla arar; ham anahtarla yazılan bir ölçü hiç bulunmaz.
    const defter = buildBook({ parts: [temiz], models: [] });
    expect(defter).toHaveLength(1);
    expect(defter[0].lookupKey).toBe(temizAnahtar);
  });
});

describe("aynı ürünün iki tedarikçi yazımı", () => {
  // Ölçüldü (0019 + 0026): `PT 2,5` klemensi hem "Phoenix Contact" hem BOŞ
  // tedarikçiyle geçiyor — 708 + 262 adet. İki AYRI anahtar doğar ve deftere
  // tek satır yazmak parçaların dörtte birini ıskalar.
  const klemens = {
    designation: "Feed-through terminal block PT 2,5",
    typeNo: "PT 2,5",
    partNo: "",
  };

  it("iki ayrı anahtar üretir", () => {
    const markali = materialCatalogIdentity({ ...klemens, supplier: "Phoenix Contact" });
    const marasiz = materialCatalogIdentity({ ...klemens, supplier: "" });
    expect(markali.lookupKey).not.toBe(marasiz.lookupKey);
    expect(marasiz.lookupKey.startsWith("|")).toBe(true);
  });

  it("defter tip numarasıyla YEDEK ARAMA yapar — ama yalnız tek eşleşmede", () => {
    const parts = [
      ham({ device: "X1", deviceTag: "=T+P-X1", ...klemens, supplier: "Phoenix Contact", qty: 10 }),
      ham({ device: "X2", deviceTag: "=T+P-X2", ...klemens, supplier: "", qty: 10 }),
    ];
    const markaliAnahtar = materialCatalogIdentity({ ...klemens, supplier: "Phoenix Contact" }).lookupKey;

    // Defterde YALNIZ markalı kayıt var; markasız satır ona düşmeli.
    const satirlar = buildBook({
      parts,
      models: [
        {
          lookupKey: markaliAnahtar,
          supplier: "Phoenix Contact",
          typeNo: "PT 2,5",
          widthMm: 5.2,
          heightMm: 47.5,
          depthMm: 46.5,
          moduleUnits: null,
          mountType: "din",
          zone: "klemens",
          clearanceTopMm: null,
          clearanceBottomMm: null,
          heatW: null,
          source: "katalog",
          note: "",
        },
      ],
    });

    // İki ayrı satır (iki ayrı anahtar) ama İKİSİ DE ölçülü.
    expect(satirlar).toHaveLength(2);
    for (const s of satirlar) {
      expect(s.widthMm).toBe(5.2);
      expect(s.source).toBe("katalog");
    }
  });
});

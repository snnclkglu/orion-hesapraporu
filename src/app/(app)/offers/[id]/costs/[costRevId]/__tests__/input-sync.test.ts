// GİRDİLERİ TEKLİFLE EŞİTLEME — SÖZ: belgenin sustuğu alan DEĞİŞMEZ.
//
// Eşitleme kullanıcının elle düzelttiği girdilerin üstüne yazan tek yoldur; bu
// yüzden ölçülen şey "doğru sayıyı getiriyor mu" değil, ÖNCE "getirmemesi
// gereken yerde susuyor mu"dur. Sessiz bir ezme, teklifte okunamayan bir hızı
// ya da kod varsayılanı olan bir teker adedini "teklif böyle diyor" diye
// yazmak demektir (değişmez md. 4).

import { describe, expect, it } from "vitest";
import { emptyCostInputs } from "@/lib/offers/cost/payload";
import { groupFromKey } from "@/lib/offers/payload";
import type { OfferItem } from "@/lib/offers/types";
import { teklifleEsitle } from "../input-sync";

function kalem(
  yama: Partial<OfferItem> = {},
  parcalar: [string, string, Record<string, string>][] = []
): OfferItem {
  const item: OfferItem = {
    id: "kalem-1",
    title: "32T x 30m ÇİFT KİRİŞ KÖPRÜLÜ VİNÇ",
    craneType: "Köprülü Vinç",
    capacityT: null,
    spanM: null,
    groups: ["general", "mainHoist", "trolley", "bridge"].map((k) => groupFromKey(k)),
    ...yama,
  };
  for (const [g, r, parts] of parcalar) {
    const row = item.groups.find((x) => x.key === g)?.rows.find((x) => x.key === r);
    if (!row) throw new Error(`defterde yok: ${g}/${r}`);
    row.parts = { ...row.parts, ...parts };
  }
  return item;
}

describe("teklifleEsitle", () => {
  it("teklifte DEĞİŞEN açıklığı elle girilmiş değerin üstüne yazar ve farkı söyler", () => {
    const mevcut = { ...emptyCostInputs(), spanM: 30, capacityT: 32 };
    const { inputs, farklar } = teklifleEsitle(mevcut, kalem({ spanM: 28, capacityT: 32 }));

    expect(inputs.spanM).toBe(28);
    expect(farklar.map((f) => f.key)).toEqual(["spanM"]);
    expect(farklar[0]).toMatchObject({ etiket: "Açıklık", birim: "m", eski: "30", yeni: "28" });
  });

  it("TEKLİFİN OKUYAMADIĞI alanı boşaltmaz — elle girilen değer kalır", () => {
    // Teklifte kaldırma yüksekliği hiç yazmıyor ve hız "yaklaşık 6" gibi
    // çözümlenemeyen bir metin; ikisi de `null` okunur.
    const mevcut = { ...emptyCostInputs(), liftHeightM: 12, liftSpeedMpm: 6 };
    const { inputs, farklar } = teklifleEsitle(
      mevcut,
      kalem({}, [["mainHoist", "liftSpeed", { range: "yaklaşık altı" }]])
    );

    expect(inputs.liftHeightM).toBe(12);
    expect(inputs.liftSpeedMpm).toBe(6);
    expect(farklar).toEqual([]);
  });

  it("teklifte YAZMAYAN adetleri kod varsayılanına çekmez", () => {
    // `inputsFromOfferItem` okunamayan adedi TABANDAN döndürür. Taban mevcut
    // girdi olduğu için burada fark çıkmamalı; boşaltılmış bir tabanla okunsaydı
    // köprüde 4 teker varsayılır ve kullanıcının yazdığı 6 sessizce silinirdi.
    const mevcut = { ...emptyCostInputs(), bridgeWheelCount: 6, trolleyDriveCount: 1 };
    const { inputs, farklar } = teklifleEsitle(mevcut, kalem());

    expect(inputs.bridgeWheelCount).toBe(6);
    expect(inputs.trolleyDriveCount).toBe(1);
    expect(farklar).toEqual([]);
  });

  it("teklifte YAZAN teker adedini alır", () => {
    const mevcut = { ...emptyCostInputs(), bridgeWheelCount: 4 };
    const { inputs, farklar } = teklifleEsitle(
      mevcut,
      kalem({}, [["bridge", "wheel", { count: "8" }]])
    );

    expect(inputs.bridgeWheelCount).toBe(8);
    expect(farklar.map((f) => f.key)).toEqual(["bridgeWheelCount"]);
  });

  it("PORTAL BAYRAĞINI düşürmez — teklif başlığı köprü dese bile", () => {
    // Ayak modeli yalnız portalde çalışır; bayrağı düşürmek ağırlığın üçte
    // birini sessizce yok etmek olurdu.
    const mevcut = { ...emptyCostInputs(true), gantry: true, legHeightM: 12 };
    const { inputs, farklar } = teklifleEsitle(mevcut, kalem());

    expect(inputs.gantry).toBe(true);
    expect(inputs.legHeightM).toBe(12);
    expect(farklar).toEqual([]);
  });

  it("fark yoksa GELEN NESNENİN AYNISINI döndürür", () => {
    // Aynı referans: çağrı yeri farksız bir eşitlemede belgeyi kirletmemeli,
    // yoksa "Kaydet" düğmesi hiçbir şey değişmeden yanmaya başlar.
    const mevcut = { ...emptyCostInputs(), capacityT: 32, spanM: 30 };
    const sonuc = teklifleEsitle(mevcut, kalem({ capacityT: 32, spanM: 30 }));

    expect(sonuc.farklar).toEqual([]);
    expect(sonuc.inputs).toBe(mevcut);
  });

  it("vinç sınıfını teklifin genel satırından okur", () => {
    const mevcut = { ...emptyCostInputs(), craneClass: "M5" as const };
    const item = kalem();
    const row = item.groups.find((g) => g.key === "general")?.rows.find((r) => r.key === "craneClass");
    if (row) row.value = "FEM 3m / M6";
    const { inputs, farklar } = teklifleEsitle(mevcut, item);

    expect(inputs.craneClass).toBe("M6");
    expect(farklar.map((f) => f.etiket)).toEqual(["Vinç Sınıfı"]);
  });
});

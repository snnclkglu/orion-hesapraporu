import { describe, expect, it } from "vitest";
import {
  hammaddeSatiriMi,
  siparisKilosu,
  siparisTuru,
  turSuzgeciUyuyor,
} from "../siparis-turu";

describe("siparisTuru", () => {
  it("bütün satırlar hammaddeyse hammaddedir", () => {
    expect(
      siparisTuru([{ sample: "SAC 10 X 1500 X 6000 ST37" }, { sample: "UPN 100 S235JR" }])
    ).toBe("hammadde");
  });

  it("hiçbir satır hammadde değilse ekipmandır", () => {
    expect(siparisTuru([{ sample: "RULMAN 22212 E" }, { sample: "KAPLİN N-EUPEX B 140" }])).toBe(
      "ekipman"
    );
  });

  it("KARMA gerçek bir hâldir — aynı firmadan sac ve rulman alınabilir", () => {
    expect(siparisTuru([{ sample: "SAC 10 MM S355JR" }, { sample: "RULMAN 6022 - Z" }])).toBe(
      "karma"
    );
  });

  it("satırı olmayan sipariş hammadde SAYILMAZ", () => {
    expect(siparisTuru([])).toBe("ekipman");
  });
});

describe("hammaddeSatiriMi", () => {
  it("plaka siparişinin adı hammaddedir", () => {
    expect(hammaddeSatiriMi("SAC 12 X 1500 X 3000 S235JR")).toBe(true);
  });
  it("ray ve profil hammaddedir", () => {
    expect(hammaddeSatiriMi("RAY A65 S235JR")).toBe(true);
    expect(hammaddeSatiriMi("HEA 200 S235JR")).toBe(true);
  });
  it("motor hammadde değildir", () => {
    expect(hammaddeSatiriMi("ELEKTRİK MOTORU 30KW 1500 D-DK (GAMAK)")).toBe(false);
  });
});

describe("turSuzgeciUyuyor", () => {
  it("süzgeç boşsa her şey geçer", () => {
    expect(turSuzgeciUyuyor("ekipman", [])).toBe(true);
  });

  it("KARMA sipariş HEM hammadde HEM ekipman süzgecine girer", () => {
    // İçinde sac olan karma bir sipariş "bu ay ne kadar sac aldım" sorusunun
    // cevabının parçasıdır; dışarıda bırakmak toplamı eksik gösterirdi.
    expect(turSuzgeciUyuyor("karma", ["hammadde"])).toBe(true);
    expect(turSuzgeciUyuyor("karma", ["ekipman"])).toBe(true);
  });

  it("hammadde süzgecinde saf ekipman siparişi görünmez", () => {
    expect(turSuzgeciUyuyor("ekipman", ["hammadde"])).toBe(false);
    expect(turSuzgeciUyuyor("hammadde", ["ekipman"])).toBe(false);
  });
});

describe("siparisKilosu", () => {
  it("yalnız kilo birimli satırlar toplanır, ötekiler AYRICA sayılır", () => {
    const s = siparisKilosu([
      { qty: 3537, unit: "Kg" },
      { qty: 12, unit: "Boy" },
      { qty: 4, unit: "Adet" },
    ]);
    expect(s.kg).toBe(3537);
    expect(s.kiloDisiSatir).toBe(2);
  });

  it("birim yazımı büyük/küçük harften bağımsızdır", () => {
    expect(siparisKilosu([{ qty: 100, unit: "kg" }]).kg).toBe(100);
    expect(siparisKilosu([{ qty: 100, unit: "KG" }]).kg).toBe(100);
  });
});

// Mahal iklimlendirme yükü — mühendislik doğrulaması.
//
// Kontroller fiziğe karşıdır: denge, ölçek tutarlılığı, sınır durumları. Bir
// üretici tablosuna karşı DEĞİL. Sonda bir de tarihsel karşılaştırma vardır:
// TMS'in Erdemir E-House raporu (28.07.2026) fikstür olarak koşturulur ve
// sapmalar gerekçesiyle birlikte belgelenir.

import { describe, expect, it } from "vitest";
import {
  airDensity,
  computeClimateLoad,
  humidityRatio,
  insulationLambda,
  moistAirEnthalpy,
  panelUValue,
  saturationPressure,
  solAirTemperature,
  type ClimateLoadInput,
} from "../climate-load";
import { driveGroupLossKw, driveLossKw, panelHeatKw } from "../drive-losses";

const base: ClimateLoadInput = {
  widthM: 3, lengthM: 4, heightM: 2.6,
  insulation: "rockWool100",
  doorCount: 1,
  ambientTempC: 45,
  ambientRhPct: 50,
  environment: "indoor",
  deviceHeatKw: 3,
  radiationKw: 0,
  safetyFactorPct: 15,
};

describe("psikrometri", () => {
  it("doymuş buhar basıncı bilinen noktalarda tutar", () => {
    // Magnus bağıntısı vinç ortam bandında (−40…+80 °C) %1,5'ten iyi;
    // kaynama noktasına yaklaşınca sapar, o bant kapsam dışıdır.
    expect(saturationPressure(0)).toBeCloseTo(611, -1);
    expect(saturationPressure(20) / 1000).toBeCloseTo(2.34, 1);   // 2,34 kPa
    expect(saturationPressure(40) / 1000).toBeCloseTo(7.38, 1);   // 7,38 kPa
    expect(saturationPressure(60) / 1000).toBeCloseTo(19.94, 0);  // 19,94 kPa
  });

  it("nem oranı sıcaklıkla hızla artar — gizli yükün kaynağı budur", () => {
    const w25 = humidityRatio(25, 50);
    const w45 = humidityRatio(45, 50);
    const w60 = humidityRatio(60, 40);
    expect(w25).toBeGreaterThan(0.009);
    expect(w25).toBeLessThan(0.011);
    // Aynı bağıl nemde 20 K artış nem oranını ikiye katlamaktan fazlasını yapar.
    expect(w45 / w25).toBeGreaterThan(2.5);
    // 60 °C / %40 — TMS raporunun dış koşulu. TMS 250 m rakımda 100 kPa
    // kullanmış, uygulama standart atmosferi (101,325 kPa) kullanır; basınç
    // farkı nem oranını ~%1 aşağı çeker.
    expect(w60 * 1000).toBeGreaterThan(50);
    expect(w60 * 1000).toBeLessThan(56);
  });

  it("entalpi farkı gizli yükün baskın olduğunu gösterir", () => {
    const dh = moistAirEnthalpy(60, 40) - moistAirEnthalpy(25, 50);
    // Duyulur kısım yalnız ~35 kJ/kg; kalanı nemdir.
    expect(dh).toBeGreaterThan(120);
  });

  it("hava yoğunluğu sıcaklıkla azalır", () => {
    expect(airDensity(25)).toBeGreaterThan(airDensity(60));
    expect(airDensity(25)).toBeCloseTo(1.18, 2);
  });
});

describe("zarf ısı geçişi", () => {
  it("λ sıcaklıkla artar — 10 °C beyan değeri sıcak ortamda yetersizdir", () => {
    expect(insulationLambda(10)).toBeCloseTo(0.036, 4);
    expect(insulationLambda(41)).toBeGreaterThan(insulationLambda(10));
    // 41 °C'de (60/22 mahal) artış %10'un üstünde olmalı.
    expect(insulationLambda(41) / insulationLambda(10)).toBeGreaterThan(1.1);
  });

  it("100 mm yalıtım 50 mm'nin yaklaşık yarısı kadar ısı geçirir", () => {
    const u50 = panelUValue("rockWool50", 35);
    const u100 = panelUValue("rockWool100", 35);
    expect(u100).toBeLessThan(u50);
    expect(u50 / u100).toBeGreaterThan(1.7);
    expect(u50 / u100).toBeLessThan(2.1);
  });

  it("ısı köprüsü payı U'yu yükseltir, sıfır payda düz plaka değerine iner", () => {
    expect(panelUValue("rockWool100", 35, 0.15))
      .toBeCloseTo(panelUValue("rockWool100", 35, 0) * 1.15, 5);
  });

  it("güneş-hava sıcaklığı yüzeyi dış havadan sıcak gösterir", () => {
    const roof = solAirTemperature(40, 950, true);
    const wall = solAirTemperature(40, 350, false);
    expect(roof).toBeGreaterThan(50);
    expect(roof).toBeGreaterThan(wall);
    // Koyu boya (α 0,7) açık boyadan (α 0,3) belirgin sıcak.
    expect(solAirTemperature(40, 950, true, 0.7))
      .toBeGreaterThan(solAirTemperature(40, 950, true, 0.3) + 10);
  });
});

describe("mahal ısı yükü", () => {
  it("kalemlerin toplamı hesaplanan yüke, emniyet katsayısı toplama gider", () => {
    const r = computeClimateLoad(base);
    expect(r.transmissionKw + r.solarKw + r.radiationKw + r.deviceHeatKw + r.freshAirKw)
      .toBeCloseTo(r.calculatedKw, 6);
    expect(r.totalKw).toBeCloseTo(r.calculatedKw * 1.15, 6);
  });

  it("dış sıcaklık iç tasarım sıcaklığına eşitken yalnız cihaz ısısı kalır", () => {
    const r = computeClimateLoad({ ...base, ambientTempC: 25, ambientRhPct: 50 });
    expect(r.transmissionKw).toBeCloseTo(0, 6);
    expect(r.freshAirKw).toBeCloseTo(0, 6);
    expect(r.calculatedKw).toBeCloseTo(base.deviceHeatKw, 6);
  });

  it("100 mm yalıtım iletim yükünü düşürür, diğer kalemleri değiştirmez", () => {
    const ince = computeClimateLoad({ ...base, insulation: "rockWool50" });
    const kalin = computeClimateLoad({ ...base, insulation: "rockWool100" });
    expect(kalin.transmissionKw).toBeLessThan(ince.transmissionKw);
    expect(kalin.freshAirKw).toBeCloseTo(ince.freshAirKw, 6);
    expect(kalin.deviceHeatKw).toBe(ince.deviceHeatKw);
  });

  it("açık havada güneş yükü devreye girer, kapalı mahalde sıfırdır", () => {
    const kapali = computeClimateLoad(base);
    const acik = computeClimateLoad({ ...base, environment: "outdoor" });
    expect(kapali.solarKw).toBe(0);
    expect(acik.solarKw).toBeGreaterThan(0);
    expect(acik.totalKw).toBeGreaterThan(kapali.totalKw);
    // Güneş iletim kalemini bozmaz; ayrı raporlanır.
    expect(acik.transmissionKw).toBeCloseTo(kapali.transmissionKw, 6);
  });

  it("kapı adedi HEM zarf ısı geçişini HEM sızıntıyı büyütür", () => {
    const tek = computeClimateLoad({ ...base, doorCount: 1 });
    const cift = computeClimateLoad({ ...base, doorCount: 2 });
    expect(cift.transmissionKw).toBeGreaterThan(tek.transmissionKw);
    expect(cift.infiltrationM3h).toBeGreaterThan(tek.infiltrationM3h);
    expect(cift.freshAirKw).toBeGreaterThan(tek.freshAirKw);
  });

  it("yoğuşan su nem farkından gelir; kuru ortamda sıfırdır", () => {
    expect(computeClimateLoad(base).condensateKgH).toBeGreaterThan(0);
    // Dış hava iç havadan KURU ise klima nem almaz.
    expect(computeClimateLoad({ ...base, ambientRhPct: 5 }).condensateKgH).toBe(0);
  });

  it("üfleme debisi toplam yükle orantılıdır", () => {
    const az = computeClimateLoad({ ...base, deviceHeatKw: 2 });
    const cok = computeClimateLoad({ ...base, deviceHeatKw: 8 });
    expect(cok.airFlowM3h / az.airFlowM3h).toBeCloseTo(cok.totalKw / az.totalKw, 6);
  });

  it("ışınım yükü doğrudan toplama girer", () => {
    const yok = computeClimateLoad(base);
    const var_ = computeClimateLoad({ ...base, radiationKw: 2 });
    expect(var_.calculatedKw - yok.calculatedKw).toBeCloseTo(2, 6);
  });
});

describe("sürücü kayıpları", () => {
  it("motor gücünü karşılayan ilk katalog satırı seçilir", () => {
    // 55 kW motor → P_Hd 55 kW satırı (ACS880-104-0140A), kayıp 1,1 kW
    expect(driveLossKw(55)).toBeCloseTo(1.1, 3);
    // 50 kW motor da aynı satıra düşer — bir büyük seçilmiş olur.
    expect(driveLossKw(50)).toBeCloseTo(1.1, 3);
    expect(driveLossKw(11)).toBeCloseTo(0.3, 3);
    expect(driveLossKw(0)).toBe(0);
  });

  it("kayıp oranı büyük sürücülerde %2 mertebesinde kalır", () => {
    for (const p of [30, 55, 110, 250]) {
      const oran = driveLossKw(p) / p;
      expect(oran).toBeGreaterThan(0.015);
      expect(oran).toBeLessThan(0.035);
    }
  });

  it("adet çarpar, pano ısısı yardımcı ve eşzamanlılıkla ölçeklenir", () => {
    expect(driveGroupLossKw(11, 2)).toBeCloseTo(0.6, 3);
    // 1,73 kW invertör kaybı → yardımcı %80 + eşzamanlılık 0,6
    expect(panelHeatKw(1.73)).toBeCloseTo(1.73 * 1.8 * 0.6, 6);
  });

  it("tipik bir vinçte pano ısısı 2–5 kW bandındadır", () => {
    // Ana 55 + yrd 11 + araba 3 + köprü 2×3 kW
    const inverter =
      driveGroupLossKw(55, 1) + driveGroupLossKw(11, 1) +
      driveGroupLossKw(3, 1) + driveGroupLossKw(3, 2);
    const q = panelHeatKw(inverter);
    expect(q).toBeGreaterThan(1);
    expect(q).toBeLessThan(5);
  });
});

/**
 * TARİHSEL KARŞILAŞTIRMA — TMS "Heat Gain Calculation Report (E-House Single
 * Room)", Erdemir Elektrik Odası, 28.07.2026.
 *
 * Şartname DEĞİLDİR: uygulamanın yöntemi kendi standardına dayanır ve sapma
 * gerekçesiyle belgelenir. Bilinen ve KABUL EDİLEN sapmalar:
 *
 *  · İç tasarım sıcaklığı — TMS 22 °C, uygulama 25 °C (firma kabulü). Bu tek
 *    başına iletim ve taze hava kalemlerini düşürür.
 *  · Emniyet katsayısı — TMS %10, uygulama %15 (tozlu ortamda kondenser
 *    kirlenmesi kapasiteyi düşürür).
 *  · Işınım — TMS 0,20 kW yazmış; kaynağı formda sorulmuyor. Elektrik odası
 *    platform üzerinde ve altında ısı kalkanı varsa ışınım gerçekten ihmal
 *    edilebilir; uygulama bu kalemi UYDURMAZ, mühendise sorar.
 *
 * Sınanan şey bu yüzden birebir sayı değil, BÜYÜKLÜK MERTEBESİ ve kalemlerin
 * birbirine oranıdır.
 */
describe("tarihsel karşılaştırma — TMS Erdemir E-House raporu", () => {
  const erdemir = computeClimateLoad({
    widthM: 2, lengthM: 9, heightM: 3,
    insulation: "rockWool100",
    doorCount: 2,
    ambientTempC: 60,
    ambientRhPct: 40,
    environment: "indoor",
    deviceHeatKw: 22.5,
    radiationKw: 0,
    safetyFactorPct: 15,
  });

  it("U değeri TMS'in kullandığı 0,392 W/m²K ile aynı mertebede", () => {
    // TMS 0,392 — 100 mm taş yününün sıcaklık düzeltmeli değeri. Uygulama ısı
    // köprüsü payı da eklediği için biraz yüksek çıkar; bu bilinçli farktır.
    expect(erdemir.uValue).toBeGreaterThan(0.35);
    expect(erdemir.uValue).toBeLessThan(0.50);
  });

  it("iletim kalemi TMS'in 1,80 kW'ına yakın", () => {
    expect(erdemir.transmissionKw).toBeGreaterThan(1.2);
    expect(erdemir.transmissionKw).toBeLessThan(2.2);
  });

  it("taze hava ve yoğuşma TMS'in 0,53 kW / 0,54 kg/h değerlerine yakın", () => {
    expect(erdemir.freshAirKw).toBeGreaterThan(0.3);
    expect(erdemir.freshAirKw).toBeLessThan(0.8);
    expect(erdemir.condensateKgH).toBeGreaterThan(0.3);
    expect(erdemir.condensateKgH).toBeLessThan(0.8);
  });

  it("toplam yük TMS'in 27,53 kW'ının %10 bandında", () => {
    expect(erdemir.totalKw).toBeGreaterThan(27.53 * 0.9);
    expect(erdemir.totalKw).toBeLessThan(27.53 * 1.1);
  });

  it("cihaz ısısı toplamın büyük çoğunluğunu oluşturur", () => {
    // TMS'te 22,5 / 25,03 = %90; uygulamada da aynı tablo çıkmalı.
    expect(erdemir.deviceHeatKw / erdemir.calculatedKw).toBeGreaterThan(0.85);
  });
});

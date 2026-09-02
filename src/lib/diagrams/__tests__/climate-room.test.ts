import { describe, expect, it } from "vitest";
import { climateRoomDiagram, type ClimateRoomParams } from "../climateRoom";
import { textWidth } from "../model";

const room: ClimateRoomParams = {
  title: "Elektrik Odası",
  widthM: 2.6,
  lengthM: 3,
  heightM: 2.8,
  insulationMm: 50,
  doorCount: 1,
  doorWidthMm: 800,
  doorHeightMm: 2000,
  ambientTempC: 45,
  ambientRhPct: 50,
  roomTempC: 25,
  roomRhPct: 50,
  outdoor: false,
  transmissionKw: 1,
  solarKw: 0,
  radiationKw: 0,
  deviceHeatKw: 1.1,
  occupantKw: 0,
  freshAirKw: 0.3,
  totalKw: 2.8,
  freshAirM3h: 12,
  airFlowM3h: 1100,
  glazingAreaM2: 0,
  occupantCount: 0,
  deviceCount: 3,
  deviceLabel: "Pano",
  panelWidthsMm: [400, 600, 800],
  panelHeightMm: 1800,
  panelDepthMm: 600,
  panelBaseHeightMm: 200,
};

describe("elektrik odası ön ve yan görünüşü", () => {
  it("kapıyı çizmez; yan görünüşü ön görünüşün sağında gösterir", () => {
    const diagram = climateRoomDiagram(room);
    const textEls = diagram.els.filter((element) => element.kind === "text");
    const texts = textEls.map((element) => element.text);
    const front = textEls.find((element) => element.text === "ÖN GÖRÜNÜŞ");
    const side = textEls.find((element) => element.text === "YAN GÖRÜNÜŞ");

    expect(texts).toContain("ÖN GÖRÜNÜŞ");
    expect(texts).toContain("YAN GÖRÜNÜŞ");
    // ETİKET BİÇİMİ DAR (02.09.2026, md. 5): "P1 · 400" sekiz karakterle
    // pano kutusuna sığmıyordu ve komşusuyla birleşiyordu.
    expect(texts).toContain("P2-600");
    expect(texts).toContain("P3-800");
    // 400 mm'lik pano 3 m'lik odada 22 px çizilir; "P1-400" 27 px eder ve
    // SIĞMAZ — etiket atılmaz, numaraya KISALIR. Enler alt lejantta zaten var.
    expect(texts).toContain("P1");
    expect(texts).not.toContain("P1-400");
    expect(texts.some((text) => text.includes("Kapı"))).toBe(false);
    expect(texts.some((text) => text.includes("800 × 2.000 mm"))).toBe(false);
    expect(texts).toContain("Yürüme Mesafesi 2.000 mm");
    expect(side!.x).toBeGreaterThan(front!.x);
    expect(diagram.width).toBeGreaterThan(800);
    expect(diagram.height).toBeLessThan(450);
  });

  it("ÖN ve YAN görünüşün yüksekliği EŞİTTİR (aynı oda, aynı ölçek)", () => {
    // Kullanıcı bildirimi (02.09.2026, md. 5). Eskiden iki kutu iki ayrı
    // yükseklik tavanına (168 / 116) çarpıyordu ve aynı 2,8 m'lik oda solda
    // 154 px, sağda 104 px çiziliyordu — teknik resimde izdüşüm çizgileri
    // ancak eşit ölçekte hizalanır.
    const diagram = climateRoomDiagram(room);
    // İKİ DIŞ ZARF = alanca en büyük iki dikdörtgen (iç zarflar da eşittir
    // ama duvar kalınlığı kadar küçüktür; ölçüt dış kutulardır).
    const kutular = diagram.els
      .filter((el) => el.kind === "rect")
      .sort((a, b) => b.w * b.h - a.w * a.h)
      .slice(0, 2);
    expect(Math.round(kutular[0].h)).toBe(Math.round(kutular[1].h));
    expect(Math.round(kutular[0].y)).toBe(Math.round(kutular[1].y));
  });

  it("her pano etiketi KENDİ KUTUSUNA sığar", () => {
    // Sığmayan etiket atılmaz, `P1` biçimine kısalır; hiçbir hâlde kutusundan
    // taşmaz. Ölçüt `textWidth`in kendisidir, sabit bir px eşiği değil.
    const kalabalik: ClimateRoomParams = {
      ...room,
      deviceCount: 6,
      panelWidthsMm: [600, 800, 800, 800, 800, 600],
    };
    for (const p of [room, kalabalik]) {
      const diagram = climateRoomDiagram(p);
      const panolar = diagram.els
        .filter((el) => el.kind === "rect")
        .filter((el) => el.h > 20 && el.h < 120 && el.w < 80);
      const etiketler = diagram.els
        .filter((el) => el.kind === "text")
        .filter((el) => /^P\d+(-|$)/.test(el.text));
      for (const et of etiketler) {
        const kutu = panolar.find((r) => Math.abs(r.x + r.w / 2 - et.x) < 0.6);
        expect(kutu, et.text).toBeDefined();
        expect(textWidth(et) * 1.08, et.text).toBeLessThanOrEqual(kutu!.w);
      }
    }
  });

  it("panolardan sonra BOYDA KALAN mesafe yazılır; sığmıyorsa işaretle", () => {
    const sigan = climateRoomDiagram({ ...room, remainingLengthMm: 1200 });
    expect(sigan.els.some((el) => el.kind === "text" && el.text === "Kalan 1.200 mm")).toBe(true);
    const sigmayan = climateRoomDiagram({ ...room, remainingLengthMm: -400 });
    expect(
      sigmayan.els.some((el) => el.kind === "text" && el.text.startsWith("SIĞMIYOR"))
    ).toBe(true);
  });
});

describe("operatör kabini alt etiket şeridi", () => {
  const kabin: ClimateRoomParams = {
    title: "Operatör Kabini",
    widthM: 2.5, lengthM: 2, heightM: 2.4,
    insulationMm: 50, doorCount: 1, doorWidthMm: 700, doorHeightMm: 1900,
    ambientTempC: 50, ambientRhPct: 50, roomTempC: 23, roomRhPct: 50,
    outdoor: false,
    transmissionKw: 0.81, solarKw: 0, radiationKw: 0, deviceHeatKw: 0.3,
    occupantKw: 0.13, freshAirKw: 0.62, totalKw: 2.14,
    freshAirM3h: 18, airFlowM3h: 809,
    glazingAreaM2: 2.5, occupantCount: 1, deviceCount: 0, deviceLabel: "Cihazlar",
  };

  it("etiketler EN ÇOK İKİ taban çizgisine oturur — basamaklanmaz", () => {
    // Kullanıcı bildirimi (02.09.2026, md. 13): "aşağılı yukarılı yazılar var".
    // Dört etiket ayrı ayrı basıldığında çakışma çözücü ikisini 7,6 px aşağı
    // itiyordu; artık şerit elle kuruluyor ve `fixed` olduğu için kaydırılamaz.
    const diagram = climateRoomDiagram(kabin);
    // ŞERİDİN KENDİSİ: kutunun altındaki, birleştirilmiş etiket satırları.
    // "Operatör" başlıkta ve yük çubuğu lejantında da geçtiği için ad değil
    // BİÇİM aranır — şerit parçaları " · " ile birleşiktir ya da tek parçadır.
    const parca = /(\d+ Kapı|Cam [\d,]+ m²|Cihazlar|\d+ Operatör)/;
    const serit = diagram.els
      .filter((el) => el.kind === "text")
      .filter((el) => el.fixed === true && parca.test(el.text));
    expect(serit.length).toBeGreaterThan(0);
    const taban = new Set(serit.map((el) => Math.round(el.y)));
    expect(taban.size).toBeLessThanOrEqual(2);
    for (const el of serit) expect(el.fixed, el.text).toBe(true);
  });

  it("dört bilgi de kaybolmaz", () => {
    const metin = climateRoomDiagram(kabin)
      .els.filter((el) => el.kind === "text")
      .map((el) => el.text)
      .join(" | ");
    expect(metin).toContain("1 Kapı");
    expect(metin).toContain("Cam 2,5 m²");
    expect(metin).toContain("1 Operatör");
  });
});

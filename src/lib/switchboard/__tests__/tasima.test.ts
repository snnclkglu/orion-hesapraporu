// ŞEMADA SÜRÜKLENEN AYGIT — bırakma indeksi ve çözümdeki karşılığı (PANO-23).
//
// İki ayrı şeyin testidir ve ikisi de sessizce yanlış olabilirdi:
//
//  1. BIRAKMA İNDEKSİNİN ARİTMETİĞİ. Taşınan aygıt listeden çıkacağı için
//     hedef indeks onun eski yerinden sonraysa bir azaltılmalıdır. Azaltılmazsa
//     cihaz her sürüklemede bir adım GERİDE kalır — kullanıcı "tuttu ama tam
//     oraya gitmedi" der ve ikinci kez sürükler. Bu hesap bir React
//     bileşeninin içinde yaşasaydı hiç sınanamazdı.
//
//  2. YAZILAN SIRANIN ÇÖZÜMDE İŞLEMESİ. `order_in_rail` sütunu okunuyordu,
//     yerleştirici onu dinliyordu — ama HİÇBİR YERE YAZILMIYORDU. PANO-23'ün
//     temeli yarım bağlıydı: okuyan ve uygulayan taraf vardı, yazan taraf yok.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { birakmaIndeksi } from "@/lib/diagrams/panoLayout";
import { auditLineup } from "../audit";
import { computeSwitchboardLayout, resolveSettings } from "../compute";
import type { PlacementOverride } from "../types";

describe("bırakma indeksi", () => {
  const sira = ["A", "B", "C", "D", "E"];

  it("SOLA bırakılan aygıt komşunun ÖNÜNE geçer", () => {
    // E'yi B'nin soluna: E, B'den sonra olduğu için düşüş yok.
    expect(birakmaIndeksi(sira, "E", "B", true)).toBe(1);
  });

  it("SAĞA bırakılan aygıt komşunun ARKASINA geçer", () => {
    expect(birakmaIndeksi(sira, "E", "B", false)).toBe(2);
  });

  it("İLERİ taşımada indeks BİR AZALIR", () => {
    // A'yı D'nin sağına. Ham hedef 4; A çıkınca liste kayar, doğru cevap 3.
    expect(birakmaIndeksi(sira, "A", "D", false)).toBe(3);
  });

  it("GERİ taşımada indeks OLDUĞU GİBİ kalır", () => {
    expect(birakmaIndeksi(sira, "D", "A", true)).toBe(0);
  });

  it("aygıtı KENDİ yerine bırakmak yerini değiştirmez", () => {
    // C'yi C'nin soluna bırakmak: hedef 2, yani C'nin kendi indeksi.
    expect(birakmaIndeksi(sira, "C", "C", true)).toBe(2);
  });

  it("tanınmayan komşu için karar YOKTUR", () => {
    expect(birakmaIndeksi(sira, "A", "Z", true)).toBeNull();
  });

  it("indeks listenin DIŞINA taşmaz", () => {
    expect(birakmaIndeksi(sira, "X", "E", false)).toBe(4);
    expect(birakmaIndeksi(sira, "X", "A", true)).toBe(0);
  });

  it("BOŞ listede karar YOKTUR", () => {
    expect(birakmaIndeksi([], "A", "B", true)).toBeNull();
  });
});

function parca(over: Partial<ElectricalPart> = {}): ElectricalPart {
  return {
    deviceTag: "=T1+P1-F1",
    installation: "T1",
    location: "P1",
    device: "F1",
    qty: 1,
    designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 10A",
    typeNo: "5SL6310-7",
    supplier: "Siemens",
    partNo: "SIE.5SL6310-7",
    page: 1,
    ...over,
  };
}

function duzeltme(deviceKey: string, order: number): PlacementOverride {
  return {
    deviceKey,
    panelCode: null,
    mountType: null,
    zone: null,
    railIndex: null,
    orderInRail: order,
    anchorDeviceKey: null,
    anchorSide: null,
    widthMm: null,
    heightMm: null,
    depthMm: null,
    pinned: true,
    note: "",
  };
}

describe("taşınan aygıt ÇÖZÜMDE de taşınır", () => {
  const salterler = Array.from({ length: 6 }, (_, i) =>
    parca({ device: `F${i + 1}`, deviceTag: `=T1+P1-F${i + 1}` })
  );

  /** Sürükle-bırakın gerçek zinciri: indeksi hesapla, düzeltme olarak yaz. */
  function surukleVeCoz(tasinan: string, komsu: string, oncesine: boolean) {
    const once = computeSwitchboardLayout({ parts: salterler });
    const sirali = once.room[0].placements.map((p) => p.deviceKey);
    const hedef = birakmaIndeksi(sirali, tasinan, komsu, oncesine);
    expect(hedef).not.toBeNull();
    const sonra = computeSwitchboardLayout({
      parts: salterler,
      placementOverrides: [duzeltme(tasinan, hedef as number)],
    });
    return { once: sirali, sonra: sonra.room[0].placements.map((p) => p.label), sonuc: sonra };
  }

  it("SONA taşınan aygıt gerçekten sona gider", () => {
    const { sonra } = surukleVeCoz("T1|P1|F1", "T1|P1|F6", false);
    expect(sonra).toEqual(["F2", "F3", "F4", "F5", "F6", "F1"]);
  });

  it("BAŞA taşınan aygıt gerçekten başa gider", () => {
    const { sonra } = surukleVeCoz("T1|P1|F6", "T1|P1|F1", true);
    expect(sonra).toEqual(["F6", "F1", "F2", "F3", "F4", "F5"]);
  });

  it("ORTAYA taşınan aygıt komşusunun yanına oturur", () => {
    const { sonra } = surukleVeCoz("T1|P1|F1", "T1|P1|F4", false);
    expect(sonra).toEqual(["F2", "F3", "F4", "F1", "F5", "F6"]);
  });

  it("taşınan aygıt SABİTLENİR ve rozet taşır", () => {
    const { sonuc } = surukleVeCoz("T1|P1|F1", "T1|P1|F6", false);
    const y = sonuc.room[0].placements.find((p) => p.label === "F1");
    expect(y?.pinned).toBe(true);
  });

  it("taşıma DENETİMİ BOZMAZ", () => {
    // Sürükle-bırak bir plan üretir ve o plan da ölçülür (PANO-11): çakışma,
    // ray kapasitesi, eksiksizlik. Kullanıcının eli bunları geçersiz kılmaz.
    const { sonuc } = surukleVeCoz("T1|P1|F1", "T1|P1|F4", false);
    const denetim = auditLineup(
      sonuc.room,
      resolveSettings({}),
      sonuc.devices.filter((d) => d.panelCode === "P1")
    );
    for (const a of denetim) {
      const kalanlar = a.result.checks.filter((c) => !c.ok);
      expect(kalanlar.map((c) => `${a.code}/${c.key}: ${c.detail}`)).toEqual([]);
    }
  });

  it("taşıma ölçü düzeltmesini SİLMEZ", () => {
    // `movePlacement` bilerek ayrı bir eylemdir: `savePlacement` ölçü
    // alanlarını `null` varsayar ve yalnız sıra göndermek kullanıcının elle
    // yazdığı ölçüyü silerdi. Burada iki alanın birlikte yaşadığı sabitlenir.
    const elleOlculu: PlacementOverride = {
      ...duzeltme("T1|P1|F1", 5),
      widthMm: 70,
      heightMm: 90,
      depthMm: 80,
    };
    const sonuc = computeSwitchboardLayout({
      parts: salterler,
      placementOverrides: [elleOlculu],
    });
    const y = sonuc.room[0].placements.find((p) => p.label === "F1");
    expect(y?.widthMm).toBe(70);
    expect(y?.dimSource).toBe("elle");
    expect(sonuc.room[0].placements.at(-1)?.label).toBe("F1");
  });

  it("parmak izi taşımayla DEĞİŞİR — onay eskir", () => {
    const a = computeSwitchboardLayout({ parts: salterler }).fingerprint;
    const b = computeSwitchboardLayout({
      parts: salterler,
      placementOverrides: [duzeltme("T1|P1|F1", 5)],
    }).fingerprint;
    expect(b).not.toBe(a);
  });
});

describe("BÖLÜNMÜŞ GÖZDE taşıma pano AÇMAZ", () => {
  // Ölçülmüş tuzak (0026-01, 08.09.2026): bölünmüş bir gözün kodu (`LVD0-D`)
  // gerçek bir konum değil, bölücünün ÜRETTİĞİ bir addır. Sürükleme onu bir
  // yerleşim düzeltmesi olarak yazınca dizide AYNI KODLU İKİNCİ bir göz
  // beliriyor ve toplam en 2.500 mm'den 2.900 mm'ye çıkıyordu — imalatçı
  // fazladan bir gövde keserdi.
  //
  // Bu yüzden `movePlacement` pano koduna DOKUNMAZ; test o sözleşmeyi çivi
  // gibi tutar.
  const klemens = Array.from({ length: 40 }, (_, i) =>
    parca({
      location: "LVD9",
      device: `X${i + 1}`,
      deviceTag: `=T1+LVD9-X${i + 1}`,
      designation: "Feed-through terminal block UT 2,5",
      typeNo: "UT 2,5",
      supplier: "Phoenix Contact",
      partNo: "PXC.3044076",
      qty: 200,
    })
  );

  it("bölünmüş dizide taşıma GÖZ SAYISINI ve TOPLAM ENİ değiştirmez", () => {
    const once = computeSwitchboardLayout({ parts: klemens });
    expect(once.room.length).toBeGreaterThan(1);

    const hedefGoz = once.room.find((p) => p.placements.length > 2);
    expect(hedefGoz).toBeTruthy();
    const sirali = (hedefGoz as NonNullable<typeof hedefGoz>).placements
      .map((p) => p.deviceKey)
      .filter((k, i, a) => a.indexOf(k) === i);
    const hedef = birakmaIndeksi(sirali, sirali[sirali.length - 1], sirali[0], true);

    const sonra = computeSwitchboardLayout({
      parts: klemens,
      // `panelCode: null` — taşıma pano kodu YAZMAZ.
      placementOverrides: [duzeltme(sirali[sirali.length - 1], hedef as number)],
    });

    expect(sonra.room.length).toBe(once.room.length);
    expect(sonra.room.reduce((t, p) => t + p.widthMm, 0)).toBe(
      once.room.reduce((t, p) => t + p.widthMm, 0)
    );
    // Aynı kodlu iki göz OLAMAZ.
    const kodlar = sonra.room.map((p) => p.code);
    expect(new Set(kodlar).size).toBe(kodlar.length);
  });
});

describe("BÖLGE SINIRINI aşan taşıma", () => {
  // Kullanıcı bir kumanda rölesini giriş bandının ortasına sürükleyebilir.
  // Yerleştirici bunu ENGELLEMEZ — mühendis kendi panosunu bilir — ama bölge
  // değişince yeni ray açar (PANO-4) ve sonucu ÇİZİMDE görünür. Sessizce
  // reddetmek ya da rayları karıştırmak, ikisi de yanlış olurdu.
  const karisik = [
    ...Array.from({ length: 3 }, (_, i) =>
      parca({ device: `F${i + 1}`, deviceTag: `=T1+P1-F${i + 1}` })
    ),
    parca({
      device: "K1",
      deviceTag: "=T1+P1-K1",
      designation: "INTERFACE RELAY 24VDC 6A",
      typeNo: "G2RV-SL700",
      supplier: "Omron",
      partNo: "OMR.G2RV",
    }),
  ];

  it("kumanda rölesi giriş bandına taşınabilir ve SIRA korunur", () => {
    const sonuc = computeSwitchboardLayout({
      parts: karisik,
      placementOverrides: [duzeltme("T1|P1|K1", 1)],
    });
    const p = sonuc.room[0];
    expect(p.placements.map((x) => x.label)).toEqual(["F1", "K1", "F2", "F3"]);

    // BÖLGE ARTIK RAY AÇMIYOR (PANO-37, kullanıcı kararı 09.09.2026):
    // "gruplandırmaya gerek yok, yan yana koyulabilir." Eski kural bu taşımada
    // ÜÇ ray açıyordu (giriş · kumanda · giriş) ve iki rayın sağı boş
    // kalıyordu. Dördü de aynı raya sığıyor.
    expect(p.rails).toHaveLength(1);
    const oRayin = p.placements.filter((x) => x.railIndex === 0);
    expect(oRayin).toHaveLength(4);
    // Sabitlenen sıra RAY İÇİNDE de korunur: K1, F1 ile F2'nin arasındadır.
    expect([...oRayin].sort((a, b) => a.xMm - b.xMm).map((x) => x.label)).toEqual([
      "F1",
      "K1",
      "F2",
      "F3",
    ]);
  });

  it("bölge aşan taşıma denetimi BOZMAZ", () => {
    const sonuc = computeSwitchboardLayout({
      parts: karisik,
      placementOverrides: [duzeltme("T1|P1|K1", 1)],
    });
    const denetim = auditLineup(
      sonuc.room,
      resolveSettings({}),
      sonuc.devices.filter((d) => d.panelCode === "P1")
    );
    for (const a of denetim) {
      expect(a.result.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual([]);
    }
  });
});

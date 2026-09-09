// AYGIT AYIRMA — alt aygıt, ürünsüz satır ve pano yanı ekipmanı.
//
// Üçü de "Panoya girmeyen aygıtlar" yığınının nasıl okunacağıyla ilgilidir.
// Ölçüldü (0026-01, 08.09.2026): o yığın 50 satırdı ve 35'i bir yerleşim
// hatası değil bir SINIFLANDIRMA eksiğiydi; gerçek eksik olan dört ölçüsüz
// sürücü o kalabalığın içinde görünmüyordu. Kuyruğun her satırının TEK ve
// DOĞRU bir gerekçesi olmak zorunda.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { auditLineup } from "../audit";
import { computeSwitchboardLayout, resolveSettings } from "../compute";

function parca(over: Partial<ElectricalPart> = {}): ElectricalPart {
  return {
    deviceTag: "=100T+LVD0-F1",
    installation: "100T",
    location: "LVD0",
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

function coz(parts: ElectricalPart[]) {
  return computeSwitchboardLayout({ parts });
}

/** Kuyruğun sebep sayaçları. */
function kuyruk(r: ReturnType<typeof coz>): Record<string, number> {
  const m: Record<string, number> = {};
  for (const u of r.unplaced) m[u.reason] = (m[u.reason] ?? 0) + 1;
  return m;
}

describe("alt aygıt ana aygıta yutulur (PANO-24)", () => {
  it("sürücünün opsiyon kartı AYRI yer istemez", () => {
    // 0026'nın gerçek satırları: `-U20` sürücü, `-U20-U15` onun yuvasına takılan
    // enkoder arayüz kartı. İkinci satır ayrı bir kutu olsaydı montaj
    // plakasında kendi yerini isterdi.
    const r = coz([
      parca({
        device: "U20",
        deviceTag: "=100T+LVD0-U20",
        designation: "ATV930 - 90kW - 400/480V - with braking unit - IP21",
        typeNo: "ATV930D90N4",
        supplier: "SE",
        partNo: "SE.ATV930D90N4",
      }),
      parca({
        device: "U20-U15",
        deviceTag: "=100T+LVD0-U20-U15",
        designation: "ATV900 HTL encoder interface modul",
        typeNo: "VW3A3424",
        supplier: "SE",
        partNo: "SE.VW3A3424",
      }),
      ...Array.from({ length: 3 }, (_, i) =>
        parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
      ),
    ]);
    const anahtarlar = r.unplaced.map((u) => u.device.key);
    expect(anahtarlar).not.toContain("100T|LVD0|U20U15");
    // Sürücünün kendisi kuyrukta (ölçüsü defterde yok) ama kart YOK.
    expect(anahtarlar).toContain("100T|LVD0|U20");
  });

  it("ÖKSÜZ alt aygıt kendi kutusudur", () => {
    // 0026'da `-M36-1G12` enkoderi var, `-M36` motoru malzeme listesinde yok.
    // Onu yutacak bir gövde olmadığı için kaybolmamalı.
    const r = coz([
      ...Array.from({ length: 3 }, (_, i) =>
        parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
      ),
      parca({
        device: "M36-1G12",
        deviceTag: "=100T+LVD0-M36-1G12",
        designation: "Hollow Shaft Encoder for Direct Coupling",
        typeNo: "80H20630V1024-R3",
        supplier: "FNC",
        partNo: "FNC.80H",
      }),
    ]);
    expect(r.unplaced.map((u) => u.device.key)).toContain("100T|LVD0|M361G12");
  });
});

describe("ürünsüz satır SINIFLANMAMIŞ değildir", () => {
  it("tedarikçisi, tipi ve parça numarası boş satır kendi kovasına düşer", () => {
    // 0026'nın `-Y64`…`-Y75` fren bobinleri: aygıt etiketi var, malzeme yok
    // (redüktörle birlikte geliyor). Sınıflandırıcıya kızmanın anlamı yok.
    const r = coz([
      ...Array.from({ length: 3 }, (_, i) =>
        parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
      ),
      parca({
        device: "Y64",
        deviceTag: "=100T+LVD0-Y64",
        qty: null,
        designation: "",
        typeNo: "",
        supplier: "",
        partNo: "",
      }),
    ]);
    expect(kuyruk(r).urunsuz).toBe(1);
    expect(kuyruk(r).siniflanmamis ?? 0).toBe(0);
  });

  it("ürünü OLAN ama tanınmayan satır hâlâ SINIFLANMAMIŞTIR", () => {
    // Ayrım anlamlıdır: burada sınıflandırılacak bir ürün VAR ve tanınmadı.
    const r = coz([
      ...Array.from({ length: 3 }, (_, i) =>
        parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
      ),
      parca({
        device: "Z9",
        deviceTag: "=100T+LVD0-Z9",
        designation: "BILINMEYEN CIHAZ",
        typeNo: "XYZ-1",
        supplier: "ACME",
        partNo: "ACME.XYZ1",
      }),
    ]);
    expect(kuyruk(r).siniflanmamis).toBe(1);
    expect(kuyruk(r).urunsuz ?? 0).toBe(0);
  });
});

describe("pano yanı ekipmanı KUYRUĞA DÜŞMEZ, listeye girer (PANO-27 · PANO-37)", () => {
  // PANO YANINDA ARTIK YALNIZ FREN DİRENCİ VAR (kullanıcı düzeltmesi,
  // 09.09.2026): siren, korna, ikaz kolonu ve projektör sahaya taşındı.
  // Fikstür de onunla birlikte değişti — bu describe'ın konusu "çizilmeyen
  // ama panonun yanında duran ekipman"dır, hangi aile olduğu değil.
  const yanSatirlar = [
    parca({
      device: "R24",
      deviceTag: "=100T+LVD0-R24",
      designation: "Braking Resistor 75kW, 3 Ohm",
      typeNo: "BRSD-836SW-7503",
      supplier: "RESSA",
      partNo: "RES.BRSD-836SW-7503",
    }),
    parca({
      device: "R34",
      deviceTag: "=100T+LVD0-R34",
      designation: "Braking Resistor 11kW, 25 Ohm",
      typeNo: "BRSD-836SW-1125",
      supplier: "RESSA",
      partNo: "RES.BRSD-836SW-1125",
    }),
  ];

  it("fren dirençleri panonun yan listesindedir", () => {
    const r = coz([
      ...Array.from({ length: 3 }, (_, i) =>
        parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
      ),
      ...yanSatirlar,
    ]);
    const yan = r.room.flatMap((p) => p.sideDevices).map((d) => d.label);
    expect(yan.sort()).toEqual(["R24", "R34"]);
  });

  it("İKAZ VE AYDINLATMA yan listede DEĞİL, sahadadır (PANO-37)", () => {
    const r = coz([
      ...Array.from({ length: 3 }, (_, i) =>
        parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
      ),
      parca({
        device: "H166",
        deviceTag: "=100T+LVD0-H166",
        designation: "40W 108dB Siren",
        typeNo: "SNT-SL190-22",
        supplier: "MC",
        partNo: "MC.SNT-SL190-22",
      }),
      parca({
        device: "E151",
        deviceTag: "=100T+LVD0-E151",
        designation: "160W 5000K 230VAC LED Floodlight",
        typeNo: "N1000-P-2/160W.5000K",
        supplier: "NIKI",
        partNo: "NIKI.N1000",
      }),
    ]);
    expect(r.room.flatMap((p) => p.sideDevices)).toHaveLength(0);
    // KAYBOLMAZLAR: `saha` kuyruğunda sebebiyle görünürler (PANO-10).
    const saha = r.unplaced.filter((u) => u.reason === "saha").map((u) => u.device.label);
    expect(saha.sort()).toEqual(["E151", "H166"]);
  });

  it("kuyrukta GÖRÜNMEZ ve SİPARİŞ KAPISINI kapatmaz", () => {
    const salterler = Array.from({ length: 3 }, (_, i) =>
      parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
    );
    const yansiz = coz(salterler);
    const yanli = coz([...salterler, ...yanSatirlar]);

    expect(yanli.unplaced.map((u) => u.device.label)).toEqual([]);
    // Ölçüsü bilinmiyor ama sipariş sayacını KIPIRDATMAZ: bir sirenin eni
    // panonun gövdesini belirlemez (PANO-12 sayacı GÖVDE içindir).
    expect(yanli.estimatedCount).toBe(yansiz.estimatedCount);
  });

  it("montaj plakasına ve kapağa GİRMEZ", () => {
    const r = coz([
      ...Array.from({ length: 3 }, (_, i) =>
        parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
      ),
      ...yanSatirlar,
    ]);
    for (const p of r.room) {
      expect(p.placements.some((y) => y.mountType === "yan")).toBe(false);
      expect(p.doorPlacements.some((y) => y.mountType === "yan")).toBe(false);
    }
  });

  it("YALNIZ yan ekipman olan konum PANO AÇMAZ", () => {
    // Bir sirenin asıldığı yer bir gövde değildir (PANO-2 ile aynı ilke:
    // tek başına bir lamba da pano açmaz).
    const r = coz(yanSatirlar);
    expect(r.room).toHaveLength(0);
    expect(r.excluded.map((e) => e.code)).toContain("LVD0");
  });
});

describe("ÇİZİLMEYEN aygıt da denetlenir", () => {
  // PANO-11 denetçisi sonucu ölçer, algoritmanın iddiasını değil. Ama denetim
  // yalnız plaka ve kapağı ölçüyordu: gövde gereci (fan, termostat, pano
  // lambası) ve pano yanı ekipmanı (fren direnci) `ayir()` içinde bir
  // daldan düşse HİÇBİR ŞEY haber vermezdi. O aygıtlar çizilmiyor ama SİPARİŞ
  // EDİLİYOR; sessiz kayıp yanlış yerleşimden tehlikelidir.
  const parts = [
    ...Array.from({ length: 3 }, (_, i) =>
      parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
    ),
    parca({
      device: "M162",
      deviceTag: "=100T+LVD0-M162",
      designation: "Panels Ventilation Fan Filter 27W",
      typeNo: "FULL2500",
      supplier: "QUICK",
      partNo: "QCK.FULL2500",
    }),
    parca({
      device: "R24",
      deviceTag: "=100T+LVD0-R24",
      designation: "Braking Resistor 75kW, 3 Ohm",
      typeNo: "BRSD-836SW-7503",
      supplier: "RESSA",
      partNo: "RES.BRSD-836SW-7503",
    }),
  ];

  const sonuc = coz(parts);
  const beklenen = sonuc.devices.filter((d) => d.panelCode === "LVD0");

  function denetle(panolar: typeof sonuc.room) {
    return auditLineup(panolar, resolveSettings({}), beklenen)
      .flatMap((a) => a.result.checks.map((c) => ({ ...c, kod: a.code })))
      .filter((c) => !c.ok);
  }

  it("eksiksiz dizide gövde ve yan denetimi GEÇER", () => {
    const kalanlar = denetle(sonuc.room);
    expect(kalanlar.map((c) => `${c.kod}/${c.key}`)).toEqual([]);
  });

  it("gövde gereci ELLE DÜŞÜRÜLÜRSE denetim YAKALAR", () => {
    // Denetimin bir şey ölçtüğünü kanıtlamanın tek yolu, ölçtüğü şeyi bozmak.
    const bozuk = sonuc.room.map((p) => ({ ...p, bodyDevices: [] }));
    const kalanlar = denetle(bozuk);
    expect(kalanlar.map((c) => c.key)).toContain("govde-eksiksizlik");
    expect(kalanlar.find((c) => c.key === "govde-eksiksizlik")?.detail).toContain("M162");
  });

  it("pano yanı ekipmanı ELLE DÜŞÜRÜLÜRSE denetim YAKALAR", () => {
    const bozuk = sonuc.room.map((p) => ({ ...p, sideDevices: [] }));
    const kalanlar = denetle(bozuk);
    expect(kalanlar.map((c) => c.key)).toContain("yan-eksiksizlik");
    expect(kalanlar.find((c) => c.key === "yan-eksiksizlik")?.detail).toContain("R24");
  });

  it("denetim GEÇENLERİ de sayar — neyin denetlendiği görünür (PANO-11)", () => {
    const hepsi = auditLineup(sonuc.room, resolveSettings({}), beklenen).flatMap(
      (a) => a.result.checks
    );
    const govde = hepsi.find((c) => c.key === "govde-eksiksizlik");
    const yan = hepsi.find((c) => c.key === "yan-eksiksizlik");
    expect(govde?.detail).toBe("1 gereç");
    expect(yan?.detail).toBe("1 ekipman");
  });
});

describe("her dizinin denetim satırının KENDİ ADI vardır", () => {
  it("oda ve saha satırları ayrı adlandırılır", () => {
    // Ölçüldü (08.09.2026): iki dizi de satırını "Dizi geneli" diye
    // adlandırıyordu. @react-pdf aynı anahtarı iki kez görünce satırlardan
    // birini DÜŞÜREBİLİR — imalatçının kâğıdından bir denetim eksilirdi.
    // Ayrıca okuyan, başarısız bir denetimin hangi diziye ait olduğunu
    // göremiyordu.
    const r = coz([
      ...Array.from({ length: 3 }, (_, i) =>
        parca({ device: `F${i + 1}`, deviceTag: `=100T+LVD0-F${i + 1}` })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        parca({
          location: "TB1",
          device: `F${i + 1}`,
          deviceTag: `=100T+TB1-F${i + 1}`,
        })
      ),
    ]);
    const kodlar = r.audits.map((a) => a.code);
    expect(kodlar).toContain("Oda dizisi geneli");
    expect(kodlar).toContain("Saha dizisi geneli");
    // Hiçbir denetim satırı aynı adı taşımaz.
    expect(new Set(kodlar).size).toBe(kodlar.length);
  });
});

// Uçtan uca entegrasyon: runCalc(V5_TEMPLATE).
//
// Modüller arası bağımlılıklar motorda TÜRETİLİR (ör. ana kiriş, araba
// modülünün hesapladığı gerçek hızı ve ivmelenme süresini alır). Bu test o
// zincirin uçtan uca tutarlı çalıştığını doğrular.
//
// NOT: hücre bazlı tarihsel karşılaştırma modül başına ayrı dosyalarda yapılır
// (*.golden.test.ts); burada TEKRARLANMAZ. Bu dosya motorun kendi iç
// tutarlılığına bakar: zincirin kopmadığı, türetilmiş değerlerin makul olduğu
// ve yayını engelleyen kontrol kümesinin bilinçli biçimde sabitlendiği.

import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "../defaults";
import { runCalc } from "../engine";
import { blockingFailures } from "../types";

describe("engine entegrasyonu — V5 şablonu", () => {
  const result = runCalc(V5_TEMPLATE);

  it("tüm modüller hesaplanır", () => {
    for (const key of [
      "mainHoist", "auxHoist", "hookBlock", "trolley", "bridge",
      "girder", "buckling", "endCarriage",
    ] as const) {
      expect(result[key], key).toBeDefined();
    }
  });

  it("modüller arası türetilmiş bağımlılık zinciri kopmaz", () => {
    // Araba/köprü → ana kiriş: gerçek hız ve ivmelenme süresi kaynak modülden
    // gelir; sıfır ya da tanımsız olursa ana kirişin yatay yük zinciri çöker.
    for (const which of ["trolley", "bridge"] as const) {
      const v = result[which]!.values;
      expect(v.actualSpeedMpm, `${which} gerçek hız`).toBeGreaterThan(0);
      expect(v.startupTimeS, `${which} kalkış süresi`).toBeGreaterThan(0);
    }
    // Ana kaldırma → kanca bloğu: halat yükü ve tambur devri aktarılır.
    expect(result.hookBlock!.values.ropeLoadKg).toBeCloseTo(
      result.mainHoist!.values.ropeLoadKg,
      9
    );
  });

  it("hiçbir modül sonlu olmayan (NaN/Infinity) değer üretmez", () => {
    const bad: string[] = [];
    for (const key of [
      "mainHoist", "auxHoist", "hookBlock", "trolley", "bridge",
      "girder", "buckling", "endCarriage",
    ] as const) {
      const cells = result[key]!.cells;
      for (const [name, value] of Object.entries(cells)) {
        if (typeof value === "number" && !Number.isFinite(value)) {
          bad.push(`${key}.${name} = ${value}`);
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("her kontrolün gereken/sağlanan değeri sonludur", () => {
    const bad = result.allChecks.filter((c) => {
      const provided = Number.isFinite(c.provided);
      const required =
        c.op === "range"
          ? Number.isFinite(c.min) && Number.isFinite(c.max)
          : Number.isFinite(c.required);
      return !provided || !required;
    });
    expect(bad.map((c) => c.id), "tanımsız kontrol değeri").toEqual([]);
  });

  it("referans iş emrinin yayını engelleyen kontrolleri bilinçli olarak sabittir", () => {
    // Bu liste referans vinçte GERÇEKTEN sağlanmayan kontrollerdir; değişmesi
    // ya bir hesap değişikliğine ya da girdi değişikliğine işaret eder ve
    // mühendislik etkisi değerlendirilmeden güncellenmemelidir.
    const blocking = blockingFailures(result.allChecks).map((c) => c.id).sort();
    expect(blocking, `engelleyici kırılmalar: ${blocking.join(", ")}`).toEqual(
      [
        "bridge.brake.torque",          // köprü freni referans işte seçilmemiş
        // Hareket eden toplam W artık köprü + araba kapasitesi/kanca/halat
        // donanımıyla hesaplandığı için referans redüktör emniyeti yetersizdir.
        "bridge.gearbox.safety",
        "hookBlock.sheaveBearing.life", // makara rulmanı ömrü yetersiz (2707 < 6300 saat)
        "main.gearbox.torque",          // redüktör torku sınırın hemen altında (22 < 22,07 kNm)
        // Tambur mili D1 = 6 cm referans yükte yetersiz: 115 MPa > 90 MPa (C30).
        // Kesme kontrolü sağlanıyor, eğilme ve bileşik sağlanmıyor.
        "main.shaft.bending",
        "main.shaft.stress",
      ].sort()
    );
  });
});

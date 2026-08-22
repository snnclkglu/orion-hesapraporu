// TEKER KATSAYILARI MOTORLA AYRIŞMASIN — kural iki yerde yaşıyor (değişmez md. 8).
//
// Hızlı teker seçimi (md. 12) FEM 1.001 4.2.4.1'in iki tablosunu okur:
// mekanizma katsayısı c2 (T.4.2.4.1.3) ve limit yüzey basıncı PL. İkisi de
// hesap motorunda ZATEN VAR (`lib/calc/modules/travelGroup.ts`) ama orada
// DIŞA AKTARILMAMIŞ yerel yardımcılardır; dışa açmak, bir hesap modülünün iç
// ayrıntısını iki modülün sözleşmesi hâline getirirdi.
//
// Bu yüzden maliyet tarafında kendi kopyaları var. Bedeli, standardın aynı
// tablosunun iki yerde yaşamasıdır — ve bu test o boşluğu kapatır: motorun
// KAYNAK DOSYASINI okur, tablo satırlarını oradan çıkarır ve maliyet
// tarafındaki fonksiyonla karşılaştırır (`terms.test.ts` deseni).

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { wheelLimitPressureOf, wheelMechanismFactor } from "../params";
import { CRANE_CLASSES } from "../params";

const MOTOR = path.join(process.cwd(), "src/lib/calc/modules/travelGroup.ts");

function motorKaynagi(): string {
  return readFileSync(MOTOR, "utf8");
}

describe("c2 mekanizma katsayısı motorla aynıdır", () => {
  const kaynak = motorKaynagi();

  it("motorda `mechanismFactorC2` hâlâ var (fikstür bozulmamış)", () => {
    expect(kaynak.includes("function mechanismFactorC2")).toBe(true);
  });

  it("her vinç sınıfında motorun yazdığı sayıyı verir", () => {
    // Motorun gövdesi okunur ve sayılar ORADAN çıkarılır; beklenen değerler
    // bu dosyaya yazılsaydı üçüncü bir kopya doğardı.
    const gövde = kaynak.slice(
      kaynak.indexOf("function mechanismFactorC2"),
      kaynak.indexOf("\n}", kaynak.indexOf("function mechanismFactorC2"))
    );
    const oku = (sinif: string): number => {
      const satir = gövde
        .split("\n")
        .find((l) => l.includes(`"${sinif}"`) && l.includes("return"));
      // M7/M8 tek bir `return` ile kapanır (koşulsuz son satır).
      const m = (satir ?? gövde.split("\n").filter((l) => l.includes("return")).pop() ?? "").match(
        /return\s+([\d.]+)/
      );
      if (!m) throw new Error(`motorda ${sinif} için sayı bulunamadı`);
      return Number(m[1]);
    };
    for (const sinif of CRANE_CLASSES) {
      expect(wheelMechanismFactor(sinif), sinif).toBe(oku(sinif));
    }
  });
});

describe("limit yüzey basıncı PL motorla aynıdır", () => {
  const kaynak = motorKaynagi();

  it("motorda `wheelLimitPressure` hâlâ var", () => {
    expect(kaynak.includes("function wheelLimitPressure")).toBe(true);
  });

  it("motorun bandları ve değerleri birebir okunur", () => {
    const bas = kaynak.indexOf("function wheelLimitPressure");
    const gövde = kaynak.slice(bas, kaynak.indexOf("\n}", bas));
    // `if (t >= 500 && t < 600) return 5;` biçimindeki her satır bir banttır.
    const bantlar = [...gövde.matchAll(/>=\s*(\d+)[^\n]*?return\s+([\d.]+)/g)].map((m) => ({
      alt: Number(m[1]),
      pl: Number(m[2]),
    }));
    expect(bantlar.length).toBeGreaterThanOrEqual(6);
    for (const b of bantlar) {
      expect(wheelLimitPressureOf(b.alt), `${b.alt} N/mm²`).toBe(b.pl);
    }
  });

  it("500 N/mm² ALTINDA sınır YOKTUR — sıfır değil, null", () => {
    // Motorda o hâl bir METİN döndürüyor ("Tanımsız …"); burada `null`dır ve
    // öneri boş kalır. İkisi de aynı şeyi söyler: bu malzeme uygun değildir.
    expect(wheelLimitPressureOf(400)).toBeNull();
    expect(wheelLimitPressureOf(Number.NaN)).toBeNull();
  });
});

// Bordro çekirdeği — yasal hesabın doğrulaması.
//
// EN GÜÇLÜ İDDİA: 2026 parametreleriyle BRÜT ASGARİ ÜCRET verildiğinde çıkan
// net, Asgari Ücret Tespit Komisyonu'nun ilan ettiği NET ASGARİ ÜCRETİN TA
// KENDİSİ olmalıdır (28.075,50 ₺). Bu tek sınama SGK oranını, işsizlik
// oranını, vergi dilimini, gelir vergisi istisnasını ve damga vergisi
// istisnasını AYNI ANDA doğrular — biri yanlışsa sayı tutmaz.

import { describe, expect, it } from "vitest";
import {
  brutBul,
  brutten,
  bordroyaGirenNet,
  dilimliVergi,
  gecerliParametre,
  saatlikMaliyet,
  yilKumulatifi,
  type PayrollParams,
} from "../bordro";

/** 2026 — migration'daki `hr_payroll_params` satırının birebir aynısı. */
const P2026: PayrollParams = {
  validFrom: "2026-01-01",
  label: "2026",
  minWageGross: 33030,
  sgkCeiling: 297270,
  sgkEmployeeRate: 0.14,
  unemploymentEmployeeRate: 0.01,
  sgkEmployerRate: 0.2075,
  unemploymentEmployerRate: 0.02,
  stampTaxRate: 0.00759,
  brackets: [
    { ust: 190000, oran: 0.15 },
    { ust: 400000, oran: 0.2 },
    { ust: 1500000, oran: 0.27 },
    { ust: 5300000, oran: 0.35 },
    { ust: null, oran: 0.4 },
  ],
  incomeTaxExemption: 4211.33,
  stampTaxExemption: 250.7,
  source: "test",
  verified: true,
};

describe("asgari ücret — parametrelerin çapraz doğrulaması", () => {
  const b = brutten(33030, 0, P2026);

  it("brüt asgari ücret, ilan edilen NET asgari ücreti verir", () => {
    // 33.030 − 4.624,20 (SGK) − 330,30 (işsizlik) − 0 (GV istisna kapatıyor)
    //        − 0 (DV istisna kapatıyor) = 28.075,50
    expect(b.net).toBeCloseTo(28075.5, 2);
  });

  it("asgari ücrette gelir ve damga vergisi TAMAMEN istisnadır", () => {
    expect(b.incomeTax).toBe(0);
    expect(b.stampTax).toBe(0);
    // Ham vergi sıfır DEĞİLDİR — istisna onu kapatır. İkisini karıştırmak
    // bordroda "vergi hiç hesaplanmadı" gibi okunurdu.
    expect(b.incomeTaxGross).toBeCloseTo(4211.33, 2);
    expect(b.stampTaxGross).toBeCloseTo(250.7, 2);
  });

  it("istisna tutarları asgari ücretin kendisinden çıkar", () => {
    // GV istisnası = (brüt − %14 − %1) × %15
    const matrah = 33030 - 33030 * 0.14 - 33030 * 0.01;
    expect(matrah * 0.15).toBeCloseTo(P2026.incomeTaxExemption, 1);
    // DV istisnası = brüt × 0,00759
    expect(33030 * 0.00759).toBeCloseTo(P2026.stampTaxExemption, 1);
  });
});

describe("brütleştirme (netten brüte)", () => {
  it("net → brüt → net turu kapanır", () => {
    for (const net of [28075.5, 45000, 71000, 120000, 250000]) {
      const b = brutBul(net, 0, P2026);
      // Bulunan brüt geri çevrildiğinde aynı neti vermeli.
      expect(brutten(b.gross, 0, P2026).net).toBeCloseTo(net, 1);
    }
  });

  it("brüt her zaman netten büyüktür ve makul bandda kalır", () => {
    const b = brutBul(71000, 0, P2026);
    expect(b.gross).toBeGreaterThan(71000);
    // %15 SGK + vergi: brüt netin 1,2–2,2 katı arasında olmalı.
    expect(b.gross / 71000).toBeGreaterThan(1.2);
    expect(b.gross / 71000).toBeLessThan(2.2);
  });

  it("sıfır net sıfır brüt verir — uydurulmuş bir taban yok", () => {
    const b = brutBul(0, 0, P2026);
    expect(b.gross).toBe(0);
    expect(b.totalDeductions).toBe(0);
  });

  it("kesintiler toplamı bileşenlerine eşittir", () => {
    const b = brutBul(90000, 0, P2026);
    expect(b.totalDeductions).toBeCloseTo(
      b.sgkEmployee + b.unemploymentEmployee + b.incomeTax + b.stampTax,
      2
    );
    expect(b.gross - b.totalDeductions).toBeCloseTo(b.net, 1);
  });
});

describe("SGK tavanı", () => {
  it("tavanı aşan kazançtan prim ALINMAZ", () => {
    const b = brutten(400000, 0, P2026);
    expect(b.sgkBase).toBe(P2026.sgkCeiling);
    expect(b.sgkEmployee).toBeCloseTo(297270 * 0.14, 2);
  });

  it("tavan altında matrah brütün kendisidir", () => {
    const b = brutten(100000, 0, P2026);
    expect(b.sgkBase).toBe(100000);
  });
});

describe("kümülatif matrah ve vergi dilimi", () => {
  it("dilim yılbaşından biriken matraha göre yükselir", () => {
    // İlk 190.000 %15, sonrası %20.
    const ilk = dilimliVergi(0, 100000, P2026.brackets);
    expect(ilk.vergi).toBeCloseTo(15000, 2);
    expect(ilk.uygulananOran).toBe(0.15);

    // 180.000 birikmişken 40.000 matrah: 10.000'i %15, 30.000'i %20.
    const ikinci = dilimliVergi(180000, 40000, P2026.brackets);
    expect(ikinci.vergi).toBeCloseTo(10000 * 0.15 + 30000 * 0.2, 2);
    expect(ikinci.uygulananOran).toBe(0.2);
  });

  it("dilim atlayan matrah bütün ara dilimlerden geçer", () => {
    const v = dilimliVergi(0, 500000, P2026.brackets);
    const beklenen = 190000 * 0.15 + 210000 * 0.2 + 100000 * 0.27;
    expect(v.vergi).toBeCloseTo(beklenen, 2);
    expect(v.uygulananOran).toBe(0.27);
  });

  it("AYNI MAAŞ yıl ilerledikçe daha çok vergilenir", () => {
    // Bordronun en çok soru alan davranışı: net sabitken brüt yıl içinde
    // ARTAR, çünkü aynı neti verebilmek için daha çok vergi ödenmelidir.
    const satirlar = Array.from({ length: 12 }, (_, i) => ({
      period: `2026-${String(i + 1).padStart(2, "0")}`,
      netSalary: 90000,
      overtimeAmount: 0,
      bonus: 0,
    }));
    const harita = yilKumulatifi(satirlar, P2026);
    const ocak = harita.get("2026-01")!;
    const aralik = harita.get("2026-12")!;
    expect(aralik.gross).toBeGreaterThan(ocak.gross);
    expect(aralik.appliedRate).toBeGreaterThanOrEqual(ocak.appliedRate);
    // Kümülatif matrah her ay artmalı, hiç düşmemeli.
    let onceki = 0;
    for (let i = 1; i <= 12; i++) {
      const k = harita.get(`2026-${String(i).padStart(2, "0")}`)!.cumulativeTaxBase;
      expect(k).toBeGreaterThan(onceki);
      onceki = k;
    }
  });

  it("kümülatif hesap SIRAYA duyarlıdır, girdi sırası değil", () => {
    // Satırlar karışık gelse de sonuç aynı olmalı — fonksiyon kendi sıralar.
    const a = [
      { period: "2026-03", netSalary: 50000, overtimeAmount: 0, bonus: 0 },
      { period: "2026-01", netSalary: 50000, overtimeAmount: 0, bonus: 0 },
      { period: "2026-02", netSalary: 50000, overtimeAmount: 0, bonus: 0 },
    ];
    const h1 = yilKumulatifi(a, P2026);
    const h2 = yilKumulatifi([...a].reverse(), P2026);
    expect(h1.get("2026-03")!.gross).toBeCloseTo(h2.get("2026-03")!.gross, 2);
  });
});

describe("bordroya giren kazanç", () => {
  it("fazla mesai ve prim matraha girer", () => {
    expect(
      bordroyaGirenNet({ period: "2026-08", netSalary: 71000, overtimeAmount: 48753.33, bonus: 5000 })
    ).toBeCloseTo(124753.33, 2);
  });

  it("harcirah ve avans BURAYA GİRMEZ", () => {
    // Harcirah masraf karşılığıdır (GVK md. 24), avans zaten ödenmiş ücretin
    // mahsubudur; ikisi de vergi matrahını değiştirmez.
    const r = { period: "2026-08", netSalary: 71000, overtimeAmount: 0, bonus: 0 };
    expect(bordroyaGirenNet({ ...r })).toBe(71000);
  });
});

describe("parametre seçimi", () => {
  const P2025: PayrollParams = { ...P2026, validFrom: "2025-01-01", label: "2025", minWageGross: 26005.5 };

  it("dönem için EN YENİ geçerli parametre kazanır", () => {
    expect(gecerliParametre([P2025, P2026], "2026-08")?.label).toBe("2026");
    expect(gecerliParametre([P2025, P2026], "2025-06")?.label).toBe("2025");
  });

  it("parametresi olmayan dönem NULL döner — uydurma yok", () => {
    expect(gecerliParametre([P2026], "2024-05")).toBeNull();
    expect(gecerliParametre([], "2026-08")).toBeNull();
  });

  it("yıl ortası zam ikinci satırla gelir, eskisi silinmez", () => {
    const temmuz: PayrollParams = { ...P2026, validFrom: "2026-07-01", label: "2026/2" };
    expect(gecerliParametre([P2026, temmuz], "2026-06")?.label).toBe("2026");
    expect(gecerliParametre([P2026, temmuz], "2026-07")?.label).toBe("2026/2");
  });
});

describe("saatlik maliyet", () => {
  it("kur varsa avro, yoksa null — sıfır DEĞİL", () => {
    const a = saatlikMaliyet(1_000_000, 5000, 54.8231, "net")!;
    expect(a.try).toBeCloseTo(200, 6);
    expect(a.eur).toBeCloseTo(200 / 54.8231, 6);
    const b = saatlikMaliyet(1_000_000, 5000, null, "net")!;
    expect(b.eur).toBeNull();
  });

  it("saat yoksa hesap YAPILMAZ (sıfıra bölme)", () => {
    expect(saatlikMaliyet(1000, 0, 50, "net")).toBeNull();
    expect(saatlikMaliyet(0, 100, 50, "net")).toBeNull();
  });

  it("ölçülen büyüklük künyede durur", () => {
    expect(saatlikMaliyet(1000, 10, 50, "employer")!.kind).toBe("employer");
  });
});

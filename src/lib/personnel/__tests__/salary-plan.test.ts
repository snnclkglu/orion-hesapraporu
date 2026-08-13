// Ücret planı çekirdeği — zam aritmetiği ve geçerlilik çözümlemesi.
//
// Testin ASIL İŞİ İKİ KAYMAYI ENGELLEMEKTİR:
//
//  1. BİRİM KAYMASI. Oran ekranda YÜZDE (15), veritabanında KESİRDİR (0,15).
//     Dönüşüm yalnız iki yerdedir (`loadSalaryPlan` okurken, `oranKesre`
//     yazarken) ve çekirdeğin tamamı YÜZDE konuşur. Bir gün çekirdeğe kesir
//     verilirse %15'lik bir zam %0,15'e düşer ve kimse fark etmez — sayı
//     hâlâ makul görünür.
//
//  2. TABAN KAYMASI. Yıl başı zammının tabanı "geçen yılın ARALIK ayında
//     geçerli ücret"tir; yılın ortalaması ya da ocak ayındaki ücreti değil.
//     Yıl içi ayarlama almış bir kişide bu fark gerçek paradır.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUND_STEP,
  RAISE_PRESETS,
  gecerliUcret,
  planSapmasi,
  yilBasi,
  yilBasiTabani,
  yuvarla,
  zamOrani,
  zamliUcret,
} from "../salary-plan";

const PLAN = [
  { employeeId: "a", effectiveFrom: "2025-01", netSalary: 40000 },
  { employeeId: "a", effectiveFrom: "2025-09", netSalary: 47500 }, // yıl içi ayarlama
  { employeeId: "a", effectiveFrom: "2026-01", netSalary: 55000 },
  { employeeId: "b", effectiveFrom: "2026-01", netSalary: 30000 },
];

describe("yuvarlama", () => {
  it("varsayılan adım 100 ₺'dir (devralınan 566 satırın tamamı yüzlüktü)", () => {
    expect(DEFAULT_ROUND_STEP).toBe(100);
  });

  it("adımına en yakın değere gider", () => {
    expect(yuvarla(53675, 100)).toBe(53700);
    expect(yuvarla(53625, 100)).toBe(53600);
    expect(yuvarla(53675, 1000)).toBe(54000);
    expect(yuvarla(53675, 500)).toBe(53500);
  });

  it("adım 1 yuvarlamayı kapatır ve bozuk adım 1 sayılır", () => {
    expect(yuvarla(53675.4, 1)).toBe(53675);
    expect(yuvarla(53675.4, 0)).toBe(53675);
    expect(yuvarla(53675.4, Number.NaN)).toBe(53675);
  });
});

describe("zam aritmetiği", () => {
  it("hazır oranlar kullanıcının kendi listesidir", () => {
    expect([...RAISE_PRESETS]).toEqual([5, 10, 15, 20, 25]);
  });

  it("ORAN YÜZDEDİR, kesir değil — birim kayması burada yakalanır", () => {
    // 50.000'e %15 zam 57.500 eder. Çekirdek kesir bekleseydi (0,15) aynı
    // çağrı 50.000 × 1,15 yerine 50.000 × 15 = 750.000 verirdi.
    expect(zamliUcret(50000, 15, 1)).toBe(57500);
    // Kesir verilirse sonuç neredeyse değişmez — sessiz hatanın kendisi budur;
    // test bu iki sonucun ASLA aynı olmadığını dondurur.
    expect(zamliUcret(50000, 0.15, 1)).toBe(50075);
  });

  it("yuvarlamayı zammın üstüne uygular", () => {
    expect(zamliUcret(47500, 13, 100)).toBe(53700); // ham 53.675
    expect(zamliUcret(47500, 13, 1)).toBe(53675);
  });

  it("tabanı olmayan ya da sıfır olan kişiye zam 0 döner", () => {
    expect(zamliUcret(null, 15)).toBe(0);
    expect(zamliUcret(0, 15)).toBe(0);
    expect(zamliUcret(-100, 15)).toBe(0);
  });

  it("oran ile ücret birbirinin tersidir", () => {
    const yeni = zamliUcret(40000, 20, 1);
    expect(yeni).toBe(48000);
    expect(zamOrani(40000, yeni)).toBeCloseTo(20, 10);
  });

  it("taban yoksa oran SIFIR DEĞİL null'dur", () => {
    // "zam yok" ile "taban bilinmiyor" aynı şey değildir: ilk ücreti "%0 zam
    // almış" göstermek, ekranda ortalamayı da aşağı çekerdi.
    expect(zamOrani(null, 50000)).toBeNull();
    expect(zamOrani(0, 50000)).toBeNull();
    expect(zamOrani(40000, null)).toBeNull();
  });
});

describe("geçerlilik çözümlemesi", () => {
  it("dönemden sonra başlayan karar geçmez", () => {
    expect(gecerliUcret(PLAN, "a", "2025-06")?.netSalary).toBe(40000);
    expect(gecerliUcret(PLAN, "a", "2025-09")?.netSalary).toBe(47500);
    expect(gecerliUcret(PLAN, "a", "2025-12")?.netSalary).toBe(47500);
    expect(gecerliUcret(PLAN, "a", "2026-03")?.netSalary).toBe(55000);
  });

  it("ilk karardan ÖNCESİ null'dur — sıfır değil", () => {
    expect(gecerliUcret(PLAN, "a", "2024-12")).toBeNull();
    expect(gecerliUcret(PLAN, "yok", "2026-01")).toBeNull();
  });

  it("gün taşıyan dönem de aynı aya düşer", () => {
    expect(gecerliUcret(PLAN, "a", "2026-01-01")?.netSalary).toBe(55000);
  });

  it("liste SIRALI GELMEK ZORUNDA DEĞİLDİR", () => {
    // Sıralı gelmesini şart koşmak, çağıranın unuttuğu gün sessizce yanlış
    // ücret verirdi.
    const karisik = [...PLAN].reverse();
    expect(gecerliUcret(karisik, "a", "2025-12")?.netSalary).toBe(47500);
  });

  it("TABAN ARALIK AYIDIR, ocak ya da ortalama değil", () => {
    // 2026 zammının tabanı 47.500'dür (eylül ayarlaması), 40.000 değil.
    expect(yilBasiTabani(PLAN, "a", 2026)?.netSalary).toBe(47500);
    expect(yilBasiTabani(PLAN, "b", 2026)).toBeNull();
  });

  it("yıl başı günü ayın ilk günüdür", () => {
    expect(yilBasi(2026)).toBe("2026-01-01");
  });
});

describe("plan sapması", () => {
  it("bir liranın altındaki fark sapma sayılmaz", () => {
    // Yuvarlama artığı yüzünden her satırı uyarıya boğmak, uyarıyı anlamsız
    // kılardı.
    expect(planSapmasi(50000, 50000.4)).toBeNull();
    expect(planSapmasi(50000, 49999.6)).toBeNull();
  });

  it("gerçek sapmayı İŞARETİYLE döndürür", () => {
    expect(planSapmasi(50000, 45000)).toBe(-5000);
    expect(planSapmasi(50000, 52000)).toBe(2000);
  });

  it("planı olmayan satır sapma üretmez", () => {
    expect(planSapmasi(null, 50000)).toBeNull();
    expect(planSapmasi(0, 50000)).toBeNull();
  });
});

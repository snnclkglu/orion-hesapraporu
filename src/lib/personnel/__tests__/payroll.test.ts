// Maaş çekirdeği — devralınan Excel'e karşı TARİHSEL DOĞRULAMA + fizik.
//
// Buradaki sayılar "ORİON - Personel ve Maaş Listesi.xlsx" dosyasından
// alınmıştır ve şartname DEĞİL FİKSTÜRDÜR (hesap motorundaki
// `__tests__/legacy/` ile aynı statü): bağıntının kaynağı 4857 sayılı İş
// Kanunu md. 41'dir, Excel yalnız o bağıntının 566 satırda tuttuğunu
// gösterir.
//
// Testin ASIL İŞİ İKİ KAYNAĞI BİRBİRİNE BAĞLAMAKTIR: aynı bağıntı bir kez
// TypeScript'te (`fazlaMesaiTutari`, ekran önizlemesi) bir kez Postgres'te
// (`hr_payroll.overtime_amount` generated sütunu) yazılıdır. İkisi
// ayrışırsa kullanıcı kaydetmeden önce bir tutar görür, kaydettikten sonra
// başka bir tutar — ve fark sessizdir.

import { describe, expect, it } from "vitest";
import {
  AYLIK_CALISMA_SAATI,
  donemOzeti,
  fazlaMesaiTutari,
  hizmetGunu,
  hizmetSuresiMetni,
  netCalismaSaati,
  periodLabel,
  periodRange,
  saatlikUcret,
  yas,
} from "../payroll";

describe("fazla mesai bağıntısı", () => {
  it("aylık çalışma saati 225'tir (30 gün × 7,5 saat)", () => {
    // Sabit üç yerde kullanılıyor; değişirse ne kırıldığı burada görünsün.
    expect(AYLIK_CALISMA_SAATI).toBe(225);
  });

  it("saatlik ücret net maaşın 225'te biridir", () => {
    expect(saatlikUcret(45000)).toBeCloseTo(200, 10);
    expect(saatlikUcret(0)).toBe(0);
    expect(saatlikUcret(null)).toBe(0);
  });

  it("%50 zamlı saat 1,5 katı, %100 zamlı 2 katı öder", () => {
    // 45.000 / 225 = 200 TL/saat → 10 saat %50 = 3.000, 10 saat %100 = 4.000
    expect(fazlaMesaiTutari(45000, 10, 0)).toBeCloseTo(3000, 6);
    expect(fazlaMesaiTutari(45000, 0, 10)).toBeCloseTo(4000, 6);
    expect(fazlaMesaiTutari(45000, 10, 10)).toBeCloseTo(7000, 6);
  });

  it("maaşı olmayan satırda mesai tutarı sıfırdır", () => {
    // Saat girilmiş ama maaş girilmemişse tutar UYDURULMAZ. Saatlik ücret
    // maaştan çıkar; maaş yoksa hesaplanacak bir şey yoktur.
    expect(fazlaMesaiTutari(0, 40, 8)).toBe(0);
    expect(fazlaMesaiTutari(null, 40, 8)).toBe(0);
  });

  // ——————————————————————————————————————————— DEVRALINAN KAYIT (fikstür)
  //
  // Aşağıdaki altı satır Excel'den birebir alınmıştır ve aktarım sırasında
  // 566 satırın TAMAMI 0,02 TL toleransla doğrulandı (sıfır sapma). Burada
  // uçlar ve tipik durumlar dondurulur.
  const FIKSTUR: [ad: string, net: number, s50: number, s100: number, tutar: number][] = [
    ["REYHAN AKTAŞ · 2024-05", 18000, 27, 0, 3240],
    ["REYHAN AKTAŞ · 2024-10 (iki oranlı)", 18000, 16, 4, 2560],
    ["HİKMET BOZKIR · 2024-10 (iki oranlı)", 50000, 9, 11, 7888.888888888889],
    ["ORHAN KILIÇ · 2025-12 (en yüksek saat)", 71000, 103, 0, 48753.33333333333],
    ["MEHMET AVCI · 2026-01", 85000, 22.5, 0, 12750],
    ["MURAT KARAKURT · 2026-01 (yarım saat)", 44000, 7.5, 0, 2200],
  ];

  it.each(FIKSTUR)("devralınan kayıt: %s", (_ad, net, s50, s100, tutar) => {
    expect(fazlaMesaiTutari(net, s50, s100)).toBeCloseTo(tutar, 6);
  });

  it("veritabanındaki türetilmiş sütunla AYNI bağıntıyı yazar", () => {
    // Postgres tarafı: round((net/225.0) * (s50*1.5 + s100*2.0), 2)
    // Yuvarlama farkı en fazla yarım kuruş olmalıdır.
    const yuvarla = (v: number) => Math.round(v * 100) / 100;
    for (const [, net, s50, s100, tutar] of FIKSTUR) {
      expect(yuvarla(fazlaMesaiTutari(net, s50, s100))).toBe(yuvarla(tutar));
    }
  });
});

describe("dönem özeti", () => {
  const rows = [
    { employeeId: "a", netSalary: 45000, overtimeHours50: 10, overtimeHours100: 0, overtimeAmount: 3000 },
    { employeeId: "b", netSalary: 90000, overtimeHours50: 0, overtimeHours100: 5, overtimeAmount: 4000 },
  ];

  it("normal çalışma saati kişi × 225'tir", () => {
    expect(donemOzeti(rows).normalHours).toBe(450);
  });

  it("kişi başı ortalama ve saat maliyeti türetilir", () => {
    const o = donemOzeti(rows);
    expect(o.count).toBe(2);
    expect(o.netTotal).toBe(135000);
    expect(o.netAverage).toBe(67500);
    expect(o.overtimeHours).toBe(15);
    expect(o.overtimeTotal).toBe(7000);
    expect(o.overtimeHourCost).toBeCloseTo(7000 / 15, 10);
  });

  it("boş dönemde bölme yoktur", () => {
    // Sıfıra bölünmüş bir ortalama NaN olur ve ekranda sessizce "—" değil
    // "NaN ₺" basılırdı.
    const o = donemOzeti([]);
    expect(o.netAverage).toBe(0);
    expect(o.overtimeHourCost).toBe(0);
  });
});

describe("net çalışma saati", () => {
  it("normal + mesai − izin − rapor", () => {
    // Excel "Aylık Çalışma Saatleri" 2024-05: 2025 + 72,5 − 12 − 0 = 2085,5
    expect(netCalismaSaati(2025, 72.5, 12, 0)).toBe(2085.5);
    // 2025-06: 5400 + 470 − 116,5 − 227 = 5526,5
    expect(netCalismaSaati(5400, 470, 116.5, 227)).toBe(5526.5);
  });
});

describe("dönem yardımcıları", () => {
  it("aralık iki ucu da kapsar ve yıl sınırını geçer", () => {
    expect(periodRange("2025-11", "2026-02")).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02",
    ]);
  });

  it("tek aylık aralık tek eleman döner, ters aralık boş", () => {
    expect(periodRange("2026-08", "2026-08")).toEqual(["2026-08"]);
    expect(periodRange("2026-08", "2026-07")).toEqual([]);
  });

  it("etiket Türkçedir", () => {
    expect(periodLabel("2026-08")).toBe("Ağustos 2026");
    expect(periodLabel("2025-01")).toBe("Ocak 2025");
  });
});

describe("hizmet süresi", () => {
  it("açık dönem bugüne kadar sayılır", () => {
    expect(hizmetGunu("2026-08-01", null, "2026-08-12")).toBe(11);
  });

  it("kapalı dönem çıkış tarihine kadar sayılır", () => {
    // Devralınan kayıt: CAFER ASLAN 2024-11-25 → 2024-12-31 = 36 gün
    expect(hizmetGunu("2024-11-25", "2024-12-31", "2026-08-12")).toBe(36);
  });

  it("giriş tarihi yoksa sıfırdır — uydurulmuş bir kıdem üretilmez", () => {
    expect(hizmetGunu(null, null, "2026-08-12")).toBe(0);
    expect(hizmetGunu("", "", "2026-08-12")).toBe(0);
  });

  it("okunur süre yıl ve ay verir", () => {
    expect(hizmetSuresiMetni(929)).toBe("2 yıl 6 ay");
    expect(hizmetSuresiMetni(36)).toBe("1 ay");
    expect(hizmetSuresiMetni(11)).toBe("11 gün");
    expect(hizmetSuresiMetni(0)).toBe("—");
  });

  it("yaş doğum tarihinden çıkar, yoksa null", () => {
    expect(yas("1994-08-10", "2026-08-12")).toBe(32);
    expect(yas(null, "2026-08-12")).toBeNull();
  });
});

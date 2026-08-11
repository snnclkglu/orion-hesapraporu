// Ödeme koşulu ve tarih bağıntıları.
//
// Buradaki en önemli test `odemeGunu`dur ve gerekçesi bir kullanıcı cümlesidir
// (11.08.2026, md. 11):
//
//   "Ödeme vadesi var ise ÜRÜN TESLİMİ + vade süresi şeklinde öderiz.
//    Sipariş tarihi + Vade DEĞİL."
//
// Bu kural iki yerde yaşıyor: burada (ekran + Excel) ve `purchase_order_totals`
// görünümünde (SQL). İkisi ayrışırsa finansa iki farklı gün söylenir; SQL
// karşılığı bu dosyanın sonunda migration OKUNARAK sınanır.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADVANCE_PERCENTS,
  PAYMENT_TERMS,
  advanceAmount,
  ayDonemi,
  avansGunu,
  eurKarsiligi,
  gunEkle,
  gunFarki,
  haftaDonemi,
  kurGerekli,
  odemeGunu,
  paymentTermLabel,
  paymentTermValue,
} from "../terms";

describe("odemeGunu — TESLİMDEN sayılır, sipariş tarihinden DEĞİL", () => {
  it("vadeli: teslim + vade", () => {
    expect(
      odemeGunu({ dueAt: "2026-09-01", receivedAt: "2026-09-10", paymentTermDays: 30 })
    ).toBe("2026-10-10");
  });

  it("mal gelmediyse TERMİN esas alınır (tahminin dayanağı tahmindir)", () => {
    expect(odemeGunu({ dueAt: "2026-09-01", receivedAt: null, paymentTermDays: 45 })).toBe(
      "2026-10-16"
    );
  });

  it("GERÇEKLEŞEN teslim, termini YENER", () => {
    // Mal termininden 20 gün geç geldiyse ödeme de 20 gün kayar.
    const tahmin = odemeGunu({ dueAt: "2026-09-01", receivedAt: null, paymentTermDays: 30 });
    const gercek = odemeGunu({ dueAt: "2026-09-01", receivedAt: "2026-09-21", paymentTermDays: 30 });
    expect(tahmin).toBe("2026-10-01");
    expect(gercek).toBe("2026-10-21");
  });

  it("peşinde ödeme günü TESLİM günüdür — vade eklenmez", () => {
    expect(odemeGunu({ dueAt: "2026-09-01", receivedAt: null, paymentTermDays: 0 })).toBe(
      "2026-09-01"
    );
  });

  it("ne teslim ne termin varsa gün YOKTUR — sipariş tarihine DÜŞMEZ", () => {
    // Sipariş tarihine düşmek, kuralın tam tersini yapmak olurdu.
    expect(odemeGunu({ dueAt: null, receivedAt: null, paymentTermDays: 30 })).toBeNull();
  });

  it("avans SİPARİŞ GÜNÜNDE ödenir — peşinatın tanımı budur", () => {
    expect(avansGunu({ orderedAt: "2026-08-12" })).toBe("2026-08-12");
  });
});

describe("advanceAmount — TUTAR yüzdeyi yener", () => {
  it("yüzdeden hesaplar", () => {
    expect(advanceAmount(10_000, 20, null)).toBe(2000);
  });

  it("elle yazılmış tutar kazanır (tedarikçi yuvarlak rakam ister)", () => {
    expect(advanceAmount(10_000, 20, 2500)).toBe(2500);
  });

  it("ikisi de yoksa sıfır", () => {
    expect(advanceAmount(10_000, null, null)).toBe(0);
    expect(advanceAmount(10_000, 0, 0)).toBe(0);
  });

  it("kullanıcının istediği yüzdeler listede", () => {
    for (const p of [5, 10, 15, 20, 25, 30]) {
      expect(ADVANCE_PERCENTS).toContain(p);
    }
  });
});

describe("PAYMENT_TERMS — kullanıcının listesi birebir", () => {
  it("Peşin · Kredi Kartı · 15/30/45/60/90 gün", () => {
    expect(PAYMENT_TERMS.map((t) => t.label)).toEqual([
      "Peşin",
      "Kredi Kartı",
      "15 gün",
      "30 gün",
      "45 gün",
      "60 gün",
      "90 gün",
    ]);
  });

  it("biçim ile gün AYRI durur — 'kredi kartı kaç gün eder' sorusu doğmaz", () => {
    const kk = PAYMENT_TERMS.find((t) => t.value === "kredi_karti")!;
    expect(kk.method).toBe("kredi_karti");
    expect(kk.days).toBe(0);
  });

  it("kayıttan açılır liste değeri geri bulunur", () => {
    expect(paymentTermValue("pesin", 0)).toBe("pesin");
    expect(paymentTermValue("vadeli", 45)).toBe("45");
    // Liste KAPALI DEĞİLDİR: 120 gün "özel" olarak geri döner.
    expect(paymentTermValue("vadeli", 120)).toBe("ozel");
  });

  it("etiket okunur", () => {
    expect(paymentTermLabel("pesin", 0)).toBe("Peşin");
    expect(paymentTermLabel("vadeli", 60)).toBe("60 gün vadeli");
  });
});

describe("eurKarsiligi — kuru olmayan satır toplama GİRMEZ", () => {
  it("avro satırı olduğu gibi geçer", () => {
    expect(eurKarsiligi(1000, "EUR", null)).toBe(1000);
  });

  it("kurla bölünür", () => {
    expect(eurKarsiligi(35_000, "TRY", 35)).toBe(1000);
  });

  it("kur yoksa NULL — SIFIR DEĞİL", () => {
    // Sıfır "bedava" derdi ve toplamlara sessizce girerdi.
    expect(eurKarsiligi(35_000, "TRY", null)).toBeNull();
    expect(eurKarsiligi(35_000, "TRY", 0)).toBeNull();
  });

  it("kur avro dışı her para biriminde zorunludur", () => {
    expect(kurGerekli("EUR")).toBe(false);
    expect(kurGerekli("TRY")).toBe(true);
    expect(kurGerekli("USD")).toBe(true);
  });
});

describe("dönemler", () => {
  it("ay dönemi Türkçe ad taşır", () => {
    expect(ayDonemi("2026-09-15")).toEqual({
      key: "2026-09",
      label: "Eylül 2026",
      start: "2026-09-01",
    });
  });

  it("hafta PAZARTESİ başlar — pazar günü dönem değiştirmez", () => {
    // 2026-08-16 pazar, 2026-08-17 pazartesi.
    const pazar = haftaDonemi("2026-08-16");
    const cumartesi = haftaDonemi("2026-08-15");
    expect(pazar.start).toBe(cumartesi.start);
    expect(haftaDonemi("2026-08-17").start).toBe("2026-08-17");
  });

  it("gün aritmetiği yerel gündür (UTC kayması yok)", () => {
    expect(gunEkle("2026-12-31", 1)).toBe("2027-01-01");
    expect(gunFarki("2026-09-10", "2026-09-01")).toBe(9);
    expect(gunFarki("2026-08-25", "2026-09-01")).toBe(-7);
    expect(gunFarki(null)).toBeNull();
    expect(gunFarki("bozuk")).toBeNull();
  });
});

describe("SQL karşılığı ayrışmamalı", () => {
  /**
   * `purchase_order_totals` görünümü ödeme gününü aynı kuralla hesaplar.
   * İki tanım ayrışırsa ekran bir gün, veritabanı başka bir gün söyler —
   * `progress.test.ts`in migration okuma kalıbının aynısı.
   */
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260812000002_purchasing.sql"),
    "utf8"
  );

  it("görünüm ödeme gününü TESLİMDEN sayıyor", () => {
    expect(migration).toContain("coalesce(o.received_at, o.due_at) + o.payment_term_days");
    // Sipariş tarihinden sayan bir bağıntı ASLA olmamalı.
    expect(migration).not.toMatch(/o\.ordered_at\s*\+\s*o\.payment_term_days/);
  });

  it("vade sıfırsa teslim gününün kendisi kullanılıyor", () => {
    expect(migration).toContain("when o.payment_term_days = 0 then coalesce(o.received_at, o.due_at)");
  });
});

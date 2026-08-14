// KDV çekirdeği — sarf gideri ve sipariş AYNI sözlüğü kullanır.
//
// Oran listesi üç yerde birden yaşıyor: burada, iki ekranın açılır listesinde ve
// veritabanının iki `check` kısıtında. Sonuncusu migration OKUNARAK sınanır
// (`terms.test.ts` ve `progress.test.ts` kalıbının aynısı) — ayrışırsa ekranda
// seçilebilen bir oran kaydetmede reddedilirdi.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_VAT_RATE, VAT_RATES, orderVatTotals, vatRateOf, vatTotals } from "../vat";

describe("vatTotals", () => {
  it("farklı KDV oranlarını satır bazında toplar", () => {
    expect(
      vatTotals([
        { net: 100, vatRate: 20 },
        { net: 200, vatRate: 10 },
        { net: 300, vatRate: 1 },
      ])
    ).toEqual({ net: 600, vat: 43, gross: 643 });
  });

  it("%0 satırı tutara girer ama KDV üretmez", () => {
    expect(vatTotals([{ net: 500, vatRate: 0 }])).toEqual({ net: 500, vat: 0, gross: 500 });
  });

  it("bozuk tutarları hesaba katmaz", () => {
    expect(
      vatTotals([
        { net: Number.NaN, vatRate: 20 },
        { net: -10, vatRate: 10 },
        { net: 50, vatRate: 1 },
      ])
    ).toEqual({ net: 50, vat: 0.5, gross: 50.5 });
  });
});

describe("vatRateOf — tanınmayan değer VARSAYILANA düşer, sıfıra DEĞİL", () => {
  it("geçerli oranları olduğu gibi verir", () => {
    for (const rate of VAT_RATES) expect(vatRateOf(rate)).toBe(rate);
  });

  it("veritabanından gelen metni okur", () => {
    expect(vatRateOf("10")).toBe(10);
    expect(vatRateOf("0")).toBe(0);
  });

  it("null / bilinmeyen oran varsayılan olur", () => {
    // Sıfıra düşseydi eski satırların ödeme takvimi olduğundan düşük çıkardı.
    expect(vatRateOf(null)).toBe(DEFAULT_VAT_RATE);
    expect(vatRateOf(8)).toBe(DEFAULT_VAT_RATE);
    expect(vatRateOf(undefined)).toBe(DEFAULT_VAT_RATE);
  });
});

describe("orderVatTotals — sipariş satırları", () => {
  it("adet × birim fiyat KDV hariç toplamdır", () => {
    expect(orderVatTotals([{ qty: 3, unitPrice: 100, vatRate: 20 }])).toEqual({
      net: 300,
      vat: 60,
      gross: 360,
    });
  });

  it("fiyatı girilmemiş satır sıfır sayılır", () => {
    expect(orderVatTotals([{ qty: 5, unitPrice: null }]).net).toBe(0);
  });

  it("oranı olmayan eski satır varsayılanla hesaplanır", () => {
    expect(orderVatTotals([{ qty: 1, unitPrice: 100 }]).gross).toBe(120);
  });
});

describe("SQL karşılığı ayrışmamalı", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260814000004_purchase_vat.sql"),
    "utf8"
  );

  it("iki tablonun kısıtı da aynı oran listesini taşıyor", () => {
    const liste = `(${VAT_RATES.join(", ")})`;
    // Sipariş satırı + sarf gideri — ikisi de aynı dizgiyle yazılır.
    expect(migration.match(new RegExp(liste.replace(/[()]/g, "\\$&"), "g"))?.length).toBe(2);
  });

  it("görünüm KDV'yi satır oranından hesaplıyor", () => {
    expect(migration).toContain("l.vat_rate / 100");
  });

  it("ödeme günü hâlâ TESLİMDEN sayılıyor", () => {
    // Görünüm yeniden yazıldı; kural değişmedi (`terms.test.ts` ile aynı şart).
    expect(migration).toContain("coalesce(o.received_at, o.due_at) + o.payment_term_days");
    expect(migration).not.toMatch(/o\.ordered_at\s*\+\s*o\.payment_term_days/);
  });
});

// GEÇMİŞ TEKLİF VERİ GÖÇÜNÜN KORUMA TESTLERİ.
//
// Bu migration tek seferlik görünse de canlı satış geçmişini kurar. Sınırın,
// fiyat kaynağının veya 0064 bağının ileride "sadeleştirilmesi" analizde onlarca
// işi sessizce kaybettirir; sözleşmeyi kaynak düzeyinde bu yüzden çiviliyoruz.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260904000003_historical_job_offers.sql"),
  "utf8"
);

describe("geçmiş işlerden teklif arşivi", () => {
  it("yalnız 0064 öncesini alır ve iş bağıyla tekrar çalışmaya dayanır", () => {
    expect(sql).toContain("::int < 64");
    expect(sql).toContain("not exists (select 1 from public.offers o where o.job_id = j.id)");
    expect(sql).toContain("create temporary table _historical_offer_backfill on commit drop");
  });

  it("fiyatları kalem kalem Satış Takibi'nden taşır, eksik fiyatı sıfır yapmaz", () => {
    expect(sql).toContain("join public.job_item_sales s on s.job_item_id = i.id");
    expect(sql).toContain("'unitPrice', s.unit_price");
    expect(sql).toContain("when count(*) filter (where s.unit_price is not null) = 0 then null");
    expect(sql).not.toContain("coalesce(s.unit_price, 0)");
  });

  it("teklif/veriliş/kazanım gününü iş emri günü yapar ve R0'ı yayımlar", () => {
    expect(sql).toContain("work_order_date, work_order_date, work_order_date");
    expect(sql).toContain("offer_id, 0, 'R0', 'issued', payload");
    expect(sql).toContain("'won', currency");
  });

  it("mevcut 0064 teklifini doğru işe bağlar", () => {
    expect(sql).toContain("8926d3aa-659e-4618-825e-f774c1efacc0");
    expect(sql).toContain("69dac3a5-45c7-4f94-ae52-2850b9542014");
    expect(sql).toContain("job_no = '0064'");
  });
});

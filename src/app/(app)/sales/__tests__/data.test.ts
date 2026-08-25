import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSaleRows } from "../data";

function istemci(
  yanitlar: Array<{ data: unknown[] | null; error: { code?: string; message: string } | null }>,
  sorgular: string[]
): SupabaseClient {
  return {
    from: () => ({
      select: (sorgu: string) => {
        sorgular.push(sorgu);
        return {
          order: async () => yanitlar.shift()!,
        };
      },
    }),
  } as unknown as SupabaseClient;
}

const kalem = {
  id: "item-1",
  item_no: "0064-01",
  product_name: "PORTAL VİNÇ",
  sort: 0,
  jobs: {
    id: "job-1",
    job_no: "0064",
    customer: "ASTOR A.Ş.",
    status: "active",
    contract_date: "2026-08-22",
    work_order_date: null,
    delivery_date: null,
    workshop_exit_date: null,
    shipping_address: "Uzun sevk adresi",
    customers: { short_name: "ASTOR", color_hue: 10 },
    job_contracts: null,
  },
  job_item_sales: null,
};

describe("Satış Takibi veri okuması", () => {
  it("shipping_country geçişi uygulanmamışsa eski şemayla yeniden okur", async () => {
    const sorgular: string[] = [];
    const supabase = istemci(
      [
        {
          data: null,
          error: { code: "42703", message: "column jobs_1.shipping_country does not exist" },
        },
        { data: [kalem], error: null },
      ],
      sorgular
    );

    const rows = await loadSaleRows(supabase);

    expect(rows).toHaveLength(1);
    expect(rows[0].itemNo).toBe("0064-01");
    expect(rows[0].jobShippingCountry).toBe("Türkiye");
    expect(sorgular[0]).toContain("shipping_country");
    expect(sorgular[1]).not.toContain("shipping_country");
  });

  it("başka bir veritabanı hatasını boş liste gibi gizlemez", async () => {
    const supabase = istemci(
      [{ data: null, error: { code: "42501", message: "permission denied" } }],
      []
    );

    await expect(loadSaleRows(supabase)).rejects.toThrow("permission denied");
  });
});

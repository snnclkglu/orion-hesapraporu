import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyPayload } from "@/lib/offers/payload";
import { addOfferTemplateItemDraft, saveOfferRevisionDraft } from "../mutations";

const offerId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";

function revisionClient(options: {
  written: Array<{ id: string }>;
  currentStatus?: "draft" | "issued" | null;
  onUpdate?: (value: Record<string, unknown>) => void;
}): SupabaseClient {
  const updateBuilder = {
    eq: () => updateBuilder,
    select: async () => ({ data: options.written, error: null }),
  };
  const selectBuilder = {
    eq: () => selectBuilder,
    maybeSingle: async () => ({
      data: options.currentStatus ? { status: options.currentStatus } : null,
      error: null,
    }),
  };
  return {
    from: () => ({
      update: (value: Record<string, unknown>) => {
        options.onUpdate?.(value);
        return updateBuilder;
      },
      select: () => selectBuilder,
    }),
  } as unknown as SupabaseClient;
}

describe("ortak teklif revizyonu yazma çekirdeği", () => {
  it("not verilmediyse not sütununa dokunmaz", async () => {
    let update: Record<string, unknown> | undefined;
    const result = await saveOfferRevisionDraft(
      revisionClient({ written: [{ id: revisionId }], onUpdate: (value) => (update = value) }),
      offerId,
      revisionId,
      { payload: { ...emptyPayload("EUR") }, background: false }
    );

    expect(result).toEqual({ data: { ok: true } });
    expect(update).toHaveProperty("payload");
    expect(update).not.toHaveProperty("notes");
  });

  it("yayımlanmış satıra yazmayı mevcut uyarı metniyle conflict yapar", async () => {
    const result = await saveOfferRevisionDraft(
      revisionClient({ written: [], currentStatus: "issued" }),
      offerId,
      revisionId,
      { payload: { ...emptyPayload("EUR") }, background: false }
    );

    expect(result).toEqual({
      error: {
        kind: "conflict",
        message: "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun.",
      },
    });
  });

  it("şablondan kalemi gerçek defter satırlarıyla kurup aynı kayıt yolundan geçirir", async () => {
    let writtenPayload: { items?: Array<{ id: string; groups: Array<{ key: string }> }> } | undefined;
    const currentBuilder = {
      eq: () => currentBuilder,
      maybeSingle: async () => ({ data: { payload: emptyPayload("EUR"), status: "draft" }, error: null }),
    };
    const templateBuilder = {
      eq: () => templateBuilder,
      maybeSingle: async () => ({
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          crane_type: "ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ",
          skeleton: { groupKeys: ["general", "mainHoist", "electrical"] },
        },
        error: null,
      }),
    };
    const updateBuilder = {
      eq: () => updateBuilder,
      select: async () => ({ data: [{ id: revisionId }], error: null }),
    };
    const supabase = {
      from: (table: string) => {
        if (table === "offer_revisions") {
          return {
            select: () => currentBuilder,
            update: (value: { payload: typeof writtenPayload }) => {
              writtenPayload = value.payload;
              return updateBuilder;
            },
          };
        }
        if (table === "offer_templates") return { select: () => templateBuilder };
        throw new Error(`Beklenmeyen tablo: ${table}`);
      },
    } as unknown as SupabaseClient;

    const result = await addOfferTemplateItemDraft(supabase, offerId, revisionId, {
      templateId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.item.craneType).toBe("ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ");
    expect(result.data?.item.groups.map((group) => group.key)).toEqual([
      "general",
      "mainHoist",
      "electrical",
      "safety",
    ]);
    expect(writtenPayload?.items).toHaveLength(1);
  });
});

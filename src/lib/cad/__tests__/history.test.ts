import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCadService } from "../service";
import { historySchema, monthRange, quickHistoryRange } from "../history";

const actor = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
function setup(status = "review", artifacts: unknown[] = [{ id: actor, kind: "pdf", name: "source_BIRLESIK.pdf", storage_path: "private/combined.pdf" }]) {
  const calls: unknown[][] = [];
  const signed = vi.fn(async () => ({ data: { signedUrl: "https://example.com/pdf" }, error: null }));
  const db = {
    from(table: string) {
      const response = { data: table === "cad_artifacts" ? artifacts : [], count: 145, error: null };
      const chain: Record<string, unknown> = {};
      for (const name of ["select","eq","is","ilike","gte","lt","order","range"]) chain[name] = (...args: unknown[]) => { calls.push([table,name,...args]); return chain; };
      chain.single = async () => ({ data: { id: jobId, status, attempt_id: actor, source_path: "source.dwg", source_name: "Kanca.dwg" }, error: null });
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(response).then(resolve);
      return chain;
    },
    storage: { from: () => ({ createSignedUrl: signed }) },
  } as unknown as SupabaseClient;
  return { calls, signed, service: createCadService(db, async () => ({ actor, db, canWrite: true }), "https://example.com") };
}
describe("CAD geçmişi ve birleşik PDF", () => {
  it("hızlı ay seçimi yıl geçişini, artık yılı ve Türkiye gününü korur", () => {
    expect(monthRange("2024-02")).toEqual({from:"2024-02-01",to:"2024-02-29"});
    expect(quickHistoryRange("previous",new Date("2026-01-05T12:00:00Z"))).toEqual({from:"2025-12-01",to:"2025-12-31"});
    expect(quickHistoryRange("today",new Date("2026-09-12T22:00:00Z"))).toEqual({from:"2026-09-13",to:"2026-09-13"});
  });
  it("filtreleri sahiplikle birlikte uygular ve 100'den eski kayıtlara sayfalar", async () => {
    const s = setup();
    const result = await s.service.snapshot(undefined, { search: "A%_", status: "review", device: actor, from: "2026-09-01", to: "2026-09-12", page: 6 });
    expect(result.total).toBe(145);
    expect(s.calls).toContainEqual(["cad_devices","is","revoked_at",null]);
    expect(s.calls).toContainEqual(["cad_jobs","eq","owner_id",actor]);
    expect(s.calls).toContainEqual(["cad_jobs","ilike","source_name","%A\\%\\_%"]);
    expect(s.calls).toContainEqual(["cad_jobs","eq","status","review"]);
    expect(s.calls).toContainEqual(["cad_jobs","eq","device_id",actor]);
    expect(s.calls).toContainEqual(["cad_jobs","gte","created_at","2026-09-01T00:00:00+03:00"]);
    expect(s.calls).toContainEqual(["cad_jobs","lt","created_at","2026-09-12T21:00:00.000Z"]);
    expect(s.calls).toContainEqual(["cad_jobs","range",120,139]);
  });
  it("geçersiz tarih aralığını ve durumu reddeder", () => {
    expect(historySchema.safeParse({ from:"2026-09-13",to:"2026-09-12" }).success).toBe(false);
    expect(historySchema.safeParse({ from:"2026-02-30" }).success).toBe(false);
    expect(historySchema.safeParse({ status:"anything" }).success).toBe(false);
  });
  it("birleşik PDF'yi yalnız sahibinin güncel denemesinden ve indirmeye zorlamadan açar", async () => {
    const s=setup();
    await s.service.fileUrl(jobId, undefined, true);
    expect(s.calls).toContainEqual(["cad_jobs","eq","owner_id",actor]);
    expect(s.calls).toContainEqual(["cad_artifacts","eq","attempt_id",actor]);
    expect(s.signed).toHaveBeenCalledWith("private/combined.pdf",60,undefined);
  });
  it("başarısız veya birleşik PDF'si eksik iş için başka dosyayı sunmaz", async () => {
    for (const s of [setup("failed"), setup("review", [{ kind:"pdf",name:"tek-pafta.pdf" }])]) {
      await expect(s.service.fileUrl(jobId,undefined,true)).rejects.toMatchObject({ status:404 });
      expect(s.signed).not.toHaveBeenCalled();
    }
  });
});

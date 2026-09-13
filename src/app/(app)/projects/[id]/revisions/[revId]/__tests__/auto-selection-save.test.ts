import { beforeEach, expect, it, vi } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";

const db = vi.hoisted(() => ({ role: "admin", context: "engineering", current: { inputs: {} as Record<string, unknown>, updated_at: "v1", status: "draft" }, updated: [{ id: "revision", updated_at: "v2" }], writes: [] as { table: string; value: Record<string, unknown>; filters: [string, unknown][] }[], audits: [] as unknown[] }));
const drawingPlan=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/drawing-plan-service",()=>({syncDrawingPlanAfterSave:drawingPlan}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/pdf/report", () => ({ renderReportPdf: vi.fn() }));
vi.mock("@/lib/settings", () => ({ getReportSettings: vi.fn() }));
vi.mock("@/lib/report-cover-identity-server", () => ({ loadReportCoverIdentity: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
  from(table: string) {
    const filters: [string, unknown][] = [];
    let write: Record<string, unknown> | undefined;
    const result = () => ({ data: write ? db.updated : table === "profiles" ? { role: db.role } : table === "projects" ? { report_context: db.context } : db.current, error: null });
    const query = {
      select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      maybeSingle: async () => result(), single: async () => result(),
      update(value: Record<string, unknown>) { write = value; db.writes.push({ table, value, filters }); return query; },
      insert: async (value: unknown) => { db.audits.push(value); return { error: null }; },
      then(resolve: (value: ReturnType<typeof result>) => unknown) { return Promise.resolve(result()).then(resolve); },
    };
    return query;
  },
}) }));
import { saveRevision, issueRevision } from "../actions";

beforeEach(() => {
  drawingPlan.mockReset().mockResolvedValue(undefined);
  db.role = "admin"; db.context = "engineering";
  db.current = { inputs: { offerTechnicalSource: { offerRevisionId: "offer", itemId: "item", warnings: ["Sınıf doğrulanmalı"] } }, updated_at: "v1", status: "draft" };
  db.updated = [{ id: "revision", updated_at: "v2" }]; db.writes = []; db.audits = [];
});
const save = (version: string) => saveRevision("project", "revision", NEW_WORK_TEMPLATE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, version);

it("eski sekmedeki kaydı yeni revizyonun üzerine yazmaz", async () => {
  const result = await save("old-version");
  expect(result.error).toContain("başka bir sekmede");
  expect(db.writes).toHaveLength(0); expect(db.audits).toHaveLength(0);
});
it("okuma ile yazma arasında kaydı değişen revizyonda başarı ve denetim kaydı üretmez", async () => {
  db.updated = [];
  const result = await save("v1");
  expect(result.error).toContain("kaydetme sırasında değişti");
  expect(db.writes[0].filters).toEqual(expect.arrayContaining([["id", "revision"], ["project_id", "project"], ["updated_at", "v1"], ["status", "draft"]]));
  expect(db.audits).toHaveLength(0);
});
it("başarılı kayıtta kaynak notlarını korur ve yeni kayıt sürümünü döndürür", async () => {
  expect(await save("v1")).toEqual({ ok: true, updatedAt: "v2", drawingPlanWarning:false, drawingPlanMessage:undefined });
  expect(drawingPlan).toHaveBeenCalledTimes(1);
  expect((db.writes[0].value.inputs as Record<string, unknown>).offerTechnicalSource).toEqual(db.current.inputs.offerTechnicalSource);
  expect(db.audits).toHaveLength(1);
});
it("mühendislik rolü teklif bağlamındaki raporu bu eylem üzerinden değiştiremez", async () => {
  db.role = "engineer"; db.context = "offer";
  expect((await save("v1")).error).toContain("yetkiniz yok");
  expect(db.writes).toHaveLength(0);
});
it("biçimi bozuk seçim izini sessizce kabul ederek yayımlamaz", async () => {
  db.current.inputs.autoSelection = { status: "readyForReview" };
  expect((await issueRevision("project", "revision", "")).error).toContain("kontrol notlarını");
  expect(db.writes).toHaveLength(0);
});

it("teknik resim planı hatasında hesap kaydı korunur ve uyarı görünür",async()=>{
  drawingPlan.mockRejectedValueOnce(new Error("Kaynak alınamadı"));
  expect(await save("v1")).toMatchObject({ok:true,updatedAt:"v2",drawingPlanWarning:true});
  expect(db.writes).toHaveLength(1);
});

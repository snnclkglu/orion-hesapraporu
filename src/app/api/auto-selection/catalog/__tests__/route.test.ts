import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ user: true, role: "engineer" as string | null, context: "engineering", status: "draft", versions: [1, 1] as (number | null)[], catalogError: false, catalogReads: 0 }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user ? { id: "user" } : null } }) },
  rpc: async (name: string) => { state.catalogReads++; return { data: name === "auto_selection_catalog_manifest" ? [] : { rows: [], total: state.catalogError ? null : 0, page: 0 }, error: null }; },
  from: (table: string) => {
    const builder = {
      select: () => builder, eq: () => builder, order: () => builder,
      maybeSingle: async () => ({ data: table === "profiles" ? state.role ? { role: state.role } : null : table === "revisions" ? { project_id: "project", status: state.status } : { report_context: state.context } }),
      single: async () => { const version = state.versions.shift(); return { data: version == null ? null : { version } }; },
    }; return builder;
  },
}) }));
const { GET } = await import("../route");
const call = (query = "revisionId=revision&page=0&filter=[]") => GET(new NextRequest(`http://localhost/api/auto-selection/catalog?${query}`));
beforeEach(() => { vi.unstubAllEnvs(); Object.assign(state, { user: true, role: "engineer", context: "engineering", status: "draft", versions: [1, 1], catalogError: false, catalogReads: 0 }); });

describe("katalog seçim erişimi ve tutarlılığı", () => {
  it("anonim istek ve hatalı sayfa katalog okumaz", async () => {
    state.user = false; expect((await call()).status).toBe(401);
    expect((await call("revisionId=x&page=-1")).status).toBe(400);
    expect(state.catalogReads).toBe(0);
  });
  it("okuma rolünü yazma yetkisi saymaz, teklif bağlamını ayırır", async () => {
    state.role = "manager"; expect((await call()).status).toBe(403);
    state.role = "engineer"; state.context = "offer"; expect((await call()).status).toBe(403);
    state.context = "engineering"; state.role = null; expect((await call()).status).toBe(403);
    expect(state.catalogReads).toBe(0);
  });
  it("yayımlanmış rapor ve kapalı özellik için seçim başlatmaz", async () => {
    state.status = "issued"; expect((await call()).status).toBe(403);
    vi.stubEnv("AUTO_SELECTION_ENABLED", "false"); expect((await call()).status).toBe(503);
    expect(state.catalogReads).toBe(0);
  });
  it("eksik sayfayı ve değişen katalog sürümünü başarılı yanıt yapmaz", async () => {
    state.catalogError = true; expect((await call()).status).toBe(502);
    state.catalogError = false; state.versions = [10, 11]; expect((await call()).status).toBe(409);
  });
  it("önbellek kontrolü yetkiyi yeniden denetler ve ürünleri tekrar indirmez", async () => {
    const response = await call("revisionId=revision&metadata=1");
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ version: 1 });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(state.catalogReads).toBe(0);
  });
  it("aile özeti de yetki ve sürüm kontrolünden geçer; eksik filtre tüm kataloğu açmaz", async () => {
    expect((await call("revisionId=revision&manifest=1")).status).toBe(200);
    expect(state.catalogReads).toBe(1);
    state.versions = [1, 1];
    expect((await call("revisionId=revision&page=0")).status).toBe(400);
    expect(state.catalogReads).toBe(1);
    state.versions = [1, 2];
    expect((await call("revisionId=revision&manifest=1")).status).toBe(409);
  });
});

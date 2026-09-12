import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CadError, createCadService, sha256 } from "../service";

const actor = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
function setup(rows: Record<string, unknown> = {}) {
  const filters: unknown[][] = [];
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((...args: unknown[]) => { filters.push([table, ...args]); return chain; }),
      is: vi.fn(() => chain),
      single: vi.fn(async () => ({ data: rows[table] ?? null, error: null })),
    };
    return chain;
  });
  const rpc = vi.fn(async () => ({ data: id, error: null }));
  const storage = { from: vi.fn() };
  const admin = { from, rpc, storage } as unknown as SupabaseClient;
  const context = vi.fn(async () => ({ actor, db: admin, canWrite: true }));
  return { service: createCadService(admin, context, "https://test.supabase.co"), from, rpc, storage, filters, context, admin };
}
describe("CAD hizmet sınırları", () => {
  it("geçersiz cihaz anahtarı veritabanına ulaşamaz", async () => {
    const s = setup();
    await expect(s.service.workerCommand("invalid", { action: "claim" })).rejects.toMatchObject({ status: 401 });
    expect(s.from).not.toHaveBeenCalled(); expect(s.rpc).not.toHaveBeenCalled();
  });
  it("eşleştirme kodu ve cihaz anahtarının yalnız hash değerini yollar", async () => {
    const s = setup(); const code = "a".repeat(64); const token = "b".repeat(64);
    expect(await s.service.workerCommand(null, { action: "pair", data: { code, token } })).toEqual({ deviceId: id, protocol: 1, storageOrigin: "https://test.supabase.co" });
    expect(s.rpc).toHaveBeenCalledWith("cad_pair", { p_hash: sha256(code), p_token_hash: sha256(token) });
  });
  it("rolü kaldırılan cihaz iş alamaz", async () => {
    const s = setup({ cad_device_secrets: { device_id: id }, cad_devices: { id, owner_id: actor }, profiles: { role: "viewer" } });
    await expect(s.service.workerCommand("b".repeat(64), { action: "claim" })).rejects.toMatchObject({ status: 403 });
    expect(s.rpc).not.toHaveBeenCalled();
  });
  it("web yazması kimlik/yetki kontrolünden önce veri değiştirmez", async () => {
    const s = setup();
    const service = createCadService(s.admin, async () => { throw new CadError("Yetki yok", 403); }, "https://test.supabase.co");
    await expect(service.webCommand("cancel", { jobId: id })).rejects.toMatchObject({ status: 403 });
    expect(s.from).not.toHaveBeenCalled(); expect(s.rpc).not.toHaveBeenCalled();
  });
  it("dosya indirme sahiplik sorgusu başarısızsa imzalı bağlantı üretmez", async () => {
    const s = setup();
    await expect(s.service.fileUrl(id)).rejects.toMatchObject({ status: 404 });
    expect(s.filters).toContainEqual(["cad_jobs", "owner_id", actor]);
    expect(s.storage.from).not.toHaveBeenCalled();
  });
  it("başka denemenin tamamlanması çıktı kontrolüne bile giremez", async () => {
    const s = setup({ cad_device_secrets: { device_id: id }, cad_devices: { id, owner_id: actor }, profiles: { role: "engineer" }, cad_jobs: { id, device_id: id, attempt_id: actor } });
    await expect(s.service.workerCommand("b".repeat(64), { action: "complete", data: { jobId: id, attemptId: id } })).rejects.toMatchObject({ status: 409 });
    expect(s.rpc).not.toHaveBeenCalled(); expect(s.storage.from).not.toHaveBeenCalled();
  });
});

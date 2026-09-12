import { it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const key = "a".repeat(64);
const item = (n: number) => ({ bucket_id: "account-avatars", name: `path-${n}` });
function worker({ items = [item(0)], busy = false, storageError = false, recheckEmpty = false, finishError = false } = {}) {
  let handler!: (r: Request) => Promise<Response>;
  const remove = vi.fn(async (paths: string[]) => ({ data: paths.map(name => ({ name })), error: storageError ? {} : null }));
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "account_maintenance_begin") return { data: { busy, run_id: "run", items } };
    if (name === "account_maintenance_recheck") return { data: recheckEmpty ? [] : args.p_items };
    return { error: finishError ? {} : null };
  });
  runInNewContext(readFileSync("supabase/functions/account-maintenance/index.js", "utf8").replace(/^import .*;$/gm, ""), {
    Response, TextDecoder, Date, AbortSignal, fetch,
    createClient: () => ({ rpc, storage: { from: () => ({ remove }) } }),
    Deno: { env: { get: () => key }, serve: (fn: typeof handler) => { handler = fn; } },
  });
  return { rpc, remove, send: (body = "{}", token = key, method = "POST") => handler(new Request("https://local.test", { method, headers: { "x-account-maintenance-key": token }, ...(method === "POST" ? { body } : {}) })) };
}
it("yalnız dar bakım anahtarını kabul eder", async () => {
  const w = worker();
  for (const token of ["", "b".repeat(64), "normal-user-jwt"]) expect((await w.send("{}", token)).status).toBe(401);
  expect((await w.send("{}", key, "GET")).status).toBe(405);
  expect(w.rpc).not.toHaveBeenCalled();
});
it("gövdeyi sınırlar ve belirsiz silme talebini reddeder", async () => {
  const w = worker();
  for (const body of ['{"apply":"true"}', '{"bucket":"other"}', "null", "[]", "broken"]) expect((await w.send(body)).status).toBe(400);
  expect((await w.send(" ".repeat(513))).status).toBe(413);
  expect(w.rpc).not.toHaveBeenCalled();
});
it("varsayılan çalışma yalnız sayar ve tamamlanma kaydı yazar", async () => {
  const w = worker();
  const r = await w.send();
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ mode: "dry-run", candidates: 1, removed: 0 });
  expect(w.remove).not.toHaveBeenCalled();
  expect(w.rpc).toHaveBeenLastCalledWith("account_maintenance_finish", expect.objectContaining({ p_removed: 0, p_error: null }));
});
it("başka çalışan varken dosyalara dokunmaz", async () => {
  const w = worker({ busy: true });
  expect((await w.send('{"apply":true}')).status).toBe(409);
  expect(w.remove).not.toHaveBeenCalled();
  expect(w.rpc).toHaveBeenCalledTimes(1);
});
it("500 nesneyi 50'lik gruplarda yeniden kontrol ederek kaldırır", async () => {
  const w = worker({ items: Array.from({ length: 500 }, (_, n) => item(n)) });
  expect((await w.send('{"apply":true}')).status).toBe(200);
  expect(w.remove).toHaveBeenCalledTimes(10);
  expect(w.remove.mock.calls.every(([paths]) => paths.length === 50)).toBe(true);
  expect(w.rpc).toHaveBeenLastCalledWith("account_maintenance_finish", expect.objectContaining({ p_removed: 500 }));
});
it("yeniden kontrolde korunmuş dosyaları atlar", async () => {
  const w = worker({ recheckEmpty: true });
  expect((await w.send('{"apply":true}')).status).toBe(200);
  expect(w.remove).not.toHaveBeenCalled();
});
it("Storage hatasında devam etmez ve hata sayısını kaydeder", async () => {
  const w = worker({ items: Array.from({ length: 60 }, (_, n) => item(n)), storageError: true });
  expect((await w.send('{"apply":true}')).status).toBe(503);
  expect(w.remove).toHaveBeenCalledTimes(1);
  expect(w.rpc).toHaveBeenLastCalledWith("account_maintenance_finish", expect.objectContaining({ p_removed: 0, p_failed: 50, p_error: "storage" }));
});
it("tamamlanma kaydı yazılamadıysa başarı bildirmez", async () => {
  expect((await worker({ finishError: true }).send()).status).toBe(503);
});

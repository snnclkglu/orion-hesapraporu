import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const m = vi.hoisted(() => ({
  role: "admin",
  rpc: vi.fn(),
  admin: vi.fn(),
  tables: {} as Record<string, unknown[]>,
}));
function builder(data: unknown) {
  const b = {
    select: () => b,
    eq: () => b,
    order: () => b,
    limit: () => b,
    gte: () => b,
    lte: () => b,
    lt: () => b,
    single: async () => ({ data: { role: m.role }, error: null }),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  };
  return b;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
      }),
    },
    from: () => builder([]),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    m.admin();
    return {
      from: (table: string) => builder(m.tables[table] ?? []),
      rpc: m.rpc,
    };
  },
}));
import { integrationCommand, integrationSnapshot } from "./server";
const actorId = "00000000-0000-4000-8000-000000000001",
  token = "integration-test-long-token-only-never-real-12345";
beforeEach(() => {
  m.role = "admin";
  m.admin.mockClear();
  m.rpc.mockReset().mockResolvedValue({ data: {}, error: null });
  m.tables = {
    profiles: [{ id: actorId, full_name: "TEST AJANI", role: "admin" }],
  };
  vi.stubEnv(
    "AGENT_API_CLIENTS",
    JSON.stringify([
      {
        id: "grok-test",
        name: "GROK TEST",
        actorId,
        token,
        scopes: ["offers:read"],
      },
    ]),
  );
  vi.stubEnv(
    "AGENT_TASK_SCOPE_GRANTS",
    JSON.stringify([
      {
        tokenSha256: createHash("sha256").update(token).digest("hex"),
        scopes: ["tasks:read"],
      },
    ]),
  );
  vi.stubEnv("EMAIL_AGENT_CLIENTS", "");
});
afterEach(() => vi.unstubAllEnvs());
it("Müdür sunucu verisini veya değişiklik RPC'sini çağıramaz", async () => {
  m.role = "manager";
  await expect(integrationSnapshot()).rejects.toThrow("Yönetici");
  await expect(
    integrationCommand({ action: "import", id: "grok-test" }),
  ).rejects.toThrow("Yönetici");
  expect(m.admin).not.toHaveBeenCalled();
  expect(m.rpc).not.toHaveBeenCalled();
});
it("güvenli özet ham token ve hash içermez, ek görev iznini gösterir", async () => {
  const snapshot = await integrationSnapshot();
  expect(snapshot.agents[0].scopes).toEqual(["offers:read", "tasks:read"]);
  expect(JSON.stringify(snapshot)).not.toContain(token);
  expect(JSON.stringify(snapshot)).not.toContain(
    createHash("sha256").update(token).digest("hex"),
  );
});
it("aktarım aynı kimliği ve kapsamı taşır, istemciden token almaz", async () => {
  await integrationCommand({ action: "import", id: "grok-test" });
  const payload = m.rpc.mock.calls[0][1].p_value;
  expect(payload.id).toBe("grok-test");
  expect(payload.actorId).toBe(actorId);
  expect(payload.scopes).toEqual(["offers:read", "tasks:read"]);
  expect(payload.digest).toBe(createHash("sha256").update(token).digest("hex"));
  expect(payload.token).toBeUndefined();
  await expect(
    integrationCommand({
      action: "import",
      id: "grok-test",
      token: "injected",
    }),
  ).rejects.toThrow();
});
it("veritabanına aktarılan kayıt, eski ortam izinleriyle genişlemez", async () => {
  m.tables.agent_clients = [
    {
      id: "grok-test",
      name: "GROK TEST",
      actor_id: actorId,
      scopes: ["tasks:read"],
      rate_limit: 10,
      status: "paused",
      version: 2,
      created_at: null,
    },
  ];
  const snapshot = await integrationSnapshot();
  expect(snapshot.agents).toHaveLength(1);
  expect(snapshot.agents[0].scopes).toEqual(["tasks:read"]);
  expect(snapshot.agents[0].status).toBe("paused");
});
it("yeni anahtar yalnız dönüşte gösterilir ve RPC'ye özeti gider", async () => {
  const result = await integrationCommand({
    action: "rotate",
    id: "grok-test",
    version: 1,
    overlapHours: 24,
  });
  expect(result.token).toMatch(/^orion_[A-Za-z0-9_-]{43}$/);
  expect(JSON.stringify(m.rpc.mock.calls)).not.toContain(result.token!);
  expect(m.rpc.mock.calls[0][1].p_value.digest).toBe(
    createHash("sha256").update(result.token!).digest("hex"),
  );
});

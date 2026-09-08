import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const actorId = "11111111-1111-4111-8111-111111111111";
const token = "agent-test-token-that-is-longer-than-thirty-two-characters";
const auditInsert = vi.fn();
const profileSingle = vi.fn();
const idempotencyRecords = new Map<string, Record<string, unknown>>();

function idempotencyTable() {
  return {
    insert: vi.fn(async (value: Record<string, unknown>) => {
      const key = `${value.agent_id}:${value.idempotency_key}`;
      if (idempotencyRecords.has(key)) return { error: { code: "23505" } };
      idempotencyRecords.set(key, {
        ...value,
        response_status: null,
        response_body: null,
        completed_at: null,
      });
      return { error: null };
    }),
    select: vi.fn(() => {
      const filters: Record<string, unknown> = {};
      const builder = {
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        maybeSingle: async () => ({
          data: idempotencyRecords.get(`${filters.agent_id}:${filters.idempotency_key}`) ?? null,
          error: null,
        }),
      };
      return builder;
    }),
    update: vi.fn((value: Record<string, unknown>) => {
      const filters: Record<string, unknown> = {};
      const builder = {
        eq: (column: string, filterValue: unknown) => {
          filters[column] = filterValue;
          return builder;
        },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          const key = `${filters.agent_id}:${filters.idempotency_key}`;
          const current = idempotencyRecords.get(key);
          if (current && current.request_hash === filters.request_hash) {
            idempotencyRecords.set(key, { ...current, ...value });
          }
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
      return builder;
    }),
  };
}

const adminClient = {
  from: vi.fn((table: string) => {
    if (table === "profiles") {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: profileSingle,
      };
      return builder;
    }
    if (table === "audit_log") return { insert: auditInsert };
    if (table === "agent_api_idempotency") return idempotencyTable();
    throw new Error(`Beklenmeyen tablo: ${table}`);
  }),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient,
}));

const {
  agentJson,
  authorizeAgent,
  mutationErrorResponse,
  resetAgentRateLimitForTests,
  runAgentRequest,
  secureTokenEquals,
} = await import("../_lib");
const { proxy } = await import("@/proxy");

function request(value = token, ip = "203.0.113.10") {
  return new Request("https://orion.test/api/agent/offers", {
    headers: {
      Authorization: `Bearer ${value}`,
      "x-forwarded-for": ip,
    },
  });
}

describe("agent teklif API güvenlik sınırı", () => {
  beforeEach(() => {
    process.env.AGENT_API_TOKEN = token;
    process.env.AGENT_USER_ID = actorId;
    delete process.env.AGENT_API_CLIENTS;
    delete process.env.AGENT_API_RATE_LIMIT;
    resetAgentRateLimitForTests();
    idempotencyRecords.clear();
    profileSingle.mockReset().mockResolvedValue({
      data: { id: actorId, role: "manager" },
      error: null,
    });
    auditInsert.mockReset().mockResolvedValue({ error: null });
    adminClient.from.mockClear();
  });

  afterEach(() => {
    delete process.env.AGENT_API_TOKEN;
    delete process.env.AGENT_USER_ID;
    delete process.env.AGENT_API_CLIENTS;
    delete process.env.AGENT_API_RATE_LIMIT;
  });

  it("tokenı sabit boyutlu özetle karşılaştırır", () => {
    expect(secureTokenEquals(token, token)).toBe(true);
    expect(secureTokenEquals(`${token}-yanlış`, token)).toBe(false);
  });

  it("eksik veya yanlış tokenı 401 ile reddeder", async () => {
    const missing = await authorizeAgent(
      new Request("https://orion.test/api/agent/offers"),
      "offers:read"
    );
    expect(missing.response?.status).toBe(401);
    expect(await missing.response?.json()).toEqual({ error: "Yetkilendirme başarısız." });

    const wrong = await authorizeAgent(request("wrong-token"), "offers:read");
    expect(wrong.response?.status).toBe(401);
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it("agent profilinin teklif yetkisini ayrıca doğrular", async () => {
    profileSingle.mockResolvedValueOnce({
      data: { id: actorId, role: "engineer" },
      error: null,
    });
    const result = await authorizeAgent(request(), "offers:draft:write");
    expect(result.response?.status).toBe(403);
  });

  it("işleme başlamadan actor=agent ayrıntılı denetim izi yazar", async () => {
    const response = await runAgentRequest(
      request(),
      {
        action: "agent.offer.read",
        scope: "offers:read",
        detail: { offer_id: "offer-1" },
      },
      async () => agentJson({ ok: true })
    );
    expect(response.status).toBe(200);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: actorId,
        action: "agent.offer.read",
        detail: expect.objectContaining({
          actor: "agent",
          agent_id: "offers-v1",
          scope: "offers:read",
          offer_id: "offer-1",
        }),
      })
    );
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("her agentı ayrı scope listesiyle sınırlar", async () => {
    process.env.AGENT_API_CLIENTS = JSON.stringify([
      {
        id: "grok-offers",
        name: "Grok Teklifçi",
        token,
        actorId,
        scopes: ["offers:read"],
      },
    ]);

    const readable = await authorizeAgent(request(), "offers:read");
    expect(readable.context?.principal.id).toBe("grok-offers");

    const forbidden = await authorizeAgent(request(token, "203.0.113.12"), "offers:draft:write");
    expect(forbidden.response?.status).toBe(403);
    expect(await forbidden.response?.json()).toEqual({ error: "Agent bu işlem için yetkili değil." });
  });

  it("aynı Idempotency-Key ile yinelenen POST yanıtını tekrar oynatır", async () => {
    const makeRequest = () =>
      new Request("https://orion.test/api/agent/offers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "offer-command-123",
        },
        body: JSON.stringify({ customerId: actorId }),
      });
    const handler = vi.fn(async () => agentJson({ offerId: "offer-1" }, { status: 201 }));
    const definition = { action: "agent.offer.create", scope: "offers:draft:write" } as const;

    const first = await runAgentRequest(makeRequest(), definition, handler);
    const replay = await runAgentRequest(makeRequest(), definition, handler);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
    expect(await replay.json()).toEqual({ offerId: "offer-1" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(auditInsert).toHaveBeenCalledTimes(2);
  });

  it("basit dakika sınırını aşınca 429 döndürür", async () => {
    process.env.AGENT_API_RATE_LIMIT = "1";
    expect(
      (await authorizeAgent(request(token, "203.0.113.11"), "offers:read")).context
    ).toBeDefined();
    const limited = await authorizeAgent(request(token, "203.0.113.11"), "offers:read");
    expect(limited.response?.status).toBe(429);
    expect(limited.response?.headers.get("Retry-After")).toBeTruthy();
  });

  it("yayımlanmış revizyon hatasını 409 sözleşmesine çevirir", async () => {
    const response = mutationErrorResponse({
      kind: "conflict",
      message: "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun.",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun.",
    });
  });

  it("proxy agent uçlarını oturum sayfasına yönlendirmez", async () => {
    const response = await proxy(new NextRequest("https://orion.test/api/agent/offers"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";

const actorId = "11111111-1111-4111-8111-111111111111";
const token = "agent-test-token-that-is-longer-than-thirty-two-characters";
const auditInsert = vi.fn();
const profileSingle = vi.fn();
const resolveRegistry = vi.fn();
const recordRequest = vi.fn();
beforeEach(() => {
  resolveRegistry
    .mockReset()
    .mockReturnValue({
      data: { managed: false, principal: null },
      error: null,
    });
  recordRequest.mockReset();
});
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
          data:
            idempotencyRecords.get(
              `${filters.agent_id}:${filters.idempotency_key}`,
            ) ?? null,
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
        then: (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) => {
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
  rpc: vi.fn((name: string, args: Record<string, unknown>) => {
    if (name === "agent_resolve") return resolveRegistry(args);
    if (name === "agent_record_request") recordRequest(args.p_event);
    return { abortSignal: async () => ({ error: null }) };
  }),
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
    delete process.env.AGENT_TASK_SCOPE_GRANTS;
    delete process.env.EMAIL_AGENT_CLIENTS;
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
    delete process.env.AGENT_TASK_SCOPE_GRANTS;
    delete process.env.EMAIL_AGENT_CLIENTS;
    delete process.env.AGENT_API_TOKEN;
    delete process.env.AGENT_USER_ID;
    delete process.env.AGENT_API_CLIENTS;
    delete process.env.AGENT_API_RATE_LIMIT;
  });

  it("tokenı sabit boyutlu özetle karşılaştırır", () => {
    expect(secureTokenEquals(token, token)).toBe(true);
    expect(secureTokenEquals(`${token}-yanlış`, token)).toBe(false);
  });

  it("özetle verilen görev izni yalnız mevcut eşleşen ajanı genişletir, kimliğini korur", async () => {
    process.env.AGENT_API_CLIENTS = JSON.stringify([
      {
        id: "grok-offers",
        name: "Grok",
        token,
        actorId,
        scopes: ["offers:read"],
      },
      {
        id: "other-agent",
        name: "Diğer",
        token: token + "-other",
        actorId,
        scopes: ["offers:read"],
      },
    ]);
    process.env.AGENT_TASK_SCOPE_GRANTS = JSON.stringify([
      {
        tokenSha256: createHash("sha256").update(token).digest("hex"),
        scopes: [
          "tasks:context:read",
          "tasks:read",
          "tasks:write",
          "tasks:comment",
        ],
      },
    ]);
    for (const scope of [
      "tasks:context:read",
      "tasks:read",
      "tasks:write",
      "tasks:comment",
    ] as const) {
      const result = await authorizeAgent(request(), scope);
      expect(result.context?.principal).toMatchObject({
        id: "grok-offers",
        actorId,
      });
      expect(
        (await authorizeAgent(request(token + "-other"), scope)).response
          ?.status,
      ).toBe(403);
    }
    expect(
      (await authorizeAgent(request(), "offers:read")).context,
    ).toBeDefined();
    expect(
      (await authorizeAgent(request(), "offers:draft:write")).response?.status,
    ).toBe(403);
    expect(
      (await authorizeAgent(request(), "email:read")).response?.status,
    ).toBe(403);
    expect(
      (await authorizeAgent(request("unknown-token"), "tasks:read")).response
        ?.status,
    ).toBe(401);
    profileSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(
      (await authorizeAgent(request(), "tasks:read")).response?.status,
    ).toBe(403);
  });

  it("görev özeti eski teklif kurulumu ile de çalışır", async () => {
    process.env.AGENT_TASK_SCOPE_GRANTS = JSON.stringify([
      {
        tokenSha256: createHash("sha256").update(token).digest("hex"),
        scopes: ["tasks:read"],
      },
    ]);
    expect(
      (await authorizeAgent(request(), "tasks:read")).context?.principal.id,
    ).toBe("offers-v1");
    expect(
      (await authorizeAgent(request(), "offers:draft:write")).context,
    ).toBeDefined();
    delete process.env.AGENT_API_TOKEN;
    delete process.env.AGENT_USER_ID;
    expect(
      (await authorizeAgent(request(), "tasks:read")).response?.status,
    ).toBe(503);
  });

  it.each([
    "invalid-json",
    JSON.stringify([{ tokenSha256: "invalid", scopes: ["tasks:read"] }]),
    JSON.stringify([
      { tokenSha256: "a".repeat(64), scopes: ["offers:draft:write"] },
    ]),
    JSON.stringify([
      { tokenSha256: "a".repeat(64), scopes: ["tasks:read"], actorId },
    ]),
    JSON.stringify([
      { tokenSha256: "a".repeat(64), scopes: ["tasks:read", "tasks:read"] },
    ]),
    JSON.stringify(
      Array(2).fill({ tokenSha256: "a".repeat(64), scopes: ["tasks:read"] }),
    ),
  ])("geçersiz ek görev ayarı güvenli biçimde kapanır: %s", async (value) => {
    process.env.AGENT_TASK_SCOPE_GRANTS = value;
    expect(
      (await authorizeAgent(request(), "tasks:read")).response?.status,
    ).toBe(503);
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it("E-posta ajanı eklenmesi eski teklif anahtarını kapatmaz ve teklif anahtarına e-posta yetkisi vermez", async () => {
    process.env.EMAIL_AGENT_CLIENTS = JSON.stringify([
      {
        id: "email-agent",
        name: "E-posta Agentı",
        token: token + "-email",
        actorId,
        scopes: ["email:read"],
      },
    ]);
    expect(
      (await authorizeAgent(request(), "offers:read")).context,
    ).toBeDefined();
    expect(
      (await authorizeAgent(request(), "email:read")).response?.status,
    ).toBe(403);
    expect(
      (await authorizeAgent(request(token + "-email"), "email:read")).response
        ?.status,
    ).toBe(403);
    profileSingle.mockResolvedValue({
      data: { id: actorId, role: "admin" },
      error: null,
    });
    expect(
      (await authorizeAgent(request(token + "-email"), "email:read")).context,
    ).toBeDefined();
    expect(
      (await authorizeAgent(request(token + "-email"), "email:send")).response
        ?.status,
    ).toBe(403);
  });

  it("eksik veya yanlış tokenı 401 ile reddeder", async () => {
    const missing = await authorizeAgent(
      new Request("https://orion.test/api/agent/offers"),
      "offers:read",
    );
    expect(missing.response?.status).toBe(401);
    expect(await missing.response?.json()).toEqual({
      error: "Yetkilendirme başarısız.",
    });

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
      async () => agentJson({ ok: true }),
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
      }),
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

    const forbidden = await authorizeAgent(
      request(token, "203.0.113.12"),
      "offers:draft:write",
    );
    expect(forbidden.response?.status).toBe(403);
    expect(await forbidden.response?.json()).toEqual({
      error: "Agent bu işlem için yetkili değil.",
    });
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
    const handler = vi.fn(async () =>
      agentJson({ offerId: "offer-1" }, { status: 201 }),
    );
    const definition = {
      action: "agent.offer.create",
      scope: "offers:draft:write",
    } as const;

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
      (await authorizeAgent(request(token, "203.0.113.11"), "offers:read"))
        .context,
    ).toBeDefined();
    const limited = await authorizeAgent(
      request(token, "203.0.113.11"),
      "offers:read",
    );
    expect(limited.response?.status).toBe(429);
    expect(limited.response?.headers.get("Retry-After")).toBeTruthy();
  });

  it("yayımlanmış revizyon hatasını 409 sözleşmesine çevirir", async () => {
    const response = mutationErrorResponse({
      kind: "conflict",
      message:
        "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun.",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error:
        "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun.",
    });
  });

  it("proxy agent uçlarını oturum sayfasına yönlendirmez", async () => {
    const response = await proxy(
      new NextRequest("https://orion.test/api/agent/offers"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("Veritabanı ajan kaydı ve sonuç ölçümü", () => {
  const principal = {
    id: "offers-v1",
    name: "API TEST",
    actorId,
    scopes: ["tasks:read"],
    rateLimitPerMinute: 60,
  };
  beforeEach(() => {
    process.env.AGENT_API_TOKEN = token;
    process.env.AGENT_USER_ID = actorId;
    delete process.env.AGENT_API_CLIENTS;
    delete process.env.AGENT_TASK_SCOPE_GRANTS;
    delete process.env.EMAIL_AGENT_CLIENTS;
    resetAgentRateLimitForTests();
    profileSingle
      .mockReset()
      .mockResolvedValue({
        data: { id: actorId, role: "manager" },
        error: null,
      });
    auditInsert.mockReset().mockResolvedValue({ error: null });
  });
  it("veritabanında azaltılan izin eski teklif yetkisiyle genişlemez", async () => {
    resolveRegistry.mockReturnValue({
      data: { managed: true, principal },
      error: null,
    });
    expect(
      (await authorizeAgent(request(), "offers:read")).response?.status,
    ).toBe(403);
    expect(
      (await authorizeAgent(request(), "tasks:read")).context?.principal.scopes,
    ).toEqual(["tasks:read"]);
    expect(resolveRegistry.mock.calls[0][0].p_digest).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
  });
  it("iptal, sona erme veya duraklatma ortam anahtarını canlandırmaz", async () => {
    resolveRegistry.mockReturnValue({
      data: { managed: true, principal: null },
      error: null,
    });
    expect(
      (await authorizeAgent(request(), "offers:read")).response?.status,
    ).toBe(401);
  });
  it("kayıt sunucusu kesintisinde eski ortama geri düşmez", async () => {
    resolveRegistry.mockReturnValue({ data: null, error: { code: "503" } });
    expect(
      (await authorizeAgent(request(), "offers:read")).response?.status,
    ).toBe(503);
  });
  it("ortam tanımı olmadan yeni veritabanı ajanı bağlanabilir", async () => {
    delete process.env.AGENT_API_TOKEN;
    delete process.env.AGENT_USER_ID;
    resolveRegistry.mockReturnValue({
      data: { managed: true, principal },
      error: null,
    });
    const result = await authorizeAgent(request(), null);
    expect(result.context?.principal.id).toBe(principal.id);
    expect(JSON.stringify(result.context?.principal)).not.toContain(token);
  });
  it("403 nedeni ve istek kimliği var; sorgu, kimlik ve token ölçüme sızmaz", async () => {
    resolveRegistry.mockReturnValue({
      data: { managed: true, principal },
      error: null,
    });
    const r = new Request(
      "https://orion.test/api/agent/tasks/private-person-name?secret=personal",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const result = await runAgentRequest(
      r,
      { action: "test", scope: "tasks:write" },
      async () => agentJson({ ok: true }),
    );
    expect(result.status).toBe(403);
    expect(result.headers.get("X-Request-Id")).toBeTruthy();
    const event = recordRequest.mock.calls[0][0];
    expect(event.reason_code).toBe("scope_denied");
    expect(event.request_id).toBe(result.headers.get("X-Request-Id"));
    expect(event.route).toBe("/api/agent/tasks/:id");
    expect(JSON.stringify(event)).not.toContain("personal");
    expect(JSON.stringify(event)).not.toContain(token);
  });
  it("profil rolü reddi ayrı neden olarak ölçülür", async () => {
    resolveRegistry.mockReturnValue({
      data: {
        managed: true,
        principal: { ...principal, scopes: ["email:read"] },
      },
      error: null,
    });
    const result = await runAgentRequest(
      request(),
      { action: "test", scope: "email:read" },
      async () => agentJson({ ok: true }),
    );
    expect(result.status).toBe(403);
    expect(recordRequest.mock.calls[0][0].reason_code).toBe("profile_denied");
  });
  it("erken doğrulama hatası kimlik doğrulanmış sayılmaz", async () => {
    const { observeAgentRequest, agentError } = await import("../_lib");
    const result = await observeAgentRequest(request(), async () =>
      agentError("Geçersiz JSON", 422),
    );
    expect(result.headers.get("X-Request-Id")).toBeTruthy();
    expect(recordRequest.mock.calls[0][0]).toMatchObject({
      agent_id: null,
      status: 422,
      reason_code: "validation",
    });
  });
  it("zorunlu audit hatası işlemden önce durdurulur", async () => {
    auditInsert.mockResolvedValue({ error: { code: "503" } });
    const handler = vi.fn();
    const result = await runAgentRequest(
      request(),
      { action: "test", scope: "offers:read" },
      handler,
    );
    expect(result.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
    expect(recordRequest.mock.calls[0][0].status).toBe(503);
  });
});

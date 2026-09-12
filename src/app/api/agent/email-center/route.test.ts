import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  execute: vi.fn(),
  definitions: [] as Record<string, unknown>[],
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/email-center/worker", () => ({ processEmailCenter: vi.fn() }));
vi.mock("@/lib/email-center/service", async (original) => ({
  ...(await original<typeof import("@/lib/email-center/service")>()),
  executeEmailCommand: mocks.execute,
}));
vi.mock("../_lib", () => ({
  observeAgentRequest: async (
    _request: Request,
    handler: () => Promise<Response>,
  ) => handler(),
  agentOptions: () => new Response(),
  agentJson: (body: unknown) => Response.json(body),
  agentError: (error: string, status: number) =>
    Response.json({ error }, { status }),
  readAgentJson: async (request: Request) => ({ data: await request.json() }),
  runAgentRequest: async (
    request: Request,
    definition: Record<string, unknown>,
    handler: (context: unknown) => Promise<Response>,
  ) => {
    mocks.definitions.push(definition);
    // Gerçek geçit yazma isteğinin ham gövdesini tekrar anahtarı için okur.
    await request.clone().arrayBuffer();
    return handler({
      actorId: "193c652b-177e-4aa8-9c6a-5d07baf3925d",
      principal: { id: "test-agent" },
      supabase: {},
    });
  },
}));
import { POST } from "./route";
const versionId = "7ad0e485-b0c6-4d29-9653-6b9c45bd7e51";
function request(body: unknown, key?: string) {
  return new Request("https://app.orioncranes.com/api/agent/email-center", {
    method: "POST",
    headers: key ? { "Idempotency-Key": key } : {},
    body: JSON.stringify(body),
  });
}
describe("E-posta ajanı komut geçidi", () => {
  beforeEach(() => {
    mocks.after.mockReset();
    mocks.execute.mockReset().mockResolvedValue({ ok: true });
    mocks.definitions.length = 0;
  });
  it("Yazma gövdesini tekrar güvenliği için tüketmeden bırakır", async () => {
    const response = await POST(
      request(
        { action: "test.send", data: { versionId, requestId: versionId } },
        "test-request-1",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.definitions[0].scope).toBe("email:test:send");
  });
  it("Önizleme kuyruk işleyicisini çağırmaz", async () => {
    expect(
      (await POST(request({ action: "preview", data: { versionId } }))).status,
    ).toBe(200);
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.definitions[0].scope).toBe("email:read");
  });
  it("Anahtarsız yazmayı reddeder", async () => {
    expect(
      (
        await POST(
          request({
            action: "template.publish",
            data: { templateId: versionId, versionId },
          }),
        )
      ).status,
    ).toBe(422);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

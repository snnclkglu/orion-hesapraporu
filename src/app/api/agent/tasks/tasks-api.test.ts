import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  rpc: vi.fn(),
  command: vi.fn(),
  snapshot: vi.fn(),
  detail: vi.fn(),
  tags: vi.fn(),
}));
vi.mock("../_lib", () => ({
  agentJson: (d: unknown, i?: ResponseInit) => Response.json(d, i),
  agentError: (e: string, status: number, h?: HeadersInit) =>
    Response.json({ error: e }, { status, headers: h }),
  agentOptions: () => new Response(null, { status: 204 }),
  readAgentJson: async (r: Request) => ({ data: await r.json() }),
  runAgentRequest: mocks.run,
}));
vi.mock("@/lib/tasks/service", () => ({
  taskCommand: mocks.command,
  taskSnapshot: mocks.snapshot,
  taskDetail: mocks.detail,
  taskTagCatalog: mocks.tags,
  TaskError: class extends Error {
    constructor(
      message: string,
      public status = 422,
    ) {
      super(message);
    }
  },
}));
import { GET, POST, PATCH } from "./[[...segments]]/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: true });
  mocks.run.mockImplementation(async (_r, _d, h) =>
    h({
      supabase: { rpc: mocks.rpc },
      actorId: "actor",
      principal: { id: "grok-tasks", rateLimitPerMinute: 60 },
    }),
  );
  mocks.command.mockResolvedValue({ task: { id: "new" } });
  mocks.snapshot.mockResolvedValue({
    tasks: [],
    total: 0,
    boards: [],
    people: [],
    jobs: [],
    teams: [],
  });
});
const ctx = (...segments: string[]) => ({
  params: Promise.resolve({ segments }),
});
it("akış güncellemesi yazma yetkisi, aktör ve tekrar anahtarıyla iletilir", async () => {
  const id = crypto.randomUUID();
  const r = await PATCH(
    new Request("https://example.test/api/agent/tasks/" + id + "/workflow", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "workflow-0001",
      },
      body: JSON.stringify({
        version: 3,
        recurrence: { mode: "weekly", interval: 1 },
      }),
    }),
    ctx(id, "workflow"),
  );
  expect(r.status).toBe(200);
  expect(mocks.run).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ scope: "tasks:write" }),
    expect.anything(),
  );
  expect(mocks.command).toHaveBeenCalledWith(
    expect.anything(),
    "actor",
    "workflow",
    expect.objectContaining({ id, version: 3 }),
    "grok-tasks",
    "workflow-0001",
  );
});
const req = (method: string, body: unknown, key = "request-0001") =>
  new Request("https://example.test/api/agent/tasks", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
it.each(["cancel", "reactivate"])("%s ayrı iptal izniyle çalışır", async (operation) => {
  const id = crypto.randomUUID();
  const response = await POST(req("POST", { version: 3, ...(operation === "cancel" ? { reason: "Yanlışlıkla açıldı" } : {}) }), ctx(id, operation));
  expect(response.status).toBe(200);
  expect(mocks.run).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({scope:"tasks:cancel"}), expect.anything());
  expect(mocks.command).toHaveBeenCalledWith(expect.anything(), "actor", operation, expect.objectContaining({id,version:3}), "grok-tasks", "request-0001");
});
it("anahtar yoksa yazma servisine gitmez", async () => {
  expect((await POST(req("POST", { title: "Görev" }, ""), ctx())).status).toBe(
    422,
  );
  expect(mocks.command).not.toHaveBeenCalled();
});
it("liste varsayılanı özel ve ekip kapsamındaki erişilebilir kayıtları içerir", async () => {
  await GET(
    new Request("https://example.test/api/agent/tasks?sourceRef=mail-1"),
    ctx(),
  );
  expect(mocks.snapshot).toHaveBeenCalledWith(expect.anything(), "actor", {
    view: "boards",
    sourceRef: "mail-1",
  });
});
it("görev oluşturma yalnız tasks:write ister", async () => {
  expect((await POST(req("POST", { title: "Görev" }), ctx())).status).toBe(201);
  expect(mocks.run.mock.calls[0][1].scope).toBe("tasks:write");
  expect(mocks.command).toHaveBeenCalledWith(
    expect.anything(),
    "actor",
    "create",
    { title: "Görev" },
    "grok-tasks",
    "request-0001",
  );
});
it("güncelleme URL kimliğini kullanır", async () => {
  await PATCH(
    req("PATCH", { id: "other", version: 1, title: "Yeni" }),
    ctx("correct"),
  );
  expect(mocks.command.mock.calls[0][3].id).toBe("correct");
});
it("yorum bağımsız scope ile açılır", async () => {
  await POST(req("POST", { body: "Yorum" }), ctx("task", "comments"));
  expect(mocks.run.mock.calls[0][1].scope).toBe("tasks:comment");
});
it("ortak hız sınırı geçilemiyorsa yazma olmaz", async () => {
  mocks.rpc.mockResolvedValue({ data: false });
  expect((await POST(req("POST", { title: "İş" }), ctx())).status).toBe(429);
  expect(mocks.command).not.toHaveBeenCalled();
});
it("hız sınırı erişilemiyorsa güvenli biçimde durur", async () => {
  mocks.rpc.mockResolvedValue({ error: { message: "offline" } });
  expect(
    (await GET(new Request("https://example.test/api/agent/tasks"), ctx()))
      .status,
  ).toBe(503);
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
it("tekrar yanıtında replay başlığı vardır", async () => {
  mocks.command.mockResolvedValue({ task: { id: "same" }, replayed: true });
  const r = await POST(req("POST", { title: "İş" }), ctx());
  expect(r.headers.get("Idempotency-Replayed")).toBe("true");
});
it("bağlam uçları başka modülün verilerini döndürmez", async () => {
  const r = await GET(
    new Request("https://example.test/api/agent/tasks/context"),
    ctx("context"),
  );
  expect(Object.keys(await r.json()).sort()).toEqual([
    "boards",
    "jobs",
    "people",
    "teams",
  ]);
  expect(mocks.run.mock.calls[0][1].scope).toBe("tasks:context:read");
});
it("etiket kataloğu görev kimliği gibi yorumlanmaz",async()=>{
 mocks.tags.mockResolvedValue({tags:[],total:0,nextCursor:null});
 const r=await GET(new Request("https://example.test/api/agent/tasks/tags?q=Teklif"),ctx("tags"));
 expect(r.status).toBe(200);expect(mocks.tags).toHaveBeenCalledWith(expect.anything(),"actor",{q:"Teklif"});expect(mocks.detail).not.toHaveBeenCalled();
 expect(mocks.run.mock.calls[0][1].scope).toBe("tasks:read");
});
it("etiket oluşturma ayrı katalog izni ve tekrar anahtarı kullanır",async()=>{
 const r=await POST(req("POST",{name:"TEKLİF",scope:"global",color_hue:300}),ctx("tags"));
 expect(r.status).toBe(201);expect(mocks.run.mock.calls[0][1].scope).toBe("tasks:tags:manage");
 expect(mocks.command.mock.calls[0][2]).toBe("tag.create");expect(mocks.command.mock.calls[0][3]).not.toHaveProperty("id");
});
it("katalog güncellemesi yol kimliğini kullanır",async()=>{
 const id=crypto.randomUUID();await PATCH(req("PATCH",{version:1,archived:true}),ctx("tags",id));
 expect(mocks.command.mock.calls[0][2]).toBe("tag.update");expect(mocks.command.mock.calls[0][3]).toEqual({id,version:1,archived:true});
});
it("göreve etiket eklemek katalog yönetim izni istemez",async()=>{
 await PATCH(req("PATCH",{version:2,add_tag_ids:[crypto.randomUUID()]}),ctx(crypto.randomUUID()));
 expect(mocks.run.mock.calls[0][1].scope).toBe("tasks:write");
});

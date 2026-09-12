import { beforeEach, expect, it, vi } from "vitest";
const snapshot = vi.hoisted(() => vi.fn());
vi.mock("@/lib/integrations/server", () => ({ integrationSnapshot: snapshot }));
import { GET } from "./route";
beforeEach(() => { snapshot.mockReset(); });
it("bağlantı paketi giriş kontrolünden geçmeden indirilemez", async () => {
  snapshot.mockRejectedValue(new Error("Yetkisiz"));
  const response = await GET(new Request("https://example.invalid/admin/integrations/download"));
  expect(response.status).toBe(403);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("paket gerçek alan şemalarını ve ortam adresini içerir", async () => {
  snapshot.mockResolvedValue({ checkedAt:"2026-09-12T12:00:00Z",environment:"Önizleme",baseUrl:"https://example.invalid/api/agent",agents:[{id:"grok",scopes:["tasks:read"]}] });
  const response = await GET(new Request("https://example.invalid/admin/integrations/download?agent=grok"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toContain("attachment");
  const body = await response.json();
  expect(body.taskOpenApi.servers[0].url).toBe("https://example.invalid/api/agent");
  expect(body.schemas.newOffer.required).toEqual(expect.arrayContaining(["customerId","subject"]));
  expect(body.schemas.emailCommand).toBeDefined();
  expect(body.docs.map((d:{name:string})=>d.name)).toContain("email-center-agent.md");
  expect(body.guide).toContain("İzinler: tasks:read");
});

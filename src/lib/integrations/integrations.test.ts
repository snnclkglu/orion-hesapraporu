import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGENT_SCOPES, agentEditSchema, profileCanUseScope } from "./model";
import { ENDPOINTS, connectionGuide } from "./catalog";
const migration = readFileSync(
  "supabase/migrations/20260912210000_task_cancellation.sql",
  "utf8",
);
describe("API yönetim sözleşmesi", () => {
  it("SQL scope sözlüğü uygulamanın kapalı sözlüğüyle eşleşir", () => {
    const scopes = migration
      .match(/scopes <@ array\[([^\]]+)\]/)![1]
      .match(/'([^']+)'/g)!
      .map((s) => s.slice(1, -1));
    expect(scopes.sort()).toEqual([...AGENT_SCOPES].sort());
  });
  it("scope seçimi profil rolünü yükseltmez", () => {
    expect(profileCanUseScope("engineer", "email:send")).toBe(false);
    expect(profileCanUseScope("manager", "email:read")).toBe(false);
    expect(profileCanUseScope("manager", "offers:read")).toBe(true);
    expect(profileCanUseScope(null, "tasks:write")).toBe(false);
  });
  it("bilinmeyen izin ve istemciden gelen gizli değerleri reddeder", () => {
    const value = {
      id: "test-agent",
      name: "test ajan",
      actorId: "00000000-0000-4000-8000-000000000001",
      scopes: ["tasks:read"],
      rateLimitPerMinute: 60,
      version: 1,
      status: "active",
    };
    expect(agentEditSchema.parse(value).name).toBe("TEST AJAN");
    expect(
      agentEditSchema.safeParse({ ...value, token: "secret" }).success,
    ).toBe(false);
    expect(
      agentEditSchema.safeParse({
        ...value,
        scopes: ["tasks:read", "tasks:read"],
      }).success,
    ).toBe(false);
    expect(
      agentEditSchema.safeParse({ ...value, scopes: ["admin:all"] }).success,
    ).toBe(false);
  });
  it("katalog dahili uçları dış API olarak göstermez", () => {
    expect(
      ENDPOINTS.some(
        (e) =>
          e.path.includes("worker") ||
          e.path.includes("cron") ||
          e.path.includes("account"),
      ),
    ).toBe(false);
    expect(ENDPOINTS.find((e) => e.path === "/tasks/context")?.scope).toBe(
      "tasks:context:read",
    );
    expect(
      ENDPOINTS.find(
        (e) => e.path === "/tasks/{id}/comments" && e.method === "POST",
      )?.scope,
    ).toBe("tasks:comment");
    for (const e of ENDPOINTS)
      if (e.scope) expect(AGENT_SCOPES).toContain(e.scope);
  });
  it("teklif kataloğunun yöntem ve izinleri gerçek route ile eşleşir", () => {
    for (const e of ENDPOINTS.filter((e) => e.module === "Teklif")) {
      const route = readFileSync(
        "src/app/api/agent" +
          e.path.replace(/\{([^}]+)\}/g, "[$1]") +
          "/route.ts",
        "utf8",
      );
      expect(route).toContain(`function ${e.method}(`);
      expect(route).toContain(`scope: "${e.scope}"`);
    }
  });
  it("Grokbot yönergesi gizli token yerine ortam değişkeni kullanır", () => {
    const guide = connectionGuide("https://example.invalid/api/agent", [
      "tasks:read",
    ]);
    expect(guide).toContain("$ORION_API_TOKEN");
    expect(guide).toContain("$env:ORION_API_TOKEN");
    expect(guide).toContain("Idempotency-Key");
  });
});

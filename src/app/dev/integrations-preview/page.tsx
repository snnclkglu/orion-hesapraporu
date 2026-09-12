import { notFound } from "next/navigation";
import { IntegrationsView } from "@/components/integrations/integrations-view";
import type { IntegrationSnapshot } from "@/lib/integrations/model";
const initial: IntegrationSnapshot = {
  agents: [
    {
      id: "grok-orion",
      name: "ORION GÖREV AJANI",
      actorId: "00000000-0000-4000-8000-000000000001",
      profileName: "OTOMASYON PROFİLİ",
      role: "engineer",
      scopes: [
        "tasks:context:read",
        "tasks:read",
        "tasks:write",
        "tasks:comment",
      ],
      rateLimitPerMinute: 60,
      status: "active",
      version: 1,
      source: "database",
      createdAt: null,
      credentials: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          label: "Örnek anahtar",
          createdAt: "2026-09-12T09:00:00Z",
          expiresAt: null,
          revokedAt: null,
        },
      ],
    },
    {
      id: "offers-v1",
      name: "TEKLİF AJANI",
      actorId: "00000000-0000-4000-8000-000000000003",
      profileName: "TEKLİF OTOMASYONU",
      role: "manager",
      scopes: ["offers:read", "offers:draft:write"],
      rateLimitPerMinute: 60,
      status: "active",
      version: 0,
      source: "environment",
      createdAt: null,
      credentials: [],
    },
  ],
  profiles: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      full_name: "OTOMASYON PROFİLİ",
      role: "engineer",
    },
  ],
  events: [
    {
      id: 1,
      request_id: "00000000-0000-4000-8000-000000000004",
      agent_id: "grok-orion",
      method: "GET",
      route: "/api/agent/tasks/context",
      scope: "tasks:context:read",
      status: 403,
      duration_ms: 86,
      replayed: false,
      created_at: "2026-09-12T09:00:00Z",
    },
  ],
  changes: [],
  nextCursor: null,
  environmentValid: true,
  databaseReady: true,
  checkedAt: "2026-09-12T09:00:00Z",
  environment: "Önizleme · Örnek bilgiler",
  baseUrl: "https://example.invalid/api/agent",
};
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="p-4">
      <p className="mb-4 text-sm text-muted-foreground">
        Etkileşimli önizleme · Örnek bilgiler; işlem ve bağlantı yapılmaz.
      </p>
      <IntegrationsView initial={initial} preview />
    </main>
  );
}

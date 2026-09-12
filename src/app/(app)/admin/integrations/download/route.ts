import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { integrationSnapshot } from "@/lib/integrations/server";
import { ENDPOINTS, connectionGuide } from "@/lib/integrations/catalog";
import {
  newOfferSchema,
  saveRevisionSchema,
  addOfferTemplateItemSchema,
} from "@/app/(app)/offers/schema";
import { commandSchema } from "@/lib/email-center/service";
import taskOpenApi from "../../../../../../docs/task-api.openapi.json";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const snapshot = await integrationSnapshot();
    const id = new URL(request.url).searchParams.get("agent");
    const agent = snapshot.agents.find((a) => a.id === id);
    const docs = await Promise.all(
      ["agent-api.md", "task-workspace.md", "email-center-agent.md"].map(
        async (name) => ({
          name,
          content: await readFile(join(process.cwd(), "docs", name), "utf8"),
        }),
      ),
    );
    const schemas = Object.fromEntries(
      Object.entries({
        newOffer: newOfferSchema,
        saveRevision: saveRevisionSchema,
        addTemplateItem: addOfferTemplateItemSchema,
        emailCommand: commandSchema,
      }).map(([key, schema]) => [
        key,
        z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }),
      ]),
    );
    return Response.json(
      {
        apiVersion: "1",
        generatedAt: snapshot.checkedAt,
        environment: snapshot.environment,
        guide: connectionGuide(snapshot.baseUrl, agent?.scopes ?? []),
        endpoints: ENDPOINTS,
        schemas,
        taskOpenApi: { ...taskOpenApi, servers: [{ url: snapshot.baseUrl }] },
        docs,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition":
            'attachment; filename="orion-api-baglanti.json"',
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return Response.json(
      {
        error:
          "Bağlantı paketi okunamadı. Yönetici oturumuyla yeniden deneyin.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}

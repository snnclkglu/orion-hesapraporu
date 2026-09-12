import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/roles";
import { checkDb } from "@/lib/account/server";
import { configuredAgents } from "./config";
import {
  agentEditSchema,
  type IntegrationSnapshot,
  type ManagedAgent,
  type RequestEvent,
  type ConfigEvent,
} from "./model";
import { z } from "zod";

export async function integrationContext() {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) throw new Error("Oturumunuz sona erdi. Yeniden giriş yapın.");
  const { data, error } = await session
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (error || !isAdminRole(data?.role))
    throw new Error("Bu bölüm yalnız Yöneticiye açıktır.");
  return { actor: user.id, db: createAdminClient() };
}
export const eventFilterSchema = z
  .object({
    agent: z.string().max(64).optional(),
    status: z.enum(["all", "error", "success"]).default("all"),
    cursor: z.coerce.number().int().positive().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .strict();
export type EventFilters = z.input<typeof eventFilterSchema>;
export async function integrationSnapshot(
  filters: EventFilters = {},
): Promise<IntegrationSnapshot> {
  const f = eventFilterSchema.parse(filters);
  const { db } = await integrationContext();
  const env = configuredAgents();
  let query = db
    .from("agent_request_events")
    .select(
      "id,request_id,agent_id,method,route,scope,status,duration_ms,replayed,reason_code,created_at",
    )
    .order("id", { ascending: false })
    .limit(31);
  if (f.agent) query = query.eq("agent_id", f.agent);
  if (f.status === "error") query = query.gte("status", 400);
  if (f.status === "success") query = query.lt("status", 400);
  if (f.cursor) query = query.lt("id", f.cursor);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00+03:00`);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59.999+03:00`);
  const [clients, keys, profiles, events, changes, daily] = await Promise.all([
    db
      .from("agent_clients")
      .select("id,name,actor_id,scopes,rate_limit,status,version,created_at")
      .order("name"),
    db
      .from("agent_credentials")
      .select("id,agent_id,label,created_at,expires_at,revoked_at")
      .order("created_at", { ascending: false }),
    db.from("profiles").select("id,full_name,role").order("full_name"),
    query,
    db
      .from("agent_config_events")
      .select("id,agent_id,actor,action,detail,created_at")
      .order("id", { ascending: false })
      .limit(30),
    db
      .from("agent_request_daily")
      .select("day,agent_id,requests,errors,duration_ms")
      .order("day", { ascending: false })
      .limit(500),
  ]);
  checkDb(profiles.error);
  const people = profiles.data ?? [];
  const ready =
    !clients.error && !keys.error && !events.error && !changes.error;
  const agents: ManagedAgent[] = (clients.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    actorId: c.actor_id,
    scopes: c.scopes,
    rateLimitPerMinute: c.rate_limit,
    source: "database",
    status: c.status,
    version: c.version,
    createdAt: c.created_at,
    profileName: people.find((p) => p.id === c.actor_id)?.full_name ?? null,
    role: people.find((p) => p.id === c.actor_id)?.role ?? null,
    credentials: (keys.data ?? [])
      .filter((k) => k.agent_id === c.id)
      .map((k) => ({
        id: k.id,
        label: k.label,
        createdAt: k.created_at,
        expiresAt: k.expires_at,
        revokedAt: k.revoked_at,
      })),
  }));
  for (const c of env ?? []) {
    if (agents.some((a) => a.id === c.id)) continue;
    // İzin verilen alanlar tek tek seçilir: token nesnesi asla yayılmaz.
    agents.push({
      id: c.id,
      name: c.name,
      actorId: c.actorId,
      scopes: [...c.scopes],
      rateLimitPerMinute: c.rateLimitPerMinute,
      source: "environment",
      status: "active",
      version: 0,
      createdAt: null,
      credentials: [],
      profileName: people.find((p) => p.id === c.actorId)?.full_name ?? null,
      role: people.find((p) => p.id === c.actorId)?.role ?? null,
    });
  }
  const rows = (events.data ?? []) as RequestEvent[];
  return {
    daily: daily.data ?? [],
    agents,
    profiles: people,
    events: rows.slice(0, 30),
    nextCursor: rows.length > 30 ? rows[29].id : null,
    changes: (changes.data ?? []).map((c) => ({
      id: c.id,
      agent_id: c.agent_id,
      actor_name: people.find((p) => p.id === c.actor)?.full_name ?? null,
      action: c.action,
      detail: c.detail,
      created_at: c.created_at,
    })) as ConfigEvent[],
    databaseReady: ready,
    environmentValid: env !== null,
    checkedAt: new Date().toISOString(),
    environment:
      process.env.VERCEL_ENV === "production"
        ? "Üretim"
        : process.env.VERCEL_ENV === "preview"
          ? "Önizleme"
          : "Yerel geliştirme",
    baseUrl:
      process.env.VERCEL_ENV === "production"
        ? "https://app.orioncranes.com/api/agent"
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}/api/agent`
          : "http://localhost:3000/api/agent",
  };
}
const commandSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("import"), id: z.string().min(2).max(64) })
    .strict(),
  z
    .object({
      action: z.literal("create"),
      value: agentEditSchema,
      dedicatedProfile: z.literal(true),
    })
    .strict(),
  z.object({ action: z.literal("update"), value: agentEditSchema }).strict(),
  z
    .object({
      action: z.literal("rotate"),
      id: z.string().min(2).max(64),
      version: z.number().int().positive(),
      overlapHours: z.union([z.literal(0), z.literal(24)]),
    })
    .strict(),
  z
    .object({
      action: z.literal("revoke"),
      id: z.string().min(2).max(64),
      version: z.number().int().positive(),
      credentialId: z.uuid(),
    })
    .strict(),
]);
export type IntegrationCommand = z.input<typeof commandSchema>;
export async function integrationCommand(
  input: unknown,
): Promise<{ token?: string }> {
  const { db, actor } = await integrationContext();
  const command = commandSchema.parse(input);
  let value: Record<string, unknown>;
  let token: string | undefined;
  if (command.action === "import") {
    const env = configuredAgents();
    const c = env?.find((a) => a.id === command.id);
    if (!c) throw new Error("Ortam kaydı doğrulanamadı. Ayarları yenileyin.");
    value = {
      id: c.id,
      name: c.name,
      actorId: c.actorId,
      scopes: c.scopes,
      rateLimitPerMinute: c.rateLimitPerMinute,
      digest: createHash("sha256").update(c.token).digest("hex"),
      label: "Aktarılan anahtar",
    };
  } else if (command.action === "create" || command.action === "update") {
    value = command.value;
    if (
      command.action === "create" &&
      configuredAgents()?.some((a) => a.id === command.value.id)
    )
      throw new Error("Bu kimlik ortamda mevcut. Önce mevcut kaydı aktarın.");
  } else value = { ...command };
  if (command.action === "create" || command.action === "rotate") {
    token = `orion_${randomBytes(32).toString("base64url")}`;
    value = {
      ...value,
      digest: createHash("sha256").update(token).digest("hex"),
      label: `Anahtar ${token.slice(-6)}`,
    };
  }
  const { error } = await db.rpc("agent_manage", {
    p_actor: actor,
    p_action: command.action,
    p_value: value,
  });
  checkDb(error);
  return token ? { token } : {};
}

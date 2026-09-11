import "server-only";

// AGENT API KAPISI.
//
// Bu dosya teklif modülüne ait değildir. Bugün yalnız teklif scope'ları vardır;
// yarın mühendislik ya da satın alma agent'ı açıldığında aynı kimlik, rate-limit,
// idempotency ve audit hattından geçer. Bir route'un var olması yetki vermez:
// route hem agent scope'unu hem de o agent'a bağlanan profilin uygulama rolünü
// açıkça istemek zorundadır.

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { canEditOffers, canSeeOffers, isAdminRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OfferMutationError } from "@/app/(app)/offers/mutations";

const DEFAULT_RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const MAX_JSON_BYTES = 2_000_000;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,128}$/;

const RESPONSE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Idempotency-Replayed, X-Request-Id",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Orion-Agent-Api-Version": "1",
} as const;

/** Her yeni bölüm burada kapalı bir scope olarak tanımlanır. */
export const AGENT_SCOPES = ["offers:read", "offers:draft:write", "email:read", "email:draft:write", "email:publish", "email:test:send", "email:send"] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

const agentClientSchema = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/),
    name: z.string().trim().min(2).max(120),
    token: z.string().min(32).max(512),
    actorId: z.uuid(),
    scopes: z.array(z.enum(AGENT_SCOPES)).min(1),
    rateLimitPerMinute: z.number().int().min(1).max(600).optional(),
  })
  .strict()
  .superRefine((client, context) => {
    if (new Set(client.scopes).size !== client.scopes.length) {
      context.addIssue({ code: "custom", message: "Scope tekrarı var.", path: ["scopes"] });
    }
  });

const agentClientsSchema = z
  .array(agentClientSchema)
  .min(1)
  .max(50)
  .superRefine((clients, context) => {
    const ids = new Set<string>();
    const tokens = new Set<string>();
    clients.forEach((client, index) => {
      if (ids.has(client.id)) {
        context.addIssue({ code: "custom", message: "Agent kimliği tekrarı var.", path: [index, "id"] });
      }
      if (tokens.has(client.token)) {
        context.addIssue({ code: "custom", message: "Agent token tekrarı var.", path: [index, "token"] });
      }
      ids.add(client.id);
      tokens.add(client.token);
    });
  });

export interface AgentPrincipal {
  id: string;
  name: string;
  actorId: string;
  scopes: readonly AgentScope[];
  rateLimitPerMinute: number;
}

interface ConfiguredAgent extends AgentPrincipal {
  token: string;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const agentGlobal = globalThis as typeof globalThis & {
  __orionAgentRateBuckets?: Map<string, RateBucket>;
};
const rateBuckets = (agentGlobal.__orionAgentRateBuckets ??= new Map<string, RateBucket>());

export interface AgentApiContext {
  supabase: SupabaseClient;
  actorId: string;
  principal: AgentPrincipal;
  requestId: string;
}

export interface AgentRequestDefinition {
  action: string;
  scope: AgentScope;
  detail?: Record<string, unknown>;
}

type AgentAuthorization =
  | { context: AgentApiContext; response?: never }
  | { context?: never; response: Response };

export function agentJson(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: { ...RESPONSE_HEADERS, ...init.headers },
  });
}

export function agentError(message: string, status: number, headers?: HeadersInit): Response {
  return agentJson({ error: message }, { status, headers });
}

export function agentOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...RESPONSE_HEADERS,
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Expose-Headers": "Idempotency-Replayed, X-Request-Id",
      "Access-Control-Max-Age": "600",
    },
  });
}

/** Uzunluk farkı dahil token karşılaştırmasını sabit boyutlu özetler üzerinden yapar. */
export function secureTokenEquals(received: string, expected: string): boolean {
  const receivedHash = createHash("sha256").update(received).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

function defaultRateLimit(): number {
  const value = Number(process.env.AGENT_API_RATE_LIMIT ?? DEFAULT_RATE_LIMIT);
  return Number.isInteger(value) && value >= 1 && value <= 600 ? value : DEFAULT_RATE_LIMIT;
}

/**
 * Tercih edilen ayar TEK secret içindeki JSON dizisidir: AGENT_API_CLIENTS.
 * Eski AGENT_API_TOKEN + AGENT_USER_ID ikilisi ilk kurulumları bozmamak için
 * aynı iki teklif scope'uyla geriye dönük olarak kabul edilir.
 */
function configuredAgents(): ConfiguredAgent[] | null {
  const registry = process.env.AGENT_API_CLIENTS?.trim();
  const emailRegistry = process.env.EMAIL_AGENT_CLIENTS?.trim();
  const token = process.env.AGENT_API_TOKEN?.trim() ?? "";
  const actorId = process.env.AGENT_USER_ID?.trim() ?? "";
  const legacy = token.length >= 32 && z.uuid().safeParse(actorId).success
    ? [{id:'offers-v1',name:'Teklif Agentı',token,actorId,scopes:['offers:read','offers:draft:write']}]
    : [];
  if (registry || emailRegistry) {
    try {
      const parsed = agentClientsSchema.safeParse([...(registry ? JSON.parse(registry) : legacy), ...(emailRegistry ? JSON.parse(emailRegistry) : [])]);
      if (!parsed.success) return null;
      return parsed.data.map((client) => ({
        ...client,
        rateLimitPerMinute: client.rateLimitPerMinute ?? defaultRateLimit(),
      }));
    } catch {
      return null;
    }
  }

  if (token.length < 32 || !z.uuid().safeParse(actorId).success) return null;
  return [
    {
      id: "offers-v1",
      name: "Teklif Agentı",
      token,
      actorId,
      scopes: ["offers:read", "offers:draft:write"],
      rateLimitPerMinute: defaultRateLimit(),
    },
  ];
}

function bearerToken(request: Request): string {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization")?.trim() ?? "");
  return match?.[1]?.trim() ?? "";
}

function matchingAgent(request: Request, agents: readonly ConfiguredAgent[]): ConfiguredAgent | null {
  const received = bearerToken(request);
  if (!received) return null;

  // İlk eşleşmede dönmeyiz; kayıt sırası ölçülebilir bir zaman farkı üretmesin.
  let match: ConfiguredAgent | null = null;
  for (const agent of agents) {
    if (secureTokenEquals(received, agent.token)) match = agent;
  }
  return match;
}

function clientKey(request: Request, agentId: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${agentId}:${ip}`).digest("hex");
}

function rateLimitResponse(request: Request, agent: ConfiguredAgent): Response | null {
  const now = Date.now();
  const key = clientKey(request, agent.id);
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;

  // Uzun yaşayan yerel süreçte eski kovalar birikmesin. Vercel örnekleri zaten
  // kısa ömürlüdür; bu sınır yalnız bellek için emniyet kemeridir.
  if (rateBuckets.size > 1_000) {
    for (const [bucketKey, value] of rateBuckets) {
      if (value.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }

  if (bucket.count <= agent.rateLimitPerMinute) return null;
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
  return agentError("Çok fazla istek gönderildi; lütfen kısa süre sonra tekrar deneyin.", 429, {
    "Retry-After": String(retryAfter),
  });
}

function profileCanUseScope(role: string | null, scope: AgentScope): boolean {
  if (scope.startsWith('email:')) return isAdminRole(role);
  switch (scope) {
    case "offers:read":
      return canSeeOffers(role);
    case "offers:draft:write":
      return canEditOffers(role);
    default: return false;
  }
}

export function resetAgentRateLimitForTests(): void {
  rateBuckets.clear();
}

export async function authorizeAgent(
  request: Request,
  requiredScope: AgentScope
): Promise<AgentAuthorization> {
  const agents = configuredAgents();
  if (!agents) return { response: agentError("Agent API yapılandırılmamış.", 503) };

  const agent = matchingAgent(request, agents);
  if (!agent) {
    return {
      response: agentError("Yetkilendirme başarısız.", 401, {
        "WWW-Authenticate": "Bearer",
      }),
    };
  }
  if (!agent.scopes.includes(requiredScope)) {
    return { response: agentError("Agent bu işlem için yetkili değil.", 403) };
  }

  const limited = rateLimitResponse(request, agent);
  if (limited) return { response: limited };

  let supabase: SupabaseClient;
  try {
    supabase = createAdminClient();
  } catch {
    return { response: agentError("Agent API şu anda kullanılamıyor.", 503) };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", agent.actorId)
    .maybeSingle();
  if (error) return { response: agentError("Agent yetkisi doğrulanamadı.", 503) };
  if (!profile || !profileCanUseScope(profile.role as string | null, requiredScope)) {
    return { response: agentError("Agent profili bu işlem için yetkili değil.", 403) };
  }

  const principal: AgentPrincipal = {
    id: agent.id,
    name: agent.name,
    actorId: agent.actorId,
    scopes: agent.scopes,
    rateLimitPerMinute: agent.rateLimitPerMinute,
  };
  return {
    context: {
      supabase,
      actorId: agent.actorId,
      principal,
      requestId: randomUUID(),
    },
  };
}

interface IdempotencyRecord {
  method: string;
  path: string;
  request_hash: string;
  response_status: number | null;
  response_body: unknown;
  completed_at: string | null;
}

type IdempotencyClaim =
  | { key: string; requestHash: string }
  | { response: Response }
  | null;

function requestPath(request: Request): string {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

async function claimIdempotency(
  request: Request,
  context: AgentApiContext
): Promise<IdempotencyClaim> {
  if (request.method !== "POST") return null;
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return null;
  if (!IDEMPOTENCY_KEY.test(key)) {
    return {
      response: agentError("Idempotency-Key 8-128 görünür ASCII karakter olmalı.", 422),
    };
  }

  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_JSON_BYTES) {
    return { response: agentError("İstek gövdesi çok büyük.", 422) };
  }

  let body: ArrayBuffer;
  try {
    body = await request.clone().arrayBuffer();
  } catch {
    return { response: agentError("İstek gövdesi okunamadı.", 422) };
  }
  if (body.byteLength > MAX_JSON_BYTES) {
    return { response: agentError("İstek gövdesi çok büyük.", 422) };
  }
  const path = requestPath(request);
  const requestHash = createHash("sha256")
    .update(request.method)
    .update("\n")
    .update(path)
    .update("\n")
    .update(Buffer.from(body))
    .digest("hex");

  const { error: insertError } = await context.supabase.from("agent_api_idempotency").insert({
    agent_id: context.principal.id,
    idempotency_key: key,
    method: request.method,
    path,
    request_hash: requestHash,
  });
  if (!insertError) return { key, requestHash };
  if (insertError.code !== "23505") {
    return { response: agentError("İstek tekrar güvenliği doğrulanamadı.", 503) };
  }

  const { data, error } = await context.supabase
    .from("agent_api_idempotency")
    .select("method, path, request_hash, response_status, response_body, completed_at")
    .eq("agent_id", context.principal.id)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error || !data) {
    return { response: agentError("İstek tekrar güvenliği doğrulanamadı.", 503) };
  }

  const existing = data as IdempotencyRecord;
  if (
    existing.method !== request.method ||
    existing.path !== path ||
    existing.request_hash !== requestHash
  ) {
    return {
      response: agentError("Aynı Idempotency-Key farklı bir istek için kullanılamaz.", 409),
    };
  }
  if (!existing.completed_at || existing.response_status === null) {
    return { response: agentError("Aynı anahtarlı istek halen işleniyor.", 409) };
  }

  return {
    response: agentJson(existing.response_body, {
      status: existing.response_status,
      headers: { "Idempotency-Replayed": "true" },
    }),
  };
}

async function completeIdempotency(
  context: AgentApiContext,
  claim: Exclude<IdempotencyClaim, null | { response: Response }>,
  response: Response
): Promise<void> {
  try {
    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      body = { error: "Yanıt tekrar oynatılamadı." };
    }
    await context.supabase
      .from("agent_api_idempotency")
      .update({
        response_status: response.status,
        response_body: body,
        completed_at: new Date().toISOString(),
      })
      .eq("agent_id", context.principal.id)
      .eq("idempotency_key", claim.key)
      .eq("request_hash", claim.requestHash);
  } catch {
    // İş tamamlandıktan sonra tekrar defteri erişilemezse başarılı işi geri
    // alamayız. Kayıt "işleniyor" kalır ve aynı anahtarın yeniden mutasyon
    // üretmesi yerine güvenli biçimde 409 dönmesini sağlar.
  }
}

function withRequestId(response: Response, requestId: string): Response {
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export async function runAgentRequest(
  request: Request,
  definition: AgentRequestDefinition,
  handler: (context: AgentApiContext) => Promise<Response>
): Promise<Response> {
  const authorized = await authorizeAgent(request, definition.scope);
  if (authorized.response) return authorized.response;

  const { context } = authorized;
  const { error: auditError } = await context.supabase.from("audit_log").insert({
    project_id: null,
    actor: context.actorId,
    action: definition.action,
    detail: {
      ...(definition.detail ?? {}),
      actor: "agent",
      agent_id: context.principal.id,
      agent_name: context.principal.name,
      scope: definition.scope,
      request_id: context.requestId,
      method: request.method,
      path: new URL(request.url).pathname,
    },
  });
  // Denetim izi yazılamıyorsa işlem hiç başlamaz; özellikle yazma uçlarında
  // kayıtsız bir değişiklik bırakmak başarılı cevap vermekten daha kötüdür.
  if (auditError) {
    return withRequestId(
      agentError("İstek denetim kaydına alınamadı.", 503),
      context.requestId
    );
  }

  const claim = await claimIdempotency(request, context);
  if (claim && "response" in claim) return withRequestId(claim.response, context.requestId);

  try {
    const response = await handler(context);
    if (claim) await completeIdempotency(context, claim, response);
    return withRequestId(response, context.requestId);
  } catch {
    const response = agentError("İstek işlenemedi.", 500);
    if (claim) await completeIdempotency(context, claim, response);
    return withRequestId(response, context.requestId);
  }
}

export async function readAgentJson(
  request: Request
): Promise<{ data: unknown; response?: never } | { data?: never; response: Response }> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return { response: agentError("İstek gövdesi JSON olmalı.", 422) };
  }

  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_JSON_BYTES) {
    return { response: agentError("İstek gövdesi çok büyük.", 422) };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { response: agentError("İstek gövdesi okunamadı.", 422) };
  }
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    return { response: agentError("İstek gövdesi çok büyük.", 422) };
  }

  try {
    return { data: JSON.parse(text) as unknown };
  } catch {
    return { response: agentError("Geçersiz JSON gövdesi.", 422) };
  }
}

export function mutationErrorResponse(error: OfferMutationError): Response {
  switch (error.kind) {
    case "validation":
      return agentError(error.message, 422);
    case "not_found":
      return agentError(error.message, 404);
    case "conflict":
      return agentError(error.message, 409);
    case "forbidden":
      return agentError(error.message, 403);
    case "database":
      return agentError("İşlem veritabanına kaydedilemedi.", 500);
  }
}

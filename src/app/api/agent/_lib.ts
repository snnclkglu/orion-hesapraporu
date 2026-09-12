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
import { createAdminClient } from "@/lib/supabase/admin";
import { USER_ROLES } from "@/lib/roles";
import type { OfferMutationError } from "@/app/(app)/offers/mutations";

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

export { AGENT_SCOPES } from "@/lib/integrations/model";
export type { AgentScope, AgentPrincipal } from "@/lib/integrations/model";
import {
  type AgentScope,
  type AgentPrincipal,
  principalSchema,
  profileCanUseScope,
} from "@/lib/integrations/model";
import {
  configuredAgents,
  type ConfiguredAgent,
} from "@/lib/integrations/config";
interface RateBucket {
  count: number;
  resetAt: number;
}

const agentGlobal = globalThis as typeof globalThis & {
  __orionAgentRateBuckets?: Map<string, RateBucket>;
};
const rateBuckets = (agentGlobal.__orionAgentRateBuckets ??= new Map<
  string,
  RateBucket
>());

export interface AgentApiContext {
  supabase: SupabaseClient;
  actorId: string;
  principal: AgentPrincipal;
  requestId: string;
}

export interface AgentRequestDefinition {
  action: string;
  scope: AgentScope | null;
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

export function agentError(
  message: string,
  status: number,
  headers?: HeadersInit,
): Response {
  return agentJson({ error: message }, { status, headers });
}

export function agentOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...RESPONSE_HEADERS,
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Idempotency-Key",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
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

function bearerToken(request: Request): string {
  const match = /^Bearer\s+(.+)$/i.exec(
    request.headers.get("authorization")?.trim() ?? "",
  );
  return match?.[1]?.trim() ?? "";
}

function matchingAgent(
  request: Request,
  agents: readonly ConfiguredAgent[],
): ConfiguredAgent | null {
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
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${agentId}:${ip}`).digest("hex");
}

function rateLimitResponse(
  request: Request,
  agent: AgentPrincipal,
): Response | null {
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
  return agentError(
    "Çok fazla istek gönderildi; lütfen kısa süre sonra tekrar deneyin.",
    429,
    {
      "Retry-After": String(retryAfter),
    },
  );
}

export function resetAgentRateLimitForTests(): void {
  rateBuckets.clear();
}

export async function authorizeAgent(
  request: Request,
  requiredScope: AgentScope | null,
): Promise<AgentAuthorization> {
  const agents = configuredAgents();
  const received = bearerToken(request);
  if (!received || received.length > 512)
    return {
      response: agentError("Yetkilendirme başarısız.", 401, {
        "WWW-Authenticate": "Bearer",
      }),
    };
  const legacy = matchingAgent(request, agents ?? []);
  let supabase: SupabaseClient;
  let agent: AgentPrincipal | null = null;
  let managed = false;
  let registryConfigured = false;
  try {
    supabase = createAdminClient();
    const { data, error } = await supabase.rpc("agent_resolve", {
      p_digest: createHash("sha256").update(received).digest("hex"),
      p_env_id: legacy?.id ?? null,
    });
    if (error || !data || typeof data.managed !== "boolean")
      return { response: agentError("Ajan kayıtları doğrulanamadı.", 503) };
    managed = data.managed;
    registryConfigured = data.configured === true;
    if (managed) {
      if (data.principal) {
        const parsed = principalSchema.safeParse(data.principal);
        if (!parsed.success)
          return {
            response: agentError("Ajan yapılandırması doğrulanamadı.", 503),
          };
        agent = parsed.data;
      }
    } else agent = legacy;
  } catch {
    return { response: agentError("Agent API şu anda kullanılamıyor.", 503) };
  }
  if (!agent)
    return {
      response: agentError(
        !agents && !registryConfigured
          ? "Agent API yapılandırılmamış veya anahtar geçersiz."
          : "Yetkilendirme başarısız.",
        !agents && !managed && !registryConfigured ? 503 : 401,
      ),
    };
  const trace = requestTraces.get(request);
  if (trace) trace.agentId = agent.id;
  const limited = rateLimitResponse(request, agent);
  if (limited) return { response: limited };
  if (requiredScope && !agent.scopes.includes(requiredScope)) {
    return { response: agentError("Agent bu işlem için yetkili değil.", 403) };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", agent.actorId)
    .maybeSingle();
  if (error)
    return { response: agentError("Agent yetkisi doğrulanamadı.", 503) };
  if (
    !profile ||
    (requiredScope
      ? !profileCanUseScope(profile.role as string | null, requiredScope)
      : !USER_ROLES.some((role) => role === profile.role))
  ) {
    return {
      response: agentError("Agent profili bu işlem için yetkili değil.", 403),
    };
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
      requestId: requestTraces.get(request)?.id ?? randomUUID(),
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
  context: AgentApiContext,
): Promise<IdempotencyClaim> {
  // Görev komutlarında tekrar kaydı mutasyonla aynı SQL transaction içindedir.
  if (new URL(request.url).pathname.startsWith("/api/agent/tasks")) return null;
  if (request.method !== "POST") return null;
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return null;
  if (!IDEMPOTENCY_KEY.test(key)) {
    return {
      response: agentError(
        "Idempotency-Key 8-128 görünür ASCII karakter olmalı.",
        422,
      ),
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

  const { error: insertError } = await context.supabase
    .from("agent_api_idempotency")
    .insert({
      agent_id: context.principal.id,
      idempotency_key: key,
      method: request.method,
      path,
      request_hash: requestHash,
    });
  if (!insertError) return { key, requestHash };
  if (insertError.code !== "23505") {
    return {
      response: agentError("İstek tekrar güvenliği doğrulanamadı.", 503),
    };
  }

  const { data, error } = await context.supabase
    .from("agent_api_idempotency")
    .select(
      "method, path, request_hash, response_status, response_body, completed_at",
    )
    .eq("agent_id", context.principal.id)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error || !data) {
    return {
      response: agentError("İstek tekrar güvenliği doğrulanamadı.", 503),
    };
  }

  const existing = data as IdempotencyRecord;
  if (
    existing.method !== request.method ||
    existing.path !== path ||
    existing.request_hash !== requestHash
  ) {
    return {
      response: agentError(
        "Aynı Idempotency-Key farklı bir istek için kullanılamaz.",
        409,
      ),
    };
  }
  if (!existing.completed_at || existing.response_status === null) {
    return {
      response: agentError("Aynı anahtarlı istek halen işleniyor.", 409),
    };
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
  response: Response,
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

// Yol sözlüğü dışındaki parçalar kaydedilmez; arama metni ve kayıt kimliği yoktur.
const routeWords = new Set([
  "tasks",
  "context",
  "comments",
  "events",
  "workflow",
  "offers",
  "revisions",
  "items",
  "customers",
  "offer-options",
  "offer-templates",
  "email-center",
  "me",
]);
export function safeAgentRoute(url: string): string {
  const parts = new URL(url).pathname
    .replace(/^\/api\/agent\/?/, "")
    .split("/")
    .filter(Boolean);
  return (
    "/api/agent/" +
    parts
      .slice(0, 6)
      .map((p) => (routeWords.has(p) ? p : ":id"))
      .join("/")
  );
}
const requestTraces = new WeakMap<
  Request,
  { id: string; agentId: string | null; scope: AgentScope | null }
>();
export async function observeAgentRequest(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (requestTraces.has(request)) return handler();
  const trace = {
    id: randomUUID(),
    agentId: null as string | null,
    scope: null as AgentScope | null,
  };
  requestTraces.set(request, trace);
  const started = Date.now();
  let response: Response;
  try {
    response = await handler();
  } catch {
    response = agentError("İstek işlenemedi.", 500);
  }
  response.headers.set("X-Request-Id", trace.id);
  let reasonCode: string | null =
    (
      {
        401: "auth_failed",
        403: "access_denied",
        404: "not_found",
        409: "conflict",
        422: "validation",
        429: "limited",
        500: "internal",
        503: "unavailable",
      } as Record<number, string>
    )[response.status] ?? null;
  if (response.status === 403) {
    try {
      const body = await response.clone().json();
      if (body.error === "Agent bu işlem için yetkili değil.")
        reasonCode = "scope_denied";
      if (body.error === "Agent profili bu işlem için yetkili değil.")
        reasonCode = "profile_denied";
    } catch {
      /* İçerik saklanmaz; yalnız bilinen sabit neden kodları seçilir. */
    }
  }
  try {
    await createAdminClient()
      .rpc("agent_record_request", {
        p_event: {
          reason_code: reasonCode,
          request_id: trace.id,
          agent_id: trace.agentId,
          scope: trace.scope,
          method: request.method,
          route: safeAgentRoute(request.url),
          status: response.status,
          duration_ms: Math.min(3600000, Math.max(0, Date.now() - started)),
          replayed: response.headers.get("Idempotency-Replayed") === "true",
        },
      })
      .abortSignal(AbortSignal.timeout(1500));
  } catch {
    /* Sonuç ölçümü işin sonucunu değiştirmez; zorunlu audit ayrı kalır. */
  }
  requestTraces.delete(request);
  return response;
}
export async function runAgentRequest(
  request: Request,
  definition: AgentRequestDefinition,
  handler: (context: AgentApiContext) => Promise<Response>,
): Promise<Response> {
  return observeAgentRequest(request, () => {
    const trace = requestTraces.get(request);
    if (trace) trace.scope = definition.scope;
    return runAuthorizedRequest(request, definition, handler);
  });
}

async function runAuthorizedRequest(
  request: Request,
  definition: AgentRequestDefinition,
  handler: (context: AgentApiContext) => Promise<Response>,
): Promise<Response> {
  const authorized = await authorizeAgent(request, definition.scope);
  if (authorized.response) return authorized.response;

  const { context } = authorized;
  const { error: auditError } = await context.supabase
    .from("audit_log")
    .insert({
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
      context.requestId,
    );
  }

  const claim = await claimIdempotency(request, context);
  if (claim && "response" in claim)
    return withRequestId(claim.response, context.requestId);

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
  request: Request,
): Promise<
  { data: unknown; response?: never } | { data?: never; response: Response }
> {
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

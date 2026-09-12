import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AGENT_SCOPES, type AgentPrincipal } from "./model";
const DEFAULT_RATE_LIMIT = 60;
const agentClientSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9._-]{1,63}$/),
    name: z.string().trim().min(2).max(120),
    token: z.string().min(32).max(512),
    actorId: z.uuid(),
    scopes: z.array(z.enum(AGENT_SCOPES)).min(1),
    rateLimitPerMinute: z.number().int().min(1).max(600).optional(),
  })
  .strict()
  .superRefine((client, context) => {
    if (new Set(client.scopes).size !== client.scopes.length) {
      context.addIssue({
        code: "custom",
        message: "Scope tekrarı var.",
        path: ["scopes"],
      });
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
        context.addIssue({
          code: "custom",
          message: "Agent kimliği tekrarı var.",
          path: [index, "id"],
        });
      }
      if (tokens.has(client.token)) {
        context.addIssue({
          code: "custom",
          message: "Agent token tekrarı var.",
          path: [index, "token"],
        });
      }
      ids.add(client.id);
      tokens.add(client.token);
    });
  });

// Mevcut gizli kayıt yeniden okunamadığında yalnız seçilmiş token'a görev
// kapsamı ekler. Yeni kimlik/token oluşturmaz; profil ve kayıt yetkileri aynıdır.
const taskScopeGrantsSchema = z
  .array(
    z
      .object({
        tokenSha256: z.string().regex(/^[a-f0-9]{64}$/),
        scopes: z
          .array(
            z.enum([
              "tasks:context:read",
              "tasks:read",
              "tasks:write",
              "tasks:comment",
            ]),
          )
          .min(1)
          .max(4)
          .refine((scopes) => new Set(scopes).size === scopes.length),
      })
      .strict(),
  )
  .max(50)
  .refine(
    (grants) =>
      new Set(grants.map((grant) => grant.tokenSha256)).size === grants.length,
  );

function applyTaskScopeGrants(
  clients: ConfiguredAgent[],
): ConfiguredAgent[] | null {
  const raw = process.env.AGENT_TASK_SCOPE_GRANTS?.trim();
  if (!raw) return clients;
  try {
    const parsed = taskScopeGrantsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return clients.map((client) => {
      const digest = createHash("sha256").update(client.token).digest("hex");
      const grant = parsed.data.find((value) => value.tokenSha256 === digest);
      return grant
        ? {
            ...client,
            scopes: [...new Set([...client.scopes, ...grant.scopes])],
          }
        : client;
    });
  } catch {
    return null;
  }
}

export interface ConfiguredAgent extends AgentPrincipal {
  token: string;
}
function defaultRateLimit(): number {
  const value = Number(process.env.AGENT_API_RATE_LIMIT ?? DEFAULT_RATE_LIMIT);
  return Number.isInteger(value) && value >= 1 && value <= 600
    ? value
    : DEFAULT_RATE_LIMIT;
}

/**
 * Tercih edilen ayar TEK secret içindeki JSON dizisidir: AGENT_API_CLIENTS.
 * Eski AGENT_API_TOKEN + AGENT_USER_ID ikilisi ilk kurulumları bozmamak için
 * aynı iki teklif scope'uyla geriye dönük olarak kabul edilir.
 */
export function configuredAgents(): ConfiguredAgent[] | null {
  const registry = process.env.AGENT_API_CLIENTS?.trim();
  const emailRegistry = process.env.EMAIL_AGENT_CLIENTS?.trim();
  const token = process.env.AGENT_API_TOKEN?.trim() ?? "";
  const actorId = process.env.AGENT_USER_ID?.trim() ?? "";
  const legacy =
    token.length >= 32 && z.uuid().safeParse(actorId).success
      ? [
          {
            id: "offers-v1",
            name: "Teklif Agentı",
            token,
            actorId,
            scopes: ["offers:read", "offers:draft:write"],
          },
        ]
      : [];
  if (registry || emailRegistry) {
    try {
      const parsed = agentClientsSchema.safeParse([
        ...(registry ? JSON.parse(registry) : legacy),
        ...(emailRegistry ? JSON.parse(emailRegistry) : []),
      ]);
      if (!parsed.success) return null;
      return applyTaskScopeGrants(
        parsed.data.map((client) => ({
          ...client,
          rateLimitPerMinute: client.rateLimitPerMinute ?? defaultRateLimit(),
        })),
      );
    } catch {
      return null;
    }
  }

  if (token.length < 32 || !z.uuid().safeParse(actorId).success) return null;
  return applyTaskScopeGrants([
    {
      id: "offers-v1",
      name: "Teklif Agentı",
      token,
      actorId,
      scopes: ["offers:read", "offers:draft:write"],
      rateLimitPerMinute: defaultRateLimit(),
    },
  ]);
}

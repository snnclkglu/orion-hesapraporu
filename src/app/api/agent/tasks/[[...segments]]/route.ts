import {
  agentJson,
  agentError,
  agentOptions,
  readAgentJson,
  runAgentRequest,
  type AgentScope,
} from "../../_lib";
import {
  taskSnapshot,
  taskDetail,
  taskCommand,
  taskTagCatalog,
  TaskError,
} from "@/lib/tasks/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ segments?: string[] }> };
export function OPTIONS() {
  return agentOptions();
}
async function handle(request: Request, ctx: Context) {
  const { segments = [] } = await ctx.params;
  const [id, child] = segments;
  const read = request.method === "GET";
  const scope: AgentScope =
    !read && (child === "cancel" || child === "reactivate") ? "tasks:cancel" : id === "tags" && !read ? "tasks:tags:manage" : id === "context"
      ? "tasks:context:read"
      : read
        ? "tasks:read"
        : child === "comments"
          ? "tasks:comment"
          : "tasks:write";
  return runAgentRequest(
    request,
    { action: `agent.tasks.${read ? "read" : "write"}`, scope },
    async ({ supabase, actorId, principal }) => {
      const { data: allowed, error } = await supabase.rpc("task_rate_limit", {
        p_principal: principal.id,
        p_limit: principal.rateLimitPerMinute,
      });
      if (error) return agentError("İstek sınırı doğrulanamadı.", 503);
      if (!allowed)
        return agentError("İstek sınırına ulaşıldı.", 429, {
          "Retry-After": "60",
        });
      try {
        if (segments.length > 2) return agentError("Uç bulunamadı.", 404);
        if (read) {
          if (id === "tags") {
            if (child) return agentError("Uç bulunamadı.", 404);
            return agentJson(await taskTagCatalog(supabase, actorId, Object.fromEntries(new URL(request.url).searchParams)));
          }
          if (id === "context") {
            const q = new URL(request.url).searchParams.get("q") ?? "";
            const data = await taskSnapshot(supabase, actorId, {
              view: "team",
              q,
            });
            return agentJson({
              boards: data.boards,
              teams: data.teams,
              members: data.members,
              people: data.people,
              jobs: data.jobs,
            });
          }
          if (id) {
            const d = await taskDetail(supabase, actorId, id);
            if (child === "workflow") {
              const { data, error } = await supabase.rpc("task_flow_detail", {
                p_id: id,
                p_actor: actorId,
              });
              if (error) return agentError("Görev akışı okunamadı.", 503);
              return agentJson({
                checklist: d.task.checklist ?? [],
                recurrence: d.task.recurrence ?? null,
                ...data,
              });
            }
            return agentJson(
              child === "comments"
                ? { comments: d.comments }
                : child === "events"
                  ? { events: d.events }
                  : child
                    ? { error: "Uç bulunamadı" }
                    : d,
              {
                status:
                  child && !["comments", "events"].includes(child) ? 404 : 200,
              },
            );
          }
          const params = Object.fromEntries(new URL(request.url).searchParams);
          const data = await taskSnapshot(supabase, actorId, {
            view: "boards",
            ...params,
            ...(params.sent !== undefined
              ? { sent: params.sent === "true" }
              : {}),
            ...(params.unassigned !== undefined
              ? { unassigned: params.unassigned === "true" }
              : {}),
            ...(params.untagged !== undefined ? {untagged: params.untagged === "true"} : {}),
          });
          const last = data.tasks.at(-1);
          return agentJson({
            tasks: data.tasks,
            total: data.total,
            nextCursor:
              data.tasks.length === 50 && last
                ? `${last.updated_at}|${last.id}`
                : null,
          });
        }
        const key = request.headers.get("idempotency-key")?.trim();
        if (!key || !/^[\x21-\x7e]{8,128}$/.test(key))
          return agentError("Idempotency-Key 8–128 karakter olmalı.", 422);
        const body = await readAgentJson(request);
        if (body.response) return body.response;
        if (
          !body.data ||
          typeof body.data !== "object" ||
          Array.isArray(body.data)
        )
          return agentError("JSON nesnesi gerekli.", 422);
        const input = body.data as Record<string, unknown>;
        const operation =
          id && (child === "cancel" || child === "reactivate") && request.method === "POST" ? child : id === "tags" && !child && request.method === "POST" ? "tag.create"
            : id === "tags" && child && request.method === "PATCH" ? "tag.update"
            : !id && request.method === "POST"
            ? "create"
            : id && !child && request.method === "PATCH"
              ? "update"
              : id && child === "comments" && request.method === "POST"
                ? "comment"
                : id && child === "workflow" && request.method === "PATCH"
                  ? "workflow"
                  : null;
        if (!operation) return agentError("Uç veya metot bulunamadı.", 404);
        const result = await taskCommand(
          supabase,
          actorId,
          operation,
          id === "tags" ? (child ? {...input,id:child} : input) : id ? { ...input, id } : input,
          principal.id,
          key,
        );
        return agentJson(result, {
          status: operation === "create" || operation === "tag.create" ? 201 : 200,
          headers: result.replayed ? { "Idempotency-Replayed": "true" } : {},
        });
      } catch (e) {
        return e instanceof TaskError
          ? agentError(e.message, e.status)
          : agentError("İstek işlenemedi.", 503);
      }
    },
  );
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;

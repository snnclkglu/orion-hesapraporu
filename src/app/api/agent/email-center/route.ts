import { EMAIL_COMMAND_SCOPES } from "@/lib/integrations/catalog";
import { observeAgentRequest } from "../_lib";
import { after } from "next/server";
import { z } from "zod";
import {
  agentOptions,
  agentJson,
  agentError,
  readAgentJson,
  runAgentRequest,
} from "../_lib";
import {
  commandSchema,
  emailCenterData,
  emailDetail,
  executeEmailCommand,
  EmailCenterError,
} from "@/lib/email-center/service";
import { processEmailCenter } from "@/lib/email-center/worker";
export const runtime = "nodejs";
export const maxDuration = 60;
export function OPTIONS() {
  return agentOptions();
}
export async function GET(request: Request) {
  return runAgentRequest(
    request,
    { action: "agent.email.read", scope: "email:read" },
    async ({ supabase }) => {
      const params = new URL(request.url).searchParams;
      const detail = params.get("detail");
      const id = params.get("id");
      if (
        detail &&
        ["version", "delivery"].includes(detail) &&
        z.uuid().safeParse(id).success
      )
        return agentJson(
          await emailDetail(detail as "version" | "delivery", id!, supabase),
        );
      return agentJson(
        await emailCenterData(supabase, {
          jobId: params.get("jobId") ?? undefined,
          status: params.get("status") ?? undefined,
          query: params.get("q")?.slice(0, 254),
          page: Math.max(0, Math.min(10000, Number(params.get("page")) || 0)),
        }),
      );
    },
  );
}
async function post(request: Request) {
  // Asıl gövde tekrar güvenliği için okunabilir kalmalıdır.
  const json = await readAgentJson(request.clone());
  if (json.response) return json.response;
  const parsed = commandSchema.safeParse(json.data);
  if (!parsed.success)
    return agentError(
      parsed.error.issues.map((i) => i.message).join(" · "),
      422,
    );
  const command = parsed.data;
  if (command.action !== "preview" && !request.headers.get("idempotency-key"))
    return agentError("Yazma işlemi için Idempotency-Key gerekli.", 422);
  return runAgentRequest(
    request,
    {
      action: `agent.email.${command.action}`,
      scope: EMAIL_COMMAND_SCOPES[command.action],
    },
    async ({ actorId, principal, supabase }) => {
      try {
        const result = await executeEmailCommand(
          command,
          { id: actorId, source: `agent:${principal.id}` },
          supabase,
        );
        if (
          ["test.send", "delivery.retry", "delivery.resend"].includes(
            command.action,
          )
        )
          after(async () => {
            try {
              await processEmailCenter(1);
            } catch {
              console.error("E-posta kuyruğu sonraki çalışmaya bırakıldı.");
            }
          });
        return agentJson({ result });
      } catch (error) {
        return agentError(
          error instanceof Error ? error.message : "İşlem tamamlanamadı.",
          error instanceof EmailCenterError ? error.status : 422,
        );
      }
    },
  );
}

export async function POST(request: Request) {
  return observeAgentRequest(request, () => post(request));
}

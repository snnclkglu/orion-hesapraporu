import { z } from "zod";
import { agentError, agentJson, agentOptions, runAgentRequest } from "../_lib";

const listKeySchema = z.string().trim().min(1, "Liste anahtarı gerekli.").max(120);

export const runtime = "nodejs";

export function OPTIONS() {
  return agentOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return runAgentRequest(request, {
    action: "agent.offer_options.read",
    scope: "offers:read",
  }, async ({ supabase }) => {
    const parsed = listKeySchema.safeParse(url.searchParams.get("listKey") ?? "");
    if (!parsed.success) return agentError(parsed.error.issues[0].message, 422);

    const { data, error } = await supabase
      .from("offer_options")
      .select("id, list_key, value, parent_id, sort, is_default, note")
      .eq("list_key", parsed.data)
      .eq("active", true)
      .order("sort")
      .order("value");
    if (error) return agentError("Teklif seçenekleri okunamadı.", 500);

    return agentJson({ options: data ?? [] });
  });
}

import { agentError, agentJson, agentOptions, runAgentRequest } from "../_lib";

export const runtime = "nodejs";

export function OPTIONS() {
  return agentOptions();
}

export async function GET(request: Request) {
  return runAgentRequest(request, {
    action: "agent.offer_templates.read",
    scope: "offers:read",
  }, async ({ supabase }) => {
    const { data, error } = await supabase
      .from("offer_templates")
      .select("id, name, crane_type")
      .eq("active", true)
      .order("sort")
      .order("name");
    if (error) return agentError("Teklif şablonları okunamadı.", 500);
    return agentJson({ templates: data ?? [] });
  });
}

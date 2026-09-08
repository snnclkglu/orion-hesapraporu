import { z } from "zod";
import { agentError, agentJson, agentOptions, runAgentRequest } from "../_lib";

const querySchema = z.string().trim().min(1, "Müşteri arama metni gerekli.").max(120);

export const runtime = "nodejs";

export function OPTIONS() {
  return agentOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return runAgentRequest(request, {
    action: "agent.customers.search",
    scope: "offers:read",
  }, async ({ supabase }) => {
    const parsed = querySchema.safeParse(url.searchParams.get("q") ?? "");
    if (!parsed.success) return agentError(parsed.error.issues[0].message, 422);

    // `%` ve `_` kullanıcı aramasında joker değil gerçek karakterdir.
    const query = parsed.data.replace(/[%_]/g, (value) => `\\${value}`);
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(20);
    if (error) return agentError("Müşteri araması yapılamadı.", 500);

    return agentJson({
      customers: (data ?? []).map((customer) => ({
        id: customer.id as string,
        name: customer.name as string,
      })),
    });
  });
}

import { agentJson, agentOptions, runAgentRequest } from "../_lib";
export const runtime = "nodejs";
export function OPTIONS() {
  return agentOptions();
}
export async function GET(request: Request) {
  return runAgentRequest(
    request,
    { action: "agent.me.read", scope: null },
    async ({ principal, requestId }) =>
      agentJson({
        apiVersion: "1",
        agent: principal,
        requestId,
        access:
          "Scope, profil ve kayıt erişimi birlikte uygulanır. İzin listesi tüm kayıtlara erişim garantisi değildir.",
      }),
  );
}

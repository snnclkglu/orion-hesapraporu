import { createOfferDraft } from "@/app/(app)/offers/mutations";
import type { NewOfferInput } from "@/app/(app)/offers/schema";
import {
  agentJson,
  agentOptions,
  mutationErrorResponse,
  readAgentJson,
  runAgentRequest,
} from "../_lib";

export const runtime = "nodejs";

export function OPTIONS() {
  return agentOptions();
}

export async function POST(request: Request) {
  return runAgentRequest(request, {
    action: "agent.offer.create",
    scope: "offers:draft:write",
  }, async ({ supabase, actorId }) => {
    const body = await readAgentJson(request);
    if (body.response) return body.response;

    const result = await createOfferDraft(supabase, actorId, body.data as NewOfferInput);
    if (result.error) return mutationErrorResponse(result.error);

    return agentJson(
      {
        offerId: result.data.offerId,
        offerNo: result.data.offerNo,
        revisionId: result.data.revisionId,
        appUrl: new URL(`/offers/${result.data.offerId}`, request.url).toString(),
      },
      { status: 201 }
    );
  });
}

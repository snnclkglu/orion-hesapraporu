import { createOfferRevisionDraft } from "@/app/(app)/offers/mutations";
import {
  agentJson,
  agentOptions,
  mutationErrorResponse,
  runAgentRequest,
} from "../../../_lib";

export const runtime = "nodejs";

type Context = { params: Promise<{ offerId: string }> };

export function OPTIONS() {
  return agentOptions();
}

export async function POST(request: Request, { params }: Context) {
  const { offerId } = await params;
  return runAgentRequest(
    request,
    {
      action: "agent.offer.revision_create",
      scope: "offers:draft:write",
      detail: { offer_id: offerId },
    },
    async ({ supabase, actorId }) => {
      const result = await createOfferRevisionDraft(supabase, actorId, offerId);
      if (result.error) return mutationErrorResponse(result.error);
      return agentJson(
        { revisionId: result.data.revisionId, rev_no: result.data.revNo },
        { status: 201 }
      );
    }
  );
}

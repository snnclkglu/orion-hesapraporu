import { addOfferTemplateItemDraft } from "@/app/(app)/offers/mutations";
import type { AddOfferTemplateItemInput } from "@/app/(app)/offers/schema";
import {
  agentJson,
  agentOptions,
  mutationErrorResponse,
  readAgentJson,
  runAgentRequest,
} from "../../../../../_lib";

export const runtime = "nodejs";

type Context = { params: Promise<{ offerId: string; revisionId: string }> };

export function OPTIONS() {
  return agentOptions();
}

/** Şablon satırlarını agent'ın tahmin etmeden taslağa eklemesi için güvenli komut. */
export async function POST(request: Request, { params }: Context) {
  const { offerId, revisionId } = await params;
  return runAgentRequest(
    request,
    {
      action: "agent.offer.item_create_from_template",
      scope: "offers:draft:write",
      detail: { offer_id: offerId, revision_id: revisionId },
    },
    async ({ supabase }) => {
      const body = await readAgentJson(request);
      if (body.response) return body.response;

      const result = await addOfferTemplateItemDraft(
        supabase,
        offerId,
        revisionId,
        body.data as AddOfferTemplateItemInput
      );
      if (result.error) return mutationErrorResponse(result.error);
      return agentJson(
        { itemId: result.data.item.id, item: result.data.item },
        { status: 201 }
      );
    }
  );
}

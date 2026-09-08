import { z } from "zod";
import { loadOfferRevision } from "@/app/(app)/offers/data";
import { saveOfferRevisionDraftForAgent } from "@/app/(app)/offers/mutations";
import type { SaveRevisionInput } from "@/app/(app)/offers/schema";
import { offerPayloadForAgent } from "@/lib/offers/agent";
import {
  agentError,
  agentJson,
  agentOptions,
  mutationErrorResponse,
  readAgentJson,
  runAgentRequest,
} from "../../../../_lib";

export const runtime = "nodejs";

type Context = { params: Promise<{ offerId: string; revisionId: string }> };

export function OPTIONS() {
  return agentOptions();
}

function validIds(offerId: string, revisionId: string): Response | null {
  if (!z.uuid().safeParse(offerId).success) return agentError("Geçersiz teklif", 422);
  if (!z.uuid().safeParse(revisionId).success) return agentError("Geçersiz revizyon", 422);
  return null;
}

export async function GET(request: Request, { params }: Context) {
  const { offerId, revisionId } = await params;
  return runAgentRequest(
    request,
    {
      action: "agent.offer.revision_read",
      scope: "offers:read",
      detail: { offer_id: offerId, revision_id: revisionId },
    },
    async ({ supabase }) => {
      const invalid = validIds(offerId, revisionId);
      if (invalid) return invalid;

      const loaded = await loadOfferRevision(supabase, offerId, revisionId);
      if (!loaded) return agentError("Revizyon bulunamadı.", 404);
      return agentJson({
        payload: offerPayloadForAgent(loaded.revision.payload),
        notes: loaded.revision.notes,
        status: loaded.revision.status,
        rev_no: loaded.revision.rev_no,
      });
    }
  );
}

export async function PUT(request: Request, { params }: Context) {
  const { offerId, revisionId } = await params;
  return runAgentRequest(
    request,
    {
      action: "agent.offer.revision_save",
      scope: "offers:draft:write",
      detail: { offer_id: offerId, revision_id: revisionId },
    },
    async ({ supabase }) => {
      const invalid = validIds(offerId, revisionId);
      if (invalid) return invalid;
      const body = await readAgentJson(request);
      if (body.response) return body.response;

      const result = await saveOfferRevisionDraftForAgent(
        supabase,
        offerId,
        revisionId,
        body.data as SaveRevisionInput
      );
      if (result.error) return mutationErrorResponse(result.error);
      return agentJson({ ok: true });
    }
  );
}

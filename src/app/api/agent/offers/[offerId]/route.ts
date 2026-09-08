import { z } from "zod";
import { loadOffer } from "@/app/(app)/offers/data";
import { agentError, agentJson, agentOptions, runAgentRequest } from "../../_lib";

export const runtime = "nodejs";

type Context = { params: Promise<{ offerId: string }> };

export function OPTIONS() {
  return agentOptions();
}

export async function GET(request: Request, { params }: Context) {
  const { offerId } = await params;
  return runAgentRequest(
    request,
    {
      action: "agent.offer.read",
      scope: "offers:read",
      detail: { offer_id: offerId },
    },
    async ({ supabase }) => {
      const parsed = z.uuid("Geçersiz teklif").safeParse(offerId);
      if (!parsed.success) return agentError(parsed.error.issues[0].message, 422);

      const loaded = await loadOffer(supabase, parsed.data);
      if (!loaded) return agentError("Teklif bulunamadı.", 404);

      return agentJson({
        offer: {
          id: loaded.offer.id,
          offerNo: loaded.offer.offer_no,
          customerId: loaded.offer.customer_id,
          customerName: loaded.offer.customer_name,
          subject: loaded.offer.subject,
          lang: loaded.offer.lang,
          currency: loaded.offer.currency,
          status: loaded.offer.status,
          issueDate: loaded.offer.issue_date,
        },
        revisions: loaded.revisions.map((revision) => ({
          id: revision.id,
          rev_no: revision.rev_no,
          label: revision.label,
          status: revision.status,
          total_amount:
            revision.total_amount === null ? null : Number(revision.total_amount),
        })),
      });
    }
  );
}

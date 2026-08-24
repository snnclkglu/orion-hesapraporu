import { RevisionPageView } from "@/app/(app)/projects/[id]/revisions/[revId]/revision-page-view";
import { OFFER_REPORT_CONTEXT } from "@/lib/report-context";

export default function OfferCalculationRevisionPage(props: {
  params: Promise<{ id: string; revId: string }>;
}) {
  return <RevisionPageView {...props} expectedContext={OFFER_REPORT_CONTEXT} />;
}

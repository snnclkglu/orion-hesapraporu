import { ProjectPageView } from "@/app/(app)/projects/[id]/project-page-view";
import { OFFER_REPORT_CONTEXT } from "@/lib/report-context";

export default function OfferCalculationReportPage(props: {
  params: Promise<{ id: string }>;
}) {
  return <ProjectPageView {...props} expectedContext={OFFER_REPORT_CONTEXT} />;
}

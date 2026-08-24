import { OFFER_REPORT_CONTEXT } from "@/lib/report-context";
import { ProjectListPage } from "@/app/(app)/projects/project-list-page";

export const dynamic = "force-dynamic";

export default function OfferCalculationReportsPage() {
  return <ProjectListPage context={OFFER_REPORT_CONTEXT} />;
}

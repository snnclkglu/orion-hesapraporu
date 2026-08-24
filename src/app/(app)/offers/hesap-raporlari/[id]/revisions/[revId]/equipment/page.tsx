import { EquipmentPageView } from "@/app/(app)/projects/[id]/revisions/[revId]/equipment/equipment-page-view";
import { OFFER_REPORT_CONTEXT } from "@/lib/report-context";

export default function OfferCalculationEquipmentPage(props: {
  params: Promise<{ id: string; revId: string }>;
}) {
  return <EquipmentPageView {...props} expectedContext={OFFER_REPORT_CONTEXT} />;
}

import { ENGINEERING_REPORT_CONTEXT } from "@/lib/report-context";
import { EquipmentPageView } from "./equipment-page-view";

export default function EquipmentPage(props: {
  params: Promise<{ id: string; revId: string }>;
}) {
  return <EquipmentPageView {...props} expectedContext={ENGINEERING_REPORT_CONTEXT} />;
}

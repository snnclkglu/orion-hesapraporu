import { ENGINEERING_REPORT_CONTEXT } from "@/lib/report-context";
import { RevisionPageView } from "./revision-page-view";

export default function RevisionPage(props: {
  params: Promise<{ id: string; revId: string }>;
}) {
  return <RevisionPageView {...props} expectedContext={ENGINEERING_REPORT_CONTEXT} />;
}

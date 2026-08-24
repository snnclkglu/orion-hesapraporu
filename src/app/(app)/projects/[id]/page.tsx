import { ENGINEERING_REPORT_CONTEXT } from "@/lib/report-context";
import { ProjectPageView } from "./project-page-view";

export default function ProjectPage(props: { params: Promise<{ id: string }> }) {
  return <ProjectPageView {...props} expectedContext={ENGINEERING_REPORT_CONTEXT} />;
}

import { ENGINEERING_REPORT_CONTEXT } from "@/lib/report-context";
import { ProjectListPage } from "./project-list-page";

export default function ProjectsPage() {
  return <ProjectListPage context={ENGINEERING_REPORT_CONTEXT} />;
}

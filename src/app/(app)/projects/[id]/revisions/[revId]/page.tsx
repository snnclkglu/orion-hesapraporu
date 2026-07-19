import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { RevisionEditor } from "./revision-editor";
import { IssueRevisionButton } from "./issue-button";
import {
  calcInputFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";

export default async function RevisionPage({
  params,
}: {
  params: Promise<{ id: string; revId: string }>;
}) {
  const { id, revId } = await params;
  const supabase = await createClient();

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, rev_no, label, status, inputs, selections, results, engine_version")
    .eq("id", revId)
    .eq("project_id", id)
    .single();

  if (!revision) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("doc_no, name, customer")
    .eq("id", id)
    .single();

  // Boş revizyon V5 şablonuyla başlar; kayıtlı revizyon kendi snapshot'ını yükler.
  const inputs = revision.inputs as RevisionInputsJson;
  const selections = revision.selections as RevisionSelectionsJson;
  const initial = calcInputFromRevision(inputs, selections);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link href="/projects" className="hover:underline">Projeler</Link>
            {" / "}
            <Link href={`/projects/${id}`} className="hover:underline">
              {project?.doc_no}
            </Link>
            {" / "}
            <span className="font-mono">V{revision.rev_no}</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {project?.name}{" "}
            <span className="text-muted-foreground font-normal">— {project?.customer}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/projects/${id}/revisions/${revision.id}/report`}
            className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            PDF Rapor
          </a>
          <a
            href={`/projects/${id}/revisions/${revision.id}/equipment`}
            className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            Ekipman Listesi
          </a>
          <Badge variant={revision.status === "issued" ? "default" : "secondary"}>
            {revision.status === "issued" ? "yayınlandı" : "taslak"}
          </Badge>
          {revision.status === "draft" && (
            <IssueRevisionButton
              projectId={id}
              revisionId={revision.id}
              revNo={revision.rev_no}
              defaultLabel={revision.label || `V${revision.rev_no}`}
              failingChecks={
                ((revision.results as { allChecks?: { pass: boolean }[] } | null)?.allChecks ?? [])
                  .filter((c) => !c.pass).length
              }
            />
          )}
        </div>
      </div>

      <RevisionEditor
        projectId={id}
        revisionId={revision.id}
        readOnly={revision.status === "issued"}
        initial={initial}
        initialAlts={selections?.alts}
      />
    </div>
  );
}

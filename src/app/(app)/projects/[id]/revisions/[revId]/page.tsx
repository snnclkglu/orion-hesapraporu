import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { RevisionEditor } from "./revision-editor";
import {
  V5_TEMPLATE,
} from "@/lib/calc/defaults";
import type { CalcInput } from "@/lib/calc/engine";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { TechnicalSpecs } from "@/lib/calc/types";

export default async function RevisionPage({
  params,
}: {
  params: Promise<{ id: string; revId: string }>;
}) {
  const { id, revId } = await params;
  const supabase = await createClient();

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, rev_no, label, status, inputs, selections, engine_version")
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
  const inputs = revision.inputs as {
    specs?: TechnicalSpecs;
    mainHoist?: HoistInputs | null;
    auxHoist?: HoistInputs | null;
  };
  const selections = revision.selections as {
    mainHoist?: HoistSelections | null;
    auxHoist?: HoistSelections | null;
    alts?: Record<string, { active: number; options: Record<string, unknown>[] }>;
  };

  const initial: CalcInput = {
    specs: inputs?.specs ?? V5_TEMPLATE.specs,
    mainHoist: {
      inputs: inputs?.mainHoist ?? V5_TEMPLATE.mainHoist!.inputs,
      selections: selections?.mainHoist ?? V5_TEMPLATE.mainHoist!.selections,
    },
    auxHoist: {
      inputs: inputs?.auxHoist ?? V5_TEMPLATE.auxHoist!.inputs,
      selections: selections?.auxHoist ?? V5_TEMPLATE.auxHoist!.selections,
    },
  };

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
        <Badge variant={revision.status === "issued" ? "default" : "secondary"}>
          {revision.status === "issued" ? "yayınlandı" : "taslak"}
        </Badge>
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

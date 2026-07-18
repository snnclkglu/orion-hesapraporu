import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { RevisionEditor } from "./revision-editor";
import { IssueRevisionButton } from "./issue-button";
import {
  V5_TEMPLATE,
} from "@/lib/calc/defaults";
import type { CalcInput } from "@/lib/calc/engine";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { HookBlockInputs, HookBlockSelections } from "@/lib/calc/modules/hookBlock";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderInputs, GirderSelections } from "@/lib/calc/modules/mainGirder";
import type { BucklingInputs } from "@/lib/calc/modules/buckling";
import type { EndCarriageInputs, EndCarriageSelections } from "@/lib/calc/modules/endCarriage";
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
  const inputs = revision.inputs as {
    specs?: TechnicalSpecs;
    mainHoist?: HoistInputs | null;
    auxHoist?: HoistInputs | null;
    hookBlock?: HookBlockInputs | null;
    trolley?: TravelInputs | null;
    bridge?: TravelInputs | null;
    girder?: GirderInputs | null;
    buckling?: BucklingInputs | null;
    endCarriage?: EndCarriageInputs | null;
  };
  const selections = revision.selections as {
    mainHoist?: HoistSelections | null;
    auxHoist?: HoistSelections | null;
    hookBlock?: HookBlockSelections | null;
    trolley?: TravelSelections | null;
    bridge?: TravelSelections | null;
    girder?: GirderSelections | null;
    endCarriage?: EndCarriageSelections | null;
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
    hookBlock: {
      inputs: inputs?.hookBlock ?? V5_TEMPLATE.hookBlock!.inputs,
      selections: selections?.hookBlock ?? V5_TEMPLATE.hookBlock!.selections,
    },
    trolley: {
      inputs: inputs?.trolley ?? V5_TEMPLATE.trolley!.inputs,
      selections: selections?.trolley ?? V5_TEMPLATE.trolley!.selections,
    },
    bridge: {
      inputs: inputs?.bridge ?? V5_TEMPLATE.bridge!.inputs,
      selections: selections?.bridge ?? V5_TEMPLATE.bridge!.selections,
    },
    girder: {
      inputs: inputs?.girder ?? V5_TEMPLATE.girder!.inputs,
      selections: selections?.girder ?? V5_TEMPLATE.girder!.selections,
    },
    buckling: {
      inputs: inputs?.buckling ?? V5_TEMPLATE.buckling!.inputs,
    },
    endCarriage: {
      inputs: inputs?.endCarriage ?? V5_TEMPLATE.endCarriage!.inputs,
      selections: selections?.endCarriage ?? V5_TEMPLATE.endCarriage!.selections,
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
        <div className="flex items-center gap-2">
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

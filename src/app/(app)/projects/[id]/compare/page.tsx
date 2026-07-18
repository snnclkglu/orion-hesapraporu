// Revizyon karşılaştırma: iki revizyonun girdi/seçim farkları ve
// kontrol durumu değişimleri (✓→✗ / ✗→✓), modül bazında gruplu.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { diffRevisions } from "@/lib/revision-diff";
import { MODULE_LABELS, fieldLabel } from "@/lib/calc/labels";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RevisionPicker } from "./revision-picker";
import type { AnyCheck } from "@/lib/calc/types";

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
  return String(v);
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id } = await params;
  const { a: aId, b: bId } = await searchParams;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const { data: revisions } = await supabase
    .from("revisions")
    .select("id, rev_no, label, status, created_at")
    .eq("project_id", id)
    .order("rev_no", { ascending: true });

  const revList = revisions ?? [];
  if (revList.length < 2) {
    return (
      <div className="grid gap-4">
        <Header project={project} />
        <p className="text-sm text-muted-foreground">
          Karşılaştırma için en az iki revizyon gerekir.
        </p>
      </div>
    );
  }

  // Varsayılan: son iki revizyon
  const defaultA = revList[revList.length - 2].id;
  const defaultB = revList[revList.length - 1].id;
  const selA = revList.find((r) => r.id === aId)?.id ?? defaultA;
  const selB = revList.find((r) => r.id === bId)?.id ?? defaultB;

  const [{ data: revA }, { data: revB }] = await Promise.all([
    supabase.from("revisions").select("rev_no, inputs, selections, results").eq("id", selA).single(),
    supabase.from("revisions").select("rev_no, inputs, selections, results").eq("id", selB).single(),
  ]);
  if (!revA || !revB) notFound();

  const diff = diffRevisions(
    {
      inputs: revA.inputs as Record<string, unknown>,
      selections: revA.selections as Record<string, unknown>,
      results: revA.results as { allChecks?: AnyCheck[]; engineVersion?: string },
    },
    {
      inputs: revB.inputs as Record<string, unknown>,
      selections: revB.selections as Record<string, unknown>,
      results: revB.results as { allChecks?: AnyCheck[]; engineVersion?: string },
    }
  );

  const byModule = new Map<string, typeof diff.fields>();
  for (const f of diff.fields) {
    if (!byModule.has(f.module)) byModule.set(f.module, []);
    byModule.get(f.module)!.push(f);
  }
  const moduleOrder = Object.keys(MODULE_LABELS);
  const sortedModules = [...byModule.keys()].sort(
    (x, y) => moduleOrder.indexOf(x) - moduleOrder.indexOf(y)
  );

  return (
    <div className="grid gap-5">
      <Header project={project} />
      <RevisionPicker projectId={id} revisions={revList} selectedA={selA} selectedB={selB} />

      {diff.engineVersionA !== diff.engineVersionB && (
        <p className="text-xs text-muted-foreground">
          Motor sürümleri farklı: V{revA.rev_no} → {diff.engineVersionA || "—"} ·{" "}
          V{revB.rev_no} → {diff.engineVersionB || "—"}
        </p>
      )}

      {diff.checks.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold">Kontrol Durumu Değişimleri ({diff.checks.length})</h2>
          {diff.checks.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>{c.label}</span>
              <span className="flex items-center gap-2 font-mono text-xs">
                <StatusBadge pass={c.aPass} rev={revA.rev_no} />
                →
                <StatusBadge pass={c.bPass} rev={revB.rev_no} />
              </span>
            </div>
          ))}
        </section>
      )}

      {sortedModules.length === 0 && diff.checks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          İki revizyon arasında girdi, seçim veya kontrol farkı yok.
        </p>
      ) : (
        sortedModules.map((mk) => (
          <section key={mk} className="grid gap-2">
            <h2 className="text-sm font-semibold">{MODULE_LABELS[mk] ?? mk}</h2>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alan</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead className="text-right">V{revA.rev_no}</TableHead>
                    <TableHead className="text-right">V{revB.rev_no}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byModule.get(mk)!.map((f) => {
                    const fl = fieldLabel(f.key.split(".").pop()!);
                    return (
                      <TableRow key={`${f.kind}-${f.key}`}>
                        <TableCell>
                          {fl.label}
                          {fl.unit ? ` [${fl.unit}]` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {f.kind === "selection" ? "seçim" : "girdi"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {fmtVal(f.a)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {fmtVal(f.b)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Header({ project }: { project: { id: string; doc_no: string; name: string } }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">
        <Link href="/projects" className="hover:underline">Projeler</Link>
        {" / "}
        <Link href={`/projects/${project.id}`} className="hover:underline">
          <span className="font-mono">{project.doc_no}</span>
        </Link>
        {" / Karşılaştırma"}
      </div>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">
        Revizyon Karşılaştırma — {project.name}
      </h1>
    </div>
  );
}

function StatusBadge({ pass, rev }: { pass: boolean | null; rev: number }) {
  if (pass === null) return <Badge variant="outline">V{rev}: yok</Badge>;
  return (
    <Badge variant={pass ? "default" : "destructive"}>
      V{rev}: {pass ? "✓" : "✗"}
    </Badge>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { NewRevisionButton } from "./new-revision-button";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name, customer, crane_type, status, created_at")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: revisions } = await supabase
    .from("revisions")
    .select("id, rev_no, label, status, engine_version, created_at, issued_at, created_by, profiles:created_by(full_name)")
    .eq("project_id", id)
    .order("rev_no", { ascending: false });

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link href="/projects" className="hover:underline">Projeler</Link>
            {" / "}
            <span className="font-mono">{project.doc_no}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.customer} · {project.crane_type}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            {revisions?.[0]?.status === "draft" && (
              <Link
                href={`/projects/${project.id}/revisions/${revisions[0].id}`}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Düzenlemeye Devam (V{revisions[0].rev_no})
              </Link>
            )}
            <NewRevisionButton
              projectId={project.id}
              variant={revisions?.[0]?.status === "draft" ? "outline" : "default"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Yeni revizyon, son revizyonun kopyasıyla açılır — sıfırdan başlamaz.
          </p>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Revizyon</TableHead>
              <TableHead>Etiket</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Oluşturan</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead>Motor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(revisions ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">
                  <Link
                    href={`/projects/${project.id}/revisions/${r.id}`}
                    className="text-primary hover:underline"
                  >
                    V{r.rev_no}
                  </Link>
                </TableCell>
                <TableCell>{r.label}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "issued" ? "default" : "secondary"}>
                    {r.status === "issued" ? "yayınlandı" : "taslak"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {(r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("tr-TR")}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.engine_version || "—"}
                </TableCell>
              </TableRow>
            ))}
            {(revisions ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Henüz revizyon yok. &quot;Yeni Revizyon&quot; ile başlayın.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

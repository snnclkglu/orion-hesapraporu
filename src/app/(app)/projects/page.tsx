import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { NewProjectDialog } from "./new-project-dialog";
import { getReportSettings } from "@/lib/settings";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [{ data: projects }, settings] = await Promise.all([
    supabase
      .from("projects")
      .select("id, doc_no, name, customer, crane_type, status, created_at, revisions(rev_no, status)")
      .order("created_at", { ascending: false }),
    getReportSettings(supabase),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projeler</h1>
          <p className="text-sm text-muted-foreground">Hesap raporu projeleri ve revizyon arşivi</p>
        </div>
        <NewProjectDialog defaultCraneType={settings.default_crane_type} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doküman No</TableHead>
              <TableHead>Proje</TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead>Vinç Tipi</TableHead>
              <TableHead>Son Revizyon</TableHead>
              <TableHead>Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(projects ?? []).map((p) => {
              const lastRev = [...(p.revisions ?? [])].sort((a, b) => b.rev_no - a.rev_no)[0];
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">
                    <Link href={`/projects/${p.id}`} className="text-primary hover:underline">
                      {p.doc_no}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.customer}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.crane_type}</TableCell>
                  <TableCell>
                    {lastRev ? (
                      <span className="text-sm">
                        V{lastRev.rev_no}{" "}
                        <Badge variant={lastRev.status === "issued" ? "default" : "secondary"} className="ml-1">
                          {lastRev.status === "issued" ? "yayınlandı" : "taslak"}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "active" ? "outline" : "secondary"}>
                      {p.status === "active" ? "aktif" : "arşiv"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {(projects ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Henüz proje yok. &quot;Yeni Proje&quot; ile başlayın.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// İşlem kaydı (audit log): proje üzerindeki tüm aksiyonların izi.
// Kayıtlar insert-only'dir; kim, ne zaman, ne yaptı.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const ACTION_LABELS: Record<string, string> = {
  "project.create": "Proje oluşturuldu",
  "project.archive": "Proje arşivlendi",
  "project.unarchive": "Proje arşivden çıkarıldı",
  "revision.create": "Revizyon oluşturuldu",
  "revision.save": "Revizyon kaydedildi",
  "revision.issue": "Revizyon yayınlandı",
  "revision.template_set": "Şablon yapıldı",
  "revision.template_unset": "Şablon kaldırıldı",
  "drawing.create": "Çizim eklendi",
  "drawing.update": "Çizim güncellendi",
  "drawing.delete": "Çizim silindi",
};

function detailSummary(action: string, detail: Record<string, unknown>): string {
  const parts: string[] = [];
  if (detail.rev_no !== undefined) parts.push(`V${detail.rev_no}`);
  if (detail.label) parts.push(String(detail.label));
  if (detail.copied_from !== undefined && detail.copied_from !== null)
    parts.push(`V${detail.copied_from} kopyası`);
  if (detail.engine_version) parts.push(`motor v${detail.engine_version}`);
  if (detail.all_pass === false) parts.push("uygun olmayan kontroller var");
  if (detail.all_pass === true) parts.push("tüm kontroller uygun");
  if (detail.doc_no) parts.push(String(detail.doc_no));
  if (detail.drawing_no) parts.push(String(detail.drawing_no));
  if (detail.revision && action.startsWith("drawing."))
    parts.push(`Rev ${detail.revision}`);
  return parts.join(" · ");
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const { data: entries } = await supabase
    .from("audit_log")
    .select("id, action, detail, created_at, revision_id, profiles:actor(full_name)")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-sm text-muted-foreground">
          <Link href="/projects" className="hover:underline">Projeler</Link>
          {" / "}
          <Link href={`/projects/${id}`} className="hover:underline">
            <span className="font-mono">{project.doc_no}</span>
          </Link>
          {" / İşlem Kaydı"}
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          İşlem Kaydı — {project.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Son 200 kayıt. Kayıtlar silinemez ve değiştirilemez.
        </p>
      </div>

      {/* İşlem rozeti sarmaz (Badge tabanı `whitespace-nowrap`); dar telefonda
          tablo yine de kayabilir. Mobil tarayıcı kaydırma çubuğu çizmediği
          için tek ipucu bu nottur. */}
      <p className="text-[11px] text-muted-foreground md:hidden">
        → Tabloyu yana kaydırın
      </p>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {/* "Kullanıcı" mobilde işlem rozetinin altına iner; dört sütun
                + serbest metin detay telefonda tabloyu ~900px yapıyordu. */}
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead className="hidden md:table-cell">Kullanıcı</TableHead>
              <TableHead>İşlem</TableHead>
              <TableHead>Detay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(entries ?? []).map((e) => (
              <TableRow key={e.id}>
                {/* Tarih + saat mobilde sarsın: nowrap hâlinde tek başına
                    ~150px yiyordu. */}
                <TableCell className="text-sm whitespace-normal text-muted-foreground md:whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString("tr-TR")}
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">
                  {(e.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <Badge variant={e.action === "revision.issue" ? "default" : "outline"}>
                    {ACTION_LABELS[e.action] ?? e.action}
                  </Badge>
                  <div className="mt-0.5 text-[11px] text-muted-foreground md:hidden">
                    {(e.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
                  </div>
                </TableCell>
                {/* Serbest metin: taban `whitespace-nowrap`u devralınca uzun
                    detay tabloyu tek başına ~900px'e çıkarıyordu. */}
                <TableCell className="text-sm whitespace-normal text-muted-foreground md:min-w-[16rem]">
                  {detailSummary(e.action, (e.detail ?? {}) as Record<string, unknown>)}
                </TableCell>
              </TableRow>
            ))}
            {(entries ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Henüz kayıt yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
